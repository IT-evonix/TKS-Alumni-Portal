-- ============================================================================
-- COMPREHENSIVE SEARCH OPTIMIZATION FOR ALUMNI PORTAL
-- ============================================================================
-- This file contains all database optimizations for global search functionality
-- including fuzzy search support, indexes, and performance improvements.
--
-- Execution Instructions:
-- 1. Run this file against your PostgreSQL database (Neon/PostgreSQL)
-- 2. Ensure pg_trgm extension is enabled (it's safe to run CREATE EXTENSION multiple times)
-- 3. Monitor query performance after index creation (may take time on large tables)
-- ============================================================================

-- ============================================================================
-- STEP 1: Enable Required Extensions
-- ============================================================================

-- Enable pg_trgm for fuzzy search (trigram similarity matching)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Enable unaccent for accent-insensitive search (optional but recommended)
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ============================================================================
-- STEP 2: Create GIN Indexes for Fuzzy Search (pg_trgm)
-- ============================================================================

-- Alumni Table - Main Profile Fields
CREATE INDEX IF NOT EXISTS idx_alumni_first_name_trgm ON alumni USING gin (first_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_alumni_last_name_trgm ON alumni USING gin (last_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_alumni_bio_trgm ON alumni USING gin (bio gin_trgm_ops) WHERE bio IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_alumni_skills_trgm ON alumni USING gin (skills gin_trgm_ops) WHERE skills IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_alumni_current_company_trgm ON alumni USING gin (current_company gin_trgm_ops) WHERE current_company IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_alumni_current_role_trgm ON alumni USING gin ("current_role" gin_trgm_ops) WHERE "current_role" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_alumni_current_position_trgm ON alumni USING gin (current_position gin_trgm_ops) WHERE current_position IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_alumni_current_city_trgm ON alumni USING gin (current_city gin_trgm_ops) WHERE current_city IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_alumni_industry_trgm ON alumni USING gin (industry gin_trgm_ops) WHERE industry IS NOT NULL;

-- Jobs Table
CREATE INDEX IF NOT EXISTS idx_jobs_title_trgm ON jobs USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_jobs_company_trgm ON jobs USING gin (company gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_jobs_description_trgm ON jobs USING gin (description gin_trgm_ops) WHERE description IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_location_trgm ON jobs USING gin (location gin_trgm_ops) WHERE location IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_industry_trgm ON jobs USING gin (industry gin_trgm_ops) WHERE industry IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_skills_trgm ON jobs USING gin (skills gin_trgm_ops) WHERE skills IS NOT NULL;

-- Events Table
CREATE INDEX IF NOT EXISTS idx_events_title_trgm ON events USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_events_description_trgm ON events USING gin (description gin_trgm_ops) WHERE description IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_location_trgm ON events USING gin (location gin_trgm_ops) WHERE location IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_venue_trgm ON events USING gin (venue gin_trgm_ops) WHERE venue IS NOT NULL;

-- Feed Posts Table
CREATE INDEX IF NOT EXISTS idx_feed_posts_content_trgm ON feed_posts USING gin (content gin_trgm_ops) WHERE content IS NOT NULL;

-- Alumni Experiences Table
CREATE INDEX IF NOT EXISTS idx_alumni_exp_company_trgm ON alumni_experiences USING gin (company_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_alumni_exp_position_trgm ON alumni_experiences USING gin (position gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_alumni_exp_description_trgm ON alumni_experiences USING gin (description gin_trgm_ops) WHERE description IS NOT NULL;

-- Alumni Projects Table
CREATE INDEX IF NOT EXISTS idx_alumni_proj_name_trgm ON alumni_projects USING gin (project_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_alumni_proj_desc_trgm ON alumni_projects USING gin (description gin_trgm_ops) WHERE description IS NOT NULL;

-- Alumni Skills Table
CREATE INDEX IF NOT EXISTS idx_alumni_skills_name_trgm ON alumni_skills USING gin (skill_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_alumni_skills_category_trgm ON alumni_skills USING gin (category gin_trgm_ops) WHERE category IS NOT NULL;

-- Alumni Certifications Table
CREATE INDEX IF NOT EXISTS idx_alumni_cert_name_trgm ON alumni_certifications USING gin (certification_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_alumni_cert_org_trgm ON alumni_certifications USING gin (issuing_organization gin_trgm_ops);

-- Alumni Achievements Table
CREATE INDEX IF NOT EXISTS idx_alumni_ach_title_trgm ON alumni_achievements USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_alumni_ach_desc_trgm ON alumni_achievements USING gin (description gin_trgm_ops) WHERE description IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_alumni_ach_org_trgm ON alumni_achievements USING gin (issuing_organization gin_trgm_ops) WHERE issuing_organization IS NOT NULL;

-- ============================================================================
-- STEP 3: Create Standard B-Tree Indexes for Common Filters
-- ============================================================================

-- Alumni indexes for filtering
CREATE INDEX IF NOT EXISTS idx_alumni_is_active ON alumni(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_alumni_user_id ON alumni(user_id);
CREATE INDEX IF NOT EXISTS idx_alumni_batch ON alumni(batch) WHERE batch IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_alumni_graduation_year ON alumni(graduation_year);
CREATE INDEX IF NOT EXISTS idx_alumni_industry ON alumni(industry) WHERE industry IS NOT NULL;

-- Jobs indexes
CREATE INDEX IF NOT EXISTS idx_jobs_is_active ON jobs(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_jobs_location ON jobs(location) WHERE location IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_job_type ON jobs(job_type) WHERE job_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_industry ON jobs(industry) WHERE industry IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);

-- Events indexes
CREATE INDEX IF NOT EXISTS idx_events_is_active ON events(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_events_event_date ON events(event_date DESC);
CREATE INDEX IF NOT EXISTS idx_events_location ON events(location) WHERE location IS NOT NULL;

-- Feed Posts indexes
CREATE INDEX IF NOT EXISTS idx_feed_posts_is_active ON feed_posts(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_feed_posts_created_at ON feed_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_posts_author_id ON feed_posts(author_id);

-- ============================================================================
-- STEP 4: Composite Indexes for Common Query Patterns
-- ============================================================================

-- Alumni: Active alumni with common search fields
CREATE INDEX IF NOT EXISTS idx_alumni_active_search ON alumni(is_active, graduation_year, batch) 
    WHERE is_active = true;

-- Jobs: Active jobs with location and type
CREATE INDEX IF NOT EXISTS idx_jobs_active_location_type ON jobs(is_active, location, job_type) 
    WHERE is_active = true;

-- Events: Active events by date
CREATE INDEX IF NOT EXISTS idx_events_active_date ON events(is_active, event_date DESC) 
    WHERE is_active = true;

-- ============================================================================
-- STEP 5: Optional: Create Search Function for Advanced Fuzzy Search
-- ============================================================================

-- Function to search alumni with fuzzy matching
CREATE OR REPLACE FUNCTION search_alumni_fuzzy(
    search_term TEXT,
    result_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
    id VARCHAR,
    user_id VARCHAR,
    first_name TEXT,
    last_name TEXT,
    bio TEXT,
    skills TEXT,
    current_company TEXT,
    "current_role" TEXT,
    current_position TEXT,
    current_city TEXT,
    profile_picture TEXT,
    industry TEXT,
    batch TEXT,
    relevance_score REAL
) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        a.user_id,
        a.first_name,
        a.last_name,
        a.bio,
        a.skills,
        a.current_company,
        a."current_role",
        a.current_position,
        a.current_city,
        a.profile_picture,
        a.industry,
        a.batch,
        GREATEST(
            similarity(a.first_name, search_term),
            similarity(a.last_name, search_term),
            COALESCE(similarity(a.bio, search_term), 0),
            COALESCE(similarity(a.skills, search_term), 0),
            COALESCE(similarity(a.current_company, search_term), 0),
            COALESCE(similarity(a."current_role", search_term), 0),
            COALESCE(similarity(a.current_position, search_term), 0),
            COALESCE(similarity(a.current_city, search_term), 0),
            COALESCE(similarity(a.industry, search_term), 0)
        ) AS relevance_score
    FROM alumni a
    WHERE 
        a.is_active = true
        AND (
            a.first_name ILIKE '%' || search_term || '%'
            OR a.last_name ILIKE '%' || search_term || '%'
            OR a.bio ILIKE '%' || search_term || '%'
            OR a.skills ILIKE '%' || search_term || '%'
            OR a.current_company ILIKE '%' || search_term || '%'
            OR a."current_role" ILIKE '%' || search_term || '%'
            OR a.current_position ILIKE '%' || search_term || '%'
            OR a.current_city ILIKE '%' || search_term || '%'
            OR a.industry ILIKE '%' || search_term || '%'
            OR similarity(a.first_name, search_term) > 0.2
            OR similarity(a.last_name, search_term) > 0.2
            OR (a.bio IS NOT NULL AND similarity(a.bio, search_term) > 0.2)
            OR (a.current_company IS NOT NULL AND similarity(a.current_company, search_term) > 0.2)
            OR (a."current_role" IS NOT NULL AND similarity(a."current_role", search_term) > 0.2)
        )
    ORDER BY relevance_score DESC, a.created_at DESC
    LIMIT result_limit;
END;
$$;

-- ============================================================================
-- STEP 6: Analyze Tables for Query Planner Optimization
-- ============================================================================

-- Update statistics for better query planning
ANALYZE alumni;
ANALYZE jobs;
ANALYZE events;
ANALYZE feed_posts;
ANALYZE alumni_experiences;
ANALYZE alumni_projects;
ANALYZE alumni_skills;
ANALYZE alumni_certifications;
ANALYZE alumni_achievements;

-- ============================================================================
-- VERIFICATION QUERIES (Run these to verify indexes are created)
-- ============================================================================

-- Check if pg_trgm extension is enabled
-- SELECT * FROM pg_extension WHERE extname = 'pg_trgm';

-- Check all trigram indexes
-- SELECT 
--     schemaname,
--     tablename,
--     indexname,
--     indexdef
-- FROM pg_indexes
-- WHERE indexdef LIKE '%gin_trgm_ops%'
-- ORDER BY tablename, indexname;

-- Check index sizes
-- SELECT 
--     tablename,
--     indexname,
--     pg_size_pretty(pg_relation_size(indexname::regclass)) AS index_size
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--     AND indexname LIKE '%_trgm'
-- ORDER BY pg_relation_size(indexname::regclass) DESC;

-- ============================================================================
-- PERFORMANCE TIPS
-- ============================================================================
-- 1. GIN indexes are larger than B-tree but much faster for fuzzy search
-- 2. Monitor index bloat: REINDEX INDEX index_name; if needed
-- 3. For very large tables, consider partitioning
-- 4. Similarity threshold: 0.2-0.3 is good for typo tolerance, adjust as needed
-- 5. Use EXPLAIN ANALYZE to check query plans
-- ============================================================================
