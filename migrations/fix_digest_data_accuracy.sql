-- Fix data accuracy issues in digest queries

-- Fix: Add index for weekly digest queries
CREATE INDEX IF NOT EXISTS idx_alumni_weekly_digest ON alumni(weekly_digest_enabled, last_digest_sent_at);

-- Fix: Add index for job alert queries
CREATE INDEX IF NOT EXISTS idx_alumni_job_alerts ON alumni(job_alerts_enabled);

-- Fix: Add index for job_alerts_sent table
CREATE INDEX IF NOT EXISTS idx_job_alerts_sent_alumni ON job_alerts_sent(alumni_id);
CREATE INDEX IF NOT EXISTS idx_job_alerts_sent_job ON job_alerts_sent(job_id);
CREATE INDEX IF NOT EXISTS idx_job_alerts_sent_sent_at ON job_alerts_sent(sent_at);

-- Fix: Add index for pending signup requests
CREATE INDEX IF NOT EXISTS idx_signup_requests_status ON signup_requests(status);

-- Fix: Add index for pending posts
CREATE INDEX IF NOT EXISTS idx_feed_posts_status ON feed_posts(status);

-- Fix: Add index for connections by status
CREATE INDEX IF NOT EXISTS idx_connections_status ON connection_requests(status);

-- Fix: Add index for notifications by type
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

-- Fix: Add index for post likes by created_at
CREATE INDEX IF NOT EXISTS idx_post_likes_created_at ON post_likes(created_at);

-- Fix: Add index for post comments by created_at
CREATE INDEX IF NOT EXISTS idx_post_comments_created_at ON post_comments(created_at);
