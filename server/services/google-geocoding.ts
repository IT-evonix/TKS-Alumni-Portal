import axios from 'axios';

export interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress?: string;
}

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || '';

export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  if (!GOOGLE_MAPS_API_KEY) {
    console.error('[GEO] GOOGLE_MAPS_API_KEY is not configured; cannot geocode');
    return null;
  }

  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: {
        address: trimmed,
        key: GOOGLE_MAPS_API_KEY,
      },
    });

    const { status, results } = response.data;

    if (status === 'OK' && results?.length > 0) {
      const { lat, lng } = results[0].geometry.location;
      return { lat, lng, formattedAddress: results[0].formatted_address };
    }

    if (status === 'ZERO_RESULTS') {
      return null;
    }

    if (status === 'OVER_QUERY_LIMIT' || status === 'REQUEST_DENIED') {
      console.error(`[GEO] Google Geocoding API misconfiguration for "${trimmed}": ${status}`);
      return null;
    }

    console.error(`[GEO] Google Geocoding API returned status "${status}" for "${trimmed}"`);
    return null;
  } catch (error) {
    console.error(`[GEO] Failed to geocode "${trimmed}":`, error);
    return null;
  }
}
