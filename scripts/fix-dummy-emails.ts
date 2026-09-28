/**
 * Fix Dummy Alumni Emails — SQL Generator
 * ------------------------------------------------------------
 * Usage:
 *   npx tsx scripts/fix-dummy-emails.ts
 *
 * Reads three spreadsheets (NO database access) and emits:
 *   - migrations/fix_dummy_emails_<date>.sql   (guarded + transactional)
 *   - scripts/out/fix-dummy-emails-report.csv  (every row NOT updated, with reason)
 *
 * See C:\Users\vansh\.claude\plans\analyse-closely-we-scanned-jiggly-sky.md for the full plan.
 *
 * Inputs (repo root):
 *   Dummy Email Alumnis.xlsx          — the "updated" sheet. `Email (dummy)` column now holds the
 *                                       REAL email. Key columns (Alumni ID / User ID / Roll Number)
 *                                       were dropped; only `Username` survives as a join key.
 *   dummy-email-alumni-2026-08-11.xlsx — original export; has User ID / Alumni ID / old dummy email.
 *   all-alumni-2026-08-11.xlsx         — full 1,539-row snapshot; validation only.
 */

import { writeFileSync, mkdirSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import * as XLSX from "xlsx";

// ── Paths ─────────────────────────────────────────────────────────────────────
const ROOT = process.cwd();
const UPDATED_XLSX = resolve(ROOT, "Dummy Email Alumnis.xlsx");
const ORIGINAL_XLSX = resolve(ROOT, "dummy-email-alumni-2026-08-11.xlsx");
const FULL_XLSX = resolve(ROOT, "all-alumni-2026-08-11.xlsx");

const DATE_STR = "2026-09-04";
const SQL_OUT = resolve(ROOT, `migrations/fix_dummy_emails_${DATE_STR}.sql`);
const REPORT_OUT = resolve(ROOT, "scripts/out/fix-dummy-emails-report.csv");
const PRECHECK_IN = resolve(ROOT, "scripts/out/fix-dummy-emails-precheck.json");

const TARGET_PROJECT = "aikvtpqqxasdctchtgct"; // PROD Supabase project ref

// Bucket counts — hard-asserted. If the sheet OR live DB changes, these must be re-reviewed.
//   sheet classification (offline):  update-eligible 504 / dup 177 / del 14 / stillDummy 10 / blank 1
//   live split of the 504-eligible:  clean 323  +  dupAccount 181   (from the precheck file;
//     dupAccount = new email already held by another users OR alumni row)
const EXPECT = {
  updateEligible: 504,
  clean: 323,
  dupAccount: 181,
  dup: 177,
  del: 14,
  stillDummy: 10,
  blankInvalid: 1,
} as const;
const EXPECT_SHEET_ROWS = 706;
const EXPECT_ORIGINAL_ROWS = 711;
// still-dummy after run = 711 − 323 (updated) − 14 (deleted)
//                       = 177 dup + 10 stillDummy + 1 blank + 5 not-in-sheet + 181 dupAccount
const EXPECT_STILL_DUMMY_AFTER = 374;

// ── Helpers (inlined from server/utils/input-sanitization.ts) ──────────────────
function sanitizeEmail(email: unknown): string {
  if (!email) return "";
  return String(email).trim().toLowerCase();
}
function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim());
}
function isDummyEmail(email: string): boolean {
  if (!email || !email.includes("@")) return false;
  const domain = email.toLowerCase().split("@")[1] ?? "";
  return domain.includes("tks.com") || domain.includes("placeholder");
}
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DELETE_MARKER_RE = /\b(pls\s*)?(to\s*be\s*)?delet/i;

function sqlEscape(s: string): string {
  return s.replace(/'/g, "''");
}
function normUser(u: unknown): string {
  return String(u ?? "").trim().toLowerCase();
}

// ── Types ─────────────────────────────────────────────────────────────────────
// "update"     = clean, gets an email UPDATE in the emitted SQL
// "dupAccount" = new email already belongs to a self-registered account (from live precheck);
//                skip here, handled by the separate dup-account merge plan
type Bucket = "update" | "dupAccount" | "dup" | "del" | "stillDummy" | "blankInvalid";

interface OriginalRow {
  userId: string;
  alumniId: string;
  oldEmail: string;
  username: string;
}
interface Classified {
  username: string;
  name: string;
  userId: string;
  alumniId: string;
  oldEmail: string;
  newEmail: string;
  bucket: Bucket;
  reason: string;
}

// ── Pure classifier (unit-tested) ─────────────────────────────────────────────
/**
 * Classify a single updated-sheet row.
 * @param row        raw row from the updated sheet (needs Username, Email (dummy), Branch, Course)
 * @param orig       matched original-export row (userId/alumniId/oldEmail) or undefined
 * @param dupEmails  set of normalized emails that appear on >1 update-eligible row
 * @param dupAccountUserIds  userIds whose new email already belongs to a self-registered account
 *                           (from the live precheck file) — routed to the "dupAccount" bucket
 */
export function classifyRow(
  row: Record<string, unknown>,
  orig: OriginalRow | undefined,
  dupEmails: Set<string>,
  dupAccountUserIds: Set<string> = new Set(),
): Omit<Classified, "name"> {
  const username = normUser(row["Username"]);
  const newEmail = sanitizeEmail(row["Email (dummy)"]);
  const branch = String(row["Branch"] ?? "");
  const course = String(row["Course"] ?? "");
  const base = {
    username,
    userId: orig?.userId ?? "",
    alumniId: orig?.alumniId ?? "",
    oldEmail: orig?.oldEmail ?? "",
    newEmail,
  };

  if (DELETE_MARKER_RE.test(branch) || DELETE_MARKER_RE.test(course)) {
    return { ...base, bucket: "del", reason: "flagged for deletion in Branch/Course cell" };
  }
  if (!newEmail) {
    return { ...base, bucket: "blankInvalid", reason: "blank email" };
  }
  if (isDummyEmail(newEmail)) {
    return { ...base, bucket: "stillDummy", reason: "email still a placeholder/dummy" };
  }
  if (!isValidEmail(newEmail)) {
    return { ...base, bucket: "blankInvalid", reason: `invalid email format: ${newEmail}` };
  }
  if (dupEmails.has(newEmail)) {
    return { ...base, bucket: "dup", reason: "email shared with >=1 other sheet row (UNIQUE)" };
  }
  if (base.userId && dupAccountUserIds.has(base.userId)) {
    return {
      ...base,
      bucket: "dupAccount",
      reason: "owner already has a self-registered account with this email — see dup-account merge plan",
    };
  }
  return { ...base, bucket: "update", reason: "" };
}

// ── Load + classify (used by generator and golden test) ───────────────────────
export interface BuildResult {
  classified: Classified[];
  counts: Record<Bucket, number>;
  sql: string;
  reportCsv: string;
}

export function build(paths?: {
  updated?: string;
  original?: string;
  full?: string;
  precheck?: string;
}): BuildResult {
  const updatedPath = paths?.updated ?? UPDATED_XLSX;
  const originalPath = paths?.original ?? ORIGINAL_XLSX;
  const fullPath = paths?.full ?? FULL_XLSX;

  const readSheet = (p: string): Record<string, unknown>[] => {
    // Read bytes ourselves — the ESM xlsx.mjs fs shim rejects paths with spaces / OneDrive dirs.
    const wb = XLSX.read(readFileSync(p), { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(ws, { defval: "", blankrows: false });
  };

  const updated = readSheet(updatedPath);
  const original = readSheet(originalPath);
  const full = readSheet(fullPath);

  assert(updated.length === EXPECT_SHEET_ROWS, `updated sheet has ${updated.length} rows, expected ${EXPECT_SHEET_ROWS}`);
  assert(original.length === EXPECT_ORIGINAL_ROWS, `original export has ${original.length} rows, expected ${EXPECT_ORIGINAL_ROWS}`);

  // Map username -> original row (assert 1:1)
  const origByUser = new Map<string, OriginalRow>();
  for (const r of original) {
    const u = normUser(r["Username"]);
    assert(!origByUser.has(u), `duplicate username in original export: ${u}`);
    origByUser.set(u, {
      userId: String(r["User ID"] ?? "").trim(),
      alumniId: String(r["Alumni ID"] ?? "").trim(),
      oldEmail: sanitizeEmail(r["Email (dummy)"]),
      username: u,
    });
  }

  // Assertion 2: every updated username resolves to exactly one original row
  const unmatched = updated.filter((r) => !origByUser.has(normUser(r["Username"])));
  assert(unmatched.length === 0, `${unmatched.length} updated rows have no matching original row (by username)`);

  // Pre-pass: which normalized emails appear on >1 row that would otherwise be update-eligible
  // (exclude delete-flagged / still-dummy / blank rows from the dup tally so a shared placeholder
  //  doesn't spuriously mark a real email as a dup)
  const emailFreq = new Map<string, number>();
  for (const r of updated) {
    const branch = String(r["Branch"] ?? "");
    const course = String(r["Course"] ?? "");
    if (DELETE_MARKER_RE.test(branch) || DELETE_MARKER_RE.test(course)) continue;
    const e = sanitizeEmail(r["Email (dummy)"]);
    if (!e || isDummyEmail(e) || !isValidEmail(e)) continue;
    emailFreq.set(e, (emailFreq.get(e) ?? 0) + 1);
  }
  const dupEmails = new Set([...emailFreq.entries()].filter(([, n]) => n > 1).map(([e]) => e));

  // ── Live precheck: which of the update-eligible rows are clean vs dup-account ──
  // Produced by `npx tsx scripts/fix-dummy-emails-precheck.ts` against PROD (read-only).
  let precheck: {
    cleanUserIds: string[];
    dupAccountUserIds: string[];
    target?: string;
    generatedAt?: string;
  };
  try {
    precheck = JSON.parse(readFileSync(paths?.precheck ?? PRECHECK_IN, "utf8"));
  } catch {
    assert(false, `missing ${PRECHECK_IN} — run: npx tsx scripts/fix-dummy-emails-precheck.ts`);
    throw new Error("unreachable");
  }
  const dupAccountUserIds = new Set(precheck.dupAccountUserIds);
  const cleanUserIds = new Set(precheck.cleanUserIds);
  assert(
    dupAccountUserIds.size === EXPECT.dupAccount,
    `precheck dupAccountUserIds ${dupAccountUserIds.size} != ${EXPECT.dupAccount} — DB changed, re-review`,
  );
  assert(
    cleanUserIds.size === EXPECT.clean,
    `precheck cleanUserIds ${cleanUserIds.size} != ${EXPECT.clean} — DB changed, re-review`,
  );

  // Classify
  const classified: Classified[] = updated.map((r) => {
    const u = normUser(r["Username"]);
    const orig = origByUser.get(u);
    const c = classifyRow(r, orig, dupEmails, dupAccountUserIds);
    const name = [r["First Name"], r["Last Name"]].map((x) => String(x ?? "").trim()).filter(Boolean).join(" ");
    return { ...c, name };
  });

  const counts: Record<Bucket, number> = {
    update: 0, dupAccount: 0, dup: 0, del: 0, stillDummy: 0, blankInvalid: 0,
  };
  for (const c of classified) counts[c.bucket]++;

  // Assertion 3: buckets sum to sheet rows, and match expected counts
  const sum =
    counts.update + counts.dupAccount + counts.dup + counts.del + counts.stillDummy + counts.blankInvalid;
  assert(sum === EXPECT_SHEET_ROWS, `bucket sum ${sum} != ${EXPECT_SHEET_ROWS}`);
  assert(counts.update === EXPECT.clean, `update bucket ${counts.update} != ${EXPECT.clean} — sheet/DB changed`);
  assert(counts.dupAccount === EXPECT.dupAccount, `dupAccount bucket ${counts.dupAccount} != ${EXPECT.dupAccount}`);
  assert(counts.update + counts.dupAccount === EXPECT.updateEligible, `clean+dupAccount != ${EXPECT.updateEligible}`);
  assert(counts.dup === EXPECT.dup, `dup bucket ${counts.dup} != ${EXPECT.dup} — sheet changed, re-review`);
  assert(counts.del === EXPECT.del, `del bucket ${counts.del} != ${EXPECT.del} — sheet changed, re-review`);
  assert(counts.stillDummy === EXPECT.stillDummy, `stillDummy bucket ${counts.stillDummy} != ${EXPECT.stillDummy}`);
  assert(counts.blankInvalid === EXPECT.blankInvalid, `blankInvalid bucket ${counts.blankInvalid} != ${EXPECT.blankInvalid}`);

  const updates = classified.filter((c) => c.bucket === "update");
  const deletes = classified.filter((c) => c.bucket === "del");
  const dupRows = classified.filter((c) => c.bucket === "dup");

  // Assertion 4: every update userId is a well-formed distinct UUID present in precheck.cleanUserIds
  const updIds = new Set<string>();
  for (const c of updates) {
    assert(UUID_RE.test(c.userId), `update row ${c.username} has non-UUID userId: "${c.userId}"`);
    assert(!updIds.has(c.userId), `update userId appears twice: ${c.userId}`);
    assert(cleanUserIds.has(c.userId), `update row ${c.username} userId not in precheck cleanUserIds`);
    assert(!dupAccountUserIds.has(c.userId), `update row ${c.username} userId is in dupAccountUserIds`);
    updIds.add(c.userId);
  }
  assert(updIds.size === EXPECT.clean, `distinct update userIds ${updIds.size} != ${EXPECT.clean}`);

  // Assertion 5: every update newEmail valid, non-dummy, unique across updates, not a sheet-dup email
  const updEmails = new Set<string>();
  const dupEmailSet = new Set(dupRows.map((c) => c.newEmail));
  for (const c of updates) {
    assert(isValidEmail(c.newEmail), `update row ${c.username} invalid email: ${c.newEmail}`);
    assert(!isDummyEmail(c.newEmail), `update row ${c.username} still dummy: ${c.newEmail}`);
    assert(!updEmails.has(c.newEmail), `update newEmail not unique: ${c.newEmail}`);
    assert(!dupEmailSet.has(c.newEmail), `update newEmail collides with a dup-bucket email: ${c.newEmail}`);
    updEmails.add(c.newEmail);
  }

  // Assertion 6: no userId shared between update / delete / dupAccount sets
  const delIds = new Set(deletes.map((c) => c.userId));
  const dupAcctIds = new Set(classified.filter((c) => c.bucket === "dupAccount").map((c) => c.userId));
  for (const id of delIds) {
    assert(!updIds.has(id), `userId in both update and delete: ${id}`);
    assert(!dupAcctIds.has(id), `userId in both dupAccount and delete: ${id}`);
  }
  assert(dupAcctIds.size === EXPECT.dupAccount, `distinct dupAccount userIds ${dupAcctIds.size} != ${EXPECT.dupAccount}`);

  // Assertion 7: delete userIds present in original export and still dummy in the full snapshot
  assert(delIds.size === EXPECT.del, `distinct delete userIds ${delIds.size} != ${EXPECT.del}`);
  const fullByUser = new Map(full.map((r) => [normUser(r["Username"]), r] as const));
  for (const c of deletes) {
    assert(UUID_RE.test(c.userId), `delete row ${c.username} has non-UUID userId: "${c.userId}"`);
    const fr = fullByUser.get(c.username);
    assert(!!fr, `delete row ${c.username} not found in full snapshot`);
    assert(isDummyEmail(sanitizeEmail(fr!["Email"])), `delete row ${c.username} not on a dummy email in snapshot`);
  }

  // Assertion 8: "still dummy after run" derived two ways, both == expected
  //   updated  = counts.update (324),  deleted = counts.del (14)
  const derivedA = EXPECT_ORIGINAL_ROWS - counts.update - counts.del;
  const notInSheet = EXPECT_ORIGINAL_ROWS - EXPECT_SHEET_ROWS; // 5
  const derivedB =
    counts.dupAccount + counts.dup + counts.stillDummy + counts.blankInvalid + notInSheet;
  assert(derivedA === EXPECT_STILL_DUMMY_AFTER, `derivedA ${derivedA} != ${EXPECT_STILL_DUMMY_AFTER}`);
  assert(derivedB === EXPECT_STILL_DUMMY_AFTER, `derivedB ${derivedB} != ${EXPECT_STILL_DUMMY_AFTER}`);

  const sql = buildSql(updates, deletes);
  const reportCsv = buildReport(classified);

  return { classified, counts, sql, reportCsv };
}

// ── SQL builder ───────────────────────────────────────────────────────────────
// The Supabase SQL editor runs each ";"-terminated statement in isolation — temp tables
// vanish between statements, BEGIN/COMMIT don't span. So the migration is TWO independent
// single-statement WITH-chains (A: email updates, B: deletes). Each is atomic: it applies
// completely or errors and changes nothing. Guards are CTEs that divide by zero (aborting
// the whole statement) if a precondition fails. Run A, check its result row, then run B.
export function buildSql(updates: Classified[], deletes: Classified[]): string {
  const emailValues = updates
    .map((c) => `    ('${c.userId}', '${sqlEscape(c.newEmail)}')`)
    .join(",\n");
  const delValues = deletes.map((c) => `    ('${c.userId}')`).join(",\n");

  const statementA = `-- =====================  STATEMENT A — ${updates.length} EMAIL UPDATES  =====================
-- One atomic statement. On success the result row reads:
--   guard_dummy=1  guard_users=1  guard_alumni=1
--   users_updated=${updates.length}  alumni_updated=${updates.length}
-- Any ERROR (e.g. "division by zero" from a guard) => nothing changed.
WITH
_email_fix (user_id, new_email) AS (VALUES
${emailValues}
),
guard_dummy AS (            -- every target is currently on a dummy email
  SELECT (1 / (1 - LEAST(1, count(*))))::int AS ok
    FROM _email_fix f JOIN users u ON u.id = f.user_id
   WHERE u.email NOT LIKE '%placeholder%' AND u.email NOT LIKE '%@student.tks.com'
),
guard_users AS (            -- no new email already on a DIFFERENT users row
  SELECT (1 / (1 - LEAST(1, count(*))))::int AS ok
    FROM _email_fix f JOIN users u ON lower(u.email) = f.new_email AND u.id <> f.user_id
),
guard_alumni AS (           -- no new email already on a DIFFERENT alumni row
  SELECT (1 / (1 - LEAST(1, count(*))))::int AS ok
    FROM _email_fix f JOIN alumni a ON lower(a.email) = f.new_email AND a.user_id <> f.user_id
),
upd_users AS (
  UPDATE users u SET email = f.new_email, updated_at = now()
    FROM _email_fix f
   WHERE u.id = f.user_id
     AND (SELECT ok FROM guard_dummy) = 1
     AND (SELECT ok FROM guard_users) = 1
     AND (SELECT ok FROM guard_alumni) = 1
  RETURNING 1
),
upd_alumni AS (
  UPDATE alumni a SET email = f.new_email, updated_at = now()
    FROM _email_fix f
   WHERE a.user_id = f.user_id
     AND (SELECT ok FROM guard_dummy) = 1
     AND (SELECT ok FROM guard_users) = 1
     AND (SELECT ok FROM guard_alumni) = 1
  RETURNING 1
)
SELECT
  (SELECT ok FROM guard_dummy)      AS guard_dummy,
  (SELECT ok FROM guard_users)      AS guard_users,
  (SELECT ok FROM guard_alumni)     AS guard_alumni,
  (SELECT count(*) FROM upd_users)  AS users_updated,
  (SELECT count(*) FROM upd_alumni) AS alumni_updated;`;

  const statementB = `-- =====================  STATEMENT B — ${deletes.length} HARD-DELETES  =====================
-- Run this ONLY after Statement A succeeded. One atomic statement. On success:
--   guard_preflight=1  conn_cleared=<0+>  alumni_deleted=${deletes.length}  users_deleted=${deletes.length}
WITH
_del_users (user_id) AS (VALUES
${delValues}
),
guard_preflight AS (        -- no blocking child row for the ${deletes.length} deletes, EXCLUDING
                            -- connection_requests (conn_clear removes those first)
  SELECT (1 / (1 - LEAST(1,
       (SELECT count(*) FROM feed_posts      WHERE author_id    IN (SELECT user_id FROM _del_users))
     + (SELECT count(*) FROM user_blocks     WHERE blocker_id   IN (SELECT user_id FROM _del_users) OR blocked_id IN (SELECT user_id FROM _del_users))
     + (SELECT count(*) FROM events          WHERE organized_by IN (SELECT user_id FROM _del_users))
     + (SELECT count(*) FROM signup_requests WHERE reviewed_by  IN (SELECT user_id FROM _del_users))
     )))::int AS ok
),
conn_clear AS (
  DELETE FROM connection_requests
   WHERE (requester_id IN (SELECT user_id FROM _del_users) OR recipient_id IN (SELECT user_id FROM _del_users))
     AND (SELECT ok FROM guard_preflight) = 1
  RETURNING 1
),
del_alumni AS (
  DELETE FROM alumni
   WHERE user_id IN (SELECT user_id FROM _del_users)
     AND (SELECT ok FROM guard_preflight) = 1
     AND (SELECT count(*) FROM conn_clear) >= 0   -- force conn_clear to run first
  RETURNING 1
),
del_users AS (
  DELETE FROM users
   WHERE id IN (SELECT user_id FROM _del_users)
     AND (SELECT ok FROM guard_preflight) = 1
     AND (SELECT count(*) FROM del_alumni) >= 0   -- force del_alumni to run first
  RETURNING 1
)
SELECT
  (SELECT ok FROM guard_preflight)  AS guard_preflight,
  (SELECT count(*) FROM conn_clear) AS conn_cleared,
  (SELECT count(*) FROM del_alumni) AS alumni_deleted,
  (SELECT count(*) FROM del_users)  AS users_deleted;`;

  return `-- ============================================================================
-- Fix dummy alumni emails -> real emails   |   TARGET: Supabase project ${TARGET_PROJECT} (PROD)
-- Generated ${DATE_STR} by scripts/fix-dummy-emails.ts from "Dummy Email Alumnis.xlsx".
--
-- TWO statements below (A then B). The Supabase editor's "Run" executes the whole file
-- but treats A and B as separate statements — that's fine, each is self-contained and
-- atomic. Recommended: run A alone first (select it + "Run selection", or run the file
-- and read the FIRST result), confirm users_updated=${updates.length}, then run B.
--
-- ${updates.length} email updates, ${deletes.length} hard-deletes.
-- After both: still-dummy count should be ${EXPECT_STILL_DUMMY_AFTER}
--   (${EXPECT.dupAccount} dup-account + ${EXPECT.dup} dup-skip + ${EXPECT.stillDummy} still-dummy + ${EXPECT.blankInvalid} blank + 5 not-in-sheet).
--   Run fix_dummy_emails_${DATE_STR}_verify.sql afterwards to check.
-- ============================================================================

${statementA}


${statementB}
`;
}

// ── Report builder ────────────────────────────────────────────────────────────
function buildReport(classified: Classified[]): string {
  const header = "username,name,user_id,alumni_id,old_email,new_email,bucket,reason";
  const csvCell = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
  const lines = classified
    .filter((c) => c.bucket !== "update")
    .sort((a, b) => a.bucket.localeCompare(b.bucket) || a.username.localeCompare(b.username))
    .map((c) =>
      [c.username, c.name, c.userId, c.alumniId, c.oldEmail, c.newEmail, c.bucket, c.reason]
        .map(csvCell)
        .join(","),
    );
  return [header, ...lines].join("\n") + "\n";
}

// ── assert helper ─────────────────────────────────────────────────────────────
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error(`\n❌  ASSERTION FAILED: ${msg}\n    No files were written.`);
    process.exit(1);
  }
}

// ── main ──────────────────────────────────────────────────────────────────────
function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log(" TKS Alumni Portal – Dummy Email Fix: SQL Generator");
  console.log("═══════════════════════════════════════════════════════════\n");

  const { counts, sql, reportCsv, classified } = build();

  console.log("Bucket counts:");
  console.log(`   UPDATE (real email applied)      : ${counts.update}`);
  console.log(`   DUP-ACCOUNT (owner self-registered) : ${counts.dupAccount}  → dup-account merge plan`);
  console.log(`   DUP-skip (email reused in sheet) : ${counts.dup}`);
  console.log(`   DELETE-marked (hard delete)      : ${counts.del}`);
  console.log(`   still-dummy (not filled in)      : ${counts.stillDummy}`);
  console.log(`   blank / invalid                 : ${counts.blankInvalid}`);
  console.log(`   ── total sheet rows             : ${classified.length}`);
  console.log(`   not in sheet (untouched)        : ${EXPECT_ORIGINAL_ROWS - EXPECT_SHEET_ROWS}`);
  console.log(`\n   After run, still-dummy rows      : ${EXPECT_STILL_DUMMY_AFTER} (SQL verify target)\n`);

  const verifySql = `-- Post-run verification for fix_dummy_emails_${DATE_STR}.sql
-- Run this AFTER the migration. Every check should pass.
SELECT
  (SELECT count(*) FROM users  WHERE email LIKE '%placeholder%' OR email LIKE '%@student.tks.com') AS users_still_dummy,   -- expect ${EXPECT_STILL_DUMMY_AFTER}
  (SELECT count(*) FROM alumni WHERE email LIKE '%placeholder%' OR email LIKE '%@student.tks.com') AS alumni_still_dummy,  -- expect ${EXPECT_STILL_DUMMY_AFTER}
  (SELECT count(*) FROM users u JOIN alumni a ON a.user_id = u.id WHERE lower(u.email) <> lower(a.email)) AS email_mismatches,  -- expect 3 (pre-existing, unrelated)
  (SELECT count(*) FROM users WHERE username IN (
     'peter.ekka','ruhaan.jagota','soham.grover','sriha.maitra','s.sss','amulya.jain','rajeswari.b',
     'ruth.data','astha.joshi','anju.shibu','hiten.khatri','arnav.patil','evya.gupta','shubhu.mutta'
   )) AS deleted_accounts_remaining;  -- expect 0
`;
  const VERIFY_OUT = resolve(ROOT, `migrations/fix_dummy_emails_${DATE_STR}_verify.sql`);

  mkdirSync(dirname(SQL_OUT), { recursive: true });
  mkdirSync(dirname(REPORT_OUT), { recursive: true });
  writeFileSync(SQL_OUT, sql);
  writeFileSync(REPORT_OUT, reportCsv);
  writeFileSync(VERIFY_OUT, verifySql);

  console.log("✅  Wrote:");
  console.log(`   ${SQL_OUT}`);
  console.log(`   ${VERIFY_OUT}`);
  console.log(`   ${REPORT_OUT}`);
  console.log("\nRun the migration SQL in the Supabase editor (one statement, atomic — RUN once).");
  console.log(`Then run the _verify.sql to confirm ${EXPECT_STILL_DUMMY_AFTER}/${EXPECT_STILL_DUMMY_AFTER} and 0 deleted-accounts-remaining.`);
}

// Only run main when executed directly (not when imported by the test file)
const isDirectRun =
  process.argv[1] && resolve(process.argv[1]).endsWith("fix-dummy-emails.ts");
if (isDirectRun) main();
