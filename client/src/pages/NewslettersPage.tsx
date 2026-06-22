import React, { useState, useEffect, useCallback } from "react";
import DOMPurify from "dompurify";
import { ArrowLeft, Newspaper, Calendar, Users, Loader2, ChevronDown } from "lucide-react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface NewsletterSummary {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image: string | null;
  sent_at: string;
  sent_count: number;
  total_recipients: number;
}

interface NewsletterDetail extends NewsletterSummary {
  content: string;
  recipient_role: string;
}

interface NewslettersPageProps {
  slug?: string;
}

const EMBED_LABEL: Record<string, string> = {
  blog: "Blog Post", podcast: "Podcast", post: "Community Post", pdf: "PDF Document",
};
const EMBED_ACCENT: Record<string, string> = {
  blog: "#7c3aed", podcast: "#e11d48", post: "#0284c7", pdf: "#d97706",
};

/** Convert data-embedded blocks to visible styled cards before DOMPurify strips data-* attributes. */
function renderEmbeddedCards(html: string): string {
  if (!html.includes("data-embedded=")) return html;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  doc.querySelectorAll("[data-embedded]").forEach((el) => {
    const type = el.getAttribute("data-embedded-type") || "blog";
    const url = el.getAttribute("data-embedded-url") || "#";
    const cover = el.getAttribute("data-embedded-cover") || "";
    const meta = el.getAttribute("data-embedded-meta") || "";
    const titleEl = el.querySelector("[data-embedded-title]");
    const excerptEl = el.querySelector("[data-embedded-excerpt]");
    const title = titleEl?.textContent?.trim() || "";
    const excerpt = excerptEl?.textContent?.trim() || "";
    const label = EMBED_LABEL[type] || "Featured";
    const accent = EMBED_ACCENT[type] || "#008060";
    const isPdf = type === "pdf";
    const fullUrl = /^https?:\/\//i.test(url) ? url : url;

    const card = doc.createElement("div");
    card.setAttribute(
      "style",
      `margin:20px 0;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;border-top:4px solid ${accent};box-shadow:0 2px 8px rgba(0,0,0,0.06);`
    );
    card.innerHTML = `
      <div style="padding:8px 20px;background:#f9fafb;border-bottom:1px solid #f0f0f0;">
        <span style="font-size:11px;font-weight:700;color:${accent};text-transform:uppercase;letter-spacing:0.1em;">${label}</span>
      </div>
      ${cover ? `<img src="${cover}" alt="" style="width:100%;height:180px;object-fit:cover;display:block;" />` : ""}
      <div style="padding:18px 22px;">
        ${meta ? `<p style="font-size:12px;color:#9ca3af;margin:0 0 6px 0;">${meta}</p>` : ""}
        ${title ? `<p style="font-size:17px;font-weight:700;color:#111827;margin:0 0 8px 0;line-height:1.3;">${title}</p>` : ""}
        ${excerpt ? `<p style="font-size:14px;color:#4b5563;line-height:1.6;margin:0 0 14px 0;">${excerpt.slice(0, 200)}${excerpt.length > 200 ? "…" : ""}</p>` : ""}
        ${!title && !excerpt ? `<p style="font-size:14px;color:#6b7280;margin:0 0 14px 0;">${isPdf ? "Click below to open the document." : "No preview available."}</p>` : ""}
        <a href="${fullUrl}" target="_blank" rel="noopener noreferrer"
          style="display:inline-block;padding:9px 22px;background:${accent};color:#fff;font-size:13px;font-weight:700;border-radius:50px;text-decoration:none;">
          ${isPdf ? "View PDF →" : "Read more →"}
        </a>
      </div>`;
    el.replaceWith(card);
  });
  return doc.body.innerHTML;
}

export function NewslettersPage({ slug }: NewslettersPageProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [newsletters, setNewsletters] = useState<NewsletterSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [detail, setDetail] = useState<NewsletterDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  React.useEffect(() => {
    document.title = slug && detail
      ? `${detail.title} - TKS Alumni`
      : "Newsletters - TKS Alumni";
  }, [slug, detail]);

  const getHeaders = useCallback(() => {
    const token = localStorage.getItem("auth_token") || "";
    const userId = user?.id || localStorage.getItem("userId") || "";
    return {
      "Content-Type": "application/json",
      "user-id": userId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, [user?.id]);

  // Fetch list
  const fetchNewsletters = useCallback(async (p = 1, append = false) => {
    if (p === 1) setLoading(true);
    else setLoadingMore(true);
    try {
      const res = await fetch(`/api/newsletters?page=${p}&limit=12`, { headers: getHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setTotal(data.total || 0);
      setNewsletters((prev) => append ? [...prev, ...(data.newsletters || [])] : (data.newsletters || []));
      setPage(p);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [getHeaders, toast]);

  // Fetch single newsletter detail by slug
  const fetchDetail = useCallback(async (s: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/newsletters/${encodeURIComponent(s)}`, { headers: getHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Not found");
      setDetail(data.newsletter);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setLocation("/newsletters");
    } finally {
      setDetailLoading(false);
    }
  }, [getHeaders, toast, setLocation]);

  useEffect(() => {
    if (!user?.id) return;
    if (slug) {
      fetchDetail(slug);
    } else {
      fetchNewsletters(1);
    }
  }, [user?.id, slug]);

  const hasMore = newsletters.length < total;

  // ---- Detail view ----
  if (slug) {
    if (detailLoading) {
      return (
        <AppLayout>
          <div className="flex items-center justify-center min-h-64 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading newsletter…
          </div>
        </AppLayout>
      );
    }

    if (!detail) return null;

    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto px-4 py-6">
          <Button
            variant="ghost"
            className="mb-4 gap-2 text-gray-600"
            onClick={() => setLocation("/newsletters")}
          >
            <ArrowLeft className="w-4 h-4" /> Back to Newsletters
          </Button>

          {detail.cover_image && (
            <img
              src={detail.cover_image}
              alt={detail.title}
              className="w-full h-56 object-cover rounded-xl mb-6"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          )}

          <div className="flex items-center gap-2 mb-3 text-xs text-gray-400">
            <Calendar className="w-3.5 h-3.5" />
            {new Date(detail.sent_at).toLocaleDateString("en-IN", { dateStyle: "long" })}
            <span>·</span>
            <Users className="w-3.5 h-3.5" />
            Sent to {detail.total_recipients} recipients
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{detail.title}</h1>
          {detail.excerpt && <p className="text-gray-500 italic mb-6">{detail.excerpt}</p>}

          <hr className="border-gray-200 mb-6" />

          {/* Render TipTap HTML — same approach as BlogDetailPage */}
          <div
            className="prose prose-sm sm:prose max-w-none text-gray-700
              prose-headings:text-gray-900 prose-a:text-[#008060] prose-a:underline
              prose-blockquote:border-l-[#008060] prose-blockquote:bg-green-50 prose-blockquote:py-1 prose-blockquote:pl-4"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderEmbeddedCards(detail.content), { ADD_ATTR: ["target", "rel"] }) }}
          />

          <hr className="border-gray-200 mt-8 mb-4" />
          <p className="text-xs text-gray-400 text-center">
            You received this newsletter as a member of the TKS Alumni community.
          </p>
        </div>
      </AppLayout>
    );
  }

  // ---- List view ----
  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-sky-50 rounded-lg">
            <Newspaper className="w-6 h-6 text-sky-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Alumni Newsletters</h1>
            <p className="text-sm text-gray-500">Stay updated with news and stories from TKS</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center min-h-48 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
          </div>
        ) : newsletters.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Newspaper className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No newsletters published yet</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {newsletters.map((n) => (
                <NewsletterCard
                  key={n.id}
                  newsletter={n}
                  onClick={() => setLocation(`/newsletters/${n.slug}`)}
                />
              ))}
            </div>

            {hasMore && (
              <div className="mt-6 text-center">
                <Button
                  variant="outline"
                  onClick={() => fetchNewsletters(page + 1, true)}
                  disabled={loadingMore}
                  className="gap-2"
                >
                  {loadingMore
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <ChevronDown className="w-4 h-4" />
                  }
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}

function NewsletterCard({ newsletter: n, onClick }: { newsletter: NewsletterSummary; onClick: () => void }) {
  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow border border-gray-200 overflow-hidden"
      onClick={onClick}
    >
      {n.cover_image && (
        <img
          src={n.cover_image}
          alt={n.title}
          className="w-full h-36 object-cover"
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
      )}
      {!n.cover_image && (
        <div className="w-full h-20 bg-gradient-to-br from-sky-50 to-sky-100 flex items-center justify-center">
          <Newspaper className="w-8 h-8 text-sky-300" />
        </div>
      )}
      <CardContent className="p-4">
        <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 mb-1">{n.title}</h3>
        {n.excerpt && <p className="text-xs text-gray-500 line-clamp-2 mb-2">{n.excerpt}</p>}
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {new Date(n.sent_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {n.total_recipients}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
