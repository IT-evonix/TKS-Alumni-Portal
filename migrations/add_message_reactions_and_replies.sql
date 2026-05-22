-- Migration: Add Message Reactions and Replies
-- This migration adds support for reacting to messages and replying to messages in the inbox/chat

-- Create message_reactions table
CREATE TABLE IF NOT EXISTS message_reactions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id VARCHAR NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji VARCHAR(10) NOT NULL, -- Store emoji character (e.g., '👍', '❤️', '😂')
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(message_id, user_id) -- One reaction per user per message (WhatsApp style)
);

-- Create message_replies table
CREATE TABLE IF NOT EXISTS message_replies (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id VARCHAR NOT NULL REFERENCES messages(id) ON DELETE CASCADE, -- Original message being replied to
  sender_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user_id ON message_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_message_replies_message_id ON message_replies(message_id);
CREATE INDEX IF NOT EXISTS idx_message_replies_sender_id ON message_replies(sender_id);

-- Add trigger to update updated_at timestamp for message_replies
CREATE OR REPLACE FUNCTION update_message_replies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_message_replies_updated_at ON message_replies;
CREATE TRIGGER update_message_replies_updated_at 
  BEFORE UPDATE ON message_replies
  FOR EACH ROW 
  EXECUTE FUNCTION update_message_replies_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_replies ENABLE ROW LEVEL SECURITY;

-- RLS policies for message_reactions
DROP POLICY IF EXISTS "Users can view all reactions" ON message_reactions;
CREATE POLICY "Users can view all reactions" 
  ON message_reactions FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Users can create reactions" ON message_reactions;
CREATE POLICY "Users can create reactions" 
  ON message_reactions FOR INSERT 
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete their own reactions" ON message_reactions;
CREATE POLICY "Users can delete their own reactions" 
  ON message_reactions FOR DELETE 
  USING (true);

-- RLS policies for message_replies
DROP POLICY IF EXISTS "Users can view all replies" ON message_replies;
CREATE POLICY "Users can view all replies" 
  ON message_replies FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Users can create replies" ON message_replies;
CREATE POLICY "Users can create replies" 
  ON message_replies FOR INSERT 
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update their own replies" ON message_replies;
CREATE POLICY "Users can update their own replies" 
  ON message_replies FOR UPDATE 
  USING (true);

DROP POLICY IF EXISTS "Users can delete their own replies" ON message_replies;
CREATE POLICY "Users can delete their own replies" 
  ON message_replies FOR DELETE 
  USING (true);
