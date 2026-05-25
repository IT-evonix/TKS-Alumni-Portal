import { supabase } from "./server/supabase.js"; // wait, let's find the correct path

async function check() {
  const { data, error } = await supabase.from('alumni').select('*').limit(1);
  console.log("Data:", data);
  console.log("Error:", error);
}
check();
