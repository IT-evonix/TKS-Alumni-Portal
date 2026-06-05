 /**
 * Notification Enhancement Routes
 * Handles preferences, push notifications, archive, analytics, and actions
 */

import { Express } from "express";
import { supabase } from "../supabase";
import { runNotificationCleanup } from "../services/notification-cleanup-service";
import { transformToCamelCase } from "../utils/case-transform";

export function registerNotificationEnhancementRoutes(app: Express) {
  // ==================== NOTIFICATION PREFERENCES ====================

  // Get notification preferences
  app.get("/api/notifications/preferences", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", userId);

      if (error) {
        console.error("Get preferences error:", error);
        return res.status(500).json({ error: "Failed to fetch preferences" });
      }

      // Convert to object keyed by notification_type
      const preferences: Record<string, any> = {};
      data?.forEach((pref: any) => {
        preferences[pref.notification_type] = {
          enabled: pref.enabled,
          emailEnabled: pref.email_enabled,
          pushEnabled: pref.push_enabled,
          priority: pref.priority,
          quietHoursStart: pref.quiet_hours_start,
          quietHoursEnd: pref.quiet_hours_end,
        };
      });

      res.json({ preferences });
    } catch (error) {
      console.error("Get preferences error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update notification preferences
  app.put("/api/notifications/preferences", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const { preferences } = req.body;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Upsert preferences for each type
      const updates = Object.entries(preferences).map(([type, prefs]: [string, any]) => ({
        user_id: userId,
        notification_type: type,
        enabled: prefs.enabled ?? true,
        email_enabled: prefs.emailEnabled ?? true,
        push_enabled: prefs.pushEnabled ?? true,
        priority: prefs.priority ?? "medium",
        quiet_hours_start: prefs.quietHoursStart || null,
        quiet_hours_end: prefs.quietHoursEnd || null,
        updated_at: new Date().toISOString(),
      }));

      // Use upsert
      const { error } = await supabase
        .from("notification_preferences")
        .upsert(updates, {
          onConflict: "user_id,notification_type",
        });

      if (error) {
        console.error("Update preferences error:", error);
        return res.status(500).json({ error: "Failed to update preferences" });
      }

      res.json({ message: "Preferences updated successfully" });
    } catch (error) {
      console.error("Update preferences error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== PUSH NOTIFICATIONS ====================

  // Subscribe to push notifications
  app.post("/api/notifications/push/subscribe", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const { endpoint, keys, userAgent } = req.body;

      if (!userId || !endpoint || !keys) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Get alumni ID
      const { data: alumniData } = await supabase
        .from("alumni")
        .select("id")
        .eq("user_id", userId)
        .single();
        
      if (!alumniData) {
        return res.status(404).json({ error: "Alumni profile not found" });
      }

      const { error } = await supabase
        .from("push_subscriptions")
        .upsert(
          {
            alumni_id: alumniData.id,
            endpoint,
            keys: { p256dh: keys.p256dh, auth: keys.auth },
            user_agent: userAgent || null,
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "alumni_id,endpoint",
          }
        );

      if (error) {
        console.error("Push subscription error:", error);
        return res.status(500).json({ error: "Failed to subscribe" });
      }

      res.json({ message: "Subscribed to push notifications" });
    } catch (error) {
      console.error("Push subscription error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Unsubscribe from push notifications
  app.post("/api/notifications/push/unsubscribe", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const { endpoint } = req.body;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Get alumni ID
      const { data: alumniData } = await supabase
        .from("alumni")
        .select("id")
        .eq("user_id", userId)
        .single();

      if (!alumniData) {
        return res.status(404).json({ error: "Alumni profile not found" });
      }

      const { error } = await supabase
        .from("push_subscriptions")
        .update({ is_active: false })
        .eq("alumni_id", alumniData.id)
        .eq("endpoint", endpoint);

      if (error) {
        console.error("Push unsubscription error:", error);
        return res.status(500).json({ error: "Failed to unsubscribe" });
      }

      res.json({ message: "Unsubscribed from push notifications" });
    } catch (error) {
      console.error("Push unsubscription error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== NOTIFICATION ARCHIVE ====================

  // Archive notification
  app.post("/api/notifications/:id/archive", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const { id } = req.params;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Get notification
      const { data: notification, error: fetchError } = await supabase
        .from("notifications")
        .select("*")
        .eq("id", id)
        .eq("user_id", userId)
        .single();

      if (fetchError || !notification) {
        return res.status(404).json({ error: "Notification not found" });
      }

      // Insert into archive
      const { error: archiveError } = await supabase
        .from("notification_archive")
        .insert({
          user_id: userId,
          notification_id: id,
          type: notification.type,
          title: notification.title,
          content: notification.content,
          related_id: notification.related_id,
          redirect_url: notification.redirect_url,
          actor_id: notification.actor_id,
          metadata: notification.metadata,
          is_read: notification.is_read,
          read_at: notification.read_at,
          created_at: notification.created_at,
        });

      if (archiveError) {
        console.error("Archive error:", archiveError);
        // Continue even if archive fails
      }

      // Mark as archived
      const { error: updateError } = await supabase
        .from("notifications")
        .update({ is_archived: true, archived_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", userId);

      if (updateError) {
        console.error("Update archive error:", updateError);
        return res.status(500).json({ error: "Failed to archive notification" });
      }

      res.json({ message: "Notification archived" });
    } catch (error) {
      console.error("Archive notification error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get archived notifications
  app.get("/api/notifications/archive", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const { limit = "50", offset = "0" } = req.query;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { data, error } = await supabase
        .from("notification_archive")
        .select("*")
        .eq("user_id", userId)
        .order("archived_at", { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      if (error) {
        console.error("Get archive error:", error);
        return res.status(500).json({ error: "Failed to fetch archived notifications" });
      }

      res.json({ notifications: transformToCamelCase(data || []) });
    } catch (error) {
      console.error("Get archive error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Unarchive notification
  app.post("/api/notifications/:id/unarchive", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const { id } = req.params;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { error } = await supabase
        .from("notifications")
        .update({ is_archived: false, archived_at: null })
        .eq("id", id)
        .eq("user_id", userId);

      if (error) {
        console.error("Unarchive error:", error);
        return res.status(500).json({ error: "Failed to unarchive notification" });
      }

      res.json({ message: "Notification unarchived" });
    } catch (error) {
      console.error("Unarchive error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== NOTIFICATION ACTIONS ====================

  // Quick action (reply, like, dismiss, snooze)
  app.post("/api/notifications/:id/action", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const { id } = req.params;
      const { actionType, actionData } = req.body;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Record action
      const { error: actionError } = await supabase
        .from("notification_actions")
        .insert({
          notification_id: id,
          user_id: userId,
          action_type: actionType,
          action_data: JSON.stringify(actionData || {}),
        });

      if (actionError) {
        console.error("Action error:", actionError);
      }

      // Handle specific actions
      if (actionType === "snooze") {
        const { snoozeUntil } = actionData || {};
        if (snoozeUntil) {
          await supabase
            .from("notifications")
            .update({ snoozed_until: snoozeUntil })
            .eq("id", id)
            .eq("user_id", userId);
        }
      } else if (actionType === "dismiss") {
        await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("id", id)
          .eq("user_id", userId);
      }

      res.json({ message: "Action processed" });
    } catch (error) {
      console.error("Notification action error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== NOTIFICATION ANALYTICS ====================

  // Track notification event
  app.post("/api/notifications/analytics/track", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const { notificationId, notificationType, action, metadata } = req.body;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { error } = await supabase
        .from("notification_analytics")
        .insert({
          user_id: userId,
          notification_id: notificationId,
          notification_type: notificationType,
          action,
          metadata: JSON.stringify(metadata || {}),
        });

      if (error) {
        console.error("Analytics track error:", error);
        return res.status(500).json({ error: "Failed to track event" });
      }

      res.json({ message: "Event tracked" });
    } catch (error) {
      console.error("Analytics track error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get notification analytics
  app.get("/api/notifications/analytics", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const { days = "30" } = req.query;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Use the database function
      const { data, error } = await supabase.rpc("get_notification_analytics_summary", {
        p_user_id: userId,
        p_days: Number(days),
      });

      if (error) {
        console.error("Get analytics error:", error);
        // Fallback to manual query
        const { data: fallbackData } = await supabase
          .from("notification_analytics")
          .select("*")
          .eq("user_id", userId)
          .gte("action_timestamp", new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000).toISOString());

        return res.json({ analytics: fallbackData || [] });
      }

      res.json({ analytics: data || [] });
    } catch (error) {
      console.error("Get analytics error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== NOTIFICATION HISTORY PAGE ====================

  // Get notification history with pagination
  app.get("/api/notifications/history", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const { limit = "20", offset = "0", filter, search, type } = req.query;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      let query = supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      if (filter === "archived") {
        query = query.eq("is_archived", true);
      } else if (filter === "unarchived") {
        query = query.eq("is_archived", false);
      }

      if (type) {
        query = query.eq("type", type);
      }

      if (search) {
        query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Get history error:", error);
        return res.status(500).json({ error: "Failed to fetch history" });
      }

      // Get total count
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      res.json({
        notifications: transformToCamelCase(data || []),
        total: count || 0,
        limit: Number(limit),
        offset: Number(offset),
      });
    } catch (error) {
      console.error("Get history error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== NOTIFICATION CLEANUP ====================

  // Run notification cleanup (admin or scheduled task)
  app.post("/api/notifications/cleanup", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const { archiveDays = 90, deleteDays = 365 } = req.body;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Check if user is admin (you can add admin check here)
      // For now, allow any authenticated user to trigger cleanup

      const result = await runNotificationCleanup(
        Number(archiveDays) || 90,
        Number(deleteDays) || 365
      );

      res.json({
        message: "Cleanup completed successfully",
        result
      });
    } catch (error) {
      console.error("Cleanup error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Track notification click
  app.post("/api/notifications/:id/click", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const { id } = req.params;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Get notification type
      const { data: notification } = await supabase
        .from("notifications")
        .select("type")
        .eq("id", id)
        .eq("user_id", userId)
        .single();

      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }

      // Track analytics
      await supabase
        .from("notification_analytics")
        .insert({
          user_id: userId,
          notification_id: id,
          notification_type: notification.type,
          action: "clicked",
        });

      res.json({ message: "Click tracked" });
    } catch (error) {
      console.error("Track click error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}
