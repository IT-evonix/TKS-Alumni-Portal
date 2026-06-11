-- Blog Categories
CREATE TABLE IF NOT EXISTS blog_categories (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT '#008060',
  icon TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Blog Posts
CREATE TABLE IF NOT EXISTS blog_posts (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id VARCHAR REFERENCES blog_categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT,
  content TEXT NOT NULL,
  cover_image TEXT,
  tags TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  rejection_reason TEXT,
  reading_time_minutes INTEGER DEFAULT 1,
  views_count INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  bookmarks_count INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Blog Comments
CREATE TABLE IF NOT EXISTS blog_comments (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id VARCHAR NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  author_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id VARCHAR,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
ALTER TABLE blog_comments ADD FOREIGN KEY (parent_id) REFERENCES blog_comments(id) ON DELETE CASCADE;

-- Blog Likes
CREATE TABLE IF NOT EXISTS blog_likes (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id VARCHAR NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- Blog Bookmarks
CREATE TABLE IF NOT EXISTS blog_bookmarks (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id VARCHAR NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- Seed default categories
INSERT INTO blog_categories (name, slug, description, color, display_order) VALUES
  ('Technology', 'technology', 'Tech trends and software', '#0EA5E9', 1),
  ('Career', 'career', 'Career advice and growth', '#8B5CF6', 2),
  ('Life', 'life', 'Life experiences and stories', '#F59E0B', 3),
  ('Tips & Tricks', 'tips-tricks', 'Practical tips and how-tos', '#10B981', 4)
ON CONFLICT (slug) DO NOTHING;
