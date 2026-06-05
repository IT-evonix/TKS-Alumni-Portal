import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

// Validate before creating client
if (!supabaseUrl || !supabaseKey) {
  const isBrowser = typeof window !== 'undefined';
  const context = isBrowser ? 'browser' : 'server';

  console.error(`❌ FATAL (${context}): Supabase credentials missing`);
  console.error('Required:', isBrowser ? 'VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY' : 'SUPABASE_URL, SUPABASE_ANON_KEY');

  if (!isBrowser) {
    // Server-side: crash immediately
    process.exit(1);
  }
  // Browser: will throw error on first use
}

// Validate URL format
try {
  if (supabaseUrl) {
    new URL(supabaseUrl);
  }
} catch (error) {
  console.error(`❌ FATAL: Invalid SUPABASE_URL format: ${supabaseUrl}`);
  if (typeof window === 'undefined') {
    process.exit(1);
  }
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: typeof window !== 'undefined', // Only persist in browser
    autoRefreshToken: true,
    detectSessionInUrl: typeof window !== 'undefined',
  },
  global: {
    headers: {
      'X-Client-Info': 'tks-alumni-portal',
    },
  },
});

// Health check function
export async function checkSupabaseConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.from('users').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}


// Database types based on your schema
export interface User {
  id: string
  username: string
  email: string
  is_admin: boolean
  user_role: 'alumni' | 'student' | 'faculty' | 'administrator';
  created_at: string
  updated_at: string
}

export interface Alumni {
  id: string
  user_id: string
  first_name: string
  last_name: string
  email: string
  phone?: string
  date_of_birth?: string
  gender?: string
  profile_picture?: string
  bio?: string
  graduation_year: number
  batch: string
  course?: string
  branch?: string
  roll_number?: string
  cgpa?: string
  current_city?: string
  current_state?: string
  current_country?: string
  permanent_address?: string
  current_company?: string
  current_role?: string
  industry?: string
  experience?: string
  skills?: string
  higher_education?: string
  university?: string
  higher_education_country?: string
  linkedin_url?: string
  linkedin_photo_url?: string
  linkedin_synced?: boolean
  github_url?: string
  twitter_url?: string
  personal_website?: string
  is_profile_public: boolean
  show_email: boolean
  show_phone: boolean
  is_verified: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface FeedPost {
  id: string
  author_id: string
  content: string
  image_url?: string
  post_type: string
  likes_count: number
  comments_count: number
  shares_count: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PostLike {
  id: string
  post_id: string
  user_id: string
  created_at: string
}

export interface PostComment {
  id: string
  post_id: string
  user_id: string
  content: string
  is_active: boolean
  created_at: string
  updated_at: string
}