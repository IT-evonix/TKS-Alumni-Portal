import React, { useState, useEffect, useRef } from "react";
import { PenSquare, BookOpen, ChevronLeft, ChevronRight, Edit } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BlogCard } from "@/components/blogs/BlogCard";
import { BlogFilterBar } from "@/components/blogs/BlogFilterBar";
import { BlogEditor } from "@/components/blogs/BlogEditor";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { clientConfig } from "@/lib/config";

export function BlogsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Listing state
  const [posts, setPosts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const limit = 9;

  // Filter state
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // BUG 5 FIX: track current search so fetchPosts can be called with explicit params
  const searchRef = useRef(search);

  // Categories
  const [categories, setCategories] = useState<any[]>([]);

  // My posts tab
  const [myPosts, setMyPosts] = useState<any[]>([]);
  const [myPostsLoading, setMyPostsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  // Editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<any>(null);

  // Popular tags derived from posts
  const popularTags = React.useMemo(() => {
    const tagCounts: Record<string, number> = {};
    posts.forEach((p) => (p.tags || []).forEach((t: string) => { tagCounts[t] = (tagCounts[t] || 0) + 1; }));
    return Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t);
  }, [posts]);

  React.useEffect(() => { document.title = "Blogs - TKS Alumni Portal"; }, []);

  const getHeaders = () => {
    const token = localStorage.getItem("auth_token") || "";
    return {
      "user-id": user?.id || localStorage.getItem("userId") || "",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  // Fetch categories once
  useEffect(() => {
    fetch(`${clientConfig.apiUrl}/api/blogs/categories`)
      .then((r) => r.json())
      .then((d) => setCategories(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  // Fetch when page, category, or tag changes (but NOT search — search uses debounce below)
  useEffect(() => {
    fetchPosts();
  }, [page, selectedCategory, selectedTag]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search: reset to page 1 and fetch in one shot.
  // BUG 5 FIX: if page is already 1 we pass the new search directly to fetchPosts.
  // If page > 1 we call setPage(1) which triggers the effect above — but we also
  // pass the search override so we don't wait for a stale-closure re-render.
  useEffect(() => {
    searchRef.current = search;
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      if (page !== 1) {
        setPage(1); // triggers [page] effect which will call fetchPosts with updated searchRef
      } else {
        fetchPosts({ page: 1, search }); // already on page 1 — fetch directly
      }
    }, 300);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  // BUG 5 FIX: fetchPosts accepts explicit overrides so the debounce and page-change
  // effects never both fire for the same query.
  const fetchPosts = async (overrides?: { page?: number; search?: string }) => {
    const effectivePage = overrides?.page ?? page;
    const effectiveSearch = overrides?.search !== undefined ? overrides.search : searchRef.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: effectivePage.toString(),
        limit: limit.toString(),
        ...(effectiveSearch ? { search: effectiveSearch } : {}),
        ...(selectedCategory ? { category: selectedCategory } : {}),
        ...(selectedTag ? { tag: selectedTag } : {}),
      });
      const res = await fetch(`${clientConfig.apiUrl}/api/blogs?${params}`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
        setTotal(data.total || 0);
      }
    } catch (e) {
      console.error("Failed to fetch blogs", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyPosts = async () => {
    if (!user) return;
    setMyPostsLoading(true);
    try {
      const res = await fetch(`${clientConfig.apiUrl}/api/blogs/my/posts`, { headers: getHeaders() });
      if (res.ok) setMyPosts(await res.json());
    } catch (e) {
      console.error("Failed to fetch my posts", e);
    } finally {
      setMyPostsLoading(false);
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === "mine") fetchMyPosts();
  };

  const handleLike = async (postId: string) => {
    if (!user) { toast({ title: "Sign in to like posts", variant: "destructive" }); return; }
    try {
      const res = await fetch(`${clientConfig.apiUrl}/api/blogs/${postId}/like`, {
        method: "POST",
        headers: getHeaders(),
      });
      if (res.ok) {
        const { liked } = await res.json();
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? { ...p, viewer_has_liked: liked, likes_count: p.likes_count + (liked ? 1 : -1) }
              : p
          )
        );
      }
    } catch {}
  };

  const handleBookmark = async (postId: string) => {
    if (!user) { toast({ title: "Sign in to bookmark posts", variant: "destructive" }); return; }
    try {
      const res = await fetch(`${clientConfig.apiUrl}/api/blogs/${postId}/bookmark`, {
        method: "POST",
        headers: getHeaders(),
      });
      if (res.ok) {
        const { bookmarked } = await res.json();
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? { ...p, viewer_has_bookmarked: bookmarked, bookmarks_count: p.bookmarks_count + (bookmarked ? 1 : -1) }
              : p
          )
        );
      }
    } catch {}
  };

  const handleEditorSaved = (post: any) => {
    fetchPosts();
    if (activeTab === "mine") fetchMyPosts();
    setEditingPost(null);
  };

  const handleEditPost = (post: any) => {
    setEditingPost(post);
    setEditorOpen(true);
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm("Delete this post? This cannot be undone.")) return;
    try {
      const res = await fetch(`${clientConfig.apiUrl}/api/blogs/${postId}`, {
        method: "DELETE",
        headers: getHeaders(),
      });
      if (res.ok) {
        setMyPosts((prev) => prev.filter((p) => p.id !== postId));
        toast({ title: "Post deleted" });
      }
    } catch {
      toast({ title: "Failed to delete post", variant: "destructive" });
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <AppLayout currentPage="blogs">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-[#008060]" />
              Blogs
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Insights and stories from the TKS community</p>
          </div>
          {user && (
            <Button
              className="bg-[#008060] hover:bg-[#006b51]"
              onClick={() => { setEditingPost(null); setEditorOpen(true); }}
            >
              <PenSquare className="h-4 w-4 mr-2" />
              Write a Blog
            </Button>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="bg-gray-100">
            <TabsTrigger value="all">All Posts {total > 0 && <span className="ml-1.5 text-xs bg-white px-1.5 py-0.5 rounded-full text-gray-600">{total}</span>}</TabsTrigger>
            {user && <TabsTrigger value="mine">My Blogs</TabsTrigger>}
          </TabsList>

          {/* All Posts tab */}
          <TabsContent value="all" className="space-y-5 mt-4">
            <BlogFilterBar
              categories={categories}
              search={search}
              selectedCategory={selectedCategory}
              selectedTag={selectedTag}
              popularTags={popularTags}
              onSearchChange={(v) => { setSearch(v); setPage(1); }}
              onCategoryChange={(v) => { setSelectedCategory(v); setPage(1); }}
              onTagChange={(v) => { setSelectedTag(v); setPage(1); }}
            />

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="animate-pulse rounded-xl overflow-hidden border border-gray-200">
                    <div className="bg-gray-200" style={{ height: "160px" }} />
                    <div className="p-4 space-y-3">
                      <div className="h-3 bg-gray-200 rounded w-1/3" />
                      <div className="h-5 bg-gray-200 rounded w-5/6" />
                      <div className="h-4 bg-gray-100 rounded w-full" />
                      <div className="h-4 bg-gray-100 rounded w-4/5" />
                    </div>
                  </div>
                ))}
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-lg font-medium">No blogs found</p>
                <p className="text-sm mt-1">
                  {search || selectedCategory || selectedTag
                    ? "Try adjusting your filters"
                    : "Be the first to write a blog post!"}
                </p>
                {user && !search && !selectedCategory && !selectedTag && (
                  <Button
                    className="mt-4 bg-[#008060] hover:bg-[#006b51]"
                    onClick={() => { setEditingPost(null); setEditorOpen(true); }}
                  >
                    <PenSquare className="h-4 w-4 mr-2" />
                    Write a Blog
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {posts.map((post) => (
                    <BlogCard
                      key={post.id}
                      post={post}
                      onLike={handleLike}
                      onBookmark={handleBookmark}
                    />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <span className="text-sm text-gray-500">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* My Blogs tab */}
          {user && (
            <TabsContent value="mine" className="mt-4">
              {myPostsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse rounded-xl overflow-hidden border border-gray-200">
                      <div className="bg-gray-200" style={{ height: "160px" }} />
                      <div className="p-4 space-y-3">
                        <div className="h-5 bg-gray-200 rounded w-5/6" />
                        <div className="h-4 bg-gray-100 rounded w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : myPosts.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <PenSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-lg font-medium">No posts yet</p>
                  <p className="text-sm mt-1">Start writing your first blog post!</p>
                  <Button
                    className="mt-4 bg-[#008060] hover:bg-[#006b51]"
                    onClick={() => { setEditingPost(null); setEditorOpen(true); }}
                  >
                    <PenSquare className="h-4 w-4 mr-2" />
                    Write a Blog
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {myPosts.map((post) => (
                    <div key={post.id} className="relative group">
                      <BlogCard post={post} showStatus />
                      {/* Edit/Delete overlay for own posts in draft/rejected */}
                      {["draft", "rejected"].includes(post.status) && (
                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-7 px-2 text-xs shadow"
                            onClick={() => handleEditPost(post)}
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 px-2 text-xs shadow"
                            onClick={() => handleDeletePost(post.id)}
                          >
                            ✕
                          </Button>
                        </div>
                      )}
                      {/* Rejection reason */}
                      {post.status === "rejected" && post.rejection_reason && (
                        <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                          <span className="font-medium">Rejected: </span>{post.rejection_reason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Blog Editor Dialog */}
      <BlogEditor
        open={editorOpen}
        onClose={() => { setEditorOpen(false); setEditingPost(null); }}
        onSaved={handleEditorSaved}
        categories={categories}
        editPost={editingPost}
      />
    </AppLayout>
  );
}
