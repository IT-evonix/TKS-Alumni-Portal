-- Post-run verification for round2_apply_2026-09-10.sql. Run AFTER.
SELECT
  (SELECT count(*) FROM users  WHERE email ILIKE '%placeholder%' OR email ILIKE '%@student.tks.com') AS users_still_dummy,   -- expect 6
  (SELECT count(*) FROM alumni WHERE email ILIKE '%placeholder%' OR email ILIKE '%@student.tks.com') AS alumni_still_dummy,  -- expect 6
  (SELECT count(*) FROM users u JOIN alumni a ON a.user_id=u.id WHERE lower(u.email)<>lower(a.email)) AS email_mismatches,   -- expect 0
  (SELECT count(*) FROM connection_requests c LEFT JOIN users u ON u.id=c.requester_id WHERE u.id IS NULL) AS orphan_conn_req,  -- expect 0
  (SELECT count(*) FROM connection_requests c LEFT JOIN users u ON u.id=c.recipient_id WHERE u.id IS NULL) AS orphan_conn_rec,  -- expect 0
  (SELECT count(*) FROM alumni a LEFT JOIN users u ON u.id=a.user_id WHERE u.id IS NULL) AS orphan_alumni,  -- expect 0
  (SELECT count(*) FROM users WHERE username = 'shriya.kalyani') AS sample_delete_gone,       -- expect 0
  (SELECT email FROM users WHERE id = 'c5509f46-d7d7-492c-bd9a-59b9a3bb5266') AS sample_apply_email,                -- expect dewang3@gmail.com
  (SELECT first_name || ' ' || last_name || ' <' || email || '>' FROM alumni WHERE user_id = '42fd2328-e238-48f2-b25f-ae0e8e416cca') AS renamed_row;  -- expect Apekshya Mohanty <debarchana.mohanty@rediffmail.com>
