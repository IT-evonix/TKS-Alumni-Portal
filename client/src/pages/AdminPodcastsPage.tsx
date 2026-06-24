import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Mic2, Plus, Edit, Trash2, Eye, Star, StarOff, Calendar, Clock,
  CheckCircle, X, ArrowLeft, Radio, Users, Bell, LogOut
} from "lucide-react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { NotificationDropdown } from "@/components/layout/NotificationDropdown";
import { useNotifications } from "@/contexts/NotificationContext";

interface PodcastLink {
  label: string;
  url: string;
}

interface Podcast {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  show_notes: string | null;
  video_url: string;
  embed_url: string | null;
  links: PodcastLink[];
  tags: string[];
  episode_number: number | null;
  status: "draft" | "scheduled" | "published";
  scheduled_at: string | null;
  published_at: string | null;
  is_featured: boolean;
  views_count: number;
  created_at: string;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  published: { label: "Published", className: "bg-green-100 text-green-700 border border-green-200" },
  scheduled: { label: "Scheduled", className: "bg-blue-100 text-blue-700 border border-blue-200" },
  draft:     { label: "Draft",     className: "bg-gray-100 text-gray-500 border border-gray-200" },
};

function deriveEmbedUrl(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") {
      const id = u.pathname.slice(1).split("?")[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname.startsWith("/embed/")) return url;
      const id = u.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch {
    // invalid URL
  }
  return null;
}

const EMPTY_FORM = {
  title: "",
  episodeNumber: "",
  videoUrl: "",
  description: "",
  showNotes: "",
  tags: [] as string[],
  status: "draft" as "draft" | "scheduled" | "published",
  scheduledAt: "",
  links: [] as PodcastLink[],
};

export function AdminPodcastsPage() {
  const { user, adminUser, logoutAdmin } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { unreadCount } = useNotifications();
  const [showNotifications, setShowNotifications] = useState(false);

  const [episodes, setEpisodes] = useState<Podcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [tagInput, setTagInput] = useState("");

  // Viewers panel
  interface Viewer { userId: string; name: string; email: string; avatarUrl: string | null; viewedAt: string; }
  const [viewersEpisode, setViewersEpisode] = useState<Podcast | null>(null);
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [viewersLoading, setViewersLoading] = useState(false);

  React.useEffect(() => { document.title = "Podcast Management - Admin"; }, []);

  const getHeaders = () => {
    const token = localStorage.getItem("auth_token") || "";
    const userId = adminUser?.id || user?.id || localStorage.getItem("userId") || "";
    return {
      "Content-Type": "application/json",
      "user-id": userId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const loadViewers = async (ep: Podcast) => {
    setViewersEpisode(ep);
    setViewersLoading(true);
    setViewers([]);
    try {
      const res = await fetch(`/api/podcasts/${ep.id}/viewers`, { headers: getHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setViewers(data.viewers || []);
    } catch (err: any) {
      toast({ title: "Error loading viewers", description: err.message, variant: "destructive" });
    } finally {
      setViewersLoading(false);
    }
  };

  const fetchEpisodes = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200" });
      const res = await fetch(`/api/podcasts/admin/all?${params}`, { headers: getHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEpisodes(data.episodes || []);
    } catch (err: any) {
      toast({ title: "Error loading episodes", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!adminUser?.id && !user?.id) return;
    fetchEpisodes();
  }, [adminUser?.id, user?.id]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setTagInput("");
    setFormOpen(true);
  };

  const openEdit = (ep: Podcast) => {
    setEditingId(ep.id);
    setForm({
      title: ep.title,
      episodeNumber: ep.episode_number ? String(ep.episode_number) : "",
      videoUrl: ep.video_url,
      description: ep.description || "",
      showNotes: ep.show_notes || "",
      tags: ep.tags || [],
      status: ep.status,
      scheduledAt: ep.scheduled_at ? utcToISTLocal(ep.scheduled_at) : "",
      links: ep.links || [],
    });
    setTagInput("");
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast({ title: "Title is required", variant: "destructive" }); return; }
    if (!form.videoUrl.trim()) { toast({ title: "Video URL is required", variant: "destructive" }); return; }
    if (form.status === "scheduled" && !form.scheduledAt) {
      toast({ title: "Scheduled date/time is required", variant: "destructive" }); return;
    }
    if (form.status === "scheduled" && form.scheduledAt) {
      const scheduledUtcMs = new Date(istLocalToUTC(form.scheduledAt)).getTime();
      if (scheduledUtcMs <= Date.now()) {
        toast({ title: "Scheduled time must be in the future", description: "Please pick a time after the current IST time.", variant: "destructive" });
        return;
      }
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        episodeNumber: form.episodeNumber ? parseInt(form.episodeNumber) : null,
        videoUrl: form.videoUrl.trim(),
        description: form.description.trim() || null,
        showNotes: form.showNotes.trim() || null,
        tags: form.tags,
        status: form.status,
        scheduledAt: form.status === "scheduled" ? istLocalToUTC(form.scheduledAt) : null,
        links: form.links.filter(l => l.url.trim()),
      };
      const url = editingId ? `/api/podcasts/${editingId}` : "/api/podcasts";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: getHeaders(), body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: editingId ? "Episode updated" : "Episode created" });
      setFormOpen(false);
      fetchEpisodes();
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (id: string) => {
    try {
      const res = await fetch(`/api/podcasts/${id}/publish`, { method: "PUT", headers: getHeaders() });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ title: "Episode published" });
      fetchEpisodes();
    } catch (err: any) {
      toast({ title: "Failed to publish", description: err.message, variant: "destructive" });
    }
  };

  const handleToggleFeatured = async (ep: Podcast) => {
    try {
      const res = await fetch(`/api/podcasts/${ep.id}/feature`, { method: "PUT", headers: getHeaders() });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ title: ep.is_featured ? "Removed from featured" : "Marked as featured" });
      fetchEpisodes();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/podcasts/${id}`, { method: "DELETE", headers: getHeaders() });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ title: "Episode deleted" });
      setDeleteConfirmId(null);
      fetchEpisodes();
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
  };

  const addLink = () => setForm(f => ({ ...f, links: [...f.links, { label: "", url: "" }] }));
  const removeLink = (i: number) => setForm(f => ({ ...f, links: f.links.filter((_, idx) => idx !== i) }));
  const updateLink = (i: number, field: "label" | "url", value: string) =>
    setForm(f => ({ ...f, links: f.links.map((l, idx) => idx === i ? { ...l, [field]: value } : l) }));

  // IST is UTC+5:30 (330 minutes). These helpers convert precisely without
  // relying on the browser's local timezone, which may not be IST.
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

  /** UTC ISO string → "YYYY-MM-DDTHH:mm" in IST, suitable for datetime-local inputs */
  const utcToISTLocal = (utcIso: string): string => {
    const utcMs = new Date(utcIso).getTime();
    const istMs = utcMs + IST_OFFSET_MS;
    return new Date(istMs).toISOString().slice(0, 16);
  };

  /** "YYYY-MM-DDTHH:mm" treated as IST → UTC ISO string for the server */
  const istLocalToUTC = (istLocal: string): string => {
    // istLocal has no tz info; we treat it as IST by subtracting the offset
    const naiveMs = new Date(istLocal + ":00.000Z").getTime(); // parsed as UTC
    const utcMs = naiveMs - IST_OFFSET_MS;
    return new Date(utcMs).toISOString();
  };

  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: true,
      timeZone: "Asia/Kolkata",
    }) : "—";

  const counts = {
    all: episodes.length,
    published: episodes.filter(e => e.status === "published").length,
    scheduled: episodes.filter(e => e.status === "scheduled").length,
    draft: episodes.filter(e => e.status === "draft").length,
  };

  // Filter for each tab
  const filtered = activeTab === "all" ? episodes : episodes.filter(e => e.status === activeTab);

  return (
    <div className="flex min-h-screen bg-white">
      <AdminSidebar currentPage="podcasts" />

      <div className="flex-1 flex flex-col min-w-0">
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
              <h2 className="text-xl font-semibold text-gray-900">Podcast Management</h2>
            </div>
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation("/podcast")}
                className="hidden sm:flex gap-2 text-gray-600"
              >
                <Radio className="w-4 h-4" />
                View Public Page
              </Button>
              <Button
                onClick={openCreate}
                className="bg-[#008060] hover:bg-[#006b51] text-white gap-2"
                size="sm"
              >
                <Plus className="w-4 h-4" />
                New Episode
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

        {/* Main Content */}
        <main className="flex-1 p-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: "Total Episodes", value: counts.all, color: "text-gray-700", bg: "bg-gray-50", border: "border-gray-200" },
              { label: "Published", value: counts.published, color: "text-green-700", bg: "bg-green-50", border: "border-green-200" },
              { label: "Scheduled", value: counts.scheduled, color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" },
              { label: "Drafts", value: counts.draft, color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
            ].map(s => (
              <div key={s.label} className={`${s.bg} border ${s.border} rounded-xl px-4 py-3`}>
                <p className="text-xs text-gray-500 font-medium">{s.label}</p>
                <p className={`text-2xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Tabs + Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 pt-4 border-b border-gray-100">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="bg-gray-100/80">
                  {(["all", "published", "scheduled", "draft"] as const).map(tab => (
                    <TabsTrigger key={tab} value={tab} className="capitalize gap-1.5 text-sm">
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                      <span className="text-[10px] bg-white/80 text-gray-500 rounded-full px-1.5 py-0.5 font-semibold min-w-[18px] text-center">
                        {counts[tab]}
                      </span>
                    </TabsTrigger>
                  ))}
                </TabsList>

                {(["all", "published", "scheduled", "draft"] as const).map(tab => (
                  <TabsContent key={tab} value={tab} className="mt-0">
                    {loading ? (
                      <div className="flex items-center justify-center py-20 text-gray-400 gap-3">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#008060] border-t-transparent" />
                        Loading episodes...
                      </div>
                    ) : filtered.length === 0 ? (
                      <div className="text-center py-20">
                        <div className="w-16 h-16 rounded-full bg-pink-50 flex items-center justify-center mx-auto mb-4">
                          <Mic2 className="w-7 h-7 text-pink-300" />
                        </div>
                        <p className="font-semibold text-gray-600">No episodes found</p>
                        <p className="text-sm text-gray-400 mt-1">
                          {tab === "all" ? "Create your first episode to get started." : `No ${tab} episodes yet.`}
                        </p>
                        {tab === "all" && (
                          <Button onClick={openCreate} className="mt-4 bg-[#008060] hover:bg-[#006b51] text-white gap-2" size="sm">
                            <Plus className="w-4 h-4" /> New Episode
                          </Button>
                        )}
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50/60 border-b border-gray-100">
                            <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide w-10 pl-4">#</TableHead>
                            <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Title</TableHead>
                            <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Status</TableHead>
                            <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Date</TableHead>
                            <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-right pr-4">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filtered.map(ep => (
                            <TableRow key={ep.id} className="hover:bg-gray-50/60 transition-colors border-b border-gray-50">
                              <TableCell className="pl-4 text-sm text-gray-400 font-medium">
                                {ep.episode_number ?? "—"}
                              </TableCell>
                              <TableCell className="py-3">
                                <div className="flex items-start gap-2 max-w-xs lg:max-w-sm">
                                  {ep.is_featured && (
                                    <Star className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                                  )}
                                  <div>
                                    <p className="font-semibold text-gray-900 text-sm line-clamp-1">{ep.title}</p>
                                    {ep.description && (
                                      <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">{ep.description}</p>
                                    )}
                                    {ep.tags.length > 0 && (
                                      <div className="flex gap-1 mt-1 flex-wrap">
                                        {ep.tags.slice(0, 3).map(t => (
                                          <span key={t} className="text-[10px] bg-gray-100 text-gray-500 rounded px-1.5 py-px">{t}</span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_BADGE[ep.status]?.className}`}>
                                  {STATUS_BADGE[ep.status]?.label}
                                </span>
                              </TableCell>
                              <TableCell className="hidden lg:table-cell">
                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                  {ep.status === "scheduled" ? (
                                    <><Clock className="w-3 h-3 text-blue-400" />{fmt(ep.scheduled_at)}</>
                                  ) : ep.status === "published" ? (
                                    fmt(ep.published_at)
                                  ) : (
                                    <span className="text-gray-400">{fmt(ep.created_at)}</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right pr-4">
                                <div className="flex items-center gap-0.5 justify-end">
                                  {ep.status !== "published" && (
                                    <Button size="sm" variant="ghost" title="Publish now"
                                      className="h-8 w-8 p-0 text-green-600 hover:bg-green-50"
                                      onClick={() => handlePublish(ep.id)}
                                    >
                                      <CheckCircle className="w-3.5 h-3.5" />
                                    </Button>
                                  )}
                                  <Button size="sm" variant="ghost" title={ep.is_featured ? "Unfeature" : "Feature"}
                                    className={`h-8 w-8 p-0 ${ep.is_featured ? "text-amber-500 hover:bg-amber-50" : "text-gray-300 hover:text-amber-400 hover:bg-amber-50"}`}
                                    onClick={() => handleToggleFeatured(ep)}
                                  >
                                    {ep.is_featured ? <Star className="w-3.5 h-3.5" /> : <StarOff className="w-3.5 h-3.5" />}
                                  </Button>
                                  <Button size="sm" variant="ghost" title="View viewers"
                                    className="h-8 w-8 p-0 text-purple-500 hover:bg-purple-50"
                                    onClick={() => loadViewers(ep)}
                                  >
                                    <Users className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button size="sm" variant="ghost" title="Edit"
                                    className="h-8 w-8 p-0 text-blue-500 hover:bg-blue-50"
                                    onClick={() => openEdit(ep)}
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button size="sm" variant="ghost" title="Delete"
                                    className="h-8 w-8 p-0 text-red-400 hover:bg-red-50"
                                    onClick={() => setDeleteConfirmId(ep.id)}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </TabsContent>
                ))}
              </Tabs>
            </div>
          </div>
        </main>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <div className="w-8 h-8 rounded-lg bg-pink-50 flex items-center justify-center">
                <Mic2 className="w-4 h-4 text-pink-600" />
              </div>
              {editingId ? "Edit Episode" : "New Episode"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {/* Title + Episode Number */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  Title <span className="text-red-400">*</span>
                </Label>
                <Input
                  placeholder="Episode title"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="focus:border-[#008060] focus:ring-[#008060]/20"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Episode #</Label>
                <Input
                  type="number" min={1} placeholder="e.g. 12"
                  value={form.episodeNumber}
                  onChange={e => setForm(f => ({ ...f, episodeNumber: e.target.value }))}
                  className="focus:border-[#008060] focus:ring-[#008060]/20"
                />
              </div>
            </div>

            {/* Video URL */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">
                Video URL <span className="text-red-400">*</span>
              </Label>
              <Input
                placeholder="https://www.youtube.com/watch?v=... or Vimeo URL"
                value={form.videoUrl}
                onChange={e => setForm(f => ({ ...f, videoUrl: e.target.value }))}
                className="focus:border-[#008060] focus:ring-[#008060]/20"
              />
              <p className="text-xs text-gray-400">Supports YouTube and Vimeo. Embed will be generated automatically.</p>
              {(() => {
                const embedUrl = deriveEmbedUrl(form.videoUrl);
                if (!embedUrl) return null;
                return (
                  <div className="mt-2 rounded-lg overflow-hidden border border-gray-200 bg-black aspect-video">
                    <iframe
                      src={embedUrl}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title="Video preview"
                    />
                  </div>
                );
              })()}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">Description</Label>
              <Textarea
                placeholder="Short episode summary shown on the listing page"
                rows={3}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="focus:border-[#008060] focus:ring-[#008060]/20 resize-none"
              />
            </div>

            {/* Show Notes */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">Show Notes / Transcript</Label>
              <Textarea
                placeholder="Detailed notes, timestamps, transcript..."
                rows={4}
                value={form.showNotes}
                onChange={e => setForm(f => ({ ...f, showNotes: e.target.value }))}
                className="focus:border-[#008060] focus:ring-[#008060]/20 resize-none"
              />
            </div>

            {/* Tags */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">Tags</Label>
              <div className="flex flex-wrap gap-1.5 min-h-[38px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-within:border-[#008060] focus-within:ring-2 focus-within:ring-[#008060]/20">
                {form.tags.map((tag, i) => (
                  <span key={i} className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 rounded px-2 py-0.5 text-xs font-medium">
                    {tag}
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, tags: f.tags.filter((_, idx) => idx !== i) }))}
                      className="text-gray-400 hover:text-gray-700 leading-none"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  placeholder={form.tags.length === 0 ? "Type a tag and press Enter or comma" : "Add another tag..."}
                  value={tagInput}
                  onChange={e => {
                    const val = e.target.value;
                    if (val.includes(",")) {
                      const parts = val.split(",").map(t => t.trim()).filter(Boolean);
                      const newTags = parts.slice(0, -1);
                      const remaining = parts[parts.length - 1] ?? "";
                      if (newTags.length > 0) {
                        setForm(f => ({ ...f, tags: [...f.tags, ...newTags.filter(t => !f.tags.includes(t))] }));
                      }
                      setTagInput(val.endsWith(",") ? "" : remaining);
                    } else {
                      setTagInput(val);
                    }
                  }}
                  onKeyDown={e => {
                    if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
                      e.preventDefault();
                      const newTag = tagInput.trim();
                      if (newTag && !form.tags.includes(newTag)) {
                        setForm(f => ({ ...f, tags: [...f.tags, newTag] }));
                      }
                      setTagInput("");
                    } else if (e.key === "Backspace" && !tagInput && form.tags.length > 0) {
                      setForm(f => ({ ...f, tags: f.tags.slice(0, -1) }));
                    }
                  }}
                  onBlur={() => {
                    if (tagInput.trim()) {
                      const newTag = tagInput.trim();
                      if (!form.tags.includes(newTag)) {
                        setForm(f => ({ ...f, tags: [...f.tags, newTag] }));
                      }
                      setTagInput("");
                    }
                  }}
                  className="flex-1 min-w-[120px] outline-none bg-transparent text-sm placeholder:text-muted-foreground"
                />
              </div>
            </div>

            {/* External Links */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-gray-700">External Links</Label>
                <Button type="button" size="sm" variant="outline"
                  className="h-7 gap-1 text-xs hover:border-[#008060] hover:text-[#008060]"
                  onClick={addLink}
                >
                  <Plus className="w-3 h-3" /> Add Link
                </Button>
              </div>
              {form.links.length === 0 && (
                <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2.5 border border-dashed border-gray-200">
                  No links added. Add links to resources, articles, or websites mentioned in the episode.
                </p>
              )}
              <div className="space-y-2">
                {form.links.map((link, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input
                      placeholder="Label (e.g. Guest LinkedIn)"
                      value={link.label}
                      onChange={e => updateLink(i, "label", e.target.value)}
                      className="flex-1 focus:border-[#008060] focus:ring-[#008060]/20"
                    />
                    <Input
                      placeholder="https://..."
                      value={link.url}
                      onChange={e => updateLink(i, "url", e.target.value)}
                      className="flex-1 focus:border-[#008060] focus:ring-[#008060]/20"
                    />
                    <Button type="button" variant="ghost" size="sm"
                      className="h-8 w-8 p-0 text-gray-300 hover:text-red-400 flex-shrink-0"
                      onClick={() => removeLink(i)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-100 pt-1" />

            {/* Status + Scheduled At */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Publishing Status</Label>
                <Select value={form.status} onValueChange={(v: any) => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="focus:border-[#008060]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">
                      <span className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" /> Draft
                      </span>
                    </SelectItem>
                    <SelectItem value="scheduled">
                      <span className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" /> Scheduled
                      </span>
                    </SelectItem>
                    <SelectItem value="published">
                      <span className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" /> Published
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.status === "scheduled" && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">
                    Publish Date & Time <span className="text-red-400">*</span>
                    <span className="ml-1.5 text-[10px] font-normal text-blue-500 bg-blue-50 border border-blue-100 rounded px-1.5 py-px">IST</span>
                  </Label>
                  <Input
                    type="datetime-local"
                    value={form.scheduledAt}
                    min={(() => utcToISTLocal(new Date(Date.now() + 60000).toISOString()))()}
                    onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))}
                    className={`focus:border-[#008060] focus:ring-[#008060]/20 ${
                      form.scheduledAt && new Date(istLocalToUTC(form.scheduledAt)).getTime() <= Date.now()
                        ? "border-red-400 focus:border-red-400 focus:ring-red-400/20"
                        : ""
                    }`}
                  />
                  {form.scheduledAt && new Date(istLocalToUTC(form.scheduledAt)).getTime() <= Date.now() ? (
                    <p className="text-[11px] text-red-500">Scheduled time must be in the future.</p>
                  ) : (
                    <p className="text-[11px] text-gray-400">All times are in India Standard Time (UTC+5:30)</p>
                  )}
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
              <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving} className="border-gray-200">
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-[#008060] hover:bg-[#006b51] text-white gap-2 min-w-[140px]"
              >
                {saving ? (
                  <><div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" /> Saving...</>
                ) : form.status === "published" ? (
                  <><CheckCircle className="w-4 h-4" /> {editingId ? "Update" : "Publish Episode"}</>
                ) : form.status === "scheduled" ? (
                  <><Calendar className="w-4 h-4" /> {editingId ? "Update" : "Schedule Episode"}</>
                ) : (
                  editingId ? "Update Episode" : "Save as Draft"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Viewers Dialog */}
      <Dialog open={!!viewersEpisode} onOpenChange={() => setViewersEpisode(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                <Users className="w-4 h-4 text-purple-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight truncate">
                  {viewersEpisode?.episode_number ? `Ep ${viewersEpisode.episode_number} · ` : ""}
                  {viewersEpisode?.title}
                </p>
                <p className="text-xs text-gray-400 font-normal">
                  {viewersLoading ? "Loading..." : `${viewers.length} unique viewer${viewers.length !== 1 ? "s" : ""}`}
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto mt-2 -mx-6 px-6">
            {viewersLoading ? (
              <div className="flex items-center justify-center py-12 text-gray-400">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-purple-400 border-t-transparent mr-2" />
                Loading viewers...
              </div>
            ) : viewers.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Eye className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium text-gray-500">No views yet</p>
                <p className="text-xs mt-1">Views will appear here once members open this episode.</p>
              </div>
            ) : (
              <ul className="space-y-1 pb-2">
                {viewers.map((v, i) => (
                  <li key={v.userId ?? i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors">
                    {v.avatarUrl ? (
                      <img src={v.avatarUrl} alt={v.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 text-xs font-semibold text-purple-600">
                        {(v.name || v.email || "?")[0].toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{v.name || "—"}</p>
                      <p className="text-xs text-gray-400 truncate">{v.email}</p>
                    </div>
                    <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0">
                      {new Date(v.viewedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" /> Delete Episode
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-2">
            This will permanently delete the episode. This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" className="border-gray-200" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}>
              Delete Episode
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
