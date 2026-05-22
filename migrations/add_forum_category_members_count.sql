-- Migration: Add members_count column to forum_categories table
-- This column stores the count of unique users who have participated in threads/posts within each category

-- Step 1: Add the members_count column to forum_categories table
ALTER TABLE forum_categories 
ADD COLUMN IF NOT EXISTS members_count INTEGER DEFAULT 0;

-- Step 2: Drop existing function if it exists (with different signature)
DROP FUNCTION IF EXISTS update_category_members_count(UUID);
DROP FUNCTION IF EXISTS update_category_members_count(TEXT);

-- Step 2: Create a function to calculate and update members_count for a category
CREATE OR REPLACE FUNCTION update_category_members_count(category_id_param TEXT)
RETURNS INTEGER AS $$
DECLARE
    v_member_count INTEGER;
BEGIN
    -- Count distinct users who have:
    -- 1. Created threads in this category
    -- 2. Posted replies in threads of this category
    WITH thread_authors AS (
        SELECT DISTINCT author_id
        FROM forum_threads
        WHERE category_id::TEXT = category_id_param
          AND author_id IS NOT NULL
    ),
    post_authors AS (
        SELECT DISTINCT fp.author_id
        FROM forum_posts fp
        INNER JOIN forum_threads ft ON fp.thread_id = ft.id
        WHERE ft.category_id::TEXT = category_id_param
          AND fp.author_id IS NOT NULL
    ),
    all_members AS (
        SELECT author_id FROM thread_authors
        UNION
        SELECT author_id FROM post_authors
    )
    SELECT COUNT(*) INTO v_member_count
    FROM all_members;

    -- Update the category with the calculated count
    UPDATE forum_categories
    SET members_count = COALESCE(v_member_count, 0)
    WHERE id::TEXT = category_id_param;

    RETURN COALESCE(v_member_count, 0);
END;
$$ LANGUAGE plpgsql;

-- Step 3: Update all existing categories with their current members_count
DO $$
DECLARE
    category_record RECORD;
BEGIN
    FOR category_record IN SELECT id FROM forum_categories LOOP
        PERFORM update_category_members_count(category_record.id::TEXT);
    END LOOP;
END $$;

-- Step 4: Drop existing trigger function if it exists
DROP FUNCTION IF EXISTS trigger_update_category_members_count();

-- Step 4: Create a trigger function to automatically update members_count when threads/posts are created
CREATE OR REPLACE FUNCTION trigger_update_category_members_count()
RETURNS TRIGGER AS $$
DECLARE
    category_id_val TEXT;
BEGIN
    -- Determine category_id based on the table being modified
    IF TG_TABLE_NAME = 'forum_threads' THEN
        category_id_val := NEW.category_id::TEXT;
    ELSIF TG_TABLE_NAME = 'forum_posts' THEN
        SELECT category_id::TEXT INTO category_id_val
        FROM forum_threads
        WHERE id::TEXT = NEW.thread_id::TEXT;
    END IF;

    -- Update members_count for the category
    IF category_id_val IS NOT NULL THEN
        PERFORM update_category_members_count(category_id_val);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create triggers to automatically update members_count
-- Trigger for new threads
DROP TRIGGER IF EXISTS update_members_count_on_thread_insert ON forum_threads;
CREATE TRIGGER update_members_count_on_thread_insert
    AFTER INSERT ON forum_threads
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_category_members_count();

-- Trigger for new posts
DROP TRIGGER IF EXISTS update_members_count_on_post_insert ON forum_posts;
CREATE TRIGGER update_members_count_on_post_insert
    AFTER INSERT ON forum_posts
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_category_members_count();

-- Step 6: Create index on members_count for better query performance (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_forum_categories_members_count ON forum_categories(members_count);

-- Verification query: Check the members_count for all categories
-- SELECT id, name, members_count FROM forum_categories ORDER BY members_count DESC;
