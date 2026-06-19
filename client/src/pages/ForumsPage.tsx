import React, { useState, useEffect } from "react";
import { formatTimeAgo, getUserTimezonePreference, formatTimeWithPreference } from "@/utils/time";
import { useAutoUpdateTime } from "@/hooks/useAutoUpdateTime";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Search,
    Plus,
    TrendingUp,
    Flame,
    Star,
    Pin,
    MessageSquare,
    Eye,
    ThumbsUp,
    Clock,
    Users,
    Award,
    Trophy,
    Bookmark,
} from "lucide-react";

interface Category {
    id: string;
    name: string;
    slug: string;
    description: string;
    icon: string;
    color: string;
    threads_count: number;
    posts_count: number;
    members_count?: number;
    is_active: boolean;
}

interface Thread {
    id: string;
    title: string;
    slug: string;
    content: string;
    thread_type: string;
    tags: string[];
    is_pinned: boolean;
    is_locked: boolean;
    is_resolved: boolean;
    views_count: number;
    posts_count: number;
    upvotes_count: number;
    created_at: string;
    last_activity_at: string;
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

interface Contributor {
    id: string;
    user_id: string;
    reputation_score: number;
    reputation_level: string;
    user: {
        id: string;
        username: string;
        profile_picture?: string;
    };
}

export const ForumsPage = (): JSX.Element => {
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const { user } = useAuth();
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState("all");
    const [categories, setCategories] = useState<Category[]>([]);
    const [risingThreads, setRisingThreads] = useState<Thread[]>([]);
    const [freshThreads, setFreshThreads] = useState<Thread[]>([]);
    const [unansweredThreads, setUnansweredThreads] = useState<Thread[]>([]);
    const [bookmarkedThreads, setBookmarkedThreads] = useState<Thread[]>([]);
    const [topContributors, setTopContributors] = useState<Contributor[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingBookmarks, setIsLoadingBookmarks] = useState(false);

    // Set page title
    useEffect(() => {
        document.title = "Forums - TKS Alumni Portal";
    }, []);

    // Fetch categories and threads
    useEffect(() => {
        fetchCategories();
        fetchRisingThreads();
        fetchFreshThreads();
        fetchUnansweredThreads();
        fetchLeaderboard();
    }, []);

    // Fetch bookmarked threads when bookmarked tab is active
    useEffect(() => {
        if (activeTab === "bookmarked" && user?.id) {
            fetchBookmarkedThreads();
        }
    }, [activeTab, user?.id]);

    const fetchCategories = async () => {
        try {
            const response = await fetch("/api/forums/categories", {
                headers: {
                    "user-id": localStorage.getItem("userId") || "",
                },
            });

            if (response.ok) {
                const data = await response.json();
                setCategories(data.categories || []);
            }
        } catch (error) {
            console.error("Error fetching categories:", error);
            toast({
                title: "Error",
                description: "Failed to load forum categories",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const fetchRisingThreads = async () => {
        try {
            const response = await fetch("/api/forums/rising?limit=10", {
                headers: {
                    "user-id": localStorage.getItem("userId") || "",
                },
            });

            if (response.ok) {
                const data = await response.json();
                setRisingThreads(data.threads || []);
            }
        } catch (error) {
            console.error("Error fetching rising threads:", error);
        }
    };

    const fetchFreshThreads = async () => {
        try {
            const response = await fetch("/api/forums/threads?sort=new&limit=10", {
                headers: {
                    "user-id": localStorage.getItem("userId") || "",
                },
            });

            if (response.ok) {
                const data = await response.json();
                setFreshThreads(data.threads || []);
            }
        } catch (error) {
            console.error("Error fetching fresh threads:", error);
        }
    };

    const fetchUnansweredThreads = async () => {
        try {
            const response = await fetch("/api/forums/threads?unanswered=true&limit=10", {
                headers: {
                    "user-id": localStorage.getItem("userId") || "",
                },
            });

            if (response.ok) {
                const data = await response.json();
                setUnansweredThreads(data.threads || []);
            }
        } catch (error) {
            console.error("Error fetching unanswered threads:", error);
        }
    };

    const fetchLeaderboard = async () => {
        try {
            const response = await fetch("/api/forums/leaderboard?limit=5", {
                headers: {
                    "user-id": localStorage.getItem("userId") || "",
                },
            });

            if (response.ok) {
                const data = await response.json();
                setTopContributors(data.leaderboard || []);
            }
        } catch (error) {
            console.error("Error fetching leaderboard:", error);
        }
    };

    const fetchBookmarkedThreads = async () => {
        if (!user?.id) {
            return;
        }

        setIsLoadingBookmarks(true);
        try {
            const response = await fetch("/api/forums/bookmarks", {
                headers: {
                    "user-id": user.id,
                },
            });

            if (response.ok) {
                const data = await response.json();
                // Transform bookmarks data to threads format
                const threads = (data.bookmarks || []).map((bookmark: any) => {
                    const thread = bookmark.thread;
                    return {
                        id: thread.id,
                        title: thread.title,
                        slug: thread.slug,
                        content: thread.content,
                        thread_type: thread.thread_type,
                        tags: thread.tags || [],
                        is_pinned: thread.is_pinned,
                        is_locked: thread.is_locked,
                        is_resolved: thread.is_resolved,
                        views_count: thread.views_count || 0,
                        posts_count: thread.posts_count || 0,
                        upvotes_count: thread.upvotes_count || 0,
                        created_at: thread.created_at,
                        last_activity_at: thread.last_activity_at || thread.created_at,
                        author: thread.author,
                        category: thread.category,
                        isBookmarked: true, // Mark as bookmarked
                        bookmarked_at: bookmark.created_at, // When it was bookmarked
                    };
                });
                setBookmarkedThreads(threads);
            } else {
                toast({
                    title: "Error",
                    description: "Failed to load bookmarked threads",
                    variant: "destructive",
                });
            }
        } catch (error) {
            console.error("Error fetching bookmarked threads:", error);
            toast({
                title: "Error",
                description: "Failed to load bookmarked threads",
                variant: "destructive",
            });
        } finally {
            setIsLoadingBookmarks(false);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            setLocation(`/forums/search?q=${encodeURIComponent(searchQuery)}`);
        }
    };

    const handleNewThread = () => {
        setLocation("/forums/new");
    };

    const formatNumber = (num: number): string => {
        if (num >= 1000) {
            return `${(num / 1000).toFixed(1)}k`;
        }
        return num.toString();
    };

    const handleUserClick = (e: React.MouseEvent, userId: string) => {
        // If it's the current user, allow bubbling (so they can click the card/thread)
        // and do not redirect to profile.
        if (user?.id === userId) return;

        e.stopPropagation();
        setLocation(`/profile/${userId}`);
    };

    return (
        <AppLayout currentPage="forums">
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
                <div className="max-w-[1400px] mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
                    {/* Header */}
                    <div className="mb-6 sm:mb-8">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
                            <div className="min-w-0">
                                <p className="text-sm sm:text-base text-gray-600 mt-2">
                                    Connect, share knowledge, and engage with the alumni community
                                </p>
                            </div>
                            <Button
                                onClick={handleNewThread}
                                className="bg-gradient-to-r from-[#008060] to-[#006b4f] hover:from-[#006b4f] hover:to-[#005a42] text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 w-full sm:w-auto min-h-[44px]"
                                aria-label="Create new thread"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                New Thread
                            </Button>
                        </div>

                        {/* Search Bar */}
                        <form onSubmit={handleSearch} className="relative group">
                            <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-focus-within:text-[#008060] transition-colors duration-300" />
                            <Input
                                type="text"
                                placeholder="Search discussions, topics, or users..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 sm:pl-12 pr-4 h-11 sm:h-12 text-sm sm:text-base border-gray-200 focus:border-[#008060] focus:ring-2 focus:ring-[#008060]/20 rounded-xl shadow-sm group-hover:shadow-md transition-all duration-300"
                                aria-label="Search forums"
                            />
                        </form>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
                        {/* Main Content */}
                        <div className="lg:col-span-2 xl:col-span-3">
                            {/* Tabs */}
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6 sm:mb-8">
                                {/* Compact Scrollable Tabs Container - Sized Up */}
                                <div className="w-full overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
                                    <TabsList className="inline-flex w-auto h-auto p-1.5 bg-white border border-gray-200 rounded-xl gap-2 shadow-sm">
                                        <TabsTrigger
                                            value="all"
                                            className="flex-shrink-0 rounded-lg data-[state=active]:bg-[#008060] data-[state=active]:text-white data-[state=active]:shadow-md hover:text-[#008060] px-4 py-2 text-sm sm:text-sm font-medium transition-all"
                                        >
                                            All
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="rising"
                                            className="flex-shrink-0 rounded-lg data-[state=active]:bg-[#008060] data-[state=active]:text-white data-[state=active]:shadow-md hover:text-[#008060] px-4 py-2 text-sm sm:text-sm font-medium transition-all"
                                        >
                                            <TrendingUp className="w-4 h-4 mr-2 inline-block" />
                                            Rising
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="fresh"
                                            className="flex-shrink-0 rounded-lg data-[state=active]:bg-[#008060] data-[state=active]:text-white data-[state=active]:shadow-md hover:text-[#008060] px-4 py-2 text-sm sm:text-sm font-medium transition-all"
                                        >
                                            <Clock className="w-4 h-4 mr-2 inline-block" />
                                            Fresh
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="unanswered"
                                            className="flex-shrink-0 rounded-lg data-[state=active]:bg-[#008060] data-[state=active]:text-white data-[state=active]:shadow-md hover:text-[#008060] px-4 py-2 text-sm sm:text-sm font-medium transition-all"
                                        >
                                            <MessageSquare className="w-4 h-4 mr-2 inline-block" />
                                            Unanswered
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="bookmarked"
                                            className="flex-shrink-0 rounded-lg data-[state=active]:bg-[#008060] data-[state=active]:text-white data-[state=active]:shadow-md hover:text-[#008060] px-4 py-2 text-sm sm:text-sm font-medium transition-all"
                                        >
                                            <Bookmark className="w-4 h-4 mr-2 inline-block" />
                                            Saved
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="leaderboard"
                                            className="lg:hidden flex-shrink-0 rounded-lg data-[state=active]:bg-[#008060] data-[state=active]:text-white data-[state=active]:shadow-md hover:text-[#008060] px-4 py-2 text-sm sm:text-sm font-medium transition-all"
                                        >
                                            <Award className="w-4 h-4 mr-2 inline-block" />
                                            Leaders
                                        </TabsTrigger>
                                    </TabsList>
                                </div>

                                <TabsContent value="all" className="mt-4 sm:mt-6">
                                    {isLoading ? (
                                        <div className="text-center py-12">
                                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#008060]"></div>
                                            <p className="mt-2 text-gray-600">Loading categories...</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 md:gap-5 overflow-hidden">
                                            {categories.map((category) => (
                                                <Card
                                                    key={category.id}
                                                    className="relative overflow-hidden hover:shadow-2xl transition-all duration-300 cursor-pointer border-0 group bg-gradient-to-br from-white to-gray-50/50 hover:scale-[1.02]"
                                                    onClick={() => setLocation(`/forums/category/${category.slug}`)}
                                                >
                                                    {/* Animated border glow */}
                                                    <div
                                                        className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                                                        style={{
                                                            background: `linear-gradient(135deg, ${category.color}20, transparent)`,
                                                            border: `2px solid ${category.color}30`
                                                        }}
                                                    />

                                                    <CardContent className="relative p-4 sm:p-5 md:p-6">
                                                        <div className="flex items-start gap-3 sm:gap-4">
                                                            {/* Enhanced icon container */}
                                                            <div
                                                                className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center text-xl sm:text-2xl md:text-3xl shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300 flex-shrink-0"
                                                                style={{
                                                                    background: `linear-gradient(135deg, ${category.color}20, ${category.color}10)`,
                                                                    boxShadow: `0 4px 12px ${category.color}20`
                                                                }}
                                                                aria-hidden="true"
                                                            >
                                                                {category.icon}
                                                            </div>

                                                            {/* Content with better hierarchy */}
                                                            <div className="flex-1 min-w-0">
                                                                <h3 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 mb-1.5 group-hover:text-[#008060] transition-colors line-clamp-1">
                                                                    {category.name}
                                                                </h3>
                                                                <p className="text-gray-600 text-xs sm:text-sm mb-3 line-clamp-2 leading-relaxed">
                                                                    {category.description}
                                                                </p>
                                                                <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-gray-500">
                                                                    <span className="flex items-center gap-1.5 bg-white/80 backdrop-blur-sm px-2.5 py-1.5 rounded-lg shadow-sm group-hover:bg-white transition-colors">
                                                                        <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 text-[#008060]" />
                                                                        <span className="font-semibold text-gray-700">{formatNumber(category.threads_count)}</span>
                                                                    </span>
                                                                    <span className="flex items-center gap-1.5 bg-white/80 backdrop-blur-sm px-2.5 py-1.5 rounded-lg shadow-sm group-hover:bg-white transition-colors">
                                                                        <Users className="w-3.5 h-3.5 flex-shrink-0 text-[#008060]" />
                                                                        <span className="font-semibold text-gray-700">{formatNumber(category.members_count || 0)}</span>
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    )}
                                </TabsContent>

                                <TabsContent value="rising" className="mt-4 sm:mt-6">
                                    <div className="grid grid-cols-1 gap-3 sm:gap-4 overflow-hidden">
                                        {risingThreads.length === 0 ? (
                                            <div className="text-center py-12 text-gray-500">
                                                <TrendingUp className="w-12 h-12 mx-auto mb-2 text-gray-300" aria-hidden="true" />
                                                <p className="text-sm sm:text-base">No rising threads right now</p>
                                            </div>
                                        ) : (
                                            risingThreads.map((thread) => (
                                                <Card
                                                    key={thread.id}
                                                    className="hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group border-0 ring-1 ring-gray-100 hover:ring-[#008060]/30 overflow-hidden bg-white hover:bg-gradient-to-br hover:from-white hover:to-[#008060]/5"
                                                    onClick={() => setLocation(`/forums/thread/${thread.id}`)}
                                                >
                                                    <div className="absolute top-0 left-0 w-1 h-full bg-[#008060] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                                    <CardContent className="p-4 sm:p-5 md:p-6">
                                                        <div className="flex items-start gap-3 sm:gap-4">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex flex-wrap items-center gap-2 mb-2 sm:mb-3">
                                                                    {thread.is_pinned && (
                                                                        <Pin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#008060] flex-shrink-0 fill-[#008060]/20" />
                                                                    )}
                                                                    {thread.is_resolved && (
                                                                        <Badge className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100 text-[10px] sm:text-xs font-medium">
                                                                            ✓ Resolved
                                                                        </Badge>
                                                                    )}
                                                                    <Badge
                                                                        style={{
                                                                            backgroundColor: `${thread.category.color}15`,
                                                                            color: thread.category.color,
                                                                            borderColor: `${thread.category.color}30`
                                                                        }}
                                                                        className="text-[10px] sm:text-xs font-medium border"
                                                                    >
                                                                        {thread.category.name}
                                                                    </Badge>
                                                                    {thread.thread_type === 'question' && (
                                                                        <Badge variant="outline" className="border-orange-200 text-orange-600 bg-orange-50 text-[10px] sm:text-xs">
                                                                            ❓ Question
                                                                        </Badge>
                                                                    )}
                                                                    {thread.thread_type === 'announcement' && (
                                                                        <Badge variant="outline" className="border-blue-200 text-blue-600 bg-blue-50 text-[10px] sm:text-xs">
                                                                            📢 Announcement
                                                                        </Badge>
                                                                    )}
                                                                    <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-200 text-[10px] sm:text-xs">
                                                                        <TrendingUp className="w-3 h-3 mr-1" />
                                                                        Rising
                                                                    </Badge>
                                                                </div>
                                                                <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-2 sm:mb-3 group-hover:text-[#008060] transition-colors line-clamp-2">
                                                                    {thread.title}
                                                                </h3>
                                                                <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-500 mb-2 sm:mb-3">
                                                                    <span
                                                                        className={`transition-colors font-medium flex items-center gap-1.5 ${user?.id !== thread.author.id ? "cursor-pointer hover:text-[#008060] hover:underline" : ""}`}
                                                                        onClick={(e) => handleUserClick(e, thread.author.id)}
                                                                    >
                                                                        <Avatar className="w-5 h-5 border border-gray-200">
                                                                            <AvatarImage src={thread.author.profile_picture} />
                                                                            <AvatarFallback className="text-[10px] bg-gray-100">{thread.author.username.charAt(0)}</AvatarFallback>
                                                                        </Avatar>
                                                                        @{thread.author.username}
                                                                    </span>
                                                                    <span className="flex items-center gap-1.5 bg-gray-50 px-2 py-0.5 rounded-full">
                                                                        <Clock className="w-3 h-3 flex-shrink-0 text-gray-400" />
                                                                        <span className="whitespace-nowrap" title={new Date(thread.created_at).toLocaleString()}>
                                                                            {formatTimeAgo(thread.created_at)}
                                                                        </span>
                                                                    </span>
                                                                </div>
                                                                <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-600 border-t border-gray-50 pt-3 mt-1">
                                                                    <span className="flex items-center gap-1.5 hover:text-[#008060] transition-colors">
                                                                        <ThumbsUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                                                                        <span className="font-medium">{thread.upvotes_count}</span>
                                                                    </span>
                                                                    <span className="flex items-center gap-1.5 hover:text-[#008060] transition-colors">
                                                                        <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                                                                        <span className="font-medium">{thread.posts_count}</span>
                                                                    </span>
                                                                    <span className="flex items-center gap-1.5 hover:text-[#008060] transition-colors">
                                                                        <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                                                                        <span className="font-medium">{formatNumber(thread.views_count)}</span>
                                                                    </span>
                                                                </div>
                                                                {thread.tags && thread.tags.length > 0 && (
                                                                    <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-3 p-2 bg-gray-50/50 rounded-lg">
                                                                        {thread.tags.map((tag, index) => (
                                                                            <Badge
                                                                                key={index}
                                                                                variant="outline"
                                                                                className="text-[10px] sm:text-xs bg-white text-gray-600 hover:text-[#008060] hover:border-[#008060]/30 transition-colors"
                                                                            >
                                                                                #{tag}
                                                                            </Badge>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))
                                        )}
                                    </div>
                                </TabsContent>

                                <TabsContent value="fresh" className="mt-4 sm:mt-6">
                                    <div className="grid grid-cols-1 gap-3 sm:gap-4 overflow-hidden">
                                        {freshThreads.length === 0 ? (
                                            <div className="text-center py-12 text-gray-500">
                                                <Clock className="w-12 h-12 mx-auto mb-2 text-gray-300" aria-hidden="true" />
                                                <p className="text-sm sm:text-base">No fresh threads found</p>
                                            </div>
                                        ) : (
                                            freshThreads.map((thread) => (
                                                <Card
                                                    key={thread.id}
                                                    className="hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group border-0 ring-1 ring-gray-100 hover:ring-[#008060]/30 overflow-hidden bg-white hover:bg-gradient-to-br hover:from-white hover:to-[#008060]/5"
                                                    onClick={() => setLocation(`/forums/thread/${thread.id}`)}
                                                >
                                                    <div className="absolute top-0 left-0 w-1 h-full bg-[#008060] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                                    <CardContent className="p-4 sm:p-5 md:p-6">
                                                        <div className="flex items-start gap-3 sm:gap-4">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex flex-wrap items-center gap-2 mb-2 sm:mb-3">
                                                                    {thread.is_pinned && (
                                                                        <Pin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#008060] flex-shrink-0 fill-[#008060]/20" />
                                                                    )}
                                                                    {thread.is_resolved && (
                                                                        <Badge className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100 text-[10px] sm:text-xs font-medium">
                                                                            ✓ Resolved
                                                                        </Badge>
                                                                    )}
                                                                    <Badge
                                                                        style={{
                                                                            backgroundColor: `${thread.category.color}15`,
                                                                            color: thread.category.color,
                                                                            borderColor: `${thread.category.color}30`
                                                                        }}
                                                                        className="text-[10px] sm:text-xs font-medium border"
                                                                    >
                                                                        {thread.category.name}
                                                                    </Badge>
                                                                    {thread.thread_type === 'question' && (
                                                                        <Badge variant="outline" className="border-orange-200 text-orange-600 bg-orange-50 text-[10px] sm:text-xs">
                                                                            ❓ Question
                                                                        </Badge>
                                                                    )}
                                                                    {thread.thread_type === 'announcement' && (
                                                                        <Badge variant="outline" className="border-blue-200 text-blue-600 bg-blue-50 text-[10px] sm:text-xs">
                                                                            📢 Announcement
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-2 sm:mb-3 group-hover:text-[#008060] transition-colors line-clamp-2">
                                                                    {thread.title}
                                                                </h3>
                                                                <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-500 mb-2 sm:mb-3">
                                                                    <span
                                                                        className={`transition-colors font-medium flex items-center gap-1.5 ${user?.id !== thread.author.id ? "cursor-pointer hover:text-[#008060] hover:underline" : ""}`}
                                                                        onClick={(e) => handleUserClick(e, thread.author.id)}
                                                                    >
                                                                        <Avatar className="w-5 h-5 border border-gray-200">
                                                                            <AvatarImage src={thread.author.profile_picture} />
                                                                            <AvatarFallback className="text-[10px] bg-gray-100">{thread.author.username.charAt(0)}</AvatarFallback>
                                                                        </Avatar>
                                                                        @{thread.author.username}
                                                                    </span>
                                                                    <span className="flex items-center gap-1.5 bg-gray-50 px-2 py-0.5 rounded-full">
                                                                        <Clock className="w-3 h-3 flex-shrink-0 text-gray-400" />
                                                                        <span className="whitespace-nowrap" title={new Date(thread.created_at).toLocaleString()}>
                                                                            {formatTimeAgo(thread.created_at)}
                                                                        </span>
                                                                    </span>
                                                                </div>
                                                                <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-600 border-t border-gray-50 pt-3 mt-1">
                                                                    <span className="flex items-center gap-1.5 hover:text-[#008060] transition-colors">
                                                                        <ThumbsUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                                                                        <span className="font-medium">{thread.upvotes_count}</span>
                                                                    </span>
                                                                    <span className="flex items-center gap-1.5 hover:text-[#008060] transition-colors">
                                                                        <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                                                                        <span className="font-medium">{thread.posts_count}</span>
                                                                    </span>
                                                                    <span className="flex items-center gap-1.5 hover:text-[#008060] transition-colors">
                                                                        <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                                                                        <span className="font-medium">{formatNumber(thread.views_count)}</span>
                                                                    </span>
                                                                </div>
                                                                {thread.tags && thread.tags.length > 0 && (
                                                                    <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-3 p-2 bg-gray-50/50 rounded-lg">
                                                                        {thread.tags.map((tag, index) => (
                                                                            <Badge
                                                                                key={index}
                                                                                variant="outline"
                                                                                className="text-[10px] sm:text-xs bg-white text-gray-600 hover:text-[#008060] hover:border-[#008060]/30 transition-colors"
                                                                            >
                                                                                #{tag}
                                                                            </Badge>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))
                                        )}
                                    </div>
                                </TabsContent>

                                <TabsContent value="unanswered" className="mt-4 sm:mt-6">
                                    <div className="grid grid-cols-1 gap-3 sm:gap-4 overflow-hidden">
                                        {unansweredThreads.length === 0 ? (
                                            <div className="text-center py-12 text-gray-500">
                                                <MessageSquare className="w-12 h-12 mx-auto mb-2 text-gray-300" aria-hidden="true" />
                                                <p className="text-sm sm:text-base">No unanswered threads found</p>
                                            </div>
                                        ) : (
                                            unansweredThreads.map((thread) => (
                                                <Card
                                                    key={thread.id}
                                                    className="hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group border-0 ring-1 ring-gray-100 hover:ring-[#008060]/30 overflow-hidden bg-white hover:bg-gradient-to-br hover:from-white hover:to-[#008060]/5"
                                                    onClick={() => setLocation(`/forums/thread/${thread.id}`)}
                                                >
                                                    <div className="absolute top-0 left-0 w-1 h-full bg-[#008060] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                                    <CardContent className="p-4 sm:p-5 md:p-6">
                                                        <div className="flex items-start gap-3 sm:gap-4">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex flex-wrap items-center gap-2 mb-2 sm:mb-3">
                                                                    <Badge
                                                                        style={{
                                                                            backgroundColor: `${thread.category.color}15`,
                                                                            color: thread.category.color,
                                                                            borderColor: `${thread.category.color}30`
                                                                        }}
                                                                        className="text-[10px] sm:text-xs font-medium border"
                                                                    >
                                                                        {thread.category.name}
                                                                    </Badge>
                                                                    {thread.thread_type === 'question' && (
                                                                        <Badge variant="outline" className="border-orange-200 text-orange-600 bg-orange-50 text-[10px] sm:text-xs">
                                                                            ❓ Question
                                                                        </Badge>
                                                                    )}
                                                                    {thread.thread_type === 'announcement' && (
                                                                        <Badge variant="outline" className="border-blue-200 text-blue-600 bg-blue-50 text-[10px] sm:text-xs">
                                                                            📢 Announcement
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-2 sm:mb-3 group-hover:text-[#008060] transition-colors line-clamp-2">
                                                                    {thread.title}
                                                                </h3>
                                                                <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-500 mb-2 sm:mb-3">
                                                                    <span
                                                                        className={`transition-colors font-medium flex items-center gap-1.5 ${user?.id !== thread.author.id ? "cursor-pointer hover:text-[#008060] hover:underline" : ""}`}
                                                                        onClick={(e) => handleUserClick(e, thread.author.id)}
                                                                    >
                                                                        <Avatar className="w-5 h-5 border border-gray-200">
                                                                            <AvatarImage src={thread.author.profile_picture} />
                                                                            <AvatarFallback className="text-[10px] bg-gray-100">{thread.author.username.charAt(0)}</AvatarFallback>
                                                                        </Avatar>
                                                                        @{thread.author.username}
                                                                    </span>
                                                                    <span className="flex items-center gap-1.5 bg-gray-50 px-2 py-0.5 rounded-full">
                                                                        <Clock className="w-3 h-3 flex-shrink-0 text-gray-400" />
                                                                        <span className="whitespace-nowrap" title={new Date(thread.created_at).toLocaleString()}>
                                                                            {formatTimeAgo(thread.created_at)}
                                                                        </span>
                                                                    </span>
                                                                </div>
                                                                <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-600 border-t border-gray-50 pt-3 mt-1">
                                                                    <span className="flex items-center gap-1.5 hover:text-[#008060] transition-colors">
                                                                        <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                                                                        <span className="font-medium">{thread.posts_count} {thread.posts_count === 1 ? 'reply' : 'replies'}</span>
                                                                    </span>
                                                                    <span className="flex items-center gap-1.5 hover:text-[#008060] transition-colors">
                                                                        <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                                                                        <span className="font-medium">{formatNumber(thread.views_count)}</span>
                                                                    </span>
                                                                </div>
                                                                {thread.tags && thread.tags.length > 0 && (
                                                                    <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-3 p-2 bg-gray-50/50 rounded-lg">
                                                                        {thread.tags.map((tag, index) => (
                                                                            <Badge
                                                                                key={index}
                                                                                variant="outline"
                                                                                className="text-[10px] sm:text-xs bg-white text-gray-600 hover:text-[#008060] hover:border-[#008060]/30 transition-colors"
                                                                            >
                                                                                #{tag}
                                                                            </Badge>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))
                                        )}
                                    </div>
                                </TabsContent>

                                <TabsContent value="bookmarked" className="mt-4 sm:mt-6">
                                    {!user ? (
                                        <div className="text-center py-12 text-gray-500">
                                            <Bookmark className="w-12 h-12 mx-auto mb-2 text-gray-300" aria-hidden="true" />
                                            <p className="text-sm sm:text-base mb-2">Please log in to view your bookmarked threads</p>
                                            <Button
                                                onClick={() => setLocation("/login")}
                                                className="mt-4 bg-[#008060] hover:bg-[#007055] text-white"
                                            >
                                                Log In
                                            </Button>
                                        </div>
                                    ) : isLoadingBookmarks ? (
                                        <div className="text-center py-12">
                                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#008060]"></div>
                                            <p className="mt-2 text-gray-600">Loading bookmarked threads...</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-3 sm:gap-4 overflow-hidden">
                                            {bookmarkedThreads.length === 0 ? (
                                                <div className="text-center py-12 text-gray-500">
                                                    <Bookmark className="w-12 h-12 mx-auto mb-2 text-gray-300" aria-hidden="true" />
                                                    <p className="text-sm sm:text-base font-medium mb-1">No bookmarked threads yet</p>
                                                    <p className="text-xs sm:text-sm text-gray-400">Bookmark threads you want to save for later</p>
                                                </div>
                                            ) : (
                                                bookmarkedThreads.map((thread) => (
                                                    <Card
                                                        key={thread.id}
                                                        className="hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group border-0 ring-1 ring-gray-100 hover:ring-[#008060]/30 overflow-hidden bg-white hover:bg-gradient-to-br hover:from-white hover:to-[#008060]/5"
                                                        onClick={() => setLocation(`/forums/thread/${thread.id}`)}
                                                    >
                                                        <div className="absolute top-0 left-0 w-1 h-full bg-[#008060] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                                        <CardContent className="p-4 sm:p-5 md:p-6">
                                                            <div className="flex items-start gap-3 sm:gap-4">
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex flex-wrap items-center gap-2 mb-2 sm:mb-3">
                                                                        <Badge className="bg-[#008060] text-white text-[10px] sm:text-xs flex items-center gap-1 shadow-sm">
                                                                            <Bookmark className="w-3 h-3 fill-current" />
                                                                            Bookmarked
                                                                        </Badge>
                                                                        {thread.is_pinned && (
                                                                            <Pin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#008060] flex-shrink-0 fill-[#008060]/20" />
                                                                        )}
                                                                        {thread.is_resolved && (
                                                                            <Badge className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100 text-[10px] sm:text-xs font-medium">
                                                                                ✓ Resolved
                                                                            </Badge>
                                                                        )}
                                                                        <Badge
                                                                            style={{
                                                                                backgroundColor: `${thread.category.color}15`,
                                                                                color: thread.category.color,
                                                                                borderColor: `${thread.category.color}30`
                                                                            }}
                                                                            className="text-[10px] sm:text-xs font-medium border"
                                                                        >
                                                                            {thread.category.name}
                                                                        </Badge>
                                                                        {thread.thread_type === 'question' && (
                                                                            <Badge variant="outline" className="border-orange-200 text-orange-600 bg-orange-50 text-[10px] sm:text-xs">
                                                                                ❓ Question
                                                                            </Badge>
                                                                        )}
                                                                        {thread.thread_type === 'announcement' && (
                                                                            <Badge variant="outline" className="border-blue-200 text-blue-600 bg-blue-50 text-[10px] sm:text-xs">
                                                                                📢 Announcement
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                    <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-2 sm:mb-3 group-hover:text-[#008060] transition-colors line-clamp-2">
                                                                        {thread.title}
                                                                    </h3>
                                                                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-500 mb-2 sm:mb-3">
                                                                        <span
                                                                            className={`transition-colors font-medium flex items-center gap-1.5 ${user?.id !== thread.author.id ? "cursor-pointer hover:text-[#008060] hover:underline" : ""}`}
                                                                            onClick={(e) => handleUserClick(e, thread.author.id)}
                                                                        >
                                                                            <Avatar className="w-5 h-5 border border-gray-200">
                                                                                <AvatarImage src={thread.author.profile_picture} />
                                                                                <AvatarFallback className="text-[10px] bg-gray-100">{thread.author.username.charAt(0)}</AvatarFallback>
                                                                            </Avatar>
                                                                            @{thread.author.username}
                                                                        </span>
                                                                        <span className="flex items-center gap-1.5 bg-gray-50 px-2 py-0.5 rounded-full">
                                                                            <Clock className="w-3 h-3 flex-shrink-0 text-gray-400" />
                                                                            <span className="whitespace-nowrap" title={new Date(thread.created_at).toLocaleString()}>
                                                                                {formatTimeAgo(thread.created_at)}
                                                                            </span>
                                                                        </span>
                                                                        {(thread as any).bookmarked_at && (
                                                                            <span className="flex items-center gap-1 text-[#008060] bg-[#008060]/5 px-2 py-0.5 rounded-full">
                                                                                <Bookmark className="w-3 h-3 flex-shrink-0 fill-current" />
                                                                                <span className="whitespace-nowrap">Saved {formatTimeAgo((thread as any).bookmarked_at)}</span>
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-600 border-t border-gray-50 pt-3 mt-1">
                                                                        <span className="flex items-center gap-1.5 hover:text-[#008060] transition-colors">
                                                                            <ThumbsUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                                                                            <span className="font-medium">{thread.upvotes_count}</span>
                                                                        </span>
                                                                        <span className="flex items-center gap-1.5 hover:text-[#008060] transition-colors">
                                                                            <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                                                                            <span className="font-medium">{thread.posts_count}</span>
                                                                        </span>
                                                                        <span className="flex items-center gap-1.5 hover:text-[#008060] transition-colors">
                                                                            <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                                                                            <span className="font-medium">{formatNumber(thread.views_count)}</span>
                                                                        </span>
                                                                    </div>
                                                                    {thread.tags && thread.tags.length > 0 && (
                                                                        <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-2 sm:mt-3 p-2 bg-gray-50/50 rounded-lg">
                                                                            {thread.tags.map((tag, index) => (
                                                                                <Badge
                                                                                    key={index}
                                                                                    variant="outline"
                                                                                    className="text-[10px] sm:text-xs bg-white text-gray-600 hover:text-[#008060] hover:border-[#008060]/30 transition-colors"
                                                                                >
                                                                                    #{tag}
                                                                                </Badge>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </TabsContent>

                                <TabsContent value="leaderboard" className="mt-6 lg:hidden">
                                    <Card className="border-2 border-[#008060]/20">
                                        <CardHeader className="p-4 sm:p-6">
                                            <CardTitle className="flex items-center gap-2 text-[#008060] text-lg sm:text-xl">
                                                <Trophy className="w-5 h-5 flex-shrink-0" />
                                                Top Contributors
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-4 sm:p-6">
                                            <div className="space-y-4">
                                                {topContributors.length === 0 ? (
                                                    <div className="text-center py-8 text-gray-500">
                                                        <Award className="w-12 h-12 mx-auto mb-2 text-gray-300" aria-hidden="true" />
                                                        <p className="text-sm sm:text-base">No contributors yet</p>
                                                    </div>
                                                ) : (
                                                    topContributors.map((contributor, index) => (
                                                        <div key={contributor.id} className="flex items-center gap-2 sm:gap-3 min-w-0 w-full">
                                                            <div className={`font-bold w-6 sm:w-7 md:w-8 text-center flex-shrink-0 ${index === 0 ? "text-yellow-500 text-base sm:text-lg" :
                                                                index === 1 ? "text-gray-400 text-base sm:text-lg" :
                                                                    index === 2 ? "text-amber-700 text-base sm:text-lg" :
                                                                        "text-gray-400 text-sm sm:text-base"
                                                                }`}>
                                                                {index + 1}
                                                            </div>
                                                            <Avatar
                                                                className={`h-9 w-9 sm:h-10 sm:w-10 md:h-11 md:w-11 border border-gray-100 transition-opacity flex-shrink-0 ${user?.id !== contributor.user.id ? "cursor-pointer hover:opacity-80" : ""}`}
                                                                onClick={(e) => handleUserClick(e, contributor.user.id)}
                                                            >
                                                                <AvatarImage src={contributor.user.profile_picture} className="object-cover" />
                                                                <AvatarFallback className="bg-[#008060]/10 text-[#008060] text-xs sm:text-sm font-semibold">
                                                                    {contributor.user.username.charAt(0).toUpperCase()}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <div className="flex-1 min-w-0 overflow-hidden">
                                                                <p
                                                                    className={`text-xs sm:text-sm font-semibold text-gray-900 truncate transition-colors ${user?.id !== contributor.user.id ? "cursor-pointer hover:text-[#008060] hover:underline" : ""}`}
                                                                    onClick={(e) => handleUserClick(e, contributor.user.id)}
                                                                    title={contributor.user.username}
                                                                >
                                                                    {contributor.user.username}
                                                                </p>
                                                                <p className="text-[10px] sm:text-xs text-gray-500 capitalize truncate">
                                                                    {contributor.reputation_level}
                                                                </p>
                                                            </div>
                                                            <div className="text-xs sm:text-sm font-bold text-[#008060] flex-shrink-0 ml-auto">
                                                                {contributor.reputation_score}
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </TabsContent>
                            </Tabs>
                        </div >

                        {/* Sidebar - Leaderboard */}
                        <div className="hidden lg:block lg:col-span-1 mt-6 sm:mt-8 lg:mt-0">
                            <Card className="border-0 shadow-xl bg-gradient-to-br from-white via-[#008060]/5 to-white sticky top-20 sm:top-24 lg:top-28 overflow-hidden">
                                {/* Decorative background */}
                                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#008060]/10 to-transparent rounded-full blur-3xl" />

                                <CardHeader className="relative p-4 sm:p-6 border-b border-gray-100">
                                    <CardTitle className="flex items-center gap-2 text-[#008060] text-lg sm:text-xl">
                                        <div className="p-2 bg-gradient-to-br from-[#008060] to-[#006b4f] rounded-lg shadow-md">
                                            <Trophy className="w-5 h-5 text-white" />
                                        </div>
                                        Top Contributors
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="relative p-4 sm:p-6">
                                    <div className="space-y-4">
                                        {topContributors.length === 0 ? (
                                            <div className="text-center py-8 text-gray-500">
                                                <Award className="w-12 h-12 mx-auto mb-2 text-gray-300" aria-hidden="true" />
                                                <p className="text-sm sm:text-base">No contributors yet</p>
                                            </div>
                                        ) : (
                                            topContributors.map((contributor, index) => (
                                                <div
                                                    key={contributor.id}
                                                    className={`flex items-center gap-2 p-2 rounded-lg transition-all duration-300 hover:bg-white/80 ${index < 3 ? 'bg-gradient-to-r from-white to-gray-50/50 shadow-sm border border-gray-100' : ''
                                                        }`}
                                                >
                                                    <div className={`font-bold w-6 h-6 rounded-full flex items-center justify-center text-center flex-shrink-0 ${index === 0 ? "bg-gradient-to-br from-yellow-400 to-yellow-600 text-white shadow-md text-xs" :
                                                        index === 1 ? "bg-gradient-to-br from-gray-300 to-gray-500 text-white shadow-md text-xs" :
                                                            index === 2 ? "bg-gradient-to-br from-amber-600 to-amber-800 text-white shadow-md text-xs" :
                                                                "bg-gray-100 text-gray-600 text-xs"
                                                        }`}>
                                                        {index < 3 ? (index === 0 ? "1" : index === 1 ? "2" : "3") : index + 1}
                                                    </div>
                                                    <Avatar
                                                        className={`h-8 w-8 border transition-all flex-shrink-0 ${index < 3
                                                            ? `border-${index === 0 ? 'yellow' : index === 1 ? 'gray' : 'amber'}-400 shadow-sm`
                                                            : 'border-gray-200'
                                                            } ${user?.id !== contributor.user.id ? "cursor-pointer hover:scale-105" : ""}`}
                                                        onClick={(e) => handleUserClick(e, contributor.user.id)}
                                                    >
                                                        <AvatarImage src={contributor.user.profile_picture} className="object-cover" />
                                                        <AvatarFallback className="bg-gradient-to-br from-[#008060] to-[#006b4f] text-white font-bold text-[10px]">
                                                            {contributor.user.username.charAt(0).toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1 min-w-0 ml-0.5">
                                                        <p
                                                            className={`text-xs font-semibold text-gray-900 truncate transition-colors ${user?.id !== contributor.user.id ? "cursor-pointer hover:text-[#008060]" : ""}`}
                                                            onClick={(e) => handleUserClick(e, contributor.user.id)}
                                                            title={contributor.user.username}
                                                        >
                                                            {contributor.user.username}
                                                        </p>
                                                        <p className="text-[10px] text-gray-500 capitalize truncate w-full leading-tight">
                                                            {contributor.reputation_level}
                                                        </p>
                                                    </div>
                                                    <div className="flex-shrink-0">
                                                        <div className="px-1.5 py-0.5 bg-gradient-to-r from-[#008060] to-[#006b4f] text-white rounded-full text-[10px] font-bold shadow-sm min-w-[24px] text-center">
                                                            {contributor.reputation_score}
                                                        </div>
                                                    </div>
                                                </div>
                                            )))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
};
