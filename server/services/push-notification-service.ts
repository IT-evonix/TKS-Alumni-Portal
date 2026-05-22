/**
 * Backend Push Notification Service
 * Handles sending push notifications to subscribed users
 */

import webpush from 'web-push';
import { config } from '../config';
import { supabase } from '../supabase';

// Configure VAPID details — all three values are required
if (!config.vapidSubject || !config.vapidPublicKey || !config.vapidPrivateKey) {
  console.warn('[PushNotification] VAPID keys not configured — push notifications will be disabled. Set VAPID_SUBJECT, VAPID_PUBLIC_KEY, and VAPID_PRIVATE_KEY environment variables.');
} else {
  webpush.setVapidDetails(
    config.vapidSubject,
    config.vapidPublicKey,
    config.vapidPrivateKey
  );
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  data?: {
    url?: string;
    notificationId?: string;
    type?: string;
    [key: string]: any;
  };
  requireInteraction?: boolean;
  silent?: boolean;
}

/**
 * Send push notification to a user
 */
export async function sendPushNotification(
  userId: string,
  payload: PushNotificationPayload
): Promise<{ sent: number; failed: number }> {
  if (!config.vapidPublicKey || !config.vapidPrivateKey) {
    return { sent: 0, failed: 0 };
  }
  try {
    // Get the alumni ID for the user
    const { data: alumniData } = await supabase
      .from('alumni')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!alumniData) {
      console.log(`No alumni profile found for user ${userId}`);
      return { sent: 0, failed: 0 };
    }

    // Get all push subscriptions for the user
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('alumni_id', alumniData.id)
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching push subscriptions:', error);
      return { sent: 0, failed: 0 };
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`No push subscriptions found for user ${userId}`);
      return { sent: 0, failed: 0 };
    }

    // Send to all subscriptions
    const results = await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        try {
          const pushSubscription = {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.keys.p256dh,
              auth: subscription.keys.auth,
            },
          };

          await webpush.sendNotification(
            pushSubscription,
            JSON.stringify(payload)
          );

          return { success: true, subscriptionId: subscription.id };
        } catch (error: any) {
          console.error('Error sending push notification:', error);

          // If subscription is invalid, mark it as inactive
          if (error.statusCode === 410 || error.statusCode === 404) {
            await supabase
              .from('push_subscriptions')
              .update({ is_active: false })
              .eq('id', subscription.id);
          }

          return { success: false, error, subscriptionId: subscription.id };
        }
      })
    );

    // Count successes and failures
    let sent = 0;
    let failed = 0;

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          sent++;
        } else {
          failed++;
        }
      } else {
        failed++;
      }
    });

    return { sent, failed };
  } catch (error) {
    console.error('Error in sendPushNotification:', error);
    return { sent: 0, failed: 0 };
  }
}

/**
 * Send push notification to multiple users
 */
export async function sendPushNotificationToUsers(
  userIds: string[],
  payload: PushNotificationPayload
): Promise<{ sent: number; failed: number }> {
  let totalSent = 0;
  let totalFailed = 0;

  for (const userId of userIds) {
    const result = await sendPushNotification(userId, payload);
    totalSent += result.sent;
    totalFailed += result.failed;
  }

  return { sent: totalSent, failed: totalFailed };
}

/**
 * Send push notification when a new notification is created
 */
export async function sendPushForNotification(
  userId: string,
  notification: {
    id: string;
    type: string;
    title: string;
    content: string;
    redirect_url?: string | null;
  }
): Promise<void> {
  // Check user preferences
  const { data: preferences, error: prefError } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .eq('notification_type', notification.type)
    .maybeSingle();
  
  // If error or no preferences found, use defaults (allow push)
  if (prefError || !preferences) {
    // No preferences set, allow push by default
  }

  // If preferences exist and push is disabled, don't send
  if (preferences && !preferences.push_enabled) {
    return;
  }

  // Check if in quiet hours
  if (preferences?.quiet_hours_start && preferences?.quiet_hours_end) {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const start = preferences.quiet_hours_start;
    const end = preferences.quiet_hours_end;

    // Handle quiet hours that span midnight
    if (start > end) {
      if (currentTime >= start || currentTime <= end) {
        return; // In quiet hours
      }
    } else {
      if (currentTime >= start && currentTime <= end) {
        return; // In quiet hours
      }
    }
  }

  // Send push notification
  const payload: PushNotificationPayload = {
    title: notification.title,
    body: notification.content,
    icon: '/tks_logo.png',
    badge: '/tks_logo.png',
    tag: notification.type,
    data: {
      url: notification.redirect_url || '/feed',
      notificationId: notification.id,
      type: notification.type,
    },
    requireInteraction: false,
  };

  await sendPushNotification(userId, payload);
}
