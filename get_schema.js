import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
  const { data: users, error: e1 } = await supabase.from('users').select('*').limit(1);
  console.log("Users schema:", users ? Object.keys(users[0] || {}) : e1);
  
  const { data: alumni, error: e2 } = await supabase.from('alumni').select('*').limit(1);
  console.log("Alumni schema:", alumni ? Object.keys(alumni[0] || {}) : e2);
}

checkSchema();
