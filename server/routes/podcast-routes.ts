import { Router } from "express";
import { supabase } from "../supabase";
import { broadcastNotificationToAllAlumni, NotificationType, NotificationRedirectUrl } from "../services/notification-helper";

const router = Router();

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

function deriveEmbedUrl(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") {
      const id = u.pathname.slice(1).split("?")[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname.startsWith("/embed/")) return url;
      const id = u.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (u.hostname === "vimeo.com") {
      const id = u.pathname.slice(1).split("/")[0];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
    return url;
  } catch {
    return null;
  }
}

async function isAdminUser(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("users")
    .select("is_admin, user_role")
    .eq("id", userId)
    .maybeSingle();
  return !!(data?.is_admin || data?.user_role === "administrator");
}

function escapeLike(value: string): string {
  return value.replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function validateLinks(links: any[]): string | null {
  for (const link of links) {
    if (!link.url || typeof link.url !== "string") return "Each link must have a url";
    if (!/^https?:\/\//i.test(link.url)) return "Link URLs must start with http:// or https://";
  }
  return null;
}

function parseLinks(raw: any): { label: string; url: string }[] {
  try { return JSON.parse(raw || "[]"); } catch { return []; }
}

function parseTags(raw: any): string[] {
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw || "[]"); } catch { return []; }
}

async function lazyPublishScheduled() {
  try {
    await supabase
      .from("podcasts")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("status", "scheduled")
      .lte("scheduled_at", new Date().toISOString());
  } catch {
    // Non-critical — don't block the public listing
  }
}

// ==================== ADMIN ROUTES (must come before /:slug) ====================

// GET /api/podcasts/admin/all — all episodes (admin only)
router.get("/admin/all", async (req: any, res: any) => {
  try {
    const userId = req.headers["user-id"] as string;
    if (!userId || !(await isAdminUser(userId))) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const status = req.query.status as string;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const offset = (page - 1) * limit;

    let query = supabase
      .from("podcasts")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && ["draft", "scheduled", "published"].includes(status)) {
      query = query.eq("status", status);
    }

    const { data, error, count } = await query;
    if (error) {
      console.error("[podcasts /admin/all]", error);
      return res.status(500).json({ error: error.message });
    }

    const episodes = (data || []).map((ep: any) => ({
      ...ep,
      links: parseLinks(ep.links),
      tags: parseTags(ep.tags),
    }));

    return res.json({ episodes, total: count || 0, page, totalPages: Math.ceil((count || 0) / limit) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/podcasts — create episode (admin only)
router.post("/", async (req: any, res: any) => {
  try {
    const userId = req.headers["user-id"] as string;
    if (!userId || !(await isAdminUser(userId))) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { title, description, showNotes, videoUrl, links, tags, episodeNumber, status, scheduledAt } = req.body;

    if (!title?.trim()) return res.status(400).json({ error: "Title is required" });
    if (!videoUrl?.trim()) return res.status(400).json({ error: "Video URL is required" });

    const resolvedStatus = status || "draft";
    if (resolvedStatus === "scheduled") {
      if (!scheduledAt) return res.status(400).json({ error: "Scheduled date/time is required for scheduled episodes" });
      if (new Date(scheduledAt) <= new Date()) return res.status(400).json({ error: "Scheduled time must be in the future" });
    }

    const slug = generateSlug(title);
    const embedUrl = deriveEmbedUrl(videoUrl);
    const linksArr = Array.isArray(links) ? links : [];
    const linkError = validateLinks(linksArr);
    if (linkError) return res.status(400).json({ error: linkError });
    const linksJson = JSON.stringify(linksArr);
    const tagsArr = Array.isArray(tags) ? tags.filter(Boolean) : [];
    const publishedAt = resolvedStatus === "published" ? new Date().toISOString() : null;

    const { data, error } = await supabase
      .from("podcasts")
      .insert({
        created_by: userId,
        title: title.trim(),
        slug,
        description: description?.trim() || null,
        show_notes: showNotes?.trim() || null,
        video_url: videoUrl.trim(),
        embed_url: embedUrl,
        links: linksJson,
        tags: tagsArr,
        episode_number: episodeNumber || null,
        status: resolvedStatus,
        scheduled_at: scheduledAt || null,
        published_at: publishedAt,
        is_featured: false,
        views_count: 0,
      })
      .select()
      .single();

    if (error) {
      console.error("[podcasts POST /]", error);
      return res.status(500).json({ error: error.message });
    }

    if (resolvedStatus === "published") {
      broadcastNotificationToAllAlumni({
        type: NotificationType.NEW_PODCAST,
        title: "New Podcast Episode",
        content: `A new podcast episode is available: "${data.title}"`,
        relatedId: data.id,
        redirectUrl: `${NotificationRedirectUrl.PODCASTS}/${data.slug}`,
        actorId: userId,
      }).catch(() => {});

      const io = (global as any).io;
      if (io) io.emit("new_podcast", { podcast: { ...data, links: parseLinks(data.links), tags: parseTags(data.tags) } });
    }

    return res.status(201).json({ ...data, links: parseLinks(data.links), tags: parseTags(data.tags) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/podcasts/:id/publish — force-publish immediately (admin only)
router.put("/:id/publish", async (req: any, res: any) => {
  try {
    const userId = req.headers["user-id"] as string;
    if (!userId || !(await isAdminUser(userId))) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { data, error } = await supabase
      .from("podcasts")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    broadcastNotificationToAllAlumni({
      type: NotificationType.NEW_PODCAST,
      title: "New Podcast Episode",
      content: `A new podcast episode is available: "${data.title}"`,
      relatedId: data.id,
      redirectUrl: `${NotificationRedirectUrl.PODCASTS}/${data.slug}`,
      actorId: userId,
    }).catch(() => {});

    const io = (global as any).io;
    if (io) io.emit("new_podcast", { podcast: { ...data, links: parseLinks(data.links), tags: parseTags(data.tags) } });

    return res.json({ ...data, links: parseLinks(data.links), tags: parseTags(data.tags) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/podcasts/:id/feature — toggle is_featured (admin only)
router.put("/:id/feature", async (req: any, res: any) => {
  try {
    const userId = req.headers["user-id"] as string;
    if (!userId || !(await isAdminUser(userId))) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { data: existing } = await supabase
      .from("podcasts")
      .select("is_featured")
      .eq("id", req.params.id)
      .maybeSingle();

    const { data, error } = await supabase
      .from("podcasts")
      .update({ is_featured: !existing?.is_featured, updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ...data, links: parseLinks(data.links), tags: parseTags(data.tags) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/podcasts/:id — update episode (admin only)
router.put("/:id", async (req: any, res: any) => {
  try {
    const userId = req.headers["user-id"] as string;
    if (!userId || !(await isAdminUser(userId))) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { title, description, showNotes, videoUrl, links, tags, episodeNumber, status, scheduledAt, isFeatured } = req.body;

    const { data: existing, error: fetchErr } = await supabase
      .from("podcasts")
      .select("id, status, published_at, video_url, embed_url")
      .eq("id", req.params.id)
      .maybeSingle();

    if (fetchErr) return res.status(500).json({ error: fetchErr.message });
    if (!existing) return res.status(404).json({ error: "Episode not found" });

    const resolvedStatus = status || existing.status;
    if (resolvedStatus === "scheduled") {
      if (!scheduledAt) return res.status(400).json({ error: "Scheduled date/time is required for scheduled episodes" });
      if (new Date(scheduledAt) <= new Date()) return res.status(400).json({ error: "Scheduled time must be in the future" });
    }

    let publishedAt = existing.published_at;
    if (resolvedStatus === "published" && !publishedAt) {
      publishedAt = new Date().toISOString();
    }

    const updatePayload: any = { updated_at: new Date().toISOString() };
    if (title !== undefined) updatePayload.title = title.trim();
    if (description !== undefined) updatePayload.description = description?.trim() || null;
    if (showNotes !== undefined) updatePayload.show_notes = showNotes?.trim() || null;
    if (videoUrl !== undefined) {
      updatePayload.video_url = videoUrl.trim();
      updatePayload.embed_url = deriveEmbedUrl(videoUrl.trim());
    } else if (existing.video_url && !existing.embed_url) {
      // Re-derive embed_url if it was never set (e.g. stored null from prior bad input)
      updatePayload.embed_url = deriveEmbedUrl(existing.video_url);
    }
    if (links !== undefined) {
      const linksArr = Array.isArray(links) ? links : [];
      const linkError = validateLinks(linksArr);
      if (linkError) return res.status(400).json({ error: linkError });
      updatePayload.links = JSON.stringify(linksArr);
    }
    if (tags !== undefined) updatePayload.tags = Array.isArray(tags) ? tags.filter(Boolean) : [];
    if (episodeNumber !== undefined) updatePayload.episode_number = episodeNumber || null;
    if (status !== undefined) updatePayload.status = resolvedStatus;
    if (scheduledAt !== undefined) updatePayload.scheduled_at = scheduledAt || null;
    if (isFeatured !== undefined) updatePayload.is_featured = isFeatured;
    if (publishedAt !== existing.published_at) updatePayload.published_at = publishedAt;

    const { data, error } = await supabase
      .from("podcasts")
      .update(updatePayload)
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) {
      console.error("[podcasts PUT /:id]", error);
      return res.status(500).json({ error: error.message });
    }
    return res.json({ ...data, links: parseLinks(data.links), tags: parseTags(data.tags) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/podcasts/:id — delete episode (admin only)
router.delete("/:id", async (req: any, res: any) => {
  try {
    const userId = req.headers["user-id"] as string;
    if (!userId || !(await isAdminUser(userId))) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { error } = await supabase.from("podcasts").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==================== LIKE / COMMENT ROUTES ====================

// POST /api/podcasts/:id/like — toggle like for the authenticated user
router.post("/:id/like", async (req: any, res: any) => {
  const userId = req.headers["user-id"] as string;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const podcastId = req.params.id;
  try {
    const { data: existing } = await supabase
      .from("podcast_likes")
      .select("id")
      .eq("podcast_id", podcastId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      await supabase.from("podcast_likes").delete().eq("id", existing.id);

      const { data: pod } = await supabase
        .from("podcasts")
        .select("likes_count")
        .eq("id", podcastId)
        .maybeSingle();

      const newCount = Math.max(0, (pod?.likes_count ?? 1) - 1);
      await supabase
        .from("podcasts")
        .update({ likes_count: newCount, updated_at: new Date().toISOString() })
        .eq("id", podcastId);

      return res.json({ isLiked: false, likes_count: newCount });
    } else {
      await supabase.from("podcast_likes").insert({ podcast_id: podcastId, user_id: userId });

      const { data: pod } = await supabase
        .from("podcasts")
        .select("likes_count")
        .eq("id", podcastId)
        .maybeSingle();

      const newCount = (pod?.likes_count ?? 0) + 1;
      await supabase
        .from("podcasts")
        .update({ likes_count: newCount, updated_at: new Date().toISOString() })
        .eq("id", podcastId);

      return res.json({ isLiked: true, likes_count: newCount });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/podcasts/:id/comments — list comments for an episode
router.get("/:id/comments", async (req: any, res: any) => {
  const podcastId = req.params.id;
  try {
    const { data, error } = await supabase
      .from("podcast_comments")
      .select("id, content, user_id, created_at, users:user_id(id, username)")
      .eq("podcast_id", podcastId)
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (error) return res.status(500).json({ error: error.message });

    const userIds = (data || []).map((c: any) => c.user_id).filter(Boolean);
    const alumniMap: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: alumniData } = await supabase
        .from("alumni")
        .select("user_id, profile_picture_url, first_name, last_name")
        .in("user_id", userIds);
      (alumniData || []).forEach((a: any) => { alumniMap[a.user_id] = a; });
    }

    const comments = (data || []).map((c: any) => {
      const alumni = alumniMap[c.user_id];
      return {
        id: c.id,
        content: c.content,
        createdAt: c.created_at,
        author: {
          id: c.users?.id,
          username: c.users?.username,
          firstName: alumni?.first_name || null,
          lastName: alumni?.last_name || null,
          avatarUrl: alumni?.profile_picture_url || null,
        },
      };
    });

    return res.json({ comments });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/podcasts/:id/comments — add a comment to an episode
router.post("/:id/comments", async (req: any, res: any) => {
  const userId = req.headers["user-id"] as string;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const podcastId = req.params.id;
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: "Content is required" });

  try {
    const { data, error } = await supabase
      .from("podcast_comments")
      .insert({ podcast_id: podcastId, user_id: userId, content: content.trim(), is_active: true })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    // Increment comments_count
    const { data: pod } = await supabase
      .from("podcasts")
      .select("comments_count")
      .eq("id", podcastId)
      .maybeSingle();

    await supabase
      .from("podcasts")
      .update({ comments_count: (pod?.comments_count ?? 0) + 1, updated_at: new Date().toISOString() })
      .eq("id", podcastId);

    return res.status(201).json({ comment: data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==================== VIEW TRACKING ROUTES ====================

// POST /api/podcasts/:id/view — record a unique view for the authenticated user
router.post("/:id/view", async (req: any, res: any) => {
  const userId = req.headers["user-id"] as string;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.params;
  try {
    // Atomic: inserts view row + conditionally increments counter in one SQL transaction
    const { data, error } = await supabase.rpc("increment_podcast_view", {
      p_podcast_id: id,
      p_user_id: userId,
    });
    if (error) throw error;
    return res.json({ views_count: data ?? 0 });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/podcasts/:id/viewers — list users who viewed this episode (admin only)
router.get("/:id/viewers", async (req: any, res: any) => {
  const userId = req.headers["user-id"] as string;
  if (!userId || !(await isAdminUser(userId))) {
    return res.status(403).json({ error: "Admin access required" });
  }

  const { id } = req.params;
  try {
    const { data, error } = await supabase
      .from("podcast_views")
      .select("viewed_at, user_id, users:user_id(id, username, email)")
      .eq("podcast_id", id)
      .order("viewed_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const userIds = (data || []).map((row: any) => row.user_id).filter(Boolean);
    const alumniMap: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: alumniData } = await supabase
        .from("alumni")
        .select("user_id, profile_picture_url, first_name, last_name")
        .in("user_id", userIds);
      (alumniData || []).forEach((a: any) => { alumniMap[a.user_id] = a; });
    }

    const viewers = (data || []).map((row: any) => {
      const alumni = alumniMap[row.user_id];
      return {
        userId: row.users?.id,
        name: alumni ? `${alumni.first_name || ""} ${alumni.last_name || ""}`.trim() : row.users?.username,
        email: row.users?.email,
        avatarUrl: alumni?.profile_picture_url || null,
        viewedAt: row.viewed_at,
      };
    });

    return res.json({ viewers, total: viewers.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==================== PUBLIC ROUTES ====================

// GET /api/podcasts — list published episodes
router.get("/", async (req: any, res: any) => {
  try {
    await lazyPublishScheduled();

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 12));
    const offset = (page - 1) * limit;
    const search = (req.query.search as string)?.trim() || "";
    const tag = (req.query.tag as string)?.trim() || "";
    const featured = req.query.featured === "true";

    let query = supabase
      .from("podcasts")
      .select("*", { count: "exact" })
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      const safeSearch = escapeLike(search);
      query = query.or(`title.ilike.%${safeSearch}%,description.ilike.%${safeSearch}%`);
    }
    if (tag) {
      query = query.contains("tags", [tag]);
    }
    if (featured) {
      query = query.eq("is_featured", true);
    }

    const { data, error, count } = await query;
    if (error) {
      console.error("[podcasts GET /]", error);
      return res.status(500).json({ error: error.message });
    }

    const userId = req.headers["user-id"] as string | undefined;
    const likedSet = new Set<string>();
    if (userId && data && data.length > 0) {
      const podcastIds = data.map((ep: any) => ep.id);
      const { data: likes } = await supabase
        .from("podcast_likes")
        .select("podcast_id")
        .eq("user_id", userId)
        .in("podcast_id", podcastIds);
      (likes || []).forEach((l: any) => likedSet.add(l.podcast_id));
    }

    const episodes = (data || []).map((ep: any) => ({
      ...ep,
      links: parseLinks(ep.links),
      tags: parseTags(ep.tags),
      likes_count: ep.likes_count ?? 0,
      comments_count: ep.comments_count ?? 0,
      isLikedByUser: likedSet.has(ep.id),
    }));

    return res.json({
      episodes,
      total: count || 0,
      page,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (err: any) {
    console.error("[podcasts GET / catch]", err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/podcasts/:slug — single episode detail + increment views
router.get("/:slug", async (req: any, res: any) => {
  try {
    const { data, error } = await supabase
      .from("podcasts")
      .select("*")
      .eq("slug", req.params.slug)
      .eq("status", "published")
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "Episode not found" });

    return res.json({ ...data, links: parseLinks(data.links), tags: parseTags(data.tags) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
