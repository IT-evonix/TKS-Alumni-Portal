/**
 * Gamification Routes
 * Admin CRUD for badges + User badge/score/leaderboard APIs
 */
import { Router, Request, Response } from "express";
import { supabase } from "../supabase";
import { manuallyAwardBadge, revokeBadge } from "../services/gamification-service";

const router = Router();

// ==================== ADMIN ROUTES ====================

/**
 * GET /api/admin/gamification/badges
 * Fetch ALL badges (including disabled) for admin management
 */
router.get("/admin/badges", async (req: Request, res: Response) => {
  try {
    const { data: badges, error } = await supabase
      .from("gamification_badges")
      .select("*")
      .order("category", { ascending: true })
      .order("series_type", { ascending: true })
      .order("required_score", { ascending: true });

    if (error) {
      console.error("[Gamification] Admin fetch badges error:", error);
      return res.status(500).json({ error: "Failed to fetch badges" });
    }

    res.json({ badges: badges || [] });
  } catch (err) {
    console.error("[Gamification] Admin badges route error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/admin/gamification/badges
 * Create a new badge
 */
router.post("/admin/badges", async (req: Request, res: Response) => {
  try {
    const { name, description, category, seriesType, requiredScore, tier, iconUrl } = req.body;

    if (!name || !category) {
      return res.status(400).json({ error: "Name and category are required" });
    }

    if (category === "series" && !seriesType) {
      return res.status(400).json({ error: "Series type is required for series badges" });
    }

    const { data: badge, error } = await supabase
      .from("gamification_badges")
      .insert({
        name,
        description: description || null,
        category,
        series_type: seriesType || null,
        required_score: requiredScore || 0,
        tier: tier || null,
        icon_url: iconUrl || null,
      })
      .select("*")
      .single();

    if (error) {
      console.error("[Gamification] Create badge error:", error);
      return res.status(500).json({ error: "Failed to create badge" });
    }

    res.status(201).json({ badge });
  } catch (err) {
    console.error("[Gamification] Create badge route error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PUT /api/admin/gamification/badges/:id
 * Edit a badge
 */
router.put("/admin/badges/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, category, seriesType, requiredScore, tier, iconUrl } = req.body;

    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (seriesType !== undefined) updateData.series_type = seriesType;
    if (requiredScore !== undefined) updateData.required_score = requiredScore;
    if (tier !== undefined) updateData.tier = tier;
    if (iconUrl !== undefined) updateData.icon_url = iconUrl;

    const { data: badge, error } = await supabase
      .from("gamification_badges")
      .update(updateData)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      console.error("[Gamification] Update badge error:", error);
      return res.status(500).json({ error: "Failed to update badge" });
    }

    res.json({ badge });
  } catch (err) {
    console.error("[Gamification] Update badge route error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PATCH /api/admin/gamification/badges/:id/toggle
 * Enable or disable a badge
 */
router.patch("/admin/badges/:id/toggle", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Fetch current state
    const { data: current, error: fetchErr } = await supabase
      .from("gamification_badges")
      .select("is_enabled")
      .eq("id", id)
      .single();

    if (fetchErr || !current) {
      return res.status(404).json({ error: "Badge not found" });
    }

    const { data: badge, error } = await supabase
      .from("gamification_badges")
      .update({
        is_enabled: !current.is_enabled,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      console.error("[Gamification] Toggle badge error:", error);
      return res.status(500).json({ error: "Failed to toggle badge" });
    }

    res.json({ badge });
  } catch (err) {
    console.error("[Gamification] Toggle badge route error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * DELETE /api/admin/gamification/badges/:id
 * Delete a badge
 */
router.delete("/admin/badges/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from("gamification_badges")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[Gamification] Delete badge error:", error);
      return res.status(500).json({ error: "Failed to delete badge" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("[Gamification] Delete badge route error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ==================== ADMIN USERS / RANKINGS ====================

/**
 * GET /api/admin/gamification/users
 * Fetch leaderboard for admin (all users, their points, and earned badges count)
 */
router.get("/admin/users", async (req: Request, res: Response) => {
  try {
    // Only include alumni in gamification
    const { data: validRoleUsers, error: usersError } = await supabase
      .from("users")
      .select("id, email, username, created_at")
      .in("user_role", ["alumni"]);
      
    if (usersError) {
      return res.status(500).json({ error: "Failed to fetch users" });
    }

    const { data: alumniUsers } = await supabase
      .from("alumni")
      .select(`
        user_id, 
        first_name, 
        last_name, 
        profile_picture, 
        email
      `);

    const { data: userScores } = await supabase
      .from("user_scores")
      .select("*");

    const { data: earnedBadges } = await supabase
      .from("user_badges")
      .select("user_id");

    const enriched = (validRoleUsers || []).map(u => {
      const alumni = alumniUsers?.find(a => a.user_id === u.id);
      
      let firstName = alumni?.first_name;
      let lastName = alumni?.last_name;
      
      // Fallback to auth users username if alumni data is missing
      if (!firstName || firstName.trim() === '') {
        if (u.username) {
          firstName = u.username;
        }
      }

      const scoreData: any = userScores?.find(s => s.user_id === u.id) || {};
      const badgeCount = earnedBadges?.filter(b => b.user_id === u.id).length || 0;

      return {
        user_id: u.id,
        firstName: firstName || "Unknown",
        lastName: lastName || "",
        email: alumni?.email || u.email || "",
        profilePicture: alumni?.profile_picture || null,
        total_points: scoreData.total_points || 0,
        thread_score: scoreData.thread_score || 0,
        event_score: scoreData.event_score || 0,
        connection_score: scoreData.connection_score || 0,
        current_streak_days: scoreData.current_streak_days || 0,
        badgesCount: badgeCount,
        created_at: u.created_at
      };
    });

    // Sort by badges count first (so manual assignments rise to top), then by total points, then by account age (older first)
    enriched.sort((a, b) => {
      if (b.badgesCount !== a.badgesCount) {
        return b.badgesCount - a.badgesCount;
      }
      if (b.total_points !== a.total_points) {
        return b.total_points - a.total_points;
      }
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    res.json({ users: enriched });
  } catch (err) {
    console.error("[Gamification] Admin fetch users error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/admin/gamification/users/:userId/badges
 * Manually assign a badge to a user
 */
router.post("/admin/users/:userId/badges", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { badgeId } = req.body;

    if (!badgeId) {
      return res.status(400).json({ error: "badgeId is required" });
    }

    const result = await manuallyAwardBadge(userId, badgeId);
    res.status(200).json(result);
  } catch (err: any) {
    console.error("[Gamification] Admin manual assign error:", err);
    res.status(400).json({ error: err.message || "Failed to assign badge" });
  }
});

/**
 * GET /api/admin/gamification/users/:userId/badges
 * Get the specific list of earned badges for a user
 */
router.get("/admin/users/:userId/badges", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { data: userBadges, error } = await supabase
      .from("user_badges")
      .select("*, gamification_badges(*)")
      .eq("user_id", userId);

    if (error) {
      return res.status(500).json({ error: "Failed to fetch user badges" });
    }

    res.json({ badges: userBadges?.map(b => b.gamification_badges).filter(Boolean) || [] });
  } catch (err) {
    console.error("[Gamification] Admin fetch user badges error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * DELETE /api/admin/gamification/users/:userId/badges/:badgeId
 * Manually revoke a badge from a user
 */
router.delete("/admin/users/:userId/badges/:badgeId", async (req: Request, res: Response) => {
  try {
    const { userId, badgeId } = req.params;
    const result = await revokeBadge(userId, badgeId);
    res.status(200).json(result);
  } catch (err: any) {
    console.error("[Gamification] Admin manual revoke error:", err);
    res.status(400).json({ error: err.message || "Failed to revoke badge" });
  }
});

// ==================== ADMIN ANALYTICS ====================

/**
 * GET /api/admin/gamification/analytics
 * Get gamification overview stats for admin dashboard
 */
router.get("/admin/analytics", async (req: Request, res: Response) => {
  try {
    // Total badges created
    const { count: totalBadges } = await supabase
      .from("gamification_badges")
      .select("*", { count: "exact", head: true });

    // Total badges awarded
    const { count: totalAwarded } = await supabase
      .from("user_badges")
      .select("*", { count: "exact", head: true });

    // Users with at least one badge
    const { data: usersWithBadges } = await supabase
      .from("user_badges")
      .select("user_id")
      .limit(10000);

    const uniqueUsersWithBadges = new Set(
      (usersWithBadges || []).map((u) => u.user_id)
    ).size;

    // Top 5 leaderboard
    const { data: leaderboard } = await supabase
      .from("user_scores")
      .select("user_id, total_points, thread_score, event_score, connection_score")
      .order("total_points", { ascending: false })
      .limit(5);

    res.json({
      totalBadges: totalBadges || 0,
      totalAwarded: totalAwarded || 0,
      uniqueUsersWithBadges,
      topUsers: leaderboard || [],
    });
  } catch (err) {
    console.error("[Gamification] Analytics route error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ==================== PUBLIC / USER ROUTES ====================

/**
 * GET /api/gamification/badges
 * Fetch all ENABLED badges (for user to see earned vs locked)
 */
router.get("/badges", async (req: Request, res: Response) => {
  try {
    const { data: badges, error } = await supabase
      .from("gamification_badges")
      .select("*")
      .eq("is_enabled", true)
      .order("category", { ascending: true })
      .order("series_type", { ascending: true })
      .order("required_score", { ascending: true });

    if (error) {
      console.error("[Gamification] Fetch badges error:", error);
      return res.status(500).json({ error: "Failed to fetch badges" });
    }

    res.json({ badges: badges || [] });
  } catch (err) {
    console.error("[Gamification] Badges route error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/gamification/users/:userId/profile
 * Get a user's gamification profile: scores, earned badges, progress toward next badges
 */
router.get("/users/:userId/profile", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // Get user scores
    const { data: scores } = await supabase
      .from("user_scores")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    // Get user's earned badges with badge details
    const { data: earnedBadges } = await supabase
      .from("user_badges")
      .select("*, gamification_badges(*)")
      .eq("user_id", userId)
      .order("earned_at", { ascending: false });

    // Get all enabled badges to compute progress
    const { data: allBadges } = await supabase
      .from("gamification_badges")
      .select("*")
      .eq("is_enabled", true)
      .order("required_score", { ascending: true });

    const earnedBadgeIds = new Set(
      (earnedBadges || []).map((eb: any) => eb.badge_id)
    );

    // Compute progress for each series type
    const userScores: Record<string, number> = {
      thread: (scores?.thread_score as number) || 0,
      event: (scores?.event_score as number) || 0,
      connection: (scores?.connection_score as number) || 0,
    };

    const progress: any[] = [];

    for (const badge of allBadges || []) {
      if (badge.category === "series" && badge.series_type && !earnedBadgeIds.has(badge.id)) {
        const currentScore = userScores[badge.series_type] || 0;
        const required = badge.required_score || 0;
        if (currentScore < required) {
          progress.push({
            badge,
            currentScore,
            requiredScore: required,
            remaining: required - currentScore,
            percentComplete: Math.round((currentScore / required) * 100),
          });
        }
      }
    }

    // Only consider alumni for global rank
    const { data: validRoleUsers } = await supabase
      .from("users")
      .select("id")
      .in("user_role", ["alumni"]);
    const validIds = new Set(validRoleUsers?.map(u => u.id) || []);

    // Calculate global rank
    const { data: allUsersScores } = await supabase
      .from("user_scores")
      .select("user_id, total_points")
      .order("total_points", { ascending: false });
      
    // Fetch all user badges to sort by badges if points are equal
    const { data: allUserBadges } = await supabase
      .from("user_badges")
      .select("user_id");

    let globalRank = 0;
    if (allUsersScores) {
      // Filter out faculty/admin scores before ranking
      const filteredScores = allUsersScores.filter(us => validIds.has(us.user_id));
      
      const enrichedScores = filteredScores.map(us => {
        const badgesCount = allUserBadges?.filter(b => b.user_id === us.user_id).length || 0;
        return { ...us, badgesCount };
      });

      // Sort matching the admin ranking logic: badgesCount desc, then total_points desc
      enrichedScores.sort((a, b) => {
        if (b.badgesCount !== a.badgesCount) return b.badgesCount - a.badgesCount;
        return b.total_points - a.total_points;
      });

      const idx = enrichedScores.findIndex(s => s.user_id === userId);
      globalRank = idx >= 0 ? idx + 1 : enrichedScores.length + 1;
    }

    res.json({
      scores: scores || {
        thread_score: 0,
        event_score: 0,
        connection_score: 0,
        current_streak_days: 0,
        highest_streak: 0,
        total_points: 0,
      },
      earnedBadges: earnedBadges || [],
      progress, // Next badges to unlock with how far away they are
      globalRank
    });
  } catch (err) {
    console.error("[Gamification] User profile route error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/gamification/leaderboard
 * Top 5 alumni by badges count and total points
 */
router.get("/leaderboard", async (req: Request, res: Response) => {
  try {
    // Only include alumni in public leaderboard
    const { data: validRoleUsers } = await supabase
      .from("users")
      .select("id, username, created_at")
      .in("user_role", ["alumni"]);

    const { data: alumniUsers } = await supabase
      .from("alumni")
      .select("user_id, first_name, last_name, profile_picture, graduation_year");

    const { data: userScores, error } = await supabase
      .from("user_scores")
      .select("user_id, total_points, thread_score, event_score, connection_score, current_streak_days");

    if (error) {
      console.error("[Gamification] Leaderboard error:", error);
      return res.status(500).json({ error: "Failed to fetch leaderboard" });
    }

    const { data: allUserBadges } = await supabase.from("user_badges").select("user_id");

    const enriched = (validRoleUsers || []).map(u => {
      const alumni = alumniUsers?.find(a => a.user_id === u.id);
      
      let firstName = alumni?.first_name;
      let lastName = alumni?.last_name;
      let profilePicture = alumni?.profile_picture;
      let graduationYear = alumni?.graduation_year;

      // Fallback to auth users username if alumni data is missing
      if (!firstName || firstName.trim() === '') {
        if (u.username) {
          firstName = u.username;
        }
      }

      const scoreData: any = userScores?.find(s => s.user_id === u.id) || {};
      const badgeCount = allUserBadges?.filter(b => b.user_id === u.id).length || 0;

      return {
        user_id: u.id,
        firstName: firstName || "Unknown",
        lastName: lastName || "",
        profilePicture: profilePicture || null,
        graduationYear: graduationYear || null,
        total_points: scoreData.total_points || 0,
        thread_score: scoreData.thread_score || 0,
        event_score: scoreData.event_score || 0,
        connection_score: scoreData.connection_score || 0,
        current_streak_days: scoreData.current_streak_days || 0,
        badgesCount: badgeCount,
        created_at: u.created_at
      };
    });

    // Sort by badgesCount desc, then total_points desc, then created_at asc (older first)
    enriched.sort((a, b) => {
      if (b.badgesCount !== a.badgesCount) return b.badgesCount - a.badgesCount;
      if (b.total_points !== a.total_points) return b.total_points - a.total_points;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    // Limit to top 5
    const top5Leaderboard = enriched.slice(0, 5);

    res.json({ leaderboard: top5Leaderboard });
  } catch (err) {
    console.error("[Gamification] Leaderboard route error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
