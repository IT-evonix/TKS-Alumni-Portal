-- Atomic podcast view tracking: inserts a unique view row and conditionally
-- increments the views_count counter in a single transaction to prevent
-- race conditions when multiple concurrent requests view the same episode.
CREATE OR REPLACE FUNCTION increment_podcast_view(p_podcast_id text, p_user_id text)
RETURNS integer AS $$
DECLARE
  v_inserted integer;
BEGIN
  INSERT INTO podcast_views (podcast_id, user_id)
  VALUES (p_podcast_id, p_user_id)
  ON CONFLICT (podcast_id, user_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted > 0 THEN
    UPDATE podcasts
    SET views_count = views_count + 1,
        updated_at = NOW()
    WHERE id = p_podcast_id;
  END IF;

  RETURN (SELECT views_count FROM podcasts WHERE id = p_podcast_id);
END;
$$ LANGUAGE plpgsql;
