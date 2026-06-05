import { supabase, checkSupabaseConnection } from './supabase';

/**
 * database/db.ts - Consolidated Supabase SDK Entry Point
 * 
 * We have migrated from a direct Postgres (TCP) connection to the 
 * Supabase HTTP Client (SDK). This ensures the application can interact
 * with the database using the API URL and Keys provided in .env.
 */

// Placeholder for legacy 'db' export to minimize immediate breaking changes
// Direct access to the database should now predominantly use the Supabase client
export const db = supabase;

/**
 * Replaces the old Neon/Postgres initialization with a Supabase health check.
 */
export async function initializeDb() {
    console.log('1️⃣ Initializing Supabase database connection...');
    
    const isConnected = await checkSupabaseConnection();
    
    if (isConnected) {
        console.log('✅ Supabase client initialized and connected successfully');
    } else {
        console.warn('⚠️ Supabase connection check failed. Verify your SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
        // We don't throw here to allow the server to start, but many operations will fail.
    }
}

/**
 * Backwards compatibility exports
 */
export async function getDb() {
    return supabase;
}

export function getDbSync() {
    return supabase;
}
