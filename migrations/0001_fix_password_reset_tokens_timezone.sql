-- Fix: password_reset_tokens timestamp columns must be timezone-aware.
--
-- Two earlier migrations (0000_nifty_misty_knight.sql and create_password_reset_tokens.sql)
-- both create this table with `CREATE TABLE IF NOT EXISTS` but disagree on column type:
-- one declares plain `timestamp` (timezone-naive), the other `TIMESTAMP WITH TIME ZONE`.
-- Whichever ran first against a given database is what stuck; if the naive one won,
-- reading expires_at back reinterprets the stored UTC wall-clock numbers under the
-- Postgres session timezone, shifting the effective expiry and causing password
-- reset / account setup links to appear expired earlier (or later) than the
-- advertised 1 hour, depending on server/DB timezone configuration.
--
-- This migration is idempotent: it only converts the column if it is still naive,
-- and reinterprets existing stored values as UTC (which is what the application
-- always intended when writing `Date.toISOString()`), so it does not change the
-- real expiry instant of any in-flight token.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'password_reset_tokens'
      AND column_name = 'expires_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE password_reset_tokens
      ALTER COLUMN expires_at TYPE TIMESTAMPTZ USING expires_at AT TIME ZONE 'UTC',
      ALTER COLUMN used_at TYPE TIMESTAMPTZ USING used_at AT TIME ZONE 'UTC',
      ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
  END IF;
END $$;
