import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Plus, Send, Trash2, Edit, Clock, CheckCircle, AlertCircle,
  Users, Loader2, Newspaper, Calendar, MailOpen, TrendingUp, FileText,
} from "lucide-react";
import { useLocation } from "wouter";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

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

export function AdminNewslettersPage() {
  const { user, adminUser } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"draft" | "scheduled" | "sent" | "failed">("draft");
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

  const fetchNewsletters = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/newsletters", { headers: getHeaders() });
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
    } catch { /* non-critical */ }
  }, [getHeaders]);

  useEffect(() => {
    if (!adminUser?.id && !user?.id) return;
    fetchNewsletters();
    fetchCreditStatus();
  }, [adminUser?.id, user?.id]);

  // Poll while something is sending
  useEffect(() => {
    const hasSending = newsletters.some((n) => n.status === "sending");
    if (hasSending && !pollRef.current) {
      pollRef.current = setInterval(() => fetchNewsletters(), 3000);
    } else if (!hasSending && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [newsletters, fetchNewsletters]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/admin/newsletters/${deleteTarget.id}`, { method: "DELETE", headers: getHeaders() });
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
      const res = await fetch(`/api/admin/newsletters/${sendNowTarget.id}/send-now`, { method: "POST", headers: getHeaders() });
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
      const res = await fetch(`/api/admin/newsletters/${newsletterId}/test-send`, { method: "POST", headers: getHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Test send failed");
      toast({ title: "Test email sent", description: `Sent to ${data.sentTo}` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setTestSendingId(null);
    }
  };

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

  const totalDelivered = newsletters.filter((n) => n.status === "sent").reduce((s, n) => s + n.sent_count, 0);
  const totalRecipients = newsletters.filter((n) => n.status === "sent").reduce((s, n) => s + n.total_recipients, 0);
  const totalOpens = newsletters.filter((n) => n.status === "sent").reduce((s, n) => s + (n.open_count || 0), 0);
  const overallRate = totalRecipients > 0 ? Math.round((totalDelivered / totalRecipients) * 100) : null;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar currentPage="newsletters" />

      <div className="flex-1 overflow-auto min-w-0">
        {/* Page header */}
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
              onClick={() => navigate("/admin/newsletters/new")}
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
                      key={value} value={value}
                      className="relative px-3 py-2.5 text-sm font-medium text-gray-500 rounded-none border-b-2 border-transparent data-[state=active]:border-[#008060] data-[state=active]:text-[#008060] data-[state=active]:bg-transparent data-[state=active]:shadow-none transition-colors"
                    >
                      {label}
                      {count > 0 && (
                        <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs font-medium ${countClass}`}>{count}</span>
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
                            onClick={() => navigate("/admin/newsletters/new")}
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
                            onEdit={() => navigate(`/admin/newsletters/${n.id}/edit`)}
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
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDelete}>Delete</AlertDialogAction>
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
  newsletter: n, statusBadge, formatRecipientFilter, onEdit, onDelete, onSendNow, onTestSend, isSending, isTestSending,
}: {
  newsletter: Newsletter;
  statusBadge: (s: Newsletter["status"]) => React.ReactNode;
  formatRecipientFilter: (n: Newsletter) => string;
  onEdit: () => void; onDelete: () => void; onSendNow: () => void; onTestSend: () => void;
  isSending: boolean; isTestSending: boolean;
}) {
  const canEdit = n.status !== "sending" && n.status !== "sent";
  const canDelete = n.status !== "sending";
  const canSend = n.status === "draft" || n.status === "scheduled" || n.status === "failed";
  const canTest = n.status !== "sending" && n.status !== "sent";
  const deliveryRate = n.total_recipients > 0 ? Math.round((n.sent_count / n.total_recipients) * 100) : null;
  const openRate = n.sent_count > 0 ? Math.round(((n.open_count || 0) / n.sent_count) * 100) : null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          {statusBadge(n.status)}
          {n.status === "sending" && <Loader2 className="w-3.5 h-3.5 animate-spin text-yellow-600" />}
        </div>
        <p className="font-semibold text-gray-900 text-base leading-snug truncate">{n.title}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3 flex-shrink-0" />{formatRecipientFilter(n)}
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
              <AlertCircle className="w-3 h-3 flex-shrink-0" />Send failed — retry below
            </span>
          )}
        </div>
        {(n.status === "sent" || n.status === "sending") && n.total_recipients > 0 && (
          <div className="mt-2 inline-flex items-center gap-3 flex-wrap">
            <span className="text-xs text-gray-500">{n.sent_count} / {n.total_recipients} delivered</span>
            {deliveryRate !== null && (
              <div className="flex items-center gap-1.5">
                <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${n.status === "sending" ? "bg-yellow-400" : deliveryRate === 100 ? "bg-green-500" : "bg-green-400"}`} style={{ width: `${deliveryRate}%` }} />
                </div>
                <span className="text-xs font-medium text-gray-600">{deliveryRate}%</span>
              </div>
            )}
            {n.status === "sent" && (n.open_count || 0) > 0 && openRate !== null && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <MailOpen className="w-3 h-3" />{n.open_count} opens ({openRate}%)
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0 sm:pt-0.5 flex-wrap">
        {canSend && (
          <Button size="sm" disabled={isSending} onClick={onSendNow} className="bg-[#008060] hover:bg-[#006b51] text-white gap-1.5 text-xs px-3">
            {isSending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
            {n.status === "failed" ? "Retry" : "Send Now"}
          </Button>
        )}
        {canTest && (
          <Button size="sm" variant="outline" disabled={isTestSending} onClick={onTestSend} className="gap-1.5 text-xs px-3 text-sky-600 border-sky-200 hover:bg-sky-50" title="Send a test email to yourself">
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
          <Button size="sm" variant="ghost" onClick={onDelete} className="text-red-400 hover:text-red-600 hover:bg-red-50 px-2" title="Delete">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
