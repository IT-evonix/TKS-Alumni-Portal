-- Migration to create the alumni_education table
-- Referenced by server/profile-extended-routes.ts and server/routes/alumni-search-routes.ts

CREATE TABLE IF NOT EXISTS alumni_education (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  alumni_id VARCHAR NOT NULL,
  school TEXT NOT NULL,
  degree TEXT,
  field_of_study TEXT,
  start_date DATE,
  end_date DATE,
  grade TEXT,
  activities TEXT,
  description TEXT,
  is_current BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_alumni_education_alumni FOREIGN KEY (alumni_id) REFERENCES alumni(id) ON DELETE CASCADE,
  CONSTRAINT valid_edu_dates CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_education_alumni ON alumni_education(alumni_id);
CREATE INDEX IF NOT EXISTS idx_education_start_date ON alumni_education(start_date);
CREATE INDEX IF NOT EXISTS idx_education_is_current ON alumni_education(is_current);

-- Auto-update updated_at (function already exists from multi_entry_profile.sql)
DROP TRIGGER IF EXISTS update_alumni_education_updated_at ON alumni_education;
CREATE TRIGGER update_alumni_education_updated_at BEFORE UPDATE ON alumni_education
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
