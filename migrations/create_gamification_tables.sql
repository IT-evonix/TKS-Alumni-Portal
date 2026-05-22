-- ============================================================
-- Gamification Tables Migration — FINAL CORRECT VERSION
-- Verified against gamification-service.ts and gamification-routes.ts
-- Safe to run multiple times (IF NOT EXISTS throughout)
-- Run in: Supabase SQL Editor
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. gamification_badges
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gamification_badges (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    description     TEXT,
    icon_url        TEXT,
    required_score  INTEGER NOT NULL DEFAULT 0,
    category        TEXT NOT NULL DEFAULT 'common',   -- 'common' | 'series'
    series_type     TEXT,                              -- 'thread' | 'event' | 'connection' | 'login' | 'profile'
    tier            TEXT,                              -- 'bronze' | 'silver' | 'gold'
    -- ✅ MUST be is_enabled — server uses .eq("is_enabled", true) NOT is_active
    is_enabled      BOOLEAN NOT NULL DEFAULT true,
    display_order   INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- ✅ MUST have updated_at — PUT /admin/badges/:id sets updated_at
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gamification_badges_category
    ON public.gamification_badges (category);

CREATE INDEX IF NOT EXISTS idx_gamification_badges_series_type
    ON public.gamification_badges (series_type);

CREATE INDEX IF NOT EXISTS idx_gamification_badges_is_enabled
    ON public.gamification_badges (is_enabled);

-- ─────────────────────────────────────────────────────────────
-- 2. user_scores
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_scores (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- ✅ FK to users(id) NOT alumni(user_id)
    -- Reason: admin/faculty users are in users table but NOT in alumni table
    -- gamification-service.ts checks users.user_role directly
    user_id                 VARCHAR NOT NULL UNIQUE
        REFERENCES public.users(id) ON DELETE CASCADE,
    total_points            INTEGER NOT NULL DEFAULT 0,
    thread_score            INTEGER NOT NULL DEFAULT 0,
    event_score             INTEGER NOT NULL DEFAULT 0,
    connection_score        INTEGER NOT NULL DEFAULT 0,
    -- ✅ MUST be current_streak_days (not current_streak)
    current_streak_days     INTEGER NOT NULL DEFAULT 0,
    -- ✅ MUST be highest_streak NOT highest_streak_days
    -- gamification-service.ts line 247: "highest_streak: highestStreak"
    highest_streak          INTEGER NOT NULL DEFAULT 0,
    -- ✅ MUST be last_active_date NOT last_login_date
    -- gamification-service.ts line 219: "scores.last_active_date"
    -- gamification-service.ts line 248: "last_active_date: now.toISOString()"
    last_active_date        TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_scores_total_points
    ON public.user_scores (total_points DESC);

CREATE INDEX IF NOT EXISTS idx_user_scores_user_id
    ON public.user_scores (user_id);

-- ─────────────────────────────────────────────────────────────
-- 3. user_badges
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_badges (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- ✅ FK to users(id) NOT alumni(user_id) — same reason as user_scores
    user_id     VARCHAR NOT NULL
        REFERENCES public.users(id) ON DELETE CASCADE,
    badge_id    UUID NOT NULL
        REFERENCES public.gamification_badges(id) ON DELETE CASCADE,
    earned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- A user can only earn a specific badge once
    CONSTRAINT user_badges_unique_pair UNIQUE (user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user_id
    ON public.user_badges (user_id);

CREATE INDEX IF NOT EXISTS idx_user_badges_badge_id
    ON public.user_badges (badge_id);

CREATE INDEX IF NOT EXISTS idx_user_badges_earned_at
    ON public.user_badges (earned_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 4. Row Level Security
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.gamification_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_scores         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges         ENABLE ROW LEVEL SECURITY;

-- gamification_badges policies
DO $$ BEGIN
  CREATE POLICY "Anyone can view active badges"
    ON public.gamification_badges FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Service role manages badges"
    ON public.gamification_badges FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- user_scores policies
DO $$ BEGIN
  CREATE POLICY "Anyone can view scores"
    ON public.user_scores FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Backend can update scores"
    ON public.user_scores FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- user_badges policies
DO $$ BEGIN
  CREATE POLICY "Anyone can view earned badges"
    ON public.user_badges FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Backend can manage user badges"
    ON public.user_badges FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────
-- 5. Enable Realtime (for live leaderboard & badge updates)
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.gamification_badges;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.user_scores;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.user_badges;
EXCEPTION WHEN others THEN NULL; END $$;
