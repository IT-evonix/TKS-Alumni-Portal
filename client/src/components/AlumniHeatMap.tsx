import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Users, TrendingUp, Globe, Filter, Search } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { supabase } from '@/lib/supabase';

interface AlumniData {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  current_city: string;
  current_state: string;
  current_country: string;

}

interface CityCount {
  city: string;
  state: string;
  country: string;
  count: number;
  lat: number;
  lng: number;
}

// Custom Marker Generator for MapLibre
const createHeatMarker = (count: number) => {
  const getColorData = (c: number) => {
    if (c === 1) return { color: '#fbbf24', shadow: 'rgba(251, 191, 36, 0.4)' };
    if (c < 10) return { color: '#f59e0b', shadow: 'rgba(245, 158, 11, 0.4)' };
    if (c < 25) return { color: '#d97706', shadow: 'rgba(217, 119, 6, 0.4)' };
    if (c < 50) return { color: '#b45309', shadow: 'rgba(180, 83, 9, 0.4)' };
    return { color: '#78350f', shadow: 'rgba(120, 53, 15, 0.5)' };
  };

  const { color, shadow } = getColorData(count);
  const size = Math.min(28 + Math.sqrt(count) * 4, 70);

  const el = document.createElement('div');
  el.className = 'custom-heat-marker';
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.backgroundColor = color;
  el.style.borderRadius = '50%';
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  el.style.color = 'white';
  el.style.fontWeight = '800';
  el.style.fontSize = `${Math.max(12, size * 0.35)}px`;
  el.style.boxShadow = `0 0 0 3px white, 0 0 15px ${shadow}`;
  el.style.border = '2px solid rgba(255,255,255,0.7)';
  el.style.cursor = 'pointer';
  el.innerText = count.toString();

  // Add pulse animation
  if (!document.getElementById('map-marker-animations')) {
    const style = document.createElement('style');
    style.id = 'map-marker-animations';
    style.innerHTML = `
      @keyframes marker-pulse {
        0% { box-shadow: 0 0 0 0px rgba(255, 255, 255, 0.4); }
        70% { box-shadow: 0 0 0 15px rgba(255, 255, 255, 0); }
        100% { box-shadow: 0 0 0 0px rgba(255, 255, 255, 0); }
      }
      .custom-heat-marker {
        animation: marker-pulse 2s infinite ease-out;
      }
    `;
    document.head.appendChild(style);
  }

  return el;
};

// MapLibre MapWrapper — view changes ONLY when viewVersion changes (explicit user action)
const MapWrapper = ({ filteredData, view, viewVersion, onMarkerClick, onZoomEnd }: {
  filteredData: any[],
  view: { center: [number, number], zoom: number },
  viewVersion: number,
  onMarkerClick?: (marker: any) => void,
  onZoomEnd?: (zoom: number) => void
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const prevViewVersionRef = useRef(0);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapInstanceRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [view.center[1], view.center[0]], // MapLibre uses [lng, lat]
      zoom: view.zoom,
      attributionControl: false
    });

    map.addControl(new maplibregl.NavigationControl({
      showCompass: false
    }), 'top-right');

    map.on('zoomend', () => {
      if (onZoomEnd) onZoomEnd(map.getZoom());
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

  // Sync view ONLY when viewVersion changes (user clicked filter / marker)
  // This prevents data refreshes from resetting the user's zoom/pan
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    // Skip if version hasn't changed (i.e. just a data refresh)
    if (viewVersion === prevViewVersionRef.current) return;
    prevViewVersionRef.current = viewVersion;

    map.flyTo({
      center: [view.center[1], view.center[0]],
      zoom: view.zoom,
      speed: 1.2
    });
  }, [viewVersion]);

  // Sync Markers — only updates markers, never moves the camera
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Add new markers
    filteredData.forEach(item => {
      const el = createHeatMarker(item.count);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([item.lng, item.lat])
        .addTo(map);

      el.addEventListener('click', () => {
        if (onMarkerClick) onMarkerClick(item);
      });

      // Tooltip on hover
      const tooltip = document.createElement('div');
      const subtitleParts: string[] = [];
      if (item.state && item.state !== item.name) subtitleParts.push(item.state);
      if (item.country && item.country !== item.name && item.country !== item.state) subtitleParts.push(item.country);
      const subtitle = subtitleParts.join(', ');

      tooltip.innerHTML = `
        <div style="font-weight: 800; color: #1e293b; font-size: 13px;">${item.name}</div>
        ${subtitle ? `<div style="color: #94a3b8; font-size: 10px; margin-top: 1px;">${subtitle}</div>` : ''}
        <div style="background: #f8fafc; margin-top: 4px; padding: 4px 8px; border-radius: 4px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 700; color: #f59e0b; font-size: 14px;">${item.count}</span>
          <span style="color: #64748b; margin-left: 10px; font-size: 10px; text-transform: uppercase;">Alumni</span>
        </div>
      `;
      tooltip.style.position = 'absolute';
      tooltip.style.bottom = '100%';
      tooltip.style.left = '50%';
      tooltip.style.transform = 'translate(-50%, -15px)';
      tooltip.style.backgroundColor = 'white';
      tooltip.style.padding = '8px';
      tooltip.style.minWidth = '120px';
      tooltip.style.borderRadius = '8px';
      tooltip.style.boxShadow = '0 4px 15px rgba(0,0,0,0.15)';
      tooltip.style.opacity = '0';
      tooltip.style.pointerEvents = 'none';
      tooltip.style.transition = 'opacity 0.2s, transform 0.2s';
      tooltip.style.zIndex = '1000';

      el.appendChild(tooltip);

      el.addEventListener('mouseenter', () => {
        tooltip.style.opacity = '1';
        tooltip.style.transform = 'translate(-50%, -20px)';
      });
      el.addEventListener('mouseleave', () => {
        tooltip.style.opacity = '0';
        tooltip.style.transform = 'translate(-50%, -15px)';
      });

      markersRef.current.push(marker);
    });
  }, [filteredData]);

  return <div ref={containerRef} className="w-full h-full rounded-2xl" />;
};

export default function AlumniHeatMap() {
  const [alumniData, setAlumniData] = useState<AlumniData[]>([]);
  const [processedMapData, setProcessedMapData] = useState<{
    cities: any[],
    states: any[],
    countries: any[]
  }>({ cities: [], states: [], countries: [] });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [selectedState, setSelectedState] = useState<string>('all');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [currentZoom, setCurrentZoom] = useState(2.0);
  // viewVersion increments ONLY on explicit user actions (filter/marker click)
  // Data refreshes do NOT change this — so the map won't fly/reset on refresh
  const [viewVersion, setViewVersion] = useState(0);

  // Determine levels based strictly on zoom so manual zooming works dynamically
  const currentLevel = useMemo(() => {
    if (currentZoom >= 6.5) return 'city';
    if (currentZoom >= 3.5) return 'state';
    return 'country';
  }, [currentZoom]);

  // Determine what markers to show
  const finalDisplayData = useMemo(() => {
    let data: any[] = [];
    if (currentLevel === 'country') {
      data = processedMapData.countries.map(c => ({
        ...c, name: c.country, type: 'country', id: c.country
      }));
    } else if (currentLevel === 'state') {
      let states = processedMapData.states;
      if (selectedCountry !== 'all') {
        states = states.filter(s => {
          const sample = processedMapData.cities.find(c => c.state === s.state);
          return sample?.country === selectedCountry;
        });
      }
      data = states.map(s => {
        // Find the country for this state from the cities data
        const sample = processedMapData.cities.find(c => c.state === s.state);
        return {
          ...s, name: s.state, type: 'state', id: s.state,
          country: sample?.country || selectedCountry
        };
      });
    } else {
      let cities = processedMapData.cities;
      if (selectedCountry !== 'all') cities = cities.filter(c => c.country === selectedCountry);
      if (selectedState !== 'all') cities = cities.filter(c => c.state === selectedState);
      data = cities.map(c => ({
        ...c, name: c.city, type: 'city', id: c.city
      }));
    }

    // Apply minimal Jitter to prevent overlap for markers at the very close coordinates
    // Using 0.002 degrees (~200 meters) instead of 0.15 degrees (~16.6 km)
    const coordinateGroups = new Map<string, any[]>();
    
    return data.map(item => {
      const key = `${item.lat.toFixed(3)},${item.lng.toFixed(3)}`;
      
      if (!coordinateGroups.has(key)) {
        coordinateGroups.set(key, []);
      }
      
      const group = coordinateGroups.get(key)!;
      const indexInGroup = group.length;
      group.push(item);

      if (indexInGroup === 0) return item;

      const angle = (indexInGroup * (2 * Math.PI)) / 6;
      const radius = 0.002 * Math.sqrt(indexInGroup);
      
      return {
        ...item,
        lat: item.lat + radius * Math.sin(angle),
        lng: item.lng + radius * Math.cos(angle)
      };
    });
  }, [processedMapData, selectedCountry, selectedState, currentLevel]);

  // Map View — only changes when user explicitly changes filters
  const mapView = useMemo(() => {
    if (selectedCity !== 'all') {
      const data = processedMapData.cities.find(c => c.city === selectedCity);
      if (data) return { center: [data.lat, data.lng] as [number, number], zoom: 12 };
    }

    if (selectedState !== 'all') {
      const data = processedMapData.states.find(s => s.state === selectedState);
      return {
        center: (data ? [data.lat, data.lng] : [20, 78]) as [number, number],
        zoom: 7
      };
    }

    if (selectedCountry !== 'all') {
      const data = processedMapData.countries.find(c => c.country === selectedCountry);
      return {
        center: (data ? [data.lat, data.lng] : [20, 78]) as [number, number],
        zoom: 4.5
      };
    }

    return { center: [20, 5] as [number, number], zoom: 1.5 };
  }, [selectedCountry, selectedState, selectedCity, processedMapData]);

  // Track whether initial load is done
  const hasLoadedOnce = useRef(false);

  // Fetch data — silent refresh (no loading spinner after initial load)
  const fetchData = useCallback(async (isInitial = false) => {
    try {
      // Only show loading spinner on very first load
      if (isInitial) setLoading(true);

      const res = await fetch('/api/alumni-map/map-data', {
        cache: 'no-store',
        headers: { 'Pragma': 'no-cache' }
      });
      const data = await res.json();

      const freshAlumni = data.alumni || [];
      setAlumniData(freshAlumni);

      if (freshAlumni.length === 0) {
        setProcessedMapData({ cities: [], states: [], countries: [] });
        // Only reset filters on initial load when empty
        if (!hasLoadedOnce.current) {
          setSelectedCountry('all');
          setSelectedState('all');
          setSelectedCity('all');
        }
      } else if (data.processed) {
        setProcessedMapData(data.processed);
      }

      hasLoadedOnce.current = true;
    } catch (err) {
      // Only show error on initial load
      if (!hasLoadedOnce.current) {
        setError(err instanceof Error ? err.message : 'Error loading map');
      }
      console.error('[Alumni Map] Refresh error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  // Real-time subscription — silent refresh only (no zoom reset)
  useEffect(() => {
    const channel = supabase
      .channel('alumni-map-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'alumni'
        },
        () => {
          console.log('[Real-time] Alumni data changed, silently refreshing markers...');
          fetchData(false);
        }
      )
      .subscribe();

    // Polling fallback every 5 minutes instead of 30s
    // (realtime handles most cases, this is just for TRUNCATE/bulk ops)
    const pollInterval = setInterval(() => {
      fetchData(false);
    }, 300000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [fetchData]);

  // Wrapper for selecting country — increments viewVersion to trigger flyTo
  const handleSelectCountry = useCallback((id: string) => {
    setSelectedCountry(id);
    setSelectedState('all');
    setSelectedCity('all');
    setViewVersion(v => v + 1);
  }, []);

  const handleSelectState = useCallback((id: string) => {
    setSelectedState(id);
    setSelectedCity('all');
    setViewVersion(v => v + 1);
  }, []);

  const handleSelectCity = useCallback((id: string) => {
    setSelectedCity(id);
    setViewVersion(v => v + 1);
  }, []);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[600px] space-y-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      <p className="text-muted-foreground animate-pulse">Loading Alumni Map...</p>
    </div>
  );

  if (error) return <Card className="p-6 text-center text-destructive m-4">Error: {error}</Card>;

  return (
    <div className="p-4 space-y-6">
      <Card className="border-none shadow-2xl overflow-hidden rounded-2xl bg-card">
        <CardContent className="p-0 flex flex-col lg:flex-row h-[800px]">
          
          {/* Sidebar Directory */}
          <div className="w-full lg:w-[350px] border-r border-border bg-muted/10 flex flex-col h-[350px] lg:h-full overflow-hidden shrink-0">
            <div className="p-4 border-b border-border sticky top-0 bg-background/95 backdrop-blur z-10 flex items-center justify-between">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary"/> Alumni Directory
              </h3>
              {(selectedCountry !== 'all' || selectedState !== 'all' || selectedCity !== 'all') && (
                <Button variant="ghost" size="sm" onClick={() => { 
                  setSelectedCountry('all'); 
                  setSelectedState('all'); 
                  setSelectedCity('all');
                  setViewVersion(v => v + 1); 
                }}>
                  Reset Map
                </Button>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <div className="mb-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {currentLevel === 'country' ? 'Global Reach' : (currentLevel === 'state' ? `States in ${selectedCountry}` : 'Cities')}
                </p>
                <p className="text-xs text-muted-foreground">Zoom map to drill down automatically.</p>
              </div>

              {currentLevel === 'country' && processedMapData.countries.sort((a,b)=>b.count-a.count).map(item => (
                <div key={item.country} 
                     className="flex items-center justify-between p-3 rounded-lg bg-background hover:bg-muted cursor-pointer transition-all border border-border/50 hover:border-border shadow-sm"
                     onClick={() => handleSelectCountry(item.country)}>
                  <span className="font-medium">{item.country}</span>
                  <Badge variant="secondary" className="bg-primary/10 text-primary">{item.count} Alumni</Badge>
                </div>
              ))}

              {currentLevel === 'state' && processedMapData.states
                .filter(s => selectedCountry === 'all' || processedMapData.cities.find(c => c.state === s.state)?.country === selectedCountry)
                .sort((a,b)=>b.count-a.count).map(item => (
                <div key={item.state} 
                     className="flex items-center justify-between p-3 rounded-lg bg-background hover:bg-muted cursor-pointer transition-all border border-border/50 hover:border-border shadow-sm"
                     onClick={() => handleSelectState(item.state)}>
                  <div className="flex flex-col">
                    <span className="font-medium">{item.state}</span>
                    <span className="text-[10px] text-muted-foreground uppercase">{selectedCountry !== 'all' ? selectedCountry : 'Multiple Countries'}</span>
                  </div>
                  <Badge variant="secondary" className="bg-primary/10 text-primary">{item.count} Alumni</Badge>
                </div>
              ))}

              {currentLevel === 'city' && processedMapData.cities
                .filter(c => (selectedCountry === 'all' || c.country === selectedCountry) && (selectedState === 'all' || c.state === selectedState))
                .sort((a,b)=>b.count-a.count).map(item => (
                <div key={item.city} 
                     className={`flex items-center justify-between p-3 rounded-lg bg-background hover:bg-muted cursor-pointer transition-all border shadow-sm ${selectedCity === item.city ? 'border-primary ring-1 ring-primary' : 'border-border/50 hover:border-border'}`}
                     onClick={() => handleSelectCity(item.city)}>
                  <div className="flex flex-col">
                    <span className="font-medium">{item.city}</span>
                    <span className="text-[10px] text-muted-foreground uppercase">{item.state}</span>
                  </div>
                  <Badge variant="secondary" className="bg-primary/10 text-primary">{item.count} Alumni</Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Map Area */}
          <div className="relative flex-1 h-[500px] lg:h-full overflow-hidden">
            <MapWrapper
              filteredData={finalDisplayData}
              view={mapView}
              viewVersion={viewVersion}
              onZoomEnd={setCurrentZoom}
              onMarkerClick={(item) => {
                if (item.type === 'country') handleSelectCountry(item.id);
                else if (item.type === 'state') handleSelectState(item.id);
                else if (item.type === 'city') handleSelectCity(item.id);
              }}
            />

            {/* Float Legend */}
            <div className="absolute bottom-8 left-8 z-10 bg-background/90 backdrop-blur p-5 rounded-2xl border border-border/50 shadow-2xl">
              <h4 className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground mb-4">Concentration Map</h4>
              <div className="space-y-2">
                {[
                  { label: '1 Alumnus', color: '#fbbf24' },
                  { label: '2-10 Alumni', color: '#f59e0b' },
                  { label: '10-25 Alumni', color: '#d97706' },
                  { label: '25-50 Alumni', color: '#b45309' },
                  { label: '50+ Alumni', color: '#78350f' }
                ].map(row => (
                  <div key={row.label} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ background: row.color }}></div>
                    <span className="text-[11px] font-bold text-foreground">{row.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Header Overlay */}
            <div className="absolute top-8 left-8 z-10 pointer-events-none">
              <Badge variant="outline" className="bg-background/90 backdrop-blur py-2 px-4 shadow-xl border-amber-500/20">
                <Users className="w-4 h-4 mr-2 text-amber-500" />
                <span className="text-sm font-black uppercase tracking-widest text-foreground">
                  {currentLevel === 'country' ? 'Global Reach' : (currentLevel === 'state' ? `Inside ${selectedCountry}` : `Inside ${selectedState}`)}
                </span>
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
