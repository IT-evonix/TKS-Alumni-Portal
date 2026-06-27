import React, { useEffect, useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { formatDistanceToNow, format, startOfDay, isToday, isYesterday, isThisWeek, isThisMonth } from "date-fns";
import { Bell, Archive, ArchiveRestore, Trash2, Search, Filter, Calendar, Clock, MessageSquare, UserPlus, ThumbsUp, MessageCircle, Briefcase, CheckCircle, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppLayout } from "@/components/layout/AppLayout";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  EnhancedNotification,
  getActorAvatar,
  getNotificationTypeLabel,
  getNotificationTypeColor,
} from "@/utils/notificationUtils";

type FilterType = 'all' | 'unread' | 'archived' | 'unarchived';

interface NotificationGroup {
  date: string;
  label: string;
  notifications: EnhancedNotification[];
}

export const NotificationHistoryPage: React.FC = () => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<EnhancedNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('');
  const observerTarget = useRef<HTMLDivElement>(null);
  const LIMIT = 20;

  useEffect(() => {
    if (user?.id) {
      loadNotifications(true);
    }
  }, [user?.id, activeFilter, selectedType]);

  const loadNotifications = async (reset: boolean = false) => {
    if (!user?.id) return;

    const currentOffset = reset ? 0 : offset;
    setLoading(true);

    try {
      const params = new URLSearchParams({
        limit: LIMIT.toString(),
        offset: currentOffset.toString(),
        ...(activeFilter === 'archived' && { filter: 'archived' }),
        ...(activeFilter === 'unarchived' && { filter: 'unarchived' }),
        ...(selectedType && { type: selectedType }),
        ...(searchQuery && { search: searchQuery }),
      });

      const response = await fetch(`/api/notifications/history?${params}`, {
        headers: {
          'user-id': user.id,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }

      const data = await response.json();
      const newNotifications = data.notifications || [];

      if (reset) {
        setNotifications(newNotifications);
        setOffset(LIMIT);
      } else {
        setNotifications(prev => [...prev, ...newNotifications]);
        setOffset(prev => prev + LIMIT);
      }

      setHasMore(newNotifications.length === LIMIT);
    } catch (error) {
      console.error('Error loading notifications:', error);
      toast({
        title: "Error",
        description: "Failed to load notifications",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadNotifications(false);
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, loading, offset]);

  // Search handler
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setOffset(0);
    setTimeout(() => loadNotifications(true), 300); // Debounce
  }, [activeFilter, selectedType]);

  // Group notifications by date
  const groupedNotifications = React.useMemo(() => {
    const groups: NotificationGroup[] = [];
    let currentGroup: NotificationGroup | null = null;

    notifications.forEach(notification => {
      const date = new Date(notification.created_at);
      const dateKey = format(startOfDay(date), 'yyyy-MM-dd');
      
      let label = '';
      if (isToday(date)) {
        label = 'Today';
      } else if (isYesterday(date)) {
        label = 'Yesterday';
      } else if (isThisWeek(date)) {
        label = format(date, 'EEEE'); // Day name
      } else if (isThisMonth(date)) {
        label = format(date, 'MMMM d'); // Month day
      } else {
        label = format(date, 'MMMM d, yyyy'); // Full date
      }

      if (!currentGroup || currentGroup.date !== dateKey) {
        currentGroup = {
          date: dateKey,
          label,
          notifications: [],
        };
        groups.push(currentGroup);
      }

      currentGroup.notifications.push(notification);
    });

    return groups;
  }, [notifications]);

  const handleArchive = async (id: string) => {
    if (!user?.id) return;

    try {
      const response = await fetch(`/api/notifications/${id}/archive`, {
        method: 'POST',
        headers: { 'user-id': user.id },
      });

      if (response.ok) {
        setNotifications(prev => prev.filter(n => n.id !== id));
        toast({
          title: "Archived",
          description: "Notification archived",
        });
      }
    } catch (error) {
      console.error('Error archiving:', error);
    }
  };

  const handleUnarchive = async (id: string) => {
    if (!user?.id) return;

    try {
      const response = await fetch(`/api/notifications/${id}/unarchive`, {
        method: 'POST',
        headers: { 'user-id': user.id },
      });

      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => (n.id === id ? { ...n, is_archived: false } : n))
        );
        toast({
          title: "Unarchived",
          description: "Notification restored",
        });
      }
    } catch (error) {
      console.error('Error unarchiving:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user?.id) return;

    try {
      const response = await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
        headers: { 'user-id': user.id },
      });

      if (response.ok) {
        setNotifications(prev => prev.filter(n => n.id !== id));
        toast({
          title: "Deleted",
          description: "Notification deleted",
        });
      }
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  const handleNotificationClick = (notification: EnhancedNotification) => {
    let redirectUrl = notification.redirect_url || '/feed';
    const relatedId = notification.related_id;

    switch (notification.type) {
      case 'connection_request':
        redirectUrl = '/connections?tab=received';
        break;
      case 'connection_response':
        if (relatedId) {
          redirectUrl = `/connections?userId=${relatedId}`;
          sessionStorage.setItem('highlightUserId', relatedId);
        } else {
          redirectUrl = '/connections';
        }
        break;
      case 'post_like':
      case 'post_comment':
      case 'comment_reply':
        if (relatedId) {
          sessionStorage.setItem('scrollToPostId', relatedId);
          redirectUrl = `/feed#post-${relatedId}`;
        }
        break;
      case 'message': {
        const actorId = notification.actor_id || relatedId;
        if (actorId) {
          redirectUrl = `/inbox?user=${actorId}`;
          sessionStorage.setItem('openConversationId', actorId);
        } else {
          redirectUrl = '/inbox';
        }
        break;
      }
      case 'event_rsvp':
      case 'event_reminder_24h':
      case 'event_reminder_1h':
        if (relatedId) {
          redirectUrl = `/events?eventId=${relatedId}`;
          sessionStorage.setItem('scrollToEventId', relatedId);
        } else {
          redirectUrl = '/events';
        }
        break;
      case 'job':
        if (relatedId) {
          redirectUrl = `/job-portal?jobId=${relatedId}`;
          sessionStorage.setItem('scrollToJobId', relatedId);
        } else {
          redirectUrl = '/job-portal';
        }
        break;
      case 'post_pending_approval':
        redirectUrl = '/admin/travel-chapters?tab=pending';
        break;
      case 'signup_request':
        redirectUrl = '/admin/users';
        break;
      case 'signup_approved':
        redirectUrl = '/profile';
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
    }

    setLocation(redirectUrl);
  };

  return (
    <AppLayout currentPage="notifications">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="mb-6">
<p className="text-sm sm:text-base text-gray-600">View and manage all your notifications</p>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Filter Tabs */}
          <div className="flex flex-wrap gap-2">
            {(['all', 'unread', 'archived', 'unarchived'] as FilterType[]).map((filter) => (
              <button
                key={filter}
                onClick={() => {
                  setActiveFilter(filter);
                  setOffset(0);
                  loadNotifications(true);
                }}
                className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                  activeFilter === filter
                    ? 'bg-[#008060] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {filter === 'all' ? 'All' : filter === 'unread' ? 'Unread' : filter === 'archived' ? 'Archived' : 'Active'}
              </button>
            ))}
          </div>
        </div>

        {/* Notifications List */}
        {loading && notifications.length === 0 ? (
          <div className="flex items-center justify-center p-12">
            <div className="w-8 h-8 border-4 border-[#008060]/30 border-t-[#008060] rounded-full animate-spin"></div>
          </div>
        ) : groupedNotifications.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600">No notifications found</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedNotifications.map((group) => (
              <div key={group.date}>
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    {group.label}
                  </h2>
                </div>

                <div className="space-y-2">
                  {group.notifications.map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition-all cursor-pointer ${
                        !notification.is_read ? 'bg-blue-50/50 border-blue-200' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        {notification.actor && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setLocation(`/profile/${notification.actor_id}`);
                            }}
                            className="flex-shrink-0"
                          >
                            <Avatar className="w-10 h-10 ring-2 ring-offset-2 ring-gray-200 hover:ring-[#008060] transition-all">
                              <AvatarImage src={getActorAvatar(notification.actor)} alt={notification.actor.fullName} />
                              <AvatarFallback className="bg-[#008060]/10 text-[#008060] text-xs font-semibold">
                                {notification.actor.fullName
                                  .split(' ')
                                  .map(n => n[0])
                                  .join('')
                                  .toUpperCase()
                                  .slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                          </button>
                        )}

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className={`text-sm font-medium ${!notification.is_read ? 'font-semibold' : ''}`}>
                                {notification.title}
                              </p>
                              <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                {notification.content}
                              </p>
                              <div className="flex items-center gap-3 mt-2">
                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                  <Clock className="w-3 h-3" />
                                  {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                                </div>
                                <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${getNotificationTypeColor(notification.type)}`}>
                                  {(() => {
                                    const iconClass = "w-3 h-3";
                                    switch (notification.type) {
                                      case 'message': return <MessageSquare className={iconClass} />;
                                      case 'connection_request':
                                      case 'connection_response': return <UserPlus className={iconClass} />;
                                      case 'post_like': return <ThumbsUp className={iconClass} />;
                                      case 'post_comment':
                                      case 'comment_reply': return <MessageCircle className={iconClass} />;
                                      case 'event_rsvp':
                                      case 'event_reminder_24h':
                                      case 'event_reminder_1h': return <Calendar className={iconClass} />;
                                      case 'job': return <Briefcase className={iconClass} />;
                                      case 'signup_approved':
                                      case 'post_approved': return <CheckCircle className={iconClass} />;
                                      case 'post_rejected':
                                      case 'post_deleted': return <X className={iconClass} />;
                                      case 'post_pending_approval':
                                      case 'signup_request':
                                      case 'new_blog': return <Bell className={iconClass} />;
                                      case 'mentorship_request':
                                      case 'mentorship_response':
                                      case 'session_scheduled':
                                      case 'session_cancelled': return <UserPlus className={iconClass} />;
                                      case 'badge_earned':
                                      case 'badge_lost': return <CheckCircle className={iconClass} />;
                                      case 'new_podcast': return <MessageSquare className={iconClass} />;
                                      default: return <Bell className={iconClass} />;
                                    }
                                  })()}
                                  {getNotificationTypeLabel(notification.type)}
                                </div>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1">
                              {notification.is_archived ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUnarchive(notification.id);
                                  }}
                                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                                  title="Unarchive"
                                >
                                  <ArchiveRestore className="w-4 h-4 text-gray-500" />
                                </button>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleArchive(notification.id);
                                  }}
                                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                                  title="Archive"
                                >
                                  <Archive className="w-4 h-4 text-gray-500" />
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(notification.id);
                                }}
                                className="p-2 hover:bg-red-50 rounded-full transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4 text-gray-500 hover:text-red-500" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Unread Indicator */}
                        {!notification.is_read && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2"></div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Infinite Scroll Trigger */}
            {hasMore && (
              <div ref={observerTarget} className="flex items-center justify-center p-8">
                {loading ? (
                  <div className="w-8 h-8 border-4 border-[#008060]/30 border-t-[#008060] rounded-full animate-spin"></div>
                ) : (
                  <p className="text-sm text-gray-500">Loading more...</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
};
