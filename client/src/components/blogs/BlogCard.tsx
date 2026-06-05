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

  return (
    <Card className="group flex flex-col overflow-hidden border border-gray-200 hover:shadow-md transition-shadow duration-200 cursor-pointer h-full">
      {/* Cover image */}
      {post.cover_image ? (
        <div
          className="relative w-full bg-gray-100 overflow-hidden"
          style={{ paddingTop: "56.25%" }}
          onClick={() => setLocation(`/blogs/${post.slug}`)}
        >
          <img
            src={post.cover_image}
            alt={post.title}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>
      ) : (
        <div
          className="w-full bg-gradient-to-br from-[#008060]/10 to-[#008060]/5 flex items-center justify-center"
          style={{ height: "160px" }}
          onClick={() => setLocation(`/blogs/${post.slug}`)}
        >
          <span className="text-4xl text-[#008060]/20 font-bold select-none">T</span>
        </div>
      )}

      <CardContent className="flex flex-col flex-1 p-4 gap-3">
        {/* Category + status */}
        <div className="flex items-center gap-2 flex-wrap">
          {post.category && (
            <Badge
              className="text-xs font-medium px-2 py-0.5"
              style={{ backgroundColor: `${post.category.color}20`, color: post.category.color, border: `1px solid ${post.category.color}40` }}
            >
              {post.category.name}
            </Badge>
          )}
          {showStatus && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[post.status] || "bg-gray-100 text-gray-600"}`}>
              {post.status === "pending_review" ? "In Review" : post.status.charAt(0).toUpperCase() + post.status.slice(1)}
            </span>
          )}
        </div>

        {/* Title */}
        <h3
          className="font-semibold text-gray-900 text-base leading-snug line-clamp-2 group-hover:text-[#008060] transition-colors"
          onClick={() => setLocation(`/blogs/${post.slug}`)}
        >
          {post.title}
        </h3>

        {/* Excerpt */}
        {post.excerpt && (
          <p
            className="text-sm text-gray-500 line-clamp-2 flex-1"
            onClick={() => setLocation(`/blogs/${post.slug}`)}
          >
            {post.excerpt}
          </p>
        )}

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {post.tags.slice(0, 3).map((tag: string) => (
              <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                #{tag}
              </span>
            ))}
            {post.tags.length > 3 && (
              <span className="text-xs text-gray-400">+{post.tags.length - 3} more</span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-auto">
          {/* Author */}
          <div className="flex items-center gap-2 min-w-0">
            <Avatar className="h-6 w-6 flex-shrink-0">
              <AvatarImage src={post.author?.profile_picture} />
              <AvatarFallback className="text-xs bg-[#008060]/10 text-[#008060]">{authorInitials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-700 truncate">{authorName}</p>
              <p className="text-xs text-gray-400">{formatDate(post.published_at || post.created_at)}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Clock className="h-3 w-3" />
              {post.reading_time_minutes}m
            </span>
            {post.views_count > 0 && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Eye className="h-3 w-3" />
                {post.views_count}
              </span>
            )}
            {onLike && (
              <Button
                variant="ghost"
                size="sm"
                className={`h-6 px-1.5 text-xs gap-1 ${post.viewer_has_liked ? "text-red-500" : "text-gray-400 hover:text-red-500"}`}
                onClick={(e) => { e.stopPropagation(); onLike(post.id); }}
              >
                <Heart className={`h-3 w-3 ${post.viewer_has_liked ? "fill-current" : ""}`} />
                {post.likes_count > 0 && <span>{post.likes_count}</span>}
              </Button>
            )}
            {onBookmark && (
              <Button
                variant="ghost"
                size="sm"
                className={`h-6 px-1.5 text-xs ${post.viewer_has_bookmarked ? "text-[#008060]" : "text-gray-400 hover:text-[#008060]"}`}
                onClick={(e) => { e.stopPropagation(); onBookmark(post.id); }}
              >
                <Bookmark className={`h-3 w-3 ${post.viewer_has_bookmarked ? "fill-current" : ""}`} />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
