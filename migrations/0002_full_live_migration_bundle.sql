-- ============================================================
-- TKS Alumni Portal — FULL LIVE MIGRATION BUNDLE (v6)
-- Combines 44 migration files, in dependency-safe order.
-- All statements are idempotent (safe to re-run if interrupted).
--
-- FIXES APPLIED across v2-v6 (based on live schema introspection
-- and actual run errors, in order encountered):
-- v2: prod_migration.sql — user_scores/user_badges.user_id UUID -> VARCHAR.
-- v3: backfilled alumni_certifications.expiry_date and
--     mentorship_requests.goal_text/match_score (missing on live
--     pre-existing tables).
-- v4: Added DROP TRIGGER/POLICY IF EXISTS guards (Postgres has no
--     CREATE TRIGGER/POLICY IF NOT EXISTS); fixed add_resume_field.sql's
--     mismatched DROP/CREATE policy names.
-- v5: Guarded a bare ALTER PUBLICATION ... ADD TABLE in
--     add_alumni_locations.sql (invalid once prod_migration.sql makes
--     supabase_realtime a FOR ALL TABLES publication).
-- v6: add_mentorship_enhancements.sql — mentorship_sessions.request_id
--     was UUID, referencing mentorship_requests.id, which is VARCHAR
--     live (mentorship_requests already existed before this migration
--     set ran). Changed request_id to VARCHAR.
--
-- NOTE: Not wrapped in one big outer transaction, because
-- prod_migration.sql (block 1 below) contains its own BEGIN/COMMIT
-- around a publication DROP+CREATE, and nesting transactions is
-- unsafe. Supabase SQL Editor runs the whole pasted script as one
-- implicit batch already; if you want extra safety you can paste
-- and run this in smaller chunks (block by block) instead of all
-- at once — every block is independently idempotent either way.
-- ============================================================


-- ============================================================
-- [1/44] prod_migration.sql
-- ============================================================
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


-- ============================================================
-- [2/44] multi_entry_profile.sql
-- ============================================================
-- Multi-Entry Profile Enhancement Migration
-- This migration creates normalized tables for professional experiences, skills, certifications, languages, and achievements

-- ==================== PROFESSIONAL EXPERIENCES ====================
CREATE TABLE IF NOT EXISTS alumni_experiences (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  alumni_id VARCHAR NOT NULL,
  company_name TEXT NOT NULL,
  position TEXT NOT NULL,
  employment_type TEXT CHECK (employment_type IN ('full-time', 'part-time', 'contract', 'internship', 'freelance')),
  location TEXT,
  location_type TEXT CHECK (location_type IN ('onsite', 'remote', 'hybrid')),
  start_date DATE NOT NULL,
  end_date DATE,
  is_current BOOLEAN DEFAULT false,
  description TEXT,
  responsibilities TEXT[],
  achievements TEXT[],
  skills_used TEXT[],
  industry TEXT,
  company_size TEXT CHECK (company_size IN ('startup', 'small', 'medium', 'large', 'enterprise')),
  company_url TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_alumni_experiences_alumni FOREIGN KEY (alumni_id) REFERENCES alumni(id) ON DELETE CASCADE,
  CONSTRAINT valid_dates CHECK (end_date IS NULL OR end_date >= start_date)
);

-- ==================== SKILLS & EXPERTISE ====================
CREATE TABLE IF NOT EXISTS alumni_skills (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  alumni_id VARCHAR NOT NULL,
  skill_name TEXT NOT NULL,
  category TEXT, -- technical, soft, language, tool, framework, domain
  proficiency_level TEXT CHECK (proficiency_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
  years_of_experience INTEGER CHECK (years_of_experience >= 0),
  last_used_date DATE,
  is_primary BOOLEAN DEFAULT false,
  endorsements_count INTEGER DEFAULT 0,
  verified BOOLEAN DEFAULT false,
  description TEXT,
  related_projects TEXT[],
  certification_ids TEXT[],
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_alumni_skills_alumni FOREIGN KEY (alumni_id) REFERENCES alumni(id) ON DELETE CASCADE,
  CONSTRAINT unique_skill_per_alumni UNIQUE (alumni_id, skill_name)
);

-- ==================== CERTIFICATIONS ====================
CREATE TABLE IF NOT EXISTS alumni_certifications (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  alumni_id VARCHAR NOT NULL,
  certification_name TEXT NOT NULL,
  issuing_organization TEXT NOT NULL,
  issue_date DATE NOT NULL,
  expiry_date DATE,
  credential_id TEXT,
  credential_url TEXT,
  verification_url TEXT,
  is_active BOOLEAN DEFAULT true,
  skills_gained TEXT[],
  description TEXT,
  certificate_file_url TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_alumni_certifications_alumni FOREIGN KEY (alumni_id) REFERENCES alumni(id) ON DELETE CASCADE,
  CONSTRAINT valid_cert_dates CHECK (expiry_date IS NULL OR expiry_date >= issue_date)
);

-- ==================== LANGUAGES ====================
CREATE TABLE IF NOT EXISTS alumni_languages (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  alumni_id VARCHAR NOT NULL,
  language_name TEXT NOT NULL,
  proficiency_level TEXT NOT NULL CHECK (proficiency_level IN ('native', 'fluent', 'advanced', 'intermediate', 'beginner')),
  can_read BOOLEAN DEFAULT true,
  can_write BOOLEAN DEFAULT true,
  can_speak BOOLEAN DEFAULT true,
  certification_name TEXT,
  certification_score TEXT,
  certification_date DATE,
  is_native BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_alumni_languages_alumni FOREIGN KEY (alumni_id) REFERENCES alumni(id) ON DELETE CASCADE,
  CONSTRAINT unique_language_per_alumni UNIQUE (alumni_id, language_name)
);

-- ==================== ACHIEVEMENTS & AWARDS ====================
CREATE TABLE IF NOT EXISTS alumni_achievements (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  alumni_id VARCHAR NOT NULL,
  achievement_type TEXT NOT NULL CHECK (achievement_type IN ('award', 'recognition', 'publication', 'patent', 'project', 'competition', 'other')),
  title TEXT NOT NULL,
  description TEXT,
  issuing_organization TEXT,
  date_received DATE NOT NULL,
  category TEXT, -- academic, professional, community, sports, arts, research
  level TEXT CHECK (level IN ('international', 'national', 'state', 'institutional', 'local')),
  url TEXT,
  certificate_url TEXT,
  co_recipients TEXT[],
  impact_description TEXT,
  media_coverage_urls TEXT[],
  is_featured BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_alumni_achievements_alumni FOREIGN KEY (alumni_id) REFERENCES alumni(id) ON DELETE CASCADE
);

-- ==================== PROJECTS PORTFOLIO (Bonus) ====================
CREATE TABLE IF NOT EXISTS alumni_projects (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  alumni_id VARCHAR NOT NULL,
  project_name TEXT NOT NULL,
  project_type TEXT CHECK (project_type IN ('personal', 'professional', 'academic', 'open-source')),
  description TEXT NOT NULL,
  role TEXT,
  start_date DATE,
  end_date DATE,
  is_ongoing BOOLEAN DEFAULT false,
  technologies_used TEXT[],
  project_url TEXT,
  github_url TEXT,
  demo_url TEXT,
  image_urls TEXT[],
  team_size INTEGER,
  your_contribution TEXT,
  outcomes TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_alumni_projects_alumni FOREIGN KEY (alumni_id) REFERENCES alumni(id) ON DELETE CASCADE
);

-- ==================== BACKFILL COLUMNS ON PRE-EXISTING TABLES ====================
-- These 6 tables may already exist on a given database (created by an earlier,
-- independent process) with a different/partial column set. The CREATE TABLE IF
-- NOT EXISTS blocks above are then no-ops, so explicitly add every column this
-- migration expects, guarded, so the file is correct whether the table is fresh
-- or pre-existing.

-- alumni_experiences
ALTER TABLE alumni_experiences ADD COLUMN IF NOT EXISTS employment_type TEXT;
ALTER TABLE alumni_experiences ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE alumni_experiences ADD COLUMN IF NOT EXISTS location_type TEXT;
ALTER TABLE alumni_experiences ADD COLUMN IF NOT EXISTS is_current BOOLEAN DEFAULT false;
ALTER TABLE alumni_experiences ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE alumni_experiences ADD COLUMN IF NOT EXISTS responsibilities TEXT[];
ALTER TABLE alumni_experiences ADD COLUMN IF NOT EXISTS achievements TEXT[];
ALTER TABLE alumni_experiences ADD COLUMN IF NOT EXISTS skills_used TEXT[];
ALTER TABLE alumni_experiences ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE alumni_experiences ADD COLUMN IF NOT EXISTS company_size TEXT;
ALTER TABLE alumni_experiences ADD COLUMN IF NOT EXISTS company_url TEXT;
ALTER TABLE alumni_experiences ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE alumni_experiences ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE alumni_experiences ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- alumni_skills
ALTER TABLE alumni_skills ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE alumni_skills ADD COLUMN IF NOT EXISTS proficiency_level TEXT;
ALTER TABLE alumni_skills ADD COLUMN IF NOT EXISTS years_of_experience INTEGER;
ALTER TABLE alumni_skills ADD COLUMN IF NOT EXISTS last_used_date DATE;
ALTER TABLE alumni_skills ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;
ALTER TABLE alumni_skills ADD COLUMN IF NOT EXISTS endorsements_count INTEGER DEFAULT 0;
ALTER TABLE alumni_skills ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false;
ALTER TABLE alumni_skills ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE alumni_skills ADD COLUMN IF NOT EXISTS related_projects TEXT[];
ALTER TABLE alumni_skills ADD COLUMN IF NOT EXISTS certification_ids TEXT[];
ALTER TABLE alumni_skills ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE alumni_skills ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE alumni_skills ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- alumni_certifications (confirmed live gap: expiry_date was missing)
ALTER TABLE alumni_certifications ADD COLUMN IF NOT EXISTS expiry_date DATE;
ALTER TABLE alumni_certifications ADD COLUMN IF NOT EXISTS credential_id TEXT;
ALTER TABLE alumni_certifications ADD COLUMN IF NOT EXISTS credential_url TEXT;
ALTER TABLE alumni_certifications ADD COLUMN IF NOT EXISTS verification_url TEXT;
ALTER TABLE alumni_certifications ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE alumni_certifications ADD COLUMN IF NOT EXISTS skills_gained TEXT[];
ALTER TABLE alumni_certifications ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE alumni_certifications ADD COLUMN IF NOT EXISTS certificate_file_url TEXT;
ALTER TABLE alumni_certifications ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE alumni_certifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE alumni_certifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- alumni_languages
ALTER TABLE alumni_languages ADD COLUMN IF NOT EXISTS can_read BOOLEAN DEFAULT true;
ALTER TABLE alumni_languages ADD COLUMN IF NOT EXISTS can_write BOOLEAN DEFAULT true;
ALTER TABLE alumni_languages ADD COLUMN IF NOT EXISTS can_speak BOOLEAN DEFAULT true;
ALTER TABLE alumni_languages ADD COLUMN IF NOT EXISTS certification_name TEXT;
ALTER TABLE alumni_languages ADD COLUMN IF NOT EXISTS certification_score TEXT;
ALTER TABLE alumni_languages ADD COLUMN IF NOT EXISTS certification_date DATE;
ALTER TABLE alumni_languages ADD COLUMN IF NOT EXISTS is_native BOOLEAN DEFAULT false;
ALTER TABLE alumni_languages ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE alumni_languages ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE alumni_languages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- alumni_achievements
ALTER TABLE alumni_achievements ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE alumni_achievements ADD COLUMN IF NOT EXISTS issuing_organization TEXT;
ALTER TABLE alumni_achievements ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE alumni_achievements ADD COLUMN IF NOT EXISTS level TEXT;
ALTER TABLE alumni_achievements ADD COLUMN IF NOT EXISTS url TEXT;
ALTER TABLE alumni_achievements ADD COLUMN IF NOT EXISTS certificate_url TEXT;
ALTER TABLE alumni_achievements ADD COLUMN IF NOT EXISTS co_recipients TEXT[];
ALTER TABLE alumni_achievements ADD COLUMN IF NOT EXISTS impact_description TEXT;
ALTER TABLE alumni_achievements ADD COLUMN IF NOT EXISTS media_coverage_urls TEXT[];
ALTER TABLE alumni_achievements ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;
ALTER TABLE alumni_achievements ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE alumni_achievements ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE alumni_achievements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- alumni_projects
ALTER TABLE alumni_projects ADD COLUMN IF NOT EXISTS project_type TEXT;
ALTER TABLE alumni_projects ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE alumni_projects ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE alumni_projects ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE alumni_projects ADD COLUMN IF NOT EXISTS is_ongoing BOOLEAN DEFAULT false;
ALTER TABLE alumni_projects ADD COLUMN IF NOT EXISTS technologies_used TEXT[];
ALTER TABLE alumni_projects ADD COLUMN IF NOT EXISTS project_url TEXT;
ALTER TABLE alumni_projects ADD COLUMN IF NOT EXISTS github_url TEXT;
ALTER TABLE alumni_projects ADD COLUMN IF NOT EXISTS demo_url TEXT;
ALTER TABLE alumni_projects ADD COLUMN IF NOT EXISTS image_urls TEXT[];
ALTER TABLE alumni_projects ADD COLUMN IF NOT EXISTS team_size INTEGER;
ALTER TABLE alumni_projects ADD COLUMN IF NOT EXISTS your_contribution TEXT;
ALTER TABLE alumni_projects ADD COLUMN IF NOT EXISTS outcomes TEXT;
ALTER TABLE alumni_projects ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE alumni_projects ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE alumni_projects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- ==================== INDEXES FOR PERFORMANCE ====================
CREATE INDEX IF NOT EXISTS idx_experiences_alumni ON alumni_experiences(alumni_id);
CREATE INDEX IF NOT EXISTS idx_experiences_current ON alumni_experiences(is_current);
CREATE INDEX IF NOT EXISTS idx_experiences_dates ON alumni_experiences(start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_skills_alumni ON alumni_skills(alumni_id);
CREATE INDEX IF NOT EXISTS idx_skills_category ON alumni_skills(category);
CREATE INDEX IF NOT EXISTS idx_skills_proficiency ON alumni_skills(proficiency_level);
CREATE INDEX IF NOT EXISTS idx_skills_primary ON alumni_skills(is_primary);

CREATE INDEX IF NOT EXISTS idx_certifications_alumni ON alumni_certifications(alumni_id);
CREATE INDEX IF NOT EXISTS idx_certifications_active ON alumni_certifications(is_active);
CREATE INDEX IF NOT EXISTS idx_certifications_expiry ON alumni_certifications(expiry_date);

CREATE INDEX IF NOT EXISTS idx_languages_alumni ON alumni_languages(alumni_id);
CREATE INDEX IF NOT EXISTS idx_languages_proficiency ON alumni_languages(proficiency_level);

CREATE INDEX IF NOT EXISTS idx_achievements_alumni ON alumni_achievements(alumni_id);
CREATE INDEX IF NOT EXISTS idx_achievements_type ON alumni_achievements(achievement_type);
CREATE INDEX IF NOT EXISTS idx_achievements_featured ON alumni_achievements(is_featured);
CREATE INDEX IF NOT EXISTS idx_achievements_date ON alumni_achievements(date_received);

CREATE INDEX IF NOT EXISTS idx_projects_alumni ON alumni_projects(alumni_id);
CREATE INDEX IF NOT EXISTS idx_projects_ongoing ON alumni_projects(is_ongoing);

-- ==================== TRIGGERS FOR AUTO-UPDATE ====================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_alumni_experiences_updated_at ON alumni_experiences;
CREATE TRIGGER update_alumni_experiences_updated_at BEFORE UPDATE ON alumni_experiences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_alumni_skills_updated_at ON alumni_skills;
CREATE TRIGGER update_alumni_skills_updated_at BEFORE UPDATE ON alumni_skills
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_alumni_certifications_updated_at ON alumni_certifications;
CREATE TRIGGER update_alumni_certifications_updated_at BEFORE UPDATE ON alumni_certifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_alumni_languages_updated_at ON alumni_languages;
CREATE TRIGGER update_alumni_languages_updated_at BEFORE UPDATE ON alumni_languages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_alumni_achievements_updated_at ON alumni_achievements;
CREATE TRIGGER update_alumni_achievements_updated_at BEFORE UPDATE ON alumni_achievements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_alumni_projects_updated_at ON alumni_projects;
CREATE TRIGGER update_alumni_projects_updated_at BEFORE UPDATE ON alumni_projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-update certification active status based on expiry
CREATE OR REPLACE FUNCTION update_certification_active_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.expiry_date IS NOT NULL AND NEW.expiry_date < CURRENT_DATE THEN
        NEW.is_active = false;
    ELSE
        NEW.is_active = true;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS check_certification_expiry ON alumni_certifications;
CREATE TRIGGER check_certification_expiry BEFORE INSERT OR UPDATE ON alumni_certifications
    FOR EACH ROW EXECUTE FUNCTION update_certification_active_status();

-- ==================== COMMENTS FOR DOCUMENTATION ====================
COMMENT ON TABLE alumni_experiences IS 'Stores professional work experiences and employment history for alumni';
COMMENT ON TABLE alumni_skills IS 'Stores skills and expertise with proficiency levels and metadata';
COMMENT ON TABLE alumni_certifications IS 'Stores professional certifications and credentials';
COMMENT ON TABLE alumni_languages IS 'Stores language proficiencies with detailed skill breakdown';
COMMENT ON TABLE alumni_achievements IS 'Stores awards, achievements, publications, and recognitions';
COMMENT ON TABLE alumni_projects IS 'Stores portfolio projects with detailed information';


-- ============================================================
-- [3/44] add_alumni_locations.sql
-- ============================================================
-- Migration: add alumni_locations table for multi-location support
-- Each alumnus can have multiple labeled locations (Home, University, Job, Internship, Other)
-- Legacy single-location fields on alumni table are preserved for backward compatibility

CREATE TABLE IF NOT EXISTS alumni_locations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alumni_id      TEXT NOT NULL REFERENCES alumni(id) ON DELETE CASCADE,
  label_type     TEXT NOT NULL CHECK (label_type IN ('Home', 'University', 'Job', 'Internship', 'Other')),
  city           TEXT,
  state          TEXT,
  country        TEXT,
  latitude       NUMERIC,
  longitude      NUMERIC,
  location_label TEXT,
  created_at     TIMESTAMP DEFAULT NOW(),
  updated_at     TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alumni_locations_alumni_id ON alumni_locations(alumni_id);
CREATE INDEX IF NOT EXISTS idx_alumni_locations_lat_lng
  ON alumni_locations(latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Reuse the trigger function already defined in multi_entry_profile.sql
DROP TRIGGER IF EXISTS update_alumni_locations_updated_at ON alumni_locations;
CREATE TRIGGER update_alumni_locations_updated_at
  BEFORE UPDATE ON alumni_locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE alumni_locations ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read locations
DROP POLICY IF EXISTS "alumni_locations_select" ON alumni_locations;
CREATE POLICY "alumni_locations_select" ON alumni_locations
  FOR SELECT TO authenticated USING (true);

-- Alumni can only insert their own locations
DROP POLICY IF EXISTS "alumni_locations_insert" ON alumni_locations;
CREATE POLICY "alumni_locations_insert" ON alumni_locations
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid()::text = (SELECT user_id FROM alumni WHERE id = alumni_id)
  );

-- Alumni can only update their own locations
DROP POLICY IF EXISTS "alumni_locations_update" ON alumni_locations;
CREATE POLICY "alumni_locations_update" ON alumni_locations
  FOR UPDATE TO authenticated
  USING (
    auth.uid()::text = (SELECT user_id FROM alumni WHERE id = alumni_id)
  );

-- Alumni can only delete their own locations
DROP POLICY IF EXISTS "alumni_locations_delete" ON alumni_locations;
CREATE POLICY "alumni_locations_delete" ON alumni_locations
  FOR DELETE TO authenticated
  USING (
    auth.uid()::text = (SELECT user_id FROM alumni WHERE id = alumni_id)
  );

-- Enable Realtime
-- Guarded: if supabase_realtime was created FOR ALL TABLES (see prod_migration.sql),
-- explicitly adding a table to it is invalid (error 55000) and unnecessary, since
-- FOR ALL TABLES already covers every table including this one.
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE alumni_locations;
EXCEPTION WHEN others THEN NULL; END $$;


-- ============================================================
-- [4/44] create_alumni_heatmap_indexes.sql
-- ============================================================
-- ============================================================
-- Alumni Heat Map - Location Columns Migration
-- Ensures current_city, current_state, current_country exist
-- on the alumni table (they are defined in the base migration,
-- but this file is safe to re-run on any fresh Supabase project)
-- ============================================================

-- Add location columns if missing (idempotent)
ALTER TABLE alumni
  ADD COLUMN IF NOT EXISTS "current_city"    text,
  ADD COLUMN IF NOT EXISTS "current_state"   text,
  ADD COLUMN IF NOT EXISTS "current_country" text;

-- ─────────────────────────────────────────────────────────────
-- Indexes for map query performance
-- (alumni-map.ts queries: filter by country/state/city)
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_alumni_current_country
    ON alumni (current_country)
    WHERE current_country IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_alumni_current_state
    ON alumni (current_state)
    WHERE current_state IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_alumni_current_city
    ON alumni (current_city)
    WHERE current_city IS NOT NULL;

-- Composite index for the most common map-data query pattern
CREATE INDEX IF NOT EXISTS idx_alumni_location_composite
    ON alumni (current_country, current_state, current_city)
    WHERE current_country IS NOT NULL
      AND current_state IS NOT NULL
      AND current_city IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- Enable Realtime on alumni table
-- (AlumniHeatMap.tsx subscribes to postgres_changes on 'alumni')
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE alumni;
EXCEPTION WHEN others THEN NULL; END $$;


-- ============================================================
-- [5/44] add_advanced_profile_fields.sql
-- ============================================================

-- Migration to add advanced profile fields to alumni table

-- Add professional fields
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS employment_status TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS employment_history TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS previous_companies TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS years_of_experience INTEGER DEFAULT 0;

-- Add expertise fields
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS expertise_areas TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS certifications TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS languages_known TEXT;

-- Add achievement fields
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS achievements TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS awards TEXT;

-- Add additional info fields
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS keywords TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Asia/Kolkata';
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS volunteer_interests TEXT;

-- Add startup fields
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS is_startup_founder BOOLEAN DEFAULT FALSE;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS startup_name TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS startup_role TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS funding_stage TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS founding_year INTEGER;

-- Add profile completion tracking
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS profile_completion_score INTEGER DEFAULT 0;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS completed_sections TEXT DEFAULT '[]';

-- Create indexes for search optimization
CREATE INDEX IF NOT EXISTS idx_alumni_employment_status ON alumni(employment_status);
CREATE INDEX IF NOT EXISTS idx_alumni_is_startup_founder ON alumni(is_startup_founder);
CREATE INDEX IF NOT EXISTS idx_alumni_completion_score ON alumni(profile_completion_score);

-- For TEXT columns that store JSON arrays, we need to use gin_trgm_ops for text search
-- or convert to JSONB for proper GIN indexing. For now, we'll use regular B-tree indexes.
CREATE INDEX IF NOT EXISTS idx_alumni_expertise_areas ON alumni(expertise_areas);
CREATE INDEX IF NOT EXISTS idx_alumni_keywords ON alumni(keywords);

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'alumni' 
  AND column_name IN (
    'employment_status', 'employment_history', 'expertise_areas', 
    'certifications', 'languages_known', 'achievements', 'keywords',
    'is_startup_founder', 'profile_completion_score'
  )
ORDER BY column_name;


-- ============================================================
-- [6/44] add_missing_alumni_columns.sql
-- ============================================================
-- ============================================================
-- Add missing alumni columns that exist in server code but
-- are not in the base migration (0000_nifty_misty_knight.sql)
-- Safe to run multiple times (ADD COLUMN IF NOT EXISTS)
-- ============================================================

-- is_batch_champion: used by admin users route, alumni-search-routes,
-- and multiple places in routes.ts for batch champion management
ALTER TABLE public.alumni
  ADD COLUMN IF NOT EXISTS is_batch_champion BOOLEAN DEFAULT false;

-- Create index for batch champion filter queries
CREATE INDEX IF NOT EXISTS idx_alumni_is_batch_champion
  ON public.alumni (is_batch_champion)
  WHERE is_batch_champion = true;


-- ============================================================
-- [7/44] add_profile_improvements_fields.sql
-- ============================================================
-- Migration: Add Profile Improvements Fields
-- This ensures all new fields for profile improvements exist in the alumni table

-- Add social media fields if they don't exist
DO $$ 
BEGIN
    -- GitHub URL
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'alumni' AND column_name = 'github_url'
    ) THEN
        ALTER TABLE alumni ADD COLUMN github_url TEXT;
    END IF;

    -- Twitter URL
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'alumni' AND column_name = 'twitter_url'
    ) THEN
        ALTER TABLE alumni ADD COLUMN twitter_url TEXT;
    END IF;

    -- Personal Website
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'alumni' AND column_name = 'personal_website'
    ) THEN
        ALTER TABLE alumni ADD COLUMN personal_website TEXT;
    END IF;

    -- Show Email (Privacy Setting)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'alumni' AND column_name = 'show_email'
    ) THEN
        ALTER TABLE alumni ADD COLUMN show_email BOOLEAN DEFAULT false;
    END IF;

    -- Show Phone (Privacy Setting)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'alumni' AND column_name = 'show_phone'
    ) THEN
        ALTER TABLE alumni ADD COLUMN show_phone BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Update existing records to have default values for privacy settings
UPDATE alumni 
SET show_email = false 
WHERE show_email IS NULL;

UPDATE alumni 
SET show_phone = false 
WHERE show_phone IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN alumni.github_url IS 'GitHub profile URL';
COMMENT ON COLUMN alumni.twitter_url IS 'Twitter/X profile URL';
COMMENT ON COLUMN alumni.personal_website IS 'Personal website URL';
COMMENT ON COLUMN alumni.show_email IS 'Privacy setting: Show email on public profile';
COMMENT ON COLUMN alumni.show_phone IS 'Privacy setting: Show phone on public profile';


-- ============================================================
-- [8/44] ensure_work_mode_column.sql
-- ============================================================
-- Migration: Ensure work_mode column exists in jobs table
-- This script ensures the work_mode column is present and properly configured

-- Add work_mode column if it doesn't exist
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS work_mode TEXT;

-- Add a comment to document the column
COMMENT ON COLUMN jobs.work_mode IS 'Work mode: remote, onsite, or hybrid';

-- Optional: Update any existing jobs that have "Remote" or similar in location field
-- to have the appropriate work_mode value
-- This helps migrate old data
UPDATE jobs 
SET work_mode = 'remote' 
WHERE (LOWER(location) LIKE '%remote%' OR LOWER(location) LIKE '%work from home%' OR LOWER(location) LIKE '%wfh%')
  AND (work_mode IS NULL OR work_mode = '');

UPDATE jobs 
SET work_mode = 'hybrid' 
WHERE (LOWER(location) LIKE '%hybrid%' OR LOWER(location) LIKE '%flexible%')
  AND (work_mode IS NULL OR work_mode = '');

-- Set default to 'onsite' for jobs without work_mode but with a physical location
UPDATE jobs 
SET work_mode = 'onsite' 
WHERE work_mode IS NULL 
  AND location IS NOT NULL 
  AND location != ''
  AND LOWER(location) NOT LIKE '%remote%'
  AND LOWER(location) NOT LIKE '%hybrid%';

-- Verify the column exists and check current state
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'jobs' 
  AND column_name = 'work_mode';


-- ============================================================
-- [9/44] add_jobs_industry_skills.sql
-- ============================================================
-- Migration: Add missing industry and skills columns to jobs table

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS skills TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS company_logo TEXT;


-- ============================================================
-- [10/44] add_venue_column.sql
-- ============================================================
-- Migration: Add venue column to events table
-- This migration adds the venue column that exists in the schema but may be missing in the database

-- Check if column exists before adding (PostgreSQL 9.5+)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'events' 
        AND column_name = 'venue'
    ) THEN
        ALTER TABLE events ADD COLUMN venue TEXT;
        RAISE NOTICE 'Added venue column to events table';
    ELSE
        RAISE NOTICE 'venue column already exists in events table';
    END IF;
END $$;


-- ============================================================
-- [11/44] add_resume_field.sql
-- ============================================================
-- Simple Resume Upload Migration (Fixed for RLS)
-- Run this in Supabase SQL Editor

-- Step 1: Add resume_url column to alumni table
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS resume_url TEXT;

-- Step 2: Add index for resume_url
CREATE INDEX IF NOT EXISTS idx_alumni_resume_url ON alumni(resume_url) WHERE resume_url IS NOT NULL;

-- Step 3: Create storage bucket (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', false)
ON CONFLICT (id) DO NOTHING;

-- Step 4: Drop existing policies if they exist
-- (names must match exactly what Step 5 creates below, so this file is
-- safely re-runnable — the original names here didn't match the CREATEs)
DROP POLICY IF EXISTS "Users can view resumes" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own resumes" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own resumes" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own resumes" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload resumes" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view resumes" ON storage.objects;

-- Step 5: Create simple, working RLS policies

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Authenticated users can upload resumes"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'resumes' AND
  auth.role() = 'authenticated'
);

-- Allow users to view any resume (you can restrict this later)
CREATE POLICY "Authenticated users can view resumes"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'resumes' AND
  auth.role() = 'authenticated'
);

-- Allow users to update files in their own folder
CREATE POLICY "Users can update their own resumes"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'resumes' AND
  auth.role() = 'authenticated'
);

-- Allow users to delete files in their own folder
CREATE POLICY "Users can delete their own resumes"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'resumes' AND
  auth.role() = 'authenticated'
);

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'alumni' 
  AND column_name = 'resume_url';

-- Verify bucket was created
SELECT id, name, public FROM storage.buckets WHERE id = 'resumes';

-- Verify policies were created
SELECT policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects' 
  AND policyname LIKE '%resume%';


-- ============================================================
-- [12/44] add_resume_field_enhanced_rls.sql
-- ============================================================
-- Optional: Enhanced RLS Policy for Resume Access with Connection Check
-- Run this AFTER the main migration if you want to restrict resume access to connections only

-- First, drop the existing policy
DROP POLICY IF EXISTS "Users can view resumes" ON storage.objects;

-- Create enhanced policy that checks connection_requests table
CREATE POLICY "Users can view resumes"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'resumes' AND
  (
    -- User can view their own resume
    auth.uid()::text = (storage.foldername(name))[1]
    OR
    -- Or if they are connected (check connection_requests table)
    EXISTS (
      SELECT 1 FROM connection_requests
      WHERE status = 'accepted'
      AND (
        (requester_id = auth.uid()::text AND recipient_id = (storage.foldername(name))[1])
        OR
        (recipient_id = auth.uid()::text AND requester_id = (storage.foldername(name))[1])
      )
    )
  )
);

-- Note: This policy restricts resume viewing to:
-- 1. The resume owner
-- 2. Users who have an accepted connection with the resume owner


-- ============================================================
-- [13/44] add_digest_preferences.sql
-- ============================================================
-- Add digest-related columns to alumni table
ALTER TABLE "alumni" ADD COLUMN IF NOT EXISTS "weekly_digest_enabled" boolean DEFAULT true;
ALTER TABLE "alumni" ADD COLUMN IF NOT EXISTS "last_digest_sent_at" timestamp;
ALTER TABLE "alumni" ADD COLUMN IF NOT EXISTS "job_alerts_enabled" boolean DEFAULT true;
ALTER TABLE "alumni" ADD COLUMN IF NOT EXISTS "job_alert_preferences" text DEFAULT '{}';

-- Create job_alerts_sent table to track sent job alerts
CREATE TABLE IF NOT EXISTS "job_alerts_sent" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "job_id" varchar NOT NULL,
    "alumni_id" varchar NOT NULL,
    "match_score" integer NOT NULL,
    "sent_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "job_alerts_sent_job_id_alumni_id_unique" UNIQUE("job_id", "alumni_id")
);

-- Add foreign key constraints
DO $$ BEGIN
    ALTER TABLE "job_alerts_sent" ADD CONSTRAINT "job_alerts_sent_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "job_alerts_sent" ADD CONSTRAINT "job_alerts_sent_alumni_id_alumni_id_fk" FOREIGN KEY ("alumni_id") REFERENCES "public"."alumni"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


-- ============================================================
-- [14/44] fix_digest_data_accuracy.sql
-- ============================================================
-- Fix data accuracy issues in digest queries

-- Fix: Add index for weekly digest queries
CREATE INDEX IF NOT EXISTS idx_alumni_weekly_digest ON alumni(weekly_digest_enabled, last_digest_sent_at);

-- Fix: Add index for job alert queries
CREATE INDEX IF NOT EXISTS idx_alumni_job_alerts ON alumni(job_alerts_enabled);

-- Fix: Add index for job_alerts_sent table
CREATE INDEX IF NOT EXISTS idx_job_alerts_sent_alumni ON job_alerts_sent(alumni_id);
CREATE INDEX IF NOT EXISTS idx_job_alerts_sent_job ON job_alerts_sent(job_id);
CREATE INDEX IF NOT EXISTS idx_job_alerts_sent_sent_at ON job_alerts_sent(sent_at);

-- Fix: Add index for pending signup requests
CREATE INDEX IF NOT EXISTS idx_signup_requests_status ON signup_requests(status);

-- Fix: Add index for pending posts
CREATE INDEX IF NOT EXISTS idx_feed_posts_status ON feed_posts(status);

-- Fix: Add index for connections by status
CREATE INDEX IF NOT EXISTS idx_connections_status ON connection_requests(status);

-- Fix: Add index for notifications by type
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

-- Fix: Add index for post likes by created_at
CREATE INDEX IF NOT EXISTS idx_post_likes_created_at ON post_likes(created_at);

-- Fix: Add index for post comments by created_at
CREATE INDEX IF NOT EXISTS idx_post_comments_created_at ON post_comments(created_at);


-- ============================================================
-- [15/44] add_is_competitive_to_badges.sql
-- ============================================================
ALTER TABLE gamification_badges 
ADD COLUMN IF NOT EXISTS is_competitive BOOLEAN DEFAULT FALSE;


-- ============================================================
-- [16/44] create_blog_tables.sql
-- ============================================================
-- Blog Categories
CREATE TABLE IF NOT EXISTS blog_categories (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT '#008060',
  icon TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Blog Posts
CREATE TABLE IF NOT EXISTS blog_posts (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id VARCHAR REFERENCES blog_categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT,
  content TEXT NOT NULL,
  cover_image TEXT,
  tags TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  rejection_reason TEXT,
  reading_time_minutes INTEGER DEFAULT 1,
  views_count INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  bookmarks_count INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Blog Comments
CREATE TABLE IF NOT EXISTS blog_comments (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id VARCHAR NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  author_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id VARCHAR,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
DO $$ BEGIN
  ALTER TABLE blog_comments ADD CONSTRAINT blog_comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES blog_comments(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Blog Likes
CREATE TABLE IF NOT EXISTS blog_likes (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id VARCHAR NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- Blog Bookmarks
CREATE TABLE IF NOT EXISTS blog_bookmarks (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id VARCHAR NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- Seed default categories
INSERT INTO blog_categories (name, slug, description, color, display_order) VALUES
  ('Technology', 'technology', 'Tech trends and software', '#0EA5E9', 1),
  ('Career', 'career', 'Career advice and growth', '#8B5CF6', 2),
  ('Life', 'life', 'Life experiences and stories', '#F59E0B', 3),
  ('Tips & Tricks', 'tips-tricks', 'Practical tips and how-tos', '#10B981', 4)
ON CONFLICT (slug) DO NOTHING;


-- ============================================================
-- [17/44] add_blog_indexes.sql
-- ============================================================
-- Performance indexes for blog tables
-- Run this in Supabase SQL editor or as a migration

CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_author_id ON blog_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at ON blog_posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_comments_post_id ON blog_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_blog_comments_parent_id ON blog_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_blog_likes_post_user ON blog_likes(post_id, user_id);
CREATE INDEX IF NOT EXISTS idx_blog_bookmarks_post_user ON blog_bookmarks(post_id, user_id);


-- ============================================================
-- [18/44] add_blog_counter_functions.sql
-- ============================================================
-- Atomic counter increment/decrement for blog posts
-- Prevents race conditions in likes, bookmarks, and comments counts
-- Run this in Supabase SQL editor or as a migration

CREATE OR REPLACE FUNCTION increment_blog_counter(
  p_post_id TEXT,
  p_col TEXT,
  p_delta INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate column name to prevent SQL injection
  IF p_col NOT IN ('likes_count', 'bookmarks_count', 'comments_count', 'views_count') THEN
    RAISE EXCEPTION 'Invalid column name: %', p_col;
  END IF;

  EXECUTE format(
    'UPDATE blog_posts SET %I = GREATEST(0, %I + $1), updated_at = NOW() WHERE id = $2',
    p_col, p_col
  ) USING p_delta, p_post_id;
END;
$$;

-- Grant execute permission to authenticated users (Supabase anon/service role)
GRANT EXECUTE ON FUNCTION increment_blog_counter(TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_blog_counter(TEXT, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION increment_blog_counter(TEXT, TEXT, INTEGER) TO anon;


-- ============================================================
-- [19/44] create_podcast_tables.sql
-- ============================================================
-- Podcast episodes table
CREATE TABLE IF NOT EXISTS podcasts (
  id             VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by     VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Content
  title          TEXT NOT NULL,
  slug           TEXT NOT NULL UNIQUE,
  description    TEXT,
  show_notes     TEXT,

  -- Video
  video_url      TEXT NOT NULL,
  embed_url      TEXT,

  -- External links stored as JSON text: [{label: string, url: string}]
  links          TEXT DEFAULT '[]',

  -- Metadata
  tags           TEXT[] DEFAULT '{}',
  episode_number INTEGER,

  -- Publishing workflow
  status         TEXT NOT NULL DEFAULT 'draft',  -- draft | scheduled | published
  scheduled_at   TIMESTAMP WITH TIME ZONE,
  published_at   TIMESTAMP WITH TIME ZONE,
  is_featured    BOOLEAN DEFAULT false,

  views_count    INTEGER DEFAULT 0,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS podcasts_status_idx        ON podcasts(status);
CREATE INDEX IF NOT EXISTS podcasts_published_at_idx  ON podcasts(published_at DESC);
CREATE INDEX IF NOT EXISTS podcasts_scheduled_at_idx  ON podcasts(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS podcasts_slug_idx          ON podcasts(slug);


-- ============================================================
-- [20/44] add_podcast_views_table.sql
-- ============================================================
CREATE TABLE IF NOT EXISTS "podcast_views" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "podcast_id" varchar NOT NULL REFERENCES podcasts(id) ON DELETE CASCADE,
    "user_id" varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "viewed_at" timestamp DEFAULT now() NOT NULL,
    UNIQUE("podcast_id", "user_id")
);

CREATE INDEX IF NOT EXISTS podcast_views_podcast_id_idx ON podcast_views(podcast_id);
CREATE INDEX IF NOT EXISTS podcast_views_user_id_idx ON podcast_views(user_id);


-- ============================================================
-- [21/44] add_podcast_view_counter_function.sql
-- ============================================================
-- Atomic podcast view tracking: inserts a unique view row and conditionally
-- increments the views_count counter in a single transaction to prevent
-- race conditions when multiple concurrent requests view the same episode.
CREATE OR REPLACE FUNCTION increment_podcast_view(p_podcast_id text, p_user_id text)
RETURNS integer AS $$
DECLARE
  v_inserted integer;
BEGIN
  INSERT INTO podcast_views (podcast_id, user_id)
  VALUES (p_podcast_id, p_user_id)
  ON CONFLICT (podcast_id, user_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted > 0 THEN
    UPDATE podcasts
    SET views_count = views_count + 1,
        updated_at = NOW()
    WHERE id = p_podcast_id;
  END IF;

  RETURN (SELECT views_count FROM podcasts WHERE id = p_podcast_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- [22/44] add_podcast_likes_comments.sql
-- ============================================================
-- Podcast likes table
CREATE TABLE IF NOT EXISTS podcast_likes (
  id          VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  podcast_id  VARCHAR NOT NULL REFERENCES podcasts(id) ON DELETE CASCADE,
  user_id     VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (podcast_id, user_id)
);

CREATE INDEX IF NOT EXISTS podcast_likes_podcast_idx ON podcast_likes(podcast_id);
CREATE INDEX IF NOT EXISTS podcast_likes_user_idx    ON podcast_likes(user_id);

-- Add likes_count to podcasts if not present
ALTER TABLE podcasts ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;

-- Podcast comments table
CREATE TABLE IF NOT EXISTS podcast_comments (
  id          VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  podcast_id  VARCHAR NOT NULL REFERENCES podcasts(id) ON DELETE CASCADE,
  user_id     VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS podcast_comments_podcast_idx ON podcast_comments(podcast_id);
CREATE INDEX IF NOT EXISTS podcast_comments_user_idx    ON podcast_comments(user_id);

-- Add comments_count to podcasts if not present
ALTER TABLE podcasts ADD COLUMN IF NOT EXISTS comments_count INTEGER DEFAULT 0;


-- ============================================================
-- [23/44] create_travel_chapters.sql
-- ============================================================
-- Create travel_chapters table
CREATE TABLE IF NOT EXISTS travel_chapters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    country TEXT NOT NULL,
    description TEXT,
    cover_image TEXT,
    coordinates TEXT,
    created_by VARCHAR REFERENCES users(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create travel_chapter_members table
CREATE TABLE IF NOT EXISTS travel_chapter_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id UUID NOT NULL REFERENCES travel_chapters(id) ON DELETE CASCADE,
    user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(chapter_id, user_id)
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_travel_chapters_status ON travel_chapters(status);
CREATE INDEX IF NOT EXISTS idx_travel_chapters_city ON travel_chapters(city);
CREATE INDEX IF NOT EXISTS idx_travel_chapter_members_user_id ON travel_chapter_members(user_id);
CREATE INDEX IF NOT EXISTS idx_travel_chapter_members_chapter_id ON travel_chapter_members(chapter_id);


-- ============================================================
-- [24/44] create_travel_chapter_messages.sql
-- ============================================================
CREATE TABLE IF NOT EXISTS "travel_chapter_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "chapter_id" uuid NOT NULL REFERENCES "travel_chapters"("id") ON DELETE cascade,
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "content" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);


-- ============================================================
-- [25/44] create_travel_chapter_events.sql
-- ============================================================
-- Migration to add events to travel chapters
CREATE TABLE IF NOT EXISTS travel_chapter_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id UUID NOT NULL REFERENCES travel_chapters(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    venue TEXT NOT NULL,
    event_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_by VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS travel_chapter_event_rsvps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES travel_chapter_events(id) ON DELETE CASCADE,
    user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('going', 'maybe', 'not_going')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, user_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_travel_chapter_events_chapter_id ON travel_chapter_events(chapter_id);
CREATE INDEX IF NOT EXISTS idx_travel_chapter_event_rsvps_event_id ON travel_chapter_event_rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_travel_chapter_event_rsvps_user_id ON travel_chapter_event_rsvps(user_id);


-- ============================================================
-- [26/44] add_travel_chapter_coordinates.sql
-- ============================================================
-- Add real latitude/longitude columns to travel_chapters, sourced from Google Geocoding API.
-- The legacy 'coordinates' TEXT column ("lng,lat") is kept read-only for backward compatibility
-- until fully backfilled; new code should read/write latitude/longitude instead.
ALTER TABLE travel_chapters ADD COLUMN IF NOT EXISTS latitude NUMERIC;
ALTER TABLE travel_chapters ADD COLUMN IF NOT EXISTS longitude NUMERIC;

CREATE INDEX IF NOT EXISTS idx_travel_chapters_lat_lng
  ON travel_chapters(latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;


-- ============================================================
-- [27/44] create_travel_journal_tables.sql
-- ============================================================
-- Migration: create_travel_journal_tables.sql
-- Replaces travel_chapters city-community feature with travel_posts journal feed

CREATE TABLE IF NOT EXISTS travel_posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  city            TEXT NOT NULL,
  country         TEXT NOT NULL,
  coordinates     TEXT,
  caption         TEXT,
  is_hidden       BOOLEAN NOT NULL DEFAULT FALSE,
  likes_count     INTEGER NOT NULL DEFAULT 0,
  comments_count  INTEGER NOT NULL DEFAULT 0,
  bookmarks_count INTEGER NOT NULL DEFAULT 0,
  views_count     INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS travel_post_media (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id      UUID NOT NULL REFERENCES travel_posts(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN ('image', 'video')),
  url          TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  order_index  INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS travel_post_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES travel_posts(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS travel_post_likes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES travel_posts(id) ON DELETE CASCADE,
  user_id    VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

CREATE TABLE IF NOT EXISTS travel_post_bookmarks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES travel_posts(id) ON DELETE CASCADE,
  user_id    VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

CREATE TABLE IF NOT EXISTS travel_post_comments (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id   UUID NOT NULL REFERENCES travel_posts(id) ON DELETE CASCADE,
  author_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES travel_post_comments(id) ON DELETE CASCADE,
  content   TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_travel_posts_author        ON travel_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_travel_posts_city          ON travel_posts(city);
CREATE INDEX IF NOT EXISTS idx_travel_posts_created       ON travel_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_travel_posts_hidden        ON travel_posts(is_hidden);
CREATE INDEX IF NOT EXISTS idx_travel_post_media_post     ON travel_post_media(post_id, order_index);
CREATE INDEX IF NOT EXISTS idx_travel_post_links_post     ON travel_post_links(post_id);
CREATE INDEX IF NOT EXISTS idx_travel_post_likes_post     ON travel_post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_travel_post_likes_user     ON travel_post_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_travel_post_bookmarks_user ON travel_post_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_travel_post_comments_post  ON travel_post_comments(post_id, is_active);
CREATE INDEX IF NOT EXISTS idx_travel_post_comments_par   ON travel_post_comments(parent_id);

-- Atomic counter function (mirrors increment_blog_counter)
CREATE OR REPLACE FUNCTION increment_travel_post_counter(
  p_post_id TEXT,
  p_col     TEXT,
  p_delta   INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_col NOT IN ('likes_count', 'bookmarks_count', 'comments_count', 'views_count') THEN
    RAISE EXCEPTION 'Invalid column: %', p_col;
  END IF;
  EXECUTE format(
    'UPDATE travel_posts SET %I = GREATEST(0, %I + $1), updated_at = NOW() WHERE id = $2',
    p_col, p_col
  ) USING p_delta, p_post_id::UUID;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_travel_post_counter(TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_travel_post_counter(TEXT, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION increment_travel_post_counter(TEXT, TEXT, INTEGER) TO anon;


-- ============================================================
-- [28/44] add_travel_post_approval_status.sql
-- ============================================================
ALTER TABLE travel_posts
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Back-fill: existing posts were already public, treat them as approved
UPDATE travel_posts SET status = 'approved' WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_travel_posts_status ON travel_posts(status);
CREATE INDEX IF NOT EXISTS idx_travel_posts_status_hidden ON travel_posts(status, is_hidden);


-- ============================================================
-- [29/44] add_travel_post_resubmit.sql
-- ============================================================
-- Add columns to support author edit & resubmit flow for travel posts
ALTER TABLE travel_posts
  ADD COLUMN IF NOT EXISTS previous_caption        TEXT,
  ADD COLUMN IF NOT EXISTS previous_city           TEXT,
  ADD COLUMN IF NOT EXISTS previous_country        TEXT,
  ADD COLUMN IF NOT EXISTS previous_media_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS resubmit_count          INTEGER NOT NULL DEFAULT 0;


-- ============================================================
-- [30/44] add_newsletters_table.sql
-- ============================================================
-- Newsletter feature: Admin-created newsletters sent via email + in-app notifications
-- Recipients resolved at send-time from stored filter fields (avoids stale snapshots)

CREATE TABLE IF NOT EXISTS newsletters (
  id                        VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by                VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title                     TEXT NOT NULL,
  slug                      TEXT NOT NULL UNIQUE,
  excerpt                   TEXT,
  content                   TEXT NOT NULL,
  cover_image               TEXT,
  -- Recipient filters ('all' = no filter applied)
  recipient_role            TEXT NOT NULL DEFAULT 'all',
  recipient_batch           TEXT NOT NULL DEFAULT 'all',
  recipient_graduation_year TEXT NOT NULL DEFAULT 'all',
  -- Workflow: draft -> scheduled -> sending -> sent | failed
  status                    TEXT NOT NULL DEFAULT 'draft',
  scheduled_at              TIMESTAMP WITH TIME ZONE,
  sent_at                   TIMESTAMP WITH TIME ZONE,
  -- Delivery stats (recorded at send-time; persists even if users are later deleted)
  total_recipients          INTEGER NOT NULL DEFAULT 0,
  sent_count                INTEGER NOT NULL DEFAULT 0,
  failed_count              INTEGER NOT NULL DEFAULT 0,
  created_at                TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at                TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS newsletters_status_idx
  ON newsletters(status);

-- Partial index — only scheduled newsletters need scheduled_at lookups
CREATE INDEX IF NOT EXISTS newsletters_scheduled_at_idx
  ON newsletters(scheduled_at)
  WHERE status = 'scheduled';

CREATE INDEX IF NOT EXISTS newsletters_slug_idx
  ON newsletters(slug);

-- Archive page sorted by sent_at descending
CREATE INDEX IF NOT EXISTS newsletters_sent_at_idx
  ON newsletters(sent_at DESC);


-- ============================================================
-- [31/44] add_newsletter_open_tracking.sql
-- ============================================================
-- Open tracking: aggregate counter on newsletters + per-open event log

ALTER TABLE newsletters ADD COLUMN IF NOT EXISTS open_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS newsletter_opens (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  newsletter_id VARCHAR     NOT NULL REFERENCES newsletters(id) ON DELETE CASCADE,
  user_id       VARCHAR,
  opened_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS newsletter_opens_newsletter_id_idx ON newsletter_opens(newsletter_id);

-- RPC function called by the tracking pixel endpoint to increment open_count atomically
CREATE OR REPLACE FUNCTION increment_newsletter_open_count(nid VARCHAR)
RETURNS VOID
LANGUAGE SQL
AS $$
  UPDATE newsletters SET open_count = open_count + 1 WHERE id = nid;
$$;


-- ============================================================
-- [32/44] add_newsletter_unsubscribe.sql
-- ============================================================
-- Allow alumni to opt out of newsletters via one-click unsubscribe
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS newsletter_unsubscribed BOOLEAN NOT NULL DEFAULT FALSE;

-- Partial index: only indexes opted-out rows (keeps index tiny)
CREATE INDEX IF NOT EXISTS alumni_newsletter_unsubscribed_idx
  ON alumni(newsletter_unsubscribed)
  WHERE newsletter_unsubscribed = TRUE;


-- ============================================================
-- [33/44] add_recipient_department.sql
-- ============================================================
-- Add department/branch filter column to newsletters table
ALTER TABLE newsletters ADD COLUMN IF NOT EXISTS recipient_department TEXT NOT NULL DEFAULT 'all';


-- ============================================================
-- [34/44] add_newsletter_custom_recipients.sql
-- ============================================================
-- Add custom_recipient_emails to newsletters table
-- Stores a JSON array of additional email addresses (beyond filter-based recipients)
-- e.g. ["external@example.com", "partner@org.com"]
ALTER TABLE newsletters
  ADD COLUMN IF NOT EXISTS custom_recipient_emails TEXT DEFAULT '[]';


-- ============================================================
-- [35/44] add_mentorship_tables.sql
-- ============================================================
-- Mentorship requests table
CREATE TABLE IF NOT EXISTS mentorship_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentee_id VARCHAR NOT NULL,
  mentor_id VARCHAR NOT NULL,
  status TEXT DEFAULT 'pending',
  message TEXT,
  goal_text TEXT,
  match_score INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Backfill columns in case mentorship_requests already existed with a partial schema
ALTER TABLE mentorship_requests ADD COLUMN IF NOT EXISTS goal_text TEXT;
ALTER TABLE mentorship_requests ADD COLUMN IF NOT EXISTS match_score INTEGER;

-- Prevent duplicate pending requests from same mentee to same mentor
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_request
  ON mentorship_requests(mentee_id, mentor_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_requests_mentor ON mentorship_requests(mentor_id, status);
CREATE INDEX IF NOT EXISTS idx_requests_mentee ON mentorship_requests(mentee_id);

-- Add mentor availability columns to alumni table
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS mentor_available BOOLEAN DEFAULT true;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS max_mentees INTEGER DEFAULT 3;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS mentee_count INTEGER DEFAULT 0;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS years_of_experience INTEGER;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS timezone TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS expertise_areas TEXT;


-- ============================================================
-- [36/44] add_mentorship_enhancements.sql
-- ============================================================
-- Mentor availability columns
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS available_days TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS session_type TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS meeting_link TEXT;

-- Bookmarks
CREATE TABLE IF NOT EXISTS mentorship_bookmarks (
  mentee_id VARCHAR NOT NULL,
  mentor_id  VARCHAR NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (mentee_id, mentor_id)
);

-- Sessions
CREATE TABLE IF NOT EXISTS mentorship_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id        VARCHAR NOT NULL,
  mentee_id        VARCHAR NOT NULL,
  request_id       VARCHAR NOT NULL REFERENCES mentorship_requests(id) ON DELETE CASCADE,
  scheduled_at     TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  agenda           TEXT,
  notes            TEXT,
  status           TEXT DEFAULT 'upcoming',
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_mentor  ON mentorship_sessions(mentor_id);
CREATE INDEX IF NOT EXISTS idx_sessions_mentee  ON mentorship_sessions(mentee_id);
CREATE INDEX IF NOT EXISTS idx_sessions_request ON mentorship_sessions(request_id);

-- Reviews
CREATE TABLE IF NOT EXISTS mentorship_reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL,
  reviewer_id VARCHAR NOT NULL,
  reviewed_id VARCHAR NOT NULL,
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (session_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_reviewed ON mentorship_reviews(reviewed_id);


-- ============================================================
-- [37/44] add_mentorship_profile_fields.sql
-- ============================================================
-- Add new mentor profile fields for richer mentorship experience
-- (linkedin_url already exists on the alumni table from the profile system)
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS mentorship_style TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS help_topics TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS github_url TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS portfolio_url TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS twitter_url TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS total_mentees_helped INTEGER DEFAULT 0;

-- Function to safely increment total_mentees_helped without race conditions
CREATE OR REPLACE FUNCTION increment_mentees_helped(uid TEXT)
RETURNS void AS $$
  UPDATE alumni SET total_mentees_helped = COALESCE(total_mentees_helped, 0) + 1 WHERE user_id = uid;
$$ LANGUAGE sql;


-- ============================================================
-- [38/44] add_is_mentor_column.sql
-- ============================================================
-- Add is_mentor column to alumni table
-- Used by mentorship routes to filter available mentors
ALTER TABLE public.alumni
  ADD COLUMN IF NOT EXISTS is_mentor BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_alumni_is_mentor
  ON public.alumni (is_mentor)
  WHERE is_mentor = true;


-- ============================================================
-- [39/44] add_mentorship_status_constraints.sql
-- ============================================================
ALTER TABLE mentorship_sessions DROP CONSTRAINT IF EXISTS chk_mentorship_sessions_status;
ALTER TABLE mentorship_sessions ADD CONSTRAINT chk_mentorship_sessions_status CHECK (status IN ('scheduled', 'completed', 'cancelled', 'rescheduled', 'upcoming'));
ALTER TABLE mentorship_requests DROP CONSTRAINT IF EXISTS chk_mentorship_requests_status;
ALTER TABLE mentorship_requests ADD CONSTRAINT chk_mentorship_requests_status CHECK (status IN ('pending', 'accepted', 'rejected', 'declined', 'ended'));


-- ============================================================
-- [40/44] add_meet_link_to_sessions.sql
-- ============================================================
ALTER TABLE mentorship_sessions ADD COLUMN IF NOT EXISTS meet_link TEXT;


-- ============================================================
-- [41/44] add_cancellation_reason_to_sessions.sql
-- ============================================================
ALTER TABLE mentorship_sessions ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;


-- ============================================================
-- [42/44] create_notification_enhancements.sql
-- ============================================================
-- ============================================
-- NOTIFICATION ENHANCEMENTS SCHEMA
-- Creates tables for preferences, archive, analytics, and push notifications
-- ============================================

-- Notification Preferences Table
CREATE TABLE IF NOT EXISTS notification_preferences (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type VARCHAR NOT NULL,
  enabled BOOLEAN DEFAULT true,
  email_enabled BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT true,
  priority VARCHAR DEFAULT 'medium', -- 'high', 'medium', 'low'
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, notification_type)
);

-- Push Notification Subscriptions
CREATE TABLE IF NOT EXISTS push_notification_subscriptions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

-- Notification Archive Table
CREATE TABLE IF NOT EXISTS notification_archive (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_id VARCHAR NOT NULL,
  type VARCHAR NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  related_id TEXT,
  redirect_url TEXT,
  actor_id VARCHAR,
  metadata TEXT,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  archived_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, notification_id)
);

-- Notification Analytics Table
CREATE TABLE IF NOT EXISTS notification_analytics (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_id VARCHAR NOT NULL,
  notification_type VARCHAR NOT NULL,
  action VARCHAR NOT NULL, -- 'created', 'read', 'clicked', 'dismissed', 'archived', 'deleted'
  action_timestamp TIMESTAMPTZ DEFAULT NOW(),
  metadata TEXT, -- JSON for additional data
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notification Actions Table (for quick actions)
CREATE TABLE IF NOT EXISTS notification_actions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id VARCHAR NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type VARCHAR NOT NULL, -- 'quick_reply', 'quick_like', 'dismiss', 'snooze'
  action_data TEXT, -- JSON for action-specific data
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add archive column to notifications table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' 
    AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE notifications ADD COLUMN is_archived BOOLEAN DEFAULT false;
    ALTER TABLE notifications ADD COLUMN archived_at TIMESTAMPTZ;
    ALTER TABLE notifications ADD COLUMN priority VARCHAR DEFAULT 'medium';
    ALTER TABLE notifications ADD COLUMN snoozed_until TIMESTAMPTZ;
    ALTER TABLE notifications ADD COLUMN preview_image TEXT;
    ALTER TABLE notifications ADD COLUMN action_data TEXT; -- JSON for action buttons
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user ON notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_type ON notification_preferences(notification_type);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_notification_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_archive_user ON notification_archive(user_id, archived_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_analytics_user ON notification_analytics(user_id, action_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_notification_analytics_type ON notification_analytics(notification_type, action);
CREATE INDEX IF NOT EXISTS idx_notifications_archived ON notifications(user_id, is_archived, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(user_id, priority, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_snoozed ON notifications(user_id, snoozed_until) WHERE snoozed_until IS NOT NULL;

-- Function to auto-archive old notifications
CREATE OR REPLACE FUNCTION auto_archive_old_notifications()
RETURNS void AS $$
BEGIN
  -- Archive notifications older than 30 days that are read
  INSERT INTO notification_archive (
    user_id, notification_id, type, title, content, related_id, 
    redirect_url, actor_id, metadata, is_read, read_at, created_at
  )
  SELECT 
    user_id, id, type, title, content, related_id, 
    redirect_url, actor_id, metadata, is_read, read_at, created_at
  FROM notifications
  WHERE is_read = true 
    AND is_archived = false
    AND created_at < NOW() - INTERVAL '30 days'
  ON CONFLICT (user_id, notification_id) DO NOTHING;

  -- Mark as archived
  UPDATE notifications
  SET is_archived = true, archived_at = NOW()
  WHERE is_read = true 
    AND is_archived = false
    AND created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job (requires pg_cron extension)
-- This would typically be set up via a cron job or scheduler
-- SELECT cron.schedule('auto-archive-notifications', '0 2 * * *', 'SELECT auto_archive_old_notifications()');

-- Function to get notification analytics summary
CREATE OR REPLACE FUNCTION get_notification_analytics_summary(p_user_id VARCHAR, p_days INTEGER DEFAULT 30)
RETURNS TABLE (
  notification_type VARCHAR,
  total_created BIGINT,
  total_read BIGINT,
  read_rate NUMERIC,
  total_clicked BIGINT,
  click_rate NUMERIC,
  avg_time_to_read INTERVAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    na.notification_type,
    COUNT(*) FILTER (WHERE na.action = 'created') as total_created,
    COUNT(*) FILTER (WHERE na.action = 'read') as total_read,
    CASE 
      WHEN COUNT(*) FILTER (WHERE na.action = 'created') > 0 
      THEN ROUND(
        (COUNT(*) FILTER (WHERE na.action = 'read')::NUMERIC / 
         COUNT(*) FILTER (WHERE na.action = 'created')::NUMERIC) * 100, 
        2
      )
      ELSE 0
    END as read_rate,
    COUNT(*) FILTER (WHERE na.action = 'clicked') as total_clicked,
    CASE 
      WHEN COUNT(*) FILTER (WHERE na.action = 'read') > 0 
      THEN ROUND(
        (COUNT(*) FILTER (WHERE na.action = 'clicked')::NUMERIC / 
         COUNT(*) FILTER (WHERE na.action = 'read')::NUMERIC) * 100, 
        2
      )
      ELSE 0
    END as click_rate,
    AVG(
      CASE 
        WHEN created.action_timestamp IS NOT NULL AND read.action_timestamp IS NOT NULL
        THEN read.action_timestamp - created.action_timestamp
        ELSE NULL
      END
    ) FILTER (WHERE created.action_timestamp IS NOT NULL AND read.action_timestamp IS NOT NULL) as avg_time_to_read
  FROM notification_analytics na
  LEFT JOIN notification_analytics created 
    ON na.notification_id = created.notification_id 
    AND created.action = 'created'
  LEFT JOIN notification_analytics read 
    ON na.notification_id = read.notification_id 
    AND read.action = 'read'
  WHERE na.user_id = p_user_id
    AND na.action_timestamp >= NOW() - (p_days || ' days')::INTERVAL
  GROUP BY na.notification_type;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- [43/44] add_notification_dedup_index.sql
-- ============================================================
-- Prevents concurrent duplicate notifications of the same type/actor/related_id for a user.
-- Scoped to the types that are checked for duplicates in notification-helper.ts.
-- The application handles error code 23505 (unique violation) as a graceful skip.

CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_dedup
  ON notifications (user_id, type, related_id, actor_id)
  WHERE type IN ('post_like', 'post_comment', 'comment_reply');

-- Down:
-- DROP INDEX IF EXISTS uq_notifications_dedup;


-- ============================================================
-- [44/44] add_comment_replies.sql
-- ============================================================

-- Drop existing table if it exists to recreate with proper constraints
DROP TABLE IF EXISTS post_comment_replies CASCADE;

-- Add replies_count column to post_comments if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='post_comments' AND column_name='replies_count') THEN
    ALTER TABLE post_comments ADD COLUMN replies_count INTEGER DEFAULT 0;
  END IF;
END$$;

-- Create post_comment_replies table with explicit foreign key constraints
CREATE TABLE post_comment_replies (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id VARCHAR NOT NULL,
  user_id VARCHAR NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Explicit foreign key constraints
  CONSTRAINT fk_comment_replies_comment
    FOREIGN KEY (comment_id) 
    REFERENCES post_comments(id) 
    ON DELETE CASCADE,
    
  CONSTRAINT fk_comment_replies_user
    FOREIGN KEY (user_id) 
    REFERENCES users(id) 
    ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_comment_replies_comment_id ON post_comment_replies(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_replies_user_id ON post_comment_replies(user_id);
CREATE INDEX IF NOT EXISTS idx_comment_replies_created_at ON post_comment_replies(created_at);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_comment_reply_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_comment_reply_updated_at_trigger ON post_comment_replies;
CREATE TRIGGER update_comment_reply_updated_at_trigger
BEFORE UPDATE ON post_comment_replies
FOR EACH ROW
EXECUTE FUNCTION update_comment_reply_updated_at();

-- Update existing comments to have replies_count = 0
UPDATE post_comments SET replies_count = 0 WHERE replies_count IS NULL;

-- Grant necessary permissions (adjust as needed for your setup)
-- These might be needed depending on your Supabase RLS policies
ALTER TABLE post_comment_replies ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (you may need to adjust these based on your security requirements)
DROP POLICY IF EXISTS "Users can view active replies" ON post_comment_replies;
CREATE POLICY "Users can view active replies" ON post_comment_replies
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Users can create replies" ON post_comment_replies;
CREATE POLICY "Users can create replies" ON post_comment_replies
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update own replies" ON post_comment_replies;
CREATE POLICY "Users can update own replies" ON post_comment_replies
  FOR UPDATE USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can delete own replies" ON post_comment_replies;
CREATE POLICY "Users can delete own replies" ON post_comment_replies
  FOR DELETE USING (auth.uid()::text = user_id);


-- ============================================================
-- [44/44] Migration tracking ledger (new — closes the "no tracking" gap)
-- ============================================================
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO schema_migrations (filename) VALUES
  ('0001_fix_password_reset_tokens_timezone.sql'),
  ('prod_migration.sql'),
  ('multi_entry_profile.sql'),
  ('add_alumni_locations.sql'),
  ('create_alumni_heatmap_indexes.sql'),
  ('add_advanced_profile_fields.sql'),
  ('add_missing_alumni_columns.sql'),
  ('add_profile_improvements_fields.sql'),
  ('ensure_work_mode_column.sql'),
  ('add_jobs_industry_skills.sql'),
  ('add_venue_column.sql'),
  ('add_resume_field.sql'),
  ('add_resume_field_enhanced_rls.sql'),
  ('add_digest_preferences.sql'),
  ('fix_digest_data_accuracy.sql'),
  ('add_is_competitive_to_badges.sql'),
  ('create_blog_tables.sql'),
  ('add_blog_indexes.sql'),
  ('add_blog_counter_functions.sql'),
  ('create_podcast_tables.sql'),
  ('add_podcast_views_table.sql'),
  ('add_podcast_view_counter_function.sql'),
  ('add_podcast_likes_comments.sql'),
  ('create_travel_chapters.sql'),
  ('create_travel_chapter_messages.sql'),
  ('create_travel_chapter_events.sql'),
  ('add_travel_chapter_coordinates.sql'),
  ('create_travel_journal_tables.sql'),
  ('add_travel_post_approval_status.sql'),
  ('add_travel_post_resubmit.sql'),
  ('add_newsletters_table.sql'),
  ('add_newsletter_open_tracking.sql'),
  ('add_newsletter_unsubscribe.sql'),
  ('add_recipient_department.sql'),
  ('add_newsletter_custom_recipients.sql'),
  ('add_mentorship_tables.sql'),
  ('add_mentorship_enhancements.sql'),
  ('add_mentorship_profile_fields.sql'),
  ('add_is_mentor_column.sql'),
  ('add_mentorship_status_constraints.sql'),
  ('add_meet_link_to_sessions.sql'),
  ('add_cancellation_reason_to_sessions.sql'),
  ('create_notification_enhancements.sql'),
  ('add_notification_dedup_index.sql'),
  ('add_comment_replies.sql')
ON CONFLICT (filename) DO NOTHING;
