
-- Drop existing table if it exists to recreate with proper constraints
DROP TABLE IF EXISTS post_comment_replies CASCADE;

-- Add replies_count column to post_comments if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='post_comments' AND column_name='replies_count') THEN
    ALTER TABLE post_comments ADD COLUMN replies_count INTEGER DEFAULT 0;
  END IF;
END$$;

-- Create post_comment_replies table with explicit foreign key constraints
CREATE TABLE post_comment_replies (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id VARCHAR NOT NULL,
  user_id VARCHAR NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Explicit foreign key constraints
  CONSTRAINT fk_comment_replies_comment
    FOREIGN KEY (comment_id) 
    REFERENCES post_comments(id) 
    ON DELETE CASCADE,
    
  CONSTRAINT fk_comment_replies_user
    FOREIGN KEY (user_id) 
    REFERENCES users(id) 
    ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_comment_replies_comment_id ON post_comment_replies(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_replies_user_id ON post_comment_replies(user_id);
CREATE INDEX IF NOT EXISTS idx_comment_replies_created_at ON post_comment_replies(created_at);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_comment_reply_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_comment_reply_updated_at_trigger ON post_comment_replies;
CREATE TRIGGER update_comment_reply_updated_at_trigger
BEFORE UPDATE ON post_comment_replies
FOR EACH ROW
EXECUTE FUNCTION update_comment_reply_updated_at();

-- Update existing comments to have replies_count = 0
UPDATE post_comments SET replies_count = 0 WHERE replies_count IS NULL;

-- Grant necessary permissions (adjust as needed for your setup)
-- These might be needed depending on your Supabase RLS policies
ALTER TABLE post_comment_replies ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (you may need to adjust these based on your security requirements)
CREATE POLICY "Users can view active replies" ON post_comment_replies
  FOR SELECT USING (is_active = true);

CREATE POLICY "Users can create replies" ON post_comment_replies
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own replies" ON post_comment_replies
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own replies" ON post_comment_replies
  FOR DELETE USING (auth.uid()::text = user_id);
