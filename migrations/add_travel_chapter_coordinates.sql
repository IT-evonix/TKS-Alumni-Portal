-- Add real latitude/longitude columns to travel_chapters, sourced from Google Geocoding API.
-- The legacy 'coordinates' TEXT column ("lng,lat") is kept read-only for backward compatibility
-- until fully backfilled; new code should read/write latitude/longitude instead.
ALTER TABLE travel_chapters ADD COLUMN IF NOT EXISTS latitude NUMERIC;
ALTER TABLE travel_chapters ADD COLUMN IF NOT EXISTS longitude NUMERIC;

CREATE INDEX IF NOT EXISTS idx_travel_chapters_lat_lng
  ON travel_chapters(latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
