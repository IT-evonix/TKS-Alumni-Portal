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
  first_name: string;
  last_name: string;
  latitude: number;
  longitude: number;
  location_label: string;
  current_city?: string;
  current_state?: string;
  current_country?: string;
}

const MapWrapper = ({ data, view, viewVersion, onBoundsChange }: {
  data: AlumniData[],
  view: { center: [number, number], zoom: number, bounds?: [[number, number], [number, number]] },
  viewVersion: number,
  onBoundsChange?: (bounds: { sw: { lng: number, lat: number }, ne: { lng: number, lat: number }, zoom: number }) => void
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
      center: view.center, // view.center is already [lng, lat]
      zoom: view.zoom,
      maxZoom: 9, // Restrict maximum zoom level
      attributionControl: false
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => {
      // Enhance administrative boundaries to clearly delineate Countries, States, and Cities/Counties
      const styleLayers = map.getStyle().layers;
      if (styleLayers) {
        styleLayers.forEach(layer => {
          if (['boundary_county', 'boundary_state', 'boundary_country_outline', 'boundary_country_inner'].includes(layer.id) && layer.type === 'line') {
            // Use a distinct but elegant slate color for borders
            map.setPaintProperty(layer.id, 'line-color', '#94a3b8');
            map.setPaintProperty(layer.id, 'line-opacity', 0.8);

            // Dynamic line-width depending on the boundary type
            let widthStyle = 1 as any;
            if (layer.id.includes('country')) {
              widthStyle = [
                'interpolate', ['linear'], ['zoom'],
                0, 0.5,
                4, 1.5,
                10, 2.5
              ];
            } else if (layer.id.includes('state')) {
              widthStyle = [
                'interpolate', ['linear'], ['zoom'],
                3, 0.1,
                6, 1.2,
                12, 2
              ];
              map.setPaintProperty(layer.id, 'line-dasharray', [3, 2]); // Dashed lines for states
            } else {
              widthStyle = [
                'interpolate', ['linear'], ['zoom'],
                7, 0.1,
                11, 1,
                15, 1.5
              ];
              map.setPaintProperty(layer.id, 'line-dasharray', [2, 3]); // Dotted lines for counties/cities
            }

            map.setPaintProperty(layer.id, 'line-width', widthStyle);
          }
        });
      }

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
            0.2, '#99f6e4', // teal-200
            0.4, '#10b981', // emerald-500 (brand primary)
            0.6, '#fbbf24', // amber-400
            0.8, '#f97316', // orange-500
            1, '#ef4444'    // red-500
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

        const labelCounts = new Map<string, number>();
        let totalCount = 0;

        features.forEach(f => {
          const label = f.properties?.label || 'Unknown Location';
          labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
          totalCount++;
        });

        const sortedLabels = Array.from(labelCounts.entries()).sort((a, b) => b[1] - a[1]);
        const labelsHtml = sortedLabels.map(([name, count]) => `
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px; gap: 16px; align-items: center; padding: 8px 10px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
            <span style="font-weight: 600; color: #334155; word-break: break-word; font-size: 13px;">${name}</span>
            <span style="background: #f59e0b; color: #ffffff; padding: 2px 8px; border-radius: 9999px; font-weight: 700; font-size: 11px; box-shadow: 0 2px 4px rgba(245,158,11,0.2);">${count}</span>
          </div>
        `).join('');

        const html = `
          <style>
            .custom-click-popup .maplibregl-popup-content {
              border-radius: 16px !important;
              padding: 16px !important;
              box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1) !important;
              border: 1px solid #e2e8f0;
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
          </style>
          <div style="color: #0f172a; padding: 4px; min-width: 250px; max-width: 300px; font-family: inherit;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px; padding-right: 24px;">
              <div style="background: #fffbeb; color: #d97706; width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; border: 1px solid #fef3c7;">
                📍
              </div>
              <div>
                <h3 style="margin: 0;  font-size: 15px; font-weight: 800; color: #0f172a; letter-spacing: -0.01em;">Location Details</h3>
                <p style="margin: 0; font-size: 12px; color: #64748b; font-weight: 500; margin-top: 2px;">${totalCount} ${totalCount === 1 ? 'Alumnus' : 'Alumni'} located here</p>
              </div>
            </div>
            <div style="max-height: 240px; overflow-y: auto; padding-right: 6px;" class="custom-scrollbar">
              ${labelsHtml}
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
          id: alumnus.id,
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

  return <div ref={containerRef} className="w-full h-full rounded-2xl" />;
};

export default function AlumniHeatMap() {
  const [alumniData, setAlumniData] = useState<AlumniData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    <div className="flex flex-col items-center justify-center h-[600px] space-y-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      <p className="text-muted-foreground animate-pulse">Loading Map...</p>
    </div>
  );

  if (error) return <Card className="p-6 text-center text-destructive m-4">Error: {error}</Card>;

  return (
    <div className="p-2 md:p-4 space-y-6 w-full max-w-6xl mx-auto">
      <Card className="border-none shadow-2xl overflow-hidden rounded-2xl bg-card">
        <CardContent className="p-0 flex flex-col-reverse lg:flex-row w-full h-[85vh] lg:h-[550px] min-h-[500px]">

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
            />

            {/* Legend - Compact dots on Mobile, Full on Desktop */}
            <div className="absolute bottom-3 right-3 lg:bottom-8 lg:left-8 lg:right-auto z-10 bg-background/90 backdrop-blur-sm px-2.5 py-1.5 lg:p-5 rounded-full lg:rounded-2xl border border-border/50 shadow-md lg:shadow-xl">
              <h4 className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground mb-4 hidden lg:block">Heatmap Density</h4>
              <div className="flex flex-row lg:flex-col gap-1.5 lg:gap-2 items-center lg:items-start">
                {[
                  { label: 'Highest Density', color: '#ef4444' },
                  { label: 'High Density', color: '#f97316' },
                  { label: 'Medium Density', color: '#fbbf24' },
                  { label: 'Low Density', color: '#10b981' },
                  { label: 'Lowest Density', color: '#99f6e4' }
                ].map(row => (
                  <div key={row.label} className="flex items-center gap-3 shrink-0">
                    <div className="w-2.5 h-2.5 lg:w-3 lg:h-3 rounded-full shrink-0" style={{ background: row.color, boxShadow: `0 0 6px ${row.color}` }}></div>
                    <span className="text-[11px] font-bold text-foreground whitespace-nowrap hidden lg:inline">{row.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
