import React, { useState, useEffect, useRef } from "react";
import { Heart, MessageCircle, Bookmark, Share2, MapPin, Play, Clock, XCircle, Globe, ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useTravelPostLike } from "@/hooks/useTravelPostLike";
import { useTravelPostBookmark } from "@/hooks/useTravelPostBookmark";
import { clientConfig } from "@/lib/config";

interface TravelPost {
  id: string;
  author_id: string;
  city: string;
  country: string;
  caption?: string | null;
  likes_count: number;
  comments_count: number;
  bookmarks_count: number;
  created_at: string;
  media: { id: string; type: "image" | "video"; url: string; order_index: number }[];
  author: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    profile_picture?: string | null;
    current_role?: string | null;
  };
  viewer_has_liked: boolean;
  viewer_has_bookmarked: boolean;
  status?: "pending" | "approved" | "rejected";
  rejection_reason?: string | null;
  resubmit_count?: number;
}

interface Props {
  post: TravelPost;
  onClick: () => void;
  isOwnPost?: boolean;
  onEdit?: () => void;
  onLike?: () => void;
  onBookmark?: () => void;
}

export function TravelPostCard({ post, onClick, isOwnPost, onEdit, onLike, onBookmark }: Props) {
  const { toast } = useToast();
  const likeMutation = useTravelPostLike(post.id);
  const bookmarkMutation = useTravelPostBookmark(post.id);

  const authorName = [post.author?.first_name, post.author?.last_name].filter(Boolean).join(" ") || "Alumni";
  const avatarUrl = post.author?.profile_picture;

  const sortedMedia = [...post.media].sort((a, b) => a.order_index - b.order_index);
  const [mediaIndex, setMediaIndex] = useState(0);
  const hoverRef = useRef(false);
  const coverMedia = sortedMedia[mediaIndex] ?? sortedMedia[0];

  useEffect(() => {
    if (sortedMedia.length <= 1) return;
    const id = setInterval(() => {
      if (!hoverRef.current) {
        setMediaIndex((i) => (i + 1) % sortedMedia.length);
      }
    }, 3000);
    return () => clearInterval(id);
  }, [sortedMedia.length]);

  function goTo(e: React.MouseEvent, index: number) {
    e.stopPropagation();
    setMediaIndex((index + sortedMedia.length) % sortedMedia.length);
  }
  const timeAgo = (() => {
    try { return formatDistanceToNow(new Date(post.created_at), { addSuffix: true }); }
    catch { return ""; }
  })();

  function handleLike(e: React.MouseEvent) {
    e.stopPropagation();
    if (onLike) { onLike(); } else { likeMutation.mutate(); }
  }

  function handleBookmark(e: React.MouseEvent) {
    e.stopPropagation();
    if (onBookmark) { onBookmark(); } else { bookmarkMutation.mutate(); }
  }

  function handleShare(e: React.MouseEvent) {
    e.stopPropagation();
    const url = `${window.location.origin}/city-chapter/${post.id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => toast({ title: "Link copied!", description: "Share it with friends." }));
    } else {
      const el = document.createElement("textarea");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      toast({ title: "Link copied!" });
    }
  }

  return (
    <div
      className="relative bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      {/* Status banners for own pending/rejected posts */}
      {isOwnPost && post.status === "pending" && (
        <div className="px-3 py-2 bg-yellow-50 border-b border-yellow-100 text-xs text-yellow-700 font-medium flex items-center gap-1.5">
          <Clock className="w-3 h-3 flex-shrink-0" />
          <span className="flex-1">Under review — not yet visible to others</span>
          {onEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="flex items-center gap-1 text-yellow-700 hover:text-yellow-900 underline underline-offset-2 font-medium flex-shrink-0"
            >
              <Pencil className="w-3 h-3" />
              Edit
            </button>
          )}
        </div>
      )}
      {isOwnPost && post.status === "rejected" && (
        <div className="px-3 py-2 bg-red-50 border-b border-red-100 text-xs text-red-700 flex items-center gap-1.5">
          <XCircle className="w-3 h-3 flex-shrink-0" />
          <span className="flex-1">
            <span className="font-medium">Not approved</span>
            {post.rejection_reason && <> — {post.rejection_reason}</>}
          </span>
          {onEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="flex items-center gap-1 text-red-700 hover:text-red-900 underline underline-offset-2 font-medium flex-shrink-0"
            >
              <Pencil className="w-3 h-3" />
              Edit &amp; Resubmit
            </button>
          )}
        </div>
      )}

      {/* Cover media */}
      <div
        className="group relative aspect-video bg-gradient-to-br from-blue-400 to-indigo-600 overflow-hidden"
        onMouseEnter={() => { hoverRef.current = true; }}
        onMouseLeave={() => { hoverRef.current = false; }}
      >
        {/* Type badge — top-right */}
        <div className="absolute top-2 right-2 z-10">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-white bg-blue-500 px-1.5 py-0 h-5 rounded-full shadow-sm">
            <Globe className="w-2.5 h-2.5" />
            City Chapter
          </span>
        </div>
        {coverMedia ? (
          coverMedia.type === "video" ? (
            <div className="relative w-full h-full">
              <video
                src={coverMedia.url}
                className="w-full h-full object-cover"
                muted
                preload="metadata"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <div className="bg-white/90 rounded-full p-3">
                  <Play className="w-6 h-6 text-gray-800 fill-gray-800" />
                </div>
              </div>
            </div>
          ) : (
            <img
              key={coverMedia.url}
              src={coverMedia.url}
              alt={`${post.city} city chapter`}
              className="w-full h-full object-cover transition-opacity duration-500"
              loading="lazy"
            />
          )
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
            <MapPin className="w-10 h-10 mb-2 opacity-80" />
            <span className="text-xl font-semibold opacity-90">{post.city}</span>
          </div>
        )}

        {/* Prev / Next arrows */}
        {sortedMedia.length > 1 && (
          <>
            <button
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1 transition opacity-0 group-hover:opacity-100"
              onClick={(e) => goTo(e, mediaIndex - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1 transition opacity-0 group-hover:opacity-100"
              onClick={(e) => goTo(e, mediaIndex + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}

        {/* Dot indicators for multiple media */}
        {sortedMedia.length > 1 && sortedMedia.length <= 10 && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 flex gap-1">
            {sortedMedia.map((_, i) => (
              <button
                key={i}
                onClick={(e) => goTo(e, i)}
                className={`block rounded-full transition-all duration-300 ${i === mediaIndex ? "w-3 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/50"}`}
              />
            ))}
          </div>
        )}

        {/* Media count badge for > 10 items */}
        {sortedMedia.length > 10 && (
          <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
            {mediaIndex + 1}/{sortedMedia.length}
          </div>
        )}

        {/* Location badge */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/50 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm">
          <MapPin className="w-3 h-3" />
          <span>{post.city}, {post.country}</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Author row with inline tag */}
        <div className="flex items-center gap-3 mb-3">
          {avatarUrl ? (
            <img src={avatarUrl} alt={authorName} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-semibold">{authorName.charAt(0).toUpperCase()}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{authorName}</p>
            {post.author?.current_role && (
              <p className="text-xs text-gray-500 truncate">{post.author.current_role}</p>
            )}
          </div>
          <span className="text-xs text-gray-400 flex-shrink-0">{timeAgo}</span>
        </div>

        {/* Caption */}
        {post.caption && (
          <p className="text-sm text-gray-700 line-clamp-3 mb-3">{post.caption}</p>
        )}

        {/* Action row */}
        <div className="flex items-center gap-4 pt-2 border-t border-gray-50">
          <button
            onClick={handleLike}
            className={`flex items-center gap-1.5 text-sm transition-colors ${post.viewer_has_liked ? "text-red-500" : "text-gray-500 hover:text-red-400"}`}
            disabled={!onLike && likeMutation.isPending}
          >
            <Heart className={`w-4 h-4 ${post.viewer_has_liked ? "fill-red-500" : ""}`} />
            <span>{post.likes_count}</span>
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-500 transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            <span>{post.comments_count}</span>
          </button>

          <div className="flex-1" />

          <button
            onClick={handleBookmark}
            className={`flex items-center gap-1.5 text-sm transition-colors ${post.viewer_has_bookmarked ? "text-blue-500" : "text-gray-500 hover:text-blue-400"}`}
            disabled={!onBookmark && bookmarkMutation.isPending}
          >
            <Bookmark className={`w-4 h-4 ${post.viewer_has_bookmarked ? "fill-blue-500" : ""}`} />
          </button>

          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-green-500 transition-colors"
          >
            <Share2 className="w-4 h-4" />
          </button>

          {/* Edit button — only visible for approved own posts (pending/rejected have banners above) */}
          {isOwnPost && onEdit && post.status === "approved" && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-indigo-500 transition-colors"
              title="Edit post"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
