/**
 * Full cleanup auto-actions — SQL generator (offline)
 *   npx tsx scripts/full-cleanup-merge.ts
 *
 * Reads scripts/out/full-cleanup-precheck.json and emits ONE atomic single-statement WITH-chain:
 *   1. 17 safe dupe merges — delete the school-import placeholder, keep the self-registered account
 *   2. 1 email typo fix — strip "mailto:" prefix (Janvi Dixit)
 *   3. 14 test/dev account deletes (+ their 6 empty alumni rows + vijay's 1 test message)
 *
 * Everything else -> scripts/out/MASTER-school-list.csv (413 rows).
 * Guards abort (division by zero) on any surprise; a successful statement auto-commits.
 */

import { writeFileSync, mkdirSync, readFileSync } from "fs";
import { resolve, dirname } from "path";

const ROOT = process.cwd();
const PRECHECK_IN = resolve(ROOT, "scripts/out/full-cleanup-precheck.json");
const DATE_STR = "2026-09-10";
const SQL_OUT = resolve(ROOT, `migrations/full_cleanup_${DATE_STR}.sql`);
const VERIFY_OUT = resolve(ROOT, `migrations/full_cleanup_${DATE_STR}_verify.sql`);
const TARGET_PROJECT = "aikvtpqqxasdctchtgct";

const EXPECT = { safeMerges: 17, typoFixes: 1, testDeletes: 14 } as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sqlEsc = (s: string) => s.replace(/'/g, "''");

interface Precheck {
  safeMerges: { keepId: string; keepUsername: string; dropId: string; dropUsername: string; name: string }[];
  connReassign: string[];
  connDelete: string[];
  msgReassign: string[];
  typoFixes: { userId: string; username: string; from: string; to: string }[];
  testDeletes: { userId: string; username: string; email: string; activity: number; hasAlumni: boolean }[];
}

function assert(c: unknown, m: string): asserts c {
  if (!c) { console.error(`\n❌  ASSERTION FAILED: ${m}\n    No files written.`); process.exit(1); }
}

export function build(path = PRECHECK_IN): { sql: string; verifySql: string; pc: Precheck } {
  let pc: Precheck;
  try { pc = JSON.parse(readFileSync(path, "utf8")); }
  catch { assert(false, `missing ${path} — run scripts/full-cleanup-precheck.ts`); throw new Error("x"); }

  assert(pc.safeMerges.length === EXPECT.safeMerges, `safeMerges ${pc.safeMerges.length} != ${EXPECT.safeMerges}`);
  assert(pc.typoFixes.length === EXPECT.typoFixes, `typoFixes ${pc.typoFixes.length} != ${EXPECT.typoFixes}`);
  assert(pc.testDeletes.length === EXPECT.testDeletes, `testDeletes ${pc.testDeletes.length} != ${EXPECT.testDeletes}`);
  assert(pc.connReassign.length === 0 && pc.connDelete.length === 0 && pc.msgReassign.length === 0,
    `safe merges expected 0 child rows; got conn ${pc.connReassign.length}/${pc.connDelete.length} msg ${pc.msgReassign.length}`);

  const keepIds = new Set(pc.safeMerges.map((s) => s.keepId));
  const dropIds = new Set(pc.safeMerges.map((s) => s.dropId));
  const testIds = new Set(pc.testDeletes.map((t) => t.userId));
  const typoIds = new Set(pc.typoFixes.map((t) => t.userId));
  for (const s of pc.safeMerges) {
    assert(UUID_RE.test(s.keepId) && UUID_RE.test(s.dropId), `bad uuid ${s.name}`);
    assert(s.keepId !== s.dropId, `keep==drop ${s.name}`);
  }
  for (const id of dropIds) assert(!keepIds.has(id), `id both keep and drop: ${id}`);
  for (const id of testIds) { assert(!keepIds.has(id) && !dropIds.has(id) && !typoIds.has(id), `test-delete id overlaps: ${id}`); assert(UUID_RE.test(id), `bad test uuid ${id}`); }
  for (const id of typoIds) { assert(!keepIds.has(id) && !dropIds.has(id), `typo id overlaps: ${id}`); assert(UUID_RE.test(id), `bad typo uuid ${id}`); }

  const allDeleteIds = [...dropIds, ...testIds];
  assert(new Set(allDeleteIds).size === allDeleteIds.length, "duplicate id in the combined delete set");

  const sql = buildSql(pc);
  const verifySql = buildVerify(pc);
  return { sql, verifySql, pc };
}

export function buildSql(pc: Precheck): string {
  const mergeVals = pc.safeMerges.map((s) => `    ('${s.dropId}')`).join(",\n");
  const testVals = pc.testDeletes.map((t) => `    ('${t.userId}')`).join(",\n");
  const typo = pc.typoFixes[0];

  return `-- ============================================================================
-- Full cleanup — auto-actions   |   TARGET: Supabase project ${TARGET_PROJECT} (PROD)
-- Generated ${DATE_STR} by scripts/full-cleanup-merge.ts
--
-- ONE atomic statement (WITH-chain). Applies fully and auto-commits, or errors and changes
-- nothing. Guards compute 1/(1-LEAST(1,<bad>)) -> 1 when clean, else division-by-zero.
--
--  1. ${pc.safeMerges.length} duplicate merges  — delete the school-import placeholder account, keep the
--     student's self-registered account (verified: import acct has ZERO activity, 0 child rows).
--  2. ${pc.typoFixes.length} email typo fix       — strip the "mailto:" prefix on ${typo?.username}.
--  3. ${pc.testDeletes.length} test/dev deletes   — 'om','admin','vijay', 10x 'prashant*' dev accounts,
--     'alumni@evonix.co'. Also removes their ${pc.testDeletes.filter((t) => t.hasAlumni).length} empty alumni rows and vijay's 1 test message.
--
-- All other issues (~180 duplicate groups needing school confirmation, yopmail throwaways,
-- internal-domain emails) are in scripts/out/MASTER-school-list.csv — NOT touched here.
--
-- On SUCCESS: g_merge_dummy=1 g_merge_keep_ok=1 g_test_safe=1
--   dupe_placeholders_deleted=${pc.safeMerges.length}  typo_fixed=${pc.typoFixes.length}
--   test_users_deleted=${pc.testDeletes.length}  test_alumni_deleted=${pc.testDeletes.filter((t) => t.hasAlumni).length}  test_messages_deleted=1
-- Then run full_cleanup_${DATE_STR}_verify.sql.
-- ============================================================================
WITH
_dupe_drop (id) AS (VALUES
${mergeVals}
),
_test (id) AS (VALUES
${testVals}
),

-- ---- guards ----
g_merge_dummy AS (         -- every dupe-drop account is a school import: dummy email OR created on
                            -- an import date, AND has zero activity (checked in precheck; re-assert dummy/date here)
  SELECT (1 / (1 - LEAST(1, count(*))))::int AS ok
    FROM _dupe_drop d JOIN users u ON u.id = d.id
   WHERE NOT (
     u.email LIKE '%placeholder%' OR u.email LIKE '%@student.tks.com'
     OR u.created_at::date IN ('2025-10-02','2026-02-09','2026-02-13')
   )
),
g_merge_keep_ok AS (       -- for each dupe-drop, a DIFFERENT non-blocked account with the same
                            -- normalized name still exists (the keeper)
  SELECT (1 / (1 - LEAST(1, count(*))))::int AS ok
    FROM _dupe_drop d
    JOIN alumni ad ON ad.user_id = d.id
   WHERE NOT EXISTS (
     SELECT 1 FROM alumni ak JOIN users uk ON uk.id = ak.user_id
      WHERE ak.user_id <> d.id
        AND lower(regexp_replace(ak.first_name, '[^a-zA-Z0-9]', '', 'g')) = lower(regexp_replace(ad.first_name, '[^a-zA-Z0-9]', '', 'g'))
        AND lower(regexp_replace(ak.last_name,  '[^a-zA-Z0-9]', '', 'g')) = lower(regexp_replace(ad.last_name,  '[^a-zA-Z0-9]', '', 'g'))
        AND NOT uk.account_blocked
   )
),
g_test_safe AS (           -- no test account is an admin / administrator, and none has feed posts,
                            -- connection requests, or blog posts (only vijay's 1 message is allowed)
  SELECT (1 / (1 - LEAST(1,
       (SELECT count(*) FROM users u WHERE u.id IN (SELECT id FROM _test) AND (u.is_admin OR u.user_role = 'administrator'))
     + (SELECT count(*) FROM feed_posts          WHERE author_id    IN (SELECT id FROM _test))
     + (SELECT count(*) FROM connection_requests WHERE requester_id IN (SELECT id FROM _test) OR recipient_id IN (SELECT id FROM _test))
     + (SELECT count(*) FROM blog_posts          WHERE author_id    IN (SELECT id FROM _test))
     + (SELECT count(*) FROM events              WHERE organized_by IN (SELECT id FROM _test))
     + (SELECT count(*) FROM signup_requests     WHERE reviewed_by  IN (SELECT id FROM _test))
     )))::int AS ok
),

-- ---- writes ----
typo_fix AS (
  UPDATE users u SET email = '${sqlEsc(typo.to)}', updated_at = now()
   WHERE u.id = '${typo.userId}' AND lower(u.email) = '${sqlEsc(typo.from.toLowerCase())}'
  RETURNING 1
),
typo_fix_alumni AS (
  UPDATE alumni a SET email = '${sqlEsc(typo.to)}', updated_at = now()
   WHERE a.user_id = '${typo.userId}' AND lower(a.email) = '${sqlEsc(typo.from.toLowerCase())}'
  RETURNING 1
),
-- vijay's single test message (no ON DELETE CASCADE on messages.sender_id / receiver_id)
msg_clear AS (
  DELETE FROM messages
   WHERE (sender_id IN (SELECT id FROM _test) OR receiver_id IN (SELECT id FROM _test))
     AND (SELECT ok FROM g_test_safe) = 1
  RETURNING 1
),
del_dupe_alumni AS (
  DELETE FROM alumni WHERE user_id IN (SELECT id FROM _dupe_drop)
     AND (SELECT ok FROM g_merge_dummy) = 1 AND (SELECT ok FROM g_merge_keep_ok) = 1
  RETURNING 1
),
del_dupe_users AS (
  DELETE FROM users WHERE id IN (SELECT id FROM _dupe_drop)
     AND (SELECT ok FROM g_merge_dummy) = 1 AND (SELECT ok FROM g_merge_keep_ok) = 1
     AND (SELECT count(*) FROM del_dupe_alumni) >= 0
  RETURNING 1
),
del_test_alumni AS (
  DELETE FROM alumni WHERE user_id IN (SELECT id FROM _test)
     AND (SELECT ok FROM g_test_safe) = 1
     AND (SELECT count(*) FROM msg_clear) >= 0
  RETURNING 1
),
del_test_users AS (
  DELETE FROM users WHERE id IN (SELECT id FROM _test)
     AND (SELECT ok FROM g_test_safe) = 1
     AND (SELECT count(*) FROM del_test_alumni) >= 0
     AND (SELECT count(*) FROM msg_clear) >= 0
  RETURNING 1
)
SELECT
  (SELECT ok FROM g_merge_dummy)          AS g_merge_dummy,
  (SELECT ok FROM g_merge_keep_ok)        AS g_merge_keep_ok,
  (SELECT ok FROM g_test_safe)            AS g_test_safe,
  (SELECT count(*) FROM typo_fix)         AS typo_fixed_users,
  (SELECT count(*) FROM typo_fix_alumni)  AS typo_fixed_alumni,
  (SELECT count(*) FROM msg_clear)        AS test_messages_deleted,
  (SELECT count(*) FROM del_dupe_alumni)  AS dupe_alumni_deleted,
  (SELECT count(*) FROM del_dupe_users)   AS dupe_placeholders_deleted,
  (SELECT count(*) FROM del_test_alumni)  AS test_alumni_deleted,
  (SELECT count(*) FROM del_test_users)   AS test_users_deleted;
`;
}

function buildVerify(pc: Precheck): string {
  const s0 = pc.safeMerges[0];
  const t0 = pc.typoFixes[0];
  return `-- Post-run verification for full_cleanup_${DATE_STR}.sql. Run AFTER.
SELECT
  (SELECT count(*) FROM users)  AS total_users,   -- was 1201; expect 1201 - 17 - 14 = 1170
  (SELECT count(*) FROM alumni) AS total_alumni,  -- was 1189; expect 1189 - 17 - ${pc.testDeletes.filter((t) => t.hasAlumni).length} = ${1189 - 17 - pc.testDeletes.filter((t) => t.hasAlumni).length}
  (SELECT count(*) FROM users WHERE username = '${s0?.dropUsername}') AS sample_dupe_drop_gone,       -- 0
  (SELECT email FROM users WHERE username = '${s0?.keepUsername}') AS sample_dupe_keep_email,         -- unchanged real email
  (SELECT count(*) FROM users WHERE username IN ('om','admin','vijay','alumni_ms7i2z5c')) AS test_accts_remaining,  -- 0
  (SELECT email FROM users WHERE id = '${t0?.userId}') AS janvi_email,                                -- ${t0?.to}
  (SELECT count(*) FROM users u JOIN alumni a ON a.user_id=u.id WHERE lower(u.email)<>lower(a.email)) AS email_mismatches,  -- 0
  (SELECT count(*) FROM alumni a LEFT JOIN users u ON u.id=a.user_id WHERE u.id IS NULL) AS orphan_alumni,  -- 0
  (SELECT count(*) FROM messages m LEFT JOIN users u ON u.id=m.sender_id WHERE u.id IS NULL) AS orphan_msg_sender,  -- 0
  (SELECT count(*) FROM users WHERE email ILIKE '%placeholder%' OR email ILIKE '%@student.tks.com') AS still_dummy;  -- was 6; some of the 6 may now be gone via merges
`;
}

function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log(" Full Cleanup Auto-Actions: SQL Generator");
  console.log("═══════════════════════════════════════════════════════════\n");
  const { sql, verifySql, pc } = build();
  console.log(`  safe dupe merges  : ${pc.safeMerges.length}`);
  console.log(`  email typo fixes  : ${pc.typoFixes.length}`);
  console.log(`  test/dev deletes  : ${pc.testDeletes.length}  (+ ${pc.testDeletes.filter((t) => t.hasAlumni).length} alumni rows, 1 message)`);
  console.log(`\n  -> everything else in scripts/out/MASTER-school-list.csv\n`);

  mkdirSync(dirname(SQL_OUT), { recursive: true });
  writeFileSync(SQL_OUT, sql);
  writeFileSync(VERIFY_OUT, verifySql);
  console.log(`✅  Wrote:\n   ${SQL_OUT}\n   ${VERIFY_OUT}`);
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]).endsWith("full-cleanup-merge.ts");
if (isDirectRun) main();
