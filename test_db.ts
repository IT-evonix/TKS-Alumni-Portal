import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function check() {
  const { data, error } = await supabase.rpc('get_alumni_columns');
  if (error) {
    // fallback
    const { data: d2 } = await supabase.from('alumni').select('*').limit(1);
    console.log("Alumni row:", d2);
  }
}
check();
