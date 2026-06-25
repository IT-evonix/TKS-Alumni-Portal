export interface FeedPost {
  _type: "post";
  _sortDate: string;
  id: string;
  author_id: string;
  content: string;
  image_url?: string | null;
  post_type?: string;
  likes_count: number;
  comments_count: number;
  shares_count?: number;
  is_active?: boolean;
  status?: string;
  created_at: string;
  updated_at?: string;
  author?: any;
  author_profile_picture?: string | null;
  author_first_name?: string | null;
  author_last_name?: string | null;
  author_gender?: string | null;
  isLikedByUser?: boolean;
}

export interface FeedBlog {
  _type: "blog";
  _sortDate: string;
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  cover_image?: string | null;
  category?: { id: string; name: string; slug: string; color: string } | null;
  author?: {
    id: string;
    username?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    profile_picture?: string | null;
    current_role?: string | null;
  } | null;
  tags?: string[];
  reading_time_minutes?: number | null;
  views_count?: number;
  likes_count?: number;
  published_at: string;
  created_at?: string;
  viewer_has_bookmarked?: boolean;
}

export interface FeedPodcast {
  _type: "podcast";
  _sortDate: string;
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  embed_url?: string | null;
  video_url?: string | null;
  tags?: string[];
  episode_number?: number | null;
  views_count?: number;
  likes_count?: number;
  comments_count?: number;
  isLikedByUser?: boolean;
  published_at?: string | null;
  created_at: string;
}

export interface FeedTravelPost {
  _type: "travel_post";
  _sortDate: string;
  id: string;
  author_id: string;
  city: string;
  country: string;
  caption?: string | null;
  status: "pending" | "approved" | "rejected";
  rejection_reason?: string | null;
  is_hidden: boolean;
  likes_count: number;
  comments_count: number;
  bookmarks_count: number;
  views_count: number;
  created_at: string;
  updated_at: string;
  author: {
    id: string;
    username?: string;
    first_name?: string;
    last_name?: string;
    profile_picture?: string;
    current_role?: string;
  };
  media: Array<{ id: string; type: "image" | "video"; url: string; storage_path?: string; order_index: number }>;
  links: Array<{ id: string; post_id: string; url: string; title?: string; description?: string; order_index: number }>;
  viewer_has_liked: boolean;
  viewer_has_bookmarked: boolean;
}

export type FeedItem = FeedPost | FeedBlog | FeedPodcast | FeedTravelPost;
