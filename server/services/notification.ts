import { supabase } from "../supabase";

interface NotificationData {
    userId: string;
    type: string;
    title: string;
    content: string;
    relatedId?: string;
}

export async function createNotification(data: NotificationData) {
    try {
        const { error } = await supabase
            .from("notifications")
            .insert({
                user_id: data.userId,
                type: data.type,
                title: data.title,
                content: data.content,
                related_id: data.relatedId,
                is_read: false
            });

        if (error) {
            console.error("Error creating notification:", error);
            throw error;
        }

        return true;
    } catch (err) {
        console.error("Failed to create notification:", err);
        // Don't crash the request if notification fails
        return false;
    }
}
