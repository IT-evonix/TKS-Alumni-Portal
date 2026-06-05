-- Optional: Enhanced RLS Policy for Resume Access with Connection Check
-- Run this AFTER the main migration if you want to restrict resume access to connections only

-- First, drop the existing policy
DROP POLICY IF EXISTS "Users can view resumes" ON storage.objects;

-- Create enhanced policy that checks connection_requests table
CREATE POLICY "Users can view resumes"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'resumes' AND
  (
    -- User can view their own resume
    auth.uid()::text = (storage.foldername(name))[1]
    OR
    -- Or if they are connected (check connection_requests table)
    EXISTS (
      SELECT 1 FROM connection_requests
      WHERE status = 'accepted'
      AND (
        (requester_id = auth.uid()::text AND recipient_id = (storage.foldername(name))[1])
        OR
        (recipient_id = auth.uid()::text AND requester_id = (storage.foldername(name))[1])
      )
    )
  )
);

-- Note: This policy restricts resume viewing to:
-- 1. The resume owner
-- 2. Users who have an accepted connection with the resume owner
