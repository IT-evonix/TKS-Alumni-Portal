/**
 * Round-2 dedupe pre-check (the 193 still-dummy accounts)
 * ------------------------------------------------------------
 *   npx tsx scripts/dedupe-193-precheck.ts
 *
 * Reads the updated sheet + original export, cross-checks LIVE prod, and classifies every
 * still-dummy account into:
 *   dedupe   - one person, 2+ records; one is approved (or, if none approved, keep the one
 *              with the most data). Delete the loser(s), apply the real email to the keeper.
 *   siblings - genuinely different people sharing a family email (need distinct addresses).
 *   collision- different people, one clearly owns the email, the other got it by mistake.
 *   unresolved - blank / still-dummy / not-in-sheet.
 *
 * Emits scripts/out/dedupe-193-precheck.json  (consumed by dedupe-193-merge.ts) and
 *       scripts/out/school-round2.csv          (every row the school must supply an email for).
 * NO WRITES.
 */

import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import * as XLSX from "xlsx";

const SUPABASE_URL = process.env.EXPORT_SUPABASE_URL || "https://aikvtpqqxasdctchtgct.supabase.co";
const SUPABASE_SERVICE_KEY =
  process.env.EXPORT_SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpa3Z0cHFxeGFzZGN0Y2h0Z2N0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTI5ODM4OCwiZXhwIjoyMDc0ODc0Mzg4fQ.N4Y9iGXA-PnSfSd65U94NOu_QvnTnkl51LWRREzLt5s";

const ROOT = process.cwd();
const UPDATED_XLSX = resolve(ROOT, "Dummy Email Alumnis.xlsx");
const ORIGINAL_XLSX = resolve(ROOT, "dummy-email-alumni-2026-08-11.xlsx");
const OUT = resolve(ROOT, "scripts/out/dedupe-193-precheck.json");
const SCHOOL_CSV = resolve(ROOT, "scripts/out/school-round2.csv");

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const norm = (e: unknown) => String(e ?? "").trim().toLowerCase();
const isDummy = (e: unknown) => /placeholder|@student\.tks\.com/.test(norm(e));
const isValidEmail = (e: string) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(e.trim());
const DELETE_MARKER = /\b(pls\s*)?(to\s*be\s*)?delet/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Hand-curated: the 6 REVIEW groups that are "different people, one owns the email, the other
// got it wrongly". Both rows go to the school (we don't guess ownership).
const COLLISION_EMAILS = new Set([
  "srisravya27@gmail.com",
  "meharsatsangi07@gmail.com",
  "debarchana.mohanty@rediffmail.com",
  "syonshukla28@gmail.com",
  "sanyukta.mp@gmail.com",
  "jain.abhilasha@gmail.com",
]);
// Hand-curated genuine sibling groups (different first names, shared family email).
const SIBLING_EMAILS = new Set([
  "deepalisingh10@gmail.com",
  "monikagul@gmail.com",
  "seemasinghpuri@gmail.com",
  "shreyaanjinturkar@gmail.com",
]);

// Hand-curated: Pattern-B groups where the person is a clean dupe BUT the email in the sheet
// clearly belongs to someone else (local-part unrelated to the name). -> school.
const WRONG_EMAIL_FOR_PERSON = new Set([
  "vandannajain@gmail.com", // person is "Kushal Bhansali"; email is a Vandana Jain address
]);

function readSheet(p: string): Record<string, unknown>[] {
  const wb = XLSX.read(readFileSync(p), { type: "buffer" });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "", blankrows: false });
}
async function fetchAll<T>(table: string, cols: string): Promise<T[]> {
  let all: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await sb.from(table).select(cols).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    all = all.concat((data ?? []) as T[]);
    if (!data || data.length < 1000) break;
    from += 1000;
  }
  return all;
}

interface Member {
  username: string;
  userId: string;
  alumniId: string;
  name: string;
  grad: unknown;
  approved: boolean;
  dbEmail: string;
  dataScore: number; // higher = more profile data
}
// Pattern A: real self-registered account already holds the email -> delete ALL placeholder
//            records in the group, apply nothing.
// Pattern B: no real account; the email lives only on the placeholders -> keep the best
//            placeholder, delete the rest, apply the email to the keeper.
interface DedupeGroup {
  email: string;
  pattern: "A" | "B";
  realUserId: string | null; // pattern A: the self-registered account we keep untouched
  keep: Member | null;       // pattern B: the placeholder we keep + update
  drop: Member[];            // placeholder accounts to delete (all of them for A)
}
interface OtherRow { username: string; userId: string | null; name: string; grad: unknown; email: string; reason: string; }

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log(" Round-2 dedupe pre-check (193 still-dummy accounts)");
  console.log("═══════════════════════════════════════════════════════════\n");

  const up = readSheet(UPDATED_XLSX);
  const original = readSheet(ORIGINAL_XLSX);
  const origByUser = new Map(original.map((r) => [norm(r["Username"]), r]));

  type U = { id: string; email: string; username: string; account_approved: boolean };
  type A = {
    id: string; user_id: string; email: string; first_name: string; last_name: string;
    graduation_year: unknown; roll_number: string; date_of_birth: unknown;
    phone: string; current_city: string; current_company: string; linkedin_url: string;
  };
  const users = await fetchAll<U>("users", "id,email,username,account_approved,account_blocked");
  const alumni = await fetchAll<A>(
    "alumni",
    "id,user_id,email,first_name,last_name,graduation_year,roll_number,date_of_birth,phone,current_city,current_company,linkedin_url",
  );
  const uByUsername = new Map(users.map((u) => [norm(u.username), u]));
  const uById = new Map(users.map((u) => [u.id, u]));
  const aByUser = new Map(alumni.map((a) => [a.user_id, a]));
  const uByEmail = new Map<string, U[]>();
  users.forEach((u) => uByEmail.set(norm(u.email), [...(uByEmail.get(norm(u.email)) ?? []), u]));
  const aByEmail = new Map<string, A[]>();
  alumni.forEach((a) => aByEmail.set(norm(a.email), [...(aByEmail.get(norm(a.email)) ?? []), a]));
  console.log(`prod: ${users.length} users, ${alumni.length} alumni\n`);

  const dataScore = (a: A | undefined) =>
    !a ? -1 :
      (a.phone?.trim() ? 3 : 0) +
      (a.linkedin_url?.trim() ? 2 : 0) +
      (a.current_company && a.current_company !== "No" ? 2 : 0) +
      (a.current_city?.trim() ? 1 : 0);

  // group updated-sheet rows by the "real" email they carry (skip delete-marked, blank, still-dummy)
  const groups = new Map<string, Record<string, unknown>[]>();
  const blank: OtherRow[] = [];
  const stillDummy: OtherRow[] = [];
  for (const r of up) {
    if (DELETE_MARKER.test(String(r["Branch"])) || DELETE_MARKER.test(String(r["Course"]))) continue;
    const e = norm(r["Email (dummy)"]);
    const u = norm(r["Username"]);
    const mk = (reason: string): OtherRow => ({
      username: String(r["Username"]),
      userId: uByUsername.get(u)?.id ?? null,
      name: `${r["First Name"]} ${r["Last Name"]}`.trim(),
      grad: r["Graduation Year"],
      email: e,
      reason,
    });
    if (!e) { blank.push(mk("blank email in sheet")); continue; }
    if (isDummy(e)) { stillDummy.push(mk("email in sheet is still a placeholder")); continue; }
    if (!isValidEmail(e)) { blank.push(mk(`invalid email in sheet: ${e}`)); continue; }
    (groups.get(e) ?? groups.set(e, []).get(e)!).push(r);
  }

  const dedupe: DedupeGroup[] = [];
  const siblings: { email: string; members: OtherRow[] }[] = [];
  const collisions: { email: string; members: OtherRow[] }[] = [];
  const schoolRows: OtherRow[] = [...blank, ...stillDummy];
  let singleClean = 0;

  for (const [email, rs] of groups) {
    // build live members
    const members: Member[] = rs.map((r) => {
      const u = uByUsername.get(norm(r["Username"]));
      const a = u ? aByUser.get(u.id) : undefined;
      return {
        username: String(r["Username"]),
        userId: u?.id ?? "",
        alumniId: a?.id ?? "",
        name: `${a?.first_name ?? r["First Name"]} ${a?.last_name ?? r["Last Name"]}`.trim(),
        grad: a?.graduation_year ?? r["Graduation Year"],
        approved: u?.account_approved ?? false,
        dbEmail: a?.email ?? "",
        dataScore: dataScore(a),
      };
    });
    const liveDummy = members.filter((m) => m.userId && m.alumniId && isDummy(m.dbEmail));

    if (rs.length === 1) { singleClean++; continue; }            // shouldn't happen (grouped by dup), keep guard
    if (liveDummy.length < 2) { singleClean++; continue; }        // the rest already resolved by earlier migrations

    const asOther = (m: Member, reason: string): OtherRow => ({
      username: m.username, userId: m.userId, name: m.name, grad: m.grad, email, reason,
    });

    if (COLLISION_EMAILS.has(email)) {
      collisions.push({ email, members: liveDummy.map((m) => asOther(m, "different person; email ownership disputed")) });
      schoolRows.push(...liveDummy.map((m) => asOther(m, `shares ${email} with a different person`)));
      continue;
    }
    if (SIBLING_EMAILS.has(email)) {
      siblings.push({ email, members: liveDummy.map((m) => asOther(m, "sibling; needs own email")) });
      schoolRows.push(...liveDummy.map((m) => asOther(m, `sibling sharing ${email}`)));
      continue;
    }

    // Is there a real self-registered account (not in this group) already holding the email,
    // on either users or alumni? -> Pattern A: delete every placeholder, touch nothing else.
    const groupIds = new Set(liveDummy.map((m) => m.userId));
    const uHolders = (uByEmail.get(email) ?? []).filter((u) => !groupIds.has(u.id));
    const aHolders = (aByEmail.get(email) ?? []).filter((a) => !groupIds.has(a.user_id));

    if (uHolders.length >= 1 || aHolders.length >= 1) {
      const real = uHolders[0] ?? uById.get(aHolders[0].user_id) ?? null;
      // sanity: the real account must itself be non-dummy (else it's not a safe keeper)
      if (real && !isDummy(real.email) && !real.account_blocked) {
        dedupe.push({ email, pattern: "A", realUserId: real.id, keep: null, drop: liveDummy });
        continue;
      }
      // real account looks wrong -> hand the whole group to the school
      collisions.push({ email, members: liveDummy.map((m) => asOther(m, "email held by an account that looks invalid")) });
      schoolRows.push(...liveDummy.map((m) => asOther(m, `${email} held by a questionable account`)));
      continue;
    }

    if (WRONG_EMAIL_FOR_PERSON.has(email)) {
      collisions.push({ email, members: liveDummy.map((m) => asOther(m, "clean dupe, but sheet email belongs to a different person")) });
      schoolRows.push(...liveDummy.map((m) => asOther(m, `sheet gave ${email} which is not this person's address`)));
      continue;
    }

    // Pattern B: no third account. Keep the best placeholder, delete the rest, apply the email.
    const approved = liveDummy.filter((m) => m.approved);
    let keep: Member;
    if (approved.length === 1) keep = approved[0];
    else {
      const pool = approved.length > 1 ? approved : liveDummy;
      keep = pool.slice().sort((a, b) => b.dataScore - a.dataScore || a.username.localeCompare(b.username))[0];
    }
    const drop = liveDummy.filter((m) => m.userId !== keep.userId);
    dedupe.push({ email, pattern: "B", realUserId: null, keep, drop });
  }

  // assertions
  const assert = (c: unknown, m: string) => { if (!c) { console.error(`❌ ${m}`); process.exit(1); } };
  for (const g of dedupe) {
    assert(g.drop.length >= 1, `dedupe ${g.email} has no drop rows`);
    for (const d of g.drop) assert(UUID_RE.test(d.userId), `dedupe drop bad uuid: ${d.username}`);
    assert(isValidEmail(g.email) && !isDummy(g.email), `dedupe ${g.email} not a real email`);
    if (g.pattern === "A") {
      assert(UUID_RE.test(g.realUserId!), `pattern A ${g.email}: bad realUserId`);
      assert(!g.drop.some((d) => d.userId === g.realUserId), `pattern A ${g.email}: real account is also a drop`);
      assert(g.keep === null, `pattern A ${g.email}: should have no keep`);
    } else {
      assert(g.keep && UUID_RE.test(g.keep.userId), `pattern B ${g.email}: bad keep`);
      assert(!g.drop.some((d) => d.userId === g.keep!.userId), `pattern B ${g.email}: keep also a drop`);
    }
  }
  const patA = dedupe.filter((g) => g.pattern === "A");
  const patB = dedupe.filter((g) => g.pattern === "B");
  const keepIds = new Set(patB.map((g) => g.keep!.userId));
  const realIds = new Set(patA.map((g) => g.realUserId!));
  const dropIds = new Set(dedupe.flatMap((g) => g.drop.map((d) => d.userId)));
  for (const id of dropIds) {
    assert(!keepIds.has(id), `id is both keep and drop: ${id}`);
    assert(!realIds.has(id), `id is both a pattern-A real account and a drop: ${id}`);
  }

  console.log(`DEDUPE groups            : ${dedupe.length}  (pattern A: ${patA.length}, pattern B: ${patB.length})`);
  console.log(`  pattern A  -> delete ${patA.reduce((s, g) => s + g.drop.length, 0)} placeholders, keep the real account`);
  console.log(`  pattern B  -> delete ${patB.reduce((s, g) => s + g.drop.length, 0)} placeholders, keep ${patB.length} + apply email`);
  console.log(`  total placeholder deletes: ${[...dropIds].length}`);
  console.log(`SIBLING groups           : ${siblings.length}  (${siblings.reduce((s, g) => s + g.members.length, 0)} people -> school)`);
  console.log(`COLLISION groups         : ${collisions.length}  (${collisions.reduce((s, g) => s + g.members.length, 0)} rows -> school)`);
  console.log(`blank / still-dummy rows  : ${blank.length} / ${stillDummy.length}  -> school`);
  console.log(`already-resolved dup rows : ${singleClean}`);
  console.log(`\nSCHOOL round-2 list total : ${schoolRows.length} rows`);

  // ---- child-row reassignment: every conn_request / message the drop accounts own moves to
  //      the group's target (pattern A -> realUserId, pattern B -> keeper). Detect reassignment
  //      collisions (would create a duplicate or self-connection) -> delete instead.
  const dropToTarget = new Map<string, string>();
  for (const g of dedupe) {
    const tgt = g.pattern === "A" ? g.realUserId! : g.keep!.userId;
    for (const d of g.drop) dropToTarget.set(d.userId, tgt);
  }
  const allDrops = [...dropToTarget.keys()];
  const allConn = await fetchAll<{ requester_id: string; recipient_id: string }>("connection_requests", "requester_id,recipient_id");
  const connKey = new Set<string>();
  allConn.forEach((c) => { connKey.add(`${c.requester_id}|${c.recipient_id}`); connKey.add(`${c.recipient_id}|${c.requester_id}`); });
  async function rowsIn2<T>(t: string, cols: string, col: string, ids: string[]): Promise<T[]> {
    let o: T[] = [];
    for (let i = 0; i < ids.length; i += 80) {
      const { data, error } = await sb.from(t).select(cols).in(col, ids.slice(i, i + 80));
      if (error) throw new Error(`${t}.${col}: ${error.message}`);
      o = o.concat((data ?? []) as T[]);
    }
    return o;
  }
  const dropConn = [...new Map([
    ...(await rowsIn2<{ id: string; requester_id: string; recipient_id: string }>("connection_requests", "id,requester_id,recipient_id", "requester_id", allDrops)),
    ...(await rowsIn2<{ id: string; requester_id: string; recipient_id: string }>("connection_requests", "id,requester_id,recipient_id", "recipient_id", allDrops)),
  ].map((r) => [r.id, r])).values()];
  const connReassign: string[] = [];
  const connDelete: string[] = [];
  for (const c of dropConn) {
    const nr = dropToTarget.get(c.requester_id) ?? c.requester_id;
    const nc = dropToTarget.get(c.recipient_id) ?? c.recipient_id;
    if (nr === nc || connKey.has(`${nr}|${nc}`)) connDelete.push(c.id);
    else connReassign.push(c.id);
  }
  const dropMsg = [...new Map([
    ...(await rowsIn2<{ id: string }>("messages", "id", "sender_id", allDrops)),
    ...(await rowsIn2<{ id: string }>("messages", "id", "receiver_id", allDrops)),
  ].map((r) => [r.id, r])).values()];
  const msgReassign = dropMsg.map((m) => m.id);
  console.log(`\nchild rows on ${allDrops.length} drop accounts: ${connReassign.length} conn reassign + ${connDelete.length} conn delete, ${msgReassign.length} msg reassign`);

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({
    generatedAt: new Date().toISOString(),
    target: SUPABASE_URL,
    dedupe,
    siblings,
    collisions,
    childRows: {
      dropToTarget: Object.fromEntries(dropToTarget),
      connReassign,
      connDelete,
      msgReassign,
    },
    counts: {
      patternA: dedupe.filter((g) => g.pattern === "A").length,
      patternB: dedupe.filter((g) => g.pattern === "B").length,
      deleteAccounts: [...dropIds].length,
      applyEmail: dedupe.filter((g) => g.pattern === "B").length,
      connReassign: connReassign.length,
      connDelete: connDelete.length,
      msgReassign: msgReassign.length,
      siblings: siblings.length,
      collisions: collisions.length,
      school: schoolRows.length,
    },
  }, null, 2));

  const csvCell = (s: unknown) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const csv = ["username,name,graduation_year,current_dummy_or_shared_email,user_id,reason"]
    .concat(schoolRows
      .sort((a, b) => a.reason.localeCompare(b.reason) || a.name.localeCompare(b.name))
      .map((r) => [r.username, r.name, r.grad, r.email, r.userId ?? "", r.reason].map(csvCell).join(",")))
    .join("\n") + "\n";
  writeFileSync(SCHOOL_CSV, csv);

  console.log(`\n✅  Wrote ${OUT}`);
  console.log(`✅  Wrote ${SCHOOL_CSV}`);
  console.log("\nNext: npx tsx scripts/dedupe-193-merge.ts");
}

main().catch((e) => { console.error("\n❌  Fatal:", e?.message || e); process.exit(1); });
