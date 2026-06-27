-- Add columns to support author edit & resubmit flow for travel posts
ALTER TABLE travel_posts
  ADD COLUMN IF NOT EXISTS previous_caption        TEXT,
  ADD COLUMN IF NOT EXISTS previous_city           TEXT,
  ADD COLUMN IF NOT EXISTS previous_country        TEXT,
  ADD COLUMN IF NOT EXISTS previous_media_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS resubmit_count          INTEGER NOT NULL DEFAULT 0;
