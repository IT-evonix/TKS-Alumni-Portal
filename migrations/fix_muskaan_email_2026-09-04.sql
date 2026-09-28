-- ============================================================================
-- Set Muskaan Bhatt's account email to muskaan.nj.bhatt@gmail.com (users + alumni).
-- TARGET: Supabase project aikvtpqqxasdctchtgct (PROD)
--
-- Account: dee431c0-982a-41e7-a3bb-78c54e8d1e5d  (alumni id f753f613-e2d4-486a-a000-803a2438f6b1)
--   currently users.email = alumni.email = 'musubhatt@gmail.com'
--   -> both set to 'muskaan.nj.bhatt@gmail.com'  (this becomes her LOGIN email)
-- Verified: muskaan.nj.bhatt@gmail.com is free on both users and alumni.
-- (Bhargavi Deshmukh already sits on dbhargavi.deshmukh@gmail.com — no change needed there.)
--
-- One atomic statement. Guards abort (division by zero) on any surprise. Auto-commits on success.
-- On success: g_target=1 g_free_users=1 g_free_alumni=1 users_updated=1 alumni_updated=1
-- ============================================================================
WITH
_new AS (SELECT 'muskaan.nj.bhatt@gmail.com'::text AS email,
                'dee431c0-982a-41e7-a3bb-78c54e8d1e5d'::text AS user_id,
                'f753f613-e2d4-486a-a000-803a2438f6b1'::text AS alumni_id),

-- guard: BOTH the users row and the alumni row are exactly as expected right now.
-- count = (1 if users row matches) + (1 if alumni row matches); need 2. If <2, 2-count > 0 -> 1/0 -> abort.
g_target AS (
  SELECT (1 / (1 - LEAST(1, 2 - (
      (SELECT count(*) FROM users  u, _new n WHERE u.id = n.user_id   AND lower(u.email) = 'musubhatt@gmail.com')
    + (SELECT count(*) FROM alumni a, _new n WHERE a.id = n.alumni_id AND a.user_id = n.user_id AND lower(a.email) = 'musubhatt@gmail.com')
    ))))::int AS ok
),
-- guard: new email not already on a DIFFERENT users row
g_free_users AS (
  SELECT (1 / (1 - LEAST(1, count(*))))::int AS ok
    FROM users u, _new n WHERE lower(u.email) = n.email AND u.id <> n.user_id
),
-- guard: new email not already on a DIFFERENT alumni row
g_free_alumni AS (
  SELECT (1 / (1 - LEAST(1, count(*))))::int AS ok
    FROM alumni a, _new n WHERE lower(a.email) = n.email AND a.id <> n.alumni_id
),
upd_users AS (
  UPDATE users u SET email = n.email, updated_at = now()
    FROM _new n
   WHERE u.id = n.user_id
     AND (SELECT ok FROM g_target) = 1
     AND (SELECT ok FROM g_free_users) = 1
     AND (SELECT ok FROM g_free_alumni) = 1
  RETURNING 1
),
upd_alumni AS (
  UPDATE alumni a SET email = n.email, updated_at = now()
    FROM _new n
   WHERE a.id = n.alumni_id
     AND (SELECT ok FROM g_target) = 1
     AND (SELECT ok FROM g_free_users) = 1
     AND (SELECT ok FROM g_free_alumni) = 1
  RETURNING 1
)
SELECT
  (SELECT ok FROM g_target)         AS g_target,
  (SELECT ok FROM g_free_users)     AS g_free_users,
  (SELECT ok FROM g_free_alumni)    AS g_free_alumni,
  (SELECT count(*) FROM upd_users)  AS users_updated,   -- expect 1
  (SELECT count(*) FROM upd_alumni) AS alumni_updated;  -- expect 1
