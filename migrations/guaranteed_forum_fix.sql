-- Migration: Guaranteed Forum Fix (Comprehensive Synchronization)
-- This script ensures all forum tables, columns, types, and triggers match the application logic perfectly.

-- 1. FIX FORUM CATEGORIES
DO $$
BEGIN
    -- Add slug if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'forum_categories' AND column_name = 'slug') THEN
        ALTER TABLE forum_categories ADD COLUMN slug TEXT;
    END IF;
    
    -- Standardize members_count name
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'forum_categories' AND column_name = 'member_count') AND 
       NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'forum_categories' AND column_name = 'members_count') THEN
        ALTER TABLE forum_categories RENAME COLUMN member_count TO members_count;
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'forum_categories' AND column_name = 'members_count') THEN
        ALTER TABLE forum_categories ADD COLUMN members_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- Populate slugs
UPDATE forum_categories SET slug = LOWER(REPLACE(name, ' ', '-')) WHERE slug IS NULL;
ALTER TABLE forum_categories ALTER COLUMN slug SET NOT NULL;
ALTER TABLE forum_categories DROP CONSTRAINT IF EXISTS forum_categories_slug_unique;
ALTER TABLE forum_categories ADD CONSTRAINT forum_categories_slug_unique UNIQUE(slug);

-- 2. FIX FORUM THREADS
DO $$
BEGIN
    -- Add slug if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'forum_threads' AND column_name = 'slug') THEN
        ALTER TABLE forum_threads ADD COLUMN slug TEXT;
    END IF;

    -- Fix tags type (CRITICAL: MUST BE TEXT[] ARRAY)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'forum_threads' AND column_name = 'tags') THEN
        -- Only alter if it's currently text or varchar
        IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'forum_threads' AND column_name = 'tags') IN ('text', 'character varying') THEN
            ALTER TABLE forum_threads ALTER COLUMN tags TYPE TEXT[] USING string_to_array(tags, ',');
        END IF;
    ELSE
        ALTER TABLE forum_threads ADD COLUMN tags TEXT[] DEFAULT '{}';
    END IF;

    -- Rename view_count to views_count
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'forum_threads' AND column_name = 'view_count') AND 
       NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'forum_threads' AND column_name = 'views_count') THEN
        ALTER TABLE forum_threads RENAME COLUMN view_count TO views_count;
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'forum_threads' AND column_name = 'views_count') THEN
        ALTER TABLE forum_threads ADD COLUMN views_count INTEGER DEFAULT 0;
    END IF;

    -- Rename reply_count to posts_count
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'forum_threads' AND column_name = 'reply_count') AND 
       NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'forum_threads' AND column_name = 'posts_count') THEN
        ALTER TABLE forum_threads RENAME COLUMN reply_count TO posts_count;
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'forum_threads' AND column_name = 'posts_count') THEN
        ALTER TABLE forum_threads ADD COLUMN posts_count INTEGER DEFAULT 0;
    END IF;

    -- Ensure last_activity_at exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'forum_threads' AND column_name = 'last_activity_at') THEN
        ALTER TABLE forum_threads ADD COLUMN last_activity_at TIMESTAMP DEFAULT now();
    END IF;
END $$;

-- Populate slugs for existing threads
UPDATE forum_threads SET slug = LOWER(REGEXP_REPLACE(title, '[^a-zA-Z0-9]+', '-', 'g')) WHERE slug IS NULL;
ALTER TABLE forum_threads ALTER COLUMN slug SET NOT NULL;

-- 3. FIX FORUM POSTS (RENAME FROM REPLIES)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'forum_replies') AND 
       NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'forum_posts') THEN
        ALTER TABLE forum_replies RENAME TO forum_posts;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "forum_posts" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "thread_id" varchar NOT NULL,
    "author_id" varchar NOT NULL,
    "content" text NOT NULL,
    "parent_id" varchar,
    "is_edited" boolean DEFAULT false,
    "edit_count" integer DEFAULT 0,
    "last_edited_at" timestamp,
    "is_deleted" boolean DEFAULT false,
    "deleted_by" varchar,
    "deleted_at" timestamp,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now()
);

-- Fix parent_id vs parent_reply_id
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'forum_posts' AND column_name = 'parent_reply_id') AND 
       NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'forum_posts' AND column_name = 'parent_id') THEN
        ALTER TABLE forum_posts RENAME COLUMN parent_reply_id TO parent_id;
    END IF;
END $$;

-- 4. ACTIVITY TABLES
CREATE TABLE IF NOT EXISTS "forum_thread_views" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "thread_id" varchar NOT NULL,
    "user_id" varchar NOT NULL,
    "created_at" timestamp DEFAULT now(),
    UNIQUE("thread_id", "user_id")
);

CREATE TABLE IF NOT EXISTS "forum_votes" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" varchar NOT NULL,
    "votable_id" varchar NOT NULL,
    "votable_type" text NOT NULL,
    "vote_type" text NOT NULL,
    "created_at" timestamp DEFAULT now(),
    UNIQUE("user_id", "votable_id", "votable_type")
);

CREATE TABLE IF NOT EXISTS "forum_bookmarks" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "thread_id" varchar NOT NULL,
    "user_id" varchar NOT NULL,
    "created_at" timestamp DEFAULT now(),
    UNIQUE("thread_id", "user_id")
);

CREATE TABLE IF NOT EXISTS "forum_subscriptions" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "subscribable_id" varchar NOT NULL,
    "subscribable_type" text NOT NULL,
    "user_id" varchar NOT NULL,
    "created_at" timestamp DEFAULT now(),
    UNIQUE("user_id", "subscribable_id", "subscribable_type")
);

-- 5. FOREIGN KEY CONSTRAINTS (EXPLICIT NAMES)
DO $$
BEGIN
    ALTER TABLE IF EXISTS forum_threads DROP CONSTRAINT IF EXISTS forum_threads_author_id_fkey;
    ALTER TABLE IF EXISTS forum_threads ADD CONSTRAINT forum_threads_author_id_fkey 
        FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE;

    ALTER TABLE IF EXISTS forum_threads DROP CONSTRAINT IF EXISTS forum_threads_category_id_fkey;
    ALTER TABLE IF EXISTS forum_threads ADD CONSTRAINT forum_threads_category_id_fkey 
        FOREIGN KEY (category_id) REFERENCES forum_categories(id) ON DELETE CASCADE;

    ALTER TABLE IF EXISTS forum_posts DROP CONSTRAINT IF EXISTS forum_posts_author_id_fkey;
    ALTER TABLE IF EXISTS forum_posts ADD CONSTRAINT forum_posts_author_id_fkey 
        FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE;

    ALTER TABLE IF EXISTS forum_posts DROP CONSTRAINT IF EXISTS forum_posts_thread_id_fkey;
    ALTER TABLE IF EXISTS forum_posts ADD CONSTRAINT forum_posts_thread_id_fkey 
        FOREIGN KEY (thread_id) REFERENCES forum_threads(id) ON DELETE CASCADE;
END $$;

-- 6. RPC FUNCTIONS
CREATE OR REPLACE FUNCTION increment_reputation(
    p_user_id TEXT, 
    p_points INTEGER, 
    p_threads_increment INTEGER DEFAULT 0, 
    p_posts_increment INTEGER DEFAULT 0
) RETURNS VOID AS $$
BEGIN
    UPDATE users 
    SET reputation = COALESCE(reputation, 0) + p_points
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_vote_count(
    p_table TEXT,
    p_id TEXT,
    p_field TEXT
) RETURNS VOID AS $$
BEGIN
    EXECUTE format('UPDATE %I SET %I = GREATEST(%I - 1, 0) WHERE id = %L', p_table, p_field, p_field, p_id);
END;
$$ LANGUAGE plpgsql;

-- 7. RECREATE TRIGGERS (SOFT RESET)
DROP TRIGGER IF EXISTS update_members_count_on_thread_insert ON forum_threads;
DROP TRIGGER IF EXISTS update_members_count_on_post_insert ON forum_posts;

CREATE OR REPLACE FUNCTION trigger_update_category_members_count()
RETURNS TRIGGER AS $$
DECLARE
    category_id_val TEXT;
BEGIN
    IF TG_TABLE_NAME = 'forum_threads' THEN
        category_id_val := NEW.category_id::TEXT;
    ELSIF TG_TABLE_NAME = 'forum_posts' THEN
        SELECT category_id::TEXT INTO category_id_val
        FROM forum_threads
        WHERE id = NEW.thread_id;
    END IF;

    IF category_id_val IS NOT NULL THEN
        -- Calculate new count
        PERFORM update_category_members_count(category_id_val);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_category_members_count(category_id_param TEXT)
RETURNS INTEGER AS $$
DECLARE
    v_member_count INTEGER;
BEGIN
    WITH all_members AS (
        SELECT author_id FROM forum_threads WHERE category_id = category_id_param
        UNION
        SELECT fp.author_id FROM forum_posts fp JOIN forum_threads ft ON fp.thread_id = ft.id WHERE ft.category_id = category_id_param
    )
    SELECT COUNT(*) INTO v_member_count FROM all_members;

    UPDATE forum_categories SET members_count = COALESCE(v_member_count, 0) WHERE id = category_id_param;
    RETURN v_member_count;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_members_count_on_thread_insert
    AFTER INSERT ON forum_threads FOR EACH ROW EXECUTE FUNCTION trigger_update_category_members_count();

CREATE TRIGGER update_members_count_on_post_insert
    AFTER INSERT ON forum_posts FOR EACH ROW EXECUTE FUNCTION trigger_update_category_members_count();
