import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { TravelPostMediaGallery } from "@/components/travel/TravelPostMediaGallery";
import { TravelPostCommentsSection } from "@/components/travel/TravelPostCommentsSection";
import { TravelPostCreateModal } from "@/components/travel/TravelPostCreateModal";
import { useTravelPostLike } from "@/hooks/useTravelPostLike";
import { useTravelPostBookmark } from "@/hooks/useTravelPostBookmark";
import {
  ArrowLeft, MapPin, Heart, MessageCircle, Bookmark, Share2, ExternalLink, Loader2,
  Globe, Edit2, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow, format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { clientConfig } from "@/lib/config";

function getHeaders() {
  const token = localStorage.getItem("auth_token") || "";
  return {
    "Content-Type": "application/json",
    "user-id": localStorage.getItem("userId") || "",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export default function TravelChapterPage() {
  const [match, params] = useRoute("/travel-journal/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const postId = params?.id ?? "";

  const { data: post, isLoading, isError } = useQuery({
    queryKey: ["travel-post", postId],
    queryFn: async () => {
      const res = await fetch(`${clientConfig.apiUrl}/api/travel-posts/${postId}`, { headers: getHeaders() });
      if (!res.ok) throw new Error("Post not found");
      return res.json();
    },
    enabled: !!postId,
    staleTime: 30_000,
  });

  const likeMutation = useTravelPostLike(postId);
  const bookmarkMutation = useTravelPostBookmark(postId);

  const userId = user?.id || localStorage.getItem("userId") || "";
  const isAdmin = (user as any)?.is_admin || (user as any)?.user_role === "administrator";
  const isAuthor = post?.author_id === userId;

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${clientConfig.apiUrl}/api/travel-posts/${postId}`, {
        method: "DELETE",
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error("Failed to delete post");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["travel-posts"] });
      toast({ title: "Post deleted" });
      navigate("/travel-journal");
    },
    onError: () => toast({ title: "Failed to delete post", variant: "destructive" }),
  });

  function handleShare() {
    const url = `${window.location.origin}/travel-journal/${postId}`;
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

  if (!match) return null;

  return (
    <AppLayout currentPage="travel-journal">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Back button */}
        <button
          onClick={() => navigate("/travel-journal")}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Travel Journal
        </button>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : isError || !post ? (
          <div className="text-center py-20">
            <Globe className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">Post not found or has been removed.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/travel-journal")}>
              Back to Feed
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Author + date */}
            <div className="flex items-center gap-3">
              {post.author?.profile_picture ? (
                <img src={post.author.profile_picture} alt="author" className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
                  <span className="text-white font-semibold text-sm">
                    {(post.author?.first_name || "A").charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex-1">
                <p className="font-medium text-gray-900 text-sm">
                  {[post.author?.first_name, post.author?.last_name].filter(Boolean).join(" ") || "Alumni"}
                </p>
                <p className="text-xs text-gray-500">
                  {post.author?.current_role && <span className="mr-1">{post.author.current_role} ·</span>}
                  {(() => { try { return formatDistanceToNow(new Date(post.created_at), { addSuffix: true }); } catch { return ""; } })()}
                </p>
              </div>
              {isAuthor && (
                <button
                  onClick={() => setShowEdit(true)}
                  className="p-1.5 rounded-full text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                  title="Edit post"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
              {(isAuthor || isAdmin) && (
                <button
                  onClick={() => {
                    if (!confirmDelete) { setConfirmDelete(true); return; }
                    deleteMutation.mutate();
                  }}
                  className={`p-1.5 rounded-full transition-colors ${confirmDelete ? "text-red-600 bg-red-50" : "text-gray-400 hover:text-red-500"}`}
                  title={confirmDelete ? "Click again to confirm delete" : "Delete post"}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              )}
            </div>

            {/* Location */}
            <div className="flex items-center gap-1.5 text-sm text-gray-600">
              <MapPin className="w-4 h-4 text-blue-500 flex-shrink-0" />
              <span className="font-medium">{post.city}, {post.country}</span>
            </div>

            {/* Media gallery */}
            {post.media?.length > 0 && (
              <TravelPostMediaGallery media={post.media} />
            )}

            {/* No media placeholder */}
            {(!post.media || post.media.length === 0) && (
              <div className="aspect-video bg-gradient-to-br from-blue-400 to-indigo-600 rounded-xl flex items-center justify-center">
                <div className="text-center text-white">
                  <MapPin className="w-12 h-12 mx-auto mb-2 opacity-80" />
                  <span className="text-2xl font-semibold">{post.city}</span>
                </div>
              </div>
            )}

            {/* Caption */}
            {post.caption && (
              <div>
                <p className="text-gray-800 whitespace-pre-wrap text-sm leading-relaxed">{post.caption}</p>
              </div>
            )}

            {/* Action row */}
            <div className="flex items-center gap-4 text-sm py-2 border-t border-b border-gray-100">
              <button
                onClick={() => likeMutation.mutate()}
                className={`flex items-center gap-1.5 transition-colors ${post.viewer_has_liked ? "text-red-500" : "text-gray-500 hover:text-red-400"}`}
                disabled={likeMutation.isPending}
              >
                <Heart className={`w-4 h-4 ${post.viewer_has_liked ? "fill-red-500" : ""}`} />
                <span>{post.likes_count} likes</span>
              </button>
              <button
                onClick={() => document.getElementById("comments-section")?.scrollIntoView({ behavior: "smooth" })}
                className="flex items-center gap-1.5 text-gray-500 hover:text-blue-500 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span>{post.comments_count} comments</span>
              </button>
              <button
                onClick={() => bookmarkMutation.mutate()}
                className={`flex items-center gap-1.5 transition-colors ${post.viewer_has_bookmarked ? "text-blue-500" : "text-gray-500 hover:text-blue-400"}`}
                disabled={bookmarkMutation.isPending}
              >
                <Bookmark className={`w-4 h-4 ${post.viewer_has_bookmarked ? "fill-blue-500" : ""}`} />
                <span>{post.bookmarks_count} saves</span>
              </button>
              <button
                onClick={handleShare}
                className="flex items-center gap-1.5 text-gray-500 hover:text-green-500 transition-colors"
              >
                <Share2 className="w-4 h-4" />
              </button>
              <span className="ml-auto text-xs text-gray-400">{post.views_count} views</span>
            </div>

            {/* Links section */}
            {post.links?.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-900">Related Links</h3>
                <div className="space-y-2">
                  {post.links.map((link: any) => (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-3 p-3 border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200 transition-colors">
                        <ExternalLink className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{link.title}</p>
                        {link.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{link.description}</p>}
                        <p className="text-xs text-blue-500 truncate mt-0.5">{link.url}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Comments */}
            <div id="comments-section" className="pt-2">
              <TravelPostCommentsSection postId={postId} postStatus={post?.status} />
            </div>

            {/* Confirm delete note */}
            {confirmDelete && (
              <div className="fixed inset-x-0 bottom-0 z-50 p-4 bg-white border-t border-red-200 shadow-lg flex items-center justify-between">
                <p className="text-sm text-red-700 font-medium">Delete this post permanently?</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                  <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
                    {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit modal — only rendered when author clicks Edit */}
      {post && showEdit && (
        <TravelPostCreateModal
          open={showEdit}
          editPost={{
            id: post.id,
            city: post.city,
            country: post.country,
            coordinates: post.coordinates,
            caption: post.caption,
            status: post.status ?? "approved",
            media: post.media ?? [],
            links: post.links ?? [],
          }}
          onClose={() => setShowEdit(false)}
          onCreated={() => {
            setShowEdit(false);
            queryClient.invalidateQueries({ queryKey: ["travel-post", postId] });
            queryClient.invalidateQueries({ queryKey: ["travel-posts"] });
            queryClient.invalidateQueries({ queryKey: ["travel-my-posts"] });
          }}
        />
      )}
    </AppLayout>
  );
}
