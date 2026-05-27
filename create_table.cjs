const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS gamification_point_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        action_key VARCHAR(50) UNIQUE NOT NULL,
        points INTEGER NOT NULL DEFAULT 1,
        description TEXT,
        category VARCHAR(50) NOT NULL DEFAULT 'community',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Insert default rules if table is empty
    const { rowCount } = await client.query('SELECT 1 FROM gamification_point_rules LIMIT 1');
    if (rowCount === 0) {
      await client.query(`
        INSERT INTO gamification_point_rules (action_key, points, description, category) VALUES
        ('network_connect', 5, 'Points awarded for connecting with another alumni', 'networking'),
        ('thread_create', 10, 'Points awarded for creating a new community thread', 'community'),
        ('post_reply', 2, 'Points awarded for replying to a thread or post', 'community'),
        ('feed_create', 5, 'Points awarded for creating a post on the main feed', 'community'),
        ('event_rsvp', 15, 'Points awarded for RSVPing to an event', 'events')
      `);
      console.log('Default rules inserted.');
    } else {
      await client.query(`
        INSERT INTO gamification_point_rules (action_key, points, description, category) 
        VALUES ('network_connect', 5, 'Points awarded for connecting with another alumni', 'networking')
        ON CONFLICT (action_key) DO NOTHING;
      `);
      console.log('Rules already exist.');
    }
    console.log('Table created successfully.');
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
