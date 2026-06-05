import { createClient } from '@supabase/supabase-js';
import { clientConfig } from './config';

// Create Supabase client
export const supabase = createClient(
    clientConfig.supabaseUrl,
    clientConfig.supabaseAnonKey,
    {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
        },
    }
);
