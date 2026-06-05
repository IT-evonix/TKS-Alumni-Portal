import React from "react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { useLocation } from "wouter";
import { ArrowLeft, Bell, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { NotificationDropdown } from "@/components/layout/NotificationDropdown";
import { useState } from "react";
import { AdminBadgeManager } from "@/components/AdminBadgeManager";
import { AdminUserRankings } from "@/components/AdminUserRankings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Users, Sliders, Search } from "lucide-react";
import { AdminPointRules } from "@/components/AdminPointRules";
import { Input } from "@/components/ui/input";

export const AdminGamificationPage = () => {
    const [, setLocation] = useLocation();
    const { adminUser, logoutAdmin } = useAuth();
    const { unreadCount } = useNotifications();
    const [showNotifications, setShowNotifications] = useState(false);
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    return (
        <div className="flex min-h-screen bg-white">
            <AdminSidebar
                currentPage="gamification"
                showMobileMenu={showMobileMenu}
                onCloseMobileMenu={() => setShowMobileMenu(false)}
            />
            <div className="flex-1 flex flex-col">
                {/* Header */}
                <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 px-8 py-4 sticky top-0 z-40 shadow-sm transition-all duration-300">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 shrink-0">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setLocation("/admin/dashboard")}
                                className="hover:bg-gray-100"
                            >
                                <ArrowLeft className="h-5 w-5 text-gray-700" />
                            </Button>
                            <h2 className="text-xl font-semibold text-gray-900 hidden lg:block">Gamification Engine</h2>
                        </div>
                        
                        <div className="flex-1 max-w-md mx-4 relative group hidden sm:block">
                            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 group-hover:text-primary transition-colors" />
                            <Input
                                placeholder="Search badges, rules, alumni..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 bg-gray-50/50 border-gray-200 focus-visible:ring-primary/20 rounded-full h-10"
                            />
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="relative z-[70]">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className={`relative min-w-[44px] min-h-[44px] rounded-full transition-colors ${unreadCount > 0
                                        ? "text-[#008060] hover:bg-[#008060]/10 hover:text-[#006b51] ring-2 ring-[#008060]/30"
                                        : "text-gray-600 hover:text-[#008060] hover:bg-gray-100"
                                        }`}
                                    onClick={() => setShowNotifications(!showNotifications)}
                                >
                                    <Bell className="w-5 h-5" strokeWidth={2} />
                                    {unreadCount > 0 && (
                                        <span className="absolute -top-0.5 right-0 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white animate-pulse">
                                            {unreadCount > 99 ? "99+" : unreadCount > 9 ? "9+" : unreadCount}
                                        </span>
                                    )}
                                </Button>
                                {showNotifications && <NotificationDropdown onClose={() => setShowNotifications(false)} />}
                            </div>
                            <Button
                                variant="outline"
                                className="text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all"
                                onClick={() => logoutAdmin()}
                            >
                                <LogOut className="w-4 h-4 mr-2" />
                                Log Out
                            </Button>
                            <div className="hidden md:flex items-center gap-3 pl-4 border-l border-gray-200">
                                <div className="text-right">
                                    <p className="text-sm font-semibold text-gray-900">{adminUser?.username || 'Admin'}</p>
                                    <p className="text-xs text-gray-500">Administrator</p>
                                </div>
                                <div className="w-10 h-10 bg-gradient-to-br from-[#008060] to-[#006b51] rounded-full flex items-center justify-center shadow-md">
                                    <span className="text-white font-semibold">{adminUser?.username?.charAt(0).toUpperCase() || 'A'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </header>
                <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
                    <Tabs defaultValue="points" className="w-full">
                        <TabsList className="grid w-full max-w-[600px] grid-cols-3 mb-6 bg-slate-100/50 p-1 rounded-xl">
                            <TabsTrigger value="points" className="flex items-center gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                <Sliders className="w-4 h-4" /> Point Rules
                            </TabsTrigger>
                            <TabsTrigger value="rules" className="flex items-center gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                <Trophy className="w-4 h-4" /> Badges Config
                            </TabsTrigger>
                            <TabsTrigger value="users" className="flex items-center gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                <Users className="w-4 h-4" /> Alumni Rankings
                            </TabsTrigger>
                        </TabsList>
                        <TabsContent value="points" className="mt-0 outline-none">
                            <AdminPointRules searchQuery={searchQuery} />
                        </TabsContent>
                        <TabsContent value="rules" className="mt-0 outline-none">
                            <AdminBadgeManager searchQuery={searchQuery} />
                        </TabsContent>
                        <TabsContent value="users" className="mt-0 outline-none">
                            <AdminUserRankings searchQuery={searchQuery} />
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    );
};
