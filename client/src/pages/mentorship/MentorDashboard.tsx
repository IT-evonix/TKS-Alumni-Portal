import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeading } from '@/components/common/PageHeading';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Users, CheckCircle, XCircle, Clock, Sparkles,
  ChevronDown, ChevronUp, Inbox, Star,
  CalendarPlus, Calendar, AlertTriangle,
  BookOpen, MessageSquare, Github, Globe, Twitter, X as XIcon,
  CheckSquare,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { MentorshipRequest, MentorshipSession } from './mentorship-types';
import { SkeletonCard, isValidMeetLink, isValidMeetingLink } from './mentorship-components';

function toLocalDatetimeValue(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export const MentorDashboard = (): JSX.Element => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [statusChecked, setStatusChecked] = useState(false);
  const [isMentor, setIsMentor] = useState(false);

  const [incomingRequests, setIncomingRequests] = useState<MentorshipRequest[]>([]);
  const [sessions, setSessions] = useState<MentorshipSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  type ScheduleModal =
    | { mode: 'single'; requestId: string; otherName: string }
    | { mode: 'bulk'; requestIds: string[]; menteeNames: string[] };
  const [scheduleModal, setScheduleModal] = useState<ScheduleModal | null>(null);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedRequestIds, setSelectedRequestIds] = useState<Set<string>>(new Set());
  const [bulkScheduling, setBulkScheduling] = useState(false);
  const [newSession, setNewSession] = useState({ scheduledAt: '', durationMinutes: 60, agenda: '', meetLink: '' });
  const [availOpen, setAvailOpen] = useState(false);
  const [availSettings, setAvailSettings] = useState({
    available_days: '',
    session_type: 'video',
    meeting_link: '',
    max_mentees: 3,
    mentorship_style: 'flexible' as 'structured' | 'ad_hoc' | 'accountability' | 'flexible',
    help_topics: '[]',
    github_url: '',
    portfolio_url: '',
    twitter_url: '',
  });
  const [helpTopicInput, setHelpTopicInput] = useState('');
  const [reviewModal, setReviewModal] = useState<{ sessionId: string; reviewedId: string; reviewedName: string } | null>(null);
  const [reviewInput, setReviewInput] = useState({ rating: 5, comment: '' });
  const [endConfirm, setEndConfirm] = useState<string | null>(null);
  const [disabling, setDisabling] = useState(false);
  const [schedulingSession, setSchedulingSession] = useState(false);
  const [editModal, setEditModal] = useState<{ sessionId: string; scheduledAt: string; meetLink: string; agenda: string } | null>(null);
  const [editFields, setEditFields] = useState({ scheduledAt: '', meetLink: '', agenda: '' });
  const [cancelDialogSession, setCancelDialogSession] = useState<string | null>(null);
  const [cancelRemark, setCancelRemark] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const headers = { 'user-id': user?.id || '' };

  // On mount: verify user is actually a mentor
  useEffect(() => {
    if (!user?.id) return;
    fetch('/api/mentorship/my-status', { headers })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.is_mentor) {
          setLocation('/mentorship/mentee');
        } else {
          setIsMentor(true);
          setAvailSettings({
            available_days: data.available_days || '',
            session_type: data.session_type || 'video',
            meeting_link: data.meeting_link || '',
            max_mentees: data.max_mentees ?? 3,
            mentorship_style: data.mentorship_style || 'flexible',
            help_topics: data.help_topics || '[]',
            github_url: data.github_url || '',
            portfolio_url: data.portfolio_url || '',
            twitter_url: data.twitter_url || '',
          });
          setStatusChecked(true);
        }
      })
      .catch(() => setLocation('/mentorship/mentee'));
  }, [user?.id]);

  const fetchIncoming = useCallback(async (signal?: AbortSignal) => {
    if (!user?.id) return;
    try {
      const res = await fetch('/api/mentorship/incoming', { headers, signal });
      if (!res.ok || res.bodyUsed) return;
      const data = await res.json();
      setIncomingRequests(data.requests || []);
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      toast({ title: 'Error', description: 'Failed to load incoming requests.', variant: 'destructive' });
    }
  }, [user?.id]);

  const fetchSessions = useCallback(async (signal?: AbortSignal) => {
    if (!user?.id) return;
    setSessionsLoading(true);
    try {
      const res = await fetch('/api/mentorship/sessions', { headers, signal });
      if (!res.ok || res.bodyUsed) return;
      const data = await res.json();
      // Only mentor-side sessions
      setSessions((data.sessions || []).filter((s: MentorshipSession) => s.myRole === 'mentor'));
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      toast({ title: 'Error', description: 'Failed to load sessions.', variant: 'destructive' });
    } finally {
      setSessionsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (isMentor && user?.id) {
      const controller = new AbortController();
      fetchIncoming(controller.signal);
      fetchSessions(controller.signal);
      return () => controller.abort();
    }
  }, [isMentor, user?.id, fetchIncoming, fetchSessions]);

  // ── Actions ─────────────────────────────────────────────────────────────────

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

  const handleEndRelationship = async (requestId: string) => {
    try {
      const res = await fetch(`/api/mentorship/request/${requestId}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'user-id': user?.id || '' },
      });
      if (res.ok) {
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

  const saveAvailability = async () => {
    const selectedDays = (availSettings.available_days || '').split(',').map(d => d.trim()).filter(Boolean);
    if (selectedDays.length === 0) {
      toast({ title: 'No days selected', description: 'Please select at least one available day.', variant: 'destructive' });
      return;
    }
    if (availSettings.meeting_link && !isValidMeetingLink(availSettings.meeting_link)) {
      toast({ title: 'Invalid link', description: 'Please enter a valid Calendly, Google Meet, Zoom, Teams, or other supported meeting link.', variant: 'destructive' });
      return;
    }
    try {
      const res = await fetch('/api/mentorship/my-availability', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'user-id': user?.id || '' },
        body: JSON.stringify(availSettings),
      });
      if (res.ok) {
        setAvailOpen(false);
        toast({ title: 'Saved', description: 'Availability settings updated.' });
      } else {
        const data = await res.json().catch(() => ({}));
        toast({ title: 'Error saving', description: data?.error || 'Failed to save availability', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save availability', variant: 'destructive' });
    }
  };

  const handleDisableMentor = async () => {
    setDisabling(true);
    try {
      const res = await fetch('/api/mentorship/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'user-id': user?.id || '' },
        body: JSON.stringify({ isMentor: false }),
      });
      if (res.ok) {
        toast({ title: 'Mentor status disabled', description: 'Redirecting to mentee dashboard.' });
        setLocation('/mentorship/mentee');
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'Failed to update', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to update mentor status', variant: 'destructive' });
    } finally {
      setDisabling(false);
    }
  };

  const toggleMenteeSelection = (requestId: string) => {
    setSelectedRequestIds(prev => {
      const next = new Set(prev);
      if (next.has(requestId)) next.delete(requestId);
      else if (next.size < 20) next.add(requestId);
      return next;
    });
  };

  const createSession = async () => {
    if (!scheduleModal || !newSession.scheduledAt) return;
    if (new Date(newSession.scheduledAt) <= new Date()) {
      toast({ title: 'Invalid time', description: 'Please select a future date and time.', variant: 'destructive' });
      return;
    }
    if (!newSession.meetLink || !isValidMeetLink(newSession.meetLink)) {
      toast({ title: 'Invalid meet link', description: 'Please enter a valid link from a supported platform.', variant: 'destructive' });
      return;
    }

    if (scheduleModal.mode === 'single') {
      setSchedulingSession(true);
      try {
        const res = await fetch('/api/mentorship/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'user-id': user?.id || '' },
          body: JSON.stringify({
            requestId: scheduleModal.requestId,
            scheduledAt: new Date(newSession.scheduledAt).toISOString(),
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
      } finally {
        setSchedulingSession(false);
      }
    } else {
      // bulk mode
      setBulkScheduling(true);
      try {
        const res = await fetch('/api/mentorship/sessions/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'user-id': user?.id || '' },
          body: JSON.stringify({
            requestIds: scheduleModal.requestIds,
            scheduledAt: new Date(newSession.scheduledAt).toISOString(),
            durationMinutes: newSession.durationMinutes,
            agenda: newSession.agenda || undefined,
            meetLink: newSession.meetLink || undefined,
          }),
        });
        const data = await res.json();
        if (res.ok || res.status === 207) {
          const { succeeded = [], failed = [] } = data;
          setScheduleModal(null);
          setNewSession({ scheduledAt: '', durationMinutes: 60, agenda: '', meetLink: '' });
          setSelectedRequestIds(new Set());
          setMultiSelectMode(false);
          fetchSessions();
          if (failed.length === 0) {
            toast({ title: 'Sessions scheduled!', description: `${succeeded.length} session${succeeded.length > 1 ? 's' : ''} created.` });
          } else {
            toast({ title: 'Partial success', description: `${succeeded.length} scheduled, ${failed.length} failed — check Sessions tab.`, variant: 'destructive' });
          }
        } else {
          toast({ title: 'Error', description: data.error || 'Failed to schedule sessions', variant: 'destructive' });
        }
      } catch {
        toast({ title: 'Error', description: 'Failed to schedule sessions', variant: 'destructive' });
      } finally {
        setBulkScheduling(false);
      }
    }
  };

  const updateSessionStatus = async (sessionId: string, status: 'completed' | 'cancelled', reason?: string) => {
    try {
      const body: Record<string, any> = { status };
      if (reason) body.cancellationReason = reason;
      const res = await fetch(`/api/mentorship/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'user-id': user?.id || '' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        fetchSessions();
        toast({ title: status === 'completed' ? 'Marked complete' : 'Cancelled', description: `Session ${status}.` });
      } else {
        const data = await res.json().catch(() => ({}));
        toast({ title: 'Error', description: data.error || 'Failed to update session.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to update session. Please try again.', variant: 'destructive' });
    }
    if (status === 'cancelled') {
      setCancelDialogSession(null);
      setCancelRemark('');
    }
  };

  const rescheduleSession = async () => {
    if (!editModal) return;
    if (!editFields.scheduledAt) {
      toast({ title: 'Date required', description: 'Please select a new date and time.', variant: 'destructive' });
      return;
    }
    if (new Date(editFields.scheduledAt) <= new Date()) {
      toast({ title: 'Invalid time', description: 'Please select a future date and time.', variant: 'destructive' });
      return;
    }
    if (editFields.meetLink && !isValidMeetLink(editFields.meetLink)) {
      toast({ title: 'Invalid meet link', description: 'Please enter a valid link from a supported platform.', variant: 'destructive' });
      return;
    }
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/mentorship/sessions/${editModal.sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'user-id': user?.id || '' },
        body: JSON.stringify({
          scheduledAt: new Date(editFields.scheduledAt).toISOString(),
          meetLink: editFields.meetLink || undefined,
          agenda: editFields.agenda || undefined,
        }),
      });
      if (res.ok) {
        setEditModal(null);
        fetchSessions();
        toast({ title: 'Session updated!', description: 'The session details have been updated.' });
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'Failed to update session', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to update session', variant: 'destructive' });
    } finally {
      setSavingEdit(false);
    }
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
        toast({ title: 'Review submitted!' });
        fetchSessions();
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'Failed to submit review', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to submit review', variant: 'destructive' });
    }
  };

  // ── Derived ──────────────────────────────────────────────────────────────────

  const pendingIncoming = incomingRequests.filter(r => r.status === 'pending');
  const activeMentees = incomingRequests.filter(r => r.status === 'accepted');

  // ── Render ───────────────────────────────────────────────────────────────────

  if (!statusChecked) {
    return (
      <AppLayout currentPage="mentorship">
        <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
          <div className="space-y-3 w-full max-w-md">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      </AppLayout>
    );
  }

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
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" /> Active Mentees
            {activeMentees.length > 0 && (
              <span className="bg-green-100 text-green-700 text-xs rounded-full px-2 py-0.5">{activeMentees.length}</span>
            )}
          </h3>
          {activeMentees.length > 1 && (
            <Button size="sm" variant="ghost" className="text-xs h-7 gap-1 text-gray-600"
              onClick={() => { setMultiSelectMode(m => !m); setSelectedRequestIds(new Set()); }}>
              {multiSelectMode ? <><XIcon className="w-3 h-3" /> Done</> : <><CheckSquare className="w-3 h-3" /> Select Multiple</>}
            </Button>
          )}
        </div>
        {activeMentees.length === 0 ? (
          <p className="text-sm text-gray-500">No active mentees yet.</p>
        ) : (
          <div className="space-y-3">
            {activeMentees.map(req => {
              const isSelected = selectedRequestIds.has(req.id);
              const atMax = selectedRequestIds.size >= 20 && !isSelected;
              return (
                <Card key={req.id}
                  className={`border shadow-sm bg-green-50/30 transition-colors ${multiSelectMode ? 'cursor-pointer hover:bg-green-50/60' : ''} ${isSelected ? 'ring-2 ring-[#008060]' : ''}`}
                  onClick={multiSelectMode && !atMax ? () => toggleMenteeSelection(req.id) : undefined}>
                  <CardContent className="p-4 flex items-center gap-4">
                    {multiSelectMode && (
                      <Checkbox
                        checked={isSelected}
                        disabled={atMax}
                        onCheckedChange={() => !atMax && toggleMenteeSelection(req.id)}
                        onClick={e => e.stopPropagation()}
                        className="flex-shrink-0"
                        title={atMax ? 'Maximum 20 mentees' : undefined}
                      />
                    )}
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
                    {!multiSelectMode && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="text-xs min-h-[32px]"
                          onClick={() => setScheduleModal({ mode: 'single', requestId: req.id, otherName: `${req.mentee?.first_name} ${req.mentee?.last_name}` })}>
                          <CalendarPlus className="w-3 h-3 mr-1" /> Schedule
                        </Button>
                        <Button size="sm" variant="outline"
                          className="text-xs text-red-600 border-red-100 hover:bg-red-50 min-h-[32px]"
                          onClick={() => setEndConfirm(req.id)}>
                          End
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Floating bulk schedule bar */}
        {multiSelectMode && selectedRequestIds.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-4 bg-white border shadow-xl rounded-full px-6 py-3">
            <span className="text-sm font-medium text-gray-700">
              {selectedRequestIds.size} mentee{selectedRequestIds.size > 1 ? 's' : ''} selected
            </span>
            <Button size="sm" className="bg-[#008060] hover:bg-[#006b50] text-white rounded-full gap-1"
              onClick={() => {
                const selected = activeMentees.filter(r => selectedRequestIds.has(r.id));
                setScheduleModal({
                  mode: 'bulk',
                  requestIds: selected.map(r => r.id),
                  menteeNames: selected.map(r => `${r.mentee?.first_name} ${r.mentee?.last_name}`),
                });
              }}>
              <CalendarPlus className="w-3 h-3" /> Schedule for Selected
            </Button>
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
        <p className="text-sm mt-1">Accept a mentorship request and schedule a session with your mentee.</p>
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
                <AvatarFallback className="bg-gray-400 text-white text-xs">
                  {s.other?.first_name?.[0]}{s.other?.last_name?.[0]}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-sm">{s.other?.first_name} {s.other?.last_name}</p>
                <p className="text-xs text-gray-500">Mentee</p>
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
          {s.status === 'upcoming' && (
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="brand" className="text-xs min-h-[30px]"
                onClick={() => updateSessionStatus(s.id, 'completed')}>
                <CheckCircle className="w-3 h-3 mr-1" /> Mark Complete
              </Button>
              <Button size="sm" variant="outline" className="text-xs min-h-[30px]"
                onClick={() => {
                  setEditModal({ sessionId: s.id, scheduledAt: s.scheduled_at, meetLink: s.meet_link || '', agenda: s.agenda || '' });
                  setEditFields({ scheduledAt: s.scheduled_at ? toLocalDatetimeValue(new Date(s.scheduled_at)) : '', meetLink: s.meet_link || '', agenda: s.agenda || '' });
                }}>
                <CalendarPlus className="w-3 h-3 mr-1" /> Edit / Reschedule
              </Button>
              <Button size="sm" variant="outline" className="text-xs text-red-600 border-red-100 min-h-[30px]"
                onClick={() => setCancelDialogSession(s.id)}>
                <XCircle className="w-3 h-3 mr-1" /> Cancel
              </Button>
            </div>
          )}
          {s.status === 'completed' && (
            <Button size="sm" variant="outline" className="text-xs min-h-[30px]"
              onClick={() => setReviewModal({ sessionId: s.id, reviewedId: s.mentee_id, reviewedName: `${s.other?.first_name} ${s.other?.last_name}` })}>
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

  return (
    <AppLayout currentPage="mentorship">
      <div className="min-h-screen bg-gray-50 p-3 sm:p-4 lg:p-6">
        <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">

          <Button variant="ghost" size="sm" className="lg:hidden flex items-center gap-2 text-gray-600 hover:text-[#008060] mb-2 min-h-[44px]"
            onClick={() => window.history.back()} aria-label="Go back">
            <span className="text-xl">←</span><span>Back</span>
          </Button>

          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <PageHeading firstWord="Mentor" secondWord="Dashboard" className="mb-0" />
              <p className="text-sm sm:text-base text-gray-600 mt-1">Manage your mentees, sessions, and availability</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button variant="outline" size="sm" className="flex items-center gap-2 border-[#008060] text-[#008060] hover:bg-[#008060]/10 min-h-[44px]"
                onClick={() => setLocation('/mentorship/mentee')}>
                <BookOpen className="w-4 h-4" />
                Find a Mentor
              </Button>
              <Button onClick={handleDisableMentor} variant="destructive" disabled={disabling}
                className="w-full sm:w-auto min-h-[44px] text-sm sm:text-base">
                <Users className="w-4 h-4 mr-2" />
                {disabling ? 'Disabling…' : 'Disable Mentor Status'}
              </Button>
            </div>
          </div>

          {/* Availability settings panel */}
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
                          <button key={day} type="button"
                            onClick={() => {
                              const current = (availSettings.available_days || '').split(',').map(d => d.trim()).filter(Boolean);
                              const next = selected ? current.filter(d => d !== day) : [...current, day];
                              setAvailSettings(p => ({ ...p, available_days: next.join(',') }));
                            }}
                            className={[
                              'px-3 py-1.5 rounded-full text-xs border font-medium transition-colors',
                              selected ? 'bg-[#008060] text-white border-[#008060]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#008060] hover:text-[#008060]',
                            ].join(' ')}>
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
                    <Input value={availSettings.meeting_link}
                      onChange={e => setAvailSettings(p => ({ ...p, meeting_link: e.target.value }))}
                      placeholder="https://calendly.com/…"
                      className={`text-sm ${availSettings.meeting_link && !isValidMeetingLink(availSettings.meeting_link) ? 'border-red-400 focus-visible:ring-red-400' : ''}`} />
                    {availSettings.meeting_link && !isValidMeetingLink(availSettings.meeting_link) && (
                      <p className="text-xs text-red-500 mt-1">Enter a valid link (Calendly, Google Meet, Zoom, Teams, etc.)</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">Max Mentees</label>
                    <Input type="number" min={1} max={20} value={availSettings.max_mentees}
                      onChange={e => setAvailSettings(p => ({ ...p, max_mentees: parseInt(e.target.value) || 3 }))}
                      className="text-sm" />
                  </div>
                </div>
                {/* Mentorship Style */}
                <div className="pt-3 border-t">
                  <label className="text-xs text-gray-600 mb-1 block">Mentorship Style</label>
                  <Select value={availSettings.mentorship_style} onValueChange={v => setAvailSettings(p => ({ ...p, mentorship_style: v as any }))}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="structured"><span className="flex items-center gap-2"><BookOpen className="w-3.5 h-3.5" /> Structured curriculum</span></SelectItem>
                      <SelectItem value="ad_hoc"><span className="flex items-center gap-2"><MessageSquare className="w-3.5 h-3.5" /> Ad-hoc conversations</span></SelectItem>
                      <SelectItem value="accountability"><span className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5" /> Accountability partner</span></SelectItem>
                      <SelectItem value="flexible"><span className="flex items-center gap-2"><Sparkles className="w-3.5 h-3.5" /> Flexible / mix</span></SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Help Topics tag input */}
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">What I Can Help With (press Enter to add)</label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {(() => {
                      let topics: string[] = [];
                      try { topics = JSON.parse(availSettings.help_topics || '[]'); } catch { topics = []; }
                      return topics.map((t: string) => (
                        <Badge key={t} variant="secondary" className="bg-blue-50 text-blue-700 border border-blue-200 gap-1 pl-2 pr-1 py-0.5">
                          {t}
                          <button type="button" onClick={() => {
                            let ts: string[] = [];
                            try { ts = JSON.parse(availSettings.help_topics || '[]'); } catch { ts = []; }
                            setAvailSettings(p => ({ ...p, help_topics: JSON.stringify(ts.filter(x => x !== t)) }));
                          }} className="hover:text-red-500 ml-0.5"><XIcon className="w-3 h-3" /></button>
                        </Badge>
                      ));
                    })()}
                  </div>
                  <Input
                    value={helpTopicInput}
                    onChange={e => setHelpTopicInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        const val = helpTopicInput.trim().replace(/,$/, '');
                        if (!val) return;
                        let ts: string[] = [];
                        try { ts = JSON.parse(availSettings.help_topics || '[]'); } catch { ts = []; }
                        if (!ts.includes(val)) {
                          setAvailSettings(p => ({ ...p, help_topics: JSON.stringify([...ts, val]) }));
                        }
                        setHelpTopicInput('');
                      }
                    }}
                    placeholder="e.g. Interview prep, Startup fundraising…"
                    className="text-sm"
                  />
                </div>

                {/* Social Links */}
                <div>
                  <label className="text-xs text-gray-600 mb-2 block">Social Links</label>
                  <p className="text-xs text-gray-400 -mt-1">LinkedIn is pulled from your profile. Add your other links below.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="relative">
                      <Github className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <Input value={availSettings.github_url}
                        onChange={e => setAvailSettings(p => ({ ...p, github_url: e.target.value }))}
                        placeholder="GitHub URL" className="text-sm pl-8" />
                    </div>
                    <div className="relative">
                      <Globe className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <Input value={availSettings.portfolio_url}
                        onChange={e => setAvailSettings(p => ({ ...p, portfolio_url: e.target.value }))}
                        placeholder="Portfolio / Website URL" className="text-sm pl-8" />
                    </div>
                    <div className="relative">
                      <Twitter className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <Input value={availSettings.twitter_url}
                        onChange={e => setAvailSettings(p => ({ ...p, twitter_url: e.target.value }))}
                        placeholder="Twitter / X URL" className="text-sm pl-8" />
                    </div>
                  </div>
                </div>

                <Button onClick={saveAvailability} variant="brand" size="sm" className="min-h-[36px]"
                  disabled={!!(availSettings.meeting_link && !isValidMeetingLink(availSettings.meeting_link))}>
                  Save Availability
                </Button>
              </div>
            )}
          </div>

          {/* Tabs */}
          <Tabs defaultValue="incoming">
            <TabsList className="bg-gray-100 flex-wrap h-auto gap-1">
              <TabsTrigger value="incoming" className="flex items-center gap-1.5">
                <Inbox className="w-3.5 h-3.5" /> Incoming
                {pendingIncoming.length > 0 && (
                  <span className="ml-1 bg-[#008060] text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
                    {pendingIncoming.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="sessions" className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Sessions
                {sessions.filter(s => s.status === 'upcoming').length > 0 && (
                  <span className="ml-1 bg-blue-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
                    {sessions.filter(s => s.status === 'upcoming').length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="incoming" className="mt-4">
              {renderIncoming()}
            </TabsContent>

            <TabsContent value="sessions" className="mt-4">
              {renderSessions()}
            </TabsContent>
          </Tabs>

        </div>
      </div>

      {/* Schedule Session Modal */}
      {scheduleModal && (
        <div className="fixed inset-0 bg-black/40 z-[150] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div>
              <h2 className="font-semibold text-lg">
                {scheduleModal.mode === 'single'
                  ? `Schedule Session with ${scheduleModal.otherName}`
                  : `Schedule Session for ${scheduleModal.requestIds.length} Mentee${scheduleModal.requestIds.length > 1 ? 's' : ''}`}
              </h2>
              {scheduleModal.mode === 'bulk' && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {scheduleModal.menteeNames.map(name => (
                    <span key={name} className="inline-flex items-center bg-green-100 text-green-800 text-xs rounded-full px-2 py-0.5">{name}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-3">
              <div>
                <label htmlFor="mentor-session-date" className="text-xs text-gray-600 mb-1 block">Date & Time</label>
                <Input id="mentor-session-date" type="datetime-local" value={newSession.scheduledAt}
                  min={toLocalDatetimeValue(new Date(Date.now() + 60000))}
                  onChange={e => setNewSession(p => ({ ...p, scheduledAt: e.target.value }))}
                  className="text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Duration (minutes)</label>
                <Select value={String(newSession.durationMinutes)}
                  onValueChange={v => setNewSession(p => ({ ...p, durationMinutes: parseInt(v) }))}>
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
                <label htmlFor="mentor-session-meetlink" className="text-xs text-gray-600 mb-1 block">
                  Meet Link <span className="text-red-500">*</span>
                  <span className="ml-1 text-gray-400">(Google Meet, Zoom, Teams, Jitsi, Webex…)</span>
                </label>
                <Input id="mentor-session-meetlink" type="url" value={newSession.meetLink}
                  onChange={e => setNewSession(p => ({ ...p, meetLink: e.target.value }))}
                  placeholder="https://meet.google.com/abc-defg-hij" className="text-sm" />
              </div>
              <div>
                <label htmlFor="mentor-session-agenda" className="text-xs text-gray-600 mb-1 block">Agenda (optional)</label>
                <Textarea id="mentor-session-agenda" value={newSession.agenda}
                  onChange={e => setNewSession(p => ({ ...p, agenda: e.target.value }))}
                  placeholder="Topics to cover…" className="text-sm min-h-[64px]" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={createSession} variant="brand" className="flex-1"
                disabled={schedulingSession || bulkScheduling || !newSession.scheduledAt || !newSession.meetLink || !isValidMeetLink(newSession.meetLink)}>
                <CalendarPlus className="w-4 h-4 mr-2" />
                {(schedulingSession || bulkScheduling) ? 'Scheduling…' : 'Schedule'}
              </Button>
              <Button variant="ghost" disabled={schedulingSession || bulkScheduling} onClick={() => setScheduleModal(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewModal && (
        <div className="fixed inset-0 bg-black/40 z-[150] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="font-semibold text-lg">Review {reviewModal.reviewedName}</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-600 mb-2 block">Rating</label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} type="button" onClick={() => setReviewInput(p => ({ ...p, rating: n }))}>
                      <Star className={`w-7 h-7 transition-colors ${n <= reviewInput.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
                    </button>
                  ))}
                  <span className="ml-2 text-sm text-gray-600">{reviewInput.rating}/5</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Comment (optional)</label>
                <Textarea value={reviewInput.comment}
                  onChange={e => setReviewInput(p => ({ ...p, comment: e.target.value }))}
                  placeholder="Share your experience…" className="text-sm min-h-[80px]" />
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

      {/* Edit / Reschedule Session Modal */}
      {editModal && (
        <div className="fixed inset-0 bg-black/40 z-[150] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="font-semibold text-lg">Edit / Reschedule Session</h2>
            <div className="space-y-3">
              <div>
                <label htmlFor="edit-session-date" className="text-xs text-gray-600 mb-1 block">Date & Time <span className="text-red-500">*</span></label>
                <Input id="edit-session-date" type="datetime-local" value={editFields.scheduledAt}
                  min={toLocalDatetimeValue(new Date(Date.now() + 60000))}
                  onChange={e => setEditFields(p => ({ ...p, scheduledAt: e.target.value }))}
                  className="text-sm" />
              </div>
              <div>
                <label htmlFor="edit-session-meetlink" className="text-xs text-gray-600 mb-1 block">
                  Meet Link
                  <span className="ml-1 text-gray-400">(Google Meet, Zoom, Teams, Jitsi, Webex…)</span>
                </label>
                <Input id="edit-session-meetlink" type="url" value={editFields.meetLink}
                  onChange={e => setEditFields(p => ({ ...p, meetLink: e.target.value }))}
                  placeholder="https://meet.google.com/abc-defg-hij" className="text-sm" />
              </div>
              <div>
                <label htmlFor="edit-session-agenda" className="text-xs text-gray-600 mb-1 block">Agenda (optional)</label>
                <Textarea id="edit-session-agenda" value={editFields.agenda}
                  onChange={e => setEditFields(p => ({ ...p, agenda: e.target.value }))}
                  placeholder="Topics to cover…" className="text-sm min-h-[64px]" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={rescheduleSession} variant="brand" className="flex-1"
                disabled={savingEdit || !editFields.scheduledAt}>
                <CalendarPlus className="w-4 h-4 mr-2" /> {savingEdit ? 'Saving…' : 'Save Changes'}
              </Button>
              <Button variant="ghost" onClick={() => setEditModal(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Session Dialog */}
      {cancelDialogSession && (
        <div className="fixed inset-0 bg-black/40 z-[150] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <XCircle className="w-5 h-5 flex-shrink-0" />
              <h2 className="font-semibold text-lg">Cancel Session</h2>
            </div>
            <p className="text-sm text-gray-600">Please provide a reason for cancellation. This will be shared with the mentee.</p>
            <div>
              <label htmlFor="cancel-remark" className="text-xs text-gray-600 mb-1 block">
                Reason <span className="text-red-500">*</span>
              </label>
              <Textarea
                id="cancel-remark"
                value={cancelRemark}
                onChange={e => setCancelRemark(e.target.value)}
                placeholder="e.g. Emergency, need to reschedule, unavailable at this time…"
                className="text-sm min-h-[80px]"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                className="flex-1"
                disabled={!cancelRemark.trim()}
                onClick={() => updateSessionStatus(cancelDialogSession, 'cancelled', cancelRemark.trim())}
              >
                Confirm Cancel
              </Button>
              <Button variant="ghost" onClick={() => { setCancelDialogSession(null); setCancelRemark(''); }}>
                Go Back
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* End Relationship Confirm */}
      {endConfirm && (
        <div className="fixed inset-0 bg-black/40 z-[150] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <h2 className="font-semibold text-lg">End Relationship?</h2>
            </div>
            <p className="text-sm text-gray-600">This will permanently end the mentorship relationship. Both parties will be notified.</p>
            <div className="flex gap-2">
              <Button variant="destructive" className="flex-1" onClick={() => handleEndRelationship(endConfirm)}>
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
