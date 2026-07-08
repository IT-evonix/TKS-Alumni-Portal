import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Globe, RefreshCw, ChevronDown } from 'lucide-react';
import { Map, useMap, AdvancedMarker, InfoWindow, MapMouseEvent } from '@vis.gl/react-google-maps';
import { GoogleMapsOverlay } from '@deck.gl/google-maps';
import { HeatmapLayer } from '@deck.gl/aggregation-layers';
import { supabase } from '@/lib/supabase';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

// Shared card height across loading skeleton and real render — keep in sync.
const MAP_CARD_HEIGHT = 'h-[calc(100vh-220px)] min-h-[420px] max-h-[900px]';

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
  location_type?: string;
  weight?: number;
}

const LOCATION_TYPE_COLORS: Record<string, string> = {
  Home: '#3b82f6',
  University: '#8b5cf6',
  Job: '#10b981',
  Internship: '#f59e0b',
  Other: '#6b7280',
};

function locationTypeColor(type?: string) {
  return type && LOCATION_TYPE_COLORS[type] ? LOCATION_TYPE_COLORS[type] : '#10b981';
}

interface PopupTarget {
  lat: number;
  lng: number;
  alumni: AlumniData[];
}

function AlumniPopupContent({ alumni }: { alumni: AlumniData[] }) {
  const locationTypeBadgeColors: Record<string, React.CSSProperties> = {
    Home: { background: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe' },
    University: { background: '#ede9fe', color: '#6d28d9', border: '1px solid #ddd6fe' },
    Job: { background: '#d1fae5', color: '#065f46', border: '1px solid #a7f3d0' },
    Internship: { background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' },
    Other: { background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' },
  };

  return (
    <div style={{ color: '#0f172a', minWidth: 200, maxWidth: 300, fontFamily: 'inherit' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, borderBottom: '2px solid #f1f5f9', paddingBottom: 12, paddingRight: 8 }}>
        <div style={{ background: '#ecfdf5', color: '#008060', width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #d1fae5', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
          </svg>
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a' }}>Location Details</h3>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b', fontWeight: 500, marginTop: 2 }}>
            {alumni.length} {alumni.length === 1 ? 'Alumnus' : 'Alumni'} located here
          </p>
        </div>
      </div>
      <div style={{ maxHeight: 160, overflowY: 'auto' }}>
        {alumni.map((a, i) => {
          const name = `${a.first_name || ''} ${a.last_name || ''}`.trim() || 'Alumnus';
          const locType = a.location_type || '';
          const badgeStyle: React.CSSProperties = locType && locationTypeBadgeColors[locType] ? locationTypeBadgeColors[locType] : {};
          return (
            <div key={`${a.user_id}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, gap: 12, alignItems: 'center', padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ fontWeight: 600, color: '#0f172a', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {name}
                  {locType && (
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 9999, marginLeft: 6, ...badgeStyle }}>{locType}</span>
                  )}
                </span>
                <span style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.location_label}</span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <a href={`/profile/${a.user_id || a.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, background: '#ecfdf5', color: '#10b981', borderRadius: '50%', textDecoration: 'none', border: '1px solid #d1fae5' }} title="View Profile">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                </a>
                <a href={`/inbox?user=${a.user_id || a.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, background: '#eff6ff', color: '#3b82f6', borderRadius: '50%', textDecoration: 'none', border: '1px solid #dbeafe' }} title="Send Message">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface MapWrapperProps {
  data: AlumniData[];
  view: { center: [number, number]; zoom: number; bounds?: [[number, number], [number, number]] };
  viewVersion: number;
  onBoundsChange?: (bounds: { sw: { lng: number; lat: number }; ne: { lng: number; lat: number }; zoom: number }) => void;
  showHeatmap: boolean;
}

interface HeatmapOverlayProps {
  data: AlumniData[];
  showHeatmap: boolean;
  onHeatmapHidden?: () => void;
}

// Must be rendered as a child of <Map> — useMap() only resolves the map
// instance for components inside the Map's own context, not the component
// that renders <Map> itself.
function HeatmapOverlay({ data, showHeatmap, onHeatmapHidden }: HeatmapOverlayProps) {
  const map = useMap();
  const overlayRef = useRef<GoogleMapsOverlay | null>(null);

  // Create/destroy the deck.gl overlay on map mount (replaces the deprecated
  // google.maps.visualization.HeatmapLayer, removed in Maps JS API v3.65+)
  useEffect(() => {
    if (!map) return;
    const overlay = new GoogleMapsOverlay({ interleaved: false });
    overlay.setMap(map);
    overlayRef.current = overlay;
    return () => {
      overlay.setMap(null);
      overlay.finalize();
      overlayRef.current = null;
    };
  }, [map]);

  // Update heatmap layer whenever data or visibility changes
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    overlay.setProps({
      layers: showHeatmap
        ? [
            new HeatmapLayer({
              id: 'alumni-heatmap',
              data,
              getPosition: (a: AlumniData) => [a.longitude, a.latitude],
              getWeight: (a: AlumniData) => a.weight ?? 1,
              radiusPixels: 45,
              intensity: 3,
              threshold: 0.01,
              aggregation: 'SUM',
              colorRange: [
                [16, 185, 129, 0],
                [16, 185, 129, 200],
                [251, 191, 36, 220],
                [249, 115, 22, 235],
                [239, 68, 68, 255],
              ],
              opacity: 0.8,
            }),
          ]
        : [],
    });
    if (!showHeatmap) onHeatmapHidden?.();
  }, [data, showHeatmap, onHeatmapHidden]);

  return null;
}

function MapWrapper({ data, view, viewVersion, onBoundsChange, showHeatmap }: MapWrapperProps) {
  const map = useMap();
  const prevViewVersionRef = useRef(0);
  const [currentZoom, setCurrentZoom] = useState(view.zoom);
  const [infoTarget, setInfoTarget] = useState<PopupTarget | null>(null);

  // Camera control: respond to external viewVersion changes
  useEffect(() => {
    if (!map) return;
    if (viewVersion === prevViewVersionRef.current) return;
    prevViewVersionRef.current = viewVersion;

    if (view.bounds) {
      const bounds = new google.maps.LatLngBounds();
      bounds.extend({ lat: view.bounds[0][1], lng: view.bounds[0][0] });
      bounds.extend({ lat: view.bounds[1][1], lng: view.bounds[1][0] });
      map.fitBounds(bounds, 50);
    } else {
      map.panTo({ lat: view.center[1], lng: view.center[0] });
      map.setZoom(view.zoom);
    }
  }, [viewVersion, map, view]);

  const handleBoundsChanged = useCallback(() => {
    if (!map || !onBoundsChange) return;
    const b = map.getBounds();
    if (!b) return;
    const sw = b.getSouthWest();
    const ne = b.getNorthEast();
    onBoundsChange({
      sw: { lng: sw.lng(), lat: sw.lat() },
      ne: { lng: ne.lng(), lat: ne.lat() },
      zoom: map.getZoom() ?? currentZoom,
    });
  }, [map, onBoundsChange, currentZoom]);

  const handleZoomChanged = useCallback(() => {
    if (!map) return;
    const z = map.getZoom() ?? 1;
    setCurrentZoom(z);
    handleBoundsChanged();
  }, [map, handleBoundsChanged]);

  // Low-zoom click: drill into country → state → city
  const handleMapClick = useCallback((e: MapMouseEvent) => {
    if (!map || !e.detail.latLng) return;
    const clickLat = e.detail.latLng.lat;
    const clickLng = e.detail.latLng.lng;
    const z = map.getZoom() ?? 1;

    if (z >= 7.5) {
      const COORD_TOLERANCE = 0.01;
      const clicked = data.filter(
        a => Math.abs(a.latitude - clickLat) < COORD_TOLERANCE && Math.abs(a.longitude - clickLng) < COORD_TOLERANCE
      );
      if (clicked.length > 0) {
        setInfoTarget({ lat: clickLat, lng: clickLng, alumni: clicked });
      }
      return;
    }

    let nearest: AlumniData | null = null;
    let minDist = Infinity;
    data.forEach(a => {
      const d = Math.sqrt((a.latitude - clickLat) ** 2 + (a.longitude - clickLng) ** 2);
      if (d < minDist) { minDist = d; nearest = a; }
    });
    if (!nearest || minDist > 20) return;

    const a = nearest as AlumniData;
    if (z < 4) {
      const country = a.current_country || '';
      const group = data.filter(x => x.current_country === country || x.location_label?.includes(country));
      fitGroup(group, 5.5);
    } else if (z < 7) {
      const state = a.current_state || '';
      const group = data.filter(x => x.current_state === state || x.location_label?.includes(state));
      fitGroup(group, 7.5);
    }
  }, [map, data]);

  function fitGroup(group: AlumniData[], maxZoom: number) {
    if (!map || group.length === 0) return;
    let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90;
    group.forEach(a => {
      if (a.longitude < minLng) minLng = a.longitude;
      if (a.longitude > maxLng) maxLng = a.longitude;
      if (a.latitude < minLat) minLat = a.latitude;
      if (a.latitude > maxLat) maxLat = a.latitude;
    });
    if (minLng === maxLng && minLat === maxLat) {
      map.panTo({ lat: minLat, lng: minLng });
      map.setZoom(maxZoom);
    } else {
      const bounds = new google.maps.LatLngBounds();
      bounds.extend({ lat: minLat, lng: minLng });
      bounds.extend({ lat: maxLat, lng: maxLng });
      map.fitBounds(bounds, 50);
      if ((map.getZoom() ?? 0) > maxZoom) map.setZoom(maxZoom);
    }
  }

  const handleMarkerClick = useCallback((alumnus: AlumniData) => {
    const group = data.filter(
      a => a.latitude === alumnus.latitude && a.longitude === alumnus.longitude
    );
    setInfoTarget({ lat: alumnus.latitude, lng: alumnus.longitude, alumni: group });
  }, [data]);

  return (
    <Map
      mapId="alumni-heatmap"
      defaultCenter={{ lat: view.center[1], lng: view.center[0] }}
      defaultZoom={view.zoom}
      maxZoom={14}
      disableDefaultUI
      zoomControl
      zoomControlOptions={{ position: google.maps.ControlPosition.LEFT_BOTTOM }}
      gestureHandling="greedy"
      onBoundsChanged={handleBoundsChanged}
      onZoomChanged={handleZoomChanged}
      onClick={handleMapClick}
      className="w-full h-full rounded-2xl"
    >
      <HeatmapOverlay data={data} showHeatmap={showHeatmap} onHeatmapHidden={() => setInfoTarget(null)} />

      {/* Individual point dots at high zoom */}
      {currentZoom >= 8 && data.map((alumnus, idx) => (
        <AdvancedMarker
          key={`${alumnus.user_id}-${alumnus.latitude}-${alumnus.longitude}-${idx}`}
          position={{ lat: alumnus.latitude, lng: alumnus.longitude }}
          onClick={() => handleMarkerClick(alumnus)}
        >
          <div style={{
            width: currentZoom >= 12 ? 10 : 6,
            height: currentZoom >= 12 ? 10 : 6,
            borderRadius: '50%',
            background: locationTypeColor(alumnus.location_type),
            border: currentZoom >= 12 ? '2px solid white' : '1px solid white',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            cursor: 'pointer',
          }} />
        </AdvancedMarker>
      ))}

      {infoTarget && (
        <InfoWindow
          position={{ lat: infoTarget.lat, lng: infoTarget.lng }}
          onCloseClick={() => setInfoTarget(null)}
          maxWidth={320}
        >
          <AlumniPopupContent alumni={infoTarget.alumni} />
        </InfoWindow>
      )}
    </Map>
  );
}

type SidebarItem = { label: string; count: number; lat: number; lng: number };

interface SidebarItemsListProps {
  sidebarItems: SidebarItem[];
  mapBounds: { sw: { lng: number; lat: number }; ne: { lng: number; lat: number }; zoom: number } | null;
  alumniData: AlumniData[];
  setMapView: (v: { center: [number, number]; zoom: number; bounds?: [[number, number], [number, number]] }) => void;
  setViewVersion: React.Dispatch<React.SetStateAction<number>>;
}

function SidebarItemsList({ sidebarItems, mapBounds, alumniData, setMapView, setViewVersion }: SidebarItemsListProps) {
  if (sidebarItems.length === 0) {
    return (
      <div className="p-6 mt-4 text-center border border-dashed border-border rounded-xl bg-muted/20">
        <div className="relative w-12 h-12 mx-auto mb-3">
          <div className="absolute inset-0 rounded-full bg-muted/60 flex items-center justify-center">
            <MapPin className="w-6 h-6 text-muted-foreground/40" />
          </div>
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-background border border-border flex items-center justify-center">
            <span className="text-[9px] font-bold text-muted-foreground/50">0</span>
          </div>
        </div>
        <p className="text-sm font-semibold text-foreground">No Alumni in View</p>
        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed max-w-[180px] mx-auto">
          Zoom out or pan the map to discover alumni in other areas.
        </p>
      </div>
    );
  }

  return (
    <>
      {sidebarItems.map(item => (
        <div
          key={item.label}
          className="flex items-center justify-between p-3 rounded-lg bg-background hover:bg-muted cursor-pointer transition-all duration-200 border shadow-sm border-border/50 hover:border-primary/30 border-l-[3px] border-l-transparent hover:border-l-primary group"
          onClick={() => {
            const z = mapBounds ? mapBounds.zoom : 1;
            const isCountryLevel = z < 4;
            const isStateLevel = z >= 4 && z < 7;

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
              if (minLng === maxLng && minLat === maxLat) {
                let targetZoom = 10;
                if (isCountryLevel) targetZoom = 5;
                else if (isStateLevel) targetZoom = 8;
                setMapView({ center: [minLng, minLat], zoom: targetZoom });
              } else {
                setMapView({
                  center: [(minLng + maxLng) / 2, (minLat + maxLat) / 2],
                  zoom: 12,
                  bounds: [[minLng, minLat], [maxLng, maxLat]],
                });
              }
              setViewVersion(v => v + 1);
            }
          }}
        >
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
          <Badge
            key={`${item.label}-${item.count}`}
            variant="secondary"
            className="bg-primary/10 text-primary whitespace-nowrap shrink-0"
          >
            {item.count} {item.count === 1 ? 'Alumnus' : 'Alumni'}
          </Badge>
        </div>
      ))}
    </>
  );
}

interface AlumniHeatMapProps {
  onDataLoad?: (stats: { totalAlumni: number; countries: number; continents: number }) => void;
}

export default function AlumniHeatMap({ onDataLoad }: AlumniHeatMapProps) {
  const [alumniData, setAlumniData] = useState<AlumniData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [mapBounds, setMapBounds] = useState<{ sw: { lng: number; lat: number }; ne: { lng: number; lat: number }; zoom: number } | null>(null);
  const [mapView, setMapView] = useState<{ center: [number, number]; zoom: number; bounds?: [[number, number], [number, number]] }>({ center: [100, 30], zoom: 2.5 });
  const [viewVersion, setViewVersion] = useState(0);

  const hasLoadedOnce = useRef(false);

  const fetchData = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const res = await fetch('/api/alumni-map/map-data', { cache: 'no-store' });
      const data = await res.json();
      const loadedAlumni: AlumniData[] = data.alumni || [];
      setAlumniData(loadedAlumni);

      if (onDataLoad) {
        const seenUsers = new Set<string>();
        loadedAlumni.forEach(a => { if (a.user_id) seenUsers.add(a.user_id); });

        const uniqueCountries = new Set(
          loadedAlumni.map(a => a.current_country || '').filter(Boolean)
        );
        const CONTINENT_MAP: Record<string, string> = {
          'United States': 'NA', 'Canada': 'NA', 'Mexico': 'NA',
          'Brazil': 'SA', 'Argentina': 'SA', 'Colombia': 'SA', 'Chile': 'SA', 'Peru': 'SA',
          'United Kingdom': 'EU', 'Germany': 'EU', 'France': 'EU', 'Spain': 'EU', 'Italy': 'EU',
          'Netherlands': 'EU', 'Sweden': 'EU', 'Norway': 'EU', 'Denmark': 'EU', 'Finland': 'EU',
          'Switzerland': 'EU', 'Austria': 'EU', 'Belgium': 'EU', 'Portugal': 'EU', 'Poland': 'EU',
          'China': 'AS', 'Japan': 'AS', 'India': 'AS', 'South Korea': 'AS', 'Indonesia': 'AS',
          'Pakistan': 'AS', 'Vietnam': 'AS', 'Thailand': 'AS', 'Malaysia': 'AS', 'Singapore': 'AS',
          'Philippines': 'AS', 'Taiwan': 'AS', 'Hong Kong': 'AS', 'Israel': 'AS', 'Turkey': 'AS',
          'Saudi Arabia': 'AS', 'UAE': 'AS', 'Qatar': 'AS',
          'Nigeria': 'AF', 'Egypt': 'AF', 'Ghana': 'AF', 'Kenya': 'AF', 'South Africa': 'AF',
          'Ethiopia': 'AF', 'Morocco': 'AF', 'Tanzania': 'AF',
          'Australia': 'OC', 'New Zealand': 'OC',
        };
        const uniqueContinents = new Set(
          Array.from(uniqueCountries).map(c => CONTINENT_MAP[c] || null).filter(Boolean)
        );
        onDataLoad({
          totalAlumni: seenUsers.size,
          countries: uniqueCountries.size,
          continents: uniqueContinents.size,
        });
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

  useEffect(() => {
    const channel = supabase
      .channel('alumni-map-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alumni' }, () => fetchData(false))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alumni_locations' }, () => fetchData(false))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const sidebarItems = useMemo(() => {
    if (!mapBounds) return [];

    const visible = alumniData.filter(a => {
      let lng = a.longitude;
      while (lng < mapBounds.sw.lng) lng += 360;
      while (lng > mapBounds.ne.lng) lng -= 360;
      return a.latitude >= mapBounds.sw.lat && a.latitude <= mapBounds.ne.lat &&
        lng >= mapBounds.sw.lng && lng <= mapBounds.ne.lng;
    });

    type GroupEntry = { label: string; count: number; lat: number; lng: number; seen: Set<string> };
    const groups = new globalThis.Map<string, GroupEntry>();
    const z = mapBounds.zoom;
    const isCountryLevel = z < 4;
    const isStateLevel = z >= 4 && z < 7;

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
        groups.set(label, { label, count: 0, lat: a.latitude, lng: a.longitude, seen: new globalThis.Set<string>() });
      }
      const group = groups.get(label)!;
      if (!group.seen.has(a.user_id)) {
        group.seen.add(a.user_id);
        group.count++;
      }
    });

    return Array.from(groups.values())
      .map(({ seen: _seen, ...rest }) => rest)
      .sort((a, b) => b.count - a.count);
  }, [alumniData, mapBounds]);

  if (loading) return (
    <div className="p-0 space-y-6 w-full">
      <div className={`overflow-hidden border border-slate-200 shadow-sm rounded-2xl ${MAP_CARD_HEIGHT}`}>
        <div className="flex flex-col lg:flex-row w-full h-full relative">
          <div className="hidden lg:flex w-full lg:w-[280px] xl:w-[300px] border-t lg:border-t-0 lg:border-r border-slate-100 bg-white/60 flex-col h-full overflow-hidden shrink-0 p-4 gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Skeleton className="w-5 h-5 rounded-full" />
                <Skeleton className="w-28 h-5 rounded" />
                <Skeleton className="w-14 h-5 rounded-full" />
              </div>
              <Skeleton className="w-20 h-8 rounded-lg" />
            </div>
            <Skeleton className="w-36 h-3 rounded mt-1" />
            <div className="space-y-2 mt-1">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-slate-100">
                  <div className="space-y-1.5 flex-1 pr-3">
                    <Skeleton className="w-3/4 h-4 rounded" />
                    <Skeleton className="w-1/2 h-3 rounded" />
                  </div>
                  <Skeleton className="w-16 h-5 rounded-full" />
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1 h-full relative overflow-hidden lg:rounded-tr-2xl lg:rounded-br-2xl">
            <div className="w-full h-full animate-pulse" style={{ background: 'linear-gradient(135deg, #e8f4f0 0%, #d1ece4 30%, #e8f4f0 60%, #d1ece4 100%)' }} />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-full border-2 border-[#008060]/30 border-t-[#008060] animate-spin" />
              <p className="text-sm font-medium text-[#008060]/70 tracking-wide">Loading global network…</p>
            </div>
          </div>
          {/* Mobile collapsed directory bar placeholder */}
          <div className="lg:hidden absolute bottom-0 left-0 right-0 bg-white/95 border-t border-slate-100 px-4 py-3 flex items-center justify-between">
            <Skeleton className="w-40 h-4 rounded" />
            <Skeleton className="w-5 h-5 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );

  if (error) return <Card className="p-6 text-center text-destructive m-4">Error: {error}</Card>;

  return (
    <div className="p-0 space-y-6 w-full">
      <Card className={`border shadow-sm overflow-hidden rounded-2xl bg-card border-gray-200 ${MAP_CARD_HEIGHT}`}>
        <CardContent className="p-0 flex flex-col lg:flex-row w-full h-full relative">

          {/* Sidebar (desktop: static side panel; mobile: collapsible bottom sheet) */}
          <Collapsible
            open={sidebarOpen}
            onOpenChange={setSidebarOpen}
            className="lg:contents"
          >
          <div className="lg:hidden absolute bottom-0 left-0 right-0 z-20 bg-background border-t border-border rounded-t-2xl shadow-[0_-4px_16px_rgba(0,0,0,0.08)] max-h-[70%] flex flex-col">
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between gap-2 px-4 py-3 shrink-0" aria-label="Toggle alumni directory">
                <div className="flex items-center gap-2 min-w-0">
                  <Globe className="w-4 h-4 text-primary shrink-0" />
                  <span className="font-bold text-sm truncate">Global Directory</span>
                  {alumniData.length > 0 && (
                    <span className="inline-flex items-center bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full leading-none whitespace-nowrap shrink-0">
                      {new Set(alumniData.map(a => a.user_id)).size} alumni
                    </span>
                  )}
                </div>
                <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 ${sidebarOpen ? 'rotate-180' : ''}`} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="overflow-y-auto px-4 pb-4 space-y-2">
              <SidebarItemsList
                sidebarItems={sidebarItems}
                mapBounds={mapBounds}
                alumniData={alumniData}
                setMapView={setMapView}
                setViewVersion={setViewVersion}
              />
            </CollapsibleContent>
          </div>
          <div className="hidden lg:flex w-full lg:w-[280px] xl:w-[300px] border-t lg:border-t-0 lg:border-r border-border bg-muted/10 flex-col h-full overflow-hidden shrink-0">
            <div className="p-4 border-b border-border sticky top-0 bg-background/95 backdrop-blur z-10 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Globe className="w-5 h-5 text-primary shrink-0" />
                <h3 className="font-bold text-base leading-none">Global Directory</h3>
                {alumniData.length > 0 && (
                  <span className="inline-flex items-center bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full leading-none whitespace-nowrap">
                    {new Set(alumniData.map(a => a.user_id)).size} alumni
                  </span>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1.5 text-xs h-8 px-2.5 shrink-0 border-border hover:border-primary/40 hover:text-primary transition-colors"
                onClick={() => {
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
                        center: [(minLng + maxLng) / 2, (minLat + maxLat) / 2],
                        zoom: 1,
                        bounds: [[minLng, minLat], [maxLng, maxLat]],
                      });
                    } else {
                      setMapView({ center: [minLng, minLat], zoom: 2.5 });
                    }
                    setViewVersion(v => v + 1);
                  } else {
                    setMapView({ center: [100, 30], zoom: 2.5 });
                    setViewVersion(v => v + 1);
                  }
                }}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reset
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3 px-1 select-none">
                {mapBounds && mapBounds.zoom < 4 ? 'Countries in View' : (mapBounds && mapBounds.zoom < 7 ? 'States / Regions in View' : 'Cities / Locations in View')}
              </p>
              <SidebarItemsList
                sidebarItems={sidebarItems}
                mapBounds={mapBounds}
                alumniData={alumniData}
                setMapView={setMapView}
                setViewVersion={setViewVersion}
              />
            </div>
          </div>
          </Collapsible>

          {/* Map Area */}
          <div className="relative w-full h-full flex-1 overflow-hidden">
            <MapWrapper
              data={alumniData}
              view={mapView}
              viewVersion={viewVersion}
              onBoundsChange={setMapBounds}
              showHeatmap={showHeatmap}
            />

            {/* Legend */}
            <div className={`absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-10 bg-background/95 backdrop-blur-md px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl border border-border/50 shadow-lg w-[150px] sm:w-[230px] transition-all duration-300 ${!showHeatmap ? 'opacity-65' : ''}`}>
              <div className="flex items-center justify-between gap-3 mb-2">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground leading-none">
                  <span className="inline sm:hidden">Density</span>
                  <span className="hidden sm:inline">Heatmap Density</span>
                </h4>
                <Switch
                  checked={showHeatmap}
                  onCheckedChange={setShowHeatmap}
                  className="scale-75 origin-right"
                  aria-label="Toggle heatmap density layer"
                />
              </div>
              <div
                className="w-full h-2 rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] transition-all duration-300"
                style={{
                  background: 'linear-gradient(to right, #10b981, #fbbf24, #f97316, #ef4444)',
                  filter: showHeatmap ? 'none' : 'grayscale(100%) opacity(30%)',
                }}
              />
              <div className="flex justify-between items-center text-[9px] sm:text-[10px] font-bold text-muted-foreground px-0.5 mt-1.5">
                <span>Low</span>
                <span className="hidden sm:inline">Medium</span>
                <span>High</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
