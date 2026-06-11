-- Create travel_chapters table
CREATE TABLE IF NOT EXISTS travel_chapters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    country TEXT NOT NULL,
    description TEXT,
    cover_image TEXT,
    coordinates TEXT,
    created_by VARCHAR REFERENCES users(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create travel_chapter_members table
CREATE TABLE IF NOT EXISTS travel_chapter_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id UUID NOT NULL REFERENCES travel_chapters(id) ON DELETE CASCADE,
    user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(chapter_id, user_id)
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_travel_chapters_status ON travel_chapters(status);
CREATE INDEX IF NOT EXISTS idx_travel_chapters_city ON travel_chapters(city);
CREATE INDEX IF NOT EXISTS idx_travel_chapter_members_user_id ON travel_chapter_members(user_id);
CREATE INDEX IF NOT EXISTS idx_travel_chapter_members_chapter_id ON travel_chapter_members(chapter_id);
