import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || ''
// Prioritize Service Role Key for backend operations to bypass RLS
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || ''

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn(' [SUPABASE] WARNING: SUPABASE_SERVICE_ROLE_KEY not found. Falling back to ANON_KEY. RLS may block admin login.');
} else {
    console.log(' [SUPABASE] Service Role Key detected. Full database access enabled.');
}

export const supabase = createClient(supabaseUrl, supabaseKey)

export async function checkSupabaseConnection(): Promise<boolean> {
    try {
        const { error } = await supabase.from('users').select('id').limit(1);
        return !error;
    } catch (error) {
        console.warn('Supabase connection check failed:', error);
        return false;
    }
}

