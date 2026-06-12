CREATE TABLE IF NOT EXISTS "travel_chapter_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "chapter_id" uuid NOT NULL REFERENCES "travel_chapters"("id") ON DELETE cascade,
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "content" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
