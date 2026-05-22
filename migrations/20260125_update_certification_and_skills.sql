-- Add 'duration' column to alumni_certifications if it doesn't exist
ALTER TABLE alumni_certifications ADD COLUMN IF NOT EXISTS duration text;

-- Add 'skills_gained' column to alumni_certifications if it doesn't exist
ALTER TABLE alumni_certifications ADD COLUMN IF NOT EXISTS skills_gained text[];

-- Ensure alumni_skills has the correct columns
ALTER TABLE alumni_skills ADD COLUMN IF NOT EXISTS years_of_experience integer;
ALTER TABLE alumni_skills ADD COLUMN IF NOT EXISTS is_primary boolean DEFAULT false;
