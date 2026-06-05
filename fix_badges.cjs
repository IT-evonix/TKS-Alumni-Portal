const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Fixing badge categories...");
  
  // Set "First Steps" (login) to common
  const { error: err1 } = await supabase
    .from("gamification_badges")
    .update({ category: "common" })
    .eq("series_type", "login");
    
  if (err1) console.error("Error fixing login badge:", err1);
  else console.log("Fixed login badge.");

  // Set "Profile Pro" (profile) to common
  const { error: err2 } = await supabase
    .from("gamification_badges")
    .update({ category: "common" })
    .eq("series_type", "profile");
    
  if (err2) console.error("Error fixing profile badge:", err2);
  else console.log("Fixed profile badge.");
  
  // Also we should ensure Top Contributor is competitive
  const { error: err3 } = await supabase
    .from("gamification_badges")
    .update({ category: "competitive", series_type: "thread" })
    .eq("name", "Top Contributor");
    
  if (err3) console.error("Error fixing Top Contributor:", err3);
  else console.log("Fixed Top Contributor badge.");

  console.log("Done!");
}

run();
