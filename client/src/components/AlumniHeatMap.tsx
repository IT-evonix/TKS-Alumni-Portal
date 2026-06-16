import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Globe } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { supabase } from '@/lib/supabase';

interface AlumniData {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  latitude: number;
  longitude: number;
  location_label: string;
  current_city?: string;
  current_state?: string;
  current_country?: string;
}

const MapWrapper = ({ data, view, viewVersion, onBoundsChange, showHeatmap }: {
  data: AlumniData[],
  view: { center: [number, number], zoom: number, bounds?: [[number, number], [number, number]] },
  viewVersion: number,
  onBoundsChange?: (bounds: { sw: { lng: number, lat: number }, ne: { lng: number, lat: number }, zoom: number }) => void,
  showHeatmap: boolean
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const prevViewVersionRef = useRef(0);

  const dataRef = useRef<AlumniData[]>(data);
  useEffect(() => { dataRef.current = data; }, [data]);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapInstanceRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: view.center,
      zoom: view.zoom,
      maxZoom: 9,
      attributionControl: false
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => {

      // Add a raw GeoJSON source for true heatmap
      map.addSource('alumni-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      // Separate clustered source for city-area borders (merges nearby alumni)
      map.addSource('alumni-area-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterRadius: 80,
        clusterMaxZoom: 12
      });

      // 1. Heatmap layer
      map.addLayer({
        id: 'alumni-heat',
        type: 'heatmap',
        source: 'alumni-source',
        maxzoom: 15,
        paint: {
          // Increase the heatmap weight based on frequency
          'heatmap-weight': 1,

          // Increase the heatmap intensity by zoom level
          'heatmap-intensity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0, 1,
            15, 3
          ],

          // Beautiful light-theme friendly heat gradient starting with brand colors
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(0, 0, 0, 0)',
            0.25, '#10b981', // Low density (emerald-500)
            0.5, '#fbbf24',  // Medium density (amber-400)
            0.75, '#f97316', // High density (orange-500)
            1, '#ef4444'     // Highest density (red-500)
          ],

          // Adjust the heatmap radius by zoom level
          'heatmap-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0, 20,   // Large radius to show continent-wide hotspots
            3, 16,   // Still broad for regions
            6, 12,   // Country level
            10, 24,  // State level
            15, 40   // City level
          ],

          // Transition from heatmap to circle layer by zoom level
          'heatmap-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10, 1,
            15, 0.3
          ]
        }
      });

      // 1.5 Highlight Area Border for Cities (Green boundary covering the city area)
      map.addLayer({
        id: 'alumni-city-area',
        type: 'circle',
        source: 'alumni-area-source',
        minzoom: 8,
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            8, 30,
            10, 100
          ],
          'circle-color': 'rgba(16, 185, 129, 0.06)', // Very faint green fill
          'circle-stroke-color': '#10b981', // Solid Green Border
          'circle-stroke-width': 2,
          'circle-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            8, 0,
            9, 1
          ],
          'circle-stroke-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            8, 0,
            9, 1
          ]
        }
      });

      // 2. Point layer for higher zoom levels
      map.addLayer({
        id: 'alumni-point',
        type: 'circle',
        source: 'alumni-source',
        minzoom: 8,
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            8, 3,
            15, 8
          ],
          'circle-color': '#10b981', // emerald-500
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            8, 0,
            12, 2
          ],
          'circle-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            8, 0,
            12, 1
          ],
          'circle-stroke-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            8, 0,
            12, 1
          ]
        }
      });

      // 3. Invisible interactive layer for hovering across all zoom levels
      map.addLayer({
        id: 'alumni-interactive',
        type: 'circle',
        source: 'alumni-source',
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0, 12,
            15, 24
          ],
          'circle-color': 'rgba(0,0,0,0)', // Completely transparent
          'circle-stroke-width': 0
        }
      });

      // Click to zoom in and open detailed window
      map.on('click', 'alumni-interactive', (e) => {
        if (!e.features || e.features.length === 0) return;
        const coordinates = (e.features[0].geometry as any).coordinates.slice();

        while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
          coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
        }

        const currentZoom = map.getZoom();
        const clickedProp = e.features[0].properties;

        if (currentZoom < 4) {
          // Clicked at World view -> Auto-fit to the Country
          const country = clickedProp?.country;
          if (country) {
            const groupAlumni = dataRef.current.filter(a => a.current_country === country || a.location_label?.includes(country));
            if (groupAlumni.length > 0) {
              let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90;
              groupAlumni.forEach(a => {
                if (a.longitude < minLng) minLng = a.longitude;
                if (a.longitude > maxLng) maxLng = a.longitude;
                if (a.latitude < minLat) minLat = a.latitude;
                if (a.latitude > maxLat) maxLat = a.latitude;
              });
              if (minLng !== maxLng || minLat !== maxLat) {
                map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 50, maxZoom: 5.5, duration: 800 });
              } else {
                map.easeTo({ center: coordinates, zoom: 5.5, duration: 800 });
              }
            }
          }
          return;
        } else if (currentZoom < 6) {
          // Clicked at Country view -> Auto-fit to the State
          const state = clickedProp?.state;
          if (state) {
            const groupAlumni = dataRef.current.filter(a => a.current_state === state || a.location_label?.includes(state));
            if (groupAlumni.length > 0) {
              let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90;
              groupAlumni.forEach(a => {
                if (a.longitude < minLng) minLng = a.longitude;
                if (a.longitude > maxLng) maxLng = a.longitude;
                if (a.latitude < minLat) minLat = a.latitude;
                if (a.latitude > maxLat) maxLat = a.latitude;
              });
              if (minLng !== maxLng || minLat !== maxLat) {
                map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 50, maxZoom: 7.5, duration: 800 });
              } else {
                map.easeTo({ center: coordinates, zoom: 7.5, duration: 800 });
              }
            }
          }
          return;
        }

        // If we are here, we click at City level
        map.easeTo({
          center: coordinates,
          zoom: 8,
          duration: 800
        });

        // ONLY open the detailed location popup if we are already zoomed in near the city level
        if (currentZoom < 7.5) {
          return;
        }

        // Query all features at the clicked point
        const rawFeatures = map.queryRenderedFeatures(e.point, { layers: ['alumni-interactive'] });

        // Filter out overlapping nearby cities by strictly matching the exact coordinates of the clicked pin
        const features = rawFeatures.filter(f => {
          const coords = (f.geometry as any).coordinates;
          return coords[0] === coordinates[0] && coords[1] === coordinates[1];
        });

        const totalCount = features.length;

        const alumniListHtml = features.map(f => {
          const props = f.properties as any;
          const name = `${props.first_name || ''} ${props.last_name || ''}`.trim() || 'Alumnus';
          return `
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px; gap: 12px; align-items: center; padding: 10px 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; transition: all 0.2s ease;">
            <div style="display: flex; flex-direction: column; min-width: 0;">
              <span style="font-weight: 600; color: #0f172a; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${name}</span>
              <span style="font-size: 11px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${props.label}</span>
            </div>
            <div style="display: flex; gap: 6px; flex-shrink: 0;">
              <a href="/profile/${props.id}" style="display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: #ecfdf5; color: #10b981; border-radius: 50%; text-decoration: none; border: 1px solid #d1fae5;" title="View Profile / Connect" onmouseover="this.style.background='#d1fae5'" onmouseout="this.style.background='#ecfdf5'">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="19" y1="8" x2="19" y2="14"></line><line x1="22" y1="11" x2="16" y2="11"></line></svg>
              </a>
              <a href="/inbox?user=${props.id}" style="display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: #eff6ff; color: #3b82f6; border-radius: 50%; text-decoration: none; border: 1px solid #dbeafe;" title="Send Message" onmouseover="this.style.background='#dbeafe'" onmouseout="this.style.background='#eff6ff'">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
              </a>
            </div>
          </div>
          `;
        }).join('');

        const html = `
          <style>
            .custom-click-popup {
              max-width: 90vw !important;
            }
            .custom-click-popup .maplibregl-popup-content {
              border-radius: 16px !important;
              padding: 16px !important;
              box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1) !important;
              border: 1px solid #e2e8f0;
              box-sizing: border-box;
            }
            @media (max-width: 640px) {
              .custom-click-popup .maplibregl-popup-content {
                padding: 12px !important;
              }
              .custom-click-popup {
                max-width: 85vw !important;
              }
            }
            .custom-click-popup .maplibregl-popup-close-button {
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
            .custom-click-popup .maplibregl-popup-close-button:hover {
              background-color: #f1f5f9 !important;
              color: #0f172a !important;
            }
            .custom-scrollbar::-webkit-scrollbar {
              width: 6px;
            }
            .custom-scrollbar::-webkit-scrollbar-track {
              background: #f1f5f9;
              border-radius: 4px;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb {
              background: #cbd5e1;
              border-radius: 4px;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover {
              background: #94a3b8;
            }
          </style>
          <div style="color: #0f172a; padding: 0px; width: 100%; min-width: 200px; font-family: inherit; box-sizing: border-box;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px; padding-right: 24px;">
              <div style="background: #fffbeb; color: #d97706; width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; border: 1px solid #fef3c7;">
                📍
              </div>
              <div>
                <h3 style="margin: 0;  font-size: 15px; font-weight: 800; color: #0f172a; letter-spacing: -0.01em;">Location Details</h3>
                <p style="margin: 0; font-size: 12px; color: #64748b; font-weight: 500; margin-top: 2px;">${totalCount} ${totalCount === 1 ? 'Alumnus' : 'Alumni'} located here</p>
              </div>
            </div>
            <div style="max-height: 160px; overflow-y: auto; padding-right: 6px;" class="custom-scrollbar">
              ${alumniListHtml}
            </div>
          </div>
        `;

        new maplibregl.Popup({
          closeButton: true,
          closeOnClick: true,
          offset: 15,
          maxWidth: '320px',
          className: 'custom-click-popup'
        })
          .setLngLat(coordinates)
          .setHTML(html)
          .addTo(map);
      });

      const handleMoveEnd = () => {
        if (onBoundsChange) {
          const b = map.getBounds();
          onBoundsChange({
            sw: { lng: b.getSouthWest().lng, lat: b.getSouthWest().lat },
            ne: { lng: b.getNorthEast().lng, lat: b.getNorthEast().lat },
            zoom: map.getZoom()
          });
        }
      };

      map.on('moveend', handleMoveEnd);
      map.on('zoomend', handleMoveEnd);
      handleMoveEnd(); // Initial bounds call
    });

    mapInstanceRef.current = map;
    prevViewVersionRef.current = viewVersion;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Data Source when data changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: data.map(alumnus => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [alumnus.longitude, alumnus.latitude] // MapLibre takes [lng, lat] for GeoJSON
        },
        properties: {
          id: alumnus.user_id || alumnus.id,
          first_name: alumnus.first_name,
          last_name: alumnus.last_name,
          label: alumnus.location_label || 'Unknown Location',
          city: alumnus.current_city || '',
          state: alumnus.current_state || '',
          country: alumnus.current_country || ''
        }
      }))
    };

    const updateSource = () => {
      const source = map.getSource('alumni-source') as maplibregl.GeoJSONSource;
      if (source) {
        source.setData(geojson);
      }
      const areaSource = map.getSource('alumni-area-source') as maplibregl.GeoJSONSource;
      if (areaSource) {
        areaSource.setData(geojson);
      }
    };

    if (map.isStyleLoaded()) {
      updateSource();
    } else {
      map.once('load', updateSource);
    }
  }, [data]);

  // Sync camera position ONLY on explicit external actions (e.g., sidebar click, Reset button)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (viewVersion === prevViewVersionRef.current) return;
    prevViewVersionRef.current = viewVersion;

    if (view.bounds) {
      map.fitBounds(view.bounds, { padding: 50, maxZoom: 10, speed: 1.2 });
    } else {
      map.flyTo({
        center: view.center,
        zoom: view.zoom,
        speed: 1.2
      });
    }
  }, [viewVersion]);

  // Toggle Heatmap Layer Visibility
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const layers = ['alumni-heat', 'alumni-city-area', 'alumni-point', 'alumni-interactive'];
    
    const updateVisibility = () => {
      layers.forEach(layerId => {
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(layerId, 'visibility', showHeatmap ? 'visible' : 'none');
        }
      });
      if (!showHeatmap) {
        const popups = document.getElementsByClassName('maplibregl-popup');
        while (popups[0]) {
          popups[0].remove();
        }
      }
    };

    if (map.isStyleLoaded()) {
      updateVisibility();
    } else {
      map.once('load', updateVisibility);
    }
  }, [showHeatmap]);

  return <div ref={containerRef} className="w-full h-full rounded-2xl" />;
};

export default function AlumniHeatMap() {
  const [alumniData, setAlumniData] = useState<AlumniData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(true);

  const [mapBounds, setMapBounds] = useState<{ sw: { lng: number, lat: number }, ne: { lng: number, lat: number }, zoom: number } | null>(null);
  const [mapView, setMapView] = useState<{ center: [number, number], zoom: number, bounds?: [[number, number], [number, number]] }>({ center: [0, 20], zoom: 1 });
  const [viewVersion, setViewVersion] = useState(0);

  const hasLoadedOnce = useRef(false);

  const fetchData = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const res = await fetch('/api/alumni-map/map-data', { cache: 'no-store' });
      const data = await res.json();
      const loadedAlumni = data.alumni || [];
      setAlumniData(loadedAlumni);

      // Auto-fit to show all alumni on the globe on first load
      if (isInitial && loadedAlumni.length > 0) {
        let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90;
        loadedAlumni.forEach((a: any) => {
          if (a.longitude < minLng) minLng = a.longitude;
          if (a.longitude > maxLng) maxLng = a.longitude;
          if (a.latitude < minLat) minLat = a.latitude;
          if (a.latitude > maxLat) maxLat = a.latitude;
        });
        if (minLng !== maxLng || minLat !== maxLat) {
          setMapView({
            center: [(minLng + maxLng) / 2 as number, (minLat + maxLat) / 2 as number],
            zoom: 1,
            bounds: [[minLng, minLat], [maxLng, maxLat]]
          });
          setViewVersion(v => v + 1);
        }
      }

      hasLoadedOnce.current = true;
    } catch (err) {
      if (!hasLoadedOnce.current) setError('Error loading map');
      console.error('[Alumni Map] error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(true); }, [fetchData]);

  // Realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('alumni-map-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alumni' }, () => fetchData(false))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  // Determine sidebar items hierarchically based on map zoom
  const sidebarItems = useMemo(() => {
    if (!mapBounds) return [];

    // Filter alumni inside bounds
    const visible = alumniData.filter(a => {
      let lng = a.longitude;
      while (lng < mapBounds.sw.lng) lng += 360;
      while (lng > mapBounds.ne.lng) lng -= 360;
      return a.latitude >= mapBounds.sw.lat && a.latitude <= mapBounds.ne.lat &&
        lng >= mapBounds.sw.lng && lng <= mapBounds.ne.lng;
    });

    const groups = new Map<string, { label: string, count: number, lat: number, lng: number }>();

    // Determine grouping level
    const z = mapBounds.zoom;
    const isCountryLevel = z < 4;
    const isStateLevel = z >= 4 && z < 7;
    // Otherwise City level

    visible.forEach(a => {
      let label = '';

      if (isCountryLevel) {
        label = a.current_country || (a.location_label ? a.location_label.split(',').pop()?.trim() || '' : '') || 'Unknown Country';
      } else if (isStateLevel) {
        label = a.current_state || 'Unknown State';
        if (label === 'Unknown State' && a.location_label) {
          const parts = a.location_label.split(',');
          if (parts.length >= 2) label = parts[parts.length - 2].trim();
        }
      } else {
        label = a.location_label || 'Unknown Location';
      }

      if (!label) label = 'Unknown Area';

      if (!groups.has(label)) {
        groups.set(label, { label, count: 0, lat: a.latitude, lng: a.longitude });
      }
      groups.get(label)!.count++;
    });

    return Array.from(groups.values()).sort((a, b) => b.count - a.count);
  }, [alumniData, mapBounds]);

  if (loading) return (
    <div className="p-0 space-y-6 w-full max-w-5xl mx-auto animate-pulse">
      {/* Search Header Skeleton */}
      <div className="w-full h-12 bg-slate-200 rounded-xl max-w-md"></div>
      
      {/* Main Card Skeleton */}
      <div className="overflow-hidden border border-slate-200 shadow-sm rounded-xl">
        <div className="grid grid-cols-1 md:grid-cols-4 md:h-[600px]">
          {/* Sidebar Skeleton */}
          <div className="col-span-1 bg-white border-b md:border-b-0 md:border-r border-slate-100 p-5 flex flex-col gap-4 h-[300px] md:h-full">
            <div className="w-1/2 h-6 bg-slate-200 rounded"></div>
            <div className="w-full h-8 bg-slate-100 rounded"></div>
            <div className="space-y-3 mt-4">
              <div className="w-full h-16 bg-slate-100 rounded-lg"></div>
              <div className="w-full h-16 bg-slate-100 rounded-lg"></div>
              <div className="w-full h-16 bg-slate-100 rounded-lg"></div>
            </div>
          </div>
          {/* Map Area Skeleton */}
          <div className="col-span-3 h-[400px] md:h-full relative bg-slate-100 flex items-center justify-center">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
              <p className="text-slate-500 font-medium text-sm">Loading global network...</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (error) return <Card className="p-6 text-center text-destructive m-4">Error: {error}</Card>;

  return (
    <div className="p-0 space-y-6 w-full max-w-5xl mx-auto">
      <Card className="border shadow-sm overflow-hidden rounded-2xl bg-card border-gray-200">
        <CardContent className="p-0 flex flex-col-reverse lg:flex-row w-full h-[600px] min-h-[500px]">

          {/* Sidebar */}
          <div className="w-full lg:w-[280px] xl:w-[300px] border-t lg:border-t-0 lg:border-r border-border bg-muted/10 flex flex-col h-[45%] lg:h-full overflow-hidden shrink-0">
            <div className="p-4 border-b border-border sticky top-0 bg-background/95 backdrop-blur z-10 flex items-center justify-between">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" /> Directory
              </h3>
              <Button variant="ghost" size="sm" onClick={() => {
                if (alumniData.length > 0) {
                  let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90;
                  alumniData.forEach(a => {
                    if (a.longitude < minLng) minLng = a.longitude;
                    if (a.longitude > maxLng) maxLng = a.longitude;
                    if (a.latitude < minLat) minLat = a.latitude;
                    if (a.latitude > maxLat) maxLat = a.latitude;
                  });
                  if (minLng !== maxLng || minLat !== maxLat) {
                    setMapView({
                      center: [(minLng + maxLng) / 2 as number, (minLat + maxLat) / 2 as number],
                      zoom: 1,
                      bounds: [[minLng, minLat], [maxLng, maxLat]]
                    });
                    setViewVersion(v => v + 1);
                  }
                } else {
                  setMapView({ center: [0, 20], zoom: 1 });
                  setViewVersion(v => v + 1);
                }
              }}>Reset</Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                {mapBounds && mapBounds.zoom < 4 ? 'Countries in View' : (mapBounds && mapBounds.zoom < 7 ? 'States / Regions in View' : 'Cities / Locations in View')}
              </p>
              {sidebarItems.length > 0 ? sidebarItems.map(item => (
                <div key={item.label}
                  className="flex items-center justify-between p-3 rounded-lg bg-background hover:bg-muted cursor-pointer transition-all border shadow-sm border-border/50"
                  onClick={() => {
                    const z = mapBounds ? mapBounds.zoom : 1;
                    const isCountryLevel = z < 4;
                    const isStateLevel = z >= 4 && z < 7;

                    // Find all alumni matching this exact group label
                    const groupAlumni = alumniData.filter(a => {
                      if (isCountryLevel) {
                        const country = a.current_country || (a.location_label ? a.location_label.split(',').pop()?.trim() || '' : '') || 'Unknown Country';
                        return country === item.label;
                      } else if (isStateLevel) {
                        let st = a.current_state || 'Unknown State';
                        if (st === 'Unknown State' && a.location_label) {
                          const parts = a.location_label.split(',');
                          if (parts.length >= 2) st = parts[parts.length - 2].trim();
                        }
                        return st === item.label;
                      } else {
                        return (a.location_label || 'Unknown Location') === item.label;
                      }
                    });

                    if (groupAlumni.length > 0) {
                      let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90;
                      groupAlumni.forEach(a => {
                        if (a.longitude < minLng) minLng = a.longitude;
                        if (a.longitude > maxLng) maxLng = a.longitude;
                        if (a.latitude < minLat) minLat = a.latitude;
                        if (a.latitude > maxLat) maxLat = a.latitude;
                      });

                      // If only 1 point or all points are identical
                      if (minLng === maxLng && minLat === maxLat) {
                        let targetZoom = 10;
                        if (isCountryLevel) targetZoom = 5;
                        else if (isStateLevel) targetZoom = 8;
                        setMapView({ center: [minLng, minLat], zoom: targetZoom });
                      } else {
                        setMapView({
                          center: [(minLng + maxLng) / 2, (minLat + maxLat) / 2],
                          zoom: 12,
                          bounds: [[minLng, minLat], [maxLng, maxLat]]
                        });
                      }
                      setViewVersion(v => v + 1);
                    }
                  }}>
                  <div className="flex-1 min-w-0 pr-3">
                    <span className="font-medium text-sm block truncate" title={item.label}>
                      {item.label.split(',')[0]}
                    </span>
                    {item.label.includes(',') && (
                      <span className="text-xs text-muted-foreground block truncate" title={item.label}>
                        {item.label.substring(item.label.indexOf(',') + 1).trim()}
                      </span>
                    )}
                  </div>
                  <Badge variant="secondary" className="bg-primary/10 text-primary whitespace-nowrap shrink-0">
                    {item.count} Alumni
                  </Badge>
                </div>
              )) : (
                <div className="p-6 mt-4 text-center border border-dashed border-border rounded-xl bg-muted/30">
                  <MapPin className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" />
                  <p className="text-sm font-medium text-foreground">No Alumni in View</p>
                  <p className="text-xs text-muted-foreground mt-1">Try zooming out or panning to a different location.</p>
                </div>
              )}
            </div>
          </div>

          {/* Map Area */}
          <div className="relative w-full h-[55%] lg:h-full flex-1 overflow-hidden">
            <MapWrapper
              data={alumniData}
              view={mapView}
              viewVersion={viewVersion}
              onBoundsChange={setMapBounds}
              showHeatmap={showHeatmap}
            />
 
            {/* Legend - Sleek Gradient Bar */}
            <div 
              className={`absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-10 bg-background/95 backdrop-blur-md px-3 py-2 sm:px-4 sm:py-3 rounded-xl border border-border/50 shadow-lg w-[130px] sm:w-[220px] transition-all duration-300 ${!showHeatmap ? 'opacity-65' : ''}`}
            >
              <div 
                className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2 cursor-pointer select-none"
                onClick={() => setShowHeatmap(!showHeatmap)}
              >
                <input 
                  type="checkbox" 
                  checked={showHeatmap} 
                  onChange={() => {}} // Controlled by div click
                  className="rounded border-border text-primary focus:ring-primary h-3 w-3 sm:h-3.5 sm:w-3.5 cursor-pointer accent-primary"
                />
                <h4 className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <span className="inline sm:hidden">Density</span>
                  <span className="hidden sm:inline">Heatmap Density</span>
                </h4>
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                {/* The gradient bar */}
                <div 
                  className="w-full h-1.5 sm:h-2 rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] transition-all duration-300" 
                  style={{ 
                    background: 'linear-gradient(to right, #10b981, #fbbf24, #f97316, #ef4444)',
                    filter: showHeatmap ? 'none' : 'grayscale(100%) opacity(30%)'
                  }} 
                />
                {/* Labels beneath the bar */}
                <div className="flex justify-between items-center text-[8px] sm:text-[10px] font-bold text-muted-foreground px-0.5">
                  <span>Low</span>
                  <span className="hidden sm:inline">Medium</span>
                  <span>High</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
