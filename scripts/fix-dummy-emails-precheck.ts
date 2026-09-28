/**
 * Fix Dummy Alumni Emails — LIVE DB pre-check
 * ------------------------------------------------------------
 * Usage:
 *   npx tsx scripts/fix-dummy-emails-precheck.ts
 *
 * Connects to PROD Supabase (read-only) and, for every "update"-bucket row the generator
 * would produce, checks whether the target's NEW email already belongs to a different,
 * already-self-registered account.
 *
 * Emits scripts/out/fix-dummy-emails-precheck.json:
 *   {
 *     generatedAt, dbUserCount,
 *     cleanUserIds:  string[]   // safe to UPDATE now
 *     dupAccountUserIds: string[] // owner already has a real account -> handle via dup-merge plan
 *     dupDetails: [...]          // placeholder <-> real account pairing + child-row footprint
 *   }
 *
 * The generator (scripts/fix-dummy-emails.ts) reads this file and moves dupAccountUserIds
 * out of the UPDATE bucket into a new "dupAccount" bucket (skip + report; no SQL emitted for them).
 *
 * NO WRITES. Uses the same hardcoded prod service key as scripts/export-*.ts.
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
const OUT = resolve(ROOT, "scripts/out/fix-dummy-emails-precheck.json");

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const norm = (e: unknown) => String(e ?? "").trim().toLowerCase();
const isDummy = (e: unknown) => /placeholder|@student\.tks\.com/.test(norm(e));
const isValidEmail = (e: string) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(e.trim());
const DELETE_MARKER_RE = /\b(pls\s*)?(to\s*be\s*)?delet/i;

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

async function countIn(table: string, col: string, ids: string[]): Promise<number> {
  let total = 0;
  for (let i = 0; i < ids.length; i += 100) {
    const { count, error } = await sb
      .from(table)
      .select("*", { count: "exact", head: true })
      .in(col, ids.slice(i, i + 100));
    if (error) return -1;
    total += count ?? 0;
  }
  return total;
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log(" Dummy Email Fix – LIVE DB pre-check (read-only)");
  console.log(`  Target: ${SUPABASE_URL}`);
  console.log("═══════════════════════════════════════════════════════════\n");

  // Rebuild the "update-eligible" set exactly as the generator would (username -> userId + newEmail)
  const updated = readSheet(UPDATED_XLSX);
  const original = readSheet(ORIGINAL_XLSX);
  const origByUser = new Map<string, { userId: string; oldEmail: string }>();
  for (const r of original) {
    origByUser.set(norm(r["Username"]), {
      userId: String(r["User ID"] ?? "").trim(),
      oldEmail: norm(r["Email (dummy)"]),
    });
  }

  // emails duplicated within the sheet are already excluded by the generator's dup bucket
  const freq = new Map<string, number>();
  for (const r of updated) {
    if (DELETE_MARKER_RE.test(String(r["Branch"])) || DELETE_MARKER_RE.test(String(r["Course"]))) continue;
    const e = norm(r["Email (dummy)"]);
    if (!e || isDummy(e) || !isValidEmail(e)) continue;
    freq.set(e, (freq.get(e) ?? 0) + 1);
  }
  const sheetDupEmails = new Set([...freq].filter(([, n]) => n > 1).map(([e]) => e));

  const eligible: { userId: string; username: string; newEmail: string }[] = [];
  for (const r of updated) {
    const u = norm(r["Username"]);
    if (DELETE_MARKER_RE.test(String(r["Branch"])) || DELETE_MARKER_RE.test(String(r["Course"]))) continue;
    const e = norm(r["Email (dummy)"]);
    if (!e || isDummy(e) || !isValidEmail(e) || sheetDupEmails.has(e)) continue;
    const orig = origByUser.get(u);
    if (!orig?.userId) continue;
    eligible.push({ userId: orig.userId, username: u, newEmail: e });
  }
  console.log(`update-eligible rows (matches generator's UPDATE bucket): ${eligible.length}\n`);

  // Live users table
  type U = { id: string; email: string; username: string; user_role: string; account_approved: boolean; created_at: string };
  const users = await fetchAll<U>("users", "id,email,username,user_role,account_approved,created_at");
  console.log(`users in prod: ${users.length}`);
  const byId = new Map(users.map((u) => [u.id, u]));
  const byEmail = new Map<string, U[]>();
  for (const u of users) {
    const k = norm(u.email);
    byEmail.set(k, [...(byEmail.get(k) ?? []), u]);
  }

  // Live alumni table — has its own UNIQUE(email); a new email must not collide here either.
  type A = { id: string; user_id: string; email: string };
  const alumniAll = await fetchAll<A>("alumni", "id,user_id,email");
  const aluByEmail = new Map<string, A[]>();
  for (const a of alumniAll) {
    const k = norm(a.email);
    aluByEmail.set(k, [...(aluByEmail.get(k) ?? []), a]);
  }

  const cleanUserIds: string[] = [];
  const dupAccountUserIds: string[] = [];
  const dupDetails: Record<string, unknown>[] = [];
  const targetNotFound: string[] = [];
  const targetNotDummy: string[] = [];

  for (const row of eligible) {
    const target = byId.get(row.userId);
    if (!target) { targetNotFound.push(row.userId); continue; }
    if (!isDummy(target.email)) targetNotDummy.push(row.userId);
    const uHolders = (byEmail.get(row.newEmail) ?? []).filter((h) => h.id !== row.userId);
    const aHolders = (aluByEmail.get(row.newEmail) ?? []).filter((h) => h.user_id !== row.userId);
    if (uHolders.length === 0 && aHolders.length === 0) {
      cleanUserIds.push(row.userId);
    } else {
      dupAccountUserIds.push(row.userId);
      const h = uHolders[0];
      dupDetails.push({
        newEmail: row.newEmail,
        placeholderUserId: row.userId,
        placeholderUsername: target.username,
        placeholderEmail: target.email,
        realUserId: h?.id ?? null,
        realUsername: h?.username ?? null,
        realEmail: h?.email ?? null,
        realRole: h?.user_role ?? null,
        realApproved: h?.account_approved ?? null,
        usersHolderCount: uHolders.length,
        alumniHolderCount: aHolders.length,
        collidesOnAlumniOnly: uHolders.length === 0 && aHolders.length > 0,
      });
    }
  }

  console.log(`\n  clean (safe to UPDATE now)      : ${cleanUserIds.length}`);
  console.log(`  dup-account (owner self-registered): ${dupAccountUserIds.length}`);
  console.log(`  target user_id not found         : ${targetNotFound.length}`);
  console.log(`  target already non-dummy         : ${targetNotDummy.length}`);

  // Child-row footprint of the dup-account placeholders (for the dup-merge plan)
  const dupIds = [...new Set(dupAccountUserIds)];
  const aluRows = await fetchAll<{ id: string; user_id: string }>("alumni", "id,user_id").then((rs) =>
    rs.filter((a) => dupIds.includes(a.user_id)),
  );
  const aluIds = aluRows.map((a) => a.id);

  console.log("\n  dup-account placeholder child-row footprint:");
  const footprint: Record<string, number> = {};
  for (const [t, c] of [
    ["connection_requests", "recipient_id"],
    ["connection_requests", "requester_id"],
    ["messages", "receiver_id"],
    ["messages", "sender_id"],
    ["notifications", "user_id"],
    ["event_rsvps", "user_id"],
    ["post_likes", "user_id"],
    ["post_comments", "user_id"],
    ["feed_posts", "author_id"],
  ] as const) {
    const n = await countIn(t, c, dupIds);
    footprint[`${t}.${c}`] = n;
    console.log(`    ${t}.${c}: ${n}`);
  }
  for (const t of ["alumni_experiences", "alumni_skills", "alumni_certifications", "alumni_projects"]) {
    const n = await countIn(t, "alumni_id", aluIds);
    footprint[t] = n;
    console.log(`    ${t}: ${n}`);
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    target: SUPABASE_URL,
    dbUserCount: users.length,
    eligibleCount: eligible.length,
    cleanUserIds: cleanUserIds.sort(),
    dupAccountUserIds: dupAccountUserIds.sort(),
    targetNotFound,
    targetNotDummy,
    dupDetails,
    dupAccountChildFootprint: footprint,
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(payload, null, 2));
  console.log(`\n✅  Wrote ${OUT}`);
  console.log("\nNext: npx tsx scripts/fix-dummy-emails.ts  (it now reads this file)");
}

main().catch((e) => {
  console.error("\n❌  Fatal:", e?.message || e);
  process.exit(1);
});
