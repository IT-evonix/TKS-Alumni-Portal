import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface TravelChaptersMapProps {
  chapters: any[];
  onBoundsChange?: (bounds: maplibregl.LngLatBounds) => void;
  onChapterClick?: (chapter: any) => void;
}

// Simple hash function to generate consistent rough coordinates for a city
// Since we don't store actual Lat/Lng for travel chapters right now.
export function generateCoordinatesForCity(city: string): [number, number] {
  // Known major cities fallback
  const known: Record<string, [number, number]> = {
    'Paris': [2.3522, 48.8566],
    'New York': [-74.0060, 40.7128],
    'Tokyo': [139.6917, 35.6895],
    'London': [-0.1276, 51.5074],
    'Dubai': [55.2708, 25.2048],
    'San Francisco': [-122.4194, 37.7749],
    'Cape Town': [18.4232, -33.9249],
    'Sydney': [151.2093, -33.8688],
    'Singapore': [103.8198, 1.3521],
    'Toronto': [-79.3832, 43.6532],
    'Pimpri-Chinchwad': [73.7868, 18.6298],
    'Pune': [73.8567, 18.5204],
    'Mumbai': [72.8777, 19.0760],
    'Delhi': [77.1025, 28.7041],
    'Bangalore': [77.5946, 12.9716],
    'Berlin': [13.4050, 52.5200],
    'Amsterdam': [4.9041, 52.3676],
    'Barcelona': [2.1734, 41.3851],
    'Chicago': [-87.6298, 41.8781],
    'Los Angeles': [-118.2437, 34.0522],
  };

  if (known[city]) return known[city];

  // Pseudo-random coordinates
  let hash = 0;
  for (let i = 0; i < city.length; i++) {
    hash = city.charCodeAt(i) + ((hash << 5) - hash);
  }
  const lng = ((Math.abs(hash) % 360) - 180);
  // Keep lat within populated regions mostly (-50 to 60)
  const lat = ((Math.abs(hash >> 8) % 110) - 50);
  return [lng, lat];
}

export function TravelChaptersMap({ chapters, onBoundsChange, onChapterClick }: TravelChaptersMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const activePopupRef = useRef<maplibregl.Popup | null>(null);

  // 1. Initialize Map exactly once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: [30, 20],
      zoom: 0.8,
      maxZoom: 14,
      minZoom: 0.5,
      attributionControl: false,
      scrollZoom: true,
      dragPan: true,
    });

    // Add class for scoped CSS
    containerRef.current.classList.add('travel-chapters-map');

    // Inject styles: clip ONLY the canvas to rounded corners, allow popup to overflow
    if (!document.getElementById('chapter-map-popup-style')) {
      const style = document.createElement('style');
      style.id = 'chapter-map-popup-style';
      style.textContent = `
        .travel-chapters-map {
          overflow: visible !important;
        }
        .travel-chapters-map .maplibregl-canvas-container {
          overflow: hidden;
          border-radius: inherit;
        }
        .chapter-popup .maplibregl-popup-content {
          border-radius: 16px !important;
          padding: 16px !important;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1) !important;
          border: 1px solid #e2e8f0;
          box-sizing: border-box;
        }
        @media (max-width: 640px) {
          .chapter-popup .maplibregl-popup-content {
            padding: 12px !important;
            width: 260px !important;
          }
          .chapter-popup {
            max-width: 90vw !important;
            z-index: 50;
          }
        }
        .chapter-popup .maplibregl-popup-close-button {
          font-size: 20px !important;
          color: #94a3b8 !important;
          top: 10px !important;
          right: 10px !important;
          padding: 0 !important;
          width: 28px !important;
          height: 28px !important;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50% !important;
          background: transparent;
          transition: all 0.2s ease;
        }
        .chapter-popup .maplibregl-popup-close-button:hover {
          background-color: #f1f5f9 !important;
          color: #0f172a !important;
        }
      `;
      document.head.appendChild(style);
    }

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

    map.on('moveend', () => {
      if (onBoundsChange) onBoundsChange(map.getBounds());
    });
    map.on('zoomend', () => {
      if (onBoundsChange) onBoundsChange(map.getBounds());
      // Auto-close popup when zoomed out beyond marker visibility
      if (map.getZoom() < 4 && activePopupRef.current) {
        activePopupRef.current.remove();
        activePopupRef.current = null;
      }
    });
    // Close popup when user starts dragging the map
    map.on('dragstart', () => {
      if (activePopupRef.current) {
        activePopupRef.current.remove();
        activePopupRef.current = null;
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []); // Empty dependency array ensures map is only created once

  // 2. Add/Update markers when chapters change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Make sure window slide state is initialized
    if (!(window as any).__slideState) {
      (window as any).__slideState = {};
      
      (window as any).__updateDots = (key: string, current: number, total: number) => {
        for(let i=0; i<total; i++) {
          const dot = document.getElementById(`dot-${key}-${i}`);
          if(dot) dot.style.background = i === current ? '#008060' : '#cbd5e1';
        }
      };
      
      (window as any).__nextSlide = (key: string, total: number) => {
        let current = (window as any).__slideState[key] || 0;
        const currentSlide = document.getElementById(`slide-${key}-${current}`);
        if (currentSlide) currentSlide.style.display = 'none';
        current = (current + 1) % total;
        (window as any).__slideState[key] = current;
        const nextSlide = document.getElementById(`slide-${key}-${current}`);
        if (nextSlide) nextSlide.style.display = 'block';
        (window as any).__updateDots(key, current, total);
      };
      
      (window as any).__prevSlide = (key: string, total: number) => {
        let current = (window as any).__slideState[key] || 0;
        const currentSlide = document.getElementById(`slide-${key}-${current}`);
        if (currentSlide) currentSlide.style.display = 'none';
        current = (current - 1 + total) % total;
        (window as any).__slideState[key] = current;
        const prevSlide = document.getElementById(`slide-${key}-${current}`);
        if (prevSlide) prevSlide.style.display = 'block';
        (window as any).__updateDots(key, current, total);
      };
    }

    // Group chapters by location to show carousel for multiple chapters at same location
    const groupedChapters: Record<string, any[]> = {};
    chapters.forEach(chap => {
      const [lng, lat] = generateCoordinatesForCity(chap.city);
      const key = `${lng},${lat}`;
      if (!groupedChapters[key]) {
        groupedChapters[key] = [];
      }
      groupedChapters[key].push(chap);
    });

    Object.entries(groupedChapters).forEach(([key, locationChapters]) => {
      const [lngStr, latStr] = key.split(',');
      const lng = parseFloat(lngStr);
      const lat = parseFloat(latStr);

      // Use default MapLibre marker (reliable, known to work)
      const marker = new maplibregl.Marker({ color: '#008060', scale: 0.85 })
        .setLngLat([lng, lat])
        .addTo(map);

      // Add badge if multiple chapters at this location
      if (locationChapters.length > 1) {
        const badge = document.createElement('div');
        badge.style.position = 'absolute';
        badge.style.top = '-8px';
        badge.style.right = '-8px';
        badge.style.background = '#ef4444';
        badge.style.color = 'white';
        badge.style.borderRadius = '50%';
        badge.style.width = '20px';
        badge.style.height = '20px';
        badge.style.display = 'flex';
        badge.style.alignItems = 'center';
        badge.style.justifyContent = 'center';
        badge.style.fontSize = '11px';
        badge.style.fontWeight = 'bold';
        badge.style.border = '2px solid white';
        badge.style.boxShadow = '0 1px 2px rgba(0,0,0,0.2)';
        badge.innerText = locationChapters.length.toString();
        marker.getElement().appendChild(badge);
      }

      marker.getElement().style.cursor = 'pointer';

      marker.getElement().addEventListener('click', (e) => {
        e.stopPropagation();
        const map = mapRef.current;
        if (!map) return;

        // Close any existing popup
        if (activePopupRef.current) {
          activePopupRef.current.remove();
          activePopupRef.current = null;
        }

        const isMobile = window.innerWidth < 640;
        const mapHeight = map.getContainer().clientHeight;
        const yOffset = isMobile ? Math.floor(mapHeight * 0.25) : 0;

        // Fly to location smoothly
        map.flyTo({
          center: [lng, lat],
          offset: [0, yOffset],
          zoom: Math.max(map.getZoom(), 6),
          duration: 900,
          essential: true,
        });

        // Group ID to track slider state
        const groupId = locationChapters[0].id;
        (window as any).__slideState[groupId] = 0;

        const slidesHtml = locationChapters.map((chap, index) => {
          const coverImageHtml = chap.cover_image
            ? `<img src="${chap.cover_image}" alt="Cover" style="width: 44px; height: 44px; border-radius: 10px; object-fit: cover; flex-shrink: 0; border: 1px solid #e2e8f0;" />`
            : `<div style="width: 44px; height: 44px; border-radius: 10px; background: #fffbeb; color: #d97706; display: flex; align-items: center; justify-content: center; font-size: 20px; border: 1px solid #fef3c7; flex-shrink: 0;">📍</div>`;

          return `
            <div id="slide-${groupId}-${index}" style="display: ${index === 0 ? 'block' : 'none'}; width: 100%;">
              <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 12px; padding-right: 24px; word-wrap: break-word;">
                ${coverImageHtml}
                <div style="min-width: 0;">
                  <h3 style="margin: 0; font-size: 15px; font-weight: 800; color: #0f172a; letter-spacing: -0.01em; line-height: 1.2; word-wrap: break-word; overflow-wrap: break-word;">${chap.name || `${chap.city} Chapter`}</h3>
                  <p style="margin: 0; font-size: 12px; color: #64748b; font-weight: 500; margin-top: 2px;">${chap.country}</p>
                </div>
              </div>

              <div style="display: flex; justify-content: space-between; margin-bottom: 12px; gap: 8px; align-items: center; padding: 10px 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; transition: all 0.2s ease; box-sizing: border-box; width: 100%;">
                <div style="display: flex; flex-direction: column; min-width: 0;">
                  <span style="font-size: 11px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Host: Active</span>
                </div>
                <div style="display: flex; gap: 6px; flex-shrink: 0;">
                  <a href="/profile/${chap.created_by}" style="display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: #ecfdf5; color: #10b981; border-radius: 50%; text-decoration: none; border: 1px solid #d1fae5;" title="Connect with Host" onmouseover="this.style.background='#d1fae5'" onmouseout="this.style.background='#ecfdf5'">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="19" y1="8" x2="19" y2="14"></line><line x1="22" y1="11" x2="16" y2="11"></line></svg>
                  </a>
                  <a href="/inbox?user=${chap.created_by}&msg=${encodeURIComponent(`Hi! I noticed your ${chap.city} Travel Chapter on the TKS Alumni Portal. It's great to see alumni building communities globally — would be happy to connect and exchange thoughts! 🌐`)}" style="display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: #eff6ff; color: #3b82f6; border-radius: 50%; text-decoration: none; border: 1px solid #dbeafe;" title="Message Host" onmouseover="this.style.background='#dbeafe'" onmouseout="this.style.background='#eff6ff'">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                  </a>
                </div>
              </div>

              <button
                onclick="window.__openTravelChapter && window.__openTravelChapter('${chap.id}')"
                style="width: 100%; margin-top: 2px; padding: 10px 12px; background: #008060; color: white; border: none; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; transition: background 0.15s;"
                onmouseover="this.style.background='#005c46'"
                onmouseout="this.style.background='#008060'"
              >
                View Chapter &rarr;
              </button>
            </div>
          `;
        }).join('');

        const carouselControlsHtml = locationChapters.length > 1 ? `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px; padding-top: 12px; border-top: 1px solid #e2e8f0; width: 100%;">
            <button onclick="window.__prevSlide('${groupId}', ${locationChapters.length})" style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 50%; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #475569; padding: 0;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
            <div style="display: flex; gap: 4px; overflow-x: hidden; max-width: 100px; justify-content: center;">
              ${locationChapters.map((_, i) => `<div id="dot-${groupId}-${i}" style="width: 6px; height: 6px; border-radius: 50%; background: ${i === 0 ? '#008060' : '#cbd5e1'}; flex-shrink: 0;"></div>`).join('')}
            </div>
            <button onclick="window.__nextSlide('${groupId}', ${locationChapters.length})" style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 50%; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #475569; padding: 0;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
          </div>
        ` : '';

        const html = `
          <div style="color: #0f172a; padding: 0px; width: 100%; min-width: 180px; max-width: 100%; font-family: inherit; box-sizing: border-box;">
            ${slidesHtml}
            ${carouselControlsHtml}
          </div>
        `;

        const popup = new maplibregl.Popup({
          closeButton: true,
          closeOnClick: true,
          offset: 36,
          maxWidth: '300px',
          className: 'chapter-popup',
        })
          .setLngLat([lng, lat])
          .setHTML(html)
          .addTo(map);

        activePopupRef.current = popup;

        (window as any).__openTravelChapter = (id: string) => {
          const chapter = chapters.find(c => c.id === id);
          if (chapter && onChapterClick) {
            onChapterClick(chapter);
            popup.remove();
            activePopupRef.current = null;
          }
        };
      });

      markersRef.current.push(marker);
    });

    // Fire initial bounds change so the list filters properly
    if (onBoundsChange) {
      onBoundsChange(map.getBounds());
    }

  }, [chapters, onChapterClick, onBoundsChange]);

  return (
    <div className="relative w-full h-full bg-slate-50 overflow-visible z-50 lg:z-10">
      <div ref={containerRef} className="absolute inset-0" />
    </div>
  );
}
