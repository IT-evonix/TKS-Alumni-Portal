-- This file contains queries that have been applied to the development database 
-- and NEED to be applied to the PRODUCTION database before the next deployment.

-- =======================================================================
-- STEP 1: INITIALIZE NEW GAMIFICATION FEATURE
-- =======================================================================
-- Before running any ALTER statements, you must run the entire 
-- 'migrations/create_gamification_tables.sql' file in your production 
-- Supabase SQL Editor. This will create:
--   1. gamification_badges
--   2. user_scores
--   3. user_badges
--   4. gamification_point_rules (if applicable)

-- =======================================================================
-- STEP 2: APPLY NEW COLUMNS / PATCHES
-- =======================================================================
-- 1. Add shares_count to feed_posts
ALTER TABLE public.feed_posts ADD COLUMN IF NOT EXISTS shares_count INTEGER NOT NULL DEFAULT 0;

-- 2. Add job_score to gamification user_scores table (For tracking Alumni Job points)
ALTER TABLE public.user_scores ADD COLUMN IF NOT EXISTS job_score INTEGER NOT NULL DEFAULT 0;

-- 3. Seed point rules for job postings and job applications if they don't exist
INSERT INTO public.gamification_point_rules (action_key, points, description, category)
VALUES 
  ('job_post', 0, 'Points awarded for posting a new job opportunity', 'jobs'),
  ('job_apply', 0, 'Points awarded for applying to a job opportunity', 'jobs')
ON CONFLICT (action_key) DO NOTHING;

-- =======================================================================
-- STEP 3: INITIALIZE NEW ALUMNI MAP (HEATMAP) FEATURE
-- =======================================================================
-- You must also run the entire 'migrations/create_alumni_heatmap_indexes.sql' 
-- file in your production Supabase SQL Editor. This will:
--   1. Create necessary indexes for location-based search
--   2. Optimize the query performance for the Alumni Map / Heatmap feature
