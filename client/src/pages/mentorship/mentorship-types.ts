export interface Mentor {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  profile_picture?: string;
  current_role?: string;
  current_company?: string;
  graduation_year?: number;
  industry?: string;
  bio?: string;
  expertise_areas?: string;
  interest_areas?: string;
  alumni_skills?: { skill_name: string; proficiency_level: string; is_primary: boolean }[];
  match_score?: number;
  score_breakdown?: Record<string, number>;
  mentor_available?: boolean;
  max_mentees?: number;
  mentee_count?: number;
  available_days?: string;
  session_type?: string;
  meeting_link?: string;
  averageRating?: number | null;
  reviewCount?: number;
  mentorship_style?: 'structured' | 'ad_hoc' | 'accountability' | 'flexible';
  help_topics?: string;
  linkedin_url?: string;
  github_url?: string;
  portfolio_url?: string;
  twitter_url?: string;
  total_mentees_helped?: number;
}

export interface MentorshipRequest {
  id: string;
  mentee_id: string;
  mentor_id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'ended';
  goal_text?: string;
  message?: string;
  match_score?: number;
  created_at: string;
  mentor?: { first_name: string; last_name: string; profile_picture?: string; current_role?: string; current_company?: string };
  mentee?: { first_name: string; last_name: string; profile_picture?: string; current_role?: string; graduation_year?: number };
}

export interface MentorshipSession {
  id: string;
  mentor_id: string;
  mentee_id: string;
  request_id: string;
  scheduled_at: string;
  duration_minutes: number;
  agenda?: string;
  notes?: string;
  meet_link?: string;
  status: 'upcoming' | 'completed' | 'cancelled';
  cancellation_reason?: string;
  myRole: 'mentor' | 'mentee';
  other?: { first_name?: string; last_name?: string; profile_picture?: string; current_role?: string; current_company?: string };
}
