import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
  const { data: scores } = await supabase.from('user_scores').select('*').limit(1);
  console.log("User Scores schema:", scores ? Object.keys(scores[0] || {}) : "error");
  
  const { data: badges } = await supabase.from('gamification_badges').select('*').limit(1);
  console.log("Gamification Badges schema:", badges ? Object.keys(badges[0] || {}) : "error");
}

checkSchema();
