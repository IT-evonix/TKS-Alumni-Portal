-- Migration: Fix Ambiguous Forum Members Count
-- Run this in the Supabase SQL Editor to resolve the 500 errors when creating new forum threads or posts.

-- The error "column reference \"member_count\" is ambiguous" occurs because 
-- the local variable `member_count` conflicts with the table column `member_count` 
-- that was added to `forum_categories`.

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
