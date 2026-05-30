import React from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useSearch } from "@/contexts/SearchContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { NotificationDropdown } from "@/components/layout/NotificationDropdown";
import { socket } from "@/lib/socket";
import { useToast } from "@/hooks/use-toast";
import { Home, Calendar, MessageSquare, Settings, Bell, LogOut, Search, Briefcase, Users, User, ArrowLeft, MessagesSquare, ArrowUp, Trophy, Star } from "lucide-react";
import { GamificationDrawer } from "@/components/GamificationDrawer";

interface AppLayoutProps {
  children: React.ReactNode;
  currentPage?: 'feed' | 'job-portal' | 'events' | 'connections' | 'inbox' | 'profile' | 'settings' | 'forums';
}

// Define user roles
type UserRole = 'alumni' | 'student' | 'faculty' | 'administrator';

export const AppLayout: React.FC<AppLayoutProps> = ({ children, currentPage = 'feed' }) => {
  const [location, setLocation] = useLocation();
  const { user, alumni, faculty, student, admin, logout } = useAuth(); // Assuming these properties exist in useAuth
  const { setShowSearchModal } = useSearch();
  const { toast } = useToast();
  const { unreadCount, fetchNotifications } = useNotifications(); // Use NotificationContext as single source of truth
  const [showNotifications, setShowNotifications] = React.useState(false);
  const [showMobileMenu, setShowMobileMenu] = React.useState(false);
  const [unreadMessageCount, setUnreadMessageCount] = React.useState(0);
  const [showScrollToTop, setShowScrollToTop] = React.useState(false);
  const [showGamificationDrawer, setShowGamificationDrawer] = React.useState(false);
  const scrollableContainerRef = React.useRef<HTMLDivElement>(null);

  // Use unreadCount from context instead of separate state
  const notificationCount = unreadCount;

  // Fetch unread message count
  React.useEffect(() => {
    const fetchUnreadMessageCount = async () => {
      if (!user?.id) return;

      try {
        const response = await fetch('/api/messages/unread-count', {
          headers: {
            'user-id': user.id
          }
        });

        if (response.ok) {
          const data = await response.json();
          setUnreadMessageCount(data.count);
        }
      } catch (error) {
        console.error('Failed to fetch unread message count:', error);
      }
    };

    fetchUnreadMessageCount();

    // Poll every 10 seconds
    const interval = setInterval(fetchUnreadMessageCount, 10000);
    return () => clearInterval(interval);
  }, [user?.id]);

  // Sync notification count from context - smart polling only when needed
  React.useEffect(() => {
    if (!user?.id) return;

    // Don't fetch on mount - context handles initial fetch
    // This prevents duplicate fetches when AppLayout mounts

    // Listen for refresh events (only for manual refresh requests)
    const handleRefresh = () => {
      fetchNotifications(true); // Force fetch on manual refresh
    };
    window.addEventListener('refresh-notifications', handleRefresh);

    // Smart polling: Only poll every 90 seconds (increased to reduce load)
    // Context will handle debouncing and change detection
    const interval = setInterval(() => {
      // Let context decide if fetch is needed (it has debouncing built-in)
      fetchNotifications(false);
    }, 90000); // 90 seconds - context debouncing will prevent rapid calls

    return () => {
      clearInterval(interval);
      window.removeEventListener('refresh-notifications', handleRefresh);
    };
  }, [user?.id]); // Remove fetchNotifications from deps to prevent re-running

  // Handle Socket.IO connection and events
  React.useEffect(() => {
    if (user?.id) {
      console.log('[AppLayout] Connecting socket for user:', user.id);
      // Connect to socket
      socket.auth = { token: user.id };
      socket.connect();

      // Listen for connection events
      socket.on('connect', () => {
        console.log('[AppLayout] Socket connected, ID:', socket.id);
      });

      socket.on('connect_error', (error) => {
        console.error('[AppLayout] Socket connection error:', error);
      });

      // Listen for notifications
      const handleNotification = (data: any) => {
        console.log('[AppLayout] Notification received:', data);
        // Don't fetch - context will add notification directly via 'new-notification' event
        // This prevents duplicate API calls

        toast({
          title: data.title,
          description: data.content,
          duration: 5000,
        });
      };

      socket.on('notification', handleNotification);

      return () => {
        console.log('[AppLayout] Cleaning up socket listeners');
        socket.off('notification', handleNotification);
        socket.off('connect');
        socket.off('connect_error');
        socket.disconnect();
      };
    }
  }, [user?.id, toast]);

  // Handle scroll to show/hide scroll-to-top button
  React.useEffect(() => {
    const handleScroll = () => {
      // Check both window scroll and the main content scroll
      const scrollY = window.scrollY || window.pageYOffset;
      const contentScrollTop = scrollableContainerRef.current?.scrollTop || 0;

      // Show button when scrolled down more than 300px (either window or content)
      setShowScrollToTop(scrollY > 300 || contentScrollTop > 300);
    };

    // Listen to both window and content container scroll
    window.addEventListener('scroll', handleScroll, true);
    const contentContainer = scrollableContainerRef.current;
    if (contentContainer) {
      contentContainer.addEventListener('scroll', handleScroll);
    }

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      if (contentContainer) {
        contentContainer.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  // Scroll to top function
  const scrollToTop = () => {
    // Scroll the content container if it exists, otherwise scroll window
    if (scrollableContainerRef.current) {
      scrollableContainerRef.current.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    } else {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  };

  // Determine current page from URL if not provided
  const getCurrentPage = () => {
    if (currentPage !== 'feed') return currentPage;

    if (location.includes('/forums')) return 'forums';
    if (location.includes('/feed')) return 'feed';
    if (location.includes('/job-portal')) return 'job-portal';
    if (location.includes('/events')) return 'events';
    if (location.includes('/connections')) return 'connections';
    if (location.includes('/inbox')) return 'inbox';
    if (location.includes('/profile')) return 'profile';
    if (location.includes('/settings')) return 'settings';
    return 'feed';
  };

  const activePage = getCurrentPage();

  const displayName = alumni
    ? `${alumni.first_name || ''} ${alumni.last_name || ''}`.trim() || user?.username || 'User'
    : user?.username || 'User';

  const getProfilePicture = () => {
    if (alumni?.profile_picture && alumni.profile_picture.trim() !== '') {
      return alumni.profile_picture;
    }

    // Fallback to LinkedIn photo if manual profile picture is missing
    if (alumni?.linkedin_photo_url && alumni.linkedin_photo_url.trim() !== '') {
      return alumni.linkedin_photo_url;
    }

    const seed = encodeURIComponent(displayName);
    const gender = alumni?.gender;

    switch (gender) {
      case 'male':
        return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=008060`;
      case 'female':
        return `https://api.dicebear.com/7.x/avataaars-neutral/svg?seed=${seed}&backgroundColor=ff69b4`;
      case 'other':
        return `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}&backgroundColor=ffa500`;
      case 'prefer_not_to_say':
        return `https://api.dicebear.com/7.x/initials/svg?seed=${seed}&backgroundColor=6c63ff`;
      default:
        return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=008060`;
    }
  };

  const getUserRole = (): UserRole | null => {
    // Use the user's user_role field directly
    if (user?.user_role) {
      return user.user_role as UserRole;
    }
    // Fallback to checking individual role objects
    if (admin) return 'administrator';
    if (faculty) return 'faculty';
    if (student) return 'student';
    if (alumni) return 'alumni';
    return null;
  };

  const formatRole = (r: UserRole | string | null): string => {
    if (!r) return 'User';
    if (r === 'student') return 'Current Student';
    if (r === 'administrator') return 'Administrator';
    return r.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  };

  const role = getUserRole();
  const roleLabel = formatRole(role);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  // Define navigation items with their required roles
  const navItems = [
    { id: 'feed', icon: Home, label: 'Feed', path: '/feed', roles: ['alumni', 'student', 'faculty', 'administrator'] },
    { id: 'forums', icon: MessagesSquare, label: 'Forums', path: '/forums', roles: ['alumni', 'student', 'faculty', 'administrator'] },
    { id: 'job-portal', icon: Briefcase, label: 'Job Portal', path: '/job-portal', roles: ['alumni', 'student', 'faculty'] },
    { id: 'events', icon: Calendar, label: 'Events', path: '/events', roles: ['alumni', 'student', 'faculty', 'administrator'] },
    { id: 'connections', icon: Users, label: 'Connections', path: '/connections', roles: ['alumni', 'student', 'faculty'] },
    { id: 'leaderboard', icon: Trophy, label: 'Leaderboard', path: '/leaderboard', roles: ['alumni'] },
    { id: 'inbox', icon: MessageSquare, label: 'Inbox', path: '/inbox', roles: ['alumni', 'student', 'faculty', 'administrator'] },
  ];

  // Define bottom navigation items
  const bottomNavItems = [
    {
      icon: User,
      label: "Profile",
      path: "/profile",
      onClick: () => setLocation("/profile")
    },
    {
      icon: Settings,
      label: "Settings",
      path: "/settings",
      onClick: () => setLocation("/settings")
    }
  ];

  // Helper function to check if the user has at least one of the required roles
  const hasRole = (requiredRoles: UserRole[]): boolean => {
    if (!user) return false; // If no user is logged in, deny access
    if (!role) return true; // If role is not determined yet, show all items (fail open)
    return requiredRoles.includes(role as UserRole);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 w-full max-w-full">
      {/* Mobile Menu Overlay */}
      {/* z-[55] ensures overlay is above page content but below mobile menu (z-[60]) */}
      {showMobileMenu && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-[105] lg:hidden"
          onClick={() => setShowMobileMenu(false)}
        />
      )}

      {/* Left Sidebar - Fixed */}
      {/* z-[60] ensures mobile menu is above Save Changes overlay (z-50) */}
      <div className={`${showMobileMenu ? 'flex' : 'hidden'} lg:flex w-full sm:w-80 lg:w-60 xl:w-72 bg-white shadow-xl flex-col border-r border-gray-100 fixed h-full z-[110] lg:z-30`}>
        {/* Logo */}
        <div className="p-4 sm:p-6 border-b border-gray-100 shrink-0">
          <div
            className="flex items-center gap-2 sm:gap-3 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => {
              setLocation('/feed');
              setShowMobileMenu(false);
            }}
          >
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-[#008060] to-[#006b51] rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
              <span className="text-white text-xl sm:text-2xl font-bold">T</span>
            </div>
            <div className="min-w-0">
              <span className="font-bold text-[#008060] text-base sm:text-lg xl:text-xl block leading-tight truncate">The Kalyani School</span>
              <span className="text-[10px] sm:text-xs xl:text-sm text-gray-500 font-bold uppercase tracking-wider">Alumni Portal</span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        {/* pb-24 adds bottom padding to account for Save Changes overlay on mobile */}
        <nav className="flex-1 p-3 sm:p-4 pb-24 sm:pb-4 space-y-1 sm:space-y-2 overflow-y-auto">
          {navItems
            .filter(item => hasRole(item.roles as UserRole[]))
            .map((item) => (
              <Button
                key={item.id}
                variant={activePage === item.id ? "default" : "ghost"}
                className={`w-full justify-start rounded-xl px-4 py-3 sm:py-3 lg:py-3.5 xl:py-4 h-auto min-h-[44px] font-bold transition-all duration-300 ${activePage === item.id
                  ? "bg-gradient-to-r from-[#008060] to-[#006b51] text-white shadow-lg hover:shadow-xl hover:from-[#006b51] hover:to-[#005d47]"
                  : "text-gray-700 hover:bg-emerald-50 hover:text-[#008060]"
                  }`}
                onClick={() => {
                  setLocation(item.path);
                  setShowMobileMenu(false);
                }}
              >
                <item.icon className="mr-2 sm:mr-3 text-lg flex-shrink-0" />
                <span className="truncate">{item.label}</span>
                {item.id === 'inbox' && unreadMessageCount > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-sm">
                    {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                  </span>
                )}
              </Button>
            ))}
        </nav>

        {/* Bottom Navigation */}
        {/* pb-24 adds bottom padding on mobile to account for Save Changes overlay */}
        <div className="p-3 sm:p-4 pb-24 sm:pb-4 border-t border-gray-100 space-y-1 shrink-0">
          {bottomNavItems.map((item) => {
            const isActive = location.includes(item.path);
            return (
              <Button
                key={item.label}
                variant={isActive ? "default" : "ghost"}
                className={`w-full justify-start rounded-xl px-4 py-3 h-auto min-h-[44px] font-bold transition-all duration-300 ${isActive
                  ? "bg-gradient-to-r from-[#008060] to-[#006b51] text-white shadow-lg hover:shadow-xl hover:from-[#006b51] hover:to-[#005d47]"
                  : "text-gray-700 hover:bg-emerald-50 hover:text-[#008060]"
                  }`}
                onClick={() => {
                  item.onClick();
                  setShowMobileMenu(false);
                }}
              >
                <item.icon className="mr-2 sm:mr-3 text-lg flex-shrink-0" />
                <span className="truncate">{item.label}</span>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Main Content - Fixed Layout */}
      <div className="flex-1 flex flex-col lg:ml-60 xl:ml-72 min-h-screen overflow-x-hidden max-w-full">
        {/* Header - Fixed */}
        <div className="bg-white border-b border-gray-100 p-2 sm:p-3 md:p-4 lg:p-5 xl:p-6 fixed top-0 right-0 left-0 lg:left-60 xl:left-72 z-[100]">
          <div className="flex items-center justify-between gap-1.5 sm:gap-2 md:gap-3 lg:gap-4">
            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden mr-1 min-w-[44px] min-h-[44px] flex-shrink-0"
              onClick={() => setShowMobileMenu(!showMobileMenu)}
            >
              <span className="text-xl">☰</span>
            </Button>

            {/* Back Button - Show on all pages except feed */}


            <div className="flex-1 flex justify-center min-w-0 max-w-full">
              <div className="w-full max-w-md lg:max-w-lg xl:max-w-xl">
                <button
                  onClick={() => setShowSearchModal(true)}
                  className="w-full bg-gray-50 border-0 rounded-full px-3 sm:px-4 md:px-6 lg:px-8 xl:px-10 py-2 sm:py-2.5 md:py-3 text-xs sm:text-sm text-left text-gray-500 hover:bg-gray-100 transition-colors flex items-center justify-between min-h-[44px] gap-2"
                  aria-label="Open search"
                >
                  <span className="flex items-center gap-1.5 sm:gap-2 truncate min-w-0 flex-1">
                    <Search className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0" />
                    <span className="truncate text-xs sm:text-sm">Search...</span>
                  </span>
                  <kbd className="hidden md:inline-flex items-center px-2 py-1 bg-white rounded text-[10px] sm:text-xs text-gray-500 flex-shrink-0 border border-gray-200 font-mono">⌘K</kbd>
                </button>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 lg:gap-3 flex-shrink-0">
              {/* Gamification Trophy Button */}
              {user && user.user_role === 'alumni' && (
                <Button
                  variant="ghost"
                  className="relative flex items-center justify-center min-w-[44px] min-h-[44px] w-[44px] h-[44px] p-0 rounded-full transition-all duration-300 bg-amber-50 hover:bg-amber-100 hover:scale-105 border border-amber-200 shadow-sm group mr-1 sm:mr-2"
                  onClick={() => setShowGamificationDrawer(true)}
                  aria-label="Rewards & Gamification"
                >
                  <Star className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500 fill-amber-500 drop-shadow-sm animate-[spin_4s_linear_infinite]" strokeWidth={1.5} />
                  {/* Notification dot */}
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white animate-bounce shadow-sm"></span>
                </Button>
              )}

              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`relative min-w-[44px] min-h-[44px] w-[44px] h-[44px] p-0 rounded-full transition-colors ${notificationCount > 0
                    ? "text-[#008060] hover:bg-[#008060]/10 hover:text-[#006b51] ring-2 ring-[#008060]/30"
                    : "text-gray-600 hover:text-[#008060] hover:bg-gray-100"
                    }`}
                  onClick={() => setShowNotifications(!showNotifications)}
                  aria-label={`Notifications${notificationCount > 0 ? ` (${notificationCount} unread)` : ''}`}
                >
                  <Bell className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2} />
                  {notificationCount > 0 && (
                    <span className="absolute -top-0.5 right-0 sm:top-0 sm:right-1 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white animate-pulse">
                      {notificationCount > 99 ? "99+" : notificationCount > 9 ? "9+" : notificationCount}
                    </span>
                  )}
                </Button>

                {showNotifications && <NotificationDropdown onClose={() => setShowNotifications(false)} />}
              </div>
              <div className="hidden md:flex items-center gap-2 sm:gap-3">
                <div className="text-right">
                  <p className="font-semibold text-gray-900 text-xs sm:text-sm truncate max-w-[120px] lg:max-w-none">{displayName}</p>
                  <span className="text-xs text-gray-500 capitalize">{roleLabel}</span>
                </div>
                <button onClick={() => setLocation("/profile")}>
                  <Avatar className="w-9 h-9 sm:w-10 sm:h-10 hover:ring-2 hover:ring-[#008060] transition-all flex-shrink-0">
                    <AvatarImage src={getProfilePicture()} alt={displayName} />
                    <AvatarFallback className="text-xs sm:text-sm bg-[#008060] text-white">{getInitials(displayName)}</AvatarFallback>
                  </Avatar>
                </button>
              </div>
              {user && (
                <Button
                  variant="outline"
                  className="text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-all duration-200 px-2 sm:px-3 lg:px-4 py-1.5 sm:py-2 text-xs sm:text-sm min-h-[44px]"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-0 sm:mr-2 text-base" />
                  <span className="hidden sm:inline">Log Out</span>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Page Content - Scrollable with centered container for large screens */}
        <div id="app-main-scroll-container" data-scrollable-container ref={scrollableContainerRef} className={`flex-1 ${activePage === 'inbox' ? 'overflow-hidden' : 'overflow-y-auto'} overflow-x-hidden mt-[60px] sm:mt-[68px] lg:mt-[96px] w-full max-w-full`}>
          <div className={`w-full mx-auto ${activePage === 'inbox' ? 'h-full' : 'max-w-[1400px] xl:max-w-[1600px] 2xl:max-w-[1800px] px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8 lg:py-10'}`}>
            {children}
          </div>
        </div>
      </div>

      {/* Scroll to Top Button - Visible on all pages */}
      {/* z-[45] ensures it's above sticky footers (z-40/z-50) but below modals (z-50), dropdowns (z-[60]), and profile modals (z-[150]) */}
      {showScrollToTop && (
        <Button
          onClick={scrollToTop}
          className="fixed bottom-24 sm:bottom-6 right-4 sm:right-6 w-12 h-12 rounded-full bg-[#008060] hover:bg-[#006b51] text-white shadow-lg hover:shadow-xl transition-all duration-300 z-[45] p-0 flex items-center justify-center"
          style={{
            right: 'max(1rem, calc(1rem + env(safe-area-inset-right)))'
          }}
          aria-label="Scroll to top"
        >
          <ArrowUp className="w-5 h-5" />
        </Button>
      )}

      {/* Gamification Drawer */}
      <GamificationDrawer
        isOpen={showGamificationDrawer}
        onClose={() => setShowGamificationDrawer(false)}
      />
    </div>
  );
};
