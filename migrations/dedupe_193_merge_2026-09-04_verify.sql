-- Post-run verification for dedupe_193_merge_2026-09-04.sql. Run AFTER the merge.
SELECT
  (SELECT count(*) FROM users  WHERE email LIKE '%placeholder%' OR email LIKE '%@student.tks.com') AS users_still_dummy,   -- expect 38
  (SELECT count(*) FROM alumni WHERE email LIKE '%placeholder%' OR email LIKE '%@student.tks.com') AS alumni_still_dummy,  -- expect 38
  (SELECT count(*) FROM users u JOIN alumni a ON a.user_id = u.id WHERE lower(u.email) <> lower(a.email)) AS email_mismatches,  -- expect 0
  (SELECT count(*) FROM connection_requests c LEFT JOIN users u ON u.id = c.recipient_id WHERE u.id IS NULL) AS orphan_conn_recipient,  -- expect 0
  (SELECT count(*) FROM connection_requests c LEFT JOIN users u ON u.id = c.requester_id WHERE u.id IS NULL) AS orphan_conn_requester,  -- expect 0
  (SELECT count(*) FROM messages m LEFT JOIN users u ON u.id = m.receiver_id WHERE u.id IS NULL) AS orphan_msg_receiver,  -- expect 0
  (SELECT count(*) FROM users WHERE username = 'advika.bagmar') AS sample_drop_gone,  -- expect 0
  (SELECT email FROM users WHERE id = 'a142e49b-f036-494c-af52-ef83dc406ae5') AS sample_patternB_keeper_email;  -- expect sanskutigupta@gmail.com
