-- Allow alumni to opt out of newsletters via one-click unsubscribe
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS newsletter_unsubscribed BOOLEAN NOT NULL DEFAULT FALSE;

-- Partial index: only indexes opted-out rows (keeps index tiny)
CREATE INDEX IF NOT EXISTS alumni_newsletter_unsubscribed_idx
  ON alumni(newsletter_unsubscribed)
  WHERE newsletter_unsubscribed = TRUE;
