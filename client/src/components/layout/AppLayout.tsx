import React from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useSearch } from "@/contexts/SearchContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { useGamification } from "@/contexts/GamificationContext";
import { NotificationDropdown } from "@/components/layout/NotificationDropdown";
import { socket } from "@/lib/socket";
import { useToast } from "@/hooks/use-toast";
import { Home, Calendar, MessageSquare, Settings, Bell, LogOut, Search, Briefcase, Users, User, ArrowLeft, MessagesSquare, ArrowUp, Trophy, Star, Sparkles, MapPin, Locate, Loader2, Globe, BookOpen, GraduationCap, Mic2, ChevronDown } from "lucide-react";
import { GamificationDrawer } from "@/components/GamificationDrawer";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CityAutocomplete } from "@/components/profile/CityAutocomplete";

interface AppLayoutProps {
  children: React.ReactNode;
  currentPage?: 'feed' | 'job-portal' | 'events' | 'connections' | 'inbox' | 'profile' | 'settings' | 'forums' | 'alumni-map' | 'blogs' | 'travel-chapters' | 'travel-chapters-detail' | 'mentorship' | 'podcast';
}

// Define user roles
type UserRole = 'alumni' | 'student' | 'faculty' | 'administrator';

export const AppLayout: React.FC<AppLayoutProps> = ({ children, currentPage = 'feed' }) => {
  const [location, setLocation] = useLocation();
  const { user, alumni, faculty, student, admin, logout, refreshAlumni, isLoading } = useAuth(); // Assuming these properties exist in useAuth
  const alumniAny = alumni as any;
  const { scores } = useGamification();
  const { setShowSearchModal } = useSearch();
  const { toast } = useToast();
  const { unreadCount, fetchNotifications } = useNotifications(); // Use NotificationContext as single source of truth
  const [showNotifications, setShowNotifications] = React.useState(false);
  const [showMobileMenu, setShowMobileMenu] = React.useState(false);
  const [unreadMessageCount, setUnreadMessageCount] = React.useState(0);
  const [showScrollToTop, setShowScrollToTop] = React.useState(false);
  const [showGamificationDrawer, setShowGamificationDrawer] = React.useState(false);
  const scrollableContainerRef = React.useRef<HTMLDivElement>(null);
  const [showProfileDropdown, setShowProfileDropdown] = React.useState(false);
  const profileDropdownRef = React.useRef<HTMLDivElement>(null);

  // Daily Location Prompt States
  const [showDailyLocationPrompt, setShowDailyLocationPrompt] = React.useState(false);
  const [localLocation, setLocalLocation] = React.useState({
    city: '',
    state: '',
    country: '',
    lat: null as number | null,
    lng: null as number | null,
    label: ''
  });
  const [isSubmittingLocation, setIsSubmittingLocation] = React.useState(false);
  const [locationSubmitError, setLocationSubmitError] = React.useState<string | null>(null);

  // Open gamification drawer from anywhere via custom event
  React.useEffect(() => {
    const handler = () => setShowGamificationDrawer(true);
    window.addEventListener('open-gamification-drawer', handler);
    return () => window.removeEventListener('open-gamification-drawer', handler);
  }, []);

  // Daily Location Check-in trigger logic
  React.useEffect(() => {
    // Only prompt alumni users, only on the Feed page, and only after auth loading completes
    if (isLoading || user?.user_role !== 'alumni' || currentPage !== 'feed' || !user?.id) {
      return;
    }

    const promptKey = `heatmap_location_prompted_${user.id}`;
    const hasBeenPrompted = localStorage.getItem(promptKey);

    // Check if user already has valid location coordinates saved in the database
    const hasLocation = alumniAny?.latitude !== null && alumniAny?.latitude !== undefined &&
                        alumniAny?.longitude !== null && alumniAny?.longitude !== undefined &&
                        String(alumniAny.latitude).trim() !== '' && String(alumniAny.longitude).trim() !== '';

    // Only prompt if they haven't been prompted on this browser AND they don't already have location coordinates in the DB
    if (!hasBeenPrompted) {
      if (hasLocation) {
        // If they already have coordinates in the DB, sync it to localStorage
        localStorage.setItem(promptKey, 'true');
      } else {
        if (alumniAny) {
          setLocalLocation({
            city: alumniAny.current_city || '',
            state: alumniAny.current_state || '',
            country: alumniAny.current_country || '',
            lat: alumniAny.latitude ? Number(alumniAny.latitude) : null,
            lng: alumniAny.longitude ? Number(alumniAny.longitude) : null,
            label: alumniAny.location_label || ''
          });
        }
        setShowDailyLocationPrompt(true);
      }
    }
  }, [user?.id, user?.user_role, currentPage, alumni, isLoading]);

  // Submit daily location to endpoint
  const handleSubmitLocation = async () => {
    if (!localLocation.city || !localLocation.country) {
      setLocationSubmitError("Please search and select a valid location.");
      return;
    }

    setIsSubmittingLocation(true);
    setLocationSubmitError(null);

    try {
      const response = await fetch('/api/profile/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-id': user?.id || '',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
        },
        body: JSON.stringify({
          firstName: alumni?.first_name || user?.username || '',
          lastName: alumni?.last_name || '',
          email: user?.email || '',
          phone: alumni?.phone || '',
          batch: alumni?.batch || '',
          gender: alumni?.gender || 'prefer_not_to_say',
          currentCity: localLocation.city,
          currentState: localLocation.state,
          currentCountry: localLocation.country,
          latitude: localLocation.lat,
          longitude: localLocation.lng,
          locationLabel: localLocation.label,
          location: [localLocation.city, localLocation.state, localLocation.country].filter(Boolean).join(', ') || localLocation.label,
        })
      });

      if (response.ok) {
        await refreshAlumni();

        const promptKey = `heatmap_location_prompted_${user?.id}`;
        localStorage.setItem(promptKey, 'true');

        setShowDailyLocationPrompt(false);
        toast({
          title: "Location Updated!",
          description: "Thank you! You will now appear on the Alumni Heatmap.",
          variant: "default",
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update location");
      }
    } catch (err: any) {
      console.error("Error updating check-in location:", err);
      setLocationSubmitError(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmittingLocation(false);
    }
  };


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
      // console.log('[AppLayout] Connecting socket for user:', user.id);
      // Connect to socket
      socket.auth = { token: user.id };
      socket.connect();

      // Listen for connection events
      socket.on('connect', () => {
        // console.log('[AppLayout] Socket connected, ID:', socket.id);
      });

      socket.on('connect_error', (error) => {
        console.error('[AppLayout] Socket connection error:', error);
      });

      // Listen for notifications
      const handleNotification = (data: any) => {
        // console.log('[AppLayout] Notification received:', data);
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
        // console.log('[AppLayout] Cleaning up socket listeners');
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

  // Close profile dropdown on outside click
  React.useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target as Node)) {
        setShowProfileDropdown(false);
      }
    };
    if (showProfileDropdown) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showProfileDropdown]);

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

  const navItems = [
    { id: 'feed', icon: Home, label: 'Feed', path: '/feed', section: 'main', roles: ['alumni', 'student', 'faculty', 'administrator'] },
    { id: 'connections', icon: Users, label: 'Connections', path: '/connections', section: 'main', roles: ['alumni', 'student', 'faculty'] },
    { id: 'inbox', icon: MessageSquare, label: 'Inbox', path: '/inbox', section: 'main', roles: ['alumni', 'student', 'faculty', 'administrator'] },
    { id: 'forums', icon: MessagesSquare, label: 'Forums', path: '/forums', section: 'main', roles: ['alumni', 'student', 'faculty', 'administrator'] },
    { id: 'events', icon: Calendar, label: 'Events', path: '/events', section: 'discover', roles: ['alumni', 'student', 'faculty', 'administrator'] },
    { id: 'job-portal', icon: Briefcase, label: 'Job Portal', path: '/job-portal', section: 'discover', roles: ['alumni', 'student', 'faculty'] },
    { id: 'mentorship', icon: GraduationCap, label: 'Mentorship', path: '/mentorship', section: 'discover', roles: ['alumni', 'faculty', 'administrator'] },
    { id: 'blogs', icon: BookOpen, label: 'Blogs', path: '/blogs', section: 'discover', roles: ['alumni', 'student', 'faculty', 'administrator'] },
    { id: 'alumni-map', icon: MapPin, label: 'Global Network', path: '/alumni-map', section: 'discover', roles: ['alumni', 'student', 'faculty', 'administrator'] },
    { id: 'travel-chapters', icon: Globe, label: 'Travel Chapters', path: '/travel-chapters', section: 'discover', roles: ['alumni', 'student', 'faculty', 'administrator'] },
    { id: 'podcast', icon: Mic2, label: 'Podcast', path: '/podcast', section: 'discover', roles: ['alumni', 'student', 'faculty', 'administrator'] },
  ];


  // Helper function to check if the user has at least one of the required roles
  const hasRole = (requiredRoles: UserRole[]): boolean => {
    if (!user) return false; // If no user is logged in, deny access
    if (!role) return false; // Fail closed until role is determined
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
      <div className={`${showMobileMenu ? 'flex' : 'hidden'} lg:flex w-full sm:w-80 lg:w-60 xl:w-72 bg-white flex-col border-r fixed h-full z-[110] lg:z-30`} style={{ borderColor: 'var(--border-subtle)' }}>
        {/* Logo */}
        <div className="px-3 py-3 shrink-0" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div
            className="flex items-center gap-2.5 cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => {
              setLocation('/');
              setShowMobileMenu(false);
            }}
          >
            <div className="relative w-7 h-7 flex-shrink-0">
              <div className="w-full h-full bg-white rounded-lg shadow-sm flex items-center justify-center overflow-hidden p-0.5 border" style={{ borderColor: 'var(--border-default)' }}>
                <img src="/tks_logo.png" alt="The Kalyani School Logo" className="w-full h-full object-contain" />
              </div>
            </div>
            <div className="min-w-0">
              <span className="font-bold text-xs block leading-tight truncate" style={{ color: 'var(--brand-primary)' }}>The Kalyani School</span>
              <span className="text-[9px] text-gray-400 font-medium uppercase tracking-widest">Alumni Network</span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {navItems
            .filter(item => hasRole(item.roles as UserRole[]) && item.section === 'main')
            .map((item) => (
              <Button
                key={item.id}
                variant="ghost"
                className={`w-full justify-start rounded-[10px] px-3 py-2 h-auto min-h-[38px] font-semibold transition-all duration-200 mb-0.5 relative ${(activePage === item.id || (activePage === 'travel-chapters-detail' && item.id === 'travel-chapters'))
                  ? "bg-[#e6f5f0] text-[#008060] hover:bg-[#d0ede4]"
                  : "text-gray-600 hover:bg-[#e6f5f0]/60 hover:text-[#008060]"
                  }`}
                onClick={() => {
                  setLocation(item.path);
                  setShowMobileMenu(false);
                }}
              >
                {(activePage === item.id || (activePage === 'travel-chapters-detail' && item.id === 'travel-chapters')) && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-[#008060]" />}
                <item.icon className={`mr-3 w-[18px] h-[18px] flex-shrink-0 ${(activePage === item.id || (activePage === 'travel-chapters-detail' && item.id === 'travel-chapters')) ? 'text-[#008060]' : 'text-gray-500'}`} />
                <span className="truncate text-sm">{item.label}</span>
                {item.id === 'inbox' && unreadMessageCount > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                  </span>
                )}
              </Button>
            ))}

          {/* Discover section */}
          <div className="mt-2 mb-1 border-t" style={{ borderColor: 'var(--border-subtle)' }} />
          {navItems
            .filter(item => hasRole(item.roles as UserRole[]) && item.section === 'discover')
            .map((item) => (
              <Button
                key={item.id}
                variant="ghost"
                className={`w-full justify-start rounded-[10px] px-3 py-2 h-auto min-h-[38px] font-semibold transition-all duration-200 mb-0.5 relative ${(activePage === item.id || (activePage === 'travel-chapters-detail' && item.id === 'travel-chapters'))
                  ? "bg-[#e6f5f0] text-[#008060] hover:bg-[#d0ede4]"
                  : "text-gray-600 hover:bg-[#e6f5f0]/60 hover:text-[#008060]"
                  }`}
                onClick={() => { setLocation(item.path); setShowMobileMenu(false); }}
              >
                {(activePage === item.id || (activePage === 'travel-chapters-detail' && item.id === 'travel-chapters')) && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-[#008060]" />}
                <item.icon className={`mr-3 w-[17px] h-[17px] flex-shrink-0 ${(activePage === item.id || (activePage === 'travel-chapters-detail' && item.id === 'travel-chapters')) ? 'text-[#008060]' : 'text-gray-500'}`} />
                <span className="truncate text-sm">{item.label}</span>
              </Button>
            ))}
        </nav>

      </div>

      {/* Main Content - Fixed Layout */}
      <div className="flex-1 flex flex-col lg:ml-60 xl:ml-72 min-h-screen overflow-x-hidden max-w-full">
        {/* Header - Fixed */}
        <div className="bg-white fixed top-0 right-0 left-0 lg:left-60 xl:left-72 z-[100] h-14 sm:h-16" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="h-full flex items-center justify-between gap-2 sm:gap-3 px-3 sm:px-4 lg:px-6">
            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden min-w-[40px] min-h-[40px] w-10 h-10 flex-shrink-0 rounded-lg text-gray-600"
              onClick={() => setShowMobileMenu(!showMobileMenu)}
            >
              <span className="text-lg leading-none">☰</span>
            </Button>

            {/* Search Bar */}
            <div className="flex-1 flex justify-center min-w-0">
              <div className="w-full max-w-sm lg:max-w-md xl:max-w-lg">
                <button
                  onClick={() => setShowSearchModal(true)}
                  className="w-full rounded-full px-4 py-2 text-sm text-left text-gray-500 hover:bg-[#e6f5f0]/70 transition-colors flex items-center justify-between min-h-[38px] gap-2 border"
                  style={{ background: 'var(--surface-subtle)', borderColor: 'var(--border-default)' }}
                  aria-label="Open search"
                >
                  <span className="flex items-center gap-2 truncate flex-1">
                    <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="truncate text-sm text-gray-400">Search alumni, posts, events…</span>
                  </span>
                  <kbd className="hidden md:inline-flex items-center px-1.5 py-0.5 bg-white rounded text-[10px] text-gray-400 flex-shrink-0 border font-mono" style={{ borderColor: 'var(--border-default)' }}>⌘K</kbd>
                </button>
              </div>
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              {/* Gamification Trophy */}
              {user && user.user_role === 'alumni' && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative min-w-[40px] min-h-[40px] w-10 h-10 p-0 rounded-full transition-colors text-amber-600 bg-amber-50 hover:bg-amber-100 border border-amber-200/60"
                  onClick={() => setShowGamificationDrawer(true)}
                  aria-label="Rewards & Gamification"
                >
                  <Trophy className="w-[18px] h-[18px] fill-amber-500/30" strokeWidth={1.5} />
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-bold text-white animate-pulse-scale">
                    {(scores?.total_points || 0) > 999 ? `${((scores?.total_points || 0) / 1000).toFixed(1).replace('.0', '')}k` : (scores?.total_points || 0)}
                  </span>
                </Button>
              )}

              {/* Notification Bell */}
              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`relative min-w-[40px] min-h-[40px] w-10 h-10 p-0 rounded-full transition-colors ${notificationCount > 0
                    ? "text-[#008060] bg-[#e6f5f0] hover:bg-[#d0ede4] border border-[#d4e4dc]"
                    : "text-gray-600 hover:text-[#008060] hover:bg-[#e6f5f0]"
                    }`}
                  onClick={() => setShowNotifications(!showNotifications)}
                  aria-label={`Notifications${notificationCount > 0 ? ` (${notificationCount} unread)` : ''}`}
                >
                  <Bell className="w-[18px] h-[18px]" strokeWidth={2} />
                  {notificationCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-red-500 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-bold text-white">
                      {notificationCount > 99 ? "99+" : notificationCount > 9 ? "9+" : notificationCount}
                    </span>
                  )}
                </Button>
                {showNotifications && <NotificationDropdown onClose={() => setShowNotifications(false)} />}
              </div>

              {/* Profile dropdown */}
              <div className="relative" ref={profileDropdownRef}>
                <button
                  onClick={() => setShowProfileDropdown(v => !v)}
                  className="flex items-center gap-2 hover:opacity-90 transition-opacity pl-1"
                  aria-label="Account menu"
                >
                  <Avatar className="w-8 h-8 ring-2 ring-[#d4e4dc] hover:ring-[#008060] transition-all flex-shrink-0">
                    <AvatarImage src={getProfilePicture()} alt={displayName} />
                    <AvatarFallback className="text-xs bg-[#008060] text-white">{getInitials(displayName)}</AvatarFallback>
                  </Avatar>
                  <div className="text-left hidden lg:block">
                    <p className="font-semibold text-gray-900 text-xs leading-tight truncate max-w-[100px]">{displayName}</p>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: 'var(--brand-primary-light)', color: 'var(--brand-primary)' }}>{roleLabel}</span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 hidden lg:block flex-shrink-0" />
                </button>

                {showProfileDropdown && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border z-[200] py-1.5 animate-in fade-in slide-in-from-top-2 duration-150" style={{ borderColor: 'var(--border-subtle)' }}>
                    {/* Identity card */}
                    <div className="px-4 py-3 flex items-center gap-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                      <Avatar className="w-10 h-10 ring-2 ring-[#d4e4dc] flex-shrink-0">
                        <AvatarImage src={getProfilePicture()} alt={displayName} />
                        <AvatarFallback className="text-sm bg-[#008060] text-white">{getInitials(displayName)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 text-sm leading-tight truncate">{displayName}</p>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-0.5 inline-block" style={{ background: 'var(--brand-primary-light)', color: 'var(--brand-primary)' }}>{roleLabel}</span>
                      </div>
                    </div>
                    {/* Links */}
                    <button
                      onClick={() => { setLocation('/profile'); setShowProfileDropdown(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-[#e6f5f0]/60 hover:text-[#008060] transition-colors"
                    >
                      <User className="w-4 h-4 flex-shrink-0" /> Profile
                    </button>
                    <button
                      onClick={() => { setLocation('/settings'); setShowProfileDropdown(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-[#e6f5f0]/60 hover:text-[#008060] transition-colors"
                    >
                      <Settings className="w-4 h-4 flex-shrink-0" /> Settings
                    </button>
                    <div className="border-t my-1" style={{ borderColor: 'var(--border-subtle)' }} />
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4 flex-shrink-0" /> Log out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Page Content - Scrollable with centered container for large screens */}
        <div id="app-main-scroll-container" data-scrollable-container ref={scrollableContainerRef} className={`flex-1 ${activePage === 'inbox' || activePage === 'travel-chapters-detail' ? 'overflow-hidden' : 'overflow-y-auto'} overflow-x-hidden mt-14 sm:mt-16 w-full max-w-full`}>
          <div className={`w-full mx-auto ${activePage === 'inbox' || activePage === 'travel-chapters-detail' ? 'h-full' : 'max-w-[1400px] xl:max-w-[1600px] 2xl:max-w-[1800px] px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8 lg:py-10'}`}>
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

      {/* Daily Location Check-in Popup */}
      <Dialog
        open={showDailyLocationPrompt}
        onOpenChange={() => { }}
      >
        <DialogContent
          className="max-w-md w-[90%] p-6 sm:p-8 rounded-2xl border-0 shadow-2xl bg-gradient-to-b from-white to-slate-50/55 [&>button]:hidden z-[250]"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader className="space-y-3 text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-2">
              <MapPin className="w-6 h-6 animate-bounce text-[#008060]" />
            </div>
            <DialogTitle className="text-2xl font-bold tracking-tight text-slate-800">
              Confirm Your Location
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              We've launched a new Global Alumni Heatmap! Please confirm or update your current location to appear on the map.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-6 space-y-6">
            {/* City Autocomplete Field */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Select Your Location
              </label>
              <CityAutocomplete
                city={localLocation.label || localLocation.city}
                onCityChange={(val) => setLocalLocation(prev => ({ ...prev, label: val }))}
                onLocationSelect={(city, state, country, lat, lng, label) => {
                  setLocalLocation({
                    city,
                    state,
                    country,
                    lat: lat || null,
                    lng: lng || null,
                    label: label || ''
                  });
                  setLocationSubmitError(null);
                }}
              />
            </div>

            {/* Selected Location Details */}
            {localLocation.city && (
              <div className="p-4 rounded-xl border border-slate-100 bg-white/80 shadow-inner space-y-1 animate-in fade-in slide-in-from-top-2 duration-300">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Current selection</span>
                <p className="font-semibold text-slate-800 text-sm">{localLocation.label || `${localLocation.city}, ${localLocation.country}`}</p>
                {localLocation.lat && (
                  <p className="text-[10px] text-slate-400">Coordinates: {localLocation.lat.toFixed(4)}, {localLocation.lng?.toFixed(4)}</p>
                )}
              </div>
            )}

            {locationSubmitError && (
              <div className="text-xs font-medium text-red-500 bg-red-50 border border-red-100 rounded-xl p-3 flex items-start gap-2">
                <span>⚠️</span>
                <span>{locationSubmitError}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                disabled={isSubmittingLocation || !localLocation.city}
                onClick={handleSubmitLocation}
                className="w-full py-3 px-4 bg-[#008060] hover:bg-[#006b51] text-white font-bold rounded-xl transition-all active:scale-95 duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:scale-100 text-sm flex items-center justify-center gap-2"
              >
                {isSubmittingLocation ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Location</span>
                )}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
