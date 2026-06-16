import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface TravelChaptersMapProps {
  chapters: any[];
  selectedChapter?: any;
  onBoundsChange?: (bounds: maplibregl.LngLatBounds) => void;
  onChapterClick?: (chapter: any) => void;
  currentUserId?: string;
  onMapInteract?: () => void;
  resetTrigger?: number;
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
    'Bondi Beach': [151.2743, -33.8915],
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
    'Hyderabad': [78.4867, 17.3850],
    'Chennai': [80.2707, 13.0827],
    'Kolkata': [88.3639, 22.5726],
    'Ahmedabad': [72.5714, 23.0225],
    'Seattle': [-122.3321, 47.6062],
    'Austin': [-97.7431, 30.2672],
    'Vancouver': [-123.1207, 49.2827],
    'Montreal': [-73.5673, 45.5017],
    'Melbourne': [144.9631, -37.8136],
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

export function TravelChaptersMap({ chapters, selectedChapter, onBoundsChange, onChapterClick, currentUserId, onMapInteract, resetTrigger }: TravelChaptersMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const activePopupRef = useRef<maplibregl.Popup | null>(null);
  const isResettingRef = useRef(false);

  // 1. Initialize Map exactly once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
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
        /* Let popup escape map container */
        .travel-chapters-map {
          overflow: visible !important;
        }
        /* Only clip the actual map canvas to the border radius */
        .travel-chapters-map .maplibregl-canvas-container,
        .travel-chapters-map .maplibregl-canvas {
          border-radius: 0 0 16px 16px;
          overflow: hidden;
        }
        /* Popup always on top, never clipped */
        .maplibregl-popup {
          z-index: 9999 !important;
          overflow: visible !important;
        }
        .chapter-popup {
          z-index: 9999 !important;
        }
        
        /* Light Theme Popup */
        .chapter-popup .maplibregl-popup-content {
          border-radius: 12px !important;
          padding: 16px !important;
          background: white !important;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15) !important;
          border: 1px solid #e5e7eb;
          box-sizing: border-box;
          color: #111827 !important;
          overflow: visible !important;
        }
        
        .chapter-popup .maplibregl-popup-tip {
          border-top-color: white !important;
        }
        .maplibregl-popup-anchor-bottom .maplibregl-popup-tip {
          border-top-color: white !important;
        }
        
        @media (max-width: 640px) {
          .chapter-popup .maplibregl-popup-content {
            padding: 12px !important;
            width: 260px !important;
          }
          .chapter-popup {
            max-width: 90vw !important;
            z-index: 9999 !important;
          }
        }
        
        .chapter-popup .maplibregl-popup-close-button {
          font-size: 20px !important;
          color: #6b7280 !important;
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
          background-color: #f3f4f6 !important;
          color: #111827 !important;
        }
      `;
      document.head.appendChild(style);
    }

    map.addControl(new maplibregl.FullscreenControl(), 'top-right');
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

    const handleInteract = () => {
      if (isResettingRef.current) return;
      if (onMapInteract) onMapInteract();
    };

    map.on('dragstart', () => {
      isResettingRef.current = false; // User manual control, cancel resetting flag
      handleInteract();
      if (activePopupRef.current && window.innerWidth < 640) {
        activePopupRef.current.remove();
        activePopupRef.current = null;
      }
    });
    map.on('zoomstart', handleInteract);

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

    // Group chapters by city+country so same-city chapters always merge into one marker with a slider
    const groupedChapters: Record<string, any[]> = {};
    // Also track representative coordinates per group
    const groupCoords: Record<string, [number, number]> = {};

    chapters.forEach(chap => {
      // Normalize key: lower-case city+country so "Pune, India" and "pune, india" merge
      const cityKey = `${(chap.city || '').trim().toLowerCase()}__${(chap.country || '').trim().toLowerCase()}`;

      if (!groupedChapters[cityKey]) {
        groupedChapters[cityKey] = [];
        // Pick coordinates once for the group
        let lng: number, lat: number;
        if (chap.coordinates) {
          const parts = chap.coordinates.split(',');
          lng = parseFloat(parts[0]);
          lat = parseFloat(parts[1]);
        } else {
          const coords = generateCoordinatesForCity(chap.city);
          lng = coords[0];
          lat = coords[1];
        }
        groupCoords[cityKey] = [lng, lat];
      }
      groupedChapters[cityKey].push(chap);
    });

    Object.entries(groupedChapters).forEach(([cityKey, locationChapters]) => {
      const [lng, lat] = groupCoords[cityKey];

      // Default standard marker with brand green color
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

        if (onMapInteract) onMapInteract();

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
          zoom: Math.max(map.getZoom(), 12),
          duration: 900,
          essential: true,
        });

        // Group ID to track slider state — use cityKey so all chapters at same location share one slider
        const groupId = `grp_${locationChapters.map((c: any) => c.id).join('_')}`;  
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
                  <h3 style="margin: 0; font-size: 15px; font-weight: 800; color: #111827; letter-spacing: -0.01em; line-height: 1.2; word-wrap: break-word; overflow-wrap: break-word;">${chap.name || `${chap.city} Chapter`}</h3>
                  <p style="margin: 0; font-size: 12px; color: #6b7280; font-weight: 500; margin-top: 2px;">${chap.country}</p>
                </div>
              </div>

              <div style="display: flex; justify-content: space-between; margin-bottom: 12px; gap: 8px; align-items: center; padding: 10px 12px; background: #f9fafb; border-radius: 8px; border: 1px solid #f3f4f6; transition: all 0.2s ease; box-sizing: border-box; width: 100%;">
                <div style="display: flex; flex-direction: column; min-width: 0;">
                  <span style="font-size: 11px; color: #6b7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Host: Active</span>
                  ${chap.isMember ? `<span style="font-size: 10px; font-weight: bold; color: #008060; background: #e6f5f0; padding: 2px 6px; border-radius: 4px; margin-top: 4px; display: inline-block; width: max-content;">Member</span>` : ''}
                </div>
                <div style="display: flex; gap: 6px; flex-shrink: 0; align-items: center;">
                  ${chap.created_by !== currentUserId ? `
                    <a href="/profile/${chap.created_by}" style="display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: #ecfdf5; color: #10b981; border-radius: 50%; text-decoration: none; border: 1px solid #d1fae5;" title="Connect with Host" onmouseover="this.style.background='#d1fae5'" onmouseout="this.style.background='#ecfdf5'">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="19" y1="8" x2="19" y2="14"></line><line x1="22" y1="11" x2="16" y2="11"></line></svg>
                    </a>
                    <a href="/inbox?user=${chap.created_by}&msg=${encodeURIComponent(`Hi! I noticed your ${chap.city} Travel Chapter on the TKS Alumni Portal. It's great to see alumni building communities globally — would be happy to connect and exchange thoughts! 🌐`)}" style="display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: #e6f5f0; color: #008060; border-radius: 50%; text-decoration: none; border: 1px solid #d0ede4;" title="Message Host" onmouseover="this.style.background='#d0ede4'" onmouseout="this.style.background='#e6f5f0'">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    </a>
                  ` : `
                    <span style="font-size: 10px; font-weight: bold; color: #008060; background: #e6f5f0; padding: 2px 6px; border-radius: 4px;">Host (You)</span>
                  `}
                </div>
              </div>

              <button
                onclick="window.__openTravelChapter && window.__openTravelChapter('${chap.id}')"
                style="width: 100%; margin-top: 2px; padding: 10px 12px; background: #008060; color: white; border: none; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; transition: background 0.15s;"
                onmouseover="this.style.background='#00664c'"
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
          closeOnClick: false,
          offset: 36,
          maxWidth: '320px',
          className: 'chapter-popup',
        })
          .setLngLat([lng, lat])
          .setHTML(html)
          .addTo(map);

        activePopupRef.current = popup;

        (window as any).__openTravelChapter = (id: string) => {
          const chapter = chapters.find(c => c.id === id);
          if (chapter && onChapterClick) {
            if (document.fullscreenElement) {
              document.exitFullscreen().catch(err => console.error(err));
            }
            onChapterClick(chapter);
            popup.remove();
            activePopupRef.current = null;
          }
        };
      });

      markersRef.current.push(marker);
    });

    // Dynamic marker visibility: hide markers that are off-screen to prevent them from leaking out of the map container
    const updateMarkerVisibilities = () => {
      const currentMap = mapRef.current;
      if (!currentMap) return;
      const bounds = currentMap.getBounds();
      markersRef.current.forEach(marker => {
        const lngLat = marker.getLngLat();
        if (bounds.contains(lngLat)) {
          marker.getElement().style.display = '';
        } else {
          marker.getElement().style.display = 'none';
        }
      });
    };

    updateMarkerVisibilities();
    map.on('move', updateMarkerVisibilities);

    // Fire initial bounds change so the list filters properly
    if (onBoundsChange) {
      onBoundsChange(map.getBounds());
    }

    return () => {
      const currentMap = mapRef.current;
      if (currentMap) {
        currentMap.off('move', updateMarkerVisibilities);
      }
    };

  }, [chapters, onChapterClick, onBoundsChange, onMapInteract]);

  // 3. Zoom/center on selectedChapter when it changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedChapter) return;

    let lng: number, lat: number;
    if (selectedChapter.coordinates) {
      const parts = selectedChapter.coordinates.split(',');
      lng = parseFloat(parts[0]);
      lat = parseFloat(parts[1]);
    } else {
      const coords = generateCoordinatesForCity(selectedChapter.city);
      lng = coords[0];
      lat = coords[1];
    }

    const isMobile = window.innerWidth < 640;
    const mapHeight = map.getContainer().clientHeight;
    const yOffset = isMobile ? Math.floor(mapHeight * 0.25) : 0;

    map.flyTo({
      center: [lng, lat],
      offset: [0, yOffset],
      zoom: Math.max(map.getZoom(), 12),
      duration: 1200,
      essential: true
    });
  }, [selectedChapter]);

  // 4. Zoom out/reset when resetTrigger changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || resetTrigger === undefined || resetTrigger === 0) return;

    // Remove any active popup on reset
    if (activePopupRef.current) {
      activePopupRef.current.remove();
      activePopupRef.current = null;
    }

    isResettingRef.current = true;

    map.flyTo({
      center: [30, 20],
      zoom: 0.8,
      duration: 1000,
      essential: true
    });

    // Reset the flag after transition completes
    map.once('moveend', () => {
      isResettingRef.current = false;
    });
  }, [resetTrigger]);

  return (
    <div className="relative w-full h-full bg-slate-50 overflow-visible z-50 lg:z-10">
      <div ref={containerRef} className="absolute inset-0" />
    </div>
  );
}
