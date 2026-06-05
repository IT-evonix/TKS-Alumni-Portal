import React, { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { BackButton } from "@/components/common/BackButton";
import { Share2, Heart, MessageCircle, ArrowLeft } from "lucide-react";

interface Comment {
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

export const SharedPostPage: React.FC = () => {
  const [, params] = useRoute("/post/:postId");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const postId = params?.postId;

  const [post, setPost] = useState<any>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [pendingAction, setPendingAction] = useState<'like' | 'comment' | null>(null);
  const [isLoadingComments, setIsLoadingComments] = useState(true);

  // In-flight guard: prevents multiple simultaneous like requests
  const isLikingRef = useRef(false);

  useEffect(() => {
    if (postId) {
      fetchPost();
      fetchComments();
    }
  }, [postId]);

  useEffect(() => {
    // Update page meta tags for social sharing
    if (post) {
      updateMetaTags();
    }
  }, [post]);

  // Handle redirect after login
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const justLoggedIn = urlParams.get('login') === 'success';
    const storedAction = sessionStorage.getItem('pendingAction');
    const storedRedirectUrl = sessionStorage.getItem('redirectAfterLogin');

    if (justLoggedIn && user) {
      const action = pendingAction || storedAction;

      if (action === 'like') {
        handleLike();
      } else if (action === 'comment') {
        // Just focus the comment input
        setTimeout(() => {
          document.getElementById('comment-input')?.focus();
        }, 100);
      }

      // Clear pending action and redirect info
      setPendingAction(null);
      sessionStorage.removeItem('pendingAction');
      sessionStorage.removeItem('redirectAfterLogin');

      // Clean URL if we redirected back to this page
      if (storedRedirectUrl && window.location.pathname === storedRedirectUrl.split('?')[0]) {
        window.history.replaceState({}, '', window.location.pathname.split('?')[0]);
      }
    } else if (justLoggedIn && !user) {
      // If login failed or user is still not logged in, clear pending actions
      setPendingAction(null);
      sessionStorage.removeItem('pendingAction');
      sessionStorage.removeItem('redirectAfterLogin');
    }
  }, [user, pendingAction, postId]);

  const updateMetaTags = () => {
    if (!post) return;

    const authorName = post.author_first_name
      ? `${post.author_first_name} ${post.author_last_name || ''}`
      : post.author.username;

    // Update document title
    document.title = `${authorName}'s Post - Alumni Portal`;

    // Update or create meta tags
    const updateMeta = (property: string, content: string) => {
      // Check both property and name attributes
      let meta = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
      if (!meta) {
        meta = document.querySelector(`meta[name="${property}"]`) as HTMLMetaElement;
      }
      if (!meta) {
        meta = document.createElement('meta');
        if (property.startsWith('twitter:')) {
          meta.setAttribute('name', property);
        } else {
          meta.setAttribute('property', property);
        }
        document.head.appendChild(meta);
      }
      meta.content = content;
    };

    const postPreview = post.content.substring(0, 200) + (post.content.length > 200 ? '...' : '');

    // Open Graph tags
    updateMeta('og:title', `${authorName}'s Post - Alumni Portal`);
    updateMeta('og:description', postPreview);
    updateMeta('og:url', window.location.href);
    updateMeta('og:type', 'article');
    updateMeta('og:site_name', 'Alumni Portal');
    if (post.image_url) {
      updateMeta('og:image', post.image_url);
      updateMeta('og:image:alt', 'Post image');
    }

    // Twitter cards
    updateMeta('twitter:card', post.image_url ? 'summary_large_image' : 'summary');
    updateMeta('twitter:title', `${authorName}'s Post`);
    updateMeta('twitter:description', postPreview);
    if (post.image_url) {
      updateMeta('twitter:image', post.image_url);
    }

    // Additional SEO meta tags
    const descMeta = document.querySelector('meta[name="description"]') as HTMLMetaElement;
    if (descMeta) {
      descMeta.content = postPreview;
    }
  };

  const fetchPost = async () => {
    try {
      setIsLoading(true);
      const headers: any = {};
      if (user) {
        headers['user-id'] = user.id;
      }

      // Extract clean UUID from postId (in case it has extra content)
      const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
      if (!postId) return;
      const match = postId.match(uuidPattern);
      const cleanPostId = match ? match[0] : (postId || '');


      const response = await fetch(`/api/posts/${cleanPostId}/single`, { headers });

      if (!response.ok) {
        throw new Error('Failed to fetch post');
      }

      const data = await response.json();
      setPost(data.post);
      setIsLiked(data.post.isLikedByUser || false);
    } catch (error) {
      console.error('Error fetching post:', error);
      toast({
        title: "Error",
        description: "Failed to load post",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      setIsLoadingComments(true);

      // Extract clean UUID from postId (in case it has extra content)
      const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
      if (!postId) return;
      const match = postId.match(uuidPattern);
      const cleanPostId = match ? match[0] : (postId || '');

      const response = await fetch(`/api/posts/${cleanPostId}/comments`);
      if (response.ok) {
        const data = await response.json();
        setComments(data.comments || []);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setIsLoadingComments(false);
    }
  };

  const handleAuthRequired = (action: 'like' | 'comment') => {
    // Store the pending action and redirect URL
    sessionStorage.setItem('pendingAction', action);
    sessionStorage.setItem('redirectAfterLogin', window.location.pathname);

    // Redirect to login
    setLocation('/login');
  };

  const redirectToLogin = () => {
    // Store the current URL and pending action
    sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
    sessionStorage.setItem('pendingAction', pendingAction || '');
    setLocation('/login');
  };

  const handleLike = async () => {
    // Check if user is logged in
    if (!user) {
      handleAuthRequired('like');
      return;
    }

    // Guard: ignore click if a request is already in-flight
    if (isLikingRef.current) return;
    isLikingRef.current = true;

    // Snapshot current state for rollback
    const wasLiked = isLiked;
    const previousCount = post?.likes_count ?? 0;

    // Optimistic update
    setIsLiked(!wasLiked);
    setPost((prev: any) => ({
      ...prev,
      likes_count: prev.likes_count + (!wasLiked ? 1 : -1)
    }));

    try {
      // Extract clean UUID from postId (in case it has extra content)
      const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
      if (!postId) return;
      const match = postId.match(uuidPattern);
      const cleanPostId = match ? match[0] : (postId || '');

      const response = await fetch(`/api/posts/${cleanPostId}/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-id': user.id,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to toggle like');
      }

      // Sync with server truth (in case something diverged)
      const data = await response.json();
      setIsLiked(data.isLiked);
      setPost((prev: any) => ({
        ...prev,
        likes_count: prev.likes_count + (data.isLiked !== !wasLiked ? (data.isLiked ? 1 : -1) : 0)
      }));
    } catch (error) {
      console.error('Error liking post:', error);
      // Revert optimistic update
      setIsLiked(wasLiked);
      setPost((prev: any) => ({ ...prev, likes_count: previousCount }));
      toast({
        title: "Error",
        description: "Failed to update like",
        variant: "destructive",
      });
    } finally {
      // Always unlock
      isLikingRef.current = false;
    }
  };

  const handlePostComment = async () => {
    if (!user) {
      handleAuthRequired('comment');
      return;
    }

    if (!commentText.trim()) return;

    try {
      setIsSubmittingComment(true);

      // Extract clean UUID from postId (in case it has extra content)
      const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
      if (!postId) return;
      const match = postId.match(uuidPattern);
      const cleanPostId = match ? match[0] : (postId || '');

      const response = await fetch(`/api/posts/${cleanPostId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-id': user.id,
        },
        body: JSON.stringify({
          content: commentText,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to post comment');
      }

      setCommentText('');
      await fetchComments();

      // Update comments count
      setPost((prev: any) => ({
        ...prev,
        comments_count: prev.comments_count + 1
      }));

      toast({
        title: "Comment posted",
        description: "Your comment has been added.",
      });
    } catch (error) {
      console.error('Error posting comment:', error);
      toast({
        title: "Error",
        description: "Failed to post comment",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;
    const shareText = post ? `Check out this post by ${post.author_first_name || post.author.username}` : 'Check out this post';

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareText,
          text: post?.content.substring(0, 100),
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Link copied!",
      description: "Share link copied to clipboard",
    });
  };

  const timeAgo = (date: string) => {
    const now = new Date();
    const posted = new Date(date);
    const diffMs = now.getTime() - posted.getTime();

    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#008060]"></div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Post not found</h1>
          <p className="text-gray-600 mb-4">This post may have been deleted or doesn't exist.</p>
          <Button onClick={() => user ? setLocation('/feed') : setLocation('/')}>Go to Home</Button>
        </div>
      </div>
    );
  }

  const authorName = post.author_first_name
    ? `${post.author_first_name} ${post.author_last_name || ''}`
    : post.author.username;

  const getAuthorAvatar = () => {
    if (post.author_profile_picture) {
      return post.author_profile_picture;
    }
    const seed = encodeURIComponent(authorName);
    const gender = post.author_gender;
    switch (gender) {
      case 'male':
        return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=008060`;
      case 'female':
        return `https://api.dicebear.com/7.x/avataaars-neutral/svg?seed=${seed}&backgroundColor=ff69b4`;
      default:
        return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=008060`;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-3xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center gap-3 sm:gap-4">
          <BackButton />
          <h1 className="text-lg sm:text-xl font-semibold text-gray-900">Post</h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <Card className="bg-white rounded-2xl shadow-sm">
          <CardContent className="p-4 sm:p-6">
            {/* Post Header */}
            <div className="flex items-start gap-3 mb-4">
              <Avatar className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0">
                <AvatarImage src={getAuthorAvatar()} alt={authorName} />
                <AvatarFallback className="bg-[#008060] text-white">
                  {authorName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900">{authorName}</h4>
                <p className="text-sm text-gray-600">{post.author.email}</p>
                <p className="text-xs text-gray-500">{timeAgo(post.created_at)}</p>
              </div>
            </div>

            {/* Post Content */}
            <div className="mb-4">
              <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{post.content}</p>
            </div>

            {/* Post Image/Media */}
            {post.image_url && (
              <div className="mb-4 rounded-lg overflow-hidden">
                {post.image_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                  <img
                    src={post.image_url}
                    alt="Post attachment"
                    className="w-full h-auto"
                  />
                ) : post.image_url.match(/\.(mp4|webm)$/i) ? (
                  <video
                    src={post.image_url}
                    controls
                    className="w-full h-auto"
                  />
                ) : (
                  <a
                    href={post.image_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                  >
                    <span className="text-2xl">📄</span>
                    <span className="text-sm text-gray-700">View attached document</span>
                  </a>
                )}
              </div>
            )}

            {/* Post Actions */}
            <div className="flex items-center gap-3 sm:gap-6 pt-4 border-t border-gray-100">
              <button
                onClick={handleLike}
                className={`flex items-center gap-1.5 sm:gap-2 transition-colors min-h-[44px] min-w-[44px] px-2 ${isLiked
                  ? 'text-red-500'
                  : 'text-gray-600 hover:text-red-500'
                  }`}
                title={user ? (isLiked ? 'Unlike' : 'Like') : 'Login to like'}
              >
                <Heart className={`w-4 h-4 sm:w-5 sm:h-5 ${isLiked ? 'fill-current' : ''}`} />
                <span className="text-xs sm:text-sm font-medium">{post.likes_count}</span>
              </button>
              <button
                onClick={() => !user && handleAuthRequired('comment')}
                className="flex items-center gap-1.5 sm:gap-2 text-gray-600 hover:text-[#008060] transition-colors min-h-[44px] min-w-[44px] px-2"
                title={user ? 'Comment' : 'Login to comment'}
              >
                <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-xs sm:text-sm font-medium">{post.comments_count}</span>
              </button>
              <button
                onClick={handleShare}
                className="flex items-center gap-1.5 sm:gap-2 text-gray-600 hover:text-[#008060] transition-colors ml-auto group min-h-[44px] min-w-[44px] px-2"
                title="Share this post"
              >
                <Share2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span className="text-xs sm:text-sm font-medium hidden sm:inline">Share</span>
              </button>
            </div>

            {/* Comment Section */}
            <div className="mt-6 pt-6 border-t border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-4">
                Comments ({comments.length})
              </h3>

              {/* Comment Input */}
              {user ? (
                <div className="flex flex-col sm:flex-row gap-2 mb-6">
                  <Input
                    id="comment-input"
                    placeholder="Write a comment..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handlePostComment()}
                    className="flex-1 min-h-[44px] text-sm sm:text-base"
                  />
                  <Button
                    onClick={handlePostComment}
                    disabled={!commentText.trim() || isSubmittingComment}
                    variant="brand"
                  >
                    {isSubmittingComment ? 'Posting...' : 'Post'}
                  </Button>
                </div>
              ) : (
                <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800 mb-2">
                    Want to join the conversation?
                  </p>
                  <Button
                    size="sm"
                    onClick={() => handleAuthRequired('comment')}
                    variant="brand"
                  >
                    Log in to comment
                  </Button>
                </div>
              )}

              {/* Comments List */}
              <div className="space-y-4">
                {isLoadingComments && (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#008060]"></div>
                  </div>
                )}
                {!isLoadingComments && comments.map((comment) => {
                  const commentAuthor = comment.user_first_name
                    ? `${comment.user_first_name} ${comment.user_last_name || ''}`
                    : comment.user.username;

                  return (
                    <div key={comment.id} className="flex gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarImage
                          src={comment.user_profile_picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(commentAuthor)}`}
                          alt={commentAuthor}
                        />
                        <AvatarFallback className="bg-[#008060] text-white text-xs">
                          {commentAuthor.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm">{commentAuthor}</span>
                          <span className="text-xs text-gray-500">{timeAgo(comment.created_at)}</span>
                        </div>
                        <p className="text-sm text-gray-700">{comment.content}</p>
                      </div>
                    </div>
                  );
                })}

                {!isLoadingComments && comments.length === 0 && (
                  <p className="text-center text-sm text-gray-500 py-8">
                    No comments yet. Be the first to comment!
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Login Prompt Modal */}
        {showLoginPrompt && !user && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="max-w-md w-full mx-4">
              <CardContent className="p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-semibold mb-2">Login Required</h3>
                <p className="text-sm sm:text-base text-gray-600 mb-4">
                  {pendingAction === 'like'
                    ? 'You need to log in to like this post.'
                    : 'You need to log in to comment on this post.'}
                </p>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowLoginPrompt(false);
                      setPendingAction(null);
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={redirectToLogin}
                    variant="brand"
                    className="flex-1"
                  >
                    Log In
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};