-- Migration: Fix faculty users who were incorrectly assigned 'alumni' user_role
-- This updates users whose signup_request had user_type='faculty' but got user_role='alumni'

UPDATE users
SET user_role = 'faculty'
WHERE id IN (
    SELECT u.id
    FROM users u
    JOIN signup_requests sr ON sr.email = u.email
    WHERE sr.user_type = 'faculty'
      AND u.user_role = 'alumni'
);

-- Also fix alumni records for faculty: graduation_year may be null which is fine
-- Ensure faculty alumni records don't get auto-corrected to 'alumni' role
-- (The /api/auth/me route already skips faculty for auto-correction, so this is just data cleanup)
