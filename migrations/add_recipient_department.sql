-- Add department/branch filter column to newsletters table
ALTER TABLE newsletters ADD COLUMN IF NOT EXISTS recipient_department TEXT NOT NULL DEFAULT 'all';
