-- Migration: Add Profile Improvements Fields
-- This ensures all new fields for profile improvements exist in the alumni table

-- Add social media fields if they don't exist
DO $$ 
BEGIN
    -- GitHub URL
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'alumni' AND column_name = 'github_url'
    ) THEN
        ALTER TABLE alumni ADD COLUMN github_url TEXT;
    END IF;

    -- Twitter URL
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'alumni' AND column_name = 'twitter_url'
    ) THEN
        ALTER TABLE alumni ADD COLUMN twitter_url TEXT;
    END IF;

    -- Personal Website
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'alumni' AND column_name = 'personal_website'
    ) THEN
        ALTER TABLE alumni ADD COLUMN personal_website TEXT;
    END IF;

    -- Show Email (Privacy Setting)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'alumni' AND column_name = 'show_email'
    ) THEN
        ALTER TABLE alumni ADD COLUMN show_email BOOLEAN DEFAULT false;
    END IF;

    -- Show Phone (Privacy Setting)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'alumni' AND column_name = 'show_phone'
    ) THEN
        ALTER TABLE alumni ADD COLUMN show_phone BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Update existing records to have default values for privacy settings
UPDATE alumni 
SET show_email = false 
WHERE show_email IS NULL;

UPDATE alumni 
SET show_phone = false 
WHERE show_phone IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN alumni.github_url IS 'GitHub profile URL';
COMMENT ON COLUMN alumni.twitter_url IS 'Twitter/X profile URL';
COMMENT ON COLUMN alumni.personal_website IS 'Personal website URL';
COMMENT ON COLUMN alumni.show_email IS 'Privacy setting: Show email on public profile';
COMMENT ON COLUMN alumni.show_phone IS 'Privacy setting: Show phone on public profile';
