import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { AdminSidebar } from '@/components/layout/AdminSidebar';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, Trash2, ExternalLink, Globe, AlertCircle, Bell, LogOut, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NotificationDropdown } from "@/components/layout/NotificationDropdown";
import { useNotifications } from "@/contexts/NotificationContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from '@/contexts/AuthContext';
import { clientConfig } from '@/lib/config';

export default function AdminTravelChaptersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { user, adminUser, logoutAdmin } = useAuth();
  const { unreadCount } = useNotifications();
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeTab, setActiveTab] = useState("pending");

  React.useEffect(() => { document.title = "Travel Chapters Management - Admin"; }, []);

  // Same getHeaders pattern as AdminBlogsPage — ensures correct admin token is sent
  const getHeaders = () => {
    const token = localStorage.getItem("auth_token") || "";
    const userId = adminUser?.id || user?.id || localStorage.getItem("userId") || "";
    return {
      "Content-Type": "application/json",
      "user-id": userId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const { data: chapters = [], isLoading } = useQuery({
    queryKey: ['admin-travel-chapters'],
    queryFn: async () => {
      const res = await fetch(`${clientConfig.apiUrl}/api/travel-chapters/admin`, {
        headers: getHeaders(),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to fetch chapters: ${res.status} ${text}`);
      }
      return res.json();
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const res = await fetch(`${clientConfig.apiUrl}/api/travel-chapters/${id}/status`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-travel-chapters'] });
      toast({ title: "Success", description: data.message });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${clientConfig.apiUrl}/api/travel-chapters/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error("Failed to delete chapter");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-travel-chapters'] });
      toast({ title: "Success", description: "Chapter deleted successfully" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const filteredChapters = chapters.filter((c: any) => {
    if (activeTab === "all") return true;
    return c.status === activeTab;
  });

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      pending: { label: "In Review", className: "bg-yellow-100 text-yellow-800" },
      approved: { label: "Approved", className: "bg-green-100 text-green-800" },
      rejected: { label: "Rejected", className: "bg-red-100 text-red-800" },
    };
    const s = map[status] || { label: status, className: "bg-gray-100 text-gray-600" };
    return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.className}`}>{s.label}</span>;
  };

  return (
    <div className="flex min-h-screen bg-white">
      <AdminSidebar currentPage="travel-chapters" />
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 px-8 py-4 sticky top-0 z-40 shadow-sm transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setLocation("/admin/dashboard")}
                className="hover:bg-gray-100"
                aria-label="Back to Dashboard"
              >
                <ArrowLeft className="h-5 w-5 text-gray-700" />
              </Button>
              <h2 className="text-xl font-semibold text-gray-900">Travel Chapters Management</h2>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={() => setLocation("/travel-chapters")} className="hidden sm:flex gap-2 text-gray-600">
                <ExternalLink className="h-4 w-4" />
                View Public Directory
              </Button>
              <div className="relative z-[70]">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`relative min-w-[44px] min-h-[44px] rounded-full transition-colors ${
                    unreadCount > 0
                      ? "text-[#008060] hover:bg-[#008060]/10 hover:text-[#006b51] ring-2 ring-[#008060]/30"
                      : "text-gray-600 hover:text-[#008060] hover:bg-gray-100"
                  }`}
                  onClick={() => setShowNotifications(!showNotifications)}
                  aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
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
                  <p className="text-sm font-semibold text-gray-900">{adminUser?.username || "Admin"}</p>
                  <p className="text-xs text-gray-500">Administrator</p>
                </div>
                <div className="w-10 h-10 bg-gradient-to-br from-[#008060] to-[#006b51] rounded-full flex items-center justify-center shadow-md">
                  <span className="text-white font-semibold">{adminUser?.username?.charAt(0).toUpperCase() || "A"}</span>
                </div>
              </div>
            </div>
          </div>
        </header>
        <div className="max-w-6xl mx-auto w-full px-4 py-6 space-y-6">

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-gray-100">
              <TabsTrigger value="pending" className="flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                Pending Review
              </TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
              <TabsTrigger value="all">All Chapters</TabsTrigger>
            </TabsList>

            {["pending", "approved", "rejected", "all"].map((tab) => (
              <TabsContent key={tab} value={tab} className="mt-4">
                {isLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : filteredChapters.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <Globe className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p>No chapters in this category</p>
                  </div>
                ) : (
                  <div className="border rounded-xl overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead>Chapter</TableHead>
                          <TableHead>Author</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredChapters.map((chapter: any) => {
                          const authorName = chapter.creator?.username || "Unknown";
                          const initials = authorName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

                          return (
                            <TableRow key={chapter.id} className="hover:bg-gray-50">
                              <TableCell className="max-w-[280px]">
                                <p className="font-medium text-sm text-gray-900 line-clamp-1">{chapter.name}</p>
                                {chapter.description && (
                                  <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">{chapter.description}</p>
                                )}
                              </TableCell>
                              
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-6 w-6">
                                    <AvatarFallback className="text-xs bg-[#008060]/10 text-[#008060]">{initials}</AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm text-gray-700 whitespace-nowrap">{authorName}</span>
                                </div>
                              </TableCell>

                              <TableCell>
                                <Badge
                                  className="text-xs bg-[#008060]/10 text-[#008060] border-[#008060]/20 hover:bg-[#008060]/10"
                                >
                                  {chapter.city}, {chapter.country}
                                </Badge>
                              </TableCell>

                              <TableCell>{statusBadge(chapter.status)}</TableCell>
                              
                              <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                                {new Date(chapter.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </TableCell>
                              
                              <TableCell>
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs text-gray-500"
                                    onClick={() => setLocation(`/travel-chapters`)}
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                  </Button>
                                  
                                  {chapter.status === "pending" && (
                                    <>
                                      <Button
                                        size="sm"
                                        className="h-7 px-2 bg-green-600 hover:bg-green-700 text-xs"
                                        onClick={() => updateStatusMutation.mutate({ id: chapter.id, status: 'approved' })}
                                        disabled={updateStatusMutation.isPending}
                                      >
                                        <CheckCircle className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 px-2 border-red-300 text-red-600 hover:bg-red-50 text-xs"
                                        onClick={() => updateStatusMutation.mutate({ id: chapter.id, status: 'rejected' })}
                                        disabled={updateStatusMutation.isPending}
                                      >
                                        <XCircle className="h-3 w-3" />
                                      </Button>
                                    </>
                                  )}
                                  
                                  {chapter.status === "approved" && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2 border-red-300 text-red-600 hover:bg-red-50 text-xs"
                                      onClick={() => updateStatusMutation.mutate({ id: chapter.id, status: 'rejected' })}
                                      disabled={updateStatusMutation.isPending}
                                    >
                                      <XCircle className="h-3 w-3" />
                                    </Button>
                                  )}
                                  
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-red-400 hover:text-red-600 hover:bg-red-50 text-xs"
                                    onClick={() => {
                                      if (confirm('Are you sure you want to delete this chapter? This cannot be undone.')) {
                                        deleteMutation.mutate(chapter.id);
                                      }
                                    }}
                                    disabled={deleteMutation.isPending}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    </div>
  );
}
