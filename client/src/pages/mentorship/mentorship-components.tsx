import React from 'react';
import { Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock, Sparkles } from 'lucide-react';

export const SkeletonCard = () => (
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

export const MatchBar = ({ score }: { score: number }) => {
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

export const StatusBadge = ({ status }: { status: string }) => {
  if (status === 'accepted') return <Badge className="bg-green-100 text-green-700 border-0"><CheckCircle className="w-3 h-3 mr-1" />Accepted</Badge>;
  if (status === 'rejected') return <Badge className="bg-red-100 text-red-700 border-0"><XCircle className="w-3 h-3 mr-1" />Declined</Badge>;
  if (status === 'ended') return <Badge className="bg-gray-100 text-gray-600 border-0"><XCircle className="w-3 h-3 mr-1" />Ended</Badge>;
  return <Badge className="bg-yellow-100 text-yellow-700 border-0"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
};

export const StarRating = ({ rating, max = 5, size = 'sm' }: { rating: number; max?: number; size?: 'sm' | 'md' }) => {
  const px = size === 'md' ? 'w-4 h-4' : 'w-3 h-3';
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star key={i} className={`${px} ${i < Math.round(rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
      ))}
    </span>
  );
};

export const MEET_LINK_PATTERN = /^https?:\/\/(meet\.google\.com|zoom\.us|us\d*\.zoom\.us|teams\.microsoft\.com|teams\.live\.com|meet\.jit\.si|whereby\.com|webex\.com|[\w-]+\.webex\.com|bluejeans\.com|gotomeeting\.com|join\.me|gather\.town|meet\.around\.co|8x8\.vc)\//i;

export const isValidMeetLink = (url: string): boolean => {
  try { new URL(url); } catch { return false; }
  return MEET_LINK_PATTERN.test(url);
};
