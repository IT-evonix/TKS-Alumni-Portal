/**
 * Round-2 dedupe merge — SQL generator (offline)
 * ------------------------------------------------------------
 *   npx tsx scripts/dedupe-193-merge.ts
 *
 * Reads scripts/out/dedupe-193-precheck.json and emits ONE atomic single-statement WITH-chain:
 *   - reassign child rows (connection_requests / messages) from the 137 placeholder accounts
 *     to their target (pattern A: the real self-registered account; pattern B: the kept placeholder)
 *   - Pattern B: apply the real email to the 18 kept placeholder accounts (users + alumni)
 *   - hard-delete all 137 placeholder accounts (alumni then users; alumni sub-tables and
 *     notifications cascade automatically)
 *
 * Guards abort (division by zero) on any surprise; a successful single statement auto-commits.
 * Emits migrations/dedupe_193_merge_2026-09-04.sql and *_verify.sql.
 */

import { writeFileSync, mkdirSync, readFileSync } from "fs";
import { resolve, dirname } from "path";

const ROOT = process.cwd();
const PRECHECK_IN = resolve(ROOT, "scripts/out/dedupe-193-precheck.json");
const DATE_STR = "2026-09-04";
const SQL_OUT = resolve(ROOT, `migrations/dedupe_193_merge_${DATE_STR}.sql`);
const VERIFY_OUT = resolve(ROOT, `migrations/dedupe_193_merge_${DATE_STR}_verify.sql`);
const TARGET_PROJECT = "aikvtpqqxasdctchtgct";

const EXPECT = {
  patternA: 59, patternB: 18, deleteAccounts: 137, applyEmail: 18,
  connReassign: 16, connDelete: 1, msgReassign: 3,
} as const;
// still-dummy 193 now -> after: 193 − 137 (deleted) − 18 (pattern B emails applied) = 38
//   wait: pattern-A drops (119) are dummy; pattern-B drops (18) are dummy; pattern-B keepers (18)
//   are dummy and get a real email. 193 − 119 − 18 − 18 = 38.  (33 school rows + 5 not-in-sheet)
const EXPECT_STILL_DUMMY_AFTER = 38;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sqlEscape = (s: string) => s.replace(/'/g, "''");

interface Member { username: string; userId: string; alumniId: string; name: string; grad: unknown; approved: boolean; dbEmail: string; dataScore: number; }
interface DedupeGroup { email: string; pattern: "A" | "B"; realUserId: string | null; keep: Member | null; drop: Member[]; }
interface Precheck {
  dedupe: DedupeGroup[];
  childRows: { dropToTarget: Record<string, string>; connReassign: string[]; connDelete: string[]; msgReassign: string[] };
  counts: Record<string, number>;
}

function assert(c: unknown, m: string): asserts c {
  if (!c) { console.error(`\n❌  ASSERTION FAILED: ${m}\n    No files were written.`); process.exit(1); }
}

export function build(precheckPath = PRECHECK_IN): { sql: string; verifySql: string; precheck: Precheck } {
  let pc: Precheck;
  try { pc = JSON.parse(readFileSync(precheckPath, "utf8")); }
  catch { assert(false, `missing ${precheckPath} — run: npx tsx scripts/dedupe-193-precheck.ts`); throw new Error("x"); }

  const patA = pc.dedupe.filter((g) => g.pattern === "A");
  const patB = pc.dedupe.filter((g) => g.pattern === "B");
  assert(patA.length === EXPECT.patternA, `pattern A ${patA.length} != ${EXPECT.patternA}`);
  assert(patB.length === EXPECT.patternB, `pattern B ${patB.length} != ${EXPECT.patternB}`);

  const dropIds = new Set<string>();
  const dropRows: { id: string; target: string }[] = [];
  const emailApply: { userId: string; email: string }[] = [];
  const realKeep = new Set<string>();

  for (const g of pc.dedupe) {
    assert(!/placeholder|@student\.tks\.com/.test(g.email.toLowerCase()), `dedupe email still dummy: ${g.email}`);
    const target = g.pattern === "A" ? g.realUserId! : g.keep!.userId;
    assert(UUID_RE.test(target), `bad target uuid for ${g.email}`);
    if (g.pattern === "A") realKeep.add(target);
    else emailApply.push({ userId: g.keep!.userId, email: g.email });
    for (const d of g.drop) {
      assert(UUID_RE.test(d.userId), `bad drop uuid: ${d.username}`);
      assert(!dropIds.has(d.userId), `drop id twice: ${d.userId}`);
      dropIds.add(d.userId);
      dropRows.push({ id: d.userId, target });
    }
  }
  assert(dropIds.size === EXPECT.deleteAccounts, `delete accounts ${dropIds.size} != ${EXPECT.deleteAccounts}`);
  assert(emailApply.length === EXPECT.applyEmail, `email applies ${emailApply.length} != ${EXPECT.applyEmail}`);
  for (const id of dropIds) {
    assert(!realKeep.has(id), `id is both a drop and a pattern-A real account: ${id}`);
    assert(!emailApply.some((e) => e.userId === id), `id is both a drop and a pattern-B keeper: ${id}`);
  }
  // pattern-B keepers must not also be pattern-A real accounts
  for (const e of emailApply) assert(!realKeep.has(e.userId), `keeper also a real account: ${e.userId}`);
  // pattern-B emails distinct
  assert(new Set(emailApply.map((e) => e.email)).size === emailApply.length, "pattern-B emails not distinct");

  const { connReassign, connDelete, msgReassign } = pc.childRows;
  assert(connReassign.length === EXPECT.connReassign, `connReassign ${connReassign.length} != ${EXPECT.connReassign}`);
  assert(connDelete.length === EXPECT.connDelete, `connDelete ${connDelete.length} != ${EXPECT.connDelete}`);
  assert(msgReassign.length === EXPECT.msgReassign, `msgReassign ${msgReassign.length} != ${EXPECT.msgReassign}`);
  const cr = new Set(connReassign);
  for (const id of connDelete) assert(!cr.has(id), `conn id in both reassign and delete: ${id}`);

  const sql = buildSql(dropRows, emailApply, connReassign, connDelete, msgReassign);
  const verifySql = buildVerify(pc);
  return { sql, verifySql, precheck: pc };
}

export function buildSql(
  dropRows: { id: string; target: string }[],
  emailApply: { userId: string; email: string }[],
  connReassign: string[],
  connDelete: string[],
  msgReassign: string[],
): string {
  const NONE = "00000000-0000-0000-0000-000000000000";
  const dropValues = dropRows.map((d) => `    ('${d.id}', '${d.target}')`).join(",\n");
  const emailValues = emailApply.map((e) => `    ('${e.userId}', '${sqlEscape(e.email)}')`).join(",\n");
  const idRows = (ids: string[]) => (ids.length ? ids : [NONE]).map((i) => `    ('${i}')`).join(",\n");

  return `-- ============================================================================
-- Round-2 dedupe merge   |   TARGET: Supabase project ${TARGET_PROJECT} (PROD)
-- Generated ${DATE_STR} by scripts/dedupe-193-merge.ts from scripts/out/dedupe-193-precheck.json
--
-- ONE atomic statement (WITH-chain). Applies fully and auto-commits, or errors and changes
-- nothing. Guards compute 1/(1-LEAST(1,<bad>)) -> 1 when clean, else division-by-zero.
--
-- ${dropRows.length} placeholder accounts deleted (59 pattern-A groups: real self-registered
-- account already holds the email -> just delete the placeholders; 18 pattern-B groups: no real
-- account -> keep one placeholder and apply the email to it).
-- Child rows first: ${connReassign.length} connection_requests + ${msgReassign.length} messages reassigned to the
-- target account, ${connDelete.length} connection_request deleted (would duplicate/self-connect).
--
-- On SUCCESS the result row: g_drops_dummy=1 g_targets_ok=1 g_email_free=1 g_disjoint=1 g_preflight=1
--   conn_reassigned=${connReassign.length} conn_deleted=${connDelete.length} msgs_reassigned=${msgReassign.length}
--   emails_applied_users=${emailApply.length} emails_applied_alumni=${emailApply.length}
--   alumni_deleted=${dropRows.length} users_deleted=${dropRows.length}
-- Then run dedupe_193_merge_${DATE_STR}_verify.sql -> expect still-dummy ${EXPECT_STILL_DUMMY_AFTER}.
-- ============================================================================
WITH
_drop (id, target) AS (VALUES
${dropValues}
),
_email (user_id, new_email) AS (VALUES
${emailValues}
),
_conn_reassign (id) AS (VALUES
${idRows(connReassign)}
),
_conn_delete (id) AS (VALUES
${idRows(connDelete)}
),
_msg_reassign (id) AS (VALUES
${idRows(msgReassign)}
),

-- ---- guards ----
g_drops_dummy AS (          -- every account to delete is currently on a dummy email
  SELECT (1 / (1 - LEAST(1, count(*))))::int AS ok
    FROM _drop d JOIN users u ON u.id = d.id
   WHERE u.email NOT LIKE '%placeholder%' AND u.email NOT LIKE '%@student.tks.com'
),
g_targets_ok AS (           -- every target account exists and is NOT itself being deleted
  SELECT (1 / (1 - LEAST(1, count(*))))::int AS ok
    FROM (SELECT DISTINCT target FROM _drop) t
    LEFT JOIN users u ON u.id = t.target
   WHERE u.id IS NULL OR u.account_blocked
      OR t.target IN (SELECT id FROM _drop)
),
g_email_free AS (           -- each pattern-B new email is free on users AND alumni (except its keeper)
  SELECT (1 / (1 - LEAST(1,
       (SELECT count(*) FROM _email e JOIN users  u ON lower(u.email) = e.new_email AND u.id      <> e.user_id)
     + (SELECT count(*) FROM _email e JOIN alumni a ON lower(a.email) = e.new_email AND a.user_id <> e.user_id)
     )))::int AS ok
),
g_disjoint AS (             -- no connection_request id in both reassign and delete
  SELECT (1 / (1 - LEAST(1, count(*))))::int AS ok
    FROM _conn_reassign r JOIN _conn_delete d ON r.id = d.id
),
g_preflight AS (            -- no blocking child row (no cascade) for the deletes, EXCLUDING
                            -- connection_requests / messages (handled below)
  SELECT (1 / (1 - LEAST(1,
       (SELECT count(*) FROM feed_posts      WHERE author_id    IN (SELECT id FROM _drop))
     + (SELECT count(*) FROM user_blocks     WHERE blocker_id   IN (SELECT id FROM _drop) OR blocked_id IN (SELECT id FROM _drop))
     + (SELECT count(*) FROM events          WHERE organized_by IN (SELECT id FROM _drop))
     + (SELECT count(*) FROM signup_requests WHERE reviewed_by  IN (SELECT id FROM _drop))
     )))::int AS ok
),

-- ---- writes ----
conn_re_req AS (
  UPDATE connection_requests c SET requester_id = d.target, updated_at = now()
    FROM _drop d
   WHERE c.requester_id = d.id AND c.id IN (SELECT id FROM _conn_reassign)
     AND (SELECT ok FROM g_drops_dummy) = 1 AND (SELECT ok FROM g_targets_ok) = 1 AND (SELECT ok FROM g_disjoint) = 1
  RETURNING 1
),
conn_re_rec AS (
  UPDATE connection_requests c SET recipient_id = d.target, updated_at = now()
    FROM _drop d
   WHERE c.recipient_id = d.id AND c.id IN (SELECT id FROM _conn_reassign)
     AND (SELECT ok FROM g_drops_dummy) = 1 AND (SELECT ok FROM g_targets_ok) = 1 AND (SELECT ok FROM g_disjoint) = 1
  RETURNING 1
),
conn_del AS (
  DELETE FROM connection_requests WHERE id IN (SELECT id FROM _conn_delete)
     AND (SELECT ok FROM g_disjoint) = 1
  RETURNING 1
),
msg_re_snd AS (
  UPDATE messages m SET sender_id = d.target
    FROM _drop d
   WHERE m.sender_id = d.id AND m.id IN (SELECT id FROM _msg_reassign)
     AND (SELECT ok FROM g_drops_dummy) = 1 AND (SELECT ok FROM g_targets_ok) = 1
  RETURNING 1
),
msg_re_rcv AS (
  UPDATE messages m SET receiver_id = d.target
    FROM _drop d
   WHERE m.receiver_id = d.id AND m.id IN (SELECT id FROM _msg_reassign)
     AND (SELECT ok FROM g_drops_dummy) = 1 AND (SELECT ok FROM g_targets_ok) = 1
  RETURNING 1
),
email_users AS (
  UPDATE users u SET email = e.new_email, updated_at = now()
    FROM _email e
   WHERE u.id = e.user_id
     AND (SELECT ok FROM g_drops_dummy) = 1 AND (SELECT ok FROM g_email_free) = 1
  RETURNING 1
),
email_alumni AS (
  UPDATE alumni a SET email = e.new_email, updated_at = now()
    FROM _email e
   WHERE a.user_id = e.user_id
     AND (SELECT ok FROM g_drops_dummy) = 1 AND (SELECT ok FROM g_email_free) = 1
  RETURNING 1
),
del_alumni AS (
  DELETE FROM alumni WHERE user_id IN (SELECT id FROM _drop)
     AND (SELECT ok FROM g_drops_dummy) = 1 AND (SELECT ok FROM g_targets_ok) = 1
     AND (SELECT ok FROM g_preflight) = 1
     AND (SELECT count(*) FROM conn_re_req) >= 0
     AND (SELECT count(*) FROM conn_del) >= 0
     AND (SELECT count(*) FROM msg_re_snd) >= 0
     AND (SELECT count(*) FROM email_alumni) >= 0
  RETURNING 1
),
del_users AS (
  DELETE FROM users WHERE id IN (SELECT id FROM _drop)
     AND (SELECT ok FROM g_drops_dummy) = 1 AND (SELECT ok FROM g_targets_ok) = 1
     AND (SELECT ok FROM g_preflight) = 1
     AND (SELECT count(*) FROM del_alumni) >= 0
     AND (SELECT count(*) FROM email_users) >= 0
  RETURNING 1
)
SELECT
  (SELECT ok FROM g_drops_dummy)   AS g_drops_dummy,
  (SELECT ok FROM g_targets_ok)    AS g_targets_ok,
  (SELECT ok FROM g_email_free)    AS g_email_free,
  (SELECT ok FROM g_disjoint)      AS g_disjoint,
  (SELECT ok FROM g_preflight)     AS g_preflight,
  (SELECT count(*) FROM conn_re_req) + (SELECT count(*) FROM conn_re_rec) AS conn_reassigned,
  (SELECT count(*) FROM conn_del)   AS conn_deleted,
  (SELECT count(*) FROM msg_re_snd) + (SELECT count(*) FROM msg_re_rcv)   AS msgs_reassigned,
  (SELECT count(*) FROM email_users)  AS emails_applied_users,
  (SELECT count(*) FROM email_alumni) AS emails_applied_alumni,
  (SELECT count(*) FROM del_alumni)   AS alumni_deleted,
  (SELECT count(*) FROM del_users)    AS users_deleted;
`;
}

function buildVerify(pc: Precheck): string {
  const sampleDropUsername = pc.dedupe[0]?.drop[0]?.username ?? "";
  const sampleTargetB = pc.dedupe.find((g) => g.pattern === "B");
  return `-- Post-run verification for dedupe_193_merge_${DATE_STR}.sql. Run AFTER the merge.
SELECT
  (SELECT count(*) FROM users  WHERE email LIKE '%placeholder%' OR email LIKE '%@student.tks.com') AS users_still_dummy,   -- expect ${EXPECT_STILL_DUMMY_AFTER}
  (SELECT count(*) FROM alumni WHERE email LIKE '%placeholder%' OR email LIKE '%@student.tks.com') AS alumni_still_dummy,  -- expect ${EXPECT_STILL_DUMMY_AFTER}
  (SELECT count(*) FROM users u JOIN alumni a ON a.user_id = u.id WHERE lower(u.email) <> lower(a.email)) AS email_mismatches,  -- expect 0
  (SELECT count(*) FROM connection_requests c LEFT JOIN users u ON u.id = c.recipient_id WHERE u.id IS NULL) AS orphan_conn_recipient,  -- expect 0
  (SELECT count(*) FROM connection_requests c LEFT JOIN users u ON u.id = c.requester_id WHERE u.id IS NULL) AS orphan_conn_requester,  -- expect 0
  (SELECT count(*) FROM messages m LEFT JOIN users u ON u.id = m.receiver_id WHERE u.id IS NULL) AS orphan_msg_receiver,  -- expect 0
  (SELECT count(*) FROM users WHERE username = '${sampleDropUsername}') AS sample_drop_gone,  -- expect 0
  (SELECT email FROM users WHERE id = '${sampleTargetB?.keep?.userId ?? ""}') AS sample_patternB_keeper_email;  -- expect ${sampleTargetB?.email ?? ""}
`;
}

function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log(" Round-2 Dedupe Merge: SQL Generator");
  console.log("═══════════════════════════════════════════════════════════\n");
  const { sql, verifySql, precheck } = build();
  const c = precheck.counts;
  console.log(`  pattern A groups          : ${c.patternA}`);
  console.log(`  pattern B groups          : ${c.patternB}`);
  console.log(`  placeholder accounts del  : ${c.deleteAccounts}`);
  console.log(`  emails applied (pattern B): ${c.applyEmail}`);
  console.log(`  conn reassign / delete    : ${c.connReassign} / ${c.connDelete}`);
  console.log(`  msg reassign              : ${c.msgReassign}`);
  console.log(`\n  still-dummy after         : ${EXPECT_STILL_DUMMY_AFTER}\n`);

  mkdirSync(dirname(SQL_OUT), { recursive: true });
  writeFileSync(SQL_OUT, sql);
  writeFileSync(VERIFY_OUT, verifySql);
  console.log(`✅  Wrote:\n   ${SQL_OUT}\n   ${VERIFY_OUT}`);
  console.log(`\nRun the SQL (one atomic statement) in the Supabase editor, then run _verify.sql.`);
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]).endsWith("dedupe-193-merge.ts");
if (isDirectRun) main();
