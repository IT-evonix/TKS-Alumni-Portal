const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { error } = await supabase.rpc('execute_sql', {
    sql_string: 'ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS shares_count INTEGER DEFAULT 0;'
  });
  console.log("RPC Error:", error);
}

test();
