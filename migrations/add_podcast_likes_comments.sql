-- Podcast likes table
CREATE TABLE IF NOT EXISTS podcast_likes (
  id          VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  podcast_id  VARCHAR NOT NULL REFERENCES podcasts(id) ON DELETE CASCADE,
  user_id     VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (podcast_id, user_id)
);

CREATE INDEX IF NOT EXISTS podcast_likes_podcast_idx ON podcast_likes(podcast_id);
CREATE INDEX IF NOT EXISTS podcast_likes_user_idx    ON podcast_likes(user_id);

-- Add likes_count to podcasts if not present
ALTER TABLE podcasts ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;

-- Podcast comments table
CREATE TABLE IF NOT EXISTS podcast_comments (
  id          VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  podcast_id  VARCHAR NOT NULL REFERENCES podcasts(id) ON DELETE CASCADE,
  user_id     VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS podcast_comments_podcast_idx ON podcast_comments(podcast_id);
CREATE INDEX IF NOT EXISTS podcast_comments_user_idx    ON podcast_comments(user_id);

-- Add comments_count to podcasts if not present
ALTER TABLE podcasts ADD COLUMN IF NOT EXISTS comments_count INTEGER DEFAULT 0;
