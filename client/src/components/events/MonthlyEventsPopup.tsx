import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, Video, CalendarDays } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MonthlyEvent {
  id: string;
  title: string;
  event_date: string;
  event_time?: string | null;
  location?: string | null;
  is_virtual?: boolean;
}

interface MonthlyPopupResponse {
  show: boolean;
  events: MonthlyEvent[];
  rsvps: { event_id: string; status: string }[];
}

export function MonthlyEventsPopup() {
  const { user, isAlumni } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [rsvpStatusByEvent, setRsvpStatusByEvent] = useState<Record<string, string>>({});
  const [registeringId, setRegisteringId] = useState<string | null>(null);

  const userId = user?.id || localStorage.getItem('userId');

  const { data } = useQuery<MonthlyPopupResponse>({
    queryKey: ['/api/events/monthly-popup', userId],
    queryFn: async () => {
      const res = await fetch('/api/events/monthly-popup', {
        headers: { 'user-id': userId || '' },
      });
      if (!res.ok) throw new Error('Failed to fetch monthly events');
      return res.json();
    },
    enabled: !!isAlumni && !!user && !!userId,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  });

  useEffect(() => {
    if (data?.show && data.events?.length > 0) {
      setRsvpStatusByEvent(
        Object.fromEntries((data.rsvps || []).map((r) => [r.event_id, r.status])),
      );
      setOpen(true);
    }
  }, [data]);

  if (!isAlumni || !user || !data?.show || !data.events?.length) {
    return null;
  }

  const handleRegister = async (eventId: string) => {
    setRegisteringId(eventId);
    const currentStatus = rsvpStatusByEvent[eventId];
    try {
      const response = await fetch(`/api/events/${eventId}/rsvp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-id': userId || '',
        },
        body: JSON.stringify({ status: 'attending', guestsCount: 1 }),
      });
      if (!response.ok) throw new Error('Failed to RSVP');
      const result = await response.json();
      setRsvpStatusByEvent((prev) => ({
        ...prev,
        [eventId]: result.status ? 'attending' : '',
      }));
      toast({
        title: currentStatus === 'attending' ? 'RSVP Removed' : 'Registered!',
        description:
          currentStatus === 'attending'
            ? 'Your RSVP has been removed.'
            : "You're registered for this event.",
      });
    } catch (error) {
      console.error('Error RSVPing from monthly popup:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update RSVP.',
      });
    } finally {
      setRegisteringId(null);
    }
  };

  const handleViewAll = () => {
    setOpen(false);
    setLocation('/events');
  };

  const formatEventDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });

  const monthLabel = new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg z-[260]" overlayClassName="z-[255]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <CalendarDays className="h-5 w-5 text-[#008060]" />
            Events in {monthLabel}
          </DialogTitle>
          <DialogDescription>
            Here's what's happening this month. Register below to save your spot.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[420px] overflow-y-auto space-y-3 py-2">
          {data.events.map((event) => {
            const status = rsvpStatusByEvent[event.id];
            const isRegistered = status === 'attending';
            return (
              <div
                key={event.id}
                className="flex items-start justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{event.title}</p>
                  <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-[#008060]" />
                    <span>{formatEventDate(event.event_date)}</span>
                  </div>
                  {event.is_virtual ? (
                    <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                      <Video className="h-3.5 w-3.5 shrink-0 text-[#008060]" />
                      <span>Virtual event</span>
                    </div>
                  ) : event.location ? (
                    <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-[#008060]" />
                      <span className="truncate">{event.location}</span>
                    </div>
                  ) : null}
                </div>
                <Button
                  size="sm"
                  variant={isRegistered ? 'outline' : 'default'}
                  disabled={registeringId === event.id}
                  onClick={() => handleRegister(event.id)}
                  className={isRegistered ? '' : 'bg-[#008060] hover:bg-[#006b51]'}
                >
                  {isRegistered ? 'Registered' : 'Register'}
                </Button>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
          <Button onClick={handleViewAll} className="bg-[#008060] hover:bg-[#006b51]">
            View All Events
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
