-- ============================================================================
-- FINAL VERIFICATION — dummy-email cleanup (all 6 migrations)
-- TARGET: Supabase project aikvtpqqxasdctchtgct (PROD)
-- Read-only. Run each block; every "PASS/FAIL" column should read PASS.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. HEADLINE COUNTS
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  (SELECT count(*) FROM users)  AS total_users,          -- expect 1222
  (SELECT count(*) FROM alumni) AS total_alumni,         -- expect 1210
  (SELECT count(*) FROM users  WHERE email ILIKE '%placeholder%' OR email ILIKE '%@student.tks.com') AS users_still_dummy,   -- expect 38
  (SELECT count(*) FROM alumni WHERE email ILIKE '%placeholder%' OR email ILIKE '%@student.tks.com') AS alumni_still_dummy,  -- expect 38
  CASE WHEN
    (SELECT count(*) FROM users  WHERE email ILIKE '%placeholder%' OR email ILIKE '%@student.tks.com') = 38
    AND (SELECT count(*) FROM alumni WHERE email ILIKE '%placeholder%' OR email ILIKE '%@student.tks.com') = 38
  THEN 'PASS' ELSE 'FAIL' END AS dummy_count_check;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. users.email  vs  alumni.email  — must be identical for every linked pair
-- ─────────────────────────────────────────────────────────────────────────────
SELECT count(*) AS email_mismatches,                     -- expect 0
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS mismatch_check
FROM users u
JOIN alumni a ON a.user_id = u.id
WHERE lower(u.email) <> lower(a.email);

-- (if the above is > 0, list them:)
SELECT u.username, u.email AS users_email, a.email AS alumni_email
FROM users u JOIN alumni a ON a.user_id = u.id
WHERE lower(u.email) <> lower(a.email);


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. NO ORPHANED CHILD ROWS (a FK pointing at a user/alumni that no longer exists)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'connection_requests.requester_id' AS ref, count(*) AS orphans FROM connection_requests c LEFT JOIN users u ON u.id = c.requester_id WHERE u.id IS NULL
UNION ALL SELECT 'connection_requests.recipient_id', count(*) FROM connection_requests c LEFT JOIN users u ON u.id = c.recipient_id WHERE u.id IS NULL
UNION ALL SELECT 'messages.sender_id',   count(*) FROM messages m LEFT JOIN users u ON u.id = m.sender_id   WHERE u.id IS NULL
UNION ALL SELECT 'messages.receiver_id', count(*) FROM messages m LEFT JOIN users u ON u.id = m.receiver_id WHERE u.id IS NULL
UNION ALL SELECT 'feed_posts.author_id', count(*) FROM feed_posts f LEFT JOIN users u ON u.id = f.author_id WHERE u.id IS NULL
UNION ALL SELECT 'post_comments.user_id', count(*) FROM post_comments p LEFT JOIN users u ON u.id = p.user_id WHERE u.id IS NULL
UNION ALL SELECT 'post_likes.user_id',    count(*) FROM post_likes p LEFT JOIN users u ON u.id = p.user_id WHERE u.id IS NULL
UNION ALL SELECT 'notifications.user_id', count(*) FROM notifications n LEFT JOIN users u ON u.id = n.user_id WHERE u.id IS NULL
UNION ALL SELECT 'event_rsvps.user_id',   count(*) FROM event_rsvps e LEFT JOIN users u ON u.id = e.user_id WHERE u.id IS NULL
UNION ALL SELECT 'alumni_orphans (alumni row, no users row)', count(*) FROM alumni a LEFT JOIN users u ON u.id = a.user_id WHERE u.id IS NULL
UNION ALL SELECT 'alumni_experiences.alumni_id', count(*) FROM alumni_experiences x LEFT JOIN alumni a ON a.id = x.alumni_id WHERE a.id IS NULL
UNION ALL SELECT 'alumni_skills.alumni_id',      count(*) FROM alumni_skills x LEFT JOIN alumni a ON a.id = x.alumni_id WHERE a.id IS NULL
ORDER BY orphans DESC;
-- every row's "orphans" must be 0.


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. NO DUPLICATE EMAILS  (users.email and alumni.email are UNIQUE — belt & braces)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'users'  AS tbl, lower(email) AS email, count(*) AS n FROM users  GROUP BY lower(email) HAVING count(*) > 1
UNION ALL
SELECT 'alumni' AS tbl, lower(email), count(*) FROM alumni GROUP BY lower(email) HAVING count(*) > 1;
-- expect ZERO rows.


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. THE 38 REMAINING DUMMY ACCOUNTS — full detail (this is the school round-2 list)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  u.username,
  a.first_name || ' ' || a.last_name AS name,
  a.graduation_year,
  u.email        AS dummy_email,
  u.account_approved,
  u.account_blocked,
  u.created_at::date AS created,
  (SELECT count(*) FROM connection_requests c WHERE c.requester_id = u.id OR c.recipient_id = u.id) AS conn_reqs,
  (SELECT count(*) FROM messages m WHERE m.sender_id = u.id OR m.receiver_id = u.id)                AS msgs,
  (SELECT count(*) FROM feed_posts f WHERE f.author_id = u.id)                                     AS posts
FROM users u
JOIN alumni a ON a.user_id = u.id
WHERE u.email ILIKE '%placeholder%' OR u.email ILIKE '%@student.tks.com'
ORDER BY a.graduation_year, name;
-- expect 38 rows. Cross-check names against scripts/out/school-round2.csv (33) + the 5 not-in-sheet
-- (Girish Agarwal, Ishan Muzumdar, Tanistha Singh, Siddhi Bahl, Maanasa Yenamandra).


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. SPOT-CHECK: accounts each migration touched are in the expected end state
-- ─────────────────────────────────────────────────────────────────────────────
-- 6a. migration 1 — 3 sample email updates + 3 sample deletes
SELECT 'm1 update suryansh.rajyam'  AS check, email,
       CASE WHEN email = 'sururajyam@gmail.com' THEN 'PASS' ELSE 'FAIL' END AS result
  FROM users WHERE username = 'suryansh.rajyam'
UNION ALL
SELECT 'm1 update venkata.arnavkossireddi', email,
       CASE WHEN email = 'arnavkossireddi@gmail.com' THEN 'PASS' ELSE 'FAIL' END
  FROM users WHERE username = 'venkata.arnavkossireddi'
UNION ALL
SELECT 'm1 delete peter.ekka (should be gone)', COALESCE((SELECT email FROM users WHERE username='peter.ekka'),'(deleted)'),
       CASE WHEN NOT EXISTS (SELECT 1 FROM users WHERE username='peter.ekka') THEN 'PASS' ELSE 'FAIL' END
UNION ALL
SELECT 'm1 delete evya.gupta (should be gone)', COALESCE((SELECT email FROM users WHERE username='evya.gupta'),'(deleted)'),
       CASE WHEN NOT EXISTS (SELECT 1 FROM users WHERE username='evya.gupta') THEN 'PASS' ELSE 'FAIL' END;

-- 6b. migration 2 — dup-account merge: placeholder gone, real self-registered account kept
SELECT 'm2 ansh.tilloo placeholder gone' AS check,
       CASE WHEN NOT EXISTS (SELECT 1 FROM users WHERE username='ansh.tilloo') THEN 'PASS' ELSE 'FAIL' END AS result
UNION ALL
SELECT 'm2 real account anshtilloo_mo839n4j kept, real email',
       CASE WHEN (SELECT email FROM users WHERE username='anshtilloo_mo839n4j') = 'anshtilloo@gmail.com' THEN 'PASS' ELSE 'FAIL' END;

-- 6c. migrations 3+5 — Muskaan: exactly ONE account, on muskaan.nj.bhatt@gmail.com, both fields
SELECT 'm3/m5 Muskaan single account on nj.bhatt' AS check,
       CASE WHEN (
         SELECT count(*) FROM users u JOIN alumni a ON a.user_id=u.id
          WHERE a.first_name ILIKE 'muskaan' AND a.last_name ILIKE 'bhatt'
       ) = 1
       AND (
         SELECT lower(u.email) = 'muskaan.nj.bhatt@gmail.com' AND lower(a.email) = 'muskaan.nj.bhatt@gmail.com'
           FROM users u JOIN alumni a ON a.user_id=u.id
          WHERE a.first_name ILIKE 'muskaan' AND a.last_name ILIKE 'bhatt' LIMIT 1
       )
       THEN 'PASS' ELSE 'FAIL' END AS result;

-- 6d. migration 4 — 3 mismatches fixed (Arnav typo etc.)
SELECT 'm4 Arnav Rathore alumni.email typo fixed' AS check, a.email,
       CASE WHEN a.email = 'shailabhrathore@rediffmail.com' THEN 'PASS' ELSE 'FAIL' END AS result
  FROM alumni a WHERE a.id = '37a9443e-21a0-4569-985c-f451eff74c7e';

-- 6e. migration 6 — dedupe: a pattern-A placeholder gone + its real account holds the email;
--                   a pattern-B keeper now on the real email
SELECT 'm6 advika.bagmar placeholder gone' AS check,
       CASE WHEN NOT EXISTS (SELECT 1 FROM users WHERE username='advika.bagmar') THEN 'PASS' ELSE 'FAIL' END AS result
UNION ALL
SELECT 'm6 pattern-A real acct advikabagmar_mlf0n561 holds email',
       CASE WHEN (SELECT email FROM users WHERE username='advikabagmar_mlf0n561') = 'advika.bagmar@gmail.com' THEN 'PASS' ELSE 'FAIL' END
UNION ALL
SELECT 'm6 pattern-B keeper 23200_mlkrjnrx on real email',
       CASE WHEN (SELECT email FROM users WHERE username='23200_mlkrjnrx') = 'sanskutigupta@gmail.com' THEN 'PASS' ELSE 'FAIL' END
UNION ALL
SELECT 'm6 pattern-B keeper 23200_mlkrjnrx alumni.email matches',
       CASE WHEN (SELECT a.email FROM alumni a JOIN users u ON u.id=a.user_id WHERE u.username='23200_mlkrjnrx') = 'sanskutigupta@gmail.com' THEN 'PASS' ELSE 'FAIL' END;


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. NO real self-registered account was deleted by mistake
--    (every non-dummy account that ever had activity should still exist — sanity by count)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  (SELECT count(DISTINCT author_id)   FROM feed_posts)          AS distinct_post_authors,
  (SELECT count(*) FROM users u WHERE EXISTS (SELECT 1 FROM feed_posts f WHERE f.author_id = u.id)) AS post_authors_still_present,
  CASE WHEN (SELECT count(DISTINCT author_id) FROM feed_posts)
          = (SELECT count(*) FROM users u WHERE EXISTS (SELECT 1 FROM feed_posts f WHERE f.author_id = u.id))
       THEN 'PASS' ELSE 'FAIL' END AS every_post_author_exists,
  (SELECT count(*) FROM connection_requests c WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = c.requester_id)
                                                 OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = c.recipient_id)) AS broken_connections,
  (SELECT count(*) FROM users WHERE is_admin = true)  AS admin_accounts,          -- should be unchanged from before
  (SELECT count(*) FROM users WHERE user_role = 'administrator') AS administrator_role_accounts;


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. approved / active alumni population (the number that matters for the portal)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  count(*) FILTER (WHERE u.account_approved AND NOT u.account_blocked)                               AS approved_active,
  count(*) FILTER (WHERE u.account_approved AND NOT u.account_blocked
                        AND u.email NOT ILIKE '%placeholder%' AND u.email NOT ILIKE '%@student.tks.com') AS approved_active_real_email,
  count(*) FILTER (WHERE NOT u.account_approved)                                                     AS not_yet_approved,
  count(*) FILTER (WHERE u.account_blocked)                                                          AS blocked
FROM users u;


-- ─────────────────────────────────────────────────────────────────────────────
-- 9. INFORMATIONAL — same name + same graduation year appearing >1 time.
--    NOT a pass/fail. ~35 groups: people who self-registered TWICE with two different
--    REAL emails (the email-based dedupe could not catch these). A separate 3rd merge
--    pass will handle the genuine same-person ones; the rest are siblings/namesakes.
--    This query just lists them so the number is known and tracked.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT lower(trim(a.first_name)) AS fn, lower(trim(a.last_name)) AS ln, a.graduation_year, count(*) AS n,
       string_agg(u.username || ' <' || a.email || '> approved=' || u.account_approved, '  |  ') AS accounts
FROM alumni a JOIN users u ON u.id = a.user_id
GROUP BY lower(trim(a.first_name)), lower(trim(a.last_name)), a.graduation_year
HAVING count(*) > 1
ORDER BY n DESC, ln;
-- Expect ~35 rows. Each = 2-4 accounts. Same person = a dupe for the 3rd pass;
-- different people (e.g. "sania" vs "sameera" merchant, "anay" vs "priyanka" ghugre) = leave alone.


-- ─────────────────────────────────────────────────────────────────────────────
-- 10. OVERALL — one-line summary
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  (SELECT count(*) FROM users)  AS users,
  (SELECT count(*) FROM alumni) AS alumni,
  (SELECT count(*) FROM users  WHERE email ILIKE '%placeholder%' OR email ILIKE '%@student.tks.com') AS still_dummy,
  (SELECT count(*) FROM users u JOIN alumni a ON a.user_id=u.id WHERE lower(u.email)<>lower(a.email)) AS email_mismatch,
  (SELECT count(*) FROM alumni a LEFT JOIN users u ON u.id=a.user_id WHERE u.id IS NULL) AS orphan_alumni,
  CASE WHEN
      (SELECT count(*) FROM users  WHERE email ILIKE '%placeholder%' OR email ILIKE '%@student.tks.com') = 38
  AND (SELECT count(*) FROM alumni WHERE email ILIKE '%placeholder%' OR email ILIKE '%@student.tks.com') = 38
  AND (SELECT count(*) FROM users u JOIN alumni a ON a.user_id=u.id WHERE lower(u.email)<>lower(a.email)) = 0
  AND (SELECT count(*) FROM alumni a LEFT JOIN users u ON u.id=a.user_id WHERE u.id IS NULL) = 0
  THEN '>>> ALL CORE CHECKS PASS <<<' ELSE '>>> SOMETHING FAILED — investigate above <<<' END AS verdict;
