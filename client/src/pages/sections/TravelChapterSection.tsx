import React, { useRef, useState, useMemo } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { Users, Globe, Plus, MapPin, UploadCloud, X, ImageIcon, Trash2, UserPlus, MessageSquare } from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CityAutocomplete } from "@/components/profile/CityAutocomplete";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadingState } from "@/components/common/LoadingState";
import { PageHeading } from "@/components/common/PageHeading";
import maplibregl from 'maplibre-gl';
import { supabase } from "@/lib/supabase";
import { generateCoordinatesForCity } from "@/components/TravelChaptersMap";

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

interface TravelChapterSectionProps {
  hideHeader?: boolean;
  chapters?: any[];
  isLoading?: boolean;
  mapBounds?: maplibregl.LngLatBounds | null;
  selectedChapter?: any | null;
  onChapterClick?: (chapter: any | null) => void;
  sidebarMode?: boolean;
}

export function TravelChapterSection({
  hideHeader = false,
  chapters = [],
  isLoading = false,
  mapBounds = null,
  selectedChapter: externalSelectedChapter,
  onChapterClick,
  sidebarMode = false
}: TravelChapterSectionProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: "-60px" });
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: myProposals = [] } = useQuery({
    queryKey: ['my-travel-chapters'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/travel-chapters/my-proposals');
      if (!res.ok) return [];
      return res.json();
    }
  });

  const [activeRegion, setActiveRegion] = useState("All");

  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [description, setDescription] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isMyProposalsOpen, setIsMyProposalsOpen] = useState(false);

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

  // Filter chapters based on map bounds
  const visibleChapters = useMemo(() => {
    let filtered = chapters;

    // Filter by bounds (ONLY on desktop)
    // On mobile, the map is small, so we always show the full list below it.
    if (isDesktop && mapBounds && filtered.length > 0) {
      filtered = filtered.filter(chap => {
        const [lng, lat] = generateCoordinatesForCity(chap.city);
        return mapBounds.contains([lng, lat]);
      });
    }

    return filtered;
  }, [chapters, mapBounds, isDesktop]);

  // Separate out current user's own chapters — only show in My Travel Chapters, not in directory
  const currentUserId = user?.id;
  const directoryChapters = useMemo(() =>
    visibleChapters.filter(chap => chap.created_by !== currentUserId),
    [visibleChapters, currentUserId]
  );

  const proposeMutation = useMutation({
    mutationFn: async () => {
      let cover_image_url = undefined;

      // Pass the base64 preview string directly to the backend
      if (coverPreview) {
        cover_image_url = coverPreview;
      }

      const res = await apiRequest('POST', '/api/travel-chapters', {
        city, country, description, cover_image: cover_image_url
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
      queryClient.invalidateQueries({ queryKey: ['travel-chapters'] });
      queryClient.invalidateQueries({ queryKey: ['my-travel-chapters'] });
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
      queryClient.invalidateQueries({ queryKey: ['travel-chapters'] });
      queryClient.invalidateQueries({ queryKey: ['my-travel-chapters'] });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this chapter proposal?")) {
      deleteMutation.mutate(id);
    }
  };

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
    <div ref={containerRef} className="relative h-full flex flex-col">

      {/* ── Header & Filters ──────────────────────────────────────────────────── */}
      <div className={`lg:sticky lg:top-0 lg:z-50 bg-white pt-6 flex ${sidebarMode ? 'flex-col gap-4 items-start px-6' : 'flex-col xl:flex-row xl:items-center px-4 sm:px-6'} justify-between mb-6 border-b border-gray-100 pb-6`}>
        <div>
          <PageHeading firstWord="Travel" secondWord="Chapters" className="mb-0" />
        </div>

        <div className={`flex flex-col sm:flex-row items-center gap-3 w-full ${sidebarMode ? 'sm:flex-col items-stretch' : 'xl:w-auto justify-end'}`}>
          <div className={`flex gap-3 w-full ${sidebarMode ? 'flex-col sm:flex-row sm:w-full' : ''}`}>
            <Dialog open={isMyProposalsOpen} onOpenChange={setIsMyProposalsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className={`px-5 rounded-md shadow-sm h-10 text-sm font-semibold border-gray-200 ${sidebarMode ? 'w-full flex-1' : 'w-full sm:w-auto'}`}>
                My Travel Chapters
                {myProposals.length > 0 && (
                  <span className="ml-2 bg-[#008060] text-white text-[10px] px-2 py-0.5 rounded-full">
                    {myProposals.length}
                  </span>
                )}
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[92vw] max-w-[600px] rounded-3xl p-0 max-h-[90vh] overflow-y-auto bg-white border-0 shadow-2xl">
              <div className="bg-gray-50 border-b border-gray-100 p-6">
                <DialogTitle className="text-xl font-bold text-gray-900">
                  My Travel Chapters
                </DialogTitle>
                <DialogDescription className="text-gray-500 mt-1">
                  Track the status of your travel chapter submissions.
                </DialogDescription>
              </div>
              <div className="p-6">
                {myProposals.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-12 px-4">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 border border-gray-100">
                      <Globe className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">No Submissions Yet</h3>
                    <p className="text-gray-500 text-sm max-w-[250px]">
                      You haven't proposed any travel chapters. Click "Propose Chapter" to start a community in your city!
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Location</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[80px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myProposals.map((prop: any) => (
                        <TableRow key={prop.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-md bg-gray-100 overflow-hidden flex-shrink-0">
                                {prop.cover_image ? (
                                  <img src={prop.cover_image} alt={prop.city} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-teal-600 opacity-80" />
                                )}
                              </div>
                              <div>
                                <div className="font-bold text-gray-900">{prop.city}</div>
                                <div className="text-xs text-gray-500">{prop.country}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {prop.status === 'pending' && <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-md uppercase tracking-wider">Pending</span>}
                            {prop.status === 'approved' && <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-md uppercase tracking-wider">Approved</span>}
                            {prop.status === 'rejected' && <span className="px-2.5 py-1 bg-red-100 text-red-700 text-[10px] font-bold rounded-md uppercase tracking-wider">Rejected</span>}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDelete(prop.id)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className={`whitespace-nowrap px-5 rounded-md bg-[#008060] hover:bg-[#006b51] text-white shadow-sm h-10 text-sm font-semibold flex items-center justify-center ${sidebarMode ? 'w-full flex-1' : 'w-full sm:w-auto'}`}>
                <Plus className="w-4 h-4 mr-1.5" /> Add Chapter
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[92vw] max-w-[500px] rounded-3xl p-0 max-h-[90vh] overflow-y-auto bg-white border-0 shadow-2xl">
              <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-6 sm:p-8 text-white rounded-t-3xl relative overflow-hidden">
                <div className="absolute top-0 right-0 opacity-10 transform translate-x-1/4 -translate-y-1/4">
                  <Globe className="w-48 h-48" />
                </div>
                <DialogHeader className="text-left relative z-10">
                  <DialogTitle className="text-2xl sm:text-3xl font-extrabold text-white">Start a Travel Chapter</DialogTitle>
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
                  className="w-full h-12 bg-gray-900 hover:bg-black text-white rounded-xl shadow-lg font-bold text-base mt-4 transition-all hover:scale-[1.02] disabled:opacity-70 disabled:hover:scale-100"
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
      </div>

      {/* ── Location Cards ──────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-6">
      {isLoading ? (
        <div className="py-20">
          <LoadingState message="Discovering travel chapters..." size="lg" />
        </div>
      ) : directoryChapters.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <MapPin className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">No Chapters in View</h3>
          <p className="text-gray-500 mt-2 max-w-sm">Pan or zoom the map to discover chapters in other areas, or propose a new one!</p>
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className={`grid ${sidebarMode ? 'grid-cols-1 gap-5' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6'} pb-10 px-2`}
        >
          <AnimatePresence>
            {directoryChapters.map((chap: any, i: number) => (
              <motion.div
                key={chap.id}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
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
                        {chap.status !== "pending" && (
                          <div className="flex-shrink-0 w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" title="Active"></div>
                        )}
                      </div>
                      <p className="text-xs font-medium text-gray-500 truncate mb-3">{chap.country}</p>
                      
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
                      {chap.status !== "pending" && (
                        <div className="absolute top-3 right-3 bg-black/80 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md flex items-center">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span> Active
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

                      <div className="w-full mt-auto py-2 rounded-md border border-gray-200 text-center text-gray-800 font-bold text-xs group-hover:border-[#008060] group-hover:bg-[#008060] group-hover:text-white transition-all">
                        View Chapter
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
      </div>

      {/* Chapter Detail Modal */}
      <Dialog open={!!selectedChapter} onOpenChange={(open) => !open && setSelectedChapter(null)}>
        <DialogContent className="w-[92vw] max-w-[600px] rounded-3xl p-0 overflow-hidden bg-white border-0 shadow-2xl">
          {selectedChapter && (
            <>
              {/* Image Header */}
              <div className="h-48 sm:h-64 w-full relative bg-gray-100">
                {selectedChapter.cover_image ? (
                  <img src={selectedChapter.cover_image} alt={selectedChapter.city} className="w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 to-teal-800 opacity-80" />
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
              <div className="p-6 sm:p-8 max-h-[50vh] overflow-y-auto">
                <div className="mb-6">
                  <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">About this chapter</h4>
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {selectedChapter.description || "A growing community of TKS alumni in this area. Connect with like-minded individuals, share resources, and help build our global network."}
                  </p>
                </div>
              </div>
              
              {/* Footer Actions */}
              <div className="p-6 border-t border-gray-100 flex gap-4 bg-gray-50/50">
                <Button 
                  className="flex-1 h-12 bg-[#008060] hover:bg-[#006b51] text-white shadow-sm font-bold rounded-xl"
                  onClick={() => {
                    if (selectedChapter.created_by) {
                      setLocation(`/profile/${selectedChapter.created_by}`);
                    } else {
                      setLocation('/connections');
                    }
                  }}
                >
                  <UserPlus className="w-4 h-4 mr-2" /> Connect
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1 h-12 border-gray-200 text-gray-700 hover:bg-gray-100 font-bold rounded-xl"
                  onClick={() => {
                    if (selectedChapter.created_by) {
                      const prefillMsg = encodeURIComponent(`Hi! I noticed your ${selectedChapter.city} Travel Chapter on the TKS Alumni Portal. It's great to see alumni building communities globally — would be happy to connect and exchange thoughts! 🌐`);
                      setLocation(`/inbox?user=${selectedChapter.created_by}&msg=${prefillMsg}`);
                    } else {
                      setLocation('/inbox');
                    }
                  }}
                >
                  <MessageSquare className="w-4 h-4 mr-2" /> Message
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
