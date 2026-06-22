-- Prevents concurrent duplicate notifications of the same type/actor/related_id for a user.
-- Scoped to the types that are checked for duplicates in notification-helper.ts.
-- The application handles error code 23505 (unique violation) as a graceful skip.

CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_dedup
  ON notifications (user_id, type, related_id, actor_id)
  WHERE type IN ('post_like', 'post_comment', 'comment_reply');

-- Down:
-- DROP INDEX IF EXISTS uq_notifications_dedup;
