-- Post-run verification for dup_account_merge_2026-09-04.sql. Run AFTER the merge.
SELECT
  (SELECT count(*) FROM users  WHERE email LIKE '%placeholder%' OR email LIKE '%@student.tks.com') AS users_still_dummy,   -- expect 193
  (SELECT count(*) FROM alumni WHERE email LIKE '%placeholder%' OR email LIKE '%@student.tks.com') AS alumni_still_dummy,  -- expect 193
  (SELECT count(*) FROM connection_requests c LEFT JOIN users u ON u.id = c.recipient_id WHERE u.id IS NULL) AS orphan_conn_recipient,  -- expect 0
  (SELECT count(*) FROM connection_requests c LEFT JOIN users u ON u.id = c.requester_id WHERE u.id IS NULL) AS orphan_conn_requester,  -- expect 0
  (SELECT count(*) FROM messages m LEFT JOIN users u ON u.id = m.receiver_id WHERE u.id IS NULL) AS orphan_msg_receiver,  -- expect 0
  (SELECT count(*) FROM users WHERE username = '18186_mlkrjreo') AS sample_placeholder_gone,  -- expect 0
  (SELECT email FROM users WHERE username = 'maanasa202_mlf0r93e') AS sample_real_email;  -- unchanged real email
