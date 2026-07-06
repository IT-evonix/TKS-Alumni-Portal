import React, { useRef, useState, useMemo } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { Users, Globe, Plus, MapPin, UploadCloud, X, ImageIcon, Trash2, UserPlus, MessageSquare, CheckCircle2 } from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CityAutocomplete } from "@/components/profile/CityAutocomplete";
import { Edit } from "lucide-react";
import { LoadingState } from "@/components/common/LoadingState";
import { PageHeading } from "@/components/common/PageHeading";
import { supabase } from "@/lib/supabase";
import { resolveChapterCoords } from "@/components/TravelChaptersMap";

const getAccent = (index: number) => {
  const accents = [
    "from-emerald-500 to-teal-500",
    "from-blue-500 to-indigo-500",
    "from-purple-500 to-violet-500",
    "from-orange-500 to-amber-500",
    "from-rose-500 to-pink-500",
  ];
  return accents[index % accents.length];
};

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] } },
};

interface CityChapterSectionProps {
  hideHeader?: boolean;
  chapters?: any[];
  isLoading?: boolean;
  mapBounds?: google.maps.LatLngBounds | null;
  selectedChapter?: any | null;
  onChapterClick?: (chapter: any | null) => void;
  sidebarMode?: boolean;
  mapInteracted?: boolean;
}

export function TravelChapterSection({
  hideHeader = false,
  chapters = [],
  isLoading = false,
  mapBounds = null,
  selectedChapter: externalSelectedChapter,
  onChapterClick,
  sidebarMode = false,
  mapInteracted = false
}: CityChapterSectionProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: "-60px" });
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'all' | 'my' | 'admin'>('all');

  const { data: myProposals = [] } = useQuery({
    queryKey: ['my-city-chapters'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/travel-chapters/my-proposals');
      if (!res.ok) return [];
      return res.json();
    }
  });

  const { data: adminProposals = [] } = useQuery({
    queryKey: ['admin-city-chapters'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/travel-chapters/admin');
      if (!res.ok) return [];
      return res.json();
    },
    enabled: user?.user_role === 'administrator'
  });

  const [activeRegion, setActiveRegion] = useState("All");

  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [description, setDescription] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [editingChapter, setEditingChapter] = useState<any | null>(null);
  const [editCity, setEditCity] = useState("");
  const [editCountry, setEditCountry] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCoverPreview, setEditCoverPreview] = useState<string | null>(null);
  const [chapterToDelete, setChapterToDelete] = useState<any | null>(null);

  const fileInputEditRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editingChapter) {
      setEditCity(editingChapter.city || "");
      setEditCountry(editingChapter.country || "");
      setEditDescription(editingChapter.description || "");
      setEditCoverPreview(editingChapter.cover_image || null);
    }
  }, [editingChapter]);

  const handleEditFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Image must be under 5MB", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setEditCoverPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  // Use external state if provided, otherwise fallback to internal
  const [internalSelectedChapter, setInternalSelectedChapter] = useState<any | null>(null);

  const selectedChapter = externalSelectedChapter !== undefined ? externalSelectedChapter : internalSelectedChapter;
  const setSelectedChapter = onChapterClick || setInternalSelectedChapter;

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDesktop, setIsDesktop] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);

  React.useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Filter chapters based on map bounds — filter only when the user has actively interacted with the map
  const visibleChapters = useMemo(() => {
    let filtered = chapters;

    // Only filter by bounds when the user has actively interacted/panned/zoomed
    if (mapInteracted && mapBounds && filtered.length > 0) {
      filtered = filtered.filter(chap => {
        const coords = resolveChapterCoords(chap);
        if (!coords) return false;
        return mapBounds.contains(coords);
      });
    }

    return filtered;
  }, [chapters, mapBounds, mapInteracted]);

  // Separate out current user's own chapters — only show in My City Chapters, not in directory
  const directoryChapters = useMemo(() =>
    visibleChapters,
    [visibleChapters]
  );

  const proposeMutation = useMutation({
    mutationFn: async () => {
      let cover_image_url = undefined;

      // Pass the base64 preview string directly to the backend
      if (coverPreview) {
        cover_image_url = coverPreview;
      }
      
      let coordinatesStr = undefined;
      try {
        const nomRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city + ', ' + country)}&limit=1`);
        if (nomRes.ok) {
          const nomData = await nomRes.json();
          if (nomData && nomData.length > 0) {
            coordinatesStr = `${nomData[0].lon},${nomData[0].lat}`;
          }
        }
      } catch (err) {
        console.warn("Geocoding failed during proposal:", err);
      }

      const res = await apiRequest('POST', '/api/travel-chapters', {
        city, country, description, cover_image: cover_image_url, coordinates: coordinatesStr
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to propose chapter");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Chapter proposed successfully. Waiting for admin approval." });
      setIsDialogOpen(false);
      setCity("");
      setCountry("");
      setDescription("");
      setCoverFile(null);
      setCoverPreview(null);
      queryClient.invalidateQueries({ queryKey: ['city-chapters'] });
      queryClient.invalidateQueries({ queryKey: ['my-city-chapters'] });
    },
    onError: (err) => {
      setIsUploading(false);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/travel-chapters/${id}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete chapter");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Chapter proposal deleted successfully." });
      queryClient.invalidateQueries({ queryKey: ['city-chapters'] });
      queryClient.invalidateQueries({ queryKey: ['my-city-chapters'] });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const res = await apiRequest('PUT', `/api/travel-chapters/${id}/status`, { status });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Success", description: data.message });
      queryClient.invalidateQueries({ queryKey: ['city-chapters'] });
      queryClient.invalidateQueries({ queryKey: ['my-city-chapters'] });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const editChapterMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string, updates: any }) => {
      const res = await apiRequest('PATCH', `/api/travel-chapters/${id}`, updates);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to edit chapter");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Chapter updated successfully." });
      setEditingChapter(null);
      queryClient.invalidateQueries({ queryKey: ['city-chapters'] });
      queryClient.invalidateQueries({ queryKey: ['my-city-chapters'] });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Image must be under 5MB", variant: "destructive" });
      return;
    }
    setCoverFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setCoverPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const clearFile = () => {
    setCoverFile(null);
    setCoverPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div ref={containerRef} className="relative h-full flex flex-col">      {/* ── Header & Filters ──────────────────────────────────────────────────── */}
      <div className={`lg:sticky lg:top-0 lg:z-50 ${sidebarMode ? 'bg-white pt-6 px-6' : 'bg-transparent pt-0 px-0'} flex ${sidebarMode ? 'flex-col gap-4 items-start' : 'flex-col xl:flex-row xl:items-center'} justify-between mb-6 border-b border-gray-100 pb-6`}>
        <div>
          <PageHeading firstWord="Travel" secondWord="Chapters" className="mb-0" />
        </div>

        <div className={`flex flex-col sm:flex-row items-center gap-3 w-full ${sidebarMode ? 'sm:flex-col items-stretch' : 'xl:w-auto justify-end'}`}>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className={`whitespace-nowrap px-5 rounded-md bg-[#008060] hover:bg-[#006b51] text-white shadow-sm h-10 text-sm font-semibold flex items-center justify-center ${sidebarMode ? 'w-full flex-1' : 'w-full sm:w-auto'}`}>
                <Plus className="w-4 h-4 mr-1.5" /> Propose Chapter
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[92vw] max-w-[500px] rounded-3xl p-0 max-h-[90vh] overflow-y-auto bg-white border-0 shadow-2xl">
              <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-6 sm:p-8 text-white rounded-t-3xl relative overflow-hidden">
                <div className="absolute top-0 right-0 opacity-10 transform translate-x-1/4 -translate-y-1/4">
                  <Globe className="w-48 h-48" />
                </div>
                <DialogHeader className="text-left relative z-10">
                  <DialogTitle className="text-2xl sm:text-3xl font-extrabold text-white">Start a City Chapter</DialogTitle>
                  <DialogDescription className="text-emerald-100 mt-2 text-base">
                    Start a new alumni community in your city.
                  </DialogDescription>
                </DialogHeader>
              </div>

              <div className="p-6 sm:p-8 space-y-5">
                <div className="space-y-2 relative z-50">
                  <label className="text-sm font-bold text-gray-700 uppercase tracking-wider text-xs">City Location</label>
                  <CityAutocomplete
                    city={city}
                    onCityChange={setCity}
                    onLocationSelect={(selCity, selState, selCountry) => {
                      setCity(selCity);
                      setCountry(selCountry);
                    }}
                  />
                </div>

                <div className="space-y-2 hidden">
                  <label className="text-sm font-medium">Country</label>
                  <Input value={country} onChange={e => setCountry(e.target.value)} placeholder="Auto-filled from city" className="bg-gray-50" readOnly />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 uppercase tracking-wider text-xs">Cover Image</label>
                  {!coverPreview ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-[#008060] hover:bg-[#008060]/5 transition-all group"
                    >
                      <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <ImageIcon className="w-6 h-6 text-emerald-600" />
                      </div>
                      <p className="text-sm font-medium text-gray-900">Click to upload cover image</p>
                      <p className="text-xs text-gray-500 mt-1">High quality image of your city (Max 5MB)</p>
                    </div>
                  ) : (
                    <div className="relative rounded-xl overflow-hidden shadow-sm group">
                      <img src={coverPreview} alt="Cover preview" className="w-full h-40 object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); clearFile(); }} className="absolute top-2 right-2 bg-white/95 hover:bg-white text-red-600 shadow-md">
                          <X className="w-4 h-4 mr-1.5" /> Remove
                        </Button>
                      </div>
                    </div>
                  )}
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileSelect}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 uppercase tracking-wider text-xs">Why should we add this?</label>
                  <Textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Tell us about the growing number of alumni in this area..."
                    className="min-h-[100px] bg-gray-50/50 resize-none rounded-xl border-gray-200 focus:border-[#008060] focus:ring-[#008060]"
                  />
                </div>

                <Button
                  onClick={() => proposeMutation.mutate()}
                  disabled={proposeMutation.isPending || isUploading || !city || !country}
                  className="w-full h-10 bg-[#008060] hover:bg-[#006b51] text-white rounded-xl shadow-lg font-bold text-sm mt-4 transition-all hover:scale-[1.02] disabled:opacity-70 disabled:hover:scale-100"
                >
                  {proposeMutation.isPending || isUploading ? (
                    <span className="flex items-center"><UploadCloud className="w-5 h-5 mr-2 animate-pulse" /> Processing...</span>
                  ) : "Submit Proposal"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </div>

      {/* ── Location Cards ──────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-6">
      {/* Tab Switcher */}
      {!sidebarMode && (
        <div className="flex border-b border-gray-200 mb-8 w-full overflow-x-auto custom-scrollbar gap-2 pb-1">
          <button
            onClick={() => setActiveTab('all')}
            className={`pb-3 text-sm font-bold border-b-2 px-6 transition-all duration-300 ${
              activeTab === 'all'
                ? 'border-[#008060] text-[#008060]'
                : 'border-transparent text-gray-400 hover:text-gray-700'
            }`}
          >
            All Approved Chapters
          </button>
          <button
            onClick={() => setActiveTab('my')}
            className={`pb-3 text-sm font-bold border-b-2 px-6 transition-all duration-300 flex items-center gap-2 ${
              activeTab === 'my'
                ? 'border-[#008060] text-[#008060]'
                : 'border-transparent text-gray-400 hover:text-gray-700'
            }`}
          >
            <span>My Proposed Chapters</span>
            {myProposals.length > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'my' ? 'bg-[#008060] text-white' : 'bg-gray-100 text-gray-500'
              }`}>
                {myProposals.length}
              </span>
            )}
          </button>
          {user?.user_role === 'administrator' && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`pb-3 text-sm font-bold border-b-2 px-6 transition-all duration-300 flex items-center gap-2 ${
                activeTab === 'admin'
                  ? 'border-[#008060] text-[#008060]'
                  : 'border-transparent text-gray-400 hover:text-gray-700'
              }`}
            >
              <span>Review Proposals</span>
              {adminProposals.length > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === 'admin' ? 'bg-[#008060] text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  {adminProposals.length}
                </span>
              )}
            </button>
          )}
        </div>
      )}

      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="py-20"
          >
            <LoadingState message="Discovering city chapters..." size="lg" />
          </motion.div>
        ) : (activeTab === 'all' ? directoryChapters : activeTab === 'my' ? myProposals : adminProposals).length === 0 ? (
          <motion.div
            key={`empty-${activeTab}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col items-center justify-center py-20 text-center w-full"
          >
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              {activeTab === 'all' ? <MapPin className="w-8 h-8 text-gray-400" /> : <Globe className="w-8 h-8 text-gray-400" />}
            </div>
            <h3 className="text-lg font-bold text-gray-900">
              {activeTab === 'all' 
                ? "No Chapters in View" 
                : activeTab === 'my'
                  ? "No Proposed Chapters"
                  : "No Proposals to Review"}
            </h3>
            <p className="text-gray-500 mt-2 max-w-sm">
              {activeTab === 'all' 
                ? "Pan or zoom the map to discover chapters in other areas, or propose a new one!"
                : activeTab === 'my'
                  ? "You haven't proposed any city chapters yet. Click 'Propose Chapter' to start a local community!"
                  : "All submitted city chapter proposals have been reviewed."}
            </p>
          </motion.div>
        ) : (
          <motion.div
            key={`grid-${activeTab}`}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            className={`grid ${sidebarMode ? 'grid-cols-1 gap-5' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-6'} pb-10 px-2`}
          >
            <AnimatePresence>
              {(activeTab === 'all' ? directoryChapters : activeTab === 'my' ? myProposals : adminProposals).map((chap: any, i: number) => (
                <motion.div
                  key={chap.id}
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                  whileHover={{ y: -4, scale: sidebarMode ? 1.01 : 1.02, transition: { duration: 0.2 } }}
                  onClick={() => setSelectedChapter(chap)}
                  className={`group relative bg-white border border-gray-200 transition-all duration-300 cursor-pointer ${sidebarMode ? 'rounded-xl p-3 sm:p-4 flex flex-row items-center gap-4 hover:border-[#008060]/30 shadow-sm hover:shadow-md' : 'rounded-2xl overflow-hidden shadow-sm hover:shadow-xl flex flex-col h-full'}`}
                >
                  {sidebarMode ? (
                    <>
                      {/* Compact Image Thumbnail */}
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg flex-shrink-0 relative overflow-hidden bg-gray-100 border border-gray-100 shadow-sm">
                        {chap.cover_image ? (
                          <img src={chap.cover_image} alt={chap.city} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        ) : (
                          <div className={`absolute inset-0 w-full h-full bg-gradient-to-br ${getAccent(i)} opacity-80`} />
                        )}
                      </div>
                      {/* Compact Details */}
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3 className="text-base sm:text-lg font-bold text-gray-900 truncate tracking-tight" style={{ fontFamily: 'Georgia, serif' }}>{chap.city}</h3>
                          {chap.status === "approved" && (
                            <div className="flex-shrink-0 w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" title="Active"></div>
                          )}
                          {chap.status === "pending" && (
                            <div className="flex-shrink-0 w-2 h-2 rounded-full bg-amber-500" title="Pending"></div>
                          )}
                          {chap.status === "rejected" && (
                            <div className="flex-shrink-0 w-2 h-2 rounded-full bg-red-500" title="Rejected"></div>
                          )}
                        </div>
                        <p className="text-xs font-medium text-gray-500 truncate mb-1">{chap.country}</p>
                        
                        {/* Members Count Badge */}
                        <p className="text-xs text-gray-400 mb-2 flex items-center gap-1 font-medium">
                          <Users className="w-3.5 h-3.5 text-[#008060]" />
                          <span>{chap.memberCount || 0} {chap.memberCount === 1 ? 'member' : 'members'}</span>
                        </p>
                        
                        <div className="inline-flex items-center text-xs font-bold text-[#008060]">
                          <span>View Chapter</span>
                          <svg className="w-3.5 h-3.5 ml-1 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Original Large Grid Card */}
                      <div className="h-44 w-full relative overflow-hidden bg-gray-100">
                        {chap.cover_image ? (
                          <img src={chap.cover_image} alt={chap.city} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                        ) : (
                          <div className={`absolute inset-0 w-full h-full bg-gradient-to-br ${getAccent(i)} opacity-80`} />
                        )}
                        {chap.status === "approved" && (
                          <div className="absolute top-3 right-3 bg-black/80 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md flex items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span> Active
                          </div>
                        )}
                        {chap.status === "pending" && (
                          <div className="absolute top-3 right-3 bg-amber-500 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md">
                            Pending
                          </div>
                        )}
                        {chap.status === "rejected" && (
                          <div className="absolute top-3 right-3 bg-red-600 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md">
                            Rejected
                          </div>
                        )}
                      </div>

                      <div className="p-5 flex-1 flex flex-col">
                        <div className="flex justify-between items-start mb-4 gap-2">
                          <div>
                            <h3 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>{chap.city} Chapter</h3>
                            <p className="text-xs text-gray-500 mt-1">{chap.city}, {chap.country}</p>
                          </div>
                        </div>

                        {/* Members Count Badge */}
                        {chap.status === 'approved' && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-4 bg-gray-50 px-2.5 py-1.5 rounded-lg w-fit">
                            <Users className="w-3.5 h-3.5 text-[#008060]" />
                            <span className="font-semibold text-gray-700">{chap.memberCount || 0}</span>
                            <span>{chap.memberCount === 1 ? 'Member' : 'Members'}</span>
                          </div>
                        )}

                        {activeTab === 'my' || (activeTab === 'admin' && chap.status !== 'approved') ? (
                          <div className="flex flex-col gap-2 mt-auto w-full" onClick={e => e.stopPropagation()}>
                            <div className="flex gap-2 items-center w-full">
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 text-gray-600 hover:bg-gray-50 text-xs h-9 rounded-xl flex items-center justify-center gap-1 border-gray-200 font-semibold"
                                onClick={() => setEditingChapter(chap)}
                              >
                                <Edit className="w-3.5 h-3.5" /> Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 h-9 w-9 p-0 rounded-xl flex-shrink-0"
                                onClick={() => setChapterToDelete(chap)}
                                disabled={deleteMutation.isPending}
                              >
                                <Trash2 className="w-4.5 h-4.5" />
                              </Button>
                            </div>
                            {activeTab === 'admin' && chap.status === 'pending' && (
                              <div className="flex gap-2 pt-2 border-t border-gray-100 w-full">
                                <Button
                                  size="sm"
                                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] h-8 rounded-lg font-bold"
                                  onClick={() => updateStatusMutation.mutate({ id: chap.id, status: 'approved' })}
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1 text-red-600 hover:bg-red-50 border-red-200 text-[10px] h-8 rounded-lg font-bold"
                                  onClick={() => updateStatusMutation.mutate({ id: chap.id, status: 'rejected' })}
                                >
                                  Reject
                                </Button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="w-full mt-auto py-2.5 rounded-xl bg-emerald-50 text-center text-[#008060] font-bold text-xs group-hover:bg-[#008060] group-hover:text-white transition-all duration-300 shadow-sm">
                            View Chapter
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
      </div>

      {/* Chapter Detail Modal */}
      <ChapterDetailModal 
        selectedChapter={selectedChapter} 
        onClose={() => setSelectedChapter(null)} 
        setLocation={setLocation} 
      />

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={!!chapterToDelete} onOpenChange={(open) => !open && setChapterToDelete(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Chapter Proposal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the proposed chapter for {chapterToDelete?.city}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                if (chapterToDelete) {
                  deleteMutation.mutate(chapterToDelete.id);
                  setChapterToDelete(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit City Chapter Dialog */}
      <Dialog open={!!editingChapter} onOpenChange={(open) => !open && setEditingChapter(null)}>
        <DialogContent className="w-[92vw] max-w-[500px] rounded-3xl p-0 max-h-[90vh] overflow-y-auto bg-white border-0 shadow-2xl">
          <div className="bg-gradient-to-br from-[#008060] to-emerald-800 p-6 text-white rounded-t-3xl relative overflow-hidden">
            <DialogHeader className="text-left relative z-10">
              <DialogTitle className="text-xl sm:text-2xl font-extrabold text-white">Edit City Chapter</DialogTitle>
              <DialogDescription className="text-emerald-100 mt-2 text-sm">
                Update the details for {editingChapter?.city} Chapter.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-6 sm:p-8 space-y-5">
            <div className="space-y-2 relative z-50">
              <label className="text-sm font-bold text-gray-700 uppercase tracking-wider text-xs">City Location</label>
              <CityAutocomplete
                city={editCity}
                onCityChange={setEditCity}
                onLocationSelect={(selCity, selState, selCountry) => {
                  setEditCity(selCity);
                  setEditCountry(selCountry);
                }}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 uppercase tracking-wider text-xs">Cover Image</label>
              {!editCoverPreview ? (
                <div
                  onClick={() => fileInputEditRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-[#008060] hover:bg-[#008060]/5 transition-all group"
                >
                  <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <ImageIcon className="w-6 h-6 text-emerald-600" />
                  </div>
                  <p className="text-sm font-medium text-gray-900">Click to upload cover image</p>
                  <p className="text-xs text-gray-500 mt-1">High quality image of your city (Max 5MB)</p>
                </div>
              ) : (
                <div className="relative rounded-xl overflow-hidden shadow-sm group">
                  <img src={editCoverPreview || undefined} alt="Cover preview" className="w-full h-40 object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setEditCoverPreview(null); 
                        if (fileInputEditRef.current) fileInputEditRef.current.value = '';
                      }} 
                      className="absolute top-2 right-2 bg-white/95 hover:bg-white text-red-600 shadow-md"
                    >
                      <X className="w-4 h-4 mr-1.5" /> Remove
                    </Button>
                  </div>
                </div>
              )}
              <input
                type="file"
                ref={fileInputEditRef}
                className="hidden"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleEditFileSelect}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 uppercase tracking-wider text-xs">Description</label>
              <Textarea
                value={editDescription}
                onChange={e => setEditDescription(e.target.value)}
                placeholder="Tell us about the growing number of alumni in this area..."
                className="min-h-[100px] bg-gray-50/50 resize-none rounded-xl border-gray-200 focus:border-[#008060] focus:ring-[#008060]"
              />
            </div>

            <Button
              onClick={() => {
                if (editingChapter) {
                  editChapterMutation.mutate({
                    id: editingChapter.id,
                    updates: {
                      city: editCity,
                      country: editCountry,
                      description: editDescription,
                      cover_image: editCoverPreview || undefined
                    }
                  });
                }
              }}
              disabled={editChapterMutation.isPending || !editCity || !editCountry}
              className="w-full h-10 bg-[#008060] hover:bg-[#006b51] text-white rounded-xl shadow-lg font-bold text-sm mt-4 transition-all hover:scale-[1.02] disabled:opacity-70 disabled:hover:scale-100"
            >
              {editChapterMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Extracted Modal Component to handle individual chapter query
function ChapterDetailModal({ selectedChapter, onClose, setLocation }: { selectedChapter: any, onClose: () => void, setLocation: any }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: chapterDetails, isLoading } = useQuery({
    queryKey: ['city-chapter', selectedChapter?.id],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/travel-chapters/${selectedChapter.id}`);
      if (!res.ok) throw new Error("Failed to fetch chapter details");
      return res.json();
    },
    enabled: !!selectedChapter,
  });

  const joinMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/travel-chapters/${selectedChapter.id}/join`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to join chapter");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Joined!", description: "You are now a member of this city chapter." });
      queryClient.invalidateQueries({ queryKey: ['city-chapter', selectedChapter.id] });
      queryClient.invalidateQueries({ queryKey: ['city-chapters'] });
      queryClient.invalidateQueries({ queryKey: ['my-city-chapters'] });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const isMember = chapterDetails?.isMember;
  const memberCount = chapterDetails?.members?.length || selectedChapter?.memberCount || 0;

  return (
    <Dialog open={!!selectedChapter} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[92vw] max-w-[600px] rounded-3xl p-0 overflow-hidden bg-white border border-gray-100 shadow-2xl">
        {selectedChapter && (
          <>
            {/* Image Header */}
            <div className="h-48 sm:h-64 w-full relative bg-gray-100">
                {selectedChapter.cover_image ? (
                  <img src={selectedChapter.cover_image} alt={selectedChapter.city} className="w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#008060] to-emerald-800 opacity-90" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                <div className="absolute bottom-6 left-6 right-6">
                  <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-2" style={{ fontFamily: 'Georgia, serif' }}>
                    {selectedChapter.city}
                  </h2>
                  <div className="flex items-center text-emerald-50">
                    <MapPin className="w-4 h-4 mr-1.5 opacity-80" />
                    <span className="font-medium">{selectedChapter.country}</span>
                  </div>
                </div>
              </div>

              {/* Content Body */}
              <div className="p-6 sm:p-8 max-h-[50vh] overflow-y-auto text-gray-800">
                <div className="mb-6 flex justify-between items-center">
                  <div>
                    <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">About this chapter</h4>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {selectedChapter.description || "A growing community of TKS alumni in this area. Connect with like-minded individuals, share resources, and help build our global network."}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-3xl font-black text-[#008060] block">{memberCount}</span>
                    <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Members</span>
                  </div>
                </div>
              </div>
              
              {/* Footer Actions */}
              <div className="p-6 border-t border-gray-100 flex flex-col sm:flex-row gap-3 bg-gray-50">
                <Button 
                  className="flex-1 h-12 bg-[#008060] hover:bg-[#006b51] text-white shadow-sm font-bold rounded-xl border-0"
                  onClick={() => setLocation(`/city-chapter/${selectedChapter.id}`)}
                >
                  <Users className="w-4 h-4 mr-2" /> Open Group Chat
                </Button>

                {selectedChapter.created_by !== user?.id && (
                  <>
                    {!isMember ? (
                      <Button 
                        className="flex-1 h-12 bg-white hover:bg-emerald-50 border border-emerald-200 text-[#008060] shadow-sm font-bold rounded-xl"
                        onClick={() => joinMutation.mutate()}
                        disabled={joinMutation.isPending || isLoading}
                      >
                        {joinMutation.isPending ? "Joining..." : <><Plus className="w-4 h-4 mr-2" /> Join Chapter</>}
                      </Button>
                    ) : (
                      <Button 
                        className="flex-1 h-12 bg-emerald-50 hover:bg-emerald-50 border border-emerald-200 text-[#008060] font-bold rounded-xl shadow-sm cursor-default"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" /> Member
                      </Button>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    );
}
