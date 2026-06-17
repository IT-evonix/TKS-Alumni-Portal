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
  request_id       UUID NOT NULL REFERENCES mentorship_requests(id) ON DELETE CASCADE,
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
