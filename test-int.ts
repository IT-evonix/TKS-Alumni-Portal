import { supabase } from "./server/supabase";
async function getIntCols() {
  const { data: cols } = await supabase.from('alumni').select('*').limit(1);
  console.log(cols);
}
getIntCols();
