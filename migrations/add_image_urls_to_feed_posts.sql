-- Add support for multiple attachments per feed post
ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS image_urls text[];

-- Backfill existing single-image posts into the new array column
UPDATE feed_posts
SET image_urls = ARRAY[image_url]
WHERE image_url IS NOT NULL AND image_urls IS NULL;
