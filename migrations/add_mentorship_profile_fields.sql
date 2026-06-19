-- Add new mentor profile fields for richer mentorship experience
-- (linkedin_url already exists on the alumni table from the profile system)
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS mentorship_style TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS help_topics TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS github_url TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS portfolio_url TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS twitter_url TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS total_mentees_helped INTEGER DEFAULT 0;

-- Function to safely increment total_mentees_helped without race conditions
CREATE OR REPLACE FUNCTION increment_mentees_helped(uid TEXT)
RETURNS void AS $$
  UPDATE alumni SET total_mentees_helped = COALESCE(total_mentees_helped, 0) + 1 WHERE user_id = uid;
$$ LANGUAGE sql;
