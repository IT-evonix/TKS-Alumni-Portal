-- Migration to add events to travel chapters
CREATE TABLE IF NOT EXISTS travel_chapter_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id UUID NOT NULL REFERENCES travel_chapters(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    venue TEXT NOT NULL,
    event_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_by VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS travel_chapter_event_rsvps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES travel_chapter_events(id) ON DELETE CASCADE,
    user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('going', 'maybe', 'not_going')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, user_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_travel_chapter_events_chapter_id ON travel_chapter_events(chapter_id);
CREATE INDEX IF NOT EXISTS idx_travel_chapter_event_rsvps_event_id ON travel_chapter_event_rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_travel_chapter_event_rsvps_user_id ON travel_chapter_event_rsvps(user_id);
