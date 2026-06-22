ALTER TABLE mentorship_sessions DROP CONSTRAINT IF EXISTS chk_mentorship_sessions_status;
ALTER TABLE mentorship_sessions ADD CONSTRAINT chk_mentorship_sessions_status CHECK (status IN ('scheduled', 'completed', 'cancelled', 'rescheduled', 'upcoming'));
ALTER TABLE mentorship_requests DROP CONSTRAINT IF EXISTS chk_mentorship_requests_status;
ALTER TABLE mentorship_requests ADD CONSTRAINT chk_mentorship_requests_status CHECK (status IN ('pending', 'accepted', 'rejected', 'declined', 'ended'));
