import express from 'express';
import { db } from '../db.js';
import axios from 'axios';

const router = express.Router();

const NOMINATIM_API_URL = (process.env.NOMINATIM_API_URL || 'https://nominatim.openstreetmap.org').replace(/\/$/, '');

const GEO_CACHE: { [key: string]: { lat: number; lng: number } } = {};

const COORDINATES: { [key: string]: { lat: number; lng: number; direction?: string; offset?: [number, number] } } = {
  // Countries
  'India': { lat: 20.5937, lng: 78.9629 },
  'USA': { lat: 37.0902, lng: -95.7129 },
  'UK': { lat: 55.3781, lng: -3.4360 },
  'Australia': { lat: -25.2744, lng: 133.7751 },
  'Canada': { lat: 56.1304, lng: -106.3468 },
  'UAE': { lat: 23.4241, lng: 53.8478 },
  'Pakistan': { lat: 30.3753, lng: 69.3451 },
  'Germany': { lat: 51.1657, lng: 10.4515 },
  'Singapore': { lat: 1.3521, lng: 103.8198 },

  // States (India)
  'Maharashtra': { lat: 19.7507, lng: 75.7139 },
  'Karnataka': { lat: 15.3173, lng: 75.7139 },
  'Tamil Nadu': { lat: 11.1271, lng: 78.6569 },
  'Telangana': { lat: 18.1124, lng: 79.0193 },
  'Delhi': { lat: 28.7041, lng: 77.1025 },
  'Gujarat': { lat: 22.2587, lng: 71.1924 },
  'Rajasthan': { lat: 27.0238, lng: 74.2179 },
  'Uttar Pradesh': { lat: 26.8467, lng: 80.9462 },
  'West Bengal': { lat: 22.9868, lng: 87.8550 },
  'Haryana': { lat: 29.0588, lng: 76.0856 },
  'Punjab': { lat: 31.1471, lng: 75.3412 },
  'Madhya Pradesh': { lat: 22.9734, lng: 78.6569 },
  'Chhattisgarh': { lat: 21.2787, lng: 81.8661 },
  'Odisha': { lat: 20.9517, lng: 85.0985 },
  'Andhra Pradesh': { lat: 15.9129, lng: 79.7400 },
  'Kerala': { lat: 10.8505, lng: 76.2711 },
  'Bihar': { lat: 25.0961, lng: 85.3131 },
  'Jharkhand': { lat: 23.6102, lng: 85.2799 },
  'Assam': { lat: 26.2006, lng: 92.9376 },

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

const normalizeName = (name: string): string => {
  if (!name) return '';
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();
  if (['usa', 'uk', 'uae', 'ny', 'nj'].includes(lower)) return trimmed.toUpperCase();
  return lower.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const getCoordinates = async (name: string, context?: string) => {
  const normalized = normalizeName(name);
  if (!normalized) return null;
  const cacheKey = context ? `${normalized}|${context}` : normalized;
  if (COORDINATES[normalized]) return COORDINATES[normalized];
  if (GEO_CACHE[cacheKey]) return GEO_CACHE[cacheKey];

  const searchQuery = context ? `${normalized}, ${context}` : normalized;
  try {
    const response = await axios.get(`${NOMINATIM_API_URL}/search`, {
      params: { q: searchQuery, format: 'json', limit: 1, addressdetails: 1 },
      headers: { 'User-Agent': 'TKS-Alumni-Portal/1.0' }
    });
    if (response.data && response.data.length > 0) {
      const { lat, lon } = response.data[0];
      const coords = { lat: parseFloat(lat), lng: parseFloat(lon) };
      GEO_CACHE[cacheKey] = coords;
      return coords;
    }
    if (context) {
      const fallbackResponse = await axios.get(`${NOMINATIM_API_URL}/search`, {
        params: { q: normalized, format: 'json', limit: 1 },
        headers: { 'User-Agent': 'TKS-Alumni-Portal/1.0' }
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

// ─────────────────────────────────────────────────────────────
// No-cache middleware
// ─────────────────────────────────────────────────────────────
router.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Cache clear endpoint
router.post('/cache/clear', (req, res) => {
  const clearedCount = Object.keys(GEO_CACHE).length;
  for (const key in GEO_CACHE) {
    delete GEO_CACHE[key];
  }
  res.json({ success: true, clearedEntries: clearedCount });
});

// Get alumni data for heat map
router.get('/map-data', async (req, res) => {
  try {
    // Query ALL alumni, even if they don't have lat/lng saved yet
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
        location_label,
        users!inner (
          user_role
        )
      `)
      .eq('users.user_role', 'alumni');

    if (error) {
      console.error('Error fetching alumni map data:', error);
      return res.status(500).json({
        error: 'Failed to fetch alumni data',
        details: error.message
      });
    }

    // Add fallback coordinates for older users
    const validAlumni = await Promise.all(alumni.map(async (person) => {
      let lat = person.latitude;
      let lng = person.longitude;
      let label = person.location_label;

      if (lat == null || lng == null) {
        const city = normalizeName(person.current_city || '');
        const state = normalizeName(person.current_state || '');
        const country = normalizeName(person.current_country || '');
        
        const contextParts = [state, country].filter(Boolean);
        const context = contextParts.join(', ');

        const cityCoords = await getCoordinates(city, context);
        const stateCoords = !cityCoords ? await getCoordinates(state, country) : null;
        const countryCoords = (!cityCoords && !stateCoords) ? await getCoordinates(country) : null;

        const coords = cityCoords || stateCoords || countryCoords;
        if (coords) {
          lat = coords.lat;
          lng = coords.lng;
          label = label || [city, state, country].filter(Boolean).join(', ') || 'Unknown Location';
        }
      }

      return {
        ...person,
        latitude: lat,
        longitude: lng,
        location_label: label
      };
    }));

    // Filter out users who still don't have lat/lng even after geocoding
    const finalAlumni = validAlumni.filter(a => a.latitude != null && a.longitude != null);

    // Fetch additional locations from alumni_locations table
    const { data: extraLocations } = await db
      .from('alumni_locations')
      .select(`
        id,
        alumni_id,
        label_type,
        city,
        state,
        country,
        latitude,
        longitude,
        location_label,
        alumni!inner (
          id,
          user_id,
          first_name,
          last_name,
          users!inner (
            user_role
          )
        )
      `)
      .eq('alumni.users.user_role', 'alumni')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    const mappedExtra = (extraLocations || []).map((row: any) => ({
      id: row.alumni.id,
      user_id: row.alumni.user_id,
      first_name: row.alumni.first_name,
      last_name: row.alumni.last_name,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      location_label: row.location_label || [row.city, row.state, row.country].filter(Boolean).join(', '),
      current_city: row.city,
      current_state: row.state,
      current_country: row.country,
      location_type: row.label_type,
    }));

    const allAlumni = [...finalAlumni, ...mappedExtra];
    const distinctAlumniIds = new Set(allAlumni.map(a => a.user_id)).size;

    res.json({
      success: true,
      alumni: allAlumni,
      statistics: {
        total: distinctAlumniIds
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
      .select('current_state, users!inner(user_role)')
      .eq('users.user_role', 'alumni')
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
      .select('current_city, current_state, users!inner(user_role)')
      .eq('users.user_role', 'alumni')
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
