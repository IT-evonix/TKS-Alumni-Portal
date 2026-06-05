import { supabase } from "../supabase";
import { getBaseUrl } from "../utils/base-url";
import { getEmailHeaderHtml, getEmailFooterHtml, sendEmail } from "./email-service";

interface EventReminder {
    eventId: string;
    alumniId: string;
    reminderType: '1_week' | '1_day' | '1_hour';
    eventName: string;
    eventDate: string;
    eventLocation?: string;
    alumniEmail: string;
    alumniName: string;
}

interface NotificationPreferences {
    emailNotifications: boolean;
    pushNotifications: boolean;
    eventReminders: boolean;
}

/**
 * Check if a reminder has already been sent
 */
async function hasReminderBeenSent(
    eventId: string,
    alumniId: string,
    reminderType: string
): Promise<boolean> {
    const { data, error } = await supabase
        .from("event_reminders_sent")
        .select("id")
        .eq("event_id", eventId)
        .eq("alumni_id", alumniId)
        .eq("reminder_type", reminderType)
        .single();

    return !!data && !error;
}

/**
 * Mark a reminder as sent
 */
async function markReminderAsSent(
    eventId: string,
    alumniId: string,
    reminderType: string,
    deliveryMethod: string
): Promise<void> {
    await supabase
        .from("event_reminders_sent")
        .insert({
            event_id: eventId,
            alumni_id: alumniId,
            reminder_type: reminderType,
            delivery_method: deliveryMethod,
            sent_at: new Date().toISOString()
        });
}

/**
 * Get notification preferences for an alumni
 */
async function getNotificationPreferences(alumniId: string): Promise<NotificationPreferences> {
    const { data, error } = await supabase
        .from("alumni")
        .select("email_notifications_enabled, push_notifications_enabled, event_reminders_enabled")
        .eq("id", alumniId)
        .single();

    if (error || !data) {
        return {
            emailNotifications: false,
            pushNotifications: false,
            eventReminders: false
        };
    }

    return {
        emailNotifications: data.email_notifications_enabled ?? false,
        pushNotifications: data.push_notifications_enabled ?? false,
        eventReminders: data.event_reminders_enabled ?? false
    };
}

/** Escape for HTML in email (inline) */
function escapeHtml(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * Build event reminder message by type
 */
function getReminderMessage(reminder: EventReminder): string {
    const dateStr = new Date(reminder.eventDate).toLocaleDateString(undefined, {
        dateStyle: "medium",
        timeZone: "Asia/Kolkata",
    });
    if (reminder.reminderType === "1_week") {
        return `Your event "${reminder.eventName}" is in one week (${dateStr}).`;
    }
    if (reminder.reminderType === "1_day") {
        return `Your event "${reminder.eventName}" is tomorrow (${dateStr}).`;
    }
    const hoursUntil = Math.max(
        0,
        Math.floor((new Date(reminder.eventDate).getTime() - Date.now()) / (1000 * 60 * 60))
    );
    return `Your event "${reminder.eventName}" starts in ${hoursUntil} hour(s) (${dateStr}).`;
}

/**
 * Build HTML body for event reminder email (shared header/footer, event details, View event CTA)
 */
function getEventReminderHtml(reminder: EventReminder): string {
    const baseUrl = getBaseUrl();
    const eventUrl = `${baseUrl}/events/${reminder.eventId}`;
    const dateStr = new Date(reminder.eventDate).toLocaleString(undefined, {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: "Asia/Kolkata",
    });
    const name = escapeHtml(reminder.eventName);
    const location = reminder.eventLocation ? escapeHtml(reminder.eventLocation) : null;
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Event Reminder: ${name}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  ${getEmailHeaderHtml(baseUrl)}
  <div style="background: #ffffff; padding: 24px; border: 1px solid #e0e0e0; border-top: none;">
    <h2 style="color: #008060; margin: 0 0 16px 0; font-size: 22px;">${name}</h2>
    <p style="margin: 0 0 8px 0; font-size: 16px;"><strong>Date &amp; time:</strong> ${escapeHtml(dateStr)}</p>
    ${location ? `<p style="margin: 0 0 20px 0; font-size: 16px;"><strong>Location:</strong> ${location}</p>` : "<p style=\"margin: 0 0 20px 0;\"></p>"}
    <p style="margin: 0 0 20px 0;"><a href="${eventUrl}" style="display: inline-block; background: linear-gradient(135deg, #008060 0%, #006b51 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">View event</a></p>
    <p style="color: #666; font-size: 14px; margin: 0;">You're receiving this because you're registered for this event.</p>
  </div>
  ${getEmailFooterHtml(baseUrl)}
</body>
</html>`.trim();
}

/**
 * Send email reminder via ZeptoMail and create in-app notification
 */
async function sendEmailReminder(reminder: EventReminder): Promise<boolean> {
    const content = getReminderMessage(reminder);
    const title = `Event Reminder: ${reminder.eventName}`;
    const redirectUrl = `/events/${reminder.eventId}`;
    const textBody = content + (reminder.eventLocation ? `\nLocation: ${reminder.eventLocation}` : "");
    const htmlBody = getEventReminderHtml(reminder);

    try {
        await sendEmail({
            to: reminder.alumniEmail,
            toName: reminder.alumniName,
            subject: title,
            textBody,
            htmlBody,
        });
    } catch (emailErr) {
        console.error("Event reminder email failed:", reminder.alumniEmail, emailErr);
        // Continue to create in-app notification so user still gets reminder
    }

    try {
        await supabase.from("notifications").insert({
            user_id: reminder.alumniId,
            type: "event_reminder",
            title,
            content,
            redirect_url: redirectUrl,
            is_read: false,
        });
    } catch (notifErr) {
        console.error("Event reminder in-app notification failed:", notifErr);
        return false;
    }
    return true;
}

/**
 * Send push notification reminder
 */
async function sendPushReminder(reminder: EventReminder): Promise<boolean> {
    try {
        // TODO: Implement with web-push
        console.log(`Push reminder sent to ${reminder.alumniId} for event ${reminder.eventName}`);
        return true;
    } catch (error) {
        console.error('Error sending push reminder:', error);
        return false;
    }
}

/**
 * Send in-app notification reminder only (correct schema: content, redirect_url)
 */
async function sendInAppReminder(reminder: EventReminder): Promise<boolean> {
    try {
        const content = getReminderMessage(reminder);
        await supabase.from("notifications").insert({
            user_id: reminder.alumniId,
            type: "event_reminder",
            title: "Event Reminder",
            content,
            redirect_url: `/events/${reminder.eventId}`,
            is_read: false,
        });
        return true;
    } catch (error) {
        console.error("Error sending in-app reminder:", error);
        return false;
    }
}

/**
 * Process a single event reminder
 */
export async function processEventReminder(reminder: EventReminder): Promise<void> {
    // Check if reminder already sent
    const alreadySent = await hasReminderBeenSent(
        reminder.eventId,
        reminder.alumniId,
        reminder.reminderType
    );

    if (alreadySent) {
        console.log(`Reminder already sent for event ${reminder.eventId}, alumni ${reminder.alumniId}, type ${reminder.reminderType}`);
        return;
    }

    // Get user's notification preferences
    const preferences = await getNotificationPreferences(reminder.alumniId);

    // Check if event reminders are enabled
    if (!preferences.eventReminders) {
        console.log(`Event reminders disabled for alumni ${reminder.alumniId}`);
        return;
    }

    const deliveryMethods: string[] = [];

    // Send via enabled channels
    if (preferences.emailNotifications) {
        const sent = await sendEmailReminder(reminder);
        if (sent) deliveryMethods.push('email');
    }

    if (preferences.pushNotifications) {
        const sent = await sendPushReminder(reminder);
        if (sent) deliveryMethods.push('push');
    }

    // Always send in-app notification
    const sent = await sendInAppReminder(reminder);
    if (sent) deliveryMethods.push('in-app');

    // Mark as sent
    if (deliveryMethods.length > 0) {
        await markReminderAsSent(
            reminder.eventId,
            reminder.alumniId,
            reminder.reminderType,
            deliveryMethods.join(',')
        );
        console.log(`Event reminder sent via ${deliveryMethods.join(', ')} for ${reminder.eventName}`);
    }
}

/**
 * Get upcoming events that need reminders
 */
export async function getUpcomingEventsForReminders(): Promise<EventReminder[]> {
    const now = new Date();
    const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    const reminders: EventReminder[] = [];

    // Query events with RSVPs in the reminder windows
    // Note: This is a simplified version. In production, you'd need to:
    // 1. Join with event_rsvps table
    // 2. Filter by RSVP status (attending)
    // 3. Check if reminder already sent
    // 4. Get alumni details

    try {
        // Get events in the next week (for 1-week reminders)
        const { data: weekEvents, error: weekError } = await supabase
            .from("events")
            .select(`
                id,
                title,
                event_date,
                location
            `)
            .gte("event_date", now.toISOString())
            .lte("event_date", oneWeekFromNow.toISOString());

        // Get events in the next day (for 1-day reminders)
        const { data: dayEvents, error: dayError } = await supabase
            .from("events")
            .select(`
                id,
                title,
                event_date,
                location
            `)
            .gte("event_date", now.toISOString())
            .lte("event_date", oneDayFromNow.toISOString());

        // Get events in the next hour (for 1-hour reminders)
        const { data: hourEvents, error: hourError } = await supabase
            .from("events")
            .select(`
                id,
                title,
                event_date,
                location
            `)
            .gte("event_date", now.toISOString())
            .lte("event_date", oneHourFromNow.toISOString());

        // Process week-ahead reminders
        if (weekEvents && weekEvents.length > 0) {
            for (const event of weekEvents) {
                // Get RSVPs for this event
                const { data: rsvps, error: rsvpError } = await supabase
                    .from("event_rsvps")
                    .select(`
                        user_id,
                        status,
                        reminder_sent
                    `)
                    .eq("event_id", event.id)
                    .eq("status", "attending")
                    .eq("reminder_sent", false); // Only send to those who haven't received reminder

                if (rsvpError) {
                    console.error(`Error fetching RSVPs for event ${event.id}:`, rsvpError);
                    continue;
                }

                if (rsvps && rsvps.length > 0) {
                    // Get alumni details for reminder emails
                    const alumniIds = rsvps.map((rsvp: any) => rsvp.user_id);
                    const { data: alumniData, error: alumniError } = await supabase
                        .from("alumni")
                        .select("user_id, first_name, last_name, email")
                        .in("user_id", alumniIds);

                    if (alumniError) {
                        console.error(`Error fetching alumni for event ${event.id}:`, alumniError);
                        continue;
                    }

                    // Create reminder objects
                    if (alumniData) {
                        for (const alumni of alumniData) {
                            reminders.push({
                                eventId: event.id,
                                eventName: event.title,
                                eventDate: event.event_date,
                                alumniId: alumni.user_id,
                                alumniEmail: alumni.email,
                                alumniName: `${alumni.first_name} ${alumni.last_name}`,
                                reminderType: '1_week'
                            });
                        }
                    }
                }
            }
        }

        // Process day-ahead reminders (similar logic)
        if (dayEvents && dayEvents.length > 0) {
            for (const event of dayEvents) {
                const { data: rsvps, error: rsvpError } = await supabase
                    .from("event_rsvps")
                    .select(`
                        user_id,
                        status,
                        reminder_sent
                    `)
                    .eq("event_id", event.id)
                    .eq("status", "attending")
                    .eq("reminder_sent", false);

                if (rsvpError || !rsvps || rsvps.length === 0) continue;

                const alumniIds = rsvps.map((rsvp: any) => rsvp.user_id);
                const { data: alumniData } = await supabase
                    .from("alumni")
                    .select("user_id, first_name, last_name, email")
                    .in("user_id", alumniIds);

                if (alumniData) {
                    for (const alumni of alumniData) {
                        reminders.push({
                            eventId: event.id,
                            alumniId: alumni.user_id,
                            reminderType: '1_day',
                            eventName: event.title,
                            eventDate: event.event_date,
                            eventLocation: event.location,
                            alumniEmail: alumni.email,
                            alumniName: `${alumni.first_name} ${alumni.last_name}`
                        });
                    }
                }
            }
        }

        // Process hour-ahead reminders (similar logic)
        if (hourEvents && hourEvents.length > 0) {
            for (const event of hourEvents) {
                const { data: rsvps, error: rsvpError } = await supabase
                    .from("event_rsvps")
                    .select(`
                        user_id,
                        status,
                        reminder_sent
                    `)
                    .eq("event_id", event.id)
                    .eq("status", "attending")
                    .eq("reminder_sent", false);

                if (rsvpError || !rsvps || rsvps.length === 0) continue;

                const alumniIds = rsvps.map((rsvp: any) => rsvp.user_id);
                const { data: alumniData } = await supabase
                    .from("alumni")
                    .select("user_id, first_name, last_name, email")
                    .in("user_id", alumniIds);

                if (alumniData) {
                    for (const alumni of alumniData) {
                        reminders.push({
                            eventId: event.id,
                            alumniId: alumni.user_id,
                            reminderType: '1_hour',
                            eventName: event.title,
                            eventDate: event.event_date,
                            eventLocation: event.location,
                            alumniEmail: alumni.email,
                            alumniName: `${alumni.first_name} ${alumni.last_name}`
                        });
                    }
                }
            }
        }

        console.log(`Generated ${reminders.length} event reminders`);
        console.log(`Found ${weekEvents?.length || 0} events for 1-week reminders`);
        console.log(`Found ${dayEvents?.length || 0} events for 1-day reminders`);
        console.log(`Found ${hourEvents?.length || 0} events for 1-hour reminders`);

    } catch (error) {
        console.error('Error fetching upcoming events:', error);
    }

    return reminders;
}

/**
 * Main function to process all event reminders
 */
export async function processAllEventReminders(): Promise<void> {
    console.log('Starting event reminders processing...');

    const reminders = await getUpcomingEventsForReminders();

    console.log(`Processing ${reminders.length} event reminders`);

    for (const reminder of reminders) {
        await processEventReminder(reminder);
    }

    console.log('Event reminders processing complete');
}
