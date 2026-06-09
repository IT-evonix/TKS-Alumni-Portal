import { Router } from "express";
import multer from "multer";
import { supabase } from "../supabase";

const router = Router();

// Multer: keep files in memory for Supabase Storage upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

// Atomic counter helper — uses increment_blog_counter SQL function
async function atomicCounter(postId: string, col: string, delta: number) {
  await supabase.rpc("increment_blog_counter", {
    p_post_id: postId,
    p_col: col,
    p_delta: delta,
  });
}

// ==================== UTILITIES ====================

function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 60);
  const suffix = Math.random().toString(36).substring(2, 7);
  return `${base}-${suffix}`;
}

function calculateReadingTime(content: string): number {
  const words = content.replace(/<[^>]*>/g, "").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

// Escape SQL LIKE wildcards to prevent user input from acting as patterns
function escapeLike(value: string): string {
  return value.replace(/%/g, "\\%").replace(/_/g, "\\_");
}

// Helper: extract author fields from nested users→alumni join
function extractAuthor(usersRow: any) {
  return {
    id: usersRow?.id ?? null,
    username: usersRow?.username ?? null,
    first_name: usersRow?.alumni?.first_name ?? null,
    last_name: usersRow?.alumni?.last_name ?? null,
    profile_picture: usersRow?.alumni?.profile_picture ?? null,
    bio: usersRow?.alumni?.bio ?? null,
    current_role: usersRow?.alumni?.current_role ?? null,
    company: usersRow?.alumni?.company ?? null,
  };
}

async function isAdminUser(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("users")
    .select("is_admin, user_role")
    .eq("id", userId)
    .maybeSingle();
  return !!(data?.is_admin || data?.user_role === "administrator");
}

// ==================== COVER IMAGE UPLOAD ====================

// POST /api/blogs/upload-cover — upload cover image to Supabase Storage
router.post("/upload-cover", (req: any, res: any, next: any) => {
  // Run multer inline so fileFilter/size errors are catchable in the same handler
  upload.single("image")(req, res, async (err) => {
    if (err) {
      // MulterError (LIMIT_FILE_SIZE etc.) or fileFilter error
      return res.status(400).json({ error: err.message || "File upload error" });
    }
    try {
      const userId = req.headers["user-id"] as string;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      if (!req.file) return res.status(400).json({ error: "No image file provided" });

      // Sanitize filename: strip path traversal, keep extension only
      const originalName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      const ext = (originalName.split(".").pop() || "jpg").toLowerCase().substring(0, 5);
      const fileName = `${userId}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("blog-covers")
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("blog-covers").getPublicUrl(fileName);
      res.json({ url: urlData.publicUrl });
    } catch (error: any) {
      console.error("Cover image upload error:", error);
      res.status(500).json({ error: error.message || "Failed to upload image" });
    }
  });
});

// ==================== PUBLIC READS ====================

// GET /api/blogs/categories
router.get("/categories", async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from("blog_categories")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true });
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error("Get blog categories error:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// GET /api/blogs/my/posts  — must come BEFORE /:slug
router.get("/my/posts", async (req, res) => {
  try {
    const userId = req.headers["user-id"] as string;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { data, error } = await supabase
      .from("blog_posts")
      .select(`
        *,
        blog_categories(id, name, slug, color)
      `)
      .eq("author_id", userId)
      .order("updated_at", { ascending: false });
    if (error) throw error;

    const posts = (data || []).map((p: any) => ({
      ...p,
      category: p.blog_categories ?? null,
      blog_categories: undefined,
    }));

    res.json(posts);
  } catch (error) {
    console.error("Get my blog posts error:", error);
    res.status(500).json({ error: "Failed to fetch your posts" });
  }
});

// GET /api/blogs/admin/pending — must come BEFORE /:slug
router.get("/admin/pending", async (req, res) => {
  try {
    const userId = req.headers["user-id"] as string;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!(await isAdminUser(userId))) return res.status(403).json({ error: "Admin access required" });

    // BUG 1 FIX: nested join users → alumni (correct Supabase/PostgREST pattern)
    const { data, error } = await supabase
      .from("blog_posts")
      .select(`
        *,
        blog_categories(id, name, slug, color),
        users!blog_posts_author_id_fkey(id, username, alumni(first_name, last_name, profile_picture, current_role))
      `)
      .eq("status", "pending_review")
      .order("created_at", { ascending: true });
    if (error) throw error;

    const posts = (data || []).map((p: any) => ({
      ...p,
      category: p.blog_categories ?? null,
      author: extractAuthor(p.users),
      blog_categories: undefined,
      users: undefined,
    }));

    res.json(posts);
  } catch (error) {
    console.error("Get pending blogs error:", error);
    res.status(500).json({ error: "Failed to fetch pending posts" });
  }
});

// GET /api/blogs/admin/all — must come BEFORE /:slug
router.get("/admin/all", async (req, res) => {
  try {
    const userId = req.headers["user-id"] as string;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!(await isAdminUser(userId))) return res.status(403).json({ error: "Admin access required" });

    const status = (req.query.status as string) || "";

    // BUG 1 FIX: nested join
    let query = supabase
      .from("blog_posts")
      .select(`
        *,
        blog_categories(id, name, slug, color),
        users!blog_posts_author_id_fkey(id, username, alumni(first_name, last_name, profile_picture, current_role))
      `)
      .order("created_at", { ascending: false });

    if (status && status !== "all") query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw error;

    const posts = (data || []).map((p: any) => ({
      ...p,
      category: p.blog_categories ?? null,
      author: extractAuthor(p.users),
      blog_categories: undefined,
      users: undefined,
    }));

    res.json(posts);
  } catch (error) {
    console.error("Admin get all blogs error:", error);
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});

// GET /api/blogs — published listing with filters
router.get("/", async (req, res) => {
  try {
    const userId = req.headers["user-id"] as string;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(20, parseInt(req.query.limit as string) || 9);
    const search = (req.query.search as string) || "";
    const category = (req.query.category as string) || "";
    const tag = (req.query.tag as string) || "";
    const featured = req.query.featured === "true";
    const offset = (page - 1) * limit;

    // BUG 1 FIX: nested join
    let query = supabase
      .from("blog_posts")
      .select(`
        *,
        blog_categories(id, name, slug, color),
        users!blog_posts_author_id_fkey(id, username, alumni(first_name, last_name, profile_picture, current_role))
      `, { count: "exact" })
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      // BUG 9 FIX: escape wildcards in user-supplied search string
      const safeSearch = escapeLike(search);
      query = query.or(`title.ilike.%${safeSearch}%,excerpt.ilike.%${safeSearch}%`);
    }
    if (category) {
      const { data: catRow } = await supabase
        .from("blog_categories")
        .select("id")
        .eq("slug", category)
        .maybeSingle();
      if (catRow) query = query.eq("category_id", catRow.id);
      // If category slug not found, continue — will just return all published posts
    }
    if (tag) {
      query = query.contains("tags", [tag]);
    }
    if (featured) {
      query = query.eq("is_featured", true);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    // Batch-fetch viewer likes/bookmarks
    let likedSet = new Set<string>();
    let bookmarkedSet = new Set<string>();
    if (userId && data && data.length > 0) {
      const postIds = data.map((p: any) => p.id);
      const [likesRes, bookmarksRes] = await Promise.all([
        supabase.from("blog_likes").select("post_id").eq("user_id", userId).in("post_id", postIds),
        supabase.from("blog_bookmarks").select("post_id").eq("user_id", userId).in("post_id", postIds),
      ]);
      (likesRes.data || []).forEach((l: any) => likedSet.add(l.post_id));
      (bookmarksRes.data || []).forEach((b: any) => bookmarkedSet.add(b.post_id));
    }

    const posts = (data || []).map((p: any) => ({
      ...p,
      category: p.blog_categories ?? null,
      author: extractAuthor(p.users),
      viewer_has_liked: likedSet.has(p.id),
      viewer_has_bookmarked: bookmarkedSet.has(p.id),
      blog_categories: undefined,
      users: undefined,
    }));

    res.json({ posts, total: count || 0, page, limit });
  } catch (error) {
    console.error("Get blogs error:", error);
    res.status(500).json({ error: "Failed to fetch blogs" });
  }
});

// GET /api/blogs/:slug — single post
router.get("/:slug", async (req, res) => {
  try {
    const userId = req.headers["user-id"] as string;
    const { slug } = req.params;

    // BUG 1 FIX: nested join; also fetch bio+company for detail page author card
    const { data: post, error } = await supabase
      .from("blog_posts")
      .select(`
        *,
        blog_categories(id, name, slug, color),
        users!blog_posts_author_id_fkey(id, username, alumni(first_name, last_name, profile_picture, bio, current_role, company))
      `)
      .eq("slug", slug)
      .maybeSingle();

    if (error) throw error;
    if (!post) return res.status(404).json({ error: "Post not found" });

    const isAuthor = userId && post.author_id === userId;
    const adminFlag = userId ? await isAdminUser(userId) : false;

    if (post.status !== "published" && !isAuthor && !adminFlag) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Increment view count atomically (fire and forget)
    atomicCounter(post.id, "views_count", 1).catch(() => {});

    let viewerHasLiked = false;
    let viewerHasBookmarked = false;
    if (userId) {
      const [likeRes, bookmarkRes] = await Promise.all([
        supabase.from("blog_likes").select("id").eq("post_id", post.id).eq("user_id", userId).maybeSingle(),
        supabase.from("blog_bookmarks").select("id").eq("post_id", post.id).eq("user_id", userId).maybeSingle(),
      ]);
      viewerHasLiked = !!likeRes.data;
      viewerHasBookmarked = !!bookmarkRes.data;
    }

    res.json({
      ...post,
      category: post.blog_categories ?? null,
      author: extractAuthor(post.users),
      viewer_has_liked: viewerHasLiked,
      viewer_has_bookmarked: viewerHasBookmarked,
      blog_categories: undefined,
      users: undefined,
    });
  } catch (error) {
    console.error("Get blog post error:", error);
    res.status(500).json({ error: "Failed to fetch post" });
  }
});

// GET /api/blogs/:slug/comments
router.get("/:slug/comments", async (req, res) => {
  try {
    const { slug } = req.params;

    const { data: post } = await supabase
      .from("blog_posts")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!post) return res.status(404).json({ error: "Post not found" });

    // BUG 1 FIX: nested join for author info on comments
    const { data, error } = await supabase
      .from("blog_comments")
      .select(`
        *,
        users!blog_comments_author_id_fkey(id, username, alumni(first_name, last_name, profile_picture))
      `)
      .eq("post_id", post.id)
      .eq("is_active", true)
      .order("created_at", { ascending: true });
    if (error) throw error;

    const allComments = (data || []).map((c: any) => ({
      ...c,
      author: extractAuthor(c.users),
      replies: [] as any[],
      users: undefined,
    }));

    // Build two-level tree: top-level + nested replies
    const topLevel = allComments.filter((c: any) => !c.parent_id);
    const repliesMap = new Map<string, any[]>();
    allComments
      .filter((c: any) => c.parent_id)
      .forEach((c: any) => {
        if (!repliesMap.has(c.parent_id)) repliesMap.set(c.parent_id, []);
        repliesMap.get(c.parent_id)!.push(c);
      });
    topLevel.forEach((c: any) => {
      c.replies = repliesMap.get(c.id) || [];
    });

    res.json(topLevel);
  } catch (error) {
    console.error("Get blog comments error:", error);
    res.status(500).json({ error: "Failed to fetch comments" });
  }
});

// ==================== AUTH REQUIRED ====================

// POST /api/blogs — create draft
router.post("/", async (req, res) => {
  try {
    const userId = req.headers["user-id"] as string;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { title, excerpt, content, cover_image, category_id, tags } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: "Title is required" });
    if (title.trim().length < 5) return res.status(400).json({ error: "Title must be at least 5 characters" });
    if (!content?.trim()) return res.status(400).json({ error: "Content is required" });
    if (content.trim().length < 100) return res.status(400).json({ error: "Content must be at least 100 characters" });

    const slug = generateSlug(title.trim());
    const readingTimeMinutes = calculateReadingTime(content);

    const { data, error } = await supabase
      .from("blog_posts")
      .insert({
        author_id: userId,
        title: title.trim(),
        slug,
        excerpt: excerpt?.trim() || null,
        content: content.trim(),
        cover_image: cover_image?.trim() || null,
        category_id: category_id || null,
        tags: Array.isArray(tags) ? tags : [],
        reading_time_minutes: readingTimeMinutes,
        status: "draft",
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error("Create blog post error:", error);
    res.status(500).json({ error: "Failed to create post" });
  }
});

// PUT /api/blogs/:id — update own draft or rejected post
router.put("/:id", async (req, res) => {
  try {
    const userId = req.headers["user-id"] as string;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { id } = req.params;

    const { data: existing } = await supabase
      .from("blog_posts")
      .select("author_id, status")
      .eq("id", id)
      .maybeSingle();
    if (!existing) return res.status(404).json({ error: "Post not found" });
    if (existing.author_id !== userId) return res.status(403).json({ error: "Forbidden" });
    if (!["draft", "rejected"].includes(existing.status)) {
      return res.status(400).json({ error: "Only draft or rejected posts can be edited" });
    }

    const { title, excerpt, content, cover_image, category_id, tags } = req.body;
    const updates: any = { updated_at: new Date().toISOString() };

    if (title !== undefined) {
      if (!title?.trim() || title.trim().length < 5) {
        return res.status(400).json({ error: "Title must be at least 5 characters" });
      }
      updates.title = title.trim();
    }
    if (excerpt !== undefined) updates.excerpt = excerpt?.trim() || null;
    if (content !== undefined) {
      if (!content?.trim() || content.trim().length < 100) {
        return res.status(400).json({ error: "Content must be at least 100 characters" });
      }
      updates.content = content.trim();
      updates.reading_time_minutes = calculateReadingTime(content.trim());
    }
    if (cover_image !== undefined) updates.cover_image = cover_image?.trim() || null;
    if (category_id !== undefined) updates.category_id = category_id || null;
    if (tags !== undefined) updates.tags = Array.isArray(tags) ? tags : [];

    const { data, error } = await supabase
      .from("blog_posts")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error("Update blog post error:", error);
    res.status(500).json({ error: "Failed to update post" });
  }
});

// DELETE /api/blogs/:id — delete own post (admin can delete any)
router.delete("/:id", async (req, res) => {
  try {
    const userId = req.headers["user-id"] as string;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { id } = req.params;

    const { data: existing } = await supabase
      .from("blog_posts")
      .select("author_id")
      .eq("id", id)
      .maybeSingle();
    if (!existing) return res.status(404).json({ error: "Post not found" });

    const adminFlag = await isAdminUser(userId);
    if (existing.author_id !== userId && !adminFlag) return res.status(403).json({ error: "Forbidden" });

    const { error } = await supabase.from("blog_posts").delete().eq("id", id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error("Delete blog post error:", error);
    res.status(500).json({ error: "Failed to delete post" });
  }
});

// POST /api/blogs/:id/publish — submit for review
router.post("/:id/publish", async (req, res) => {
  try {
    const userId = req.headers["user-id"] as string;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { id } = req.params;

    const { data: existing } = await supabase
      .from("blog_posts")
      .select("author_id, status")
      .eq("id", id)
      .maybeSingle();
    if (!existing) return res.status(404).json({ error: "Post not found" });
    if (existing.author_id !== userId) return res.status(403).json({ error: "Forbidden" });
    if (!["draft", "rejected"].includes(existing.status)) {
      return res.status(400).json({ error: "Only draft or rejected posts can be submitted for review" });
    }

    const { data, error } = await supabase
      .from("blog_posts")
      .update({ status: "pending_review", rejection_reason: null, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error("Publish blog post error:", error);
    res.status(500).json({ error: "Failed to submit post for review" });
  }
});

// POST /api/blogs/:id/like — toggle like (atomic counter)
router.post("/:id/like", async (req, res) => {
  try {
    const userId = req.headers["user-id"] as string;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { id } = req.params;

    const { data: post } = await supabase.from("blog_posts").select("id").eq("id", id).maybeSingle();
    if (!post) return res.status(404).json({ error: "Post not found" });

    const { data: existing } = await supabase
      .from("blog_likes").select("id").eq("post_id", id).eq("user_id", userId).maybeSingle();

    if (existing) {
      const { error: delErr } = await supabase.from("blog_likes").delete().eq("id", existing.id);
      if (delErr) throw delErr;
      await atomicCounter(id, "likes_count", -1);
      return res.json({ liked: false });
    }

    const { error: insErr } = await supabase.from("blog_likes").insert({ post_id: id, user_id: userId });
    if (insErr) throw insErr;
    await atomicCounter(id, "likes_count", 1);
    res.json({ liked: true });
  } catch (error) {
    console.error("Toggle blog like error:", error);
    res.status(500).json({ error: "Failed to toggle like" });
  }
});

// POST /api/blogs/:id/bookmark — toggle bookmark (atomic counter)
router.post("/:id/bookmark", async (req, res) => {
  try {
    const userId = req.headers["user-id"] as string;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { id } = req.params;

    const { data: post } = await supabase.from("blog_posts").select("id").eq("id", id).maybeSingle();
    if (!post) return res.status(404).json({ error: "Post not found" });

    const { data: existing } = await supabase
      .from("blog_bookmarks").select("id").eq("post_id", id).eq("user_id", userId).maybeSingle();

    if (existing) {
      const { error: delErr } = await supabase.from("blog_bookmarks").delete().eq("id", existing.id);
      if (delErr) throw delErr;
      await atomicCounter(id, "bookmarks_count", -1);
      return res.json({ bookmarked: false });
    }

    const { error: insErr } = await supabase.from("blog_bookmarks").insert({ post_id: id, user_id: userId });
    if (insErr) throw insErr;
    await atomicCounter(id, "bookmarks_count", 1);
    res.json({ bookmarked: true });
  } catch (error) {
    console.error("Toggle blog bookmark error:", error);
    res.status(500).json({ error: "Failed to toggle bookmark" });
  }
});

// POST /api/blogs/:id/comments — add comment or reply
router.post("/:id/comments", async (req, res) => {
  try {
    const userId = req.headers["user-id"] as string;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { id } = req.params;
    const { content, parent_id } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: "Comment content is required" });
    if (content.trim().length > 2000) return res.status(400).json({ error: "Comment too long (max 2000 chars)" });

    const { data: post } = await supabase
      .from("blog_posts")
      .select("id, comments_count")
      .eq("id", id)
      .maybeSingle();
    if (!post) return res.status(404).json({ error: "Post not found" });

    // If replying, verify parent comment belongs to this post
    if (parent_id) {
      const { data: parentComment } = await supabase
        .from("blog_comments")
        .select("id, post_id")
        .eq("id", parent_id)
        .maybeSingle();
      if (!parentComment || parentComment.post_id !== id) {
        return res.status(400).json({ error: "Invalid parent comment" });
      }
    }

    const { data: comment, error } = await supabase
      .from("blog_comments")
      .insert({
        post_id: id,
        author_id: userId,
        content: content.trim(),
        parent_id: parent_id || null,
      })
      .select()
      .single();
    if (error) throw error;

    await atomicCounter(id, "comments_count", 1);

    // BUG 1 FIX: nested join for author info
    const { data: fullComment } = await supabase
      .from("blog_comments")
      .select(`
        *,
        users!blog_comments_author_id_fkey(id, username, alumni(first_name, last_name, profile_picture))
      `)
      .eq("id", comment.id)
      .maybeSingle();

    res.status(201).json({
      ...fullComment,
      author: extractAuthor((fullComment as any)?.users),
      replies: [],
      users: undefined,
    });
  } catch (error) {
    console.error("Add blog comment error:", error);
    res.status(500).json({ error: "Failed to add comment" });
  }
});

// DELETE /api/blogs/comments/:commentId
router.delete("/comments/:commentId", async (req, res) => {
  try {
    const userId = req.headers["user-id"] as string;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { commentId } = req.params;

    const { data: comment } = await supabase
      .from("blog_comments")
      .select("id, author_id, post_id, parent_id")
      .eq("id", commentId)
      .eq("is_active", true)
      .maybeSingle();
    if (!comment) return res.status(404).json({ error: "Comment not found" });

    const adminFlag = await isAdminUser(userId);
    if (comment.author_id !== userId && !adminFlag) return res.status(403).json({ error: "Forbidden" });

    // Count active replies BEFORE any soft-delete
    const { data: activeReplies } = await supabase
      .from("blog_comments")
      .select("id")
      .eq("parent_id", commentId)
      .eq("is_active", true);
    const replyCount = (activeReplies || []).length;

    // Soft-delete replies first (while their is_active is still true), then parent
    if (replyCount > 0) {
      await supabase.from("blog_comments").update({ is_active: false }).eq("parent_id", commentId);
    }
    await supabase.from("blog_comments").update({ is_active: false }).eq("id", commentId);

    // Atomically decrement comments_count by parent + reply count
    await atomicCounter(comment.post_id, "comments_count", -(1 + replyCount));

    res.json({ success: true });
  } catch (error) {
    console.error("Delete blog comment error:", error);
    res.status(500).json({ error: "Failed to delete comment" });
  }
});

// ==================== ADMIN ROUTES ====================

// PUT /api/blogs/admin/:id/approve
router.put("/admin/:id/approve", async (req, res) => {
  try {
    const userId = req.headers["user-id"] as string;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!(await isAdminUser(userId))) return res.status(403).json({ error: "Admin access required" });

    const { id } = req.params;
    const { data: existing } = await supabase.from("blog_posts").select("status").eq("id", id).maybeSingle();
    if (!existing) return res.status(404).json({ error: "Post not found" });

    const { data, error } = await supabase
      .from("blog_posts")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        rejection_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error("Approve blog post error:", error);
    res.status(500).json({ error: "Failed to approve post" });
  }
});

// PUT /api/blogs/admin/:id/reject
router.put("/admin/:id/reject", async (req, res) => {
  try {
    const userId = req.headers["user-id"] as string;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!(await isAdminUser(userId))) return res.status(403).json({ error: "Admin access required" });

    const { id } = req.params;
    const { rejection_reason } = req.body;

    if (!rejection_reason?.trim()) {
      return res.status(400).json({ error: "Rejection reason is required" });
    }

    const { data: existing } = await supabase.from("blog_posts").select("status").eq("id", id).maybeSingle();
    if (!existing) return res.status(404).json({ error: "Post not found" });

    const { data, error } = await supabase
      .from("blog_posts")
      .update({
        status: "rejected",
        rejection_reason: rejection_reason.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error("Reject blog post error:", error);
    res.status(500).json({ error: "Failed to reject post" });
  }
});

// DELETE /api/blogs/admin/:id — hard delete any post
router.delete("/admin/:id", async (req, res) => {
  try {
    const userId = req.headers["user-id"] as string;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!(await isAdminUser(userId))) return res.status(403).json({ error: "Admin access required" });

    const { id } = req.params;
    const { error } = await supabase.from("blog_posts").delete().eq("id", id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error("Admin delete blog post error:", error);
    res.status(500).json({ error: "Failed to delete post" });
  }
});

// POST /api/blogs/admin/categories
router.post("/admin/categories", async (req, res) => {
  try {
    const userId = req.headers["user-id"] as string;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!(await isAdminUser(userId))) return res.status(403).json({ error: "Admin access required" });

    const { name, description, color, icon } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Category name is required" });

    const slug = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");

    const { data, error } = await supabase
      .from("blog_categories")
      .insert({
        name: name.trim(),
        slug,
        description: description?.trim() || null,
        color: color || "#008060",
        icon: icon || null,
      })
      .select()
      .single();
    if (error) {
      if ((error as any).code === "23505") {
        return res.status(409).json({ error: "A category with this name already exists" });
      }
      throw error;
    }
    res.status(201).json(data);
  } catch (error) {
    console.error("Create blog category error:", error);
    res.status(500).json({ error: "Failed to create category" });
  }
});

// PUT /api/blogs/admin/categories/:id
router.put("/admin/categories/:id", async (req, res) => {
  try {
    const userId = req.headers["user-id"] as string;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!(await isAdminUser(userId))) return res.status(403).json({ error: "Admin access required" });

    const { id } = req.params;
    const { name, description, color, icon, is_active, display_order } = req.body;

    const updates: any = { updated_at: new Date().toISOString() };
    if (name !== undefined) {
      if (!name?.trim()) return res.status(400).json({ error: "Category name cannot be empty" });
      updates.name = name.trim();
      updates.slug = name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
    }
    if (description !== undefined) updates.description = description?.trim() || null;
    if (color) updates.color = color;
    if (icon !== undefined) updates.icon = icon || null;
    if (is_active !== undefined) updates.is_active = Boolean(is_active);
    if (display_order !== undefined) updates.display_order = Number(display_order) || 0;

    const { data, error } = await supabase
      .from("blog_categories")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      if ((error as any).code === "23505") {
        return res.status(409).json({ error: "A category with this name already exists" });
      }
      throw error;
    }
    res.json(data);
  } catch (error) {
    console.error("Update blog category error:", error);
    res.status(500).json({ error: "Failed to update category" });
  }
});

// DELETE /api/blogs/admin/categories/:id
router.delete("/admin/categories/:id", async (req, res) => {
  try {
    const userId = req.headers["user-id"] as string;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!(await isAdminUser(userId))) return res.status(403).json({ error: "Admin access required" });

    const { id } = req.params;
    const { error } = await supabase.from("blog_categories").delete().eq("id", id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error("Delete blog category error:", error);
    res.status(500).json({ error: "Failed to delete category" });
  }
});

export default router;
