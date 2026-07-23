-- Creates an admin user directly in the database.
-- Password hash below corresponds to plaintext: ChangeMe123!
-- Generate your own hash with: node -e "require('bcryptjs').hash('yourpassword', 10, (e,h)=>console.log(h))"
-- Change this immediately after first login.

INSERT INTO users (username, password, email, "is_admin", "user_role", "account_approved", "account_blocked")
VALUES (
  'admin',
  '$2a$10$wQIXxSHCt.yJbFSuWwZn1uEb/B4VdsCevXdIgU7huUWNAQ6PC2ske',
  'admin@evonix.co',
  true,
  'administrator',
  true,
  false
)
ON CONFLICT (email) DO UPDATE
SET "is_admin" = true,
    "user_role" = 'administrator';

-- Login flow (this app blocks admins from the regular /api/auth/login endpoint):
-- 1. POST /api/auth/admin/login with { "email": "admin@evonix.co", "password": "ChangeMe123!" }
-- 2. Submit OTP step:
--    - If NODE_ENV=production, a real OTP is emailed to the address above.
--    - Otherwise (dev/test), the email above is a hardcoded test-admin account
--      that always uses OTP code: 654321
--    - For any other admin email in non-production, the OTP is hardcoded to: 111111
--      (logged to server console, never actually emailed)
