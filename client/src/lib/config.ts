// client/src/lib/config.ts

interface ClientConfig {
    apiUrl: string;
    supabaseUrl: string;
    supabaseAnonKey: string;
    isDev: boolean;
}

function getClientConfig(): ClientConfig {
    const isDev = import.meta.env.DEV ?? false;

    // In production, API is same origin
    const apiUrl = isDev
        ? `${window.location.protocol}//${window.location.hostname}:5000`
        : window.location.origin;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

    // Validate in browser console (non-blocking)
    if (!supabaseUrl || !supabaseAnonKey) {
        console.error('⚠️ WARNING: Supabase credentials missing in frontend');
        console.error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
    }

    return {
        apiUrl,
        supabaseUrl,
        supabaseAnonKey,
        isDev,
    };
}

export const clientConfig = getClientConfig();
