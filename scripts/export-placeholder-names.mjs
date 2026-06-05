import 'dotenv/config';
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data, error } = await supabase
  .from('users')
  .select('username, email, alumni(first_name,last_name)')
  .ilike('email', '%placeholder%')
  .order('username', { ascending: true });

if (error) {
  console.error(error);
  process.exit(1);
}

const esc = (value) => {
  const s = String(value ?? '')
    .replace(/\r?\n/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

  return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const rows = ['name,email'];

for (const user of data || []) {
  const alumni = Array.isArray(user.alumni) ? user.alumni[0] : user.alumni;
  const name = `${alumni?.first_name || ''} ${alumni?.last_name || ''}`
    .trim()
    .replace(/\s+/g, ' ');

  rows.push([name || user.username || '', user.email || ''].map(esc).join(','));
}

fs.writeFileSync('placeholder_names.csv', rows.join('\r\n'));
console.log(JSON.stringify({ count: rows.length - 1, file: 'placeholder_names.csv' }, null, 2));
