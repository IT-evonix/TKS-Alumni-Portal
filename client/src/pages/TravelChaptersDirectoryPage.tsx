import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { TravelPostCard } from "@/components/travel/TravelPostCard";
import { TravelPostCreateModal } from "@/components/travel/TravelPostCreateModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, Plus, Loader2, Search, Globe, Bookmark } from "lucide-react";
import { clientConfig } from "@/lib/config";

function getHeaders() {
  const token = localStorage.getItem("auth_token") || "";
  return {
    "user-id": localStorage.getItem("userId") || "",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

type Tab = "all" | "mine" | "bookmarks";

export default function TravelChaptersDirectoryPage() {
  const [location, navigate] = useLocation();
  const initialTab = (new URLSearchParams(location.split("?")[1] ?? "").get("tab") as Tab | null) ?? "all";
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [cityFilter, setCityFilter] = useState("");
  const [debouncedCity, setDebouncedCity] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingPost, setEditingPost] = useState<any | null>(null);
  const [page, setPage] = useState(1);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleCityInput(v: string) {
    setCityFilter(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setDebouncedCity(v); setPage(1); }, 400);
  }

  const feedQuery = useQuery({
    queryKey: ["travel-posts", activeTab, debouncedCity, page],
    queryFn: async () => {
      let url: string;
      if (activeTab === "mine") {
        url = `${clientConfig.apiUrl}/api/travel-posts/my-posts`;
      } else if (activeTab === "bookmarks") {
        url = `${clientConfig.apiUrl}/api/travel-posts/bookmarks`;
      } else {
        const params = new URLSearchParams({ page: String(page), limit: "12" });
        if (debouncedCity.trim()) params.set("city", debouncedCity.trim());
        url = `${clientConfig.apiUrl}/api/travel-posts?${params}`;
      }
      const res = await fetch(url, { headers: getHeaders() });
      if (!res.ok) throw new Error("Failed to load posts");
      const data = await res.json();
      if (Array.isArray(data)) return { posts: data, total: data.length, page: 1, limit: data.length };
      return data as { posts: any[]; total: number; page: number; limit: number };
    },
    staleTime: 30_000,
  });

  const posts: any[] = (feedQuery.data as any)?.posts ?? [];
  const total: number = (feedQuery.data as any)?.total ?? 0;
  const totalPages = Math.ceil(total / 12);
  const isLoading = feedQuery.isLoading;
  const isError = feedQuery.isError;

  return (
    <AppLayout currentPage="city-chapter">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Globe className="w-6 h-6 text-blue-500" />
              City Chapter
            </h1>
            <p className="text-sm text-gray-500 mt-1">Stories from alumni across the globe</p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="gap-2 bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Share Story
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 mb-4 w-fit">
          {(["all", "mine", "bookmarks"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setActiveTab(t); setPage(1); }}
              className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-all ${
                activeTab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "bookmarks" ? (
                <span className="flex items-center gap-1"><Bookmark className="w-3.5 h-3.5" /> Saved</span>
              ) : t === "mine" ? "My Posts" : "All Stories"}
            </button>
          ))}
        </div>

        {/* City filter — only on "all" tab */}
        {activeTab === "all" && (
          <div className="relative mb-5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={cityFilter}
              onChange={(e) => handleCityInput(e.target.value)}
              placeholder="Filter by city…"
              className="pl-9"
            />
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : isError ? (
          <div className="text-center py-16 text-red-500">Failed to load posts. Please refresh.</div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            {activeTab === "bookmarks" ? (
              <>
                <Bookmark className="w-12 h-12 mx-auto text-gray-300" />
                <p className="text-gray-500 font-medium">No saved posts yet</p>
                <p className="text-sm text-gray-400">Bookmark posts you want to revisit later</p>
              </>
            ) : activeTab === "mine" ? (
              <>
                <MapPin className="w-12 h-12 mx-auto text-gray-300" />
                <p className="text-gray-500 font-medium">You haven't shared any stories yet</p>
                <Button onClick={() => setShowCreate(true)} size="sm" className="mt-2 gap-1">
                  <Plus className="w-4 h-4" /> Share your first story
                </Button>
              </>
            ) : debouncedCity ? (
              <>
                <MapPin className="w-12 h-12 mx-auto text-gray-300" />
                <p className="text-gray-500 font-medium">No posts from "{debouncedCity}" yet</p>
                <p className="text-sm text-gray-400">Be the first to share a story from there!</p>
              </>
            ) : (
              <>
                <Globe className="w-12 h-12 mx-auto text-gray-300" />
                <p className="text-gray-500 font-medium">No travel stories yet</p>
                <p className="text-sm text-gray-400">Be the first to share your journey!</p>
                <Button onClick={() => setShowCreate(true)} size="sm" className="mt-2 gap-1 bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4" /> Share a story
                </Button>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {posts.map((post: any) => (
                <TravelPostCard
                  key={post.id}
                  post={post}
                  onClick={() => navigate(`/city-chapter/${post.id}`)}
                  isOwnPost={activeTab === "mine"}
                  onEdit={activeTab === "mine" ? () => setEditingPost(post) : undefined}
                />
              ))}
            </div>

            {/* Pagination — only for "all" tab */}
            {activeTab === "all" && totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <TravelPostCreateModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => feedQuery.refetch()}
      />

      <TravelPostCreateModal
        open={!!editingPost}
        editPost={editingPost}
        onClose={() => setEditingPost(null)}
        onCreated={() => {
          setEditingPost(null);
          feedQuery.refetch();
        }}
      />
    </AppLayout>
  );
}
