/**
 * Notification Preferences Service
 * Manages user notification preferences
 */

export interface NotificationPreference {
  enabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  priority: 'high' | 'medium' | 'low';
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
}

export interface NotificationPreferencesMap {
  [notificationType: string]: NotificationPreference;
}

const DEFAULT_PREFERENCES: NotificationPreferencesMap = {
  message: {
    enabled: true,
    emailEnabled: true,
    pushEnabled: true,
    priority: 'high',
  },
  connection_request: {
    enabled: true,
    emailEnabled: true,
    pushEnabled: true,
    priority: 'high',
  },
  connection_response: {
    enabled: true,
    emailEnabled: false,
    pushEnabled: true,
    priority: 'medium',
  },
  post_like: {
    enabled: true,
    emailEnabled: false,
    pushEnabled: false,
    priority: 'low',
  },
  post_comment: {
    enabled: true,
    emailEnabled: true,
    pushEnabled: true,
    priority: 'medium',
  },
  comment_reply: {
    enabled: true,
    emailEnabled: true,
    pushEnabled: true,
    priority: 'medium',
  },
  event_rsvp: {
    enabled: true,
    emailEnabled: true,
    pushEnabled: true,
    priority: 'high',
  },
  event_reminder_24h: {
    enabled: true,
    emailEnabled: true,
    pushEnabled: true,
    priority: 'medium',
  },
  event_reminder_1h: {
    enabled: true,
    emailEnabled: true,
    pushEnabled: true,
    priority: 'high',
  },
  job: {
    enabled: true,
    emailEnabled: true,
    pushEnabled: true,
    priority: 'high',
  },
  signup_approved: {
    enabled: true,
    emailEnabled: true,
    pushEnabled: false,
    priority: 'high',
  },
  post_approved: {
    enabled: true,
    emailEnabled: false,
    pushEnabled: true,
    priority: 'medium',
  },
  post_rejected: {
    enabled: true,
    emailEnabled: true,
    pushEnabled: true,
    priority: 'high',
  },
};

/**
 * Get notification preferences
 */
export async function getNotificationPreferences(
  userId: string
): Promise<NotificationPreferencesMap> {
  try {
    const response = await fetch('/api/notifications/preferences', {
      headers: {
        'user-id': userId,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch preferences');
    }

    const data = await response.json();
    return { ...DEFAULT_PREFERENCES, ...data.preferences };
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    return DEFAULT_PREFERENCES;
  }
}

/**
 * Update notification preferences
 */
export async function updateNotificationPreferences(
  userId: string,
  preferences: NotificationPreferencesMap
): Promise<boolean> {
  try {
    const response = await fetch('/api/notifications/preferences', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'user-id': userId,
      },
      body: JSON.stringify({ preferences }),
    });

    if (!response.ok) {
      throw new Error('Failed to update preferences');
    }

    return true;
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    return false;
  }
}

/**
 * Check if notification type is enabled
 */
export function isNotificationTypeEnabled(
  preferences: NotificationPreferencesMap,
  type: string
): boolean {
  return preferences[type]?.enabled ?? true;
}

/**
 * Check if in quiet hours
 */
export function isInQuietHours(
  preferences: NotificationPreferencesMap,
  type: string
): boolean {
  const pref = preferences[type];
  if (!pref?.quietHoursStart || !pref?.quietHoursEnd) {
    return false;
  }

  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  const start = pref.quietHoursStart;
  const end = pref.quietHoursEnd;

  // Handle quiet hours that span midnight
  if (start > end) {
    return currentTime >= start || currentTime <= end;
  }

  return currentTime >= start && currentTime <= end;
}
