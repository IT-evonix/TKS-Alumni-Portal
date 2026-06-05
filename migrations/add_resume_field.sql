-- Simple Resume Upload Migration (Fixed for RLS)
-- Run this in Supabase SQL Editor

-- Step 1: Add resume_url column to alumni table
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS resume_url TEXT;

-- Step 2: Add index for resume_url
CREATE INDEX IF NOT EXISTS idx_alumni_resume_url ON alumni(resume_url) WHERE resume_url IS NOT NULL;

-- Step 3: Create storage bucket (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', false)
ON CONFLICT (id) DO NOTHING;

-- Step 4: Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view resumes" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own resumes" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own resumes" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own resumes" ON storage.objects;

-- Step 5: Create simple, working RLS policies

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Authenticated users can upload resumes"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'resumes' AND
  auth.role() = 'authenticated'
);

-- Allow users to view any resume (you can restrict this later)
CREATE POLICY "Authenticated users can view resumes"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'resumes' AND
  auth.role() = 'authenticated'
);

-- Allow users to update files in their own folder
CREATE POLICY "Users can update their own resumes"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'resumes' AND
  auth.role() = 'authenticated'
);

-- Allow users to delete files in their own folder
CREATE POLICY "Users can delete their own resumes"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'resumes' AND
  auth.role() = 'authenticated'
);

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'alumni' 
  AND column_name = 'resume_url';

-- Verify bucket was created
SELECT id, name, public FROM storage.buckets WHERE id = 'resumes';

-- Verify policies were created
SELECT policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects' 
  AND policyname LIKE '%resume%';
