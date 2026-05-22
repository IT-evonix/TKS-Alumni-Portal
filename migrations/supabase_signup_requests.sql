-- Signup Requests Table (Supabase)
-- Run this in Supabase SQL Editor if "Join the network" signup returns server error.
-- Used by: POST /api/auth/signup-request (alumni join flow).

CREATE TABLE IF NOT EXISTS signup_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  graduation_year INTEGER NOT NULL,
  batch TEXT,
  course TEXT,
  branch TEXT,
  roll_number TEXT,
  cgpa TEXT,
  current_city TEXT,
  current_company TEXT,
  "current_role" TEXT,
  linkedin_url TEXT,
  reason_for_joining TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for lookups used by signup and admin
CREATE UNIQUE INDEX IF NOT EXISTS idx_signup_requests_email ON signup_requests(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_signup_requests_status ON signup_requests(status);
CREATE INDEX IF NOT EXISTS idx_signup_requests_created_at ON signup_requests(created_at DESC);

-- RLS: allow service role (backend) full access; anon can have no direct access (API uses service role)
ALTER TABLE signup_requests ENABLE ROW LEVEL SECURITY;

-- Policy: service role bypasses RLS by default in Supabase. Add policy so anon cannot read/write if you ever call from client.
CREATE POLICY "Service role full access to signup_requests"
  ON signup_requests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE signup_requests IS 'Alumni join requests; admin approves before account creation.';
