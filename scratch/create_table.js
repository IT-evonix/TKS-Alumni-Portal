const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const query = `
CREATE TABLE IF NOT EXISTS "travel_chapter_messages" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "chapter_id" varchar NOT NULL REFERENCES "travel_chapters"("id") ON DELETE cascade,
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "content" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
`;
pool.query(query).then(() => {
  console.log("Table created!");
  process.exit(0);
}).catch(err => {
  console.error("Error creating table", err);
  process.exit(1);
});
