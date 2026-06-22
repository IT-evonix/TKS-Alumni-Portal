import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import {
  Star, Users, BookOpen, MessageSquare, CheckCircle2, Sparkles,
  Video, Calendar, ExternalLink, Linkedin, Github, Globe, Twitter,
  Building2,
} from 'lucide-react';
import type { Mentor } from './mentorship-types';
import { StarRating } from './mentorship-components';

interface ReviewData {
  id: string;
  rating: number;
  comment?: string;
  created_at: string;
  reviewer?: { first_name: string; last_name: string };
}

interface Props {
  mentor: Mentor;
  onClose: () => void;
  onRequest: (mentorId: string, goalText: string, message: string) => void;
  onWithdraw?: () => void;
  isPending: boolean;
  isConnected?: boolean;
  isFull: boolean;
  currentUserId: string;
}

const parseJsonArray = (raw?: string): string[] => {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return raw.split(',').map(s => s.trim()).filter(Boolean); }
};

const STYLE_MAP: Record<string, { icon: React.ReactNode; label: string; description: string }> = {
  structured:     { icon: <BookOpen className="w-4 h-4" />, label: 'Structured curriculum', description: 'Clear goals and milestones with a defined learning path' },
  ad_hoc:         { icon: <MessageSquare className="w-4 h-4" />, label: 'Ad-hoc conversations', description: 'Casual, on-demand discussions as questions arise' },
  accountability: { icon: <CheckCircle2 className="w-4 h-4" />, label: 'Accountability partner', description: 'Regular check-ins to keep you on track' },
  flexible:       { icon: <Sparkles className="w-4 h-4" />, label: 'Flexible / mix', description: 'Adapts to what you need at any given time' },
};

const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const MentorProfileModal = ({ mentor, onClose, onRequest, onWithdraw, isPending, isConnected, isFull, currentUserId }: Props): JSX.Element => {
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [requestFormOpen, setRequestFormOpen] = useState(false);
  const [goalText, setGoalText] = useState('');
  const [requestMessage, setRequestMessage] = useState('');

  const slots = (mentor.max_mentees ?? 3) - (mentor.mentee_count ?? 0);
  const matchColor = (mentor.match_score ?? 0) >= 70
    ? 'bg-green-100 text-green-700 border-green-200'
    : (mentor.match_score ?? 0) >= 45
      ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
      : 'bg-gray-100 text-gray-600 border-gray-200';

  const activeDays = mentor.available_days
    ? mentor.available_days.split(',').map(d => d.trim()).filter(Boolean)
    : [];

  const helpTopics = parseJsonArray(mentor.help_topics);
  const expertiseTags = parseJsonArray(mentor.expertise_areas);
  const primarySkills = mentor.alumni_skills?.filter(s => s.is_primary) ?? [];
  const styleInfo = mentor.mentorship_style ? STYLE_MAP[mentor.mentorship_style] : null;

  useEffect(() => {
    if (!mentor.user_id) return;
    setReviewsLoading(true);
    fetch(`/api/mentorship/reviews/${mentor.user_id}`, {
      headers: { 'user-id': currentUserId },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setReviews(data.reviews || []); })
      .catch(() => {})
      .finally(() => setReviewsLoading(false));
  }, [mentor.user_id, currentUserId]);

  const handleSendRequest = () => {
    onRequest(mentor.user_id, goalText, requestMessage);
  };

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl w-full p-0 overflow-hidden flex flex-col max-h-[92vh]">
        <DialogTitle className="sr-only">{mentor.first_name} {mentor.last_name} — Mentor Profile</DialogTitle>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1">

          {/* Hero */}
          <div className="bg-gradient-to-br from-[#008060]/8 to-emerald-50 px-6 pt-6 pb-5">
            <div className="flex items-start gap-4">
              <Avatar className="w-20 h-20 ring-4 ring-white shadow-md flex-shrink-0">
                <AvatarImage src={mentor.profile_picture} />
                <AvatarFallback className="bg-[#008060] text-white text-xl font-bold">
                  {mentor.first_name?.[0]}{mentor.last_name?.[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 leading-tight">
                      {mentor.first_name} {mentor.last_name}
                      {mentor.graduation_year && (
                        <span className="ml-2 text-sm font-normal text-gray-400 bg-white/80 px-1.5 py-0.5 rounded-full border">
                          Class of {mentor.graduation_year}
                        </span>
                      )}
                    </h2>
                    {mentor.current_role && (
                      <p className="text-sm text-gray-700 mt-0.5">{mentor.current_role}</p>
                    )}
                    {mentor.current_company && (
                      <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3.5 h-3.5" />{mentor.current_company}
                      </p>
                    )}
                  </div>
                  {mentor.match_score !== undefined && mentor.match_score > 0 && (
                    <span className={`text-sm font-semibold px-3 py-1 rounded-full border flex-shrink-0 ${matchColor}`}>
                      {mentor.match_score}% match
                    </span>
                  )}
                </div>

                {/* Social links */}
                <div className="flex items-center gap-2 mt-2">
                  {mentor.linkedin_url && (
                    <a href={mentor.linkedin_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 transition-colors">
                      <Linkedin className="w-3.5 h-3.5" /> LinkedIn
                    </a>
                  )}
                  {mentor.github_url && (
                    <a href={mentor.github_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 transition-colors">
                      <Github className="w-3.5 h-3.5" /> GitHub
                    </a>
                  )}
                  {mentor.portfolio_url && (
                    <a href={mentor.portfolio_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-[#008060] hover:text-[#006a50] transition-colors">
                      <Globe className="w-3.5 h-3.5" /> Portfolio
                    </a>
                  )}
                  {mentor.twitter_url && (
                    <a href={mentor.twitter_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-sky-500 hover:text-sky-600 transition-colors">
                      <Twitter className="w-3.5 h-3.5" /> Twitter
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="bg-white/80 rounded-xl p-3 text-center border border-white shadow-sm">
                <p className="text-xl font-bold text-[#008060]">{mentor.total_mentees_helped ?? 0}</p>
                <p className="text-xs text-gray-500 mt-0.5">Mentored</p>
              </div>
              <div className="bg-white/80 rounded-xl p-3 text-center border border-white shadow-sm">
                <p className="text-xl font-bold text-[#008060]">
                  {mentor.averageRating != null ? mentor.averageRating.toFixed(1) : '—'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Avg rating</p>
              </div>
              <div className="bg-white/80 rounded-xl p-3 text-center border border-white shadow-sm">
                <p className="text-xl font-bold text-[#008060]">{isFull ? 0 : slots}</p>
                <p className="text-xs text-gray-500 mt-0.5">Slots open</p>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 space-y-5">

            {/* About */}
            {mentor.bio && (
              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">About</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{mentor.bio}</p>
              </section>
            )}

            {/* What I can help with */}
            {(helpTopics.length > 0 || expertiseTags.length > 0 || primarySkills.length > 0) && (
              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">What I Can Help With</h3>
                <div className="space-y-2">
                  {helpTopics.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {helpTopics.map((t, i) => (
                        <Badge key={i} className="bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100">{t}</Badge>
                      ))}
                    </div>
                  )}
                  {(expertiseTags.length > 0 || primarySkills.length > 0) && (
                    <div className="flex flex-wrap gap-1.5">
                      {expertiseTags.map((t, i) => (
                        <Badge key={`exp-${i}`} variant="secondary">{t}</Badge>
                      ))}
                      {primarySkills.map((s, i) => (
                        <Badge key={`sk-${i}`} variant="outline">{s.skill_name}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Mentorship style */}
            {styleInfo && (
              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Mentorship Style</h3>
                <div className="flex items-start gap-3 bg-gray-50 rounded-xl p-3 border">
                  <span className="p-2 bg-[#008060]/10 text-[#008060] rounded-lg flex-shrink-0">
                    {styleInfo.icon}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{styleInfo.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{styleInfo.description}</p>
                  </div>
                </div>
              </section>
            )}

            {/* Availability */}
            <section>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Availability</h3>
              <div className="space-y-2">
                {/* Day grid */}
                {activeDays.length > 0 ? (
                  <div className="flex gap-1.5 flex-wrap">
                    {ALL_DAYS.map(day => (
                      <span
                        key={day}
                        className={[
                          'px-2.5 py-1 rounded-full text-xs font-medium border',
                          activeDays.includes(day)
                            ? 'bg-[#008060] text-white border-[#008060]'
                            : 'bg-gray-100 text-gray-400 border-transparent',
                        ].join(' ')}
                      >
                        {day}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">Not specified</p>
                )}
                <div className="flex items-center gap-3 flex-wrap text-sm">
                  {mentor.session_type && (
                    <span className="flex items-center gap-1.5 text-gray-600">
                      <Video className="w-4 h-4 text-[#008060]" />
                      {mentor.session_type === 'video' ? 'Video calls' : mentor.session_type === 'async' ? 'Async messaging' : 'Video or async'}
                    </span>
                  )}
                  {mentor.meeting_link && isConnected && (
                    <a href={mentor.meeting_link} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 text-xs transition-colors">
                      <Calendar className="w-3.5 h-3.5" /> Book a call
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            </section>

            {/* Reviews */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700">Reviews</h3>
                {mentor.averageRating != null && mentor.reviewCount != null && mentor.reviewCount > 0 && (
                  <span className="flex items-center gap-1.5 text-sm">
                    <StarRating rating={mentor.averageRating} />
                    <span className="font-medium text-gray-700">{mentor.averageRating.toFixed(1)}</span>
                    <span className="text-gray-400 text-xs">({mentor.reviewCount} review{mentor.reviewCount !== 1 ? 's' : ''})</span>
                  </span>
                )}
              </div>

              {reviewsLoading ? (
                <div className="space-y-3">
                  {[1, 2].map(i => (
                    <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : reviews.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No reviews yet.</p>
              ) : (
                <div className="space-y-3">
                  {reviews.slice(0, 8).map(r => (
                    <div key={r.id} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-gray-700">
                          {r.reviewer ? `${r.reviewer.first_name} ${r.reviewer.last_name}` : 'Anonymous'}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <StarRating rating={r.rating} size="sm" />
                          <span className="text-xs text-gray-400">
                            {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                      </div>
                      {r.comment && (
                        <p className="text-xs text-gray-600 leading-relaxed">{r.comment}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Request form (inline, above footer) */}
            {requestFormOpen && (
              <section className="border rounded-xl p-4 bg-gray-50 space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">Send a Mentorship Request</h3>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Your goal *</label>
                  <Textarea
                    placeholder="What do you hope to achieve through this mentorship?"
                    value={goalText}
                    onChange={e => setGoalText(e.target.value)}
                    className="text-sm min-h-[72px]"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Message (optional)</label>
                  <Textarea
                    placeholder="Introduce yourself briefly…"
                    value={requestMessage}
                    onChange={e => setRequestMessage(e.target.value)}
                    className="text-sm min-h-[60px]"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSendRequest} variant="brand" className="flex-1" disabled={!goalText.trim()}>
                    Send Request
                  </Button>
                  <Button variant="ghost" onClick={() => setRequestFormOpen(false)}>Cancel</Button>
                </div>
              </section>
            )}

          </div>
        </div>

        {/* Sticky CTA footer */}
        {!requestFormOpen && (
          <div className="border-t px-6 py-4 bg-white flex items-center gap-3 flex-shrink-0">
            <Button variant="ghost" onClick={onClose} className="flex-1">
              Close
            </Button>
            {isPending ? (
              <Button
                variant="outline"
                className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => { onWithdraw?.(); onClose(); }}
              >
                Withdraw Request
              </Button>
            ) : (
              <Button
                variant={isConnected ? 'outline' : 'brand'}
                className={`flex-1${isConnected ? ' text-green-700 border-green-200 bg-green-50' : ''}`}
                disabled={isConnected || isFull}
                onClick={() => !isConnected && setRequestFormOpen(true)}
              >
                {isConnected ? 'Connected' : isFull ? 'Mentor Full' : 'Request Mentorship'}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
