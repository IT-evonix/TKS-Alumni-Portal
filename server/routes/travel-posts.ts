import { Router } from "express";
import { z } from "zod";
import { supabase } from "../supabase";
import {
  createAndEmitNotification,
  NotificationType,
} from "../services/notification-helper";
import { requireAuth, requireAdmin } from "../middleware/auth";

const router = Router();

// ==================== UTILITIES ====================

async function atomicCounter(postId: string, col: string, delta: number) {
  await supabase.rpc("increment_travel_post_counter", {
    p_post_id: postId,
    p_col: col,
    p_delta: delta,
  });
}

async function fetchAuthor(authorId: string) {
  const [userRes, alumniRes] = await Promise.all([
    supabase.from("users").select("id, username").eq("id", authorId).maybeSingle(),
    supabase.from("alumni").select("first_name, last_name, profile_picture, current_role").eq("user_id", authorId).maybeSingle(),
  ]);
  const u = userRes.data;
  const a = alumniRes.data;

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
    if (parts.length >= 2) { derivedFirst = parts[0]; derivedLast = parts.slice(1).join(" "); }
    else if (parts.length === 1) { derivedFirst = parts[0]; }
  }

  return {
    id: u?.id ?? authorId,
    username: u?.username ?? null,
    first_name: a?.first_name ?? derivedFirst,
    last_name: a?.last_name ?? derivedLast,
    profile_picture: a?.profile_picture ?? null,
    current_role: a?.current_role ?? null,
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

// Upload a single base64 media item to Supabase Storage; returns { url, storage_path }
async function uploadMediaItem(
  data: string,
  postId: string
): Promise<{ url: string; storage_path: string; type: "image" | "video" }> {
  const mimeMatch = data.match(/^data:([^;]+);base64,/);
  if (!mimeMatch) throw new Error("Invalid base64 data URI");
  const mime = mimeMatch[1];

  const imageTypes: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
  const videoTypes: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };

  const ext = imageTypes[mime] ?? videoTypes[mime];
  if (!ext) throw new Error(`Unsupported file type: ${mime}`);

  const mediaType: "image" | "video" = imageTypes[mime] ? "image" : "video";

  // Validate size from base64 length (approx bytes = length * 0.75)
  const base64Data = data.replace(/^data:[^;]+;base64,/, "");
  const approxBytes = Math.ceil(base64Data.length * 0.75);
  const maxBytes = mediaType === "image" ? 5 * 1024 * 1024 : 50 * 1024 * 1024;
  if (approxBytes > maxBytes) {
    const maxMB = mediaType === "image" ? 5 : 50;
    throw new Error(`${mediaType === "image" ? "Image" : "Video"} exceeds ${maxMB}MB limit`);
  }

  const buffer = Buffer.from(base64Data, "base64");
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
  const storagePath = `travel-posts/${postId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("event_covers")
    .upload(storagePath, buffer, { contentType: mime });
  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from("event_covers").getPublicUrl(storagePath);
  return { url: urlData.publicUrl, storage_path: storagePath, type: mediaType };
}

async function deleteMediaFiles(postId: string) {
  const { data: mediaRows } = await supabase
    .from("travel_post_media")
    .select("storage_path")
    .eq("post_id", postId);
  if (mediaRows && mediaRows.length > 0) {
    const paths = mediaRows.map((m: any) => m.storage_path);
    await supabase.storage.from("event_covers").remove(paths);
  }
}

// Build a feed post shape from a DB row + author map + viewer context
function formatPost(row: any, author: any, viewerHasLiked: boolean, viewerHasBookmarked: boolean) {
  return {
    id: row.id,
    author_id: row.author_id,
    city: row.city,
    country: row.country,
    coordinates: row.coordinates,
    caption: row.caption,
    is_hidden: row.is_hidden,
    status: row.status ?? "approved",
    rejection_reason: row.rejection_reason ?? null,
    likes_count: row.likes_count,
    comments_count: row.comments_count,
    bookmarks_count: row.bookmarks_count,
    views_count: row.views_count,
    created_at: row.created_at,
    updated_at: row.updated_at,
    author,
    media: row.media ?? [],
    links: row.links ?? [],
    viewer_has_liked: viewerHasLiked,
    viewer_has_bookmarked: viewerHasBookmarked,
    // Resubmit diff fields
    previous_caption: row.previous_caption ?? null,
    previous_city: row.previous_city ?? null,
    previous_country: row.previous_country ?? null,
    previous_media_snapshot: row.previous_media_snapshot ?? null,
    resubmit_count: row.resubmit_count ?? 0,
  };
}

// ==================== VALIDATION SCHEMAS ====================

const mediaItemSchema = z.object({
  data: z.string().min(1),
  order_index: z.number().int().min(0).default(0),
});

const linkItemSchema = z.object({
  url: z.string().url("Invalid URL"),
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  order_index: z.number().int().min(0).default(0),
});

const createPostSchema = z.object({
  city: z.string().min(1).max(100),
  country: z.string().min(1).max(100),
  coordinates: z.string().optional(),
  caption: z.string().max(5000).optional(),
  media: z.array(mediaItemSchema).max(10, "Maximum 10 media items allowed").default([]),
  links: z.array(linkItemSchema).max(5, "Maximum 5 links allowed").default([]),
});

// ==================== ROUTES ====================

// GET /api/travel-posts — paginated public feed
router.get("/", requireAuth, async (req: any, res: any) => {
  try {
    const userId = req.headers["user-id"] as string;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit as string) || 10));
    const cityFilter = req.query.city as string | undefined;
    const offset = (page - 1) * limit;

    let query = supabase
      .from("travel_posts")
      .select("*", { count: "exact" })
      .eq("status", "approved")
      .eq("is_hidden", false)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (cityFilter?.trim()) {
      query = query.ilike("city", `%${cityFilter.trim()}%`);
    }

    const { data: posts, error, count } = await query;
    if (error) throw error;

    if (!posts || posts.length === 0) {
      return res.json({ posts: [], total: 0, page, limit });
    }

    // Batch fetch media (first item only for feed card cover)
    const postIds = posts.map((p: any) => p.id);
    const authorIds = [...new Set(posts.map((p: any) => p.author_id as string))];

    const [mediaRes, usersRes, alumniRes, likesRes, bookmarksRes] = await Promise.all([
      supabase.from("travel_post_media").select("*").in("post_id", postIds).order("order_index", { ascending: true }),
      supabase.from("users").select("id, username").in("id", authorIds),
      supabase.from("alumni").select("user_id, first_name, last_name, profile_picture, current_role").in("user_id", authorIds),
      supabase.from("travel_post_likes").select("post_id").in("post_id", postIds).eq("user_id", userId),
      supabase.from("travel_post_bookmarks").select("post_id").in("post_id", postIds).eq("user_id", userId),
    ]);

    const mediaMap = new Map<string, any[]>();
    (mediaRes.data || []).forEach((m: any) => {
      if (!mediaMap.has(m.post_id)) mediaMap.set(m.post_id, []);
      mediaMap.get(m.post_id)!.push(m);
    });

    const userMap = new Map((usersRes.data || []).map((u: any) => [u.id, u]));
    const alumniMap = new Map((alumniRes.data || []).map((a: any) => [a.user_id, a]));
    const likedSet = new Set((likesRes.data || []).map((l: any) => l.post_id as string));
    const bookmarkedSet = new Set((bookmarksRes.data || []).map((b: any) => b.post_id as string));

    const formatted = posts.map((p: any) => {
      const u = userMap.get(p.author_id);
      const a = alumniMap.get(p.author_id);
      const author = {
        id: p.author_id,
        username: u?.username ?? null,
        first_name: a?.first_name ?? null,
        last_name: a?.last_name ?? null,
        profile_picture: a?.profile_picture ?? null,
        current_role: a?.current_role ?? null,
      };
      return formatPost(
        { ...p, media: mediaMap.get(p.id) ?? [], links: [] },
        author,
        likedSet.has(p.id),
        bookmarkedSet.has(p.id)
      );
    });

    res.json({ posts: formatted, total: count ?? 0, page, limit });
  } catch (error) {
    console.error("Travel posts feed error:", error);
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});

// GET /api/travel-posts/my-posts
router.get("/my-posts", requireAuth, async (req: any, res: any) => {
  try {
    const userId = req.headers["user-id"] as string;

    const { data: posts, error } = await supabase
      .from("travel_posts")
      .select("*")
      .eq("author_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;

    if (!posts || posts.length === 0) return res.json([]);

    const postIds = posts.map((p: any) => p.id);
    const [mediaRes, likesRes, bookmarksRes] = await Promise.all([
      supabase.from("travel_post_media").select("*").in("post_id", postIds).order("order_index", { ascending: true }),
      supabase.from("travel_post_likes").select("post_id").in("post_id", postIds).eq("user_id", userId),
      supabase.from("travel_post_bookmarks").select("post_id").in("post_id", postIds).eq("user_id", userId),
    ]);

    const mediaMap = new Map<string, any[]>();
    (mediaRes.data || []).forEach((m: any) => {
      if (!mediaMap.has(m.post_id)) mediaMap.set(m.post_id, []);
      mediaMap.get(m.post_id)!.push(m);
    });

    const likedSet = new Set((likesRes.data || []).map((l: any) => l.post_id as string));
    const bookmarkedSet = new Set((bookmarksRes.data || []).map((b: any) => b.post_id as string));
    const author = await fetchAuthor(userId);

    return res.json(
      posts.map((p: any) =>
        formatPost({ ...p, media: mediaMap.get(p.id) ?? [], links: [] }, author, likedSet.has(p.id), bookmarkedSet.has(p.id))
      )
    );
  } catch (error) {
    console.error("My travel posts error:", error);
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});

// GET /api/travel-posts/bookmarks
router.get("/bookmarks", requireAuth, async (req: any, res: any) => {
  try {
    const userId = req.headers["user-id"] as string;

    const { data: bookmarks, error: bErr } = await supabase
      .from("travel_post_bookmarks")
      .select("post_id")
      .eq("user_id", userId);
    if (bErr) throw bErr;
    if (!bookmarks || bookmarks.length === 0) return res.json([]);

    const postIds = bookmarks.map((b: any) => b.post_id as string);

    const { data: posts, error } = await supabase
      .from("travel_posts")
      .select("*")
      .in("id", postIds)
      .or(`and(status.eq.approved,is_hidden.eq.false),author_id.eq.${userId}`)
      .order("created_at", { ascending: false });
    if (error) throw error;
    if (!posts || posts.length === 0) return res.json([]);

    const authorIds = [...new Set(posts.map((p: any) => p.author_id as string))];
    const [mediaRes, usersRes, alumniRes, likesRes] = await Promise.all([
      supabase.from("travel_post_media").select("*").in("post_id", postIds).order("order_index", { ascending: true }),
      supabase.from("users").select("id, username").in("id", authorIds),
      supabase.from("alumni").select("user_id, first_name, last_name, profile_picture, current_role").in("user_id", authorIds),
      supabase.from("travel_post_likes").select("post_id").in("post_id", postIds).eq("user_id", userId),
    ]);

    const mediaMap = new Map<string, any[]>();
    (mediaRes.data || []).forEach((m: any) => {
      if (!mediaMap.has(m.post_id)) mediaMap.set(m.post_id, []);
      mediaMap.get(m.post_id)!.push(m);
    });

    const userMap = new Map((usersRes.data || []).map((u: any) => [u.id, u]));
    const alumniMap = new Map((alumniRes.data || []).map((a: any) => [a.user_id, a]));
    const likedSet = new Set((likesRes.data || []).map((l: any) => l.post_id as string));

    return res.json(
      posts.map((p: any) => {
        const u = userMap.get(p.author_id);
        const a = alumniMap.get(p.author_id);
        const author = { id: p.author_id, username: u?.username ?? null, first_name: a?.first_name ?? null, last_name: a?.last_name ?? null, profile_picture: a?.profile_picture ?? null, current_role: a?.current_role ?? null };
        return formatPost({ ...p, media: mediaMap.get(p.id) ?? [], links: [] }, author, likedSet.has(p.id), true);
      })
    );
  } catch (error) {
    console.error("Bookmarks error:", error);
    res.status(500).json({ error: "Failed to fetch bookmarks" });
  }
});

// GET /api/travel-posts/:id — full post detail
router.get("/:id", requireAuth, async (req: any, res: any) => {
  try {
    const userId = req.headers["user-id"] as string;
    const { id } = req.params;

    const { data: post, error } = await supabase
      .from("travel_posts")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!post) return res.status(404).json({ error: "Post not found" });
    const isAuthor = post.author_id === userId;
    const isAdmin = await isAdminUser(userId);
    if (!isAuthor && !isAdmin) {
      if (post.is_hidden || post.status !== "approved") {
        return res.status(404).json({ error: "Post not found" });
      }
    }

    const [mediaRes, linksRes, likeRes, bookmarkRes, author] = await Promise.all([
      supabase.from("travel_post_media").select("*").eq("post_id", id).order("order_index", { ascending: true }),
      supabase.from("travel_post_links").select("*").eq("post_id", id).order("order_index", { ascending: true }),
      supabase.from("travel_post_likes").select("id").eq("post_id", id).eq("user_id", userId).maybeSingle(),
      supabase.from("travel_post_bookmarks").select("id").eq("post_id", id).eq("user_id", userId).maybeSingle(),
      fetchAuthor(post.author_id),
    ]);

    // Fire-and-forget view counter
    atomicCounter(id, "views_count", 1).catch(() => {});

    return res.json(
      formatPost(
        { ...post, media: mediaRes.data ?? [], links: linksRes.data ?? [] },
        author,
        !!likeRes.data,
        !!bookmarkRes.data
      )
    );
  } catch (error) {
    console.error("Get travel post error:", error);
    res.status(500).json({ error: "Failed to fetch post" });
  }
});

// POST /api/travel-posts — create post
router.post("/", requireAuth, async (req: any, res: any) => {
  try {
    const userId = req.headers["user-id"] as string;
    const parsed = createPostSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid request" });
    }
    const { city, country, coordinates, caption, media, links } = parsed.data;

    // Insert post row first to get an ID for storage paths
    const { data: post, error: postErr } = await supabase
      .from("travel_posts")
      .insert({ author_id: userId, city, country, coordinates: coordinates ?? null, caption: caption ?? null })
      .select()
      .single();
    if (postErr) throw postErr;

    // Upload media in parallel
    const uploadedMedia: { url: string; storage_path: string; type: string; order_index: number }[] = [];
    if (media.length > 0) {
      const results = await Promise.allSettled(
        media.map((m) => uploadMediaItem(m.data, post.id).then((r) => ({ ...r, order_index: m.order_index })))
      );
      for (const r of results) {
        if (r.status === "rejected") {
          // Cleanup already-uploaded files and delete the post row
          await deleteMediaFiles(post.id).catch(() => {});
          await supabase.from("travel_posts").delete().eq("id", post.id);
          return res.status(400).json({ error: r.reason?.message ?? "Media upload failed" });
        }
        uploadedMedia.push(r.value);
      }

      const { error: mediaErr } = await supabase.from("travel_post_media").insert(
        uploadedMedia.map((m) => ({ post_id: post.id, type: m.type, url: m.url, storage_path: m.storage_path, order_index: m.order_index }))
      );
      if (mediaErr) throw mediaErr;
    }

    // Insert links
    if (links.length > 0) {
      const { error: linksErr } = await supabase.from("travel_post_links").insert(
        links.map((l) => ({ post_id: post.id, url: l.url, title: l.title, description: l.description ?? null, order_index: l.order_index }))
      );
      if (linksErr) throw linksErr;
    }

    const author = await fetchAuthor(userId);
    const response = formatPost(
      { ...post, media: uploadedMedia, links: links.map((l, i) => ({ ...l, id: `temp-${i}`, post_id: post.id })) },
      author, false, false
    );
    res.status(201).json(response);

    // Notify all admins of new pending post (fire-and-forget)
    (async () => {
      try {
        const { data: admins } = await supabase
          .from("users")
          .select("id")
          .or("is_admin.eq.true,user_role.eq.administrator");
        const authorName = [author.first_name, author.last_name].filter(Boolean).join(" ") || "An alumni";
        if (admins) {
          for (const admin of admins) {
            await createAndEmitNotification({
              userId: admin.id,
              type: NotificationType.POST_PENDING_APPROVAL,
              title: "Travel Post Pending Review",
              content: `${authorName} submitted a travel post from ${city}, ${country}.`,
              relatedId: post.id,
              redirectUrl: "/admin/travel-chapters",
              actorId: userId,
            }).catch(() => {});
          }
        }
      } catch {}
    })();
  } catch (error) {
    console.error("Create travel post error:", error);
    res.status(500).json({ error: "Failed to create post" });
  }
});

// PATCH /api/travel-posts/:id — edit post (owner only, or admin without resubmit)
router.patch("/:id", requireAuth, async (req: any, res: any) => {
  try {
    const userId = req.headers["user-id"] as string;
    const { id } = req.params;

    const { data: post } = await supabase
      .from("travel_posts")
      .select("id, author_id, status, caption, city, country, resubmit_count")
      .eq("id", id)
      .maybeSingle();
    if (!post) return res.status(404).json({ error: "Post not found" });
    const isAuthor = post.author_id === userId;
    if (!isAuthor && !(await isAdminUser(userId))) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { city, country, coordinates, caption, media, links, resubmit } = req.body;
    const isResubmit = resubmit === true && isAuthor; // admins never trigger resubmit flow

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (city !== undefined) updates.city = city;
    if (country !== undefined) updates.country = country;
    if (coordinates !== undefined) updates.coordinates = coordinates;
    if (caption !== undefined) updates.caption = caption;

    // Capture old media snapshot BEFORE deletion (needed for resubmit diff)
    let previousMediaSnapshot: { url: string; type: string; order_index: number }[] | null = null;
    if (isResubmit && Array.isArray(media)) {
      const { data: currentMedia } = await supabase
        .from("travel_post_media")
        .select("url, type, order_index")
        .eq("post_id", id)
        .order("order_index");
      previousMediaSnapshot = currentMedia ?? [];
    }

    // Build resubmit updates (only when author is explicitly resubmitting)
    if (isResubmit) {
      // Only snapshot if the post was approved or rejected (has a "published" state to compare against)
      // If still pending, keep existing snapshot (holds last approved version or null for brand-new)
      if (post.status === "approved" || post.status === "rejected") {
        updates.previous_caption = post.caption ?? null;
        updates.previous_city = post.city ?? null;
        updates.previous_country = post.country ?? null;
        updates.previous_media_snapshot = previousMediaSnapshot ?? null;
      }
      updates.status = "pending";
      updates.rejection_reason = null;
      updates.resubmit_count = (post.resubmit_count ?? 0) + 1;
    }

    // Full replacement for media — upload new files first, then write DB atomically
    let uploadedMedia: any[] | null = null;
    if (Array.isArray(media)) {
      // Upload any new base64 items before touching the DB
      const results = await Promise.allSettled(
        media.map((m: any) => {
          if (m.data?.startsWith("data:")) {
            return uploadMediaItem(m.data, id).then((r) => ({ ...r, order_index: m.order_index ?? 0 }));
          }
          // Already-uploaded URL passed back (no re-upload needed)
          return Promise.resolve({ url: m.url, storage_path: m.storage_path ?? null, type: m.type, order_index: m.order_index ?? 0 });
        })
      );
      for (const r of results) {
        if (r.status === "rejected") return res.status(400).json({ error: r.reason?.message ?? "Media upload failed" });
      }
      uploadedMedia = results.map((r) => (r as PromiseFulfilledResult<any>).value);

      // All uploads succeeded — now delete old storage files and DB rows
      await deleteMediaFiles(id);
      await supabase.from("travel_post_media").delete().eq("post_id", id);
      if (uploadedMedia.length > 0) {
        await supabase.from("travel_post_media").insert(
          uploadedMedia.map((m) => ({ post_id: id, type: m.type, url: m.url, storage_path: m.storage_path, order_index: m.order_index }))
        );
      }
    }

    // Write post-level updates (status, snapshot, city, caption, etc.) AFTER media succeeds
    await supabase.from("travel_posts").update(updates).eq("id", id);

    // Full replacement for links
    if (Array.isArray(links)) {
      await supabase.from("travel_post_links").delete().eq("post_id", id);
      if (links.length > 0) {
        await supabase.from("travel_post_links").insert(
          links.slice(0, 5).map((l: any, i: number) => ({ post_id: id, url: l.url, title: l.title, description: l.description ?? null, order_index: l.order_index ?? i }))
        );
      }
    }

    const { data: updated } = await supabase.from("travel_posts").select("*").eq("id", id).maybeSingle();
    const [newMediaRes, newLinksRes, author] = await Promise.all([
      supabase.from("travel_post_media").select("*").eq("post_id", id).order("order_index"),
      supabase.from("travel_post_links").select("*").eq("post_id", id).order("order_index"),
      fetchAuthor(userId),
    ]);
    const [likeRes, bookmarkRes] = await Promise.all([
      supabase.from("travel_post_likes").select("id").eq("post_id", id).eq("user_id", userId).maybeSingle(),
      supabase.from("travel_post_bookmarks").select("id").eq("post_id", id).eq("user_id", userId).maybeSingle(),
    ]);

    const response = formatPost({ ...updated, media: newMediaRes.data ?? [], links: newLinksRes.data ?? [] }, author, !!likeRes.data, !!bookmarkRes.data);

    // Notify all admins of edit/resubmission (fire-and-forget)
    if (isAuthor) {
      const effectiveCity = city ?? post.city;
      const effectiveCountry = country ?? post.country;
      const newResubmitCount = (post.resubmit_count ?? 0) + (isResubmit ? 1 : 0);
      (async () => {
        try {
          const { data: admins } = await supabase
            .from("users")
            .select("id")
            .or("is_admin.eq.true,user_role.eq.administrator");
          const authorInfo = await fetchAuthor(userId);
          const authorName = [authorInfo.first_name, authorInfo.last_name].filter(Boolean).join(" ") || "An alumni";
          if (admins) {
            for (const admin of admins) {
              await createAndEmitNotification({
                userId: admin.id,
                type: NotificationType.POST_PENDING_APPROVAL,
                title: isResubmit ? "Travel Post Resubmitted for Review" : "Travel Post Edited",
                content: isResubmit
                  ? `${authorName} resubmitted their travel post from ${effectiveCity}, ${effectiveCountry} (edit #${newResubmitCount}).`
                  : `${authorName} edited their travel post from ${effectiveCity}, ${effectiveCountry}.`,
                relatedId: id,
                redirectUrl: "/admin/travel-chapters",
                actorId: userId,
              }).catch(() => {});
            }
          }
        } catch {}
      })();
    }

    return res.json(response);
  } catch (error) {
    console.error("Edit travel post error:", error);
    res.status(500).json({ error: "Failed to update post" });
  }
});

// DELETE /api/travel-posts/:id
router.delete("/:id", requireAuth, async (req: any, res: any) => {
  try {
    const userId = req.headers["user-id"] as string;
    const { id } = req.params;

    const { data: post } = await supabase.from("travel_posts").select("id, author_id, city, country").eq("id", id).maybeSingle();
    if (!post) return res.status(404).json({ error: "Post not found" });
    const isAdmin = await isAdminUser(userId);
    if (post.author_id !== userId && !isAdmin) {
      return res.status(403).json({ error: "Forbidden" });
    }

    await deleteMediaFiles(id);
    const { error } = await supabase.from("travel_posts").delete().eq("id", id);
    if (error) throw error;

    // Notify the author when an admin deletes their post
    if (isAdmin && post.author_id !== userId) {
      createAndEmitNotification({
        userId: post.author_id,
        type: NotificationType.POST_DELETED,
        title: "Travel Post Removed",
        content: `Your travel post from ${post.city}, ${post.country} has been removed by an admin.`,
        redirectUrl: "/travel-journal",
      }).catch((err) => console.error("Travel post delete notification error:", err));
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("Delete travel post error:", error);
    res.status(500).json({ error: "Failed to delete post" });
  }
});

// POST /api/travel-posts/:id/like — toggle like
router.post("/:id/like", requireAuth, async (req: any, res: any) => {
  try {
    const userId = req.headers["user-id"] as string;
    const { id } = req.params;

    const { data: post } = await supabase.from("travel_posts").select("id, author_id, city").eq("id", id).maybeSingle();
    if (!post) return res.status(404).json({ error: "Post not found" });

    const { data: existing } = await supabase
      .from("travel_post_likes").select("id").eq("post_id", id).eq("user_id", userId).maybeSingle();

    if (existing) {
      await supabase.from("travel_post_likes").delete().eq("id", existing.id);
      await atomicCounter(id, "likes_count", -1);
      const { data: updated } = await supabase.from("travel_posts").select("likes_count").eq("id", id).maybeSingle();
      return res.json({ liked: false, likes_count: updated?.likes_count ?? 0 });
    }

    const { data: inserted } = await supabase
      .from("travel_post_likes")
      .upsert({ post_id: id, user_id: userId }, { onConflict: "post_id,user_id", ignoreDuplicates: true })
      .select("id")
      .maybeSingle();

    if (inserted) {
      await atomicCounter(id, "likes_count", 1);

      if (post.author_id !== userId) {
        const { data: liker } = await supabase.from("alumni").select("first_name, last_name").eq("user_id", userId).maybeSingle();
        const likerName = liker ? `${liker.first_name} ${liker.last_name}` : "Someone";
        createAndEmitNotification({
          userId: post.author_id,
          type: NotificationType.POST_LIKE,
          title: "Travel Post Liked",
          content: `${likerName} liked your travel post from ${post.city}`,
          relatedId: id,
          redirectUrl: `/travel-journal/${id}`,
          actorId: userId,
        }).catch((err) => console.error("Travel like notification error:", err));
      }
    }

    const { data: updated } = await supabase.from("travel_posts").select("likes_count").eq("id", id).maybeSingle();
    return res.json({ liked: true, likes_count: updated?.likes_count ?? 0 });
  } catch (error) {
    console.error("Toggle travel like error:", error);
    res.status(500).json({ error: "Failed to toggle like" });
  }
});

// POST /api/travel-posts/:id/bookmark — toggle bookmark
router.post("/:id/bookmark", requireAuth, async (req: any, res: any) => {
  try {
    const userId = req.headers["user-id"] as string;
    const { id } = req.params;

    const { data: post } = await supabase.from("travel_posts").select("id").eq("id", id).maybeSingle();
    if (!post) return res.status(404).json({ error: "Post not found" });

    const { data: existing } = await supabase
      .from("travel_post_bookmarks").select("id").eq("post_id", id).eq("user_id", userId).maybeSingle();

    if (existing) {
      await supabase.from("travel_post_bookmarks").delete().eq("id", existing.id);
      await atomicCounter(id, "bookmarks_count", -1);
      const { data: updated } = await supabase.from("travel_posts").select("bookmarks_count").eq("id", id).maybeSingle();
      return res.json({ bookmarked: false, bookmarks_count: updated?.bookmarks_count ?? 0 });
    }

    const { data: inserted } = await supabase
      .from("travel_post_bookmarks")
      .upsert({ post_id: id, user_id: userId }, { onConflict: "post_id,user_id", ignoreDuplicates: true })
      .select("id")
      .maybeSingle();
    if (inserted) await atomicCounter(id, "bookmarks_count", 1);

    const { data: updated } = await supabase.from("travel_posts").select("bookmarks_count").eq("id", id).maybeSingle();
    return res.json({ bookmarked: true, bookmarks_count: updated?.bookmarks_count ?? 0 });
  } catch (error) {
    console.error("Toggle travel bookmark error:", error);
    res.status(500).json({ error: "Failed to toggle bookmark" });
  }
});

// GET /api/travel-posts/:id/comments — two-level comment tree
router.get("/:id/comments", requireAuth, async (req: any, res: any) => {
  try {
    const { id } = req.params;

    const { data: post } = await supabase.from("travel_posts").select("id").eq("id", id).maybeSingle();
    if (!post) return res.status(404).json({ error: "Post not found" });

    const { data, error } = await supabase
      .from("travel_post_comments")
      .select("*")
      .eq("post_id", id)
      .order("created_at", { ascending: true });
    if (error) throw error;

    const authorIds = [...new Set((data || []).filter((c: any) => c.is_active).map((c: any) => c.author_id as string))];
    const [usersRes, alumniRes] = await Promise.all([
      authorIds.length > 0 ? supabase.from("users").select("id, username").in("id", authorIds) : { data: [] },
      authorIds.length > 0 ? supabase.from("alumni").select("user_id, first_name, last_name, profile_picture").in("user_id", authorIds) : { data: [] },
    ]);
    const userMap = new Map((usersRes.data || []).map((u: any) => [u.id, u]));
    const alumniMap = new Map((alumniRes.data || []).map((a: any) => [a.user_id, a]));

    const allComments = (data || []).map((c: any) => {
      if (!c.is_active) {
        return { id: c.id, post_id: c.post_id, parent_id: c.parent_id, is_active: false, content: null, created_at: c.created_at, author: null, replies: [] };
      }
      const u = userMap.get(c.author_id);
      const a = alumniMap.get(c.author_id);
      return {
        ...c,
        author: { id: c.author_id, username: u?.username ?? null, first_name: a?.first_name ?? null, last_name: a?.last_name ?? null, profile_picture: a?.profile_picture ?? null },
        replies: [] as any[],
      };
    });

    const topLevel = allComments.filter((c: any) => !c.parent_id);
    const repliesMap = new Map<string, any[]>();
    allComments.filter((c: any) => c.parent_id).forEach((c: any) => {
      if (!repliesMap.has(c.parent_id)) repliesMap.set(c.parent_id, []);
      repliesMap.get(c.parent_id)!.push(c);
    });
    topLevel.forEach((c: any) => { c.replies = repliesMap.get(c.id) ?? []; });

    // Filter: hide inactive comments with no replies (show placeholder if has replies)
    const visible = topLevel.filter((c: any) => c.is_active || c.replies.length > 0);
    visible.forEach((c: any) => { c.replies = c.replies.filter((r: any) => r.is_active); });

    return res.json(visible);
  } catch (error) {
    console.error("Get travel comments error:", error);
    res.status(500).json({ error: "Failed to fetch comments" });
  }
});

// POST /api/travel-posts/:id/comments — add comment or reply
router.post("/:id/comments", requireAuth, async (req: any, res: any) => {
  try {
    const userId = req.headers["user-id"] as string;
    const { id } = req.params;
    const { content, parent_id } = req.body;

    if (!content?.trim()) return res.status(400).json({ error: "Comment content is required" });
    if (content.trim().length > 2000) return res.status(400).json({ error: "Comment too long (max 2000 chars)" });

    const { data: post } = await supabase.from("travel_posts").select("id, author_id, city, status").eq("id", id).maybeSingle();
    if (!post) return res.status(404).json({ error: "Post not found" });
    if (post.status !== "approved") return res.status(403).json({ error: "Comments are only allowed on approved posts" });

    if (parent_id) {
      const { data: parentComment } = await supabase
        .from("travel_post_comments")
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
      .from("travel_post_comments")
      .insert({ post_id: id, author_id: userId, content: content.trim(), parent_id: parent_id || null })
      .select()
      .single();
    if (error) throw error;

    await atomicCounter(id, "comments_count", 1);

    const author = await fetchAuthor(userId);

    // Notify post author (skip self)
    if (post.author_id !== userId) {
      const commenterName = `${author.first_name ?? ""} ${author.last_name ?? ""}`.trim() || "Someone";
      createAndEmitNotification({
        userId: post.author_id,
        type: NotificationType.POST_COMMENT,
        title: "New Comment",
        content: `${commenterName} commented on your travel post from ${post.city}`,
        relatedId: id,
        redirectUrl: `/travel-journal/${id}`,
        actorId: userId,
      }).catch(() => {});
    }

    // If it's a reply, also notify the parent comment author (if different from post author and self)
    if (parent_id) {
      const { data: parentComment } = await supabase.from("travel_post_comments").select("author_id").eq("id", parent_id).maybeSingle();
      if (parentComment && parentComment.author_id !== userId && parentComment.author_id !== post.author_id) {
        const commenterName = `${author.first_name ?? ""} ${author.last_name ?? ""}`.trim() || "Someone";
        createAndEmitNotification({
          userId: parentComment.author_id,
          type: NotificationType.POST_COMMENT,
          title: "New Reply",
          content: `${commenterName} replied to your comment on a travel post from ${post.city}`,
          relatedId: id,
          redirectUrl: `/travel-journal/${id}`,
          actorId: userId,
        }).catch(() => {});
      }
    }

    return res.status(201).json({ ...comment, author, replies: [] });
  } catch (error) {
    console.error("Add travel comment error:", error);
    res.status(500).json({ error: "Failed to add comment" });
  }
});

// DELETE /api/travel-posts/:id/comments/:commentId — soft delete
router.delete("/:id/comments/:commentId", requireAuth, async (req: any, res: any) => {
  try {
    const userId = req.headers["user-id"] as string;
    const { commentId } = req.params;

    const { data: comment } = await supabase
      .from("travel_post_comments")
      .select("id, post_id, author_id, parent_id")
      .eq("id", commentId)
      .maybeSingle();
    if (!comment) return res.status(404).json({ error: "Comment not found" });

    const isAdmin = await isAdminUser(userId);
    if (comment.author_id !== userId && !isAdmin) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Soft-delete comment and any replies
    const { data: replies } = await supabase
      .from("travel_post_comments")
      .select("id")
      .eq("parent_id", commentId)
      .eq("is_active", true);
    const replyCount = replies?.length ?? 0;

    await supabase.from("travel_post_comments").update({ is_active: false }).eq("id", commentId);
    if (replyCount > 0) {
      await supabase.from("travel_post_comments").update({ is_active: false }).eq("parent_id", commentId);
    }

    await atomicCounter(comment.post_id, "comments_count", -(1 + replyCount));
    return res.json({ success: true });
  } catch (error) {
    console.error("Delete travel comment error:", error);
    res.status(500).json({ error: "Failed to delete comment" });
  }
});

// ==================== ADMIN ROUTES ====================

// GET /api/travel-posts/admin/all
router.get("/admin/all", requireAdmin, async (req: any, res: any) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const hiddenOnly = req.query.hidden === "true";
    const statusFilter = req.query.status as string | undefined;
    const offset = (page - 1) * limit;

    let query = supabase
      .from("travel_posts")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (statusFilter && ["pending", "approved", "rejected"].includes(statusFilter)) {
      query = query.eq("status", statusFilter);
    }
    if (hiddenOnly) query = query.eq("is_hidden", true);

    const { data: posts, error, count } = await query;
    if (error) throw error;
    if (!posts || posts.length === 0) return res.json({ posts: [], total: 0, page, limit });

    const postIds = posts.map((p: any) => p.id);
    const authorIds = [...new Set(posts.map((p: any) => p.author_id as string))];

    const [mediaRes, usersRes, alumniRes] = await Promise.all([
      supabase.from("travel_post_media").select("post_id, type, url, order_index").in("post_id", postIds).order("order_index"),
      supabase.from("users").select("id, username").in("id", authorIds),
      supabase.from("alumni").select("user_id, first_name, last_name, profile_picture").in("user_id", authorIds),
    ]);

    const mediaMap = new Map<string, any[]>();
    (mediaRes.data || []).forEach((m: any) => {
      if (!mediaMap.has(m.post_id)) mediaMap.set(m.post_id, []);
      mediaMap.get(m.post_id)!.push(m);
    });
    const userMap = new Map((usersRes.data || []).map((u: any) => [u.id, u]));
    const alumniMap = new Map((alumniRes.data || []).map((a: any) => [a.user_id, a]));

    const formatted = posts.map((p: any) => {
      const u = userMap.get(p.author_id);
      const a = alumniMap.get(p.author_id);
      const author = { id: p.author_id, username: u?.username ?? null, first_name: a?.first_name ?? null, last_name: a?.last_name ?? null, profile_picture: a?.profile_picture ?? null };
      return formatPost({ ...p, media: mediaMap.get(p.id) ?? [], links: [] }, author, false, false);
    });

    return res.json({ posts: formatted, total: count ?? 0, page, limit });
  } catch (error) {
    console.error("Admin travel posts error:", error);
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});

// PATCH /api/travel-posts/admin/:id/hide — toggle is_hidden
router.patch("/admin/:id/hide", requireAdmin, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { hidden } = req.body;

    const { data: post } = await supabase.from("travel_posts").select("id").eq("id", id).maybeSingle();
    if (!post) return res.status(404).json({ error: "Post not found" });

    const { error } = await supabase
      .from("travel_posts")
      .update({ is_hidden: !!hidden, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;

    return res.json({ success: true, is_hidden: !!hidden });
  } catch (error) {
    console.error("Admin hide post error:", error);
    res.status(500).json({ error: "Failed to update post" });
  }
});

// PATCH /api/travel-posts/admin/:id/approve
router.patch("/admin/:id/approve", requireAdmin, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const adminId = req.headers["user-id"] as string;

    const { data: existing } = await supabase
      .from("travel_posts")
      .select("status, author_id, city, country")
      .eq("id", id)
      .maybeSingle();
    if (!existing) return res.status(404).json({ error: "Post not found" });
    if (existing.status !== "pending") {
      return res.status(400).json({ error: "Only pending posts can be approved" });
    }

    const { error } = await supabase
      .from("travel_posts")
      .update({
        status: "approved",
        rejection_reason: null,
        previous_caption: null,
        previous_city: null,
        previous_country: null,
        previous_media_snapshot: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw error;

    createAndEmitNotification({
      userId: existing.author_id,
      type: NotificationType.POST_APPROVED,
      title: "Travel Post Approved",
      content: `Your travel post from ${existing.city}, ${existing.country} has been approved and is now live!`,
      relatedId: id,
      redirectUrl: `/travel-journal/${id}`,
      actorId: adminId,
    }).catch(() => {});

    return res.json({ success: true });
  } catch (error) {
    console.error("Admin approve post error:", error);
    res.status(500).json({ error: "Failed to approve post" });
  }
});

// PATCH /api/travel-posts/admin/:id/reject
router.patch("/admin/:id/reject", requireAdmin, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const adminId = req.headers["user-id"] as string;
    const { rejection_reason } = req.body;

    if (!rejection_reason?.trim()) {
      return res.status(400).json({ error: "Rejection reason is required" });
    }

    const { data: existing } = await supabase
      .from("travel_posts")
      .select("status, author_id, city, country")
      .eq("id", id)
      .maybeSingle();
    if (!existing) return res.status(404).json({ error: "Post not found" });
    if (existing.status !== "pending") {
      return res.status(400).json({ error: "Only pending posts can be rejected" });
    }

    const { error } = await supabase
      .from("travel_posts")
      .update({ status: "rejected", rejection_reason: rejection_reason.trim(), updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;

    createAndEmitNotification({
      userId: existing.author_id,
      type: NotificationType.POST_REJECTED,
      title: "Travel Post Not Approved",
      content: `Your travel post from ${existing.city}, ${existing.country} was not approved. Reason: ${rejection_reason.trim()}`,
      relatedId: id,
      redirectUrl: `/travel-journal?tab=mine`,
      actorId: adminId,
    }).catch(() => {});

    return res.json({ success: true });
  } catch (error) {
    console.error("Admin reject post error:", error);
    res.status(500).json({ error: "Failed to reject post" });
  }
});

export default router;
