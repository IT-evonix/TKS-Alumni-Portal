/** npx tsx --test scripts/round2-apply-merge.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { build } from "./round2-apply-merge.ts";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("golden: round-2 apply SQL against live precheck", () => {
  const { sql, precheck } = build(resolve(REPO_ROOT, "scripts/out/round2-apply-precheck.json"));

  // single-statement CTE, no forbidden constructs
  assert.ok(!/\bBEGIN;/.test(sql) && !/^COMMIT;/m.test(sql), "no BEGIN/COMMIT");
  assert.ok(!sql.includes("$$"), "no dollar-quoting");
  assert.ok(!/CREATE TEMP TABLE/i.test(sql), "no temp tables");
  assert.ok(/^WITH\b/m.test(sql), "WITH chain");
  const noC = sql.replace(/--[^\n]*/g, "");
  assert.equal((noC.match(/;/g) ?? []).length, 1, "one ';' outside comments");

  // 6 guards, all referenced
  const guards = sql.match(/\(1 \/ \(1 - LEAST\(1,/g) ?? [];
  assert.equal(guards.length, 6, `expected 6 guards, got ${guards.length}`);
  for (const g of ["g_apply_dummy", "g_email_free", "g_drops_dummy", "g_targets_ok", "g_disjoint", "g_preflight"]) {
    assert.ok(sql.includes(`${g} AS (`) && sql.includes(`(SELECT ok FROM ${g})`), `${g} present & referenced`);
  }

  // 3 DELETE CTEs scoped
  const deletes = (sql.match(/DELETE FROM \w+/gi) ?? []).sort();
  assert.deepEqual(deletes, ["DELETE FROM alumni", "DELETE FROM connection_requests", "DELETE FROM users"]);
  assert.ok(/DELETE FROM users WHERE id IN \(SELECT id FROM _drop\)/i.test(sql), "users delete scoped");

  // counts from precheck
  const plans = precheck.plans;
  assert.equal(plans.filter((p: any) => p.action === "apply_email").length, 10);
  assert.equal(plans.filter((p: any) => p.action === "rename_and_apply").length, 1);
  assert.equal(plans.filter((p: any) => p.action === "delete").length, 21);
  assert.equal(plans.filter((p: any) => p.action === "keep_round3").length, 1);

  // _email rows = 11, _drop rows = 21
  const sec = (name: string) => { const s = sql.indexOf(`${name} (`); const e = sql.indexOf("\n),", s); return sql.slice(s, e); };
  assert.equal((sec("_email").match(/^\s*\('[0-9a-f-]{36}',/gim) ?? []).length, 11, "_email rows");
  assert.equal((sec("_drop").match(/^\s*\('[0-9a-f-]{36}', '/gim) ?? []).length, 21, "_drop rows");

  // no apply id is also a delete id
  const delIds = new Set(plans.filter((p: any) => p.action === "delete").map((p: any) => p.userId));
  for (const p of plans.filter((p: any) => ["apply_email", "rename_and_apply"].includes(p.action))) {
    assert.ok(!delIds.has(p.userId), `${p.username}: apply id also a delete`);
  }
  // child targets not deleted
  for (const [drop, tgt] of Object.entries(precheck.childRows.targetByDrop)) {
    assert.ok(delIds.has(drop), `targetByDrop key ${drop} should be a delete`);
    assert.ok(!delIds.has(tgt as string), `child target ${tgt} is deleted`);
  }
});
