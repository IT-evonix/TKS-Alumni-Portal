-- Multi-Entry Profile Enhancement Migration
-- This migration creates normalized tables for professional experiences, skills, certifications, languages, and achievements

-- ==================== PROFESSIONAL EXPERIENCES ====================
CREATE TABLE IF NOT EXISTS alumni_experiences (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  alumni_id VARCHAR NOT NULL,
  company_name TEXT NOT NULL,
  position TEXT NOT NULL,
  employment_type TEXT CHECK (employment_type IN ('full-time', 'part-time', 'contract', 'internship', 'freelance')),
  location TEXT,
  location_type TEXT CHECK (location_type IN ('onsite', 'remote', 'hybrid')),
  start_date DATE NOT NULL,
  end_date DATE,
  is_current BOOLEAN DEFAULT false,
  description TEXT,
  responsibilities TEXT[],
  achievements TEXT[],
  skills_used TEXT[],
  industry TEXT,
  company_size TEXT CHECK (company_size IN ('startup', 'small', 'medium', 'large', 'enterprise')),
  company_url TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_alumni_experiences_alumni FOREIGN KEY (alumni_id) REFERENCES alumni(id) ON DELETE CASCADE,
  CONSTRAINT valid_dates CHECK (end_date IS NULL OR end_date >= start_date)
);

-- ==================== SKILLS & EXPERTISE ====================
CREATE TABLE IF NOT EXISTS alumni_skills (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  alumni_id VARCHAR NOT NULL,
  skill_name TEXT NOT NULL,
  category TEXT, -- technical, soft, language, tool, framework, domain
  proficiency_level TEXT CHECK (proficiency_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
  years_of_experience INTEGER CHECK (years_of_experience >= 0),
  last_used_date DATE,
  is_primary BOOLEAN DEFAULT false,
  endorsements_count INTEGER DEFAULT 0,
  verified BOOLEAN DEFAULT false,
  description TEXT,
  related_projects TEXT[],
  certification_ids TEXT[],
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_alumni_skills_alumni FOREIGN KEY (alumni_id) REFERENCES alumni(id) ON DELETE CASCADE,
  CONSTRAINT unique_skill_per_alumni UNIQUE (alumni_id, skill_name)
);

-- ==================== CERTIFICATIONS ====================
CREATE TABLE IF NOT EXISTS alumni_certifications (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  alumni_id VARCHAR NOT NULL,
  certification_name TEXT NOT NULL,
  issuing_organization TEXT NOT NULL,
  issue_date DATE NOT NULL,
  expiry_date DATE,
  credential_id TEXT,
  credential_url TEXT,
  verification_url TEXT,
  is_active BOOLEAN DEFAULT true,
  skills_gained TEXT[],
  description TEXT,
  certificate_file_url TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_alumni_certifications_alumni FOREIGN KEY (alumni_id) REFERENCES alumni(id) ON DELETE CASCADE,
  CONSTRAINT valid_cert_dates CHECK (expiry_date IS NULL OR expiry_date >= issue_date)
);

-- ==================== LANGUAGES ====================
CREATE TABLE IF NOT EXISTS alumni_languages (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  alumni_id VARCHAR NOT NULL,
  language_name TEXT NOT NULL,
  proficiency_level TEXT NOT NULL CHECK (proficiency_level IN ('native', 'fluent', 'advanced', 'intermediate', 'beginner')),
  can_read BOOLEAN DEFAULT true,
  can_write BOOLEAN DEFAULT true,
  can_speak BOOLEAN DEFAULT true,
  certification_name TEXT,
  certification_score TEXT,
  certification_date DATE,
  is_native BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_alumni_languages_alumni FOREIGN KEY (alumni_id) REFERENCES alumni(id) ON DELETE CASCADE,
  CONSTRAINT unique_language_per_alumni UNIQUE (alumni_id, language_name)
);

-- ==================== ACHIEVEMENTS & AWARDS ====================
CREATE TABLE IF NOT EXISTS alumni_achievements (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  alumni_id VARCHAR NOT NULL,
  achievement_type TEXT NOT NULL CHECK (achievement_type IN ('award', 'recognition', 'publication', 'patent', 'project', 'competition', 'other')),
  title TEXT NOT NULL,
  description TEXT,
  issuing_organization TEXT,
  date_received DATE NOT NULL,
  category TEXT, -- academic, professional, community, sports, arts, research
  level TEXT CHECK (level IN ('international', 'national', 'state', 'institutional', 'local')),
  url TEXT,
  certificate_url TEXT,
  co_recipients TEXT[],
  impact_description TEXT,
  media_coverage_urls TEXT[],
  is_featured BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_alumni_achievements_alumni FOREIGN KEY (alumni_id) REFERENCES alumni(id) ON DELETE CASCADE
);

-- ==================== PROJECTS PORTFOLIO (Bonus) ====================
CREATE TABLE IF NOT EXISTS alumni_projects (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  alumni_id VARCHAR NOT NULL,
  project_name TEXT NOT NULL,
  project_type TEXT CHECK (project_type IN ('personal', 'professional', 'academic', 'open-source')),
  description TEXT NOT NULL,
  role TEXT,
  start_date DATE,
  end_date DATE,
  is_ongoing BOOLEAN DEFAULT false,
  technologies_used TEXT[],
  project_url TEXT,
  github_url TEXT,
  demo_url TEXT,
  image_urls TEXT[],
  team_size INTEGER,
  your_contribution TEXT,
  outcomes TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_alumni_projects_alumni FOREIGN KEY (alumni_id) REFERENCES alumni(id) ON DELETE CASCADE
);

-- ==================== BACKFILL COLUMNS ON PRE-EXISTING TABLES ====================
-- These 6 tables may already exist on a given database (created by an earlier,
-- independent process) with a different/partial column set. The CREATE TABLE IF
-- NOT EXISTS blocks above are then no-ops, so explicitly add every column this
-- migration expects, guarded, so the file is correct whether the table is fresh
-- or pre-existing.

-- alumni_experiences
ALTER TABLE alumni_experiences ADD COLUMN IF NOT EXISTS employment_type TEXT;
ALTER TABLE alumni_experiences ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE alumni_experiences ADD COLUMN IF NOT EXISTS location_type TEXT;
ALTER TABLE alumni_experiences ADD COLUMN IF NOT EXISTS is_current BOOLEAN DEFAULT false;
ALTER TABLE alumni_experiences ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE alumni_experiences ADD COLUMN IF NOT EXISTS responsibilities TEXT[];
ALTER TABLE alumni_experiences ADD COLUMN IF NOT EXISTS achievements TEXT[];
ALTER TABLE alumni_experiences ADD COLUMN IF NOT EXISTS skills_used TEXT[];
ALTER TABLE alumni_experiences ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE alumni_experiences ADD COLUMN IF NOT EXISTS company_size TEXT;
ALTER TABLE alumni_experiences ADD COLUMN IF NOT EXISTS company_url TEXT;
ALTER TABLE alumni_experiences ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE alumni_experiences ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE alumni_experiences ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- alumni_skills
ALTER TABLE alumni_skills ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE alumni_skills ADD COLUMN IF NOT EXISTS proficiency_level TEXT;
ALTER TABLE alumni_skills ADD COLUMN IF NOT EXISTS years_of_experience INTEGER;
ALTER TABLE alumni_skills ADD COLUMN IF NOT EXISTS last_used_date DATE;
ALTER TABLE alumni_skills ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;
ALTER TABLE alumni_skills ADD COLUMN IF NOT EXISTS endorsements_count INTEGER DEFAULT 0;
ALTER TABLE alumni_skills ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false;
ALTER TABLE alumni_skills ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE alumni_skills ADD COLUMN IF NOT EXISTS related_projects TEXT[];
ALTER TABLE alumni_skills ADD COLUMN IF NOT EXISTS certification_ids TEXT[];
ALTER TABLE alumni_skills ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE alumni_skills ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE alumni_skills ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- alumni_certifications (confirmed live gap: expiry_date was missing)
ALTER TABLE alumni_certifications ADD COLUMN IF NOT EXISTS expiry_date DATE;
ALTER TABLE alumni_certifications ADD COLUMN IF NOT EXISTS credential_id TEXT;
ALTER TABLE alumni_certifications ADD COLUMN IF NOT EXISTS credential_url TEXT;
ALTER TABLE alumni_certifications ADD COLUMN IF NOT EXISTS verification_url TEXT;
ALTER TABLE alumni_certifications ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE alumni_certifications ADD COLUMN IF NOT EXISTS skills_gained TEXT[];
ALTER TABLE alumni_certifications ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE alumni_certifications ADD COLUMN IF NOT EXISTS certificate_file_url TEXT;
ALTER TABLE alumni_certifications ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE alumni_certifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE alumni_certifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- alumni_languages
ALTER TABLE alumni_languages ADD COLUMN IF NOT EXISTS can_read BOOLEAN DEFAULT true;
ALTER TABLE alumni_languages ADD COLUMN IF NOT EXISTS can_write BOOLEAN DEFAULT true;
ALTER TABLE alumni_languages ADD COLUMN IF NOT EXISTS can_speak BOOLEAN DEFAULT true;
ALTER TABLE alumni_languages ADD COLUMN IF NOT EXISTS certification_name TEXT;
ALTER TABLE alumni_languages ADD COLUMN IF NOT EXISTS certification_score TEXT;
ALTER TABLE alumni_languages ADD COLUMN IF NOT EXISTS certification_date DATE;
ALTER TABLE alumni_languages ADD COLUMN IF NOT EXISTS is_native BOOLEAN DEFAULT false;
ALTER TABLE alumni_languages ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE alumni_languages ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE alumni_languages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- alumni_achievements
ALTER TABLE alumni_achievements ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE alumni_achievements ADD COLUMN IF NOT EXISTS issuing_organization TEXT;
ALTER TABLE alumni_achievements ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE alumni_achievements ADD COLUMN IF NOT EXISTS level TEXT;
ALTER TABLE alumni_achievements ADD COLUMN IF NOT EXISTS url TEXT;
ALTER TABLE alumni_achievements ADD COLUMN IF NOT EXISTS certificate_url TEXT;
ALTER TABLE alumni_achievements ADD COLUMN IF NOT EXISTS co_recipients TEXT[];
ALTER TABLE alumni_achievements ADD COLUMN IF NOT EXISTS impact_description TEXT;
ALTER TABLE alumni_achievements ADD COLUMN IF NOT EXISTS media_coverage_urls TEXT[];
ALTER TABLE alumni_achievements ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;
ALTER TABLE alumni_achievements ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE alumni_achievements ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE alumni_achievements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- alumni_projects
ALTER TABLE alumni_projects ADD COLUMN IF NOT EXISTS project_type TEXT;
ALTER TABLE alumni_projects ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE alumni_projects ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE alumni_projects ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE alumni_projects ADD COLUMN IF NOT EXISTS is_ongoing BOOLEAN DEFAULT false;
ALTER TABLE alumni_projects ADD COLUMN IF NOT EXISTS technologies_used TEXT[];
ALTER TABLE alumni_projects ADD COLUMN IF NOT EXISTS project_url TEXT;
ALTER TABLE alumni_projects ADD COLUMN IF NOT EXISTS github_url TEXT;
ALTER TABLE alumni_projects ADD COLUMN IF NOT EXISTS demo_url TEXT;
ALTER TABLE alumni_projects ADD COLUMN IF NOT EXISTS image_urls TEXT[];
ALTER TABLE alumni_projects ADD COLUMN IF NOT EXISTS team_size INTEGER;
ALTER TABLE alumni_projects ADD COLUMN IF NOT EXISTS your_contribution TEXT;
ALTER TABLE alumni_projects ADD COLUMN IF NOT EXISTS outcomes TEXT;
ALTER TABLE alumni_projects ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE alumni_projects ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE alumni_projects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- ==================== INDEXES FOR PERFORMANCE ====================
CREATE INDEX IF NOT EXISTS idx_experiences_alumni ON alumni_experiences(alumni_id);
CREATE INDEX IF NOT EXISTS idx_experiences_current ON alumni_experiences(is_current);
CREATE INDEX IF NOT EXISTS idx_experiences_dates ON alumni_experiences(start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_skills_alumni ON alumni_skills(alumni_id);
CREATE INDEX IF NOT EXISTS idx_skills_category ON alumni_skills(category);
CREATE INDEX IF NOT EXISTS idx_skills_proficiency ON alumni_skills(proficiency_level);
CREATE INDEX IF NOT EXISTS idx_skills_primary ON alumni_skills(is_primary);

CREATE INDEX IF NOT EXISTS idx_certifications_alumni ON alumni_certifications(alumni_id);
CREATE INDEX IF NOT EXISTS idx_certifications_active ON alumni_certifications(is_active);
CREATE INDEX IF NOT EXISTS idx_certifications_expiry ON alumni_certifications(expiry_date);

CREATE INDEX IF NOT EXISTS idx_languages_alumni ON alumni_languages(alumni_id);
CREATE INDEX IF NOT EXISTS idx_languages_proficiency ON alumni_languages(proficiency_level);

CREATE INDEX IF NOT EXISTS idx_achievements_alumni ON alumni_achievements(alumni_id);
CREATE INDEX IF NOT EXISTS idx_achievements_type ON alumni_achievements(achievement_type);
CREATE INDEX IF NOT EXISTS idx_achievements_featured ON alumni_achievements(is_featured);
CREATE INDEX IF NOT EXISTS idx_achievements_date ON alumni_achievements(date_received);

CREATE INDEX IF NOT EXISTS idx_projects_alumni ON alumni_projects(alumni_id);
CREATE INDEX IF NOT EXISTS idx_projects_ongoing ON alumni_projects(is_ongoing);

-- ==================== TRIGGERS FOR AUTO-UPDATE ====================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_alumni_experiences_updated_at ON alumni_experiences;
CREATE TRIGGER update_alumni_experiences_updated_at BEFORE UPDATE ON alumni_experiences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_alumni_skills_updated_at ON alumni_skills;
CREATE TRIGGER update_alumni_skills_updated_at BEFORE UPDATE ON alumni_skills
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_alumni_certifications_updated_at ON alumni_certifications;
CREATE TRIGGER update_alumni_certifications_updated_at BEFORE UPDATE ON alumni_certifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_alumni_languages_updated_at ON alumni_languages;
CREATE TRIGGER update_alumni_languages_updated_at BEFORE UPDATE ON alumni_languages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_alumni_achievements_updated_at ON alumni_achievements;
CREATE TRIGGER update_alumni_achievements_updated_at BEFORE UPDATE ON alumni_achievements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_alumni_projects_updated_at ON alumni_projects;
CREATE TRIGGER update_alumni_projects_updated_at BEFORE UPDATE ON alumni_projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-update certification active status based on expiry
CREATE OR REPLACE FUNCTION update_certification_active_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.expiry_date IS NOT NULL AND NEW.expiry_date < CURRENT_DATE THEN
        NEW.is_active = false;
    ELSE
        NEW.is_active = true;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS check_certification_expiry ON alumni_certifications;
CREATE TRIGGER check_certification_expiry BEFORE INSERT OR UPDATE ON alumni_certifications
    FOR EACH ROW EXECUTE FUNCTION update_certification_active_status();

-- ==================== COMMENTS FOR DOCUMENTATION ====================
COMMENT ON TABLE alumni_experiences IS 'Stores professional work experiences and employment history for alumni';
COMMENT ON TABLE alumni_skills IS 'Stores skills and expertise with proficiency levels and metadata';
COMMENT ON TABLE alumni_certifications IS 'Stores professional certifications and credentials';
COMMENT ON TABLE alumni_languages IS 'Stores language proficiencies with detailed skill breakdown';
COMMENT ON TABLE alumni_achievements IS 'Stores awards, achievements, publications, and recognitions';
COMMENT ON TABLE alumni_projects IS 'Stores portfolio projects with detailed information';
