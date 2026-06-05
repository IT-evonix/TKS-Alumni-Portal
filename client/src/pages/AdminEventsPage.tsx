import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { createClient } from '@supabase/supabase-js';
import {
  ArrowLeft,
  Users,
  Download,
  MoreHorizontal,
  Calendar,
  MapPin,
  Search,
  Plus,
  Filter,
  FileText,
  Trash2,
  Edit,
  Upload,
  ExternalLink,
  Clock,
  Map,
  Video,
  MonitorPlay,
  Bell,
  LogOut,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { formatDateTimeIST, formatTimeIST, utcToLocalDatetimeLocal } from "@/lib/dateUtils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NotificationDropdown } from "@/components/layout/NotificationDropdown";
import { useNotifications } from "@/contexts/NotificationContext";

interface Event {
  id: string;
  title: string;
  description: string;
  event_date: string;
  location: string;
  is_virtual: boolean;
  virtual_link: string | null;
  max_attendees: number | null;
  registration_deadline: string | null;
  cover_image: string | null;
  organized_by: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const AdminEventsPage = (): JSX.Element => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, adminUser, logoutAdmin } = useAuth();
  const { unreadCount } = useNotifications();
  const [showNotifications, setShowNotifications] = useState(false);

  // Helper function to get profile picture with default fallback
  const getProfilePicture = (alumni: any) => {
    if (alumni?.profile_picture && alumni.profile_picture.trim() !== '') {
      return alumni.profile_picture;
    }

    const firstName = alumni?.first_name || '';
    const lastName = alumni?.last_name || '';
    const displayName = `${firstName} ${lastName}`.trim() || 'User';
    const seed = encodeURIComponent(displayName);
    const gender = alumni?.gender || 'default';

    switch (gender) {
      case 'male':
        return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=008060`;
      case 'female':
        return `https://api.dicebear.com/7.x/avataaars-neutral/svg?seed=${seed}&backgroundColor=ff69b4`;
      case 'other':
        return `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}&backgroundColor=ffa500`;
      case 'prefer_not_to_say':
        return `https://api.dicebear.com/7.x/initials/svg?seed=${seed}&backgroundColor=6c63ff`;
      default:
        return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=008060`;
    }
  };
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Filter states
  const [selectedLocation, setSelectedLocation] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [eventType, setEventType] = useState<string>("all"); // "all", "virtual", "in-person"
  const [registrationStatus, setRegistrationStatus] = useState<string>("all"); // "all", "open", "closed"
  const [activeStatus, setActiveStatus] = useState<string>("all"); // "all", "active", "inactive"

  // Dynamic filter options
  const [filterOptions, setFilterOptions] = useState({
    locations: [] as string[],
    tags: [] as string[],
  });
  const [createDialog, setCreateDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filesDialog, setFilesDialog] = useState(false);
  const [eventFiles, setEventFiles] = useState<string[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [deleteFileDialog, setDeleteFileDialog] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);

  // Attendees state
  const [viewAttendeesDialog, setViewAttendeesDialog] = useState(false);
  const [eventAttendees, setEventAttendees] = useState<any[]>([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);
  const [attendeeStats, setAttendeeStats] = useState({ attending: 0, maybe: 0, not_attending: 0 });

  // Initialize Supabase client
  const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL || '',
    import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  );

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    event_date: "",
    location: "",
    is_virtual: false,
    virtual_link: "",
    max_attendees: "",
    registration_deadline: "",
    cover_image: "",
    is_active: true
  });

  // Fetch events
  useEffect(() => {
    fetchEvents();
    fetchFilterOptions();
  }, []);

  // Fetch filter options from database
  const fetchFilterOptions = async () => {
    try {
      const response = await fetch('/api/events/filters?includeInactive=true', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setFilterOptions({
          locations: data.locations || [],
          tags: data.tags || [],
        });
      }
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  };

  // Automatic logout on tab close for admins (not on refresh)
  useEffect(() => {
    const handleUnload = () => {
      sessionStorage.setItem('adminRefresh', Date.now().toString());
    };

    window.addEventListener('unload', handleUnload);

    return () => {
      window.removeEventListener('unload', handleUnload);
    };
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const userId = adminUser?.id || user?.id || localStorage.getItem('userId');

      const params = new URLSearchParams();

      // Always include inactive for admin view
      params.append('includeInactive', 'true');

      // Active status filter
      if (activeStatus === 'active') {
        params.append('includeInactive', 'false');
      } else if (activeStatus === 'inactive') {
        // We'll filter this client-side or modify backend to support it
      }

      if (searchTerm && searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }

      if (selectedLocation && selectedLocation.trim()) {
        params.append('location', selectedLocation.trim());
      }

      // Tags filter (multiple tags)
      if (selectedTags.length > 0) {
        params.append('tags', selectedTags.join(','));
      }

      // Date range filters
      if (dateFrom && dateFrom.trim()) {
        params.append('dateFrom', dateFrom.trim());
      }
      if (dateTo && dateTo.trim()) {
        params.append('dateTo', dateTo.trim());
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

      if (response.ok) {
        const data = await response.json();
        let eventsList = data.events || [];

        // Client-side filter for inactive status if needed
        if (activeStatus === 'inactive') {
          eventsList = eventsList.filter((e: Event) => !e.is_active);
        } else if (activeStatus === 'active') {
          eventsList = eventsList.filter((e: Event) => e.is_active);
        }

        setEvents(eventsList);
      } else {
        throw new Error('Failed to fetch events');
      }
    } catch (error) {
      console.error('Error fetching events:', error);
      toast({
        title: "Error",
        description: "Failed to load events",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Auto-search when filters change with debouncing
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchEvents();
    }, 300); // 300ms debounce delay

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, selectedLocation, selectedTags, dateFrom, dateTo, eventType, registrationStatus, activeStatus]);

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm("");
    setSelectedLocation("");
    setSelectedTags([]);
    setDateFrom("");
    setDateTo("");
    setEventType("all");
    setRegistrationStatus("all");
    setActiveStatus("all");
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      event_date: "",
      location: "",
      is_virtual: false,
      virtual_link: "",
      max_attendees: "",
      registration_deadline: "",
      cover_image: "",
      is_active: true
    });
    // Clear any pending cover image upload
    delete (window as any).__pendingEventCover;
  };

  // Open create dialog
  const handleCreateClick = () => {
    resetForm();
    setCreateDialog(true);
  };

  // Open edit dialog
  const handleEditClick = async (event: Event) => {
    setSelectedEvent(event);

    // Fetch current cover image from storage if it exists
    let currentCoverImage = "";

    if (event.id) {
      try {
        // List files in the event's directory
        const { data: files, error } = await supabase.storage
          .from('event_covers')
          .list(event.id);

        if (!error && files && files.length > 0) {
          // Find the cover image file (should be named cover.{ext})
          const coverFile = files.find(file => file.name.startsWith('cover.'));

          if (coverFile) {
            const filePath = `${event.id}/${coverFile.name}`;
            const { data: publicUrlData } = supabase.storage
              .from('event_covers')
              .getPublicUrl(filePath);

            if (publicUrlData?.publicUrl) {
              currentCoverImage = publicUrlData.publicUrl + '?t=' + Date.now(); // Add timestamp to bypass cache
            }
          }
        }
      } catch (error) {
        console.error('Error fetching cover image:', error);
      }
    }

    setFormData({
      title: event.title || "",
      description: event.description || "",
      event_date: utcToLocalDatetimeLocal(event.event_date),
      location: event.location || "",
      is_virtual: event.is_virtual || false,
      virtual_link: event.virtual_link || "",
      max_attendees: event.max_attendees?.toString() || "",
      registration_deadline: utcToLocalDatetimeLocal(event.registration_deadline),
      cover_image: currentCoverImage,
      is_active: event.is_active
    });
    setEditDialog(true);
  };

  // Open delete dialog
  const handleDeleteClick = (event: Event) => {
    setSelectedEvent(event);
    setDeleteDialog(true);
  };

  // Custom validation function
  const validateEventData = (eventDate: string, registrationDeadline: string, maxAttendees: string) => {
    // Validate registration deadline is before event date
    if (registrationDeadline && eventDate && new Date(registrationDeadline) >= new Date(eventDate)) {
      toast({
        title: "Validation Error",
        description: "Registration deadline must be before the event date",
        variant: "destructive"
      });
      return false;
    }

    // Validate max attendees
    const attendees = maxAttendees ? parseInt(maxAttendees) : null;
    if (maxAttendees !== "" && (isNaN(attendees as number) || attendees! <= 0)) {
      toast({
        title: "Validation Error",
        description: "Max attendees must be a positive number greater than 0",
        variant: "destructive"
      });
      return false;
    }
    return true;
  };

  // Create event
  const handleCreate = async () => {
    if (!formData.title || !formData.event_date) {
      toast({
        title: "Validation Error",
        description: "Title and Event Date are required",
        variant: "destructive"
      });
      return;
    }

    // Additional validation for virtual events
    if (formData.is_virtual && !formData.virtual_link) {
      toast({
        title: "Validation Error",
        description: "Virtual link is required for virtual events",
        variant: "destructive"
      });
      return;
    }

    // Validate event data before submission
    if (!validateEventData(formData.event_date, formData.registration_deadline, formData.max_attendees)) {
      return;
    }

    setIsSubmitting(true);
    try {
      const userId = adminUser?.id || user?.id || localStorage.getItem('userId');

      // Extract date and time from datetime-local input
      // The datetime-local input value is in format: "YYYY-MM-DDTHH:mm"
      const eventDateTime = new Date(formData.event_date);
      const eventTime = formData.event_date.split('T')[1]; // Extract time portion (HH:mm)

      // First create the event without cover image
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-id': userId || ''
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          eventDate: formData.event_date, // Send as-is, backend will handle parsing
          eventTime: eventTime, // Send extracted time
          location: formData.location || null,
          isVirtual: formData.is_virtual,
          virtualLink: formData.virtual_link || null,
          maxAttendees: formData.max_attendees ? parseInt(formData.max_attendees) : null,
          registrationDeadline: formData.registration_deadline || null,
          coverImage: null,
          isActive: formData.is_active
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create event: ${errorText}`);
      }

      const { event } = await response.json();
      const eventId = event.id;

      // Upload cover image if one is pending, using the event ID as directory
      const pendingCoverFile = (window as any).__pendingEventCover as File;

      if (pendingCoverFile) {
        const fileExt = pendingCoverFile.name.split('.').pop()?.toLowerCase() || '';
        const filePath = `${eventId}/cover.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('event_covers')
          .upload(filePath, pendingCoverFile, {
            cacheControl: '3600',
            upsert: true,
          });

        if (uploadError) {
          console.error('Failed to upload cover image:', uploadError);
          toast({
            title: "Warning",
            description: "Event created but cover image upload failed",
            variant: "destructive"
          });
        } else {
          const { data: publicUrlData } = supabase.storage
            .from('event_covers')
            .getPublicUrl(uploadData.path);

          // Update event with cover image URL
          await fetch(`/api/events/${eventId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'user-id': userId || '',
              'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
            },
            body: JSON.stringify({
              ...event,
              coverImage: publicUrlData.publicUrl
            })
          });
        }

        delete (window as any).__pendingEventCover; // Clear pending upload
      }

      toast({
        title: "Success",
        description: "Event created successfully",
      });

      setCreateDialog(false);
      resetForm();
      fetchEvents();
    } catch (error) {
      console.error('Error creating event:', error);
      toast({
        title: "Error",
        description: (error as Error).message || "Failed to create event",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update event
  const handleUpdate = async () => {
    if (!selectedEvent) return;

    if (!formData.title || !formData.event_date) {
      toast({
        title: "Validation Error",
        description: "Title and Event Date are required",
        variant: "destructive"
      });
      return;
    }

    // Additional validation for virtual events
    if (formData.is_virtual && !formData.virtual_link) {
      toast({
        title: "Validation Error",
        description: "Virtual link is required for virtual events",
        variant: "destructive"
      });
      return;
    }

    // Validate event data before submission
    if (!validateEventData(formData.event_date, formData.registration_deadline, formData.max_attendees)) {
      return;
    }

    setIsSubmitting(true);
    try {
      const userId = adminUser?.id || user?.id || localStorage.getItem('userId');

      // Handle cover image update/deletion
      let uploadedCoverImageUrl: string | null = formData.cover_image;
      const pendingCoverFile = (window as any).__pendingEventCover as File;

      if (pendingCoverFile) {
        // Delete existing cover image if it exists
        if (selectedEvent.cover_image) {
          const existingImagePath = selectedEvent.cover_image.split('/storage/v1/object/public/event_covers/')[1];
          if (existingImagePath) {
            const { error: deleteError } = await supabase.storage
              .from('event_covers')
              .remove([existingImagePath]);
            if (deleteError) {
              console.warn(`Could not delete existing cover image: ${deleteError.message}`);
            }
          }
        }

        // Upload new cover image
        const fileExt = pendingCoverFile.name.split('.').pop()?.toLowerCase() || '';
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('event_covers')
          .upload(`${selectedEvent.id}/cover.${fileExt}`, pendingCoverFile, {
            cacheControl: '3600',
            upsert: true,
          });

        if (uploadError) {
          throw new Error(`Failed to upload cover image: ${uploadError.message}`);
        }

        const { data: publicUrlData } = supabase.storage
          .from('event_covers')
          .getPublicUrl(uploadData.path);

        uploadedCoverImageUrl = publicUrlData.publicUrl || formData.cover_image;
        delete (window as any).__pendingEventCover; // Clear pending upload
      } else if (!formData.cover_image && selectedEvent.cover_image) {
        // Image was deleted but no new one uploaded
        const existingImagePath = selectedEvent.cover_image.split('/storage/v1/object/public/event_covers/')[1];
        if (existingImagePath) {
          const { error: deleteError } = await supabase.storage
            .from('event_covers')
            .remove([existingImagePath]);
          if (deleteError) {
            console.warn(`Could not delete existing cover image: ${deleteError.message}`);
          }
        }
        uploadedCoverImageUrl = null as string | null;
      }


      const response = await fetch(`/api/events/${selectedEvent.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'user-id': userId || ''
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          eventDate: formData.event_date, // Send as-is, backend will handle parsing
          eventTime: formData.event_date.split('T')[1], // Extract time portion (HH:mm)
          location: formData.location || null,
          isVirtual: formData.is_virtual,
          virtualLink: formData.virtual_link || null,
          maxAttendees: formData.max_attendees ? parseInt(formData.max_attendees) : null,
          registrationDeadline: formData.registration_deadline || null,
          coverImage: uploadedCoverImageUrl || null,
          isActive: formData.is_active
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update event: ${errorText}`);
      }

      toast({
        title: "Success",
        description: "Event updated successfully",
      });

      setEditDialog(false);
      setSelectedEvent(null);
      resetForm();
      fetchEvents();
    } catch (error) {
      console.error('Error updating event:', error);
      toast({
        title: "Error",
        description: (error as Error).message || "Failed to update event",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete event
  const handleDelete = async () => {
    if (!selectedEvent) return;

    setIsSubmitting(true);
    try {
      const userId = adminUser?.id || user?.id || localStorage.getItem('userId');

      const response = await fetch(`/api/events/${selectedEvent.id}`, {
        method: 'DELETE',
        headers: {
          'user-id': userId || ''
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete event: ${errorText}`);
      }

      // Optionally delete the cover image from Supabase storage
      if (selectedEvent.cover_image) {
        const existingImagePath = selectedEvent.cover_image.split('/').pop(); // Extract filename
        if (existingImagePath) {
          const { error: deleteError } = await supabase.storage
            .from('event_covers')
            .remove([`${selectedEvent.id}/${existingImagePath}`]); // Assuming path is eventId/filename
          if (deleteError) {
            console.warn(`Could not delete cover image for event ${selectedEvent.id}: ${deleteError.message}`);
          }
        }
      }

      toast({
        title: "Success",
        description: "Event deleted successfully",
      });

      setDeleteDialog(false);
      setSelectedEvent(null);
      fetchEvents();
    } catch (error) {
      console.error('Error deleting event:', error);
      toast({
        title: "Error",
        description: (error as Error).message || "Failed to delete event",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format date for display (IST)
  const formatDate = (dateString: string) => {
    try {
      return formatDateTimeIST(dateString).split(',')[0]; // Get date part only
    } catch {
      return dateString;
    }
  };

  // Format date and time for display (IST)
  const formatDateTime = (dateString: string) => {
    try {
      return formatDateTimeIST(dateString);
    } catch {
      return dateString;
    }
  };

  // Handle file upload for event documents
  const handleFileUpload = async (eventId: string, file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${file.name}`;
      const filePath = `${eventId}/${fileName}`;

      const { error } = await supabase.storage
        .from('event_docs')
        .upload(filePath, file);

      if (error) {
        console.error('Upload error:', error);
        toast({
          title: "Upload Failed",
          description: error.message || "Failed to upload file",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Success",
        description: "File uploaded successfully"
      });

      // Refresh file list if dialog is open for this event
      if (selectedEvent?.id === eventId) {
        fetchEventFiles(eventId);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Error",
        description: "Failed to upload file",
        variant: "destructive"
      });
    }
  };

  // Fetch files for an event
  const fetchEventFiles = async (eventId: string) => {
    try {
      setLoadingFiles(true);
      const { data, error } = await supabase.storage
        .from('event_docs')
        .list(eventId, {
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (error) {
        console.error('Fetch files error:', error);
        toast({
          title: "Error",
          description: "Failed to load files",
          variant: "destructive"
        });
        return;
      }

      setEventFiles(data?.map(file => file.name) || []);
    } catch (error) {
      console.error('Fetch files error:', error);
      toast({
        title: "Error",
        description: "Failed to load files",
        variant: "destructive"
      });
    } finally {
      setLoadingFiles(false);
    }
  };

  // Open files dialog
  const handleViewFiles = async (event: Event) => {
    setSelectedEvent(event);
    setFilesDialog(true);
    await fetchEventFiles(event.id);
  };

  // Delete file
  const handleDeleteFile = async () => {
    if (!selectedEvent || !fileToDelete) return;

    try {
      const filePath = `${selectedEvent.id}/${fileToDelete}`;
      const { error } = await supabase.storage
        .from('event_docs')
        .remove([filePath]);

      if (error) {
        console.error('Delete file error:', error);
        toast({
          title: "Error",
          description: "Failed to delete file",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Success",
        description: "File deleted successfully"
      });

      setDeleteFileDialog(false);
      setFileToDelete(null);
      await fetchEventFiles(selectedEvent.id);
    } catch (error) {
      console.error('Delete file error:', error);
      toast({
        title: "Error",
        description: "Failed to delete file",
        variant: "destructive"
      });
    }
  };

  // Download/View file
  const handleViewFile = async (fileName: string) => {
    if (!selectedEvent) return;

    try {
      const filePath = `${selectedEvent.id}/${fileName}`;
      const { data } = supabase.storage
        .from('event_docs')
        .getPublicUrl(filePath);

      if (data?.publicUrl) {
        window.open(data.publicUrl, '_blank');
      }
    } catch (error) {
      console.error('View file error:', error);
      toast({
        title: "Error",
        description: "Failed to open file",
        variant: "destructive"
      });
    }
  };

  // View Attendees
  const handleViewAttendees = async (event: Event) => {
    setSelectedEvent(event);
    setViewAttendeesDialog(true);
    setLoadingAttendees(true);

    try {
      const userId = adminUser?.id || user?.id || localStorage.getItem('userId');
      const response = await fetch(`/api/events/${event.id}/rsvps`, {
        headers: {
          'user-id': userId || ''
        }
      });

      if (response.ok) {
        const data = await response.json();
        const rsvps = data.rsvps || [];
        setEventAttendees(rsvps);

        // Calculate stats
        const stats = rsvps.reduce((acc: any, rsvp: any) => {
          acc[rsvp.status] = (acc[rsvp.status] || 0) + (rsvp.guests_count || 1);
          return acc;
        }, { attending: 0, maybe: 0, not_attending: 0 });
        setAttendeeStats(stats);
      } else {
        throw new Error('Failed to fetch attendees');
      }
    } catch (error) {
      console.error('Error fetching attendees:', error);
      toast({
        title: "Error",
        description: "Failed to load attendees list",
        variant: "destructive"
      });
    } finally {
      setLoadingAttendees(false);
    }
  };

  // Download Attendees Report
  const handleDownloadAttendees = (format: 'csv' | 'excel' | 'pdf') => {
    if (!selectedEvent || eventAttendees.length === 0) {
      toast({
        title: "No Data",
        description: "There are no attendees to download.",
        variant: "destructive"
      });
      return;
    }

    // Prepare data for export
    const exportData = eventAttendees.map(rsvp => ({
      Name: rsvp.alumni ? `${rsvp.alumni.first_name} ${rsvp.alumni.last_name}` : (rsvp.user?.username || 'Unknown'),
      Email: rsvp.user?.email || rsvp.alumni?.email || '-',
      Batch: rsvp.alumni?.batch || 'N/A',
      Status: rsvp.status.charAt(0).toUpperCase() + rsvp.status.slice(1),
      Guests: rsvp.guests_count || 1,
      Date: new Date(rsvp.created_at).toLocaleDateString(),
      Notes: rsvp.notes || ''
    }));

    const timestamp = new Date().toISOString().split('T')[0];
    const fileName = `${selectedEvent.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_attendees_${timestamp}`;

    try {
      if (format === 'csv') {
        const ws = XLSX.utils.json_to_sheet(exportData);
        const csv = XLSX.utils.sheet_to_csv(ws);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        if (link.download !== undefined) {
          const url = URL.createObjectURL(blob);
          link.setAttribute("href", url);
          link.setAttribute("download", `${fileName}.csv`);
          link.style.visibility = 'hidden';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      } else if (format === 'excel') {
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Attendees");
        XLSX.writeFile(wb, `${fileName}.xlsx`);
      } else if (format === 'pdf') {
        const doc = new jsPDF();

        // Add Title
        doc.setFontSize(18);
        doc.text(`Event Attendees: ${selectedEvent.title}`, 14, 22);

        doc.setFontSize(11);
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 30);
        doc.text(`Total: Going (${attendeeStats.attending}) | Maybe (${attendeeStats.maybe}) | No (${attendeeStats.not_attending})`, 14, 36);

        let startY = 44;

        // Separate attendees by status
        const goingAttendees = eventAttendees.filter(rsvp => rsvp.status === 'attending');
        const maybeAttendees = eventAttendees.filter(rsvp => rsvp.status === 'maybe');
        const noAttendees = eventAttendees.filter(rsvp => rsvp.status === 'not_attending');

        // Helper function to prepare table data with S.No.
        const prepareTableData = (attendees: any[], startNumber: number = 1) => {
          return attendees.map((rsvp, index) => {
            const name = rsvp.alumni
              ? `${rsvp.alumni.first_name} ${rsvp.alumni.last_name}`
              : (rsvp.user?.username || 'Unknown');
            return [
              (startNumber + index).toString(), // S.No.
              name,
              rsvp.user?.email || rsvp.alumni?.email || '-',
              rsvp.alumni?.batch || 'N/A',
              rsvp.guests_count || 1,
              new Date(rsvp.created_at).toLocaleDateString(),
              rsvp.notes || ''
            ];
          });
        };

        // Going Section
        if (goingAttendees.length > 0) {
          doc.setFontSize(14);
          doc.setTextColor(0, 128, 96); // Brand green
          doc.text('Going:', 14, startY);
          doc.setTextColor(0, 0, 0); // Reset to black

          autoTable(doc, {
            startY: startY + 6,
            head: [['S.No.', 'Name', 'Email', 'Batch', 'Guests', 'Date', 'Notes']],
            body: prepareTableData(goingAttendees),
            headStyles: { fillColor: [0, 128, 96] }, // Brand color
            styles: { fontSize: 9 },
            margin: { left: 14, right: 14 },
          });

          startY = (doc as any).lastAutoTable.finalY + 15;
        }

        // Maybe Section
        if (maybeAttendees.length > 0) {
          // Check if we need a new page
          if (startY > 250) {
            doc.addPage();
            startY = 20;
          }

          doc.setFontSize(14);
          doc.setTextColor(255, 193, 7); // Yellow
          doc.text('Maybe:', 14, startY);
          doc.setTextColor(0, 0, 0); // Reset to black

          autoTable(doc, {
            startY: startY + 6,
            head: [['S.No.', 'Name', 'Email', 'Batch', 'Guests', 'Date', 'Notes']],
            body: prepareTableData(maybeAttendees),
            headStyles: { fillColor: [255, 193, 7] }, // Yellow
            styles: { fontSize: 9 },
            margin: { left: 14, right: 14 },
          });

          startY = (doc as any).lastAutoTable.finalY + 15;
        }

        // No Section
        if (noAttendees.length > 0) {
          // Check if we need a new page
          if (startY > 250) {
            doc.addPage();
            startY = 20;
          }

          doc.setFontSize(14);
          doc.setTextColor(220, 53, 69); // Red
          doc.text('No:', 14, startY);
          doc.setTextColor(0, 0, 0); // Reset to black

          autoTable(doc, {
            startY: startY + 6,
            head: [['S.No.', 'Name', 'Email', 'Batch', 'Guests', 'Date', 'Notes']],
            body: prepareTableData(noAttendees),
            headStyles: { fillColor: [220, 53, 69] }, // Red
            styles: { fontSize: 9 },
            margin: { left: 14, right: 14 },
          });
        }

        doc.save(`${fileName}.pdf`);
      }

      toast({
        title: "Download Started",
        description: `Downloading ${format.toUpperCase()} report...`,
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Download Failed",
        description: "There was an error generating the report.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="flex min-h-screen bg-white">
      {/* Shared Admin Sidebar */}
      <AdminSidebar currentPage="events" />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 px-8 py-4 sticky top-0 z-40 shadow-sm transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setLocation("/admin/dashboard")}
                className="hover:bg-gray-100"
                aria-label="Back to Dashboard"
              >
                <ArrowLeft className="h-5 w-5 text-gray-700" />
              </Button>
              <h2 className="text-xl font-semibold text-gray-900">Events</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative z-[70]">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`relative min-w-[44px] min-h-[44px] rounded-full transition-colors ${
                    unreadCount > 0
                      ? "text-[#008060] hover:bg-[#008060]/10 hover:text-[#006b51] ring-2 ring-[#008060]/30"
                      : "text-gray-600 hover:text-[#008060] hover:bg-gray-100"
                  }`}
                  onClick={() => setShowNotifications(!showNotifications)}
                  aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
                >
                  <Bell className="w-5 h-5" strokeWidth={2} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 right-0 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white animate-pulse">
                      {unreadCount > 99 ? "99+" : unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </Button>

                {showNotifications && <NotificationDropdown onClose={() => setShowNotifications(false)} />}
              </div>
              <Button
                variant="outline"
                className="text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all"
                onClick={() => {
                  logoutAdmin();
                }}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Log Out
              </Button>
              <div className="hidden md:flex items-center gap-3 pl-4 border-l border-gray-200">
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">{adminUser?.username || 'Admin'}</p>
                  <p className="text-xs text-gray-500">Administrator</p>
                </div>
                <div className="w-10 h-10 bg-gradient-to-br from-[#008060] to-[#006b51] rounded-full flex items-center justify-center shadow-md">
                  <span className="text-white font-semibold">{adminUser?.username?.charAt(0).toUpperCase() || 'A'}</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 p-6 md:p-8 bg-gray-50/50 overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-6">

            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Events Management</h1>
                <p className="text-sm text-gray-500 mt-1">Create and manage your upcoming and past events</p>
              </div>
              <Button
                onClick={handleCreateClick}
                className="bg-[#008060] hover:bg-[#006b51] text-white shadow-sm hover:shadow-md transition-all rounded-lg px-4"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Event
              </Button>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  title: "Total Events",
                  value: events.length,
                  icon: Calendar,
                  color: "text-blue-600",
                  bg: "bg-blue-50",
                  onClick: () => clearFilters()
                },
                {
                  title: "Upcoming",
                  value: events.filter(e => new Date(e.event_date) >= new Date()).length,
                  icon: Clock,
                  color: "text-emerald-600",
                  bg: "bg-emerald-50",
                  onClick: () => {
                    clearFilters();
                    const today = new Date().toISOString().split('T')[0];
                    setDateFrom(today);
                  }
                },
                {
                  title: "Virtual",
                  value: events.filter(e => e.is_virtual).length,
                  icon: Video,
                  color: "text-purple-600",
                  bg: "bg-purple-50",
                  onClick: () => {
                    clearFilters();
                    setEventType("virtual");
                  }
                },
                {
                  title: "In-Person",
                  value: events.filter(e => !e.is_virtual).length,
                  icon: MapPin,
                  color: "text-orange-600",
                  bg: "bg-orange-50",
                  onClick: () => {
                    clearFilters();
                    setEventType("in-person");
                  }
                },
              ].map((stat, i) => (
                <div
                  key={i}
                  onClick={stat.onClick}
                  className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-center justify-between hover:shadow-md hover:border-[#008060] transition-all cursor-pointer group"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-500 group-hover:text-[#008060] transition-colors">{stat.title}</p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1 group-hover:text-[#008060] transition-colors">{stat.value}</h3>
                  </div>
                  <div className={`p-3 rounded-lg ${stat.bg} group-hover:bg-[#008060]/10 transition-colors`}>
                    <stat.icon className={`w-5 h-5 ${stat.color} group-hover:text-[#008060] transition-colors`} />
                  </div>
                </div>
              ))}
            </div>

            {/* Search and Filters */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="space-y-4">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search events by title, description, or location..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 border-gray-200 focus:border-[#008060] focus:ring-[#008060]/20 rounded-lg"
                  />
                </div>

                {/* Filters Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Location Filter */}
                  <Select value={selectedLocation || "all"} onValueChange={(value) => setSelectedLocation(value === "all" ? "" : value)}>
                    <SelectTrigger className="w-full border-gray-200">
                      <SelectValue placeholder="Location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Locations</SelectItem>
                      {filterOptions.locations.length > 0 ? (
                        filterOptions.locations.map((loc) => (
                          <SelectItem key={loc} value={loc}>
                            {loc}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="_none" disabled>No locations</SelectItem>
                      )}
                    </SelectContent>
                  </Select>

                  {/* Event Type Filter */}
                  <Select value={eventType} onValueChange={setEventType}>
                    <SelectTrigger className="w-full border-gray-200">
                      <SelectValue placeholder="Event Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="virtual">Virtual</SelectItem>
                      <SelectItem value="in-person">In-Person</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Registration Status Filter */}
                  <Select value={registrationStatus} onValueChange={setRegistrationStatus}>
                    <SelectTrigger className="w-full border-gray-200">
                      <SelectValue placeholder="Registration" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="open">Registration Open</SelectItem>
                      <SelectItem value="closed">Registration Closed</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Active Status Filter */}
                  <Select value={activeStatus} onValueChange={setActiveStatus}>
                    <SelectTrigger className="w-full border-gray-200">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Events</SelectItem>
                      <SelectItem value="active">Active Only</SelectItem>
                      <SelectItem value="inactive">Inactive Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Date Range Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-700 mb-1.5 block">From Date</label>
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="border-gray-200"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700 mb-1.5 block">To Date</label>
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="border-gray-200"
                    />
                  </div>
                </div>

                {/* Tags Filter */}
                {filterOptions.tags.length > 0 && (
                  <div>
                    <label className="text-xs font-medium text-gray-700 mb-1.5 block">Tags</label>
                    <div className="flex flex-wrap gap-2">
                      {filterOptions.tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant={selectedTags.includes(tag) ? "default" : "outline"}
                          className={`cursor-pointer hover:bg-[#008060]/10 ${selectedTags.includes(tag) ? "bg-[#008060] text-white" : ""
                            }`}
                          onClick={() => {
                            setSelectedTags(prev =>
                              prev.includes(tag)
                                ? prev.filter(t => t !== tag)
                                : [...prev, tag]
                            );
                          }}
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Filter Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <span className="text-sm text-gray-600">
                    {events.length} event{events.length !== 1 ? 's' : ''} found
                  </span>
                  <Button variant="outline" onClick={clearFilters} className="text-[#008060] border-[#008060] hover:bg-[#008060]/10">
                    <Filter className="w-4 h-4 mr-2" />
                    Clear Filters
                  </Button>
                </div>
              </div>
            </div>

            {/* Events Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden ring-1 ring-gray-100">
              {loading ? (
                <div className="p-12 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#008060]/10 mb-4">
                    <div className="w-6 h-6 border-2 border-[#008060]/30 border-t-[#008060] rounded-full animate-spin"></div>
                  </div>
                  <p className="text-gray-600 font-medium">Loading events...</p>
                </div>
              ) : events.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
                    <Calendar className="w-6 h-6 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900">No events found</h3>
                  <p className="text-gray-500 mt-1">Try adjusting your search terms or create a new event.</p>
                </div>
              ) : (
                <div className="overflow-x-auto custom-scrollbar">
                  <Table className="w-full">
                    <TableHeader className="bg-gray-50/80 sticky top-0 z-10 backdrop-blur-sm">
                      <TableRow className="border-b border-gray-200 hover:bg-transparent">
                        <TableHead className="w-[300px] pl-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Event Details</TableHead>
                        <TableHead className="w-[200px] py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Date & Time</TableHead>
                        <TableHead className="w-[150px] py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Location</TableHead>
                        <TableHead className="w-[120px] py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Attendees</TableHead>
                        <TableHead className="w-[100px] py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 text-center">Status</TableHead>
                        <TableHead className="w-[80px] py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 text-end pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {events.map((event) => {
                        const isExpired = new Date(event.event_date) < new Date();
                        return (
                          <TableRow
                            key={event.id}
                            className="hover:bg-gray-50/50 transition-colors border-b border-gray-100 last:border-0 cursor-pointer"
                            onClick={() => handleEditClick(event)}
                          >
                            <TableCell className="pl-6 py-4 align-top">
                              <div className="flex flex-col">
                                <span className="font-semibold text-gray-900 line-clamp-1" title={event.title}>{event.title}</span>
                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full w-fit mt-1.5 inline-flex items-center">
                                  {event.is_virtual ? <Video className="w-3 h-3 mr-1" /> : <MapPin className="w-3 h-3 mr-1" />}
                                  {event.is_virtual ? "Virtual" : "In-Person"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="py-4 align-top">
                              <div className="flex flex-col text-sm">
                                <div className="flex items-center text-gray-900 font-medium">
                                  <Calendar className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
                                  {formatDate(event.event_date)}
                                </div>
                                <div className="flex items-center text-gray-500 mt-1">
                                  <Clock className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
                                  {formatTimeIST(event.event_date)}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="py-4 align-top text-sm text-gray-600">
                              {event.is_virtual ? (
                                <a href={event.virtual_link || "#"} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center">
                                  <ExternalLink className="w-3.5 h-3.5 mr-1" /> Link
                                </a>
                              ) : (
                                <span className="line-clamp-2" title={event.location}>{event.location || "-"}</span>
                              )}
                            </TableCell>
                            <TableCell className="py-4 align-top">
                              <span className="text-sm font-medium text-gray-700">
                                {event.max_attendees ? (
                                  <span>{event.max_attendees} <span className="text-gray-400 font-normal">max</span></span>
                                ) : "Unlimited"}
                              </span>
                            </TableCell>
                            <TableCell className="py-4 align-top text-center">
                              <Badge variant="secondary" className={`
                                ${isExpired ? "bg-gray-100 text-gray-600 border-gray-200" :
                                  event.is_active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}
                              `}>
                                {isExpired ? "Expired" : event.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell className="pr-6 py-4 align-top text-end" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-gray-100 rounded-lg text-gray-500">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48 bg-white border border-gray-200 shadow-lg rounded-xl">
                                  <DropdownMenuItem onClick={() => handleViewAttendees(event)} className="cursor-pointer text-gray-700 focus:bg-gray-50">
                                    <Users className="w-4 h-4 mr-2" /> Attendees
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleEditClick(event)} className="cursor-pointer text-gray-700 focus:bg-gray-50">
                                    <Edit className="w-4 h-4 mr-2" /> Edit Details
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleViewFiles(event)} className="cursor-pointer text-gray-700 focus:bg-gray-50">
                                    <FileText className="w-4 h-4 mr-2" /> Manage Files
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => {
                                    const input = document.createElement('input');
                                    input.type = 'file';
                                    input.accept = 'image/*,.pdf,.doc,.docx';
                                    input.onchange = (e) => {
                                      const file = (e.target as HTMLInputElement).files?.[0];
                                      if (file) handleFileUpload(event.id, file);
                                    };
                                    input.click();
                                  }} className="cursor-pointer text-gray-700 focus:bg-gray-50">
                                    <Upload className="w-4 h-4 mr-2" /> Upload File
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleDeleteClick(event)} className="cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-700">
                                    <Trash2 className="w-4 h-4 mr-2" /> Delete Event
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Create Event Dialog */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className="sm:max-w-3xl bg-white border-2 border-[#008060]/20 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <span>➕</span>
              Create New Event
            </DialogTitle>
            <DialogDescription className="text-gray-600 pt-2">
              Fill in the details to create a new event. All fields marked with * are required.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Event Title *</label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Annual Alumni Meet 2025"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Description</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe your event..."
                className="min-h-[100px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Event Date & Time *</label>
                <Input
                  type="datetime-local"
                  value={formData.event_date}
                  onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Registration Deadline</label>
                <Input
                  type="datetime-local"
                  value={formData.registration_deadline}
                  onChange={(e) => setFormData({ ...formData, registration_deadline: e.target.value })}
                  onBlur={() => {
                    if (formData.registration_deadline && formData.event_date) {
                      validateEventData(formData.event_date, formData.registration_deadline, formData.max_attendees);
                    }
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Location</label>
              <Input
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="City, Country or leave empty for virtual"
              />
            </div>

            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <Switch
                checked={formData.is_virtual}
                onCheckedChange={(checked) => setFormData({ ...formData, is_virtual: checked })}
              />
              <label className="text-sm font-medium text-gray-700">This is a virtual event</label>
            </div>

            {formData.is_virtual && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Virtual Link *</label>
                <Input
                  value={formData.virtual_link}
                  onChange={(e) => setFormData({ ...formData, virtual_link: e.target.value })}
                  placeholder="https://zoom.us/..."
                  required
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Max Attendees</label>
                <Input
                  type="number"
                  min="1"
                  value={formData.max_attendees}
                  onChange={(e) => setFormData({ ...formData, max_attendees: e.target.value })}
                  onBlur={() => {
                    if (formData.max_attendees) {
                      validateEventData(formData.event_date, formData.registration_deadline, formData.max_attendees);
                    }
                  }}
                  placeholder="Leave empty for unlimited"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Event Cover Image</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-[#008060] transition-colors cursor-pointer"
                  onClick={() => document.getElementById('create-event-cover-upload')?.click()}
                >
                  {formData.cover_image ? (
                    <div className="space-y-2">
                      <img src={formData.cover_image} alt="Event cover" className="max-h-40 mx-auto rounded" />
                      <p className="text-sm text-gray-600">Click to change image</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-4xl">📸</div>
                      <p className="text-sm text-gray-600">Click to upload event cover image</p>
                      <p className="text-xs text-gray-500">PNG, JPG, GIF up to 5MB</p>
                    </div>
                  )}
                </div>
                <input
                  id="create-event-cover-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      // Temporarily store the file for upload after event creation
                      (window as any).__pendingEventCover = file;
                      // Show preview
                      const reader = new FileReader();
                      reader.onload = (e) => {
                        setFormData({ ...formData, cover_image: e.target?.result as string });
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <label className="text-sm font-medium text-gray-700">Set event as active</label>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setCreateDialog(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isSubmitting}
              className="bg-gradient-to-r from-[#008060] to-[#006b51] text-white"
            >
              {isSubmitting ? "Creating..." : "Create Event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Event Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="sm:max-w-3xl bg-white border-2 border-[#008060]/20 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <span>✏️</span>
              Edit Event
            </DialogTitle>
            <DialogDescription className="text-gray-600 pt-2">
              Update the event details below. Changes will be reflected immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Event Title *</label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Annual Alumni Meet 2025"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Description</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe your event..."
                className="min-h-[100px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Event Date & Time *</label>
                <Input
                  type="datetime-local"
                  value={formData.event_date}
                  onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Registration Deadline</label>
                <Input
                  type="datetime-local"
                  value={formData.registration_deadline}
                  onChange={(e) => setFormData({ ...formData, registration_deadline: e.target.value })}
                  onBlur={() => {
                    if (formData.registration_deadline && formData.event_date) {
                      validateEventData(formData.event_date, formData.registration_deadline, formData.max_attendees);
                    }
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Location</label>
              <Input
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="City, Country or leave empty for virtual"
              />
            </div>

            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <Switch
                checked={formData.is_virtual}
                onCheckedChange={(checked) => setFormData({ ...formData, is_virtual: checked })}
              />
              <label className="text-sm font-medium text-gray-700">This is a virtual event</label>
            </div>

            {formData.is_virtual && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Virtual Link *</label>
                <Input
                  value={formData.virtual_link}
                  onChange={(e) => setFormData({ ...formData, virtual_link: e.target.value })}
                  placeholder="https://zoom.us/..."
                  required
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Max Attendees</label>
                <Input
                  type="number"
                  min="1"
                  value={formData.max_attendees}
                  onChange={(e) => setFormData({ ...formData, max_attendees: e.target.value })}
                  onBlur={() => {
                    if (formData.max_attendees) {
                      validateEventData(formData.event_date, formData.registration_deadline, formData.max_attendees);
                    }
                  }}
                  placeholder="Leave empty for unlimited"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Event Cover Image</label>
                {formData.cover_image ? (
                  <div className="space-y-3">
                    <div className="border-2 border-gray-200 rounded-lg p-4 bg-gray-50">
                      <p className="text-sm font-medium text-gray-700 mb-3">Current Cover Image</p>
                      <div className="flex flex-col items-center gap-3">
                        <img src={formData.cover_image} alt="Current event cover" className="max-h-48 w-auto rounded object-cover" />
                        <div className="flex gap-2 w-full justify-center">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => document.getElementById('edit-event-cover-upload')?.click()}
                            className="border-blue-500 text-blue-600 hover:bg-blue-50"
                          >
                            🔄 Replace Image
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              if (selectedEvent?.cover_image) {
                                try {
                                  // Extract the path from the URL
                                  const coverImagePath = selectedEvent.cover_image.split('/storage/v1/object/public/event_covers/')[1];
                                  if (coverImagePath) {
                                    const { error } = await supabase.storage
                                      .from('event_covers')
                                      .remove([coverImagePath]);

                                    if (error) {
                                      toast({
                                        title: "Error",
                                        description: "Failed to delete cover image",
                                        variant: "destructive"
                                      });
                                    } else {
                                      setFormData({ ...formData, cover_image: "" });
                                      toast({
                                        title: "Success",
                                        description: "Cover image deleted successfully"
                                      });
                                    }
                                  }
                                } catch (error) {
                                  console.error('Delete cover error:', error);
                                  toast({
                                    title: "Error",
                                    description: "Failed to delete cover image",
                                    variant: "destructive"
                                  });
                                }
                              } else {
                                setFormData({ ...formData, cover_image: "" });
                              }
                            }}
                            className="border-red-500 text-red-600 hover:bg-red-50"
                          >
                            🗑️ Delete Image
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-[#008060] transition-colors cursor-pointer"
                    onClick={() => document.getElementById('edit-event-cover-upload')?.click()}
                  >
                    <div className="space-y-2">
                      <div className="text-4xl">📸</div>
                      <p className="text-sm text-gray-600">Click to upload event cover image</p>
                      <p className="text-xs text-gray-500">PNG, JPG, GIF up to 5MB</p>
                    </div>
                  </div>
                )}
                <input
                  id="edit-event-cover-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      // Temporarily store the file for upload after event update
                      (window as any).__pendingEventCover = file;
                      // Show preview
                      const reader = new FileReader();
                      reader.onload = (e) => {
                        setFormData({ ...formData, cover_image: e.target?.result as string });
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <label className="text-sm font-medium text-gray-700">Set event as active</label>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setEditDialog(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={isSubmitting}
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white"
            >
              {isSubmitting ? "Updating..." : "Update Event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent className="sm:max-w-md bg-white border-2 border-red-200">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-red-600 flex items-center gap-2">
              <span>⚠️</span>
              Confirm Deletion
            </DialogTitle>
            <DialogDescription className="text-gray-600 pt-2">
              Are you sure you want to delete this event? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {selectedEvent && (
            <div className="bg-red-50 rounded-lg p-4 my-4">
              <p className="text-sm font-semibold text-gray-900 mb-1">Event to delete:</p>
              <p className="text-red-700 font-medium">{selectedEvent.title}</p>
              <p className="text-xs text-gray-600 mt-2">Date: {formatDate(selectedEvent.event_date)}</p>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteDialog(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={isSubmitting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isSubmitting ? "Deleting..." : "Delete Event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Files Management Dialog */}
      <Dialog open={filesDialog} onOpenChange={setFilesDialog}>
        <DialogContent className="sm:max-w-2xl bg-white border-2 border-purple-200">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-purple-600 flex items-center gap-2">
              <span>📁</span>
              Event Files
            </DialogTitle>
            <DialogDescription className="text-gray-600 pt-2">
              {selectedEvent ? `Files for: ${selectedEvent.title}` : 'Manage event documents and images'}
            </DialogDescription>
          </DialogHeader>

          <div className="my-4">
            {loadingFiles ? (
              <div className="flex items-center justify-center py-8">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-8 h-8 border-4 border-purple-600/30 border-t-purple-600 rounded-full animate-spin"></div>
                  <p className="text-gray-600">Loading files...</p>
                </div>
              </div>
            ) : eventFiles.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No files uploaded yet</p>
                <p className="text-sm text-gray-400 mt-2">Click the Upload button in the table to add files</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {eventFiles.map((fileName) => (
                  <div key={fileName} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">
                        {fileName.match(/\.(jpg|jpeg|png|gif)$/i) ? '🖼️' : '📄'}
                      </span>
                      <span className="text-sm font-medium text-gray-700">{fileName}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewFile(fileName)}
                        className="border-blue-500 text-blue-600 hover:bg-blue-50"
                      >
                        👁️ View
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setFileToDelete(fileName);
                          setDeleteFileDialog(true);
                        }}
                        className="border-red-500 text-red-600 hover:bg-red-50"
                      >
                        🗑️ Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFilesDialog(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete File Confirmation Dialog */}
      <Dialog open={deleteFileDialog} onOpenChange={setDeleteFileDialog}>
        <DialogContent className="sm:max-w-md bg-white border-2 border-red-200">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-red-600 flex items-center gap-2">
              <span>⚠️</span>
              Confirm File Deletion
            </DialogTitle>
            <DialogDescription className="text-gray-600 pt-2">
              Are you sure you want to delete this file? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {fileToDelete && (
            <div className="bg-red-50 rounded-lg p-4 my-4">
              <p className="text-sm font-semibold text-gray-900 mb-1">File to delete:</p>
              <p className="text-red-700 font-medium break-all">{fileToDelete}</p>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteFileDialog(false);
                setFileToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteFile}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete File
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attendees Dialog */}
      <Dialog open={viewAttendeesDialog} onOpenChange={setViewAttendeesDialog}>
        <DialogContent className="sm:max-w-4xl bg-white border-2 border-teal-200 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-teal-700 flex items-center gap-2">
              <Users className="w-6 h-6" />
              Event Attendees
            </DialogTitle>
            <DialogDescription className="text-gray-600 pt-2">
              {selectedEvent ? `Manage attendees for: ${selectedEvent.title}` : 'View event attendees'}
            </DialogDescription>
          </DialogHeader>

          {/* Action Bar */}
          <div className="flex justify-end gap-2 -mt-4 mb-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  Download Report
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleDownloadAttendees('csv')}>
                  Download CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownloadAttendees('excel')}>
                  Download Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownloadAttendees('pdf')}>
                  Download PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="my-4">
            {/* Stats Summary */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-green-50 p-4 rounded-lg border border-green-100 text-center">
                <p className="text-sm font-medium text-green-800">Confirmed</p>
                <p className="text-2xl font-bold text-green-600">{attendeeStats.attending}</p>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100 text-center">
                <p className="text-sm font-medium text-yellow-800">Maybe</p>
                <p className="text-2xl font-bold text-yellow-600">{attendeeStats.maybe}</p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg border border-red-100 text-center">
                <p className="text-sm font-medium text-red-800">Declined</p>
                <p className="text-2xl font-bold text-red-600">{attendeeStats.not_attending}</p>
              </div>
            </div>

            {loadingAttendees ? (
              <div className="flex items-center justify-center py-8">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-8 h-8 border-4 border-teal-600/30 border-t-teal-600 rounded-full animate-spin"></div>
                  <p className="text-gray-600">Loading attendees...</p>
                </div>
              </div>
            ) : eventAttendees.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <p className="text-gray-500">No responses yet</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="font-semibold text-gray-700">Name</TableHead>
                      <TableHead className="font-semibold text-gray-700">Email</TableHead>
                      <TableHead className="font-semibold text-gray-700">Status</TableHead>
                      <TableHead className="font-semibold text-gray-700">Guests</TableHead>
                      <TableHead className="font-semibold text-gray-700">Date</TableHead>
                      <TableHead className="font-semibold text-gray-700">Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eventAttendees.map((rsvp: any) => (
                      <TableRow key={rsvp.id} className="hover:bg-gray-50">
                        <TableCell className="font-medium">
                          {rsvp.alumni ? (
                            <div className="flex items-center gap-2">
                              <img
                                src={getProfilePicture(rsvp.alumni)}
                                alt={`${rsvp.alumni.first_name} ${rsvp.alumni.last_name}`}
                                className="w-8 h-8 rounded-full object-cover"
                                onError={(e) => {
                                  // Fallback to default if image fails to load
                                  const target = e.target as HTMLImageElement;
                                  const firstName = rsvp.alumni?.first_name || '';
                                  const lastName = rsvp.alumni?.last_name || '';
                                  const displayName = `${firstName} ${lastName}`.trim() || 'User';
                                  const seed = encodeURIComponent(displayName);
                                  target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=008060`;
                                }}
                              />
                              <div>
                                <p>{rsvp.alumni.first_name} {rsvp.alumni.last_name}</p>
                                <p className="text-xs text-gray-500">{rsvp.alumni.batch || 'Batch N/A'}</p>
                              </div>
                            </div>
                          ) : (
                            rsvp.user?.username || 'Unknown User'
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">{rsvp.user?.email || rsvp.alumni?.email || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={
                            rsvp.status === 'attending' ? 'default' :
                              rsvp.status === 'maybe' ? 'secondary' : 'destructive'
                          } className={
                            rsvp.status === 'attending' ? 'bg-green-100 text-green-800 hover:bg-green-200' :
                              rsvp.status === 'maybe' ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' :
                                'bg-red-100 text-red-800 hover:bg-red-200'
                          }>
                            {rsvp.status.charAt(0).toUpperCase() + rsvp.status.slice(1).replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>{rsvp.guests_count || 1}</TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {new Date(rsvp.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500 max-w-xs truncate" title={rsvp.notes}>
                          {rsvp.notes || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setViewAttendeesDialog(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};