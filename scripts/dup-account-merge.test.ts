/**
 * Tests for scripts/dup-account-merge.ts
 *   npx tsx --test scripts/dup-account-merge.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { buildSql, build } from "./dup-account-merge.ts";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const merge = (o: Partial<Parameters<typeof buildSql>[0][number]> = {}) => ({
  placeholderUserId: "11111111-1111-4111-8111-111111111111",
  placeholderUsername: "jane.doe",
  placeholderEmail: "jane.doe@alumni.placeholder.com",
  placeholderAlumniId: "22222222-2222-4222-8222-222222222222",
  realUserId: "33333333-3333-4333-8333-333333333333",
  realUsername: "janedoe_ab12",
  realAlumniId: "44444444-4444-4444-8444-444444444444",
  newEmail: "janedoe@gmail.com",
  connReassign: [] as string[],
  connDelete: [] as string[],
  msgReassign: [] as string[],
  portCompany: null as string | null,
  ...o,
});
const CLEAN = [{ userId: "55555555-5555-4555-8555-555555555555", newEmail: "x@y.com" }];

test("buildSql: escapes single quotes in ported company", () => {
  const sql = buildSql([merge({ portCompany: "O'Brien & Co" })], CLEAN, [], [], []);
  assert.ok(sql.includes("'O''Brien & Co'"), "single quote doubled");
});

test("buildSql: single-statement CTE structure", () => {
  const sql = buildSql(
    [merge({ connReassign: ["c1"], connDelete: ["c2"], msgReassign: ["m1"] })],
    CLEAN,
    ["c1"],
    ["c2"],
    ["m1"],
  );
  // no BEGIN/COMMIT, no dollar-quoting, no temp tables
  assert.ok(!/\bBEGIN;/.test(sql) && !/^COMMIT;/m.test(sql), "no BEGIN/COMMIT");
  assert.ok(!sql.includes("$$"), "no dollar-quoting");
  assert.ok(!/CREATE TEMP TABLE/i.test(sql), "no temp tables");
  assert.ok(/^WITH\b/m.test(sql), "starts with WITH");
  // exactly one ';' outside comments
  const noC = sql.replace(/--[^\n]*/g, "");
  assert.equal((noC.match(/;/g) ?? []).length, 1, "exactly one ';' outside comments");

  // 5 guard CTEs, each dividing by zero on violation, each referenced
  const guards = sql.match(/\(1 \/ \(1 - LEAST\(1,/g) ?? [];
  assert.equal(guards.length, 5, `expected 5 guards, got ${guards.length}`);
  for (const g of ["g_dummy", "g_real", "g_disjoint", "g_noref", "g_preflight"]) {
    assert.ok(new RegExp(`${g} AS \\(`).test(sql), `${g} CTE present`);
    assert.ok(new RegExp(`\\(SELECT ok FROM ${g}\\)`).test(sql), `${g} referenced`);
  }

  // 3 DELETE CTEs, scoped
  const deletes = (sql.match(/DELETE FROM \w+/gi) ?? []).sort();
  assert.deepEqual(
    deletes,
    ["DELETE FROM alumni", "DELETE FROM connection_requests", "DELETE FROM users"],
    "3 DELETE CTEs",
  );
  assert.ok(/DELETE FROM connection_requests\n   WHERE id IN \(SELECT req_id FROM _conn_delete\)/i.test(sql), "conn delete scoped");
  assert.ok(/DELETE FROM users\n   WHERE id IN \(SELECT placeholder_id FROM _merge\)/i.test(sql), "users delete scoped");
  assert.ok(!/\bDROP\s+TABLE\b/i.test(sql) && !/\bTRUNCATE\b/i.test(sql), "no DROP/TRUNCATE");

  // deletes gated on all guards
  assert.ok(/DELETE FROM users[\s\S]*?g_dummy[\s\S]*?g_real[\s\S]*?g_preflight[\s\S]*?g_noref/i.test(sql), "users delete gated on 4 guards");
});

test("golden: generator output against the live precheck file", () => {
  const { sql, precheck } = build(resolve(REPO_ROOT, "scripts/out/dup-account-precheck.json"));

  assert.equal(precheck.merges.length, 180);
  assert.equal(precheck.clean1RowUpdate.length, 1);

  // 180 _merge rows: ('uuid', 'uuid', <company|NULL>)
  const mergeRows = sql.match(/^\s*\('[0-9a-f-]{36}', '[0-9a-f-]{36}', (?:'[^']*(?:''[^']*)*'|NULL)\)[,;]?\s*$/gim) ?? [];
  assert.equal(mergeRows.length, 180, `expected 180 _merge rows, got ${mergeRows.length}`);

  // per-CTE id counts
  const section = (name: string) => {
    const start = sql.indexOf(`_${name} (`);
    const end = sql.indexOf("\n),", start);
    return (sql.slice(start, end).match(/\('[0-9a-f-]{36}'\)/g) ?? []).length;
  };
  assert.equal(section("conn_reassign"), 70, "_conn_reassign rows");
  assert.equal(section("conn_delete"), 9, "_conn_delete rows");
  assert.equal(section("msg_reassign"), 10, "_msg_reassign rows");

  assert.equal((sql.match(/\(1 \/ \(1 - LEAST\(1,/g) ?? []).length, 5, "5 guards");
  assert.ok(!sql.includes("$$") && !/\bBEGIN;/.test(sql), "no $$ / BEGIN");

  // no placeholder id is also a real id
  const phSet = new Set(precheck.merges.map((m) => m.placeholderUserId));
  assert.ok(!precheck.merges.some((m) => phSet.has(m.realUserId)), "no id both placeholder and real");
  // conn reassign/delete disjoint + globally unique
  const r = precheck.merges.flatMap((m) => m.connReassign);
  const d = precheck.merges.flatMap((m) => m.connDelete);
  assert.equal(new Set([...r, ...d]).size, r.length + d.length, "conn ids unique across reassign+delete");
  // clean-update id not among placeholders
  assert.ok(!phSet.has(precheck.clean1RowUpdate[0].userId), "clean-update id is not a merge placeholder");
});
