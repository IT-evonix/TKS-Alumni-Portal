-- Migration: Add user_type to signup_requests and allow nullable academic fields
-- Description: Supports faculty registrations by not requiring graduation year or batch.

-- 1. Add user_type to signup_requests
ALTER TABLE signup_requests 
ADD COLUMN IF NOT EXISTS user_type text DEFAULT 'alumni';

-- 2. Drop NOT NULL constraints on graduation_year and batch from signup_requests
ALTER TABLE signup_requests 
ALTER COLUMN graduation_year DROP NOT NULL,
ALTER COLUMN batch DROP NOT NULL;

-- 3. Drop NOT NULL constraints from alumni table to support faculty records
ALTER TABLE alumni
ALTER COLUMN graduation_year DROP NOT NULL,
ALTER COLUMN batch DROP NOT NULL;
