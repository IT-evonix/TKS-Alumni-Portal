-- Adds a column to track when a user last saw the "monthly events" popup,
-- so it can be shown once on their first login each calendar month.
-- Run this manually in the Supabase SQL Editor.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_monthly_popup_shown_at TIMESTAMP WITH TIME ZONE;
