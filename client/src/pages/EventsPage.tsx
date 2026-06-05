import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { getUserFriendlyError, logError, handleAPIError } from "@/utils/errorHandler";
import { validateRequired, validateTextLength } from "@/utils/validation";
import { SkeletonEventCard } from "@/components/common/SkeletonLoader";
import { PageHeading } from "@/components/common/PageHeading";
import { BackButton } from "@/components/common/BackButton";
import { supabase } from "@/lib/supabase";

interface Event {
  id: string;
  title: string;
  description: string;
  event_date: string;
  event_time?: string;
  location: string;
  venue: string;
  is_virtual: boolean;
  virtual_link?: string;
  cover_image?: string;
  max_attendees?: number;
  registration_deadline?: string;
  organized_by: string;
  organizer?: {
    id: string;
    username: string;
    email: string;
  };
  tags?: string[];
  is_active?: boolean;
  rsvp_count?: number;
  user_rsvp?: {
    status: string;
    guests_count: number;
    notes?: string;
  };
}

export const EventsPage = (): JSX.Element => {
  const { user } = useAuth();
  const { toast } = useToast();

  // Set page title
  React.useEffect(() => {
    document.title = "Events - TKS Alumni Portal";
  }, []);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const [eventType, setEventType] = useState<string>("all"); // "all", "virtual", "in-person"
  const [registrationStatus, setRegistrationStatus] = useState<string>("all"); // "all", "open", "closed"
  const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);
  const [eventHeading, setEventHeading] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventVenue, setEventVenue] = useState("");
  const [isVirtual, setIsVirtual] = useState(false);
  const [virtualLink, setVirtualLink] = useState("");
  const [maxAttendees, setMaxAttendees] = useState("");
  const [selectedEventTags, setSelectedEventTags] = useState<string[]>([]);
  const [isPosting, setIsPosting] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [rsvpDialog, setRsvpDialog] = useState(false);
  const [selectedEventForRsvp, setSelectedEventForRsvp] = useState<Event | null>(null);
  const [rsvpGuestsCount, setRsvpGuestsCount] = useState(0);
  const [rsvpNotes, setRsvpNotes] = useState("");
  const [eventDetailsDialog, setEventDetailsDialog] = useState(false);
  const [selectedEventDetails, setSelectedEventDetails] = useState<Event | null>(null);
  const [availableLocations, setAvailableLocations] = useState<string[]>([]);
  const [dynamicTags, setDynamicTags] = useState<string[]>([]);
  const [isRsvping, setIsRsvping] = useState<string | null>(null);

  // Event documents/attachments uploaded by admin
  const [eventDocs, setEventDocs] = useState<{ name: string; displayName: string; url: string; size?: number }[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);

  // Handle hash navigation (scroll to specific event from search) and sessionStorage
  React.useEffect(() => {
    const hash = window.location.hash;
    const eventIdFromHash = hash?.startsWith('#event-') ? hash.replace('#event-', '') : null;
    const eventIdFromQuery = new URLSearchParams(window.location.search).get('eventId');
    const eventIdFromStorage = sessionStorage.getItem('scrollToEventId');
    const eventId = eventIdFromHash || eventIdFromQuery || eventIdFromStorage;

    if (eventId && !isLoading && events.length > 0) {
      const timeoutId = setTimeout(() => {
        const element = document.getElementById(`event-${eventId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('search-highlight');
          setTimeout(() => element.classList.remove('search-highlight'), 2000);
        }
        // Clear sessionStorage
        if (eventIdFromStorage) {
          sessionStorage.removeItem('scrollToEventId');
        }
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [isLoading, events.length]);

  // Base tag color definitions
  const tagColorMap: Record<string, string> = {
    "Reunion": "bg-yellow-100 text-yellow-800",
    "Meetup": "bg-purple-100 text-purple-800",
    "Social": "bg-pink-100 text-pink-800",
    "Fun": "bg-green-100 text-green-800",
    "Academic": "bg-cyan-100 text-cyan-800",
    "Professional": "bg-indigo-100 text-indigo-800",
    "Sports": "bg-orange-100 text-orange-800",
    "Networking": "bg-blue-100 text-blue-800",
    "Career": "bg-emerald-100 text-emerald-800",
    "Webinar": "bg-teal-100 text-teal-800",
    "Workshop": "bg-violet-100 text-violet-800",
    "Cultural": "bg-rose-100 text-rose-800"
  };

  // Combine static tag colors with dynamic tags from database
  const availableTags = dynamicTags.map(tag => ({
    name: tag,
    color: tagColorMap[tag] || "bg-gray-100 text-gray-800"
  }));

  const fetchFilterOptions = async () => {
    try {
      const response = await fetch('/api/events/filters');
      if (response.ok) {
        const data = await response.json();
        setAvailableLocations(data.locations || []);
        setDynamicTags(data.tags || []);
      }
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  };

  const getTagColor = (tag: string) => {
    const tagData = availableTags.find(t => t.name === tag);
    return tagData?.color || "bg-gray-100 text-gray-800";
  };

  const toggleEventTag = (tagName: string) => {
    setSelectedEventTags(prev =>
      prev.includes(tagName)
        ? prev.filter(t => t !== tagName)
        : [...prev, tagName]
    );
  };

  const fetchEvents = async () => {
    try {
      setIsLoading(true);
      const userId = user?.id || localStorage.getItem('userId');
      const params = new URLSearchParams();

      if (searchTerm && searchTerm.trim()) params.append('search', searchTerm.trim());
      if (selectedLocation && selectedLocation !== "all" && selectedLocation.trim()) params.append('location', selectedLocation.trim());

      // Tags filter (multiple tags)
      if (selectedTags.length > 0) {
        params.append('tags', selectedTags.join(','));
      }



      // Virtual/In-person filter
      if (eventType === "virtual") {
        params.append('isVirtual', 'true');
      } else if (eventType === "in-person") {
        params.append('isVirtual', 'false');
      }

      // Registration status filter
      if (registrationStatus === "open" || registrationStatus === "closed") {
        params.append('registrationStatus', registrationStatus);
      }

      const response = await fetch(`/api/events?${params.toString()}`, {
        headers: {
          'user-id': userId || ''
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }

      const data = await response.json();
      setEvents(data.events || []);
    } catch (error) {
      console.error('Error fetching events:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load events",
        variant: "destructive"
      });
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Track if this is the initial mount to prevent double fetch
  const isInitialMount = React.useRef(true);

  useEffect(() => {
    fetchEvents();
    fetchFilterOptions();
    isInitialMount.current = false;
  }, []);

  // Auto-search when filters change with debouncing
  useEffect(() => {
    // Skip the first render after initial mount to prevent double fetch
    if (isInitialMount.current) {
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      fetchEvents();
    }, 300); // 300ms debounce delay

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, selectedLocation, selectedTags, eventType, registrationStatus]);

  const handleCreateEvent = async () => {
    if (!user?.id) {
      toast({
        title: "Authentication Required",
        description: "You must be logged in to create an event",
        variant: "destructive",
      });
      return;
    }

    // Validate required fields
    const titleValidation = validateRequired(eventHeading, 'Event Title');
    if (!titleValidation.isValid) {
      toast({
        title: "Validation Error",
        description: titleValidation.error,
        variant: "destructive",
      });
      return;
    }

    const descriptionValidation = validateRequired(eventDescription, 'Event Description');
    if (!descriptionValidation.isValid) {
      toast({
        title: "Validation Error",
        description: descriptionValidation.error,
        variant: "destructive",
      });
      return;
    }

    const dateValidation = validateRequired(eventDate, 'Event Date');
    if (!dateValidation.isValid) {
      toast({
        title: "Validation Error",
        description: dateValidation.error,
        variant: "destructive",
      });
      return;
    }

    // Validate description length
    const descLengthValidation = validateTextLength(eventDescription, 'Event Description', 10, 5000);
    if (!descLengthValidation.isValid) {
      toast({
        title: "Validation Error",
        description: descLengthValidation.error,
        variant: "destructive",
      });
      return;
    }

    // Validate date is not in the past
    const eventDateObj = new Date(eventDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (eventDateObj < today) {
      toast({
        title: "Validation Error",
        description: "Event date cannot be in the past",
        variant: "destructive",
      });
      return;
    }

    setIsPosting(true);
    try {
      const userId = user?.id || localStorage.getItem('userId');

      const response = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-id': userId || ''
        },
        body: JSON.stringify({
          title: eventHeading.trim(),
          description: eventDescription.trim(),
          eventDate: eventDate,
          eventTime: eventTime || null,
          location: eventLocation.trim() || null,
          venue: eventVenue.trim() || null,
          imageUrl: null,
          tags: selectedEventTags,
          maxParticipants: maxAttendees ? parseInt(maxAttendees) : null
        })
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Success",
          description: "Event created successfully!",
        });

        // Reset form
        setEventHeading("");
        setEventDescription("");
        setEventDate("");
        setEventTime("");
        setEventLocation("");
        setEventVenue("");
        setIsVirtual(false);
        setVirtualLink("");
        setMaxAttendees("");
        setSelectedEventTags([]);
        setIsCreateEventOpen(false);

        // Refresh events list and filter options
        fetchEvents();
        fetchFilterOptions();
      } else {
        const errorInfo = await handleAPIError(response);
        logError(errorInfo, 'EventsPage.handleCreateEvent');
        toast({
          title: "Error",
          description: getUserFriendlyError(errorInfo),
          variant: "destructive"
        });
      }
    } catch (error) {
      logError(error, 'EventsPage.handleCreateEvent');
      toast({
        title: "Error",
        description: getUserFriendlyError(error),
        variant: "destructive"
      });
    } finally {
      setIsPosting(false);
    }
  };

  const applyFilters = async () => {
    try {
      setIsLoading(true);
      await fetchEvents();
    } catch (error) {
      console.error('Error applying filters:', error);
      toast({
        title: "Error",
        description: "Failed to apply filters. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearFilters = async () => {
    try {
      // Reset all filter states
      setSearchTerm("");
      setSelectedLocation("all");
      setSelectedTags([]);

      setEventType("all");
      setRegistrationStatus("all");
      setIsLoading(true);

      // Fetch all events without any filters
      const userId = user?.id || localStorage.getItem('userId');
      const response = await fetch('/api/events', {
        headers: {
          'user-id': userId || ''
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }

      const data = await response.json();
      setEvents(data.events || []);
    } catch (error) {
      console.error('Error clearing filters:', error);
      toast({
        title: "Error",
        description: "Failed to clear filters. Please try again.",
        variant: "destructive"
      });
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFilterTag = (tagName: string) => {
    setSelectedTags(prev =>
      prev.includes(tagName)
        ? prev.filter(t => t !== tagName)
        : [...prev, tagName]
    );
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    } catch (e) {
      return dateString;
    }
  };

  const formatTime = (timeString: string | null) => {
    if (!timeString) return 'Time TBA';
    return timeString;
  };

  const handleRsvpClick = (event: Event) => {
    if (!user?.id) {
      toast({
        title: "Login Required",
        description: "You need to be logged in to RSVP.",
        variant: "destructive",
      });
      return;
    }
    setSelectedEventForRsvp(event);
    setRsvpGuestsCount(event.user_rsvp?.guests_count || 1);
    setRsvpNotes(event.user_rsvp?.notes || "");
    setRsvpDialog(true);
  };

  const handleRsvpSubmit = async () => {
    if (!selectedEventForRsvp || !user?.id) return;

    try {
      const userId = localStorage.getItem('userId');
      const response = await fetch(`/api/events/${selectedEventForRsvp.id}/rsvp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-id': userId || ''
        },
        body: JSON.stringify({
          status: 'attending',
          guestsCount: rsvpGuestsCount,
          notes: rsvpNotes
        })
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "RSVP confirmed!",
        });
        setRsvpDialog(false);
        fetchEvents();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to RSVP",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error RSVPing:', error);
      toast({
        title: "Error",
        description: "Failed to RSVP",
        variant: "destructive",
      });
    }
  };

  const handleQuickRsvp = async (event: Event, status: 'attending' | 'maybe' | 'not_attending') => {
    if (!user?.id) {
      toast({
        title: "Login Required",
        description: "Please log in to RSVP.",
        variant: "destructive",
      });
      return;
    }

    // Determine if we are toggling off (same status clicked)
    const currentStatus = event.user_rsvp?.status;
    const isTogglingOff = currentStatus === status;
    const newStatus = isTogglingOff ? null : status; // Prepare for local state update

    // Optimistic Update
    const originalEvents = [...events];
    const originalSelectedEventDetails = selectedEventDetails;
    setEvents(prevEvents => prevEvents.map(e => {
      if (e.id === event.id) {
        return {
          ...e,
          user_rsvp: newStatus ? {
            status: newStatus,
            guests_count: e.user_rsvp?.guests_count || 1,
            notes: e.user_rsvp?.notes || ""
          } : undefined,
          // Adjust RSVP count roughly (imprecise but good enough for optimistic feedback)
          rsvp_count: isTogglingOff
            ? Math.max(0, (e.rsvp_count || 0) - (currentStatus === 'attending' ? (e.user_rsvp?.guests_count || 1) : 0))
            : (status === 'attending' && currentStatus !== 'attending')
              ? (e.rsvp_count || 0) + (e.user_rsvp?.guests_count || 1)
              : (e.rsvp_count || 0)
        };
      }
      return e;
    }));

    // Also update selectedEventDetails if this is the event being viewed
    if (selectedEventDetails && selectedEventDetails.id === event.id) {
      setSelectedEventDetails({
        ...selectedEventDetails,
        user_rsvp: newStatus ? {
          status: newStatus,
          guests_count: selectedEventDetails.user_rsvp?.guests_count || 1,
          notes: selectedEventDetails.user_rsvp?.notes || ""
        } : undefined,
        rsvp_count: isTogglingOff
          ? Math.max(0, (selectedEventDetails.rsvp_count || 0) - (currentStatus === 'attending' ? (selectedEventDetails.user_rsvp?.guests_count || 1) : 0))
          : (status === 'attending' && currentStatus !== 'attending')
            ? (selectedEventDetails.rsvp_count || 0) + (selectedEventDetails.user_rsvp?.guests_count || 1)
            : (selectedEventDetails.rsvp_count || 0)
      });
    }

    setIsRsvping(event.id);
    try {
      const userId = localStorage.getItem('userId');
      const response = await fetch(`/api/events/${event.id}/rsvp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-id': userId || ''
        },
        body: JSON.stringify({
          status,
          guestsCount: event.user_rsvp?.guests_count || 1,
          notes: event.user_rsvp?.notes || ""
        })
      });

      if (response.ok) {
        const data = await response.json();
        // data.status will be the actual status from backend (null if toggled off)

        toast({
          title: data.status ? "RSVP Updated" : "RSVP Removed",
          description: data.status
            ? `Your status has been updated to ${data.status === 'attending' ? 'Going' : data.status === 'maybe' ? 'Maybe' : 'Declined'}.`
            : "Your RSVP has been removed.",
        });

        // We can fetchEvents in background to sync exact counts, but it's optional if we trust our backend logic
        fetchEvents();
      } else {
        throw new Error("Failed to RSVP");
      }
    } catch (error) {
      console.error('Error RSVPing:', error);
      // Rollback
      setEvents(originalEvents);
      if (originalSelectedEventDetails) {
        setSelectedEventDetails(originalSelectedEventDetails);
      }

      const errorMsg = error instanceof Error ? error.message : "Failed to RSVP";
      // Try to parse JSON error if response exists but threw (logic handled in block above roughly, but robust handling is better)
      // Since we threw generic error, we just show toast.

      toast({
        title: "Error",
        description: "Failed to update RSVP. Changes reverted.",
        variant: "destructive",
      });
    } finally {
      setIsRsvping(null);
    }
  };

  const fetchEventDocs = async (eventId: string) => {
    try {
      setIsLoadingDocs(true);
      setEventDocs([]);
      const { data, error } = await supabase.storage
        .from('event_docs')
        .list(eventId, { sortBy: { column: 'created_at', order: 'desc' } });

      if (error || !data) {
        console.error('Error fetching event docs:', error);
        return;
      }

      // Build public URLs for each file — filter out placeholder/empty entries
      const docsWithUrls = data
        .filter((file) => file.name && file.name !== '.emptyFolderPlaceholder')
        .map((file) => {
          const { data: urlData } = supabase.storage
            .from('event_docs')
            .getPublicUrl(`${eventId}/${file.name}`);
          // Clean display name: strip leading timestamp prefix "1234567890_"
          const displayName = file.name.replace(/^\d+_/, '').replace(/_/g, ' ') || file.name;
          return {
            name: file.name,          // raw storage name (used as key + for URL)
            displayName,              // human-friendly label shown to user
            url: urlData?.publicUrl || '',
            size: (file.metadata as any)?.size,
          };
        })
        .filter((d) => d.url);

      setEventDocs(docsWithUrls);
    } catch (err) {
      console.error('Unexpected error fetching docs:', err);
    } finally {
      setIsLoadingDocs(false);
    }
  };

  const handleViewDetails = (event: Event) => {
    setSelectedEventDetails(event);
    setEventDocs([]);
    setEventDetailsDialog(true);
    fetchEventDocs(event.id);
  };

  /** Return a suitable emoji icon based on file extension */
  const getFileIcon = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (['pdf'].includes(ext)) return '📄';
    if (['doc', 'docx'].includes(ext)) return '📝';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return '📊';
    if (['ppt', 'pptx'].includes(ext)) return '📑';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return '🖼️';
    if (['mp4', 'mov', 'avi', 'mkv'].includes(ext)) return '🎬';
    if (['mp3', 'wav', 'ogg'].includes(ext)) return '🎵';
    if (['zip', 'rar', '7z'].includes(ext)) return '🗜️';
    return '📎';
  };

  /** Format file size in human-readable form */
  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  /**
   * Parse a UTC timestamp from the DB.
   * Supabase returns `timestamp without timezone` as "YYYY-MM-DDTHH:mm:ss" (no 'Z'),
   * which JS parses as local time instead of UTC. We force UTC by appending 'Z'.
   */
  const parseUTCDate = (dateStr: string): Date => {
    if (!dateStr) return new Date(NaN);
    // Already has timezone info — parse as-is
    if (dateStr.endsWith('Z') || dateStr.includes('+') || (dateStr.includes('-', 10))) {
      return new Date(dateStr);
    }
    // No timezone marker → treat as UTC (the server saves UTC to DB)
    return new Date(dateStr + 'Z');
  };

  const isRegistrationOpen = (event: Event) => {
    if (!event.registration_deadline) return true;
    const deadlineUTC = parseUTCDate(event.registration_deadline);
    if (isNaN(deadlineUTC.getTime())) return true;
    return deadlineUTC > new Date(); // both in UTC — accurate to the second
  };

  const getEventStatus = (event: Event) => {
    const eventDateUTC = parseUTCDate(event.event_date);
    const now = new Date();

    if (eventDateUTC < now) return { label: "Completed", color: "bg-gray-500" };
    if (!event.is_active) return { label: "Cancelled", color: "bg-red-500" };
    if (!isRegistrationOpen(event)) return { label: "Registration Closed", color: "bg-orange-500" };
    return { label: "Upcoming", color: "bg-green-500" };
  };

  return (
    <>
      <style>{`
        @keyframes highlightPulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(0, 128, 96, 0);
            background-color: transparent;
          }
          50% {
            box-shadow: 0 0 20px 5px rgba(0, 128, 96, 0.3);
            background-color: rgba(0, 128, 96, 0.05);
          }
        }
        
        .search-highlight {
          animation: highlightPulse 2s ease-in-out;
          border: 2px solid #008060 !important;
        }
      `}</style>

      <AppLayout currentPage="events">
        <div className="p-3 sm:p-4 lg:p-6 max-w-7xl mx-auto">
          {/* Page Heading */}
          <div className="mb-6 sm:mb-8">
            <PageHeading firstWord="Events" secondWord="Portal" />
          </div>
          {/* Back Button */}
          <div className="mb-4 sm:mb-6 lg:hidden">
            <BackButton />
          </div>
          {/* Post Event Section */}
          {user?.is_admin && (
            <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
              <p className="text-sm sm:text-base text-gray-700">Wish to alert your peers about an event ?</p>
              <Dialog open={isCreateEventOpen} onOpenChange={setIsCreateEventOpen}>
                <DialogTrigger asChild>
                  <Button variant="brand" className="w-full sm:w-auto px-4 sm:px-6 py-2 rounded flex items-center justify-center gap-2 min-h-[44px] text-sm sm:text-base">
                    Post an Event
                    <span role="img" aria-label="Upload">📤</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
                  <DialogHeader>
                    <DialogTitle>Create Event</DialogTitle>
                  </DialogHeader>

                  <div className="space-y-4">
                    {/* User Info */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-200 rounded-full flex items-center justify-center">
                        <span className="text-orange-800 font-medium">{user?.username?.charAt(0).toUpperCase()}</span>
                      </div>
                      <span className="font-medium truncate">{user?.username}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="ml-auto text-red-500 border-red-500 hover:bg-red-50"
                        onClick={() => setIsCreateEventOpen(false)}
                      >
                        Cancel ✗
                      </Button>
                    </div>

                    {/* Event Heading */}
                    <div>
                      <Input
                        placeholder="Event Heading *"
                        value={eventHeading}
                        onChange={(e) => setEventHeading(e.target.value)}
                        className="border-gray-300 min-h-[44px]"
                        required
                      />
                    </div>

                    {/* Event Description */}
                    <div>
                      <Textarea
                        placeholder="What's happening ? *"
                        value={eventDescription}
                        onChange={(e) => setEventDescription(e.target.value)}
                        className="min-h-[120px] border-gray-300 resize-none"
                        required
                      />
                    </div>

                    {/* Event Date & Time */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-1 block">Event Date *</label>
                        <Input
                          type="date"
                          value={eventDate}
                          onChange={(e) => setEventDate(e.target.value)}
                          className="border-gray-300 min-h-[44px]"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1 block">Event Time</label>
                        <Input
                          type="time"
                          value={eventTime}
                          onChange={(e) => setEventTime(e.target.value)}
                          className="border-gray-300 min-h-[44px]"
                        />
                      </div>
                    </div>

                    {/* Location and Venue */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-1 block">Location</label>
                        <Input
                          placeholder="Event location (e.g., Pune)"
                          value={eventLocation}
                          onChange={(e) => setEventLocation(e.target.value)}
                          className="border-gray-300 min-h-[44px]"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1 block">Venue</label>
                        <Input
                          placeholder="Event venue (e.g., Hotel Grand)"
                          value={eventVenue}
                          onChange={(e) => setEventVenue(e.target.value)}
                          className="border-gray-300 min-h-[44px]"
                        />
                      </div>
                    </div>

                    {/* Virtual Event */}
                    <div className="flex items-center gap-2 py-2">
                      <input
                        type="checkbox"
                        id="isVirtual"
                        checked={isVirtual}
                        onChange={(e) => setIsVirtual(e.target.checked)}
                        className="w-5 h-5"
                      />
                      <label htmlFor="isVirtual" className="text-sm font-medium">This is a virtual event</label>
                    </div>

                    {/* Virtual Link */}
                    {isVirtual && (
                      <div>
                        <label className="text-sm font-medium mb-1 block">Virtual Link</label>
                        <Input
                          placeholder="Virtual meeting link"
                          value={virtualLink}
                          onChange={(e) => setVirtualLink(e.target.value)}
                          className="border-gray-300 min-h-[44px]"
                        />
                      </div>
                    )}

                    {/* Max Attendees */}
                    <div>
                      <label className="text-sm font-medium mb-1 block">Max Attendees (optional)</label>
                      <Input
                        type="number"
                        placeholder="Maximum number of attendees"
                        value={maxAttendees}
                        onChange={(e) => setMaxAttendees(e.target.value)}
                        className="border-gray-300 min-h-[44px]"
                      />
                    </div>

                    {/* Add Tags Section */}
                    <div>
                      <p className="text-sm font-medium mb-3">Add Tags:</p>
                      <div className="flex flex-wrap gap-2">
                        {availableTags.map((tag) => (
                          <Badge
                            key={tag.name}
                            variant="outline"
                            className={`cursor-pointer transition-colors px-3 py-1 text-sm ${selectedEventTags.includes(tag.name)
                              ? tag.color
                              : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                              }`}
                            onClick={() => toggleEventTag(tag.name)}
                          >
                            {tag.name}
                            {selectedEventTags.includes(tag.name) && ' ✓'}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Post Button */}
                    <div className="flex justify-end pt-4">
                      <Button
                        variant="brand"
                        className="px-8 h-11 w-full sm:w-auto"
                        onClick={handleCreateEvent}
                        disabled={isPosting || !eventHeading.trim() || !eventDescription.trim() || !eventDate}
                      >
                        {isPosting ? "Posting..." : "Post Event"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}

          {/* Recent Events Header */}
          <div className="mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold mb-3 sm:mb-4">Recent Events</h2>

            {/* Search and Filters */}
            <div className="space-y-3 sm:space-y-4">
              {/* First Row: Search and Quick Filters */}
              <div className="flex flex-col lg:flex-row gap-3 sm:gap-4 w-full">
                <Input
                  placeholder="Search event by name"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      applyFilters();
                    }
                  }}
                  className="flex-1 min-h-[44px] text-sm sm:text-base w-full"
                  aria-label="Search events"
                />

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:flex gap-2 sm:gap-3 lg:gap-4 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide snap-x snap-mandatory w-full lg:w-auto">
                  <Select value={selectedLocation || "all"} onValueChange={(value) => setSelectedLocation(value === "all" ? "all" : value)}>
                    <SelectTrigger className="w-full lg:w-[140px] min-h-[44px] text-xs sm:text-sm">
                      <SelectValue placeholder="Location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Locations</SelectItem>
                      {availableLocations.map(location => (
                        <SelectItem key={location} value={location}>
                          {location}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={eventType} onValueChange={setEventType}>
                    <SelectTrigger className="w-full lg:w-[140px] min-h-[44px] text-xs sm:text-sm">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="virtual">Virtual</SelectItem>
                      <SelectItem value="in-person">In-Person</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={registrationStatus} onValueChange={setRegistrationStatus}>
                    <SelectTrigger className="w-full lg:w-[160px] min-h-[44px] text-xs sm:text-sm">
                      <SelectValue placeholder="Registration" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Events</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Mobile Filter Actions */}
                  <div className="col-span-2 sm:col-span-1 lg:hidden flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 text-[#008060] border-[#008060] min-h-[44px]"
                      onClick={handleClearFilters}
                    >
                      Clear
                    </Button>

                    <Button
                      className="flex-1 bg-gray-800 hover:bg-gray-700 text-white min-h-[44px]"
                      onClick={applyFilters}
                    >
                      Apply
                    </Button>
                  </div>
                </div>

                {/* Desktop Filter Actions */}
                <div className="hidden lg:flex gap-2">
                  <Button
                    variant="outline"
                    className="text-[#008060] border-[#008060] min-h-[44px]"
                    onClick={handleClearFilters}
                  >
                    Clear Filters
                  </Button>

                  <Button
                    className="bg-gray-800 hover:bg-gray-700 text-white min-h-[44px]"
                    onClick={applyFilters}
                  >
                    Apply Filter
                  </Button>
                </div>
              </div>



              {/* Third Row: Tags Filter */}
              {dynamicTags.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Filter by Tags:</label>
                  <div className="flex flex-wrap gap-2">
                    {dynamicTags.map((tag) => {
                      const tagColor = tagColorMap[tag] || "bg-gray-100 text-gray-800";
                      return (
                        <Badge
                          key={tag}
                          variant="outline"
                          className={`cursor-pointer transition-colors px-3 py-1 ${selectedTags.includes(tag)
                            ? tagColor
                            : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                            }`}
                          onClick={() => toggleFilterTag(tag)}
                        >
                          {tag}
                          {selectedTags.includes(tag) && ' ✓'}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Events List */}
          <div className="space-y-4">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <SkeletonEventCard key={i} />
                ))}
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#008060]"></div>
                  <p className="mt-2 text-gray-600">Loading events...</p>
                </div>
              </div>
            ) : events.length === 0 ? (
              <Card className="border-dashed border-2 border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100/50">
                <CardContent className="p-12 text-center">
                  <div className="max-w-md mx-auto space-y-6">
                    <div className="text-6xl mb-4">📅</div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-bold text-gray-900">No events found</h3>
                      <p className="text-gray-600">Check back later or adjust your filters</p>
                    </div>
                    <div className="pt-4">
                      <Button
                        onClick={handleClearFilters}
                        variant="outline"
                        className="px-6"
                      >
                        Clear Filters
                      </Button>
                    </div>
                    {user?.is_admin && (
                      <div className="pt-4 border-t border-gray-200">
                        <p className="text-sm text-gray-500 mb-3">
                          💡 <strong>Tip:</strong> Create an event to bring the community together
                        </p>
                        <Button
                          onClick={() => setIsCreateEventOpen(true)}
                          variant="brand"
                          size="sm"
                        >
                          Create Event
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              events.map((event) => {
                const status = getEventStatus(event);
                const registrationOpen = isRegistrationOpen(event);

                return (
                  <Card key={event.id} id={`event-${event.id}`} className="overflow-hidden hover:shadow-lg transition-shadow max-w-full">
                    <CardContent className="p-0">
                      <div className="flex flex-col md:flex-row">
                        {/* Event Image */}
                        <div className="md:w-48 lg:w-56 xl:w-64 h-48 md:h-auto flex-shrink-0 relative">
                          <img
                            src={event.cover_image || "/figmaAssets/rectangle-10.png"}
                            alt={event.title}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        {/* Event Details */}
                        <div className="flex-1 p-4 sm:p-6">
                          <div className="flex flex-col md:flex-row justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              {/* Status Badge */}
                              <div className="flex items-center gap-2 mb-2">
                                <Badge className={`${status.color} text-white`}>
                                  {status.label}
                                </Badge>
                                {event.is_virtual && (
                                  <Badge variant="outline" className="border-blue-500 text-blue-600">
                                    🌐 Virtual
                                  </Badge>
                                )}
                                {event.user_rsvp && (
                                  <Badge variant="outline" className={`
                                  ${event.user_rsvp.status === 'attending' ? 'border-green-500 text-green-600' :
                                      event.user_rsvp.status === 'maybe' ? 'border-blue-500 text-blue-600' :
                                        'border-gray-500 text-gray-600'}
                                `}>
                                    ✓ {event.user_rsvp.status === 'attending' ? "You're attending" :
                                      event.user_rsvp.status === 'maybe' ? "You might attend" :
                                        "You declined"}
                                  </Badge>
                                )}
                              </div>

                              <h3 className="text-lg font-semibold text-[#008060] mb-2">
                                {event.title}
                              </h3>

                              <div className="space-y-1 text-sm text-gray-600 mb-3">
                                <div className="flex items-center gap-2">
                                  📅 {formatDate(event.event_date)}
                                  {event.event_time && <span>| ⏰ {formatTime(event.event_time)}</span>}
                                </div>
                                {(event.venue || event.location) && (
                                  <div className="flex items-center gap-2">
                                    📍 {[event.venue, event.location].filter(Boolean).join(', ')}
                                  </div>
                                )}
                                {event.max_attendees && (
                                  <div className="flex items-center gap-2">
                                    👥 {event.rsvp_count || 0} / {event.max_attendees} attendees
                                  </div>
                                )}
                                {event.registration_deadline && (
                                  <div className="flex items-center gap-2">
                                    ⏳ Registration closes: {formatDate(event.registration_deadline)}
                                  </div>
                                )}
                              </div>

                              <p className="text-gray-700 text-sm mb-3 leading-relaxed line-clamp-2">
                                {event.description}
                              </p>

                              {/* Tags */}
                              {event.tags && event.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-3">
                                  {event.tags.map((tag, index) => (
                                    <span
                                      key={index}
                                      className={`px-2 py-1 text-xs rounded ${getTagColor(tag)}`}
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex md:flex-col gap-2 md:ml-4 min-w-[140px] sm:min-w-[160px]">
                              <Button
                                variant="brand"
                                className="px-4 sm:px-6 py-2 text-xs sm:text-sm flex-1 md:flex-none min-h-[44px]"
                                onClick={() => handleViewDetails(event)}
                                aria-label={`View details for ${event.title}`}
                              >
                                View Details
                              </Button>
                              {status.label === "Upcoming" && registrationOpen && (
                                <div className="flex flex-row md:flex-col gap-2 w-full md:mt-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleQuickRsvp(event, 'attending')}
                                    disabled={isRsvping === event.id}
                                    className={`flex-1 text-xs py-2 h-auto transition-all ${event.user_rsvp?.status === 'attending'
                                      ? 'bg-[#008060] text-white hover:bg-[#007055]'
                                      : 'bg-white text-[#008060] border border-[#008060] hover:bg-[#008060]/10'
                                      }`}
                                  >
                                    {isRsvping === event.id ? '...' : (event.user_rsvp?.status === 'attending' ? '✓ Going' : 'Going')}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleQuickRsvp(event, 'maybe')}
                                    disabled={isRsvping === event.id}
                                    className={`flex-1 text-xs py-2 h-auto transition-all ${event.user_rsvp?.status === 'maybe'
                                      ? 'bg-blue-500 text-white hover:bg-blue-600 border-blue-500'
                                      : 'bg-white text-blue-500 border border-blue-500 hover:bg-blue-50'
                                      }`}
                                  >
                                    {isRsvping === event.id ? '...' : (event.user_rsvp?.status === 'maybe' ? '✓ Maybe' : 'Maybe')}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleQuickRsvp(event, 'not_attending')}
                                    disabled={isRsvping === event.id}
                                    className={`flex-1 text-xs py-2 h-auto transition-all ${event.user_rsvp?.status === 'not_attending'
                                      ? 'bg-gray-500 text-white hover:bg-gray-600 border-gray-500'
                                      : 'bg-white text-gray-500 border border-gray-300 hover:bg-gray-50'
                                      }`}
                                  >
                                    {isRsvping === event.id ? '...' : (event.user_rsvp?.status === 'not_attending' ? '✓ No' : 'No')}
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>
        {/* RSVP Dialog */}
        <Dialog open={rsvpDialog} onOpenChange={setRsvpDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>RSVP for {selectedEventForRsvp?.title}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Number of Guests (including yourself)
                </label>
                <Input
                  type="number"
                  min="1"
                  max={selectedEventForRsvp?.max_attendees || 10}
                  value={rsvpGuestsCount || 1}
                  onChange={(e) => setRsvpGuestsCount(parseInt(e.target.value) || 1)}
                  className="border-gray-300"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {selectedEventForRsvp?.max_attendees &&
                    `Maximum ${selectedEventForRsvp.max_attendees} attendees allowed`
                  }
                </p>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Additional Notes (Optional)
                </label>
                <Textarea
                  placeholder="Any dietary restrictions, accessibility needs, or questions..."
                  value={rsvpNotes}
                  onChange={(e) => setRsvpNotes(e.target.value)}
                  className="min-h-[100px] border-gray-300"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRsvpDialog(false)}>
                Cancel
              </Button>
              <Button
                variant="brand"
                onClick={handleRsvpSubmit}
              >
                Confirm RSVP
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Event Details Dialog */}
        <Dialog open={eventDetailsDialog} onOpenChange={setEventDetailsDialog}>
          <DialogContent className="max-w-2xl w-[95vw] sm:w-full !block !gap-0 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl text-[#008060]">
                {selectedEventDetails?.title}
              </DialogTitle>
            </DialogHeader>

            {selectedEventDetails && (
              <div className="space-y-4 py-4">
                {selectedEventDetails.cover_image && (
                  <img
                    src={selectedEventDetails.cover_image}
                    alt={selectedEventDetails.title}
                    className="w-full h-64 object-cover rounded-lg"
                  />
                )}

                <div className="flex flex-wrap gap-2">
                  <Badge className={`${getEventStatus(selectedEventDetails).color} text-white`}>
                    {getEventStatus(selectedEventDetails).label}
                  </Badge>
                  {selectedEventDetails.is_virtual && (
                    <Badge variant="outline" className="border-blue-500 text-blue-600">
                      🌐 Virtual Event
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-700">Date & Time</p>
                    <p className="text-sm text-gray-600 break-words">
                      📅 {formatDate(selectedEventDetails.event_date)}
                      {selectedEventDetails.event_time && (
                        <> | ⏰ {formatTime(selectedEventDetails.event_time)}</>
                      )}
                    </p>
                  </div>

                  {(selectedEventDetails.venue || selectedEventDetails.location) && (
                    <div>
                      <p className="text-sm font-semibold text-gray-700">
                        {selectedEventDetails.venue ? "Venue" : "Location"}
                      </p>
                      <p className="text-sm text-gray-600 break-words">
                        📍 {[selectedEventDetails.venue, selectedEventDetails.location].filter(Boolean).join(', ')}
                      </p>
                    </div>
                  )}

                  {selectedEventDetails.is_virtual && selectedEventDetails.virtual_link && (
                    <div className="md:col-span-2">
                      <p className="text-sm font-semibold text-gray-700">Virtual Link</p>
                      <a
                        href={selectedEventDetails.virtual_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline break-all"
                      >
                        {selectedEventDetails.virtual_link}
                      </a>
                    </div>
                  )}

                  {selectedEventDetails.max_attendees && (
                    <div>
                      <p className="text-sm font-semibold text-gray-700">Capacity</p>
                      <p className="text-sm text-gray-600">
                        👥 {selectedEventDetails.rsvp_count || 0} / {selectedEventDetails.max_attendees} attendees
                      </p>
                    </div>
                  )}

                  {selectedEventDetails.registration_deadline && (
                    <div>
                      <p className="text-sm font-semibold text-gray-700">Registration Deadline</p>
                      <p className="text-sm text-gray-600">
                        ⏳ {formatDate(selectedEventDetails.registration_deadline)}
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">Description</p>
                  <p className="text-sm text-gray-600 leading-relaxed break-words whitespace-pre-line">
                    {selectedEventDetails.description}
                  </p>
                </div>

                {selectedEventDetails.tags && selectedEventDetails.tags.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-2">Categories</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedEventDetails.tags.map((tag, index) => (
                        <span
                          key={index}
                          className={`px-3 py-1 text-sm rounded ${getTagColor(tag)}`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Event Documents / Attachments uploaded by admin */}
                <div className="border-t pt-4">
                  <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    📎 Event Documents
                  </p>
                  {isLoadingDocs ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                      <div className="w-4 h-4 border-2 border-[#008060] border-t-transparent rounded-full animate-spin" />
                      Loading documents...
                    </div>
                  ) : eventDocs.length === 0 ? (
                    <p className="text-sm text-gray-400 italic py-1">No attachments uploaded for this event.</p>
                  ) : (
                    <ul className="space-y-2">
                      {eventDocs.map((doc) => (
                        <li key={doc.name} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200 hover:bg-[#008060]/5 hover:border-[#008060]/30 transition-all group">
                          <span className="text-2xl flex-shrink-0">{getFileIcon(doc.name)}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">
                              {doc.displayName}
                            </p>
                            {doc.size && (
                              <p className="text-xs text-gray-500">{formatFileSize(doc.size)}</p>
                            )}
                          </div>
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-white bg-[#008060] hover:bg-[#006b51] px-3 py-1.5 rounded-lg transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Open ↗
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {getEventStatus(selectedEventDetails).label === "Upcoming" &&
                  isRegistrationOpen(selectedEventDetails) && (
                    <div className="pt-4 border-t">
                      <p className="text-sm font-semibold text-gray-700 mb-3">Your RSVP Status</p>
                      <div className="grid grid-cols-3 gap-3">
                        <Button
                          size="sm"
                          onClick={() => handleQuickRsvp(selectedEventDetails, 'attending')}
                          disabled={isRsvping === selectedEventDetails.id}
                          className={`flex-1 text-sm py-3 h-auto transition-all ${selectedEventDetails.user_rsvp?.status === 'attending'
                            ? 'bg-[#008060] text-white hover:bg-[#007055]'
                            : 'bg-white text-[#008060] border border-[#008060] hover:bg-[#008060]/10'
                            }`}
                        >
                          {isRsvping === selectedEventDetails.id ? '...' : (selectedEventDetails.user_rsvp?.status === 'attending' ? '✓ Going' : 'Going')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleQuickRsvp(selectedEventDetails, 'maybe')}
                          disabled={isRsvping === selectedEventDetails.id}
                          className={`flex-1 text-sm py-3 h-auto transition-all ${selectedEventDetails.user_rsvp?.status === 'maybe'
                            ? 'bg-blue-500 text-white hover:bg-blue-600 border-blue-500'
                            : 'bg-white text-blue-500 border border-blue-500 hover:bg-blue-50'
                            }`}
                        >
                          {isRsvping === selectedEventDetails.id ? '...' : (selectedEventDetails.user_rsvp?.status === 'maybe' ? '✓ Maybe' : 'Maybe')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleQuickRsvp(selectedEventDetails, 'not_attending')}
                          disabled={isRsvping === selectedEventDetails.id}
                          className={`flex-1 text-sm py-3 h-auto transition-all ${selectedEventDetails.user_rsvp?.status === 'not_attending'
                            ? 'bg-gray-500 text-white hover:bg-gray-600 border-gray-500'
                            : 'bg-white text-gray-500 border border-gray-300 hover:bg-gray-50'
                            }`}
                        >
                          {isRsvping === selectedEventDetails.id ? '...' : (selectedEventDetails.user_rsvp?.status === 'not_attending' ? '✓ No' : 'No')}
                        </Button>
                      </div>
                    </div>
                  )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </AppLayout>
    </>
  );
};
