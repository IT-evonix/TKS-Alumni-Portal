-- Migration: Add linkedin_oauth_id to signup_requests
-- Supports linking LinkedIn OAuth signups to approved user accounts

ALTER TABLE signup_requests
ADD COLUMN IF NOT EXISTS linkedin_oauth_id text;
