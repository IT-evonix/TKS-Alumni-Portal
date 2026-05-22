import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import {
  CheckCircle,
  XCircle,
  Eye,
  Calendar,
  User,
  ArrowLeft,
  FileText,
  Clock,
  ThumbsUp,
  MessageCircle,
  TrendingUp,
  Bell,
  LogOut,
} from "lucide-react";

import { PostCreator } from "@/components/feed/PostCreator";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PostCard } from "@/components/feed/PostCard";
import { formatDateTimeIST } from "@/lib/dateUtils";
import { NotificationDropdown } from "@/components/layout/NotificationDropdown";
import { useNotifications } from "@/contexts/NotificationContext";

export const AdminFeedPage = (): JSX.Element => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, adminUser, alumni, logoutAdmin } = useAuth();
  const { unreadCount } = useNotifications();
  const [showNotifications, setShowNotifications] = useState(false);

  // Data States
  const [posts, setPosts] = useState<any[]>([]); // Pending posts for approval
  const [feedPosts, setFeedPosts] = useState<any[]>([]); // Live feed posts
  const [isLoading, setIsLoading] = useState(true);
  const [isFeedLoading, setIsFeedLoading] = useState(true);

  // Interaction States for Feed Posts
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());
  const [showComments, setShowComments] = useState<Set<string>>(new Set());
  const [commentTexts, setCommentTexts] = useState<{ [key: string]: string }>({});
  const [showPostOptions, setShowPostOptions] = useState<Set<string>>(new Set());

  // Pending Post Approval States
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [showPostDialog, setShowPostDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');

  // Post creation states
  const [postText, setPostText] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isPosting, setIsPosting] = useState(false);

  useEffect(() => {
    fetchPendingPosts();
    fetchFeedPosts();
  }, [adminUser]);

  // Automatic logout on tab close for admins (not on refresh)
  useEffect(() => {
    const handleUnload = () => {
      sessionStorage.setItem('adminRefresh', Date.now().toString());
    };

    window.addEventListener('unload', handleUnload);

    return () => {
      window.removeEventListener('unload', handleUnload);
    };
  }, []);

  const fetchPendingPosts = async () => {
    try {
      setIsLoading(true);
      const userId = adminUser?.id;

      const response = await fetch('/api/admin/posts/pending', {
        headers: {
          'user-id': userId || '',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch pending posts');
      }

      const data = await response.json();
      setPosts(data.posts || []);
    } catch (error) {
      console.error('Error fetching pending posts:', error);
      toast({
        title: "Error",
        description: "Failed to load pending posts",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFeedPosts = async () => {
    try {
      setIsFeedLoading(true);
      const userId = adminUser?.id;

      const response = await fetch('/api/posts?limit=50', {
        headers: {
          'user-id': userId || '', // This allows checking isLiked status for admin
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
        },
      });

      if (!response.ok) {
        console.warn('Failed to fetch feed posts');
        setFeedPosts([]);
        return;
      }

      const data = await response.json();
      setFeedPosts(data.posts || []);
    } catch (error) {
      console.error('Error fetching feed posts:', error);
    } finally {
      setIsFeedLoading(false);
    }
  };

  // --- Handlers for Feed Interactivity ---

  const handleLike = async (postId: string) => {
    let originalLikesCount = 0;
    let originalIsLikedByUser = false;

    const userId = adminUser?.id;
    const post = feedPosts.find(p => p.id === postId);
    if (!post) return;

    // Get current like status
    const wasLiked = post.isLikedByUser || likedPosts.has(postId);
    originalLikesCount = post.likes_count;
    originalIsLikedByUser = post.isLikedByUser;

    try {
      // Optimistically update UI
      setFeedPosts(prev => prev.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            likes_count: wasLiked
              ? Math.max(0, p.likes_count - 1)
              : p.likes_count + 1,
            isLikedByUser: !wasLiked
          };
        }
        return p;
      }));

      // Update liked posts set
      if (!wasLiked) {
        setLikedPosts(prev => {
          const s = new Set<string>();
          prev.forEach(v => s.add(v));
          s.add(postId);
          return s;
        });
      } else {
        setLikedPosts(prev => {
          const newSet = new Set(prev);
          newSet.delete(postId);
          return newSet;
        });
      }

      // Send request to server
      const response = await fetch(`/api/posts/${postId}/like`, {
        method: 'POST',
        headers: {
          'user-id': userId || '',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to toggle like');
      }
    } catch (error) {
      console.error('Error liking post:', error);
      // Revert optimistic update
      setFeedPosts(prev => prev.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            likes_count: originalLikesCount,
            isLikedByUser: originalIsLikedByUser
          };
        }
        return p;
      }));

      toast({
        title: "Error",
        description: "Failed to update like. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleComment = (postId: string) => {
    setShowComments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
  };

  const handleReadMore = (postId: string) => {
    setExpandedPosts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
  };

  const handlePostOptions = (postId: string) => {
    // Admins can see options for ANY post to delete/manage it
    setShowPostOptions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
  };

  const handleCommentTextChange = (postId: string, text: string) => {
    setCommentTexts(prev => ({ ...prev, [postId]: text }));
  };

  const handlePostComment = async (postId: string) => {
    const commentText = commentTexts[postId];
    if (!commentText?.trim()) return;

    const userId = adminUser?.id;
    if (!userId) {
      toast({ title: "Error", description: "Not authenticated", variant: "destructive" });
      return;
    }

    try {
      const response = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-id': userId || '',
        },
        body: JSON.stringify({
          content: commentText,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to post comment');
      }

      // Clear comment text
      setCommentTexts(prev => ({ ...prev, [postId]: '' }));

      // Update comments count for feed post
      setFeedPosts(prev => prev.map(p =>
        p.id === postId
          ? { ...p, comments_count: p.comments_count + 1 }
          : p
      ));

      toast({
        title: "Success",
        description: "Comment posted.",
      });
    } catch (error) {
      console.error('Error posting comment:', error);
      toast({
        title: "Error",
        description: "Failed to post comment.",
        variant: "destructive",
      });
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this post? This cannot be undone.')) return;

    try {
      const userId = adminUser?.id;

      // Try admin endpoint specifically if available, or just general delete
      // Since we are admin, we should be able to delete any post
      // We'll try the general endpoint first with admin user-id
      const response = await fetch(`/api/posts/${postId}`, {
        method: 'DELETE',
        headers: {
          'user-id': userId || '', // Backend should check if this user is admin
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
        },
      });

      if (!response.ok) {
        // If simple delete fails, maybe try admin specific route if it exists? 
        // For now assume backend handles admin check on general route or fail
        throw new Error('Failed to delete post');
      }

      setFeedPosts(prev => prev.filter(post => post.id !== postId));
      setShowPostOptions(new Set());

      toast({
        title: "Success",
        description: "Post deleted successfully.",
      });
    } catch (error) {
      console.error('Error deleting post:', error);
      toast({
        title: "Error",
        description: "Failed to delete post.",
        variant: "destructive",
      });
    }
  };

  // --- End Feed Handlers ---


  // Post Creation Handlers
  const handleFileAttachment = (type: 'document' | 'photo' | 'video') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = type === 'document' ? '.pdf,.doc,.docx' :
      type === 'photo' ? 'image/*' : 'video/*';
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        setAttachedFiles(prev => [...prev, ...Array.from(files)]);
      }
    };
    input.click();
  };

  const handlePost = async () => {
    if (!postText.trim() && attachedFiles.length === 0) return;

    setIsPosting(true);
    try {
      const userId = adminUser?.id;
      let uploadedFileUrl = null;

      // Upload file if there's an attachment
      if (attachedFiles.length > 0) {
        const file = attachedFiles[0];
        const formData = new FormData();
        formData.append('file', file);

        console.log('Uploading file:', file.name, 'Size:', file.size, 'Type:', file.type);

        const uploadResponse = await fetch('/api/upload/post-attachment', {
          method: 'POST',
          headers: {
            'user-id': userId || '',
            'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
          },
          body: formData,
        });

        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          uploadedFileUrl = uploadData.url;
        } else {
          const errorData = await uploadResponse.json();
          console.error('Upload failed:', errorData);
          toast({
            title: "Upload Failed",
            description: errorData.error || "Failed to upload file",
            variant: "destructive",
          });
          setIsPosting(false);
          return;
        }
      }

      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-id': userId || '',
        },
        body: JSON.stringify({
          content: postText,
          imageUrl: uploadedFileUrl,
          postType: 'general',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create post');
      }

      // Reset form
      setPostText("");
      setAttachedFiles([]);

      // Refresh feed
      fetchFeedPosts();

      toast({
        title: "Success",
        description: "Post created successfully! It is now live on the feed.",
      });
    } catch (error) {
      console.error("Failed to create post:", error);
      toast({
        title: "Error",
        description: "Failed to create post. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPosting(false);
    }
  };


  const handleViewPost = (post: any) => {
    setSelectedPost(post);
    setShowPostDialog(true);
  };

  const handleApproveClick = () => {
    setActionType('approve');
    setShowPostDialog(false);
    setShowConfirmDialog(true);
  };

  const handleRejectClick = () => {
    setActionType('reject');
    setShowPostDialog(false);
    setShowConfirmDialog(true);
  };

  const handleConfirmAction = async () => {
    if (!selectedPost) return;

    try {
      const userId = adminUser?.id;
      const endpoint = actionType === 'approve'
        ? `/api/admin/posts/${selectedPost.id}/approve`
        : `/api/admin/posts/${selectedPost.id}/reject`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'user-id': userId || '',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to ${actionType} post`);
      }

      toast({
        title: "Success",
        description: `Post ${actionType === 'approve' ? 'approved' : 'rejected'} successfully`,
      });

      // Remove post from list
      setPosts(prev => prev.filter(p => p.id !== selectedPost.id));
      setShowConfirmDialog(false);
      setSelectedPost(null);
    } catch (error) {
      console.error(`Error ${actionType}ing post:`, error);
      toast({
        title: "Error",
        description: `Failed to ${actionType} post`,
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    // Use IST formatting for all admin panel timestamps
    return formatDateTimeIST(dateString);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex min-h-screen bg-white">
      {/* Shared Admin Sidebar */}
      <AdminSidebar currentPage="feed" />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 px-8 py-4 sticky top-0 z-40 shadow-sm transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setLocation("/admin/dashboard")}
                className="hover:bg-gray-100"
                aria-label="Back to Dashboard"
              >
                <ArrowLeft className="h-5 w-5 text-gray-700" />
              </Button>
              <h2 className="text-xl font-semibold text-gray-900">Feed</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative z-[70]">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`relative min-w-[44px] min-h-[44px] rounded-full transition-colors ${
                    unreadCount > 0
                      ? "text-[#008060] hover:bg-[#008060]/10 hover:text-[#006b51] ring-2 ring-[#008060]/30"
                      : "text-gray-600 hover:text-[#008060] hover:bg-gray-100"
                  }`}
                  onClick={() => setShowNotifications(!showNotifications)}
                  aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
                >
                  <Bell className="w-5 h-5" strokeWidth={2} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 right-0 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white animate-pulse">
                      {unreadCount > 99 ? "99+" : unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </Button>

                {showNotifications && <NotificationDropdown onClose={() => setShowNotifications(false)} />}
              </div>
              <Button
                variant="outline"
                className="text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all"
                onClick={() => {
                  logoutAdmin();
                }}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Log Out
              </Button>
              <div className="hidden md:flex items-center gap-3 pl-4 border-l border-gray-200">
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">{adminUser?.username || 'Admin'}</p>
                  <p className="text-xs text-gray-500">Administrator</p>
                </div>
                <div className="w-10 h-10 bg-gradient-to-br from-[#008060] to-[#006b51] rounded-full flex items-center justify-center shadow-md">
                  <span className="text-white font-semibold">{adminUser?.username?.charAt(0).toUpperCase() || 'A'}</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6 md:p-8 bg-gray-50/50 overflow-y-auto">
          <div className="max-w-5xl mx-auto space-y-6">

            {/* Page Header */}
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Feed Management</h1>
              <p className="text-sm text-gray-500 mt-1">Manage posts, approvals, and community content</p>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { title: "Total Posts", value: feedPosts.length, icon: FileText, color: "text-blue-600", bg: "bg-blue-50" },
                { title: "Pending", value: posts.length, icon: Clock, color: "text-orange-600", bg: "bg-orange-50" },
                { title: "Engagement", value: feedPosts.reduce((sum, p) => sum + (p.likes_count || 0), 0), icon: ThumbsUp, color: "text-emerald-600", bg: "bg-emerald-50" },
                { title: "Comments", value: feedPosts.reduce((sum, p) => sum + (p.comments_count || 0), 0), icon: MessageCircle, color: "text-purple-600", bg: "bg-purple-50" },
              ].map((stat, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                  <div>
                    <p className="text-sm font-medium text-gray-500">{stat.title}</p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</h3>
                  </div>
                  <div className={`p-3 rounded-lg ${stat.bg}`}>
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <Tabs defaultValue="feed" className="w-full">
              <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent gap-8">
                <TabsTrigger
                  value="feed"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#008060] data-[state=active]:bg-transparent px-2 py-3 font-medium text-gray-500 data-[state=active]:text-[#008060]"
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Live Feed
                </TabsTrigger>
                <TabsTrigger
                  value="approval"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#008060] data-[state=active]:bg-transparent px-2 py-3 font-medium text-gray-500 data-[state=active]:text-[#008060]"
                >
                  <Clock className="w-4 h-4 mr-2" />
                  Post Approval
                  {posts.length > 0 && (
                    <span className="ml-2 bg-orange-100 text-orange-600 text-xs px-2 py-0.5 rounded-full font-semibold">{posts.length}</span>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="feed" className="mt-6">
                {/* Post Creation Section */}
                <div className="mb-8">
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <div className="mb-4">
                      <h3 className="text-lg font-bold text-gray-900 mb-1">Create Admin Post</h3>
                      <p className="text-sm text-gray-600">Make an announcement or share an update on the feed</p>
                    </div>

                    <PostCreator
                      postText={postText}
                      attachedFiles={attachedFiles}
                      isPosting={isPosting}
                      onPostTextChange={setPostText}
                      onFileAttachment={handleFileAttachment}
                      onPost={handlePost}
                      onRemoveFile={(index) => setAttachedFiles(prev => prev.filter((_, i) => i !== index))}
                    />
                  </div>
                </div>

                <Separator className="my-8" />

                {/* Feed Posts */}
                <div className="space-y-6">
                  <h3 className="text-lg font-bold text-gray-900">Recent Posts</h3>
                  {isFeedLoading ? (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#008060]/10 mb-4">
                        <div className="w-6 h-6 border-2 border-[#008060]/30 border-t-[#008060] rounded-full animate-spin"></div>
                      </div>
                      <p className="text-gray-600 font-medium">Loading feed...</p>
                    </div>
                  ) : feedPosts.length === 0 ? (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
                        <FileText className="w-6 h-6 text-gray-400" />
                      </div>
                      <h3 className="text-lg font-medium text-gray-900">No posts yet</h3>
                      <p className="text-gray-500 mt-1">Be the first to create a post!</p>
                    </div>
                  ) : (
                    feedPosts.map((post) => (
                      <PostCard
                        key={post.id}
                        post={post}
                        isLiked={post.isLikedByUser || likedPosts.has(post.id)}
                        isExpanded={expandedPosts.has(post.id)}
                        showComments={showComments.has(post.id)}
                        commentText={commentTexts[post.id] || ''}
                        onLike={() => handleLike(post.id)}
                        onComment={() => handleComment(post.id)}
                        onReadMore={() => handleReadMore(post.id)}
                        onOptionsClick={() => handlePostOptions(post.id)}
                        onEdit={() => fetchFeedPosts()}
                        onDelete={() => handleDeletePost(post.id)}
                        showOptions={showPostOptions.has(post.id)}
                        onPostComment={() => handlePostComment(post.id)}
                        onCommentTextChange={(text) => handleCommentTextChange(post.id, text)}
                      />
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="approval" className="mt-6">
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Approvals Queue</h3>
                  <p className="text-sm text-gray-600">Review and approve posts from alumni</p>
                </div>
                {isLoading ? (
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#008060]/10 mb-4">
                      <div className="w-6 h-6 border-2 border-[#008060]/30 border-t-[#008060] rounded-full animate-spin"></div>
                    </div>
                    <p className="text-gray-600 font-medium">Loading pending posts...</p>
                  </div>
                ) : posts.length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50 mb-4">
                      <CheckCircle className="w-8 h-8 text-emerald-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">All Caught Up!</h3>
                    <p className="text-gray-600">No pending posts to review at the moment.</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {posts.map((post) => (
                      <Card key={post.id} className="bg-white hover:shadow-lg transition-shadow border-gray-200">
                        <CardContent className="p-6">
                          <div className="flex items-start gap-4">
                            <Avatar className="w-12 h-12 flex-shrink-0">
                              <AvatarImage
                                src={post.author_alumni?.profile_picture || `https://api.dicebear.com/7.x/initials/svg?seed=${post.author?.username}`}
                                alt={post.author?.username}
                              />
                              <AvatarFallback className="bg-[#008060] text-white">
                                {getInitials(post.author?.username || 'U')}
                              </AvatarFallback>
                            </Avatar>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between mb-3">
                                <div>
                                  <h4 className="font-semibold text-gray-900">
                                    {post.author_alumni?.first_name && post.author_alumni?.last_name
                                      ? `${post.author_alumni.first_name} ${post.author_alumni.last_name}`
                                      : post.author?.username}
                                  </h4>
                                  <p className="text-sm text-gray-500 flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {formatDate(post.created_at)}
                                  </p>
                                </div>
                                <Button
                                  onClick={() => handleViewPost(post)}
                                  variant="outline"
                                  size="sm"
                                  className="flex items-center gap-2 border-gray-200"
                                >
                                  <Eye className="w-4 h-4" />
                                  Review
                                </Button>
                              </div>

                              <p className="text-gray-700 line-clamp-3 mb-4">
                                {post.content}
                              </p>

                              {post.image_url && (
                                <div className="mb-4 rounded-lg overflow-hidden border border-gray-100 bg-gray-50">
                                  {post.image_url.match(/\.(jpg|jpeg|png|gif|webp)($|\?)/i) ? (
                                    <img
                                      src={post.image_url}
                                      alt="Post attachment"
                                      className="w-full max-h-64 object-cover"
                                    />
                                  ) : post.image_url.match(/\.(mp4|webm|mov|avi)($|\?)/i) ? (
                                    <video
                                      src={post.image_url}
                                      controls
                                      className="w-full max-h-64 object-contain"
                                    />
                                  ) : (
                                    <a
                                      href={post.image_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-3 p-4 hover:bg-gray-100 transition-colors"
                                    >
                                      <span className="text-2xl">📄</span>
                                      <div>
                                        <p className="font-medium text-gray-900 text-sm">View Attached Document</p>
                                        <p className="text-xs text-gray-500">Click to open</p>
                                      </div>
                                    </a>
                                  )}
                                </div>
                              )}

                              <div className="flex gap-2">
                                <Button
                                  onClick={() => {
                                    setSelectedPost(post);
                                    handleApproveClick();
                                  }}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2"
                                  size="sm"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  Approve
                                </Button>
                                <Button
                                  onClick={() => {
                                    setSelectedPost(post);
                                    handleRejectClick();
                                  }}
                                  variant="destructive"
                                  className="flex items-center gap-2"
                                  size="sm"
                                >
                                  <XCircle className="w-4 h-4" />
                                  Reject
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>

      {/* Post Detail Dialog */}
      <Dialog open={showPostDialog} onOpenChange={setShowPostDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Post Details</DialogTitle>
          </DialogHeader>

          {selectedPost && (
            <div className="space-y-6">
              {/* Author Information */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Author Information
                </h3>
                <div className="flex items-start gap-4">
                  <Avatar className="w-16 h-16">
                    <AvatarImage
                      src={selectedPost.author_alumni?.profile_picture || `https://api.dicebear.com/7.x/initials/svg?seed=${selectedPost.author?.username}`}
                      alt={selectedPost.author?.username}
                    />
                    <AvatarFallback className="bg-[#008060] text-white">
                      {getInitials(selectedPost.author?.username || 'U')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-2">
                    <p className="text-sm">
                      <span className="font-medium">Name:</span>{' '}
                      {selectedPost.author_alumni?.first_name && selectedPost.author_alumni?.last_name
                        ? `${selectedPost.author_alumni.first_name} ${selectedPost.author_alumni.last_name}`
                        : selectedPost.author?.username}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Email:</span>{' '}
                      {selectedPost.author_alumni?.email || selectedPost.author?.email}
                    </p>
                    {selectedPost.author_alumni?.phone && (
                      <p className="text-sm">
                        <span className="font-medium">Phone:</span> {selectedPost.author_alumni.phone}
                      </p>
                    )}
                    {selectedPost.author_alumni?.batch && (
                      <p className="text-sm">
                        <span className="font-medium">Batch:</span> {selectedPost.author_alumni.batch}
                      </p>
                    )}
                    {selectedPost.author_alumni?.current_company && (
                      <p className="text-sm">
                        <span className="font-medium">Company:</span>{' '}
                        {selectedPost.author_alumni.current_company}
                        {selectedPost.author_alumni.current_role && ` - ${selectedPost.author_alumni.current_role}`}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Post Content */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Post Content</h3>
                <p className="text-gray-700 whitespace-pre-wrap">{selectedPost.content}</p>
              </div>

              {/* Attached Media */}
              {selectedPost.image_url && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Attached Media</h3>
                  <div className="rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                    {selectedPost.image_url.match(/\.(jpg|jpeg|png|gif|webp)($|\?)/i) ? (
                      <img
                        src={selectedPost.image_url}
                        alt="Post attachment"
                        className="w-full object-contain max-h-96"
                      />
                    ) : selectedPost.image_url.match(/\.(mp4|webm|mov|avi)($|\?)/i) ? (
                      <video
                        src={selectedPost.image_url}
                        controls
                        className="w-full object-contain max-h-96"
                      />
                    ) : (
                      <a
                        href={selectedPost.image_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-4 hover:bg-gray-100 transition-colors"
                      >
                        <span className="text-3xl">📄</span>
                        <div>
                          <p className="font-medium text-gray-900">View Attached Document</p>
                          <p className="text-sm text-gray-500">Click to open full document</p>
                        </div>
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Post Metadata */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Post Metadata
                </h3>
                <div className="space-y-2 text-sm">
                  <p><span className="font-medium">Created:</span> {formatDate(selectedPost.created_at)}</p>
                  <p><span className="font-medium">Type:</span> {selectedPost.post_type}</p>
                  <p><span className="font-medium">Status:</span> Pending Approval</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              onClick={handleApproveClick}
              className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Approve Post
            </Button>
            <Button
              onClick={handleRejectClick}
              variant="destructive"
              className="flex items-center gap-2"
            >
              <XCircle className="w-4 h-4" />
              Reject Post
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === 'approve' ? 'Approve Post?' : 'Reject Post?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === 'approve'
                ? 'Are you sure you want to approve this post? It will be visible to all users on the feed.'
                : 'Are you sure you want to reject this post? This action will hide the post from users.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              className={actionType === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {actionType === 'approve' ? 'Approve' : 'Reject'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};