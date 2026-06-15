/**
 * Notification utility functions
 */

export interface NotificationActor {
  firstName: string;
  lastName: string;
  profilePicture: string | null;
  gender: string | null;
  fullName: string;
}

export interface EnhancedNotification {
  id: string;
  type: string;
  title: string;
  content: string;
  related_id: string | null;
  redirect_url?: string | null;
  actor_id?: string | null;
  actor?: NotificationActor | null;
  metadata?: string | null;
  is_read: boolean;
  read_at?: string | null;
  is_archived?: boolean;
  archived_at?: string | null;
  created_at: string;
}

export interface BundledNotification {
  id: string;
  type: string;
  title: string;
  content: string;
  actors: NotificationActor[];
  actorCount: number;
  related_id: string | null;
  redirect_url?: string | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
  notifications: EnhancedNotification[];
}

/**
 * Get default avatar URL based on name and gender
 */
export function getDefaultAvatar(name: string, gender?: string | null): string {
  const seed = encodeURIComponent(name);

  switch (gender) {
    case 'male':
      return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=008060`;
    case 'female':
      return `https://api.dicebear.com/7.x/avataaars-neutral/svg?seed=${seed}&backgroundColor=ff69b4`;
    case 'other':
      return `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}&backgroundColor=ffa500`;
    default:
      return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=008060`;
  }
}

/**
 * Get avatar URL for a notification actor
 */
export function getActorAvatar(actor: NotificationActor | null | undefined): string {
  if (!actor) {
    return getDefaultAvatar('User');
  }

  if (actor.profilePicture && actor.profilePicture.trim() !== '') {
    // Check if it's a base64 image or URL
    if (actor.profilePicture.startsWith('data:image') || actor.profilePicture.startsWith('http')) {
      return actor.profilePicture;
    }
    // If it's stored without the data:image prefix, add it
    if (actor.profilePicture.includes('base64,')) {
      return `data:image/jpeg;${actor.profilePicture}`;
    }
  }

  return getDefaultAvatar(actor.fullName || `${actor.firstName} ${actor.lastName}`.trim() || 'User', actor.gender);
}

/**
 * Bundle similar notifications together
 */
export function bundleNotifications(notifications: EnhancedNotification[]): (EnhancedNotification | BundledNotification)[] {
  const bundled: (EnhancedNotification | BundledNotification)[] = [];
  const processed = new Set<string>();

  // Group notifications by type and related_id
  const groups = new Map<string, EnhancedNotification[]>();

  notifications.forEach(notification => {
    // Don't bundle connection requests, messages, signup approvals, or gamification notifications
    if (['connection_request', 'message', 'signup_approved', 'post_approved', 'post_rejected', 'post_deleted', 'signup_request', 'gamification_point', 'badge_earned', 'badge_lost'].includes(notification.type)) {
      bundled.push(notification);
      return;
    }

    // Create a key for bundling (type + related_id)
    const key = `${notification.type}:${notification.related_id || 'none'}`;

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(notification);
  });

  // Process groups
  groups.forEach((groupNotifications, key) => {
    if (groupNotifications.length === 1) {
      // Single notification, don't bundle
      bundled.push(groupNotifications[0]);
    } else {
      // Multiple notifications, bundle them
      const firstNotification = groupNotifications[0];
      const actors = groupNotifications
        .map(n => n.actor)
        .filter((actor): actor is NotificationActor => actor !== null && actor !== undefined);

      // Remove duplicates based on actor fullName
      const uniqueActorsMap = new Map<string, NotificationActor>();
      actors.forEach(actor => {
        const key = actor.fullName || `${actor.firstName} ${actor.lastName}`.trim() || 'Unknown';
        if (!uniqueActorsMap.has(key)) {
          uniqueActorsMap.set(key, actor);
        }
      });
      const uniqueActors = Array.from(uniqueActorsMap.values());

      const bundledNotification: BundledNotification = {
        id: firstNotification.id,
        type: firstNotification.type,
        title: getBundledTitle(firstNotification.type, uniqueActors.length),
        content: getBundledContent(firstNotification.type, uniqueActors, groupNotifications.length),
        actors: uniqueActors,
        actorCount: uniqueActors.length,
        related_id: firstNotification.related_id,
        redirect_url: firstNotification.redirect_url,
        is_read: groupNotifications.every(n => n.is_read),
        read_at: groupNotifications.find(n => n.read_at)?.read_at || null,
        created_at: groupNotifications[0].created_at, // Use most recent
        notifications: groupNotifications
      };

      bundled.push(bundledNotification);
    }
  });

  // Sort by created_at (most recent first)
  return bundled.sort((a, b) => {
    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();
    return dateB - dateA;
  });
}

/**
 * Get bundled title based on notification type and count
 */
function getBundledTitle(type: string, actorCount: number): string {
  switch (type) {
    case 'post_like':
      return actorCount === 1 ? 'Post Liked' : `${actorCount} people liked your post`;
    case 'post_comment':
      return actorCount === 1 ? 'New Comment' : `${actorCount} people commented on your post`;
    case 'comment_reply':
      return actorCount === 1 ? 'Reply to Comment' : `${actorCount} people replied to your comment`;
    default:
      return 'New Activity';
  }
}

/**
 * Get bundled content based on notification type and actors
 */
function getBundledContent(
  type: string,
  actors: NotificationActor[],
  totalCount: number
): string {
  if (actors.length === 0) {
    return 'Multiple people interacted with your content';
  }

  if (actors.length === 1) {
    return `${actors[0].fullName} ${getActionText(type)}`;
  }

  if (actors.length === 2) {
    return `${actors[0].fullName} and ${actors[1].fullName} ${getActionText(type, true)}`;
  }

  const remaining = totalCount - 2;
  return `${actors[0].fullName}, ${actors[1].fullName}, and ${remaining} other${remaining > 1 ? 's' : ''} ${getActionText(type, true)}`;
}

/**
 * Get action text for notification type
 */
function getActionText(type: string, plural: boolean = false): string {
  switch (type) {
    case 'post_like':
      return plural ? 'liked your post' : 'liked your post';
    case 'post_comment':
      return plural ? 'commented on your post' : 'commented on your post';
    case 'comment_reply':
      return plural ? 'replied to your comment' : 'replied to your comment';
    default:
      return 'interacted with your content';
  }
}

/**
 * Filter notifications by date range
 */
export function filterByDate(
  notifications: EnhancedNotification[],
  filter: 'all' | 'unread' | 'today' | 'this_week'
): EnhancedNotification[] {
  const now = new Date();
  let startDate: Date | null = null;

  switch (filter) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'this_week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'unread':
      return notifications.filter(n => !n.is_read);
    case 'all':
    default:
      return notifications;
  }

  if (startDate) {
    return notifications.filter(n => new Date(n.created_at) >= startDate!);
  }

  return notifications;
}

/**
 * Group notifications by type
 */
export function groupByType(notifications: EnhancedNotification[]): Record<string, EnhancedNotification[]> {
  return notifications.reduce((groups, notification) => {
    const type = notification.type;
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(notification);
    return groups;
  }, {} as Record<string, EnhancedNotification[]>);
}

/**
 * Get notification type label
 */
export function getNotificationTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    'message': 'Messages',
    'connection_request': 'Connections',
    'connection_response': 'Connections',
    'post_like': 'Post Interactions',
    'post_comment': 'Post Interactions',
    'comment_reply': 'Post Interactions',
    'event_rsvp': 'Events',
    'event_reminder_24h': 'Events',
    'event_reminder_1h': 'Events',
    'job': 'Job Alerts',
    'signup_approved': 'Account',
    'signup_request': 'Admin Alerts',
    'post_pending_approval': 'Admin Alerts',
    'post_approved': 'Posts',
    'post_rejected': 'Posts',
    'post_deleted': 'Posts',
    'badge_earned': 'Gamification',
    'badge_lost': 'Gamification',
    'gamification_point': 'Gamification',
  };

  return labels[type] || 'Other';
}

/**
 * Get notification type color
 */
export function getNotificationTypeColor(type: string): string {
  const colors: Record<string, string> = {
    'message': 'bg-blue-100 text-blue-700 border-blue-200',
    'connection_request': 'bg-green-100 text-green-700 border-green-200',
    'connection_response': 'bg-green-100 text-green-700 border-green-200',
    'post_like': 'bg-red-100 text-red-700 border-red-200',
    'post_comment': 'bg-purple-100 text-purple-700 border-purple-200',
    'comment_reply': 'bg-purple-100 text-purple-700 border-purple-200',
    'event_rsvp': 'bg-orange-100 text-orange-700 border-orange-200',
    'event_reminder_24h': 'bg-orange-100 text-orange-700 border-orange-200',
    'event_reminder_1h': 'bg-orange-100 text-orange-700 border-orange-200',
    'job': 'bg-indigo-100 text-indigo-700 border-indigo-200',
    'signup_approved': 'bg-green-100 text-green-700 border-green-200',
    'signup_request': 'bg-amber-100 text-amber-800 border-amber-200',
    'post_pending_approval': 'bg-amber-100 text-amber-800 border-amber-200',
    'post_approved': 'bg-green-100 text-green-700 border-green-200',
    'post_rejected': 'bg-red-100 text-red-700 border-red-200',
    'post_deleted': 'bg-red-100 text-red-700 border-red-200',
    'badge_earned': 'bg-amber-100 text-amber-700 border-amber-200',
    'badge_lost': 'bg-red-100 text-red-700 border-red-200',
    'gamification_point': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  };

  return colors[type] || 'bg-gray-100 text-gray-700 border-gray-200';
}

/**
 * Get notification icon name (for use with lucide-react)
 * Components should import icons and use this to determine which icon to render
 */
export function getNotificationIconName(type: string): string {
  const iconMap: Record<string, string> = {
    'message': 'MessageSquare',
    'connection_request': 'UserPlus',
    'connection_response': 'UserPlus',
    'post_like': 'ThumbsUp',
    'post_comment': 'MessageCircle',
    'comment_reply': 'MessageCircle',
    'event_rsvp': 'Calendar',
    'event_reminder_24h': 'Calendar',
    'event_reminder_1h': 'Calendar',
    'job': 'Briefcase',
    'signup_approved': 'CheckCircle',
    'signup_request': 'UserPlus',
    'post_pending_approval': 'FileText',
    'post_approved': 'CheckCircle',
    'post_rejected': 'X',
    'post_deleted': 'Trash2',
    'badge_earned': 'Trophy',
    'badge_lost': 'AlertTriangle',
    'gamification_point': 'Star',
  };
  return iconMap[type] || 'Bell';
}
