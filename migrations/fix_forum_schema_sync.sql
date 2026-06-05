-- Migration: Synchronize Forum Schema with Backend API (Safe/Idempotent Version)
-- This script fixes discrepancies between the database and server/routes.ts 

-- 1. FIX FORUM CATEGORIES
-- Add slug column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'forum_categories' AND column_name = 'slug') THEN
        ALTER TABLE forum_categories ADD COLUMN slug TEXT UNIQUE;
    END IF;
END $$;

-- Populate slugs if they are null
DO $$
BEGIN
    UPDATE forum_categories SET slug = LOWER(REPLACE(name, ' ', '-')) WHERE slug IS NULL;
END $$;

-- Set slug to NOT NULL if it isn't already
DO $$
BEGIN
    ALTER TABLE forum_categories ALTER COLUMN slug SET NOT NULL;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- Handle member_count vs members_count
DO $$
BEGIN
    -- If 'member_count' exists AND 'members_count' DOES NOT exist, rename it
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'forum_categories' AND column_name = 'member_count') AND 
       NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'forum_categories' AND column_name = 'members_count') THEN
        ALTER TABLE forum_categories RENAME COLUMN member_count TO members_count;
    -- If 'members_count' doesn't exist at all, add it
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'forum_categories' AND column_name = 'members_count') THEN
        ALTER TABLE forum_categories ADD COLUMN members_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- 2. FIX FORUM THREADS
-- Add slug column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'forum_threads' AND column_name = 'slug') THEN
        ALTER TABLE forum_threads ADD COLUMN slug TEXT;
    END IF;
END $$;

-- Rename view_count to views_count if needed
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'forum_threads' AND column_name = 'view_count') AND 
       NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'forum_threads' AND column_name = 'views_count') THEN
        ALTER TABLE forum_threads RENAME COLUMN view_count TO views_count;
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'forum_threads' AND column_name = 'views_count') THEN
        ALTER TABLE forum_threads ADD COLUMN views_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- Rename reply_count to posts_count if needed
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'forum_threads' AND column_name = 'reply_count') AND 
       NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'forum_threads' AND column_name = 'posts_count') THEN
        ALTER TABLE forum_threads RENAME COLUMN reply_count TO posts_count;
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'forum_threads' AND column_name = 'posts_count') THEN
        ALTER TABLE forum_threads ADD COLUMN posts_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- Populate slugs for existing threads
DO $$
BEGIN
    UPDATE forum_threads SET slug = LOWER(REGEXP_REPLACE(title, '[^a-zA-Z0-9]+', '-', 'g')) WHERE slug IS NULL;
END $$;

-- Set slug to NOT NULL if it isn't already
DO $$
BEGIN
    ALTER TABLE forum_threads ALTER COLUMN slug SET NOT NULL;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- 3. RENAME FORUM REPLIES TO FORUM POSTS (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'forum_replies') AND 
       NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'forum_posts') THEN
        ALTER TABLE forum_replies RENAME TO forum_posts;
    END IF;
END $$;

-- Ensure forum_posts has all required columns
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

-- 4. CREATE MISSING ACTIVITY TABLES
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
    "votable_type" text NOT NULL, -- 'thread' or 'post'
    "vote_type" text NOT NULL,     -- 'upvote' or 'downvote'
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
    "subscribable_type" text NOT NULL, -- 'thread' or 'category'
    "user_id" varchar NOT NULL,
    "created_at" timestamp DEFAULT now(),
    UNIQUE("user_id", "subscribable_id", "subscribable_type")
);

-- 5. ADD EXPLICIT FOREIGN KEY CONSTRAINTS WITH EXPECTED NAMES
-- For forum_threads
ALTER TABLE forum_threads DROP CONSTRAINT IF EXISTS forum_threads_author_id_fkey;
ALTER TABLE forum_threads ADD CONSTRAINT forum_threads_author_id_fkey 
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE forum_threads DROP CONSTRAINT IF EXISTS forum_threads_category_id_fkey;
ALTER TABLE forum_threads ADD CONSTRAINT forum_threads_category_id_fkey 
    FOREIGN KEY (category_id) REFERENCES forum_categories(id) ON DELETE CASCADE;

-- For forum_posts
ALTER TABLE forum_posts DROP CONSTRAINT IF EXISTS forum_posts_author_id_fkey;
ALTER TABLE forum_posts ADD CONSTRAINT forum_posts_author_id_fkey 
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE forum_posts DROP CONSTRAINT IF EXISTS forum_posts_thread_id_fkey;
ALTER TABLE forum_posts ADD CONSTRAINT forum_posts_thread_id_fkey 
    FOREIGN KEY (thread_id) REFERENCES forum_threads(id) ON DELETE CASCADE;

-- 6. CREATE RPC FUNCTIONS
CREATE OR REPLACE FUNCTION increment_reputation(
    p_user_id TEXT, 
    p_points INTEGER, 
    p_threads_increment INTEGER DEFAULT 0, 
    p_posts_increment INTEGER DEFAULT 0
) RETURNS VOID AS $$
BEGIN
    -- Reputation logic placeholder
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
