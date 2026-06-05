-- Migration: Add missing industry and skills columns to jobs table

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS skills TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS company_logo TEXT;
