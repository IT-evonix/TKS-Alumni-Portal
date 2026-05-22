import { Router } from "express";
import { supabase } from "../supabase";

const router = Router();

/**
 * Track search analytics
 * POST /api/analytics/search
 */
router.post("/search", async (req, res) => {
    try {
        const {
            query,
            filters,
            resultsCount,
            clickedResultId,
            clickedResultType,
            clickedResultPosition,
            searchDurationMs,
            hadResults,
            usedSuggestion,
            suggestionText,
            cacheHit
        } = req.body;

        const userId = req.headers['user-id'] as string;
        const userAgent = req.headers['user-agent'];
        const ipAddress = req.ip || req.connection.remoteAddress;

        // Generate session ID (could be enhanced with actual session tracking)
        const sessionId = req.headers['x-session-id'] as string || `session-${Date.now()}`;

        const { error } = await supabase
            .from("search_analytics")
            .insert({
                user_id: userId || null,
                query,
                filters: filters || {},
                results_count: resultsCount || 0,
                clicked_result_id: clickedResultId || null,
                clicked_result_type: clickedResultType || null,
                clicked_result_position: clickedResultPosition || null,
                search_duration_ms: searchDurationMs || null,
                had_results: hadResults !== false,
                used_suggestion: usedSuggestion || false,
                suggestion_text: suggestionText || null,
                cache_hit: cacheHit || false,
                session_id: sessionId,
                user_agent: userAgent,
                ip_address: ipAddress
            });

        if (error) {
            console.error("Error tracking search analytics:", error);
            // Don't fail the request if analytics fails
            return res.status(200).json({ success: true, tracked: false });
        }

        res.json({ success: true, tracked: true });
    } catch (error) {
        console.error("Search analytics error:", error);
        res.status(200).json({ success: true, tracked: false });
    }
});

/**
 * Get popular searches
 * GET /api/analytics/search/popular
 */
router.get("/search/popular", async (req, res) => {
    try {
        const limit = parseInt(req.query.limit as string) || 10;

        const { data, error } = await supabase
            .from("popular_searches")
            .select("*")
            .limit(limit);

        if (error) throw error;

        res.json({ searches: data || [] });
    } catch (error) {
        console.error("Error fetching popular searches:", error);
        res.status(500).json({ error: "Failed to fetch popular searches" });
    }
});

/**
 * Get zero result searches
 * GET /api/analytics/search/zero-results
 */
router.get("/search/zero-results", async (req, res) => {
    try {
        const userId = req.headers["user-id"] as string;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const { data: user } = await supabase
            .from("users")
            .select("is_admin, user_role")
            .eq("id", userId)
            .single();

        if (!user || (!user.is_admin && user.user_role !== "administrator")) {
            return res.status(403).json({ error: "Unauthorized" });
        }

        const limit = parseInt(req.query.limit as string) || 20;

        const { data, error } = await supabase
            .from("zero_result_searches")
            .select("*")
            .limit(limit);

        if (error) throw error;

        res.json({ searches: data || [] });
    } catch (error) {
        console.error("Error fetching zero result searches:", error);
        res.status(500).json({ error: "Failed to fetch zero result searches" });
    }
});

/**
 * Get search performance metrics
 * GET /api/analytics/search/performance
 */
router.get("/search/performance", async (req, res) => {
    try {
        const userId = req.headers["user-id"] as string;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const { data: user } = await supabase
            .from("users")
            .select("is_admin, user_role")
            .eq("id", userId)
            .single();

        if (!user || (!user.is_admin && user.user_role !== "administrator")) {
            return res.status(403).json({ error: "Unauthorized" });
        }

        const days = parseInt(req.query.days as string) || 30;

        const { data, error } = await supabase
            .from("search_performance_metrics")
            .select("*")
            .limit(days);

        if (error) throw error;

        res.json({ metrics: data || [] });
    } catch (error) {
        console.error("Error fetching search performance:", error);
        res.status(500).json({ error: "Failed to fetch search performance" });
    }
});

/**
 * Get filter usage statistics
 * GET /api/analytics/search/filter-usage
 */
router.get("/search/filter-usage", async (req, res) => {
    try {
        const userId = req.headers["user-id"] as string;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const { data: user } = await supabase
            .from("users")
            .select("is_admin, user_role")
            .eq("id", userId)
            .single();

        if (!user || (!user.is_admin && user.user_role !== "administrator")) {
            return res.status(403).json({ error: "Unauthorized" });
        }

        const { data, error } = await supabase
            .from("filter_usage_stats")
            .select("*");

        if (error) throw error;

        res.json({ stats: data || [] });
    } catch (error) {
        console.error("Error fetching filter usage stats:", error);
        res.status(500).json({ error: "Failed to fetch filter usage stats" });
    }
});

/**
 * Track search result click
 * POST /api/analytics/search/click
 */
router.post("/search/click", async (req, res) => {
    try {
        const {
            query,
            resultId,
            resultType,
            position
        } = req.body;

        const userId = req.headers['user-id'] as string;

        // Update the most recent search analytics entry for this user/query
        const { error } = await supabase
            .from("search_analytics")
            .update({
                clicked_result_id: resultId,
                clicked_result_type: resultType,
                clicked_result_position: position
            })
            .eq("user_id", userId)
            .eq("query", query)
            .order("created_at", { ascending: false })
            .limit(1);

        if (error) {
            console.error("Error tracking click:", error);
            return res.status(200).json({ success: true, tracked: false });
        }

        res.json({ success: true, tracked: true });
    } catch (error) {
        console.error("Click tracking error:", error);
        res.status(200).json({ success: true, tracked: false });
    }
});

export default router;
