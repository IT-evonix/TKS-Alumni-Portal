-- Atomic like/unlike toggle for feed posts: inserts or deletes the post_likes
-- row and updates feed_posts.likes_count in a single transaction, preventing
-- the lost-update and duplicate-like races caused by the previous
-- check-then-select-then-update pattern in POST /api/posts/:id/like.
CREATE OR REPLACE FUNCTION toggle_post_like(p_post_id TEXT, p_user_id TEXT)
RETURNS TABLE(is_liked BOOLEAN, likes_count INTEGER) AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM post_likes
  WHERE post_id = p_post_id AND user_id = p_user_id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted > 0 THEN
    UPDATE feed_posts
    SET likes_count = GREATEST(0, likes_count - 1)
    WHERE id = p_post_id;
  ELSE
    INSERT INTO post_likes (post_id, user_id)
    VALUES (p_post_id, p_user_id)
    ON CONFLICT (post_id, user_id) DO NOTHING;

    UPDATE feed_posts
    SET likes_count = likes_count + 1
    WHERE id = p_post_id;
  END IF;

  RETURN QUERY
    SELECT (v_deleted = 0), fp.likes_count
    FROM feed_posts fp
    WHERE fp.id = p_post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION toggle_post_like(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION toggle_post_like(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION toggle_post_like(TEXT, TEXT) TO anon;

-- Prevent duplicate like rows for the same user/post even under concurrent
-- requests that race past the DELETE above (belt-and-suspenders with the
-- ON CONFLICT DO NOTHING in the function).
CREATE UNIQUE INDEX IF NOT EXISTS post_likes_post_user_unique
  ON post_likes (post_id, user_id);
