/**
 * Tests for scripts/dedupe-193-merge.ts
 *   npx tsx --test scripts/dedupe-193-merge.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { buildSql, build } from "./dedupe-193-merge.ts";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("buildSql: escapes quotes, single-statement structure", () => {
  const sql = buildSql(
    [{ id: "11111111-1111-4111-8111-111111111111", target: "33333333-3333-4333-8333-333333333333" }],
    [{ userId: "22222222-2222-4222-8222-222222222222", email: "o'brien@x.com" }],
    ["c1"], ["c2"], ["m1"],
  );
  assert.ok(sql.includes("'o''brien@x.com'"), "quote doubled");
  assert.ok(!/\bBEGIN;/.test(sql) && !/^COMMIT;/m.test(sql), "no BEGIN/COMMIT");
  assert.ok(!sql.includes("$$"), "no dollar-quoting");
  assert.ok(!/CREATE TEMP TABLE/i.test(sql), "no temp tables");
  assert.ok(/^WITH\b/m.test(sql), "WITH chain");
  const noC = sql.replace(/--[^\n]*/g, "");
  assert.equal((noC.match(/;/g) ?? []).length, 1, "one ';' outside comments");
  const deletes = (sql.match(/DELETE FROM \w+/gi) ?? []).sort();
  assert.deepEqual(deletes, ["DELETE FROM alumni", "DELETE FROM connection_requests", "DELETE FROM users"]);
  for (const g of ["g_drops_dummy", "g_targets_ok", "g_email_free", "g_disjoint", "g_preflight"]) {
    assert.ok(sql.includes(`${g} AS (`) && sql.includes(`(SELECT ok FROM ${g})`), `${g} present & referenced`);
  }
  assert.equal((sql.match(/\(1 \/ \(1 - LEAST\(1,/g) ?? []).length, 5, "5 guards");
});

test("golden: against live precheck file", () => {
  const { sql, precheck } = build(resolve(REPO_ROOT, "scripts/out/dedupe-193-precheck.json"));
  const c = precheck.counts;
  assert.equal(c.patternA, 59);
  assert.equal(c.patternB, 18);
  assert.equal(c.deleteAccounts, 137);
  assert.equal(c.applyEmail, 18);

  // count rows per CTE section (bounded by the CTE name and its closing "\n),")
  const section = (name: string) => {
    const s = sql.indexOf(`${name} (`);
    const e = sql.indexOf("\n),", s);
    return sql.slice(s, e);
  };
  const dropRows = section("_drop").match(/^\s*\('[0-9a-f-]{36}', '[0-9a-f-]{36}'\),?\s*$/gim) ?? [];
  assert.equal(dropRows.length, 137, `expected 137 _drop rows, got ${dropRows.length}`);
  const emailRows = section("_email").match(/^\s*\('[0-9a-f-]{36}', '[^']+'\),?\s*$/gim) ?? [];
  assert.equal(emailRows.length, 18, `expected 18 _email rows, got ${emailRows.length}`);
  // and none of the _email second values is a bare uuid (it's an address)
  assert.ok(!emailRows.some((r) => /'[0-9a-f-]{36}'\),?\s*$/.test(r)), "_email second col is an address, not a uuid");

  // no drop id appears as a pattern-A real account or pattern-B keeper
  const drops = new Set(Object.keys(precheck.childRows.dropToTarget));
  for (const g of precheck.dedupe) {
    const tgt = g.pattern === "A" ? g.realUserId : g.keep.userId;
    assert.ok(!drops.has(tgt), `${g.email}: target ${tgt} is also a drop`);
  }
  // conn reassign/delete disjoint
  const r = new Set(precheck.childRows.connReassign);
  assert.ok(!precheck.childRows.connDelete.some((id) => r.has(id)), "conn reassign/delete disjoint");
});
