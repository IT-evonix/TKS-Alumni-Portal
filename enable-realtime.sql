BEGIN;
ALTER PUBLICATION supabase_realtime ADD TABLE user_scores;
ALTER PUBLICATION supabase_realtime ADD TABLE user_badges;
COMMIT;
