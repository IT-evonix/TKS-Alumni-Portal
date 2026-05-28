import express from 'express';
import { db } from '../db.js';
import axios from 'axios';

const router = express.Router();

// local in-memory cache for geocoding to minimize API hits
const GEO_CACHE: { [key: string]: { lat: number; lng: number } } = {};

// ─────────────────────────────────────────────────────────────
// No-cache middleware — ensures all alumni-map API responses
// are never stored in browser/proxy cache.
// This means: after a TRUNCATE or DELETE in Supabase, the
// map will always fetch fresh data on next page load.
// ─────────────────────────────────────────────────────────────
router.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Cache clear endpoint — call this after bulk DB operations
// so the geocoding cache is also wiped
router.post('/cache/clear', (req, res) => {
  const clearedCount = Object.keys(GEO_CACHE).length;
  for (const key in GEO_CACHE) {
    delete GEO_CACHE[key];
  }
  console.log(`[Alumni Map] GEO_CACHE cleared — removed ${clearedCount} entries`);
  res.json({ success: true, clearedEntries: clearedCount });
});


// World coordinates for major cities and regions
const COORDINATES: { [key: string]: { lat: number; lng: number; direction?: string; offset?: [number, number] } } = {
  // Countries (Approximate centers)
  'India': { lat: 20.5937, lng: 78.9629, direction: 'bottom', offset: [0, 10] },
  'USA': { lat: 37.0902, lng: -95.7129, direction: 'right', offset: [10, 0] },
  'UK': { lat: 55.3781, lng: -3.4360, direction: 'left', offset: [-10, 0] },
  'Australia': { lat: -25.2744, lng: 133.7751, direction: 'top', offset: [0, -10] },
  'Canada': { lat: 56.1304, lng: -106.3468, direction: 'top', offset: [0, -10] },
  'UAE': { lat: 23.4241, lng: 53.8478, direction: 'left', offset: [-10, 0] },
  'Pakistan': { lat: 30.3753, lng: 69.3451, direction: 'top', offset: [0, -10] },
  'Germany': { lat: 51.1657, lng: 10.4515, direction: 'right', offset: [10, 0] },
  'Singapore': { lat: 1.3521, lng: 103.8198, direction: 'right', offset: [10, 0] },

  // States (India)
  'Maharashtra': { lat: 19.7507, lng: 75.7139, direction: 'left', offset: [-15, 0] },
  'Karnataka': { lat: 15.3173, lng: 75.7139, direction: 'left', offset: [-15, 0] },
  'Tamil Nadu': { lat: 11.1271, lng: 78.6569, direction: 'bottom', offset: [0, 5] },
  'Telangana': { lat: 18.1124, lng: 79.0193, direction: 'right', offset: [15, 0] },
  'Delhi': { lat: 28.7041, lng: 77.1025, direction: 'top', offset: [0, -5] },
  'Gujarat': { lat: 22.2587, lng: 71.1924, direction: 'left', offset: [-15, 0] },
  'Rajasthan': { lat: 27.0238, lng: 74.2179, direction: 'left', offset: [-15, 0] },
  'Uttar Pradesh': { lat: 26.8467, lng: 80.9462, direction: 'right', offset: [15, 0] },
  'West Bengal': { lat: 22.9868, lng: 87.8550, direction: 'right', offset: [15, 0] },
  'Haryana': { lat: 29.0588, lng: 76.0856, direction: 'top', offset: [0, -5] },
  'Punjab': { lat: 31.1471, lng: 75.3412, direction: 'top', offset: [0, -5] },
  'Madhya Pradesh': { lat: 22.9734, lng: 78.6569, direction: 'bottom', offset: [0, 15] },
  'Chhattisgarh': { lat: 21.2787, lng: 81.8661, direction: 'right', offset: [15, 5] },
  'Odisha': { lat: 20.9517, lng: 85.0985, direction: 'right', offset: [15, 0] },
  'Andhra Pradesh': { lat: 15.9129, lng: 79.7400, direction: 'right', offset: [15, 0] },
  'Kerala': { lat: 10.8505, lng: 76.2711, direction: 'left', offset: [-15, 0] },
  'Bihar': { lat: 25.0961, lng: 85.3131, direction: 'top', offset: [0, -5] },
  'Jharkhand': { lat: 23.6102, lng: 85.2799, direction: 'bottom', offset: [0, 5] },
  'Assam': { lat: 26.2006, lng: 92.9376, direction: 'top', offset: [0, -5] },

  // Cities
  'Mumbai': { lat: 19.0760, lng: 72.8777 },
  'Bangalore': { lat: 12.9716, lng: 77.5946 },
  'Hyderabad': { lat: 17.3850, lng: 78.4867 },
  'Chennai': { lat: 13.0827, lng: 80.2707 },
  'Kolkata': { lat: 22.5726, lng: 88.3639 },
  'Pune': { lat: 18.5204, lng: 73.8567 },
  'Ahmedabad': { lat: 23.0225, lng: 72.5714 },
  'Jaipur': { lat: 26.9124, lng: 75.7873 },
  'Lucknow': { lat: 26.8467, lng: 80.9462 },
  'New York': { lat: 40.7128, lng: -74.0060 },
  'San Francisco': { lat: 37.7749, lng: -122.4194 },
  'London': { lat: 51.5074, lng: -0.1278 },
  'Toronto': { lat: 43.6532, lng: -79.3832 },
  'Sydney': { lat: -33.8688, lng: 151.2093 },
  'Dubai': { lat: 25.2048, lng: 55.2708 },
  'New Jersey': { lat: 40.0583, lng: -74.4057 },
  'California': { lat: 36.7783, lng: -119.4179 },
  'Texas': { lat: 31.9686, lng: -99.9018 },
  'England': { lat: 52.3555, lng: -1.1743 },
  'NY': { lat: 40.7128, lng: -74.0060 },
};

// Map name normalization helper
const normalizeName = (name: string): string => {
  if (!name) return '';
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();

  // Handle common uppercase acronyms
  if (['usa', 'uk', 'uae', 'ny', 'nj'].includes(lower)) {
    return trimmed.toUpperCase();
  }

  // Title Case for others
  return lower.split(' ').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
};

// Robust coordinate lookup with auto-geocoding
// Accepts a single name or a full context string for better accuracy
const getCoordinates = async (name: string, context?: string) => {
  const normalized = normalizeName(name);
  if (!normalized) return null;

  // Build a cache key that includes context for specificity
  const cacheKey = context ? `${normalized}|${context}` : normalized;

  // 1. Check fixed overrides (for overlaps/prio)
  if (COORDINATES[normalized]) return COORDINATES[normalized];

  // 2. Check local session cache
  if (GEO_CACHE[cacheKey]) return GEO_CACHE[cacheKey];

  // 3. Fallback to auto-geocoding (Nominatim)
  // Use context-aware search for better accuracy
  // e.g. "Dharangaon, Jalgaon, Maharashtra, India" instead of just "Dharangaon"
  const searchQuery = context ? `${normalized}, ${context}` : normalized;

  try {
    console.log(`[GEO] Fetching coordinates for: ${searchQuery}`);
    const response = await axios.get(`https://nominatim.openstreetmap.org/search`, {
      params: {
        q: searchQuery,
        format: 'json',
        limit: 1,
        addressdetails: 1
      },
      headers: {
        'User-Agent': 'TKS-Alumni-Portal/1.0'
      }
    });

    if (response.data && response.data.length > 0) {
      const { lat, lon } = response.data[0];
      const coords = { lat: parseFloat(lat), lng: parseFloat(lon) };
      GEO_CACHE[cacheKey] = coords;
      return coords;
    }

    // If context search failed, try without context as fallback
    if (context) {
      console.log(`[GEO] Context search failed, retrying without context: ${normalized}`);
      const fallbackResponse = await axios.get(`https://nominatim.openstreetmap.org/search`, {
        params: {
          q: normalized,
          format: 'json',
          limit: 1
        },
        headers: {
          'User-Agent': 'TKS-Alumni-Portal/1.0'
        }
      });

      if (fallbackResponse.data && fallbackResponse.data.length > 0) {
        const { lat, lon } = fallbackResponse.data[0];
        const coords = { lat: parseFloat(lat), lng: parseFloat(lon) };
        GEO_CACHE[cacheKey] = coords;
        return coords;
      }
    }
  } catch (error) {
    console.error(`[GEO] Failed to fetch coordinates for ${searchQuery}:`, error);
  }

  return null;
};

// Get alumni data for heat map
router.get('/map-data', async (req, res) => {
  try {
    // Query alumni with location data
    const { data: alumni, error } = await db
      .from('alumni')
      .select(`
        id,
        user_id,
        first_name,
        last_name,
        email,
        current_city,
        current_state,
        current_country,
        latitude,
        longitude,
        location_label
      `);

    if (error) {
      console.error('Error fetching alumni map data:', error);
      return res.status(500).json({
        error: 'Failed to fetch alumni data',
        details: error.message
      });
    }

    // Process data for heat map
    const cityMap = new Map();
    const stateMap = new Map();
    const countryMap = new Map();

    // Only include alumni with complete location data (country, state, and city)
    const validAlumni = alumni.filter((person: any) =>
      person.current_country?.trim() &&
      person.current_state?.trim() &&
      person.current_city?.trim()
    );

    validAlumni.forEach((person: any) => {
      const country = normalizeName(person.current_country);
      const state = normalizeName(person.current_state);
      const city = normalizeName(person.current_city);
      const lat = person.latitude;
      const lng = person.longitude;

      // Count by country
      countryMap.set(country, (countryMap.get(country) || 0) + 1);

      if (state) {
        stateMap.set(state, (stateMap.get(state) || 0) + 1);
      }

      // Group by exact coordinates if available, otherwise by city-state-country
      const locationKey = (lat != null && lng != null) ? `${lat}-${lng}` : `${city}-${state}-${country}`;
      const existingCity = cityMap.get(locationKey);
      if (existingCity) {
        existingCity.count++;
      } else {
        cityMap.set(locationKey, {
          city: person.location_label ? person.location_label.split(',')[0] : city, // Use specific label part
          state,
          country,
          count: 1,
          lat,
          lng,
          fullLabel: person.location_label
        });
      }
    });

    const countryDataArray = Array.from(countryMap.entries());
    const countryData = await Promise.all(countryDataArray.map(async ([country, count]) => {
      const coordsResult = await getCoordinates(country);
      const coords = coordsResult || { lat: 20.5937, lng: 78.9629 };
      return {
        country,
        count,
        lat: coords.lat,
        lng: coords.lng,
        direction: (coords as any).direction,
        offset: (coords as any).offset
      };
    }));

    const stateDataArray = Array.from(stateMap.entries());
    const stateData = await Promise.all(stateDataArray.map(async ([state, count]) => {
      const coordsResult = await getCoordinates(state);
      const coords = coordsResult || { lat: 20.5937, lng: 78.9629 };
      return {
        state,
        count,
        lat: coords.lat,
        lng: coords.lng,
        direction: (coords as any).direction,
        offset: (coords as any).offset
      };
    }));

    const cityDataArray = Array.from(cityMap.values());
    const cityData = await Promise.all(cityDataArray.map(async (cityInfo) => {
      // If we already have precise coordinates from DB, use them!
      if (cityInfo.lat !== null && cityInfo.lat !== undefined && cityInfo.lng !== null && cityInfo.lng !== undefined) {
        return {
          ...cityInfo,
          lat: parseFloat(cityInfo.lat),
          lng: parseFloat(cityInfo.lng),
          direction: undefined,
          offset: undefined
        };
      }

      // Fallback for older data without saved coordinates
      const contextParts = [cityInfo.state, cityInfo.country].filter(Boolean);
      const context = contextParts.join(', ');

      const cityCoords = await getCoordinates(cityInfo.city, context);
      const stateCoords = !cityCoords ? await getCoordinates(cityInfo.state, cityInfo.country) : null;
      const countryCoords = (!cityCoords && !stateCoords) ? await getCoordinates(cityInfo.country) : null;

      const coords = cityCoords || stateCoords || countryCoords || { lat: 20.5937, lng: 78.9629 };

      return {
        ...cityInfo,
        lat: coords.lat,
        lng: coords.lng,
        direction: (coords as any).direction,
        offset: (coords as any).offset
      };
    }));

    res.json({
      success: true,
      alumni: validAlumni,
      processed: {
        cities: cityData,
        states: stateData,
        countries: countryData
      },
      statistics: {
        total: validAlumni.length,
        totalCities: cityData.length,
        totalStates: stateData.length,
        totalCountries: countryData.length
      }
    });

  } catch (error) {
    console.error('Server error in alumni map data:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get alumni count by state (for quick stats)
router.get('/state-stats', async (req, res) => {
  try {
    const { data, error } = await db
      .from('alumni')
      .select('current_state')
      .not('current_state', 'is', null);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const stateCounts = new Map();

    data.forEach(person => {
      const state = person.current_state?.trim();
      if (state) {
        stateCounts.set(state, (stateCounts.get(state) || 0) + 1);
      }
    });

    const result = Array.from(stateCounts.entries())
      .map(([state, count]) => ({ state, count }))
      .sort((a, b) => b.count - a.count);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get alumni count by city
router.get('/city-stats', async (req, res) => {
  try {
    const { data, error } = await db
      .from('alumni')
      .select('current_city, current_state')
      .not('current_city', 'is', null)
      .not('current_state', 'is', null);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const cityCounts = new Map();

    data.forEach(person => {
      const city = person.current_city?.trim();
      const state = person.current_state?.trim();

      if (city && state) {
        const key = `${city}, ${state}`;
        cityCounts.set(key, (cityCounts.get(key) || 0) + 1);
      }
    });

    const result = Array.from(cityCounts.entries())
      .map(([location, count]) => {
        const [city, state] = location.split(', ');
        return {
          city: city?.trim(),
          state: state?.trim(),
          count
        };
      })
      .sort((a, b) => b.count - a.count);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
