/**
 * Tests for scripts/fix-dummy-emails.ts
 *   npx tsx --test scripts/fix-dummy-emails.test.ts
 *
 * Dependency-free: node:test + node:assert. No test framework is configured in this repo.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { classifyRow, buildSql, build } from "./fix-dummy-emails.ts";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const ORIG = {
  userId: "11111111-1111-4111-8111-111111111111",
  alumniId: "22222222-2222-4222-8222-222222222222",
  oldEmail: "jane.doe@alumni.placeholder.com",
  username: "jane.doe",
};
const row = (o: Record<string, unknown>) => ({
  "First Name": "Jane",
  "Last Name": "Doe",
  Username: "jane.doe",
  "Email (dummy)": "",
  Branch: "",
  Course: "",
  ...o,
});

test("classifyRow: real unique email -> update", () => {
  const c = classifyRow(row({ "Email (dummy)": "Jane.Doe@Gmail.com" }), ORIG, new Set());
  assert.equal(c.bucket, "update");
  assert.equal(c.newEmail, "jane.doe@gmail.com"); // normalized
  assert.equal(c.userId, ORIG.userId);
});

test("classifyRow: still @alumni.placeholder.com -> stillDummy", () => {
  const c = classifyRow(row({ "Email (dummy)": "jane.doe@alumni.placeholder.com" }), ORIG, new Set());
  assert.equal(c.bucket, "stillDummy");
});

test("classifyRow: still @student.tks.com -> stillDummy", () => {
  const c = classifyRow(row({ "Email (dummy)": "12345@student.tks.com" }), ORIG, new Set());
  assert.equal(c.bucket, "stillDummy");
});

test("classifyRow: blank email -> blankInvalid", () => {
  const c = classifyRow(row({ "Email (dummy)": "   " }), ORIG, new Set());
  assert.equal(c.bucket, "blankInvalid");
});

test("classifyRow: malformed email -> blankInvalid", () => {
  const c = classifyRow(row({ "Email (dummy)": "not-an-email" }), ORIG, new Set());
  assert.equal(c.bucket, "blankInvalid");
});

test('classifyRow: "Pls delete" in Branch -> del (beats email)', () => {
  const c = classifyRow(
    row({ "Email (dummy)": "jane.doe@gmail.com", Branch: "Pls delete" }),
    ORIG,
    new Set(),
  );
  assert.equal(c.bucket, "del");
});

test('classifyRow: "to be deleted" in Course -> del', () => {
  const c = classifyRow(
    row({ "Email (dummy)": "jane.doe@gmail.com", Course: "to be deleted" }),
    ORIG,
    new Set(),
  );
  assert.equal(c.bucket, "del");
});

test("classifyRow: email shared with another row -> dup", () => {
  const dupEmails = new Set(["jane.doe@gmail.com"]);
  const c = classifyRow(row({ "Email (dummy)": "jane.doe@gmail.com" }), ORIG, dupEmails);
  assert.equal(c.bucket, "dup");
});

test("classifyRow: userId in dupAccount set -> dupAccount (owner self-registered)", () => {
  const c = classifyRow(
    row({ "Email (dummy)": "jane.doe@gmail.com" }),
    ORIG,
    new Set(),
    new Set([ORIG.userId]),
  );
  assert.equal(c.bucket, "dupAccount");
});

test("classifyRow: sheet-dup beats dupAccount", () => {
  const c = classifyRow(
    row({ "Email (dummy)": "jane.doe@gmail.com" }),
    ORIG,
    new Set(["jane.doe@gmail.com"]),
    new Set([ORIG.userId]),
  );
  assert.equal(c.bucket, "dup");
});

test("buildSql: escapes single quotes in email", () => {
  const u = {
    username: "o.neil",
    name: "O Neil",
    userId: "33333333-3333-4333-8333-333333333333",
    alumniId: "",
    oldEmail: "",
    newEmail: "o'neil@gmail.com",
    bucket: "update" as const,
    reason: "",
  };
  const sql = buildSql([u], []);
  assert.ok(sql.includes("'o''neil@gmail.com'"), "single quote must be doubled");
});

test("golden: generator output against the real files + live precheck", () => {
  const { counts, sql } = build({
    updated: resolve(REPO_ROOT, "Dummy Email Alumnis.xlsx"),
    original: resolve(REPO_ROOT, "dummy-email-alumni-2026-08-11.xlsx"),
    full: resolve(REPO_ROOT, "all-alumni-2026-08-11.xlsx"),
    precheck: resolve(REPO_ROOT, "scripts/out/fix-dummy-emails-precheck.json"),
  });

  assert.deepEqual(counts, {
    update: 323,
    dupAccount: 181,
    dup: 177,
    del: 14,
    stillDummy: 10,
    blankInvalid: 1,
  });

  // exactly 323 email VALUES rows: ('uuid', 'email')
  const emailPairs = sql.match(/^\s*\('[0-9a-f-]{36}', '[^']*(?:''[^']*)*'\)[,;]?\s*$/gim) ?? [];
  assert.equal(emailPairs.length, 323, `expected 323 email VALUES rows, got ${emailPairs.length}`);

  // exactly 14 delete-id VALUES rows: ('uuid')
  const delPairs = sql.match(/^\s*\('[0-9a-f-]{36}'\)[,;]?\s*$/gim) ?? [];
  assert.equal(delPairs.length, 14, `expected 14 delete VALUES rows, got ${delPairs.length}`);

  // ── two-statement CTE structure ──
  assert.ok(!/\bBEGIN;/.test(sql) && !/^COMMIT;/m.test(sql), "no BEGIN/COMMIT");
  assert.ok(!sql.includes("$$"), "no dollar-quoting anywhere");
  assert.ok(!/CREATE TEMP TABLE/i.test(sql), "no temp tables (editor runs statements in isolation)");
  assert.ok(sql.includes("STATEMENT A") && sql.includes("STATEMENT B"), "labelled A and B");

  const [, stmtA, stmtB] = sql.split(/-- =+  STATEMENT [AB] /);
  assert.ok(stmtA && stmtB, "splits into two statements");
  // each statement: exactly one ';' outside comments, and starts WITH
  for (const [name, s] of [["A", stmtA], ["B", stmtB]] as const) {
    const noC = s.replace(/--[^\n]*/g, "");
    assert.equal((noC.match(/;/g) ?? []).length, 1, `statement ${name}: exactly one ';' outside comments`);
    assert.ok(/\bWITH\b/.test(s), `statement ${name} is a WITH chain`);
  }

  // Statement A: 3 guards + 2 UPDATE CTEs, no DELETE
  assert.equal((stmtA.match(/\(1 \/ \(1 - LEAST\(1,/g) ?? []).length, 3, "A has 3 guards");
  for (const g of ["guard_dummy", "guard_users", "guard_alumni"]) {
    assert.ok(stmtA.includes(`${g} AS (`) && stmtA.includes(`(SELECT ok FROM ${g})`), `A: ${g} present & referenced`);
  }
  assert.equal((stmtA.match(/\bUPDATE \w+/g) ?? []).length, 2, "A: 2 UPDATE CTEs");
  assert.ok(!/DELETE FROM/i.test(stmtA), "A: no DELETE");

  // Statement B: 1 guard + 3 DELETE CTEs, no UPDATE
  assert.equal((stmtB.match(/\(1 \/ \(1 - LEAST\(1,/g) ?? []).length, 1, "B has 1 guard");
  assert.ok(stmtB.includes("guard_preflight AS (") && stmtB.includes("(SELECT ok FROM guard_preflight)"), "B: guard_preflight present & referenced");
  assert.deepEqual(
    (stmtB.match(/DELETE FROM \w+/gi) ?? []).sort(),
    ["DELETE FROM alumni", "DELETE FROM connection_requests", "DELETE FROM users"],
    "B: 3 DELETE CTEs",
  );
  assert.ok(!/\bUPDATE \w+ (SET|a SET|u SET)/i.test(stmtB), "B: no UPDATE");

  assert.ok(!/\bDROP\s+TABLE\b/i.test(sql) && !/\bTRUNCATE\b/i.test(sql), "no DROP/TRUNCATE");
});
