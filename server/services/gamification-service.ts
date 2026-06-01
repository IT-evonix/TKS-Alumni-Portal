/**
 * Gamification Service
 * Handles automated badge awarding, score tracking, and leaderboard logic.
 */
import { supabase } from "../supabase";
import { createAndEmitNotification, NotificationType } from "./notification-helper";

// ==================== POINT RULES CACHE ====================

let pointRulesCache: Record<string, number> = {};
let lastCacheUpdate = 0;
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

/**
 * Fetch point rules from the database and cache them
 */
async function getPointRules(): Promise<Record<string, number>> {
  const now = Date.now();
  if (now - lastCacheUpdate < CACHE_TTL && Object.keys(pointRulesCache).length > 0) {
    return pointRulesCache;
  }

  try {
    const { data, error } = await supabase
      .from("gamification_point_rules")
      .select("action_key, points");

    if (!error && data) {
      const newRules: Record<string, number> = {};
      data.forEach(rule => {
        newRules[rule.action_key] = rule.points;
      });
      pointRulesCache = newRules;
      lastCacheUpdate = now;
    }
  } catch (err) {
    console.error("[Gamification] Failed to fetch point rules:", err);
  }

  // Return default fallbacks if cache is empty
  return {
    network_connect: pointRulesCache.network_connect ?? 5,
    thread_create: pointRulesCache.thread_create ?? 10,
    post_reply: pointRulesCache.post_reply ?? 2,
    feed_create: pointRulesCache.feed_create ?? 5,
    event_rsvp: pointRulesCache.event_rsvp ?? 15,
    job_post: pointRulesCache.job_post ?? 20,

    ...pointRulesCache
  };
}

/**
 * Force clear the cache when admin updates rules
 */
export function clearPointRulesCache() {
  pointRulesCache = {};
  lastCacheUpdate = 0;
}

// ==================== SCORE UPDATE HELPERS ====================

/**
 * Ensure a user_scores row exists for the given user.
 * If not, insert a default row; then return the current scores.
 */
export async function ensureUserScores(userId: string) {
  // Gamification only applies to 'alumni' role as requested
  const { data: userRoleData } = await supabase
    .from("users")
    .select("user_role")
    .eq("id", userId)
    .maybeSingle();

  if (!userRoleData || userRoleData.user_role !== 'alumni') {
    return null;
  }

  const { data: existing } = await supabase
    .from("user_scores")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return existing;

  const { data: created, error } = await supabase
    .from("user_scores")
    .insert({ user_id: userId })
    .select("*")
    .single();

  if (error) {
    console.error("[Gamification] Failed to create user_scores row:", error);
    return null;
  }
  return created;
}

/**
 * Increment a specific score field for a user and check for new badge unlocks.
 * @param actionKey The specific action key (e.g., 'thread_create', 'post_reply') to fetch dynamic points.
 * @param multiplier Use 1 to add points, -1 to subtract (e.g. when deleting a post or canceling RSVP).
 */
export async function incrementScore(
  userId: string,
  field: "thread_score" | "event_score" | "connection_score" | "job_score",
  actionKey: string,
  multiplier: number = 1
) {
  try {
    // Gamification only applies to alumni users
    const { data: userRoleData } = await supabase
      .from("users")
      .select("user_role")
      .eq("id", userId)
      .maybeSingle();

    if (!userRoleData || userRoleData.user_role !== 'alumni') {
      return; // Silently skip non-alumni users
    }

    // Determine actual amount to add based on dynamic rules
    const rules = await getPointRules();
    const baseAmount = rules[actionKey] !== undefined ? rules[actionKey] : 1;
    const actualAmount = baseAmount * multiplier;

    // Ensure row exists
    const scores = await ensureUserScores(userId);
    if (!scores) return;

    const currentValue = (scores[field] as number) || 0;
    const newValue = Math.max(0, currentValue + actualAmount);
    const currentTotal = (scores.total_points as number) || 0;

    // Calculate actual difference applied to keep total_points perfectly synced
    const actualDiff = newValue - currentValue;

    const { error } = await supabase
      .from("user_scores")
      .update({
        [field]: newValue,
        total_points: Math.max(0, currentTotal + actualDiff),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (error) {
      console.error(`[Gamification] Failed to increment ${field}:`, error);
      return;
    }

    // Send a real-time notification for the point change
    if (actualDiff !== 0) {
      const actionName = actionKey.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
      const changeWord = actualDiff > 0 ? "earned" : "lost";
      
      createAndEmitNotification({
        userId,
        type: "gamification_point",
        title: `Points ${changeWord}!`,
        content: `You ${changeWord} ${Math.abs(actualDiff)} point(s) for: ${actionName}.`,
        redirectUrl: "/profile",
      }).catch(err => console.error("Gamification point notification error:", err));
    }

    // Map DB field to series_type used in gamification_badges table
    const seriesTypeMap: Record<string, string> = {
      thread_score: "thread",
      event_score: "event",
      connection_score: "connection",
      job_score: "job",
    };
    const seriesType = seriesTypeMap[field];

    // Check if user unlocked any new series badges
    await checkAndAwardSeriesBadges(userId, seriesType, newValue);

    // Check if user claimed a competitive leaderboard badge
    await checkCompetitiveBadges(userId, seriesType, newValue);
  } catch (err) {
    console.error("[Gamification] incrementScore error:", err);
  }
}

// ==================== COMPETITIVE BADGE LOGIC ====================

/**
 * Checks if the user's new score makes them the top ranker for a competitive badge.
 * If yes, revokes the badge from the previous owner and awards it to this user.
 */
async function checkCompetitiveBadges(userId: string, seriesType: string, newValue: number) {
  try {
    // Check role first: gamification only applies to 'alumni'
    const { data: userRoleData } = await supabase
      .from("users")
      .select("user_role")
      .eq("id", userId)
      .maybeSingle();

    if (!userRoleData || userRoleData.user_role !== 'alumni') {
      return; 
    }

    // Find the single competitive badge for this series (the one without fixed tiers)
    const { data: competitiveBadges } = await supabase
      .from("gamification_badges")
      .select("*")
      .eq("category", "competitive")
      .eq("series_type", seriesType)
      .eq("is_enabled", true)
      .or('required_score.eq.0,required_score.is.null')
      .limit(1);

    const competitiveBadge = competitiveBadges?.[0];
    if (!competitiveBadge) return;

    // Get current top scorers for this field
    const scoreField = seriesType === "thread" ? "thread_score" : 
                       seriesType === "event" ? "event_score" : 
                       seriesType === "connection" ? "connection_score" : 
                       seriesType === "job" ? "job_score" : null;
    
    if (!scoreField) return;

    // We get the top scorer (limit 1) order by the score field desc
    const { data: topScorer } = await supabase
      .from("user_scores")
      .select(`user_id, ${scoreField}`)
      .order(scoreField, { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!topScorer) return;

    // Determine who should have the badge now
    if (topScorer && ((topScorer as any)[scoreField] as number) > 0) {
      const actualTopScorerId = topScorer.user_id;

      // Check if the actual top scorer already has the badge
      const { data: existing } = await supabase
        .from("user_badges")
        .select("id")
        .eq("user_id", actualTopScorerId)
        .eq("badge_id", competitiveBadge.id)
        .maybeSingle();

      if (!existing) {
        // They are the new top scorer but don't have the badge yet!
        // Revoke it from whoever currently has it
        const { data: previousOwners } = await supabase
          .from("user_badges")
          .select("user_id")
          .eq("badge_id", competitiveBadge.id)
          .neq("user_id", actualTopScorerId);

        if (previousOwners && previousOwners.length > 0) {
          for (const prev of previousOwners) {
            await revokeBadge(prev.user_id, competitiveBadge.id);
            
            // Notify them they lost it
            await createAndEmitNotification({
              userId: prev.user_id,
              type: NotificationType.BADGE_LOST,
              title: "Badge Lost",
              content: `Someone just overtook your '${competitiveBadge.name}' badge! Reclaim your spot!`,
              redirectUrl: "/profile",
            });
          }
        }

        // Award it to the actual top scorer
        await manuallyAwardBadge(
          actualTopScorerId, 
          competitiveBadge.id, 
          `Congratulations! You reached the top rank and earned the '${competitiveBadge.name}' badge!`
        );
      }
    } else {
      // Top scorer score is 0. No one should have it.
      const { data: previousOwners } = await supabase
        .from("user_badges")
        .select("user_id")
        .eq("badge_id", competitiveBadge.id);

      if (previousOwners && previousOwners.length > 0) {
        for (const prev of previousOwners) {
          await revokeBadge(prev.user_id, competitiveBadge.id);
        }
      }
    }
  } catch (err) {
    console.error("[Gamification] checkCompetitiveBadges error:", err);
  }
}

// ==================== BADGE AWARDING ====================

/**
 * Award a specific common badge (one-time) to a user if they don't already have it.
 * Used for: first_login, profile_completion, etc.
 */
export async function awardCommonBadge(userId: string, seriesType: string) {
  try {
    // Check role first: gamification only applies to 'alumni'
    const { data: userRoleData } = await supabase
      .from("users")
      .select("user_role")
      .eq("id", userId)
      .maybeSingle();

    if (!userRoleData || userRoleData.user_role !== 'alumni') {
      return; // Do not award badges to non-alumni
    }

    // Find the matching badge for the given series type (ignoring category in case admin changed it)
    const { data: badge } = await supabase
      .from("gamification_badges")
      .select("id, name")
      .eq("series_type", seriesType)
      .eq("is_enabled", true)
      .maybeSingle();

    if (!badge) return; // Badge not configured or disabled

    // Check if already awarded
    const { data: existing } = await supabase
      .from("user_badges")
      .select("id")
      .eq("user_id", userId)
      .eq("badge_id", badge.id)
      .maybeSingle();

    if (existing) return; // Already has this badge

    // Award the badge
    await supabase.from("user_badges").insert({
      user_id: userId,
      badge_id: badge.id,
    });

    console.log(`[Gamification] Awarded common badge (${seriesType}) to user ${userId}`);

    // Push notification to user
    await createAndEmitNotification({
      userId,
      type: NotificationType.BADGE_EARNED,
      title: "New Badge Unlocked! 🏆",
      content: `Congratulations! You've earned the '${badge.name}' badge.`,
      redirectUrl: "/profile",
      relatedId: badge.id
    });
  } catch (err) {
    console.error("[Gamification] awardCommonBadge error:", err);
  }
}

/**
 * Check all series (ranked) badges for a given series_type.
 * Award any that the user qualifies for but hasn't earned yet.
 */
async function checkAndAwardSeriesBadges(
  userId: string,
  seriesType: string,
  currentScore: number  
) {
  try {
    // Get all enabled series/tiered badges for this type, ordered by required_score
    const { data: badges } = await supabase
      .from("gamification_badges")
      .select("id, required_score, name, category")
      .in("category", ["series", "competitive", "common"])
      .eq("series_type", seriesType)
      .eq("is_enabled", true)
      .order("required_score", { ascending: true });

    if (!badges || badges.length === 0) return;

    // Only process common badges (unconditional) OR badges with a valid required score
    const validBadges = badges.filter(b => b.category === 'common' || (b.required_score && b.required_score > 0));

    if (validBadges.length === 0) return;

    // Get user's already-earned badge IDs
    const badgeIds = badges.map((b) => b.id);
    const { data: earnedBadges } = await supabase
      .from("user_badges")
      .select("badge_id")
      .eq("user_id", userId)
      .in("badge_id", badgeIds);

    const earnedSet = new Set((earnedBadges || []).map((e) => e.badge_id));

    // Award any badges that user meets the threshold for but hasn't earned
    for (const badge of validBadges) {
      // Common badges are awarded strictly because the action just occurred.
      // Series/competitive badges require meeting the score threshold.
      const meetsRequirement = badge.category === 'common' || currentScore >= (badge.required_score || 0);

      if (meetsRequirement && !earnedSet.has(badge.id)) {
        await supabase.from("user_badges").insert({
          user_id: userId,
          badge_id: badge.id,
        });
        console.log(
          `[Gamification] Awarded series badge ${badge.id} (${seriesType}, score=${badge.required_score}) to user ${userId}`
        );

        // Push priority badge notification
        await createAndEmitNotification({
          userId,
          type: NotificationType.BADGE_EARNED,
          title: "Achievement Unlocked! 🌟",
          content: `You've reached a new milestone and earned the '${badge.name}' badge!`,
          redirectUrl: "/profile",
          relatedId: badge.id
        });
      }
    }
  } catch (err) {
    console.error("[Gamification] checkAndAwardSeriesBadges error:", err);
  }
}

// ==================== STREAK TRACKING ====================

/**
 * Update the user's login/activity streak.
 * Call this on every login or significant daily action.
 */
export async function updateStreak(userId: string) {
  try {
    const scores = await ensureUserScores(userId);
    if (!scores) return;

    const now = new Date();
    const today = now.toISOString().split("T")[0]; // YYYY-MM-DD

    const lastActive = scores.last_active_date
      ? new Date(scores.last_active_date).toISOString().split("T")[0]
      : null;

    if (lastActive === today) return; // Already counted today

    let newStreak = 1;
    if (lastActive) {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      if (lastActive === yesterdayStr) {
        // Consecutive day
        newStreak = ((scores.current_streak_days as number) || 0) + 1;
      }
      // else: streak broken, reset to 1
    }

    const highestStreak = Math.max(
      newStreak,
      (scores.highest_streak as number) || 0
    );

    await supabase
      .from("user_scores")
      .update({
        current_streak_days: newStreak,
        highest_streak: highestStreak,
        last_active_date: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("user_id", userId);
  } catch (err) {
    console.error("[Gamification] updateStreak error:", err);
  }
}

// ==================== PROFILE COMPLETION CHECK ====================

/**
 * Check if a user's profile is "complete" and award the badge if so.
 * Called after profile updates.
 */
export async function checkProfileCompletion(userId: string) {
  try {
    const { data: profile } = await supabase
      .from("alumni")
      .select("first_name, last_name, email, phone, profile_picture, current_company, current_role, linkedin_url, graduation_year, bio")
      .eq("user_id", userId)
      .maybeSingle();

    if (!profile) return;

    // Check if all key fields are filled
    const requiredFields = [
      profile.first_name,
      profile.last_name,
      profile.email,
      profile.phone,
      profile.profile_picture,
      profile.current_company,
      profile.current_role,
      profile.linkedin_url,
    ];

    const filledCount = requiredFields.filter(
      (f) => f !== null && f !== undefined && String(f).trim() !== ""
    ).length;

    if (filledCount === requiredFields.length) {
      await awardCommonBadge(userId, "profile");
    }
  } catch (err) {
    console.error("[Gamification] checkProfileCompletion error:", err);
  }
}

// ==================== MANUAL BADGE ASSIGNMENT ====================

/**
 * Manually award a specific badge to a user from the Admin Dashboard
 * Bypasses normal score checks.
 */
export async function manuallyAwardBadge(userId: string, badgeId: string, customMessage?: string) {
  try {
    // Gamification only applies to 'alumni'
    const { data: userRoleData } = await supabase
      .from("users")
      .select("user_role")
      .eq("id", userId)
      .maybeSingle();

    if (!userRoleData || userRoleData.user_role !== 'alumni') {
      throw new Error("Badges can only be assigned to alumni users.");
    }

    // Verify the badge exists
    const { data: badge, error: badgeErr } = await supabase
      .from("gamification_badges")
      .select("*")
      .eq("id", badgeId)
      .single();

    if (badgeErr || !badge) {
      throw new Error("Badge not found");
    }

    // Check if the user already has this badge
    const { data: existing } = await supabase
      .from("user_badges")
      .select("id")
      .eq("user_id", userId)
      .eq("badge_id", badgeId)
      .maybeSingle();

    if (existing) {
      throw new Error("User already has this badge");
    }

    // Assign badge
    const { error: insertErr } = await supabase
      .from("user_badges")
      .insert({
        user_id: userId,
        badge_id: badge.id,
      });

    if (insertErr) {
      throw new Error(`Failed to assign badge: ${insertErr.message}`);
    }

    // Add badge points to user's total score
    if (badge.required_score > 0) {
      const scores = await ensureUserScores(userId);
      if (scores) {
        await supabase
          .from("user_scores")
          .update({
            total_points: (scores.total_points || 0) + badge.required_score,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);
      }
    }

    // Send Notification
    try {
      await createAndEmitNotification({
        userId,
        type: NotificationType.BADGE_EARNED,
        title: customMessage ? "Top Ranker Achievement! 🏆" : "New Badge Awarded!",
        content: customMessage || `Admin manually awarded you the "${badge.name}" badge!`,
        redirectUrl: "/profile",
        metadata: {
          badgeId: badge.id,
          badgeName: badge.name,
          badgeIcon: badge.icon_url,
        }
      });
    } catch (notifErr) {
      console.error("[Gamification] Manual assign notification failed:", notifErr);
    }

    console.log(`[Gamification] Admin manually awarded badge ${badgeId} to user ${userId}`);
    return { success: true, badge };
  } catch (err) {
    console.error("[Gamification] manuallyAwardBadge error:", err);
    throw err;
  }
}

/**
 * Manually revoke a specific badge from a user
 */
export async function revokeBadge(userId: string, badgeId: string) {
  try {
    // Fetch badge first to know how many points to deduct
    const { data: badge } = await supabase
      .from("gamification_badges")
      .select("required_score")
      .eq("id", badgeId)
      .single();

    const { error: deleteErr } = await supabase
      .from("user_badges")
      .delete()
      .eq("user_id", userId)
      .eq("badge_id", badgeId);

    if (deleteErr) {
      throw new Error(`Failed to revoke badge: ${deleteErr.message}`);
    }

    // Subtract badge points from user's total score
    if (badge && badge.required_score > 0) {
      const { data: scores } = await supabase
        .from("user_scores")
        .select("total_points")
        .eq("user_id", userId)
        .maybeSingle();
        
      if (scores) {
        await supabase
          .from("user_scores")
          .update({
            total_points: Math.max(0, (scores.total_points || 0) - badge.required_score),
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);
      }
    }

    console.log(`[Gamification] Admin revoked badge ${badgeId} from user ${userId}`);
    return { success: true };
  } catch (err) {
    console.error("[Gamification] revokeBadge error:", err);
    throw err;
  }
}

// ==================== AUTO-SEEDING ====================

const defaultBadges = [
  // Common badges (one-time milestones)
  {
    name: "First Steps",
    description: "Logged in for the first time. Welcome to the alumni community!",
    category: "common",
    series_type: "login",
    required_score: 0,
    tier: "bronze",
    icon_url: null,
    is_enabled: true,
    display_order: 1,
  },
  {
    name: "Profile Pro",
    description: "Completed your alumni profile with all key details.",
    category: "common",
    series_type: "profile",
    required_score: 0,
    tier: "bronze",
    icon_url: null,
    is_enabled: true,
    display_order: 2,
  },
  // Thread series badges
  {
    name: "Conversation Starter",
    description: "Made your first post or comment in the community feed.",
    category: "series",
    series_type: "thread",
    required_score: 1,
    tier: "bronze",
    icon_url: null,
    is_enabled: true,
    display_order: 10,
  },
  {
    name: "Active Contributor",
    description: "Contributed 5 posts or comments in the community.",
    category: "series",
    series_type: "thread",
    required_score: 5,
    tier: "silver",
    icon_url: null,
    is_enabled: true,
    display_order: 11,
  },
  {
    name: "Community Voice",
    description: "Reached 15 posts or comments. Your voice matters!",
    category: "series",
    series_type: "thread",
    required_score: 15,
    tier: "gold",
    icon_url: null,
    is_enabled: true,
    display_order: 12,
  },
  // Event series badges
  {
    name: "Event Explorer",
    description: "Attended your first alumni event. Great to see you!",
    category: "series",
    series_type: "event",
    required_score: 1,
    tier: "bronze",
    icon_url: null,
    is_enabled: true,
    display_order: 20,
  },
  {
    name: "Event Enthusiast",
    description: "Attended 5 alumni events. You're a regular!",
    category: "series",
    series_type: "event",
    required_score: 5,
    tier: "silver",
    icon_url: null,
    is_enabled: true,
    display_order: 21,
  },
  {
    name: "Event Champion",
    description: "Attended 15 events. A true community pillar!",
    category: "series",
    series_type: "event",
    required_score: 15,
    tier: "gold",
    icon_url: null,
    is_enabled: true,
    display_order: 22,
  },
  // Connection series badges
  {
    name: "Networker",
    description: "Made your first alumni connection.",
    category: "series",
    series_type: "connection",
    required_score: 1,
    tier: "bronze",
    icon_url: null,
    is_enabled: true,
    display_order: 30,
  },
  {
    name: "Well Connected",
    description: "Built a network of 5 alumni connections.",
    category: "series",
    series_type: "connection",
    required_score: 5,
    tier: "silver",
    icon_url: null,
    is_enabled: true,
    display_order: 31,
  },
  {
    name: "Super Connector",
    description: "An impressive network of 15+ alumni connections!",
    category: "series",
    series_type: "connection",
    required_score: 15,
    tier: "gold",
    icon_url: null,
    is_enabled: true,
    display_order: 32,
  },
  // Competitive Badges
  {
    name: "Event Master",
    description: "Highest event participation! Held by the #1 Event Explorer.",
    category: "competitive",
    series_type: "event",
    required_score: 0,
    tier: "platinum",
    icon_url: null,
    is_enabled: true,
    display_order: 100,
  },
  {
    name: "Top Contributor",
    description: "Highest comments and replies! The reigning Community Voice.",
    category: "competitive",
    series_type: "thread",
    required_score: 0,
    tier: "platinum",
    icon_url: null,
    is_enabled: true,
    display_order: 101,
  },
];

/**
 * Checks if default badges exist in the database, and inserts them if they don't.
 * Safe to call on application startup against any environment.
 */
/**
 * Checks if default point rules exist in the database, and inserts any that are missing.
 */
export async function ensureDefaultPointRulesExist() {
  try {
    const { data: existing, error: checkErr } = await supabase
      .from("gamification_point_rules")
      .select("action_key");

    if (checkErr) {
      console.warn("[Gamification Auto-Seeder] Error checking existing point rules:", checkErr.message);
      return;
    }

    const existingKeys = new Set((existing || []).map(r => r.action_key));

    const defaultRules = [
      { action_key: "network_connect", points: 5, description: "Points awarded for connecting with another alumni", category: "networking" },
      { action_key: "thread_create", points: 10, description: "Points awarded for creating a new community thread", category: "community" },
      { action_key: "post_reply", points: 2, description: "Points awarded for replying to a thread or post", category: "community" },
      { action_key: "feed_create", points: 5, description: "Points awarded for creating a post on the main feed", category: "community" },
      { action_key: "event_rsvp", points: 15, description: "Points awarded for RSVPing to an event", category: "events" },
      { action_key: "job_post", points: 20, description: "Points awarded for posting a new job opportunity", category: "jobs" },
      { action_key: "job_apply", points: 5, description: "Points awarded for applying to a job opportunity", category: "jobs" }
    ];

    const toInsert = defaultRules.filter(r => !existingKeys.has(r.action_key));
    if (toInsert.length > 0) {
      const { error: insertErr } = await supabase
        .from("gamification_point_rules")
        .insert(toInsert);

      if (insertErr) {
        console.error("[Gamification Auto-Seeder] Error seeding point rules:", insertErr.message);
        return;
      }
      console.log(`[Gamification Auto-Seeder] Successfully seeded ${toInsert.length} default point rules.`);
    }
  } catch (err) {
    console.error("[Gamification Auto-Seeder] Unexpected error in point rules seeder:", err);
  }
}

/**
 * Checks if default badges exist in the database, and inserts them if they don't.
 * Safe to call on application startup against any environment.
 */
export async function ensureDefaultBadgesExist() {
  try {
    // Seed point rules first
    await ensureDefaultPointRulesExist().catch(err => 
      console.error("[Gamification Auto-Seeder] Point rules seed failed:", err)
    );

    const { data: existing, error: checkErr } = await supabase
      .from("gamification_badges")
      .select("id")
      .limit(1);

    if (checkErr) {
      console.warn("[Gamification Auto-Seeder] Error checking existing badges:", checkErr.message);
      return;
    }

    if (existing && existing.length > 0) {
      console.log("[Gamification Auto-Seeder] Badges already exist. Skipping seed.");
      return;
    }

    console.log("[Gamification Auto-Seeder] No badges found. Inserting 5 core series (default badges)...");
    
    const { data, error } = await supabase
      .from("gamification_badges")
      .insert(defaultBadges)
      .select("id, name, category, series_type, tier");

    if (error) {
      console.error("[Gamification Auto-Seeder] Error seeding badges:", error.message);
      return;
    }

    console.log(`[Gamification Auto-Seeder] Successfully seeded ${data?.length} default badges.`);
  } catch (err) {
    console.error("[Gamification Auto-Seeder] Unexpected error:", err);
  }
}
