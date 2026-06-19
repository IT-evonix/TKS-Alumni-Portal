import { Router } from "express";
import multer from "multer";
import { supabase } from "../supabase";
import { broadcastNotificationToAllAlumni, createAndEmitNotification, NotificationType, NotificationRedirectUrl } from "../services/notification-helper";

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

// Fetch author info: user row + alumni row separately (avoids unreliable nested join)
async function fetchAuthor(authorId: string, includeExtended = false) {
  const [userRes, alumniRes] = await Promise.all([
    supabase.from("users").select("id, username").eq("id", authorId).maybeSingle(),
    includeExtended
      ? supabase.from("alumni").select("first_name, last_name, profile_picture, bio, current_role, company").eq("user_id", authorId).maybeSingle()
      : supabase.from("alumni").select("first_name, last_name, profile_picture, current_role").eq("user_id", authorId).maybeSingle(),
  ]);
  const u = userRes.data;
  const a = alumniRes.data;

  // Derive a human-readable name from username when no alumni profile exists
  // e.g. "john_doe_42" → first_name "John", last_name "Doe"
  let derivedFirst: string | null = null;
  let derivedLast: string | null = null;
  if (!a?.first_name && u?.username) {
    const parts = u.username
      .replace(/[_\-\.]+/g, " ")
      .replace(/\d+/g, "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((p: string) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase());
    if (parts.length >= 2) {
      derivedFirst = parts[0];
      derivedLast = parts.slice(1).join(" ");
    } else if (parts.length === 1) {
      derivedFirst = parts[0];
    }
  }

  return {
    id: u?.id ?? authorId,
    username: u?.username ?? null,
    first_name: a?.first_name ?? derivedFirst,
    last_name: a?.last_name ?? derivedLast,
    profile_picture: a?.profile_picture ?? null,
    bio: (a as any)?.bio ?? null,
    current_role: a?.current_role ?? null,
    company: (a as any)?.company ?? null,
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

// GET /api/blogs/my/bookmarks  — must come BEFORE /:slug
router.get("/my/bookmarks", async (req, res) => {
  try {
    const userId = req.headers["user-id"] as string;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { data: bookmarks, error: bmError } = await supabase
      .from("blog_bookmarks")
      .select("post_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (bmError) throw bmError;

    const postIds = (bookmarks || []).map((b: any) => b.post_id);
    if (postIds.length === 0) return res.json([]);

    const { data, error } = await supabase
      .from("blog_posts")
      .select(`*, blog_categories(id, name, slug, color)`)
      .in("id", postIds)
      .eq("status", "published");
    if (error) throw error;

    // Preserve bookmark order
    const postMap = new Map((data || []).map((p: any) => [p.id, p]));
    const posts = postIds
      .map((id: string) => postMap.get(id))
      .filter(Boolean)
      .map((p: any) => ({
        ...p,
        category: p.blog_categories ?? null,
        blog_categories: undefined,
        viewer_has_bookmarked: true,
      }));

    res.json(posts);
  } catch (error) {
    console.error("Get bookmarked blog posts error:", error);
    res.status(500).json({ error: "Failed to fetch bookmarked posts" });
  }
});

// GET /api/blogs/my/posts  — must come BEFORE /:slug
router.get("/my/posts", async (req, res) => {
  try {
    const userId = req.headers["user-id"] as string;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const [postsRes, author] = await Promise.all([
      supabase
        .from("blog_posts")
        .select(`*, blog_categories(id, name, slug, color)`)
        .eq("author_id", userId)
        .order("updated_at", { ascending: false }),
      fetchAuthor(userId),
    ]);
    if (postsRes.error) throw postsRes.error;

    const posts = (postsRes.data || []).map((p: any) => ({
      ...p,
      category: p.blog_categories ?? null,
      blog_categories: undefined,
      author,
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

    const { data, error } = await supabase
      .from("blog_posts")
      .select(`*, blog_categories(id, name, slug, color)`)
      .eq("status", "pending_review")
      .order("created_at", { ascending: true });
    if (error) throw error;

    const authorIds = [...new Set((data || []).map((p: any) => p.author_id as string))];
    const [usersRes, alumniRes] = await Promise.all([
      supabase.from("users").select("id, username").in("id", authorIds),
      supabase.from("alumni").select("user_id, first_name, last_name, profile_picture, current_role").in("user_id", authorIds),
    ]);
    const alumniByUserId = new Map((alumniRes.data || []).map((a: any) => [a.user_id, a]));
    const userById = new Map((usersRes.data || []).map((u: any) => [u.id, u]));

    const posts = (data || []).map((p: any) => {
      const u = userById.get(p.author_id);
      const a = alumniByUserId.get(p.author_id);
      return {
        ...p,
        category: p.blog_categories ?? null,
        author: { id: p.author_id, username: u?.username ?? null, first_name: a?.first_name ?? null, last_name: a?.last_name ?? null, profile_picture: a?.profile_picture ?? null, bio: null, current_role: a?.current_role ?? null, company: null },
        blog_categories: undefined,
      };
    });

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

    let query = supabase
      .from("blog_posts")
      .select(`*, blog_categories(id, name, slug, color)`)
      .order("created_at", { ascending: false });

    if (status && status !== "all") query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw error;

    const authorIds = [...new Set((data || []).map((p: any) => p.author_id as string))];
    const [usersRes2, alumniRes2] = await Promise.all([
      supabase.from("users").select("id, username").in("id", authorIds),
      supabase.from("alumni").select("user_id, first_name, last_name, profile_picture, current_role").in("user_id", authorIds),
    ]);
    const alumniByUserId2 = new Map((alumniRes2.data || []).map((a: any) => [a.user_id, a]));
    const userById2 = new Map((usersRes2.data || []).map((u: any) => [u.id, u]));

    const posts = (data || []).map((p: any) => {
      const u = userById2.get(p.author_id);
      const a = alumniByUserId2.get(p.author_id);
      return {
        ...p,
        category: p.blog_categories ?? null,
        author: { id: p.author_id, username: u?.username ?? null, first_name: a?.first_name ?? null, last_name: a?.last_name ?? null, profile_picture: a?.profile_picture ?? null, bio: null, current_role: a?.current_role ?? null, company: null },
        blog_categories: undefined,
      };
    });

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

    let query = supabase
      .from("blog_posts")
      .select(`*, blog_categories(id, name, slug, color)`, { count: "exact" })
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

    // Batch-fetch viewer likes/bookmarks and author alumni info
    let likedSet = new Set<string>();
    let bookmarkedSet = new Set<string>();
    const authorMap = new Map<string, any>();

    if (data && data.length > 0) {
      const postIds = data.map((p: any) => p.id);
      const authorIds = [...new Set(data.map((p: any) => p.author_id as string))];

      const fetchPromises: Promise<any>[] = [];
      if (userId) {
        fetchPromises.push(
          Promise.resolve(supabase.from("blog_likes").select("post_id").eq("user_id", userId).in("post_id", postIds)),
          Promise.resolve(supabase.from("blog_bookmarks").select("post_id").eq("user_id", userId).in("post_id", postIds)),
        );
      }
      fetchPromises.push(
        Promise.resolve(supabase.from("users").select("id, username").in("id", authorIds)),
        Promise.resolve(supabase.from("alumni").select("user_id, first_name, last_name, profile_picture, current_role").in("user_id", authorIds)),
      );

      const results = await Promise.all(fetchPromises);
      let usersData: any[], alumniData: any[];
      if (userId) {
        const [likesRes, bookmarksRes, usersRes, alumniRes] = results;
        (likesRes.data || []).forEach((l: any) => likedSet.add(l.post_id));
        (bookmarksRes.data || []).forEach((b: any) => bookmarkedSet.add(b.post_id));
        usersData = usersRes.data || [];
        alumniData = alumniRes.data || [];
      } else {
        const [usersRes, alumniRes] = results;
        usersData = usersRes.data || [];
        alumniData = alumniRes.data || [];
      }

      const alumniByUserId = new Map(alumniData.map((a: any) => [a.user_id, a]));
      usersData.forEach((u: any) => {
        const a = alumniByUserId.get(u.id);
        authorMap.set(u.id, {
          id: u.id,
          username: u.username,
          first_name: a?.first_name ?? null,
          last_name: a?.last_name ?? null,
          profile_picture: a?.profile_picture ?? null,
          bio: null,
          current_role: a?.current_role ?? null,
          company: null,
        });
      });
    }

    const posts = (data || []).map((p: any) => ({
      ...p,
      category: p.blog_categories ?? null,
      author: authorMap.get(p.author_id) ?? { id: p.author_id, username: null, first_name: null, last_name: null, profile_picture: null, bio: null, current_role: null, company: null },
      viewer_has_liked: likedSet.has(p.id),
      viewer_has_bookmarked: bookmarkedSet.has(p.id),
      blog_categories: undefined,
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

    const { data: post, error } = await supabase
      .from("blog_posts")
      .select(`*, blog_categories(id, name, slug, color)`)
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

    const [author, likeRes, bookmarkRes] = await Promise.all([
      fetchAuthor(post.author_id, true),
      userId ? supabase.from("blog_likes").select("id").eq("post_id", post.id).eq("user_id", userId).maybeSingle() : Promise.resolve({ data: null }),
      userId ? supabase.from("blog_bookmarks").select("id").eq("post_id", post.id).eq("user_id", userId).maybeSingle() : Promise.resolve({ data: null }),
    ]);

    res.json({
      ...post,
      category: post.blog_categories ?? null,
      author,
      viewer_has_liked: !!likeRes.data,
      viewer_has_bookmarked: !!bookmarkRes.data,
      blog_categories: undefined,
    });
  } catch (error: any) {
    console.error("Get blog post error:", error);
    res.status(500).json({ error: "Failed to fetch post", detail: error?.message || String(error) });
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

    const { data, error } = await supabase
      .from("blog_comments")
      .select("*")
      .eq("post_id", post.id)
      .eq("is_active", true)
      .order("created_at", { ascending: true });
    if (error) throw error;

    const commentAuthorIds = [...new Set((data || []).map((c: any) => c.author_id as string))];
    const [cUsersRes, cAlumniRes] = await Promise.all([
      supabase.from("users").select("id, username").in("id", commentAuthorIds),
      supabase.from("alumni").select("user_id, first_name, last_name, profile_picture").in("user_id", commentAuthorIds),
    ]);
    const cAlumniMap = new Map((cAlumniRes.data || []).map((a: any) => [a.user_id, a]));
    const cUserMap = new Map((cUsersRes.data || []).map((u: any) => [u.id, u]));

    const allComments = (data || []).map((c: any) => {
      const u = cUserMap.get(c.author_id);
      const a = cAlumniMap.get(c.author_id);
      return {
        ...c,
        author: { id: c.author_id, username: u?.username ?? null, first_name: a?.first_name ?? null, last_name: a?.last_name ?? null, profile_picture: a?.profile_picture ?? null },
        replies: [] as any[],
      };
    });

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
    const contentText = content.replace(/<[^>]*>/g, "").trim();
    if (contentText.length < 50) return res.status(400).json({ error: "Content must be at least 50 characters (excluding formatting)" });
    if (contentText.length > 1000) return res.status(400).json({ error: "Content must be 1000 characters or fewer (excluding formatting)" });

    if (excerpt && excerpt.trim().length > 50) {
      return res.status(400).json({ error: "Excerpt must be 50 characters or fewer" });
    }

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

    const { title, excerpt, content, cover_image, category_id, tags } = req.body;
    // Editing a published or pending_review post resets it to draft so it goes through review again
    const updates: any = {
      updated_at: new Date().toISOString(),
      ...(["published", "pending_review"].includes(existing.status)
        ? { status: "draft", published_at: null, rejection_reason: null }
        : {}),
    };

    if (title !== undefined) {
      if (!title?.trim() || title.trim().length < 5) {
        return res.status(400).json({ error: "Title must be at least 5 characters" });
      }
      updates.title = title.trim();
    }
    if (excerpt !== undefined) {
      if (excerpt && excerpt.trim().length > 50) {
        return res.status(400).json({ error: "Excerpt must be 50 characters or fewer" });
      }
      updates.excerpt = excerpt?.trim() || null;
    }
    if (content !== undefined) {
      const contentText = content?.replace(/<[^>]*>/g, "").trim() ?? "";
      if (!contentText || contentText.length < 50) {
        return res.status(400).json({ error: "Content must be at least 50 characters (excluding formatting)" });
      }
      if (contentText.length > 1000) {
        return res.status(400).json({ error: "Content must be 1000 characters or fewer (excluding formatting)" });
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

// DELETE /api/blogs/comments/:commentId — must come BEFORE /:id
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

    // Notify all admins that a blog post is pending review
    try {
      const { data: admins } = await supabase
        .from("users")
        .select("id")
        .eq("is_admin", true);
      if (admins && admins.length > 0) {
        for (const admin of admins) {
          try {
            await createAndEmitNotification({
              userId: admin.id,
              type: NotificationType.POST_PENDING_APPROVAL,
              title: "Blog Post Pending Review",
              content: `A blog post "${data.title}" has been submitted for review.`,
              relatedId: data.id,
              redirectUrl: "/admin/blogs",
              actorId: userId,
            });
          } catch (notifErr) {
            console.error("Blog pending review: failed to notify admin", admin.id, notifErr);
          }
        }
      }
    } catch (notifyError) {
      console.error("Blog pending review: admin notification error", notifyError);
    }

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

    const { data: inserted, error: insErr } = await supabase
      .from("blog_likes")
      .upsert({ post_id: id, user_id: userId }, { onConflict: "post_id,user_id", ignoreDuplicates: true })
      .select("id")
      .maybeSingle();
    if (insErr) throw insErr;
    if (inserted) {
      await atomicCounter(id, "likes_count", 1); // only increment if row was actually new

      // Notify the blog author (skip if liker is the author)
      const { data: blogPost } = await supabase
        .from("blog_posts")
        .select("author_id, title")
        .eq("id", id)
        .maybeSingle();
      if (blogPost && blogPost.author_id !== userId) {
        const { data: liker } = await supabase
          .from("users")
          .select("first_name, last_name")
          .eq("id", userId)
          .maybeSingle();
        const likerName = liker ? `${liker.first_name} ${liker.last_name}` : "Someone";
        await createAndEmitNotification({
          userId: blogPost.author_id,
          type: NotificationType.POST_LIKE,
          title: "Post Liked",
          content: `${likerName} liked your blog post "${blogPost.title}"`,
          relatedId: id,
          redirectUrl: `/blogs/${id}`,
          actorId: userId,
        }).catch((err) => console.error("Blog like notification error:", err));
      }
    }
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

    const { data: inserted, error: insErr } = await supabase
      .from("blog_bookmarks")
      .upsert({ post_id: id, user_id: userId }, { onConflict: "post_id,user_id", ignoreDuplicates: true })
      .select("id")
      .maybeSingle();
    if (insErr) throw insErr;
    if (inserted) await atomicCounter(id, "bookmarks_count", 1); // only increment if row was actually new
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

    // If replying, verify parent comment belongs to this post and is top-level (no deeper nesting)
    if (parent_id) {
      const { data: parentComment } = await supabase
        .from("blog_comments")
        .select("id, post_id, parent_id")
        .eq("id", parent_id)
        .maybeSingle();
      if (!parentComment || parentComment.post_id !== id) {
        return res.status(400).json({ error: "Invalid parent comment" });
      }
      if (parentComment.parent_id) {
        return res.status(400).json({ error: "Replies cannot be nested more than one level deep" });
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

    const [newCommentAuthor] = await Promise.all([fetchAuthor(userId)]);
    res.status(201).json({
      ...comment,
      author: newCommentAuthor,
      replies: [],
    });
  } catch (error) {
    console.error("Add blog comment error:", error);
    res.status(500).json({ error: "Failed to add comment" });
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
    if (existing.status !== "pending_review") {
      return res.status(400).json({ error: "Only posts pending review can be approved" });
    }

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

    broadcastNotificationToAllAlumni({
      type: NotificationType.NEW_BLOG,
      title: "New Blog Post",
      content: `A new blog post has been published: "${data.title}"`,
      relatedId: data.id,
      redirectUrl: `${NotificationRedirectUrl.BLOGS}/${data.slug}`,
      actorId: data.author_id,
    }).catch(() => {});

    // Notify the author that their post was approved
    createAndEmitNotification({
      userId: data.author_id,
      type: NotificationType.POST_APPROVED,
      title: "Blog Post Approved",
      content: `Your blog post "${data.title}" has been approved and published!`,
      relatedId: data.id,
      redirectUrl: `${NotificationRedirectUrl.BLOGS}/${data.slug}`,
      actorId: userId,
    }).catch(() => {});

    const io = (global as any).io;
    if (io) io.emit("new_blog", { blog: data });

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

    // Notify the author that their post was rejected
    createAndEmitNotification({
      userId: data.author_id,
      type: NotificationType.POST_REJECTED,
      title: "Blog Post Rejected",
      content: `Your blog post "${data.title}" was not approved. Reason: ${rejection_reason.trim()}`,
      relatedId: data.id,
      redirectUrl: `${NotificationRedirectUrl.BLOGS}`,
      actorId: userId,
    }).catch(() => {});

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

    // Fetch post before deletion so we can notify the author
    const { data: post } = await supabase
      .from("blog_posts")
      .select("id, title, author_id")
      .eq("id", id)
      .maybeSingle();

    if (!post) return res.status(404).json({ error: "Post not found" });

    const { error } = await supabase.from("blog_posts").delete().eq("id", id);
    if (error) throw error;

    // Notify the author that their post was removed by an admin
    createAndEmitNotification({
      userId: post.author_id,
      type: NotificationType.POST_DELETED,
      title: "Blog Post Removed",
      content: `Your blog post "${post.title}" has been removed by an administrator.`,
      relatedId: null,
      redirectUrl: NotificationRedirectUrl.BLOGS,
      actorId: userId,
    }).catch(() => {});

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
