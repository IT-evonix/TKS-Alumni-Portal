-- Add custom_recipient_emails to newsletters table
-- Stores a JSON array of additional email addresses (beyond filter-based recipients)
-- e.g. ["external@example.com", "partner@org.com"]
ALTER TABLE newsletters
  ADD COLUMN IF NOT EXISTS custom_recipient_emails TEXT DEFAULT '[]';
