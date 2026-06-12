CREATE TABLE IF NOT EXISTS "podcast_views" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "podcast_id" varchar NOT NULL REFERENCES podcasts(id) ON DELETE CASCADE,
    "user_id" varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "viewed_at" timestamp DEFAULT now() NOT NULL,
    UNIQUE("podcast_id", "user_id")
);

CREATE INDEX IF NOT EXISTS podcast_views_podcast_id_idx ON podcast_views(podcast_id);
CREATE INDEX IF NOT EXISTS podcast_views_user_id_idx ON podcast_views(user_id);
