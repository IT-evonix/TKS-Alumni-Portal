import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from "@/components/ui/input";
import { MapPin, X, Loader2, Building2, Locate } from "lucide-react";
import { useMapsLibrary } from '@vis.gl/react-google-maps';

interface CityAutocompleteProps {
  city: string;
  onCityChange: (city: string) => void;
  onLocationSelect: (city: string, state: string, country: string, lat?: number, lng?: number, label?: string) => void;
  disabled?: boolean;
}

function getAddressComponent(components: google.maps.places.AddressComponent[] | undefined, type: string): string {
  return components?.find(c => c.types.includes(type))?.longText ?? '';
}

function getPlaceType(types: string[] | undefined): string {
  const t = types || [];
  if (t.some(x => ['locality', 'postal_town'].includes(x))) return 'City';
  if (t.some(x => ['sublocality', 'neighborhood'].includes(x))) return 'Area';
  if (t.some(x => ['administrative_area_level_1', 'administrative_area_level_2'].includes(x))) return 'Region';
  if (t.some(x => ['university', 'school'].includes(x))) return 'Education';
  return 'Location';
}

export function CityAutocomplete({ city, onCityChange, onLocationSelect, disabled }: CityAutocompleteProps) {
  const placesLib = useMapsLibrary('places');
  const [query, setQuery] = useState(city || '');
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

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
    };
  }, []);

  const getSessionToken = useCallback(() => {
    if (!sessionTokenRef.current && placesLib) {
      sessionTokenRef.current = new placesLib.AutocompleteSessionToken();
    }
    return sessionTokenRef.current;
  }, [placesLib]);

  const fetchSuggestions = useCallback(async (text: string) => {
    if (!placesLib || !text.trim() || text.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    try {
      const request: google.maps.places.AutocompleteRequest = {
        input: text,
        sessionToken: getSessionToken() ?? undefined,
      };

      const { suggestions: results } = await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
      const predictions = (results || []).filter(r => r.placePrediction);
      setSuggestions(predictions);
      setShowSuggestions(predictions.length > 0);
    } catch (error) {
      console.error("Error fetching location suggestions", error);
      setSearchError("Location search is unavailable right now. Please try again later.");
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsSearching(false);
    }
  }, [placesLib, getSessionToken]);

  const searchLocation = (text: string) => {
    isTypingRef.current = true;
    setQuery(text);
    onCityChange(text);

    setSearchError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(text);
    }, 500);
  };

  const selectSuggestion = async (suggestion: google.maps.places.AutocompleteSuggestion) => {
    const placePrediction = suggestion.placePrediction;
    if (!placePrediction) return;

    isTypingRef.current = false;
    setSuggestions([]);
    setShowSuggestions(false);

    try {
      const place = placePrediction.toPlace();
      await place.fetchFields({ fields: ['location', 'addressComponents', 'formattedAddress'] });

      const comps = place.addressComponents ?? undefined;
      const cityName = getAddressComponent(comps, 'locality')
        || getAddressComponent(comps, 'postal_town')
        || getAddressComponent(comps, 'sublocality')
        || getAddressComponent(comps, 'administrative_area_level_2');
      const state = getAddressComponent(comps, 'administrative_area_level_1');
      const country = getAddressComponent(comps, 'country');
      const lat = place.location?.lat();
      const lng = place.location?.lng();
      const full = place.formattedAddress ?? placePrediction.text.text;

      setQuery(full);
      onCityChange(cityName || full);
      onLocationSelect(cityName, state, country, lat, lng, full);
    } catch (error) {
      console.error("Error fetching place details", error);
    } finally {
      // Reset the session so the next search starts a new billed session
      sessionTokenRef.current = null;
    }
  };

  const clearInput = () => {
    isTypingRef.current = false;
    setQuery('');
    onCityChange('');
    onLocationSelect('', '', '');
    setSuggestions([]);
    setShowSuggestions(false);
    sessionTokenRef.current = null;
  };

  const handleLocateUser = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    if (!window.google?.maps) {
      console.error("Google Maps not loaded yet");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const geocoder = new google.maps.Geocoder();
          const response = await geocoder.geocode({ location: { lat: latitude, lng: longitude } });
          const result = response.results[0];

          if (result) {
            const comps = result.address_components;
            const find = (type: string) => comps.find(c => c.types.includes(type))?.long_name ?? '';
            const cityName = find('locality') || find('postal_town') || find('sublocality');
            const state = find('administrative_area_level_1');
            const country = find('country');
            const full = result.formatted_address;

            setQuery(full);
            onCityChange(cityName || full);
            onLocationSelect(cityName, state, country, latitude, longitude, full);
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
          placeholder="Search location (City, State, Country...)"
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

      {searchError && (
        <p className="text-xs text-destructive mt-1.5 px-0.5">{searchError}</p>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-background rounded-md shadow-lg border border-border max-h-80 overflow-auto">
          {suggestions.map((suggestion, index) => {
            const prediction = suggestion.placePrediction!;
            const mainText = prediction.mainText?.text || prediction.text.text;
            const secondaryText = prediction.secondaryText?.text || '';

            return (
              <div
                key={`${prediction.placeId || index}`}
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
                    <span className="font-semibold text-foreground truncate">{mainText}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold shrink-0 uppercase border border-primary/20">
                      {getPlaceType(prediction.types)}
                    </span>
                  </div>
                  {secondaryText && (
                    <p className="text-xs text-muted-foreground mt-0.5 whitespace-normal line-clamp-2">
                      {secondaryText}
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
