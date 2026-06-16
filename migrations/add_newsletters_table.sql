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
