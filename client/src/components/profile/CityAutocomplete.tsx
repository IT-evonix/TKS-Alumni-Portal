import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from "@/components/ui/input";
import { MapPin, X, Loader2, Building2 } from "lucide-react";

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
      // Using Photon API (by Komoot) - Built on OpenStreetMap for Autocomplete
      // This guarantees coordinates match the base map EXACTLY, but gives much better suggestions than Nominatim.
      const params = new URLSearchParams({
        q: text,
        limit: '10',
        lang: 'en'
      });

      const res = await fetch(
        `https://photon.komoot.io/api/?${params.toString()}`,
        {
          signal: abortRef.current.signal
        }
      );

      if (!res.ok) {
        setIsSearching(false);
        return;
      }

      const data = await res.json();

      if (data.features) {
        // Filter and deduplicate
        const seenNames = new Set<string>();
        const uniqueSuggestions = [];

        for (const feature of data.features) {
          const props = feature.properties;

          // Filter out purely commercial places or addresses if we only want cities/villages
          if (['house', 'building', 'highway'].includes(props.osm_value)) {
            continue;
          }

          const place = props.name || props.city || props.town || props.village || '';
          const state = props.state || '';
          const country = props.country || '';

          const uniqueKey = `${place}-${state}-${country}`.toLowerCase().trim();

          if (!seenNames.has(uniqueKey) && place) {
            seenNames.add(uniqueKey);
            uniqueSuggestions.push(feature);
          }
        }

        setSuggestions(uniqueSuggestions.slice(0, 7));
        setShowSuggestions(uniqueSuggestions.length > 0);
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
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(text);
    }, 500);
  };

  const extractLocationParts = (feature: any) => {
    const props = feature.properties;
    const place = props.name || props.city || props.town || props.village || props.locality || '';
    let state = props.state || '';
    const country = props.country || '';
    const district = props.county || props.district || '';

    if (!state) {
      state = place;
    }

    return { place, district, state, country };
  };

  const selectSuggestion = (feature: any) => {
    isTypingRef.current = false;
    const { place, state, country, district } = extractLocationParts(feature);
    const displayCity = place;

    setQuery(displayCity);
    setSuggestions([]);
    setShowSuggestions(false);

    // Photon returns [lon, lat]
    const lng = feature.geometry.coordinates[0];
    const lat = feature.geometry.coordinates[1];

    // Create a precise label for backend storage
    const labelParts = [];
    if (place) labelParts.push(place);
    if (district && district !== place) labelParts.push(district);
    if (state && state !== district && state !== place) labelParts.push(state);
    if (country) labelParts.push(country);
    const fullLabel = labelParts.join(', ');

    onLocationSelect(displayCity, state, country, lat, lng, fullLabel);
  };

  const clearInput = () => {
    isTypingRef.current = false;
    setQuery('');
    onCityChange('');
    onLocationSelect('', '', '');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const formatDisplayParts = (feature: any) => {
    const { place, district, state, country } = extractLocationParts(feature);

    const primary = place;

    const trailParts = [];
    if (district && district !== primary) trailParts.push(district);
    if (state && state !== primary && state !== district) trailParts.push(state);
    if (country && country !== primary) trailParts.push(country);

    return { primary, trail: trailParts.join(', ') };
  };

  const getPlaceType = (feature: any): string => {
    const type = feature.properties.osm_value || '';
    if (['city', 'town', 'municipality'].includes(type)) return 'City';
    if (['village', 'hamlet'].includes(type)) return 'Village';
    if (['suburb', 'neighbourhood'].includes(type)) return 'Area';
    if (['administrative', 'state', 'province'].includes(type)) return 'State/Region';
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
          placeholder="Search for a city or village (e.g., Pune, Erandol...)"
          disabled={disabled}
          className="pl-9 pr-9 min-h-[44px]"
          autoComplete="off"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-3.5 h-4 w-4 text-muted-foreground animate-spin" />
        )}
        {query && !disabled && !isSearching && (
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
        <div className="absolute z-50 w-full mt-1 bg-background rounded-md shadow-lg border border-border max-h-72 overflow-auto">
          {suggestions.map((suggestion, index) => {
            const { primary, trail } = formatDisplayParts(suggestion);
            return (
              <div
                key={`${suggestion.properties?.osm_id || index}`}
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
                    <span className="font-semibold text-foreground truncate">{primary}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold shrink-0 uppercase border border-primary/20">
                      {getPlaceType(suggestion)}
                    </span>
                  </div>
                  {trail && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {trail}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
