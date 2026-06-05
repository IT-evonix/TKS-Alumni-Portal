import React, { useState, useEffect, useRef, memo } from "react";
import { useLocation } from "wouter";
import { Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatTimeAgo } from "@/lib/dateUtils";
import { useAuth } from "@/contexts/AuthContext";
import { OptimizedImage } from "@/components/common/OptimizedImage";

interface CommentReply {
  id: string;
  content: string;
  created_at: string;
  user: {
    id: string;
    username: string;
    email: string;
  };
  user_first_name?: string;
  user_last_name?: string;
  user_profile_picture?: string;
  user_gender?: string;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  replies_count?: number;
  user: {
    id: string;
    username: string;
    email: string;
  };
  user_first_name?: string;
  user_last_name?: string;
  user_profile_picture?: string;
  user_gender?: string;
}

interface PostCardProps {
  post: {
    id: string;
    author: {
      username: string;
      email: string;
    };
    content: string;
    image_url?: string;
    likes_count: number;
    comments_count: number;
    created_at: string;
    isLikedByUser?: boolean;
  };
  isLiked: boolean;
  isExpanded: boolean;
  showComments: boolean;
  commentText: string;
  onLike: () => void;
  onComment: () => void;
  onReadMore: () => void;
  onPostComment: () => void;
  onCommentTextChange: (text: string) => void;
  onOptionsClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  showOptions: boolean;
}

const PostCardComponent: React.FC<PostCardProps> = ({
  post,
  isLiked,
  isExpanded,
  showComments,
  commentText,
  onLike,
  onComment,
  onReadMore,
  onPostComment,
  onCommentTextChange,
  onOptionsClick,
  onEdit,
  onDelete,
  showOptions,
}) => {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { adminUser, user } = useAuth();
  const currentUserId = localStorage.getItem('userId');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm("Delete this comment?")) return;
    try {
      // Use adminUser ID if in admin context, otherwise use regular user ID
      const userId = adminUser?.id || user?.id || currentUserId || '';
      const response = await fetch(`/api/posts/${post.id}/comments/${commentId}`, {
        method: 'DELETE',
        headers: { 'user-id': userId }
      });

      if (response.ok) {
        setComments(prev => prev.filter(c => c.id !== commentId));
        toast({
          title: "Success",
          description: "Comment deleted",
        });
      } else {
        throw new Error('Failed to delete');
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to delete comment",
        variant: "destructive",
      });
    }
  };

  const handleDeleteReply = async (commentId: string, replyId: string) => {
    if (!window.confirm("Delete this reply?")) return;
    try {
      // Use adminUser ID if in admin context, otherwise use regular user ID
      const userId = adminUser?.id || user?.id || currentUserId || '';
      const response = await fetch(`/api/comments/${commentId}/replies/${replyId}`, {
        method: 'DELETE',
        headers: { 'user-id': userId }
      });

      if (response.ok) {
        setCommentReplies(prev => ({
          ...prev,
          [commentId]: prev[commentId].filter(r => r.id !== replyId)
        }));

        setComments(prev => prev.map(c =>
          c.id === commentId
            ? { ...c, replies_count: Math.max(0, (c.replies_count || 0) - 1) }
            : c
        ));

        toast({
          title: "Success",
          description: "Reply deleted",
        });
      } else {
        throw new Error('Failed to delete');
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to delete reply",
        variant: "destructive",
      });
    }
  };

  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(post.content);
  const [_currentTime, setCurrentTime] = useState(new Date());

  // Reply states
  const [showReplies, setShowReplies] = useState<Set<string>>(new Set());
  const [commentReplies, setCommentReplies] = useState<{ [key: string]: CommentReply[] }>({});
  const [replyTexts, setReplyTexts] = useState<{ [key: string]: string }>({});
  const [loadingReplies, setLoadingReplies] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (showComments) {
      fetchComments();
    }
  }, [showComments, post.id]);

  // Close dropdown menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        if (showOptions) {
          onOptionsClick();
        }
      }
    };

    if (showOptions) {
      // Add event listener when menu is open
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      // Cleanup event listener
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showOptions, onOptionsClick]);

  // Auto-fetch replies for comments that have replies when comments change
  useEffect(() => {
    if (comments.length > 0) {
      comments.forEach((comment) => {
        if ((comment.replies_count || 0) > 0 && !commentReplies[comment.id]) {
          // Auto-show and fetch replies for comments that have them
          setShowReplies((prev: Set<string>) => new Set(Array.from(prev).concat(comment.id)));
          fetchReplies(comment.id);
        }
      });
    }
  }, [comments]);

  // Update current time to refresh timestamps for recent posts
  useEffect(() => {
    const now = new Date();
    const posted = new Date(post.created_at);
    const diffMs = now.getTime() - posted.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    // Only update timestamps frequently for recent posts (less than 60 minutes old)
    if (diffMinutes < 60) {
      const interval = setInterval(() => {
        setCurrentTime(new Date());
      }, 1000); // Update every second for posts less than an hour old

      return () => clearInterval(interval);
    } else if (diffMinutes < 1440) {
      // Update every minute for posts less than 24 hours old
      const interval = setInterval(() => {
        setCurrentTime(new Date());
      }, 60000);

      return () => clearInterval(interval);
    }
  }, [post.created_at]);

  const fetchComments = async () => {
    try {
      setIsLoadingComments(true);
      const response = await fetch(`/api/posts/${post.id}/comments`);

      if (!response.ok) {
        throw new Error('Failed to fetch comments');
      }

      const data = await response.json();
      setComments(data.comments || []);
    } catch (error) {
    } finally {
      setIsLoadingComments(false);
    }
  };

  const fetchReplies = async (commentId: string) => {
    try {
      setLoadingReplies((prev: Set<string>) => new Set(Array.from(prev).concat(commentId)));
      const response = await fetch(`/api/comments/${commentId}/replies`);

      if (!response.ok) {
        throw new Error('Failed to fetch replies');
      }

      const data = await response.json();
      setCommentReplies(prev => ({ ...prev, [commentId]: data.replies || [] }));
    } catch (error) {
    } finally {
      setLoadingReplies(prev => {
        const newSet = new Set(prev);
        newSet.delete(commentId);
        return newSet;
      });
    }
  };

  const handleToggleReplies = async (commentId: string) => {
    const isShowing = showReplies.has(commentId);

    setShowReplies(prev => {
      const newSet = new Set(prev);
      if (isShowing) {
        newSet.delete(commentId);
      } else {
        newSet.add(commentId);
      }
      return newSet;
    });

    // Fetch replies if showing and not already loaded
    if (!isShowing && !commentReplies[commentId]) {
      await fetchReplies(commentId);
    }
  };

  const handlePostReply = async (commentId: string) => {
    const replyText = replyTexts[commentId];
    if (!replyText?.trim()) return;

    try {
      // Use adminUser ID if in admin context, otherwise use regular user ID
      const userId = adminUser?.id || user?.id || currentUserId || '';
      const response = await fetch(`/api/comments/${commentId}/replies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-id': userId,
        },
        body: JSON.stringify({
          content: replyText.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to post reply');
      }

      // Remove reply input (close the reply box)
      const { [commentId]: _discard, ...rest } = replyTexts;
      setReplyTexts(rest);

      // Update replies count in comment
      setComments(prev => prev.map(c =>
        c.id === commentId
          ? { ...c, replies_count: (c.replies_count || 0) + 1 }
          : c
      ));

      // Automatically show replies after posting
      if (!showReplies.has(commentId)) {
        setShowReplies((prev: Set<string>) => new Set(Array.from(prev).concat(commentId)));
      }

      // Refresh replies to show the new one
      await fetchReplies(commentId);

      toast({
        title: "Reply posted",
        description: "Your reply has been added.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to post reply. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handlePostComment = async () => {
    await onPostComment();
    // Refresh comments after posting
    fetchComments();
  };

  const handleEditSubmit = async () => {
    if (!editedContent.trim()) {
      toast({
        title: "Error",
        description: "Post content cannot be empty",
        variant: "destructive"
      });
      return;
    }

    try {
      // Use adminUser ID if in admin context, otherwise use regular user ID
      const userId = adminUser?.id || user?.id || currentUserId || '';
      const response = await fetch(`/api/posts/${post.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'user-id': userId
        },
        body: JSON.stringify({
          content: editedContent,
          imageUrl: post.image_url
        })
      });

      if (response.ok) {
        const _updatedPost = await response.json();
        toast({
          title: "Success",
          description: "Post updated successfully"
        });
        setIsEditing(false);
        // Update post content locally without page refresh
        if (onEdit) {
          onEdit();
        }
        // Emit custom event for real-time update
        window.dispatchEvent(new CustomEvent('post-updated', { 
          detail: { postId: post.id, content: editedContent } 
        }));
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to update post",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update post",
        variant: "destructive"
      });
    }
  };

  const handleEditCancel = () => {
    setEditedContent(post.content);
    setIsEditing(false);
  };

  // Check if the author is an admin
  const isAdminPost = (post as any).author?.email === 'kalyani@evonix.co' ||
    (post as any).author?.is_admin ||
    (post as any).author_role === 'administrator';

  // Check if current user is an admin (either adminUser or user with admin role)
  const isCurrentUserAdmin = adminUser?.is_admin || adminUser?.user_role === 'administrator' ||
    user?.is_admin || user?.user_role === 'administrator';

  const authorName = isAdminPost
    ? "The Kalyani School"
    : (post as any).author_first_name
      ? `${(post as any).author_first_name} ${(post as any).author_last_name || ''}`.trim()
      : post.author.username;

  const getAuthorProfilePicture = () => {
    if ((post as any).author_profile_picture && (post as any).author_profile_picture.trim() !== '') {
      return (post as any).author_profile_picture;
    }

    const seed = encodeURIComponent(authorName);
    const gender = (post as any).author_gender;

    switch (gender) {
      case 'male':
        return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=008060`;
      case 'female':
        return `https://api.dicebear.com/7.x/avataaars-neutral/svg?seed=${seed}&backgroundColor=ff69b4`;
      case 'other':
        return `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}&backgroundColor=ffa500`;
      case 'prefer_not_to_say':
        return `https://api.dicebear.com/7.x/initials/svg?seed=${seed}&backgroundColor=6c63ff`;
      default:
        return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=008060`;
    }
  };

  // Helper function to copy text to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Link copied!",
        description: "Share link copied to clipboard",
      });
    }).catch(err => {
      toast({
        title: "Error",
        description: "Failed to copy link",
        variant: "destructive"
      });
    });
  };

  const handleShare = async () => {
    // Ensure we only use the post ID, not the entire content
    const postId = post.id.split(' ')[0]; // Take only the first part before any space
    const shareUrl = `${window.location.origin}/post/${postId}`;
    const shareText = `Check out this post by ${authorName}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareText,
          text: post.content.substring(0, 100),
          url: shareUrl,
        });

        toast({
          title: "Shared!",
          description: "Post shared successfully",
        });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          copyToClipboard(shareUrl);
        }
      }
    } else {
      copyToClipboard(shareUrl);
    }
  };

  return (
    <Card id={`post-${post.id}`} className="bg-white rounded-xl sm:rounded-2xl border border-gray-200 shadow-sm sm:shadow-md hover:shadow-xl transition-all duration-300 hover:scale-[1.005] sm:hover:scale-[1.01] max-w-full overflow-hidden">
      <CardContent className="p-4 sm:p-6 md:p-8">
        <div className="flex items-start gap-3 sm:gap-4 mb-3 sm:mb-4">
          <Avatar
            className="w-10 h-10 sm:w-12 sm:h-12 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setLocation(`/profile/${(post as any).author_id}`)}
          >
            <AvatarImage
              src={getAuthorProfilePicture()}
              alt={authorName}
            />
            <AvatarFallback className="bg-[#008060] text-white">
              {authorName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h4
              className="font-semibold text-gray-900 text-base sm:text-lg cursor-pointer hover:text-[#008060] hover:underline transition-colors w-fit truncate max-w-full"
              onClick={() => setLocation(`/profile/${(post as any).author_id}`)}
            >
              {authorName}
            </h4>
            <p className="text-xs sm:text-sm text-gray-600 mb-0.5 sm:mb-1 truncate">
              {isAdminPost ? (
                <span className="text-[#008060] font-medium flex items-center gap-1">
                  <span>Administrator</span>
                  <span className="bg-[#008060]/10 text-[#008060] text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold">Official</span>
                </span>
              ) : (
                post.author.email
              )}
            </p>
            <p className="text-[10px] sm:text-xs text-gray-500">{formatTimeAgo(post.created_at)}</p>
          </div>
          {(() => {
            const isAuthor = (post as any).author_id === currentUserId;
            // Show edit/delete options if:
            // 1. User is the author of the post, OR
            // 2. Current user is an admin AND the post is an admin post
            const canEditDelete = isAuthor || (isCurrentUserAdmin && isAdminPost);

            return canEditDelete ? (
              <div className="relative" ref={dropdownRef}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-gray-400 hover:text-gray-600 h-8 w-8 sm:h-10 sm:w-10"
                  onClick={onOptionsClick}
                >
                  <span className="text-lg sm:text-xl">⋯</span>
                </Button>

                {showOptions && (
                  <div className="absolute right-0 top-8 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                    <div className="py-1">
                      <button
                        onClick={() => {
                          setIsEditing(true);
                          onOptionsClick(); // Close menu
                        }}
                        className="w-full text-left px-4 py-3 sm:py-2 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 min-h-[44px]"
                      >
                        Edit Post
                      </button>
                      <button
                        onClick={onDelete}
                        className="w-full text-left px-4 py-3 sm:py-2 text-sm text-red-600 hover:bg-gray-50 active:bg-gray-100 min-h-[44px]"
                      >
                        Delete Post
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : null;
          })()}
        </div>

        <div className="mb-4 sm:mb-6">
          {isEditing ? (
            <div className="space-y-3">
              <Textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="min-h-[100px] resize-none text-base"
                placeholder="What's on your mind?"
              />
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEditCancel}
                  className="min-h-[40px]"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleEditSubmit}
                  className="bg-[#008060] hover:bg-[#007055] min-h-[40px]"
                >
                  Save Changes
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className={`text-gray-800 leading-relaxed text-sm sm:text-base mb-3 sm:mb-4 break-words whitespace-pre-wrap ${!isExpanded && post.content.length > 200 ? 'line-clamp-4' : ''}`}>
                {post.content}
              </div>
              {post.content.length > 200 && (
                <button
                  onClick={onReadMore}
                  className="text-[#008060] hover:text-[#007055] text-sm font-medium mb-4 p-1 -ml-1"
                >
                  {isExpanded ? 'Show Less' : 'Read Full Post'}
                </button>
              )}
            </>
          )}

          {/* Display attached file */}
          {post.image_url && (
            <div className="mb-4 rounded-lg overflow-hidden bg-gray-50/50 border border-gray-100 max-w-full">
              {post.image_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                <OptimizedImage
                  src={post.image_url}
                  alt="Post attachment"
                  className="w-full h-auto object-cover sm:object-contain max-h-[400px] sm:max-h-[500px] md:max-h-[600px] mx-auto"
                  loading="lazy"
                  responsive={true}
                  quality={85}
                />
              ) : post.image_url.match(/\.(mp4|webm)$/i) ? (
                <video
                  src={post.image_url}
                  controls
                  className="w-full h-auto max-h-[400px] sm:max-h-[500px] md:max-h-[600px] mx-auto"
                  style={{ maxWidth: '100%' }}
                />
              ) : (
                <a
                  href={post.image_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-white rounded-lg hover:bg-gray-100 w-full min-h-[50px]"
                >
                  <span className="text-2xl">📄</span>
                  <span className="text-sm text-gray-700 truncate">View attached document</span>
                </a>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-3 sm:pt-4 border-t border-gray-50">
          <div className="flex items-center gap-4 sm:gap-6 w-full sm:w-auto justify-between sm:justify-start">
            <button
              onClick={onLike}
              className={`flex items-center gap-1.5 sm:gap-2 transition-all duration-200 transform active:scale-125 p-2 -ml-2 rounded-lg hover:bg-gray-50 ${isLiked
                ? 'text-red-500'
                : 'text-gray-600 hover:text-red-500'
                }`}
            >
              <span className="text-xl sm:text-lg">{isLiked ? '❤️' : '🤍'}</span>
              <span className="text-sm font-medium">
                {post.likes_count}
              </span>
            </button>
            <button
              onClick={onComment}
              className="flex items-center gap-1.5 sm:gap-2 text-gray-600 hover:text-[#008060] transition-all duration-200 transform active:scale-110 p-2 rounded-lg hover:bg-gray-50"
            >
              <span className="text-xl sm:text-lg">💬</span>
              <span className="text-sm font-medium">{post.comments_count}</span>
            </button>
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 sm:gap-2 text-gray-600 hover:text-[#008060] transition-all duration-200 transform active:scale-110 p-2 rounded-lg hover:bg-gray-50"
            >
              <span className="text-xl sm:text-lg">🔗</span>
              <span className="text-sm font-medium">Share</span>
            </button>
          </div>
          {post.content.length > 200 && (
            <button
              onClick={onReadMore}
              className="text-[#008060] hover:text-[#007055] text-sm font-medium"
            >
              {isExpanded ? 'Show Less' : 'Read Full Post'}
            </button>
          )}
        </div>

        {showComments && (
          <div className="mt-6 pt-6 border-t border-gray-100">
            {/* Comment input */}
            <div className="flex items-center gap-2 mb-4">
              <Avatar className="w-8 h-8">
                <AvatarImage src={getAuthorProfilePicture()} alt="Current user" />
                <AvatarFallback className="bg-[#008060] text-white">
                  {authorName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <Input
                placeholder="Write a comment..."
                value={commentText}
                onChange={(e) => onCommentTextChange(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handlePostComment()}
                className="flex-1 text-sm"
              />
              <Button
                size="sm"
                onClick={handlePostComment}
                disabled={!commentText?.trim()}
                className="bg-[#008060] hover:bg-[#007055] disabled:opacity-50"
              >
                Post
              </Button>
            </div>

            {/* Comments list */}
            {isLoadingComments ? (
              <div className="text-center py-4">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[#008060]"></div>
              </div>
            ) : comments.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {comments.map((comment) => {
                  const commentAuthorName = comment.user_first_name
                    ? `${comment.user_first_name} ${comment.user_last_name || ''}`.trim()
                    : comment.user.username;

                  const getCommentAuthorAvatar = () => {
                    if (comment.user_profile_picture && comment.user_profile_picture.trim() !== '') {
                      return comment.user_profile_picture;
                    }

                    const seed = encodeURIComponent(commentAuthorName);
                    const gender = comment.user_gender;

                    switch (gender) {
                      case 'male':
                        return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=008060`;
                      case 'female':
                        return `https://api.dicebear.com/7.x/avataaars-neutral/svg?seed=${seed}&backgroundColor=ff69b4`;
                      case 'other':
                        return `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}&backgroundColor=ffa500`;
                      case 'prefer_not_to_say':
                        return `https://api.dicebear.com/7.x/initials/svg?seed=${seed}&backgroundColor=6c63ff`;
                      default:
                        return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=008060`;
                    }
                  };

                  const commentTimeAgo = formatTimeAgo(comment.created_at);

                  const replies = commentReplies[comment.id] || [];
                  const hasReplies = (comment.replies_count || 0) > 0;

                  return (
                    <div key={comment.id} className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200 border border-gray-100">
                      <div className="flex items-start gap-2">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={getCommentAuthorAvatar()} alt={commentAuthorName} />
                          <AvatarFallback className="bg-[#008060] text-white">
                            {commentAuthorName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-gray-900">{commentAuthorName}</span>
                              <span className="text-xs text-gray-500">{commentTimeAgo}</span>
                            </div>
                            {comment.user.id === currentUserId && (
                              <button
                                onClick={() => handleDeleteComment(comment.id)}
                                className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                title="Delete comment"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <p className="text-sm text-gray-700 mb-2">{comment.content}</p>

                          {/* Reply button */}
                          <div className="flex items-center gap-3 text-xs">
                            <button
                              onClick={() => {
                                const currentValue = replyTexts[comment.id];
                                if (currentValue !== undefined) {
                                  // Hide reply input
                                  const { [comment.id]: _discard, ...rest } = replyTexts;
                                  setReplyTexts(rest);
                                } else {
                                  // Show reply input
                                  setReplyTexts(prev => ({
                                    ...prev,
                                    [comment.id]: ''
                                  }));
                                }
                              }}
                              className="text-[#008060] hover:text-[#007055] font-medium"
                            >
                              {replyTexts[comment.id] !== undefined ? 'Cancel' : 'Reply'}
                            </button>

                            {hasReplies && (
                              <button
                                onClick={() => handleToggleReplies(comment.id)}
                                className="text-gray-600 hover:text-gray-800 font-medium flex items-center gap-1"
                              >
                                {showReplies.has(comment.id) ? '▼' : '▶'}
                                {comment.replies_count} {comment.replies_count === 1 ? 'reply' : 'replies'}
                              </button>
                            )}
                          </div>

                          {/* Reply input */}
                          {replyTexts[comment.id] !== undefined && (
                            <div className="mt-2 flex items-center gap-2">
                              <Avatar className="w-6 h-6">
                                <AvatarImage src={getAuthorProfilePicture()} alt="You" />
                                <AvatarFallback className="bg-[#008060] text-white text-xs">
                                  {authorName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              <Input
                                placeholder="Write a reply..."
                                value={replyTexts[comment.id] || ''}
                                onChange={(e) => setReplyTexts(prev => ({ ...prev, [comment.id]: e.target.value }))}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handlePostReply(comment.id);
                                  }
                                }}
                                className="text-xs h-8 flex-1"
                                autoFocus
                              />
                              <Button
                                size="sm"
                                onClick={() => handlePostReply(comment.id)}
                                disabled={!replyTexts[comment.id]?.trim()}
                                className="bg-[#008060] hover:bg-[#007055] h-8 px-3 text-xs"
                              >
                                Post
                              </Button>
                            </div>
                          )}

                          {/* Replies list */}
                          {showReplies.has(comment.id) && (
                            <div className="mt-3 ml-4 space-y-2 border-l-2 border-gray-200 pl-3">
                              {loadingReplies.has(comment.id) ? (
                                <div className="text-center py-2">
                                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-[#008060]"></div>
                                </div>
                              ) : replies.length > 0 ? (
                                replies.map((reply) => {
                                  const replyAuthorName = reply.user_first_name
                                    ? `${reply.user_first_name} ${reply.user_last_name || ''}`.trim()
                                    : reply.user.username;

                                  const getReplyAuthorAvatar = () => {
                                    if (reply.user_profile_picture && reply.user_profile_picture.trim() !== '') {
                                      return reply.user_profile_picture;
                                    }
                                    const seed = encodeURIComponent(replyAuthorName);
                                    const gender = reply.user_gender;
                                    switch (gender) {
                                      case 'male':
                                        return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=008060`;
                                      case 'female':
                                        return `https://api.dicebear.com/7.x/avataaars-neutral/svg?seed=${seed}&backgroundColor=ff69b4`;
                                      case 'other':
                                        return `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}&backgroundColor=ffa500`;
                                      case 'prefer_not_to_say':
                                        return `https://api.dicebear.com/7.x/initials/svg?seed=${seed}&backgroundColor=6c63ff`;
                                      default:
                                        return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=008060`;
                                    }
                                  };

                                  const replyTimeAgo = formatTimeAgo(reply.created_at);

                                  return (
                                    <div key={reply.id} className="flex items-start gap-2 bg-white rounded-lg p-2">
                                      <Avatar className="w-6 h-6">
                                        <AvatarImage src={getReplyAuthorAvatar()} alt={replyAuthorName} />
                                        <AvatarFallback className="bg-[#008060] text-white text-xs">
                                          {replyAuthorName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                          <div className="flex items-center gap-2">
                                            <span className="font-semibold text-xs text-gray-900">{replyAuthorName}</span>
                                            <span className="text-xs text-gray-500">{replyTimeAgo}</span>
                                          </div>
                                          {reply.user.id === currentUserId && (
                                            <button
                                              onClick={() => handleDeleteReply(comment.id, reply.id)}
                                              className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                              title="Delete reply"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </button>
                                          )}
                                        </div>
                                        <p className="text-xs text-gray-700">{reply.content}</p>
                                      </div>
                                    </div>
                                  );
                                })
                              ) : (
                                <p className="text-xs text-gray-500 py-2">No replies yet</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-sm text-gray-500 py-4">No comments yet. Be the first to comment!</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Memoize PostCard to prevent unnecessary re-renders
export const PostCard = memo(PostCardComponent, (prevProps, nextProps) => {
  // Only re-render if these props change
  return (
    prevProps.post.id === nextProps.post.id &&
    prevProps.post.likes_count === nextProps.post.likes_count &&
    prevProps.post.comments_count === nextProps.post.comments_count &&
    prevProps.post.content === nextProps.post.content &&
    prevProps.isLiked === nextProps.isLiked &&
    prevProps.isExpanded === nextProps.isExpanded &&
    prevProps.showComments === nextProps.showComments &&
    prevProps.commentText === nextProps.commentText &&
    prevProps.showOptions === nextProps.showOptions
  );
});