/**
 * Full cleanup analyzer — categorize EVERY remaining data-quality issue in users/alumni.
 *   npx tsx scripts/full-cleanup-analyze.ts
 *
 * Read-only. Emits scripts/out/full-cleanup-analysis.json + per-category CSVs.
 */

import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";

const SUPABASE_URL = process.env.EXPORT_SUPABASE_URL || "https://aikvtpqqxasdctchtgct.supabase.co";
const SUPABASE_SERVICE_KEY =
  process.env.EXPORT_SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpa3Z0cHFxeGFzZGN0Y2h0Z2N0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTI5ODM4OCwiZXhwIjoyMDc0ODc0Mzg4fQ.N4Y9iGXA-PnSfSd65U94NOu_QvnTnkl51LWRREzLt5s";

const OUT_DIR = resolve(process.cwd(), "scripts/out");
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const norm = (e: unknown) => String(e ?? "").trim().toLowerCase();
const isDummy = (e: unknown) => /placeholder|@student\.tks\.com/.test(norm(e));
const VALID = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const DISPOSABLE = /@(yopmail|mailinator|guerrillamail|10minutemail|tempmail|trashmail|throwaway|sharklasers|getnada)\./i;
const INTERNAL = /@(thekalyanischool|indusschoolpune)\.(com|edu\.in|org)$/i;
const TYPO_TLD = /\.(con|cmo|vom|xom|co$|c0m|gmial\.com|gmai\.com|gmil\.com|gamil\.com|hotmial\.com|yaho\.com|outlok\.com)$/i;
const canon = (s: string) => norm(s).replace(/[^a-z0-9]/g, "");

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
// Build one map of user_id -> activity count by pulling every relevant table ONCE.
async function buildActivityMap(alumniIdToUser: Map<string, string>): Promise<Map<string, number>> {
  const m = new Map<string, number>();
  const bump = (uid: string | undefined) => { if (uid) m.set(uid, (m.get(uid) ?? 0) + 1); };
  // Real user actions only — NOT notifications (everyone gets welcome notifications).
  const tablesByUser: [string, string][] = [
    ["feed_posts", "author_id"], ["post_comments", "user_id"], ["post_likes", "user_id"],
    ["connection_requests", "requester_id"], ["connection_requests", "recipient_id"],
    ["messages", "sender_id"], ["messages", "receiver_id"], ["event_rsvps", "user_id"],
    ["blog_posts", "author_id"], ["job_applications", "user_id"], ["saved_jobs", "user_id"],
    ["blog_comments", "author_id"], ["post_comment_replies", "user_id"],
  ];
  for (const [t, col] of tablesByUser) {
    try {
      for (const r of await fetchAll<Record<string, string>>(t, col)) bump(r[col]);
    } catch { /* table may not exist */ }
  }
  // alumni_* keyed by alumni_id -> map to user
  for (const t of ["alumni_experiences", "alumni_skills", "alumni_certifications", "alumni_projects", "alumni_achievements"]) {
    try {
      for (const r of await fetchAll<{ alumni_id: string }>(t, "alumni_id")) bump(alumniIdToUser.get(r.alumni_id));
    } catch { /* */ }
  }
  return m;
}

interface U { id: string; email: string; username: string; account_approved: boolean; account_blocked: boolean; user_role: string; is_admin: boolean; created_at: string; updated_at: string }
interface A { id: string; user_id: string; email: string; first_name: string; last_name: string; graduation_year: unknown; batch: string; phone: string; roll_number: string; date_of_birth: unknown }

async function main() {
  console.log("Full cleanup analysis — reading prod...\n");
  const users = await fetchAll<U>("users", "id,email,username,account_approved,account_blocked,user_role,is_admin,created_at,updated_at");
  const alumni = await fetchAll<A>("alumni", "id,user_id,email,first_name,last_name,graduation_year,batch,phone,roll_number,date_of_birth");
  const uById = new Map(users.map((u) => [u.id, u]));
  const aByUser = new Map(alumni.map((a) => [a.user_id, a]));
  const alumniIdToUser = new Map(alumni.map((a) => [a.id, a.user_id]));
  console.log(`users ${users.length}  alumni ${alumni.length}`);
  console.log("building activity map...");
  const activity = await buildActivityMap(alumniIdToUser);
  console.log(`activity map: ${activity.size} accounts have activity\n`);

  const cat: Record<string, any[]> = {
    dummy: [], malformed: [], disposable: [], internal_domain: [], typo_tld: [],
    no_alumni_row: [], test_account: [], same_name_diff_year: [], same_name_same_year: [],
  };

  // --- per-account email quality ---
  for (const u of users) {
    const a = aByUser.get(u.id);
    const e = norm(u.email);
    const row = { user_id: u.id, username: u.username, name: a ? `${a.first_name} ${a.last_name}`.trim() : "(no alumni)", grad: a?.graduation_year ?? "", email: u.email, approved: u.account_approved, role: u.user_role };
    if (isDummy(e)) cat.dummy.push(row);
    else if (!e || !VALID.test(e)) {
      if (/^mailto:/i.test(u.email) || /\s/.test(u.email) || u.email.includes("@@")) cat.malformed.push({ ...row, issue: "malformed" });
      else if (!e) cat.malformed.push({ ...row, issue: "blank" });
      else cat.malformed.push({ ...row, issue: "invalid" });
    } else if (DISPOSABLE.test(e)) cat.disposable.push(row);
    else if (INTERNAL.test(e)) cat.internal_domain.push(row);
    else if (TYPO_TLD.test(e)) cat.typo_tld.push({ ...row, issue: "TLD typo" });

    if (!a) {
      const isTest = /^(om|admin|vijay|test|prashant|developer)/i.test(u.username) || /@(gmail\.com|rt\.co|5353\.co)$/.test(e) && /^(om|admin|vijay|prashant)/i.test(u.username);
      cat.no_alumni_row.push({ ...row, is_admin: u.is_admin, created: u.created_at?.slice(0, 10), likely_test: /^(om|admin|vijay|prashant|developer)/i.test(u.username) });
    }
  }

  // --- test accounts (heuristic) ---
  for (const u of users) {
    if (/^(om|admin|vijay|test\d*|demo|prashant(kalyani\d+|_\w+|)|developerprashant\d*)$/i.test(u.username) && !isDummy(u.email)) {
      const a = aByUser.get(u.id);
      cat.test_account.push({ user_id: u.id, username: u.username, email: u.email, name: a ? `${a.first_name} ${a.last_name}` : "(no alumni)", role: u.user_role, is_admin: u.is_admin, created: u.created_at?.slice(0, 10) });
    }
  }

  // --- same person: group by canonical(first+last) ---
  const byName = new Map<string, A[]>();
  for (const a of alumni) {
    const k = `${canon(a.first_name)}|${canon(a.last_name)}`;
    byName.set(k, [...(byName.get(k) ?? []), a]);
  }
  for (const [k, group] of byName) {
    if (group.length < 2) continue;
    const years = new Set(group.map((a) => a.graduation_year));
    const bucket = years.size > 1 ? cat.same_name_diff_year : cat.same_name_same_year;
    const members = group.map((a) => {
      const u = uById.get(a.user_id);
      return {
        user_id: a.user_id, alumni_id: a.id, username: u?.username, email: a.email,
        first: a.first_name, last: a.last_name, grad: a.graduation_year, batch: a.batch,
        approved: u?.account_approved, dummy: isDummy(a.email), phone: a.phone || "",
        roll: /^\d+$/.test(String(a.roll_number || "")) ? a.roll_number : "",
        activity: activity.get(a.user_id) ?? 0,
        created: u?.created_at?.slice(0, 10),
      };
    });
    bucket.push({ key: k, count: group.length, members });
  }

  // report
  console.log("═══ CATEGORY COUNTS ═══");
  for (const [name, arr] of Object.entries(cat)) {
    if (name === "same_name_diff_year" || name === "same_name_same_year") {
      const accts = arr.reduce((s: number, g: any) => s + g.count, 0);
      console.log(`  ${name.padEnd(22)} : ${String(arr.length).padStart(4)} groups  (${accts} accounts)`);
    } else {
      console.log(`  ${name.padEnd(22)} : ${String(arr.length).padStart(4)}`);
    }
  }

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(resolve(OUT_DIR, "full-cleanup-analysis.json"), JSON.stringify({ generatedAt: new Date().toISOString(), userCount: users.length, alumniCount: alumni.length, categories: cat }, null, 2));

  // CSVs for the human-review categories
  const csv = (rows: any[], cols: string[]) => [cols.join(",")].concat(rows.map((r) => cols.map((c) => `"${String(r[c] ?? "").replace(/"/g, '""')}"`).join(","))).join("\n") + "\n";
  writeFileSync(resolve(OUT_DIR, "cat-malformed.csv"), csv(cat.malformed, ["username", "name", "grad", "email", "issue"]));
  writeFileSync(resolve(OUT_DIR, "cat-disposable.csv"), csv(cat.disposable, ["username", "name", "grad", "email", "role"]));
  writeFileSync(resolve(OUT_DIR, "cat-internal-domain.csv"), csv(cat.internal_domain, ["username", "name", "grad", "email", "role"]));
  writeFileSync(resolve(OUT_DIR, "cat-typo-tld.csv"), csv(cat.typo_tld, ["username", "name", "grad", "email", "issue"]));
  writeFileSync(resolve(OUT_DIR, "cat-no-alumni-row.csv"), csv(cat.no_alumni_row, ["username", "email", "role", "is_admin", "created", "likely_test"]));
  writeFileSync(resolve(OUT_DIR, "cat-test-accounts.csv"), csv(cat.test_account, ["username", "email", "name", "role", "is_admin", "created"]));

  // flatten dupe groups to one row per account
  const flat = (groups: any[]) => groups.flatMap((g) => g.members.map((m: any) => ({ group: g.key, group_size: g.count, ...m })));
  writeFileSync(resolve(OUT_DIR, "cat-dupes-diff-year.csv"), csv(flat(cat.same_name_diff_year), ["group", "group_size", "username", "first", "last", "grad", "batch", "email", "dummy", "approved", "activity", "phone", "roll", "created", "user_id"]));
  writeFileSync(resolve(OUT_DIR, "cat-dupes-same-year.csv"), csv(flat(cat.same_name_same_year), ["group", "group_size", "username", "first", "last", "grad", "batch", "email", "dummy", "approved", "activity", "phone", "roll", "created", "user_id"]));

  console.log(`\n✅  Wrote scripts/out/full-cleanup-analysis.json + 8 category CSVs`);
}

main().catch((e) => { console.error("\n❌ ", e?.message || e); process.exit(1); });
