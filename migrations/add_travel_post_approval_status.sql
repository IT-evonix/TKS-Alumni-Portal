ALTER TABLE travel_posts
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Back-fill: existing posts were already public, treat them as approved
UPDATE travel_posts SET status = 'approved' WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_travel_posts_status ON travel_posts(status);
CREATE INDEX IF NOT EXISTS idx_travel_posts_status_hidden ON travel_posts(status, is_hidden);
