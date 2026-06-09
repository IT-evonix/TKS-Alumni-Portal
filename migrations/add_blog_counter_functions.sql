-- Atomic counter increment/decrement for blog posts
-- Prevents race conditions in likes, bookmarks, and comments counts
-- Run this in Supabase SQL editor or as a migration

CREATE OR REPLACE FUNCTION increment_blog_counter(
  p_post_id TEXT,
  p_col TEXT,
  p_delta INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate column name to prevent SQL injection
  IF p_col NOT IN ('likes_count', 'bookmarks_count', 'comments_count', 'views_count') THEN
    RAISE EXCEPTION 'Invalid column name: %', p_col;
  END IF;

  EXECUTE format(
    'UPDATE blog_posts SET %I = GREATEST(0, %I + $1), updated_at = NOW() WHERE id = $2',
    p_col, p_col
  ) USING p_delta, p_post_id;
END;
$$;

-- Grant execute permission to authenticated users (Supabase anon/service role)
GRANT EXECUTE ON FUNCTION increment_blog_counter(TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_blog_counter(TEXT, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION increment_blog_counter(TEXT, TEXT, INTEGER) TO anon;
