import React from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Users, Calendar, MessageSquare, FileText, Upload, Briefcase, TrendingUp, ChevronRight, Mail, Inbox, Trophy, MapPin, Globe, BookOpen } from "lucide-react";

interface AdminSidebarProps {
  currentPage: 'dashboard' | 'feed' | 'events' | 'jobs' | 'messages' | 'analytics' | 'users' | 'bulk-email' | 'import' | 'inbox' | 'gamification' | 'location-export' | 'travel-chapters' | 'blogs';
  showMobileMenu?: boolean;
  onCloseMobileMenu?: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  currentPage,
  showMobileMenu = false,
  onCloseMobileMenu
}) => {
  const [, setLocation] = useLocation();

  const navItems = [
    {
      icon: LayoutDashboard,
      label: "Dashboard",
      path: "/admin/dashboard",
      key: "dashboard",
      color: "text-blue-600",
      bgColor: "bg-blue-50"
    },
    {
      icon: TrendingUp,
      label: "Analytics",
      path: "/admin/analytics",
      key: "analytics",
      color: "text-purple-600",
      bgColor: "bg-purple-50"
    },
    {
      icon: Trophy,
      label: "Gamification",
      path: "/admin/gamification",
      key: "gamification",
      color: "text-amber-600",
      bgColor: "bg-amber-50"
    },
    {
      icon: Users,
      label: "Users",
      path: "/admin/users",
      key: "users",
      color: "text-indigo-600",
      bgColor: "bg-indigo-50"
    },
    {
      icon: BookOpen,
      label: "Blogs",
      path: "/admin/blogs",
      key: "blogs",
      color: "text-violet-600",
      bgColor: "bg-violet-50"
    },
    {
      icon: FileText,
      label: "Feed",
      path: "/admin/feed",
      key: "feed",
      color: "text-emerald-600",
      bgColor: "bg-emerald-50"
    },
    {
      icon: Calendar,
      label: "Events",
      path: "/admin/events",
      key: "events",
      color: "text-orange-600",
      bgColor: "bg-orange-50"
    },
    {
      icon: Briefcase,
      label: "Jobs",
      path: "/admin/jobs",
      key: "jobs",
      color: "text-rose-600",
      bgColor: "bg-rose-50"
    },
    {
      icon: Inbox,
      label: "Inbox",
      path: "/admin/inbox",
      key: "inbox",
      color: "text-teal-600",
      bgColor: "bg-teal-50"
    },
    {
      icon: MessageSquare,
      label: "All Messages",
      path: "/admin/messages",
      key: "messages",
      color: "text-cyan-600",
      bgColor: "bg-cyan-50"
    },
    {
      icon: Mail,
      label: "Bulk Email",
      path: "/admin/bulk-email",
      key: "bulk-email",
      color: "text-blue-600",
      bgColor: "bg-blue-50"
    },
    {
      icon: Upload,
      label: "Import Data",
      path: "/admin/import",
      key: "import",
      color: "text-green-600",
      bgColor: "bg-green-50"
    },
    {
      icon: MapPin,
      label: "Location Export",
      path: "/admin/location-export",
      key: "location-export",
      color: "text-indigo-600",
      bgColor: "bg-indigo-50"
    },
    {
      icon: Globe,
      label: "Travel Chapters",
      path: "/admin/travel-chapters",
      key: "travel-chapters",
      color: "text-emerald-600",
      bgColor: "bg-emerald-50"
    },
  ];

  const handleNavigation = (path: string) => {
    setLocation(path);
    if (onCloseMobileMenu) {
      onCloseMobileMenu();
    }
  };

  return (
    <div className={`${showMobileMenu ? 'flex' : 'hidden'} lg:flex w-full sm:w-80 lg:w-64 xl:w-80 bg-white shadow-xl flex-col border-r border-gray-200 fixed lg:sticky lg:top-0 lg:h-screen z-50`}>
      {/* Logo Section */}
      <div className="p-6 border-b border-gray-200 bg-white">
        <div
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => handleNavigation("/")}
        >
          <div className="relative flex-shrink-0">
            {/* Logo */}
            <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden shadow-md group-hover:shadow-lg transition-all duration-300 bg-white">
              <img
                src="/tks_logo.png"
                alt="The Kalyani School Logo"
                className="w-full h-full object-contain p-1"
              />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-bold text-gray-900 text-base sm:text-lg lg:text-base xl:text-lg leading-tight group-hover:text-[#008060] transition-colors">
              The Kalyani School
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 font-semibold uppercase tracking-wide mt-0.5">
              Admin Control
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-8 space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = item.key === currentPage;
          const Icon = item.icon;

          return (
            <Button
              key={item.path}
              variant={isActive ? "default" : "ghost"}
              className={`
                group w-full justify-start rounded-md px-3 py-2 h-auto
                font-medium transition-all duration-200
                ${isActive
                  ? 'bg-[#008060] text-white hover:bg-[#006b51] shadow-md'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                }
              `}
              onClick={() => handleNavigation(item.path)}
            >
              {/* Icon container */}
              <div className={`
                mr-3 flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center
                transition-all duration-200
                ${isActive
                  ? 'bg-white/20 text-white'
                  : `${item.bgColor} ${item.color}`
                }
              `}>
                <Icon className="w-4 h-4" strokeWidth={2} />
              </div>

              {/* Label */}
              <span className="text-sm flex-1 text-left">
                {item.label}
              </span>

              {/* Active chevron */}
              {isActive && (
                <ChevronRight className="w-4 h-4 ml-auto" />
              )}
            </Button>
          );
        })}
      </nav>


    </div>
  );
};