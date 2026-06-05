-- Storage Buckets Setup
-- Run this in your Supabase SQL Editor

-- 1. Create Buckets
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('message-attachments', 'message-attachments', true),
  ('post-attachments', 'post-attachments', true),
  ('event_covers', 'event_covers', true),
  ('profile-pictures', 'profile-pictures', true),
  ('event_docs', 'event_docs', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Enable Public Access (Read)
-- Allows checking if files exist and reading them
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id IN ('message-attachments', 'post-attachments', 'event_covers', 'profile-pictures', 'event_docs') );

-- 3. Enable Authenticated Uploads
-- Allows logged-in users to upload files
CREATE POLICY "Authenticated Upload"
ON storage.objects FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated' AND
  bucket_id IN ('message-attachments', 'post-attachments', 'event_covers', 'profile-pictures', 'event_docs')
);

-- 4. Enable Owner Deletion (Optional but recommended)
-- Allows users to delete their own files (assumes file path starts with user ID)
CREATE POLICY "Owner Delete"
ON storage.objects FOR DELETE
USING (
  auth.uid()::text = (storage.foldername(name))[1]
);
