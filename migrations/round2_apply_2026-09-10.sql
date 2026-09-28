-- ============================================================================
-- Round-2 apply (school-returned "Copy of Pending Students.xlsx")
-- TARGET: Supabase project aikvtpqqxasdctchtgct (PROD)   |   Generated 2026-09-10
--
-- ONE atomic statement (WITH-chain). Applies fully and auto-commits, or errors and changes
-- nothing. Guards compute 1/(1-LEAST(1,<bad>)) -> 1 when clean, else division-by-zero.
--
-- 11 emails applied (1 of them also renames aishwary.tiwari -> Apekshya Mohanty).
-- 21 placeholder accounts deleted; 4 connection_requests reassigned to the
-- surviving account, 1 connection_request deleted. 1 account (nanki.puri) left for round 3.
--
-- On SUCCESS: g_apply_dummy=1 g_email_free=1 g_drops_dummy=1 g_targets_ok=1 g_disjoint=1 g_preflight=1
--   conn_reassigned=4 conn_deleted=1
--   emails_applied_users=11 emails_applied_alumni=11 renamed=1
--   alumni_deleted=21 users_deleted=21
-- Then run round2_apply_2026-09-10_verify.sql -> expect still-dummy 6.
-- ============================================================================
WITH
_email (user_id, new_email, new_first, new_last) AS (VALUES
    ('c5509f46-d7d7-492c-bd9a-59b9a3bb5266', 'dewang3@gmail.com', NULL, NULL),
    ('5fa9a852-dba6-47c3-92f8-dc4e1fb09492', 'reenadbs@gmail.com', NULL, NULL),
    ('2c3a90c6-b828-47e7-8459-5eb444987f5b', 'suchitra.khandelwal@gmail.com', NULL, NULL),
    ('25c422e6-aa71-436e-baa1-2625699db529', 'jain.abhilasha@gmail.com', NULL, NULL),
    ('01568071-1de4-4095-8690-def375fc3d39', 'sanyukta.mp@gmail.com', NULL, NULL),
    ('25a9a191-1eff-4777-8a7a-8cb19be44730', 'sauhard2706@gmail.com', NULL, NULL),
    ('4c21fa56-fb36-4489-a04e-17f646d5c83d', 'srishti.shetty2020@gmail.com', NULL, NULL),
    ('7a5d51aa-b768-42b2-86b4-bf25bff72742', 'bhansalikushal5@gmail.com', NULL, NULL),
    ('545ed9dd-d6a3-4842-9215-38db6b5324e1', 'monikagul@gmail.com', NULL, NULL),
    ('6be3a61d-5234-4e6a-8c8f-4e329b58f90c', 'reachaaryan@gmail.com', NULL, NULL),
    ('42fd2328-e238-48f2-b25f-ae0e8e416cca', 'debarchana.mohanty@rediffmail.com', 'Apekshya', 'Mohanty')
),
_drop (id, child_target) AS (VALUES
    ('a4d862ef-ed9a-4792-a005-ad83479f2a47', '00000000-0000-0000-0000-000000000000'),
    ('6f6166e4-f06f-4c50-a193-0a0397a43df1', 'c38fb8e3-8f10-48e5-b33e-ae52db0c402a'),
    ('05e88e02-3601-41fe-a2a6-b8fd4970ccd9', '9e69bfa6-ce1b-400f-8bf7-91106dccb7df'),
    ('931207a8-48df-4dc3-9fbe-8c3baaff12e2', '00000000-0000-0000-0000-000000000000'),
    ('a4bb6ab5-57e5-40e0-b119-9e2dfcb7794b', 'c4d8805e-9861-43b7-90b8-9eb67710a6ba'),
    ('f8743ea1-23d4-48d1-9264-fb4def1d03d8', '00000000-0000-0000-0000-000000000000'),
    ('eb7f4b34-f4b5-402a-a984-f146733bd46c', '3236ad24-46e6-475c-bb9b-5e1db91c616b'),
    ('7c7f15c9-2418-4f37-9109-22a0b21a507b', '00000000-0000-0000-0000-000000000000'),
    ('f29d630d-34a0-4b7a-b59f-f287a4091e20', '00000000-0000-0000-0000-000000000000'),
    ('d78f348b-2cba-4136-b35a-f331dec08db0', '00000000-0000-0000-0000-000000000000'),
    ('c42b1589-262e-4fb1-ba1c-53f19c303eff', '00000000-0000-0000-0000-000000000000'),
    ('b83ba77e-6b38-4c3d-aa09-a9a019267c4d', 'eeb4a48c-c20c-4fa2-9aec-5929f468834d'),
    ('73aa4951-fa47-4fc2-b4cc-da545f968e48', 'd4d06354-205a-471c-8b8d-1b9e2895efe1'),
    ('e6937234-23a3-4af8-b409-4e440ae3d859', 'f440a066-1904-4495-a173-f5ce28fb5521'),
    ('b08bf240-5422-44d2-8540-112b6418fdb4', '511d44cd-f547-412e-855f-bdfff40b1c95'),
    ('ac98a9c6-1844-4e67-ac27-e8670558cd38', '00000000-0000-0000-0000-000000000000'),
    ('7ed47c56-6a58-415d-a2c4-c016f455852f', 'd34d42d1-5c91-4429-b361-9570fe064945'),
    ('888f3af4-b268-48d3-b4d7-411bb7bd4ec3', '00000000-0000-0000-0000-000000000000'),
    ('20a5c234-a29c-475e-90a6-4cf16bb1254f', 'd521d450-e9b8-4e53-9e8d-6404d8540d91'),
    ('eff3d117-2bbf-4c37-9246-4b04774d33c2', '3ad5620a-b40e-44a2-849b-1d681ed2119b'),
    ('a378f09e-e605-4b49-baa2-26f18bf271cb', '00000000-0000-0000-0000-000000000000')
),
_conn_reassign (id) AS (VALUES
    ('3eea1ac1-14dc-4d89-8722-98141ec4fdc8'),
    ('22ab992f-2287-41fb-8148-6e7384cd676a'),
    ('41640e86-7de7-4088-bfe9-ac260ae9af9e'),
    ('07e41021-3589-433e-a346-d5466c2771a9')
),
_conn_delete (id) AS (VALUES
    ('bfb90d89-f2d1-4840-9cfd-9f1118babe84')
),

-- ---- guards ----
g_apply_dummy AS (         -- every account we're applying an email to is currently dummy
  SELECT (1 / (1 - LEAST(1, count(*))))::int AS ok
    FROM _email e JOIN users u ON u.id = e.user_id
   WHERE u.email NOT LIKE '%placeholder%' AND u.email NOT LIKE '%@student.tks.com'
),
g_email_free AS (          -- each new email is free on users AND alumni (except its own account)
  SELECT (1 / (1 - LEAST(1,
       (SELECT count(*) FROM _email e JOIN users  u ON lower(u.email) = e.new_email AND u.id      <> e.user_id)
     + (SELECT count(*) FROM _email e JOIN alumni a ON lower(a.email) = e.new_email AND a.user_id <> e.user_id)
     )))::int AS ok
),
g_drops_dummy AS (         -- every account to delete is currently dummy
  SELECT (1 / (1 - LEAST(1, count(*))))::int AS ok
    FROM _drop d JOIN users u ON u.id = d.id
   WHERE u.email NOT LIKE '%placeholder%' AND u.email NOT LIKE '%@student.tks.com'
),
g_targets_ok AS (          -- every child-target account exists, is not blocked, and is NOT itself
                            -- being deleted (a still-dummy target is fine — e.g. nanki.puri, kept for round 3)
  SELECT (1 / (1 - LEAST(1, count(*))))::int AS ok
    FROM (SELECT DISTINCT child_target AS t FROM _drop WHERE child_target <> '00000000-0000-0000-0000-000000000000') x
    LEFT JOIN users u ON u.id = x.t
   WHERE u.id IS NULL OR u.account_blocked OR x.t IN (SELECT id FROM _drop)
),
g_disjoint AS (            -- no connection_request id in both reassign and delete
  SELECT (1 / (1 - LEAST(1, count(*))))::int AS ok
    FROM _conn_reassign r JOIN _conn_delete d ON r.id = d.id
),
g_preflight AS (           -- no blocking child row (no cascade) for the deletes, EXCLUDING conn
  SELECT (1 / (1 - LEAST(1,
       (SELECT count(*) FROM feed_posts      WHERE author_id    IN (SELECT id FROM _drop))
     + (SELECT count(*) FROM user_blocks     WHERE blocker_id   IN (SELECT id FROM _drop) OR blocked_id IN (SELECT id FROM _drop))
     + (SELECT count(*) FROM events          WHERE organized_by IN (SELECT id FROM _drop))
     + (SELECT count(*) FROM signup_requests WHERE reviewed_by  IN (SELECT id FROM _drop))
     + (SELECT count(*) FROM messages        WHERE sender_id    IN (SELECT id FROM _drop) OR receiver_id IN (SELECT id FROM _drop))
     )))::int AS ok
),

-- ---- writes ----
conn_re_req AS (
  UPDATE connection_requests c SET requester_id = d.child_target, updated_at = now()
    FROM _drop d
   WHERE c.requester_id = d.id AND d.child_target <> '00000000-0000-0000-0000-000000000000' AND c.id IN (SELECT id FROM _conn_reassign)
     AND (SELECT ok FROM g_drops_dummy) = 1 AND (SELECT ok FROM g_targets_ok) = 1 AND (SELECT ok FROM g_disjoint) = 1
  RETURNING 1
),
conn_re_rec AS (
  UPDATE connection_requests c SET recipient_id = d.child_target, updated_at = now()
    FROM _drop d
   WHERE c.recipient_id = d.id AND d.child_target <> '00000000-0000-0000-0000-000000000000' AND c.id IN (SELECT id FROM _conn_reassign)
     AND (SELECT ok FROM g_drops_dummy) = 1 AND (SELECT ok FROM g_targets_ok) = 1 AND (SELECT ok FROM g_disjoint) = 1
  RETURNING 1
),
conn_del AS (
  DELETE FROM connection_requests WHERE id IN (SELECT id FROM _conn_delete)
     AND (SELECT ok FROM g_disjoint) = 1
  RETURNING 1
),
email_users AS (
  UPDATE users u
     SET email = e.new_email, updated_at = now()
    FROM _email e
   WHERE u.id = e.user_id
     AND (SELECT ok FROM g_apply_dummy) = 1 AND (SELECT ok FROM g_email_free) = 1
  RETURNING 1
),
email_alumni AS (
  UPDATE alumni a
     SET email = e.new_email,
         first_name = COALESCE(e.new_first, a.first_name),
         last_name  = COALESCE(e.new_last,  a.last_name),
         updated_at = now()
    FROM _email e
   WHERE a.user_id = e.user_id
     AND (SELECT ok FROM g_apply_dummy) = 1 AND (SELECT ok FROM g_email_free) = 1
  RETURNING (e.new_first IS NOT NULL) AS renamed
),
del_alumni AS (
  DELETE FROM alumni WHERE user_id IN (SELECT id FROM _drop)
     AND (SELECT ok FROM g_drops_dummy) = 1 AND (SELECT ok FROM g_targets_ok) = 1 AND (SELECT ok FROM g_preflight) = 1
     AND (SELECT count(*) FROM conn_re_req) >= 0
     AND (SELECT count(*) FROM conn_del) >= 0
     AND (SELECT count(*) FROM email_alumni) >= 0
  RETURNING 1
),
del_users AS (
  DELETE FROM users WHERE id IN (SELECT id FROM _drop)
     AND (SELECT ok FROM g_drops_dummy) = 1 AND (SELECT ok FROM g_targets_ok) = 1 AND (SELECT ok FROM g_preflight) = 1
     AND (SELECT count(*) FROM del_alumni) >= 0
     AND (SELECT count(*) FROM email_users) >= 0
  RETURNING 1
)
SELECT
  (SELECT ok FROM g_apply_dummy) AS g_apply_dummy,
  (SELECT ok FROM g_email_free)  AS g_email_free,
  (SELECT ok FROM g_drops_dummy) AS g_drops_dummy,
  (SELECT ok FROM g_targets_ok)  AS g_targets_ok,
  (SELECT ok FROM g_disjoint)    AS g_disjoint,
  (SELECT ok FROM g_preflight)   AS g_preflight,
  (SELECT count(*) FROM conn_re_req) + (SELECT count(*) FROM conn_re_rec) AS conn_reassigned,
  (SELECT count(*) FROM conn_del)      AS conn_deleted,
  (SELECT count(*) FROM email_users)   AS emails_applied_users,
  (SELECT count(*) FROM email_alumni)  AS emails_applied_alumni,
  (SELECT count(*) FROM email_alumni WHERE renamed) AS renamed,
  (SELECT count(*) FROM del_alumni)    AS alumni_deleted,
  (SELECT count(*) FROM del_users)     AS users_deleted;
