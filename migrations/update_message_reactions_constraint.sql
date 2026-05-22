-- Migration: Update message reactions to allow only one per user Per message
-- This aligns with WhatsApp behavior where a new reaction replaces the old one.

-- First, clean up any existing duplicate reactions (keep the most recent one)
DELETE FROM message_reactions mr1
WHERE EXISTS (
    SELECT 1 FROM message_reactions mr2
    WHERE mr1.message_id = mr2.message_id
    AND mr1.user_id = mr2.user_id
    AND mr1.created_at < mr2.created_at
);

-- Remove the old unique constraint
ALTER TABLE message_reactions DROP CONSTRAINT IF EXISTS message_reactions_message_id_user_id_emoji_key;

-- Add the new unique constraint (one reaction per user per message)
ALTER TABLE message_reactions ADD CONSTRAINT message_reactions_one_per_user_per_message UNIQUE (message_id, user_id);
