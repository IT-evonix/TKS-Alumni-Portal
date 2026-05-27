
import { Router } from "express";
import { supabase } from "../supabase";
import {
    createAndEmitNotification,
    NotificationType,
    NotificationRedirectUrl
} from "../services/notification-helper";
import { incrementScore } from "../services/gamification-service";

const router = Router();


// Check connection status with another user
router.get("/status/:userId", async (req, res) => {
    try {
        const currentUserId = req.headers["user-id"] as string;
        const { userId } = req.params;

        if (!currentUserId) {
            return res.status(401).json({ error: "No user ID provided" });
        }

        if (currentUserId === userId) {
            return res.json({ status: "self" });
        }

        const { data: connection } = await supabase
            .from("connection_requests")
            .select("status, requester_id")
            .or(
                `and(requester_id.eq.${currentUserId},recipient_id.eq.${userId}),and(requester_id.eq.${userId},recipient_id.eq.${currentUserId})`,
            )
            .maybeSingle();

        if (!connection) {
            return res.json({ status: "none" });
        }

        const isRequester = connection.requester_id === currentUserId;

        if (connection.status === "accepted") {
            return res.json({ status: "connected", isRequester });
        } else if (connection.status === "pending") {
            return res.json({ status: "pending", isRequester });
        } else {
            return res.json({ status: "none", isRequester });
        }
    } catch (error) {
        console.error("Check connection status error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ==================== CONNECTION REQUEST ROUTES ====================

// Get all connection requests (sent and received)
router.get("/requests", async (req, res) => {
    try {
        const userId = req.headers["user-id"] as string;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const { type } = req.query; // 'sent' or 'received' or 'all'

        let query = supabase
            .from("connection_requests")
            .select(`
        *,
        requester:users!requester_id(id, username, email),
        recipient:users!recipient_id(id, username, email)
      `)
            .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`)
            .order("created_at", { ascending: false });

        if (type === "sent") {
            query = query.eq("requester_id", userId);
        } else if (type === "received") {
            query = query.eq("recipient_id", userId);
        }

        const { data: requests, error } = await query;

        if (error) {
            console.error("Get connection requests error:", error);
            return res.status(500).json({ error: "Failed to fetch requests" });
        }

        res.json({ requests: requests || [] });
    } catch (error) {
        console.error("Get connection requests error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Send a connection request
router.post("/request", async (req, res) => {
    try {
        const userId = req.headers["user-id"] as string;
        if (!userId) {
            return res.status(401).json({ error: "No user ID provided" });
        }

        const { recipientId, message } = req.body;

        if (!recipientId) {
            return res.status(400).json({ error: "Recipient ID is required" });
        }

        if (recipientId === userId) {
            return res
                .status(400)
                .json({ error: "Cannot send connection request to yourself" });
        }

        // Check if connection already exists
        const { data: existing } = await supabase
            .from("connection_requests")
            .select("id, status")
            .or(
                `and(requester_id.eq.${userId},recipient_id.eq.${recipientId}),and(requester_id.eq.${recipientId},recipient_id.eq.${userId})`,
            )
            .maybeSingle();

        let request;

        if (existing) {
            if (existing.status === 'pending') {
                return res.status(400).json({ error: "Connection request already pending" });
            } else if (existing.status === 'accepted') {
                return res.status(400).json({ error: "You are already connected" });
            } else {
                // If rejected or withdrawn, update to pending
                const { data: updated, error: updateError } = await supabase
                    .from("connection_requests")
                    .update({
                        status: 'pending',
                        created_at: new Date().toISOString(),
                        requester_id: userId,
                        recipient_id: recipientId,
                        message: message
                    })
                    .eq('id', existing.id)
                    .select()
                    .single();

                if (updateError) throw updateError;
                request = updated;
            }
        } else {
            // Create new request
            const { data: newReq, error: createError } = await supabase
                .from("connection_requests")
                .insert({
                    requester_id: userId,
                    recipient_id: recipientId,
                    message,
                    status: 'pending'
                })
                .select()
                .single();

            if (createError) throw createError;
            request = newReq;
        }

        // Notification Logic
        const { data: senderAlumni } = await supabase
            .from("alumni")
            .select("first_name, last_name")
            .eq("user_id", userId)
            .maybeSingle();

        const senderName = senderAlumni ? `${senderAlumni.first_name} ${senderAlumni.last_name}` : "An alumni";

        // Create notification using new helper
        await createAndEmitNotification({
            userId: recipientId,
            type: NotificationType.CONNECTION_REQUEST,
            title: "New Connection Request",
            content: `${senderName} wants to connect with you`,
            relatedId: userId,
            redirectUrl: NotificationRedirectUrl.CONNECTIONS_RECEIVED,
            actorId: userId,
        });

        // Gamification Points for Connection Request
        incrementScore(userId, "connection_score", "network_connect", 1).catch(err => 
            console.error("Gamification network request error:", err)
        );

        res.status(201).json({ message: "Connection request sent", request });

    } catch (error) {
        console.error("Send connection request error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Withdraw connection request (Delete the request)
router.delete("/request", async (req, res) => {
    try {
        const userId = req.headers["user-id"] as string;
        if (!userId) {
            return res.status(401).json({ error: "No user ID provided" });
        }

        const { recipientId } = req.body;

        if (!recipientId) {
            return res.status(400).json({ error: "Recipient ID is required" });
        }

        const { data: request, error: findError } = await supabase
            .from("connection_requests")
            .select("id")
            .eq("requester_id", userId)
            .eq("recipient_id", recipientId)
            .eq("status", "pending")
            .single();

        if (findError || !request) {
            return res.status(404).json({ error: "Connection request not found" });
        }

        const { error: deleteError } = await supabase
            .from("connection_requests")
            .delete()
            .eq("id", request.id);

        if (deleteError) throw deleteError;

        // Remove associated notification
        await supabase.from("notifications")
            .delete()
            .eq("user_id", recipientId)
            .eq("related_id", userId)
            .eq("type", "connection_request")
            .eq("is_read", false);

        // Deduct Gamification Points for Connection Request Withdrawal
        incrementScore(userId, "connection_score", "network_connect", -1).catch(err => 
            console.error("Gamification network withdraw error:", err)
        );

        res.json({ message: "Connection request withdrawn" });
    } catch (error) {
        console.error("Withdraw connection request error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Remove connection (Disconnect)
router.delete("/connection", async (req, res) => {
    try {
        const userId = req.headers["user-id"] as string;
        if (!userId) {
            return res.status(401).json({ error: "No user ID provided" });
        }

        const { targetUserId } = req.body;

        if (!targetUserId) {
            return res.status(400).json({ error: "Target User ID is required" });
        }

        // Find the accepted connection request (can be in either direction)
        const { data: connection, error: findError } = await supabase
            .from("connection_requests")
            .select("id")
            .or(`and(requester_id.eq.${userId},recipient_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},recipient_id.eq.${userId})`)
            .eq("status", "accepted")
            .single();

        if (findError || !connection) {
            return res.status(404).json({ error: "Connection not found" });
        }

        // Delete the connection
        const { error: deleteError } = await supabase
            .from("connection_requests")
            .delete()
            .eq("id", connection.id);

        if (deleteError) throw deleteError;

        // Deduct Gamification Points for Connection Removal
        incrementScore(userId, "connection_score", "network_connect", -1).catch(err => 
            console.error("Gamification network remove error (user):", err)
        );
        incrementScore(targetUserId, "connection_score", "network_connect", -1).catch(err => 
            console.error("Gamification network remove error (target):", err)
        );

        res.json({ message: "Connection removed successfully" });
    } catch (error) {
        console.error("Remove connection error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Respond to connection request (Accept/Reject)
router.post("/respond", async (req, res) => {
    try {
        const userId = req.headers["user-id"] as string;
        if (!userId) {
            return res.status(401).json({ error: "No user ID provided" });
        }

        const { requesterId, action } = req.body; // action: 'accept' | 'reject'

        if (!requesterId || !action) {
            return res.status(400).json({ error: "Requester ID and action are required" });
        }

        const { data: request, error: findError } = await supabase
            .from("connection_requests")
            .select("id, status")
            .eq("requester_id", requesterId)
            .eq("recipient_id", userId)
            .eq("status", "pending")
            .single();

        if (findError || !request) {
            return res.status(404).json({ error: "Pending connection request not found" });
        }

        const newStatus = action === 'accept' ? 'accepted' : 'rejected';

        const { error: updateError } = await supabase
            .from("connection_requests")
            .update({
                status: newStatus,
                updated_at: new Date().toISOString()
            })
            .eq("id", request.id);

        if (updateError) throw updateError;

        // Mark notification as read
        await supabase.from("notifications")
            .update({ is_read: true })
            .eq("user_id", userId)
            .eq("related_id", requesterId)
            .eq("type", "connection_request");

        // If accepted, notify requester
        if (action === 'accept') {
            const { data: recipientAlumni } = await supabase
                .from("alumni")
                .select("first_name, last_name")
                .eq("user_id", userId)
                .maybeSingle();

            const recipientName = recipientAlumni ? `${recipientAlumni.first_name} ${recipientAlumni.last_name}` : "An alumni";

            // Create notification using new helper
            await createAndEmitNotification({
                userId: requesterId,
                type: NotificationType.CONNECTION_RESPONSE,
                title: "Connection Accepted",
                content: `${recipientName} accepted your connection request`,
                relatedId: userId,
                redirectUrl: NotificationRedirectUrl.CONNECTIONS,
                actorId: userId,
            });

            // Gamification Points for Connection
            incrementScore(userId, "connection_score", "network_connect", 1).catch(err => console.error("Gamification network connect error (recipient):", err));
            incrementScore(requesterId, "connection_score", "network_connect", 1).catch(err => console.error("Gamification network connect error (requester):", err));
        }

        res.json({ message: `Connection request ${newStatus}` });

    } catch (error) {
        console.error("Respond connection request error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Batch check connection status
router.post("/status/batch", async (req, res) => {
    try {
        const currentUserId = req.headers["user-id"] as string;
        const { userIds } = req.body;

        if (!currentUserId) {
            return res.status(401).json({ error: "No user ID provided" });
        }

        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return res.json({ statuses: {} });
        }

        const { data: requests, error } = await supabase
            .from("connection_requests")
            .select("status, requester_id, recipient_id")
            .or(`requester_id.eq.${currentUserId},recipient_id.eq.${currentUserId}`);

        if (error) {
            console.error("Batch status error:", error);
            return res.status(500).json({ error: "Failed to fetch statuses" });
        }

        const statuses: Record<string, string> = {};

        // Default all to 'none'
        userIds.forEach(id => statuses[id] = id === currentUserId ? 'self' : 'none');

        requests?.forEach((req) => {
            const otherId = req.requester_id === currentUserId ? req.recipient_id : req.requester_id;
            let status = req.status;

            if (status === 'pending') {
                status = req.requester_id === currentUserId ? 'pending_sent' : 'pending_received';
            }

            if (status === 'withdrawn') status = 'none';
            // Only overwrite if we found a match (which we should for valid requests)
            if (userIds.includes(otherId)) {
                statuses[otherId] = status;
            }
        });

        res.json({ statuses });
    } catch (error) {
        console.error("Batch status error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Get connection statistics
router.get("/stats", async (req, res) => {
    try {
        const userId = req.headers["user-id"] as string;
        if (!userId) {
            return res.status(401).json({ error: "No user ID provided" });
        }

        // Fetch all requests involving user
        const { data: allRequests, error } = await supabase
            .from("connection_requests")
            .select("status, requester_id, recipient_id")
            .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`);

        if (error) {
            console.error("Get connection stats error:", error);
            return res.status(500).json({ error: "Failed to fetch stats" });
        }

        let totalConnections = 0;
        let pendingSent = 0;
        let pendingReceived = 0;

        allRequests?.forEach(req => {
            if (req.status === 'accepted') {
                totalConnections++;
            } else if (req.status === 'pending') {
                if (req.requester_id === userId) pendingSent++;
                else pendingReceived++;
            }
        });

        res.json({
            totalConnections,
            pendingSent,
            pendingReceived,

        });
    } catch (error) {
        console.error("Get connection stats error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Get intelligent connection suggestions
router.get("/suggestions", async (req, res) => {
    try {
        const userId = req.headers["user-id"] as string;
        const limit = parseInt(req.query.limit as string) || 5;

        if (!userId) {
            return res.status(401).json({ error: "Not authenticated" });
        }

        // Get current user's profile
        const { data: currentAlumni } = await supabase
            .from("alumni")
            .select("*")
            .eq("user_id", userId)
            .single();

        if (!currentAlumni) {
            return res.json({ suggestions: [] });
        }

        // Get all existing active connections (accepted or pending)
        // We exclude withdrawn/rejected so they can be suggested again
        const { data: existingConnections } = await supabase
            .from("connection_requests")
            .select("requester_id, recipient_id")
            .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`)
            .in("status", ["pending", "accepted"]);

        const connectedUserIds = new Set<string>();
        existingConnections?.forEach((conn) => {
            if (conn.requester_id === userId) {
                connectedUserIds.add(conn.recipient_id);
            } else {
                connectedUserIds.add(conn.requester_id);
            }
        });

        // Get all alumni excluding current user
        // We fetch more than limit to score them in memory
        // Ideally we'd do this in SQL but scoring is complex
        const { data: allAlumni, error } = await supabase
            .from("alumni")
            .select("*, users!inner(id, username, email)")
            .neq("user_id", userId)
            .eq("is_active", true);
        // Removed is_profile_public check if we want to suggest private profiles? 
        // Usually suggestions should respect privacy, but let's keep consistent with valid profiles.
        // Original code had .eq("is_profile_public", true);

        if (error) throw error;

        // Filter out already connected users
        const availableAlumni =
            allAlumni?.filter((alumni) => !connectedUserIds.has(alumni.user_id)) ||
            [];

        // Calculate connection probability score for each user
        const scoredSuggestions = availableAlumni.map((alumni) => {
            let score = 0;
            const reasons: string[] = [];

            // Same batch - highest weight (40 points)
            if (alumni.batch && alumni.batch === currentAlumni.batch) {
                score += 40;
                reasons.push("Same batch");
            }

            // Same location/city - high weight (25 points)
            if (
                alumni.current_city &&
                alumni.current_city === currentAlumni.current_city
            ) {
                score += 25;
                reasons.push("Same location");
            }

            // Same company - high weight (25 points)
            if (
                alumni.current_company &&
                alumni.current_company === currentAlumni.current_company
            ) {
                score += 25;
                reasons.push("Works at same company");
            }

            // Same industry - medium weight (15 points)
            if (alumni.industry && alumni.industry === currentAlumni.industry) {
                score += 15;
                reasons.push("Same industry");
            }

            // Same course/branch - medium weight (15 points)
            if (alumni.course && alumni.course === currentAlumni.course) {
                score += 15;
                reasons.push("Same course");
            }

            // Similar graduation year (within 2 years) - medium weight (10 points)
            if (alumni.graduation_year && currentAlumni.graduation_year) {
                const yearDiff = Math.abs(
                    alumni.graduation_year - currentAlumni.graduation_year,
                );
                if (yearDiff <= 2) {
                    score += Math.max(0, 10 - yearDiff * 3);
                    if (yearDiff === 0) {
                        reasons.push("Same graduation year");
                    } else {
                        reasons.push(
                            `Graduated ${yearDiff} year${yearDiff > 1 ? "s" : ""} apart`,
                        );
                    }
                }
            }

            // Profile completeness bonus - low weight (5 points)
            if (alumni.profile_picture && alumni.bio && alumni.linkedin_url) {
                score += 5;
            }

            return {
                ...alumni,
                connection_score: score,
                connection_reasons: reasons,
            };
        });

        // Sort by score and return top suggestions
        const topSuggestions = scoredSuggestions
            .sort((a, b) => b.connection_score - a.connection_score)
            .slice(0, Number(limit));

        res.json({ suggestions: topSuggestions });

    } catch (error) {
        console.error("Suggestions error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
