import React from "react";
import { useLocation } from "wouter";
import { Clock, Eye, ArrowRight, BookOpen, Bookmark } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { FeedBlog } from "@/types/feed";

interface FeedBlogCardProps {
  blog: FeedBlog;
  onBookmark?: (blogId: string) => void;
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function FeedBlogCard({ blog, onBookmark }: FeedBlogCardProps) {
  const [, setLocation] = useLocation();
  const [coverError, setCoverError] = React.useState(false);

  const authorName = blog.author
    ? `${blog.author.first_name || ""} ${blog.author.last_name || ""}`.trim() || blog.author.username || "TKS Alumni"
    : "TKS Alumni";
  const authorInitials = authorName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "TK";

  const navigate = () => setLocation(`/blogs/${blog.slug}`);

  return (
    <Card
      className="group overflow-hidden cursor-pointer hover:shadow-md transition-all duration-200 relative"
      style={{ border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)", borderLeft: "3px solid #008060" }}
      onClick={navigate}
    >
      {/* Type + category badges — top-right */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1 flex-wrap justify-end">
        <Badge className="bg-[#008060]/90 text-white border-0 text-[10px] font-semibold px-1.5 py-0 h-5 shadow-sm">
          Blog Post
        </Badge>
        {blog.category && (
          <Badge
            className="text-[10px] font-medium px-1.5 py-0 h-5 border-0 shadow-sm"
            style={{ backgroundColor: blog.category.color, color: "#fff" }}
          >
            {blog.category.name}
          </Badge>
        )}
      </div>

      {/* Cover image */}
      {blog.cover_image && !coverError ? (
        <div className="relative w-full bg-gray-100 overflow-hidden aspect-video">
          <img
            src={blog.cover_image}
            alt={blog.title}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setCoverError(true)}
          />
        </div>
      ) : (
        <div className="w-full bg-gradient-to-br from-[#008060]/10 to-[#008060]/5 flex items-center justify-center aspect-video">
          <BookOpen className="w-10 h-10 text-[#008060]/25" />
        </div>
      )}

      <CardContent className="p-4 space-y-3">

        {/* Title */}
        <h3 className="font-semibold text-gray-900 text-base leading-snug line-clamp-2 group-hover:text-[#008060] transition-colors">
          {blog.title}
        </h3>

        {/* Excerpt */}
        {blog.excerpt && (
          <p className="text-sm text-gray-500 line-clamp-2">{blog.excerpt}</p>
        )}

        {/* Tags */}
        {blog.tags && blog.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {blog.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                #{tag}
              </span>
            ))}
            {blog.tags.length > 3 && (
              <span className="text-xs text-gray-400">+{blog.tags.length - 3} more</span>
            )}
          </div>
        )}

        {/* Footer */}
        <div
          className="flex items-center justify-between pt-2 border-t border-gray-100"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Avatar className="h-6 w-6 flex-shrink-0">
              <AvatarImage src={blog.author?.profile_picture ?? undefined} />
              <AvatarFallback className="text-xs bg-[#008060]/10 text-[#008060]">{authorInitials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-700 truncate">{authorName}</p>
              {blog.author?.current_role && (
                <p className="text-xs text-gray-400 truncate">{blog.author.current_role}</p>
              )}
              <p className="text-xs text-gray-400">{formatDate(blog.published_at)}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {blog.reading_time_minutes && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Clock className="h-3 w-3" />
                {blog.reading_time_minutes}m
              </span>
            )}
            {(blog.views_count ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Eye className="h-3 w-3" />
                {blog.views_count}
              </span>
            )}
            {onBookmark && (
              <Button
                variant="ghost"
                size="sm"
                className={`h-7 w-7 p-0 ${blog.viewer_has_bookmarked ? "text-[#008060]" : "text-gray-400 hover:text-[#008060]"}`}
                title={blog.viewer_has_bookmarked ? "Remove bookmark" : "Save blog"}
                onClick={(e) => { e.stopPropagation(); onBookmark(blog.id); }}
              >
                <Bookmark className={`h-4 w-4 ${blog.viewer_has_bookmarked ? "fill-current" : ""}`} />
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1 border-[#008060]/30 text-[#008060] hover:bg-[#008060] hover:text-white hover:border-[#008060]"
              onClick={(e) => { e.stopPropagation(); navigate(); }}
            >
              Read <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
