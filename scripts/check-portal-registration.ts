/**
 * Check Portal Registration Status for a given grade
 * ------------------------------------------------------------
 * Usage:
 *   npx tsx scripts/check-portal-registration.ts "<Grade Label>" "<input csv path>" "<output slug>"
 *
 * Example:
 *   npx tsx scripts/check-portal-registration.ts "Grade XI" "Data for portal registration(Grade XI).csv" "grade-xi"
 *
 * Reads a school CSV (Sr. No, Adm no, Student Name, Class Name, Portal
 * Registration Yes/No columns) and checks each student against the
 * production `alumni`/`users` tables by NORMALIZED NAME ONLY (no
 * admission-number field exists in the DB).
 *
 * Read-only / no DB writes. Emits:
 *   - scripts/out/<slug>-registration-results.csv  (input + Yes/No filled in)
 *   - scripts/out/<slug>-registration-precheck.json (matched/unmatched/ambiguous detail)
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";

const [, , gradeLabelArg, inputCsvArg, outSlugArg] = process.argv;
const GRADE_LABEL = gradeLabelArg || "Grade X";
const OUT_SLUG = outSlugArg || "grade-x";

const SUPABASE_URL = process.env.EXPORT_SUPABASE_URL || "https://aikvtpqqxasdctchtgct.supabase.co";
const SUPABASE_SERVICE_KEY =
  process.env.EXPORT_SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpa3Z0cHFxeGFzZGN0Y2h0Z2N0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTI5ODM4OCwiZXhwIjoyMDc0ODc0Mzg4fQ.N4Y9iGXA-PnSfSd65U94NOu_QvnTnkl51LWRREzLt5s";

const OUT = resolve(process.cwd(), "scripts/out");
const INPUT_CSV = resolve(process.cwd(), inputCsvArg || "Data for portal registration(Grade X).csv");

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const norm = (s: unknown) =>
  String(s ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "");

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

type Alumni = { id: string; user_id: string; first_name: string; last_name: string };

interface StudentRow {
  srNo: string;
  admNo: string;
  studentName: string;
  className: string;
}

function parseCsv(text: string): StudentRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  // Row 0 = header, Row 1 = sub-header ("Yes","No"), Row 2+ = data
  const rows: StudentRow[] = [];
  for (let i = 2; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols.length < 4) continue;
    const [srNo, admNo, studentName, className] = cols;
    if (!studentName || !studentName.trim()) continue;
    rows.push({
      srNo: srNo.trim(),
      admNo: admNo.trim(),
      studentName: studentName.trim(),
      className: className.trim(),
    });
  }
  return rows;
}

async function main() {
  mkdirSync(OUT, { recursive: true });

  console.log("═══════════════════════════════════════════════════════════");
  console.log(` ${GRADE_LABEL} Portal Registration Check (name-only match)`);
  console.log("═══════════════════════════════════════════════════════════\n");

  const csvText = readFileSync(INPUT_CSV, "utf8");
  const students = parseCsv(csvText);
  console.log(`Loaded ${students.length} students from CSV\n`);

  await checkAgainstDb(students, csvText);
}

async function checkAgainstDb(students: StudentRow[], csvText: string) {
  console.log("Fetching alumni records from production DB...");
  const alumni = await fetchAll<Alumni>("alumni", "id,user_id,first_name,last_name");
  console.log(`Fetched ${alumni.length} alumni rows\n`);

  // Map by combined normalized full name (first+last, order-independent) -> list of matches
  const byFullName = new Map<string, Alumni[]>();
  for (const a of alumni) {
    const f = norm(a.first_name);
    const l = norm(a.last_name);
    const key = [f, l].filter(Boolean).sort().join("|");
    if (!key) continue;
    byFullName.set(key, [...(byFullName.get(key) ?? []), a]);
  }

  // Also index by every individual name token, for partial/subset matching
  const byToken = new Map<string, Alumni[]>();
  for (const a of alumni) {
    const tokens = new Set(
      [...String(a.first_name ?? "").split(/\s+/), ...String(a.last_name ?? "").split(/\s+/)]
        .map(norm)
        .filter(Boolean)
    );
    for (const t of tokens) {
      byToken.set(t, [...(byToken.get(t) ?? []), a]);
    }
  }

  const results: {
    srNo: string;
    admNo: string;
    studentName: string;
    className: string;
    status: "Yes" | "No";
    confidence: "exact" | "ambiguous" | "none";
    matchedNames?: string[];
  }[] = [];

  for (const s of students) {
    const tokens = s.studentName.split(/\s+/).map(norm).filter(Boolean);
    const fullKey = [...tokens].sort().join("|");

    // 1. Try exact full-name match (all tokens, any order) against combined first+last
    //    Build candidate keys: since DB only has first_name/last_name (2 tokens), try all
    //    2-token combinations from the CSV name's tokens.
    let matched: Alumni[] = [];
    if (tokens.length >= 2) {
      for (let i = 0; i < tokens.length; i++) {
        for (let j = 0; j < tokens.length; j++) {
          if (i === j) continue;
          const key = [tokens[i], tokens[j]].sort().join("|");
          const found = byFullName.get(key);
          if (found) matched.push(...found);
        }
      }
    }
    matched = [...new Map(matched.map((a) => [a.id, a])).values()];

    let status: "Yes" | "No" = "No";
    let confidence: "exact" | "ambiguous" | "none" = "none";
    let matchedNames: string[] | undefined;

    if (matched.length === 1) {
      status = "Yes";
      confidence = "exact";
      matchedNames = [`${matched[0].first_name} ${matched[0].last_name}`];
    } else if (matched.length > 1) {
      status = "Yes";
      confidence = "ambiguous";
      matchedNames = matched.map((a) => `${a.first_name} ${a.last_name}`);
    } else {
      status = "No";
      confidence = "none";
    }

    results.push({
      srNo: s.srNo,
      admNo: s.admNo,
      studentName: s.studentName,
      className: s.className,
      status,
      confidence,
      matchedNames,
    });
  }

  const yesCount = results.filter((r) => r.status === "Yes").length;
  const noCount = results.filter((r) => r.status === "No").length;
  const ambiguous = results.filter((r) => r.confidence === "ambiguous");

  console.log(`Matched (Yes): ${yesCount}`);
  console.log(`Not matched (No): ${noCount}`);
  console.log(`Ambiguous matches needing manual review: ${ambiguous.length}\n`);

  // Write updated CSV preserving original structure
  const lines = csvText.split(/\r?\n/);
  const outLines: string[] = [lines[0], lines[1]];
  for (const r of results) {
    const yes = r.status === "Yes" ? "Yes" : "";
    const no = r.status === "No" ? "No" : "";
    outLines.push(`${r.srNo},${r.admNo},${r.studentName},${r.className},${yes},${no}`);
  }
  const resultsCsvPath = resolve(OUT, `${OUT_SLUG}-registration-results.csv`);
  writeFileSync(resultsCsvPath, outLines.join("\n"), "utf8");

  const precheckPath = resolve(OUT, `${OUT_SLUG}-registration-precheck.json`);
  writeFileSync(
    precheckPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        totals: { total: results.length, yes: yesCount, no: noCount, ambiguous: ambiguous.length },
        ambiguousMatches: ambiguous,
        allResults: results,
      },
      null,
      2
    ),
    "utf8"
  );

  console.log("══════════════════════════════════════════════════════════");
  console.log(` DONE`);
  console.log(`   Results CSV : ${resultsCsvPath}`);
  console.log(`   Precheck JSON: ${precheckPath}`);
  console.log("══════════════════════════════════════════════════════════");

  if (ambiguous.length > 0) {
    console.log("\n⚠️  Ambiguous matches (multiple DB candidates) — review manually:");
    for (const a of ambiguous) {
      console.log(`   - ${a.studentName} (Adm ${a.admNo}) -> ${a.matchedNames?.join(" | ")}`);
    }
  }
}

main().catch((err) => {
  console.error("\n❌  Fatal error:", err?.message || err);
  process.exit(1);
});
