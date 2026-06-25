import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CornerDownRight, Trash2, Send, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { clientConfig } from "@/lib/config";

interface CommentAuthor {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  profile_picture?: string | null;
}

interface Comment {
  id: string;
  post_id: string;
  parent_id: string | null;
  content: string | null;
  is_active: boolean;
  created_at: string;
  author: CommentAuthor | null;
  replies: Comment[];
}

interface Props {
  postId: string;
}

function getHeaders(userId: string) {
  const token = localStorage.getItem("auth_token") || "";
  return {
    "Content-Type": "application/json",
    "user-id": userId,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function Avatar({ author }: { author: CommentAuthor | null }) {
  const name = author ? [author.first_name, author.last_name].filter(Boolean).join(" ") : "?";
  if (author?.profile_picture) {
    return <img src={author.profile_picture} alt={name} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />;
  }
  return (
    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center flex-shrink-0">
      <span className="text-white text-xs font-semibold">{name.charAt(0).toUpperCase()}</span>
    </div>
  );
}

function CommentItem({
  comment,
  postId,
  userId,
  isAdmin,
  onDeleted,
}: {
  comment: Comment;
  postId: string;
  userId: string;
  isAdmin: boolean;
  onDeleted: () => void;
}) {
  const { toast } = useToast();
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const queryClient = useQueryClient();

  const authorName = comment.author ? [comment.author.first_name, comment.author.last_name].filter(Boolean).join(" ") || "Alumni" : "Alumni";
  const timeAgo = (() => { try { return formatDistanceToNow(new Date(comment.created_at), { addSuffix: true }); } catch { return ""; } })();

  const canDelete = comment.author?.id === userId || isAdmin;

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    try {
      const res = await fetch(`${clientConfig.apiUrl}/api/travel-posts/${postId}/comments/${comment.id}`, {
        method: "DELETE",
        headers: getHeaders(userId),
      });
      if (!res.ok) throw new Error();
      queryClient.invalidateQueries({ queryKey: ["travel-comments", postId] });
      queryClient.invalidateQueries({ queryKey: ["travel-post", postId] });
      onDeleted();
    } catch {
      toast({ title: "Failed to delete comment", variant: "destructive" });
    } finally {
      setConfirmDelete(false);
    }
  }

  async function handleReply() {
    if (!replyText.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${clientConfig.apiUrl}/api/travel-posts/${postId}/comments`, {
        method: "POST",
        headers: getHeaders(userId),
        body: JSON.stringify({ content: replyText.trim(), parent_id: comment.id }),
      });
      if (!res.ok) throw new Error();
      setReplyText("");
      setShowReply(false);
      queryClient.invalidateQueries({ queryKey: ["travel-comments", postId] });
      queryClient.invalidateQueries({ queryKey: ["travel-post", postId] });
    } catch {
      toast({ title: "Failed to post reply", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  if (!comment.is_active && comment.replies.filter((r) => r.is_active).length === 0) return null;

  return (
    <div className="flex gap-3">
      <Avatar author={comment.author} />
      <div className="flex-1 min-w-0">
        {!comment.is_active ? (
          <p className="text-sm text-gray-400 italic">This comment was deleted.</p>
        ) : (
          <>
            <div className="bg-gray-50 rounded-xl px-3 py-2">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-sm font-medium text-gray-900">{authorName}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{timeAgo}</span>
                  {canDelete && (
                    <button
                      onClick={handleDelete}
                      className={`text-xs transition-colors ${confirmDelete ? "text-red-600 font-medium" : "text-gray-400 hover:text-red-500"}`}
                      title={confirmDelete ? "Click again to confirm" : "Delete comment"}
                    >
                      {confirmDelete ? "Confirm delete?" : <Trash2 className="w-3 h-3" />}
                    </button>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{comment.content}</p>
            </div>

            {/* Reply button — only on top-level comments */}
            {!comment.parent_id && (
              <button
                onClick={() => setShowReply((v) => !v)}
                className="mt-1 flex items-center gap-1 text-xs text-gray-500 hover:text-blue-500 transition-colors"
              >
                <CornerDownRight className="w-3 h-3" />
                Reply
              </button>
            )}
          </>
        )}

        {/* Reply input */}
        {showReply && (
          <div className="mt-2 flex gap-2">
            <input
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReply(); } }}
              placeholder="Write a reply…"
              maxLength={2000}
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <button
              onClick={handleReply}
              disabled={submitting || !replyText.trim()}
              className="text-blue-600 hover:text-blue-700 disabled:opacity-40 transition-colors"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        )}

        {/* Nested replies */}
        {comment.replies.length > 0 && (
          <div className="mt-3 space-y-3 pl-2 border-l-2 border-gray-100">
            {comment.replies.filter((r) => r.is_active).map((reply) => (
              <div key={reply.id} className="flex gap-2">
                <Avatar author={reply.author} />
                <div className="flex-1 min-w-0">
                  <div className="bg-gray-50 rounded-xl px-3 py-2">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm font-medium text-gray-900">
                        {reply.author ? [reply.author.first_name, reply.author.last_name].filter(Boolean).join(" ") || "Alumni" : "Alumni"}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">
                          {(() => { try { return formatDistanceToNow(new Date(reply.created_at), { addSuffix: true }); } catch { return ""; } })()}
                        </span>
                        {(reply.author?.id === userId || isAdmin) && (
                          <button
                            onClick={async () => {
                              try {
                                const res = await fetch(`${clientConfig.apiUrl}/api/travel-posts/${postId}/comments/${reply.id}`, {
                                  method: "DELETE", headers: getHeaders(userId),
                                });
                                if (!res.ok) throw new Error();
                                queryClient.invalidateQueries({ queryKey: ["travel-comments", postId] });
                                queryClient.invalidateQueries({ queryKey: ["travel-post", postId] });
                              } catch { toast({ title: "Failed to delete reply", variant: "destructive" }); }
                            }}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{reply.content}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function TravelPostCommentsSection({ postId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const userId = user?.id || localStorage.getItem("userId") || "";
  const isAdmin = (user as any)?.is_admin || (user as any)?.user_role === "administrator";

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["travel-comments", postId],
    queryFn: async () => {
      const res = await fetch(`${clientConfig.apiUrl}/api/travel-posts/${postId}/comments`, {
        headers: getHeaders(userId),
      });
      if (!res.ok) throw new Error("Failed to load comments");
      return res.json() as Promise<Comment[]>;
    },
    staleTime: 30_000,
  });

  async function handleAddComment() {
    if (!newComment.trim() || !userId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${clientConfig.apiUrl}/api/travel-posts/${postId}/comments`, {
        method: "POST",
        headers: getHeaders(userId),
        body: JSON.stringify({ content: newComment.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to post");
      }
      setNewComment("");
      queryClient.invalidateQueries({ queryKey: ["travel-comments", postId] });
      queryClient.invalidateQueries({ queryKey: ["travel-post", postId] });
    } catch (err: any) {
      toast({ title: err.message || "Failed to post comment", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-gray-900">
        Comments {comments.length > 0 && <span className="text-gray-400 font-normal">({comments.length})</span>}
      </h3>

      {/* New comment input */}
      <div className="flex gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center flex-shrink-0">
          <span className="text-white text-xs font-semibold">
            {((user as any)?.alumni?.first_name || (user as any)?.first_name || "Y").charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 flex gap-2">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
            placeholder="Write a comment…"
            rows={1}
            maxLength={2000}
            className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <button
            onClick={handleAddComment}
            disabled={submitting || !newComment.trim()}
            className="text-blue-600 hover:text-blue-700 disabled:opacity-40 transition-colors self-end mb-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Comments list */}
      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No comments yet. Be the first to comment!</p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              postId={postId}
              userId={userId}
              isAdmin={isAdmin}
              onDeleted={() => {}}
            />
          ))}
        </div>
      )}
    </div>
  );
}
