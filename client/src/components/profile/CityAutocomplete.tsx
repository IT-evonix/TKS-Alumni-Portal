import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from "@/components/ui/input";
import { MapPin, X, Loader2 } from "lucide-react";

interface CityAutocompleteProps {
  city: string;
  onCityChange: (city: string) => void;
  onLocationSelect: (city: string, state: string, country: string) => void;
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
  // Track whether the user is actively typing so we don't let the parent
  // prop sync overwrite their input mid-search.
  const isTypingRef = useRef(false);

  // Only sync from parent prop when the user is NOT actively typing.
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

  // Cleanup on unmount
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

    // Abort any in-flight request
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setIsSearching(true);
    try {
      const params = new URLSearchParams({
        format: 'json',
        q: text,
        addressdetails: '1',
        limit: '8',
        'accept-language': 'en',
      });

      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`,
        {
          signal: abortRef.current.signal,
          headers: {
            'User-Agent': 'TKS-Alumni-Portal/1.0'
          }
        }
      );

      if (!res.ok) {
        console.error("Nominatim returned status:", res.status);
        setIsSearching(false);
        return;
      }

      const data = await res.json();
      setSuggestions(data || []);
      setShowSuggestions((data || []).length > 0);
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

    // Debounce API calls (500ms) to respect Nominatim rate-limit (1 req/sec)
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(text);
    }, 500);
  };

  /**
   * Extract structured location parts from Nominatim address.
   * 
   * Nominatim returns for Indian locations:
   *   address.village / town / city  → Place name (Pipri)
   *   address.county                 → Taluka name (Dharangaon)
   *   address.state_district         → District name (Jalgaon)
   *   address.state                  → State (Maharashtra)
   *   address.country                → Country (India)
   */
  const extractLocationParts = (suggestion: any) => {
    const address = suggestion.address || {};

    // The place (most specific)
    const place =
      address.village ||
      address.hamlet ||
      address.town ||
      address.suburb ||
      address.neighbourhood ||
      address.city ||
      suggestion.name ||
      '';

    // Taluka / Tehsil (county in Nominatim)
    const taluka = address.county || '';

    // District (state_district in Nominatim)
    const district = address.state_district || '';

    // City (if village/town exists, then city is the larger city nearby)
    const city = address.city || '';

    // State
    const state = address.state || address.province || '';

    // Country
    const country = address.country || '';

    return { place, taluka, district, city, state, country };
  };

  const selectSuggestion = (suggestion: any) => {
    isTypingRef.current = false;
    const { place, taluka, district, state, country } = extractLocationParts(suggestion);

    // Build a rich city display name:
    // "Pipri, Dharangaon (Taluka), Jalgaon (District)"
    // This gives full context of where exactly the location is
    const cityParts: string[] = [];
    if (place) cityParts.push(place);
    if (taluka && taluka !== place && taluka !== district) cityParts.push(taluka);
    if (district && district !== place && district !== state) cityParts.push(district);
    const displayCity = cityParts.join(', ') || place;

    setQuery(displayCity);
    setSuggestions([]);
    setShowSuggestions(false);
    onLocationSelect(displayCity, state, country);
  };

  const clearInput = () => {
    isTypingRef.current = false;
    setQuery('');
    onCityChange('');
    onLocationSelect('', '', '');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  /**
   * Format the suggestion display for the dropdown.
   * Shows proper hierarchy:
   *   Place name (bold) → Taluka → District → State → Country
   * Example: "Pipri → Dharangaon → Jalgaon → Maharashtra → India"
   */
  const formatDisplayParts = (suggestion: any) => {
    const { place, taluka, district, city, state, country } = extractLocationParts(suggestion);

    // Primary = place name (village/town/city)
    const primary = place || suggestion.name || '';

    // Build hierarchy trail: Taluka → District → State → Country
    const trail: string[] = [];
    if (taluka && taluka !== primary) trail.push(taluka);
    if (district && district !== primary && district !== taluka) trail.push(district);
    // If it's a village/town, also mention the nearest city if different
    if (city && city !== primary && city !== district && city !== taluka) trail.push(city);
    if (state && state !== district) trail.push(state);
    if (country) trail.push(country);

    return { primary, trail: trail.join(' › ') };
  };

  // Get type badge for the suggestion
  const getPlaceType = (suggestion: any): string => {
    const address = suggestion.address || {};
    if (address.village) return 'Village';
    if (address.hamlet) return 'Hamlet';
    if (address.town) return 'Town';
    if (address.suburb || address.neighbourhood) return 'Area';
    if (address.city && !address.village && !address.town) return 'City';
    if (address.state_district && !address.city && !address.village && !address.town) return 'District';
    if (address.state && !address.state_district) return 'State';
    return suggestion.type || 'Place';
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
          placeholder="Search any location (city, village, area...)"
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
                key={`${suggestion.place_id || index}`}
                className="px-4 py-3 hover:bg-muted cursor-pointer text-sm border-b border-border last:border-0 flex items-start gap-2.5"
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                onClick={() => selectSuggestion(suggestion)}
              >
                <MapPin className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{primary}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold shrink-0 uppercase">
                      {getPlaceType(suggestion)}
                    </span>
                  </div>
                  {trail && (
                    <p className="text-xs text-muted-foreground mt-0.5">
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
