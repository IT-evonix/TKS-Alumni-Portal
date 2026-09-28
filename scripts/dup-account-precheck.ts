/**
 * Dup-Account Merge — LIVE DB pre-check (read-only)
 * ------------------------------------------------------------
 * Usage:
 *   npx tsx scripts/dup-account-precheck.ts
 *
 * The dummy-email fix left 181 placeholder accounts whose "real" email is already held by a
 * self-registered account. This re-derives those 181 placeholder<->real pairs against CURRENT
 * prod and works out, per pair, how to move the placeholder's child rows before deleting it.
 *
 * Emits scripts/out/dup-account-precheck.json — consumed by scripts/dup-account-merge.ts.
 * NO WRITES.
 */

import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import * as XLSX from "xlsx";

const SUPABASE_URL =
  process.env.EXPORT_SUPABASE_URL || "https://aikvtpqqxasdctchtgct.supabase.co";
const SUPABASE_SERVICE_KEY =
  process.env.EXPORT_SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpa3Z0cHFxeGFzZGN0Y2h0Z2N0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTI5ODM4OCwiZXhwIjoyMDc0ODc0Mzg4fQ.N4Y9iGXA-PnSfSd65U94NOu_QvnTnkl51LWRREzLt5s";

const ROOT = process.cwd();
const UPDATED_XLSX = resolve(ROOT, "Dummy Email Alumnis.xlsx");
const ORIGINAL_XLSX = resolve(ROOT, "dummy-email-alumni-2026-08-11.xlsx");
const PRIOR_PRECHECK = resolve(ROOT, "scripts/out/fix-dummy-emails-precheck.json");
const OUT = resolve(ROOT, "scripts/out/dup-account-precheck.json");

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const norm = (e: unknown) => String(e ?? "").trim().toLowerCase();
const isDummy = (e: unknown) => /placeholder|@student\.tks\.com/.test(norm(e));
const isValidEmail = (e: string) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(e.trim());
const JUNK_COMPANY = new Set(["", "no", "none", "n/a", "na", "-", "yes"]);

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
async function rowsIn<T>(table: string, cols: string, col: string, ids: string[]): Promise<T[]> {
  let out: T[] = [];
  for (let i = 0; i < ids.length; i += 80) {
    const { data, error } = await sb.from(table).select(cols).in(col, ids.slice(i, i + 80));
    if (error) throw new Error(`${table}.${col}: ${error.message}`);
    out = out.concat((data ?? []) as T[]);
  }
  return out;
}

interface Merge {
  placeholderUserId: string;
  placeholderUsername: string;
  placeholderEmail: string;
  placeholderAlumniId: string | null;
  realUserId: string;
  realUsername: string;
  realAlumniId: string | null;
  newEmail: string;
  connReassign: string[];
  connDelete: string[];
  msgReassign: string[];
  portCompany: string | null;
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log(" Dup-Account Merge – LIVE DB pre-check (read-only)");
  console.log(`  Target: ${SUPABASE_URL}`);
  console.log("═══════════════════════════════════════════════════════════\n");

  const prior = JSON.parse(readFileSync(PRIOR_PRECHECK, "utf8")) as { dupAccountUserIds: string[] };
  const phIds0: string[] = prior.dupAccountUserIds;
  console.log(`placeholder user_ids from dummy-email precheck: ${phIds0.length}`);

  // map placeholder user_id -> intended real email (from the sheet, joined via original export)
  const updated = readSheet(UPDATED_XLSX);
  const original = readSheet(ORIGINAL_XLSX);
  const origByUser = new Map(original.map((r) => [norm(r["Username"]), r]));
  const newEmailByUser = new Map<string, string>();
  for (const r of updated) {
    const o = origByUser.get(norm(r["Username"]));
    if (o) newEmailByUser.set(String(o["User ID"]).trim(), norm(r["Email (dummy)"]));
  }

  type U = { id: string; email: string; username: string; account_approved: boolean; account_blocked: boolean };
  type A = { id: string; user_id: string; email: string; current_company: string | null };
  const users = await fetchAll<U>("users", "id,email,username,account_approved,account_blocked");
  const alumni = await fetchAll<A>("alumni", "id,user_id,email,current_company");
  console.log(`prod users: ${users.length}   alumni: ${alumni.length}\n`);

  const uById = new Map(users.map((u) => [u.id, u]));
  const aByUser = new Map(alumni.map((a) => [a.user_id, a]));
  const uByEmail = new Map<string, U[]>();
  users.forEach((u) => uByEmail.set(norm(u.email), [...(uByEmail.get(norm(u.email)) ?? []), u]));
  const aByEmail = new Map<string, A[]>();
  alumni.forEach((a) => aByEmail.set(norm(a.email), [...(aByEmail.get(norm(a.email)) ?? []), a]));

  // Existing connection-request pair set (for collision detection on reassignment)
  const allConn = await fetchAll<{ requester_id: string; recipient_id: string }>(
    "connection_requests",
    "requester_id,recipient_id",
  );
  const connPairKey = new Set<string>();
  for (const c of allConn) {
    connPairKey.add(`${c.requester_id}|${c.recipient_id}`);
    connPairKey.add(`${c.recipient_id}|${c.requester_id}`);
  }

  // All connection_requests / messages the placeholders own
  const phConn = [
    ...(await rowsIn<{ id: string; requester_id: string; recipient_id: string; status: string }>(
      "connection_requests", "id,requester_id,recipient_id,status", "requester_id", phIds0)),
    ...(await rowsIn<{ id: string; requester_id: string; recipient_id: string; status: string }>(
      "connection_requests", "id,requester_id,recipient_id,status", "recipient_id", phIds0)),
  ];
  const phConnUniq = [...new Map(phConn.map((r) => [r.id, r])).values()];
  const phMsg = [
    ...(await rowsIn<{ id: string; sender_id: string; receiver_id: string }>(
      "messages", "id,sender_id,receiver_id", "sender_id", phIds0)),
    ...(await rowsIn<{ id: string; sender_id: string; receiver_id: string }>(
      "messages", "id,sender_id,receiver_id", "receiver_id", phIds0)),
  ];
  const phMsgUniq = [...new Map(phMsg.map((r) => [r.id, r])).values()];

  const merges: Merge[] = [];
  const clean1RowUpdate: { userId: string; newEmail: string }[] = [];
  const skipped: { placeholderUserId: string; reason: string }[] = [];

  for (const phId of phIds0) {
    const ph = uById.get(phId);
    const newEmail = newEmailByUser.get(phId) ?? "";
    if (!ph) { skipped.push({ placeholderUserId: phId, reason: "placeholder user_id no longer exists" }); continue; }
    if (!isDummy(ph.email)) { skipped.push({ placeholderUserId: phId, reason: `placeholder no longer dummy: ${ph.email}` }); continue; }
    if (!newEmail || !isValidEmail(newEmail) || isDummy(newEmail)) {
      skipped.push({ placeholderUserId: phId, reason: `bad target email: ${newEmail}` });
      continue;
    }

    const realUsers = (uByEmail.get(newEmail) ?? []).filter((u) => u.id !== phId);
    const realAlumni = (aByEmail.get(newEmail) ?? []).filter((a) => a.user_id !== phId);

    if (realUsers.length === 0 && realAlumni.length > 0) {
      // email only on alumni table (pre-existing users<>alumni mismatch) — a clean update, not a merge
      clean1RowUpdate.push({ userId: phId, newEmail });
      continue;
    }
    if (realUsers.length === 0) { skipped.push({ placeholderUserId: phId, reason: "no real account holds the email anymore" }); continue; }
    if (realUsers.length > 1) { skipped.push({ placeholderUserId: phId, reason: `${realUsers.length} real accounts hold the email` }); continue; }

    const real = realUsers[0];
    if (real.account_blocked) { skipped.push({ placeholderUserId: phId, reason: "real account is blocked" }); continue; }
    if (isDummy(real.email)) { skipped.push({ placeholderUserId: phId, reason: "real account itself still dummy" }); continue; }

    // connection_requests owned by this placeholder → reassign or delete
    const connReassign: string[] = [];
    const connDelete: string[] = [];
    for (const c of phConnUniq) {
      if (c.requester_id !== phId && c.recipient_id !== phId) continue;
      const newReq = c.requester_id === phId ? real.id : c.requester_id;
      const newRec = c.recipient_id === phId ? real.id : c.recipient_id;
      if (newReq === newRec || connPairKey.has(`${newReq}|${newRec}`)) connDelete.push(c.id);
      else connReassign.push(c.id);
    }
    const msgReassign = phMsgUniq
      .filter((mm) => mm.sender_id === phId || mm.receiver_id === phId)
      .map((mm) => mm.id);

    // company port: placeholder has a real company, real account's is junk/empty
    const phA = aByUser.get(phId);
    const realA = aByUser.get(real.id);
    const phCompany = String(phA?.current_company ?? "").trim();
    const realCompany = String(realA?.current_company ?? "").trim();
    const portCompany =
      phCompany && !JUNK_COMPANY.has(phCompany.toLowerCase()) && JUNK_COMPANY.has(realCompany.toLowerCase())
        ? phCompany
        : null;

    merges.push({
      placeholderUserId: phId,
      placeholderUsername: ph.username,
      placeholderEmail: ph.email,
      placeholderAlumniId: phA?.id ?? null,
      realUserId: real.id,
      realUsername: real.username,
      realAlumniId: realA?.id ?? null,
      newEmail,
      connReassign,
      connDelete,
      msgReassign,
      portCompany,
    });
  }

  const connReassignAll = merges.flatMap((m) => m.connReassign);
  const connDeleteAll = merges.flatMap((m) => m.connDelete);
  const msgReassignAll = merges.flatMap((m) => m.msgReassign);

  console.log(`  merges                 : ${merges.length}`);
  console.log(`  clean 1-row update     : ${clean1RowUpdate.length}  ${clean1RowUpdate.map((c) => c.newEmail).join(", ")}`);
  console.log(`  skipped                : ${skipped.length}`);
  skipped.forEach((s) => console.log(`      - ${s.placeholderUserId}: ${s.reason}`));
  console.log(`  connection_requests    : ${connReassignAll.length} reassign  +  ${connDeleteAll.length} delete  = ${connReassignAll.length + connDeleteAll.length}`);
  console.log(`  messages reassign      : ${msgReassignAll.length}`);
  console.log(`  company ports          : ${merges.filter((m) => m.portCompany).length}`);

  const payload = {
    generatedAt: new Date().toISOString(),
    target: SUPABASE_URL,
    dbUserCount: users.length,
    merges,
    clean1RowUpdate,
    skipped,
    totals: {
      merges: merges.length,
      connReassign: connReassignAll.length,
      connDelete: connDeleteAll.length,
      msgReassign: msgReassignAll.length,
      companyPorts: merges.filter((m) => m.portCompany).length,
    },
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(payload, null, 2));
  console.log(`\n✅  Wrote ${OUT}`);
  console.log("\nNext: npx tsx scripts/dup-account-merge.ts");
}

main().catch((e) => {
  console.error("\n❌  Fatal:", e?.message || e);
  process.exit(1);
});
