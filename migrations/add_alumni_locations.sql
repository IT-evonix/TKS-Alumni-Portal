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
