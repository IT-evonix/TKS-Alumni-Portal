-- Migration: Fix alumni graduation_year check constraint
-- The previous constraint was too restrictive, blocking valid graduation years.
-- Drop and replace with a permissive range that covers all realistic values.

ALTER TABLE alumni DROP CONSTRAINT IF EXISTS alumni_graduation_year_check;

ALTER TABLE alumni ADD CONSTRAINT alumni_graduation_year_check
  CHECK (graduation_year IS NULL OR (graduation_year >= 1950 AND graduation_year <= 2100));
