-- ==============================================================================
-- MIGRATION SCRIPT FOR PRODUCTION: GAMIFICATION & HEATMAP/LOCATION MODULES
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. HEATMAP & LOCATION EXPORT MODULE
-- ------------------------------------------------------------------------------
-- Add location coordinate columns to the alumni table if they don't exist
ALTER TABLE public.alumni ADD COLUMN IF NOT EXISTS latitude NUMERIC;
ALTER TABLE public.alumni ADD COLUMN IF NOT EXISTS longitude NUMERIC;
ALTER TABLE public.alumni ADD COLUMN IF NOT EXISTS location_label TEXT;


-- ------------------------------------------------------------------------------
-- 2. GAMIFICATION MODULE (POINTS & BADGES)
-- ------------------------------------------------------------------------------

-- Create gamification_badges table
CREATE TABLE IF NOT EXISTS public.gamification_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'common', -- 'common', 'series'
    series_type TEXT, -- 'login', 'profile', 'thread', 'event', 'connection'
    required_score INTEGER DEFAULT 0,
    tier TEXT, -- 'bronze', 'silver', 'gold', 'platinum'
    icon_url TEXT,
    is_enabled BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create gamification_point_rules table
CREATE TABLE IF NOT EXISTS public.gamification_point_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_key TEXT NOT NULL UNIQUE,
    points INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    category TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create user_scores table to track points and streaks
CREATE TABLE IF NOT EXISTS public.user_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    total_points INTEGER DEFAULT 0,
    thread_score INTEGER DEFAULT 0,
    event_score INTEGER DEFAULT 0,
    connection_score INTEGER DEFAULT 0,
    job_score INTEGER DEFAULT 0,
    current_streak_days INTEGER DEFAULT 0,
    highest_streak INTEGER DEFAULT 0,
    last_active_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id)
);

-- Create user_badges mapping table for awarded badges
CREATE TABLE IF NOT EXISTS public.user_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    badge_id UUID NOT NULL REFERENCES public.gamification_badges(id) ON DELETE CASCADE,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    is_featured BOOLEAN DEFAULT false,
    UNIQUE(user_id, badge_id)
);

-- Enable Realtime for Gamification Tables
-- Note: This is required if you want websocket postgres_changes to fire.
-- It's okay if this throws a warning if the publication already exists.
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR ALL TABLES;
COMMIT;
-- Alternatively, if you only want specific tables in realtime:
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.user_scores;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.user_badges;


-- ------------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------

-- Enable RLS
ALTER TABLE public.gamification_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_point_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- gamification_badges policies
DROP POLICY IF EXISTS "Enable read access for all users" ON public.gamification_badges;
CREATE POLICY "Enable read access for all users" ON public.gamification_badges FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable all access for admins" ON public.gamification_badges;
CREATE POLICY "Enable all access for admins" ON public.gamification_badges FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid()::text AND users.user_role = 'administrator')
);

-- gamification_point_rules policies
DROP POLICY IF EXISTS "Enable read access for all users on point rules" ON public.gamification_point_rules;
CREATE POLICY "Enable read access for all users on point rules" ON public.gamification_point_rules FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable all access for admins on point rules" ON public.gamification_point_rules;
CREATE POLICY "Enable all access for admins on point rules" ON public.gamification_point_rules FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid()::text AND users.user_role = 'administrator')
);

-- user_scores policies
DROP POLICY IF EXISTS "Enable read access for all users on user_scores" ON public.user_scores;
CREATE POLICY "Enable read access for all users on user_scores" ON public.user_scores FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable update for users on user_scores" ON public.user_scores;
CREATE POLICY "Enable update for users on user_scores" ON public.user_scores FOR UPDATE USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Enable insert for users on user_scores" ON public.user_scores;
CREATE POLICY "Enable insert for users on user_scores" ON public.user_scores FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- user_badges policies
DROP POLICY IF EXISTS "Enable read access for all users on user_badges" ON public.user_badges;
CREATE POLICY "Enable read access for all users on user_badges" ON public.user_badges FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable update for users on user_badges" ON public.user_badges;
CREATE POLICY "Enable update for users on user_badges" ON public.user_badges FOR UPDATE USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Enable insert for users on user_badges" ON public.user_badges;
CREATE POLICY "Enable insert for users on user_badges" ON public.user_badges FOR INSERT WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Enable delete for users on user_badges" ON public.user_badges;
CREATE POLICY "Enable delete for users on user_badges" ON public.user_badges FOR DELETE USING (auth.uid()::text = user_id);


-- ------------------------------------------------------------------------------
-- 4. SEED DEFAULT DATA
-- ------------------------------------------------------------------------------

-- Insert default badges (Login Streak Series, Profile, Thread, Event, Connection)
-- Login Streak
INSERT INTO public.gamification_badges (name, description, category, series_type, required_score, tier, icon_url, is_enabled, display_order)
SELECT 'Login Streak', 'Maintained a consecutive daily login streak.', 'series', 'login', 1, 'bronze', '🎯', true, 1
WHERE NOT EXISTS (SELECT 1 FROM public.gamification_badges WHERE name = 'Login Streak' AND tier = 'bronze');

INSERT INTO public.gamification_badges (name, description, category, series_type, required_score, tier, icon_url, is_enabled, display_order)
SELECT 'Login Streak', 'Maintained a consecutive daily login streak.', 'series', 'login', 7, 'silver', '🔥', true, 2
WHERE NOT EXISTS (SELECT 1 FROM public.gamification_badges WHERE name = 'Login Streak' AND tier = 'silver');

INSERT INTO public.gamification_badges (name, description, category, series_type, required_score, tier, icon_url, is_enabled, display_order)
SELECT 'Login Streak', 'Maintained a consecutive daily login streak.', 'series', 'login', 30, 'gold', '🔥', true, 3
WHERE NOT EXISTS (SELECT 1 FROM public.gamification_badges WHERE name = 'Login Streak' AND tier = 'gold');

INSERT INTO public.gamification_badges (name, description, category, series_type, required_score, tier, icon_url, is_enabled, display_order)
SELECT 'Login Streak', 'Maintained a consecutive daily login streak.', 'series', 'login', 100, 'platinum', '👑', true, 4
WHERE NOT EXISTS (SELECT 1 FROM public.gamification_badges WHERE name = 'Login Streak' AND tier = 'platinum');

-- Profile Pro
INSERT INTO public.gamification_badges (name, description, category, series_type, required_score, tier, icon_url, is_enabled, display_order)
SELECT 'Profile Pro', 'Completed your alumni profile with all key details.', 'common', 'profile', 0, 'bronze', '⭐', true, 2
WHERE NOT EXISTS (SELECT 1 FROM public.gamification_badges WHERE series_type = 'profile');

-- Insert default point rules
INSERT INTO public.gamification_point_rules (action_key, points, description, category)
SELECT 'network_connect', 1, 'Points awarded for connecting with another alumni', 'networking'
WHERE NOT EXISTS (SELECT 1 FROM public.gamification_point_rules WHERE action_key = 'network_connect');

INSERT INTO public.gamification_point_rules (action_key, points, description, category)
SELECT 'thread_create', 1, 'Points awarded for creating a new community thread', 'community'
WHERE NOT EXISTS (SELECT 1 FROM public.gamification_point_rules WHERE action_key = 'thread_create');

INSERT INTO public.gamification_point_rules (action_key, points, description, category)
SELECT 'post_reply', 1, 'Points awarded for replying to a thread or post', 'community'
WHERE NOT EXISTS (SELECT 1 FROM public.gamification_point_rules WHERE action_key = 'post_reply');

INSERT INTO public.gamification_point_rules (action_key, points, description, category)
SELECT 'feed_create', 1, 'Points awarded for creating a post on the main feed', 'community'
WHERE NOT EXISTS (SELECT 1 FROM public.gamification_point_rules WHERE action_key = 'feed_create');

INSERT INTO public.gamification_point_rules (action_key, points, description, category)
SELECT 'event_rsvp', 1, 'Points awarded for RSVPing to an event', 'events'
WHERE NOT EXISTS (SELECT 1 FROM public.gamification_point_rules WHERE action_key = 'event_rsvp');

INSERT INTO public.gamification_point_rules (action_key, points, description, category)
SELECT 'job_post', 1, 'Points awarded for posting a new job opportunity', 'jobs'
WHERE NOT EXISTS (SELECT 1 FROM public.gamification_point_rules WHERE action_key = 'job_post');

INSERT INTO public.gamification_point_rules (action_key, points, description, category)
SELECT 'job_apply', 1, 'Points awarded for applying to a job opportunity', 'jobs'
WHERE NOT EXISTS (SELECT 1 FROM public.gamification_point_rules WHERE action_key = 'job_apply');

-- ==============================================================================
-- MIGRATION COMPLETE
-- ==============================================================================
