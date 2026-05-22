import { supabase } from "../supabase";
import { sendPushForNotification } from "./push-notification-service";

/**
 * Track notification analytics event
 */
async function trackNotificationEvent(
    userId: string,
    notificationId: string,
    notificationType: string,
    action: 'created' | 'read' | 'clicked' | 'dismissed' | 'archived' | 'deleted',
    metadata?: Record<string, any>
): Promise<void> {
    try {
        await supabase
            .from("notification_analytics")
            .insert({
                user_id: userId,
                notification_id: notificationId,
                notification_type: notificationType,
                action,
                metadata: metadata ? JSON.stringify(metadata) : null,
            });
    } catch (error) {
        // Don't fail notification creation if analytics fails
        console.error("[Notification] Failed to track analytics:", error);
    }
}

/**
 * Centralized notification creation service
 * Ensures consistent notification structure across the application
 */

export interface CreateNotificationParams {
    userId: string;
    type: string;
    title: string;
    content: string;
    relatedId?: string | null;
    redirectUrl: string;
    actorId?: string | null;
    metadata?: Record<string, any>;
}

/**
 * Checks if a notification type is enabled for a user
 * @param userId User ID
 * @param notificationType Notification type
 * @returns true if enabled, false otherwise
 */
async function isNotificationTypeEnabled(userId: string, notificationType: string): Promise<boolean> {
    try {
        const { data: preference, error } = await supabase
            .from("notification_preferences")
            .select("enabled")
            .eq("user_id", userId)
            .eq("notification_type", notificationType)
            .maybeSingle();

        // If no preference found, default to enabled
        if (error || !preference) {
            return true;
        }

        return preference.enabled !== false;
    } catch (error) {
        console.error("[Notification] Error checking preferences:", error);
        // Default to enabled on error
        return true;
    }
}

/**
 * Checks for duplicate notifications (same type, user, related_id, and actor within last 5 minutes)
 * @param userId User ID
 * @param type Notification type
 * @param relatedId Related entity ID
 * @param actorId Actor ID
 * @returns true if duplicate exists
 */
async function isDuplicateNotification(
    userId: string,
    type: string,
    relatedId: string | null,
    actorId: string | null
): Promise<boolean> {
    try {
        // Only check for duplicates for certain types that can be spammed
        const duplicateCheckTypes = ['post_like', 'post_comment', 'comment_reply'];
        if (!duplicateCheckTypes.includes(type)) {
            return false;
        }

        // Check for recent duplicate (within last 5 minutes)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

        let query = supabase
            .from("notifications")
            .select("id")
            .eq("user_id", userId)
            .eq("type", type)
            .gte("created_at", fiveMinutesAgo)
            .limit(1);

        if (relatedId) {
            query = query.eq("related_id", relatedId);
        }

        if (actorId) {
            query = query.eq("actor_id", actorId);
        }

        const { data, error } = await query;

        if (error) {
            console.error("[Notification] Error checking duplicates:", error);
            return false; // Don't block on error
        }

        return (data?.length || 0) > 0;
    } catch (error) {
        console.error("[Notification] Exception checking duplicates:", error);
        return false;
    }
}

/**
 * Creates a notification in the database
 * @param params Notification parameters
 * @returns Object with error if creation failed
 */
export async function createNotification(params: CreateNotificationParams) {
    try {
        // Check if notification type is enabled for user
        const isEnabled = await isNotificationTypeEnabled(params.userId, params.type);
        if (!isEnabled) {
            console.log(`[Notification] Skipping disabled notification type: ${params.type} for user: ${params.userId}`);
            return { error: null, data: null, skipped: true };
        }

        // Check for duplicates
        const isDuplicate = await isDuplicateNotification(
            params.userId,
            params.type,
            params.relatedId || null,
            params.actorId || null
        );
        if (isDuplicate) {
            console.log(`[Notification] Skipping duplicate notification: ${params.type} for user: ${params.userId}`);
            return { error: null, data: null, skipped: true };
        }

        // Build insert object
        const insertData: any = {
            user_id: params.userId,
            type: params.type,
            title: params.title,
            content: params.content,
            related_id: params.relatedId || null,
            redirect_url: params.redirectUrl,
            actor_id: params.actorId || null,
            metadata: params.metadata ? JSON.stringify(params.metadata) : null,
            is_read: false,
        };

        const { data, error } = await supabase
            .from("notifications")
            .insert(insertData)
            .select()
            .single();

        if (error) {
            console.error("[Notification] Failed to create notification:", {
                error,
                type: params.type,
                userId: params.userId,
                message: error.message
            });
            return { error, data: null };
        }

        console.log(`[Notification] Created notification: ${data.id} (type: ${params.type}, user: ${params.userId})`);

        // Track analytics
        await trackNotificationEvent(
            params.userId,
            data.id,
            params.type,
            'created',
            { related_id: params.relatedId, actor_id: params.actorId }
        );

        return { error: null, data };
    } catch (error) {
        console.error("[Notification] Exception creating notification:", {
            error,
            type: params.type,
            userId: params.userId
        });
        return { error, data: null };
    }
}

/**
 * Sends a real-time notification via Socket.IO using room-based emission
 * @param recipientId User ID to send notification to
 * @param notification Notification data
 */
export function emitRealtimeNotification(
    recipientId: string,
    notification: {
        type: string;
        title: string;
        content: string;
        related_id?: string | null;
        redirect_url: string;
    }
) {
    try {
        const io = (global as any).io;

        if (io) {
            // Use room-based emission for reliability (works across tabs, reconnections)
            const roomName = `user:${recipientId}`;
            io.to(roomName).emit("notification", notification);
            console.log(`[Notification] Emitted to room: ${roomName}`, {
                type: notification.type,
                title: notification.title
            });
        } else {
            console.warn("[Notification] Socket.IO not initialized, skipping real-time notification");
        }
    } catch (error) {
        console.error("[Notification] Failed to emit real-time notification:", error);
    }
}

/**
 * Creates a notification and sends it in real-time
 * @param params Notification parameters
 */
export async function createAndEmitNotification(params: CreateNotificationParams) {
    // Create in database
    const { error, data, skipped } = await createNotification(params);

    // If skipped (disabled or duplicate), return early
    if (skipped) {
        return { error: null, data: null, skipped: true };
    }

    if (!error && data) {
        // Send real-time notification via Socket.IO
        emitRealtimeNotification(params.userId, {
            type: params.type,
            title: params.title,
            content: params.content,
            related_id: params.relatedId || null,
            redirect_url: params.redirectUrl,
        });

        // Send push notification (if user has subscribed)
        try {
            await sendPushForNotification(params.userId, {
                id: data.id,
                type: params.type,
                title: params.title,
                content: params.content,
                redirect_url: params.redirectUrl,
            });
        } catch (pushError) {
            // Don't fail notification creation if push fails
            console.error("[Notification] Failed to send push notification:", pushError);
        }
    } else if (error) {
        console.error("[Notification] Failed to create notification, skipping real-time delivery:", {
            error,
            type: params.type,
            userId: params.userId
        });
    }

    return { error, data };
}

/**
 * Notification type constants for consistency
 */
export const NotificationType = {
    WELCOME: "welcome",
    POST_LIKE: "post_like",
    POST_COMMENT: "post_comment",
    COMMENT_REPLY: "comment_reply",
    CONNECTION_REQUEST: "connection_request",
    CONNECTION_RESPONSE: "connection_response",
    MESSAGE: "message",
    EVENT_RSVP: "event_rsvp",
    EVENT_REMINDER_24H: "event_reminder_24h",
    EVENT_REMINDER_1H: "event_reminder_1h",
    JOB: "job",
    SIGNUP_APPROVED: "signup_approved",
    SIGNUP_REQUEST: "signup_request",
    POST_APPROVED: "post_approved",
    POST_REJECTED: "post_rejected",
    /** Notify admins when a user submits a post for approval */
    POST_PENDING_APPROVAL: "post_pending_approval",
    WEEKLY_DIGEST: "weekly_digest",
} as const;

/**
 * Redirect URL constants for consistency
 */
export const NotificationRedirectUrl = {
    FEED: "/feed",
    CONNECTIONS: "/connections",
    CONNECTIONS_RECEIVED: "/connections?tab=received",
    INBOX: "/inbox",
    EVENTS: "/events",
    JOB_PORTAL: "/job-portal",
    PROFILE: "/profile",
    ADMIN_USERS: "/admin/users",
    ADMIN_FEED: "/admin/feed",
} as const;
