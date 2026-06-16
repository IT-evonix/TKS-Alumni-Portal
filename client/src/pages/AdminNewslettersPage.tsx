import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Plus, Send, Trash2, Edit, Clock, CheckCircle, AlertCircle,
  Users, Loader2, Newspaper, Calendar, MailOpen, TrendingUp, FileText, RefreshCw,
  ChevronUp, ChevronDown, GripVertical, Radio, BookOpen, MessageSquare, Search, X, Link2
} from "lucide-react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
// TipTap
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { createLowlight, common } from "lowlight";

const lowlight = createLowlight(common);

// ---- Types ----
interface Newsletter {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "scheduled" | "sending" | "sent" | "failed";
  recipient_role: string;
  recipient_batch: string;
  recipient_graduation_year: string;
  recipient_department: string;
  scheduled_at: string | null;
  sent_at: string | null;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  open_count: number;
  created_at: string;
  updated_at: string;
}

interface NewsletterDetail extends Newsletter {
  excerpt: string | null;
  content: string;
  cover_image: string | null;
}

interface RecipientPreview {
  count: number;
  users: Array<{ id: string; email: string; name: string; batch: string; graduationYear: number }>;
}

// ---- Article type ----
interface Article {
  id: string;
  title: string;
  image: string;
  content: string;
}

// ---- Embedded content item ----
type EmbedType = "blog" | "podcast" | "post";

interface EmbeddedItem {
  embedId: string;        // local UUID for list key
  type: EmbedType;
  id: string;             // source record id
  title: string;
  excerpt: string;
  coverImage: string;
  url: string;            // relative path, e.g. /blogs/slug
  meta: string;           // e.g. author name, episode number
}

function makeArticleId() {
  return Math.random().toString(36).slice(2, 10);
}

function articlesToHtml(articles: Article[]): string {
  return articles
    .map(
      (a) =>
        `<section data-article="${a.id}">` +
        (a.title ? `<h2 data-article-title>${a.title}</h2>` : "") +
        (a.image ? `<img data-article-image src="${a.image}" alt="" />` : "") +
        `<div data-article-body>${a.content}</div>` +
        `</section>`
    )
    .join("\n");
}

function embeddedItemsToHtml(items: EmbeddedItem[]): string {
  if (!items.length) return "";
  return items
    .map(
      (item) =>
        `<div data-embedded="${item.embedId}" data-embedded-type="${item.type}" data-embedded-id="${item.id}" data-embedded-url="${item.url}" data-embedded-cover="${item.coverImage}" data-embedded-meta="${item.meta}">` +
        (item.title ? `<span data-embedded-title>${item.title}</span>` : "") +
        (item.excerpt ? `<span data-embedded-excerpt>${item.excerpt}</span>` : "") +
        `</div>`
    )
    .join("\n");
}

function parseEmbeddedFromHtml(html: string): EmbeddedItem[] {
  if (!html || !html.includes("data-embedded=")) return [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  return Array.from(doc.querySelectorAll("[data-embedded]")).map((el) => ({
    embedId: el.getAttribute("data-embedded") || makeArticleId(),
    type: (el.getAttribute("data-embedded-type") || "blog") as EmbedType,
    id: el.getAttribute("data-embedded-id") || "",
    title: (el.querySelector("[data-embedded-title]") as HTMLElement)?.innerText || "",
    excerpt: (el.querySelector("[data-embedded-excerpt]") as HTMLElement)?.innerText || "",
    coverImage: el.getAttribute("data-embedded-cover") || "",
    url: el.getAttribute("data-embedded-url") || "",
    meta: el.getAttribute("data-embedded-meta") || "",
  }));
}

function parseArticlesFromHtml(html: string): Article[] | null {
  // Returns null if the HTML was not produced by articlesToHtml (legacy single body)
  if (!html || !html.includes('data-article=')) return null;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const sections = Array.from(doc.querySelectorAll("section[data-article]"));
  if (!sections.length) return null;
  return sections.map((sec) => ({
    id: sec.getAttribute("data-article") || makeArticleId(),
    title: (sec.querySelector("[data-article-title]") as HTMLElement)?.innerText || "",
    image: (sec.querySelector("[data-article-image]") as HTMLImageElement)?.src || "",
    content: (sec.querySelector("[data-article-body]") as HTMLElement)?.innerHTML || "",
  }));
}

const EMBED_TYPE_CONFIG: Record<EmbedType, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  blog:    { label: "Blog",    icon: BookOpen,      color: "text-violet-600", bgColor: "bg-violet-50" },
  podcast: { label: "Podcast", icon: Radio,         color: "text-rose-600",   bgColor: "bg-rose-50"   },
  post:    { label: "Post",    icon: MessageSquare, color: "text-sky-600",    bgColor: "bg-sky-50"    },
};

// ---- Constants ----
const AUTOSAVE_KEY_PREFIX = "newsletter_draft_";

export function AdminNewslettersPage() {
  const { user, adminUser } = useAuth();
  const { toast } = useToast();

  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"draft" | "scheduled" | "sent" | "failed">("draft");
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingNewsletter, setEditingNewsletter] = useState<NewsletterDetail | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Newsletter | null>(null);
  const [sendNowTarget, setSendNowTarget] = useState<Newsletter | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [testSendingId, setTestSendingId] = useState<string | null>(null);
  const [creditStatus, setCreditStatus] = useState<{ creditsOk: boolean | "unknown"; message: string } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  React.useEffect(() => { document.title = "Newsletters - Admin"; }, []);

  const getHeaders = useCallback(() => {
    const token = localStorage.getItem("auth_token") || "";
    const userId = adminUser?.id || user?.id || localStorage.getItem("userId") || "";
    return {
      "Content-Type": "application/json",
      "user-id": userId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, [adminUser?.id, user?.id]);

  const fetchNewsletters = useCallback(async (status?: string) => {
    setLoading(true);
    try {
      const qs = status ? `?status=${status}` : "";
      const res = await fetch(`/api/admin/newsletters${qs}`, { headers: getHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch");
      setNewsletters(data.newsletters || []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [getHeaders, toast]);

  const fetchCreditStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/newsletters/email-credits", { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setCreditStatus(data);
      }
    } catch {
      // non-critical — silently ignore
    }
  }, [getHeaders]);

  useEffect(() => {
    if (!adminUser?.id && !user?.id) return;
    fetchNewsletters();
    fetchCreditStatus();
  }, [adminUser?.id, user?.id]);

  // Poll for status updates when something is 'sending'
  useEffect(() => {
    const hasSending = newsletters.some((n) => n.status === "sending");
    if (hasSending && !pollRef.current) {
      pollRef.current = setInterval(() => fetchNewsletters(), 3000);
    } else if (!hasSending && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [newsletters, fetchNewsletters]);

  const openComposer = (newsletter?: NewsletterDetail) => {
    setEditingNewsletter(newsletter || null);
    setComposerOpen(true);
  };

  const openEditNewsletter = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/newsletters/${id}`, { headers: getHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch");
      openComposer(data.newsletter);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/admin/newsletters/${deleteTarget.id}`, {
        method: "DELETE",
        headers: getHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      toast({ title: "Deleted", description: "Newsletter deleted successfully" });
      setDeleteTarget(null);
      fetchNewsletters();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleSendNow = async () => {
    if (!sendNowTarget) return;
    setSendingId(sendNowTarget.id);
    try {
      const res = await fetch(`/api/admin/newsletters/${sendNowTarget.id}/send-now`, {
        method: "POST",
        headers: getHeaders(),
      });
      const data = await res.json();
      if (res.status !== 202 && !res.ok) throw new Error(data.error || "Send failed");
      toast({ title: "Sending started", description: "Newsletter is being sent in the background" });
      setSendNowTarget(null);
      setTimeout(() => fetchNewsletters(), 1000);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSendingId(null);
    }
  };

  const handleTestSend = async (newsletterId: string) => {
    setTestSendingId(newsletterId);
    try {
      const res = await fetch(`/api/admin/newsletters/${newsletterId}/test-send`, {
        method: "POST",
        headers: getHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Test send failed");
      toast({ title: "Test email sent", description: `Sent to ${data.sentTo}` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setTestSendingId(null);
    }
  };

  // 'scheduled' tab shows both scheduled and actively-sending newsletters
  const filteredNewsletters = newsletters.filter((n) =>
    activeTab === "scheduled"
      ? n.status === "scheduled" || n.status === "sending"
      : n.status === activeTab
  );

  const formatRecipientFilter = (n: Newsletter) => {
    const parts: string[] = [];
    if (n.recipient_role && n.recipient_role !== "all") parts.push(n.recipient_role);
    if (n.recipient_batch && n.recipient_batch !== "all") parts.push(n.recipient_batch);
    if (n.recipient_graduation_year && n.recipient_graduation_year !== "all") parts.push(`Class of ${n.recipient_graduation_year}`);
    if (n.recipient_department && n.recipient_department !== "all") parts.push(n.recipient_department);
    return parts.length > 0 ? parts.join(" · ") : "All alumni";
  };

  const statusBadge = (status: Newsletter["status"]) => {
    const map: Record<string, { label: string; className: string }> = {
      draft: { label: "Draft", className: "bg-gray-100 text-gray-700" },
      scheduled: { label: "Scheduled", className: "bg-blue-100 text-blue-700" },
      sending: { label: "Sending…", className: "bg-yellow-100 text-yellow-700" },
      sent: { label: "Sent", className: "bg-green-100 text-green-700" },
      failed: { label: "Failed", className: "bg-red-100 text-red-700" },
    };
    const { label, className } = map[status] || map.draft;
    return <Badge className={`${className} font-medium text-xs`}>{label}</Badge>;
  };

  const tabCounts = {
    draft: newsletters.filter((n) => n.status === "draft").length,
    scheduled: newsletters.filter((n) => n.status === "scheduled").length,
    sending: newsletters.filter((n) => n.status === "sending").length,
    sent: newsletters.filter((n) => n.status === "sent").length,
    failed: newsletters.filter((n) => n.status === "failed").length,
  };

  const totalDelivered = newsletters.filter(n => n.status === "sent").reduce((sum, n) => sum + n.sent_count, 0);
  const totalRecipients = newsletters.filter(n => n.status === "sent").reduce((sum, n) => sum + n.total_recipients, 0);
  const totalOpens = newsletters.filter(n => n.status === "sent").reduce((sum, n) => sum + (n.open_count || 0), 0);
  const overallRate = totalRecipients > 0 ? Math.round((totalDelivered / totalRecipients) * 100) : null;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar currentPage="newsletters" />

      <div className="flex-1 overflow-auto min-w-0">
        {/* Page header band */}
        <div className="bg-white border-b border-gray-200 px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-sky-50 rounded-xl">
                <Newspaper className="w-6 h-6 text-sky-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 leading-tight">Newsletters</h1>
                <p className="text-sm text-gray-500">Create and send newsletters to alumni</p>
              </div>
            </div>
            <Button
              onClick={() => openComposer()}
              className="bg-[#008060] hover:bg-[#006b51] text-white gap-2"
            >
              <Plus className="w-4 h-4" />
              New Newsletter
            </Button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* ZeptoMail credit warning */}
          {creditStatus && creditStatus.creditsOk === false && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span><strong>Email credits exhausted</strong> — newsletters cannot be sent. {creditStatus.message}</span>
            </div>
          )}

          {/* Stats cards */}
          {!loading && newsletters.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Drafts</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{tabCounts.draft}</p>
                <p className="text-xs text-gray-400 mt-0.5">waiting to send</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Scheduled</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{tabCounts.scheduled + tabCounts.sending}</p>
                <p className="text-xs text-gray-400 mt-0.5">queued for delivery</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <MailOpen className="w-4 h-4 text-green-500" />
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Sent</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{tabCounts.sent}</p>
                <p className="text-xs text-gray-400 mt-0.5">{totalDelivered.toLocaleString()} emails delivered</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Delivery Rate</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{overallRate !== null ? `${overallRate}%` : "—"}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {totalOpens > 0 ? `${totalOpens} opens tracked` : "across all campaigns"}
                </p>
              </div>
            </div>
          )}

          {/* Tabs + list */}
          <div className="bg-white rounded-xl border border-gray-200">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
              <div className="px-4 pt-4 border-b border-gray-100">
                <TabsList className="bg-transparent p-0 h-auto gap-1">
                  {([
                    { value: "draft", label: "Drafts", count: tabCounts.draft, countClass: "bg-gray-100 text-gray-600" },
                    { value: "scheduled", label: "Scheduled", count: tabCounts.scheduled + tabCounts.sending, countClass: "bg-blue-50 text-blue-600" },
                    { value: "sent", label: "Sent", count: tabCounts.sent, countClass: "bg-green-50 text-green-600" },
                    { value: "failed", label: "Failed", count: tabCounts.failed, countClass: "bg-red-50 text-red-600" },
                  ] as const).map(({ value, label, count, countClass }) => (
                    <TabsTrigger
                      key={value}
                      value={value}
                      className="relative px-3 py-2.5 text-sm font-medium text-gray-500 rounded-none border-b-2 border-transparent data-[state=active]:border-[#008060] data-[state=active]:text-[#008060] data-[state=active]:bg-transparent data-[state=active]:shadow-none transition-colors"
                    >
                      {label}
                      {count > 0 && (
                        <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs font-medium ${countClass}`}>
                          {count}
                        </span>
                      )}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              <div className="p-4">
                {(["draft", "scheduled", "sent", "failed"] as const).map((tab) => (
                  <TabsContent key={tab} value={tab} className="mt-0">
                    {loading ? (
                      <div className="flex items-center justify-center py-20 text-gray-400">
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        <span className="text-sm">Loading newsletters…</span>
                      </div>
                    ) : filteredNewsletters.length === 0 ? (
                      <div className="text-center py-16">
                        <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                          <Newspaper className="w-7 h-7 text-gray-300" />
                        </div>
                        <p className="text-sm font-medium text-gray-600">No {tab} newsletters</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {tab === "draft" && "Start writing your first newsletter."}
                          {tab === "scheduled" && "No newsletters are queued for delivery."}
                          {tab === "sent" && "Sent newsletters will appear here."}
                          {tab === "failed" && "No send failures — all good!"}
                        </p>
                        {tab === "draft" && (
                          <Button
                            size="sm"
                            className="mt-4 bg-[#008060] hover:bg-[#006b51] text-white gap-1.5"
                            onClick={() => openComposer()}
                          >
                            <Plus className="w-3.5 h-3.5" /> Create Newsletter
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredNewsletters.map((n) => (
                          <NewsletterRow
                            key={n.id}
                            newsletter={n}
                            statusBadge={statusBadge}
                            formatRecipientFilter={formatRecipientFilter}
                            onEdit={() => openEditNewsletter(n.id)}
                            onDelete={() => setDeleteTarget(n)}
                            onSendNow={() => setSendNowTarget(n)}
                            onTestSend={() => handleTestSend(n.id)}
                            isSending={sendingId === n.id || n.status === "sending"}
                            isTestSending={testSendingId === n.id}
                          />
                        ))}
                      </div>
                    )}
                  </TabsContent>
                ))}
              </div>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Composer Dialog */}
      {composerOpen && (
        <NewsletterComposerDialog
          open={composerOpen}
          newsletter={editingNewsletter}
          getHeaders={getHeaders}
          onClose={() => { setComposerOpen(false); setEditingNewsletter(null); }}
          onSaved={() => { setComposerOpen(false); setEditingNewsletter(null); fetchNewsletters(); }}
        />
      )}

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Newsletter?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.title}" will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send Now Confirm */}
      <AlertDialog open={!!sendNowTarget} onOpenChange={(o) => { if (!o) setSendNowTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Newsletter Now?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately email all matching recipients for "{sendNowTarget?.title}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-[#008060] hover:bg-[#006b51]" onClick={handleSendNow}>
              {sendingId ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Send Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---- Newsletter Row Component ----
function NewsletterRow({
  newsletter: n,
  statusBadge,
  formatRecipientFilter,
  onEdit,
  onDelete,
  onSendNow,
  onTestSend,
  isSending,
  isTestSending,
}: {
  newsletter: Newsletter;
  statusBadge: (s: Newsletter["status"]) => React.ReactNode;
  formatRecipientFilter: (n: Newsletter) => string;
  onEdit: () => void;
  onDelete: () => void;
  onSendNow: () => void;
  onTestSend: () => void;
  isSending: boolean;
  isTestSending: boolean;
}) {
  const canEdit = n.status !== "sending" && n.status !== "sent";
  const canDelete = n.status !== "sending";
  const canSend = n.status === "draft" || n.status === "scheduled" || n.status === "failed";
  const canTest = n.status !== "sending" && n.status !== "sent";
  const deliveryRate = n.total_recipients > 0 ? Math.round((n.sent_count / n.total_recipients) * 100) : null;
  const openRate = n.sent_count > 0 ? Math.round(((n.open_count || 0) / n.sent_count) * 100) : null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          {statusBadge(n.status)}
          {n.status === "sending" && <Loader2 className="w-3.5 h-3.5 animate-spin text-yellow-600" />}
        </div>

        <p className="font-semibold text-gray-900 text-base leading-snug truncate">{n.title}</p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3 flex-shrink-0" />
            {formatRecipientFilter(n)}
          </span>

          {n.status === "scheduled" && n.scheduled_at && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3 flex-shrink-0" />
              {new Date(n.scheduled_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
            </span>
          )}

          {n.status === "sent" && n.sent_at && (
            <span className="flex items-center gap-1">
              <CheckCircle className="w-3 h-3 flex-shrink-0 text-green-500" />
              {new Date(n.sent_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
            </span>
          )}

          {n.status === "failed" && (
            <span className="flex items-center gap-1 text-red-500">
              <AlertCircle className="w-3 h-3 flex-shrink-0" />
              Send failed — retry below
            </span>
          )}
        </div>

        {/* Delivery stats — sent & sending only */}
        {(n.status === "sent" || n.status === "sending") && n.total_recipients > 0 && (
          <div className="mt-2 inline-flex items-center gap-3 flex-wrap">
            <span className="text-xs text-gray-500">
              {n.sent_count} / {n.total_recipients} delivered
            </span>
            {deliveryRate !== null && (
              <div className="flex items-center gap-1.5">
                <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${n.status === "sending" ? "bg-yellow-400" : deliveryRate === 100 ? "bg-green-500" : "bg-green-400"}`}
                    style={{ width: `${deliveryRate}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-gray-600">{deliveryRate}%</span>
              </div>
            )}
            {n.status === "sent" && (n.open_count || 0) > 0 && openRate !== null && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <MailOpen className="w-3 h-3" />
                {n.open_count} opens ({openRate}%)
              </span>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0 sm:pt-0.5 flex-wrap">
        {canSend && (
          <Button
            size="sm"
            disabled={isSending}
            onClick={onSendNow}
            className="bg-[#008060] hover:bg-[#006b51] text-white gap-1.5 text-xs px-3"
          >
            {isSending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
            {n.status === "failed" ? "Retry" : "Send Now"}
          </Button>
        )}
        {canTest && (
          <Button
            size="sm"
            variant="outline"
            disabled={isTestSending}
            onClick={onTestSend}
            className="gap-1.5 text-xs px-3 text-sky-600 border-sky-200 hover:bg-sky-50"
            title="Send a test email to yourself"
          >
            {isTestSending ? <Loader2 className="w-3 h-3 animate-spin" /> : <MailOpen className="w-3 h-3" />}
            Test
          </Button>
        )}
        {canEdit && (
          <Button size="sm" variant="outline" onClick={onEdit} className="gap-1.5 text-xs px-3">
            <Edit className="w-3 h-3" />
            {n.status === "scheduled" ? "Reschedule" : "Edit"}
          </Button>
        )}
        {canDelete && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            className="text-red-400 hover:text-red-600 hover:bg-red-50 px-2"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ---- Newsletter Composer Dialog ----
interface ComposerProps {
  open: boolean;
  newsletter: NewsletterDetail | null;
  getHeaders: () => Record<string, string>;
  onClose: () => void;
  onSaved: () => void;
}

// ---- Inline TipTap toolbar ----
function ToolbarBtn({ onClick, active, title, children }: { onClick: () => void; active?: boolean; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={`px-2 py-1 rounded text-sm font-medium transition-colors ${active ? "bg-[#008060] text-white" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"}`}
    >
      {children}
    </button>
  );
}

function NlEditorToolbar({ editor }: { editor: any }) {
  if (!editor) return null;
  const addLink = () => {
    const url = window.prompt("Enter URL:");
    if (url) editor.chain().focus().extendMarkRange("link").setLink({ href: url, target: "_blank" }).run();
  };
  const addImage = () => {
    const url = window.prompt("Enter image URL:");
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };
  return (
    <div className="flex flex-wrap items-center gap-0.5 p-2 border-b border-gray-200 bg-gray-50 rounded-t-md">
      <ToolbarBtn title="H1" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })}>H1</ToolbarBtn>
      <ToolbarBtn title="H2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })}>H2</ToolbarBtn>
      <ToolbarBtn title="H3" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })}>H3</ToolbarBtn>
      <span className="w-px h-5 bg-gray-300 mx-1" />
      <ToolbarBtn title="Bold" onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")}><strong>B</strong></ToolbarBtn>
      <ToolbarBtn title="Italic" onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")}><em>I</em></ToolbarBtn>
      <ToolbarBtn title="Strikethrough" onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")}><s>S</s></ToolbarBtn>
      <ToolbarBtn title="Code" onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive("code")}><code className="font-mono text-xs">`c`</code></ToolbarBtn>
      <span className="w-px h-5 bg-gray-300 mx-1" />
      <ToolbarBtn title="Bullet list" onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")}>• List</ToolbarBtn>
      <ToolbarBtn title="Ordered list" onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")}>1. List</ToolbarBtn>
      <ToolbarBtn title="Blockquote" onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")}>" Quote</ToolbarBtn>
      <ToolbarBtn title="Code block" onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")}>{"</>"}</ToolbarBtn>
      <span className="w-px h-5 bg-gray-300 mx-1" />
      <ToolbarBtn title="Link" onClick={addLink} active={editor.isActive("link")}>🔗</ToolbarBtn>
      <ToolbarBtn title="Image" onClick={addImage}>🖼</ToolbarBtn>
    </div>
  );
}

// ---- Single article editor card ----
function ArticleEditorCard({
  article,
  index,
  total,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  article: Article;
  index: number;
  total: number;
  onChange: (updated: Article) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, autolink: true }),
      Image,
      CodeBlockLowlight.configure({ lowlight }),
    ],
    content: article.content || "",
    onUpdate: ({ editor }) => onChange({ ...article, content: editor.getHTML() }),
  });

  const initialized = useRef(false);
  useEffect(() => {
    if (editor && article.content && !initialized.current) {
      initialized.current = true;
      editor.commands.setContent(article.content);
    }
  }, [editor]);

  return (
    <div className="border border-gray-200 rounded-xl bg-white shadow-sm">
      {/* Card header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 bg-gray-50 rounded-t-xl">
        <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex-1">
          Article {index + 1}
        </span>
        <button
          type="button"
          disabled={index === 0}
          onClick={onMoveUp}
          className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Move up"
        >
          <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
        </button>
        <button
          type="button"
          disabled={index === total - 1}
          onClick={onMoveDown}
          className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Move down"
        >
          <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
        </button>
        {total > 1 && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600 ml-1"
            title="Remove article"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="p-4 space-y-3">
        {/* Article title */}
        <div>
          <Label className="text-xs">Article Title <span className="text-gray-400 font-normal">(optional)</span></Label>
          <input
            type="text"
            value={article.title}
            onChange={(e) => onChange({ ...article, title: e.target.value })}
            placeholder="e.g. Alumni Spotlight"
            maxLength={200}
            className="mt-1 w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#008060]/30 focus:border-[#008060]"
          />
        </div>

        {/* Article image */}
        <div>
          <Label className="text-xs">Image URL <span className="text-gray-400 font-normal">(optional)</span></Label>
          <input
            type="text"
            value={article.image}
            onChange={(e) => onChange({ ...article, image: e.target.value })}
            placeholder="https://…"
            className="mt-1 w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#008060]/30 focus:border-[#008060]"
          />
          {article.image && (
            <img
              src={article.image}
              alt="Article"
              className="mt-2 rounded-md h-20 object-cover"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          )}
        </div>

        {/* Article body */}
        <div>
          <Label className="text-xs">Body *</Label>
          <div
            className="mt-1 border border-gray-200 rounded-md overflow-hidden cursor-text"
            onClick={() => editor?.chain().focus().run()}
          >
            <NlEditorToolbar editor={editor} />
            <EditorContent
              editor={editor}
              className="prose prose-sm max-w-none min-h-[140px] p-3 focus-within:outline-none [&_.ProseMirror]:min-h-[120px] [&_.ProseMirror]:outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Content picker panel (blogs / podcasts / feed posts) ----
function ContentPickerPanel({
  getHeaders,
  attachedItems,
  onAttach,
  onDetach,
}: {
  getHeaders: () => Record<string, string>;
  attachedItems: EmbeddedItem[];
  onAttach: (item: EmbeddedItem) => void;
  onDetach: (embedId: string) => void;
}) {
  const [activeType, setActiveType] = useState<EmbedType>("blog");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const attachedIds = new Set(attachedItems.map((i) => i.id));

  const search = useCallback(async (type: EmbedType, q: string) => {
    setSearching(true);
    setResults([]);
    try {
      let url = "";
      if (type === "blog")    url = `/api/blogs?limit=10&search=${encodeURIComponent(q)}`;
      if (type === "podcast") url = `/api/podcasts?limit=10&search=${encodeURIComponent(q)}`;
      if (type === "post")    url = `/api/posts?limit=10&search=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: getHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      // Normalise across different response shapes
      const raw =
        data.blogs ?? data.podcasts ?? data.posts ?? data.feedPosts ?? [];
      setResults(raw);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [getHeaders]);

  // Debounced search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => search(activeType, query), 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [query, activeType, search]);

  // Reset query + results when tab changes
  const handleTabChange = (type: EmbedType) => {
    setActiveType(type);
    setQuery("");
    setResults([]);
  };

  const buildItem = (type: EmbedType, raw: any): EmbeddedItem => {
    if (type === "blog") return {
      embedId: makeArticleId(),
      type,
      id: raw.id,
      title: raw.title || "",
      excerpt: raw.excerpt || "",
      coverImage: raw.cover_image || "",
      url: `/blogs/${raw.slug}`,
      meta: raw.author
        ? `${raw.author.first_name || ""} ${raw.author.last_name || ""}`.trim()
        : "",
    };
    if (type === "podcast") return {
      embedId: makeArticleId(),
      type,
      id: raw.id,
      title: raw.title || "",
      excerpt: raw.description || "",
      coverImage: "",
      url: `/podcasts`,
      meta: raw.episode_number ? `Episode ${raw.episode_number}` : "",
    };
    // post
    return {
      embedId: makeArticleId(),
      type,
      id: raw.id,
      title: "",
      excerpt: raw.content ? raw.content.slice(0, 140) : "",
      coverImage: raw.image_url || "",
      url: `/feed`,
      meta: raw.author_first_name
        ? `${raw.author_first_name} ${raw.author_last_name || ""}`.trim()
        : "",
    };
  };

  return (
    <div className="space-y-4">
      {/* Type tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
        {(["blog", "podcast", "post"] as EmbedType[]).map((t) => {
          const cfg = EMBED_TYPE_CONFIG[t];
          const Icon = cfg.icon;
          return (
            <button
              key={t}
              type="button"
              onClick={() => handleTabChange(t)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeType === t
                  ? `bg-white shadow-sm ${cfg.color}`
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {cfg.label}s
            </button>
          );
        })}
      </div>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${EMBED_TYPE_CONFIG[activeType].label.toLowerCase()}s…`}
          className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#008060]/30 focus:border-[#008060]"
        />
        {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 animate-spin" />}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100 max-h-64 overflow-y-auto">
          {results.map((raw) => {
            const item = buildItem(activeType, raw);
            const alreadyAttached = attachedIds.has(item.id);
            const cfg = EMBED_TYPE_CONFIG[activeType];
            const Icon = cfg.icon;
            return (
              <div key={raw.id} className="flex items-start gap-3 p-3 hover:bg-gray-50 transition-colors">
                {item.coverImage ? (
                  <img
                    src={item.coverImage}
                    alt=""
                    className="w-12 h-12 rounded-md object-cover flex-shrink-0"
                    onError={(e) => (e.currentTarget.style.display = "none")}
                  />
                ) : (
                  <div className={`w-12 h-12 rounded-md flex items-center justify-center flex-shrink-0 ${cfg.bgColor}`}>
                    <Icon className={`w-5 h-5 ${cfg.color}`} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate leading-snug">
                    {item.title || item.excerpt.slice(0, 60) || "Untitled"}
                  </p>
                  {item.meta && <p className="text-xs text-gray-400 mt-0.5">{item.meta}</p>}
                  {item.excerpt && item.title && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{item.excerpt}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => alreadyAttached ? onDetach(attachedItems.find((i) => i.id === item.id)!.embedId) : onAttach(item)}
                  className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                    alreadyAttached
                      ? "bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-600"
                      : "bg-[#008060] text-white hover:bg-[#006b51]"
                  }`}
                >
                  {alreadyAttached ? "Remove" : "Attach"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {!searching && query && results.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-4">
          No {EMBED_TYPE_CONFIG[activeType].label.toLowerCase()}s found for "{query}"
        </p>
      )}

      {!query && results.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-4">
          Search to find {EMBED_TYPE_CONFIG[activeType].label.toLowerCase()}s to attach
        </p>
      )}

      {/* Attached items */}
      {attachedItems.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Attached ({attachedItems.length})</p>
          <div className="space-y-1.5">
            {attachedItems.map((item) => {
              const cfg = EMBED_TYPE_CONFIG[item.type];
              const Icon = cfg.icon;
              return (
                <div key={item.embedId} className="flex items-center gap-2.5 p-2.5 border border-gray-200 rounded-lg bg-white">
                  <div className={`w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 ${cfg.bgColor}`}>
                    <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">
                      {item.title || item.excerpt.slice(0, 50) || "Untitled"}
                    </p>
                    <p className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</p>
                  </div>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-gray-600 p-1"
                    title="Preview"
                  >
                    <Link2 className="w-3 h-3" />
                  </a>
                  <button
                    type="button"
                    onClick={() => onDetach(item.embedId)}
                    className="text-gray-400 hover:text-red-500 p-1"
                    title="Remove"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function NewsletterComposerDialog({ open, newsletter, getHeaders, onClose, onSaved }: ComposerProps) {
  const { toast } = useToast();
  const isEdit = !!newsletter;
  const autosaveKey = AUTOSAVE_KEY_PREFIX + (newsletter?.id || "new");

  const [title, setTitle] = useState(newsletter?.title || "");
  const [excerpt, setExcerpt] = useState(newsletter?.excerpt || "");
  const [coverImage, setCoverImage] = useState(newsletter?.cover_image || "");
  const [recipientRole, setRecipientRole] = useState(newsletter?.recipient_role || "all");
  const [recipientBatch, setRecipientBatch] = useState(newsletter?.recipient_batch || "all");
  const [recipientGradYear, setRecipientGradYear] = useState(newsletter?.recipient_graduation_year || "all");
  const [recipientDepartment, setRecipientDepartment] = useState(newsletter?.recipient_department || "all");
  const [deliveryMode, setDeliveryMode] = useState<"draft" | "schedule" | "send_now">("draft");
  const [scheduledAt, setScheduledAt] = useState(newsletter?.scheduled_at
    ? new Date(newsletter.scheduled_at).toISOString().slice(0, 16)
    : ""
  );
  const [saving, setSaving] = useState(false);
  const [previewConfirmOpen, setPreviewConfirmOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState<"schedule" | "send_now" | null>(null);

  // Articles state — parse from existing newsletter content or start with one blank article
  const [articles, setArticles] = useState<Article[]>(() => {
    if (newsletter?.content) {
      const parsed = parseArticlesFromHtml(newsletter.content);
      if (parsed) return parsed;
      // Legacy single-body content — wrap in one article
      return [{ id: makeArticleId(), title: "", image: "", content: newsletter.content }];
    }
    return [{ id: makeArticleId(), title: "", image: "", content: "" }];
  });

  const [embeddedItems, setEmbeddedItems] = useState<EmbeddedItem[]>(() =>
    newsletter?.content ? parseEmbeddedFromHtml(newsletter.content) : []
  );

  const getContent = () =>
    articlesToHtml(articles) + (embeddedItems.length ? "\n" + embeddedItemsToHtml(embeddedItems) : "");

  // Dynamic filter options fetched from DB
  const [filterOptions, setFilterOptions] = useState<{
    batches: string[];
    departments: string[];
    graduationYears: string[];
    roles: string[];
  }>({ batches: [], departments: [], graduationYears: [], roles: [] });

  useEffect(() => {
    fetch("/api/admin/newsletters/filter-options", { headers: getHeaders() })
      .then((r) => r.json())
      .then((data) => {
        if (data.batches) setFilterOptions(data);
      })
      .catch(() => {});
  }, []);
  const [recipientPreview, setRecipientPreview] = useState<RecipientPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore autosave draft (new newsletters only)
  useEffect(() => {
    if (!isEdit) {
      const saved = localStorage.getItem(autosaveKey);
      if (saved) {
        try {
          const d = JSON.parse(saved);
          setHasDraft(true);
          setTitle(d.title || "");
          setExcerpt(d.excerpt || "");
          setCoverImage(d.coverImage || "");
          setRecipientRole(d.recipientRole || "all");
          setRecipientBatch(d.recipientBatch || "all");
          setRecipientGradYear(d.recipientGradYear || "all");
          setRecipientDepartment(d.recipientDepartment || "all");
          if (d.articles) setArticles(d.articles);
          if (d.embeddedItems) setEmbeddedItems(d.embeddedItems);
        } catch {/* ignore malformed */ }
      }
    }
  }, []);

  // Autosave: localStorage for new newsletters, server PUT for existing drafts
  const content = getContent();
  useEffect(() => {
    if (!title && articles.every((a) => !a.content) && !embeddedItems.length) return;

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);

    if (!isEdit) {
      autosaveTimerRef.current = setTimeout(() => {
        localStorage.setItem(autosaveKey, JSON.stringify({
          title, excerpt, articles, embeddedItems, coverImage, recipientRole, recipientBatch, recipientGradYear, recipientDepartment,
        }));
      }, 5000);
    } else if (newsletter?.status === "draft") {
      autosaveTimerRef.current = setTimeout(async () => {
        try {
          await fetch(`/api/admin/newsletters/${newsletter.id}`, {
            method: "PUT",
            headers: getHeaders(),
            body: JSON.stringify({
              title, excerpt, content,
              cover_image: coverImage,
              recipient_role: recipientRole,
              recipient_batch: recipientBatch,
              recipient_graduation_year: recipientGradYear,
              recipient_department: recipientDepartment,
            }),
          });
        } catch { /* silent autosave failure */ }
      }, 5000);
    }

    return () => { if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current); };
  }, [title, excerpt, articles, embeddedItems, coverImage, recipientRole, recipientBatch, recipientGradYear, recipientDepartment]);

  const clearDraft = () => localStorage.removeItem(autosaveKey);

  const previewRecipients = async () => {
    setPreviewLoading(true);
    try {
      const res = await fetch("/api/admin/newsletters/recipients/preview-filters", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          role: recipientRole,
          batch: recipientBatch,
          graduationYear: recipientGradYear,
          department: recipientDepartment,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setRecipientPreview(data);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setPreviewLoading(false);
    }
  };

  const validate = () => {
    if (!title.trim() || title.trim().length < 3) return "Title must be at least 3 characters";
    const allText = articles.map((a) => a.content.replace(/<[^>]*>/g, "").trim()).join(" ");
    if (allText.length < 10) return "At least one article must have content (at least 10 characters)";
    if (deliveryMode === "schedule" && !scheduledAt) return "Scheduled date/time is required";
    if (deliveryMode === "schedule" && scheduledAt) {
      const utc = new Date(scheduledAt + "+05:30");
      if (utc <= new Date()) return "Scheduled time must be in the future";
    }
    return null;
  };

  const handleSaveWithPreview = (mode: "draft" | "schedule" | "send_now") => {
    if (mode === "send_now" || mode === "schedule") {
      const err = validate();
      if (err) { toast({ title: "Validation error", description: err, variant: "destructive" }); return; }
      setPendingMode(mode);
      setPreviewConfirmOpen(true);
      return;
    }
    handleSave("draft");
  };

  const handleSave = async (mode: "draft" | "schedule" | "send_now") => {
    const err = validate();
    if (err) { toast({ title: "Validation error", description: err, variant: "destructive" }); return; }

    setSaving(true);
    try {
      const body: Record<string, any> = {
        title: title.trim(),
        excerpt: excerpt.trim() || null,
        content: getContent(),
        cover_image: coverImage.trim() || null,
        recipient_role: recipientRole,
        recipient_batch: recipientBatch,
        recipient_graduation_year: recipientGradYear,
        recipient_department: recipientDepartment,
        status: mode === "schedule" ? "scheduled" : "draft",
        scheduled_at: mode === "schedule" ? scheduledAt : null,
      };

      const url = isEdit ? `/api/admin/newsletters/${newsletter!.id}` : "/api/admin/newsletters";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, { method, headers: getHeaders(), body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");

      const savedId = data.newsletter?.id ?? newsletter?.id;

      if (mode === "send_now" && savedId) {
        const sendRes = await fetch(`/api/admin/newsletters/${savedId}/send-now`, {
          method: "POST",
          headers: getHeaders(),
        });
        const sendData = await sendRes.json();
        if (sendRes.status !== 202 && !sendRes.ok) throw new Error(sendData.error || "Send failed");
        clearDraft();
        toast({ title: "Sending started", description: "Newsletter is being sent in the background" });
        onSaved();
        return;
      }

      clearDraft();
      toast({
        title: isEdit ? "Updated" : "Saved",
        description: mode === "schedule" ? "Newsletter scheduled successfully" : "Draft saved",
      });
      onSaved();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const isPastDate = scheduledAt ? new Date(scheduledAt + "+05:30") <= new Date() : false;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-sky-600" />
            {isEdit ? "Edit Newsletter" : "New Newsletter"}
          </DialogTitle>
        </DialogHeader>

        {hasDraft && !isEdit && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-700 flex items-center justify-between">
            <span>Restored unsaved draft</span>
            <button onClick={() => { setHasDraft(false); clearDraft(); }} className="underline text-xs">Discard</button>
          </div>
        )}

        <div className="space-y-6">
          {/* Section 1: Content */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Content</h3>

            <div>
              <Label htmlFor="nl-title">Newsletter Title *</Label>
              <Input
                id="nl-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. TKS Alumni Newsletter – June 2026"
                maxLength={200}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="nl-excerpt">Excerpt <span className="text-gray-400 font-normal">(optional)</span></Label>
              <Textarea
                id="nl-excerpt"
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                placeholder="A brief summary shown in the newsletter archive…"
                rows={2}
                maxLength={300}
                className="mt-1 resize-none"
              />
              <p className="text-xs text-gray-400 mt-1">{excerpt.length}/300</p>
            </div>

            <div>
              <Label htmlFor="nl-cover">Cover Image URL <span className="text-gray-400 font-normal">(optional)</span></Label>
              <Input
                id="nl-cover"
                value={coverImage}
                onChange={(e) => setCoverImage(e.target.value)}
                placeholder="https://…"
                className="mt-1"
              />
              {coverImage && (
                <img
                  src={coverImage}
                  alt="Cover preview"
                  className="mt-2 rounded-md h-24 object-cover"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              )}
            </div>

            {/* Articles */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Articles / Sections *
                </Label>
                <span className="text-xs text-gray-400">{articles.length} article{articles.length !== 1 ? "s" : ""}</span>
              </div>

              <div className="space-y-3">
                {articles.map((article, idx) => (
                  <ArticleEditorCard
                    key={article.id}
                    article={article}
                    index={idx}
                    total={articles.length}
                    onChange={(updated) =>
                      setArticles((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
                    }
                    onRemove={() =>
                      setArticles((prev) => prev.filter((a) => a.id !== article.id))
                    }
                    onMoveUp={() =>
                      setArticles((prev) => {
                        const next = [...prev];
                        [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                        return next;
                      })
                    }
                    onMoveDown={() =>
                      setArticles((prev) => {
                        const next = [...prev];
                        [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                        return next;
                      })
                    }
                  />
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setArticles((prev) => [
                    ...prev,
                    { id: makeArticleId(), title: "", image: "", content: "" },
                  ])
                }
                className="gap-2 w-full border-dashed text-[#008060] border-[#008060]/40 hover:bg-green-50"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Article / Section
              </Button>
            </div>
          </div>

          {/* Section 2: Attach Content */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Attach Content
              </h3>
              {embeddedItems.length > 0 && (
                <span className="text-xs font-medium text-[#008060] bg-green-50 px-2 py-0.5 rounded-full">
                  {embeddedItems.length} attached
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">
              Attach published blogs, podcasts, or feed posts to feature them in this newsletter.
            </p>
            <ContentPickerPanel
              getHeaders={getHeaders}
              attachedItems={embeddedItems}
              onAttach={(item) => setEmbeddedItems((prev) => [...prev, item])}
              onDetach={(embedId) => setEmbeddedItems((prev) => prev.filter((i) => i.embedId !== embedId))}
            />
          </div>

          {/* Section 3: Recipients */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Recipients</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Role</Label>
                <Select value={recipientRole} onValueChange={setRecipientRole}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All roles</SelectItem>
                    {filterOptions.roles.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r.charAt(0).toUpperCase() + r.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Batch</Label>
                <Select value={recipientBatch} onValueChange={setRecipientBatch}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All batches</SelectItem>
                    {filterOptions.batches.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Graduation Year</Label>
                <Select value={recipientGradYear} onValueChange={setRecipientGradYear}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All years</SelectItem>
                    {filterOptions.graduationYears.map((y) => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Department</Label>
                <Select value={recipientDepartment} onValueChange={setRecipientDepartment}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All departments</SelectItem>
                    {filterOptions.departments.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button variant="outline" size="sm" onClick={previewRecipients} disabled={previewLoading} className="gap-2">
              {previewLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
              Preview Recipients
            </Button>

            {recipientPreview && (
              <div className="text-sm text-gray-600 bg-gray-50 border rounded-md p-3">
                <span className="font-medium text-gray-800">{recipientPreview.count}</span> recipients match these filters.
                {recipientPreview.users.slice(0, 3).map((u) => (
                  <span key={u.id} className="ml-1 text-xs text-gray-500">· {u.name}</span>
                ))}
                {recipientPreview.count > 3 && <span className="text-xs text-gray-400"> and {recipientPreview.count - 3} more</span>}
              </div>
            )}
          </div>

          {/* Section 3: Delivery */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Delivery</h3>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeliveryMode("draft")}
                className={`flex-1 border rounded-md p-3 text-sm text-left transition-colors ${deliveryMode === "draft" ? "border-[#008060] bg-green-50 text-[#008060]" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
              >
                <div className="font-medium">Save as Draft</div>
                <div className="text-xs text-gray-400 mt-0.5">Send manually later</div>
              </button>
              <button
                type="button"
                onClick={() => setDeliveryMode("schedule")}
                className={`flex-1 border rounded-md p-3 text-sm text-left transition-colors ${deliveryMode === "schedule" ? "border-[#008060] bg-green-50 text-[#008060]" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
              >
                <div className="font-medium">Schedule</div>
                <div className="text-xs text-gray-400 mt-0.5">Auto-send at a specific time</div>
              </button>
              <button
                type="button"
                onClick={() => setDeliveryMode("send_now")}
                className={`flex-1 border rounded-md p-3 text-sm text-left transition-colors ${deliveryMode === "send_now" ? "border-[#008060] bg-green-50 text-[#008060]" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
              >
                <div className="font-medium flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5" />
                  Send Now
                </div>
                <div className="text-xs text-gray-400 mt-0.5">Publish &amp; send immediately</div>
              </button>
            </div>

            {deliveryMode === "schedule" && (
              <div>
                <Label htmlFor="nl-schedule" className="text-xs">Date & Time (IST)</Label>
                <Input
                  id="nl-schedule"
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className={`mt-1 ${isPastDate ? "border-red-400" : ""}`}
                  min={(() => {
                    const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
                    return nowIST.toISOString().slice(0, 16);
                  })()}
                />
                {isPastDate && <p className="text-xs text-red-500 mt-1">Scheduled time is in the past</p>}
                <p className="text-xs text-gray-400 mt-1">Times are in IST (Asia/Kolkata, UTC+05:30)</p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="mt-6 flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          {(deliveryMode === "schedule" || deliveryMode === "send_now") && (
            <Button
              variant="outline"
              onClick={() => handleSave("draft")}
              disabled={saving}
              className="gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Save as Draft Instead
            </Button>
          )}
          <Button
            onClick={() => handleSaveWithPreview(deliveryMode)}
            disabled={saving || (deliveryMode === "schedule" && isPastDate)}
            className="bg-[#008060] hover:bg-[#006b51] text-white gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : deliveryMode === "send_now" ? <Send className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
            {deliveryMode === "schedule" ? "Schedule Newsletter" : deliveryMode === "send_now" ? "Send Now" : "Save Draft"}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Full preview + confirm dialog */}
      <Dialog open={previewConfirmOpen} onOpenChange={(o) => { if (!o) { setPreviewConfirmOpen(false); setPendingMode(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <CheckCircle className="w-5 h-5 text-[#008060]" />
              Confirm &amp; {pendingMode === "send_now" ? "Send" : "Schedule"} Newsletter
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Review the newsletter below before confirming. This action{" "}
              {pendingMode === "send_now" ? "will immediately send emails to all recipients" : "will schedule the newsletter for delivery"}.
            </p>

            {/* Preview card */}
            <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
              {coverImage && (
                <img
                  src={coverImage}
                  alt="Cover"
                  className="w-full h-40 object-cover"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              )}
              <div className="p-5 space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 leading-tight">{title || <span className="text-gray-400 italic">Untitled</span>}</h2>
                  {excerpt && <p className="text-sm text-gray-500 italic mt-1">{excerpt}</p>}
                </div>
                {articles.map((a, i) => (
                  <div key={a.id} className={i > 0 ? "border-t border-gray-100 pt-4" : ""}>
                    {a.title && <h3 className="text-base font-semibold text-gray-800 mb-2">{a.title}</h3>}
                    {a.image && (
                      <img
                        src={a.image}
                        alt=""
                        className="rounded-md mb-2 max-h-32 object-cover"
                        onError={(e) => (e.currentTarget.style.display = "none")}
                      />
                    )}
                    <div
                      className="prose prose-sm max-w-none text-gray-700"
                      dangerouslySetInnerHTML={{ __html: a.content }}
                    />
                  </div>
                ))}

                {embeddedItems.length > 0 && (
                  <div className="border-t border-gray-100 pt-4 space-y-2">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Attached Content</p>
                    {embeddedItems.map((item) => {
                      const cfg = EMBED_TYPE_CONFIG[item.type];
                      const Icon = cfg.icon;
                      return (
                        <div key={item.embedId} className={`flex items-start gap-3 p-3 rounded-lg border border-gray-100 ${cfg.bgColor}`}>
                          <div className={`w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0 bg-white border border-gray-200`}>
                            <Icon className={`w-4 h-4 ${cfg.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-semibold uppercase tracking-wide mb-0.5 ${cfg.color}`}>{cfg.label}</p>
                            <p className="text-sm font-medium text-gray-900 leading-snug">
                              {item.title || item.excerpt.slice(0, 80) || "Untitled"}
                            </p>
                            {item.meta && <p className="text-xs text-gray-400 mt-0.5">{item.meta}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Meta summary */}
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 space-y-2 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <Users className="w-4 h-4 flex-shrink-0 text-gray-400" />
                <span>
                  Recipients:{" "}
                  <span className="font-medium text-gray-800">
                    {[
                      recipientRole !== "all" ? recipientRole : null,
                      recipientBatch !== "all" ? recipientBatch : null,
                      recipientGradYear !== "all" ? `Class of ${recipientGradYear}` : null,
                      recipientDepartment !== "all" ? recipientDepartment : null,
                    ].filter(Boolean).join(" · ") || "All alumni"}
                  </span>
                  {recipientPreview && (
                    <span className="ml-2 text-gray-500">({recipientPreview.count} matched)</span>
                  )}
                </span>
              </div>
              {pendingMode === "schedule" && scheduledAt && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar className="w-4 h-4 flex-shrink-0 text-gray-400" />
                  <span>
                    Scheduled for:{" "}
                    <span className="font-medium text-gray-800">
                      {new Date(scheduledAt + "+05:30").toLocaleString("en-IN", { dateStyle: "full", timeStyle: "short" })} IST
                    </span>
                  </span>
                </div>
              )}
              {pendingMode === "send_now" && (
                <div className="flex items-center gap-2 text-amber-600">
                  <Send className="w-4 h-4 flex-shrink-0" />
                  <span className="font-medium">Will be sent immediately upon confirmation</span>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="mt-4 flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => { setPreviewConfirmOpen(false); setPendingMode(null); }}
              disabled={saving}
            >
              Go Back &amp; Edit
            </Button>
            <Button
              onClick={() => {
                setPreviewConfirmOpen(false);
                handleSave(pendingMode!);
                setPendingMode(null);
              }}
              disabled={saving}
              className="bg-[#008060] hover:bg-[#006b51] text-white gap-2"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : pendingMode === "send_now" ? (
                <Send className="w-4 h-4" />
              ) : (
                <Clock className="w-4 h-4" />
              )}
              {pendingMode === "send_now" ? "Yes, Send Now" : "Yes, Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
