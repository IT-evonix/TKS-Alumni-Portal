import { Router } from "express";
import { supabase } from "../supabase";
import { getCurrentUTCTimestamp } from "../../shared/time-utils";

const router = Router();

/**
 * Batch insert audit logs
 * POST /api/audit-logs/batch
 */
router.post("/batch", async (req, res) => {
    try {
        const { logs } = req.body;

        if (!Array.isArray(logs) || logs.length === 0) {
            return res.status(400).json({ error: "Invalid logs array" });
        }

        // Validate and prepare logs for insertion
        const preparedLogs = logs.map(log => ({
            event_type: log.event_type,
            user_id: log.user_id || null,
            target_user_id: log.target_user_id || null,
            target_resource_type: log.target_resource_type || null,
            target_resource_id: log.target_resource_id || null,
            action: log.action,
            details: log.details || {},
            ip_address: log.ip_address || req.ip || null,
            user_agent: log.user_agent || req.headers['user-agent'] || null,
            session_id: log.session_id || null,
            status: log.status || 'success',
            error_message: log.error_message || null,
            timestamp: log.timestamp || getCurrentUTCTimestamp(),
            created_at: getCurrentUTCTimestamp(),
        }));

        // Insert into database
        const { error } = await supabase
            .from("audit_logs")
            .insert(preparedLogs);

        if (error) {
            console.error("Error inserting audit logs:", error);
            return res.status(500).json({ error: "Failed to insert audit logs" });
        }

        res.json({ success: true, count: preparedLogs.length });
    } catch (error) {
        console.error("Audit log batch error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * Get audit logs for a user (admin only)
 * GET /api/audit-logs/user/:userId
 */
router.get("/user/:userId", async (req, res) => {
    try {
        const requestingUserId = req.headers["user-id"] as string;
        const { userId } = req.params;
        const { limit = 100, offset = 0, event_type } = req.query;

        if (!requestingUserId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        // Check if requesting user is admin
        const { data: requestingUser } = await supabase
            .from("users")
            .select("is_admin")
            .eq("id", requestingUserId)
            .single();

        if (!requestingUser?.is_admin) {
            return res.status(403).json({ error: "Forbidden: Admin access required" });
        }

        // Build query
        let query = supabase
            .from("audit_logs")
            .select("*")
            .eq("user_id", userId)
            .order("timestamp", { ascending: false })
            .range(Number(offset), Number(offset) + Number(limit) - 1);

        if (event_type) {
            query = query.eq("event_type", event_type);
        }

        const { data: logs, error } = await query;

        if (error) {
            console.error("Error fetching audit logs:", error);
            return res.status(500).json({ error: "Failed to fetch audit logs" });
        }

        res.json({ logs, count: logs?.length || 0 });
    } catch (error) {
        console.error("Audit log fetch error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * Get recent audit logs (admin only)
 * GET /api/audit-logs/recent
 */
router.get("/recent", async (req, res) => {
    try {
        const requestingUserId = req.headers["user-id"] as string;
        const { limit = 50, event_type, status } = req.query;

        if (!requestingUserId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        // Check if requesting user is admin
        const { data: requestingUser } = await supabase
            .from("users")
            .select("is_admin")
            .eq("id", requestingUserId)
            .single();

        if (!requestingUser?.is_admin) {
            return res.status(403).json({ error: "Forbidden: Admin access required" });
        }

        // Build query
        let query = supabase
            .from("audit_logs")
            .select("*")
            .order("timestamp", { ascending: false })
            .limit(Number(limit));

        if (event_type) {
            query = query.eq("event_type", event_type);
        }

        if (status) {
            query = query.eq("status", status);
        }

        const { data: logs, error } = await query;

        if (error) {
            console.error("Error fetching recent audit logs:", error);
            return res.status(500).json({ error: "Failed to fetch audit logs" });
        }

        res.json({ logs, count: logs?.length || 0 });
    } catch (error) {
        console.error("Audit log fetch error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * Get audit log statistics (admin only)
 * GET /api/audit-logs/stats
 */
router.get("/stats", async (req, res) => {
    try {
        const requestingUserId = req.headers["user-id"] as string;

        if (!requestingUserId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        // Check if requesting user is admin
        const { data: requestingUser } = await supabase
            .from("users")
            .select("is_admin")
            .eq("id", requestingUserId)
            .single();

        if (!requestingUser?.is_admin) {
            return res.status(403).json({ error: "Forbidden: Admin access required" });
        }

        // Get statistics
        const { data: stats, error } = await supabase
            .rpc('get_audit_log_stats');

        if (error) {
            console.error("Error fetching audit log stats:", error);
            return res.status(500).json({ error: "Failed to fetch statistics" });
        }

        res.json({ stats });
    } catch (error) {
        console.error("Audit log stats error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
