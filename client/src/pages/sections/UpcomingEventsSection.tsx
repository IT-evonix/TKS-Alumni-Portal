import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { Calendar, MapPin, Clock, Users, Tag, ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Event {
  id: string;
  title: string;
  description: string;
  event_date: string;
  event_time?: string;
  location: string;
  venue?: string;
  cover_image?: string;
  registration_deadline?: string;
  max_attendees?: number;
  rsvp_count?: number;
  tags?: string[];
  is_virtual?: boolean;
  is_active: boolean;
  user_rsvp?: {
    status: string;
    guests_count?: number;
  };
}

function parseUTCDate(dateStr: string): Date {
  if (!dateStr) return new Date(NaN);
  if (dateStr.endsWith("Z") || dateStr.includes("+") || dateStr.includes("-", 10)) {
    return new Date(dateStr);
  }
  return new Date(dateStr + "Z");
}

function formatDateIST(dateStr: string): string {
  const date = parseUTCDate(dateStr);
  return date.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatShortDateIST(dateStr: string): string {
  const date = parseUTCDate(dateStr);
  return date.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getDayIST(dateStr: string): number {
  const date = parseUTCDate(dateStr);
  return parseInt(
    date.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric" }),
    10
  );
}

function getMonthIST(dateStr: string): string {
  const date = parseUTCDate(dateStr);
  return date.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    month: "short",
  });
}

function formatEventTime(timeString: string): string {
  const [hours, minutes] = timeString.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm} IST`;
}

function isRegistrationOpen(event: Event): boolean {
  if (!event.registration_deadline) return true;
  const deadlineUTC = parseUTCDate(event.registration_deadline);
  if (isNaN(deadlineUTC.getTime())) return true;
  return deadlineUTC > new Date();
}

function getEventStatus(event: Event): { label: string; color: string } {
  const now = new Date();
  const eventDateUTC = parseUTCDate(event.event_date);

  if (isNaN(eventDateUTC.getTime())) {
    return { label: "Unknown", color: "bg-gray-400" };
  }

  if (eventDateUTC < now) {
    return { label: "Past", color: "bg-gray-500" };
  }

  const open = isRegistrationOpen(event);
  if (!open) {
    return { label: "Registration Closed", color: "bg-amber-500" };
  }

  return { label: "Upcoming", color: "bg-emerald-500" };
}

export const UpcomingEventsSection = (): JSX.Element => {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const [eventDocs, setEventDocs] = useState<{ name: string; displayName: string; url: string; size?: number }[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);

  const fetchEventDocs = async (eventId: string) => {
    try {
      setIsLoadingDocs(true);
      setEventDocs([]);
      const { data, error } = await supabase.storage
        .from('event_docs')
        .list(eventId, { sortBy: { column: 'created_at', order: 'desc' } });

      if (error || !data) return;

      const docsWithUrls = data
        .filter((file) => file.name && file.name !== '.emptyFolderPlaceholder')
        .map((file) => {
          const { data: urlData } = supabase.storage
            .from('event_docs')
            .getPublicUrl(`${eventId}/${file.name}`);
          const displayName = file.name.replace(/^\d+_/, '').replace(/_/g, ' ') || file.name;
          return {
            name: file.name,
            displayName,
            url: urlData?.publicUrl || '',
            size: (file.metadata as any)?.size
          };
        })
        .filter((d) => d.url);

      setEventDocs(docsWithUrls);
    } catch (err) {
      console.error('Error fetching event docs:', err);
    } finally {
      setIsLoadingDocs(false);
    }
  };

  const openEventModal = (event: Event) => {
    setSelectedEvent(event);
    setEventDocs([]);
    fetchEventDocs(event.id);
  };

  const getFileIcon = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (ext === 'pdf') return '📄';
    if (['doc', 'docx'].includes(ext)) return '📝';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return '📊';
    if (['ppt', 'pptx'].includes(ext)) return '📑';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return '🖼️';
    if (['mp4', 'mov', 'avi'].includes(ext)) return '🎬';
    if (['zip', 'rar'].includes(ext)) return '🗜️';
    return '📎';
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const userId = user?.id || localStorage.getItem("userId");
        const headers: HeadersInit = {};
        if (userId) {
          headers["user-id"] = userId;
        }

        const response = await fetch("/api/events?sort=upcoming&limit=3", {
          headers,
        });
        if (response.ok) {
          const data = await response.json();
          setEvents(data.events || []);
        }
      } catch (error) {
        console.error("Failed to fetch events:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvents();
  }, [user?.id]);

  const handleRegisterClick = (eventId: string) => {
    if (user) {
      setLocation(`/events#event-${eventId}`);
    } else {
      sessionStorage.setItem("redirectAfterLogin", `/events#event-${eventId}`);
      setLocation("/login");
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {[1, 2].map((i) => (
          <div key={i} className="h-56 bg-gray-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-700">No upcoming events scheduled</h3>
        <p className="text-gray-500 mt-2 text-sm">Check back soon for alumni meetups and reunions!</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-6 max-w-4xl mx-auto">
        {events.map((event) => {
          const isOpen = isRegistrationOpen(event);
          const status = getEventStatus(event);

          return (
            <Card
              key={event.id}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden group"
            >
              <CardContent className="p-0">
                <div className="flex flex-col md:flex-row h-full">
                  {/* Event Image */}
                  <div className="md:w-2/5 relative overflow-hidden h-48 md:h-auto min-h-[200px]">
                    <div className="absolute inset-0 bg-gray-100 animate-pulse" />
                    <img
                      src={event.cover_image || "/figmaAssets/rectangle-10.png"}
                      alt={event.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 relative z-10"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/landing-assets/event-placeholder.jpg";
                      }}
                    />
                    {/* Date Badge */}
                    <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-sm z-20">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block text-center">
                        {getMonthIST(event.event_date)}
                      </span>
                      <div className="text-xl font-bold text-gray-900 leading-none text-center">
                        {getDayIST(event.event_date)}
                      </div>
                    </div>
                    {/* Status Badge */}
                    <div className="absolute top-4 right-4 z-20">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full text-white ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                  </div>

                  {/* Event Content */}
                  <div className="md:w-3/5 p-6 md:p-8 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start gap-4">
                        <h3 className="font-semibold text-gray-900 text-lg md:text-xl leading-tight line-clamp-2">
                          {event.title}
                        </h3>
                        {event.is_virtual && (
                          <span className="px-2 py-1 bg-blue-50 text-blue-600 text-xs font-medium rounded-md whitespace-nowrap">
                            Virtual
                          </span>
                        )}
                      </div>

                      <p className="text-gray-600 text-sm leading-relaxed line-clamp-2">
                        {event.description}
                      </p>

                      <div className="space-y-1.5 text-sm text-gray-500 pt-1">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                          <span>{formatShortDateIST(event.event_date)}</span>
                          {event.event_time && (
                            <>
                              <span className="text-gray-300">|</span>
                              <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                              <span>{formatEventTime(event.event_time)}</span>
                            </>
                          )}
                        </div>
                        {(event.venue || event.location) && (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                            <span className="truncate">
                              {[event.venue, event.location].filter(Boolean).join(", ")}
                            </span>
                          </div>
                        )}
                        {event.max_attendees && (
                          <div className="flex items-center gap-1.5 text-gray-400">
                            <Users className="w-4 h-4 shrink-0" />
                            <span>{event.rsvp_count || 0} / {event.max_attendees} attendees</span>
                          </div>
                        )}
                        {event.registration_deadline && (
                          <div className="flex items-center gap-1.5 text-xs">
                            <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <span className={isOpen ? "text-gray-400" : "text-red-500 font-medium"}>
                              Registration {isOpen ? "closes" : "closed"}:{" "}
                              {formatShortDateIST(event.registration_deadline)}
                              {(() => {
                                const d = parseUTCDate(event.registration_deadline);
                                const timeStr = d.toLocaleTimeString("en-IN", {
                                  timeZone: "Asia/Kolkata",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  hour12: true,
                                });
                                return ` at ${timeStr} IST`;
                              })()}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Tags */}
                      {event.tags && event.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {event.tags.slice(0, 3).map((tag, index) => (
                            <span
                              key={index}
                              className="px-2 py-0.5 text-xs rounded-md bg-gray-100 text-gray-600"
                            >
                              {tag}
                            </span>
                          ))}
                          {event.tags.length > 3 && (
                            <span className="px-2 py-0.5 text-xs text-gray-400">
                              +{event.tags.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-5 pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-center gap-2.5">
                      <Button
                        onClick={() => openEventModal(event)}
                        className="w-full sm:w-auto h-10 rounded-lg font-medium text-sm px-5 bg-gray-900 hover:bg-gray-800 text-white transition-all duration-300 flex items-center gap-2"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        View Details
                      </Button>
                      <Button
                        onClick={() => handleRegisterClick(event.id)}
                        disabled={!isOpen}
                        className={`w-full sm:w-auto h-10 rounded-lg font-medium text-sm px-5 transition-all duration-300 ${
                          isOpen
                            ? "bg-emerald-600 text-white hover:bg-emerald-700"
                            : "bg-gray-100 text-gray-400 cursor-not-allowed"
                        }`}
                      >
                        {isOpen
                          ? user ? "Register Now" : "Login to Register"
                          : "Registration Closed"}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Event Detail Modal */}
      <Dialog
        open={!!selectedEvent}
        onOpenChange={(open) => !open && setSelectedEvent(null)}
      >
        <DialogContent className="max-w-2xl w-[95vw] sm:w-full !block !gap-0 !p-0 overflow-hidden rounded-2xl border border-gray-200 shadow-2xl">
          {selectedEvent &&
            (() => {
              const status = getEventStatus(selectedEvent);
              const isOpen = isRegistrationOpen(selectedEvent);
              const deadlineUTC = selectedEvent.registration_deadline
                ? parseUTCDate(selectedEvent.registration_deadline)
                : null;

              return (
                <>
                  {/* Modal Header Image */}
                  <div className="relative w-full h-52 sm:h-60 overflow-hidden bg-gray-100">
                    <img
                      src={selectedEvent.cover_image || "/figmaAssets/rectangle-10.png"}
                      alt={selectedEvent.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/landing-assets/event-placeholder.jpg";
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
                    <div className="absolute top-4 left-4 flex gap-2">
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full text-white ${status.color}`}>
                        {status.label}
                      </span>
                      {selectedEvent.is_virtual && (
                        <span className="px-3 py-1 bg-blue-500 text-white text-xs font-semibold rounded-full">
                          Virtual
                        </span>
                      )}
                    </div>
                    <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm px-3 py-2 rounded-lg shadow-md">
                      <div className="text-gray-900 font-bold text-lg leading-none">
                        {getDayIST(selectedEvent.event_date)}
                      </div>
                      <div className="text-gray-500 text-xs font-semibold uppercase tracking-wide">
                        {getMonthIST(selectedEvent.event_date)}{" "}
                        {parseUTCDate(selectedEvent.event_date).toLocaleDateString(
                          "en-IN",
                          { timeZone: "Asia/Kolkata", year: "numeric" }
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Modal Body */}
                  <div className="p-6 sm:p-8 space-y-5 max-h-[60vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight pr-6">
                        {selectedEvent.title}
                      </DialogTitle>
                    </DialogHeader>

                    <DialogDescription asChild>
                      <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
                        {selectedEvent.description}
                      </p>
                    </DialogDescription>

                    {/* Event Details Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="w-9 h-9 rounded-lg bg-gray-200 flex items-center justify-center shrink-0">
                          <Calendar className="w-5 h-5 text-gray-600" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Date & Time</p>
                          <p className="text-sm font-semibold text-gray-800">{formatDateIST(selectedEvent.event_date)}</p>
                          {selectedEvent.event_time && (
                            <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                              <Clock className="w-3.5 h-3.5" />
                              {formatEventTime(selectedEvent.event_time)}
                            </p>
                          )}
                        </div>
                      </div>

                      {(selectedEvent.venue || selectedEvent.location) && (
                        <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                          <div className="w-9 h-9 rounded-lg bg-gray-200 flex items-center justify-center shrink-0">
                            <MapPin className="w-5 h-5 text-gray-600" />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                              {selectedEvent.is_virtual ? "Platform" : "Location"}
                            </p>
                            {selectedEvent.venue && (
                              <p className="text-sm font-semibold text-gray-800">{selectedEvent.venue}</p>
                            )}
                            {selectedEvent.location && (
                              <p className="text-sm text-gray-500">{selectedEvent.location}</p>
                            )}
                          </div>
                        </div>
                      )}

                      {selectedEvent.max_attendees && (
                        <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                          <div className="w-9 h-9 rounded-lg bg-gray-200 flex items-center justify-center shrink-0">
                            <Users className="w-5 h-5 text-gray-600" />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Attendees</p>
                            <p className="text-sm font-semibold text-gray-800">
                              {selectedEvent.rsvp_count || 0} / {selectedEvent.max_attendees} registered
                            </p>
                            <div className="mt-1.5 h-1.5 bg-gray-200 rounded-full overflow-hidden w-32">
                              <div
                                className="h-full bg-gray-900 rounded-full transition-all"
                                style={{
                                  width: `${Math.min(
                                    ((selectedEvent.rsvp_count || 0) / selectedEvent.max_attendees) * 100,
                                    100
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {selectedEvent.registration_deadline && deadlineUTC && (
                        <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                          <div className="w-9 h-9 rounded-lg bg-gray-200 flex items-center justify-center shrink-0">
                            <Clock className="w-5 h-5 text-gray-600" />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Registration Deadline</p>
                            <p className="text-sm font-semibold text-gray-800">
                              {formatShortDateIST(selectedEvent.registration_deadline)}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {deadlineUTC.toLocaleTimeString("en-IN", {
                                timeZone: "Asia/Kolkata",
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: true,
                              })}{" "}
                              IST
                            </p>
                            <p className={`text-xs mt-1 font-medium ${isOpen ? "text-emerald-600" : "text-red-500"}`}>
                              {isOpen ? "Registration open" : "Registration closed"}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Tags */}
                    {selectedEvent.tags && selectedEvent.tags.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Tag className="w-4 h-4 text-gray-400" />
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Tags</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {selectedEvent.tags.map((tag, index) => (
                            <span
                              key={index}
                              className="px-3 py-1 text-xs rounded-full bg-gray-100 text-gray-700 border border-gray-200 font-medium"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Event Documents */}
                    <div className="border-t border-gray-100 pt-4">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
                        Attachments
                      </p>
                      {isLoadingDocs ? (
                        <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                          <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                          Loading documents...
                        </div>
                      ) : eventDocs.length === 0 ? (
                        <p className="text-sm text-gray-400">No attachments for this event.</p>
                      ) : (
                        <ul className="space-y-2">
                          {eventDocs.map((doc) => (
                            <li key={doc.name} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-all">
                              <span className="text-lg flex-shrink-0">{getFileIcon(doc.name)}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-800 truncate">{doc.displayName}</p>
                                {doc.size && (
                                  <p className="text-xs text-gray-400">{formatFileSize(doc.size)}</p>
                                )}
                              </div>
                              <a
                                href={doc.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 px-3 py-1.5 rounded-md transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Open
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-gray-100">
                      <Button
                        onClick={() => {
                          setSelectedEvent(null);
                          handleRegisterClick(selectedEvent.id);
                        }}
                        disabled={!isOpen}
                        className={`flex-1 h-11 rounded-lg font-semibold text-sm transition-all duration-300 ${
                          isOpen
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                            : "bg-gray-100 text-gray-400 cursor-not-allowed"
                        }`}
                      >
                        {isOpen
                          ? user ? "Register for this Event" : "Login to Register"
                          : "Registration Closed"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setSelectedEvent(null)}
                        className="flex-1 sm:flex-none h-11 rounded-lg border-gray-200 text-gray-600 hover:bg-gray-50 font-medium text-sm"
                      >
                        Close
                      </Button>
                    </div>
                  </div>
                </>
              );
            })()}
        </DialogContent>
      </Dialog>
    </>
  );
};
