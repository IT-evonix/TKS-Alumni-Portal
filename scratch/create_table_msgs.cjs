const { Pool } = require('pg');

const pool = new Pool({ 
  user: 'postgres',
  password: '4RV6cji@&X.A74p',
  host: 'db.qvxdatdhsvjvxuhdpsdd.supabase.co',
  port: 5432,
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

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
