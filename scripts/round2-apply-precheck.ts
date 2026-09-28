/**
 * Round-2 apply pre-check — school-filled "Copy of Pending Students.xlsx"
 * ------------------------------------------------------------
 *   npx tsx scripts/round2-apply-precheck.ts
 *
 * Reads the school-returned sheet, cross-checks LIVE prod, classifies each of the 33 rows,
 * plans child-row reassignment for deletes, and emits scripts/out/round2-apply-precheck.json.
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
const SHEET = resolve(ROOT, "Copy of Pending Students.xlsx");
const OUT = resolve(ROOT, "scripts/out/round2-apply-precheck.json");

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const norm = (e: unknown) => String(e ?? "").trim().toLowerCase();
const isDummy = (e: unknown) => /placeholder|@student\.tks\.com/.test(norm(e));
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// ── Explicit per-row decisions confirmed with the user (2026-09-10) ──
// username -> override. "delete" (with optional childTarget), "rename" (+email), "keep" (round3).
const OVERRIDE: Record<string, { action: "delete" | "rename" | "keep"; email?: string; firstName?: string; lastName?: string; childTargetUsername?: string; note: string }> = {
  "salma.deshpande":  { action: "delete", note: "staff, not an alumnus" },
  "shriya.kalyani":   { action: "delete", note: "no email from school; delete per user" },
  // user (2026-09-10): Anandi's real email is anandisingh03@gmail.com, and she already has a
  // real account (anandisingh03_mlf0r7k5) holding it -> delete this placeholder, reassign child rows.
  "anandi.singh":     { action: "delete", childTargetUsername: "anandisingh03_mlf0r7k5", note: "real account anandisingh03_mlf0r7k5 already holds her real email" },
  "aishwary.tiwari":  { action: "rename", firstName: "Apekshya", lastName: "Mohanty", email: "debarchana.mohanty@rediffmail.com", note: "school: real person is Apekshya Mohanty, keeps this email" },
  "apekshya.mohanty": { action: "delete", note: "school: duplicate of the renamed aishwary.tiwari row" },
  "nanki.puri":       { action: "keep", note: "school gave sibling Seema's shared email; Nanki needs her own -> round 3" },
  // shreyaan.jinturkar: same person as shreyaanjinturkar_b44rn8 which holds the email; delete placeholder,
  //                     move its 3 connection_requests to the real account
  "shreyaan.jinturkar": { action: "delete", childTargetUsername: "shreyaanjinturkar_b44rn8", note: "dupe of real account; reassign child rows" },
  // seema.puri: school 'duplicate'; its 1 connection_request -> nanki.puri (the surviving sibling)
  "seema.puri":       { action: "delete", childTargetUsername: "nanki.puri", note: "school duplicate; child row -> nanki.puri" },
};

interface Plan {
  sr: number;
  username: string;
  name: string;
  grad: unknown;
  userId: string;
  alumniId: string;
  currentEmail: string;
  action: "apply_email" | "rename_and_apply" | "delete" | "keep_round3";
  newEmail?: string;
  newFirstName?: string;
  newLastName?: string;
  childTargetUserId?: string;   // delete: reassign conn/msg here
  deleteChildRows?: boolean;    // delete: no target -> drop the child rows
  note: string;
}

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

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log(" Round-2 apply pre-check (Copy of Pending Students.xlsx)");
  console.log("═══════════════════════════════════════════════════════════\n");

  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(
    XLSX.read(readFileSync(SHEET), { type: "buffer" }).Sheets["school-round2"],
    { defval: "", blankrows: false },
  );
  console.log(`sheet rows: ${rows.length}`);

  type U = { id: string; email: string; username: string; account_approved: boolean; account_blocked: boolean };
  type A = { id: string; user_id: string; email: string; first_name: string; last_name: string };
  const users = await fetchAll<U>("users", "id,email,username,account_approved,account_blocked");
  const alumni = await fetchAll<A>("alumni", "id,user_id,email,first_name,last_name");
  const uById = new Map(users.map((u) => [u.id, u]));
  const uByUsername = new Map(users.map((u) => [norm(u.username), u]));
  const aByUser = new Map(alumni.map((a) => [a.user_id, a]));
  const uByEmail = new Map<string, U[]>();
  users.forEach((u) => uByEmail.set(norm(u.email), [...(uByEmail.get(norm(u.email)) ?? []), u]));
  const aByEmail = new Map<string, A[]>();
  alumni.forEach((a) => aByEmail.set(norm(a.email), [...(aByEmail.get(norm(a.email)) ?? []), a]));

  const plans: Plan[] = [];
  const problems: string[] = [];

  for (const r of rows) {
    const username = String(r["username"]);
    const u = uByUsername.get(norm(username));
    const raw = String(r["Real Email ID"] ?? "").trim();
    const base = {
      sr: Number(r["Sr. No"]),
      username,
      name: String(r["name"]),
      grad: r["graduation_year"],
      userId: u?.id ?? "",
      alumniId: u ? aByUser.get(u.id)?.id ?? "" : "",
      currentEmail: u?.email ?? "",
    };

    if (!u) { problems.push(`${username}: user_id/username not found in DB`); continue; }
    if (!isDummy(u.email)) { problems.push(`${username}: already NON-dummy (${u.email}) — skip`); continue; }

    const ov = OVERRIDE[norm(username)];
    if (ov) {
      if (ov.action === "keep") { plans.push({ ...base, action: "keep_round3", note: ov.note }); continue; }
      if (ov.action === "rename") {
        const email = norm(ov.email!);
        const uColl = (uByEmail.get(email) ?? []).filter((x) => x.id !== u.id);
        const aColl = (aByEmail.get(email) ?? []).filter((x) => x.user_id !== u.id);
        if (uColl.length || aColl.length) { problems.push(`${username}: rename email ${email} collides`); continue; }
        plans.push({ ...base, action: "rename_and_apply", newEmail: email, newFirstName: ov.firstName, newLastName: ov.lastName, note: ov.note });
        continue;
      }
      // delete
      let childTargetUserId: string | undefined;
      let deleteChildRows = false;
      if (ov.childTargetUsername) {
        const t = uByUsername.get(norm(ov.childTargetUsername));
        if (!t) { problems.push(`${username}: childTarget ${ov.childTargetUsername} not found`); continue; }
        childTargetUserId = t.id;
      } else {
        deleteChildRows = true;
      }
      plans.push({ ...base, action: "delete", childTargetUserId, deleteChildRows, note: ov.note });
      continue;
    }

    // No override: classify from the school's answer
    if (!raw) { problems.push(`${username}: blank email, no override`); continue; }
    if (/please\s*delete/i.test(raw) || /^duplicate/i.test(raw)) {
      plans.push({ ...base, action: "delete", deleteChildRows: true, note: `school: ${raw}` });
      continue;
    }
    if (/^staff$|^teacher$/i.test(raw)) { problems.push(`${username}: 'staff' with no override`); continue; }

    const m = raw.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (!m || !EMAIL_RE.test(m[0])) { problems.push(`${username}: unparseable answer "${raw}"`); continue; }
    const email = norm(m[0]);

    // collision? -> the person already has a real account with this email -> delete the placeholder
    const uColl = (uByEmail.get(email) ?? []).filter((x) => x.id !== u.id);
    const aColl = (aByEmail.get(email) ?? []).filter((x) => x.user_id !== u.id);
    if (uColl.length || aColl.length) {
      const realU = uColl[0] ?? uById.get(aColl[0].user_id);
      if (!realU || isDummy(realU.email) || realU.account_blocked) {
        problems.push(`${username}: email ${email} held by a questionable account`);
        continue;
      }
      // reassign child rows of the placeholder to the real account
      plans.push({ ...base, action: "delete", childTargetUserId: realU.id, note: `email held by real account ${realU.username}; delete placeholder, reassign child rows` });
      continue;
    }

    plans.push({ ...base, action: "apply_email", newEmail: email, note: "school-provided real email, no collision" });
  }

  // ── child-row reassignment planning for the deletes ──
  const deletes = plans.filter((p) => p.action === "delete");
  const deleteIds = deletes.map((p) => p.userId);
  const targetByDrop = new Map(deletes.filter((p) => p.childTargetUserId).map((p) => [p.userId, p.childTargetUserId!]));

  const allConn = await fetchAll<{ requester_id: string; recipient_id: string }>("connection_requests", "requester_id,recipient_id");
  const connKey = new Set<string>();
  allConn.forEach((c) => { connKey.add(`${c.requester_id}|${c.recipient_id}`); connKey.add(`${c.recipient_id}|${c.requester_id}`); });

  const dropConn = [...new Map([
    ...(await rowsIn<{ id: string; requester_id: string; recipient_id: string }>("connection_requests", "id,requester_id,recipient_id", "requester_id", deleteIds)),
    ...(await rowsIn<{ id: string; requester_id: string; recipient_id: string }>("connection_requests", "id,requester_id,recipient_id", "recipient_id", deleteIds)),
  ].map((r) => [r.id, r])).values()];
  const connReassign: string[] = [];
  const connDelete: string[] = [];
  for (const c of dropConn) {
    const tReq = targetByDrop.get(c.requester_id);
    const tRec = targetByDrop.get(c.recipient_id);
    if (!tReq && !tRec) { connDelete.push(c.id); continue; }       // no target -> drop
    const nr = tReq ?? c.requester_id;
    const nc = tRec ?? c.recipient_id;
    if (nr === nc || connKey.has(`${nr}|${nc}`)) connDelete.push(c.id);
    else connReassign.push(c.id);
  }
  const dropMsg = [...new Map([
    ...(await rowsIn<{ id: string; sender_id: string; receiver_id: string }>("messages", "id,sender_id,receiver_id", "sender_id", deleteIds)),
    ...(await rowsIn<{ id: string; sender_id: string; receiver_id: string }>("messages", "id,sender_id,receiver_id", "receiver_id", deleteIds)),
  ].map((r) => [r.id, r])).values()];
  const msgReassign: string[] = [];
  const msgDelete: string[] = [];
  for (const mm of dropMsg) {
    const t = targetByDrop.get(mm.sender_id) ?? targetByDrop.get(mm.receiver_id);
    if (t) msgReassign.push(mm.id); else msgDelete.push(mm.id);
  }

  // preflight — blocking child rows (no cascade) other than conn/msg
  const blockers: Record<string, number> = {};
  for (const [t, col] of [["feed_posts", "author_id"], ["user_blocks", "blocker_id"], ["user_blocks", "blocked_id"], ["events", "organized_by"], ["signup_requests", "reviewed_by"]] as const) {
    let n = 0;
    for (let i = 0; i < deleteIds.length; i += 80) {
      const { count } = await sb.from(t).select("*", { count: "exact", head: true }).in(col, deleteIds.slice(i, i + 80));
      n += count ?? 0;
    }
    blockers[`${t}.${col}`] = n;
  }

  const applyEmail = plans.filter((p) => p.action === "apply_email");
  const rename = plans.filter((p) => p.action === "rename_and_apply");
  const keep = plans.filter((p) => p.action === "keep_round3");

  console.log(`\nplans: ${plans.length}   problems: ${problems.length}`);
  console.log(`  apply_email      : ${applyEmail.length}`);
  console.log(`  rename_and_apply : ${rename.length}`);
  console.log(`  delete           : ${deletes.length}  (with child-target: ${deletes.filter((p) => p.childTargetUserId).length})`);
  console.log(`  keep (round 3)   : ${keep.length}`);
  console.log(`\nchild rows on deletes: conn ${connReassign.length} reassign / ${connDelete.length} delete, msg ${msgReassign.length} reassign / ${msgDelete.length} delete`);
  console.log(`preflight blockers  : ${JSON.stringify(blockers)}`);
  if (problems.length) { console.log("\n⚠️  PROBLEMS:"); problems.forEach((p) => console.log(`   ${p}`)); }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({
    generatedAt: new Date().toISOString(),
    plans, problems,
    childRows: { connReassign, connDelete, msgReassign, msgDelete, targetByDrop: Object.fromEntries(targetByDrop) },
    blockers,
    counts: {
      applyEmail: applyEmail.length, rename: rename.length, delete: deletes.length, keep: keep.length,
      connReassign: connReassign.length, connDelete: connDelete.length, msgReassign: msgReassign.length, msgDelete: msgDelete.length,
    },
  }, null, 2));
  console.log(`\n✅  Wrote ${OUT}`);
}

main().catch((e) => { console.error("\n❌  Fatal:", e?.message || e); process.exit(1); });
