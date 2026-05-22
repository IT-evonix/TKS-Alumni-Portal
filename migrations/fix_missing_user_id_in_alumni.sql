-- Migration: Fix missing user_id in alumni table
-- This ensures all alumni records have a valid user_id for connection status functionality

-- Step 1: Identify alumni records without user_id
-- This query will show any alumni that don't have a user_id
-- Run this first to see if there are any issues:
-- SELECT id, email, first_name, last_name, user_id 
-- FROM alumni 
-- WHERE user_id IS NULL;

-- Step 2: If there are records without user_id, we need to either:
-- Option A: Create users for them (if they should have accounts)
-- Option B: Delete orphaned alumni records (if they're invalid)
-- Option C: Link them to existing users by email match

-- For now, we'll add a constraint to prevent future NULL user_id values
-- and create a function to help identify orphaned records

-- Add NOT NULL constraint if it doesn't exist (be careful - this will fail if NULLs exist)
-- ALTER TABLE alumni ALTER COLUMN user_id SET NOT NULL;

-- Instead, let's create a safer approach:
-- 1. Create a function to find orphaned alumni
CREATE OR REPLACE FUNCTION find_orphaned_alumni()
RETURNS TABLE (
    alumni_id VARCHAR,
    email TEXT,
    first_name TEXT,
    last_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        a.email,
        a.first_name,
        a.last_name
    FROM alumni a
    WHERE a.user_id IS NULL
    ORDER BY a.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- 2. Create a function to link alumni to users by email (if user exists)
CREATE OR REPLACE FUNCTION link_alumni_to_user_by_email()
RETURNS INTEGER AS $$
DECLARE
    linked_count INTEGER := 0;
    alumni_record RECORD;
    user_record RECORD;
BEGIN
    -- Find alumni without user_id but with matching email in users table
    FOR alumni_record IN 
        SELECT id, email 
        FROM alumni 
        WHERE user_id IS NULL
    LOOP
        -- Try to find matching user by email
        SELECT id INTO user_record
        FROM users
        WHERE email = alumni_record.email
        LIMIT 1;
        
        -- If user found and not already linked to another alumni, link them
        IF user_record.id IS NOT NULL THEN
            -- Check if this user_id is already linked to another alumni
            IF NOT EXISTS (
                SELECT 1 FROM alumni 
                WHERE user_id = user_record.id AND id != alumni_record.id
            ) THEN
                UPDATE alumni
                SET user_id = user_record.id
                WHERE id = alumni_record.id;
                
                linked_count := linked_count + 1;
            END IF;
        END IF;
    END LOOP;
    
    RETURN linked_count;
END;
$$ LANGUAGE plpgsql;

-- 3. Add index to ensure user_id lookups are fast
CREATE INDEX IF NOT EXISTS idx_alumni_user_id_not_null ON alumni(user_id) WHERE user_id IS NOT NULL;

-- 4. Add a check constraint to warn about NULL user_id (if your DB supports it)
-- This won't prevent NULLs but will help identify issues
-- ALTER TABLE alumni ADD CONSTRAINT check_user_id_not_null CHECK (user_id IS NOT NULL);

-- Instructions for running this migration:
-- 1. First, check for orphaned records:
--    SELECT * FROM find_orphaned_alumni();
--
-- 2. If there are orphaned records, try to link them:
--    SELECT link_alumni_to_user_by_email();
--
-- 3. Review any remaining orphaned records and decide:
--    - Delete them if they're invalid/test data
--    - Create users for them if they're legitimate alumni
--    - Manually link them if you know the correct user_id
--
-- 4. After cleaning up, you can optionally add the NOT NULL constraint:
--    ALTER TABLE alumni ALTER COLUMN user_id SET NOT NULL;
