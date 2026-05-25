import React, { useState, useEffect, useRef } from 'react';
import { Input } from "@/components/ui/input";
import { MapPin, X } from "lucide-react";

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
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(city || '');
  }, [city]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchLocation = async (text: string) => {
    setQuery(text);
    onCityChange(text);

    if (!text.trim() || text.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&featuretype=city&addressdetails=1&limit=5`);
      const data = await res.json();
      setSuggestions(data);
      setShowSuggestions(true);
    } catch (error) {
      console.error("Error fetching city suggestions", error);
    }
  };

  const selectSuggestion = (suggestion: any) => {
    const address = suggestion.address;
    const selectedCity = address.city || address.town || address.village || address.county || suggestion.name || '';
    const selectedState = address.state || '';
    const selectedCountry = address.country || '';
    
    setQuery(selectedCity);
    onLocationSelect(selectedCity, selectedState, selectedCountry);
    setShowSuggestions(false);
  };

  const clearInput = () => {
    setQuery('');
    onCityChange('');
    setSuggestions([]);
    setShowSuggestions(false);
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
          placeholder="City"
          disabled={disabled}
          className="pl-9 pr-9 min-h-[44px]"
          autoComplete="off"
        />
        {query && !disabled && (
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
        <div className="absolute z-50 w-full mt-1 bg-background rounded-md shadow-lg border border-border max-h-60 overflow-auto">
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              className="px-4 py-2.5 hover:bg-muted cursor-pointer text-sm border-b border-border last:border-0 flex items-start gap-2"
              onClick={() => selectSuggestion(suggestion)}
            >
              <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <span>{suggestion.display_name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
