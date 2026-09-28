/**
 * Full cleanup pre-check — verify the auto-actions against LIVE prod, plan child-row moves.
 *   npx tsx scripts/full-cleanup-precheck.ts
 *
 * Auto-actions (everything else -> school CSV):
 *   1. 17 safe dupe merges: delete the school-import placeholder, keep the self-registered account
 *   2. email typo fixes: mailto: prefix, .con->.com, .gamil->.gmail  (only unambiguous)
 *   3. delete confirmed test/dev accounts with no alumni row
 *
 * Emits scripts/out/full-cleanup-precheck.json + scripts/out/MASTER-school-list.csv. NO WRITES.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";

const SUPABASE_URL = process.env.EXPORT_SUPABASE_URL || "https://aikvtpqqxasdctchtgct.supabase.co";
const SUPABASE_SERVICE_KEY =
  process.env.EXPORT_SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpa3Z0cHFxeGFzZGN0Y2h0Z2N0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTI5ODM4OCwiZXhwIjoyMDc0ODc0Mzg4fQ.N4Y9iGXA-PnSfSd65U94NOu_QvnTnkl51LWRREzLt5s";

const OUT = resolve(process.cwd(), "scripts/out");
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const norm = (e: unknown) => String(e ?? "").trim().toLowerCase();
const isDummy = (e: unknown) => /placeholder|@student\.tks\.com/.test(norm(e));
const VALID = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IMPORT_DATES = new Set(["2025-10-02", "2026-02-09", "2026-02-13"]);

// Confirmed test/dev accounts (hand-verified 2026-09-10 — usernames are exact).
// Real students named Om/Prashant (omkar.lalla, om.bhavsar, omsinha3006, ...) are NOT here.
const TEST_ACCOUNT_USERNAMES = new Set([
  "om", "admin", "vijay",
  "prashant_mjvl2ne9", "prashant_mjtzarpk", "prashant_mjtzmvh7",
  "prashant_mjuy7xwf", "prashant_mjuyex1x", "prashant_mjvkge3d",
  "prashantkalyani777", "prashantkalyani712_mjs9c7ej",
  "developerprashant172_mjtywzig", "developerprashant172_mjtz10g4",
  "alumni_ms7i2z5c",
]);

async function fetchAll<T>(t: string, c: string): Promise<T[]> {
  let a: T[] = [];
  let f = 0;
  while (true) {
    const { data, error } = await sb.from(t).select(c).range(f, f + 999);
    if (error) throw new Error(`${t}: ${error.message}`);
    a = a.concat((data ?? []) as T[]);
    if (!data || data.length < 1000) break;
    f += 1000;
  }
  return a;
}
async function rowsIn<T>(t: string, cols: string, col: string, ids: string[]): Promise<T[]> {
  let o: T[] = [];
  for (let i = 0; i < ids.length; i += 80) {
    const { data, error } = await sb.from(t).select(cols).in(col, ids.slice(i, i + 80));
    if (error) throw new Error(`${t}.${col}: ${error.message}`);
    o = o.concat((data ?? []) as T[]);
  }
  return o;
}

function fixTypo(email: string): string | null {
  let e = norm(email);
  if (/^mailto:/i.test(e)) e = e.replace(/^mailto:/i, "");
  e = e
    .replace(/\.con$/i, ".com")
    .replace(/@gamil\.com$/i, "@gmail.com")
    .replace(/@gmial\.com$/i, "@gmail.com")
    .replace(/@gmai\.com$/i, "@gmail.com")
    .replace(/@hotmial\.com$/i, "@hotmail.com")
    .replace(/@yaho\.com$/i, "@yahoo.com")
    .replace(/@outlok\.com$/i, "@outlook.com");
  return e !== norm(email) && VALID.test(e) ? e : null;
}

async function main() {
  console.log("Full cleanup pre-check — reading prod + analysis...\n");
  const A = JSON.parse(readFileSync(resolve(OUT, "full-cleanup-analysis.json"), "utf8"));

  type U = { id: string; email: string; username: string; account_approved: boolean; account_blocked: boolean; user_role: string; is_admin: boolean; created_at: string };
  type Al = { id: string; user_id: string; email: string; first_name: string; last_name: string; graduation_year: unknown };
  const users = await fetchAll<U>("users", "id,email,username,account_approved,account_blocked,user_role,is_admin,created_at");
  const alumni = await fetchAll<Al>("alumni", "id,user_id,email,first_name,last_name,graduation_year");
  const uById = new Map(users.map((u) => [u.id, u]));
  const uByUsername = new Map(users.map((u) => [norm(u.username), u]));
  const aByUser = new Map(alumni.map((a) => [a.user_id, a]));
  const uByEmail = new Map<string, U[]>();
  users.forEach((u) => uByEmail.set(norm(u.email), [...(uByEmail.get(norm(u.email)) ?? []), u]));
  const aByEmail = new Map<string, Al[]>();
  alumni.forEach((a) => aByEmail.set(norm(a.email), [...(aByEmail.get(norm(a.email)) ?? []), a]));

  const isImport = (m: any) => m.dummy === true || IMPORT_DATES.has(m.created);

  // ── 1. re-derive the 17 safe merges directly from live data (not stale JSON) ──
  const byName = new Map<string, Al[]>();
  for (const a of alumni) {
    const k = `${norm(a.first_name).replace(/[^a-z0-9]/g, "")}|${norm(a.last_name).replace(/[^a-z0-9]/g, "")}`;
    byName.set(k, [...(byName.get(k) ?? []), a]);
  }
  // activity map (light — connection_requests + feed_posts + messages only, enough to gate)
  const act = new Map<string, number>();
  const bump = (id: string | undefined) => { if (id) act.set(id, (act.get(id) ?? 0) + 1); };
  for (const [t, c] of [["feed_posts", "author_id"], ["post_comments", "user_id"], ["post_likes", "user_id"], ["connection_requests", "requester_id"], ["connection_requests", "recipient_id"], ["messages", "sender_id"], ["messages", "receiver_id"], ["event_rsvps", "user_id"], ["blog_posts", "author_id"], ["job_applications", "user_id"]] as const) {
    try { for (const r of await fetchAll<Record<string, string>>(t, c)) bump(r[c]); } catch { /* */ }
  }

  const safeMerges: { keepId: string; keepUsername: string; dropId: string; dropUsername: string; name: string }[] = [];
  const reviewGroups: any[] = [];
  for (const [k, group] of byName) {
    if (group.length < 2) continue;
    const members = group.map((a) => {
      const u = uById.get(a.user_id);
      return { a, u, created: u?.created_at?.slice(0, 10) ?? "", dummy: isDummy(a.email), activity: act.get(a.user_id) ?? 0 };
    });
    if (members.length === 2) {
      const imports = members.filter(isImport);
      const reals = members.filter((m) => !isImport(m));
      if (imports.length === 1 && reals.length === 1 && imports[0].activity === 0) {
        safeMerges.push({
          keepId: reals[0].a.user_id, keepUsername: reals[0].u!.username,
          dropId: imports[0].a.user_id, dropUsername: imports[0].u!.username,
          name: `${reals[0].a.first_name} ${reals[0].a.last_name}`.trim(),
        });
        continue;
      }
    }
    reviewGroups.push({ key: k, members: members.map((m) => ({ username: m.u?.username, name: `${m.a.first_name} ${m.a.last_name}`.trim(), grad: m.a.graduation_year, email: m.a.email, dummy: m.dummy, approved: m.u?.account_approved, activity: m.activity, created: m.created, user_id: m.a.user_id })) });
  }

  // child rows on the 17 drop accounts
  const dropIds = safeMerges.map((s) => s.dropId);
  const dropToKeep = new Map(safeMerges.map((s) => [s.dropId, s.keepId]));
  const allConn = await fetchAll<{ requester_id: string; recipient_id: string }>("connection_requests", "requester_id,recipient_id");
  const connKey = new Set<string>();
  allConn.forEach((c) => { connKey.add(`${c.requester_id}|${c.recipient_id}`); connKey.add(`${c.recipient_id}|${c.requester_id}`); });
  const dropConn = [...new Map([
    ...(await rowsIn<{ id: string; requester_id: string; recipient_id: string }>("connection_requests", "id,requester_id,recipient_id", "requester_id", dropIds)),
    ...(await rowsIn<{ id: string; requester_id: string; recipient_id: string }>("connection_requests", "id,requester_id,recipient_id", "recipient_id", dropIds)),
  ].map((r) => [r.id, r])).values()];
  const connReassign: string[] = [], connDelete: string[] = [];
  for (const c of dropConn) {
    const nr = dropToKeep.get(c.requester_id) ?? c.requester_id;
    const nc = dropToKeep.get(c.recipient_id) ?? c.recipient_id;
    if (nr === nc || connKey.has(`${nr}|${nc}`)) connDelete.push(c.id); else connReassign.push(c.id);
  }
  const dropMsg = [...new Map([
    ...(await rowsIn<{ id: string }>("messages", "id", "sender_id", dropIds)),
    ...(await rowsIn<{ id: string }>("messages", "id", "receiver_id", dropIds)),
  ].map((r) => [r.id, r])).values()];

  // preflight blockers on the 17
  const blockers: Record<string, number> = {};
  for (const [t, col] of [["feed_posts", "author_id"], ["user_blocks", "blocker_id"], ["user_blocks", "blocked_id"], ["events", "organized_by"], ["signup_requests", "reviewed_by"]] as const) {
    let n = 0;
    for (let i = 0; i < dropIds.length; i += 80) {
      const { count } = await sb.from(t).select("*", { count: "exact", head: true }).in(col, dropIds.slice(i, i + 80));
      n += count ?? 0;
    }
    blockers[`${t}.${col}`] = n;
  }

  // ── 2. email typo fixes (only unambiguous, only if the fixed email is free) ──
  const typoFixes: { userId: string; username: string; from: string; to: string }[] = [];
  for (const m of [...A.categories.malformed, ...A.categories.typo_tld]) {
    const u = uById.get(m.user_id);
    if (!u) continue;
    const fixed = fixTypo(u.email);
    if (!fixed) continue;
    const uColl = (uByEmail.get(fixed) ?? []).filter((x) => x.id !== u.id);
    const aColl = (aByEmail.get(fixed) ?? []).filter((x) => x.user_id !== u.id);
    if (uColl.length || aColl.length) continue; // fixed email taken -> school
    typoFixes.push({ userId: u.id, username: u.username, from: u.email, to: fixed });
  }

  // ── 3. test/dev accounts to delete (exact hand-verified list) ──
  const testDeletes: { userId: string; username: string; email: string; activity: number; hasAlumni: boolean }[] = [];
  for (const u of users) {
    if (!TEST_ACCOUNT_USERNAMES.has(norm(u.username))) continue;
    if (u.is_admin || u.user_role === "administrator") continue; // never touch admins
    testDeletes.push({ userId: u.id, username: u.username, email: u.email, activity: act.get(u.id) ?? 0, hasAlumni: !!aByUser.get(u.id) });
  }

  // ── assertions ──
  const assert = (c: unknown, msg: string) => { if (!c) { console.error(`❌ ${msg}`); process.exit(1); } };
  const keepIds = new Set(safeMerges.map((s) => s.keepId));
  for (const s of safeMerges) {
    assert(UUID_RE.test(s.keepId) && UUID_RE.test(s.dropId), `bad uuid in merge ${s.name}`);
    assert(s.keepId !== s.dropId, `merge ${s.name}: keep==drop`);
    const dropU = uById.get(s.dropId), keepU = uById.get(s.keepId);
    assert(!!dropU && !!keepU, `merge ${s.name}: account missing`);
    assert(!keepU!.account_blocked, `merge ${s.name}: keep is blocked`);
  }
  for (const id of dropIds) assert(!keepIds.has(id), `id is both keep and drop: ${id}`);
  for (const [k, v] of Object.entries(blockers)) assert(v === 0, `preflight blocker ${k}=${v}`);
  const tfIds = new Set(typoFixes.map((t) => t.userId));
  const tdIds = new Set(testDeletes.map((t) => t.userId));
  for (const id of tdIds) assert(!keepIds.has(id) && !dropIds.includes(id) && !tfIds.has(id), `test-delete id overlaps: ${id}`);

  console.log(`SAFE dupe merges     : ${safeMerges.length}  (delete import, keep self-reg)`);
  console.log(`  child rows         : ${connReassign.length} conn reassign, ${connDelete.length} conn delete, ${dropMsg.length} msg`);
  console.log(`  preflight blockers : ${JSON.stringify(blockers)}`);
  console.log(`email typo fixes     : ${typoFixes.length}`);
  typoFixes.forEach((t) => console.log(`    ${t.username}: ${t.from} -> ${t.to}`));
  console.log(`test/dev deletes     : ${testDeletes.length}`);
  testDeletes.forEach((t) => console.log(`    ${t.username} <${t.email}>`));
  console.log(`\nNEEDS SCHOOL REVIEW  : ${reviewGroups.length} dupe groups + email issues`);

  // ── MASTER school list ──
  const school: any[] = [];
  const cat = A.categories;
  for (const m of cat.dummy) school.push({ category: "dummy-email (has a real account too)", username: m.username, name: m.name, grad: m.grad, email: m.email, note: "confirm which account & email to keep", user_id: m.user_id });
  for (const m of cat.disposable) school.push({ category: "throwaway email (yopmail)", username: m.username, name: m.name, grad: m.grad, email: m.email, note: "need real email", user_id: m.user_id });
  for (const m of cat.internal_domain) school.push({ category: "internal-domain email", username: m.username, name: m.name, grad: m.grad, email: m.email, note: "need personal email", user_id: m.user_id });
  for (const m of cat.malformed) if (!typoFixes.some((t) => t.userId === m.user_id)) school.push({ category: "malformed email", username: m.username, name: m.name, grad: m.grad, email: m.email, note: "need real email", user_id: m.user_id });
  for (const m of cat.typo_tld) if (!typoFixes.some((t) => t.userId === m.user_id)) school.push({ category: "email typo (ambiguous)", username: m.username, name: m.name, grad: m.grad, email: m.email, note: "confirm correct email", user_id: m.user_id });
  for (const g of reviewGroups) for (const m of g.members) school.push({ category: `duplicate person (${g.members.length} accounts)`, username: m.username, name: m.name, grad: m.grad, email: m.email, note: "confirm which account & grad year is correct", user_id: m.user_id, group: g.key });

  const cols = ["category", "group", "username", "name", "grad", "email", "note", "user_id"];
  writeFileSync(resolve(OUT, "MASTER-school-list.csv"),
    [cols.join(",")].concat(school.map((r) => cols.map((c) => `"${String(r[c] ?? "").replace(/"/g, '""')}"`).join(","))).join("\n") + "\n");

  mkdirSync(dirname(resolve(OUT, "x")), { recursive: true });
  writeFileSync(resolve(OUT, "full-cleanup-precheck.json"), JSON.stringify({
    generatedAt: new Date().toISOString(),
    safeMerges, connReassign, connDelete, msgReassign: dropMsg.map((m) => m.id),
    typoFixes, testDeletes, blockers,
    counts: { safeMerges: safeMerges.length, typoFixes: typoFixes.length, testDeletes: testDeletes.length, reviewGroups: reviewGroups.length, schoolRows: school.length },
  }, null, 2));

  console.log(`\n✅  Wrote full-cleanup-precheck.json`);
  console.log(`✅  Wrote MASTER-school-list.csv (${school.length} rows)`);
}

main().catch((e) => { console.error("\n❌ ", e?.message || e); process.exit(1); });
