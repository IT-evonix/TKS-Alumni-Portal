import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Map, useMap, AdvancedMarker, InfoWindow } from '@vis.gl/react-google-maps';

interface CityChaptersMapProps {
  chapters: any[];
  selectedChapter?: any;
  onBoundsChange?: (bounds: google.maps.LatLngBounds) => void;
  onChapterClick?: (chapter: any) => void;
  currentUserId?: string;
  onMapInteract?: () => void;
  resetTrigger?: number;
}

export function resolveChapterCoords(chapter: any): { lat: number; lng: number } | null {
  if (typeof chapter.latitude === 'number' && typeof chapter.longitude === 'number') {
    return { lat: chapter.latitude, lng: chapter.longitude };
  }
  // Legacy fallback for chapters created before geocoding was persisted server-side
  if (chapter.coordinates) {
    const parts = chapter.coordinates.split(',');
    const lng = parseFloat(parts[0]);
    const lat = parseFloat(parts[1]);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) return { lat, lng };
  }
  return null;
}

interface ActiveGroup {
  cityKey: string;
  coords: { lat: number; lng: number };
  chapters: any[];
}

function ChapterSlide({
  chapter,
  currentUserId,
  onChapterClick,
}: {
  chapter: any;
  currentUserId?: string;
  onChapterClick: (ch: any) => void;
}) {
  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, paddingRight: 24 }}>
        {chapter.cover_image ? (
          <img src={chapter.cover_image} alt="Cover" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', flexShrink: 0, border: '1px solid #e2e8f0' }} />
        ) : (
          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, border: '1px solid #fef3c7', flexShrink: 0 }}>📍</div>
        )}
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#111827', letterSpacing: '-0.01em', lineHeight: 1.2, wordWrap: 'break-word' }}>
            {chapter.name || `${chapter.city} Chapter`}
          </h3>
          <p style={{ margin: 0, fontSize: 12, color: '#6b7280', fontWeight: 500, marginTop: 2 }}>{chapter.country}</p>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, gap: 8, alignItems: 'center', padding: '10px 12px', background: '#f9fafb', borderRadius: 8, border: '1px solid #f3f4f6', boxSizing: 'border-box', width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span style={{ fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Host: Active</span>
          {chapter.isMember && (
            <span style={{ fontSize: 10, fontWeight: 'bold', color: '#008060', background: '#e6f5f0', padding: '2px 6px', borderRadius: 4, marginTop: 4, display: 'inline-block', width: 'max-content' }}>Member</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
          {chapter.created_by !== currentUserId ? (
            <>
              <a href={`/profile/${chapter.created_by}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, background: '#ecfdf5', color: '#10b981', borderRadius: '50%', textDecoration: 'none', border: '1px solid #d1fae5' }} title="Connect with Host">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
              </a>
              <a href={`/inbox?user=${chapter.created_by}&msg=${encodeURIComponent(`Hi! I noticed your ${chapter.city} City Chapter on the TKS Alumni Portal. It's great to see alumni building communities globally — would be happy to connect and exchange thoughts! 🌐`)}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, background: '#e6f5f0', color: '#008060', borderRadius: '50%', textDecoration: 'none', border: '1px solid #d0ede4' }} title="Message Host">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </a>
            </>
          ) : (
            <span style={{ fontSize: 10, fontWeight: 'bold', color: '#008060', background: '#e6f5f0', padding: '2px 6px', borderRadius: 4 }}>Host (You)</span>
          )}
        </div>
      </div>

      <button
        onClick={() => onChapterClick(chapter)}
        style={{ width: '100%', marginTop: 2, padding: '10px 12px', background: '#008060', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
        onMouseOver={e => (e.currentTarget.style.background = '#00664c')}
        onMouseOut={e => (e.currentTarget.style.background = '#008060')}
      >
        View Chapter →
      </button>
    </div>
  );
}

function CityChapterCarousel({
  chapters,
  currentSlide,
  onSlideChange,
  currentUserId,
  onChapterClick,
}: {
  chapters: any[];
  currentSlide: number;
  onSlideChange: (idx: number) => void;
  currentUserId?: string;
  onChapterClick: (ch: any) => void;
}) {
  const total = chapters.length;
  return (
    <div style={{ color: '#0f172a', minWidth: 180, maxWidth: 300, fontFamily: 'inherit' }}>
      <ChapterSlide
        chapter={chapters[currentSlide]}
        currentUserId={currentUserId}
        onChapterClick={onChapterClick}
      />
      {total > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
          <button
            onClick={() => onSlideChange((currentSlide - 1 + total) % total)}
            style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '50%', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#475569', padding: 0 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
            {chapters.map((_, i) => (
              <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i === currentSlide ? '#008060' : '#cbd5e1', flexShrink: 0 }} />
            ))}
          </div>
          <button
            onClick={() => onSlideChange((currentSlide + 1) % total)}
            style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '50%', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#475569', padding: 0 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      )}
    </div>
  );
}

function MapInner({
  groupedChapters,
  selectedChapter,
  onBoundsChange,
  onChapterClick,
  currentUserId,
  onMapInteract,
  resetTrigger,
}: {
  groupedChapters: Record<string, { coords: { lat: number; lng: number }; chapters: any[] }>;
  selectedChapter?: any;
  onBoundsChange?: (bounds: google.maps.LatLngBounds) => void;
  onChapterClick?: (chapter: any) => void;
  currentUserId?: string;
  onMapInteract?: () => void;
  resetTrigger?: number;
}) {
  const map = useMap();
  const isResettingRef = useRef(false);
  const [activeGroup, setActiveGroup] = useState<ActiveGroup | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [currentZoom, setCurrentZoom] = useState(2);

  // selectedChapter flyTo
  useEffect(() => {
    if (!map || !selectedChapter) return;
    const coords = resolveChapterCoords(selectedChapter);
    if (!coords) return;
    map.panTo(coords);
    map.setZoom(Math.max(map.getZoom() ?? 0, 12));
  }, [selectedChapter, map]);

  // resetTrigger
  useEffect(() => {
    if (!map || !resetTrigger) return;
    setActiveGroup(null);
    isResettingRef.current = true;
    map.panTo({ lat: 20, lng: 30 });
    map.setZoom(2);
    setTimeout(() => { isResettingRef.current = false; }, 1200);
  }, [resetTrigger, map]);

  const handleBoundsChanged = useCallback(() => {
    if (!map || !onBoundsChange) return;
    const b = map.getBounds();
    if (b) onBoundsChange(b);
  }, [map, onBoundsChange]);

  const handleZoomChanged = useCallback(() => {
    if (!map) return;
    const z = map.getZoom() ?? 2;
    setCurrentZoom(z);
    if (z < 4 && activeGroup) setActiveGroup(null);
    handleBoundsChanged();
  }, [map, activeGroup, handleBoundsChanged]);

  return (
    <Map
      mapId="city-chapters-map"
      defaultCenter={{ lat: 20, lng: 30 }}
      defaultZoom={2}
      maxZoom={14}
      minZoom={1}
      fullscreenControl
      zoomControl
      streetViewControl={false}
      rotateControl={false}
      scaleControl={false}
      gestureHandling="greedy"
      onBoundsChanged={handleBoundsChanged}
      onZoomChanged={handleZoomChanged}
      onDragstart={() => {
        if (!isResettingRef.current && onMapInteract) onMapInteract();
      }}
      className="absolute inset-0"
    >
      {Object.entries(groupedChapters).map(([cityKey, { coords, chapters: locationChapters }]) => (
        <AdvancedMarker
          key={cityKey}
          position={coords}
          onClick={() => {
            if (onMapInteract) onMapInteract();
            map?.panTo(coords);
            map?.setZoom(Math.max(map.getZoom() ?? 0, 12));
            setCurrentSlide(0);
            setActiveGroup({ cityKey, coords, chapters: locationChapters });
          }}
        >
          <div style={{ position: 'relative', cursor: 'pointer' }}>
            <svg width="24" height="36" viewBox="0 0 24 36" style={{ display: 'block' }}>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24S24 21 24 12C24 5.373 18.627 0 12 0z" fill="#008060" />
              <circle cx="12" cy="12" r="5" fill="white" />
            </svg>
            {locationChapters.length > 1 && (
              <div style={{
                position: 'absolute', top: -8, right: -8,
                background: '#ef4444', color: 'white', borderRadius: '50%',
                width: 20, height: 20, fontSize: 11, fontWeight: 'bold',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '2px solid white', boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
              }}>
                {locationChapters.length}
              </div>
            )}
          </div>
        </AdvancedMarker>
      ))}

      {activeGroup && (
        <InfoWindow
          position={activeGroup.coords}
          onCloseClick={() => setActiveGroup(null)}
          maxWidth={320}
        >
          <CityChapterCarousel
            chapters={activeGroup.chapters}
            currentSlide={currentSlide}
            onSlideChange={setCurrentSlide}
            currentUserId={currentUserId}
            onChapterClick={(chapter) => {
              if (document.fullscreenElement) {
                document.exitFullscreen().catch(err => console.error(err));
              }
              onChapterClick?.(chapter);
              setActiveGroup(null);
            }}
          />
        </InfoWindow>
      )}
    </Map>
  );
}

export function CityChaptersMap({
  chapters,
  selectedChapter,
  onBoundsChange,
  onChapterClick,
  currentUserId,
  onMapInteract,
  resetTrigger,
}: CityChaptersMapProps) {
  // Group chapters by city+country
  const groupedChapters = useMemo(() => {
    const groups: Record<string, { coords: { lat: number; lng: number }; chapters: any[] }> = {};

    chapters.forEach(chap => {
      const coords = resolveChapterCoords(chap);
      if (!coords) return;
      const cityKey = `${(chap.city || '').trim().toLowerCase()}__${(chap.country || '').trim().toLowerCase()}`;
      if (!groups[cityKey]) {
        groups[cityKey] = { coords, chapters: [] };
      }
      groups[cityKey].chapters.push(chap);
    });

    return groups;
  }, [chapters]);

  return (
    <div className="relative w-full h-full bg-slate-50 overflow-visible z-50 lg:z-10">
      <MapInner
        groupedChapters={groupedChapters}
        selectedChapter={selectedChapter}
        onBoundsChange={onBoundsChange}
        onChapterClick={onChapterClick}
        currentUserId={currentUserId}
        onMapInteract={onMapInteract}
        resetTrigger={resetTrigger}
      />
    </div>
  );
}
