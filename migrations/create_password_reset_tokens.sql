-- Password Reset Tokens Table
-- This table stores secure tokens for password reset and initial password setup

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR NOT NULL UNIQUE,
  token_type TEXT NOT NULL DEFAULT 'reset', -- 'reset' for forgot password, 'setup' for initial password setup
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address TEXT, -- Store IP address for security auditing
  user_agent TEXT, -- Store user agent for security auditing
  
  -- Indexes for performance
  CONSTRAINT password_reset_tokens_token_key UNIQUE (token)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_type ON password_reset_tokens(token_type);

-- Add comment for documentation
COMMENT ON TABLE password_reset_tokens IS 'Stores secure tokens for password reset and initial password setup flows';
COMMENT ON COLUMN password_reset_tokens.token_type IS 'Type of token: reset (forgot password) or setup (initial password setup)';
COMMENT ON COLUMN password_reset_tokens.expires_at IS 'Token expiration timestamp (typically 1 hour from creation)';
COMMENT ON COLUMN password_reset_tokens.used_at IS 'Timestamp when token was used (null if unused)';

-- Function to automatically clean up expired tokens (optional, can be run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_password_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM password_reset_tokens
  WHERE expires_at < NOW() - INTERVAL '7 days'; -- Keep expired tokens for 7 days for auditing
END;
$$ LANGUAGE plpgsql;
