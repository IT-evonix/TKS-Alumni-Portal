import React, { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, Play, Image as ImageIcon, Pause } from "lucide-react";

interface MediaItem {
  id: string;
  type: "image" | "video";
  url: string;
  order_index: number;
}

interface Props {
  media: MediaItem[];
  autoPlay?: boolean;
}

export function TravelPostMediaGallery({ media, autoPlay = true }: Props) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const userActedRef = useRef(false);
  const sorted = [...media].sort((a, b) => a.order_index - b.order_index);

  const prev = useCallback(() => {
    userActedRef.current = true;
    setPaused(true);
    setIndex((i) => (i === 0 ? sorted.length - 1 : i - 1));
  }, [sorted.length]);

  const next = useCallback(() => {
    userActedRef.current = true;
    setPaused(true);
    setIndex((i) => (i === sorted.length - 1 ? 0 : i + 1));
  }, [sorted.length]);

  const goTo = useCallback((i: number) => {
    userActedRef.current = true;
    setPaused(true);
    setIndex(i);
  }, []);

  // Auto-advance every 4s, skip videos, pause after manual interaction
  useEffect(() => {
    if (!autoPlay || sorted.length <= 1) return;
    if (paused) return;
    const current = sorted[index];
    // Don't auto-advance on videos — let them play
    if (current?.type === "video") return;
    const id = setInterval(() => {
      setIndex((i) => (i === sorted.length - 1 ? 0 : i + 1));
    }, 4000);
    return () => clearInterval(id);
  }, [autoPlay, paused, index, sorted.length, sorted]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [prev, next]);

  if (sorted.length === 0) return null;

  const current = sorted[index];

  return (
    <div className="relative w-full overflow-hidden rounded-xl bg-black select-none">
      {/* Main media */}
      <div className="relative aspect-video w-full flex items-center justify-center">
        {current.type === "video" ? (
          <video
            key={current.url}
            src={current.url}
            controls
            className="w-full h-full object-contain"
          />
        ) : (
          <img
            key={current.url}
            src={current.url}
            alt={`Media ${index + 1}`}
            className="w-full h-full object-contain"
            loading="lazy"
          />
        )}

        {/* Count badge */}
        {sorted.length > 1 && (
          <div className="absolute top-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
            {index + 1} / {sorted.length}
          </div>
        )}

        {/* Type indicator */}
        <div className="absolute top-3 left-3 bg-black/50 text-white p-1 rounded-md">
          {current.type === "video" ? <Play className="w-3 h-3 fill-white" /> : <ImageIcon className="w-3 h-3" />}
        </div>
      </div>

      {/* Navigation arrows */}
      {sorted.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors"
            aria-label="Previous"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors"
            aria-label="Next"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Dot indicators */}
      {sorted.length > 1 && sorted.length <= 10 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
          {sorted.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`rounded-full transition-all duration-300 ${i === index ? "w-4 h-2 bg-white" : "w-2 h-2 bg-white/50 hover:bg-white/80"}`}
              aria-label={`Go to ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* Play/pause toggle for auto-scroll */}
      {sorted.length > 1 && autoPlay && sorted[index]?.type !== "video" && (
        <button
          onClick={() => setPaused((p) => !p)}
          className="absolute bottom-3 right-3 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 transition-colors"
          aria-label={paused ? "Resume slideshow" : "Pause slideshow"}
        >
          {paused ? <Play className="w-3 h-3 fill-white" /> : <Pause className="w-3 h-3 fill-white" />}
        </button>
      )}

      {/* Thumbnail strip for > 1 media */}
      {sorted.length > 1 && (
        <div className="flex gap-2 p-2 bg-gray-900 overflow-x-auto">
          {sorted.map((item, i) => (
            <button
              key={item.id}
              onClick={() => goTo(i)}
              className={`relative flex-shrink-0 w-14 h-14 rounded-md overflow-hidden border-2 transition-all ${
                i === index ? "border-white" : "border-transparent opacity-60 hover:opacity-90"
              }`}
            >
              {item.type === "video" ? (
                <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                  <Play className="w-4 h-4 text-white fill-white" />
                </div>
              ) : (
                <img src={item.url} alt={`Thumbnail ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
