-- ============================================
-- NOTIFICATION SYSTEM ENHANCEMENT MIGRATION
-- Created: 2026-01-08
-- Purpose: Add missing columns, indexes, and backfill data for notification system
-- ============================================

-- ==================== STEP 1: INSPECT CURRENT STATE ====================

-- Check current columns (for verification)
DO $$ 
BEGIN
    RAISE NOTICE '=== Current Notifications Table Structure ===';
END $$;

SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'notifications'
ORDER BY ordinal_position;

-- ==================== STEP 2: ADD MISSING COLUMNS ====================

-- Add redirect_url column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' 
        AND column_name = 'redirect_url'
    ) THEN
        ALTER TABLE notifications 
        ADD COLUMN redirect_url TEXT;
        
        RAISE NOTICE '✓ Added redirect_url column to notifications';
    ELSE
        RAISE NOTICE '✓ redirect_url column already exists in notifications';
    END IF;
END $$;

-- Add actor_id column (who triggered the notification)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' 
        AND column_name = 'actor_id'
    ) THEN
        ALTER TABLE notifications 
        ADD COLUMN actor_id VARCHAR REFERENCES users(id) ON DELETE SET NULL;
        
        RAISE NOTICE '✓ Added actor_id column to notifications';
    ELSE
        RAISE NOTICE '✓ actor_id column already exists in notifications';
    END IF;
END $$;

-- Add metadata column for extensible data
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' 
        AND column_name = 'metadata'
    ) THEN
        ALTER TABLE notifications 
        ADD COLUMN metadata JSONB;
        
        RAISE NOTICE '✓ Added metadata column to notifications';
    ELSE
        RAISE NOTICE '✓ metadata column already exists in notifications';
    END IF;
END $$;

-- Add read_at timestamp
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' 
        AND column_name = 'read_at'
    ) THEN
        ALTER TABLE notifications 
        ADD COLUMN read_at TIMESTAMP;
        
        RAISE NOTICE '✓ Added read_at column to notifications';
    ELSE
        RAISE NOTICE '✓ read_at column already exists in notifications';
    END IF;
END $$;

-- ==================== STEP 3: ADD COLUMN COMMENTS ====================

COMMENT ON COLUMN notifications.redirect_url IS 'URL to redirect user when clicking notification';
COMMENT ON COLUMN notifications.actor_id IS 'User ID of who triggered this notification (for profile links)';
COMMENT ON COLUMN notifications.metadata IS 'Additional JSON data for extensible notification types';
COMMENT ON COLUMN notifications.read_at IS 'Timestamp when notification was marked as read';

-- ==================== STEP 4: CREATE PERFORMANCE INDEXES ====================

-- Index on user_id and is_read for fast unread queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
ON notifications(user_id, is_read, created_at DESC)
WHERE is_read = false;

-- Index on user_id and created_at for pagination
CREATE INDEX IF NOT EXISTS idx_notifications_user_created 
ON notifications(user_id, created_at DESC);

-- Index on type for analytics
CREATE INDEX IF NOT EXISTS idx_notifications_type 
ON notifications(type);

-- Index on actor_id for "who interacted with me" queries
CREATE INDEX IF NOT EXISTS idx_notifications_actor 
ON notifications(actor_id)
WHERE actor_id IS NOT NULL;

-- Composite index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_notifications_user_type_read 
ON notifications(user_id, type, is_read);

RAISE NOTICE '✓ Created performance indexes';

-- ==================== STEP 5: BACKFILL REDIRECT_URL FOR EXISTING NOTIFICATIONS ====================

DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    -- Update existing notifications with redirect URLs based on type
    UPDATE notifications
    SET redirect_url = CASE
        WHEN type = 'message' THEN '/inbox'
        WHEN type IN ('connection_request', 'connection_response') THEN '/connections'
        WHEN type IN ('post_like', 'post_comment', 'comment_reply') THEN '/feed'
        WHEN type IN ('event_rsvp', 'event_reminder_24h', 'event_reminder_1h') THEN '/events'
        WHEN type = 'job' THEN '/job-portal'
        WHEN type = 'signup_approved' THEN '/profile'
        ELSE '/feed'
    END
    WHERE redirect_url IS NULL;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE '✓ Backfilled redirect_url for % existing notifications', updated_count;
END $$;

-- ==================== STEP 6: UPDATE TRIGGER FOR READ_AT ====================

-- Create or replace function to set read_at timestamp
CREATE OR REPLACE FUNCTION update_notification_read_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_read = true AND OLD.is_read = false THEN
        NEW.read_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS set_notification_read_at ON notifications;

CREATE TRIGGER set_notification_read_at
BEFORE UPDATE ON notifications
FOR EACH ROW
WHEN (NEW.is_read IS DISTINCT FROM OLD.is_read)
EXECUTE FUNCTION update_notification_read_at();

RAISE NOTICE '✓ Created trigger for read_at timestamp';

-- ==================== STEP 7: CREATE CLEANUP FUNCTION ====================

-- Function to cleanup old read notifications
CREATE OR REPLACE FUNCTION cleanup_old_notifications(days_old INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM notifications
    WHERE is_read = true 
    AND created_at < NOW() - (days_old || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RAISE NOTICE '✓ Deleted % old notifications', deleted_count;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_notifications IS 'Deletes read notifications older than specified days (default 30)';

-- ==================== STEP 8: VERIFICATION ====================

DO $$ 
BEGIN
    RAISE NOTICE '=== Migration Complete ===';
    RAISE NOTICE 'Run the following queries to verify:';
    RAISE NOTICE '1. SELECT column_name FROM information_schema.columns WHERE table_name = ''notifications'';';
    RAISE NOTICE '2. SELECT indexname FROM pg_indexes WHERE tablename = ''notifications'';';
    RAISE NOTICE '3. SELECT type, redirect_url, COUNT(*) FROM notifications GROUP BY type, redirect_url;';
END $$;

-- Display summary
SELECT 
    'Notifications Table Summary' as info,
    COUNT(*) as total_notifications,
    SUM(CASE WHEN is_read THEN 1 ELSE 0 END) as read_count,
    SUM(CASE WHEN NOT is_read THEN 1 ELSE 0 END) as unread_count,
    COUNT(DISTINCT type) as notification_types,
    SUM(CASE WHEN redirect_url IS NOT NULL THEN 1 ELSE 0 END) as with_redirect_url
FROM notifications;

-- Display notification types distribution
SELECT 
    type,
    redirect_url,
    COUNT(*) as count,
    SUM(CASE WHEN is_read THEN 1 ELSE 0 END) as read,
    SUM(CASE WHEN NOT is_read THEN 1 ELSE 0 END) as unread
FROM notifications
GROUP BY type, redirect_url
ORDER BY count DESC;
