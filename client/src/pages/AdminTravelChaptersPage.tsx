import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { useToast } from "@/hooks/use-toast";
import {
  Trash2, Eye, EyeOff, Globe, Bell, LogOut, Loader2, MapPin,
  Heart, MessageCircle, Bookmark, CheckCircle, XCircle, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { NotificationDropdown } from "@/components/layout/NotificationDropdown";
import { useNotifications } from "@/contexts/NotificationContext";
import { useAuth } from "@/contexts/AuthContext";
import { clientConfig } from "@/lib/config";
import { format } from "date-fns";

type StatusTab = "pending" | "approved" | "rejected" | "all";

export default function AdminTravelChaptersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { user, adminUser, logoutAdmin } = useAuth();
  const { unreadCount } = useNotifications();
  const [showNotifications, setShowNotifications] = useState(false);
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<StatusTab>("pending");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [rejectDialogPost, setRejectDialogPost] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  React.useEffect(() => { document.title = "Travel Journal - Admin"; }, []);

  const getHeaders = () => {
    const token = localStorage.getItem("auth_token") || "";
    const userId = adminUser?.id || user?.id || localStorage.getItem("userId") || "";
    return {
      "Content-Type": "application/json",
      "user-id": userId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-travel-posts", page, activeTab],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (activeTab !== "all") params.set("status", activeTab);
      const res = await fetch(`${clientConfig.apiUrl}/api/travel-posts/admin/all?${params}`, { headers: getHeaders() });
      if (!res.ok) throw new Error("Failed to fetch posts");
      return res.json() as Promise<{ posts: any[]; total: number; page: number; limit: number }>;
    },
    staleTime: 30_000,
  });

  const posts: any[] = data?.posts ?? [];
  const total: number = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  const hideMutation = useMutation({
    mutationFn: async ({ id, hidden }: { id: string; hidden: boolean }) => {
      const res = await fetch(`${clientConfig.apiUrl}/api/travel-posts/admin/${id}/hide`, {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify({ hidden }),
      });
      if (!res.ok) throw new Error("Failed to update post");
      return res.json();
    },
    onSuccess: (_data, { hidden }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-travel-posts"] });
      toast({ title: hidden ? "Post hidden from feed" : "Post made visible" });
    },
    onError: () => toast({ title: "Failed to update post", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${clientConfig.apiUrl}/api/travel-posts/${id}`, {
        method: "DELETE",
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error("Failed to delete post");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-travel-posts"] });
      setConfirmDeleteId(null);
      toast({ title: "Post deleted" });
    },
    onError: () => toast({ title: "Failed to delete post", variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${clientConfig.apiUrl}/api/travel-posts/admin/${id}/approve`, {
        method: "PATCH",
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error("Failed to approve");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-travel-posts"] });
      toast({ title: "Post approved and published" });
    },
    onError: () => toast({ title: "Failed to approve post", variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await fetch(`${clientConfig.apiUrl}/api/travel-posts/admin/${id}/reject`, {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify({ rejection_reason: reason }),
      });
      if (!res.ok) throw new Error("Failed to reject");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-travel-posts"] });
      setRejectDialogPost(null);
      setRejectionReason("");
      toast({ title: "Post rejected" });
    },
    onError: () => toast({ title: "Failed to reject post", variant: "destructive" }),
  });

  const tabs: { value: StatusTab; label: string; icon: React.ReactNode }[] = [
    { value: "pending", label: "Pending", icon: <Clock className="w-3.5 h-3.5" /> },
    { value: "approved", label: "Approved", icon: <CheckCircle className="w-3.5 h-3.5" /> },
    { value: "rejected", label: "Rejected", icon: <XCircle className="w-3.5 h-3.5" /> },
    { value: "all", label: "All", icon: <Globe className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar currentPage="travel-chapters" />

      <div className="flex-1 overflow-auto">
        {/* Top bar */}
        <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-500" />
            <h1 className="text-lg font-semibold text-gray-900">Travel Journal</h1>
            <Badge variant="outline" className="ml-1">{total} posts</Badge>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setShowNotifications((v) => !v)}
                className="relative p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
              {showNotifications && (
                <div className="absolute right-0 top-10 z-50">
                  <NotificationDropdown onClose={() => setShowNotifications(false)} />
                </div>
              )}
            </div>
            <button
              onClick={() => { logoutAdmin?.(); setLocation("/admin/login"); }}
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          </div>
        </header>

        <div className="p-6">
          {/* Status tabs */}
          <div className="flex items-center gap-2 mb-5">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => { setActiveTab(tab.value); setPage(1); }}
                className={`flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg font-medium transition-all ${
                  activeTab === tab.value
                    ? tab.value === "pending"
                      ? "bg-yellow-500 text-white"
                      : tab.value === "approved"
                      ? "bg-green-600 text-white"
                      : tab.value === "rejected"
                      ? "bg-red-500 text-white"
                      : "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : isError ? (
            <p className="text-center text-red-500 py-8">Failed to load posts.</p>
          ) : posts.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Globe className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No {activeTab !== "all" ? activeTab : ""} posts found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {posts.map((post: any) => {
                const authorName = [post.author?.first_name, post.author?.last_name].filter(Boolean).join(" ") || "Alumni";
                const coverMedia = post.media?.[0];
                return (
                  <div
                    key={post.id}
                    className={`bg-white rounded-xl border shadow-sm flex gap-4 p-4 ${
                      post.is_hidden ? "border-orange-200 bg-orange-50/30" :
                      post.status === "pending" ? "border-yellow-200 bg-yellow-50/20" :
                      post.status === "rejected" ? "border-red-200 bg-red-50/10" :
                      "border-gray-200"
                    }`}
                  >
                    {/* Cover thumbnail */}
                    <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center">
                      {coverMedia ? (
                        <img src={coverMedia.url} alt="cover" className="w-full h-full object-cover" />
                      ) : (
                        <MapPin className="w-6 h-6 text-white opacity-80" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="font-medium text-gray-900 text-sm">{authorName}</span>
                            {post.status === "pending" && (
                              <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300 text-xs">Pending Review</Badge>
                            )}
                            {post.status === "rejected" && (
                              <Badge className="bg-red-100 text-red-700 border-red-300 text-xs">Rejected</Badge>
                            )}
                            {post.is_hidden && (
                              <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs">Hidden</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-blue-600 mb-1">
                            <MapPin className="w-3 h-3" /> {post.city}, {post.country}
                          </div>
                          {post.status === "rejected" && post.rejection_reason && (
                            <p className="text-xs text-red-600 mb-1 italic">Reason: {post.rejection_reason}</p>
                          )}
                          {post.caption && (
                            <p className="text-xs text-gray-600 line-clamp-2">{post.caption}</p>
                          )}
                          <div className="flex items-center gap-3 text-xs text-gray-400 mt-1.5">
                            <span className="flex items-center gap-0.5"><Heart className="w-3 h-3" /> {post.likes_count}</span>
                            <span className="flex items-center gap-0.5"><MessageCircle className="w-3 h-3" /> {post.comments_count}</span>
                            <span className="flex items-center gap-0.5"><Bookmark className="w-3 h-3" /> {post.bookmarks_count}</span>
                            <span>{post.media?.length ?? 0} media</span>
                            <span className="ml-auto">
                              {(() => { try { return format(new Date(post.created_at), "MMM d, yyyy"); } catch { return ""; } })()}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {/* Approve / Reject — only for pending posts */}
                          {post.status === "pending" && (
                            <>
                              <button
                                onClick={() => approveMutation.mutate(post.id)}
                                disabled={approveMutation.isPending}
                                title="Approve post"
                                className="p-1.5 rounded-lg text-green-600 hover:bg-green-100 transition-colors"
                              >
                                {approveMutation.isPending && approveMutation.variables === post.id
                                  ? <Loader2 className="w-4 h-4 animate-spin" />
                                  : <CheckCircle className="w-4 h-4" />
                                }
                              </button>
                              <button
                                onClick={() => { setRejectDialogPost(post); setRejectionReason(""); }}
                                title="Reject post"
                                className="p-1.5 rounded-lg text-red-500 hover:bg-red-100 transition-colors"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}

                          {/* Hide/show toggle */}
                          <button
                            onClick={() => hideMutation.mutate({ id: post.id, hidden: !post.is_hidden })}
                            disabled={hideMutation.isPending}
                            title={post.is_hidden ? "Make visible" : "Hide post"}
                            className={`p-1.5 rounded-lg transition-colors ${post.is_hidden ? "text-blue-600 hover:bg-blue-100" : "text-orange-500 hover:bg-orange-100"}`}
                          >
                            {post.is_hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => setConfirmDeleteId(confirmDeleteId === post.id ? null : post.id)}
                            disabled={deleteMutation.isPending && deleteMutation.variables === post.id}
                            title="Delete post"
                            className={`p-1.5 rounded-lg transition-colors ${confirmDeleteId === post.id ? "text-red-700 bg-red-100" : "text-gray-400 hover:text-red-600 hover:bg-red-50"}`}
                          >
                            {deleteMutation.isPending && (deleteMutation.variables as string) === post.id
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <Trash2 className="w-4 h-4" />
                            }
                          </button>
                          {confirmDeleteId === post.id && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => deleteMutation.mutate(post.id)}
                              className="text-xs h-7 px-2"
                            >
                              Confirm Delete
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          )}
        </div>
      </div>

      {/* Rejection reason dialog */}
      {rejectDialogPost && (
        <Dialog open onOpenChange={() => { setRejectDialogPost(null); setRejectionReason(""); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Travel Post</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-600 mb-3">
              Post from <strong>{rejectDialogPost.city}, {rejectDialogPost.country}</strong> by{" "}
              <strong>{[rejectDialogPost.author?.first_name, rejectDialogPost.author?.last_name].filter(Boolean).join(" ") || "Alumni"}</strong>
            </p>
            <Textarea
              placeholder="Reason for rejection (will be shown to the author)..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
              className="mb-4"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setRejectDialogPost(null); setRejectionReason(""); }}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={!rejectionReason.trim() || rejectMutation.isPending}
                onClick={() => rejectMutation.mutate({ id: rejectDialogPost.id, reason: rejectionReason })}
              >
                {rejectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Reject Post
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
