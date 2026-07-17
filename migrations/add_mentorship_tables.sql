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
