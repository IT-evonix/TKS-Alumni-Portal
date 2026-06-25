import React, { useState, useRef, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MapPin, Upload, Link, FileText, Eye, X, Plus, Play, Loader2, ChevronLeft, ChevronRight, Image as ImageIcon,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CityAutocomplete } from "@/components/profile/CityAutocomplete";
import { clientConfig } from "@/lib/config";

// ---- Types ----

interface MediaFile {
  id: string;
  file: File;
  dataUri: string;
  type: "image" | "video";
  order_index: number;
}

interface LinkItem {
  id: string;
  url: string;
  title: string;
  description: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

const STEPS = ["Location", "Media", "Links", "Caption", "Preview"] as const;
const MAX_MEDIA = 10;
const MAX_LINKS = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime";

function getHeaders() {
  const token = localStorage.getItem("auth_token") || "";
  return {
    "Content-Type": "application/json",
    "user-id": localStorage.getItem("userId") || "",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function uid() { return Math.random().toString(36).slice(2); }

// ---- Preview Step with carousel ----

function PreviewStep({ mediaFiles, city, country, caption, links }: {
  mediaFiles: MediaFile[];
  city: string;
  country: string;
  caption: string;
  links: LinkItem[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef<NodeJS.Timeout | null>(null);

  const scrollTo = useCallback((index: number) => {
    setActiveIndex(index);
    if (carouselRef.current) {
      const child = carouselRef.current.children[index] as HTMLElement;
      if (child) child.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, []);

  // Auto-advance every 3s
  useEffect(() => {
    if (mediaFiles.length <= 1) return;
    autoScrollRef.current = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % mediaFiles.length;
        if (carouselRef.current) {
          const child = carouselRef.current.children[next] as HTMLElement;
          if (child) child.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
        return next;
      });
    }, 3000);
    return () => { if (autoScrollRef.current) clearInterval(autoScrollRef.current); };
  }, [mediaFiles.length]);

  const handleDotClick = (index: number) => {
    if (autoScrollRef.current) clearInterval(autoScrollRef.current);
    scrollTo(index);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Preview your travel post before publishing.</p>
      <div className="border border-gray-200 rounded-2xl overflow-hidden">
        {mediaFiles.length > 0 ? (
          <div className="relative aspect-video bg-black">
            {/* Carousel track */}
            <div
              ref={carouselRef}
              className="flex h-full overflow-x-hidden"
              style={{ scrollSnapType: 'x mandatory' }}
            >
              {mediaFiles.map((m, i) => (
                <div
                  key={m.id}
                  className="flex-shrink-0 w-full h-full"
                  style={{ scrollSnapAlign: 'center' }}
                >
                  {m.type === "video" ? (
                    <video src={m.dataUri} className="w-full h-full object-cover" controls />
                  ) : (
                    <img src={m.dataUri} alt={`media-${i}`} className="w-full h-full object-cover" />
                  )}
                </div>
              ))}
            </div>

            {/* Prev / Next arrows */}
            {mediaFiles.length > 1 && (
              <>
                <button
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1.5 transition"
                  onClick={() => handleDotClick((activeIndex - 1 + mediaFiles.length) % mediaFiles.length)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1.5 transition"
                  onClick={() => handleDotClick((activeIndex + 1) % mediaFiles.length)}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            )}

            {/* Dot indicators */}
            {mediaFiles.length > 1 && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                {mediaFiles.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => handleDotClick(i)}
                    className={`w-1.5 h-1.5 rounded-full transition-all ${i === activeIndex ? 'bg-white w-3' : 'bg-white/50'}`}
                  />
                ))}
              </div>
            )}

            {/* Counter badge */}
            {mediaFiles.length > 1 && (
              <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
                {activeIndex + 1}/{mediaFiles.length}
              </div>
            )}
          </div>
        ) : (
          <div className="aspect-video bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center">
            <div className="text-center text-white">
              <MapPin className="w-12 h-12 mx-auto mb-2 opacity-80" />
              <span className="text-xl font-semibold">{city}</span>
            </div>
          </div>
        )}

        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-blue-600">
            <MapPin className="w-4 h-4" />
            <span className="font-medium">{city}, {country}</span>
          </div>
          {caption && <p className="text-sm text-gray-700 whitespace-pre-wrap">{caption}</p>}
          {links.filter((l) => l.url && l.title).length > 0 && (
            <div className="space-y-1">
              {links.filter((l) => l.url && l.title).map((l) => (
                <div key={l.id} className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 px-2 py-1.5 rounded-lg truncate">
                  <Link className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{l.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Step indicator ----

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1 mb-4">
      {STEPS.map((label, i) => (
        <React.Fragment key={label}>
          <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold border-2 transition-all ${
            i < current ? "bg-blue-500 border-blue-500 text-white" :
            i === current ? "border-blue-500 text-blue-600" :
            "border-gray-200 text-gray-400"
          }`}>
            {i < current ? "✓" : i + 1}
          </div>
          {i < total - 1 && <div className={`flex-1 h-0.5 ${i < current ? "bg-blue-500" : "bg-gray-200"}`} />}
        </React.Fragment>
      ))}
    </div>
  );
}

// ---- Main component ----

export function TravelPostCreateModal({ open, onClose, onCreated }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [coordinates, setCoordinates] = useState("");
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [caption, setCaption] = useState("");

  function resetForm() {
    setStep(0);
    setCity(""); setCountry(""); setCoordinates("");
    setMediaFiles([]); setLinks([]); setCaption("");
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  // ---- Media handling ----

  const encodeFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const incoming = Array.from(files);
    const remaining = MAX_MEDIA - mediaFiles.length;
    if (remaining <= 0) { toast({ title: `Maximum ${MAX_MEDIA} media items allowed`, variant: "destructive" }); return; }

    const toAdd: MediaFile[] = [];
    for (const file of incoming.slice(0, remaining)) {
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      if (!isImage && !isVideo) {
        toast({ title: `Unsupported file: ${file.name}`, variant: "destructive" });
        continue;
      }
      const maxBytes = isImage ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
      if (file.size > maxBytes) {
        toast({ title: `${file.name} exceeds ${isImage ? "5MB" : "50MB"} limit`, variant: "destructive" });
        continue;
      }
      const dataUri = await encodeFile(file);
      toAdd.push({ id: uid(), file, dataUri, type: isImage ? "image" : "video", order_index: mediaFiles.length + toAdd.length });
    }
    setMediaFiles((prev) => [...prev, ...toAdd]);
  }, [mediaFiles.length, toast]);

  function removeMedia(id: string) {
    setMediaFiles((prev) => prev.filter((m) => m.id !== id).map((m, i) => ({ ...m, order_index: i })));
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  }

  // ---- Links handling ----

  function addLink() {
    if (links.length >= MAX_LINKS) { toast({ title: `Maximum ${MAX_LINKS} links allowed`, variant: "destructive" }); return; }
    setLinks((prev) => [...prev, { id: uid(), url: "", title: "", description: "" }]);
  }

  function updateLink(id: string, field: keyof LinkItem, value: string) {
    setLinks((prev) => prev.map((l) => l.id === id ? { ...l, [field]: value } : l));
  }

  function removeLink(id: string) {
    setLinks((prev) => prev.filter((l) => l.id !== id));
  }

  // ---- Validation ----

  function canProceed(): boolean {
    if (step === 0) return city.trim().length > 0 && country.trim().length > 0;
    if (step === 2) {
      return links.every((l) => {
        if (!l.url.trim() || !l.title.trim()) return false;
        try { new URL(l.url); return true; } catch { return false; }
      });
    }
    return true;
  }

  // ---- Submit ----

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const validLinks = links.filter((l) => l.url.trim() && l.title.trim());
      const body = {
        city: city.trim(),
        country: country.trim(),
        coordinates: coordinates || undefined,
        caption: caption.trim() || undefined,
        media: mediaFiles.map((m, i) => ({ data: m.dataUri, order_index: i })),
        links: validLinks.map((l, i) => ({ url: l.url.trim(), title: l.title.trim(), description: l.description.trim() || undefined, order_index: i })),
      };

      const res = await fetch(`${clientConfig.apiUrl}/api/travel-posts`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to create post");
      }

      queryClient.invalidateQueries({ queryKey: ["travel-posts"] });
      queryClient.invalidateQueries({ queryKey: ["travel-my-posts"] });
      toast({ title: "Story submitted for review!", description: `Your travel post from ${city} will be visible once an admin approves it.` });
      resetForm();
      onClose();
      onCreated?.();
    } catch (err: any) {
      toast({ title: err.message || "Failed to publish post", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  // ---- Step content ----

  function renderStep() {
    switch (step) {
      case 0: // Location
        return (
          <div className="space-y-4 pb-64">
            <p className="text-sm text-gray-500">Where did you travel to?</p>
            <CityAutocomplete
              city={city}
              onCityChange={setCity}
              onLocationSelect={(c, _s, co, lat, lng) => {
                setCity(c);
                setCountry(co);
                if (lat != null && lng != null) setCoordinates(`${lng},${lat}`);
                if (c && co) setTimeout(() => setStep((s) => s + 1), 300);
              }}
            />
            {city && country && (
              <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 px-3 py-2 rounded-lg">
                <MapPin className="w-4 h-4" />
                <span>{city}, {country}</span>
              </div>
            )}
          </div>
        );

      case 1: // Media
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Add photos and videos from your trip. ({mediaFiles.length}/{MAX_MEDIA})
            </p>

            {/* Drop zone */}
            {mediaFiles.length < MAX_MEDIA && (
              <div
                className="border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-xl p-6 text-center cursor-pointer transition-colors"
                onClick={() => fileInputRef.current?.click()}
                onDrop={onDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-600 font-medium">Drop files here or click to browse</p>
                <p className="text-xs text-gray-400 mt-1">Images up to 5MB · Videos up to 50MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_TYPES}
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && addFiles(e.target.files)}
                />
              </div>
            )}

            {/* Thumbnails */}
            {mediaFiles.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {mediaFiles.map((m) => (
                  <div key={m.id} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                    {m.type === "video" ? (
                      <div className="w-full h-full flex items-center justify-center bg-gray-800">
                        <Play className="w-8 h-8 text-white fill-white" />
                        <span className="absolute bottom-1 left-1 text-white text-xs bg-black/50 px-1 rounded">video</span>
                      </div>
                    ) : (
                      <img src={m.dataUri} alt="preview" className="w-full h-full object-cover" />
                    )}
                    <button
                      onClick={() => removeMedia(m.id)}
                      className="absolute top-1 right-1 bg-black/60 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <span className="absolute bottom-1 left-1 bg-black/50 text-white text-xs px-1 rounded">
                      {m.order_index + 1}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 2: // Links
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Add relevant links to share with your story. ({links.length}/{MAX_LINKS})</p>
            {links.map((link) => (
              <div key={link.id} className="border border-gray-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 font-medium">Link</span>
                  <button onClick={() => removeLink(link.id)} className="text-gray-400 hover:text-red-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <Input
                  placeholder="https://example.com"
                  value={link.url}
                  onChange={(e) => updateLink(link.id, "url", e.target.value)}
                  className="text-sm"
                />
                <Input
                  placeholder="Title (required)"
                  value={link.title}
                  onChange={(e) => updateLink(link.id, "title", e.target.value)}
                  className="text-sm"
                  maxLength={200}
                />
                <Input
                  placeholder="Description (optional)"
                  value={link.description}
                  onChange={(e) => updateLink(link.id, "description", e.target.value)}
                  className="text-sm"
                  maxLength={500}
                />
                {link.url && !(() => { try { new URL(link.url); return true; } catch { return false; } })() && (
                  <p className="text-xs text-red-500">Please enter a valid URL (include https://)</p>
                )}
              </div>
            ))}
            {links.length < MAX_LINKS && (
              <Button variant="outline" size="sm" onClick={addLink} className="w-full">
                <Plus className="w-4 h-4 mr-1" /> Add Link
              </Button>
            )}
            {links.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-2">No links added. This step is optional.</p>
            )}
          </div>
        );

      case 3: // Caption
        return (
          <div className="space-y-2">
            <p className="text-sm text-gray-500">Tell the story behind your travels. (optional)</p>
            <Textarea
              placeholder="What was this trip like? Share the highlights, tips, or memories…"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={5000}
              rows={6}
              className="resize-none text-sm"
            />
            <p className="text-xs text-gray-400 text-right">{caption.length}/5000</p>
          </div>
        );

      case 4: // Preview
        return <PreviewStep mediaFiles={mediaFiles} city={city} country={country} caption={caption} links={links} />;

      default:
        return null;
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-lg p-0 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Fixed header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <MapPin className="w-5 h-5 text-blue-500" />
              Share Your Travel Story
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <StepIndicator current={step} total={STEPS.length} />
          </div>
          <div className="mt-1 text-sm font-semibold text-gray-800">{STEPS[step]}</div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          {renderStep()}
        </div>

        {/* Fixed footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-white flex-shrink-0">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 0}
            className="gap-1 text-gray-600"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </Button>

          {step < STEPS.length - 1 ? (
            <Button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canProceed()}
              className="gap-1 bg-teal-600 hover:bg-teal-700"
            >
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={submitting || !city || !country}
              className="gap-1 bg-teal-600 hover:bg-teal-700"
            >
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Publishing…</> : "Publish Post"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
