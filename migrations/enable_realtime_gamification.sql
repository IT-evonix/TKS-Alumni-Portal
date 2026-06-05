BEGIN;
-- Drop the publication if we want to recreate it, but supabase_realtime already exists
-- Add tables to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE user_scores;
ALTER PUBLICATION supabase_realtime ADD TABLE user_badges;
COMMIT;
