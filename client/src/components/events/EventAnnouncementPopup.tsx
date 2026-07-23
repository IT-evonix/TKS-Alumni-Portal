import React, { useMemo, useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, Video, PartyPopper } from 'lucide-react';

interface EventNotificationMetadata {
  eventDate?: string;
  eventTime?: string;
  location?: string;
  isVirtual?: boolean;
  coverImage?: string;
}

export function EventAnnouncementPopup() {
  const { user, isAlumni } = useAuth();
  const { notifications, markAsRead } = useNotifications();
  const [, setLocation] = useLocation();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const eventNotifications = useMemo(() => {
    return (notifications as any[])
      .filter((n) => n.type === 'new_event' && !n.isRead && !dismissedIds.has(n.id))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [notifications, dismissedIds]);

  const current = eventNotifications[0];

  const metadata: EventNotificationMetadata = useMemo(() => {
    if (!current?.metadata) return {};
    try {
      return JSON.parse(current.metadata);
    } catch {
      return {};
    }
  }, [current]);

  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(!!current);
  }, [current?.id]);

  if (!isAlumni || !user || !current) {
    return null;
  }

  const handleDismiss = () => {
    setOpen(false);
    markAsRead(current.id);
    setDismissedIds((prev) => new Set(prev).add(current.id));
  };

  const handleView = () => {
    const eventId = current.relatedId || current.related_id;
    setOpen(false);
    markAsRead(current.id);
    setDismissedIds((prev) => new Set(prev).add(current.id));
    setLocation(eventId ? `/events?eventId=${eventId}` : '/events');
  };

  const formattedDate = metadata.eventDate
    ? new Date(metadata.eventDate).toLocaleString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleDismiss(); }}>
      <DialogContent className="max-w-md overflow-hidden p-0">
        {metadata.coverImage ? (
          <div className="h-40 w-full overflow-hidden">
            <img
              src={metadata.coverImage}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="h-24 w-full bg-gradient-to-r from-[#008060] to-[#006b51] flex items-center justify-center">
            <PartyPopper className="h-10 w-10 text-white/90" />
          </div>
        )}

        <div className="p-6 pt-4">
          <DialogHeader>
            <DialogTitle className="text-xl">New Event Announced</DialogTitle>
            <DialogDescription className="text-base font-medium text-foreground">
              {current.title?.replace(/^New Event:\s*/, '') || current.content}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-2 text-sm text-muted-foreground">
            {formattedDate && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 shrink-0 text-[#008060]" />
                <span>{formattedDate}</span>
              </div>
            )}
            {metadata.isVirtual ? (
              <div className="flex items-center gap-2">
                <Video className="h-4 w-4 shrink-0 text-[#008060]" />
                <span>Virtual event</span>
              </div>
            ) : metadata.location ? (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0 text-[#008060]" />
                <span>{metadata.location}</span>
              </div>
            ) : null}
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={handleDismiss}>
              Dismiss
            </Button>
            <Button onClick={handleView} className="bg-[#008060] hover:bg-[#006b51]">
              View Event
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
