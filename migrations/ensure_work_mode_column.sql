-- Migration: Ensure work_mode column exists in jobs table
-- This script ensures the work_mode column is present and properly configured

-- Add work_mode column if it doesn't exist
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS work_mode TEXT;

-- Add a comment to document the column
COMMENT ON COLUMN jobs.work_mode IS 'Work mode: remote, onsite, or hybrid';

-- Optional: Update any existing jobs that have "Remote" or similar in location field
-- to have the appropriate work_mode value
-- This helps migrate old data
UPDATE jobs 
SET work_mode = 'remote' 
WHERE (LOWER(location) LIKE '%remote%' OR LOWER(location) LIKE '%work from home%' OR LOWER(location) LIKE '%wfh%')
  AND (work_mode IS NULL OR work_mode = '');

UPDATE jobs 
SET work_mode = 'hybrid' 
WHERE (LOWER(location) LIKE '%hybrid%' OR LOWER(location) LIKE '%flexible%')
  AND (work_mode IS NULL OR work_mode = '');

-- Set default to 'onsite' for jobs without work_mode but with a physical location
UPDATE jobs 
SET work_mode = 'onsite' 
WHERE work_mode IS NULL 
  AND location IS NOT NULL 
  AND location != ''
  AND LOWER(location) NOT LIKE '%remote%'
  AND LOWER(location) NOT LIKE '%hybrid%';

-- Verify the column exists and check current state
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'jobs' 
  AND column_name = 'work_mode';
