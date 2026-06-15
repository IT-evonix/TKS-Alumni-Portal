import React, { useState, useEffect } from "react";
import { MessageCircle, Trash2, Reply, Send } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { clientConfig } from "@/lib/config";

interface BlogCommentsSectionProps {
  postId: string;
  postSlug: string;
  onCountChange?: (count: number) => void;
}

function CommentItem({
  comment,
  onDelete,
  onReply,
  currentUserId,
  isAdmin,
  topLevelId,
}: {
  comment: any;
  onDelete: (id: string, postId: string) => void;
  onReply: (parentId: string, content: string) => Promise<void>;
  currentUserId?: string;
  isAdmin: boolean;
  topLevelId?: string;
}) {
  const [showReply, setShowReply] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // For nested replies, always use the top-level comment's ID as parent (server only supports one level deep)
  const effectiveParentId = topLevelId || comment.id;

  const authorName =
    comment.author
      ? `${comment.author.first_name || ""} ${comment.author.last_name || ""}`.trim() || comment.author.username
      : "Unknown";
  const initials = authorName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  const handleReplySubmit = async () => {
    if (!replyContent.trim()) return;
    setSubmitting(true);
    try {
      await onReply(effectiveParentId, replyContent.trim());
      setReplyContent("");
      setShowReply(false);
    } finally {
      setSubmitting(false);
    }
  };

  const canDelete = isAdmin || comment.author_id === currentUserId;

  return (
    <div className="flex gap-3">
      <Avatar className="h-8 w-8 flex-shrink-0 mt-0.5">
        <AvatarImage src={comment.author?.profile_picture} />
        <AvatarFallback className="text-xs bg-[#008060]/10 text-[#008060]">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="bg-gray-50 rounded-xl px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-gray-900">{authorName}</p>
            <span className="text-xs text-gray-400">
              {new Date(comment.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          </div>
          <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap">{comment.content}</p>
        </div>
        <div className="flex items-center gap-3 mt-1 ml-1">
          {currentUserId && (
            <button
              onClick={() => setShowReply(!showReply)}
              className="text-xs text-gray-400 hover:text-[#008060] flex items-center gap-1"
            >
              <Reply className="h-3 w-3" />
              Reply
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => onDelete(comment.id, comment.post_id)}
              className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1"
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </button>
          )}
        </div>

        {/* Reply form */}
        {showReply && (
          <div className="mt-2 flex gap-2">
            <Textarea
              placeholder="Write a reply..."
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              rows={2}
              className="text-sm flex-1 min-h-[60px]"
            />
            <div className="flex flex-col gap-1">
              <Button
                size="sm"
                className="bg-[#008060] hover:bg-[#006b51] h-7 px-2"
                onClick={handleReplySubmit}
                disabled={submitting || !replyContent.trim()}
              >
                <Send className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setShowReply(false)}>
                ✕
              </Button>
            </div>
          </div>
        )}

        {/* Nested replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-3 space-y-3 pl-4 border-l-2 border-gray-100">
            {comment.replies.map((reply: any) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                onDelete={onDelete}
                onReply={onReply}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                topLevelId={comment.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function BlogCommentsSection({ postId, postSlug, onCountChange }: BlogCommentsSectionProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = user?.user_role === "administrator" || (user as any)?.is_admin;

  const getHeaders = () => {
    const token = localStorage.getItem("auth_token") || "";
    return {
      "Content-Type": "application/json",
      "user-id": user?.id || localStorage.getItem("userId") || "",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  useEffect(() => {
    fetchComments();
  }, [postSlug]);

  const fetchComments = async () => {
    try {
      const res = await fetch(`${clientConfig.apiUrl}/api/blogs/${postSlug}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data);
        onCountChange?.(data.reduce((acc: number, c: any) => acc + 1 + (c.replies?.length || 0), 0));
      }
    } catch (e) {
      console.error("Failed to fetch comments", e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !user) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${clientConfig.apiUrl}/api/blogs/${postId}/comments`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ content: newComment.trim() }),
      });
      if (!res.ok) throw new Error();
      const comment = await res.json();
      setComments((prev) => [comment, ...prev]);
      setNewComment("");
      onCountChange?.(comments.length + 1);
    } catch {
      toast({ title: "Failed to post comment", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (parentId: string, content: string) => {
    if (!user) return;
    const res = await fetch(`${clientConfig.apiUrl}/api/blogs/${postId}/comments`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ content, parent_id: parentId }),
    });
    if (!res.ok) throw new Error("Failed to reply");
    const reply = await res.json();
    setComments((prev) =>
      prev.map((c) =>
        c.id === parentId ? { ...c, replies: [...(c.replies || []), reply] } : c
      )
    );
  };

  const handleDelete = async (commentId: string, _postId: string) => {
    try {
      const res = await fetch(`${clientConfig.apiUrl}/api/blogs/comments/${commentId}`, {
        method: "DELETE",
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error();
      setComments((prev) =>
        prev
          .filter((c) => c.id !== commentId)
          .map((c) => ({ ...c, replies: (c.replies || []).filter((r: any) => r.id !== commentId) }))
      );
    } catch {
      toast({ title: "Failed to delete comment", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-gray-500" />
        <h3 className="font-semibold text-gray-900">Comments ({comments.length})</h3>
      </div>

      {/* New comment form */}
      {user ? (
        <div className="flex gap-3">
          <Avatar className="h-8 w-8 flex-shrink-0 mt-0.5">
            <AvatarImage src={(user as any).profile_picture} />
            <AvatarFallback className="text-xs bg-[#008060]/10 text-[#008060]">
              {(user as any).username?.[0]?.toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-2">
            <Textarea
              placeholder="Write a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                className="bg-[#008060] hover:bg-[#006b51]"
                onClick={handleAddComment}
                disabled={submitting || !newComment.trim()}
              >
                <Send className="h-4 w-4 mr-2" />
                Post Comment
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500 bg-gray-50 rounded-lg p-4 text-center">
          Sign in to leave a comment.
        </p>
      )}

      {/* Comments list */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="h-8 w-8 rounded-full bg-gray-200 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/4" />
                <div className="h-12 bg-gray-100 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No comments yet. Be the first!</p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onDelete={handleDelete}
              onReply={handleReply}
              currentUserId={user?.id}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}
    </div>
  );
}
