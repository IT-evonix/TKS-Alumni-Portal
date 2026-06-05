
-- Migration to add advanced profile fields to alumni table

-- Add professional fields
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS employment_status TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS employment_history TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS previous_companies TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS years_of_experience INTEGER DEFAULT 0;

-- Add expertise fields
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS expertise_areas TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS certifications TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS languages_known TEXT;

-- Add achievement fields
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS achievements TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS awards TEXT;

-- Add additional info fields
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS keywords TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Asia/Kolkata';
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS volunteer_interests TEXT;

-- Add startup fields
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS is_startup_founder BOOLEAN DEFAULT FALSE;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS startup_name TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS startup_role TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS funding_stage TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS founding_year INTEGER;

-- Add profile completion tracking
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS profile_completion_score INTEGER DEFAULT 0;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS completed_sections TEXT DEFAULT '[]';

-- Create indexes for search optimization
CREATE INDEX IF NOT EXISTS idx_alumni_employment_status ON alumni(employment_status);
CREATE INDEX IF NOT EXISTS idx_alumni_is_startup_founder ON alumni(is_startup_founder);
CREATE INDEX IF NOT EXISTS idx_alumni_completion_score ON alumni(profile_completion_score);

-- For TEXT columns that store JSON arrays, we need to use gin_trgm_ops for text search
-- or convert to JSONB for proper GIN indexing. For now, we'll use regular B-tree indexes.
CREATE INDEX IF NOT EXISTS idx_alumni_expertise_areas ON alumni(expertise_areas);
CREATE INDEX IF NOT EXISTS idx_alumni_keywords ON alumni(keywords);

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'alumni' 
  AND column_name IN (
    'employment_status', 'employment_history', 'expertise_areas', 
    'certifications', 'languages_known', 'achievements', 'keywords',
    'is_startup_founder', 'profile_completion_score'
  )
ORDER BY column_name;
