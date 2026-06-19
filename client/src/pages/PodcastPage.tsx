import React, { useState, useEffect, useCallback, useRef } from "react";
import { Mic2, Play, Search, ExternalLink, ChevronDown, ChevronUp, Eye, Calendar } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PodcastLink {
  label: string;
  url: string;
}

interface Episode {
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
  status: string;
  published_at: string | null;
  views_count: number;
  is_featured: boolean;
}

interface PodcastPageProps {
  slug?: string;
}

export function PodcastPage({ slug }: PodcastPageProps) {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeTag, setActiveTag] = useState("");
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const autoOpenedRef = useRef(false);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Fetch all tags once (unfiltered) so the tag bar never collapses when a filter is active
  useEffect(() => {
    fetch("/api/podcasts?limit=200")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.episodes) {
          const tags = Array.from(new Set<string>(data.episodes.flatMap((e: Episode) => e.tags)));
          setAllTags(tags);
        }
      })
      .catch(() => {});
  }, []);

  const fetchEpisodes = useCallback(async (pg: number, reset = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pg), limit: "12" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (activeTag) params.set("tag", activeTag);
      const res = await fetch(`/api/podcasts?${params}`);
      const data = await res.json();
      if (res.ok) {
        setEpisodes(prev => reset ? (data.episodes || []) : [...prev, ...(data.episodes || [])]);
        setTotalPages(data.totalPages || 1);
      }
    } catch {
      // silently fail — empty state shown
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, activeTag]);

  // Reset and reload when filters change
  useEffect(() => {
    setPage(1);
    fetchEpisodes(1, true);
  }, [debouncedSearch, activeTag]);

  // Auto-open episode by slug when navigating from feed
  useEffect(() => {
    if (!slug || autoOpenedRef.current || loading || episodes.length === 0) return;
    const match = episodes.find(e => e.slug === slug);
    if (match) {
      autoOpenedRef.current = true;
      openEpisode(match);
    } else if (!loading) {
      // Episode not in current page — fetch it directly by slug
      autoOpenedRef.current = true;
      fetch(`/api/podcasts/${slug}`)
        .then(r => r.ok ? r.json() : null)
        .then(ep => { if (ep) openEpisode(ep); })
        .catch(() => {});
    }
  }, [slug, episodes, loading]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchEpisodes(next, false);
  };

  // Track which episode IDs we've already fired a view for in this session
  const viewedRef = useRef<Set<string>>(new Set());

  const openEpisode = (ep: Episode) => {
    setSelectedEpisode(ep);
    setShowNotes(false);

    if (!viewedRef.current.has(ep.id)) {
      viewedRef.current.add(ep.id);
      const adminUserRaw = localStorage.getItem("adminUser");
      const adminUserId = adminUserRaw ? JSON.parse(adminUserRaw)?.id : null;
      const userId =
        localStorage.getItem("userId") ||
        adminUserId ||
        localStorage.getItem("auth_user_id") ||
        "";
      if (userId) {
        fetch(`/api/podcasts/${ep.id}/view`, {
          method: "POST",
          headers: { "user-id": userId },
        })
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (data?.views_count !== undefined) {
              setEpisodes(prev =>
                prev.map(e => e.id === ep.id ? { ...e, views_count: data.views_count } : e)
              );
              setSelectedEpisode(prev =>
                prev?.id === ep.id ? { ...prev, views_count: data.views_count } : prev
              );
            }
          })
          .catch(() => {});
      }
    }
  };

  return (
    <AppLayout currentPage="podcast">
      <div className="max-w-[1400px] mx-auto py-8 px-4 sm:px-6">
        {/* Header */}
        <div className="mb-6">
<p className="text-sm text-gray-500 mt-1">
            Stories, insights, and inspiration from the TKS alumni community.
          </p>
        </div>

        {/* Search + Tag Filters */}
        <div className="mb-6 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search episodes..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 bg-white border-gray-200 focus:border-[#008060] focus:ring-[#008060]/20"
              />
            </div>
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors whitespace-nowrap"
              >
                Clear search
              </button>
            )}
          </div>
          {allTags.length > 0 && (
            <div className="flex gap-2 flex-wrap items-center">
              <span className="text-xs text-gray-400 font-medium mr-1">Filter:</span>
              <button
                onClick={() => setActiveTag("")}
                className={`text-xs px-3 py-1 rounded-full border transition-colors font-medium ${
                  activeTag === ""
                    ? "bg-[#008060] text-white border-[#008060]"
                    : "bg-white text-gray-600 border-gray-200 hover:border-[#008060] hover:text-[#008060]"
                }`}
              >
                All
              </button>
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setActiveTag(activeTag === tag ? "" : tag)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors font-medium ${
                    activeTag === tag
                      ? "bg-[#008060] text-white border-[#008060]"
                      : "bg-white text-gray-600 border-gray-200 hover:border-[#008060] hover:text-[#008060]"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Episodes Grid */}
        {loading && episodes.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#008060] border-t-transparent mr-3" />
            Loading episodes...
          </div>
        ) : episodes.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Mic2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-semibold text-gray-600">No episodes found</p>
            <p className="text-sm mt-1">
              {debouncedSearch || activeTag ? "Try adjusting your search or filter." : "Episodes will appear here once they're published."}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {episodes.map(ep => (
                <EpisodeCard key={ep.id} episode={ep} onOpen={openEpisode} />
              ))}
            </div>

            {page < totalPages && (
              <div className="flex justify-center mt-8">
                <Button
                  variant="outline"
                  onClick={loadMore}
                  disabled={loading}
                  className="gap-2 border-gray-200 hover:border-[#008060] hover:text-[#008060]"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#008060] border-t-transparent" />
                  ) : null}
                  Load More Episodes
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Episode Modal */}
      <Dialog open={!!selectedEpisode} onOpenChange={() => setSelectedEpisode(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
          {selectedEpisode && (
            <>
              {/* Video */}
              {selectedEpisode.embed_url ? (
                <div className="aspect-video w-full bg-black rounded-t-lg overflow-hidden">
                  <iframe
                    src={selectedEpisode.embed_url}
                    className="w-full h-full"
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    title={selectedEpisode.title}
                  />
                </div>
              ) : (
                <div className="aspect-video w-full bg-gray-100 rounded-t-lg flex flex-col items-center justify-center gap-3">
                  <Play className="w-12 h-12 text-gray-300" />
                  <a
                    href={selectedEpisode.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[#008060] hover:underline flex items-center gap-1"
                  >
                    Watch on platform <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              <div className="p-5 space-y-4">
                <DialogHeader>
                  <div className="flex items-start gap-2">
                    {selectedEpisode.episode_number && (
                      <span className="flex-shrink-0 text-xs bg-[#e6f5f0] text-[#008060] font-semibold rounded px-2 py-0.5 mt-0.5">
                        Ep {selectedEpisode.episode_number}
                      </span>
                    )}
                    <DialogTitle className="text-lg font-bold text-gray-900 leading-tight">
                      {selectedEpisode.title}
                    </DialogTitle>
                  </div>
                </DialogHeader>

                {/* Tags */}
                {selectedEpisode.tags.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap">
                    {selectedEpisode.tags.map(t => (
                      <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                    ))}
                  </div>
                )}

                {/* Description */}
                {selectedEpisode.description && (
                  <p className="text-sm text-gray-700 leading-relaxed">{selectedEpisode.description}</p>
                )}

                {/* Show Notes Toggle */}
                {selectedEpisode.show_notes && (
                  <div className="border border-gray-100 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setShowNotes(s => !s)}
                      className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      Show Notes
                      {showNotes ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    {showNotes && (
                      <div className="px-4 py-3 text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                        {selectedEpisode.show_notes}
                      </div>
                    )}
                  </div>
                )}

                {/* External Links */}
                {selectedEpisode.links.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Resources & Links</p>
                    <ul className="space-y-1.5">
                      {selectedEpisode.links.map((link, i) => (
                        <li key={i}>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-[#008060] hover:text-[#006b51] hover:underline"
                          >
                            <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                            {link.label || link.url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Meta row */}
                <div className="flex items-center gap-4 text-xs text-gray-400 pt-1 border-t border-gray-100">
                  {selectedEpisode.published_at && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(selectedEpisode.published_at).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function getThumbnailUrl(videoUrl: string, embedUrl: string | null): string | null {
  const sources = [videoUrl, embedUrl].filter(Boolean) as string[];
  for (const url of sources) {
    // YouTube: youtube.com/watch?v=ID or youtu.be/ID or youtube.com/embed/ID
    const ytMatch = url.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
    );
    if (ytMatch) return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;

    // Vimeo: vimeo.com/ID or player.vimeo.com/video/ID
    const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vimeoMatch) return `https://vumbnail.com/${vimeoMatch[1]}.jpg`;
  }
  return null;
}

function EpisodeCard({ episode, onOpen }: { episode: Episode; onOpen: (ep: Episode) => void }) {
  const thumbnailUrl = getThumbnailUrl(episode.video_url, episode.embed_url);

  return (
    <Card
      className="border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col cursor-pointer group"
      onClick={() => onOpen(episode)}
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 relative overflow-hidden">
        {thumbnailUrl ? (
          <>
            <img
              src={thumbnailUrl}
              alt={episode.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {/* play overlay */}
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-200">
                <Play className="w-5 h-5 text-[#008060] ml-0.5" />
              </div>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-white/80 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-200">
              <Play className="w-5 h-5 text-[#008060] ml-0.5" />
            </div>
          </div>
        )}
        {episode.is_featured && (
          <div className="absolute top-2 left-2">
            <span className="text-[10px] bg-amber-500 text-white font-semibold px-2 py-0.5 rounded-full shadow">
              Featured
            </span>
          </div>
        )}
        {episode.episode_number && (
          <div className="absolute top-2 right-2">
            <span className="text-[10px] bg-black/60 text-white font-semibold px-2 py-0.5 rounded-full">
              Ep {episode.episode_number}
            </span>
          </div>
        )}
      </div>

      <CardContent className="p-4 flex flex-col flex-1">
        <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 leading-snug mb-1 group-hover:text-[#008060] transition-colors">
          {episode.title}
        </h3>
        <p className="text-xs text-gray-500 line-clamp-2 mb-3 leading-relaxed flex-1 min-h-[2.5rem]">
          {episode.description ?? ""}
        </p>

        <div className="mt-auto space-y-3">
          {episode.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {episode.tags.slice(0, 3).map(t => (
                <Badge key={t} variant="secondary" className="text-[10px] py-0">{t}</Badge>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-[10px] text-gray-400">
              <Play className="w-3 h-3" />
              Watch episode
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
