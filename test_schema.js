const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data, error } = await supabase.rpc('get_schema_info', {}); 
  // wait we can just query pg_attribute using REST API? No.
  const { data: cols } = await supabase.from('alumni').select('*').limit(1);
  console.log(cols);
}
run();
