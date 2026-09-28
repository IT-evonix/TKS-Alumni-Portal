/**
 * Round-2 apply — SQL generator (offline)
 * ------------------------------------------------------------
 *   npx tsx scripts/round2-apply-merge.ts
 *
 * Reads scripts/out/round2-apply-precheck.json and emits ONE atomic single-statement WITH-chain:
 *   - reassign child rows (connection_requests) from placeholder accounts to their survivor
 *   - apply 10 school-provided emails (users + alumni)
 *   - rename + apply 1 (aishwary.tiwari -> Apekshya Mohanty)
 *   - hard-delete 21 placeholder accounts (alumni then users; sub-tables + notifications cascade)
 *   - 1 account left untouched (nanki.puri -> round 3)
 *
 * Guards abort (division by zero) on any surprise; a successful single statement auto-commits.
 * Emits migrations/round2_apply_2026-09-10.sql and *_verify.sql.
 */

import { writeFileSync, mkdirSync, readFileSync } from "fs";
import { resolve, dirname } from "path";

const ROOT = process.cwd();
const PRECHECK_IN = resolve(ROOT, "scripts/out/round2-apply-precheck.json");
const DATE_STR = "2026-09-10";
const SQL_OUT = resolve(ROOT, `migrations/round2_apply_${DATE_STR}.sql`);
const VERIFY_OUT = resolve(ROOT, `migrations/round2_apply_${DATE_STR}_verify.sql`);
const TARGET_PROJECT = "aikvtpqqxasdctchtgct";

const EXPECT = { applyEmail: 10, rename: 1, delete: 21, keep: 1, connReassign: 4, connDelete: 1 } as const;
// still-dummy 38 now -> 38 - 21 (deleted) - 10 (apply) - 1 (rename) = 6  (5 not-in-sheet + nanki.puri)
const EXPECT_STILL_DUMMY_AFTER = 6;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sqlEsc = (s: string) => s.replace(/'/g, "''");

interface Plan {
  sr: number; username: string; name: string; grad: unknown;
  userId: string; alumniId: string; currentEmail: string;
  action: "apply_email" | "rename_and_apply" | "delete" | "keep_round3";
  newEmail?: string; newFirstName?: string; newLastName?: string;
  childTargetUserId?: string; deleteChildRows?: boolean; note: string;
}
interface Precheck {
  plans: Plan[];
  childRows: { connReassign: string[]; connDelete: string[]; msgReassign: string[]; msgDelete: string[]; targetByDrop: Record<string, string> };
  blockers: Record<string, number>;
  problems: string[];
}

function assert(c: unknown, m: string): asserts c {
  if (!c) { console.error(`\n❌  ASSERTION FAILED: ${m}\n    No files written.`); process.exit(1); }
}

export function build(precheckPath = PRECHECK_IN): { sql: string; verifySql: string; precheck: Precheck } {
  let pc: Precheck;
  try { pc = JSON.parse(readFileSync(precheckPath, "utf8")); }
  catch { assert(false, `missing ${precheckPath} — run: npx tsx scripts/round2-apply-precheck.ts`); throw new Error("x"); }

  assert(pc.problems.length === 0, `precheck has ${pc.problems.length} problems — resolve first`);

  const apply = pc.plans.filter((p) => p.action === "apply_email");
  const rename = pc.plans.filter((p) => p.action === "rename_and_apply");
  const del = pc.plans.filter((p) => p.action === "delete");
  const keep = pc.plans.filter((p) => p.action === "keep_round3");
  assert(apply.length === EXPECT.applyEmail, `apply ${apply.length} != ${EXPECT.applyEmail}`);
  assert(rename.length === EXPECT.rename, `rename ${rename.length} != ${EXPECT.rename}`);
  assert(del.length === EXPECT.delete, `delete ${del.length} != ${EXPECT.delete}`);
  assert(keep.length === EXPECT.keep, `keep ${keep.length} != ${EXPECT.keep}`);

  const emailApply = [...apply, ...rename];
  const emails = emailApply.map((p) => (p.newEmail ?? "").toLowerCase());
  assert(new Set(emails).size === emails.length, "duplicate emails across apply+rename");
  for (const p of emailApply) {
    assert(UUID_RE.test(p.userId), `bad uuid ${p.username}`);
    assert(!!p.newEmail && !/placeholder|@student\.tks\.com/.test(p.newEmail), `${p.username}: bad newEmail`);
  }
  const delIds = new Set(del.map((p) => p.userId));
  for (const p of del) assert(UUID_RE.test(p.userId), `bad delete uuid ${p.username}`);
  for (const p of emailApply) assert(!delIds.has(p.userId), `${p.username}: both apply and delete`);
  // child targets must not be in the delete set
  for (const [drop, tgt] of Object.entries(pc.childRows.targetByDrop)) {
    assert(delIds.has(drop), `targetByDrop key ${drop} not a delete`);
    assert(!delIds.has(tgt), `child target ${tgt} is itself being deleted`);
  }
  const { connReassign, connDelete } = pc.childRows;
  assert(connReassign.length === EXPECT.connReassign, `connReassign ${connReassign.length} != ${EXPECT.connReassign}`);
  assert(connDelete.length === EXPECT.connDelete, `connDelete ${connDelete.length} != ${EXPECT.connDelete}`);
  const crSet = new Set(connReassign);
  for (const id of connDelete) assert(!crSet.has(id), `conn ${id} in both reassign and delete`);
  // preflight blockers all zero
  for (const [k, v] of Object.entries(pc.blockers)) assert(v === 0, `preflight blocker ${k} = ${v}`);

  const sql = buildSql(emailApply, del, pc.childRows.targetByDrop, connReassign, connDelete);
  const verifySql = buildVerify(pc);
  return { sql, verifySql, precheck: pc };
}

export function buildSql(
  emailApply: Plan[],
  del: Plan[],
  targetByDrop: Record<string, string>,
  connReassign: string[],
  connDelete: string[],
): string {
  const NONE = "00000000-0000-0000-0000-000000000000";
  // _email: (user_id, new_email, new_first, new_last)   new_first/last NULL unless rename
  const emailVals = emailApply
    .map((p) => `    ('${p.userId}', '${sqlEsc(p.newEmail!)}', ${p.newFirstName ? `'${sqlEsc(p.newFirstName)}'` : "NULL"}, ${p.newLastName ? `'${sqlEsc(p.newLastName)}'` : "NULL"})`)
    .join(",\n");
  // _drop: (id, child_target)   child_target NONE when child rows are just deleted
  const dropVals = del
    .map((p) => `    ('${p.userId}', '${targetByDrop[p.userId] ?? NONE}')`)
    .join(",\n");
  const idRows = (ids: string[]) => (ids.length ? ids : [NONE]).map((i) => `    ('${i}')`).join(",\n");

  return `-- ============================================================================
-- Round-2 apply (school-returned "Copy of Pending Students.xlsx")
-- TARGET: Supabase project ${TARGET_PROJECT} (PROD)   |   Generated ${DATE_STR}
--
-- ONE atomic statement (WITH-chain). Applies fully and auto-commits, or errors and changes
-- nothing. Guards compute 1/(1-LEAST(1,<bad>)) -> 1 when clean, else division-by-zero.
--
-- ${emailApply.length} emails applied (1 of them also renames aishwary.tiwari -> Apekshya Mohanty).
-- ${del.length} placeholder accounts deleted; ${connReassign.length} connection_requests reassigned to the
-- surviving account, ${connDelete.length} connection_request deleted. 1 account (nanki.puri) left for round 3.
--
-- On SUCCESS: g_apply_dummy=1 g_email_free=1 g_drops_dummy=1 g_targets_ok=1 g_disjoint=1 g_preflight=1
--   conn_reassigned=${connReassign.length} conn_deleted=${connDelete.length}
--   emails_applied_users=${emailApply.length} emails_applied_alumni=${emailApply.length} renamed=1
--   alumni_deleted=${del.length} users_deleted=${del.length}
-- Then run round2_apply_${DATE_STR}_verify.sql -> expect still-dummy ${EXPECT_STILL_DUMMY_AFTER}.
-- ============================================================================
WITH
_email (user_id, new_email, new_first, new_last) AS (VALUES
${emailVals}
),
_drop (id, child_target) AS (VALUES
${dropVals}
),
_conn_reassign (id) AS (VALUES
${idRows(connReassign)}
),
_conn_delete (id) AS (VALUES
${idRows(connDelete)}
),

-- ---- guards ----
g_apply_dummy AS (         -- every account we're applying an email to is currently dummy
  SELECT (1 / (1 - LEAST(1, count(*))))::int AS ok
    FROM _email e JOIN users u ON u.id = e.user_id
   WHERE u.email NOT LIKE '%placeholder%' AND u.email NOT LIKE '%@student.tks.com'
),
g_email_free AS (          -- each new email is free on users AND alumni (except its own account)
  SELECT (1 / (1 - LEAST(1,
       (SELECT count(*) FROM _email e JOIN users  u ON lower(u.email) = e.new_email AND u.id      <> e.user_id)
     + (SELECT count(*) FROM _email e JOIN alumni a ON lower(a.email) = e.new_email AND a.user_id <> e.user_id)
     )))::int AS ok
),
g_drops_dummy AS (         -- every account to delete is currently dummy
  SELECT (1 / (1 - LEAST(1, count(*))))::int AS ok
    FROM _drop d JOIN users u ON u.id = d.id
   WHERE u.email NOT LIKE '%placeholder%' AND u.email NOT LIKE '%@student.tks.com'
),
g_targets_ok AS (          -- every child-target account exists, is not blocked, and is NOT itself
                            -- being deleted (a still-dummy target is fine — e.g. nanki.puri, kept for round 3)
  SELECT (1 / (1 - LEAST(1, count(*))))::int AS ok
    FROM (SELECT DISTINCT child_target AS t FROM _drop WHERE child_target <> '${NONE}') x
    LEFT JOIN users u ON u.id = x.t
   WHERE u.id IS NULL OR u.account_blocked OR x.t IN (SELECT id FROM _drop)
),
g_disjoint AS (            -- no connection_request id in both reassign and delete
  SELECT (1 / (1 - LEAST(1, count(*))))::int AS ok
    FROM _conn_reassign r JOIN _conn_delete d ON r.id = d.id
),
g_preflight AS (           -- no blocking child row (no cascade) for the deletes, EXCLUDING conn
  SELECT (1 / (1 - LEAST(1,
       (SELECT count(*) FROM feed_posts      WHERE author_id    IN (SELECT id FROM _drop))
     + (SELECT count(*) FROM user_blocks     WHERE blocker_id   IN (SELECT id FROM _drop) OR blocked_id IN (SELECT id FROM _drop))
     + (SELECT count(*) FROM events          WHERE organized_by IN (SELECT id FROM _drop))
     + (SELECT count(*) FROM signup_requests WHERE reviewed_by  IN (SELECT id FROM _drop))
     + (SELECT count(*) FROM messages        WHERE sender_id    IN (SELECT id FROM _drop) OR receiver_id IN (SELECT id FROM _drop))
     )))::int AS ok
),

-- ---- writes ----
conn_re_req AS (
  UPDATE connection_requests c SET requester_id = d.child_target, updated_at = now()
    FROM _drop d
   WHERE c.requester_id = d.id AND d.child_target <> '${NONE}' AND c.id IN (SELECT id FROM _conn_reassign)
     AND (SELECT ok FROM g_drops_dummy) = 1 AND (SELECT ok FROM g_targets_ok) = 1 AND (SELECT ok FROM g_disjoint) = 1
  RETURNING 1
),
conn_re_rec AS (
  UPDATE connection_requests c SET recipient_id = d.child_target, updated_at = now()
    FROM _drop d
   WHERE c.recipient_id = d.id AND d.child_target <> '${NONE}' AND c.id IN (SELECT id FROM _conn_reassign)
     AND (SELECT ok FROM g_drops_dummy) = 1 AND (SELECT ok FROM g_targets_ok) = 1 AND (SELECT ok FROM g_disjoint) = 1
  RETURNING 1
),
conn_del AS (
  DELETE FROM connection_requests WHERE id IN (SELECT id FROM _conn_delete)
     AND (SELECT ok FROM g_disjoint) = 1
  RETURNING 1
),
email_users AS (
  UPDATE users u
     SET email = e.new_email, updated_at = now()
    FROM _email e
   WHERE u.id = e.user_id
     AND (SELECT ok FROM g_apply_dummy) = 1 AND (SELECT ok FROM g_email_free) = 1
  RETURNING 1
),
email_alumni AS (
  UPDATE alumni a
     SET email = e.new_email,
         first_name = COALESCE(e.new_first, a.first_name),
         last_name  = COALESCE(e.new_last,  a.last_name),
         updated_at = now()
    FROM _email e
   WHERE a.user_id = e.user_id
     AND (SELECT ok FROM g_apply_dummy) = 1 AND (SELECT ok FROM g_email_free) = 1
  RETURNING (e.new_first IS NOT NULL) AS renamed
),
del_alumni AS (
  DELETE FROM alumni WHERE user_id IN (SELECT id FROM _drop)
     AND (SELECT ok FROM g_drops_dummy) = 1 AND (SELECT ok FROM g_targets_ok) = 1 AND (SELECT ok FROM g_preflight) = 1
     AND (SELECT count(*) FROM conn_re_req) >= 0
     AND (SELECT count(*) FROM conn_del) >= 0
     AND (SELECT count(*) FROM email_alumni) >= 0
  RETURNING 1
),
del_users AS (
  DELETE FROM users WHERE id IN (SELECT id FROM _drop)
     AND (SELECT ok FROM g_drops_dummy) = 1 AND (SELECT ok FROM g_targets_ok) = 1 AND (SELECT ok FROM g_preflight) = 1
     AND (SELECT count(*) FROM del_alumni) >= 0
     AND (SELECT count(*) FROM email_users) >= 0
  RETURNING 1
)
SELECT
  (SELECT ok FROM g_apply_dummy) AS g_apply_dummy,
  (SELECT ok FROM g_email_free)  AS g_email_free,
  (SELECT ok FROM g_drops_dummy) AS g_drops_dummy,
  (SELECT ok FROM g_targets_ok)  AS g_targets_ok,
  (SELECT ok FROM g_disjoint)    AS g_disjoint,
  (SELECT ok FROM g_preflight)   AS g_preflight,
  (SELECT count(*) FROM conn_re_req) + (SELECT count(*) FROM conn_re_rec) AS conn_reassigned,
  (SELECT count(*) FROM conn_del)      AS conn_deleted,
  (SELECT count(*) FROM email_users)   AS emails_applied_users,
  (SELECT count(*) FROM email_alumni)  AS emails_applied_alumni,
  (SELECT count(*) FROM email_alumni WHERE renamed) AS renamed,
  (SELECT count(*) FROM del_alumni)    AS alumni_deleted,
  (SELECT count(*) FROM del_users)     AS users_deleted;
`;
}

function buildVerify(pc: Precheck): string {
  const del0 = pc.plans.find((p) => p.action === "delete");
  const apply0 = pc.plans.find((p) => p.action === "apply_email");
  const rn = pc.plans.find((p) => p.action === "rename_and_apply");
  return `-- Post-run verification for round2_apply_${DATE_STR}.sql. Run AFTER.
SELECT
  (SELECT count(*) FROM users  WHERE email ILIKE '%placeholder%' OR email ILIKE '%@student.tks.com') AS users_still_dummy,   -- expect ${EXPECT_STILL_DUMMY_AFTER}
  (SELECT count(*) FROM alumni WHERE email ILIKE '%placeholder%' OR email ILIKE '%@student.tks.com') AS alumni_still_dummy,  -- expect ${EXPECT_STILL_DUMMY_AFTER}
  (SELECT count(*) FROM users u JOIN alumni a ON a.user_id=u.id WHERE lower(u.email)<>lower(a.email)) AS email_mismatches,   -- expect 0
  (SELECT count(*) FROM connection_requests c LEFT JOIN users u ON u.id=c.requester_id WHERE u.id IS NULL) AS orphan_conn_req,  -- expect 0
  (SELECT count(*) FROM connection_requests c LEFT JOIN users u ON u.id=c.recipient_id WHERE u.id IS NULL) AS orphan_conn_rec,  -- expect 0
  (SELECT count(*) FROM alumni a LEFT JOIN users u ON u.id=a.user_id WHERE u.id IS NULL) AS orphan_alumni,  -- expect 0
  (SELECT count(*) FROM users WHERE username = '${del0?.username}') AS sample_delete_gone,       -- expect 0
  (SELECT email FROM users WHERE id = '${apply0?.userId}') AS sample_apply_email,                -- expect ${apply0?.newEmail}
  (SELECT first_name || ' ' || last_name || ' <' || email || '>' FROM alumni WHERE user_id = '${rn?.userId}') AS renamed_row;  -- expect Apekshya Mohanty <debarchana.mohanty@rediffmail.com>
`;
}

function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log(" Round-2 Apply: SQL Generator");
  console.log("═══════════════════════════════════════════════════════════\n");
  const { sql, verifySql, precheck } = build();
  const c = precheck as unknown as { plans: Plan[]; childRows: { connReassign: string[]; connDelete: string[] } };
  console.log(`  apply_email       : ${c.plans.filter((p) => p.action === "apply_email").length}`);
  console.log(`  rename_and_apply  : ${c.plans.filter((p) => p.action === "rename_and_apply").length}`);
  console.log(`  delete            : ${c.plans.filter((p) => p.action === "delete").length}`);
  console.log(`  keep (round 3)    : ${c.plans.filter((p) => p.action === "keep_round3").length}`);
  console.log(`  conn reassign/del : ${c.childRows.connReassign.length} / ${c.childRows.connDelete.length}`);
  console.log(`\n  still-dummy after : ${EXPECT_STILL_DUMMY_AFTER}\n`);

  mkdirSync(dirname(SQL_OUT), { recursive: true });
  writeFileSync(SQL_OUT, sql);
  writeFileSync(VERIFY_OUT, verifySql);
  console.log(`✅  Wrote:\n   ${SQL_OUT}\n   ${VERIFY_OUT}`);
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]).endsWith("round2-apply-merge.ts");
if (isDirectRun) main();
