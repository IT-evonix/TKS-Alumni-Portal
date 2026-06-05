import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data, error } = await supabase
  .from('users')
  .select('email')
  .not('email', 'is', null)
  .neq('email', '');

if (error) {
  console.error(error);
  process.exit(1);
}

const counts = new Map();

for (const row of data || []) {
  const email = String(row.email || '').trim().toLowerCase();
  const atIndex = email.lastIndexOf('@');
  if (atIndex < 0) continue;
  const domain = email.slice(atIndex + 1);
  counts.set(domain, (counts.get(domain) || 0) + 1);
}

const top = [...counts.entries()]
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  .slice(0, 20)
  .map(([domain, count]) => ({ domain, count }));

console.log(JSON.stringify({ totalDomains: counts.size, top }, null, 2));
