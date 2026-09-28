-- ============================================================================
-- One-off: delete the duplicate placeholder account for Muskaan Bhatt.
-- TARGET: Supabase project aikvtpqqxasdctchtgct (PROD)
--
-- Context: Muskaan Bhatt has two accounts (both grad 2022):
--   e35e6888-855b-4c00-b7c8-34c55ef4dfdb  placeholder, imported Oct 2025, account_approved=false,
--                                         alumni.email still 'muskaan.bhatt@alumni.placeholder.com'
--                                         (this is the "194th" dummy alumni row).
--   dee431c0-982a-41e7-a3bb-78c54e8d1e5d  real, self-registered Feb 2026, account_approved=true,
--                                         phone +91 7573804804 — KEEP THIS ONE.
-- The dup-account merge mis-classified this pair (the two accounts' emails were split across
-- users vs alumni), so the placeholder was not deleted. Delete it now.
--
-- One atomic statement. Guards abort (division by zero) on any surprise. Auto-commits on success.
-- On success the result row: g_placeholder=1 g_real_kept=1 g_noblock=1 alumni_deleted=1 users_deleted=1
--   users_still_dummy=193  alumni_still_dummy=193   (both aligned again)
-- ============================================================================
WITH
_ph (id) AS (VALUES ('e35e6888-855b-4c00-b7c8-34c55ef4dfdb')),

-- guard: the placeholder is the unapproved Oct-2025 account we expect (not the real one)
g_placeholder AS (
  SELECT (1 / (1 - LEAST(1, count(*))))::int AS ok
    FROM users
   WHERE id = (SELECT id FROM _ph)
     AND (account_approved = true OR created_at > '2025-11-01' OR username <> 'muskaan.bhatt')
),
-- guard: the real account we keep still exists and is approved
g_real_kept AS (
  SELECT (1 / (1 - LEAST(1, count(*))))::int AS ok
    FROM (SELECT 1) s
   WHERE NOT EXISTS (
     SELECT 1 FROM users
      WHERE id = 'dee431c0-982a-41e7-a3bb-78c54e8d1e5d' AND account_approved = true AND account_blocked = false
   )
),
-- guard: no blocking child row (no ON DELETE CASCADE) references the placeholder
g_noblock AS (
  SELECT (1 / (1 - LEAST(1,
       (SELECT count(*) FROM feed_posts          WHERE author_id    IN (SELECT id FROM _ph))
     + (SELECT count(*) FROM connection_requests WHERE requester_id IN (SELECT id FROM _ph) OR recipient_id IN (SELECT id FROM _ph))
     + (SELECT count(*) FROM user_blocks         WHERE blocker_id   IN (SELECT id FROM _ph) OR blocked_id IN (SELECT id FROM _ph))
     + (SELECT count(*) FROM events              WHERE organized_by IN (SELECT id FROM _ph))
     + (SELECT count(*) FROM signup_requests     WHERE reviewed_by  IN (SELECT id FROM _ph))
     + (SELECT count(*) FROM messages            WHERE sender_id    IN (SELECT id FROM _ph) OR receiver_id IN (SELECT id FROM _ph))
     )))::int AS ok
),
del_alumni AS (
  DELETE FROM alumni
   WHERE user_id IN (SELECT id FROM _ph)
     AND (SELECT ok FROM g_placeholder) = 1
     AND (SELECT ok FROM g_real_kept) = 1
     AND (SELECT ok FROM g_noblock) = 1
  RETURNING 1
),
del_users AS (
  DELETE FROM users
   WHERE id IN (SELECT id FROM _ph)
     AND (SELECT ok FROM g_placeholder) = 1
     AND (SELECT ok FROM g_real_kept) = 1
     AND (SELECT ok FROM g_noblock) = 1
     AND (SELECT count(*) FROM del_alumni) >= 0
  RETURNING 1
)
SELECT
  (SELECT ok FROM g_placeholder)  AS g_placeholder,
  (SELECT ok FROM g_real_kept)    AS g_real_kept,
  (SELECT ok FROM g_noblock)      AS g_noblock,
  (SELECT count(*) FROM del_alumni) AS alumni_deleted,
  (SELECT count(*) FROM del_users)  AS users_deleted,
  (SELECT count(*) FROM users  WHERE email LIKE '%placeholder%' OR email LIKE '%@student.tks.com') AS users_still_dummy,
  (SELECT count(*) FROM alumni WHERE email LIKE '%placeholder%' OR email LIKE '%@student.tks.com') AS alumni_still_dummy;
