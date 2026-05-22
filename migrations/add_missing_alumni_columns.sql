-- ============================================================
-- Add missing alumni columns that exist in server code but
-- are not in the base migration (0000_nifty_misty_knight.sql)
-- Safe to run multiple times (ADD COLUMN IF NOT EXISTS)
-- ============================================================

-- is_batch_champion: used by admin users route, alumni-search-routes,
-- and multiple places in routes.ts for batch champion management
ALTER TABLE public.alumni
  ADD COLUMN IF NOT EXISTS is_batch_champion BOOLEAN DEFAULT false;

-- Create index for batch champion filter queries
CREATE INDEX IF NOT EXISTS idx_alumni_is_batch_champion
  ON public.alumni (is_batch_champion)
  WHERE is_batch_champion = true;
