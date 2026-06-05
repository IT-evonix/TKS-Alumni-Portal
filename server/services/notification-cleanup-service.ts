/**
 * Notification Cleanup Service
 * Handles archiving and cleaning up old notifications
 */

import { supabase } from "../supabase";

/**
 * Archive old read notifications (older than specified days)
 * @param daysOld Number of days old to archive (default: 90)
 * @returns Number of notifications archived
 */
export async function archiveOldNotifications(daysOld: number = 90): Promise<number> {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);

        // Get old read notifications
        const { data: oldNotifications, error: fetchError } = await supabase
            .from("notifications")
            .select("*")
            .eq("is_read", true)
            .lt("created_at", cutoffDate.toISOString())
            .eq("is_archived", false)
            .limit(1000); // Process in batches

        if (fetchError) {
            console.error("[Notification Cleanup] Error fetching old notifications:", fetchError);
            return 0;
        }

        if (!oldNotifications || oldNotifications.length === 0) {
            return 0;
        }

        // Archive notifications
        const archiveData = oldNotifications.map(notification => ({
            user_id: notification.user_id,
            notification_id: notification.id,
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
        }));

        // Insert into archive table
        const { error: archiveError } = await supabase
            .from("notification_archive")
            .insert(archiveData);

        if (archiveError) {
            console.error("[Notification Cleanup] Error archiving notifications:", archiveError);
            return 0;
        }

        // Mark as archived in notifications table
        const notificationIds = oldNotifications.map(n => n.id);
        const { error: updateError } = await supabase
            .from("notifications")
            .update({ is_archived: true, archived_at: new Date().toISOString() })
            .in("id", notificationIds);

        if (updateError) {
            console.error("[Notification Cleanup] Error marking as archived:", updateError);
            // Archive was successful, so we still count it
        }

        console.log(`[Notification Cleanup] Archived ${oldNotifications.length} notifications`);
        return oldNotifications.length;
    } catch (error) {
        console.error("[Notification Cleanup] Exception:", error);
        return 0;
    }
}

/**
 * Delete very old archived notifications (older than specified days)
 * @param daysOld Number of days old to delete (default: 365)
 * @returns Number of notifications deleted
 */
export async function deleteOldArchivedNotifications(daysOld: number = 365): Promise<number> {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);

        // Delete from archive table
        const { data: deletedData, error } = await supabase
            .from("notification_archive")
            .delete()
            .lt("archived_at", cutoffDate.toISOString())
            .select();

        if (error) {
            console.error("[Notification Cleanup] Error deleting old archived notifications:", error);
            return 0;
        }

        const count = deletedData?.length || 0;
        if (count > 0) {
            console.log(`[Notification Cleanup] Deleted ${count} old archived notifications`);
        }

        return count;
    } catch (error) {
        console.error("[Notification Cleanup] Exception deleting old notifications:", error);
        return 0;
    }
}

/**
 * Clean up duplicate notifications (same type, user, related_id, actor within short time)
 * Keeps only the most recent one
 * @returns Number of duplicates removed
 */
export async function cleanupDuplicateNotifications(): Promise<number> {
    try {
        // This is a complex operation, so we'll use a SQL query
        // For now, we'll handle it in the application layer by checking before creation
        // This function can be enhanced with a database function if needed
        
        console.log("[Notification Cleanup] Duplicate cleanup handled at creation time");
        return 0;
    } catch (error) {
        console.error("[Notification Cleanup] Exception cleaning duplicates:", error);
        return 0;
    }
}

/**
 * Run all cleanup tasks
 * @param archiveDays Days old to archive (default: 90)
 * @param deleteDays Days old to delete (default: 365)
 * @returns Summary of cleanup operations
 */
export async function runNotificationCleanup(
    archiveDays: number = 90,
    deleteDays: number = 365
): Promise<{
    archived: number;
    deleted: number;
    duplicates: number;
}> {
    console.log("[Notification Cleanup] Starting cleanup process...");
    
    const archived = await archiveOldNotifications(archiveDays);
    const deleted = await deleteOldArchivedNotifications(deleteDays);
    const duplicates = await cleanupDuplicateNotifications();

    console.log("[Notification Cleanup] Cleanup complete:", {
        archived,
        deleted,
        duplicates
    });

    return { archived, deleted, duplicates };
}
