-- Post-run verification for fix_dummy_emails_2026-09-04.sql
-- Run this AFTER the migration. Every check should pass.
SELECT
  (SELECT count(*) FROM users  WHERE email LIKE '%placeholder%' OR email LIKE '%@student.tks.com') AS users_still_dummy,   -- expect 374
  (SELECT count(*) FROM alumni WHERE email LIKE '%placeholder%' OR email LIKE '%@student.tks.com') AS alumni_still_dummy,  -- expect 374
  (SELECT count(*) FROM users u JOIN alumni a ON a.user_id = u.id WHERE lower(u.email) <> lower(a.email)) AS email_mismatches,  -- expect 3 (pre-existing, unrelated)
  (SELECT count(*) FROM users WHERE username IN (
     'peter.ekka','ruhaan.jagota','soham.grover','sriha.maitra','s.sss','amulya.jain','rajeswari.b',
     'ruth.data','astha.joshi','anju.shibu','hiten.khatri','arnav.patil','evya.gupta','shubhu.mutta'
   )) AS deleted_accounts_remaining;  -- expect 0
