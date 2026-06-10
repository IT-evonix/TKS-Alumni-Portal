import React, { useState, useEffect, useMemo } from "react";
import DOMPurify from "dompurify";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, Heart, Bookmark, Share2, Clock, Eye, Calendar, CheckCircle, XCircle, Edit } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { BlogCommentsSection } from "@/components/blogs/BlogCommentsSection";
import { BlogAuthorCard } from "@/components/blogs/BlogAuthorCard";
import { BlogEditor } from "@/components/blogs/BlogEditor";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { clientConfig } from "@/lib/config";

export function BlogDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();
  const { user, adminUser } = useAuth();
  const { toast } = useToast();

  const [post, setPost] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [commentsCount, setCommentsCount] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);

  // Admin moderation
  const [rejectionReason, setRejectionReason] = useState("");
  const [moderating, setModerating] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);

  const isAdmin = user?.user_role === "administrator" || (user as any)?.is_admin;
  const isAuthor = post && user && post.author?.id === user.id;

  React.useEffect(() => {
    if (slug) {
      setNotFound(false);
      fetchPost();
      fetchCategories();
    }
  }, [slug, user?.id]); // re-fetch when auth resolves so user-id header is sent

  const getHeaders = () => {
    const token = localStorage.getItem("auth_token") || "";
    return {
      "Content-Type": "application/json",
      "user-id": user?.id || adminUser?.id || localStorage.getItem("userId") || "",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const fetchPost = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${clientConfig.apiUrl}/api/blogs/${slug}`, { headers: getHeaders() });
      if (res.status === 404) { setNotFound(true); return; }
      if (res.ok) {
        const data = await res.json();
        setPost(data);
        setLiked(data.viewer_has_liked);
        setBookmarked(data.viewer_has_bookmarked);
        setLikesCount(data.likes_count || 0);
        setCommentsCount(data.comments_count || 0);
        document.title = `${data.title} - TKS Alumni Portal`;
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${clientConfig.apiUrl}/api/blogs/categories`);
      if (res.ok) setCategories(await res.json());
    } catch {}
  };

  const handleLike = async () => {
    if (!user) { toast({ title: "Sign in to like posts", variant: "destructive" }); return; }
    const newLiked = !liked;
    setLiked(newLiked);
    setLikesCount((c) => c + (newLiked ? 1 : -1));
    try {
      const res = await fetch(`${clientConfig.apiUrl}/api/blogs/${post.id}/like`, {
        method: "POST",
        headers: getHeaders(),
      });
      if (!res.ok) {
        setLiked(!newLiked);
        setLikesCount((c) => c + (newLiked ? -1 : 1));
      }
    } catch {
      setLiked(!newLiked);
      setLikesCount((c) => c + (newLiked ? -1 : 1));
    }
  };

  const handleBookmark = async () => {
    if (!user) { toast({ title: "Sign in to bookmark posts", variant: "destructive" }); return; }
    const newBookmarked = !bookmarked;
    setBookmarked(newBookmarked);
    try {
      const res = await fetch(`${clientConfig.apiUrl}/api/blogs/${post.id}/bookmark`, {
        method: "POST",
        headers: getHeaders(),
      });
      if (!res.ok) setBookmarked(!newBookmarked);
    } catch {
      setBookmarked(!newBookmarked);
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      toast({ title: "Link copied!", description: "Blog post URL copied to clipboard." });
    });
  };

  const handleAdminDelete = async () => {
    if (!confirm(`Delete "${post?.title}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${clientConfig.apiUrl}/api/blogs/admin/${post.id}`, {
        method: "DELETE",
        headers: getHeaders(),
      });
      if (res.ok) {
        toast({ title: "Post deleted." });
        setLocation("/blogs");
      } else {
        toast({ title: "Failed to delete post", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to delete post", variant: "destructive" });
    }
  };

  const handleApprove = async () => {
    setModerating(true);
    try {
      const res = await fetch(`${clientConfig.apiUrl}/api/blogs/admin/${post.id}/approve`, {
        method: "PUT",
        headers: getHeaders(),
      });
      if (res.ok) {
        toast({ title: "Post approved and published!" });
        fetchPost();
      }
    } catch {
      toast({ title: "Failed to approve", variant: "destructive" });
    } finally {
      setModerating(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) { toast({ title: "Please enter a rejection reason", variant: "destructive" }); return; }
    setModerating(true);
    try {
      const res = await fetch(`${clientConfig.apiUrl}/api/blogs/admin/${post.id}/reject`, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify({ rejection_reason: rejectionReason }),
      });
      if (res.ok) {
        toast({ title: "Post rejected." });
        setShowRejectForm(false);
        fetchPost();
      }
    } catch {
      toast({ title: "Failed to reject", variant: "destructive" });
    } finally {
      setModerating(false);
    }
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  // Sanitize HTML content from TipTap — memoized so it only runs when post.content changes
  const safeContent = useMemo(() => {
    if (!post?.content) return "";
    // Allow safe HTML tags produced by TipTap; strip event handlers and dangerous attrs
    return DOMPurify.sanitize(post.content, {
      ALLOWED_TAGS: [
        "p", "br", "strong", "em", "s", "u", "a", "ul", "ol", "li",
        "h1", "h2", "h3", "h4", "blockquote", "pre", "code", "img",
        "hr", "span", "div",
      ],
      ALLOWED_ATTR: ["href", "target", "rel", "src", "alt", "class"],
      ADD_ATTR: ["target"],
    });
  }, [post?.content]);

  const PageLayout: React.FC<{ children: React.ReactNode }> = ({ children }) =>
    adminUser ? (
      <div className="flex min-h-screen bg-white">
        <AdminSidebar currentPage="blogs" />
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    ) : (
      <AppLayout currentPage="blogs">{children}</AppLayout>
    );

  if (loading) {
    return (
      <PageLayout>
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-6 animate-pulse">
          <div className="h-5 bg-gray-200 rounded w-24" />
          <div className="h-64 bg-gray-200 rounded-xl" />
          <div className="h-8 bg-gray-200 rounded w-3/4" />
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => <div key={i} className="h-4 bg-gray-100 rounded" />)}
          </div>
        </div>
      </PageLayout>
    );
  }

  if (notFound || !post) {
    return (
      <PageLayout>
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <p className="text-2xl font-bold text-gray-700">Post not found</p>
          <p className="text-gray-400 mt-2">This post may have been removed or doesn't exist.</p>
          <Button className="mt-6 bg-[#008060] hover:bg-[#006b51]" onClick={() => setLocation("/blogs")}>
            Back to Blogs
          </Button>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Back button */}
        <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-800 -ml-2" onClick={() => setLocation("/blogs")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Blogs
        </Button>

        {/* Admin moderation panel */}
        {isAdmin && post.status === "pending_review" && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-yellow-800">This post is pending review</p>
            {!showRejectForm ? (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={handleApprove}
                  disabled={moderating}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Approve & Publish
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-300 text-red-600 hover:bg-red-50"
                  onClick={() => setShowRejectForm(true)}
                  disabled={moderating}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Reject
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Textarea
                  placeholder="Reason for rejection..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={2}
                  className="text-sm"
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" onClick={handleReject} disabled={moderating}>
                    Confirm Reject
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowRejectForm(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Author edit / admin delete banner */}
        {(isAuthor || isAdmin) && (
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 gap-3 flex-wrap">
            <p className="text-sm text-blue-700 font-medium">
              {isAuthor && post.status === "rejected"
                ? `Rejected${post.rejection_reason ? ` — ${post.rejection_reason}` : ""}`
                : isAuthor && post.status === "draft"
                ? "Draft — not yet published"
                : isAuthor && post.status === "pending_review"
                ? "Pending review"
                : isAuthor && post.status === "published"
                ? "Your published post"
                : isAdmin
                ? `Admin view — status: ${post.status}`
                : ""}
            </p>
            <div className="flex gap-2">
              {isAuthor && (
                <Button size="sm" variant="outline" className="text-blue-700 border-blue-300" onClick={() => setEditorOpen(true)}>
                  <Edit className="h-3.5 w-3.5 mr-1" />
                  Edit Post
                </Button>
              )}
              {isAdmin && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 border-red-300 hover:bg-red-50"
                  onClick={handleAdminDelete}
                >
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                  Delete Post
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Cover image */}
        {post.cover_image && (
          <div className="w-full rounded-xl overflow-hidden bg-gray-100" style={{ maxHeight: "400px" }}>
            <img
              src={post.cover_image}
              alt={post.title}
              className="w-full h-full object-cover"
              style={{ maxHeight: "400px" }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
        )}

        {/* Article header */}
        <div className="space-y-4">
          {/* Category + reading time */}
          <div className="flex flex-wrap items-center gap-2">
            {post.category && (
              <Badge
                className="text-xs"
                style={{ backgroundColor: `${post.category.color}20`, color: post.category.color, border: `1px solid ${post.category.color}40` }}
              >
                {post.category.name}
              </Badge>
            )}
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Clock className="h-3 w-3" />
              {post.reading_time_minutes} min read
            </span>
            {post.views_count > 0 && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Eye className="h-3 w-3" />
                {post.views_count} views
              </span>
            )}
            {post.published_at && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Calendar className="h-3 w-3" />
                {formatDate(post.published_at)}
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-gray-900 leading-tight">{post.title}</h1>

          {/* Author line */}
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarImage src={post.author?.profile_picture} />
              <AvatarFallback className="bg-[#008060]/10 text-[#008060] text-sm font-semibold">
                {`${post.author?.first_name?.[0] || ""}${post.author?.last_name?.[0] || ""}`.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {`${post.author?.first_name || ""} ${post.author?.last_name || ""}`.trim() || post.author?.username}
              </p>
              {post.author?.current_role && (
                <p className="text-xs text-gray-500">{post.author.current_role}</p>
              )}
            </div>
          </div>

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {post.tags.map((tag: string) => (
                <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Excerpt */}
        {post.excerpt && (
          <p className="text-lg text-gray-600 leading-relaxed border-l-4 border-[#008060] pl-4 italic">
            {post.excerpt}
          </p>
        )}

        {/* Content — rendered as sanitized HTML from TipTap */}
        <div
          className="prose prose-gray max-w-none text-base leading-relaxed
            prose-headings:font-bold prose-headings:text-gray-900
            prose-a:text-[#008060] prose-a:underline hover:prose-a:text-[#006b51]
            prose-code:bg-gray-100 prose-code:rounded prose-code:px-1 prose-code:text-sm prose-code:font-mono
            prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:rounded-lg prose-pre:p-4
            prose-blockquote:border-l-4 prose-blockquote:border-[#008060] prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-gray-600
            prose-img:rounded-lg prose-img:max-w-full"
          dangerouslySetInnerHTML={{ __html: safeContent }}
        />

        {/* Action bar */}
        <div className="flex items-center gap-3 py-4 border-t border-b border-gray-100">
          <Button
            variant="ghost"
            size="sm"
            className={`gap-1.5 ${liked ? "text-red-500 hover:text-red-600" : "text-gray-500 hover:text-red-500"}`}
            onClick={handleLike}
          >
            <Heart className={`h-5 w-5 ${liked ? "fill-current" : ""}`} />
            <span>{likesCount}</span>
            <span className="text-xs">Likes</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`gap-1.5 ${bookmarked ? "text-[#008060] hover:text-[#006b51]" : "text-gray-500 hover:text-[#008060]"}`}
            onClick={handleBookmark}
          >
            <Bookmark className={`h-5 w-5 ${bookmarked ? "fill-current" : ""}`} />
            <span className="text-xs">Bookmark</span>
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5 text-gray-500 hover:text-gray-700 ml-auto" onClick={handleShare}>
            <Share2 className="h-5 w-5" />
            <span className="text-xs">Share</span>
          </Button>
        </div>

        {/* Author card */}
        {post.author && <BlogAuthorCard author={post.author} />}

        {/* Comments */}
        <div className="pt-2">
          <BlogCommentsSection
            postId={post.id}
            postSlug={post.slug}
            onCountChange={setCommentsCount}
          />
        </div>
      </div>

      {/* Editor for author to edit their own draft/rejected post */}
      <BlogEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSaved={() => { setEditorOpen(false); fetchPost(); }}
        categories={categories}
        editPost={post}
      />
    </PageLayout>
  );
}
