-- ============================================================================
-- Fix 3 pre-existing users.email <> alumni.email mismatches.
-- TARGET: Supabase project aikvtpqqxasdctchtgct (PROD)
--
-- Login is by users.email (server/routes.ts). alumni.email is display/outbound only.
-- These 3 accounts had a divergent alumni.email from an old profile edit. Align alumni.email
-- to the login email (users.email) — the address that actually works for sign-in.
--
--   Arnav Rathore     37a9443e-...  'shailabhrathore@reddifmail.com'          -> 'shailabhrathore@rediffmail.com'   (typo fix)
--   Muskaan Bhatt      f753f613-...  'muskaan.nj.bhatt@gmail.com'             -> 'musubhatt@gmail.com'
--   Bhargavi Deshmukh  52911245-...  'bhargavi.deshmukh2023@vitstudent.ac.in' -> 'dbhargavi.deshmukh@gmail.com'
--
-- One atomic statement. Guards abort (division by zero) if the target rows aren't what we expect
-- or if the new email collides with a different account. Auto-commits on success.
-- On success: g_targets=1 g_no_collision=1 alumni_updated=3  mismatches_remaining=0
-- ============================================================================
WITH
_fix (alumni_id, user_id, expected_old_alumni_email, new_email) AS (VALUES
  ('37a9443e-21a0-4569-985c-f451eff74c7e', '15f182b9-a732-427a-9deb-697e4ced6b41', 'shailabhrathore@reddifmail.com',          'shailabhrathore@rediffmail.com'),
  ('f753f613-e2d4-486a-a000-803a2438f6b1', 'dee431c0-982a-41e7-a3bb-78c54e8d1e5d', 'muskaan.nj.bhatt@gmail.com',              'musubhatt@gmail.com'),
  ('52911245-44c3-4935-af36-af220a1915bc', 'c5d2fe86-56dc-4758-bd95-2cf1791c81f8', 'bhargavi.deshmukh2023@vitstudent.ac.in',  'dbhargavi.deshmukh@gmail.com')
),

-- guard: each target alumni row exists, is linked to the stated user, has the expected old email,
--        and that user's login email already equals the new email
g_targets AS (
  SELECT (1 / (1 - LEAST(1, 3 - count(*))))::int AS ok
    FROM _fix f
    JOIN alumni a ON a.id = f.alumni_id AND a.user_id = f.user_id
                 AND lower(a.email) = lower(f.expected_old_alumni_email)
    JOIN users  u ON u.id = f.user_id AND lower(u.email) = lower(f.new_email)
),
-- guard: the new email is not already on a DIFFERENT alumni row
g_no_collision AS (
  SELECT (1 / (1 - LEAST(1, count(*))))::int AS ok
    FROM _fix f
    JOIN alumni a ON lower(a.email) = lower(f.new_email) AND a.id <> f.alumni_id
),
upd AS (
  UPDATE alumni a SET email = f.new_email, updated_at = now()
    FROM _fix f
   WHERE a.id = f.alumni_id
     AND (SELECT ok FROM g_targets) = 1
     AND (SELECT ok FROM g_no_collision) = 1
  RETURNING 1
)
SELECT
  (SELECT ok FROM g_targets)      AS g_targets,
  (SELECT ok FROM g_no_collision) AS g_no_collision,
  (SELECT count(*) FROM upd)      AS alumni_updated,   -- expect 3
  (SELECT count(*) FROM users u JOIN alumni a ON a.user_id = u.id
     WHERE lower(u.email) <> lower(a.email))           AS mismatches_remaining_snapshot;  -- pre-write snapshot (still 3)
