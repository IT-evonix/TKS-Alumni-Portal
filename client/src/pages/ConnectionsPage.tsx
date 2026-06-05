import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { AppLayout } from "@/components/layout/AppLayout";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getUserFriendlyError, logError, handleAPIError } from "@/utils/errorHandler";
import { SkeletonConnectionCard } from "@/components/common/SkeletonLoader";
import { useOptimizedFetch } from "@/hooks/useOptimizedFetch";
import { OptimizedImage } from "@/components/common/OptimizedImage";
import { PageHeading } from "@/components/common/PageHeading";
import { BackButton } from "@/components/common/BackButton";
import { UserMinus, Check, Users, UserCheck, Send, BellRing, Trophy, MessageSquare, School } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ConnectionsTab = 'all' | 'connected' | 'sent' | 'received' | 'champions' | 'faculty';
const VALID_CONNECTION_TABS: ConnectionsTab[] = ['all', 'connected', 'sent', 'received', 'champions', 'faculty'];

const getInitialConnectionsTab = (): ConnectionsTab => {
  const tabParam = new URLSearchParams(window.location.search).get('tab');
  if (tabParam && VALID_CONNECTION_TABS.includes(tabParam as ConnectionsTab)) {
    return tabParam as ConnectionsTab;
  }

  // Fallback for cases where URL has no tab but user is returning from a profile view.
  const returnTab = sessionStorage.getItem('connectionsReturnTab');
  if (returnTab && VALID_CONNECTION_TABS.includes(returnTab as ConnectionsTab)) {
    sessionStorage.removeItem('connectionsReturnTab');
    return returnTab as ConnectionsTab;
  }

  // Keep last-used tab when returning to /connections without a tab query.
  const persistedTab = sessionStorage.getItem('connectionsActiveTab');
  if (persistedTab && VALID_CONNECTION_TABS.includes(persistedTab as ConnectionsTab)) {
    return persistedTab as ConnectionsTab;
  }

  return 'all';
};

export const ConnectionsPage = (): JSX.Element => {
  const ADMIN_CONTACT_EMAIL = "alumni@thekalyanischool.edu.in";
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isAdministrator } = useAuth();
  const { fetch: optimizedFetch, invalidateCache } = useOptimizedFetch();

  // Refs for infinite scroll
  const observerTarget = React.useRef<HTMLDivElement>(null);
  const observerRef = React.useRef<IntersectionObserver | null>(null);

  // Set page title
  React.useEffect(() => {
    document.title = "Connections - TKS Alumni Portal";
  }, []);

  const [searchTerm, setSearchTerm] = useState("");

  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [allUsersCount, setAllUsersCount] = useState(0); // Separate count for "All Users" tab
  const [championsCount, setChampionsCount] = useState(0); // Separate count for "Champions" tab
  const [facultyCount, setFacultyCount] = useState(0); // Separate count for "Faculty" tab
  const ITEMS_PER_PAGE = 20;

  const [alumni, setAlumni] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const [connectionStatuses, setConnectionStatuses] = useState<Map<number, 'none' | 'pending_sent' | 'pending_received' | 'connected'>>(new Map());
  const [sendingRequest, setSendingRequest] = useState<Set<number>>(new Set());
  const [connectionStats, setConnectionStats] = useState({
    totalConnections: 0,
    pendingSent: 0,
    pendingReceived: 0
  });

  const [activeTab, setActiveTab] = useState<ConnectionsTab>(getInitialConnectionsTab);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [lastClickTime, setLastClickTime] = useState<{ tab: string; time: number } | null>(null);
  const [contactingAdmin, setContactingAdmin] = useState(false);

  const debounceTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const loadMoreDebounceRef = React.useRef<NodeJS.Timeout | null>(null);

  const getAuthHeaders = (extraHeaders: Record<string, string> = {}): Record<string, string> => {
    const currentUserId = user?.id || localStorage.getItem('userId') || '';
    const token = localStorage.getItem('auth_token') || '';

    return {
      ...extraHeaders,
      'user-id': currentUserId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const getTabEntityLabel = (tab: typeof activeTab): string => {
    if (tab === 'all') return 'alumni';
    if (tab === 'connected') return 'connections';
    if (tab === 'champions') return 'champions';
    if (tab === 'faculty') return 'faculties';
    return 'requests';
  };

  // Scroll tracking for scroll-to-top button
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Persist last active tab for smoother return experience.
  useEffect(() => {
    sessionStorage.setItem('connectionsActiveTab', activeTab);
  }, [activeTab]);

  // Keep tab in sync with browser back/forward navigation.
  useEffect(() => {
    const syncTabFromUrl = () => {
      const tabParam = new URLSearchParams(window.location.search).get('tab');
      const nextTab: ConnectionsTab = (tabParam && VALID_CONNECTION_TABS.includes(tabParam as ConnectionsTab))
        ? (tabParam as ConnectionsTab)
        : 'all';
      setActiveTab((prev) => (prev === nextTab ? prev : nextTab));
    };

    window.addEventListener('popstate', syncTabFromUrl);
    return () => window.removeEventListener('popstate', syncTabFromUrl);
  }, []);

  // Fetch all-users count on mount so "All Users" card shows number immediately
  useEffect(() => {
    const currentUserId = user?.id || localStorage.getItem('userId');
    if (!currentUserId) return;
    const abort = new AbortController();

    const fetchInitialCounts = async () => {
      try {
        const headers = getAuthHeaders();
        const [allRes, champRes, facultyRes] = await Promise.all([
          fetch(`/api/alumni/search?limit=1&offset=0&tab=all`, { headers, signal: abort.signal }),
          fetch(`/api/alumni/search?limit=1&offset=0&tab=champions`, { headers, signal: abort.signal }),
          fetch(`/api/alumni/search?limit=1&offset=0&tab=faculty`, { headers, signal: abort.signal })
        ]);

        if (allRes.ok) {
          const data = await allRes.json();
          if (data.count !== undefined) setAllUsersCount(data.count);
        }
        if (champRes.ok) {
          const data = await champRes.json();
          if (data.count !== undefined) setChampionsCount(data.count);
        }
        if (facultyRes.ok) {
          const data = await facultyRes.json();
          if (data.count !== undefined) setFacultyCount(data.count);
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error("Failed to fetch initial counts", err);
        }
      }
    };

    fetchInitialCounts();
    return () => abort.abort();
  }, [user?.id]);

  // Auto-search when search term changes with debouncing
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      // Reset to first page when search term changes
      setOffset(0);
      fetchAlumni(0, true);
    }, 300); // 300ms debounce delay

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchTerm]);

  // Infinite Scroll Observer with debouncing
  useEffect(() => {
    if (loading || isFetchingMore) return;

    // Check if we have more data to load
    const hasMore = alumni.length < totalCount;
    if (!hasMore) return;

    // Disconnect existing observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // Create new observer with debouncing
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !loading && !isFetchingMore) {
        // Debounce to prevent multiple rapid calls
        if (loadMoreDebounceRef.current) {
          clearTimeout(loadMoreDebounceRef.current);
        }

        loadMoreDebounceRef.current = setTimeout(() => {
          handleLoadMore();
        }, 150); // 150ms debounce
      }
    }, {
      root: null, // viewport
      rootMargin: "300px", // Start loading 300px before reaching bottom
      threshold: 0.1
    });

    if (observerTarget.current) {
      observerRef.current.observe(observerTarget.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      if (loadMoreDebounceRef.current) {
        clearTimeout(loadMoreDebounceRef.current);
      }
    };
  }, [loading, isFetchingMore, alumni.length, totalCount, offset]);

  // Handle active tab change
  useEffect(() => {
    setOffset(0);
    fetchAlumni(0, true);
    fetchConnectionStats();
  }, [activeTab]);

  // Reset lastClickTime after a delay to prevent stale double-clicks
  useEffect(() => {
    if (lastClickTime) {
      const timer = setTimeout(() => {
        setLastClickTime(null);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [lastClickTime]);

  const fetchAlumni = async (currentOffset = offset, replace = false, tabOverride?: ConnectionsTab) => {
    const currentTab = tabOverride ?? activeTab;
    try {
      if (replace) {
        if (alumni.length === 0) {
          setIsInitialLoading(true);
        } else {
          setIsFiltering(true);
        }
      } else {
        setIsFetchingMore(true);
      }

      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);

      params.append('limit', ITEMS_PER_PAGE.toString());
      params.append('offset', currentOffset.toString());

      const data = await optimizedFetch(`/api/alumni/search?${params.toString()}&tab=${currentTab}`, {
        method: 'GET',
        headers: getAuthHeaders(),
        ttl: 30000, // Cache for 30 seconds
        dedupe: true
      }).catch(async () => {
        // Fallback to regular fetch if optimized fetch fails
        const response = await fetch(`/api/alumni/search?${params.toString()}&tab=${currentTab}`, {
          headers: getAuthHeaders()
        });
        if (!response.ok) throw new Error('Failed to fetch alumni');
        return response.json();
      });

      const alumniList = data.alumni || [];

      // Always update count if provided
      if (data.count !== undefined) {
        setTotalCount(data.count);

        // Store the tab-specific counts ONLY when on that tab with no search filter
        // This ensures the numbers in the tab headers remain accurate after data load
        if (!searchTerm.trim()) {
          if (currentTab === 'all') setAllUsersCount(data.count);
          if (currentTab === 'champions') setChampionsCount(data.count);
          if (currentTab === 'faculty') setFacultyCount(data.count);
        }
      }

      // Handle alumni list - always clear when replacing (switching tabs)
      if (replace) {
        // Always set to the new list (even if empty) to clear previous tab's data
        setAlumni(alumniList);
      } else {
        // For pagination, append new items
        if (alumniList.length > 0) {
          setAlumni(prev => {
            // Filter out duplicates just in case
            const existingIds = new Set(prev.map(a => a.id));
            const newItems = alumniList.filter((a: any) => !existingIds.has(a.id));
            return [...prev, ...newItems];
          });
        }
      }

      // Fetch connection statuses only if we have alumni
      if (alumniList.length > 0 && user?.id) {
        await fetchConnectionStatuses(alumniList);
      } else if (alumniList.length === 0 && replace) {
        // Clear connection statuses when switching to an empty tab
        setConnectionStatuses(new Map());
      }
    } catch (error) {
      logError(error, 'ConnectionsPage.fetchAlumni');
      toast({
        title: "Error",
        description: getUserFriendlyError(error),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setIsInitialLoading(false);
      setIsFetchingMore(false);
      setIsFiltering(false);
    }
  };

  const handleLoadMore = () => {
    const newOffset = offset + ITEMS_PER_PAGE;
    setOffset(newOffset);
    fetchAlumni(newOffset, false);
  };

  const fetchConnectionStatuses = async (alumniList: any[]) => {
    if (!user?.id || alumniList.length === 0) {
      // If no user or empty list, set all to 'none' to ensure CTAs are shown
      const defaultStatuses = new Map<number, 'none' | 'pending_sent' | 'pending_received' | 'connected'>();
      alumniList.forEach(alumnus => {
        defaultStatuses.set(alumnus.id, 'none');
      });
      setConnectionStatuses(defaultStatuses);
      return;
    }

    // Collect all user IDs (UUIDs) - filter out null/undefined
    const userIds = alumniList.map(a => a.userId || a.user_id).filter(Boolean);

    // Initialize all statuses to 'none' first to ensure CTAs are always shown
    const newStatuses = new Map<number, 'none' | 'pending_sent' | 'pending_received' | 'connected'>();
    alumniList.forEach(alumnus => {
      newStatuses.set(alumnus.id, 'none');
    });

    // If no valid userIds, just set all to 'none' and return
    if (userIds.length === 0) {
      setConnectionStatuses(newStatuses);
      return;
    }

    try {
      const response = await fetch('/api/connections/status/batch', {
        method: 'POST',
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ userIds })
      });

      if (response.ok) {
        const data = await response.json();
        const batchStatuses = data.statuses || {}; // { [uuid]: status }

        // Map back to alumni integer IDs - update only those with valid userIds
        alumniList.forEach(alumnus => {
          const userId = alumnus.userId || alumnus.user_id;
          if (userId && batchStatuses[userId]) {
            const status = batchStatuses[userId];
            // Map API status to component status
            if (status === 'connected' || status === 'accepted') {
              newStatuses.set(alumnus.id, 'connected');
            } else if (status === 'pending_sent') {
              newStatuses.set(alumnus.id, 'pending_sent');
            } else if (status === 'pending_received') {
              newStatuses.set(alumnus.id, 'pending_received');
            } else {
              newStatuses.set(alumnus.id, 'none');
            }
          }
          // If no userId or no status found, it remains 'none' (already set above)
        });

        setConnectionStatuses(newStatuses);
      } else {
        // If API call fails, still set all to 'none' so CTAs are shown
        setConnectionStatuses(newStatuses);
      }
    } catch (error) {
      console.error('Error fetching connection statuses:', error);
      // On error, still set all to 'none' so CTAs are shown
      setConnectionStatuses(newStatuses);
    }
  };

  const fetchConnectionStats = async () => {
    if (!user?.id) return;

    try {
      const response = await fetch('/api/connections/stats', {
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setConnectionStats(data);
      }
    } catch (error) {
      console.error('Error fetching connection stats:', error);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setActiveTab("all"); // Reset tab to "All Alumni"
    setLocation('/connections');
    setOffset(0);
    setAlumni([]);
    fetchAlumni(0, true, 'all');
  };

  const handleViewProfile = (alumniId: number) => {
    sessionStorage.setItem('connectionsReturnTab', activeTab);
    setLocation(`/profile/${alumniId}`);
  };

  const handleConnect = async (alumnus: any) => {
    if (!user?.id) {
      toast({
        title: "Authentication Required",
        description: "Please log in to send connection requests",
        variant: "destructive"
      });
      return;
    }

    if (sendingRequest.has(alumnus.id)) return;

    try {
      setSendingRequest(prev => new Set(prev).add(alumnus.id));

      const response = await fetch('/api/connections/request', {
        method: 'POST',
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          recipientId: alumnus.userId || alumnus.id, // Use userId if available (preferred), fallback to id
          message: `Hi ${alumnus.first_name}, I'd like to connect with you on the alumni network.`
        })
      });

      if (response.ok) {
        setConnectionStatuses(prev => {
          const newStatuses = new Map(prev);
          newStatuses.set(alumnus.id, 'pending_sent');
          return newStatuses;
        });

        // Refresh connection stats
        fetchConnectionStats();

        toast({
          title: "Success",
          description: `Connection request sent to ${alumnus.first_name} ${alumnus.last_name}!`
        });
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to send connection request",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error sending connection request:', error);
      toast({
        title: "Error",
        description: "Failed to send connection request. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSendingRequest(prev => {
        const newSet = new Set(prev);
        newSet.delete(alumnus.id);
        return newSet;
      });
    }
  };

  const handleWithdraw = async (alumnus: any) => {
    if (!user?.id) {
      toast({
        title: "Authentication Required",
        description: "Please log in to withdraw connection requests",
        variant: "destructive"
      });
      return;
    }

    if (sendingRequest.has(alumnus.id)) return;

    try {
      setSendingRequest(prev => new Set(prev).add(alumnus.id));

      const response = await fetch('/api/connections/request', {
        method: 'DELETE',
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          recipientId: alumnus.userId || alumnus.id
        })
      });

      if (response.ok) {
        // Remove from list if in 'sent' tab
        if (activeTab === 'sent') {
          setAlumni(prev => prev.filter(a => a.id !== alumnus.id));
          // Also decrease the total count to prevent refetch attempts
          setTotalCount(prev => Math.max(0, prev - 1));
        }

        // Update status
        setConnectionStatuses(prev => {
          const newStatuses = new Map(prev);
          newStatuses.set(alumnus.id, 'none');
          return newStatuses;
        });

        // Refresh connection stats
        fetchConnectionStats();

        toast({
          title: "Request Withdrawn",
          description: "Connection request withdrawn successfully"
        });
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to withdraw connection request",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error withdrawing connection request:', error);
      toast({
        title: "Error",
        description: "Failed to withdraw connection request. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSendingRequest(prev => {
        const newSet = new Set(prev);
        newSet.delete(alumnus.id);
        return newSet;
      });
    }
  };

  const handleAccept = async (alumnus: any) => {
    try {
      // We need the request ID, but we only have alumnus ID. 
      // We can fetch the list of pending requests to map it, or use a new endpoint.
      // Assuming we are in 'received' tab, we can re-use 'connectionStatuses' if we updated backend to return Request ID?
      // OR simpler: PUT /api/connections/request/by-user (if we add it)
      // OR: use the existing PUT /api/connections/request/:id. 
      // But we don't have the Request ID here! 
      // We only have the alumnus ID. 
      // Wait, 'activeTab' fetches alumni list. 
      // Does the alumni object contain the request ID? 
      // Looking at 'fetchAlumni' -> '/api/alumni/search'. 
      // If that endpoint doesn't return request ID, we are stuck.
      // BUT: We can use the 'NotificationDropdown' logic approach? No.
      // We need to fetch the request ID.
      // OR: Update backend /api/connections/request/:id to also accept 'userId' query param?
      // BETTER: Use /api/connections/request/action endpoint that takes USER ID and finds request?

      // Let's check if we can get the request ID.
      // 'connectionStatuses' is just a status string map.

      // I'll create a helper to find request ID from user ID (client side? no).
      // I will use a new endpoint: POST /api/connections/respond-by-user
      // Or cleaner: Update /api/connections/request/:id to allow :id to be 'user:123'? No.

      // Let's maintain a map of { [userId]: requestId } ?
      // Or simply call an endpoint that accepts userId.
      // I will use `GET /api/connections/requests?type=received` to get all IDs?
      // That's what 'fetchConnectionStatuses' could have done.

      // WORKAROUND: In 'received' tab, we can fetch connection requests using /api/connections/requests?type=received
      // instead of /api/alumni/search?tab=received.
      // /api/connections/requests returns the REQUEST objects (with IDs).
      // ConnectionsPage currently uses /api/alumni/search.

      // I will try to use the /api/connections/requests endpoint for fetching request ID on the fly?
      // No, that's slow.

      // I will assume we can't easily get Request ID.
      // I'll add a new endpoint: POST /api/connections/respond
      // body: { requesterId, action: 'accept'|'reject' }
      // This is robust.

      const response = await fetch('/api/connections/respond', {
        method: 'POST',
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ requesterId: alumnus.userId || alumnus.id, action: 'accept' })
      });

      if (response.ok) {
        setConnectionStatuses(prev => {
          const newStatuses = new Map(prev);
          newStatuses.set(alumnus.id, 'connected');
          return newStatuses;
        });
        fetchConnectionStats();
        toast({ title: "Connected!", description: `You remain connected with ${alumnus.first_name}` });
        // Remove from list if in 'received' tab
        if (activeTab === 'received') {
          setAlumni(prev => prev.filter(a => a.id !== alumnus.id));
          // Also decrease the total count to prevent refetch attempts
          setTotalCount(prev => Math.max(0, prev - 1));
        }
      }
    } catch (error) {
      console.error('Error accepting:', error);
    }
  };

  const handleReject = async (alumnus: any) => {
    try {
      const response = await fetch('/api/connections/respond', {
        method: 'POST',
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ requesterId: alumnus.userId || alumnus.id, action: 'reject' })
      });

      if (response.ok) {
        setConnectionStatuses(prev => {
          const newStatuses = new Map(prev);
          newStatuses.set(alumnus.id, 'none');
          return newStatuses;
        });
        fetchConnectionStats();
        toast({ title: "Request Ignored", description: "Connection request removed." });
        if (activeTab === 'received') {
          setAlumni(prev => prev.filter(a => a.id !== alumnus.id));
          // Also decrease the total count to prevent refetch attempts
          setTotalCount(prev => Math.max(0, prev - 1));
        }
      }
    } catch (error) {
      console.error("Error rejecting:", error);
    }
  };

  const handleDisconnect = async (alumnus: any) => {
    if (!user?.id) return;

    if (!confirm(`Are you sure you want to disconnect from ${alumnus.first_name}?`)) return;

    if (sendingRequest.has(alumnus.id)) return;

    try {
      setSendingRequest(prev => new Set(prev).add(alumnus.id));

      const response = await fetch('/api/connections/connection', {
        method: 'DELETE',
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          targetUserId: alumnus.userId || alumnus.user_id
        })
      });

      if (response.ok) {
        setConnectionStatuses(prev => {
          const newStatuses = new Map(prev);
          newStatuses.set(alumnus.id, 'none');
          return newStatuses;
        });

        fetchConnectionStats();

        toast({
          title: "Disconnected",
          description: `You are no longer connected with ${alumnus.first_name}.`
        });

        // If we are in 'connected' tab, remove from list
        if (activeTab === 'connected') {
          setAlumni(prev => prev.filter(a => a.id !== alumnus.id));
          setTotalCount(prev => Math.max(0, prev - 1));
        }

      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to disconnect",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast({
        title: "Error",
        description: "Failed to disconnect. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSendingRequest(prev => {
        const newSet = new Set(prev);
        newSet.delete(alumnus.id);
        return newSet;
      });
    }
  };

  const getProfilePicture = (alumnus: any) => {
    if (alumnus.profile_picture && alumnus.profile_picture.trim() !== '') {
      return alumnus.profile_picture;
    }

    const displayName = `${alumnus.first_name || ''} ${alumnus.last_name || ''}`.trim();
    const seed = encodeURIComponent(displayName);
    const gender = alumnus.gender || 'default';

    switch (gender) {
      case 'male':
        return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=008060`;
      case 'female':
        return `https://api.dicebear.com/7.x/avataaars-neutral/svg?seed=${seed}&backgroundColor=ff69b4`;
      case 'other':
        return `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}&backgroundColor=ffa500`;
      default:
        return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=008060`;
    }
  };

  const exportConnections = () => {
    const csv = [
      ['Name', 'Email', 'Phone', 'Company', 'Position', 'Location', 'Batch'].join(','),
      ...alumni.map(a => [
        `"${a.first_name} ${a.last_name}"`,
        a.email || '',
        a.phone || '',
        a.current_company || '',
        a.current_position || '',
        a.location || '',
        a.batch || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alumni_connections_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const handleApplyFilters = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setOffset(0);
    fetchAlumni(0, true);
  };

  // Handle tab click with double-click detection
  const handleTabClick = (tab: ConnectionsTab) => {
    const now = Date.now();

    // Check for double-click (within 300ms)
    if (lastClickTime && lastClickTime.tab === tab && (now - lastClickTime.time) < 300) {
      // Double-click detected - reset to 'all'
      setActiveTab('all');
      setLastClickTime(null);
      setLocation('/connections');
      setOffset(0);
      fetchAlumni(0, true, 'all');
    } else {
      // Single click - update tab immediately so fetch runs with correct tab, then sync URL
      setActiveTab(tab);
      setLocation(`/connections?tab=${tab}`);
      setLastClickTime({ tab, time: now });
    }
  };

  const handleContactAdmin = async () => {
    const currentUserId = user?.id || localStorage.getItem('userId');
    if (!currentUserId) {
      toast({
        title: "Please log in",
        description: "You need to log in to contact admin.",
        variant: "destructive",
      });
      setLocation('/login');
      return;
    }

    setContactingAdmin(true);
    try {
      const response = await fetch(`/api/messages/resolve-recipient?email=${encodeURIComponent(ADMIN_CONTACT_EMAIL)}`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();

      if (!response.ok || !data?.recipient?.id) {
        throw new Error(data?.error || "Could not open admin chat");
      }

      const username = encodeURIComponent(data.recipient.username || "Admin");
      const email = encodeURIComponent(data.recipient.email || ADMIN_CONTACT_EMAIL);
      setLocation(`/inbox?user=${data.recipient.id}&username=${username}&email=${email}`);
    } catch (error: any) {
      toast({
        title: "Unable to contact admin",
        description: error?.message || "Could not open admin chat right now.",
        variant: "destructive",
      });
    } finally {
      setContactingAdmin(false);
    }
  };

  return (
    <AppLayout currentPage="connections">
      <div className="p-3 sm:p-4 lg:p-6 max-w-7xl mx-auto overflow-x-hidden w-full">
        {/* Back Button */}
        <div className="mb-4 sm:mb-6 lg:hidden">
          <BackButton />
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="flex flex-col gap-1">
            <PageHeading firstWord="Connections" secondWord="Portal" className="mb-0" />
            {!isInitialLoading && totalCount > 0 && (
              <p className="text-sm text-gray-500">
                {alumni.length === totalCount
                  ? `Showing all ${totalCount} ${getTabEntityLabel(activeTab)}`
                  : `Showing ${alumni.length} of ${totalCount} ${getTabEntityLabel(activeTab)}`
                }
              </p>
            )}
          </div>
          <div className="flex w-full sm:w-auto gap-2">
            <Button
              onClick={handleContactAdmin}
              variant="brand"
              className="min-h-[44px] text-sm sm:text-base w-full sm:w-auto"
              disabled={contactingAdmin}
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              {contactingAdmin ? "Opening Chat..." : "Contact Admin"}
            </Button>
            {isAdministrator && (
              <Button
                onClick={exportConnections}
                variant="outline"
                className="border-[#008060] text-[#008060] hover:bg-[#008060]/10 min-h-[44px] text-sm sm:text-base w-full sm:w-auto"
                aria-label="Export connections"
              >
                <span className="mr-2">Download</span>
                Export Connections
              </Button>
            )}
          </div>
        </div>

        {/* Navigation Tabs - Modern Shadcn UI Tabs */}
        <div className="mb-8">
          <Tabs
            value={activeTab}
            onValueChange={(value) => handleTabClick(value as typeof activeTab)}
            className="w-full"
          >
            <TabsList className="grid grid-cols-2 lg:flex lg:w-full h-auto p-1 bg-gray-100/50 backdrop-blur-sm rounded-xl border border-gray-200 shadow-sm gap-1 lg:gap-2">
              <TabsTrigger 
                value="all" 
                className="flex-1 rounded-lg py-3 lg:py-2.5 data-[state=active]:bg-white data-[state=active]:text-[#008060] data-[state=active]:shadow-md transition-all duration-300"
              >
                <div className="flex flex-col lg:flex-row items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span className="font-bold whitespace-nowrap">All Alumni</span>
                  <span className="text-[10px] bg-gray-100 text-[#008060] px-1.5 py-0.5 rounded-full font-bold">({allUsersCount || 0})</span>
                </div>
              </TabsTrigger>
              <TabsTrigger 
                value="connected" 
                className="flex-1 rounded-lg py-3 lg:py-2.5 data-[state=active]:bg-white data-[state=active]:text-[#008060] data-[state=active]:shadow-md transition-all duration-300"
              >
                <div className="flex flex-col lg:flex-row items-center gap-2">
                  <UserCheck className="w-4 h-4" />
                  <span className="font-bold whitespace-nowrap">My Network</span>
                  <span className="text-[10px] bg-gray-100 text-[#008060] px-1.5 py-0.5 rounded-full font-bold">({connectionStats.totalConnections || 0})</span>
                </div>
              </TabsTrigger>
              <TabsTrigger 
                value="received" 
                className="flex-1 rounded-lg py-3 lg:py-2.5 data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:shadow-md transition-all duration-300"
              >
                <div className="flex flex-col lg:flex-row items-center gap-2">
                  <BellRing className="w-4 h-4" />
                  <span className="font-bold whitespace-nowrap">Requests</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${connectionStats.pendingReceived > 0 ? 'bg-orange-500 text-white animate-pulse' : 'bg-orange-100 text-orange-700'}`}>
                    ({connectionStats.pendingReceived || 0})
                  </span>
                </div>
              </TabsTrigger>
              <TabsTrigger 
                value="sent" 
                className="flex-1 rounded-lg py-3 lg:py-2.5 data-[state=active]:bg-white data-[state=active]:text-[#008060] data-[state=active]:shadow-md transition-all duration-300"
              >
                <div className="flex flex-col lg:flex-row items-center gap-2">
                  <Send className="w-4 h-4" />
                  <span className="font-bold whitespace-nowrap">Sent</span>
                  <span className="text-[10px] bg-gray-100 text-[#008060] px-1.5 py-0.5 rounded-full font-bold">({connectionStats.pendingSent || 0})</span>
                </div>
              </TabsTrigger>
              <TabsTrigger 
                value="champions" 
                className="flex-1 col-span-2 lg:col-span-1 rounded-lg py-3 lg:py-2.5 data-[state=active]:bg-amber-50 data-[state=active]:text-amber-700 data-[state=active]:shadow-md transition-all duration-300 border border-transparent data-[state=active]:border-amber-200"
              >
                <div className="flex flex-col lg:flex-row items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <span className="font-bold whitespace-nowrap">Champions</span>
                  <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">({championsCount || 0})</span>
                </div>
              </TabsTrigger>
              <TabsTrigger 
                value="faculty" 
                className="flex-1 col-span-2 lg:col-span-1 rounded-lg py-3 lg:py-2.5 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:shadow-md transition-all duration-300 border border-transparent data-[state=active]:border-blue-200"
              >
                <div className="flex flex-col lg:flex-row items-center gap-2">
                  <School className="w-4 h-4 text-blue-500" />
                  <span className="font-bold whitespace-nowrap">Faculty</span>
                  <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">({facultyCount || 0})</span>
                </div>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row gap-3 sm:gap-4">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              <Input
                placeholder="Search alumni by name, branch, position..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    fetchAlumni(0, true);
                  }
                }}
                className="pl-10 min-h-[44px] text-sm sm:text-base border-gray-200 focus:border-[#008060] focus:ring-[#008060] rounded-xl shadow-sm"
                aria-label="Search alumni"
              />
            </div>
            <Button
              onClick={handleApplyFilters}
              variant="brand"
              className="min-h-[44px] px-8 rounded-xl"
            >
              Search
            </Button>
          </div>
        </div>

        {/* Alumni Grid with Refined Loading states */}
        <div className="relative min-h-[400px]">
          {/* Filtering Overlay */}
          {isFiltering && (
            <div className="absolute inset-0 z-10 bg-white/50 backdrop-blur-[1px] flex items-center justify-center rounded-lg">
              <div className="flex flex-col items-center gap-3 bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#008060] border-t-transparent"></div>
                <p className="text-[#008060] font-medium">Updating results...</p>
              </div>
            </div>
          )}

          {isInitialLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <SkeletonConnectionCard key={i} />
              ))}
            </div>
          ) : alumni.length === 0 ? (
            <Card className="border-dashed border-2 border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100/50">
              <CardContent className="p-12 text-center">
                <div className="max-w-md mx-auto space-y-6">
                  {activeTab === 'connected' && (
                    <>
                      <div className="text-6xl mb-4">🤝</div>
                      <div className="space-y-2">
                        <h3 className="text-2xl font-bold text-gray-900">No Connections Yet</h3>
                        <p className="text-gray-600">You haven't connected with any alumni yet. Start connecting to build your network!</p>
                      </div>
                    </>
                  )}
                  {activeTab === 'sent' && (
                    <>
                      <div className="text-6xl mb-4">📤</div>
                      <div className="space-y-2">
                        <h3 className="text-2xl font-bold text-gray-900">No Pending Requests</h3>
                        <p className="text-gray-600">You haven't sent any connection requests yet.</p>
                      </div>
                    </>
                  )}
                  {activeTab === 'received' && (
                    <>
                      <div className="text-6xl mb-4">📥</div>
                      <div className="space-y-2">
                        <h3 className="text-2xl font-bold text-gray-900">No Pending Requests</h3>
                        <p className="text-gray-600">You don't have any pending connection requests at the moment.</p>
                      </div>
                    </>
                  )}
                  {activeTab === 'champions' && (
                    <>
                      <div className="text-6xl mb-4">🏆</div>
                      <div className="space-y-2">
                        <h3 className="text-2xl font-bold text-gray-900">No Batch Champions</h3>
                        <p className="text-gray-600">No batch champions found at this time.</p>
                      </div>
                    </>
                  )}
                  {activeTab === 'faculty' && (
                    <>
                      <div className="mb-4 flex justify-center">
                        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-blue-100">
                          <School className="h-7 w-7 text-blue-700" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-2xl font-bold text-gray-900">No Faculty Found</h3>
                        <p className="text-gray-600">No faculty profiles match your current filters.</p>
                      </div>
                    </>
                  )}
                  {(activeTab === 'all' || !activeTab) && (
                    <>
                      <div className="text-6xl mb-4">👥</div>
                      <div className="space-y-2">
                        <h3 className="text-2xl font-bold text-gray-900">No alumni found</h3>
                        <p className="text-gray-600">
                          {searchTerm
                            ? 'Try adjusting your search or filters'
                            : 'No alumni match your current filters'}
                        </p>
                      </div>
                    </>
                  )}
                  <div className="pt-4">
                    <Button
                      onClick={clearFilters}
                      variant="outline"
                      className="text-[#008060] border-[#008060] hover:bg-[#008060]/5"
                    >
                      {activeTab === 'all' ? 'Clear Filters' : 'View All Users'}
                    </Button>
                  </div>
                  {activeTab === 'all' && (
                    <div className="pt-4 border-t border-gray-200">
                      <p className="text-sm text-gray-500">
                        💡 <strong>Tip:</strong> Use the search bar to find specific alumni by name, company, or location
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
              {alumni.map((person) => {
                const fullName = `${person.first_name || ''} ${person.last_name || ''}`.trim();
                // Ensure status is always defined - default to 'none' if not found
                // Also check if person.userId matches current user (for own profile)
                const personUserId = person.userId || person.user_id;
                const isOwnProfile = user?.id === personUserId || user?.id === person.id;
                const status = isOwnProfile ? 'none' : (connectionStatuses.get(person.id) || 'none');
                const isSending = sendingRequest.has(person.id);

                return (
                  <Card key={person.id} className={`group hover:shadow-lg transition-all duration-300 max-w-full overflow-hidden ${person.isBatchChampion ? 'border-amber-400 ring-1 ring-amber-400 bg-amber-50/10' : 'border-gray-200'}`}>
                    <CardContent className="p-4 sm:p-6">
                      <div className="flex items-start justify-between mb-4">
                        <Avatar className="w-16 h-16 sm:w-20 sm:h-20 border-2 border-white shadow-sm cursor-pointer hover:opacity-90 transition-opacity" onClick={() => handleViewProfile(person.userId || person.id)}>
                          <AvatarImage
                            src={getProfilePicture(person)}
                            alt={fullName}
                            className="object-cover"
                          />
                          <AvatarFallback className="bg-[#008060] text-white text-xl">
                            {fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col items-end gap-1">
                          {person.isBatchChampion && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-amber-100 to-amber-200 text-amber-800 border border-amber-200 shadow-sm">
                              🏆 Batch Champion
                            </span>
                          )}
                          {person.batch && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              Class of {person.batch}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3 mb-6">
                        <div>
                          <h3
                            className="font-bold text-lg text-gray-900 truncate cursor-pointer hover:text-[#008060] transition-colors"
                            onClick={() => handleViewProfile(person.userId || person.id)}
                          >
                            {fullName || 'Alumni Member'}
                          </h3>
                          <p className="text-sm font-medium text-[#008060] truncate">
                            {person.userRole === 'faculty' ? 'Faculty' : person.userRole === 'student' ? 'Current Student' : person.userRole === 'administrator' ? 'Administrator' : person.userRole === 'user' ? 'User' : 'Alumni'}
                          </p>
                          {(person.current_role || person.currentRole) && (
                            <p className="text-sm text-gray-600 truncate">{person.current_role || person.currentRole}</p>
                          )}
                          {person.current_company && (
                            <p className="text-sm text-gray-500 truncate font-medium">{person.current_company}</p>
                          )}
                        </div>

                        <div className="space-y-1 pt-2 border-t border-gray-50">
                          {(person.current_city || person.currentCity) && (
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <span>📍</span>
                              <span className="truncate">{person.current_city || person.currentCity}</span>
                            </div>
                          )}
                          {(person.industry || person.branch) && (
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <span>💼</span>
                              <span className="truncate">{person.industry || person.branch}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 pt-2 w-full">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-[#008060] border-[#008060] hover:bg-[#008060]/10 min-h-[40px]"
                          onClick={() => setLocation(`/inbox?user=${person.userId || person.id}`)}
                        >
                          Message
                        </Button>
                        {!isOwnProfile ? (
                          <>
                            {status === 'none' && (
                              <Button
                                size="sm"
                                variant="brand"
                                className="w-full min-h-[44px]"
                                onClick={() => handleConnect(person)}
                                disabled={isSending}
                              >
                                {isSending ? 'Sending...' : 'Connect'}
                              </Button>
                            )}
                            {status === 'pending_received' && (
                              <div className="flex gap-2 w-full">
                                <Button
                                  size="sm"
                                  className="flex-1 bg-[#008060] hover:bg-[#007055] text-white min-h-[40px]"
                                  onClick={() => handleAccept(person)}
                                >
                                  Accept
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1 text-red-600 border-red-200 hover:bg-red-50 min-h-[40px]"
                                  onClick={() => handleReject(person)}
                                >
                                  Decline
                                </Button>
                              </div>
                            )}
                            {status === 'pending_sent' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full text-orange-600 border-orange-300 hover:bg-orange-50 min-h-[40px]"
                                onClick={() => handleWithdraw(person)}
                                disabled={isSending}
                              >
                                {isSending ? 'Withdrawing...' : 'Withdraw Request'}
                              </Button>
                            )}
                            {status === 'connected' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full text-[#008060] border-[#008060] bg-[#008060]/5 hover:bg-red-50 hover:text-red-600 hover:border-red-600 transition-colors min-h-[40px] group/disconnect"
                                onClick={() => handleDisconnect(person)}
                                disabled={isSending}
                              >
                                <span className="group-hover/disconnect:hidden flex items-center gap-2">
                                  <Check className="w-4 h-4" /> Connected
                                </span>
                                <span className="hidden group-hover/disconnect:flex items-center justify-center gap-2 w-full">
                                  <UserMinus className="w-4 h-4" /> Disconnect
                                </span>
                              </Button>
                            )}
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled
                            className="w-full cursor-default text-gray-400 min-h-[40px]"
                          >
                            You
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Infinite Scroll & Enhanced Loading State */}
        <div ref={observerTarget} className="h-10 mt-6 flex flex-col items-center justify-center w-full gap-2">
          {isFetchingMore && (
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 text-[#008060]">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#008060] border-t-transparent"></div>
                <span className="text-sm font-medium">Loading more connections...</span>
              </div>
              {totalCount > 0 && (
                <p className="text-xs text-gray-500">
                  Loaded {alumni.length} of {totalCount}
                </p>
              )}
            </div>
          )}
          {!loading && !isFetchingMore && alumni.length > 0 && alumni.length >= totalCount && (
            <div className="flex flex-col items-center gap-1">
              <p className="text-sm text-gray-500">✓ All connections loaded</p>
              {totalCount > 0 && (
                <p className="text-xs text-gray-400">
                  Showing all {totalCount} {getTabEntityLabel(activeTab)}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Scroll to Top Button */}
        {/* z-30 ensures it's below all modals (z-50), dropdowns (z-[60]), and profile modals (z-[150]) */}
        {showScrollTop && (
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-6 right-6 z-30 bg-[#008060] hover:bg-[#007055] text-white rounded-full p-3 shadow-lg transition-all duration-300 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-[#008060] focus:ring-offset-2"
            aria-label="Scroll to top"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </button>
        )}
      </div>
    </AppLayout>
  );
};


