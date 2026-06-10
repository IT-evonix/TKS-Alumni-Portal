import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  CheckCircle, XCircle, Trash2, ExternalLink, Plus, Edit, Tag, BookOpen, AlertCircle
} from "lucide-react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { clientConfig } from "@/lib/config";

export function AdminBlogsPage() {
  const { user, adminUser } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [posts, setPosts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending_review");

  // Reject dialog
  const [rejectDialogPost, setRejectDialogPost] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [moderating, setModerating] = useState(false);

  // Blog detail dialog
  const [detailPost, setDetailPost] = useState<any>(null);

  // Category management
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [catName, setCatName] = useState("");
  const [catDescription, setCatDescription] = useState("");
  const [catColor, setCatColor] = useState("#008060");
  const [catSaving, setCatSaving] = useState(false);

  React.useEffect(() => { document.title = "Blog Management - Admin"; }, []);

  const getHeaders = () => {
    const token = localStorage.getItem("auth_token") || "";
    const userId = adminUser?.id || user?.id || localStorage.getItem("userId") || "";
    return {
      "Content-Type": "application/json",
      "user-id": userId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  useEffect(() => {
    if (!adminUser?.id && !user?.id) return;
    fetchPosts(activeTab);
    fetchCategories();
  }, [adminUser?.id, user?.id]);

  const fetchPosts = async (status: string) => {
    setLoading(true);
    try {
      const url =
        status === "pending_review"
          ? `${clientConfig.apiUrl}/api/blogs/admin/pending`
          : `${clientConfig.apiUrl}/api/blogs/admin/all?status=${status === "all" ? "" : status}`;
      const res = await fetch(url, { headers: getHeaders() });
      if (res.ok) setPosts(await res.json());
    } catch {
      toast({ title: "Failed to load posts", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${clientConfig.apiUrl}/api/blogs/categories`);
      if (res.ok) setCategories(await res.json());
    } catch {}
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    // BUG 4 FIX: categories tab manages its own data; don't call fetchPosts for it
    if (tab !== "categories") {
      fetchPosts(tab);
    }
  };

  const handleApprove = async (post: any) => {
    setModerating(true);
    try {
      const res = await fetch(`${clientConfig.apiUrl}/api/blogs/admin/${post.id}/approve`, {
        method: "PUT",
        headers: getHeaders(),
      });
      if (res.ok) {
        toast({ title: "Post approved and published!" });
        setPosts((prev) => prev.filter((p) => p.id !== post.id));
      }
    } catch {
      toast({ title: "Failed to approve", variant: "destructive" });
    } finally {
      setModerating(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectionReason.trim()) { toast({ title: "Enter a rejection reason", variant: "destructive" }); return; }
    setModerating(true);
    try {
      const res = await fetch(`${clientConfig.apiUrl}/api/blogs/admin/${rejectDialogPost.id}/reject`, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify({ rejection_reason: rejectionReason }),
      });
      if (res.ok) {
        toast({ title: "Post rejected." });
        setRejectDialogPost(null);
        setRejectionReason("");
        setPosts((prev) => prev.filter((p) => p.id !== rejectDialogPost.id));
      }
    } catch {
      toast({ title: "Failed to reject", variant: "destructive" });
    } finally {
      setModerating(false);
    }
  };

  const handleDelete = async (post: any) => {
    if (!confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${clientConfig.apiUrl}/api/blogs/admin/${post.id}`, {
        method: "DELETE",
        headers: getHeaders(),
      });
      if (res.ok) {
        toast({ title: "Post deleted." });
        setPosts((prev) => prev.filter((p) => p.id !== post.id));
      }
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  const openCategoryDialog = (cat?: any) => {
    setEditingCategory(cat || null);
    setCatName(cat?.name || "");
    setCatDescription(cat?.description || "");
    setCatColor(cat?.color || "#008060");
    setCategoryDialogOpen(true);
  };

  const handleSaveCategory = async () => {
    if (!catName.trim()) { toast({ title: "Category name required", variant: "destructive" }); return; }
    setCatSaving(true);
    try {
      const url = editingCategory
        ? `${clientConfig.apiUrl}/api/blogs/admin/categories/${editingCategory.id}`
        : `${clientConfig.apiUrl}/api/blogs/admin/categories`;
      const method = editingCategory ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify({ name: catName, description: catDescription, color: catColor }),
      });
      if (res.ok) {
        toast({ title: editingCategory ? "Category updated" : "Category created" });
        setCategoryDialogOpen(false);
        fetchCategories();
      }
    } catch {
      toast({ title: "Failed to save category", variant: "destructive" });
    } finally {
      setCatSaving(false);
    }
  };

  const handleDeleteCategory = async (cat: any) => {
    if (!confirm(`Delete category "${cat.name}"?`)) return;
    try {
      const res = await fetch(`${clientConfig.apiUrl}/api/blogs/admin/categories/${cat.id}`, {
        method: "DELETE",
        headers: getHeaders(),
      });
      if (res.ok) {
        toast({ title: "Category deleted" });
        setCategories((prev) => prev.filter((c) => c.id !== cat.id));
      }
    } catch {
      toast({ title: "Failed to delete category", variant: "destructive" });
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      draft: { label: "Draft", className: "bg-gray-100 text-gray-700" },
      pending_review: { label: "In Review", className: "bg-yellow-100 text-yellow-800" },
      published: { label: "Published", className: "bg-green-100 text-green-800" },
      rejected: { label: "Rejected", className: "bg-red-100 text-red-800" },
    };
    const s = map[status] || { label: status, className: "bg-gray-100 text-gray-600" };
    return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.className}`}>{s.label}</span>;
  };

  return (
    <div className="flex min-h-screen bg-white">
      <AdminSidebar currentPage="blogs" />
      <div className="flex-1 flex flex-col">
      <div className="max-w-6xl mx-auto w-full px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-[#008060]" />
              Blog Management
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Moderate posts and manage categories</p>
          </div>
          <Button variant="outline" onClick={() => setLocation("/blogs")}>
            <ExternalLink className="h-4 w-4 mr-2" />
            View Public Blog
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="bg-gray-100">
            <TabsTrigger value="pending_review" className="flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" />
              Pending Review
            </TabsTrigger>
            <TabsTrigger value="published">Published</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
            <TabsTrigger value="all">All Posts</TabsTrigger>
            <TabsTrigger value="categories" onClick={() => {}}>
              <Tag className="h-3.5 w-3.5 mr-1" />
              Categories
            </TabsTrigger>
          </TabsList>

          {/* Posts tabs */}
          {["pending_review", "published", "rejected", "all"].map((tab) => (
            <TabsContent key={tab} value={tab} className="mt-4">
              {loading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : posts.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>No posts in this category</p>
                </div>
              ) : (
                <div className="border rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead>Post</TableHead>
                        <TableHead>Author</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {posts.map((post) => {
                        const authorName = post.author
                          ? `${post.author.first_name || ""} ${post.author.last_name || ""}`.trim() || post.author.username
                          : "Unknown";
                        const initials = authorName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

                        return (
                          <TableRow key={post.id} className="hover:bg-gray-50">
                            <TableCell className="max-w-[280px]">
                              <p className="font-medium text-sm text-gray-900 line-clamp-1">{post.title}</p>
                              {post.excerpt && (
                                <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">{post.excerpt}</p>
                              )}
                              {post.rejection_reason && (
                                <p className="text-xs text-red-500 mt-0.5 line-clamp-1">
                                  Reason: {post.rejection_reason}
                                </p>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={post.author?.profile_picture} />
                                  <AvatarFallback className="text-xs bg-[#008060]/10 text-[#008060]">{initials}</AvatarFallback>
                                </Avatar>
                                <span className="text-sm text-gray-700 whitespace-nowrap">{authorName}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {post.category ? (
                                <Badge
                                  className="text-xs"
                                  style={{ backgroundColor: `${post.category.color}20`, color: post.category.color, border: `1px solid ${post.category.color}40` }}
                                >
                                  {post.category.name}
                                </Badge>
                              ) : (
                                <span className="text-xs text-gray-400">—</span>
                              )}
                            </TableCell>
                            <TableCell>{statusBadge(post.status)}</TableCell>
                            <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                              {new Date(post.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs text-gray-500"
                                  onClick={() => setDetailPost(post)}
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </Button>
                                {post.status === "pending_review" && (
                                  <>
                                    <Button
                                      size="sm"
                                      className="h-7 px-2 bg-green-600 hover:bg-green-700 text-xs"
                                      onClick={() => handleApprove(post)}
                                      disabled={moderating}
                                    >
                                      <CheckCircle className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2 border-red-300 text-red-600 hover:bg-red-50 text-xs"
                                      onClick={() => { setRejectDialogPost(post); setRejectionReason(""); }}
                                    >
                                      <XCircle className="h-3 w-3" />
                                    </Button>
                                  </>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-red-400 hover:text-red-600 hover:bg-red-50 text-xs"
                                  onClick={() => handleDelete(post)}
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

          {/* Categories tab */}
          <TabsContent value="categories" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">{categories.length} categories</p>
              <Button size="sm" className="bg-[#008060] hover:bg-[#006b51]" onClick={() => openCategoryDialog()}>
                <Plus className="h-4 w-4 mr-1" />
                New Category
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-xl bg-white">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                    <div>
                      <p className="font-medium text-sm text-gray-900">{cat.name}</p>
                      {cat.description && <p className="text-xs text-gray-400 line-clamp-1">{cat.description}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openCategoryDialog(cat)}>
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-red-400 hover:text-red-600"
                      onClick={() => handleDeleteCategory(cat)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Blog detail dialog */}
      <Dialog open={!!detailPost} onOpenChange={(o) => !o && setDetailPost(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold leading-snug pr-6">{detailPost?.title}</DialogTitle>
          </DialogHeader>
          {detailPost && (
            <div className="space-y-4 pt-1">
              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={detailPost.author?.profile_picture} />
                    <AvatarFallback className="text-xs bg-[#008060]/10 text-[#008060]">
                      {(detailPost.author
                        ? `${detailPost.author.first_name || ""} ${detailPost.author.last_name || ""}`.trim() || detailPost.author.username
                        : "?"
                      ).split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium text-gray-700">
                    {detailPost.author
                      ? `${detailPost.author.first_name || ""} ${detailPost.author.last_name || ""}`.trim() || detailPost.author.username
                      : "Unknown"}
                  </span>
                </div>
                <span>·</span>
                <span>{new Date(detailPost.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
                <span>·</span>
                {statusBadge(detailPost.status)}
                {detailPost.category && (
                  <>
                    <span>·</span>
                    <Badge
                      className="text-xs"
                      style={{ backgroundColor: `${detailPost.category.color}20`, color: detailPost.category.color, border: `1px solid ${detailPost.category.color}40` }}
                    >
                      {detailPost.category.name}
                    </Badge>
                  </>
                )}
              </div>

              {/* Cover image */}
              {detailPost.cover_image_url && (
                <img
                  src={detailPost.cover_image_url}
                  alt="Cover"
                  className="w-full h-48 object-cover rounded-lg border border-gray-100"
                />
              )}

              {/* Excerpt */}
              {detailPost.excerpt && (
                <p className="text-sm text-gray-600 italic border-l-4 border-[#008060]/30 pl-3">{detailPost.excerpt}</p>
              )}

              {/* Content */}
              {detailPost.content && (
                <div
                  className="prose prose-sm max-w-none text-gray-700 text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: detailPost.content }}
                />
              )}

              {/* Rejection reason */}
              {detailPost.rejection_reason && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                  <p className="text-xs font-semibold text-red-700 mb-1">Rejection Reason</p>
                  <p className="text-sm text-red-600">{detailPost.rejection_reason}</p>
                </div>
              )}

              {/* Footer actions */}
              <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { const slug = detailPost.slug; setDetailPost(null); setLocation(`/blogs/${slug}`); }}
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  View Public Page
                </Button>
                <Button variant="outline" size="sm" onClick={() => setDetailPost(null)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={!!rejectDialogPost} onOpenChange={(o) => !o && setRejectDialogPost(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Post</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-sm text-gray-600">
              Rejecting: <span className="font-medium">{rejectDialogPost?.title}</span>
            </p>
            <div className="space-y-1">
              <Label>Reason for rejection</Label>
              <Textarea
                placeholder="Explain why this post is being rejected..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRejectDialogPost(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleRejectSubmit} disabled={moderating}>
                {moderating ? "Rejecting..." : "Reject Post"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={(o) => !o && setCategoryDialogOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Edit Category" : "New Category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="e.g. Technology" />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea
                value={catDescription}
                onChange={(e) => setCatDescription(e.target.value)}
                placeholder="Short description..."
                rows={2}
              />
            </div>
            <div className="space-y-1">
              <Label>Color</Label>
              <div className="flex items-center gap-3">
                <input type="color" value={catColor} onChange={(e) => setCatColor(e.target.value)} className="h-9 w-14 rounded border cursor-pointer" />
                <Input value={catColor} onChange={(e) => setCatColor(e.target.value)} className="font-mono text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>Cancel</Button>
              <Button className="bg-[#008060] hover:bg-[#006b51]" onClick={handleSaveCategory} disabled={catSaving}>
                {catSaving ? "Saving..." : "Save Category"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
