-- Migration: create_travel_journal_tables.sql
-- Replaces travel_chapters city-community feature with travel_posts journal feed

CREATE TABLE IF NOT EXISTS travel_posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  city            TEXT NOT NULL,
  country         TEXT NOT NULL,
  coordinates     TEXT,
  caption         TEXT,
  is_hidden       BOOLEAN NOT NULL DEFAULT FALSE,
  likes_count     INTEGER NOT NULL DEFAULT 0,
  comments_count  INTEGER NOT NULL DEFAULT 0,
  bookmarks_count INTEGER NOT NULL DEFAULT 0,
  views_count     INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS travel_post_media (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id      UUID NOT NULL REFERENCES travel_posts(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN ('image', 'video')),
  url          TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  order_index  INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS travel_post_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES travel_posts(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS travel_post_likes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES travel_posts(id) ON DELETE CASCADE,
  user_id    VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

CREATE TABLE IF NOT EXISTS travel_post_bookmarks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES travel_posts(id) ON DELETE CASCADE,
  user_id    VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

CREATE TABLE IF NOT EXISTS travel_post_comments (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id   UUID NOT NULL REFERENCES travel_posts(id) ON DELETE CASCADE,
  author_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES travel_post_comments(id) ON DELETE CASCADE,
  content   TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_travel_posts_author        ON travel_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_travel_posts_city          ON travel_posts(city);
CREATE INDEX IF NOT EXISTS idx_travel_posts_created       ON travel_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_travel_posts_hidden        ON travel_posts(is_hidden);
CREATE INDEX IF NOT EXISTS idx_travel_post_media_post     ON travel_post_media(post_id, order_index);
CREATE INDEX IF NOT EXISTS idx_travel_post_links_post     ON travel_post_links(post_id);
CREATE INDEX IF NOT EXISTS idx_travel_post_likes_post     ON travel_post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_travel_post_likes_user     ON travel_post_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_travel_post_bookmarks_user ON travel_post_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_travel_post_comments_post  ON travel_post_comments(post_id, is_active);
CREATE INDEX IF NOT EXISTS idx_travel_post_comments_par   ON travel_post_comments(parent_id);

-- Atomic counter function (mirrors increment_blog_counter)
CREATE OR REPLACE FUNCTION increment_travel_post_counter(
  p_post_id TEXT,
  p_col     TEXT,
  p_delta   INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_col NOT IN ('likes_count', 'bookmarks_count', 'comments_count', 'views_count') THEN
    RAISE EXCEPTION 'Invalid column: %', p_col;
  END IF;
  EXECUTE format(
    'UPDATE travel_posts SET %I = GREATEST(0, %I + $1), updated_at = NOW() WHERE id = $2',
    p_col, p_col
  ) USING p_delta, p_post_id::UUID;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_travel_post_counter(TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_travel_post_counter(TEXT, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION increment_travel_post_counter(TEXT, TEXT, INTEGER) TO anon;
