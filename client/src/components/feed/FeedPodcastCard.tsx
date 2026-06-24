import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Mic2, Eye, ArrowRight, Calendar, Heart, MessageCircle, Send } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FeedPodcast } from "@/types/feed";

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  author: {
    id?: string;
    username?: string;
    firstName?: string | null;
    lastName?: string | null;
    avatarUrl?: string | null;
  };
}

interface FeedPodcastCardProps {
  podcast: FeedPodcast;
  isLiked?: boolean;
  showComments?: boolean;
  commentText?: string;
  onLike?: () => void;
  onComment?: () => void;
  onPostComment?: () => void;
  onCommentTextChange?: (text: string) => void;
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getThumbnailUrl(videoUrl: string, embedUrl: string | null): string | null {
  const sources = [videoUrl, embedUrl].filter(Boolean) as string[];
  for (const url of sources) {
    const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    if (ytMatch) return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
    const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vimeoMatch) return `https://vumbnail.com/${vimeoMatch[1]}.jpg`;
  }
  return null;
}

export function FeedPodcastCard({
  podcast,
  isLiked = false,
  showComments = false,
  commentText = "",
  onLike,
  onComment,
  onPostComment,
  onCommentTextChange,
}: FeedPodcastCardProps) {
  const [, setLocation] = useLocation();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);

  const displayDate = podcast.published_at || podcast.created_at;
  const navigate = () => setLocation(`/podcasts/${podcast.slug}`);

  useEffect(() => {
    if (!showComments) return;
    setLoadingComments(true);
    fetch(`/api/podcasts/${podcast.id}/comments`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.comments) setComments(data.comments); })
      .catch(() => {})
      .finally(() => setLoadingComments(false));
  }, [showComments, podcast.id]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onPostComment?.();
    }
  };

  return (
    <Card
      className="group hover:shadow-md transition-all duration-200"
      style={{ border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)", borderLeft: "3px solid #9333EA" }}
    >
      <CardContent className="p-4 relative">
        {/* Badge top-right of card */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
          <Badge className="bg-purple-50 text-purple-700 border border-purple-200 text-xs font-semibold hover:bg-purple-50">
            Podcast
          </Badge>
          {podcast.episode_number != null && (
            <span className="text-xs text-gray-400 font-medium bg-white/80 px-1.5 py-0.5 rounded">Ep. {podcast.episode_number}</span>
          )}
        </div>

        <div
          className="flex gap-4 items-start cursor-pointer"
          onClick={navigate}
        >
          {/* Icon / thumbnail block */}
          {(() => {
            const thumb = getThumbnailUrl(podcast.video_url ?? "", podcast.embed_url ?? null);
            return thumb ? (
              <div className="relative flex-shrink-0 w-[72px] h-[72px] rounded-2xl overflow-hidden">
                <img src={thumb} alt={podcast.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-2xl">
                  <div className="w-6 h-6 rounded-full bg-purple-600/90 flex items-center justify-center">
                    <Mic2 className="w-3 h-3 text-white" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-shrink-0 w-[72px] h-[72px] rounded-2xl bg-purple-100 flex items-center justify-center">
                <Mic2 className="w-8 h-8 text-purple-500" />
              </div>
            );
          })()}

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-2 pr-16">

            {/* Title */}
            <h3 className="font-semibold text-gray-900 text-base leading-snug line-clamp-2 group-hover:text-purple-700 transition-colors">
              {podcast.title}
            </h3>

            {/* Description */}
            {podcast.description && (
              <p className="text-sm text-gray-500 line-clamp-2">{podcast.description}</p>
            )}

            {/* Tags */}
            {podcast.tags && podcast.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {podcast.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">
                    #{tag}
                  </span>
                ))}
                {podcast.tags.length > 3 && (
                  <span className="text-xs text-gray-400">+{podcast.tags.length - 3} more</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer — interactions */}
        <div
          className="flex items-center justify-between pt-3 mt-3 border-t border-gray-100"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Left: meta + like + comment */}
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(displayDate)}
            </span>
            {/* Like button */}
            <button
              onClick={onLike}
              className={`flex items-center gap-1 transition-colors hover:text-red-500 ${isLiked ? "text-red-500" : ""}`}
            >
              <Heart className={`h-3.5 w-3.5 ${isLiked ? "fill-red-500" : ""}`} />
              <span>{podcast.likes_count ?? 0}</span>
            </button>

            {/* Comment toggle */}
            <button
              onClick={onComment}
              className={`flex items-center gap-1 transition-colors hover:text-purple-600 ${showComments ? "text-purple-600" : ""}`}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span>{podcast.comments_count ?? 0}</span>
            </button>
          </div>

          {/* Right: View Episode */}
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1 border-purple-300 text-purple-700 hover:bg-purple-600 hover:text-white hover:border-purple-600"
            onClick={(e) => { e.stopPropagation(); navigate(); }}
          >
            View Episode <ArrowRight className="h-3 w-3" />
          </Button>
        </div>

        {/* Comments section */}
        {showComments && (
          <div className="mt-3 space-y-3" onClick={(e) => e.stopPropagation()}>
            {/* Existing comments */}
            {loadingComments ? (
              <p className="text-xs text-gray-400">Loading comments...</p>
            ) : comments.length === 0 ? (
              <p className="text-xs text-gray-400">No comments yet. Be the first!</p>
            ) : (
              <div className="space-y-2">
                {comments.map(c => {
                  const name = c.author.firstName
                    ? `${c.author.firstName} ${c.author.lastName ?? ""}`.trim()
                    : c.author.username || "User";
                  return (
                    <div key={c.id} className="flex gap-2 text-sm">
                      <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        {c.author.avatarUrl ? (
                          <img src={c.author.avatarUrl} alt={name} className="w-6 h-6 rounded-full object-cover" />
                        ) : (
                          <span className="text-[10px] font-bold text-purple-600">{name[0]?.toUpperCase()}</span>
                        )}
                      </div>
                      <div className="flex-1 bg-gray-50 rounded-lg px-3 py-2">
                        <p className="font-semibold text-xs text-gray-700">{name}</p>
                        <p className="text-xs text-gray-600 mt-0.5">{c.content}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Comment input */}
            <div className="flex gap-2">
              <Input
                value={commentText}
                onChange={e => onCommentTextChange?.(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Write a comment..."
                className="h-8 text-sm flex-1"
              />
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-2 border-purple-300 text-purple-700 hover:bg-purple-600 hover:text-white"
                onClick={onPostComment}
                disabled={!commentText.trim()}
              >
                <Send className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
