-- Podcast episodes table
CREATE TABLE IF NOT EXISTS podcasts (
  id             VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by     VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Content
  title          TEXT NOT NULL,
  slug           TEXT NOT NULL UNIQUE,
  description    TEXT,
  show_notes     TEXT,

  -- Video
  video_url      TEXT NOT NULL,
  embed_url      TEXT,

  -- External links stored as JSON text: [{label: string, url: string}]
  links          TEXT DEFAULT '[]',

  -- Metadata
  tags           TEXT[] DEFAULT '{}',
  episode_number INTEGER,

  -- Publishing workflow
  status         TEXT NOT NULL DEFAULT 'draft',  -- draft | scheduled | published
  scheduled_at   TIMESTAMP WITH TIME ZONE,
  published_at   TIMESTAMP WITH TIME ZONE,
  is_featured    BOOLEAN DEFAULT false,

  views_count    INTEGER DEFAULT 0,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS podcasts_status_idx        ON podcasts(status);
CREATE INDEX IF NOT EXISTS podcasts_published_at_idx  ON podcasts(published_at DESC);
CREATE INDEX IF NOT EXISTS podcasts_scheduled_at_idx  ON podcasts(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS podcasts_slug_idx          ON podcasts(slug);
