import { Router } from "express";
import { supabase } from "../supabase";

const router = Router();

// =====================================================
// GET /api/profile/notification-preferences
// Fetch user's notification preferences
// =====================================================
router.get("/notification-preferences", async (req, res) => {
    try {
        const userId = req.headers["user-id"] as string;

        if (!userId) {
            return res.status(401).json({ error: "User ID required" });
        }

        // Get alumni record with notification preferences
        const { data: alumni, error } = await supabase
            .from("alumni")
            .select(`
                email_notifications_enabled,
                push_notifications_enabled,
                weekly_digest_enabled,
                event_reminders_enabled,
                job_alerts_enabled,
                job_alert_preferences,
                last_digest_sent_at,
                notification_preferences_updated_at
            `)
            .eq("user_id", userId)
            .single();

        if (error) {
            console.error("Error fetching notification preferences:", error);
            return res.status(500).json({ error: "Failed to fetch preferences" });
        }

        if (!alumni) {
            return res.status(404).json({ error: "Alumni profile not found" });
        }

        // Return preferences in camelCase for frontend
        res.json({
            emailNotifications: alumni.email_notifications_enabled ?? true,
            pushNotifications: alumni.push_notifications_enabled ?? false,
            weeklyDigest: alumni.weekly_digest_enabled ?? false,
            eventReminders: alumni.event_reminders_enabled ?? true,
            jobAlerts: alumni.job_alerts_enabled ?? true,
            jobAlertPreferences: alumni.job_alert_preferences || {},
            lastDigestSentAt: alumni.last_digest_sent_at,
            updatedAt: alumni.notification_preferences_updated_at
        });
    } catch (error) {
        console.error("Error in notification preferences GET:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// =====================================================
// PUT /api/profile/notification-preferences
// Update user's notification preferences
// =====================================================
router.put("/notification-preferences", async (req, res) => {
    try {
        const userId = req.headers["user-id"] as string;

        if (!userId) {
            return res.status(401).json({ error: "User ID required" });
        }

        const {
            emailNotifications,
            pushNotifications,
            weeklyDigest,
            eventReminders,
            jobAlerts,
            jobAlertPreferences
        } = req.body;

        // Validation
        if (typeof emailNotifications !== 'boolean' ||
            typeof pushNotifications !== 'boolean' ||
            typeof weeklyDigest !== 'boolean' ||
            typeof eventReminders !== 'boolean' ||
            typeof jobAlerts !== 'boolean') {
            return res.status(400).json({
                error: "All notification preferences must be boolean values"
            });
        }

        // Validate jobAlertPreferences if provided
        if (jobAlertPreferences && typeof jobAlertPreferences !== 'object') {
            return res.status(400).json({
                error: "Job alert preferences must be an object"
            });
        }

        // Get alumni ID first
        const { data: alumniData, error: alumniError } = await supabase
            .from("alumni")
            .select("id")
            .eq("user_id", userId)
            .single();

        if (alumniError || !alumniData) {
            return res.status(404).json({ error: "Alumni profile not found" });
        }

        const alumniId = alumniData.id;

        // Update preferences
        const { data: updated, error: updateError } = await supabase
            .from("alumni")
            .update({
                email_notifications_enabled: emailNotifications,
                push_notifications_enabled: pushNotifications,
                weekly_digest_enabled: weeklyDigest,
                event_reminders_enabled: eventReminders,
                job_alerts_enabled: jobAlerts,
                job_alert_preferences: jobAlertPreferences || {},
                notification_preferences_updated_at: new Date().toISOString()
            })
            .eq("user_id", userId)
            .select()
            .single();

        if (updateError) {
            console.error("Error updating notification preferences:", updateError);
            return res.status(500).json({ error: "Failed to update preferences" });
        }

        // If push notifications were disabled, clean up subscriptions
        if (!pushNotifications) {
            await supabase
                .from("push_subscriptions")
                .update({ is_active: false })
                .eq("alumni_id", alumniId);
        }

        res.json({
            message: "Notification preferences updated successfully",
            preferences: {
                emailNotifications: updated.email_notifications_enabled,
                pushNotifications: updated.push_notifications_enabled,
                weeklyDigest: updated.weekly_digest_enabled,
                eventReminders: updated.event_reminders_enabled,
                jobAlerts: updated.job_alerts_enabled,
                jobAlertPreferences: updated.job_alert_preferences,
                updatedAt: updated.notification_preferences_updated_at
            }
        });
    } catch (error) {
        console.error("Error in notification preferences PUT:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// =====================================================
// POST /api/push/subscribe
// Register a new push notification subscription
// =====================================================
router.post("/subscribe", async (req, res) => {
    try {
        const userId = req.headers["user-id"] as string;

        if (!userId) {
            return res.status(401).json({ error: "User ID required" });
        }

        const { subscription } = req.body;

        if (!subscription || !subscription.endpoint || !subscription.keys) {
            return res.status(400).json({
                error: "Invalid subscription object. Must include endpoint and keys"
            });
        }

        // Validate keys
        if (!subscription.keys.p256dh || !subscription.keys.auth) {
            return res.status(400).json({
                error: "Subscription keys must include p256dh and auth"
            });
        }

        // Get alumni ID
        const { data: alumniData, error: alumniError } = await supabase
            .from("alumni")
            .select("id, push_notifications_enabled")
            .eq("user_id", userId)
            .single();

        if (alumniError || !alumniData) {
            return res.status(404).json({ error: "Alumni profile not found" });
        }

        // Check if push notifications are enabled
        if (!alumniData.push_notifications_enabled) {
            return res.status(403).json({
                error: "Push notifications are disabled. Enable them in settings first."
            });
        }

        const alumniId = alumniData.id;
        const userAgent = req.headers["user-agent"] || "Unknown";

        // Insert or update subscription (upsert)
        const { data: pushSub, error: pushError } = await supabase
            .from("push_subscriptions")
            .upsert({
                alumni_id: alumniId,
                endpoint: subscription.endpoint,
                keys: subscription.keys,
                user_agent: userAgent,
                is_active: true,
                created_at: new Date().toISOString()
            }, {
                onConflict: 'alumni_id,endpoint'
            })
            .select()
            .single();

        if (pushError) {
            console.error("Error saving push subscription:", pushError);
            return res.status(500).json({ error: "Failed to save subscription" });
        }

        res.json({
            message: "Push subscription registered successfully",
            subscriptionId: pushSub.id
        });
    } catch (error) {
        console.error("Error in push subscribe:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// =====================================================
// DELETE /api/push/unsubscribe
// Remove a push notification subscription
// =====================================================
router.delete("/unsubscribe", async (req, res) => {
    try {
        const userId = req.headers["user-id"] as string;

        if (!userId) {
            return res.status(401).json({ error: "User ID required" });
        }

        const { endpoint } = req.body;

        if (!endpoint) {
            return res.status(400).json({ error: "Endpoint required" });
        }

        // Get alumni ID
        const { data: alumniData, error: alumniError } = await supabase
            .from("alumni")
            .select("id")
            .eq("user_id", userId)
            .single();

        if (alumniError || !alumniData) {
            return res.status(404).json({ error: "Alumni profile not found" });
        }

        // Delete subscription
        const { error: deleteError } = await supabase
            .from("push_subscriptions")
            .delete()
            .eq("alumni_id", alumniData.id)
            .eq("endpoint", endpoint);

        if (deleteError) {
            console.error("Error deleting push subscription:", deleteError);
            return res.status(500).json({ error: "Failed to unsubscribe" });
        }

        res.json({ message: "Push subscription removed successfully" });
    } catch (error) {
        console.error("Error in push unsubscribe:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// =====================================================
// GET /api/push/subscriptions
// Get all active push subscriptions for current user
// =====================================================
router.get("/subscriptions", async (req, res) => {
    try {
        const userId = req.headers["user-id"] as string;

        if (!userId) {
            return res.status(401).json({ error: "User ID required" });
        }

        // Get alumni ID
        const { data: alumniData, error: alumniError } = await supabase
            .from("alumni")
            .select("id")
            .eq("user_id", userId)
            .single();

        if (alumniError || !alumniData) {
            return res.status(404).json({ error: "Alumni profile not found" });
        }

        // Get active subscriptions
        const { data: subscriptions, error: subError } = await supabase
            .from("push_subscriptions")
            .select("id, endpoint, user_agent, created_at")
            .eq("alumni_id", alumniData.id)
            .eq("is_active", true)
            .order("created_at", { ascending: false });

        if (subError) {
            console.error("Error fetching subscriptions:", subError);
            return res.status(500).json({ error: "Failed to fetch subscriptions" });
        }

        res.json({ subscriptions: subscriptions || [] });
    } catch (error) {
        console.error("Error in get subscriptions:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
