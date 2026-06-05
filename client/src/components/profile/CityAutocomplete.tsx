import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from "@/components/ui/input";
import { MapPin, X, Loader2, Building2, Locate } from "lucide-react";

const PHOTON_API_URL = (import.meta.env.VITE_PHOTON_API_URL || 'https://photon.komoot.io').replace(/\/$/, '');

interface CityAutocompleteProps {
  city: string;
  onCityChange: (city: string) => void;
  onLocationSelect: (city: string, state: string, country: string, lat?: number, lng?: number, label?: string) => void;
  disabled?: boolean;
}

export function CityAutocomplete({ city, onCityChange, onLocationSelect, disabled }: CityAutocompleteProps) {
  const [query, setQuery] = useState(city || '');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const isTypingRef = useRef(false);

  useEffect(() => {
    if (!isTypingRef.current) {
      setQuery(city || '');
    }
  }, [city]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
        isTypingRef.current = false;
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const fetchSuggestions = useCallback(async (text: string) => {
    if (!text.trim() || text.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsSearching(false);
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setIsSearching(true);
    try {
      // Use Photon API for fuzzy search (handles typos like "jalgoan", "dharngoan")
      // It is much more tolerant than Nominatim for long unstructured addresses
      const params = new URLSearchParams({
        q: text,
        limit: '15',
        lang: 'en'
      });

      const res = await fetch(
        `${PHOTON_API_URL}/api/?${params.toString()}`,
        { signal: abortRef.current.signal }
      );

      if (!res.ok) {
        setIsSearching(false);
        return;
      }

      const data = await res.json();

      if (data.features && data.features.length > 0) {
        const uniqueSuggestions = [];
        const seenNames = new Set<string>();

        for (const feature of data.features) {
          const props = feature.properties;
          
          // Construct a highly detailed hierarchical name from Photon properties
          const parts = [];
          const localName = props.village || props.town || props.city || props.locality || props.hamlet;
          const isGeographic = ['city', 'town', 'village', 'hamlet', 'locality', 'district'].includes(props.type);

          if (isGeographic && props.name) {
            parts.push(props.name);
          } else if (localName) {
            parts.push(localName);
          } else if (props.name) {
            parts.push(props.name);
          }

          const baseName = parts[0] || '';
          if (localName && localName !== baseName) parts.push(localName);
          
          if (props.county && props.county !== baseName && props.county !== localName) parts.push(props.county);
          if (props.state && props.state !== props.county) parts.push(props.state);
          if (props.country) parts.push(props.country);

          const fullDisplayName = parts.join(', ');
          
          const uniqueKey = fullDisplayName.toLowerCase().trim();
          if (!seenNames.has(uniqueKey) && parts.length > 1) {
            seenNames.add(uniqueKey);
            // Attach the constructed display name to the feature for later use
            feature.display_name = fullDisplayName;
            uniqueSuggestions.push(feature);
          }
        }

        setSuggestions(uniqueSuggestions.slice(0, 10));
        setShowSuggestions(uniqueSuggestions.length > 0);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') return;
      console.error("Error fetching location suggestions", error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const searchLocation = (text: string) => {
    isTypingRef.current = true;
    setQuery(text);
    onCityChange(text);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    // 500ms debounce is fine for Photon
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(text);
    }, 500); 
  };

  const extractLocationParts = (item: any) => {
    const props = item.properties || {};
    
    // Prioritize clean geographic divisions over building/POI names
    const localName = props.village || props.town || props.city || props.locality || props.hamlet;
    const isGeographic = ['city', 'town', 'village', 'hamlet', 'locality', 'district'].includes(props.type);
    
    const place = (isGeographic && props.name) ? props.name : (localName || props.name || '');
    const state = props.state || '';
    const country = props.country || '';

    return { place, state, country, full: item.display_name };
  };

  const selectSuggestion = (item: any) => {
    isTypingRef.current = false;
    const { place, state, country, full } = extractLocationParts(item);
    
    // We display the full hierarchical name as requested
    setQuery(full);
    setSuggestions([]);
    setShowSuggestions(false);

    // Photon uses GeoJSON format: [lng, lat]
    const lng = parseFloat(item.geometry.coordinates[0]);
    const lat = parseFloat(item.geometry.coordinates[1]);

    // full variable contains the exact hierarchy: City/Village, Tehsil, District, State, Country
    onLocationSelect(place, state, country, lat, lng, full);
  };

  const clearInput = () => {
    isTypingRef.current = false;
    setQuery('');
    onCityChange('');
    onLocationSelect('', '', '');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleLocateUser = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const res = await fetch(`${PHOTON_API_URL}/reverse?lat=${latitude}&lon=${longitude}&lang=en`);
          if (!res.ok) throw new Error("Reverse geocoding failed");
          
          const data = await res.json();
          if (data.features && data.features.length > 0) {
            const feature = data.features[0];
            
            const props = feature.properties || {};
            const parts = [];
            const localName = props.village || props.town || props.city || props.locality || props.hamlet;
            const isGeographic = ['city', 'town', 'village', 'hamlet', 'locality', 'district'].includes(props.type);

            if (isGeographic && props.name) {
              parts.push(props.name);
            } else if (localName) {
              parts.push(localName);
            } else if (props.name) {
              parts.push(props.name);
            }

            const baseName = parts[0] || '';
            if (localName && localName !== baseName) parts.push(localName);
            
            if (props.county && props.county !== baseName && props.county !== localName) parts.push(props.county);
            if (props.state && props.state !== props.county) parts.push(props.state);
            if (props.country) parts.push(props.country);

            const fullDisplayName = parts.join(', ');
            feature.display_name = fullDisplayName;

            const { place, state, country, full } = extractLocationParts(feature);
            
            setQuery(full || place);
            onCityChange(place);
            onLocationSelect(place, state, country, latitude, longitude, full || place);
          } else {
            console.error("No location found for coordinates");
          }
        } catch (err) {
          console.error("Error reverse geocoding user location:", err);
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        console.error("Error getting geolocation:", error);
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const getPlaceType = (item: any): string => {
    const type = item.properties?.osm_value || '';
    if (['city', 'town', 'municipality'].includes(type)) return 'City';
    if (['village', 'hamlet'].includes(type)) return 'Village';
    if (['suburb', 'neighbourhood'].includes(type)) return 'Area';
    if (['administrative', 'state', 'province'].includes(type)) return 'Region';
    if (['college', 'university', 'school'].includes(type)) return 'Education';
    return 'Location';
  };

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div className="relative flex-1">
        <MapPin className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => searchLocation(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) setShowSuggestions(true);
          }}
          onBlur={() => {
            setTimeout(() => {
              isTypingRef.current = false;
            }, 300);
          }}
          placeholder="Search location (Village, City, State, Country...)"
          disabled={disabled}
          className="pl-9 pr-9 min-h-[44px]"
          autoComplete="off"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-3.5 h-4 w-4 text-muted-foreground animate-spin" />
        )}
        {isLocating && (
          <Loader2 className="absolute right-3 top-3.5 h-4 w-4 text-primary animate-spin" />
        )}
        {!query && !disabled && !isSearching && !isLocating && (
          <button
            type="button"
            onClick={handleLocateUser}
            className="absolute right-3 top-3.5 text-muted-foreground hover:text-primary transition-colors"
            title="Use current location"
          >
            <Locate className="h-4 w-4" />
          </button>
        )}
        {query && !disabled && !isSearching && !isLocating && (
          <button
            type="button"
            onClick={clearInput}
            className="absolute right-3 top-3.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-background rounded-md shadow-lg border border-border max-h-80 overflow-auto">
          {suggestions.map((suggestion, index) => {
            const { place } = extractLocationParts(suggestion);
            const fullLabel = suggestion.display_name;
            
            return (
              <div
                key={`${suggestion.place_id || index}`}
                className="px-4 py-3 hover:bg-muted cursor-pointer text-sm border-b border-border last:border-0 flex items-start gap-3"
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                onClick={() => selectSuggestion(suggestion)}
              >
                <div className="mt-0.5 shrink-0 bg-primary/10 p-1.5 rounded-md">
                  <Building2 className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground truncate">{place || suggestion.properties?.name || 'Unknown'}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold shrink-0 uppercase border border-primary/20">
                      {getPlaceType(suggestion)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 whitespace-normal line-clamp-2">
                    {fullLabel}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
