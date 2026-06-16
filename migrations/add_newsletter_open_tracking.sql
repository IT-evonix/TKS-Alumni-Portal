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
