/** npx tsx --test scripts/full-cleanup-merge.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { build } from "./full-cleanup-merge.ts";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("golden: full-cleanup SQL against live precheck", () => {
  const { sql, pc } = build(resolve(REPO_ROOT, "scripts/out/full-cleanup-precheck.json"));

  assert.equal(pc.safeMerges.length, 17);
  assert.equal(pc.typoFixes.length, 1);
  assert.equal(pc.testDeletes.length, 14);
  assert.equal(pc.connReassign.length, 0);
  assert.equal(pc.connDelete.length, 0);

  // single-statement CTE
  assert.ok(!/\bBEGIN;/.test(sql) && !/^COMMIT;/m.test(sql), "no BEGIN/COMMIT");
  assert.ok(!sql.includes("$$"), "no dollar-quoting");
  assert.ok(!/CREATE TEMP TABLE/i.test(sql), "no temp tables");
  assert.ok(/^WITH\b/m.test(sql), "WITH chain");
  const noC = sql.replace(/--[^\n]*/g, "");
  assert.equal((noC.match(/;/g) ?? []).length, 1, "one ';' outside comments");

  // 3 guards, all referenced
  const guards = sql.match(/\(1 \/ \(1 - LEAST\(1,/g) ?? [];
  assert.equal(guards.length, 3, `expected 3 guards, got ${guards.length}`);
  for (const g of ["g_merge_dummy", "g_merge_keep_ok", "g_test_safe"]) {
    assert.ok(sql.includes(`${g} AS (`) && sql.includes(`(SELECT ok FROM ${g})`), `${g} present & referenced`);
  }

  // deletes: alumni x2 + users x2 + messages x1, all scoped
  const deletes = (sql.match(/DELETE FROM \w+/gi) ?? []).sort();
  assert.deepEqual(deletes, ["DELETE FROM alumni", "DELETE FROM alumni", "DELETE FROM messages", "DELETE FROM users", "DELETE FROM users"]);
  assert.ok(/DELETE FROM users WHERE id IN \(SELECT id FROM _dupe_drop\)/i.test(sql), "dupe users delete scoped");
  assert.ok(/DELETE FROM users WHERE id IN \(SELECT id FROM _test\)/i.test(sql), "test users delete scoped");
  // messages delete has parenthesised OR before the guard
  assert.ok(/DELETE FROM messages\n\s*WHERE \(sender_id IN[\s\S]*?OR receiver_id IN[\s\S]*?\)\n\s*AND \(SELECT ok FROM g_test_safe\)/i.test(sql), "message delete OR is parenthesised & guarded");
  assert.ok(!/\bDROP\s+TABLE\b/i.test(sql) && !/\bTRUNCATE\b/i.test(sql), "no DROP/TRUNCATE");

  // _dupe_drop 17 rows, _test 14 rows
  const sec = (n: string) => { const s = sql.indexOf(`${n} (id) AS (VALUES`); const e = sql.indexOf("\n),", s); return sql.slice(s, e); };
  assert.equal((sec("_dupe_drop").match(/\('[0-9a-f-]{36}'\)/g) ?? []).length, 17);
  assert.equal((sec("_test").match(/\('[0-9a-f-]{36}'\)/g) ?? []).length, 14);

  // no id appears in more than one set
  const merge = new Set(pc.safeMerges.map((s: any) => s.dropId));
  const keep = new Set(pc.safeMerges.map((s: any) => s.keepId));
  const test = new Set(pc.testDeletes.map((t: any) => t.userId));
  const typo = new Set(pc.typoFixes.map((t: any) => t.userId));
  for (const id of merge) assert.ok(!keep.has(id) && !test.has(id) && !typo.has(id), `merge drop ${id} overlaps`);
  for (const id of test) assert.ok(!keep.has(id) && !typo.has(id), `test ${id} overlaps`);
});
