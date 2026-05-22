
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('CRITICAL: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const isApply = process.argv.includes('--apply');

async function cleanupRemainingTestUsers() {
  console.log(`Starting ${isApply ? 'APPLY' : 'DRY RUN'} for remaining test users cleanup...\n`);

  // 1. Fetch ALL users and alumni to identify candidates locally (to avoid complex SQL or logic errors)
  const [{ data: users, error: uErr }, { data: alumni, error: aErr }] = await Promise.all([
    supabase.from('users').select('id, email, username, created_at'),
    supabase.from('alumni').select('user_id, first_name, last_name, graduation_year')
  ]);

  if (uErr || aErr) {
    console.error('Error fetching data:', uErr || aErr);
    return;
  }

  const alumniMap = new Map(alumni?.map(a => [a.user_id, a]) || []);

  // 2. Identification Criteria
  const candidates = (users || []).filter(user => {
    const username = (user.username || '').toLowerCase();
    const email = (user.email || '').toLowerCase();
    const alum = alumniMap.get(user.id);
    
    // Pattern Match
    const isRandomizedUsername = username.includes('_mm') || username.includes('_mn') || username.includes('_mc');
    const isTestDomain = email.includes('creativescope') || email.includes('example') || email.endsWith('.con');
    const isFutureGradYear = alum && alum.graduation_year > 2027;
    const isBulkCreationBatch = user.created_at.startsWith('2026-02-26T06:49');

    return isRandomizedUsername || isTestDomain || isFutureGradYear || isBulkCreationBatch;
  });

  console.log(`Found ${candidates.length} candidates for deletion:\n`);
  
  for (const c of candidates) {
    const alum = alumniMap.get(c.id);
    console.log(`- ${c.username} (${c.email}) | Name: ${alum?.first_name} ${alum?.last_name} | Grad: ${alum?.graduation_year} | Created: ${c.created_at}`);
  }

  if (candidates.length === 0) {
    console.log('\nNo candidates found. Cleanup complete.');
    return;
  }

  if (!isApply) {
    console.log(`\nDRY RUN complete. Re-run with --apply to execute deletions.`);
    return;
  }

  console.log(`\nExecuting deletion of ${candidates.length} users and their dependencies...\n`);

  const userIds = candidates.map(c => c.id);

  // 3. Remove non-cascading dependencies first
  // Note: Most tables should have ON DELETE CASCADE, but we'll handle known tricky ones manually.
  
  const tablesToClear = [
    { name: 'signup_requests', col: 'email', val: candidates.map(c => c.email) },
    { name: 'connection_requests', col: 'sender_id', val: userIds },
    { name: 'connection_requests', col: 'receiver_id', val: userIds },
    { name: 'connections', col: 'user_id', val: userIds },
    { name: 'connections', col: 'connected_user_id', val: userIds },
    { name: 'user_blocks', col: 'blocker_id', val: userIds },
    { name: 'user_blocks', col: 'blocked_id', val: userIds },
    { name: 'feed_posts', col: 'user_id', val: userIds },
    { name: 'jobs', col: 'posted_by', val: userIds },
    { name: 'events', col: 'created_by', val: userIds },
    { name: 'forum_thread_participants', col: 'user_id', val: userIds }
  ];

  for (const table of tablesToClear) {
    const { error } = await supabase.from(table.name).delete().in(table.col, table.val);
    if (error) {
      console.error(`Warning: Failed to clear ${table.name} for some users:`, error.message);
    } else {
      console.log(`Cleared ${table.name} entries.`);
    }
  }

  // 4. Finally delete the users (Alumni records should cascade)
  const { error: deleteError } = await supabase.from('users').delete().in('id', userIds);

  if (deleteError) {
    console.error('Final deletion error:', deleteError);
  } else {
    console.log(`\nSUCCESS: ${candidates.length} users and their associated records have been removed.`);
  }
}

cleanupRemainingTestUsers();
