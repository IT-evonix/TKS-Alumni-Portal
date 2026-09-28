/**
 * Full DB audit — referential integrity, orphaned rows, missing/malformed required data.
 * Read-only. Complements full-cleanup-analyze.ts (which covers email hygiene + person-level dupes).
 *
 *   npx tsx scripts/db-audit.ts
 *
 * Requires EXPORT_SUPABASE_URL and EXPORT_SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_URL /
 * SUPABASE_SERVICE_ROLE_KEY) in the environment — no fallback credentials are hardcoded here.
 */

import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";

const SUPABASE_URL = process.env.EXPORT_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY =
  process.env.EXPORT_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(
    "Missing Supabase credentials. Set EXPORT_SUPABASE_URL and EXPORT_SUPABASE_SERVICE_ROLE_KEY\n" +
      "(or SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY) in the environment before running this script."
  );
  process.exit(1);
}

const dateStamp = new Date().toISOString().slice(0, 10);
const OUT_DIR = resolve(process.cwd(), `scripts/out/db-audit-${dateStamp}`);
mkdirSync(OUT_DIR, { recursive: true });

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function fetchAll<T>(table: string, columns: string): Promise<T[]> {
  let all: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await sb.from(table).select(columns).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    all = all.concat((data ?? []) as T[]);
    if (!data || data.length < 1000) break;
    from += 1000;
  }
  return all;
}

interface Finding {
  category: string;
  confidence: "schema-confirmed" | "unverified-relationship";
  table: string;
  detail: string;
  rows: Record<string, unknown>[];
}

const findings: Finding[] = [];

function record(
  category: string,
  confidence: Finding["confidence"],
  table: string,
  detail: string,
  rows: Record<string, unknown>[]
) {
  findings.push({ category, confidence, table, detail, rows });
  if (rows.length > 0) {
    const cols = Array.from(rows.reduce((s, r) => { Object.keys(r).forEach((k) => s.add(k)); return s; }, new Set<string>()));
    const csv = [
      cols.join(","),
      ...rows.map((r) => cols.map((c) => JSON.stringify(r[c] ?? "")).join(",")),
    ].join("\n");
    writeFileSync(resolve(OUT_DIR, `${category}.csv`), csv);
  }
  console.log(`[${confidence}] ${category} (${table}): ${rows.length} row(s) — ${detail}`);
}

// column referenced -> parent id set name, used for FK checks
interface FkCheck {
  table: string;
  column: string;
  parentIdSet: () => Set<string>;
  parentLabel: string;
  confidence: Finding["confidence"];
}

async function checkOrphans(check: FkCheck) {
  const rows = await fetchAll<Record<string, unknown>>(check.table, check.column);
  const parentIds = check.parentIdSet();
  const orphans = rows.filter((r) => {
    const v = r[check.column];
    return v != null && v !== "" && !parentIds.has(String(v));
  });
  record(
    `orphan__${check.table}__${check.column}`,
    check.confidence,
    check.table,
    `${check.column} not present in ${check.parentLabel}`,
    orphans
  );
}

async function main() {
  console.log(`DB audit — reading from ${SUPABASE_URL}\n`);

  const users = await fetchAll<{ id: string; email: string; username: string }>(
    "users",
    "id,email,username"
  );
  const userIds = new Set(users.map((u) => u.id));

  const alumni = await fetchAll<{
    id: string;
    user_id: string;
    email: string;
    first_name: string;
    last_name: string;
    graduation_year: number | null;
  }>("alumni", "id,user_id,email,first_name,last_name,graduation_year");
  const alumniIds = new Set(alumni.map((a) => a.id));

  const events = await fetchAll<{ id: string }>("events", "id");
  const eventIds = new Set(events.map((e) => e.id));

  const jobs = await fetchAll<{ id: string }>("jobs", "id");
  const jobIds = new Set(jobs.map((j) => j.id));

  const feedPosts = await fetchAll<{ id: string }>("feed_posts", "id");
  const feedPostIds = new Set(feedPosts.map((p) => p.id));

  const messages = await fetchAll<{ id: string }>("messages", "id");
  const messageIds = new Set(messages.map((m) => m.id));

  const postComments = await fetchAll<{ id: string }>("post_comments", "id");
  const postCommentIds = new Set(postComments.map((c) => c.id));

  const blogPosts = await fetchAll<{ id: string }>("blog_posts", "id");
  const blogPostIds = new Set(blogPosts.map((b) => b.id));

  const blogCategories = await fetchAll<{ id: string }>("blog_categories", "id");
  const blogCategoryIds = new Set(blogCategories.map((c) => c.id));

  const gamificationBadges = await fetchAll<{ id: string }>("gamification_badges", "id");
  const badgeIds = new Set(gamificationBadges.map((b) => b.id));

  const travelChapters = await fetchAll<{ id: string }>("travel_chapters", "id");
  const travelChapterIds = new Set(travelChapters.map((t) => t.id));

  // ---- 1. Schema-confirmed (declared FK) orphan checks ----
  const hardChecks: FkCheck[] = [
    { table: "password_reset_tokens", column: "user_id", parentIdSet: () => userIds, parentLabel: "users", confidence: "schema-confirmed" },
    { table: "alumni", column: "user_id", parentIdSet: () => userIds, parentLabel: "users", confidence: "schema-confirmed" },
    { table: "alumni_experiences", column: "alumni_id", parentIdSet: () => alumniIds, parentLabel: "alumni", confidence: "schema-confirmed" },
    { table: "alumni_skills", column: "alumni_id", parentIdSet: () => alumniIds, parentLabel: "alumni", confidence: "schema-confirmed" },
    { table: "alumni_certifications", column: "alumni_id", parentIdSet: () => alumniIds, parentLabel: "alumni", confidence: "schema-confirmed" },
    { table: "alumni_languages", column: "alumni_id", parentIdSet: () => alumniIds, parentLabel: "alumni", confidence: "schema-confirmed" },
    { table: "alumni_achievements", column: "alumni_id", parentIdSet: () => alumniIds, parentLabel: "alumni", confidence: "schema-confirmed" },
    { table: "alumni_projects", column: "alumni_id", parentIdSet: () => alumniIds, parentLabel: "alumni", confidence: "schema-confirmed" },
    { table: "events", column: "organized_by", parentIdSet: () => userIds, parentLabel: "users", confidence: "schema-confirmed" },
    { table: "event_rsvps", column: "event_id", parentIdSet: () => eventIds, parentLabel: "events", confidence: "schema-confirmed" },
    { table: "event_rsvps", column: "user_id", parentIdSet: () => userIds, parentLabel: "users", confidence: "schema-confirmed" },
    { table: "messages", column: "sender_id", parentIdSet: () => userIds, parentLabel: "users", confidence: "schema-confirmed" },
    { table: "messages", column: "receiver_id", parentIdSet: () => userIds, parentLabel: "users", confidence: "schema-confirmed" },
    { table: "message_reactions", column: "message_id", parentIdSet: () => messageIds, parentLabel: "messages", confidence: "schema-confirmed" },
    { table: "message_reactions", column: "user_id", parentIdSet: () => userIds, parentLabel: "users", confidence: "schema-confirmed" },
    { table: "message_replies", column: "message_id", parentIdSet: () => messageIds, parentLabel: "messages", confidence: "schema-confirmed" },
    { table: "message_replies", column: "sender_id", parentIdSet: () => userIds, parentLabel: "users", confidence: "schema-confirmed" },
    { table: "notifications", column: "user_id", parentIdSet: () => userIds, parentLabel: "users", confidence: "schema-confirmed" },
    { table: "notifications", column: "actor_id", parentIdSet: () => userIds, parentLabel: "users", confidence: "schema-confirmed" },
    { table: "linkedin_integrations", column: "user_id", parentIdSet: () => userIds, parentLabel: "users", confidence: "schema-confirmed" },
    { table: "jobs", column: "posted_by", parentIdSet: () => userIds, parentLabel: "users", confidence: "schema-confirmed" },
    { table: "job_applications", column: "user_id", parentIdSet: () => userIds, parentLabel: "users", confidence: "schema-confirmed" },
    { table: "job_applications", column: "job_id", parentIdSet: () => jobIds, parentLabel: "jobs", confidence: "schema-confirmed" },
    { table: "saved_jobs", column: "user_id", parentIdSet: () => userIds, parentLabel: "users", confidence: "schema-confirmed" },
    { table: "saved_jobs", column: "job_id", parentIdSet: () => jobIds, parentLabel: "jobs", confidence: "schema-confirmed" },
    { table: "feed_posts", column: "author_id", parentIdSet: () => userIds, parentLabel: "users", confidence: "schema-confirmed" },
    { table: "post_likes", column: "post_id", parentIdSet: () => feedPostIds, parentLabel: "feed_posts", confidence: "schema-confirmed" },
    { table: "post_likes", column: "user_id", parentIdSet: () => userIds, parentLabel: "users", confidence: "schema-confirmed" },
    { table: "post_comments", column: "post_id", parentIdSet: () => feedPostIds, parentLabel: "feed_posts", confidence: "schema-confirmed" },
    { table: "post_comments", column: "user_id", parentIdSet: () => userIds, parentLabel: "users", confidence: "schema-confirmed" },
    { table: "post_comment_replies", column: "comment_id", parentIdSet: () => postCommentIds, parentLabel: "post_comments", confidence: "schema-confirmed" },
    { table: "post_comment_replies", column: "user_id", parentIdSet: () => userIds, parentLabel: "users", confidence: "schema-confirmed" },
    { table: "signup_requests", column: "reviewed_by", parentIdSet: () => userIds, parentLabel: "users", confidence: "schema-confirmed" },
    { table: "connection_requests", column: "requester_id", parentIdSet: () => userIds, parentLabel: "users", confidence: "schema-confirmed" },
    { table: "connection_requests", column: "recipient_id", parentIdSet: () => userIds, parentLabel: "users", confidence: "schema-confirmed" },
    { table: "user_blocks", column: "blocker_id", parentIdSet: () => userIds, parentLabel: "users", confidence: "schema-confirmed" },
    { table: "user_blocks", column: "blocked_id", parentIdSet: () => userIds, parentLabel: "users", confidence: "schema-confirmed" },
    { table: "admin_digest_preferences", column: "admin_id", parentIdSet: () => userIds, parentLabel: "users", confidence: "schema-confirmed" },
    { table: "admin_digest_logs", column: "admin_id", parentIdSet: () => userIds, parentLabel: "users", confidence: "schema-confirmed" },
    { table: "user_scores", column: "user_id", parentIdSet: () => userIds, parentLabel: "users", confidence: "schema-confirmed" },
    { table: "user_badges", column: "user_id", parentIdSet: () => userIds, parentLabel: "users", confidence: "schema-confirmed" },
    { table: "user_badges", column: "badge_id", parentIdSet: () => badgeIds, parentLabel: "gamification_badges", confidence: "schema-confirmed" },
    { table: "blog_posts", column: "author_id", parentIdSet: () => userIds, parentLabel: "users", confidence: "schema-confirmed" },
    { table: "blog_posts", column: "category_id", parentIdSet: () => blogCategoryIds, parentLabel: "blog_categories", confidence: "schema-confirmed" },
    { table: "blog_comments", column: "post_id", parentIdSet: () => blogPostIds, parentLabel: "blog_posts", confidence: "schema-confirmed" },
    { table: "blog_comments", column: "author_id", parentIdSet: () => userIds, parentLabel: "users", confidence: "schema-confirmed" },
    { table: "blog_likes", column: "post_id", parentIdSet: () => blogPostIds, parentLabel: "blog_posts", confidence: "schema-confirmed" },
    { table: "blog_likes", column: "user_id", parentIdSet: () => userIds, parentLabel: "users", confidence: "schema-confirmed" },
    { table: "blog_bookmarks", column: "post_id", parentIdSet: () => blogPostIds, parentLabel: "blog_posts", confidence: "schema-confirmed" },
    { table: "blog_bookmarks", column: "user_id", parentIdSet: () => userIds, parentLabel: "users", confidence: "schema-confirmed" },
    { table: "travel_chapters", column: "created_by", parentIdSet: () => userIds, parentLabel: "users", confidence: "schema-confirmed" },
    { table: "travel_chapter_members", column: "chapter_id", parentIdSet: () => travelChapterIds, parentLabel: "travel_chapters", confidence: "schema-confirmed" },
    { table: "travel_chapter_members", column: "user_id", parentIdSet: () => userIds, parentLabel: "users", confidence: "schema-confirmed" },
    { table: "travel_chapter_messages", column: "chapter_id", parentIdSet: () => travelChapterIds, parentLabel: "travel_chapters", confidence: "schema-confirmed" },
    { table: "travel_chapter_messages", column: "user_id", parentIdSet: () => userIds, parentLabel: "users", confidence: "schema-confirmed" },
  ];

  for (const check of hardChecks) {
    try {
      await checkOrphans(check);
    } catch (e) {
      console.warn(`  skip ${check.table}.${check.column}: ${(e as Error).message}`);
    }
  }

  // ---- 2. Unverified-relationship (no declared FK) orphan checks ----
  const softChecks: FkCheck[] = [
    { table: "mentorship_requests", column: "mentee_id", parentIdSet: () => userIds, parentLabel: "users", confidence: "unverified-relationship" },
    { table: "mentorship_requests", column: "mentor_id", parentIdSet: () => userIds, parentLabel: "users", confidence: "unverified-relationship" },
    { table: "mentorship_bookmarks", column: "mentee_id", parentIdSet: () => userIds, parentLabel: "users", confidence: "unverified-relationship" },
    { table: "mentorship_bookmarks", column: "mentor_id", parentIdSet: () => userIds, parentLabel: "users", confidence: "unverified-relationship" },
    { table: "mentorship_sessions", column: "mentor_id", parentIdSet: () => userIds, parentLabel: "users", confidence: "unverified-relationship" },
    { table: "mentorship_sessions", column: "mentee_id", parentIdSet: () => userIds, parentLabel: "users", confidence: "unverified-relationship" },
    { table: "mentorship_reviews", column: "reviewer_id", parentIdSet: () => userIds, parentLabel: "users", confidence: "unverified-relationship" },
    { table: "mentorship_reviews", column: "reviewed_id", parentIdSet: () => userIds, parentLabel: "users", confidence: "unverified-relationship" },
    { table: "podcasts", column: "created_by", parentIdSet: () => userIds, parentLabel: "users", confidence: "unverified-relationship" },
    { table: "podcast_views", column: "user_id", parentIdSet: () => userIds, parentLabel: "users", confidence: "unverified-relationship" },
  ];

  for (const check of softChecks) {
    try {
      await checkOrphans(check);
    } catch (e) {
      console.warn(`  skip ${check.table}.${check.column}: ${(e as Error).message}`);
    }
  }

  // blog_comments.parent_id is self-referential, no FK declared
  try {
    const comments = await fetchAll<{ id: string; parent_id: string | null }>(
      "blog_comments",
      "id,parent_id"
    );
    const commentIds = new Set(comments.map((c) => c.id));
    const orphanReplies = comments.filter((c) => c.parent_id && !commentIds.has(c.parent_id));
    record(
      "orphan__blog_comments__parent_id",
      "unverified-relationship",
      "blog_comments",
      "parent_id not present in blog_comments",
      orphanReplies
    );
  } catch (e) {
    console.warn(`  skip blog_comments.parent_id: ${(e as Error).message}`);
  }

  // ---- 3. 1:1ness between users and alumni ----
  const alumniByUser = new Map<string, number>();
  for (const a of alumni) alumniByUser.set(a.user_id, (alumniByUser.get(a.user_id) ?? 0) + 1);

  const usersWithoutAlumni = users.filter((u) => !alumniByUser.has(u.id));
  record("users_without_alumni_row", "schema-confirmed", "users", "user has no matching alumni row", usersWithoutAlumni);

  const usersWithMultipleAlumni = users
    .filter((u) => (alumniByUser.get(u.id) ?? 0) > 1)
    .map((u) => ({ ...u, alumni_row_count: alumniByUser.get(u.id) }));
  record("users_with_multiple_alumni_rows", "schema-confirmed", "alumni", "user has more than one alumni row", usersWithMultipleAlumni);

  const alumniOrphanedUser = alumni.filter((a) => !userIds.has(a.user_id));
  record("alumni_user_id_not_in_users", "schema-confirmed", "alumni", "alumni.user_id has no matching users row", alumniOrphanedUser);

  // ---- 4. Email drift: users.email vs alumni.email for same user_id ----
  const userById = new Map(users.map((u) => [u.id, u]));
  const emailDrift = alumni
    .filter((a) => {
      const u = userById.get(a.user_id);
      return u && u.email && a.email && u.email.trim().toLowerCase() !== a.email.trim().toLowerCase();
    })
    .map((a) => ({
      alumni_id: a.id,
      user_id: a.user_id,
      users_email: userById.get(a.user_id)?.email,
      alumni_email: a.email,
    }));
  record(
    "email_drift_users_vs_alumni",
    "schema-confirmed",
    "alumni",
    "users.email != alumni.email for same user_id (baseline from 2026-09-04 verification was 0)",
    emailDrift
  );

  // ---- 5. Required-field gaps (empty-string, not caught by NOT NULL) ----
  const isBlank = (v: unknown) => v == null || String(v).trim() === "";

  record(
    "alumni_blank_first_name",
    "schema-confirmed",
    "alumni",
    "first_name is empty/whitespace",
    alumni.filter((a) => isBlank(a.first_name))
  );
  record(
    "alumni_blank_last_name",
    "schema-confirmed",
    "alumni",
    "last_name is empty/whitespace",
    alumni.filter((a) => isBlank(a.last_name))
  );
  record(
    "users_blank_username",
    "schema-confirmed",
    "users",
    "username is empty/whitespace",
    users.filter((u) => isBlank(u.username))
  );
  record(
    "users_blank_email",
    "schema-confirmed",
    "users",
    "email is empty/whitespace",
    users.filter((u) => isBlank(u.email))
  );

  // ---- 6. Malformed graduation_year (schema's own validator floor is 2018) ----
  // Note: this platform includes currently-enrolled students, so future graduation years
  // (observed up to 2031 in prod, tapering off after 2028) are legitimate, not malformed.
  // Only the schema's documented floor (>= 2018) and non-integer values are treated as bad.
  const badGradYear = alumni.filter((a) => {
    if (a.graduation_year == null) return false;
    const y = Number(a.graduation_year);
    return !Number.isInteger(y) || y < 2018;
  });
  record(
    "alumni_graduation_year_out_of_range",
    "schema-confirmed",
    "alumni",
    "graduation_year present but < 2018 or non-integer (schema insert validator floor is 2018)",
    badGradYear
  );

  // ---- 7. Timestamp sanity: updated_at < created_at ----
  const timestampTables = [
    "users", "alumni", "events", "messages", "jobs", "job_applications",
    "feed_posts", "post_comments", "post_comment_replies", "signup_requests", "connection_requests",
    "blog_posts", "blog_comments", "travel_chapters", "travel_chapter_messages",
  ];
  for (const table of timestampTables) {
    try {
      const rows = await fetchAll<{ id: string; created_at: string; updated_at: string }>(
        table,
        "id,created_at,updated_at"
      );
      const bad = rows.filter(
        (r) => r.created_at && r.updated_at && new Date(r.updated_at) < new Date(r.created_at)
      );
      record(`timestamp_inversion__${table}`, "schema-confirmed", table, "updated_at earlier than created_at", bad);
    } catch (e) {
      console.warn(`  skip timestamp check ${table}: ${(e as Error).message}`);
    }
  }

  // ---- Summary ----
  const summary = findings.map((f) => ({
    category: f.category,
    confidence: f.confidence,
    table: f.table,
    detail: f.detail,
    count: f.rows.length,
  }));
  writeFileSync(resolve(OUT_DIR, "summary.json"), JSON.stringify(summary, null, 2));

  console.log("\n=== SUMMARY ===");
  for (const s of summary) {
    if (s.count > 0) console.log(`${s.count.toString().padStart(6)}  [${s.confidence}]  ${s.category}`);
  }
  console.log(`\nFull output written to ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
