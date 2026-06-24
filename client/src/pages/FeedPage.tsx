import React, { useState, useEffect, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { PostCreator } from "@/components/feed/PostCreator";
import { CreatePostModal } from "@/components/feed/CreatePostModal";
import { PostCard } from "@/components/feed/PostCard";
import { SidebarEvents, SidebarJobs, SidebarConnections } from "@/components/feed/SidebarComponents";
import { GamificationLeaderboard } from "@/components/GamificationLeaderboard";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useGamification } from "@/contexts/GamificationContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Flame, Trophy, PenSquare, X } from "lucide-react";
import { useRealtimeUpdates } from "@/hooks/useRealtimeUpdates";
import { getUserFriendlyError, logError, handleAPIError } from "@/utils/errorHandler";
import { validateTextLength } from "@/utils/validation";
import { SkeletonPostCard } from "@/components/common/SkeletonLoader";
import { useOptimizedFetch } from "@/hooks/useOptimizedFetch";
import { FeedBlogCard } from "@/components/feed/FeedBlogCard";
import { FeedPodcastCard } from "@/components/feed/FeedPodcastCard";
import type { FeedItem } from "@/types/feed";

export const FeedPage = (): JSX.Element => {
  const [postText, setPostText] = useState("");
  const [, setLocation] = useLocation();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user, alumni } = useAuth();
  const { scores, globalRank } = useGamification();
  const { fetch: optimizedFetch, invalidateCache } = useOptimizedFetch();

  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };
  const firstName = alumni?.first_name || user?.username || "there";
  const graduationYear = (alumni as any)?.graduation_year as string | undefined;
  const streakDays: number = scores?.current_streak_days || 0;
  const getAuthHeaders = (extraHeaders: Record<string, string> = {}): Record<string, string> => {
    const userId = user?.id || localStorage.getItem('userId') || '';
    const token = localStorage.getItem('auth_token') || '';

    return {
      ...extraHeaders,
      'user-id': userId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  // Set page title
  React.useEffect(() => {
    document.title = "Feed - TKS Alumni Portal";
  }, []);

  // Login greeting popup — show once per session
  useEffect(() => {
    if (!sessionStorage.getItem('greetingShown')) {
      sessionStorage.setItem('greetingShown', '1');
      setShowLoginGreeting(true);
      // Trigger fade-in on next tick
      const fadeIn = setTimeout(() => setGreetingVisible(true), 50);
      // Start fade-out at 3s, remove from DOM after transition (300ms)
      const fadeOut = setTimeout(() => setGreetingVisible(false), 3000);
      const remove = setTimeout(() => setShowLoginGreeting(false), 3350);
      return () => {
        clearTimeout(fadeIn);
        clearTimeout(fadeOut);
        clearTimeout(remove);
      };
    }
  }, []);

  // Loading and error states
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Posts data
  const [posts, setPosts] = useState<any[]>([]);
  const [blogs, setBlogs] = useState<any[]>([]);
  const [podcasts, setPodcasts] = useState<any[]>([]);
  const [feedFilter, setFeedFilter] = useState<"all" | "post" | "blog" | "podcast">("all");
  const [feedLimit, setFeedLimit] = useState(30);

  // Merged, chronologically sorted feed items
  const allFeedItems = useMemo<FeedItem[]>(() => {
    const taggedPosts = posts.map((p: any) => ({ ...p, _type: "post" as const, _sortDate: p.created_at }));
    const taggedBlogs = blogs.map((b: any) => ({ ...b, _type: "blog" as const, _sortDate: b.published_at }));
    const taggedPodcasts = podcasts.map((p: any) => ({ ...p, _type: "podcast" as const, _sortDate: p.published_at ?? p.created_at }));
    return [...taggedPosts, ...taggedBlogs, ...taggedPodcasts]
      .sort((a, b) => new Date(b._sortDate).getTime() - new Date(a._sortDate).getTime());
  }, [posts, blogs, podcasts]);

  const feedItems = useMemo<FeedItem[]>(() => {
    const filtered = feedFilter === "all" ? allFeedItems : allFeedItems.filter(i => i._type === feedFilter);
    return filtered.slice(0, feedLimit);
  }, [allFeedItems, feedFilter, feedLimit]);

  const tabCounts = useMemo(() => ({
    all: allFeedItems.length,
    post: allFeedItems.filter(i => i._type === "post").length,
    blog: allFeedItems.filter(i => i._type === "blog").length,
    podcast: allFeedItems.filter(i => i._type === "podcast").length,
  }), [allFeedItems]);

  useEffect(() => { setFeedLimit(30); }, [feedFilter]);

  // Post creation states
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isPosting, setIsPosting] = useState(false);

  // Post interaction states
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());
  const [showComments, setShowComments] = useState<Set<string>>(new Set());

  // Per-post in-flight lock: prevents multiple simultaneous like requests for the same post
  const likingInFlight = useRef<Set<string>>(new Set());

  // Podcast like/comment states
  const podcastLikingInFlight = useRef<Set<string>>(new Set());
  const [showPodcastComments, setShowPodcastComments] = useState<Set<string>>(new Set());
  const [podcastCommentTexts, setPodcastCommentTexts] = useState<{ [key: string]: string }>({});

  // Job interest states
  const [interestedJobs, setInterestedJobs] = useState<Set<number>>(new Set());
  const [appliedJobs, setAppliedJobs] = useState<Set<string>>(new Set());
  const [applyingToJob, setApplyingToJob] = useState<string | null>(null);

  // Event RSVP states
  const [eventRsvps, setEventRsvps] = useState<Map<string, string>>(new Map());
  const [rsvpingEvent, setRsvpingEvent] = useState<string | null>(null);

  // Connection states
  const [sentConnections, setSentConnections] = useState<Set<string>>(new Set());

  // Post options and comments
  const [showPostOptions, setShowPostOptions] = useState<Set<string>>(new Set());
  const [commentTexts, setCommentTexts] = useState<{ [key: string]: string }>({});



  // Notification dropdown state
  const [showNotifications, setShowNotifications] = useState(false);

  // Create post modal state
  const [showPostModal, setShowPostModal] = useState(false);

  // Login greeting popup
  const [showLoginGreeting, setShowLoginGreeting] = useState(false);
  const [greetingVisible, setGreetingVisible] = useState(false);
  const hasPostedRef = useRef(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-close modal after successful post
  useEffect(() => {
    if (hasPostedRef.current && !isPosting && postText === "" && attachedFiles.length === 0) {
      setShowPostModal(false);
      hasPostedRef.current = false;
    }
  }, [isPosting, postText, attachedFiles]);

  // Fetch all feed content on mount
  useEffect(() => {
    fetchFeedContent();
  }, []);

  // Real-time updates
  useRealtimeUpdates({
    onPostLike: (data) => {
      // Update post likes count in real-time
      setPosts(prev => prev.map(p =>
        p.id === data.postId
          ? { ...p, likes_count: data.likesCount, isLikedByUser: data.isLiked }
          : p
      ));
    },
    onPostComment: (data) => {
      // Only increment count if it's not our own comment (since we handle that optimistically)
      if (data.userId !== user?.id) {
        setPosts(prev => prev.map(p =>
          p.id === data.postId
            ? { ...p, comments_count: (p.comments_count || 0) + 1 }
            : p
        ));
      }
      // If comments are shown for this post, refresh them
      if (showComments.has(data.postId)) {
        window.dispatchEvent(new CustomEvent('refresh-comments', { detail: { postId: data.postId } }));
      }
    },
    onPostUpdated: (data) => {
      // Update post content in real-time
      setPosts(prev => prev.map(p =>
        p.id === data.postId
          ? { ...p, content: data.content, updated_at: new Date().toISOString() }
          : p
      ));
    },
    onNewPost: (data) => {
      // Add new post to the top of the feed (only if not already present)
      setPosts(prev => {
        const exists = prev.some(p => p.id === data.post.id);
        if (!exists) {
          return [data.post, ...prev];
        }
        return prev;
      });
    },
    onNewBlog: (data) => {
      setBlogs(prev => prev.some(b => b.id === data.blog.id) ? prev : [data.blog, ...prev]);
    },
    onNewPodcast: (data) => {
      setPodcasts(prev => prev.some(p => p.id === data.podcast.id) ? prev : [data.podcast, ...prev]);
    },
  });

  // Scroll to specific post if postId is in URL hash or sessionStorage
  useEffect(() => {
    const hash = window.location.hash;
    const postIdFromHash = hash?.startsWith('#post-') ? hash.replace('#post-', '') : null;
    const postIdFromStorage = sessionStorage.getItem('scrollToPostId');
    const postId = postIdFromHash || postIdFromStorage;

    if (postId && !isLoadingPosts && posts.length > 0) {
      // Small timeout to ensure DOM is fully rendered
      const timeoutId = setTimeout(() => {
        const element = document.getElementById(`post-${postId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Highlight the post briefly
          element.classList.add('search-highlight');
          setTimeout(() => {
            element.classList.remove('search-highlight');
          }, 2000);
        } else {
          // Post might not be loaded yet, try to fetch it
          // Check if post exists in current posts
          const postExists = posts.some(p => p.id === postId);
          if (!postExists) {
            // Post not in current feed, redirect to shared post page
            setLocation(`/post/${postId}`);
          }
        }
        // Clear sessionStorage
        if (postIdFromStorage) {
          sessionStorage.removeItem('scrollToPostId');
        }
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [isLoadingPosts, posts.length, setLocation]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
        setShowPostOptions(new Set());
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchFeedContent = async (isRefresh = false) => {
    try {
      if (!isRefresh) setIsLoadingPosts(true);
      setError(null);

      const headers = getAuthHeaders();

      const [postsRes, blogsRes, podcastsRes] = await Promise.allSettled([
        optimizedFetch('/api/posts?limit=20&offset=0', { method: 'GET', headers, ttl: 20000, dedupe: true }),
        optimizedFetch('/api/blogs?limit=20&page=1',   { method: 'GET', headers, ttl: 30000, dedupe: true }),
        optimizedFetch('/api/podcasts?limit=20&page=1', { method: 'GET', headers, ttl: 30000, dedupe: true }),
      ]);

      if (postsRes.status === 'fulfilled') {
        setPosts(postsRes.value.posts || []);
      } else {
        // Posts fetch failed — surface error but still show other content
        logError(postsRes.reason, 'FeedPage.fetchFeedContent.posts');
        const errorMessage = getUserFriendlyError(postsRes.reason);
        setError(errorMessage);
        toast({ title: "Error", description: errorMessage, variant: "destructive" });
      }

      if (blogsRes.status === 'fulfilled') {
        setBlogs(blogsRes.value.posts || []);
      }

      if (podcastsRes.status === 'fulfilled') {
        setPodcasts(podcastsRes.value.episodes || []);
      }

      if (isRefresh) {
        toast({ title: "Refreshed", description: "Feed updated successfully" });
      }
    } catch (err) {
      logError(err, 'FeedPage.fetchFeedContent');
      const errorMessage = getUserFriendlyError(err);
      setError(errorMessage);
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
      setIsLoadingPosts(false);
    }
  };

  // State for events from database
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [suggestedConnections, setSuggestedConnections] = useState<any[]>([]);

  // Fetch sidebar data on mount and set up polling
  useEffect(() => {
    // Initial fetch
    fetchUpcomingEvents();
    fetchRecentJobs();
    fetchSuggestedConnections();

    // Poll every 30 seconds to keep data fresh
    const pollInterval = setInterval(() => {
      fetchUpcomingEvents();
      fetchRecentJobs();
      fetchSuggestedConnections();
    }, 30000); // 30 seconds

    // Refresh when page becomes visible (user returns to tab)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchUpcomingEvents();
        fetchRecentJobs();
        fetchSuggestedConnections();
      }
    };

    // Refresh when window gains focus
    const handleFocus = () => {
      fetchUpcomingEvents();
      fetchRecentJobs();
      fetchSuggestedConnections();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const fetchUpcomingEvents = async () => {
    try {
      const userId = localStorage.getItem('userId');
      // Add cache-busting timestamp to prevent stale data
      const timestamp = Date.now();
      const response = await fetch(`/api/events?limit=5&sort=upcoming&userId=${userId}&_t=${timestamp}`, {
        headers: {
          'user-id': userId || '', // Add user-id to get RSVP status
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setUpcomingEvents(data.events || []);
      }
    } catch (error) {
      console.error('Error fetching upcoming events:', error);
    }
  };

  const fetchRecentJobs = async () => {
    try {
      const userId = localStorage.getItem('userId');
      // Add cache-busting timestamp to prevent stale data
      const timestamp = Date.now();
      const [jobsResponse, appliedResponse] = await Promise.all([
        fetch(`/api/jobs?limit=3&sort=recent&_t=${timestamp}`, {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        }),
        userId ? fetch(`/api/jobs/applied?_t=${timestamp}`, {
          headers: {
            'user-id': userId,
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        }) : Promise.resolve(null)
      ]);

      if (jobsResponse.ok) {
        const data = await jobsResponse.json();
        setRecentJobs(data.jobs || []);
      }

      if (appliedResponse && appliedResponse.ok) {
        const data = await appliedResponse.json();
        setAppliedJobs(new Set(data.appliedJobIds || []));
      }
    } catch (error) {
      console.error('Error fetching recent jobs:', error);
    }
  };

  const fetchSuggestedConnections = async () => {
    try {
      const userId = localStorage.getItem('userId');
      // Add cache-busting timestamp to prevent stale data
      const timestamp = Date.now();
      const response = await fetch(`/api/connections/suggestions?limit=3&_t=${timestamp}`, {
        headers: getAuthHeaders({
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        })
      });
      if (response.ok) {
        const data = await response.json();
        setSuggestedConnections(data.suggestions || []);
      }
    } catch (error) {
      console.error('Error fetching suggested connections:', error);
    }
  };

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
    // Validate post content
    if (!postText.trim() && attachedFiles.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please enter some content or attach a file",
        variant: "destructive",
      });
      return;
    }

    // Validate text length
    const textValidation = validateTextLength(postText, 'Post content', 0, 5000);
    if (!textValidation.isValid) {
      toast({
        title: "Validation Error",
        description: textValidation.error,
        variant: "destructive",
      });
      return;
    }

    hasPostedRef.current = true;
    setIsPosting(true);
    try {
      const userId = localStorage.getItem('userId');
      let uploadedFileUrl = null;

      // Upload file if there's an attachment
      if (attachedFiles.length > 0) {
        const file = attachedFiles[0];

        // Validate file
        const maxSizeMB = 10;
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];

        if (file.size > maxSizeMB * 1024 * 1024) {
          toast({
            title: "File Too Large",
            description: `File size must be less than ${maxSizeMB}MB`,
            variant: "destructive",
          });
          setIsPosting(false);
          return;
        }

        if (!allowedTypes.includes(file.type)) {
          toast({
            title: "Invalid File Type",
            description: "Please upload an image (JPEG, PNG, GIF, WebP) or PDF",
            variant: "destructive",
          });
          setIsPosting(false);
          return;
        }

        const formData = new FormData();
        formData.append('file', file);

        const uploadResponse = await fetch('/api/upload/post-attachment', {
          method: 'POST',
          headers: {
            'user-id': userId || '',
          },
          body: formData,
        });

        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          uploadedFileUrl = uploadData.url;
        } else {
          const errorInfo = await handleAPIError(uploadResponse);
          logError(errorInfo, 'FeedPage.handlePost.upload');
          toast({
            title: "Upload Failed",
            description: getUserFriendlyError(errorInfo),
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
          content: postText.trim(),
          imageUrl: uploadedFileUrl,
          postType: 'general',
        }),
      });

      if (!response.ok) {
        const errorInfo = await handleAPIError(response);
        throw errorInfo;
      }

      const data = await response.json();

      // Only add to feed if approved (which it won't be by default now)
      if (data.post.status === 'approved') {
        setPosts(prev => [data.post, ...prev]);
      }

      // Reset form
      setPostText("");
      setAttachedFiles([]);

      toast({
        title: "Success",
        description: data.post.status === 'pending'
          ? "Post submitted! It will be visible after admin approval."
          : (uploadedFileUrl ? "Post created with attachment!" : "Post created successfully!"),
      });
    } catch (error) {
      logError(error, 'FeedPage.handlePost');
      toast({
        title: "Error",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    } finally {
      setIsPosting(false);
    }
  };

  const handleLike = async (postId: string) => {
    // Guard: if a like request is already in-flight for this post, ignore the click
    if (likingInFlight.current.has(postId)) return;

    let originalLikesCount = 0;
    let originalIsLikedByUser = false;

    const userId = localStorage.getItem('userId');
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    // Get current like status from post state (the optimistic update will have already changed it)
    const wasLiked = post.isLikedByUser || likedPosts.has(postId);
    originalLikesCount = post.likes_count;
    originalIsLikedByUser = post.isLikedByUser;

    // Lock this post immediately before any state updates
    likingInFlight.current.add(postId);

    try {
      // Optimistically update UI immediately
      setPosts(prev => prev.map(p => {
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

      // Trust the optimistic update — server handled the DB write
    } catch (error) {
      console.error('Error liking post:', error);

      // Revert optimistic update on error
      setPosts(prev => prev.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            likes_count: originalLikesCount,
            isLikedByUser: originalIsLikedByUser
          };
        }
        return p;
      }));

      // Revert liked posts set
      if (!originalIsLikedByUser) {
        setLikedPosts(prev => {
          const newSet = new Set(prev);
          newSet.delete(postId);
          return newSet;
        });
      } else {
        setLikedPosts(prev => {
          const s = new Set<string>();
          prev.forEach(v => s.add(v));
          s.add(postId);
          return s;
        });
      }

      toast({
        title: "Error",
        description: "Failed to update like. Please try again.",
        variant: "destructive",
      });
    } finally {
      // Always unlock this post so future clicks work
      likingInFlight.current.delete(postId);
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

  const handleJobInterest = (jobIndex: number, interested: boolean) => {
    setInterestedJobs(prev => {
      const newSet = new Set(prev);
      if (interested) {
        newSet.add(jobIndex);
      } else {
        newSet.delete(jobIndex);
      }
      return newSet;
    });
  };

  const handleEventRSVP = async (eventId: string, status: 'attending' | 'maybe' | 'not_attending') => {
    if (!user?.id) {
      toast({
        title: "Login Required",
        description: "Please log in to RSVP to events",
        variant: "destructive"
      });
      return;
    }

    // Determine if we are toggling off
    // We check either the local state map or the event object's own rsvp status
    // The feed usually has `user_rsvp` on the event object, but `eventRsvps` map seems to be a local override
    const event = upcomingEvents.find(e => e.id === eventId);
    const currentStatus = eventRsvps.get(eventId) || event?.user_rsvp?.status;
    const isTogglingOff = currentStatus === status;
    const newStatus = isTogglingOff ? null : status;

    // Store previous state for rollback
    const previousRsvps = new Map(eventRsvps);
    const previousEvents = [...upcomingEvents];

    // Optimistic Update
    setEventRsvps(prev => {
      const newMap = new Map(prev);
      if (newStatus) {
        newMap.set(eventId, newStatus);
      } else {
        newMap.delete(eventId); // Remove from local override if toggled off
      }
      return newMap;
    });

    // Also update the event object directly for immediate feedback if the list relies on it
    setUpcomingEvents(prev => prev.map(e => {
      if (e.id === eventId) {
        // Calculate optimistic count change
        let countDiff = 0;
        if (isTogglingOff && currentStatus === 'attending') countDiff = -1;
        else if (!isTogglingOff && status === 'attending' && currentStatus !== 'attending') countDiff = 1;

        return {
          ...e,
          user_rsvp: newStatus ? { ...e.user_rsvp, status: newStatus } : undefined, // Remove user_rsvp if toggled off
          rsvp_count: Math.max(0, (e.rsvp_count || 0) + countDiff)
        };
      }
      return e;
    }));


    setRsvpingEvent(eventId);
    try {
      const userId = localStorage.getItem('userId');
      const response = await fetch(`/api/events/${eventId}/rsvp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-id': userId || ''
        },
        body: JSON.stringify({
          status,
          guestsCount: 1,
          notes: ''
        })
      });

      if (response.ok) {
        const data = await response.json();

        // If data.status is null/undefined, it means we toggled off
        if (!data.status) {
          setEventRsvps(prev => {
            const newMap = new Map(prev);
            newMap.delete(eventId);
            return newMap;
          });
        }

        toast({
          title: data.status ? "RSVP Updated" : "RSVP Cleared",
          description: data.status
            ? `You are ${data.status === 'attending' ? 'going' : data.status === 'maybe' ? 'maybe going' : 'not going'} to this event`
            : "Your response choice has been cleared"
        });

        // Refresh all sidebar data to ensure full sync
        fetchUpcomingEvents();
        fetchRecentJobs();
        fetchSuggestedConnections();
      } else {
        throw new Error("Failed to RSVP");
      }
    } catch (error) {
      console.error('Error RSVPing to event:', error);
      // Rollback
      setEventRsvps(previousRsvps);
      setUpcomingEvents(previousEvents);

      toast({
        title: "Error",
        description: "Failed to RSVP. Please try again.",
        variant: "destructive"
      });
    } finally {
      setRsvpingEvent(null);
    }
  };

  const handleJobApply = async (jobId: string) => {
    if (!user?.id) {
      toast({
        title: "Login Required",
        description: "Please log in to apply for jobs",
        variant: "destructive"
      });
      return;
    }

    setApplyingToJob(jobId);
    try {
      const userId = localStorage.getItem('userId');
      const response = await fetch(`/api/jobs/${jobId}/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-id': userId || ''
        }
      });

      if (response.ok) {
        setAppliedJobs(prev => new Set(prev).add(jobId));
        toast({
          title: "Application Submitted",
          description: "Your application has been submitted successfully"
        });
        // Refresh sidebar data to ensure sync
        fetchRecentJobs();
        fetchUpcomingEvents();
        fetchSuggestedConnections();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to apply",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error applying to job:', error);
      toast({
        title: "Error",
        description: "Failed to apply. Please try again.",
        variant: "destructive"
      });
    } finally {
      setApplyingToJob(null);
    }
  };

  const handleConnect = async (connectionId: string, isWithdrawing = false) => {
    const userId = localStorage.getItem('userId');
    // Store previous state for rollback
    const originalSentConnections = new Set(sentConnections);

    // Optimistic Update
    setSentConnections(prev => {
      const newSet = new Set(prev);
      if (isWithdrawing) {
        newSet.delete(connectionId);
      } else {
        newSet.add(connectionId);
      }
      return newSet;
    });

    try {

      if (isWithdrawing) {
        // Withdraw request
        const response = await fetch('/api/connections/request', {
          method: 'DELETE',
          headers: getAuthHeaders({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({ recipientId: connectionId }),
        });

        if (!response.ok) throw new Error("Failed to withdraw");

        toast({
          title: "Request Withdrawn",
          description: "Connection request withdrawn successfully",
        });
      } else {
        // Send request
        const response = await fetch('/api/connections/request', {
          method: 'POST',
          headers: getAuthHeaders({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({ recipientId: connectionId }),
        });

        if (!response.ok) throw new Error("Failed to send request");

        toast({
          title: "Connection request sent",
          description: "Your connection request has been sent",
        });
        // Refresh sidebar data to ensure sync
        fetchSuggestedConnections();
        fetchUpcomingEvents();
        fetchRecentJobs();
      }
    } catch (error) {
      console.error('Connection action error:', error);
      // Rollback
      setSentConnections(originalSentConnections);

      toast({
        title: "Error",
        description: `Failed to ${isWithdrawing ? 'withdraw' : 'send'} request`,
        variant: "destructive",
      });
    }
  };

  const handlePostOptions = (postId: string) => {
    const userId = localStorage.getItem('userId');
    const post = posts.find(p => p.id === postId);

    // Only show options if the current user is the author of the post
    if (!post || post.author_id !== userId) {
      return;
    }

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

  const handlePostComment = async (postId: string) => {
    const commentText = commentTexts[postId];
    if (!commentText?.trim()) return;

    const userId = localStorage.getItem('user');
    if (!userId) {
      toast({
        title: "Authentication required",
        description: "Please log in to comment on posts.",
        variant: "destructive",
      });
      return;
    }

    try {
      const userIdParsed = JSON.parse(userId).id;

      const response = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-id': userIdParsed || '',
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

      // Update comments count
      setPosts(prev => prev.map(p =>
        p.id === postId
          ? { ...p, comments_count: p.comments_count + 1 }
          : p
      ));

      toast({
        title: "Comment posted",
        description: "Your comment has been added.",
      });
    } catch (error) {
      console.error('Error posting comment:', error);
      toast({
        title: "Error",
        description: "Failed to post comment. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCommentTextChange = (postId: string, text: string) => {
    setCommentTexts(prev => ({ ...prev, [postId]: text }));
  };



  const handleDeletePost = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this post?')) return;

    try {
      const userId = localStorage.getItem('userId');

      const response = await fetch(`/api/posts/${postId}`, {
        method: 'DELETE',
        headers: {
          'user-id': userId || '',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete post');
      }

      setPosts(prev => prev.filter(post => post.id !== postId));
      setShowPostOptions(new Set());

      toast({
        title: "Post deleted",
        description: "Your post has been deleted successfully.",
      });
    } catch (error) {
      console.error('Error deleting post:', error);
      toast({
        title: "Error",
        description: "Failed to delete post. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleBlogBookmark = async (blogId: string) => {
    const blog = blogs.find((b: any) => b.id === blogId);
    if (!blog) return;
    const wasBookmarked = blog.viewer_has_bookmarked ?? false;
    setBlogs((prev: any[]) => prev.map((b: any) =>
      b.id === blogId ? { ...b, viewer_has_bookmarked: !wasBookmarked } : b
    ));
    try {
      const userId = user?.id || localStorage.getItem('userId') || '';
      const token = localStorage.getItem('auth_token') || '';
      const res = await fetch(`/api/blogs/${blogId}/bookmark`, {
        method: 'POST',
        headers: { 'user-id': userId, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setBlogs((prev: any[]) => prev.map((b: any) =>
        b.id === blogId ? { ...b, viewer_has_bookmarked: data.bookmarked } : b
      ));
      toast({ title: data.bookmarked ? "Blog saved" : "Bookmark removed", description: data.bookmarked ? "Added to your saved blogs." : "Removed from saved blogs." });
    } catch {
      setBlogs((prev: any[]) => prev.map((b: any) =>
        b.id === blogId ? { ...b, viewer_has_bookmarked: wasBookmarked } : b
      ));
      toast({ title: "Error", description: "Failed to update bookmark.", variant: "destructive" });
    }
  };

  const handlePodcastLike = async (podcastId: string) => {
    if (podcastLikingInFlight.current.has(podcastId)) return;
    podcastLikingInFlight.current.add(podcastId);

    const podcast = podcasts.find((p: any) => p.id === podcastId);
    if (!podcast) { podcastLikingInFlight.current.delete(podcastId); return; }

    const wasLiked = podcast.isLikedByUser ?? false;
    const origCount = podcast.likes_count ?? 0;

    setPodcasts((prev: any[]) => prev.map((p: any) =>
      p.id === podcastId
        ? { ...p, isLikedByUser: !wasLiked, likes_count: wasLiked ? Math.max(0, origCount - 1) : origCount + 1 }
        : p
    ));

    try {
      const userId = localStorage.getItem('userId') || '';
      const res = await fetch(`/api/podcasts/${podcastId}/like`, {
        method: 'POST',
        headers: { 'user-id': userId },
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setPodcasts((prev: any[]) => prev.map((p: any) =>
        p.id === podcastId ? { ...p, isLikedByUser: data.isLiked, likes_count: data.likes_count } : p
      ));
    } catch {
      setPodcasts((prev: any[]) => prev.map((p: any) =>
        p.id === podcastId ? { ...p, isLikedByUser: wasLiked, likes_count: origCount } : p
      ));
      toast({ title: "Error", description: "Failed to update like.", variant: "destructive" });
    } finally {
      podcastLikingInFlight.current.delete(podcastId);
    }
  };

  const handlePodcastComment = (podcastId: string) => {
    setShowPodcastComments(prev => {
      const s = new Set(prev);
      if (s.has(podcastId)) { s.delete(podcastId); } else { s.add(podcastId); }
      return s;
    });
  };

  const handlePostPodcastComment = async (podcastId: string) => {
    const text = podcastCommentTexts[podcastId]?.trim();
    if (!text) return;
    const userId = localStorage.getItem('userId') || '';
    if (!userId) {
      toast({ title: "Authentication required", description: "Please log in to comment.", variant: "destructive" });
      return;
    }
    try {
      const res = await fetch(`/api/podcasts/${podcastId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'user-id': userId },
        body: JSON.stringify({ content: text }),
      });
      if (!res.ok) throw new Error('Failed');
      setPodcastCommentTexts(prev => ({ ...prev, [podcastId]: '' }));
      setPodcasts((prev: any[]) => prev.map((p: any) =>
        p.id === podcastId ? { ...p, comments_count: (p.comments_count ?? 0) + 1 } : p
      ));
      toast({ title: "Comment posted", description: "Your comment has been added." });
    } catch {
      toast({ title: "Error", description: "Failed to post comment.", variant: "destructive" });
    }
  };

  // This function is called when a post is created by the PostCreator component
  // It's not currently used but is kept here in case it's needed in the future
  const handlePostCreated = (newPost: any) => {
    setPosts(prevPosts => [newPost, ...prevPosts]);
  };


  return (
    <AppLayout currentPage="feed">
      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-[#008060] focus:text-white focus:rounded-md"
        onClick={(e) => {
          e.preventDefault();
          const mainContent = document.getElementById('main-content');
          if (mainContent) {
            mainContent.focus();
            mainContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }}
      >
        Skip to main content
      </a>
      <div className="flex min-h-screen relative isolate overflow-x-hidden" style={{ background: 'var(--surface-subtle)' }}>
        {/* Main Content */}
        <div
          ref={contentRef}
          className="flex-1 w-full overflow-y-auto relative"
        >
          <div className="min-h-full xl:pr-[316px] transition-all duration-300 overflow-x-hidden">
            <div className="max-w-[680px] xl:max-w-[820px] 2xl:max-w-[900px] mx-auto px-3 sm:px-4 md:px-5 pt-0 pb-4 sm:pb-5 md:pb-6 w-full">

              {/* Create Post */}
              <div className="mb-4 flex items-center justify-end">
                <Button
                  onClick={() => setShowPostModal(true)}
                  className="bg-[#008060] hover:bg-[#006b51] text-white font-semibold px-5 py-2 rounded-full shadow-sm transition-all flex items-center gap-2 text-sm"
                >
                  <PenSquare className="w-4 h-4" />
                  Create Post
                </Button>
              </div>

              <CreatePostModal
                open={showPostModal}
                onClose={() => setShowPostModal(false)}
                postText={postText}
                attachedFiles={attachedFiles}
                isPosting={isPosting}
                onPostTextChange={setPostText}
                onFileAttachment={handleFileAttachment}
                onPost={handlePost}
                onRemoveFile={(index) => setAttachedFiles(prev => prev.filter((_, i) => i !== index))}
              />

              {/* Post loading/error states */}
              <div className="mb-4" data-post-creator>

                {/* Loading & Error States */}
                {isLoadingPosts && (
                  <div className="space-y-8">
                    {[1, 2, 3].map((i) => (
                      <SkeletonPostCard key={i} />
                    ))}
                    <div className="text-center py-8">
                      <div className="relative inline-block">
                        <div className="w-12 h-12 border-4 border-[#008060]/20 border-t-[#008060] rounded-full animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-2 h-2 bg-[#008060] rounded-full animate-pulse" />
                        </div>
                      </div>
                      <p className="mt-4 text-gray-500 font-medium animate-pulse">Gathering updates...</p>
                    </div>
                  </div>
                )}

                {error && !isLoadingPosts && (
                  <Card className="border-red-200 bg-red-50/50 mb-8">
                    <CardContent className="p-6 text-center">
                      <div className="space-y-4">
                        <div className="text-red-600 text-4xl mb-2">⚠️</div>
                        <p className="text-red-700 font-medium text-lg">{error}</p>
                        <p className="text-red-600 text-sm">We couldn't load your feed. Please try again.</p>
                        <div className="flex gap-3 justify-center">
                          <Button
                            onClick={() => fetchFeedContent()}
                            className="bg-red-600 hover:bg-red-700 text-white"
                          >
                            Try Again
                          </Button>
                          <Button
                            onClick={() => {
                              setError(null);
                              fetchFeedContent();
                            }}
                            variant="outline"
                            className="border-red-300 text-red-600 hover:bg-red-50"
                          >
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {!isLoadingPosts && !error && feedItems.length === 0 && (
                  <Card className="border-dashed border-2 border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100/50">
                    <CardContent className="p-12 text-center">
                      <div className="max-w-md mx-auto space-y-6">
                        <div className="text-6xl mb-4">📭</div>
                        <div className="space-y-2">
                          <h3 className="text-2xl font-bold text-gray-900">Your feed is waiting</h3>
                          <p className="text-gray-600 text-base">Be the pioneer and share the first story with your fellow alumni!</p>
                        </div>
                        <div className="pt-4">
                          <Button
                            onClick={() => {
                              // Scroll to post creator
                              const postCreator = document.querySelector('[data-post-creator]');
                              postCreator?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }}
                            variant="brand"
                            className="px-8 py-6 text-lg"
                          >
                            Create Your First Post
                          </Button>
                        </div>
                        <div className="pt-4 border-t border-gray-200">
                          <p className="text-sm text-gray-500">
                            💡 <strong>Tip:</strong> Connect with more alumni to see their posts in your feed
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Content-type filter tabs */}
                {!isLoadingPosts && !error && allFeedItems.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {(["all", "post", "blog", "podcast"] as const).map((type) => {
                      const labels = { all: "All", post: "Posts", blog: "Blogs", podcast: "Podcasts" };
                      const isActive = feedFilter === type;
                      return (
                        <button
                          key={type}
                          onClick={() => setFeedFilter(type)}
                          className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                            isActive
                              ? "bg-[#008060] text-white border-[#008060]"
                              : "bg-white text-gray-600 border-gray-200 hover:border-[#008060]/40 hover:text-[#008060]"
                          }`}
                        >
                          {labels[type]} ({tabCounts[type]})
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Feed — posts, blogs, and podcasts interleaved by date */}
                <div className="space-y-8">
                  {feedItems.map((item) => {
                    if (item._type === "blog") {
                      return <FeedBlogCard key={`blog-${item.id}`} blog={item} onBookmark={handleBlogBookmark} />;
                    }
                    if (item._type === "podcast") {
                      return (
                        <FeedPodcastCard
                          key={`podcast-${item.id}`}
                          podcast={item}
                          isLiked={item.isLikedByUser ?? false}
                          showComments={showPodcastComments.has(item.id)}
                          commentText={podcastCommentTexts[item.id] || ''}
                          onLike={() => handlePodcastLike(item.id)}
                          onComment={() => handlePodcastComment(item.id)}
                          onPostComment={() => handlePostPodcastComment(item.id)}
                          onCommentTextChange={(text) => setPodcastCommentTexts(prev => ({ ...prev, [item.id]: text }))}
                        />
                      );
                    }
                    return (
                      <PostCard
                        key={`post-${item.id}`}
                        post={item}
                        isLiked={item.isLikedByUser || likedPosts.has(item.id)}
                        isExpanded={expandedPosts.has(item.id)}
                        showComments={showComments.has(item.id)}
                        commentText={commentTexts[item.id] || ''}
                        onLike={() => handleLike(item.id)}
                        onComment={() => handleComment(item.id)}
                        onReadMore={() => handleReadMore(item.id)}
                        onPostComment={() => handlePostComment(item.id)}
                        onCommentTextChange={(text) => handleCommentTextChange(item.id, text)}
                        onOptionsClick={() => handlePostOptions(item.id)}
                        onEdit={() => console.log('Edit post', item.id)}
                        onDelete={() => handleDeletePost(item.id)}
                        showOptions={showPostOptions.has(item.id)}
                      />
                    );
                  })}
                </div>

                {/* Load more */}
                {!isLoadingPosts && feedItems.length === feedLimit && (
                  <button
                    onClick={() => setFeedLimit(prev => prev + 20)}
                    className="w-full py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:border-[#008060]/40 hover:text-[#008060] transition-colors bg-white"
                  >
                    Load more
                  </button>
                )}
              </div>

              {/* Mobile Carousel Sections */}
              <div className="xl:hidden space-y-2">
                <GamificationLeaderboard />
                <SidebarEvents
                  events={upcomingEvents}
                  onRSVP={handleEventRSVP}
                  rsvpingEvent={rsvpingEvent}
                  eventRsvps={eventRsvps}
                  onNavigate={setLocation}
                  isMobile
                />
                <SidebarJobs
                  jobs={recentJobs}
                  onApply={handleJobApply}
                  applyingToJob={applyingToJob}
                  appliedJobs={appliedJobs}
                  onNavigate={setLocation}
                  isMobile
                />
                <SidebarConnections
                  connections={suggestedConnections}
                  onConnect={handleConnect}
                  sentConnections={sentConnections}
                  onNavigate={setLocation}
                  isMobile
                />
              </div>
            </div>
          </div>
        </div>

        {/* Desktop Sidebar */}
        <div
          className="hidden xl:block w-[300px] fixed right-0 top-14 sm:top-16 bottom-0 overflow-y-auto z-10"
          style={{ borderLeft: '1px solid var(--border-subtle)', background: 'var(--surface-subtle)' }}
        >
          <div className="p-4 space-y-4">
            <GamificationLeaderboard />
            <SidebarEvents
              events={upcomingEvents}
              onRSVP={handleEventRSVP}
              rsvpingEvent={rsvpingEvent}
              eventRsvps={eventRsvps}
              onNavigate={setLocation}
            />
            <SidebarJobs
              jobs={recentJobs}
              onApply={handleJobApply}
              applyingToJob={applyingToJob}
              appliedJobs={appliedJobs}
              onNavigate={setLocation}
            />
            <SidebarConnections
              connections={suggestedConnections}
              onConnect={handleConnect}
              sentConnections={sentConnections}
              onNavigate={setLocation}
            />
          </div>
        </div>
      </div>
      {/* Login greeting popup */}
      {showLoginGreeting && (
        <div
          className="fixed top-20 right-5 z-50 pointer-events-auto"
          style={{
            transition: 'opacity 0.3s ease, transform 0.3s ease',
            opacity: greetingVisible ? 1 : 0,
            transform: greetingVisible ? 'translateY(0)' : 'translateY(-8px)',
          }}
        >
          <div
            className="rounded-2xl px-5 py-4 flex flex-col gap-2 min-w-[220px] max-w-[280px]"
            style={{
              background: 'linear-gradient(135deg, #008060 0%, #006b51 100%)',
              boxShadow: '0 8px 32px rgba(0,128,96,0.35)',
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-white font-bold text-[15px] leading-tight">
                  {getGreeting()}, {firstName} 👋
                </p>
                {graduationYear && (
                  <span
                    className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                    style={{ background: 'rgba(166,206,57,0.25)', color: '#a6ce39', border: '1px solid rgba(166,206,57,0.35)' }}
                  >
                    Class of {graduationYear}
                  </span>
                )}
              </div>
              <button
                onClick={() => { setGreetingVisible(false); setTimeout(() => setShowLoginGreeting(false), 300); }}
                className="text-white/60 hover:text-white mt-0.5 shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {(streakDays >= 2 || globalRank > 0) && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {streakDays >= 2 && (
                  <div
                    className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                    style={{ background: 'rgba(253,187,19,0.18)', color: '#fdbb13', border: '1px solid rgba(253,187,19,0.3)' }}
                  >
                    <Flame className="w-3 h-3 fill-[#fdbb13]" />
                    {streakDays}-day streak
                  </div>
                )}
                {globalRank > 0 && (
                  <div
                    className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                    style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.25)' }}
                  >
                    <Trophy className="w-3 h-3" />
                    #{globalRank} globally
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
};
