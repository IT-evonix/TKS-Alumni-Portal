import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeading } from '@/components/common/PageHeading';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Users, MessageSquare, Filter, Search, CheckCircle,
  XCircle, Clock, Sparkles, ChevronDown, ChevronUp,
  UserCheck, Inbox,
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
}

interface MentorshipRequest {
  id: string;
  mentee_id: string;
  mentor_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  goal_text?: string;
  message?: string;
  match_score?: number;
  created_at: string;
  mentor?: { first_name: string; last_name: string; profile_picture?: string; current_role?: string; current_company?: string };
  mentee?: { first_name: string; last_name: string; profile_picture?: string; current_role?: string; graduation_year?: number };
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
  return <Badge className="bg-yellow-100 text-yellow-700 border-0"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
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
  const [interestFilter, setInterestFilter] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('match');
  const [goalText, setGoalText] = useState('');
  const [goalOpen, setGoalOpen] = useState(false);
  const [pendingMentorIds, setPendingMentorIds] = useState<Set<string>>(new Set());
  const [myRequests, setMyRequests] = useState<MentorshipRequest[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<MentorshipRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestMessage, setRequestMessage] = useState('');
  const [activeRequestModal, setActiveRequestModal] = useState<string | null>(null);
  const [expandedBreakdown, setExpandedBreakdown] = useState<string | null>(null);

  const headers = { 'user-id': user?.id || '' };

  // ── Fetch helpers ───────────────────────────────────────────────────────────

  const fetchMyStatus = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch('/api/mentorship/my-status', { headers });
      if (res.ok) {
        const data = await res.json();
        setIsMentor(!!data.is_mentor);
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
        setMentors(data.mentors || []);
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

  useEffect(() => { fetchMyStatus(); fetchMyRequests(); }, [fetchMyStatus, fetchMyRequests]);
  useEffect(() => { fetchMentors(); }, [expertiseFilter, interestFilter]);
  useEffect(() => { if (isMentor) fetchIncoming(); }, [isMentor, fetchIncoming]);

  // Fetch distinct interest tags from active mentors once on mount
  useEffect(() => {
    fetch('/api/mentorship/available-interests')
      .then(r => r.ok ? r.json() : { interests: [] })
      .then(d => setAvailableInterests(d.interests || []))
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
        toast({ title: 'Request sent!', description: 'Your mentorship request has been sent.' });
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'Failed to send request', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to send request', variant: 'destructive' });
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
        setIncomingRequests(prev => prev.filter(r => r.id !== requestId));
        toast({ title: status === 'accepted' ? 'Accepted!' : 'Declined', description: `Mentorship request ${status}.` });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to respond', variant: 'destructive' });
    }
  };

  // ── Sorted mentor list ───────────────────────────────────────────────────────

  const sortedMentors = [...mentors].sort((a, b) => {
    if (sortBy === 'match') return (b.match_score || 0) - (a.match_score || 0);
    if (sortBy === 'available') {
      const aSlots = (a.max_mentees || 3) - (a.mentee_count || 0);
      const bSlots = (b.max_mentees || 3) - (b.mentee_count || 0);
      return bSlots - aSlots;
    }
    return 0; // newest: already sorted by server
  });

  // ── Render helpers ──────────────────────────────────────────────────────────

  const renderMentorCard = (mentor: Mentor) => {
    const isPending = pendingMentorIds.has(mentor.user_id);
    const slots = (mentor.max_mentees ?? 3) - (mentor.mentee_count ?? 0);
    const isFull = mentor.mentor_available === false || slots <= 0;
    const skills = mentor.alumni_skills?.filter(s => s.is_primary).slice(0, 3)
      ?? [];
    const expertiseTags: string[] = (() => {
      try {
        const raw = mentor.expertise_areas;
        if (!raw) return [];
        return JSON.parse(raw);
      } catch { return (mentor.expertise_areas || '').split(',').map(s => s.trim()).filter(Boolean); }
    })().slice(0, 3);

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
              <CardTitle className="text-base sm:text-lg truncate">
                {mentor.first_name} {mentor.last_name}
                {mentor.graduation_year && (
                  <span className="ml-2 text-xs font-normal text-gray-400">'{String(mentor.graduation_year).slice(-2)}</span>
                )}
              </CardTitle>
              <p className="text-xs sm:text-sm text-gray-600 truncate">{mentor.current_role}</p>
              <p className="text-xs text-gray-500 truncate">{mentor.current_company}</p>
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
          <div className="flex items-center justify-between text-xs">
            {isFull ? (
              <span className="text-red-500 font-medium">Full — not accepting mentees</span>
            ) : (
              <span className="text-green-600 font-medium">Available · {slots} slot{slots !== 1 ? 's' : ''}</span>
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
              <StatusBadge status={req.status} />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderIncoming = () => {
    if (!incomingRequests.length) return (
      <div className="text-center py-12 text-gray-500">
        <Inbox className="w-10 h-10 mx-auto mb-3 text-gray-300" />
        <p>No pending mentorship requests.</p>
      </div>
    );
    return (
      <div className="space-y-3">
        {incomingRequests.map(req => (
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
                  <p className="text-xs text-gray-700 mt-1 bg-gray-50 rounded px-2 py-1 italic">
                    "{req.goal_text}"
                  </p>
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
    );
  };

  // ── Page ────────────────────────────────────────────────────────────────────

  return (
    <AppLayout currentPage="mentorship">
      <div className="min-h-screen bg-gray-50 p-3 sm:p-4 lg:p-6">
        <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">

          {/* Mobile back */}
          <Button variant="ghost" size="sm" className="lg:hidden flex items-center gap-2 text-gray-600 hover:text-[#008060] mb-2 min-h-[44px]"
            onClick={() => window.history.back()} aria-label="Go back">
            <span className="text-xl">←</span><span>Back</span>
          </Button>

          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <PageHeading firstWord="Alumni" secondWord="Mentorship" className="mb-0" />
              <p className="text-sm sm:text-base text-gray-600 mt-1">AI-powered mentor matching for your career goals</p>
            </div>
            <Button onClick={toggleMentorStatus} variant={isMentor ? 'destructive' : 'brand'}
              className="w-full sm:w-auto min-h-[44px] text-sm sm:text-base">
              <Users className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">{isMentor ? 'Disable Mentor Status' : 'Become a Mentor'}</span>
              <span className="sm:hidden">{isMentor ? 'Disable' : 'Become Mentor'}</span>
            </Button>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="discover">
            <TabsList className="bg-gray-100">
              <TabsTrigger value="discover" className="flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5" /> Discover
              </TabsTrigger>
              <TabsTrigger value="my-requests" className="flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5" /> My Requests
                {myRequests.filter(r => r.status === 'pending').length > 0 && (
                  <span className="ml-1 bg-yellow-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
                    {myRequests.filter(r => r.status === 'pending').length}
                  </span>
                )}
              </TabsTrigger>
              {isMentor && (
                <TabsTrigger value="incoming" className="flex items-center gap-1.5">
                  <Inbox className="w-3.5 h-3.5" /> Incoming
                  {incomingRequests.length > 0 && (
                    <span className="ml-1 bg-[#008060] text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
                      {incomingRequests.length}
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

              {/* Filters + sort */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <Select value={expertiseFilter} onValueChange={setExpertiseFilter}>
                      <SelectTrigger className="w-48 min-h-[40px]">
                        <SelectValue placeholder="Filter by expertise" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Areas</SelectItem>
                        <SelectItem value="technology">Technology</SelectItem>
                        <SelectItem value="business">Business</SelectItem>
                        <SelectItem value="finance">Finance</SelectItem>
                        <SelectItem value="healthcare">Healthcare</SelectItem>
                        <SelectItem value="education">Education</SelectItem>
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
                        <SelectItem value="newest">Newest Members</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Interest area chips — only tags that real mentors have */}
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
                              prev.includes(interest)
                                ? prev.filter(i => i !== interest)
                                : [...prev, interest]
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
              </div>

              {/* Mentor grid */}
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {[0, 1, 2].map(i => <SkeletonCard key={i} />)}
                </div>
              ) : sortedMentors.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="font-medium">No mentors found</p>
                  <p className="text-sm mt-1">Try a different expertise filter or check back later.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {sortedMentors.map(renderMentorCard)}
                </div>
              )}
            </TabsContent>

            {/* ── My Requests tab ── */}
            <TabsContent value="my-requests" className="mt-4">
              {renderMyRequests()}
            </TabsContent>

            {/* ── Incoming tab (mentor only) ── */}
            {isMentor && (
              <TabsContent value="incoming" className="mt-4">
                {renderIncoming()}
              </TabsContent>
            )}
          </Tabs>

        </div>
      </div>
    </AppLayout>
  );
};
