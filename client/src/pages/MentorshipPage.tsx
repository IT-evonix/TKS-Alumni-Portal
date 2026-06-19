import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Users, MessageSquare, Filter, Search, CheckCircle,
  XCircle, Clock, Sparkles, ChevronDown, ChevronUp,
  UserCheck, Inbox, Bookmark, BookmarkCheck, Star,
  CalendarPlus, Calendar, ExternalLink, Video, Mail,
  AlertTriangle,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Mentor {
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
}

interface MentorshipRequest {
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

interface MentorshipSession {
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
  myRole: 'mentor' | 'mentee';
  other?: { first_name: string; last_name: string; profile_picture?: string; current_role?: string; current_company?: string };
}

// ── Skeleton card ─────────────────────────────────────────────────────────────

const SkeletonCard = () => (
  <div className="rounded-xl border-0 shadow-lg bg-white p-6 animate-pulse space-y-4">
    <div className="flex items-start gap-4">
      <div className="w-16 h-16 rounded-full bg-gray-200 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-200 rounded w-1/2" />
        <div className="h-3 bg-gray-200 rounded w-1/3" />
      </div>
    </div>
    <div className="h-2 bg-gray-200 rounded w-full" />
    <div className="flex gap-2">
      <div className="h-6 bg-gray-200 rounded w-20" />
      <div className="h-6 bg-gray-200 rounded w-16" />
    </div>
    <div className="h-10 bg-gray-200 rounded w-full" />
  </div>
);

// ── Match score bar ───────────────────────────────────────────────────────────

const MatchBar = ({ score }: { score: number }) => {
  const color = score >= 70 ? 'bg-green-500' : score >= 45 ? 'bg-yellow-500' : 'bg-gray-400';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span className="flex items-center gap-1"><Sparkles className="w-3 h-3" /> Match</span>
        <span className={`font-semibold ${score >= 70 ? 'text-green-600' : score >= 45 ? 'text-yellow-600' : 'text-gray-500'}`}>
          {score}%
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-1.5">
        <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
};

// ── Status badge ──────────────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status: string }) => {
  if (status === 'accepted') return <Badge className="bg-green-100 text-green-700 border-0"><CheckCircle className="w-3 h-3 mr-1" />Accepted</Badge>;
  if (status === 'rejected') return <Badge className="bg-red-100 text-red-700 border-0"><XCircle className="w-3 h-3 mr-1" />Declined</Badge>;
  if (status === 'ended') return <Badge className="bg-gray-100 text-gray-600 border-0"><XCircle className="w-3 h-3 mr-1" />Ended</Badge>;
  return <Badge className="bg-yellow-100 text-yellow-700 border-0"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
};

// ── Star rating display ───────────────────────────────────────────────────────

const StarRating = ({ rating, max = 5, size = 'sm' }: { rating: number; max?: number; size?: 'sm' | 'md' }) => {
  const px = size === 'md' ? 'w-4 h-4' : 'w-3 h-3';
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star key={i} className={`${px} ${i < Math.round(rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
      ))}
    </span>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────

export const MentorshipPage = (): JSX.Element => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMentor, setIsMentor] = useState(false);
  const [expertiseFilter, setExpertiseFilter] = useState('all');
  const [availableInterests, setAvailableInterests] = useState<string[]>([]);
  const [availableExpertise, setAvailableExpertise] = useState<string[]>([]);
  const [interestFilter, setInterestFilter] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('match');
  const [searchQuery, setSearchQuery] = useState('');
  const [dayFilter, setDayFilter] = useState<string[]>([]);
  const [goalText, setGoalText] = useState('');
  const [goalOpen, setGoalOpen] = useState(false);
  const [pendingMentorIds, setPendingMentorIds] = useState<Set<string>>(new Set());
  const [myRequests, setMyRequests] = useState<MentorshipRequest[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<MentorshipRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestMessage, setRequestMessage] = useState('');
  const [activeRequestModal, setActiveRequestModal] = useState<string | null>(null);
  const [expandedBreakdown, setExpandedBreakdown] = useState<string | null>(null);

  // Bookmarks
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  // Sessions
  const [sessions, setSessions] = useState<MentorshipSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [scheduleModal, setScheduleModal] = useState<{ requestId: string; otherName: string } | null>(null);
  const [newSession, setNewSession] = useState({ scheduledAt: '', durationMinutes: 60, agenda: '', meetLink: '' });

  // Availability settings
  const [availOpen, setAvailOpen] = useState(false);
  const [availSettings, setAvailSettings] = useState({ available_days: '', session_type: 'video', meeting_link: '', max_mentees: 3 });

  // Reviews
  const [reviewModal, setReviewModal] = useState<{ sessionId: string; reviewedId: string; reviewedName: string } | null>(null);
  const [reviewInput, setReviewInput] = useState({ rating: 5, comment: '' });
  const [mentorReviews, setMentorReviews] = useState<Record<string, { avg: number | null; total: number }>>({});

  // End relationship confirm
  const [endConfirm, setEndConfirm] = useState<string | null>(null);

  const headers = { 'user-id': user?.id || '' };

  // ── Fetch helpers ───────────────────────────────────────────────────────────

  const fetchMyStatus = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch('/api/mentorship/my-status', { headers });
      if (res.ok) {
        const data = await res.json();
        setIsMentor(!!data.is_mentor);
        if (data.is_mentor) {
          setAvailSettings({
            available_days: data.available_days || '',
            session_type: data.session_type || 'video',
            meeting_link: data.meeting_link || '',
            max_mentees: data.max_mentees ?? 3,
          });
        }
      }
    } catch { /* silent */ }
  }, [user?.id]);

  const fetchMentors = useCallback(async (goal?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (expertiseFilter !== 'all') params.append('expertise', expertiseFilter);
      if (goal) params.append('goal', goal);
      if (interestFilter.length > 0) params.append('interests', interestFilter.join(','));
      const res = await fetch(`/api/mentorship/mentors?${params}`, { headers });
      if (res.ok) {
        const data = await res.json();
        const mentorList: Mentor[] = (data.mentors || []).filter((m: Mentor) => m.user_id !== user?.id);
        // Fetch ratings for all mentors
        const withRatings = await Promise.all(
          mentorList.map(async (m) => {
            try {
              const r = await fetch(`/api/mentorship/reviews/${m.user_id}`, { headers });
              if (r.ok) {
                const rd = await r.json();
                return { ...m, averageRating: rd.averageRating, reviewCount: rd.total };
              }
            } catch { /* silent */ }
            return m;
          })
        );
        setMentors(withRatings);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to load mentors', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [expertiseFilter, interestFilter, user?.id]);

  const fetchMyRequests = useCallback(async () => {
    if (!user?.id) return;
    setRequestsLoading(true);
    try {
      const res = await fetch('/api/mentorship/my-requests', { headers });
      if (res.ok) {
        const data = await res.json();
        setMyRequests(data.requests || []);
        const pending = new Set<string>((data.requests || [])
          .filter((r: MentorshipRequest) => r.status === 'pending')
          .map((r: MentorshipRequest) => r.mentor_id));
        setPendingMentorIds(pending);
      }
    } catch { /* silent */ } finally {
      setRequestsLoading(false);
    }
  }, [user?.id]);

  const fetchIncoming = useCallback(async () => {
    if (!user?.id || !isMentor) return;
    try {
      const res = await fetch('/api/mentorship/incoming', { headers });
      if (res.ok) {
        const data = await res.json();
        setIncomingRequests(data.requests || []);
      }
    } catch { /* silent */ }
  }, [user?.id, isMentor]);

  const fetchBookmarks = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch('/api/mentorship/bookmarks', { headers });
      if (res.ok) {
        const data = await res.json();
        setBookmarkedIds(new Set(data.mentorIds || []));
      }
    } catch { /* silent */ }
  }, [user?.id]);

  const fetchSessions = useCallback(async () => {
    if (!user?.id) return;
    setSessionsLoading(true);
    try {
      const res = await fetch('/api/mentorship/sessions', { headers });
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch { /* silent */ } finally {
      setSessionsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchMyStatus(); fetchMyRequests(); fetchBookmarks(); }, [fetchMyStatus, fetchMyRequests, fetchBookmarks]);
  useEffect(() => { fetchMentors(); }, [expertiseFilter, interestFilter]);
  useEffect(() => { if (isMentor) fetchIncoming(); }, [isMentor, fetchIncoming]);
  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  useEffect(() => {
    fetch('/api/mentorship/available-interests')
      .then(r => r.ok ? r.json() : { interests: [] })
      .then(d => setAvailableInterests(d.interests || []))
      .catch(() => {});
    fetch('/api/mentorship/available-expertise')
      .then(r => r.ok ? r.json() : { expertise: [] })
      .then(d => setAvailableExpertise(d.expertise || []))
      .catch(() => {});
  }, []);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleFindMatches = () => fetchMentors(goalText);

  const handleRequestMentorship = async (mentorId: string) => {
    try {
      const res = await fetch('/api/mentorship/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'user-id': user?.id || '' },
        body: JSON.stringify({
          mentorId,
          message: requestMessage || undefined,
          goalText: goalText || undefined,
          matchScore: mentors.find(m => m.user_id === mentorId)?.match_score,
        }),
      });
      if (res.ok) {
        setPendingMentorIds(prev => new Set(prev).add(mentorId));
        setActiveRequestModal(null);
        setRequestMessage('');
        fetchMyRequests();
        toast({ title: 'Request sent!', description: 'Your mentorship request has been sent.' });
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'Failed to send request', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to send request', variant: 'destructive' });
    }
  };

  const handleWithdrawRequest = async (requestId: string) => {
    try {
      const res = await fetch(`/api/mentorship/request/${requestId}`, {
        method: 'DELETE',
        headers: { 'user-id': user?.id || '' },
      });
      if (res.ok) {
        fetchMyRequests();
        toast({ title: 'Withdrawn', description: 'Your request has been withdrawn.' });
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'Failed to withdraw', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to withdraw', variant: 'destructive' });
    }
  };

  const handleEndRelationship = async (requestId: string) => {
    try {
      const res = await fetch(`/api/mentorship/request/${requestId}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'user-id': user?.id || '' },
      });
      if (res.ok) {
        fetchMyRequests();
        fetchIncoming();
        fetchSessions();
        setEndConfirm(null);
        toast({ title: 'Relationship ended', description: 'The mentorship relationship has been ended.' });
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'Failed to end relationship', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to end relationship', variant: 'destructive' });
    }
  };

  const toggleMentorStatus = async () => {
    try {
      const res = await fetch('/api/mentorship/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'user-id': user?.id || '' },
        body: JSON.stringify({ isMentor: !isMentor }),
      });
      if (res.ok) {
        setIsMentor(!isMentor);
        toast({ title: 'Success', description: isMentor ? 'Mentor status disabled' : 'You are now a mentor!' });
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'Failed to update', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to update mentor status', variant: 'destructive' });
    }
  };

  const handleRespond = async (requestId: string, status: 'accepted' | 'rejected') => {
    try {
      const res = await fetch(`/api/mentorship/request/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'user-id': user?.id || '' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        fetchIncoming();
        if (status === 'accepted') fetchSessions();
        toast({ title: status === 'accepted' ? 'Accepted!' : 'Declined', description: `Mentorship request ${status}.` });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to respond', variant: 'destructive' });
    }
  };

  const toggleBookmark = async (mentorId: string) => {
    try {
      const res = await fetch('/api/mentorship/bookmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'user-id': user?.id || '' },
        body: JSON.stringify({ mentorId }),
      });
      if (res.ok) {
        const data = await res.json();
        setBookmarkedIds(prev => {
          const next = new Set(prev);
          data.bookmarked ? next.add(mentorId) : next.delete(mentorId);
          return next;
        });
      }
    } catch { /* silent */ }
  };

  const saveAvailability = async () => {
    try {
      const res = await fetch('/api/mentorship/my-availability', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'user-id': user?.id || '' },
        body: JSON.stringify(availSettings),
      });
      if (res.ok) {
        setAvailOpen(false);
        toast({ title: 'Saved', description: 'Availability settings updated.' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save availability', variant: 'destructive' });
    }
  };

  const MEET_LINK_PATTERN = /^https?:\/\/(meet\.google\.com|zoom\.us|us\d*\.zoom\.us|teams\.microsoft\.com|teams\.live\.com|meet\.jit\.si|whereby\.com|webex\.com|[\w-]+\.webex\.com|bluejeans\.com|gotomeeting\.com|join\.me|whereby\.com|gather\.town|meet\.around\.co|8x8\.vc)\//i;

  const isValidMeetLink = (url: string) => {
    try { new URL(url); } catch { return false; }
    return MEET_LINK_PATTERN.test(url);
  };

  const createSession = async (forceWithoutLink = false) => {
    if (!scheduleModal || !newSession.scheduledAt) return;
    if (new Date(newSession.scheduledAt) <= new Date()) {
      toast({ title: 'Invalid time', description: 'Please select a future date and time.', variant: 'destructive' });
      return;
    }
    if (!newSession.meetLink) {
      toast({ title: 'Meet link required', description: 'Please provide a meeting link (Google Meet, Zoom, Teams, etc.)', variant: 'destructive' });
      return;
    }
    if (!isValidMeetLink(newSession.meetLink)) {
      toast({ title: 'Invalid meet link', description: 'Please enter a valid link from a supported platform: Google Meet, Zoom, Microsoft Teams, Jitsi, Webex, etc.', variant: 'destructive' });
      return;
    }
    try {
      const res = await fetch('/api/mentorship/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'user-id': user?.id || '' },
        body: JSON.stringify({
          requestId: scheduleModal.requestId,
          scheduledAt: newSession.scheduledAt,
          durationMinutes: newSession.durationMinutes,
          agenda: newSession.agenda || undefined,
          meetLink: newSession.meetLink || undefined,
        }),
      });
      if (res.ok) {
        setScheduleModal(null);
        setNewSession({ scheduledAt: '', durationMinutes: 60, agenda: '', meetLink: '' });
        fetchSessions();
        toast({ title: 'Session scheduled!', description: 'Your mentorship session has been scheduled.' });
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'Failed to schedule', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to schedule session', variant: 'destructive' });
    }
  };

  const updateSessionStatus = async (sessionId: string, status: 'completed' | 'cancelled') => {
    try {
      const res = await fetch(`/api/mentorship/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'user-id': user?.id || '' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        fetchSessions();
        toast({ title: status === 'completed' ? 'Marked complete' : 'Cancelled', description: `Session ${status}.` });
      }
    } catch { /* silent */ }
  };

  const submitReview = async () => {
    if (!reviewModal) return;
    try {
      const res = await fetch('/api/mentorship/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'user-id': user?.id || '' },
        body: JSON.stringify({
          sessionId: reviewModal.sessionId,
          reviewedId: reviewModal.reviewedId,
          rating: reviewInput.rating,
          comment: reviewInput.comment || undefined,
        }),
      });
      if (res.ok) {
        setReviewModal(null);
        setReviewInput({ rating: 5, comment: '' });
        fetchMentors();
        toast({ title: 'Review submitted!', description: 'Thank you for your feedback.' });
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'Failed to submit review', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to submit review', variant: 'destructive' });
    }
  };

  // ── Derived data ─────────────────────────────────────────────────────────────

  const filteredMentors = mentors.filter(m => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesSearch = (
        `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) ||
        (m.bio || '').toLowerCase().includes(q) ||
        (m.current_company || '').toLowerCase().includes(q) ||
        (m.current_role || '').toLowerCase().includes(q)
      );
      if (!matchesSearch) return false;
    }
    if (dayFilter.length > 0) {
      const mentorDays = (m.available_days || '').split(',').map(d => d.trim().toLowerCase());
      return dayFilter.some(d => mentorDays.includes(d.toLowerCase()));
    }
    return true;
  });

  const sortedMentors = [...filteredMentors].sort((a, b) => {
    if (sortBy === 'match') return (b.match_score || 0) - (a.match_score || 0);
    if (sortBy === 'available') {
      const aSlots = (a.max_mentees || 3) - (a.mentee_count || 0);
      const bSlots = (b.max_mentees || 3) - (b.mentee_count || 0);
      return bSlots - aSlots;
    }
    if (sortBy === 'rating') return (b.averageRating || 0) - (a.averageRating || 0);
    return 0;
  });

  const savedMentors = mentors.filter(m => bookmarkedIds.has(m.user_id));

  const acceptedRequests = myRequests.filter(r => r.status === 'accepted');
  const hasActiveSessions = acceptedRequests.length > 0 || sessions.length > 0;

  const pendingIncoming = incomingRequests.filter(r => r.status === 'pending');
  const activeMentees = incomingRequests.filter(r => r.status === 'accepted');

  // ── Render helpers ──────────────────────────────────────────────────────────

  const renderMentorCard = (mentor: Mentor) => {
    const isPending = pendingMentorIds.has(mentor.user_id);
    const slots = (mentor.max_mentees ?? 3) - (mentor.mentee_count ?? 0);
    const isFull = mentor.mentor_available === false || slots <= 0;
    const isBookmarked = bookmarkedIds.has(mentor.user_id);
    const skills = mentor.alumni_skills?.filter(s => s.is_primary).slice(0, 3) ?? [];
    const expertiseTags: string[] = (() => {
      try {
        const raw = mentor.expertise_areas;
        if (!raw) return [];
        return JSON.parse(raw);
      } catch { return (mentor.expertise_areas || '').split(',').map(s => s.trim()).filter(Boolean); }
    })().slice(0, 3);

    const dayChips = mentor.available_days
      ? mentor.available_days.split(',').map(d => d.trim()).filter(Boolean)
      : [];

    return (
      <Card key={mentor.id} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
        <CardHeader className="p-4 sm:p-6 pb-2">
          <div className="flex items-start gap-3 sm:gap-4">
            <Avatar className="w-12 h-12 sm:w-16 sm:h-16 flex-shrink-0">
              <AvatarImage src={mentor.profile_picture} />
              <AvatarFallback className="bg-[#008060] text-white text-sm sm:text-base">
                {mentor.first_name?.[0]}{mentor.last_name?.[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-1">
                <CardTitle className="text-base sm:text-lg truncate">
                  {mentor.first_name} {mentor.last_name}
                  {mentor.graduation_year && (
                    <span className="ml-2 text-xs font-normal text-gray-400">'{String(mentor.graduation_year).slice(-2)}</span>
                  )}
                </CardTitle>
                <button
                  type="button"
                  onClick={() => toggleBookmark(mentor.user_id)}
                  className="text-gray-400 hover:text-[#008060] transition-colors flex-shrink-0 mt-0.5"
                  aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark mentor'}
                >
                  {isBookmarked
                    ? <BookmarkCheck className="w-4 h-4 text-[#008060]" />
                    : <Bookmark className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs sm:text-sm text-gray-600 truncate">{mentor.current_role}</p>
              <p className="text-xs text-gray-500 truncate">{mentor.current_company}</p>
              {mentor.averageRating !== null && mentor.averageRating !== undefined && (
                <div className="flex items-center gap-1 mt-0.5">
                  <StarRating rating={mentor.averageRating} />
                  <span className="text-xs text-gray-400">{mentor.averageRating.toFixed(1)} ({mentor.reviewCount})</span>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-2 space-y-3">
          {mentor.match_score !== undefined && (
            <div className="space-y-1">
              <MatchBar score={mentor.match_score} />
              {mentor.score_breakdown && (
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#008060] transition-colors"
                  onClick={() => setExpandedBreakdown(expandedBreakdown === mentor.user_id ? null : mentor.user_id)}
                >
                  {expandedBreakdown === mentor.user_id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {expandedBreakdown === mentor.user_id ? 'Hide breakdown' : 'See breakdown'}
                </button>
              )}
              {expandedBreakdown === mentor.user_id && mentor.score_breakdown && (() => {
                const factors: { key: string; label: string; max: number }[] = [
                  { key: 'interestOverlap', label: 'Interest Match', max: 25 },
                  { key: 'skillOverlap', label: 'Skill Overlap', max: 25 },
                  { key: 'industryMatch', label: 'Industry Match', max: 20 },
                  { key: 'careerStageGap', label: 'Career Stage', max: 15 },
                  { key: 'availability', label: 'Availability', max: 10 },
                  { key: 'timezone', label: 'Timezone', max: 5 },
                ];
                return (
                  <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 mt-1">
                    {factors.map(({ key, label, max }) => {
                      const val = mentor.score_breakdown![key] ?? 0;
                      const pct = Math.round((val / max) * 100);
                      const color = pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-400' : 'bg-gray-300';
                      return (
                        <div key={key} className="flex items-center gap-2 text-xs">
                          <span className="w-28 text-gray-600 flex-shrink-0">{label}</span>
                          <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                            <div className={`${color} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-10 text-right text-gray-500 flex-shrink-0">{val}/{max}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Availability */}
          <div className="flex items-center justify-between text-xs flex-wrap gap-1">
            {isFull ? (
              <span className="text-red-500 font-medium">Full — not accepting mentees</span>
            ) : (
              <span className="text-green-600 font-medium">Available · {slots} slot{slots !== 1 ? 's' : ''}</span>
            )}
            {dayChips.length > 0 && (
              <span className="flex items-center gap-1 text-gray-500">
                <Calendar className="w-3 h-3" />
                {dayChips.join(' · ')}
              </span>
            )}
            {mentor.session_type && (
              <span className="flex items-center gap-1 text-gray-500">
                {mentor.session_type === 'video' ? <Video className="w-3 h-3" /> : <Mail className="w-3 h-3" />}
                {mentor.session_type}
              </span>
            )}
          </div>

          {/* Expertise / skills */}
          <div className="flex flex-wrap gap-1">
            {expertiseTags.map((exp, i) => (
              <Badge key={`exp-${i}`} variant="secondary" className="text-xs">{exp}</Badge>
            ))}
            {skills.map((s, i) => (
              <Badge key={`sk-${i}`} variant="outline" className="text-xs">{s.skill_name}</Badge>
            ))}
          </div>

          {/* View profile + meeting link */}
          <div className="flex items-center gap-2">
            <a
              href={`/profile/${mentor.user_id}`}
              className="text-xs text-[#008060] hover:underline flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" /> View Profile
            </a>
            {mentor.meeting_link && (
              <a
                href={mentor.meeting_link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
              >
                <Video className="w-3 h-3" /> Book a call
              </a>
            )}
          </div>

          {/* Request modal inline */}
          {activeRequestModal === mentor.user_id ? (
            <div className="space-y-2">
              <Textarea
                placeholder="Introduce yourself and share what you hope to achieve (optional)"
                value={requestMessage}
                onChange={e => setRequestMessage(e.target.value)}
                className="text-sm min-h-[72px]"
              />
              <div className="flex gap-2">
                <Button
                  onClick={() => handleRequestMentorship(mentor.user_id)}
                  variant="brand"
                  className="flex-1 min-h-[40px] text-sm"
                  disabled={isFull}
                >
                  Send Request
                </Button>
                <Button variant="ghost" onClick={() => setActiveRequestModal(null)} className="min-h-[40px]">
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              onClick={() => isPending ? null : setActiveRequestModal(mentor.user_id)}
              variant={isPending ? 'outline' : 'brand'}
              className="w-full min-h-[40px] text-sm"
              disabled={isPending || isFull}
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              {isPending ? 'Request Pending' : isFull ? 'Mentor Full' : 'Request Mentorship'}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderMyRequests = () => {
    if (requestsLoading) return <p className="text-gray-500 text-sm">Loading…</p>;
    if (!myRequests.length) return (
      <div className="text-center py-12 text-gray-500">
        <UserCheck className="w-10 h-10 mx-auto mb-3 text-gray-300" />
        <p>You haven't sent any mentorship requests yet.</p>
        <p className="text-sm mt-1">Browse mentors in the Discover tab.</p>
      </div>
    );
    return (
      <div className="space-y-3">
        {myRequests.map(req => (
          <Card key={req.id} className="border shadow-sm">
            <CardContent className="p-4 flex items-start gap-4">
              <Avatar className="w-10 h-10 flex-shrink-0">
                <AvatarImage src={req.mentor?.profile_picture} />
                <AvatarFallback className="bg-[#008060] text-white text-xs">
                  {req.mentor?.first_name?.[0]}{req.mentor?.last_name?.[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{req.mentor?.first_name} {req.mentor?.last_name}</p>
                <p className="text-xs text-gray-500 truncate">{req.mentor?.current_role} @ {req.mentor?.current_company}</p>
                {req.goal_text && <p className="text-xs text-gray-600 mt-1 italic">"{req.goal_text.slice(0, 100)}{req.goal_text.length > 100 ? '…' : ''}"</p>}
              </div>
              <div className="flex flex-col items-end gap-2">
                <StatusBadge status={req.status} />
                {req.status === 'pending' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs text-red-600 border-red-200 hover:bg-red-50 min-h-[28px]"
                    onClick={() => handleWithdrawRequest(req.id)}
                  >
                    Withdraw
                  </Button>
                )}
                {req.status === 'accepted' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs text-gray-600 min-h-[28px]"
                    onClick={() => setScheduleModal({ requestId: req.id, otherName: `${req.mentor?.first_name} ${req.mentor?.last_name}` })}
                  >
                    <CalendarPlus className="w-3 h-3 mr-1" /> Schedule
                  </Button>
                )}
                {req.status === 'accepted' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs text-red-600 border-red-100 hover:bg-red-50 min-h-[28px]"
                    onClick={() => setEndConfirm(req.id)}
                  >
                    End Relationship
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderIncoming = () => (
    <div className="space-y-6">
      {/* Pending requests */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4" /> Pending Requests
          {pendingIncoming.length > 0 && (
            <span className="bg-yellow-100 text-yellow-700 text-xs rounded-full px-2 py-0.5">{pendingIncoming.length}</span>
          )}
        </h3>
        {pendingIncoming.length === 0 ? (
          <p className="text-sm text-gray-500">No pending requests.</p>
        ) : (
          <div className="space-y-3">
            {pendingIncoming.map(req => (
              <Card key={req.id} className="border shadow-sm">
                <CardContent className="p-4 flex items-start gap-4">
                  <Avatar className="w-10 h-10 flex-shrink-0">
                    <AvatarImage src={req.mentee?.profile_picture} />
                    <AvatarFallback className="bg-gray-400 text-white text-xs">
                      {req.mentee?.first_name?.[0]}{req.mentee?.last_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">
                      {req.mentee?.first_name} {req.mentee?.last_name}
                      {req.mentee?.graduation_year && <span className="ml-2 text-xs text-gray-400">'{String(req.mentee.graduation_year).slice(-2)}</span>}
                    </p>
                    <p className="text-xs text-gray-500">{req.mentee?.current_role}</p>
                    {req.goal_text && (
                      <p className="text-xs text-gray-700 mt-1 bg-gray-50 rounded px-2 py-1 italic">"{req.goal_text}"</p>
                    )}
                    {req.message && <p className="text-xs text-gray-600 mt-1">{req.message}</p>}
                    {req.match_score !== undefined && (
                      <p className="text-xs text-[#008060] mt-1 font-medium"><Sparkles className="w-3 h-3 inline mr-1" />{req.match_score}% match</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 ml-2">
                    <Button size="sm" variant="brand" className="min-h-[36px] text-xs" onClick={() => handleRespond(req.id, 'accepted')}>
                      <CheckCircle className="w-3 h-3 mr-1" /> Accept
                    </Button>
                    <Button size="sm" variant="outline" className="min-h-[36px] text-xs text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleRespond(req.id, 'rejected')}>
                      <XCircle className="w-3 h-3 mr-1" /> Decline
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Active mentees */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-600" /> Active Mentees
          {activeMentees.length > 0 && (
            <span className="bg-green-100 text-green-700 text-xs rounded-full px-2 py-0.5">{activeMentees.length}</span>
          )}
        </h3>
        {activeMentees.length === 0 ? (
          <p className="text-sm text-gray-500">No active mentees yet.</p>
        ) : (
          <div className="space-y-3">
            {activeMentees.map(req => (
              <Card key={req.id} className="border shadow-sm bg-green-50/30">
                <CardContent className="p-4 flex items-start gap-4">
                  <Avatar className="w-10 h-10 flex-shrink-0">
                    <AvatarImage src={req.mentee?.profile_picture} />
                    <AvatarFallback className="bg-[#008060] text-white text-xs">
                      {req.mentee?.first_name?.[0]}{req.mentee?.last_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{req.mentee?.first_name} {req.mentee?.last_name}</p>
                    <p className="text-xs text-gray-500">{req.mentee?.current_role}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs min-h-[32px]"
                      onClick={() => setScheduleModal({ requestId: req.id, otherName: `${req.mentee?.first_name} ${req.mentee?.last_name}` })}
                    >
                      <CalendarPlus className="w-3 h-3 mr-1" /> Schedule
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs text-red-600 border-red-100 hover:bg-red-50 min-h-[32px]"
                      onClick={() => setEndConfirm(req.id)}
                    >
                      End
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderSessions = () => {
    if (sessionsLoading) return <p className="text-gray-500 text-sm">Loading sessions…</p>;
    if (!sessions.length) return (
      <div className="text-center py-12 text-gray-500">
        <Calendar className="w-10 h-10 mx-auto mb-3 text-gray-300" />
        <p>No sessions scheduled yet.</p>
        <p className="text-sm mt-1">Accept a mentorship and use "Schedule" to book a session.</p>
      </div>
    );

    const upcoming = sessions.filter(s => s.status === 'upcoming');
    const past = sessions.filter(s => s.status !== 'upcoming');

    const renderSessionCard = (s: MentorshipSession) => (
      <Card key={s.id} className={`border shadow-sm ${s.status === 'completed' ? 'opacity-80' : ''}`}>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar className="w-9 h-9 flex-shrink-0">
                <AvatarImage src={s.other?.profile_picture} />
                <AvatarFallback className="bg-[#008060] text-white text-xs">
                  {s.other?.first_name?.[0]}{s.other?.last_name?.[0]}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-sm">{s.other?.first_name} {s.other?.last_name}</p>
                <p className="text-xs text-gray-500 capitalize">{s.myRole === 'mentor' ? 'Mentee' : 'Mentor'}</p>
              </div>
            </div>
            <Badge className={
              s.status === 'upcoming' ? 'bg-blue-100 text-blue-700 border-0' :
              s.status === 'completed' ? 'bg-green-100 text-green-700 border-0' :
              'bg-gray-100 text-gray-600 border-0'
            }>
              {s.status}
            </Badge>
          </div>
          <div className="text-xs text-gray-600 flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(s.scheduled_at).toLocaleString()}</span>
            <span>{s.duration_minutes} min</span>
          </div>
          {s.meet_link && <p className="text-xs bg-blue-50 rounded p-2 text-blue-700"><span className="font-medium">Meet Link: </span><a href={s.meet_link} target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-900">{s.meet_link}</a></p>}
          {s.agenda && <p className="text-xs bg-gray-50 rounded p-2 text-gray-700"><span className="font-medium">Agenda: </span>{s.agenda}</p>}
          {s.notes && <p className="text-xs bg-yellow-50 rounded p-2 text-gray-700"><span className="font-medium">Notes: </span>{s.notes}</p>}
          {s.status === 'upcoming' && (
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="brand" className="text-xs min-h-[30px]"
                onClick={() => updateSessionStatus(s.id, 'completed')}>
                <CheckCircle className="w-3 h-3 mr-1" /> Mark Complete
              </Button>
              <Button size="sm" variant="outline" className="text-xs text-red-600 border-red-100 min-h-[30px]"
                onClick={() => updateSessionStatus(s.id, 'cancelled')}>
                <XCircle className="w-3 h-3 mr-1" /> Cancel
              </Button>
            </div>
          )}
          {s.status === 'completed' && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs min-h-[30px]"
              onClick={() => setReviewModal({
                sessionId: s.id,
                reviewedId: s.myRole === 'mentor' ? s.mentee_id : s.mentor_id,
                reviewedName: `${s.other?.first_name} ${s.other?.last_name}`,
              })}
            >
              <Star className="w-3 h-3 mr-1" /> Leave Review
            </Button>
          )}
        </CardContent>
      </Card>
    );

    return (
      <div className="space-y-6">
        {upcoming.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Upcoming</h3>
            <div className="space-y-3">{upcoming.map(renderSessionCard)}</div>
          </div>
        )}
        {past.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Past Sessions</h3>
            <div className="space-y-3">{past.map(renderSessionCard)}</div>
          </div>
        )}
      </div>
    );
  };

  // ── Page ────────────────────────────────────────────────────────────────────

  return (
    <AppLayout currentPage="mentorship">
      <div className="min-h-screen bg-gray-50 p-3 sm:p-4 lg:p-6">
        <div className="max-w-[1400px] mx-auto space-y-4 sm:space-y-6">

          {/* Mobile back */}
          <Button variant="ghost" size="sm" className="lg:hidden flex items-center gap-2 text-gray-600 hover:text-[#008060] mb-2 min-h-[44px]"
            onClick={() => window.history.back()} aria-label="Go back">
            <span className="text-xl">←</span><span>Back</span>
          </Button>

          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm sm:text-base text-gray-600 mt-1">AI-powered mentor matching for your career goals</p>
            </div>
            <Button onClick={toggleMentorStatus} variant={isMentor ? 'destructive' : 'brand'}
              className="w-full sm:w-auto min-h-[44px] text-sm sm:text-base">
              <Users className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">{isMentor ? 'Disable Mentor Status' : 'Become a Mentor'}</span>
              <span className="sm:hidden">{isMentor ? 'Disable' : 'Become Mentor'}</span>
            </Button>
          </div>

          {/* Mentor availability settings panel */}
          {isMentor && (
            <div className="bg-white rounded-xl border shadow-sm">
              <button
                className="flex items-center justify-between w-full text-sm font-medium text-gray-700 p-4"
                onClick={() => setAvailOpen(!availOpen)}
              >
                <span className="flex items-center gap-2"><Calendar className="w-4 h-4 text-[#008060]" /> Availability Settings</span>
                {availOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {availOpen && (
                <div className="px-4 pb-4 space-y-3 border-t pt-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="text-xs text-gray-600 mb-2 block">Available Days</label>
                      <div className="flex flex-wrap gap-1.5">
                        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => {
                          const selected = (availSettings.available_days || '').split(',').map(d => d.trim()).filter(Boolean).includes(day);
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => {
                                const current = (availSettings.available_days || '').split(',').map(d => d.trim()).filter(Boolean);
                                const next = selected ? current.filter(d => d !== day) : [...current, day];
                                setAvailSettings(p => ({ ...p, available_days: next.join(',') }));
                              }}
                              className={[
                                'px-3 py-1.5 rounded-full text-xs border font-medium transition-colors',
                                selected
                                  ? 'bg-[#008060] text-white border-[#008060]'
                                  : 'bg-white text-gray-600 border-gray-200 hover:border-[#008060] hover:text-[#008060]',
                              ].join(' ')}
                            >
                              {day}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">Session Type</label>
                      <Select value={availSettings.session_type} onValueChange={v => setAvailSettings(p => ({ ...p, session_type: v }))}>
                        <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="video">Video</SelectItem>
                          <SelectItem value="async">Async / Messaging</SelectItem>
                          <SelectItem value="either">Either</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">Meeting / Calendly Link</label>
                      <Input
                        value={availSettings.meeting_link}
                        onChange={e => setAvailSettings(p => ({ ...p, meeting_link: e.target.value }))}
                        placeholder="https://calendly.com/..."
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">Max Mentees</label>
                      <Input
                        type="number"
                        min={1}
                        max={20}
                        value={availSettings.max_mentees}
                        onChange={e => setAvailSettings(p => ({ ...p, max_mentees: parseInt(e.target.value) || 3 }))}
                        className="text-sm"
                      />
                    </div>
                  </div>
                  <Button onClick={saveAvailability} variant="brand" size="sm" className="min-h-[36px]">
                    Save Availability
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Tabs */}
          <Tabs defaultValue="discover">
            <TabsList className="bg-gray-100 flex-wrap h-auto gap-1">
              <TabsTrigger value="discover" className="flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5" /> Discover
              </TabsTrigger>
              <TabsTrigger value="saved" className="flex items-center gap-1.5">
                <Bookmark className="w-3.5 h-3.5" /> Saved
                {bookmarkedIds.size > 0 && (
                  <span className="ml-1 bg-[#008060] text-white text-xs rounded-full px-1.5 py-0.5 leading-none">{bookmarkedIds.size}</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="my-requests" className="flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5" /> My Requests
                {myRequests.filter(r => r.status === 'pending').length > 0 && (
                  <span className="ml-1 bg-yellow-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
                    {myRequests.filter(r => r.status === 'pending').length}
                  </span>
                )}
              </TabsTrigger>
              {hasActiveSessions && (
                <TabsTrigger value="sessions" className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Sessions
                  {sessions.filter(s => s.status === 'upcoming').length > 0 && (
                    <span className="ml-1 bg-blue-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
                      {sessions.filter(s => s.status === 'upcoming').length}
                    </span>
                  )}
                </TabsTrigger>
              )}
              {isMentor && (
                <TabsTrigger value="incoming" className="flex items-center gap-1.5">
                  <Inbox className="w-3.5 h-3.5" /> Incoming
                  {pendingIncoming.length > 0 && (
                    <span className="ml-1 bg-[#008060] text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
                      {pendingIncoming.length}
                    </span>
                  )}
                </TabsTrigger>
              )}
            </TabsList>

            {/* ── Discover tab ── */}
            <TabsContent value="discover" className="mt-4 space-y-4">

              {/* Goal input */}
              <div className="bg-white rounded-xl border shadow-sm p-4 space-y-3">
                <button
                  className="flex items-center justify-between w-full text-sm font-medium text-gray-700"
                  onClick={() => setGoalOpen(!goalOpen)}
                >
                  <span className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-[#008060]" /> What are you hoping to get from mentorship?</span>
                  {goalOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {goalOpen && (
                  <div className="space-y-2">
                    <Textarea
                      placeholder='e.g. "I want to transition into product management at a tech company…"'
                      value={goalText}
                      onChange={e => setGoalText(e.target.value)}
                      className="text-sm min-h-[72px]"
                    />
                    <Button onClick={handleFindMatches} variant="brand" size="sm" className="min-h-[36px]">
                      <Sparkles className="w-4 h-4 mr-1" /> Find Best Matches
                    </Button>
                  </div>
                )}
              </div>

              {/* Search + Filters + sort */}
              <div className="space-y-3">
                {/* Search bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search by name, company, role…"
                    className="pl-9 min-h-[40px]"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <Select value={expertiseFilter} onValueChange={setExpertiseFilter}>
                      <SelectTrigger className="w-48 min-h-[40px]">
                        <SelectValue placeholder="Filter by expertise" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Areas</SelectItem>
                        {availableExpertise.map(e => (
                          <SelectItem key={e} value={e.toLowerCase()}>{e}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">Sort:</span>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="w-44 min-h-[40px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="match">Best Match</SelectItem>
                        <SelectItem value="available">Most Available</SelectItem>
                        <SelectItem value="rating">Top Rated</SelectItem>
                        <SelectItem value="newest">Newest Members</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Interest area chips */}
                {availableInterests.length > 0 && (
                  <div className="bg-white rounded-xl border shadow-sm p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-3.5 h-3.5 text-[#008060]" />
                      <span className="text-xs font-medium text-gray-600">Filter by interest area</span>
                      {interestFilter.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setInterestFilter([])}
                          className="ml-auto text-xs text-gray-400 hover:text-red-500"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {availableInterests.map(interest => {
                        const selected = interestFilter.includes(interest);
                        return (
                          <button
                            key={interest}
                            type="button"
                            onClick={() => setInterestFilter(prev =>
                              prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest]
                            )}
                            className={[
                              'px-2.5 py-0.5 rounded-full text-xs border transition-colors',
                              selected
                                ? 'bg-[#008060] text-white border-[#008060]'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-[#008060] hover:text-[#008060]',
                            ].join(' ')}
                          >
                            {interest}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {/* Day filter chips */}
                <div className="bg-white rounded-xl border shadow-sm p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-3.5 h-3.5 text-[#008060]" />
                    <span className="text-xs font-medium text-gray-600">Filter by available day</span>
                    {dayFilter.length > 0 && (
                      <button type="button" onClick={() => setDayFilter([])}
                        className="ml-auto text-xs text-[#008060] hover:underline">Clear</button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => {
                      const selected = dayFilter.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => setDayFilter(prev =>
                            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
                          )}
                          className={[
                            'px-2.5 py-0.5 rounded-full text-xs border transition-colors',
                            selected
                              ? 'bg-[#008060] text-white border-[#008060]'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-[#008060] hover:text-[#008060]',
                          ].join(' ')}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Mentor grid */}
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                  {[0, 1, 2].map(i => <SkeletonCard key={i} />)}
                </div>
              ) : sortedMentors.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="font-medium">No mentors found</p>
                  <p className="text-sm mt-1">Try a different filter or search term.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                  {sortedMentors.map(renderMentorCard)}
                </div>
              )}
            </TabsContent>

            {/* ── Saved tab ── */}
            <TabsContent value="saved" className="mt-4">
              {savedMentors.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Bookmark className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                  <p>No saved mentors yet.</p>
                  <p className="text-sm mt-1">Bookmark mentors in the Discover tab to save them here.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                  {savedMentors.map(renderMentorCard)}
                </div>
              )}
            </TabsContent>

            {/* ── My Requests tab ── */}
            <TabsContent value="my-requests" className="mt-4">
              {renderMyRequests()}
            </TabsContent>

            {/* ── Sessions tab ── */}
            {hasActiveSessions && (
              <TabsContent value="sessions" className="mt-4">
                {renderSessions()}
              </TabsContent>
            )}

            {/* ── Incoming tab (mentor only) ── */}
            {isMentor && (
              <TabsContent value="incoming" className="mt-4">
                {renderIncoming()}
              </TabsContent>
            )}
          </Tabs>

        </div>
      </div>

      {/* ── Schedule Session Modal ── */}
      {scheduleModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="font-semibold text-lg">Schedule Session with {scheduleModal.otherName}</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Date & Time</label>
                <Input
                  type="datetime-local"
                  value={newSession.scheduledAt}
                  min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                  onChange={e => setNewSession(p => ({ ...p, scheduledAt: e.target.value }))}
                  className="text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Duration (minutes)</label>
                <Select
                  value={String(newSession.durationMinutes)}
                  onValueChange={v => setNewSession(p => ({ ...p, durationMinutes: parseInt(v) }))}
                >
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 min</SelectItem>
                    <SelectItem value="45">45 min</SelectItem>
                    <SelectItem value="60">60 min</SelectItem>
                    <SelectItem value="90">90 min</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">
                  Meet Link <span className="text-red-500">*</span>
                  <span className="ml-1 text-gray-400">(Google Meet, Zoom, Teams, Jitsi, Webex…)</span>
                </label>
                <Input
                  type="url"
                  value={newSession.meetLink}
                  onChange={e => setNewSession(p => ({ ...p, meetLink: e.target.value }))}
                  placeholder="https://meet.google.com/abc-defg-hij"
                  className="text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Agenda (optional)</label>
                <Textarea
                  value={newSession.agenda}
                  onChange={e => setNewSession(p => ({ ...p, agenda: e.target.value }))}
                  placeholder="Topics to cover, questions to ask…"
                  className="text-sm min-h-[64px]"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => createSession()} variant="brand" className="flex-1" disabled={!newSession.scheduledAt || !newSession.meetLink || !isValidMeetLink(newSession.meetLink)}>
                <CalendarPlus className="w-4 h-4 mr-2" /> Schedule
              </Button>
              <Button variant="ghost" onClick={() => setScheduleModal(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Review Modal ── */}
      {reviewModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="font-semibold text-lg">Review {reviewModal.reviewedName}</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-600 mb-2 block">Rating</label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setReviewInput(p => ({ ...p, rating: n }))}
                    >
                      <Star className={`w-7 h-7 transition-colors ${n <= reviewInput.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
                    </button>
                  ))}
                  <span className="ml-2 text-sm text-gray-600">{reviewInput.rating}/5</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Comment (optional)</label>
                <Textarea
                  value={reviewInput.comment}
                  onChange={e => setReviewInput(p => ({ ...p, comment: e.target.value }))}
                  placeholder="Share your experience…"
                  className="text-sm min-h-[80px]"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={submitReview} variant="brand" className="flex-1">
                <Star className="w-4 h-4 mr-2" /> Submit Review
              </Button>
              <Button variant="ghost" onClick={() => setReviewModal(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── End Relationship Confirm ── */}
      {endConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <h2 className="font-semibold text-lg">End Relationship?</h2>
            </div>
            <p className="text-sm text-gray-600">This will permanently end the mentorship relationship. Both parties will be notified.</p>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => handleEndRelationship(endConfirm)}
              >
                Yes, End It
              </Button>
              <Button variant="ghost" onClick={() => setEndConfirm(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

    </AppLayout>
  );
};
