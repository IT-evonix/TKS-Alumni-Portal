import React, { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { formatTimeAgo } from "@/utils/time";
import { debugTimestamp } from "@/utils/debug-time";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { BackButton } from "@/components/common/BackButton";
import {
    ThumbsUp,
    ThumbsDown,
    MessageSquare,
    Eye,
    Bookmark,
    Bell,
    Share2,
    MoreVertical,
    Pin,
    Lock,
    CheckCircle,
    Clock,
    Edit,
    Trash2,
    X,
    Save,
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

interface Thread {
    id: string;
    title: string;
    content: string;
    thread_type: string;
    tags: string[];
    is_pinned: boolean;
    is_locked: boolean;
    is_resolved: boolean;
    views_count: number;
    posts_count: number;
    upvotes_count: number;
    downvotes_count: number;
    created_at: string;
    userVote: string | null;
    isBookmarked: boolean;
    isSubscribed: boolean;
    author: {
        id: string;
        username: string;
        profile_picture?: string;
    };
    category: {
        name: string;
        slug: string;
        color: string;
    };
}

interface Post {
    id: string;
    content: string;
    is_edited: boolean;
    edit_count: number;
    upvotes_count: number;
    downvotes_count: number;
    created_at: string;
    author: {
        id: string;
        username: string;
        profile_picture?: string;
    };
}

export const ForumThreadPage = (): JSX.Element => {
    const { id } = useParams<{ id: string }>();
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const { user } = useAuth();
    const [thread, setThread] = useState<Thread | null>(null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [replyContent, setReplyContent] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Edit/Delete State
    const [editingPostId, setEditingPostId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState("");
    const [editingThread, setEditingThread] = useState(false);
    const [editThreadTitle, setEditThreadTitle] = useState("");
    const [editThreadContent, setEditThreadContent] = useState("");
    const [deleteTarget, setDeleteTarget] = useState<{ type: 'thread' | 'post', id: string } | null>(null);

    const [isBookmarking, setIsBookmarking] = useState(false);

    useEffect(() => {
        if (id) {
            fetchThread();
        }
    }, [id, user?.id]);

    const fetchThread = async () => {
        try {
            setIsLoading(true);
            const response = await fetch(`/api/forums/threads/${id}`, {
                headers: {
                    "user-id": user?.id || "",
                },
            });

            if (response.ok) {
                const data = await response.json();
                setThread(data.thread);
                setPosts(data.posts || []);
                document.title = `${data.thread.title} - Forums - TKS Alumni Portal`;

                // Debug timestamp
                if (data.thread?.created_at) {
                    debugTimestamp(data.thread.created_at, 'Thread Created At');
                }
            } else {
                toast({
                    title: "Error",
                    description: "Failed to load thread",
                    variant: "destructive",
                });
            }
        } catch (error) {
            console.error("Error fetching thread:", error);
            toast({
                title: "Error",
                description: "Failed to load thread",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleVote = async (voteType: "upvote" | "downvote") => {
        if (!user) {
            toast({
                title: "Login required",
                description: "Please login to vote",
                variant: "destructive",
            });
            return;
        }

        try {
            const response = await fetch(`/api/forums/threads/${id}/vote`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "user-id": user.id,
                },
                body: JSON.stringify({ voteType }),
            });

            if (response.ok) {
                await fetchThread();
            }
        } catch (error) {
            console.error("Error voting:", error);
            toast({
                title: "Error",
                description: "Failed to vote",
                variant: "destructive",
            });
        }
    };

    const handleBookmark = async () => {
        if (!user) {
            toast({
                title: "Login required",
                description: "Please login to bookmark",
                variant: "destructive",
            });
            return;
        }

        if (isBookmarking) return;

        setIsBookmarking(true);
        try {
            const response = await fetch(`/api/forums/threads/${id}/bookmark`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "user-id": user.id,
                },
            });

            if (response.ok) {
                const data = await response.json();
                toast({
                    title: data.bookmarked ? "Bookmarked" : "Removed bookmark",
                    description: data.message,
                });

                // Optimistic update could go here, but re-fetching is safer for sync
                await fetchThread();
            } else {
                toast({
                    title: "Error",
                    description: "Failed to update bookmark",
                    variant: "destructive",
                });
            }
        } catch (error) {
            console.error("Error bookmarking:", error);
            toast({
                title: "Error",
                description: "Failed to update bookmark",
                variant: "destructive",
            });
        } finally {
            setIsBookmarking(false);
        }
    };

    const handleSubscribe = async () => {
        if (!user) {
            toast({
                title: "Login required",
                description: "Please login to subscribe",
                variant: "destructive",
            });
            return;
        }

        try {
            const response = await fetch(`/api/forums/threads/${id}/subscribe`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "user-id": user.id,
                },
            });

            if (response.ok) {
                const data = await response.json();
                toast({
                    title: data.subscribed ? "Subscribed" : "Unsubscribed",
                    description: data.message,
                });
                await fetchThread();
            }
        } catch (error) {
            console.error("Error subscribing:", error);
        }
    };

    const handleReply = async () => {
        if (!user) return;
        if (!replyContent.trim()) return;

        setIsSubmitting(true);
        try {
            const response = await fetch(`/api/forums/threads/${id}/posts`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "user-id": user.id,
                },
                body: JSON.stringify({ content: replyContent }),
            });

            if (response.ok) {
                setReplyContent("");
                await fetchThread();
                toast({
                    title: "Reply posted",
                    description: "Your reply has been added",
                });
            }
        } catch (error) {
            console.error("Error posting reply:", error);
            toast({
                title: "Error",
                description: "Failed to post reply",
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- Navigation ---
    const handleUserClick = (e: React.MouseEvent, userId: string) => {
        // If it's the current user, allow bubbling (so they can click the card/thread)
        // and do not redirect to profile.
        if (user?.id === userId) return;

        e.stopPropagation();
        setLocation(`/profile/${userId}`);
    };

    // --- Edit/Delete Logic ---

    const canEdit = (createdAt: string, authorId: string) => {
        // Users can always edit their own threads
        return user && user.id === authorId;
    };

    const canDelete = (authorId: string) => {
        return user && (user.id === authorId || user.user_role === 'administrator'); // Assuming admin role check or strict owneship
    };

    const handleEditPostStart = (post: Post) => {
        setEditingPostId(post.id);
        setEditContent(post.content);
    };

    const handleSavePost = async (postId: string) => {
        try {
            // Optimistic Update
            const originalPosts = [...posts];
            setPosts(posts.map(p => p.id === postId ? { ...p, content: editContent, is_edited: true, edit_count: p.edit_count + 1 } : p));
            setEditingPostId(null);

            const response = await fetch(`/api/forums/posts/${postId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "user-id": user?.id || "",
                },
                body: JSON.stringify({ content: editContent }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to update post");
            }
        } catch (error: any) {
            console.error("Error updating post:", error);
            toast({
                title: "Update failed",
                description: error.message,
                variant: "destructive",
            });
            await fetchThread(); // Revert/Refresh
        }
    };

    const handleEditThreadStart = () => {
        if (thread) {
            setEditingThread(true);
            setEditThreadTitle(thread.title);
            setEditThreadContent(thread.content);
        }
    };

    const handleSaveThread = async () => {
        if (!thread) return;
        try {
            // Optimistic Update
            setThread({ ...thread, title: editThreadTitle, content: editThreadContent });
            setEditingThread(false);

            const response = await fetch(`/api/forums/threads/${thread.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "user-id": user?.id || "",
                },
                body: JSON.stringify({ title: editThreadTitle, content: editThreadContent }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to update thread");
            }
        } catch (error: any) {
            console.error("Error updating thread:", error);
            toast({
                title: "Update failed",
                description: error.message,
                variant: "destructive",
            });
            await fetchThread(); // Revert/Refresh
        }
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;

        const { type, id } = deleteTarget;
        setDeleteTarget(null);

        try {
            if (type === "post") {
                // Optimistic
                setPosts(posts.filter(p => p.id !== id));
            }

            const response = await fetch(`/api/forums/${type}s/${id}`, {
                method: "DELETE",
                headers: {
                    "user-id": user?.id || "",
                },
            });

            if (response.ok) {
                toast({
                    title: "Deleted",
                    description: `${type === 'thread' ? 'Thread' : 'Post'} deleted successfully`,
                });
                if (type === "thread") {
                    setLocation("/forums");
                }
            } else {
                throw new Error("Failed to delete");
            }
        } catch (error) {
            console.error("Delete error:", error);
            toast({
                title: "Error",
                description: "Failed to delete item",
                variant: "destructive",
            });
            if (type === "post") await fetchThread(); // Revert
        }
    };

    const handleShare = async () => {
        const shareUrl = window.location.href;

        // Try Web Share API (mobile devices mostly)
        if (navigator.share) {
            try {
                await navigator.share({
                    title: thread?.title || "Forum Thread",
                    text: `Check out this discussion: ${thread?.title}`,
                    url: shareUrl,
                });
                return;
            } catch (error) {
                // Ignore AbortError (user cancelled)
                if (error instanceof Error && error.name !== "AbortError") {
                    console.error("Error sharing:", error);
                }
            }
        }

        // Fallback to Clipboard API
        try {
            await navigator.clipboard.writeText(shareUrl);
            toast({
                title: "Link copied",
                description: "Thread URL has been copied to your clipboard",
            });
        } catch (error) {
            console.error("Error copying to clipboard:", error);
            toast({
                title: "Error",
                description: "Failed to copy link to clipboard",
                variant: "destructive",
            });
        }
    };

    if (isLoading) {
        return (
            <AppLayout currentPage="forums">
                <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center">
                    <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#008060]"></div>
                        <p className="mt-2 text-gray-600">Loading thread...</p>
                    </div>
                </div>
            </AppLayout>
        );
    }

    if (!thread) {
        return (
            <AppLayout currentPage="forums">
                <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center">
                    <div className="text-center">
                        <p className="text-gray-600">Thread not found</p>
                        <Button onClick={() => setLocation("/forums")} className="mt-4">
                            Back to Forums
                        </Button>
                    </div>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout currentPage="forums">
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
                <div className="w-full max-w-5xl mx-auto px-3 sm:px-4 lg:px-6">
                    {/* Back Button */}
                    <div className="mb-3 sm:mb-4">
                        <BackButton />
                    </div>

                    {/* Thread Card */}
                    <Card className="mb-4 sm:mb-6">
                        <CardContent className="p-4 sm:p-6">
                            {/* Thread Header */}
                            <div className="flex items-start gap-3 sm:gap-4 mb-4">
                                <Avatar
                                    className={`w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 transition-opacity ${user?.id !== thread.author.id ? "cursor-pointer hover:opacity-80" : ""}`}
                                    onClick={(e) => handleUserClick(e, thread.author.id)}
                                >
                                    <AvatarImage src={thread.author.profile_picture} />
                                    <AvatarFallback>
                                        {thread.author.username.charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
                                        <span
                                            className={`font-semibold text-sm sm:text-base truncate transition-colors ${user?.id !== thread.author.id ? "cursor-pointer hover:text-[#008060] hover:underline" : ""}`}
                                            onClick={(e) => handleUserClick(e, thread.author.id)}
                                        >
                                            {thread.author.username}
                                        </span>
                                        <span className="text-xs sm:text-sm text-gray-500" title={new Date(thread.created_at).toLocaleString()}>
                                            {formatTimeAgo(thread.created_at)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {thread.is_pinned && (
                                            <Badge className="bg-[#008060] text-white">
                                                <Pin className="w-3 h-3 mr-1" />
                                                Pinned
                                            </Badge>
                                        )}
                                        {thread.is_locked && (
                                            <Badge variant="secondary">
                                                <Lock className="w-3 h-3 mr-1" />
                                                Locked
                                            </Badge>
                                        )}
                                        {thread.is_resolved && (
                                            <Badge className="bg-green-100 text-green-700">
                                                <CheckCircle className="w-3 h-3 mr-1" />
                                                Resolved
                                            </Badge>
                                        )}
                                        <Badge
                                            style={{
                                                backgroundColor: `${thread.category.color}15`,
                                                color: thread.category.color,
                                            }}
                                        >
                                            {thread.category.name}
                                        </Badge>
                                        {thread.thread_type === 'question' && (
                                            <Badge variant="outline" className="border-orange-500 text-orange-600 bg-orange-50">
                                                ❓ Question
                                            </Badge>
                                        )}
                                        {thread.thread_type === 'announcement' && (
                                            <Badge variant="outline" className="border-blue-500 text-blue-600 bg-blue-50">
                                                📢 Announcement
                                            </Badge>
                                        )}
                                        {thread.thread_type === 'job_opportunity' && (
                                            <Badge variant="outline" className="border-purple-500 text-purple-600 bg-purple-50">
                                                💼 Job Opportunity
                                            </Badge>
                                        )}
                                        {thread.thread_type === 'event' && (
                                            <Badge variant="outline" className="border-pink-500 text-pink-600 bg-pink-50">
                                                📅 Event
                                            </Badge>
                                        )}
                                        {thread.thread_type === 'mentorship' && (
                                            <Badge variant="outline" className="border-indigo-500 text-indigo-600 bg-indigo-50">
                                                🎓 Mentorship
                                            </Badge>
                                        )}
                                        {thread.thread_type === 'resource' && (
                                            <Badge variant="outline" className="border-teal-500 text-teal-600 bg-teal-50">
                                                📚 Resource
                                            </Badge>
                                        )}
                                        {thread.thread_type === 'poll' && (
                                            <Badge variant="outline" className="border-yellow-500 text-yellow-600 bg-yellow-50">
                                                📊 Poll
                                            </Badge>
                                        )}
                                        {thread.thread_type === 'success_story' && (
                                            <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50">
                                                🏆 Success Story
                                            </Badge>
                                        )}
                                        {thread.thread_type === 'collaboration' && (
                                            <Badge variant="outline" className="border-cyan-500 text-cyan-600 bg-cyan-50">
                                                💡 Collaboration
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                {user && (canEdit(thread.created_at, thread.author.id) || canDelete(thread.author.id)) && (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            {canEdit(thread.created_at, thread.author.id) && (
                                                <DropdownMenuItem onClick={handleEditThreadStart}>
                                                    <Edit className="w-4 h-4 mr-2" />
                                                    Edit Thread
                                                </DropdownMenuItem>
                                            )}
                                            {canDelete(thread.author.id) && (
                                                <DropdownMenuItem
                                                    onClick={() => setDeleteTarget({ type: 'thread', id: thread.id })}
                                                    className="text-red-600 focus:text-red-600"
                                                >
                                                    <Trash2 className="w-4 h-4 mr-2" />
                                                    Delete Thread
                                                </DropdownMenuItem>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}
                            </div>

                            {/* Thread Title & Content (Editable) */}
                            {editingThread ? (
                                <div className="space-y-4 mb-6">
                                    <Input
                                        value={editThreadTitle}
                                        onChange={(e) => setEditThreadTitle(e.target.value)}
                                        className="text-xl font-bold"
                                    />
                                    <Textarea
                                        value={editThreadContent}
                                        onChange={(e) => setEditThreadContent(e.target.value)}
                                        className="min-h-[200px]"
                                    />
                                    <div className="flex gap-2 justify-end">
                                        <Button variant="outline" size="sm" onClick={() => setEditingThread(false)}>
                                            <X className="w-4 h-4 mr-2" /> Cancel
                                        </Button>
                                        <Button size="sm" onClick={handleSaveThread} className="bg-[#008060]">
                                            <Save className="w-4 h-4 mr-2" /> Save Changes
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <h1 className="text-2xl font-bold text-gray-900 mb-4">
                                        {thread.title}
                                    </h1>
                                    <div className="prose max-w-none mb-6">
                                        <p className="text-gray-700 whitespace-pre-wrap">{thread.content}</p>
                                    </div>
                                </>
                            )}

                            {/* Tags */}
                            {thread.tags && thread.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-6">
                                    {thread.tags.map((tag, index) => (
                                        <Badge key={index} variant="outline" className="text-xs">
                                            #{tag}
                                        </Badge>
                                    ))}
                                </div>
                            )}

                            <Separator className="my-4" />

                            {/* Thread Actions */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    {/* Voting */}
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant={thread.userVote === "upvote" ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => handleVote("upvote")}
                                            className={thread.userVote === "upvote" ? "bg-[#008060]" : ""}
                                        >
                                            <ThumbsUp className="w-4 h-4 mr-1" />
                                            {thread.upvotes_count}
                                        </Button>
                                        <Button
                                            variant={thread.userVote === "downvote" ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => handleVote("downvote")}
                                        >
                                            <ThumbsDown className="w-4 h-4 mr-1" />
                                            {thread.downvotes_count}
                                        </Button>
                                    </div>

                                    {/* Stats */}
                                    <div className="flex items-center gap-4 text-sm text-gray-600">
                                        <span className="flex items-center gap-1">
                                            <MessageSquare className="w-4 h-4" />
                                            {thread.posts_count} replies
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Eye className="w-4 h-4" />
                                            {thread.views_count} views
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleBookmark}
                                        disabled={isBookmarking}
                                        className={thread.isBookmarked ? "bg-[#008060] text-white" : ""}
                                    >
                                        <Bookmark className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleSubscribe}
                                        className={thread.isSubscribed ? "bg-[#008060] text-white" : ""}
                                    >
                                        <Bell className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleShare}
                                        className="hover:bg-gray-100"
                                    >
                                        <Share2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Replies Section */}
                    <div className="mb-6">
                        <h2 className="text-xl font-bold mb-4">
                            {posts.length} {posts.length === 1 ? "Reply" : "Replies"}
                        </h2>

                        {posts.map((post) => (
                            <Card key={post.id} className="mb-4">
                                <CardContent className="p-6">
                                    <div className="flex items-start gap-4">
                                        <Avatar
                                            className={`w-10 h-10 transition-opacity ${user?.id !== post.author.id ? "cursor-pointer hover:opacity-80" : ""}`}
                                            onClick={(e) => handleUserClick(e, post.author.id)}
                                        >
                                            <AvatarImage src={post.author.profile_picture} />
                                            <AvatarFallback>
                                                {post.author.username.charAt(0).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span
                                                    className={`font-semibold transition-colors ${user?.id !== post.author.id ? "cursor-pointer hover:text-[#008060] hover:underline" : ""}`}
                                                    onClick={(e) => handleUserClick(e, post.author.id)}
                                                >
                                                    {post.author.username}
                                                </span>
                                                <span className="text-sm text-gray-500" title={new Date(post.created_at).toLocaleString()}>
                                                    {formatTimeAgo(post.created_at)}
                                                </span>
                                                {post.is_edited && (
                                                    <Badge variant="secondary" className="text-xs">
                                                        Edited
                                                    </Badge>
                                                )}
                                                {/* Post Actions Dropdown */}
                                                {user && (canEdit(post.created_at, post.author.id) || canDelete(post.author.id)) && (
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 ml-auto text-gray-500">
                                                                <MoreVertical className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            {canEdit(post.created_at, post.author.id) && (
                                                                <DropdownMenuItem onClick={() => handleEditPostStart(post)}>
                                                                    <Edit className="w-4 h-4 mr-2" />
                                                                    Edit
                                                                </DropdownMenuItem>
                                                            )}
                                                            {canDelete(post.author.id) && (
                                                                <DropdownMenuItem
                                                                    onClick={() => setDeleteTarget({ type: 'post', id: post.id })}
                                                                    className="text-red-600 focus:text-red-600"
                                                                >
                                                                    <Trash2 className="w-4 h-4 mr-2" />
                                                                    Delete
                                                                </DropdownMenuItem>
                                                            )}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                )}
                                            </div>
                                            {editingPostId === post.id ? (
                                                <div className="mb-4 space-y-3">
                                                    <Textarea
                                                        value={editContent}
                                                        onChange={(e) => setEditContent(e.target.value)}
                                                        className="w-full min-h-[100px]"
                                                    />
                                                    <div className="flex gap-2 justify-end">
                                                        <Button variant="ghost" size="sm" onClick={() => setEditingPostId(null)}>
                                                            Cancel
                                                        </Button>
                                                        <Button size="sm" onClick={() => handleSavePost(post.id)} className="bg-[#008060]">
                                                            Save
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="text-gray-700 whitespace-pre-wrap mb-4">
                                                    {post.content}
                                                </p>
                                            )}
                                            <div className="flex items-center gap-2">
                                                <Button variant="ghost" size="sm">
                                                    <ThumbsUp className="w-4 h-4 mr-1" />
                                                    {post.upvotes_count}
                                                </Button>
                                                <Button variant="ghost" size="sm">
                                                    <ThumbsDown className="w-4 h-4 mr-1" />
                                                    {post.downvotes_count}
                                                </Button>
                                            </div>
                                        </div>

                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Reply Form */}
                    {!thread.is_locked && user && (
                        <Card>
                            <CardContent className="p-6">
                                <h3 className="font-semibold mb-4">Post a Reply</h3>
                                <textarea
                                    value={replyContent}
                                    onChange={(e) => setReplyContent(e.target.value)}
                                    placeholder="Write your reply..."
                                    className="w-full min-h-[120px] p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008060] resize-none"
                                />
                                <div className="flex justify-end mt-4">
                                    <Button
                                        onClick={handleReply}
                                        disabled={isSubmitting || !replyContent.trim()}
                                        variant="brand"
                                    >
                                        {isSubmitting ? "Posting..." : "Post Reply"}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Delete Confirmation Dialog */}
                    <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete your
                                    {deleteTarget?.type === "thread" ? " thread and all its replies" : " comment"}.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
                                    Delete
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                    {thread.is_locked && (
                        <Card>
                            <CardContent className="p-6 text-center text-gray-600">
                                <Lock className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                                <p>This thread is locked. No new replies can be posted.</p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </AppLayout>
    );
};
