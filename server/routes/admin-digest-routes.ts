import { Router } from "express";
import {
    sendDigestToAdmin,
    sendDigestToAllAdmins,
    initializeAdminDigestPreferences
} from "../services/admin-digest-scheduler";
import { supabase } from "../supabase";

const router = Router();

// Middleware to check if user is admin
const requireAdmin = async (req: any, res: any, next: any) => {
    try {
        const userId = req.headers["user-id"] as string;

        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        // Use Supabase instead of Neon to match login logic
        const { data: user, error } = await supabase
            .from("users")
            .select("*")
            .eq("id", userId)
            .single();

        if (error || !user) {
            return res.status(403).json({ error: "Access denied. User not found in auth system." });
        }

        // Supports both is_admin: true OR user_role: 'administrator'
        const isAdmin = user.is_admin === true || user.user_role === 'administrator';

        if (!isAdmin) {
            return res.status(403).json({ error: "Access denied. Admin access required." });
        }

        // Removing local DB sync logic as Neon is being decommissioned.
        // We rely entirely on Supabase as the source of truth.

        req.adminUser = user;
        next();
    } catch (error) {
        console.error("Admin auth error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

/**
 * Trigger digest for the current admin immediately
 * Useful for testing the digest email
 */
router.post("/trigger", requireAdmin, async (req: any, res) => {
    try {
        const adminId = req.adminUser.id;

        // Ensure preferences exist (this also returns them)
        const preferences = await initializeAdminDigestPreferences(adminId);

        if (!preferences) {
            return res.status(500).json({ error: "Failed to load preferences" });
        }

        // Force send even if threshold not met
        await sendDigestToAdmin(adminId, preferences);

        res.json({ message: "Digest email triggered successfully" });
    } catch (error: any) {
        console.error("Error triggering digest:", error);
        res.status(500).json({ error: error.message || "Failed to trigger digest" });
    }
});

/**
 * Trigger digest for ALL admins
 * Useful for manual override of scheduled job
 */
router.post("/trigger-all", requireAdmin, async (req: any, res) => {
    try {
        // Run in background to avoid timeout
        sendDigestToAllAdmins().catch(err =>
            console.error("Background digest job failed:", err)
        );

        res.json({ message: "Digest job for all admins started in background" });
    } catch (error: any) {
        console.error("Error triggering all digests:", error);
        res.status(500).json({ error: error.message || "Failed to trigger digest job" });
    }
});

/**
 * Initialize preferences for current admin
 */
router.post("/init-preferences", requireAdmin, async (req: any, res) => {
    try {
        const adminId = req.adminUser.id;
        await initializeAdminDigestPreferences(adminId);
        res.json({ message: "Preferences initialized" });
    } catch (error: any) {
        console.error("Error initializing preferences:", error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
