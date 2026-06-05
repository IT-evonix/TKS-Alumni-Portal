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
