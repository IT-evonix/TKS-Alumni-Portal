import { Router } from "express";
import { supabase } from "../supabase";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { z } from "zod";

const router = Router();

// Validation schemas
const proposeChapterSchema = z.object({
  city: z.string().min(1, "City is required"),
  country: z.string().min(1, "Country is required"),
  description: z.string().optional(),
  cover_image: z.string().optional(),
});

// GET /api/travel-chapters - Fetch all approved chapters with member count
router.get("/", requireAuth, async (req, res) => {
  try {
    const { data: chapters, error } = await supabase
      .from("travel_chapters")
      .select(`
        *,
        members:travel_chapter_members(count),
        creator:users!travel_chapters_created_by_fkey(username, email)
      `)
      .eq("status", "approved")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Format the response
    const formattedChapters = chapters.map(chapter => ({
      ...chapter,
      memberCount: chapter.members?.[0]?.count || 0
    }));

    res.json(formattedChapters);
  } catch (error) {
    console.error("Error fetching travel chapters:", error);
    res.status(500).json({ error: "Failed to fetch chapters" });
  }
});

// GET /api/travel-chapters/my-proposals - Fetch chapters proposed by the current user
router.get("/my-proposals", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { data: chapters, error } = await supabase
      .from("travel_chapters")
      .select("*")
      .eq("created_by", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json(chapters || []);
  } catch (error) {
    console.error("Error fetching my proposals:", error);
    res.status(500).json({ error: "Failed to fetch your proposals" });
  }
});

// DELETE /api/travel-chapters/:id - Delete a chapter proposal
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const chapterId = req.params.id; // UUID string — do NOT parseInt
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // Verify ownership or admin status
    const { data: chapter, error: fetchError } = await supabase
      .from("travel_chapters")
      .select("created_by")
      .eq("id", chapterId)
      .single();

    if (fetchError || !chapter) {
      return res.status(404).json({ error: "Chapter not found" });
    }

    if (chapter.created_by !== userId && userRole !== 'administrator') {
      return res.status(403).json({ error: "Forbidden: You can only delete your own proposals" });
    }

    // Delete the chapter
    const { error: deleteError } = await supabase
      .from("travel_chapters")
      .delete()
      .eq("id", chapterId);

    if (deleteError) throw deleteError;

    res.json({ message: "Chapter deleted successfully" });
  } catch (error) {
    console.error("Error deleting chapter:", error);
    res.status(500).json({ error: "Failed to delete chapter" });
  }
});

// GET /api/travel-chapters/admin - Fetch all chapters (for admin dashboard)
router.get("/admin", requireAdmin, async (req, res) => {
  try {
    const { data: chapters, error } = await supabase
      .from("travel_chapters")
      .select(`
        *,
        creator:users!travel_chapters_created_by_fkey(username, email),
        members:travel_chapter_members(count)
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json(chapters);
  } catch (error) {
    console.error("Error fetching chapters for admin:", error);
    res.status(500).json({ error: "Failed to fetch chapters" });
  }
});

// GET /api/travel-chapters/:id - Get specific chapter details with members
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.headers["user-id"] as string;

    // Get chapter details
    const { data: chapter, error: chapterError } = await supabase
      .from("travel_chapters")
      .select("*")
      .eq("id", id)
      .single();

    if (chapterError) {
      if (chapterError.code === "PGRST116") {
        return res.status(404).json({ error: "Chapter not found" });
      }
      throw chapterError;
    }

    // Get members
    const { data: members, error: membersError } = await supabase
      .from("travel_chapter_members")
      .select(`
        role,
        joined_at,
        user:users!travel_chapter_members_user_id_fkey(
          id,
          username,
          alumni!inner(first_name, last_name, profile_picture, current_company, current_role)
        )
      `)
      .eq("chapter_id", id);

    if (membersError) throw membersError;

    // Check if current user is a member
    const isMember = members.some((m: any) => {
      const u = Array.isArray(m.user) ? m.user[0] : m.user;
      return u?.id === userId;
    });

    res.json({
      ...chapter,
      isMember,
      members: members.map((m: any) => {
        const u = Array.isArray(m.user) ? m.user[0] : m.user;
        const al = Array.isArray(u?.alumni) ? u?.alumni[0] : u?.alumni;
        return {
          userId: u?.id,
          role: m.role,
          joinedAt: m.joined_at,
          firstName: al?.first_name,
          lastName: al?.last_name,
          profilePicture: al?.profile_picture,
          currentCompany: al?.current_company,
          currentRole: al?.current_role,
        };
      })
    });
  } catch (error) {
    console.error("Error fetching chapter details:", error);
    res.status(500).json({ error: "Failed to fetch chapter details" });
  }
});

// POST /api/travel-chapters - Propose a new chapter
router.post("/", requireAuth, async (req, res) => {
  try {
    const userId = req.headers["user-id"] as string;
    const validatedData = proposeChapterSchema.parse(req.body);

    const name = `${validatedData.city} Chapter`;

    let finalCoverImageUrl = validatedData.cover_image;

    if (validatedData.cover_image && validatedData.cover_image.startsWith('data:image/')) {
      const base64Data = validatedData.cover_image.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, 'base64');
      const fileExt = validatedData.cover_image.substring(
          "data:image/".length, 
          validatedData.cover_image.indexOf(";base64")
      );
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('event_covers')
        .upload(`travel-chapters/${fileName}`, buffer, {
          contentType: `image/${fileExt}`
        });
        
      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        throw new Error("Failed to upload cover image.");
      }
      
      const { data: { publicUrl } } = supabase.storage
        .from('event_covers')
        .getPublicUrl(`travel-chapters/${fileName}`);
        
      finalCoverImageUrl = publicUrl;
    }

    const { data, error } = await supabase
      .from("travel_chapters")
      .insert({
        name,
        city: validatedData.city,
        country: validatedData.country,
        description: validatedData.description,
        cover_image: finalCoverImageUrl,
        created_by: userId,
        status: "pending"
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ message: "Chapter proposed successfully. Waiting for admin approval.", chapter: data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error("Error proposing chapter:", error);
    res.status(500).json({ error: "Failed to propose chapter" });
  }
});

// PUT /api/travel-chapters/:id/status - Approve or reject a chapter (Admin only)
router.put("/:id/status", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const { data, error } = await supabase
      .from("travel_chapters")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    res.json({ message: `Chapter ${status} successfully`, chapter: data });
  } catch (error) {
    console.error("Error updating chapter status:", error);
    res.status(500).json({ error: "Failed to update chapter status" });
  }
});

// POST /api/travel-chapters/:id/join - Join a chapter
router.post("/:id/join", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.headers["user-id"] as string;

    // Check if chapter exists and is approved
    const { data: chapter, error: chapterError } = await supabase
      .from("travel_chapters")
      .select("status")
      .eq("id", id)
      .single();

    if (chapterError || !chapter) {
      return res.status(404).json({ error: "Chapter not found" });
    }

    if (chapter.status !== "approved") {
      return res.status(400).json({ error: "Cannot join an unapproved chapter" });
    }

    // Join chapter
    const { error } = await supabase
      .from("travel_chapter_members")
      .insert({
        chapter_id: id,
        user_id: userId,
        role: "member"
      });

    if (error) {
      if (error.code === '23505') { // Unique violation
        return res.status(400).json({ error: "You are already a member of this chapter" });
      }
      throw error;
    }

    res.json({ message: "Successfully joined the chapter" });
  } catch (error) {
    console.error("Error joining chapter:", error);
    res.status(500).json({ error: "Failed to join chapter" });
  }
});

// DELETE /api/travel-chapters/:id/leave - Leave a chapter
router.delete("/:id/leave", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.headers["user-id"] as string;

    const { error } = await supabase
      .from("travel_chapter_members")
      .delete()
      .eq("chapter_id", id)
      .eq("user_id", userId);

    if (error) throw error;

    res.json({ message: "Successfully left the chapter" });
  } catch (error) {
    console.error("Error leaving chapter:", error);
    res.status(500).json({ error: "Failed to leave chapter" });
  }
});

export default router;
