import React from "react";
import { useLocation } from "wouter";
import { Heart, Bookmark, Clock, Eye } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface BlogCardProps {
  post: any;
  onLike?: (postId: string) => void;
  onBookmark?: (postId: string) => void;
  showStatus?: boolean;
}

export function BlogCard({ post, onLike, onBookmark, showStatus = false }: BlogCardProps) {
  const [, setLocation] = useLocation();
  const [coverError, setCoverError] = React.useState(false);

  const authorName = post.author
    ? `${post.author.first_name || ""} ${post.author.last_name || ""}`.trim() || post.author.username
    : "Unknown";
  const authorInitials = authorName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  const formatDate = (date: string) => {
    if (!date) return "";
    return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const statusColors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    pending_review: "bg-yellow-100 text-yellow-800",
    published: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
  };

  const navigate = () => setLocation(`/blogs/${post.slug}`);

  return (
    <Card
      className="group flex flex-col overflow-hidden border border-gray-200 hover:shadow-md transition-shadow duration-200 cursor-pointer"
      onClick={navigate}
    >
      {/* Cover image — fixed height */}
      <div className="relative w-full flex-shrink-0 overflow-hidden" style={{ height: "180px" }}>
        {post.cover_image && !coverError ? (
          <img
            src={post.cover_image}
            alt={post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setCoverError(true)}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#008060]/10 to-[#008060]/5 flex items-center justify-center">
            <span className="text-4xl text-[#008060]/20 font-bold select-none">T</span>
          </div>
        )}
      </div>

      <CardContent className="flex flex-col flex-1 p-4 gap-2">
        {/* Category + status — fixed height row, always present */}
        <div className="flex items-center gap-2 h-6">
          {post.category ? (
            <Badge
              className="text-xs font-medium px-2 py-0.5 truncate max-w-[120px]"
              style={{ backgroundColor: `${post.category.color}20`, color: post.category.color, border: `1px solid ${post.category.color}40` }}
            >
              {post.category.name}
            </Badge>
          ) : (
            <span className="h-5" />
          )}
          {showStatus && post.status && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${statusColors[post.status] || "bg-gray-100 text-gray-600"}`}>
              {post.status === "pending_review" ? "In Review" : post.status.charAt(0).toUpperCase() + post.status.slice(1)}
            </span>
          )}
        </div>

        {/* Title — exactly 2 lines */}
        <h3 className="font-semibold text-gray-900 text-base leading-snug line-clamp-2 group-hover:text-[#008060] transition-colors" style={{ minHeight: "2.75rem" }}>
          {post.title}
        </h3>

        {/* Excerpt — exactly 2 lines, always present */}
        <p className="text-sm text-gray-500 line-clamp-2" style={{ minHeight: "2.5rem" }}>
          {post.excerpt || ""}
        </p>

        {/* Tags — fixed height row, always rendered */}
        <div className="flex flex-wrap gap-1 overflow-hidden" style={{ minHeight: "1.5rem" }}>
          {post.tags && post.tags.length > 0 ? (
            <>
              {post.tags.slice(0, 3).map((tag: string) => (
                <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full whitespace-nowrap">
                  #{tag}
                </span>
              ))}
              {post.tags.length > 3 && (
                <span className="text-xs text-gray-400 self-center">+{post.tags.length - 3}</span>
              )}
            </>
          ) : null}
        </div>

        {/* Footer — single row, never wraps */}
        <div
          className="flex items-center justify-between pt-2 border-t border-gray-100 mt-auto gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Author + date — single line */}
          <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
            <Avatar className="h-5 w-5 flex-shrink-0">
              <AvatarImage src={post.author?.profile_picture} />
              <AvatarFallback className="text-[10px] bg-[#008060]/10 text-[#008060]">{authorInitials}</AvatarFallback>
            </Avatar>
            <span className="text-xs text-gray-500 truncate whitespace-nowrap">
              {authorName} · {formatDate(post.published_at || post.created_at)}
            </span>
          </div>

          {/* Stats + actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="flex items-center gap-0.5 text-xs text-gray-400 whitespace-nowrap">
              <Clock className="h-3 w-3" />
              {post.reading_time_minutes}m
            </span>
            {(post.views_count ?? 0) > 0 && (
              <span className="flex items-center gap-0.5 text-xs text-gray-400 whitespace-nowrap">
                <Eye className="h-3 w-3" />
                {post.views_count}
              </span>
            )}
            {onLike && (
              <Button
                variant="ghost"
                size="sm"
                className={`h-6 w-6 p-0 ${post.viewer_has_liked ? "text-red-500" : "text-gray-400 hover:text-red-500"}`}
                onClick={(e) => { e.stopPropagation(); onLike(post.id); }}
              >
                <Heart className={`h-3.5 w-3.5 ${post.viewer_has_liked ? "fill-current" : ""}`} />
              </Button>
            )}
            {onBookmark && (
              <Button
                variant="ghost"
                size="sm"
                className={`h-6 w-6 p-0 ${post.viewer_has_bookmarked ? "text-[#008060]" : "text-gray-400 hover:text-[#008060]"}`}
                onClick={(e) => { e.stopPropagation(); onBookmark(post.id); }}
              >
                <Bookmark className={`h-3.5 w-3.5 ${post.viewer_has_bookmarked ? "fill-current" : ""}`} />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
