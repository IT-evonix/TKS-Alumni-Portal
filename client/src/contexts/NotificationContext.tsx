import React, { createContext, useContext } from 'react';
import { useAuth } from './AuthContext';

interface Notification {
  id: string;
  type: string;
  title: string;
  content: string;
  relatedId?: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  deleteAllNotifications: () => Promise<void>;
  fetchNotifications: (force?: boolean) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user, adminUser } = useAuth();
  const activeUser = adminUser || user;
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  // Use refs to avoid recreating callbacks and causing re-renders
  const lastFetchTimestampRef = React.useRef<number>(0);
  const isFetchingRef = React.useRef<boolean>(false);
  const fetchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const pendingFetchRef = React.useRef<boolean>(false);
  const activeFetchAbortControllerRef = React.useRef<AbortController | null>(null);
  const hasInitialFetchedRef = React.useRef<boolean>(false);
  const activeUserIdRef = React.useRef<string | null>(null);

  // Helper to detect if notifications actually changed
  const hasNotificationsChanged = React.useCallback((oldNotifications: Notification[], newNotifications: Notification[]): boolean => {
    // Quick check: different lengths
    if (oldNotifications.length !== newNotifications.length) {
      return true;
    }

    // Check if any notification IDs changed
    const oldIds = new Set(oldNotifications.map(n => n.id));
    const newIds = new Set(newNotifications.map(n => n.id));
    
    if (oldIds.size !== newIds.size) {
      return true;
    }

    for (const id of oldIds) {
      if (!newIds.has(id)) {
        return true;
      }
    }

    // Check if read status changed for any notification
    const oldMap = new Map(oldNotifications.map(n => [n.id, n.isRead]));
    for (const notification of newNotifications) {
      if (oldMap.get(notification.id) !== notification.isRead) {
        return true;
      }
    }

    return false;
  }, []);

  // Smart fetch with change detection - only fetches if needed
  const fetchNotifications = React.useCallback(async (force: boolean = false) => {
    if (!activeUser) return;
    
    const now = Date.now();
    
    // Prevent concurrent fetches
    if (isFetchingRef.current && !force) {
      pendingFetchRef.current = true;
      return;
    }

    // Debounce: Don't fetch if called within last 3 seconds (unless forced)
    // Increased from 2s to 3s to prevent rapid successive calls
    if (!force && now - lastFetchTimestampRef.current < 3000) {
      // Cancel any existing timeout and schedule a new one
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      const timeSinceLastFetch = now - lastFetchTimestampRef.current;
      const remainingTime = 3000 - timeSinceLastFetch;
      
      fetchTimeoutRef.current = setTimeout(() => {
        fetchNotifications(true);
      }, remainingTime);
      return;
    }

    // Cancel any pending timeout
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
      fetchTimeoutRef.current = null;
    }

    // Abort any ongoing fetch
    if (activeFetchAbortControllerRef.current) {
      activeFetchAbortControllerRef.current.abort();
    }

    // Create new abort controller for this fetch
    const abortController = new AbortController();
    activeFetchAbortControllerRef.current = abortController;
    
    isFetchingRef.current = true;
    pendingFetchRef.current = false;

    try {
      // Add timestamp query to help with caching
      const response = await fetch(`/api/notifications?t=${now}`, {
        headers: {
          'user-id': activeUser.id
        },
        signal: abortController.signal
      });

      // Check if request was aborted
      if (abortController.signal.aborted) {
        return;
      }

      if (response.ok) {
        const data = await response.json();
        const newNotifications = data.notifications || [];
        
        // Change detection: Compare with current notifications
        // Use functional update to get latest notifications state
        setNotifications(currentNotifications => {
          const hasChanged = force || hasNotificationsChanged(currentNotifications, newNotifications);
          
          if (hasChanged) {
            lastFetchTimestampRef.current = now;
            return newNotifications;
          }
          
          return currentNotifications; // No change, keep current
        });
      }
    } catch (error: any) {
      // Don't log aborted requests
      if (error.name !== 'AbortError') {
        console.error('Failed to fetch notifications:', error);
      }
    } finally {
      // Only clear if this is still the active fetch
      if (activeFetchAbortControllerRef.current === abortController) {
        activeFetchAbortControllerRef.current = null;
      }
      isFetchingRef.current = false;
      
      // If there was a pending fetch, execute it after a short delay
      if (pendingFetchRef.current) {
        pendingFetchRef.current = false;
        // Use a small delay to prevent immediate re-fetch
        setTimeout(() => {
          fetchNotifications(true);
        }, 500);
      }
    }
  }, [activeUser?.id, hasNotificationsChanged]); // Only depend on activeUser.id, not the whole object

  React.useEffect(() => {
    if (activeUser?.id) {
      const userId = activeUser.id;
      
      // Reset if user changed
      if (activeUserIdRef.current !== userId) {
        hasInitialFetchedRef.current = false;
        activeUserIdRef.current = userId;
        // Clear any pending fetches for previous user
        if (fetchTimeoutRef.current) {
          clearTimeout(fetchTimeoutRef.current);
          fetchTimeoutRef.current = null;
        }
        if (activeFetchAbortControllerRef.current) {
          activeFetchAbortControllerRef.current.abort();
          activeFetchAbortControllerRef.current = null;
        }
      }
      
      // Initial fetch only once per user
      if (!hasInitialFetchedRef.current) {
        hasInitialFetchedRef.current = true;
        // Use a small delay to batch with other initializations
        setTimeout(() => {
          fetchNotifications(true);
        }, 100);
      }
      
      // Listen for notifications from the main Socket.IO connection in App.tsx
      const handleNewNotification = ((event: CustomEvent) => {
        const notification = event.detail;
        // Add notification directly to state (no need to fetch)
        setNotifications(prev => {
          // Check if notification already exists (prevent duplicates)
          const exists = prev.some(n => n.id === notification.id);
          if (exists) return prev;
          return [notification, ...prev];
        });
        // Update timestamp to prevent immediate refetch
        lastFetchTimestampRef.current = Date.now();
      }) as EventListener;

      window.addEventListener('new-notification', handleNewNotification);

      return () => {
        window.removeEventListener('new-notification', handleNewNotification);
        if (fetchTimeoutRef.current) {
          clearTimeout(fetchTimeoutRef.current);
          fetchTimeoutRef.current = null;
        }
        // Abort any ongoing fetch
        if (activeFetchAbortControllerRef.current) {
          activeFetchAbortControllerRef.current.abort();
          activeFetchAbortControllerRef.current = null;
        }
      };
    } else {
      // User logged out - reset state
      hasInitialFetchedRef.current = false;
      activeUserIdRef.current = null;
      setNotifications([]);
    }
  }, [activeUser?.id, fetchNotifications]); // Keep fetchNotifications for the callback

  const markAsRead = async (id: string) => {
    if (!activeUser) return;

    // Optimistic update - immediately update UI
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, isRead: true } : n)
    );

    try {
      const response = await fetch(`/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: {
          'user-id': activeUser.id
        }
      });

      if (!response.ok) {
        // Revert on error and fetch to sync
        setNotifications(prev =>
          prev.map(n => n.id === id ? { ...n, isRead: false } : n)
        );
        await fetchNotifications(true); // Force fetch on error
        throw new Error('Failed to mark as read');
      }
      // No need to fetch - optimistic update is sufficient
      // Only fetch on error to ensure sync
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      // Only fetch on error to ensure sync
      await fetchNotifications(true);
    }
  };

  const markAllAsRead = async () => {
    if (!activeUser) return;

    // Optimistic update - immediately update UI
    setNotifications(prev =>
      prev.map(n => ({ ...n, isRead: true }))
    );

    try {
      const response = await fetch('/api/notifications/read-all', {
        method: 'PUT',
        headers: {
          'user-id': activeUser.id
        }
      });

      if (!response.ok) {
        // Revert on error - fetch to sync
        await fetchNotifications(true);
        throw new Error('Failed to mark all as read');
      }
      // No need to fetch - optimistic update is sufficient
      // Only fetch on error to ensure sync
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      // Only fetch on error to ensure sync
      await fetchNotifications(true);
    }
  };

  const deleteNotification = async (id: string) => {
    if (!activeUser) return;

    // Store the notification in case we need to revert
    const deletedNotification = notifications.find(n => n.id === id);

    // Optimistic update - immediately remove from UI
    setNotifications(prev => prev.filter(n => n.id !== id));

    try {
      const response = await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
        headers: {
          'user-id': activeUser.id
        }
      });

      if (!response.ok) {
        // Revert on error - restore notification
        if (deletedNotification) {
          setNotifications(prev => [...prev, deletedNotification].sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          ));
        }
        await fetchNotifications(true); // Force fetch on error
        throw new Error('Failed to delete notification');
      }
      // No need to fetch - optimistic update is sufficient
      // Only fetch on error to ensure sync
    } catch (error) {
      console.error('Failed to delete notification:', error);
      // Only fetch on error to ensure sync
      await fetchNotifications(true);
    }
  };

  const deleteAllNotifications = async () => {
    if (!activeUser) return;

    // Store notifications in case we need to revert
    const previousNotifications = [...notifications];

    // Optimistic update - immediately clear UI
    setNotifications([]);

    try {
      const response = await fetch('/api/notifications', {
        method: 'DELETE',
        headers: {
          'user-id': activeUser.id
        }
      });

      if (!response.ok) {
        // Revert on error - restore notifications
        setNotifications(previousNotifications);
        await fetchNotifications(true); // Force fetch on error
        throw new Error('Failed to clear notifications');
      }
      // No need to fetch - optimistic update is sufficient
      // Only fetch on error to ensure sync
    } catch (error) {
      console.error('Failed to clear notifications:', error);
      // Only fetch on error to ensure sync
      await fetchNotifications(true);
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        deleteAllNotifications,
        fetchNotifications
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};