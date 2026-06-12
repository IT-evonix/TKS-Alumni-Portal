-- Add is_mentor column to alumni table
-- Used by mentorship routes to filter available mentors
ALTER TABLE public.alumni
  ADD COLUMN IF NOT EXISTS is_mentor BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_alumni_is_mentor
  ON public.alumni (is_mentor)
  WHERE is_mentor = true;
