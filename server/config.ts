import 'dotenv/config';

interface Config {
    port: number;
    nodeEnv: string;
    databaseUrl: string;
    supabaseUrl: string;
    supabaseAnonKey: string;
    supabaseServiceRoleKey?: string;
    sessionSecret: string;
    jwtSecret: string;
    vapidPublicKey?: string;
    vapidPrivateKey?: string;
    vapidSubject?: string;
}

function validateEnv(): Config {
    const required = {
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
        SESSION_SECRET: process.env.SESSION_SECRET,
        JWT_SECRET: process.env.JWT_SECRET || process.env.SESSION_SECRET, // Fallback if missing
    };

    const missing: string[] = [];

    for (const [key, value] of Object.entries(required)) {
        if (!value || value.trim() === '') {
            missing.push(key);
        }
    }

    if (missing.length > 0) {
        console.error('❌ FATAL: Missing required environment variables:');
        missing.forEach(key => console.error(`   - ${key}`));
        console.error('\nSet these in Railway dashboard or .env file');
        process.exit(1);
    }

    // Validate URLs
    try {
        new URL(required.SUPABASE_URL!);
    } catch {
        console.error(`❌ FATAL: Invalid SUPABASE_URL: ${required.SUPABASE_URL}`);
        process.exit(1);
    }

    console.log('✅ Environment variables validated');

    return {
        port: parseInt(process.env.PORT || '5000', 10),
        nodeEnv: process.env.NODE_ENV || 'development',
        databaseUrl: process.env.DATABASE_URL || required.SUPABASE_URL!,
        supabaseUrl: required.SUPABASE_URL!,
        supabaseAnonKey: required.SUPABASE_ANON_KEY!,
        supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        sessionSecret: required.SESSION_SECRET!,
        jwtSecret: required.JWT_SECRET!,
        vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
        vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
        vapidSubject: process.env.VAPID_SUBJECT || 'mailto:admin@thekalyanischool.edu.in',
    };
}

export const config = validateEnv();
