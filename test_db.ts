import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || ''
);

async function check() {
  console.log("Supabase URL:", process.env.SUPABASE_URL);
  
  console.log("\n--- Testing query from alumni-search-routes ---");
  try {
    const { data, error, count } = await supabase
      .from("alumni")
      .select(`
        id, first_name, last_name,
        users!inner(id, username, email, user_role, account_blocked)
      `, { count: 'exact' })
      .eq("is_active", true)
      .eq("users.account_blocked", false)
      .range(0, 4);
      
    console.log("alumni query result:", { data, error, count });
  } catch (e) {
    console.error("alumni query exception:", e);
  }
}

check();
