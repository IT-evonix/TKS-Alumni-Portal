/**
 * Gamification Service
 * Handles automated badge awarding, score tracking, and leaderboard logic.
 */
import { supabase } from "../supabase";
import { createAndEmitNotification, NotificationType } from "./notification-helper";

// ==================== SCORE UPDATE HELPERS ====================

/**
 * Ensure a user_scores row exists for the given user.
 * If not, insert a default row; then return the current scores.
 */
export async function ensureUserScores(userId: string) {
  // Gamification only applies to 'alumni'
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
 */
export async function incrementScore(
  userId: string,
  field: "thread_score" | "event_score" | "connection_score",
  amount: number = 1
) {
  try {
    // Ensure row exists
    const scores = await ensureUserScores(userId);
    if (!scores) return;

    const currentValue = (scores[field] as number) || 0;
    const newValue = Math.max(0, currentValue + amount);
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

    // Map DB field to series_type used in gamification_badges table
    const seriesTypeMap: Record<string, string> = {
      thread_score: "thread",
      event_score: "event",
      connection_score: "connection",
    };
    const seriesType = seriesTypeMap[field];

    // Check if user unlocked any new series badges
    await checkAndAwardSeriesBadges(userId, seriesType, newValue);
  } catch (err) {
    console.error("[Gamification] incrementScore error:", err);
  }
}

// ==================== BADGE AWARDING ====================

/**
 * Award a specific common badge (one-time) to a user if they don't already have it.
 * Used for: first_login, profile_completion, etc.
 */
export async function awardCommonBadge(userId: string, seriesType: string) {
  try {
    const scores = await ensureUserScores(userId);
    if (!scores) return; // Only alumni can get badges

    // Find the matching common badge
    const { data: badge } = await supabase
      .from("gamification_badges")
      .select("id, name")
      .eq("category", "common")
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
    // Get all enabled series badges for this type, ordered by required_score
    const { data: badges } = await supabase
      .from("gamification_badges")
      .select("id, required_score, name")
      .eq("category", "series")
      .eq("series_type", seriesType)
      .eq("is_enabled", true)
      .order("required_score", { ascending: true });

    if (!badges || badges.length === 0) return;

    // Get user's already-earned badge IDs
    const badgeIds = badges.map((b) => b.id);
    const { data: earnedBadges } = await supabase
      .from("user_badges")
      .select("badge_id")
      .eq("user_id", userId)
      .in("badge_id", badgeIds);

    const earnedSet = new Set((earnedBadges || []).map((e) => e.badge_id));

    // Award any badges that user meets the threshold for but hasn't earned
    for (const badge of badges) {
      if (currentScore >= (badge.required_score || 0) && !earnedSet.has(badge.id)) {
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
export async function manuallyAwardBadge(userId: string, badgeId: string) {
  try {
    // Gamification only applies to 'alumni'
    const { data: userRoleData } = await supabase
      .from("users")
      .select("user_role")
      .eq("id", userId)
      .maybeSingle();

    if (!userRoleData || userRoleData.user_role !== 'alumni') {
      throw new Error("Badges can only be assigned to alumni.");
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
        title: "New Badge Awarded!",
        content: `Admin manually awarded you the "${badge.name}" badge!`,
        redirectUrl: "/profile/achievements",
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
];

/**
 * Checks if default badges exist in the database, and inserts them if they don't.
 * Safe to call on application startup against any environment.
 */
export async function ensureDefaultBadgesExist() {
  try {
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
