-- ============================================
-- NOTIFICATION ENHANCEMENTS SCHEMA
-- Creates tables for preferences, archive, analytics, and push notifications
-- ============================================

-- Notification Preferences Table
CREATE TABLE IF NOT EXISTS notification_preferences (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type VARCHAR NOT NULL,
  enabled BOOLEAN DEFAULT true,
  email_enabled BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT true,
  priority VARCHAR DEFAULT 'medium', -- 'high', 'medium', 'low'
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, notification_type)
);

-- Push Notification Subscriptions
CREATE TABLE IF NOT EXISTS push_notification_subscriptions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

-- Notification Archive Table
CREATE TABLE IF NOT EXISTS notification_archive (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_id VARCHAR NOT NULL,
  type VARCHAR NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  related_id TEXT,
  redirect_url TEXT,
  actor_id VARCHAR,
  metadata TEXT,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  archived_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, notification_id)
);

-- Notification Analytics Table
CREATE TABLE IF NOT EXISTS notification_analytics (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_id VARCHAR NOT NULL,
  notification_type VARCHAR NOT NULL,
  action VARCHAR NOT NULL, -- 'created', 'read', 'clicked', 'dismissed', 'archived', 'deleted'
  action_timestamp TIMESTAMPTZ DEFAULT NOW(),
  metadata TEXT, -- JSON for additional data
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notification Actions Table (for quick actions)
CREATE TABLE IF NOT EXISTS notification_actions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id VARCHAR NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type VARCHAR NOT NULL, -- 'quick_reply', 'quick_like', 'dismiss', 'snooze'
  action_data TEXT, -- JSON for action-specific data
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add archive column to notifications table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' 
    AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE notifications ADD COLUMN is_archived BOOLEAN DEFAULT false;
    ALTER TABLE notifications ADD COLUMN archived_at TIMESTAMPTZ;
    ALTER TABLE notifications ADD COLUMN priority VARCHAR DEFAULT 'medium';
    ALTER TABLE notifications ADD COLUMN snoozed_until TIMESTAMPTZ;
    ALTER TABLE notifications ADD COLUMN preview_image TEXT;
    ALTER TABLE notifications ADD COLUMN action_data TEXT; -- JSON for action buttons
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user ON notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_type ON notification_preferences(notification_type);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_notification_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_archive_user ON notification_archive(user_id, archived_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_analytics_user ON notification_analytics(user_id, action_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_notification_analytics_type ON notification_analytics(notification_type, action);
CREATE INDEX IF NOT EXISTS idx_notifications_archived ON notifications(user_id, is_archived, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(user_id, priority, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_snoozed ON notifications(user_id, snoozed_until) WHERE snoozed_until IS NOT NULL;

-- Function to auto-archive old notifications
CREATE OR REPLACE FUNCTION auto_archive_old_notifications()
RETURNS void AS $$
BEGIN
  -- Archive notifications older than 30 days that are read
  INSERT INTO notification_archive (
    user_id, notification_id, type, title, content, related_id, 
    redirect_url, actor_id, metadata, is_read, read_at, created_at
  )
  SELECT 
    user_id, id, type, title, content, related_id, 
    redirect_url, actor_id, metadata, is_read, read_at, created_at
  FROM notifications
  WHERE is_read = true 
    AND is_archived = false
    AND created_at < NOW() - INTERVAL '30 days'
  ON CONFLICT (user_id, notification_id) DO NOTHING;

  -- Mark as archived
  UPDATE notifications
  SET is_archived = true, archived_at = NOW()
  WHERE is_read = true 
    AND is_archived = false
    AND created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job (requires pg_cron extension)
-- This would typically be set up via a cron job or scheduler
-- SELECT cron.schedule('auto-archive-notifications', '0 2 * * *', 'SELECT auto_archive_old_notifications()');

-- Function to get notification analytics summary
CREATE OR REPLACE FUNCTION get_notification_analytics_summary(p_user_id VARCHAR, p_days INTEGER DEFAULT 30)
RETURNS TABLE (
  notification_type VARCHAR,
  total_created BIGINT,
  total_read BIGINT,
  read_rate NUMERIC,
  total_clicked BIGINT,
  click_rate NUMERIC,
  avg_time_to_read INTERVAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    na.notification_type,
    COUNT(*) FILTER (WHERE na.action = 'created') as total_created,
    COUNT(*) FILTER (WHERE na.action = 'read') as total_read,
    CASE 
      WHEN COUNT(*) FILTER (WHERE na.action = 'created') > 0 
      THEN ROUND(
        (COUNT(*) FILTER (WHERE na.action = 'read')::NUMERIC / 
         COUNT(*) FILTER (WHERE na.action = 'created')::NUMERIC) * 100, 
        2
      )
      ELSE 0
    END as read_rate,
    COUNT(*) FILTER (WHERE na.action = 'clicked') as total_clicked,
    CASE 
      WHEN COUNT(*) FILTER (WHERE na.action = 'read') > 0 
      THEN ROUND(
        (COUNT(*) FILTER (WHERE na.action = 'clicked')::NUMERIC / 
         COUNT(*) FILTER (WHERE na.action = 'read')::NUMERIC) * 100, 
        2
      )
      ELSE 0
    END as click_rate,
    AVG(
      CASE 
        WHEN created.action_timestamp IS NOT NULL AND read.action_timestamp IS NOT NULL
        THEN read.action_timestamp - created.action_timestamp
        ELSE NULL
      END
    ) FILTER (WHERE created.action_timestamp IS NOT NULL AND read.action_timestamp IS NOT NULL) as avg_time_to_read
  FROM notification_analytics na
  LEFT JOIN notification_analytics created 
    ON na.notification_id = created.notification_id 
    AND created.action = 'created'
  LEFT JOIN notification_analytics read 
    ON na.notification_id = read.notification_id 
    AND read.action = 'read'
  WHERE na.user_id = p_user_id
    AND na.action_timestamp >= NOW() - (p_days || ' days')::INTERVAL
  GROUP BY na.notification_type;
END;
$$ LANGUAGE plpgsql;
