import express from 'express';
import { db } from '../db.js';
import { geocodeAddress } from '../services/google-geocoding.js';

const router = express.Router();

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

// Small deterministic hash (FNV-1a) so the same person+location always
// jitters to the same offset across requests, instead of visibly jumping.
const fnv1aHash = (str: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

// Spreads alumni that collapse onto the same static COORDINATES centroid
// into a small, stable-per-person radius (~a few km) instead of stacking
// as one saturated heatmap point.
const JITTER_DEGREES = 0.05;
const jitterCoords = (coords: { lat: number; lng: number }, seed: string) => {
  const h1 = fnv1aHash(`${seed}|lat`);
  const h2 = fnv1aHash(`${seed}|lng`);
  const offsetLat = ((h1 % 2000) / 1000 - 1) * JITTER_DEGREES;
  const offsetLng = ((h2 % 2000) / 1000 - 1) * JITTER_DEGREES;
  return { lat: coords.lat + offsetLat, lng: coords.lng + offsetLng };
};

const getCoordinates = async (name: string, context?: string, jitterSeed?: string) => {
  const normalized = normalizeName(name);
  if (!normalized) return null;
  const cacheKey = context ? `${normalized}|${context}` : normalized;
  if (COORDINATES[normalized]) {
    const base = COORDINATES[normalized];
    return jitterSeed ? jitterCoords(base, `${jitterSeed}|${normalized}`) : base;
  }
  if (GEO_CACHE[cacheKey]) return GEO_CACHE[cacheKey];

  const searchQuery = context ? `${normalized}, ${context}` : normalized;
  const result = await geocodeAddress(searchQuery);
  if (result) {
    const coords = { lat: result.lat, lng: result.lng };
    GEO_CACHE[cacheKey] = coords;
    return coords;
  }

  if (context) {
    const fallback = await geocodeAddress(normalized);
    if (fallback) {
      const coords = { lat: fallback.lat, lng: fallback.lng };
      GEO_CACHE[cacheKey] = coords;
      return coords;
    }
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
        const jitterSeed = String(person.user_id || person.id);

        const cityCoords = await getCoordinates(city, context, jitterSeed);
        const stateCoords = !cityCoords ? await getCoordinates(state, country, jitterSeed) : null;
        const countryCoords = (!cityCoords && !stateCoords) ? await getCoordinates(country, undefined, jitterSeed) : null;

        const coords = cityCoords || stateCoords || countryCoords;
        if (coords) {
          lat = coords.lat;
          lng = coords.lng;
          label = label || [city, state, country].filter(Boolean).join(', ') || 'Unknown Location';

          // Persist the geocoded result so future requests skip geocoding for this row
          db.from('alumni')
            .update({ latitude: lat, longitude: lng, location_label: label })
            .eq('id', person.id)
            .then(({ error: updateError }) => {
              if (updateError) console.error(`[GEO] Failed to persist coordinates for alumni ${person.id}:`, updateError);
            });
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
      .eq('alumni.users.user_role', 'alumni');

    const mappedExtra = (await Promise.all((extraLocations || []).map(async (row: any) => {
      let lat = row.latitude != null ? Number(row.latitude) : null;
      let lng = row.longitude != null ? Number(row.longitude) : null;
      let label = row.location_label;

      if (lat == null || lng == null) {
        const city = normalizeName(row.city || '');
        const state = normalizeName(row.state || '');
        const country = normalizeName(row.country || '');
        const context = [state, country].filter(Boolean).join(', ');
        const jitterSeed = `${row.alumni.user_id || row.alumni.id}|${row.id}`;

        const cityCoords = await getCoordinates(city, context, jitterSeed);
        const stateCoords = !cityCoords ? await getCoordinates(state, country, jitterSeed) : null;
        const countryCoords = (!cityCoords && !stateCoords) ? await getCoordinates(country, undefined, jitterSeed) : null;

        const coords = cityCoords || stateCoords || countryCoords;
        if (coords) {
          lat = coords.lat;
          lng = coords.lng;
          label = label || [city, state, country].filter(Boolean).join(', ') || 'Unknown Location';

          db.from('alumni_locations')
            .update({ latitude: lat, longitude: lng, location_label: label })
            .eq('id', row.id)
            .then(({ error: updateError }) => {
              if (updateError) console.error(`[GEO] Failed to persist coordinates for alumni_location ${row.id}:`, updateError);
            });
        }
      }

      if (lat == null || lng == null) return null;

      return {
        id: row.alumni.id,
        user_id: row.alumni.user_id,
        first_name: row.alumni.first_name,
        last_name: row.alumni.last_name,
        latitude: lat,
        longitude: lng,
        location_label: label || [row.city, row.state, row.country].filter(Boolean).join(', '),
        current_city: row.city,
        current_state: row.state,
        current_country: row.country,
        location_type: row.label_type,
      };
    }))).filter((row): row is NonNullable<typeof row> => row != null);

    const allAlumni = [...finalAlumni, ...mappedExtra];
    const distinctAlumniIds = new Set(allAlumni.map(a => a.user_id)).size;

    // Normalize heatmap weight so each person contributes ~1 total unit of
    // density regardless of how many locations they've saved (Home, University,
    // Job, Internship). Without this, someone with 4 saved locations would
    // appear 4x "denser" on the heatmap than someone with just 1.
    const LOCATION_TYPE_BASE_WEIGHT: { [key: string]: number } = {
      Home: 3,
      University: 2,
      Job: 2,
      Internship: 1,
      Other: 1,
    };
    const baseWeightFor = (locationType?: string) => LOCATION_TYPE_BASE_WEIGHT[locationType || 'Home'] ?? 1;

    const totalBaseWeightByUser = new Map<string, number>();
    allAlumni.forEach(a => {
      const key = a.user_id;
      totalBaseWeightByUser.set(key, (totalBaseWeightByUser.get(key) || 0) + baseWeightFor((a as any).location_type));
    });

    const weightedAlumni = allAlumni.map(a => {
      const totalBaseWeight = totalBaseWeightByUser.get(a.user_id) || 1;
      const weight = baseWeightFor((a as any).location_type) / totalBaseWeight;
      return { ...a, weight };
    });

    res.json({
      success: true,
      alumni: weightedAlumni,
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
