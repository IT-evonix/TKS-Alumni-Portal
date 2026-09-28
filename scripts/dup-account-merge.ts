/**
 * Dup-Account Merge — SQL Generator (offline)
 * ------------------------------------------------------------
 * Usage:
 *   npx tsx scripts/dup-account-merge.ts
 *
 * Reads scripts/out/dup-account-precheck.json (from scripts/dup-account-precheck.ts) and emits:
 *   - migrations/dup_account_merge_2026-09-04.sql   (guarded + transactional)
 *   - scripts/out/dup-account-merge-report.csv
 *
 * See C:\Users\vansh\.claude\plans\dup-account-merge.md for the plan.
 */

import { writeFileSync, mkdirSync, readFileSync } from "fs";
import { resolve, dirname } from "path";

const ROOT = process.cwd();
const PRECHECK_IN = resolve(ROOT, "scripts/out/dup-account-precheck.json");
const DATE_STR = "2026-09-04";
const SQL_OUT = resolve(ROOT, `migrations/dup_account_merge_${DATE_STR}.sql`);
const REPORT_OUT = resolve(ROOT, "scripts/out/dup-account-merge-report.csv");
const TARGET_PROJECT = "aikvtpqqxasdctchtgct";

// Hard-asserted expectations. If prod shifts, these change and must be re-reviewed.
const EXPECT = {
  merges: 180,
  clean1RowUpdate: 1,
  connReassign: 70,
  connDelete: 9,
  msgReassign: 10,
} as const;
// still-dummy after: 374 (current) − 180 (merged-away) − 1 (clean update) = 193
const EXPECT_STILL_DUMMY_AFTER = 193;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sqlEscape = (s: string) => s.replace(/'/g, "''");

export interface Merge {
  placeholderUserId: string;
  placeholderUsername: string;
  placeholderEmail: string;
  placeholderAlumniId: string | null;
  realUserId: string;
  realUsername: string;
  realAlumniId: string | null;
  newEmail: string;
  connReassign: string[];
  connDelete: string[];
  msgReassign: string[];
  portCompany: string | null;
}
export interface Precheck {
  merges: Merge[];
  clean1RowUpdate: { userId: string; newEmail: string }[];
  skipped: { placeholderUserId: string; reason: string }[];
  totals: Record<string, number>;
}
export interface BuildResult {
  sql: string;
  reportCsv: string;
  precheck: Precheck;
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error(`\n❌  ASSERTION FAILED: ${msg}\n    No files were written.`);
    process.exit(1);
  }
}

export function build(precheckPath: string = PRECHECK_IN): BuildResult {
  let precheck: Precheck;
  try {
    precheck = JSON.parse(readFileSync(precheckPath, "utf8"));
  } catch {
    assert(false, `missing ${precheckPath} — run: npx tsx scripts/dup-account-precheck.ts`);
    throw new Error("unreachable");
  }
  const { merges, clean1RowUpdate, skipped } = precheck;

  // 1. counts
  assert(merges.length === EXPECT.merges, `merges ${merges.length} != ${EXPECT.merges} — DB changed, re-review`);
  assert(clean1RowUpdate.length === EXPECT.clean1RowUpdate, `clean1RowUpdate ${clean1RowUpdate.length} != ${EXPECT.clean1RowUpdate}`);
  assert(skipped.length === 0, `${skipped.length} placeholder(s) skipped — inspect precheck.skipped and re-review`);

  const connReassign = merges.flatMap((m) => m.connReassign);
  const connDelete = merges.flatMap((m) => m.connDelete);
  const msgReassign = merges.flatMap((m) => m.msgReassign);
  assert(connReassign.length === EXPECT.connReassign, `connReassign ${connReassign.length} != ${EXPECT.connReassign}`);
  assert(connDelete.length === EXPECT.connDelete, `connDelete ${connDelete.length} != ${EXPECT.connDelete}`);
  assert(msgReassign.length === EXPECT.msgReassign, `msgReassign ${msgReassign.length} != ${EXPECT.msgReassign}`);

  // 2. ids well-formed and disjoint
  const phIds = new Set<string>();
  const realIds = new Set<string>();
  for (const m of merges) {
    assert(UUID_RE.test(m.placeholderUserId), `bad placeholder uuid: ${m.placeholderUserId}`);
    assert(UUID_RE.test(m.realUserId), `bad real uuid: ${m.realUserId}`);
    assert(!phIds.has(m.placeholderUserId), `placeholder listed twice: ${m.placeholderUserId}`);
    phIds.add(m.placeholderUserId);
    realIds.add(m.realUserId);
  }
  for (const id of phIds) assert(!realIds.has(id), `id is both placeholder and real: ${id}`);
  for (const c of clean1RowUpdate) {
    assert(UUID_RE.test(c.userId), `clean1RowUpdate bad uuid: ${c.userId}`);
    assert(!phIds.has(c.userId), `clean1RowUpdate id is also a merge placeholder: ${c.userId}`);
  }

  // 3. reassign / delete sets disjoint and globally unique
  const allConnHandled = [...connReassign, ...connDelete];
  assert(new Set(allConnHandled).size === allConnHandled.length, "a connection_request id is handled more than once");
  const rSet = new Set(connReassign);
  for (const id of connDelete) assert(!rSet.has(id), `request in both reassign and delete: ${id}`);
  assert(new Set(msgReassign).size === msgReassign.length, "a message id is handled more than once");

  // 4. emails
  for (const m of merges) {
    assert(!/placeholder|@student\.tks\.com/.test(m.newEmail.toLowerCase()), `merge newEmail still dummy: ${m.newEmail}`);
  }

  // 5. still-dummy after, two ways
  const derivedA = 374 - merges.length - clean1RowUpdate.length;
  assert(derivedA === EXPECT_STILL_DUMMY_AFTER, `derivedA ${derivedA} != ${EXPECT_STILL_DUMMY_AFTER}`);
  //   193 = 177 dup-skip + 10 still-dummy + 1 blank + 5 not-in-sheet
  assert(177 + 10 + 1 + 5 === EXPECT_STILL_DUMMY_AFTER, "static breakdown of 193 is wrong");

  const sql = buildSql(merges, clean1RowUpdate, connReassign, connDelete, msgReassign);
  const reportCsv = buildReport(merges);
  return { sql, reportCsv, precheck };
}

// One atomic single-statement WITH-chain (the Supabase editor runs statements in isolation —
// no temp tables, no BEGIN/COMMIT spanning, no dollar-quoting). Verified: multiple data-
// modifying CTEs on the same table (disjoint rows) are allowed. Any CTE error (a guard's
// division-by-zero) rolls back the whole statement; success auto-commits.
export function buildSql(
  merges: Merge[],
  clean1RowUpdate: { userId: string; newEmail: string }[],
  connReassign: string[],
  connDelete: string[],
  msgReassign: string[],
): string {
  const mergeValues = merges
    .map(
      (m) =>
        `    ('${m.placeholderUserId}', '${m.realUserId}', ` +
        `${m.portCompany ? `'${sqlEscape(m.portCompany)}'` : "NULL"})`,
    )
    .join(",\n");
  // VALUES lists must be non-empty; a sentinel that cannot match any real id is safe with NOT IN
  // (unlike NULL, which makes NOT IN return UNKNOWN for every row).
  const NONE = "00000000-0000-0000-0000-000000000000";
  const idRows = (ids: string[]) =>
    (ids.length ? ids : [NONE]).map((i) => `    ('${i}')`).join(",\n");
  const clean = clean1RowUpdate[0];

  return `-- ============================================================================
-- Merge ${merges.length} duplicate placeholder accounts into their real self-registered accounts
-- TARGET: Supabase project ${TARGET_PROJECT}  (PROD)
-- Generated ${DATE_STR} by scripts/dup-account-merge.ts from scripts/out/dup-account-precheck.json
--
-- PREREQUISITE: fix_dummy_emails_${DATE_STR}.sql is committed (baseline 374/374). Verified.
--
-- HOW TO RUN: paste this ENTIRE file into the Supabase SQL editor and click RUN. It is ONE
-- atomic statement (a WITH-chain): it applies completely and auto-commits, or errors and
-- changes NOTHING. Guards are CTEs computing 1/(1-LEAST(1,<bad>)) — = 1 when the bad count
-- is 0, else "division by zero" aborting the whole statement.
--
-- On SUCCESS the single result row shows:
--   g_dummy=1 g_real=1 g_disjoint=1 g_noref=1 g_preflight=1
--   clean_email_updated=1
--   conn_reassigned=${connReassign.length} conn_deleted=${connDelete.length} msgs_reassigned=${msgReassign.length} companies_ported=<0..${merges.filter((m) => m.portCompany).length}>
--   alumni_deleted=${merges.length} users_deleted=${merges.length}
--   users_still_dummy=${EXPECT_STILL_DUMMY_AFTER} alumni_still_dummy=${EXPECT_STILL_DUMMY_AFTER}   (pre-write snapshot minus deletes)
-- Any ERROR => nothing changed. Refresh the precheck, regenerate, re-run.
--
-- ${merges.length} placeholders merged+deleted; ${connReassign.length} conn reassigned, ${connDelete.length} deleted;
-- ${msgReassign.length} messages reassigned; + 1 clean email update (${clean?.newEmail}).
-- ============================================================================
WITH
_merge (placeholder_id, real_id, port_company) AS (VALUES
${mergeValues}
),
_conn_reassign (req_id) AS (VALUES
${idRows(connReassign)}
),
_conn_delete (req_id) AS (VALUES
${idRows(connDelete)}
),
_msg_reassign (msg_id) AS (VALUES
${idRows(msgReassign)}
),

-- ---- guards ----
g_dummy AS (            -- every placeholder still on a dummy email
  SELECT (1 / (1 - LEAST(1, count(*))))::int AS ok
    FROM _merge m JOIN users u ON u.id = m.placeholder_id
   WHERE u.email NOT LIKE '%placeholder%' AND u.email NOT LIKE '%@student.tks.com'
),
g_real AS (             -- every real_id exists, not blocked, itself not a placeholder
  SELECT (1 / (1 - LEAST(1, count(*))))::int AS ok
    FROM _merge m LEFT JOIN users u ON u.id = m.real_id
   WHERE u.id IS NULL OR u.account_blocked
      OR u.email LIKE '%placeholder%' OR u.email LIKE '%@student.tks.com'
),
g_disjoint AS (         -- no connection_request id in both reassign and delete
  SELECT (1 / (1 - LEAST(1, count(*))))::int AS ok
    FROM _conn_reassign r JOIN _conn_delete d ON r.req_id = d.req_id
),
g_preflight AS (        -- no blocking child row for the deletes, EXCLUDING connection_requests
                        -- and messages (handled below)
  SELECT (1 / (1 - LEAST(1,
       (SELECT count(*) FROM feed_posts      WHERE author_id    IN (SELECT placeholder_id FROM _merge))
     + (SELECT count(*) FROM user_blocks     WHERE blocker_id   IN (SELECT placeholder_id FROM _merge) OR blocked_id IN (SELECT placeholder_id FROM _merge))
     + (SELECT count(*) FROM events          WHERE organized_by IN (SELECT placeholder_id FROM _merge))
     + (SELECT count(*) FROM signup_requests WHERE reviewed_by  IN (SELECT placeholder_id FROM _merge))
     )))::int AS ok
),

-- ---- writes ----
clean_upd AS (          -- the 1 row that was mis-bucketed as a dup (email only on alumni table)
  UPDATE users SET email = '${sqlEscape(clean.newEmail)}', updated_at = now()
   WHERE id = '${clean.userId}'
     AND (email LIKE '%placeholder%' OR email LIKE '%@student.tks.com')
  RETURNING 1
),
conn_re_recipient AS (
  UPDATE connection_requests c SET recipient_id = m.real_id, updated_at = now()
    FROM _merge m
   WHERE c.recipient_id = m.placeholder_id
     AND c.id IN (SELECT req_id FROM _conn_reassign)
     AND (SELECT ok FROM g_dummy) = 1 AND (SELECT ok FROM g_real) = 1 AND (SELECT ok FROM g_disjoint) = 1
  RETURNING 1
),
conn_re_requester AS (  -- defensive: precheck saw placeholders only as recipient, cover both
  UPDATE connection_requests c SET requester_id = m.real_id, updated_at = now()
    FROM _merge m
   WHERE c.requester_id = m.placeholder_id
     AND c.id IN (SELECT req_id FROM _conn_reassign)
     AND (SELECT ok FROM g_dummy) = 1 AND (SELECT ok FROM g_real) = 1 AND (SELECT ok FROM g_disjoint) = 1
  RETURNING 1
),
conn_del AS (
  DELETE FROM connection_requests
   WHERE id IN (SELECT req_id FROM _conn_delete)
     AND (SELECT ok FROM g_disjoint) = 1
  RETURNING 1
),
msg_re_receiver AS (
  UPDATE messages msg SET receiver_id = m.real_id
    FROM _merge m
   WHERE msg.receiver_id = m.placeholder_id
     AND msg.id IN (SELECT msg_id FROM _msg_reassign)
     AND (SELECT ok FROM g_dummy) = 1 AND (SELECT ok FROM g_real) = 1
  RETURNING 1
),
msg_re_sender AS (
  UPDATE messages msg SET sender_id = m.real_id
    FROM _merge m
   WHERE msg.sender_id = m.placeholder_id
     AND msg.id IN (SELECT msg_id FROM _msg_reassign)
     AND (SELECT ok FROM g_dummy) = 1 AND (SELECT ok FROM g_real) = 1
  RETURNING 1
),
company_port AS (
  UPDATE alumni a SET current_company = m.port_company, updated_at = now()
    FROM _merge m
   WHERE a.user_id = m.real_id
     AND m.port_company IS NOT NULL
     AND (a.current_company IS NULL OR lower(btrim(a.current_company)) IN ('', 'no', 'none', 'n/a', 'na', '-', 'yes'))
     AND (SELECT ok FROM g_dummy) = 1 AND (SELECT ok FROM g_real) = 1
  RETURNING 1
),
-- g_noref: is there ANY connection_request / message that references a placeholder but is NOT
-- in our reassign/delete lists? (i.e. something we're not handling → abort). Snapshot-time check.
g_noref AS (
  SELECT (1 / (1 - LEAST(1,
       (SELECT count(*) FROM connection_requests
         WHERE (requester_id IN (SELECT placeholder_id FROM _merge) OR recipient_id IN (SELECT placeholder_id FROM _merge))
           AND id NOT IN (SELECT req_id FROM _conn_reassign)
           AND id NOT IN (SELECT req_id FROM _conn_delete))
     + (SELECT count(*) FROM messages
         WHERE (sender_id IN (SELECT placeholder_id FROM _merge) OR receiver_id IN (SELECT placeholder_id FROM _merge))
           AND id NOT IN (SELECT msg_id FROM _msg_reassign))
     )))::int AS ok
),
del_alumni AS (
  DELETE FROM alumni
   WHERE user_id IN (SELECT placeholder_id FROM _merge)
     AND (SELECT ok FROM g_dummy) = 1 AND (SELECT ok FROM g_real) = 1
     AND (SELECT ok FROM g_preflight) = 1 AND (SELECT ok FROM g_noref) = 1
     AND (SELECT count(*) FROM conn_del) >= 0        -- force conn_del + reassigns to run first
     AND (SELECT count(*) FROM conn_re_recipient) >= 0
     AND (SELECT count(*) FROM msg_re_receiver) >= 0
     AND (SELECT count(*) FROM company_port) >= 0
  RETURNING 1
),
del_users AS (
  DELETE FROM users
   WHERE id IN (SELECT placeholder_id FROM _merge)
     AND (SELECT ok FROM g_dummy) = 1 AND (SELECT ok FROM g_real) = 1
     AND (SELECT ok FROM g_preflight) = 1 AND (SELECT ok FROM g_noref) = 1
     AND (SELECT count(*) FROM del_alumni) >= 0     -- force del_alumni first
  RETURNING 1
)
SELECT
  (SELECT ok FROM g_dummy)                    AS g_dummy,
  (SELECT ok FROM g_real)                     AS g_real,
  (SELECT ok FROM g_disjoint)                 AS g_disjoint,
  (SELECT ok FROM g_noref)                    AS g_noref,
  (SELECT ok FROM g_preflight)                AS g_preflight,
  (SELECT count(*) FROM clean_upd)            AS clean_email_updated,
  (SELECT count(*) FROM conn_re_recipient)
    + (SELECT count(*) FROM conn_re_requester) AS conn_reassigned,
  (SELECT count(*) FROM conn_del)             AS conn_deleted,
  (SELECT count(*) FROM msg_re_receiver)
    + (SELECT count(*) FROM msg_re_sender)     AS msgs_reassigned,
  (SELECT count(*) FROM company_port)         AS companies_ported,
  (SELECT count(*) FROM del_alumni)           AS alumni_deleted,
  (SELECT count(*) FROM del_users)            AS users_deleted,
  (SELECT count(*) FROM users  WHERE email LIKE '%placeholder%' OR email LIKE '%@student.tks.com') AS users_still_dummy,   -- pre-write snapshot
  (SELECT count(*) FROM alumni WHERE email LIKE '%placeholder%' OR email LIKE '%@student.tks.com') AS alumni_still_dummy;  -- run _verify.sql after to confirm ${EXPECT_STILL_DUMMY_AFTER}
`;
}

function buildReport(merges: Merge[]): string {
  const header =
    "placeholder_username,placeholder_email,placeholder_user_id,real_username,real_email,real_user_id,conn_reassigned,conn_deleted,msgs_reassigned,company_ported";
  const cell = (s: unknown) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const lines = merges
    .sort((a, b) => a.placeholderUsername.localeCompare(b.placeholderUsername))
    .map((m) =>
      [
        m.placeholderUsername,
        m.placeholderEmail,
        m.placeholderUserId,
        m.realUsername,
        m.newEmail,
        m.realUserId,
        m.connReassign.length,
        m.connDelete.length,
        m.msgReassign.length,
        m.portCompany ?? "",
      ]
        .map(cell)
        .join(","),
    );
  return [header, ...lines].join("\n") + "\n";
}

function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log(" Dup-Account Merge: SQL Generator");
  console.log("═══════════════════════════════════════════════════════════\n");

  const { sql, reportCsv, precheck } = build();
  const t = precheck.totals;
  console.log(`   merges (placeholders deleted) : ${t.merges}`);
  console.log(`   clean 1-row email update      : ${precheck.clean1RowUpdate.length}`);
  console.log(`   connection_requests reassigned: ${t.connReassign}`);
  console.log(`   connection_requests deleted   : ${t.connDelete}`);
  console.log(`   messages reassigned           : ${t.msgReassign}`);
  console.log(`   company fields ported         : ${t.companyPorts}`);
  console.log(`\n   After run, still-dummy rows   : ${EXPECT_STILL_DUMMY_AFTER}\n`);

  const merges = precheck.merges;
  const phSample = merges[0]?.placeholderUsername ?? "";
  const realSample = merges[0]?.realUsername ?? "";
  const verifySql = `-- Post-run verification for dup_account_merge_${DATE_STR}.sql. Run AFTER the merge.
SELECT
  (SELECT count(*) FROM users  WHERE email LIKE '%placeholder%' OR email LIKE '%@student.tks.com') AS users_still_dummy,   -- expect ${EXPECT_STILL_DUMMY_AFTER}
  (SELECT count(*) FROM alumni WHERE email LIKE '%placeholder%' OR email LIKE '%@student.tks.com') AS alumni_still_dummy,  -- expect ${EXPECT_STILL_DUMMY_AFTER}
  (SELECT count(*) FROM connection_requests c LEFT JOIN users u ON u.id = c.recipient_id WHERE u.id IS NULL) AS orphan_conn_recipient,  -- expect 0
  (SELECT count(*) FROM connection_requests c LEFT JOIN users u ON u.id = c.requester_id WHERE u.id IS NULL) AS orphan_conn_requester,  -- expect 0
  (SELECT count(*) FROM messages m LEFT JOIN users u ON u.id = m.receiver_id WHERE u.id IS NULL) AS orphan_msg_receiver,  -- expect 0
  (SELECT count(*) FROM users WHERE username = '${phSample}') AS sample_placeholder_gone,  -- expect 0
  (SELECT email FROM users WHERE username = '${realSample}') AS sample_real_email;  -- unchanged real email
`;
  const VERIFY_OUT = resolve(ROOT, `migrations/dup_account_merge_${DATE_STR}_verify.sql`);

  mkdirSync(dirname(SQL_OUT), { recursive: true });
  mkdirSync(dirname(REPORT_OUT), { recursive: true });
  writeFileSync(SQL_OUT, sql);
  writeFileSync(REPORT_OUT, reportCsv);
  writeFileSync(VERIFY_OUT, verifySql);
  console.log(`✅  Wrote:\n   ${SQL_OUT}\n   ${VERIFY_OUT}\n   ${REPORT_OUT}`);
  console.log(`\nRun the SQL (one atomic statement) in the Supabase editor, then run _verify.sql.`);
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]).endsWith("dup-account-merge.ts");
if (isDirectRun) main();
