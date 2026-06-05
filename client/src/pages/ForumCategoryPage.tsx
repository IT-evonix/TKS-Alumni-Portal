import React, { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { formatTimeAgo } from "@/utils/time";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { BackButton } from "@/components/common/BackButton";
import {
    Plus,
    Pin,
    Lock,
    CheckCircle,
    MessageSquare,
    Eye,
    ThumbsUp,
    Clock,
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
}

interface Thread {
    id: string;
    title: string;
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

export const ForumCategoryPage = (): JSX.Element => {
    const { slug } = useParams<{ slug: string }>();
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const { user } = useAuth(); // Added useAuth
    const [category, setCategory] = useState<Category | null>(null);
    const [threads, setThreads] = useState<Thread[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [sortBy, setSortBy] = useState("recent");

    useEffect(() => {
        if (slug) {
            fetchCategoryData();
        }
    }, [slug, sortBy]);

    const handleUserClick = (e: React.MouseEvent, userId: string) => {
        // If it's the current user, allow bubbling (so they can click the card/thread)
        // and do not redirect to profile.
        if (user?.id === userId) return;

        e.stopPropagation();
        setLocation(`/profile/${userId}`);
    };

    const fetchCategoryData = async () => {
        try {
            setIsLoading(true);

            // First, get all categories to find the one with matching slug
            const categoriesResponse = await fetch("/api/forums/categories");
            if (!categoriesResponse.ok) throw new Error("Failed to fetch categories");

            const categoriesData = await categoriesResponse.json();
            const foundCategory = categoriesData.categories.find((c: Category) => c.slug === slug);

            if (!foundCategory) {
                toast({
                    title: "Category not found",
                    description: "The requested category does not exist",
                    variant: "destructive",
                });
                setLocation("/forums");
                return;
            }

            setCategory(foundCategory);
            document.title = `${foundCategory.name} - Forums - TKS Alumni Portal`;

            // Fetch threads for this category
            const threadsResponse = await fetch(
                `/api/forums/categories/${foundCategory.id}?sort=${sortBy}`,
                {
                    headers: {
                        "user-id": localStorage.getItem("userId") || "",
                    },
                }
            );

            if (threadsResponse.ok) {
                const threadsData = await threadsResponse.json();
                setThreads(threadsData.threads || []);
            }
        } catch (error) {
            console.error("Error fetching category:", error);
            toast({
                title: "Error",
                description: "Failed to load category",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const formatNumber = (num: number): string => {
        if (num >= 1000) {
            return `${(num / 1000).toFixed(1)}k`;
        }
        return num.toString();
    };

    // ... (rendering logic unchanged until threads map) ...

    if (isLoading) {
        return (
            <AppLayout currentPage="forums">
                <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center">
                    <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#008060]"></div>
                        <p className="mt-2 text-gray-600">Loading category...</p>
                    </div>
                </div>
            </AppLayout>
        );
    }

    if (!category) {
        return (
            <AppLayout currentPage="forums">
                <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center">
                    <div className="text-center">
                        <p className="text-gray-600">Category not found</p>
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
                <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
                    {/* Back Button */}
                    <div className="mb-3 sm:mb-4">
                        <BackButton />
                    </div>

                    {/* Category Header */}
                    <Card className="mb-4 sm:mb-6 border-l-4" style={{ borderLeftColor: category.color }}>
                        <CardContent className="p-4 sm:p-6">
                            <div className="flex flex-col sm:flex-row items-start gap-4">
                                <div
                                    className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center text-2xl sm:text-3xl shadow-sm flex-shrink-0"
                                    style={{ backgroundColor: `${category.color}15` }}
                                >
                                    {category.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-2">
                                        {category.name}
                                    </h1>
                                    <p className="text-sm sm:text-base text-gray-600 mb-3 sm:mb-4">{category.description}</p>
                                    <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-xs sm:text-sm text-gray-500">
                                        <span className="flex items-center gap-1">
                                            <MessageSquare className="w-4 h-4" />
                                            {formatNumber(category.threads_count)} threads
                                        </span>
                                        <span className="flex items-center gap-1">
                                            ?? {formatNumber(category.posts_count)} posts
                                        </span>
                                    </div>
                                </div>
                                <Button
                                    onClick={() => setLocation(`/forums/new?categoryId=${category.id}`)}
                                    variant="brand"
                                    className="w-full sm:w-auto min-h-[44px] text-sm sm:text-base"
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    New Thread
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Sort Options */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
                        <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold">Threads</h2>
                        <Select value={sortBy} onValueChange={setSortBy}>
                            <SelectTrigger className="w-full sm:w-[180px] min-h-[44px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="recent">Most Recent</SelectItem>
                                <SelectItem value="votes">Most Voted</SelectItem>
                                <SelectItem value="replies">Most Replies</SelectItem>
                                <SelectItem value="views">Most Viewed</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Threads List */}
                    {threads.length === 0 ? (
                        <Card>
                            <CardContent className="p-12 text-center">
                                <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                                <p className="text-gray-600 mb-4">No threads in this category yet</p>
                                <Button
                                    onClick={() => setLocation(`/forums/new?categoryId=${category.id}`)}
                                    variant="brand"
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    Start a Discussion
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-3 sm:space-y-4">
                            {threads.map((thread) => (
                                <Card
                                    key={thread.id}
                                    className="hover:shadow-lg transition-all duration-200 cursor-pointer group"
                                    onClick={() => setLocation(`/forums/thread/${thread.id}`)}
                                >
                                    <CardContent className="p-4 sm:p-6">
                                        <div className="flex items-start gap-3 sm:gap-4">
                                            <div className="flex-1 min-w-0">
                                                {/* Thread Badges */}
                                                <div className="flex items-center gap-2 mb-2 flex-wrap">
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
                                                    {thread.thread_type === "question" && (
                                                        <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">? Question</Badge>
                                                    )}
                                                    {thread.thread_type === "announcement" && (
                                                        <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">?? Announcement</Badge>
                                                    )}
                                                    {thread.thread_type === "job_opportunity" && (
                                                        <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700">?? Job</Badge>
                                                    )}
                                                    {thread.thread_type === "event" && (
                                                        <Badge variant="outline" className="border-pink-200 bg-pink-50 text-pink-700">?? Event</Badge>
                                                    )}
                                                    {thread.thread_type === "mentorship" && (
                                                        <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700">?? Mentorship</Badge>
                                                    )}
                                                    {thread.thread_type === "resource" && (
                                                        <Badge variant="outline" className="border-teal-200 bg-teal-50 text-teal-700">?? Resource</Badge>
                                                    )}
                                                    {thread.thread_type === "poll" && (
                                                        <Badge variant="outline" className="border-yellow-200 bg-yellow-50 text-yellow-700">?? Poll</Badge>
                                                    )}
                                                    {thread.thread_type === "success_story" && (
                                                        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">?? Success</Badge>
                                                    )}
                                                    {thread.thread_type === "collaboration" && (
                                                        <Badge variant="outline" className="border-cyan-200 bg-cyan-50 text-cyan-700">?? Collab</Badge>
                                                    )}
                                                </div>

                                                {/* Thread Title */}
                                                <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-[#008060] transition-colors line-clamp-2">
                                                    {thread.title}
                                                </h3>

                                                {/* Thread Meta */}
                                                <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                                                    <span
                                                        className={`transition-colors ${user?.id !== thread.author.id ? "cursor-pointer hover:text-[#008060] hover:underline" : ""}`}
                                                        onClick={(e) => handleUserClick(e, thread.author.id)}
                                                    >
                                                        by @{thread.author.username}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {formatTimeAgo(thread.last_activity_at)}
                                                    </span>
                                                </div>

                                                {/* Thread Stats */}
                                                <div className="flex items-center gap-4 text-sm text-gray-600">
                                                    <span className="flex items-center gap-1">
                                                        <ThumbsUp className="w-4 h-4" />
                                                        {thread.upvotes_count}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <MessageSquare className="w-4 h-4" />
                                                        {thread.posts_count}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Eye className="w-4 h-4" />
                                                        {formatNumber(thread.views_count)}
                                                    </span>
                                                </div>

                                                {/* Tags */}
                                                {thread.tags && thread.tags.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 mt-3">
                                                        {thread.tags.map((tag, index) => (
                                                            <Badge
                                                                key={index}
                                                                variant="outline"
                                                                className="text-xs"
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
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
};
