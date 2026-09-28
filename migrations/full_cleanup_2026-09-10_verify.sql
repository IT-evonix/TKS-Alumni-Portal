-- Post-run verification for full_cleanup_2026-09-10.sql. Run AFTER.
SELECT
  (SELECT count(*) FROM users)  AS total_users,   -- was 1201; expect 1201 - 17 - 14 = 1170
  (SELECT count(*) FROM alumni) AS total_alumni,  -- was 1189; expect 1189 - 17 - 6 = 1166
  (SELECT count(*) FROM users WHERE username = 'ayaan.shaikh') AS sample_dupe_drop_gone,       -- 0
  (SELECT email FROM users WHERE username = 'rubinanayaan_mogqr0uc') AS sample_dupe_keep_email,         -- unchanged real email
  (SELECT count(*) FROM users WHERE username IN ('om','admin','vijay','alumni_ms7i2z5c')) AS test_accts_remaining,  -- 0
  (SELECT email FROM users WHERE id = '392a7787-47ae-4b2b-b2eb-7c0d0cca1dae') AS janvi_email,                                -- janvi.dixit@thekalyanischool.com
  (SELECT count(*) FROM users u JOIN alumni a ON a.user_id=u.id WHERE lower(u.email)<>lower(a.email)) AS email_mismatches,  -- 0
  (SELECT count(*) FROM alumni a LEFT JOIN users u ON u.id=a.user_id WHERE u.id IS NULL) AS orphan_alumni,  -- 0
  (SELECT count(*) FROM messages m LEFT JOIN users u ON u.id=m.sender_id WHERE u.id IS NULL) AS orphan_msg_sender,  -- 0
  (SELECT count(*) FROM users WHERE email ILIKE '%placeholder%' OR email ILIKE '%@student.tks.com') AS still_dummy;  -- was 6; some of the 6 may now be gone via merges
