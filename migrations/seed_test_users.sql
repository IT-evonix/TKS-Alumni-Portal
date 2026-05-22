-- ============================================================
-- Seed Data: 4 Test Users (All Roles)
-- ============================================================
-- Passwords (bcrypt $2a$10$, cost=10):
--   admin_tks    →  Admin@TKS2024
--   alumni_tks   →  Alumni@TKS2024
--   faculty_tks  →  Faculty@TKS2024
--   user_tks     →  User@TKS2024
--
-- Run this in Supabase SQL Editor AFTER your base migration.
-- Uses INSERT ... ON CONFLICT DO NOTHING → safe to re-run.
-- ============================================================

INSERT INTO public.users
  (id, username, email, password, is_admin, user_role, account_approved, account_blocked)
VALUES
  -- ── 1. ADMIN ──────────────────────────────────────────────
  (
    gen_random_uuid(),
    'admin_tks',
    'bhupendra@evonix.co',
    '$2a$10$CxGpJXwmRVrIsCqAKZZxrO1ibDvk3qjbloKTL/Kfh4L.Avt4M3QrC',
    true,          -- is_admin = true
    'administrator',
    true,
    false
  ),

  -- ── 2. ALUMNI ─────────────────────────────────────────────
  (
    gen_random_uuid(),
    'alumni_tks',
    'alumni@tks.edu.in',
    '$2a$10$W/ESDoYLCPe5sSsuM0Pz8efYoaQ63zuCiAcQRClZ7sn64Uk/0g4.O',
    false,
    'alumni',
    true,
    false
  ),

  -- ── 3. FACULTY ────────────────────────────────────────────
  (
    gen_random_uuid(),
    'faculty_tks',
    'faculty@tks.edu.in',
    '$2a$10$r1R//L.OUS57xIXnpSmtAu408jODNdVfpKBYmw2eLnmj.HtDe/Spi',
    false,
    'faculty',
    true,
    false
  ),

  -- ── 4. REGULAR USER ───────────────────────────────────────
  (
    gen_random_uuid(),
    'user_tks',
    'user@tks.edu.in',
    '$2a$10$KZ/SSrrS/xfarlAB2LjaQur/XcAUhfL0usQQb6I0S5mZj3tH3rdxe',
    false,
    'user',
    true,
    false
  )

ON CONFLICT (email) DO NOTHING;   -- safe to re-run

-- ============================================================
-- Quick verify — run after insert to confirm all 4 rows
-- ============================================================
SELECT
  username,
  email,
  user_role,
  is_admin,
  account_approved
FROM public.users
WHERE email IN (
  'bhupendra@evonix.co',
  'alumni@tks.edu.in',
  'faculty@tks.edu.in',
  'user@tks.edu.in'
)
ORDER BY
  CASE user_role
    WHEN 'administrator' THEN 1
    WHEN 'alumni'        THEN 2
    WHEN 'faculty'       THEN 3
    WHEN 'user'          THEN 4
  END;
