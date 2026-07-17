import React, { useEffect, useState, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import {
  Bell, MessageSquare, UserPlus, ThumbsUp, MessageCircle, Calendar, Briefcase,
  CheckCircle, X, Check, Trash2, Search, Filter, FileText, Trophy, AlertTriangle, Star
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";
import {
  EnhancedNotification,
  BundledNotification,
  bundleNotifications,
  filterByDate,
  getActorAvatar,
  getNotificationTypeLabel,
  getNotificationTypeColor,
} from "@/utils/notificationUtils";

interface NotificationDropdownProps {
  onClose: () => void;
}

type FilterType = 'all' | 'unread' | 'today' | 'this_week';
type GroupByType = 'none' | 'type';

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ onClose }) => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, adminUser } = useAuth();
  const activeUser = adminUser || user;

  // Use NotificationContext as single source of truth
  const { notifications: contextNotifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, deleteAllNotifications, fetchNotifications } = useNotifications();
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [groupBy, setGroupBy] = useState<GroupByType>('none');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Convert context notifications to EnhancedNotification format
  const notifications = useMemo(() => {
    return contextNotifications.map(n => ({
      ...n,
      is_read: n.isRead,
      actor_id: n.relatedId,
      related_id: n.relatedId,
      created_at: n.createdAt
    })) as EnhancedNotification[];
  }, [contextNotifications]);

  useEffect(() => {
    // Don't fetch on mount - context handles initial fetch
    // Only fetch if explicitly needed (e.g., manual refresh)

    const handleRefreshEvent = () => {
      if (activeUser?.id) {
        fetchNotifications(true); // Force fetch on manual refresh only
      }
    };

    // Don't listen to socket here - context handles it via 'new-notification' event
    // This prevents duplicate fetches
    window.addEventListener('refresh-notifications', handleRefreshEvent);

    return () => {
      window.removeEventListener('refresh-notifications', handleRefreshEvent);
    };
  }, [activeUser?.id]); // Remove fetchNotifications from deps to prevent re-running

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Don't close if clicking the notification button itself
      const notificationButton = target instanceof Element && 
        (target.closest('[aria-label*="Notifications"]') || 
         target.closest('button[aria-label*="Notifications"]'));
      
      if (dropdownRef.current && !dropdownRef.current.contains(target) && !notificationButton) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Simplified scroll lock when dropdown is open
  useEffect(() => {
    // Current scrollable element depends on where we are
    // In Admin pages, it's often the <main> element
    const scrollableContainers = [
      document.body,
      document.documentElement,
      document.querySelector('main'),
      document.querySelector('[data-scrollable-container]')
    ].filter(Boolean) as HTMLElement[];

    // Store original styles to restore later
    const originalStyles = scrollableContainers.map(el => ({
      element: el,
      overflow: el.style.overflow,
      overflowY: el.style.overflowY,
      paddingRight: el.style.paddingRight
    }));

    // Detect scrollbar width to prevent layout shift
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    // Apply scroll lock
    scrollableContainers.forEach(el => {
      // Only apply if it's actually scrollable or to the body/html
      if (el === document.body || el === document.documentElement || el.scrollHeight > el.clientHeight) {
        el.style.overflow = 'hidden';
        el.style.overflowY = 'hidden';
        
        // Add padding to prevent jumping (standard practice)
        // Apply to body/html ALWAYS, and to main if it was the scrollable container
        if (scrollbarWidth > 0) {
          if (el === document.body || el === document.documentElement || el.tagName.toLowerCase() === 'main') {
            el.style.paddingRight = `${scrollbarWidth}px`;
          }
        }
      }
    });

    // Cleanup function
    return () => {
      originalStyles.forEach(({ element, overflow, overflowY, paddingRight }) => {
        element.style.overflow = overflow;
        element.style.overflowY = overflowY;
        element.style.paddingRight = paddingRight;
      });
    };
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (searchInputRef.current) {
      // Small delay to ensure dropdown is rendered
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, []);



  // Filter and process notifications
  const processedNotifications = useMemo(() => {
    let filtered = [...notifications];

    // Apply date filter
    if (activeFilter !== 'all') {
      filtered = filterByDate(filtered, activeFilter);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(n =>
        n.title.toLowerCase().includes(query) ||
        n.content.toLowerCase().includes(query) ||
        (n.actor && (
          n.actor.fullName.toLowerCase().includes(query) ||
          n.actor.firstName.toLowerCase().includes(query) ||
          n.actor.lastName.toLowerCase().includes(query)
        ))
      );
    }

    // Bundle similar notifications
    const bundled = bundleNotifications(filtered);

    return bundled;
  }, [notifications, activeFilter, searchQuery]);

  // Group notifications by type if enabled
  const groupedNotifications = useMemo(() => {
    if (groupBy !== 'type') {
      return { 'All': processedNotifications };
    }

    const groups: Record<string, (EnhancedNotification | BundledNotification)[]> = {};

    processedNotifications.forEach(notification => {
      const _isBundled = 'notifications' in notification;
      const type = notification.type;
      const label = getNotificationTypeLabel(type);

      if (!groups[label]) {
        groups[label] = [];
      }
      groups[label].push(notification);
    });

    return groups;
  }, [processedNotifications, groupBy]);

  const getNotificationIcon = (type: string) => {
    const iconClass = "w-4 h-4";
    switch (type) {
      case 'message':
        return <MessageSquare className={`${iconClass} text-blue-500`} />;
      case 'connection_request':
      case 'connection_response':
        return <UserPlus className={`${iconClass} text-green-500`} />;
      case 'post_like':
        return <ThumbsUp className={`${iconClass} text-red-500`} />;
      case 'post_comment':
      case 'comment_reply':
        return <MessageCircle className={`${iconClass} text-purple-500`} />;
      case 'event_rsvp':
      case 'event_reminder_24h':
      case 'event_reminder_1h':
        return <Calendar className={`${iconClass} text-orange-500`} />;
      case 'job':
        return <Briefcase className={`${iconClass} text-indigo-500`} />;
      case 'signup_approved':
      case 'post_approved':
        return <CheckCircle className={`${iconClass} text-green-500`} />;
      case 'signup_request':
        return <UserPlus className={`${iconClass} text-amber-500`} />;
      case 'post_pending_approval':
        return <FileText className={`${iconClass} text-amber-500`} />;
      case 'post_rejected':
      case 'post_deleted':
        return <X className={`${iconClass} text-red-500`} />;
      case 'badge_earned':
        return <Trophy className={`${iconClass} text-amber-500`} />;
      case 'badge_lost':
        return <AlertTriangle className={`${iconClass} text-red-500`} />;
      case 'gamification_point':
        return <Star className={`${iconClass} text-emerald-500`} />;
      case 'mentorship_request':
      case 'mentorship_response':
        return <UserPlus className={`${iconClass} text-teal-500`} />;
      default:
        return <Bell className={`${iconClass} text-gray-500`} />;
    }
  };

  const getRedirectUrl = (notification: EnhancedNotification | BundledNotification): string => {
    if ('redirect_url' in notification && notification.redirect_url) {
      return notification.redirect_url;
    }

    switch (notification.type) {
      case 'message':
        return '/inbox';
      case 'connection_request':
        return '/connections?tab=received';
      case 'connection_response':
        return '/connections';
      case 'post_like':
      case 'post_comment':
      case 'comment_reply':
      case 'post_deleted':
        return '/blogs';
      case 'post_approved':
        return '/city-chapter';
      case 'post_rejected':
        return '/city-chapter?tab=mine';
      case 'post_pending_approval':
        return '/admin/city-chapters';
      case 'new_blog':
        return '/admin/blogs';
      case 'event_rsvp':
      case 'event_reminder_24h':
      case 'event_reminder_1h':
        return '/events';
      case 'job':
        return '/job-portal';
      case 'signup_approved':
        return '/profile';
      case 'signup_request':
        return '/admin/users';
      case 'mentorship_request':
      case 'mentorship_response':
      case 'session_scheduled':
      case 'session_cancelled':
        return '/mentorship';
      case 'badge_earned':
      case 'badge_lost':
        return '/leaderboard';
      case 'new_podcast':
        return '/podcasts';
      default:
        return '/feed';
    }
  };

  const handleDelete = async (notificationId: string, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }

    if (showDeleteConfirm !== notificationId) {
      setShowDeleteConfirm(notificationId);
      return;
    }

    setDeletingId(notificationId);
    setShowDeleteConfirm(null);

    try {
      // Use context method which handles optimistic updates and sync
      await deleteNotification(notificationId);
      toast({
        title: "Success",
        description: "Notification deleted",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete notification",
        variant: "destructive"
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleConnectionAction = async (notification: EnhancedNotification, action: 'accept' | 'reject', event: React.MouseEvent) => {
    event.stopPropagation();

    setProcessingAction(notification.id);
    try {
      const userId = user?.id || localStorage.getItem('userId');

      if (!userId) {
        throw new Error('User ID not available');
      }

      const response = await fetch(`/api/notifications/${notification.id}/connection-action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-id': userId
        },
        body: JSON.stringify({ action })
      });

      if (response.ok) {
        // Refresh notifications from context to sync with DB
        await fetchNotifications();

        toast({
          title: "Success",
          description: action === 'accept'
            ? "Connection request accepted!"
            : "Connection request declined",
        });
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to process request');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process request",
        variant: "destructive"
      });
    } finally {
      setProcessingAction(null);
    }
  };

  const handleNotificationClick = async (notification: EnhancedNotification | BundledNotification) => {
    // Don't navigate if it's a connection request (user should use action buttons)
    // if (notification.type === 'connection_request') {
    //   return;
    // }

    try {
      const userId = activeUser?.id || localStorage.getItem('userId');

      if (!userId) {
        throw new Error('User ID not available');
      }

      // Mark all notifications in bundle as read
      const notificationIds = 'notifications' in notification
        ? notification.notifications.map(n => n.id)
        : [notification.id];

      // Track click analytics and mark as read
      await Promise.all([
        ...notificationIds.map(id =>
          fetch(`/api/notifications/${id}/read`, {
            method: 'PUT',
            headers: { 'user-id': userId }
          })
        ),
        // Track click for the main notification
        fetch(`/api/notifications/${notification.id}/click`, {
          method: 'POST',
          headers: { 'user-id': userId }
        }).catch(err => {
          // Don't fail if analytics fails
        })
      ]);

      // Use context method which handles optimistic updates and sync
      await Promise.all(
        notificationIds.map(id => markAsRead(id))
      );

      // Get the related_id (use first notification's related_id if bundled)
      const relatedId = 'notifications' in notification
        ? notification.notifications[0]?.related_id || notification.related_id
        : notification.related_id;

      // Build redirect URL with proper deep linking
      let redirectUrl = getRedirectUrl(notification);

      // Add query params or hash for deep linking based on notification type
      if (relatedId) {
        switch (notification.type) {
          case 'connection_request':
            redirectUrl = '/connections?tab=received';
            break;

          case 'connection_response':
            // For connection response (accepted/rejected), go to connections page
            // relatedId is the user who responded
            redirectUrl = `/connections?userId=${relatedId}`;
            sessionStorage.setItem('highlightUserId', relatedId);
            break;

          case 'post_like':
          case 'post_comment':
          case 'comment_reply':
            // For post notifications, use hash to scroll to post
            redirectUrl = `/feed#post-${relatedId}`;
            // Store post ID in sessionStorage for FeedPage to pick up
            sessionStorage.setItem('scrollToPostId', relatedId);
            break;

          case 'message': {
            // For message notifications, open specific conversation
            // Use actor_id if available, otherwise use related_id
            const messageUserId = ('actor_id' in notification && notification.actor_id)
              || ('notifications' in notification && notification.notifications[0]?.actor_id)
              || relatedId;
            if (messageUserId) {
              redirectUrl = `/inbox?user=${messageUserId}`;
              // Store conversation ID for InboxPage to pick up
              sessionStorage.setItem('openConversationId', messageUserId);
            }
            break;
          }

          case 'event_rsvp':
          case 'event_reminder_24h':
          case 'event_reminder_1h':
            // For event notifications, redirect to specific event
            redirectUrl = `/events?eventId=${relatedId}`;
            sessionStorage.setItem('scrollToEventId', relatedId);
            break;

          case 'job':
            // For job notifications, scroll to specific job
            redirectUrl = `/job-portal?jobId=${relatedId}`;
            sessionStorage.setItem('scrollToJobId', relatedId);
            break;

          case 'post_approved':
          case 'post_rejected':
          case 'post_deleted':
          case 'new_blog':
            // redirect_url is already set correctly by the server (e.g. /blogs/:slug)
            // getRedirectUrl already picked it up — don't override it here
            break;

          case 'signup_approved':
            // For signup approval, go to profile
            redirectUrl = '/profile';
            break;

          case 'signup_request':
            // For admin - signup request notification
            redirectUrl = '/admin/users';
            break;

          case 'post_pending_approval':
            redirectUrl = '/admin/city-chapters?tab=pending';
            break;

          case 'mentorship_request':
          case 'mentorship_response':
          case 'session_scheduled':
          case 'session_cancelled':
            redirectUrl = '/mentorship';
            break;

          case 'badge_earned':
          case 'badge_lost':
            redirectUrl = '/leaderboard';
            break;

          case 'new_podcast':
            redirectUrl = '/podcasts';
            break;

          case 'signup_request':
            redirectUrl = '/admin/users';
            break;

          case 'connection_request':
            redirectUrl = '/connections?tab=received';
            break;
        }
      }

      // Navigate to the redirect URL
      setLocation(redirectUrl);
      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process notification",
        variant: "destructive"
      });
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const userId = activeUser?.id || localStorage.getItem('userId');

      if (!userId) {
        toast({
          title: "Error",
          description: "User ID not available",
          variant: "destructive"
        });
        return;
      }

      await fetch('/api/notifications/read-all', {
        method: 'PUT',
        headers: {
          'user-id': userId
        }
      });

      // Use context method which handles optimistic updates and sync
      await markAllAsRead();
      toast({
        title: "Success",
        description: "All notifications marked as read"
      });
    } catch (error) {
    }
  };

  const handleClearAll = async () => {
    if (!confirm("Are you sure you want to clear all notifications?")) return;

    try {
      // Use context method which handles optimistic updates and sync
      await deleteAllNotifications();
      toast({
        title: "Success",
        description: "All notifications cleared"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to clear notifications",
        variant: "destructive"
      });
    }
  };

  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div
      ref={dropdownRef}
      data-notification-dropdown="true"
      className="fixed left-2 right-2 top-[72px] sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 w-auto sm:w-80 md:w-96 lg:w-[420px] xl:w-[480px] max-w-none sm:max-w-md border border-gray-200 rounded-xl sm:rounded-lg shadow-2xl z-[9999] flex flex-col animate-in fade-in slide-in-from-top-2 duration-200 min-h-[150px] sm:min-h-[200px]"
      style={{
        maxHeight: isMobile ? 'calc(100vh - 80px)' : '80vh',
        background: 'var(--brand-gradient-subtle)',
      }}
    >
      {/* Header */}
      <div className="p-3 sm:p-4 border-b border-gray-100 flex flex-col gap-2 sm:gap-3 sticky top-0 z-10 flex-shrink-0" style={{ background: 'var(--brand-gradient-subtle)' }}>
        <div className="flex justify-between items-center gap-2">
          <h3 className="font-semibold text-gray-900 text-sm sm:text-base md:text-lg">Notifications</h3>
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs sm:text-sm text-[#008060] hover:underline min-h-[44px] px-2 sm:px-3 whitespace-nowrap touch-manipulation"
              >
                <span className="hidden sm:inline">Mark all read</span>
                <span className="sm:hidden">Mark read</span>
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={handleClearAll}
                className="text-xs sm:text-sm text-red-600 hover:text-red-700 hover:underline min-h-[44px] px-2 sm:px-3 whitespace-nowrap touch-manipulation"
              >
                <span className="hidden sm:inline">Clear all</span>
                <span className="sm:hidden">Clear</span>
              </button>
            )}
            <button
              onClick={() => setGroupBy(groupBy === 'type' ? 'none' : 'type')}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0"
              aria-label={groupBy === 'type' ? 'Ungroup notifications' : 'Group by type'}
              title={groupBy === 'type' ? 'Ungroup' : 'Group by type'}
            >
              <Filter className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0"
              aria-label="Close notifications"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Search notifications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide pb-1 -mb-1">
          {(['all', 'unread', 'today', 'this_week'] as FilterType[]).map((filter) => {
            const isActive = activeFilter === filter;
            // Calculate counts from processed notifications to ensure accuracy
            const filteredForCount = filter === 'all'
              ? notifications
              : filter === 'unread'
                ? notifications.filter(n => !n.is_read)
                : filterByDate(notifications, filter);
            const count = filteredForCount.length;

            return (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-3 sm:px-4 py-2 sm:py-1.5 text-xs sm:text-sm font-medium rounded-full whitespace-nowrap transition-all touch-manipulation min-h-[36px] sm:min-h-[auto] flex items-center gap-1.5 ${isActive
                  ? 'bg-[#008060] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300'
                  }`}
              >
                <span className="whitespace-nowrap">
                  {filter === 'all' ? 'All' : filter === 'unread' ? 'Unread' : filter === 'today' ? 'Today' : 'This Week'}
                </span>
                {count > 0 && (
                  <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold flex-shrink-0 ${isActive ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
                    }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Notifications List */}
      <div
        className="flex-1 overflow-y-auto overscroll-contain scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent"
        style={{
          maxHeight: isMobile
            ? 'calc(100vh - 14rem)'
            : 'calc(80vh - 8rem)'
        }}
      >
        {notifications.length === 0 ? (
          <div className="p-6 sm:p-8 text-center">
            <Bell className="w-10 h-10 sm:w-12 sm:h-12 text-gray-300 mx-auto mb-2 sm:mb-3" />
            <p className="text-xs sm:text-sm font-medium text-gray-900 mb-1">No notifications yet</p>
            <p className="text-[10px] sm:text-xs text-gray-500">
              {searchQuery ? 'Try a different search term' : 'You\'re all caught up!'}
            </p>
          </div>
        ) : (
          Object.entries(groupedNotifications).map(([groupLabel, groupNotifications]) => (
            <div key={groupLabel} className={groupBy === 'type' ? 'mb-4' : ''}>
              {groupBy === 'type' && (
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 sticky top-0 z-5">
                  <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    {groupLabel}
                  </h4>
                </div>
              )}
              {groupNotifications.map((notification) => {
                const isBundled = 'notifications' in notification;
                const bundledNotification = isBundled ? notification as BundledNotification : null;
                const singleNotification = isBundled ? null : notification as EnhancedNotification;

                return (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`p-2.5 sm:p-3 md:p-4 active:bg-gray-100 hover:bg-gray-50 border-b border-gray-50 transition-all duration-150 touch-manipulation ${notification.type !== 'connection_request' ? 'cursor-pointer' : ''
                      } ${!notification.is_read ? 'bg-blue-50/50' : 'bg-white'} group`}
                  >
                    <div className="flex items-start gap-2 sm:gap-3">
                      {/* Avatar */}
                      {singleNotification?.actor && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setLocation(`/profile/${singleNotification.actor_id}`);
                            onClose();
                          }}
                          className="flex-shrink-0 mt-0.5 sm:mt-1"
                        >
                          <Avatar className="w-8 h-8 sm:w-10 sm:h-10 ring-2 ring-offset-2 ring-gray-200 hover:ring-[#008060] transition-all">
                            <AvatarImage src={getActorAvatar(singleNotification.actor)} alt={singleNotification.actor.fullName} />
                            <AvatarFallback className="bg-[#008060]/10 text-[#008060] text-xs font-semibold">
                              {singleNotification.actor.fullName
                                .split(' ')
                                .map(n => n[0])
                                .join('')
                                .toUpperCase()
                                .slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                        </button>
                      )}

                      {/* Bundled Avatars */}
                      {bundledNotification && bundledNotification.actors.length > 0 && (
                        <div className="flex-shrink-0 mt-0.5 sm:mt-1 flex -space-x-2">
                          {bundledNotification.actors.slice(0, 3).map((actor, idx) => (
                            <button
                              key={idx}
                              onClick={(e) => {
                                e.stopPropagation();
                                const actorId = bundledNotification.notifications.find(n => n.actor_id)?.actor_id;
                                if (actorId) {
                                  setLocation(`/profile/${actorId}`);
                                  onClose();
                                }
                              }}
                              className="relative"
                            >
                              <Avatar className="w-8 h-8 sm:w-10 sm:h-10 ring-2 ring-offset-2 ring-white hover:ring-[#008060] transition-all">
                                <AvatarImage src={getActorAvatar(actor)} alt={actor.fullName} />
                                <AvatarFallback className="bg-[#008060]/10 text-[#008060] text-xs font-semibold">
                                  {actor.fullName
                                    .split(' ')
                                    .map(n => n[0])
                                    .join('')
                                    .toUpperCase()
                                    .slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                            </button>
                          ))}
                          {bundledNotification.actors.length > 3 && (
                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs font-semibold text-gray-600">
                              +{bundledNotification.actors.length - 3}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Icon (if no avatar) */}
                      {!singleNotification?.actor && !bundledNotification && (
                        <div className="mt-0.5 sm:mt-1 flex-shrink-0">
                          {getNotificationIcon(notification.type)}
                        </div>
                      )}

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs sm:text-sm md:text-base ${!notification.is_read ? 'font-semibold' : 'font-medium'} break-words`}>
                              {notification.title}
                            </p>
                            <p className="text-xs sm:text-sm text-gray-600 line-clamp-2 mt-0.5 sm:mt-1 break-words">
                              {notification.content}
                            </p>
                            <p className="text-[10px] sm:text-xs text-gray-500 mt-1 sm:mt-1.5">
                              {notification.created_at ? (
                                (() => {
                                  // Normalize Supabase timestamps to include timezone info
                                  const rawTs = notification.created_at;
                                  const dateStr = /[Z+\-]\d*$/.test(rawTs) ? rawTs : `${rawTs}Z`;
                                  const date = new Date(dateStr);
                                  return isNaN(date.getTime()) ? 'Just now' : formatDistanceToNow(date, { addSuffix: true });
                                })()
                              ) : 'Just now'}
                            </p>
                          </div>

                          {/* Delete Button */}
                          <button
                            onClick={(e) => handleDelete(notification.id, e)}
                            className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity p-2 sm:p-1.5 hover:bg-red-50 active:bg-red-100 rounded-full flex-shrink-0 touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
                            aria-label="Delete notification"
                            title="Delete notification"
                          >
                            {showDeleteConfirm === notification.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(notification.id, e);
                                  }}
                                  className="text-red-600 hover:text-red-700 text-xs font-medium"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowDeleteConfirm(null);
                                  }}
                                  className="text-gray-600 hover:text-gray-700 text-xs font-medium ml-1"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <Trash2 className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${deletingId === notification.id ? 'text-red-400' : 'text-gray-400 hover:text-red-500'}`} />
                            )}
                          </button>
                        </div>

                        {/* Connection Request Action Buttons */}
                        {notification.type === 'connection_request' && !notification.is_read && singleNotification && (
                          <div className="flex gap-2 sm:gap-3 mt-2.5 sm:mt-3">
                            <Button
                              size="sm"
                              onClick={(e) => handleConnectionAction(singleNotification, 'accept', e)}
                              disabled={processingAction === notification.id}
                              className="bg-[#008060] hover:bg-[#007055] active:bg-[#006048] text-white min-h-[44px] text-xs sm:text-sm flex-1 sm:flex-none px-3 sm:px-4 touch-manipulation"
                            >
                              {processingAction === notification.id ? (
                                <span className="flex items-center gap-1.5">
                                  <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  <span className="hidden sm:inline">Processing...</span>
                                  <span className="sm:hidden">...</span>
                                </span>
                              ) : (
                                <span className="flex items-center gap-1.5">
                                  <Check className="w-3 h-3 sm:w-4 sm:h-4" />
                                  <span>Accept</span>
                                </span>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => handleConnectionAction(singleNotification, 'reject', e)}
                              disabled={processingAction === notification.id}
                              className="border-gray-300 text-gray-700 hover:bg-gray-100 active:bg-gray-200 min-h-[44px] text-xs sm:text-sm flex-1 sm:flex-none px-3 sm:px-4 touch-manipulation"
                            >
                              <X className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                              <span>Decline</span>
                            </Button>
                          </div>
                        )}

                        {/* Type Badge */}
                        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium mt-2 ${getNotificationTypeColor(notification.type)}`}>
                          {getNotificationIcon(notification.type)}
                          <span>{getNotificationTypeLabel(notification.type)}</span>
                        </div>
                      </div>

                      {/* Unread Indicator */}
                      {!notification.is_read && notification.type !== 'connection_request' && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0 animate-pulse"></div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
