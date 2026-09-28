-- ============================================================================
-- Full cleanup — auto-actions   |   TARGET: Supabase project aikvtpqqxasdctchtgct (PROD)
-- Generated 2026-09-10 by scripts/full-cleanup-merge.ts
--
-- ONE atomic statement (WITH-chain). Applies fully and auto-commits, or errors and changes
-- nothing. Guards compute 1/(1-LEAST(1,<bad>)) -> 1 when clean, else division-by-zero.
--
--  1. 17 duplicate merges  — delete the school-import placeholder account, keep the
--     student's self-registered account (verified: import acct has ZERO activity, 0 child rows).
--  2. 1 email typo fix       — strip the "mailto:" prefix on mailtojanvidixit_mlf0mfz3.
--  3. 14 test/dev deletes   — 'om','admin','vijay', 10x 'prashant*' dev accounts,
--     'alumni@evonix.co'. Also removes their 6 empty alumni rows and vijay's 1 test message.
--
-- All other issues (~180 duplicate groups needing school confirmation, yopmail throwaways,
-- internal-domain emails) are in scripts/out/MASTER-school-list.csv — NOT touched here.
--
-- On SUCCESS: g_merge_dummy=1 g_merge_keep_ok=1 g_test_safe=1
--   dupe_placeholders_deleted=17  typo_fixed=1
--   test_users_deleted=14  test_alumni_deleted=6  test_messages_deleted=1
-- Then run full_cleanup_2026-09-10_verify.sql.
-- ============================================================================
WITH
_dupe_drop (id) AS (VALUES
    ('674a79c5-fe39-40aa-890e-8c1b4ae42a2d'),
    ('5a9e627e-fb1f-4119-82f5-dc07eb7d853c'),
    ('b7962f92-602d-48ba-94b9-e9294453f425'),
    ('26f4cb2d-3389-4fe4-a986-b42766029331'),
    ('0e0b8c21-63db-4476-bb64-9562dc0de65e'),
    ('6a221ee6-f8ee-4994-8729-4ee805391420'),
    ('f275b818-4333-4112-8f58-5bfd542998a3'),
    ('0210913e-6788-48ca-bc58-49bf0ce0351b'),
    ('462c0c84-f25c-48aa-b1aa-feb89109eed9'),
    ('4fe3c986-7e93-4410-941e-1097169458f2'),
    ('db1a0210-cfdf-46fa-b3b8-0651ae3e674b'),
    ('5121689e-11e3-4693-96e7-6b50429ebb5a'),
    ('9df5c698-b854-481e-aa9e-54d92868bf70'),
    ('ccfe522e-087b-4eda-a608-31e7b8db132b'),
    ('9fe551e3-57ce-4b57-ac60-3bc0f9711da9'),
    ('5e2bd069-5195-45f5-a5d0-e9de1667f5bb'),
    ('d66f308f-5b14-41c6-add2-7b3a2f5093bc')
),
_test (id) AS (VALUES
    ('34fddbe7-f389-4656-a89a-26c00faf16b7'),
    ('6df711df-3f69-492e-957b-8a8f25e60d24'),
    ('4083c1f2-fda0-45d0-a165-b775a49aa6fa'),
    ('abdb6db0-b0ad-4458-964e-5a4dd1dfe4fe'),
    ('243b19c8-19ee-469a-ab0a-5cf0ea75811c'),
    ('cbec901b-ef94-4d43-8ec3-bc6d148238e1'),
    ('0b01f869-5951-4226-a7c5-3a659840e0e6'),
    ('c7754042-ec36-4a25-bc5d-3f57b093acd4'),
    ('9e3c5439-0eab-4b83-ab10-a38e049881ab'),
    ('c1d21e05-7282-433d-915a-00225f53e132'),
    ('97219acf-34c2-496f-a15d-a67632e5b7eb'),
    ('04dbca18-cbfb-4237-9f9d-7c0b6117c447'),
    ('61d67a3d-f64c-4fca-be41-611cdcfdd7f1'),
    ('70817401-ccf9-4726-ad07-1a494d75ef8b')
),

-- ---- guards ----
g_merge_dummy AS (         -- every dupe-drop account is a school import: dummy email OR created on
                            -- an import date, AND has zero activity (checked in precheck; re-assert dummy/date here)
  SELECT (1 / (1 - LEAST(1, count(*))))::int AS ok
    FROM _dupe_drop d JOIN users u ON u.id = d.id
   WHERE NOT (
     u.email LIKE '%placeholder%' OR u.email LIKE '%@student.tks.com'
     OR u.created_at::date IN ('2025-10-02','2026-02-09','2026-02-13')
   )
),
g_merge_keep_ok AS (       -- for each dupe-drop, a DIFFERENT non-blocked account with the same
                            -- normalized name still exists (the keeper)
  SELECT (1 / (1 - LEAST(1, count(*))))::int AS ok
    FROM _dupe_drop d
    JOIN alumni ad ON ad.user_id = d.id
   WHERE NOT EXISTS (
     SELECT 1 FROM alumni ak JOIN users uk ON uk.id = ak.user_id
      WHERE ak.user_id <> d.id
        AND lower(regexp_replace(ak.first_name, '[^a-zA-Z0-9]', '', 'g')) = lower(regexp_replace(ad.first_name, '[^a-zA-Z0-9]', '', 'g'))
        AND lower(regexp_replace(ak.last_name,  '[^a-zA-Z0-9]', '', 'g')) = lower(regexp_replace(ad.last_name,  '[^a-zA-Z0-9]', '', 'g'))
        AND NOT uk.account_blocked
   )
),
g_test_safe AS (           -- no test account is an admin / administrator, and none has feed posts,
                            -- connection requests, or blog posts (only vijay's 1 message is allowed)
  SELECT (1 / (1 - LEAST(1,
       (SELECT count(*) FROM users u WHERE u.id IN (SELECT id FROM _test) AND (u.is_admin OR u.user_role = 'administrator'))
     + (SELECT count(*) FROM feed_posts          WHERE author_id    IN (SELECT id FROM _test))
     + (SELECT count(*) FROM connection_requests WHERE requester_id IN (SELECT id FROM _test) OR recipient_id IN (SELECT id FROM _test))
     + (SELECT count(*) FROM blog_posts          WHERE author_id    IN (SELECT id FROM _test))
     + (SELECT count(*) FROM events              WHERE organized_by IN (SELECT id FROM _test))
     + (SELECT count(*) FROM signup_requests     WHERE reviewed_by  IN (SELECT id FROM _test))
     )))::int AS ok
),

-- ---- writes ----
typo_fix AS (
  UPDATE users u SET email = 'janvi.dixit@thekalyanischool.com', updated_at = now()
   WHERE u.id = '392a7787-47ae-4b2b-b2eb-7c0d0cca1dae' AND lower(u.email) = 'mailto:janvi.dixit@thekalyanischool.com'
  RETURNING 1
),
typo_fix_alumni AS (
  UPDATE alumni a SET email = 'janvi.dixit@thekalyanischool.com', updated_at = now()
   WHERE a.user_id = '392a7787-47ae-4b2b-b2eb-7c0d0cca1dae' AND lower(a.email) = 'mailto:janvi.dixit@thekalyanischool.com'
  RETURNING 1
),
-- vijay's single test message (no ON DELETE CASCADE on messages.sender_id / receiver_id)
msg_clear AS (
  DELETE FROM messages
   WHERE (sender_id IN (SELECT id FROM _test) OR receiver_id IN (SELECT id FROM _test))
     AND (SELECT ok FROM g_test_safe) = 1
  RETURNING 1
),
del_dupe_alumni AS (
  DELETE FROM alumni WHERE user_id IN (SELECT id FROM _dupe_drop)
     AND (SELECT ok FROM g_merge_dummy) = 1 AND (SELECT ok FROM g_merge_keep_ok) = 1
  RETURNING 1
),
del_dupe_users AS (
  DELETE FROM users WHERE id IN (SELECT id FROM _dupe_drop)
     AND (SELECT ok FROM g_merge_dummy) = 1 AND (SELECT ok FROM g_merge_keep_ok) = 1
     AND (SELECT count(*) FROM del_dupe_alumni) >= 0
  RETURNING 1
),
del_test_alumni AS (
  DELETE FROM alumni WHERE user_id IN (SELECT id FROM _test)
     AND (SELECT ok FROM g_test_safe) = 1
     AND (SELECT count(*) FROM msg_clear) >= 0
  RETURNING 1
),
del_test_users AS (
  DELETE FROM users WHERE id IN (SELECT id FROM _test)
     AND (SELECT ok FROM g_test_safe) = 1
     AND (SELECT count(*) FROM del_test_alumni) >= 0
     AND (SELECT count(*) FROM msg_clear) >= 0
  RETURNING 1
)
SELECT
  (SELECT ok FROM g_merge_dummy)          AS g_merge_dummy,
  (SELECT ok FROM g_merge_keep_ok)        AS g_merge_keep_ok,
  (SELECT ok FROM g_test_safe)            AS g_test_safe,
  (SELECT count(*) FROM typo_fix)         AS typo_fixed_users,
  (SELECT count(*) FROM typo_fix_alumni)  AS typo_fixed_alumni,
  (SELECT count(*) FROM msg_clear)        AS test_messages_deleted,
  (SELECT count(*) FROM del_dupe_alumni)  AS dupe_alumni_deleted,
  (SELECT count(*) FROM del_dupe_users)   AS dupe_placeholders_deleted,
  (SELECT count(*) FROM del_test_alumni)  AS test_alumni_deleted,
  (SELECT count(*) FROM del_test_users)   AS test_users_deleted;
