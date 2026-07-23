import express from 'express';
import { db } from '../db.js';
import { requireAdmin } from '../middleware/auth';
import { normalizeName, getCoordinates } from './alumni-map';

const router = express.Router();

const VALID_ROLES = ['alumni', 'student', 'faculty', 'administrator'];
const VALID_LOCATION_TYPES = ['Home', 'University', 'Job', 'Internship', 'Other'];

router.use(requireAdmin);

router.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Get alumni/student/faculty data for the admin heat map, with optional filters
router.get('/map-data', async (req, res) => {
  try {
    const rolesParam = typeof req.query.role === 'string' ? req.query.role : '';
    const roles = rolesParam
      .split(',')
      .map(r => r.trim().toLowerCase())
      .filter(r => VALID_ROLES.includes(r));
    const effectiveRoles = roles.length > 0 ? roles : ['alumni'];

    const graduationYear = typeof req.query.graduationYear === 'string' && req.query.graduationYear.trim()
      ? req.query.graduationYear.trim()
      : null;
    const country = typeof req.query.country === 'string' && req.query.country.trim()
      ? req.query.country.trim()
      : null;
    const state = typeof req.query.state === 'string' && req.query.state.trim()
      ? req.query.state.trim()
      : null;
    const city = typeof req.query.city === 'string' && req.query.city.trim()
      ? req.query.city.trim()
      : null;
    const locationType = typeof req.query.locationType === 'string' && VALID_LOCATION_TYPES.includes(req.query.locationType)
      ? req.query.locationType
      : null;

    let query = db
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
        graduation_year,
        batch,
        branch,
        users!inner (
          user_role
        )
      `)
      .in('users.user_role', effectiveRoles);

    if (graduationYear) query = query.eq('graduation_year', graduationYear);
    if (country) query = query.eq('current_country', country);
    if (state) query = query.eq('current_state', state);
    if (city) query = query.eq('current_city', city);

    const { data: alumni, error } = await query;

    if (error) {
      console.error('Error fetching admin alumni map data:', error);
      return res.status(500).json({
        error: 'Failed to fetch alumni data',
        details: error.message
      });
    }

    const validAlumni = await Promise.all((alumni || []).map(async (person: any) => {
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
        }
      }

      return {
        ...person,
        latitude: lat,
        longitude: lng,
        location_label: label
      };
    }));

    const finalAlumni = validAlumni.filter(a => a.latitude != null && a.longitude != null);

    // Fetch additional locations from alumni_locations table
    let extraQuery = db
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
          graduation_year,
          batch,
          branch,
          users!inner (
            user_role
          )
        )
      `)
      .in('alumni.users.user_role', effectiveRoles);

    if (graduationYear) extraQuery = extraQuery.eq('alumni.graduation_year', graduationYear);
    if (country) extraQuery = extraQuery.eq('country', country);
    if (state) extraQuery = extraQuery.eq('state', state);
    if (city) extraQuery = extraQuery.eq('city', city);
    if (locationType) extraQuery = extraQuery.eq('label_type', locationType);

    const { data: extraLocations } = await extraQuery;

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
        }
      }

      if (lat == null || lng == null) return null;

      return {
        id: row.alumni.id,
        user_id: row.alumni.user_id,
        first_name: row.alumni.first_name,
        last_name: row.alumni.last_name,
        graduation_year: row.alumni.graduation_year,
        batch: row.alumni.batch,
        branch: row.alumni.branch,
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
    const distinctAlumniIds = new Set(allAlumni.map((a: any) => a.user_id)).size;

    const LOCATION_TYPE_BASE_WEIGHT: { [key: string]: number } = {
      Home: 3,
      University: 2,
      Job: 2,
      Internship: 1,
      Other: 1,
    };
    const baseWeightFor = (locationType?: string) => LOCATION_TYPE_BASE_WEIGHT[locationType || 'Home'] ?? 1;

    const totalBaseWeightByUser = new Map<string, number>();
    allAlumni.forEach((a: any) => {
      const key = a.user_id;
      totalBaseWeightByUser.set(key, (totalBaseWeightByUser.get(key) || 0) + baseWeightFor(a.location_type));
    });

    const weightedAlumni = allAlumni.map((a: any) => {
      const totalBaseWeight = totalBaseWeightByUser.get(a.user_id) || 1;
      const weight = baseWeightFor(a.location_type) / totalBaseWeight;
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
    console.error('Server error in admin alumni map data:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
