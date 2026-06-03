import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkBadge() {
  const { data, error } = await supabase
    .from("gamification_badges")
    .select("*")
    .eq("name", "First Step");
  console.log(data);
}

checkBadge();
