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
  coordinates: z.string().optional(),
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
      .select(`
        *,
        members:travel_chapter_members(count)
      `)
      .eq("created_by", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const formattedChapters = (chapters || []).map(chapter => ({
      ...chapter,
      memberCount: chapter.members?.[0]?.count || 0
    }));

    res.json(formattedChapters);
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

    const formattedChapters = (chapters || []).map(chapter => ({
      ...chapter,
      memberCount: chapter.members?.[0]?.count || 0
    }));

    res.json(formattedChapters);
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
        user_id,
        user:users!travel_chapter_members_user_id_fkey(
          id,
          username,
          alumni!inner(first_name, last_name, profile_picture, current_company, current_role)
        )
      `)
      .eq("chapter_id", id);

    if (membersError) throw membersError;

    // Check if current user is a member
    const isMember = members.some((m: any) => m.user_id === userId);

    res.json({
      ...chapter,
      isMember,
      members: members.map((m: any) => {
        const u = Array.isArray(m.user) ? m.user[0] : m.user;
        const al = Array.isArray(u?.alumni) ? u?.alumni[0] : u?.alumni;
        return {
          userId: m.user_id,
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
        coordinates: validatedData.coordinates,
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

// GET messages for a chapter
router.get("/:id/messages", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.headers["user-id"] as string;

    // Optional: check if user is member
    const { data: memberCheck } = await supabase
      .from("travel_chapter_members")
      .select("id")
      .eq("chapter_id", id)
      .eq("user_id", userId)
      .single();

    if (!memberCheck) {
      return res.status(403).json({ error: "Must be a member to view messages" });
    }

    const { data: messages, error } = await supabase
      .from("travel_chapter_messages")
      .select(`
        *,
        user:users!travel_chapter_messages_user_id_fkey(
          id,
          username,
          alumni(first_name, last_name, profile_picture)
        )
      `)
      .eq("chapter_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      // Gracefully handle table missing
      if (error.code === '42P01') return res.json([]);
      throw error;
    }
    
    const formattedMessages = messages?.map((msg: any) => {
      const u = Array.isArray(msg.user) ? msg.user[0] : msg.user;
      const al = Array.isArray(u?.alumni) ? u?.alumni[0] : u?.alumni;
      return {
        ...msg,
        user: {
          id: u?.id,
          username: u?.username,
          firstName: al?.first_name,
          lastName: al?.last_name,
          profilePicture: al?.profile_picture
        }
      };
    });
    
    res.json(formattedMessages || []);
  } catch (error: any) {
    console.error("Error fetching chapter messages:", error);
    res.status(500).json({ error: error.message || "Server Error" });
  }
});

// POST a message to a chapter
router.post("/:id/messages", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.headers["user-id"] as string;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Content is required" });
    }

    const { data: memberCheck } = await supabase
      .from("travel_chapter_members")
      .select("id")
      .eq("chapter_id", id)
      .eq("user_id", userId)
      .single();

    if (!memberCheck) {
      return res.status(403).json({ error: "Must be a member to post messages" });
    }

    const { data: message, error } = await supabase
      .from("travel_chapter_messages")
      .insert({
        chapter_id: id,
        user_id: userId,
        content: content.trim()
      })
      .select(`
        *,
        user:users!travel_chapter_messages_user_id_fkey(
          id,
          username,
          alumni(first_name, last_name, profile_picture)
        )
      `)
      .single();

    if (error) throw error;
    
    const u = Array.isArray(message.user) ? message.user[0] : message.user;
    const al = Array.isArray(u?.alumni) ? u?.alumni[0] : u?.alumni;
    const formattedMessage = {
      ...message,
      user: {
        id: u?.id,
        username: u?.username,
        firstName: al?.first_name,
        lastName: al?.last_name,
        profilePicture: al?.profile_picture
      }
    };
    
    res.json(formattedMessage);
  } catch (error: any) {
    console.error("Error posting chapter message:", error);
    res.status(500).json({ error: error.message || "Server Error" });
  }
});

// PATCH edit a message
router.patch("/:id/messages/:msgId", requireAuth, async (req, res) => {
  try {
    const { id, msgId } = req.params;
    const { content } = req.body;
    const userId = req.headers["user-id"] as string;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Content is required" });
    }

    // Verify message exists and requester is the author
    const { data: existingMessage, error: fetchError } = await supabase
      .from("travel_chapter_messages")
      .select("user_id")
      .eq("id", msgId)
      .eq("chapter_id", id)
      .single();

    if (fetchError || !existingMessage) {
      return res.status(404).json({ error: "Message not found" });
    }

    if (existingMessage.user_id !== userId) {
      return res.status(403).json({ error: "Only the author can edit this message" });
    }

    const { data: message, error } = await supabase
      .from("travel_chapter_messages")
      .update({
        content: content.trim(),
        updated_at: new Date().toISOString()
      })
      .eq("id", msgId)
      .select(`
        *,
        user:users!travel_chapter_messages_user_id_fkey(
          id,
          username,
          alumni(first_name, last_name, profile_picture)
        )
      `)
      .single();

    if (error) throw error;

    const u = Array.isArray(message.user) ? message.user[0] : message.user;
    const al = Array.isArray(u?.alumni) ? u?.alumni[0] : u?.alumni;
    const formattedMessage = {
      ...message,
      user: {
        id: u?.id,
        username: u?.username,
        firstName: al?.first_name,
        lastName: al?.last_name,
        profilePicture: al?.profile_picture
      }
    };

    res.json(formattedMessage);
  } catch (error: any) {
    console.error("Error editing chapter message:", error);
    res.status(500).json({ error: error.message || "Server Error" });
  }
});

// DELETE a message
router.delete("/:id/messages/:msgId", requireAuth, async (req, res) => {
  try {
    const { id, msgId } = req.params;
    const userId = req.headers["user-id"] as string;

    // Verify message exists
    const { data: existingMessage, error: fetchError } = await supabase
      .from("travel_chapter_messages")
      .select("user_id")
      .eq("id", msgId)
      .eq("chapter_id", id)
      .single();

    if (fetchError || !existingMessage) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Check if requester is author or admin
    let isAuthorized = existingMessage.user_id === userId;

    if (!isAuthorized) {
      const { data: user } = await supabase
        .from("users")
        .select("user_role")
        .eq("id", userId)
        .single();
      
      if (user?.user_role === "administrator") {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return res.status(403).json({ error: "Not authorized to delete this message" });
    }

    const { error } = await supabase
      .from("travel_chapter_messages")
      .delete()
      .eq("id", msgId);

    if (error) throw error;

    res.json({ message: "Message deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting chapter message:", error);
    res.status(500).json({ error: error.message || "Server Error" });
  }
});

// PATCH /api/travel-chapters/:id - Edit a travel chapter
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.headers["user-id"] as string;
    const userRole = (req as any).user?.role;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // Fetch existing chapter
    const { data: chapter, error: fetchError } = await supabase
      .from("travel_chapters")
      .select("created_by, status")
      .eq("id", id)
      .single();

    if (fetchError || !chapter) {
      return res.status(404).json({ error: "Chapter not found" });
    }

    // Verify ownership or admin status
    if (chapter.created_by !== userId && userRole !== 'administrator') {
      return res.status(403).json({ error: "Forbidden: You can only edit your own proposed chapters" });
    }

    const validatedData = proposeChapterSchema.partial().parse(req.body);
    const updates: any = { ...validatedData, updated_at: new Date().toISOString() };

    // Handle base64 cover image if provided
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
        
      updates.cover_image = publicUrl;
    }

    // Reset rejected status to pending if updated
    if (chapter.status === 'rejected') {
      updates.status = 'pending';
    }

    const { data: updatedChapter, error: updateError } = await supabase
      .from("travel_chapters")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateError) throw updateError;

    res.json({ message: "Chapter updated successfully", chapter: updatedChapter });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error("Error updating chapter:", error);
    res.status(500).json({ error: "Failed to update chapter" });
  }
});

// Event schemas and routes
const createEventSchema = z.object({
  title: z.string().min(1, "Title is required"),
  venue: z.string().min(1, "Venue/Location is required"),
  event_date: z.string().min(1, "Event date & time is required"),
  description: z.string().optional(),
});

// GET /api/travel-chapters/:id/events - Get events for a chapter
router.get("/:id/events", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.headers["user-id"] as string;
    const userRole = (req as any).user?.role;

    // Check if user is a member
    const { data: memberCheck } = await supabase
      .from("travel_chapter_members")
      .select("id")
      .eq("chapter_id", id)
      .eq("user_id", userId)
      .single();

    if (!memberCheck && userRole !== 'administrator') {
      return res.status(403).json({ error: "Must be a member to view chapter events" });
    }

    const { data: events, error } = await supabase
      .from("travel_chapter_events")
      .select(`
        *,
        creator:users!travel_chapter_events_created_by_fkey(
          id,
          username,
          alumni(first_name, last_name, profile_picture)
        ),
        rsvps:travel_chapter_event_rsvps(
          user_id,
          status,
          user:users!travel_chapter_event_rsvps_user_id_fkey(
            alumni(first_name, last_name, profile_picture)
          )
        )
      `)
      .eq("chapter_id", id)
      .order("event_date", { ascending: true });

    if (error) throw error;

    // Format the response
    const formattedEvents = (events || []).map((evt: any) => {
      const creatorUser = Array.isArray(evt.creator) ? evt.creator[0] : evt.creator;
      const creatorAlumni = Array.isArray(creatorUser?.alumni) ? creatorUser.alumni[0] : creatorUser?.alumni;
      
      let rsvpsList = (evt.rsvps || []).map((r: any) => {
        const rUser = Array.isArray(r.user) ? r.user[0] : r.user;
        const rAlumni = Array.isArray(rUser?.alumni) ? rUser.alumni[0] : rUser?.alumni;
        return {
          userId: r.user_id,
          status: r.user_id === evt.created_by ? 'going' : r.status,
          firstName: rAlumni?.first_name,
          lastName: rAlumni?.last_name,
          profilePicture: rAlumni?.profile_picture,
        };
      });

      // Ensure creator is in rsvps list and status is 'going'
      const hasCreator = rsvpsList.some((r: any) => r.userId === evt.created_by);
      if (!hasCreator && creatorUser) {
        rsvpsList.push({
          userId: creatorUser.id,
          status: 'going',
          firstName: creatorAlumni?.first_name,
          lastName: creatorAlumni?.last_name,
          profilePicture: creatorAlumni?.profile_picture,
        });
      }

      return {
        ...evt,
        creator: {
          id: creatorUser?.id,
          username: creatorUser?.username,
          firstName: creatorAlumni?.first_name,
          lastName: creatorAlumni?.last_name,
          profilePicture: creatorAlumni?.profile_picture
        },
        rsvps: rsvpsList,
        myRsvp: creatorUser?.id === userId ? 'going' : (rsvpsList.find((r: any) => r.userId === userId)?.status || null)
      };
    });

    res.json(formattedEvents);
  } catch (error) {
    console.error("Error fetching events:", error);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

// POST /api/travel-chapters/:id/events - Create a new event
router.post("/:id/events", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.headers["user-id"] as string;
    const userRole = (req as any).user?.role;

    // Check if user is a member
    const { data: memberCheck } = await supabase
      .from("travel_chapter_members")
      .select("id")
      .eq("chapter_id", id)
      .eq("user_id", userId)
      .single();

    if (!memberCheck && userRole !== 'administrator') {
      return res.status(403).json({ error: "Must be a member to create events" });
    }

    const validatedData = createEventSchema.parse(req.body);

    const { data: event, error } = await supabase
      .from("travel_chapter_events")
      .insert({
        chapter_id: id,
        title: validatedData.title,
        description: validatedData.description || "",
        venue: validatedData.venue,
        event_date: validatedData.event_date,
        created_by: userId
      })
      .select(`
        *,
        creator:users!travel_chapter_events_created_by_fkey(
          id,
          username,
          alumni(first_name, last_name, profile_picture)
        )
      `)
      .single();

    if (error) throw error;

    // Automatically RSVP 'going' for the host/creator in DB
    await supabase.from("travel_chapter_event_rsvps").insert({
      event_id: event.id,
      user_id: userId,
      status: "going"
    });

    const creatorUser = Array.isArray(event.creator) ? event.creator[0] : event.creator;
    const creatorAlumni = Array.isArray(creatorUser?.alumni) ? creatorUser.alumni[0] : creatorUser?.alumni;

    const formattedEvent = {
      ...event,
      creator: {
        id: creatorUser?.id,
        username: creatorUser?.username,
        firstName: creatorAlumni?.first_name,
        lastName: creatorAlumni?.last_name,
        profilePicture: creatorAlumni?.profile_picture
      },
      rsvps: [{
        userId: userId,
        status: 'going',
        firstName: creatorAlumni?.first_name,
        lastName: creatorAlumni?.last_name,
        profilePicture: creatorAlumni?.profile_picture
      }],
      myRsvp: 'going'
    };

    res.status(201).json(formattedEvent);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error("Error creating event:", error);
    res.status(500).json({ error: "Failed to create event" });
  }
});

// POST /api/travel-chapters/:id/events/:eventId/rsvp - RSVP to an event
router.post("/:id/events/:eventId/rsvp", requireAuth, async (req, res) => {
  try {
    const { id, eventId } = req.params;
    const userId = req.headers["user-id"] as string;
    const { status } = req.body;

    if (!["going", "maybe", "not_going"].includes(status)) {
      return res.status(400).json({ error: "Invalid RSVP status" });
    }

    // Check if user is a member of the chapter
    const { data: memberCheck } = await supabase
      .from("travel_chapter_members")
      .select("id")
      .eq("chapter_id", id)
      .eq("user_id", userId)
      .single();

    if (!memberCheck) {
      return res.status(403).json({ error: "Must be a member of the chapter to RSVP" });
    }

    // Upsert RSVP
    const { error } = await supabase
      .from("travel_chapter_event_rsvps")
      .upsert({
        event_id: eventId,
        user_id: userId,
        status,
        updated_at: new Date().toISOString()
      }, {
        onConflict: "event_id,user_id"
      });

    if (error) throw error;

    res.json({ message: "RSVP updated successfully" });
  } catch (error) {
    console.error("Error updating RSVP:", error);
    res.status(500).json({ error: "Failed to update RSVP" });
  }
});

// DELETE /api/travel-chapters/:id/events/:eventId - Delete an event
router.delete("/:id/events/:eventId", requireAuth, async (req, res) => {
  try {
    const { id, eventId } = req.params;
    const userId = req.headers["user-id"] as string;
    const userRole = (req as any).user?.role;

    // Fetch event details
    const { data: event, error: eventError } = await supabase
      .from("travel_chapter_events")
      .select("created_by")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      return res.status(404).json({ error: "Event not found" });
    }

    // Fetch chapter details (to check chapter host/creator)
    const { data: chapter, error: chapterError } = await supabase
      .from("travel_chapters")
      .select("created_by")
      .eq("id", id)
      .single();

    const isAuthorized = 
      event.created_by === userId || 
      chapter?.created_by === userId || 
      userRole === 'administrator';

    if (!isAuthorized) {
      return res.status(403).json({ error: "Unauthorized to delete this event" });
    }

    const { error } = await supabase
      .from("travel_chapter_events")
      .delete()
      .eq("id", eventId);

    if (error) throw error;

    res.json({ message: "Event deleted successfully" });
  } catch (error) {
    console.error("Error deleting event:", error);
    res.status(500).json({ error: "Failed to delete event" });
  }
});

export default router;
