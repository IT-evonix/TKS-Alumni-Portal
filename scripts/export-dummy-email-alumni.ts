/**
 * Export Alumni With Placeholder / TKS Dummy Emails to Excel
 * ------------------------------------------------------------
 * Usage:
 *   npx tsx scripts/export-dummy-email-alumni.ts
 *
 * Finds every alumni whose email domain contains "tks.com" or "placeholder"
 * (case-insensitive) and writes their core profile to a dated .xlsx file
 * in the repo root, so real emails can be collected for them.
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { writeFileSync } from "fs";
import { resolve } from "path";
import * as XLSX from "xlsx";

dotenv.config({ path: resolve(process.cwd(), ".env") });

// NOTE: .env's active SUPABASE_URL/keys point at a small (~40-row) secondary/test
// project. The real production alumni data (1,539 rows, incl. the placeholder/tks.com
// dummy emails this script targets) lives in the project below, which is present in
// .env only as commented-out lines. Override explicitly here rather than relying on
// the active .env values, which would silently export from the wrong project.
const SUPABASE_URL = process.env.EXPORT_SUPABASE_URL || "https://aikvtpqqxasdctchtgct.supabase.co";
const SUPABASE_SERVICE_KEY =
  process.env.EXPORT_SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpa3Z0cHFxeGFzZGN0Y2h0Z2N0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTI5ODM4OCwiZXhwIjoyMDc0ODc0Mzg4fQ.N4Y9iGXA-PnSfSd65U94NOu_QvnTnkl51LWRREzLt5s";

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌  Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const PAGE_SIZE = 1000;

async function fetchAllAlumni(): Promise<any[]> {
  let from = 0;
  let all: any[] = [];
  while (true) {
    const { data, error } = await supabase
      .from("alumni")
      .select("*")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    all = all.concat(data ?? []);
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

async function fetchUsersByIds(userIds: string[]): Promise<Map<string, any>> {
  const usersById = new Map<string, any>();
  const chunkSize = 100;
  for (let i = 0; i < userIds.length; i += chunkSize) {
    const chunk = userIds.slice(i, i + chunkSize);
    let lastErr: any = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const { data, error } = await supabase
          .from("users")
          .select("id, username, user_role, account_approved, account_blocked, created_at")
          .in("id", chunk);
        if (error) throw error;
        (data ?? []).forEach((u) => usersById.set(u.id, u));
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }
    if (lastErr) throw lastErr;
  }
  return usersById;
}

function isDummyEmail(email: string | null | undefined): boolean {
  if (!email || !email.includes("@")) return false;
  const domain = email.toLowerCase().split("@")[1] ?? "";
  return domain.includes("tks.com") || domain.includes("placeholder");
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log(" TKS Alumni Portal – Dummy/Placeholder Email Export");
  console.log("═══════════════════════════════════════════════════════════\n");

  console.log("📥  Fetching all alumni records...");
  const alumniRows = await fetchAllAlumni();
  console.log(`✅  Fetched ${alumniRows.length} alumni records total\n`);

  const blankEmailRows = alumniRows.filter((a) => !a.email || !a.email.trim());
  const dummyRows = alumniRows.filter((a) => isDummyEmail(a.email));

  console.log(`⚠️   Blank/missing email (excluded from this report): ${blankEmailRows.length}`);
  console.log(`🎯  Matched dummy (tks.com / placeholder) emails: ${dummyRows.length}\n`);

  if (dummyRows.length === 0) {
    console.log("Nothing to export. Exiting.");
    return;
  }

  const userIds = [...new Set(dummyRows.map((a) => a.user_id).filter(Boolean))];
  console.log(`📥  Fetching ${userIds.length} linked user account records...`);
  const usersById = await fetchUsersByIds(userIds);
  console.log(`✅  Fetched ${usersById.size} user records\n`);

  const rows = dummyRows.map((a) => {
    const u = usersById.get(a.user_id) ?? {};
    return {
      "Alumni ID": a.id ?? "",
      "User ID": a.user_id ?? "",
      "First Name": a.first_name ?? "",
      "Last Name": a.last_name ?? "",
      "Email (dummy)": a.email ?? "",
      "Phone": a.phone ?? "",
      "Date of Birth": a.date_of_birth ?? "",
      "Gender": a.gender ?? "",
      "Graduation Year": a.graduation_year ?? "",
      "Batch": a.batch ?? "",
      "Course": a.course ?? "",
      "Branch": a.branch ?? "",
      "Roll Number": a.roll_number ?? "",
      "CGPA": a.cgpa ?? "",
      "Current City": a.current_city ?? "",
      "Current State": a.current_state ?? "",
      "Current Country": a.current_country ?? "",
      "Permanent Address": a.permanent_address ?? "",
      "Current Company": a.current_company ?? "",
      "Current Role": a.current_role ?? "",
      "Industry": a.industry ?? "",
      "Experience": a.experience ?? "",
      "Higher Education": a.higher_education ?? "",
      "University": a.university ?? "",
      "LinkedIn URL": a.linkedin_url ?? "",
      "GitHub URL": a.github_url ?? "",
      "Twitter URL": a.twitter_url ?? "",
      "Personal Website": a.personal_website ?? "",
      "Profile Public": a.is_profile_public ?? "",
      "Verified": a.is_verified ?? "",
      "Active": a.is_active ?? "",
      "Username": u.username ?? "",
      "Account Approved": u.account_approved ?? "",
      "Account Blocked": u.account_blocked ?? "",
      "User Role": u.user_role ?? "",
      "Alumni Created At": a.created_at ?? "",
      "Alumni Updated At": a.updated_at ?? "",
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Dummy Email Alumni");

  const dateStr = new Date().toISOString().slice(0, 10);
  const outDir = process.env.EXPORT_OUT_DIR || process.cwd();
  const outPath = resolve(outDir, `dummy-email-alumni-${dateStr}.xlsx`);
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  writeFileSync(outPath, buf);

  console.log("══════════════════════════════════════════════════════════");
  console.log(` EXPORT COMPLETE`);
  console.log(`   Rows written : ${rows.length}`);
  console.log(`   File         : ${outPath}`);
  console.log("══════════════════════════════════════════════════════════");
}

main().catch((err) => {
  console.error("\n❌  Fatal error:", err?.message || err);
  process.exit(1);
});
