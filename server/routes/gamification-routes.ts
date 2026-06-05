/**
 * Gamification Routes
 * Admin CRUD for badges + User badge/score/leaderboard APIs
 */
import { Router, Request, Response } from "express";
import { supabase } from "../supabase";
import { manuallyAwardBadge, revokeBadge, clearPointRulesCache } from "../services/gamification-service";

const router = Router();

const processUserBadges = (userBadges: any[]) => {
  if (!userBadges || userBadges.length === 0) return { badgesCount: 0, badgeScore: 0, topBadges: [], uniqueBadges: [] };
  
  const deduplicated = new Map();
  const tierWeight: any = { platinum: 4, gold: 3, silver: 2, bronze: 1 };

  userBadges.forEach(b => {
    const badge = b.gamification_badges;
    if (!badge) return;
    
    // Only deduplicate badges of 'series' category that have a tier.
    // We group by series_type AND name so different series badges don't overwrite each other.
    const isTiered = badge.tier && badge.category === 'series';
    const deduplicationKey = isTiered ? `${badge.series_type}_${badge.name}` : badge.id;
    const existing = deduplicated.get(deduplicationKey);
    
    if (!existing || (tierWeight[badge.tier || ''] || 0) > (tierWeight[existing.gamification_badges?.tier || ''] || 0)) {
      deduplicated.set(deduplicationKey, b);
    }
  });

  const uniqueBadges = Array.from(deduplicated.values());
  const badgesCount = uniqueBadges.length;

  const getBadgeScore = (tier: string | null | undefined) => {
    if (tier === 'platinum') return 100;
    if (tier === 'gold') return 50;
    if (tier === 'silver') return 20;
    if (tier === 'bronze') return 5;
    return 1; // Default for non-tiered badges
  };

  const badgeScore = uniqueBadges.reduce((acc, b: any) => acc + getBadgeScore(b.gamification_badges?.tier), 0);

  // Extract and sort badges by platinum -> gold -> silver -> bronze -> common/display_order
  const sortedBadges = uniqueBadges
    .map(b => b.gamification_badges)
    .filter(Boolean)
    .sort((a: any, b: any) => {
      const aWeight = tierWeight[a.tier || ''] || 0;
      const bWeight = tierWeight[b.tier || ''] || 0;
      if (bWeight !== aWeight) return bWeight - aWeight;
      
      return (a.display_order || 0) - (b.display_order || 0);
    });

  const topBadges = sortedBadges.slice(0, 3);
  const uniqueBadgeObjects = sortedBadges;

  return { badgesCount, badgeScore, topBadges, uniqueBadges: uniqueBadgeObjects };
};


// ==================== ADMIN ROUTES ====================

/**
 * GET /api/admin/gamification/point-rules
 * Fetch all dynamic gamification point rules
 */
router.get("/admin/point-rules", async (req: Request, res: Response) => {
  try {
    const { data: rules, error } = await supabase
      .from("gamification_point_rules")
      .select("*")
      .order("category", { ascending: true })
      .order("action_key", { ascending: true });

    if (error) {
      console.error("[Gamification] Admin fetch rules error:", error);
      return res.status(500).json({ error: "Failed to fetch point rules" });
    }

    res.json({ rules: rules || [] });
  } catch (err) {
    console.error("[Gamification] Admin point rules route error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PUT /api/admin/gamification/point-rules/:key
 * Update points for a specific action
 */
router.put("/admin/point-rules/:key", async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const { points } = req.body;

    if (typeof points !== 'number' || points < 0) {
      return res.status(400).json({ error: "Points must be a positive number" });
    }

    const { data: updatedRule, error } = await supabase
      .from("gamification_point_rules")
      .update({ points, updated_at: new Date().toISOString() })
      .eq("action_key", key)
      .select("*")
      .single();

    if (error) {
      console.error("[Gamification] Update point rule error:", error);
      return res.status(500).json({ error: "Failed to update point rule" });
    }

    // Clear cache so the next action uses the new value
    clearPointRulesCache();

    res.json({ rule: updatedRule });
  } catch (err) {
    console.error("[Gamification] Update point rule route error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

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
      .update({ 
        category: 'deleted', 
        is_enabled: false,
        updated_at: new Date().toISOString()
      })
      .eq("id", id);

    if (error) {
      console.error("[Gamification]  Delete badge error:", error);
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
    // Only include students, alumni, and regular users in gamification
    const { data: validRoleUsers, error: usersError } = await supabase
      .from("users")
      .select("id, email, username, created_at")
      .in("user_role", ["student", "alumni", "user"]);
      
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
      .select("user_id, gamification_badges(id, name, tier, series_type, category, icon_url, description, is_enabled)");

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
      const userBadges = earnedBadges?.filter(b => b.user_id === u.id) || [];
      const { badgesCount, badgeScore, uniqueBadges } = processUserBadges(userBadges);

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
        job_score: scoreData.job_score || 0,
        current_streak_days: scoreData.current_streak_days || 0,
        badgesCount,
        badgeScore,
        uniqueBadges, // Already extracted badge objects from processUserBadges
        created_at: u.created_at
      };
    });

    // Sort by total points first, then by badge score, then by badges count, then by account age (older first)
    enriched.sort((a, b) => {
      if (b.total_points !== a.total_points) return b.total_points - a.total_points;
      if (b.badgeScore !== a.badgeScore) return b.badgeScore - a.badgeScore;
      if (b.badgesCount !== a.badgesCount) return b.badgesCount - a.badgesCount;
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
      .select("user_id, total_points, thread_score, event_score, connection_score, job_score")
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

    // Gamification is only for alumni users
    const { data: userData } = await supabase
      .from("users")
      .select("user_role")
      .eq("id", userId)
      .maybeSingle();

    if (!userData || userData.user_role !== 'alumni') {
      return res.json({
        earnedBadges: [],
        progress: [],
        scores: { thread_score: 0, event_score: 0, connection_score: 0, job_score: 0, total_points: 0 },
        globalRank: 0,
      });
    }

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
      job: (scores?.job_score as number) || 0,
    };

    const progress: any[] = [];

    // Get top scores for competitive badge calculations concurrently
    const topScores: Record<string, number> = {};
    const competitiveSeriesTypes = new Set<string>();
    
    for (const badge of allBadges || []) {
      // Logic for calculating competitive top scores removed as feature is no longer used
    }

    const topScorePromises = Array.from(competitiveSeriesTypes).map(async (seriesType) => {
      const scoreField = seriesType === "thread" ? "thread_score" : 
                         seriesType === "event" ? "event_score" : 
                         seriesType === "connection" ? "connection_score" :
                         seriesType === "job" ? "job_score" : null;
      if (scoreField) {
        const { data: topScorer } = await supabase
          .from("user_scores")
          .select(scoreField)
          .order(scoreField, { ascending: false })
          .limit(1)
          .maybeSingle();
        return { seriesType, score: topScorer ? ((topScorer as any)[scoreField] as number || 0) : 0 };
      }
      return { seriesType, score: 0 };
    });

    const topScoresResults = await Promise.all(topScorePromises);
    for (const result of topScoresResults) {
      topScores[result.seriesType] = result.score;
    }

    for (const badge of allBadges || []) {
      if (!earnedBadgeIds.has(badge.id)) {
        const currentScore = userScores[badge.series_type] || 0;
        
        if (badge.category === "series" || badge.category === "common") {
          const required = badge.required_score || 0;
          
          // Auto-award missed badge if requirements are met
          // Common badges are awarded if the user has EVER done the activity (currentScore > 0)
          const meetsCommon = badge.category === 'common' && currentScore > 0;
          const meetsSeries = badge.category !== 'common' && currentScore >= required && required > 0;

          if (meetsCommon || meetsSeries) {
            supabase.from("user_badges").insert({ user_id: userId, badge_id: badge.id }).then();
            
            if (earnedBadges) {
              earnedBadges.push({
                id: `temp-${badge.id}`,
                user_id: userId,
                badge_id: badge.id,
                earned_at: new Date().toISOString(),
                is_featured: false,
                gamification_badges: badge
              });
            }
            earnedBadgeIds.add(badge.id);
            continue;
          }

          progress.push({
            badge,
            currentScore,
            requiredScore: required,
            remaining: Math.max(0, required - currentScore),
            percentComplete: Math.min(100, required > 0 ? Math.round((currentScore / required) * 100) : 100),
          });
        }
      }
    }

    // Fast calculation of approximate global rank (ignores tie-breakers for speed)
    let globalRank = 1;
    if (scores && scores.total_points > 0) {
      const { count: higherRankedCount } = await supabase
        .from("user_scores")
        .select("*", { count: 'exact', head: true })
        .gt("total_points", scores.total_points);
      
      globalRank = (higherRankedCount || 0) + 1;
    } else if (scores && scores.total_points === 0) {
      // If 0 points, they are at the bottom. Get total users count approximately
      const { count: totalScorers } = await supabase
        .from("user_scores")
        .select("*", { count: 'exact', head: true })
        .gt("total_points", 0);
      globalRank = (totalScorers || 0) + 1;
    }

    const { uniqueBadges } = processUserBadges(earnedBadges || []);

    // Calculate global badge rank using the same logic as the leaderboard
    let globalBadgeRank = 1;
    const { data: allUserBadges } = await supabase
      .from("user_badges")
      .select("user_id, gamification_badges(tier, series_type, name, is_enabled)");

    if (allUserBadges) {
      const userBadgesMap = new Map<string, any[]>();
      allUserBadges.forEach((ub: any) => {
        if (!ub.user_id) return;
        if (!userBadgesMap.has(ub.user_id)) {
          userBadgesMap.set(ub.user_id, []);
        }
        userBadgesMap.get(ub.user_id)?.push(ub);
      });

      const userBadgeScores: Record<string, number> = {};
      userBadgesMap.forEach((badgesList, uid) => {
        const tierWeight: any = { platinum: 4, gold: 3, silver: 2, bronze: 1 };
        const deduplicated = new Map();
        badgesList.forEach(b => {
          const badge = b.gamification_badges;
          if (!badge) return;
          
          // Only deduplicate badges of 'series' category that have a tier.
          // We group by series_type AND name so different series badges don't overwrite each other.
          const isTiered = badge.tier && badge.category === 'series';
          const key = isTiered ? `${badge.series_type}_${badge.name}` : badge.id;
          const existing = deduplicated.get(key);
          
          if (!existing || (tierWeight[badge.tier || ''] || 0) > (tierWeight[existing.gamification_badges?.tier || ''] || 0)) {
            deduplicated.set(key, b);
          }
        });

        const getBadgeScoreValue = (tier: string | null | undefined) => {
          if (tier === 'platinum') return 100;
          if (tier === 'gold') return 50;
          if (tier === 'silver') return 20;
          if (tier === 'bronze') return 5;
          return 1;
        };

        const score = Array.from(deduplicated.values()).reduce((acc, b: any) => acc + getBadgeScoreValue(b.gamification_badges?.tier), 0);
        userBadgeScores[uid] = score;
      });

      const targetScore = userBadgeScores[userId] || 0;
      let higherCount = 0;
      Object.entries(userBadgeScores).forEach(([uid, score]) => {
        if (uid !== userId && score > targetScore) {
          higherCount++;
        }
      });
      globalBadgeRank = higherCount + 1;
    }

    res.json({
      scores: scores || {
        thread_score: 0,
        event_score: 0,
        connection_score: 0,
        job_score: 0,
        current_streak_days: 0,
        highest_streak: 0,
        total_points: 0,
      },
      earnedBadges: earnedBadges || [],
      progress, // Next badges to unlock with how far away they are
      globalRank,
      globalBadgeRank
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
    // Only include alumni in the public leaderboard
    const { data: validRoleUsers } = await supabase
      .from("users")
      .select("id, username, created_at")
      .eq("user_role", "alumni");

    const { data: alumniUsers } = await supabase
      .from("alumni")
      .select("user_id, first_name, last_name, profile_picture, graduation_year");

    const { data: userScores, error } = await supabase
      .from("user_scores")
      .select("user_id, total_points, thread_score, event_score, connection_score, job_score, current_streak_days");

    if (error) {
      console.error("[Gamification] Leaderboard error:", error);
      return res.status(500).json({ error: "Failed to fetch leaderboard" });
    }

    const { data: allUserBadges } = await supabase
      .from("user_badges")
      .select("user_id, badge_id, gamification_badges(id, name, tier, icon_url, series_type, category, description, is_enabled)");

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
      const userBadgesList = allUserBadges?.filter(b => b.user_id === u.id) || [];
      const { badgesCount, badgeScore, topBadges, uniqueBadges } = processUserBadges(userBadgesList);

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
        job_score: scoreData.job_score || 0,
        current_streak_days: scoreData.current_streak_days || 0,
        badgesCount,
        badgeScore,
        topBadges,
        uniqueBadges, // All de-duplicated badges for the click popup
        created_at: u.created_at
      };
    });

    // Sort by total_points desc, then badgeScore desc, then badgesCount desc, then created_at asc (older first)
    const pointsLeaderboard = [...enriched].sort((a, b) => {
      if (b.total_points !== a.total_points) return b.total_points - a.total_points;
      if (b.badgeScore !== a.badgeScore) return b.badgeScore - a.badgeScore;
      if (b.badgesCount !== a.badgesCount) return b.badgesCount - a.badgesCount;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    const badgesLeaderboard = [...enriched].sort((a, b) => {
      if (b.badgeScore !== a.badgeScore) return b.badgeScore - a.badgeScore;
      if (b.total_points !== a.total_points) return b.total_points - a.total_points;
      if (b.badgesCount !== a.badgesCount) return b.badgesCount - a.badgesCount;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    // Return full leaderboards (frontend can slice if needed)
    res.json({ 
      leaderboard: pointsLeaderboard, // For backwards compatibility with GamificationLeaderboard.tsx
      pointsLeaderboard, 
      badgesLeaderboard 
    });
  } catch (err) {
    console.error("[Gamification] Leaderboard route error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
