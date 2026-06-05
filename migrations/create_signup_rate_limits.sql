-- Signup Rate Limits Table
-- Persists IP-based signup attempt history across server restarts and deployments.
-- Replaces the in-memory Map throttle in the student-signup route.

CREATE TABLE IF NOT EXISTS signup_rate_limits (
  id           VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  ip_address   TEXT NOT NULL,
  attempted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Fast lookup by IP + time window (the only query pattern used)
CREATE INDEX IF NOT EXISTS idx_signup_rate_limits_ip_time
  ON signup_rate_limits (ip_address, attempted_at DESC);

-- Auto-purge rows older than 1 hour to keep the table tiny
CREATE OR REPLACE FUNCTION cleanup_signup_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM signup_rate_limits
  WHERE attempted_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE signup_rate_limits IS
  'Tracks student signup attempts per IP for rate-limiting. Rows older than 1 hour are irrelevant and can be purged.';
