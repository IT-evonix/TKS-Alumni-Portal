-- Migration: Add venue column to events table
-- This migration adds the venue column that exists in the schema but may be missing in the database

-- Check if column exists before adding (PostgreSQL 9.5+)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'events' 
        AND column_name = 'venue'
    ) THEN
        ALTER TABLE events ADD COLUMN venue TEXT;
        RAISE NOTICE 'Added venue column to events table';
    ELSE
        RAISE NOTICE 'venue column already exists in events table';
    END IF;
END $$;
