import { Router } from "express";
import { z } from "zod";
import { supabase } from "../supabase";
import { buildRecipientQuery } from "../utils/recipient-filter";
import { sendNewsletter } from "../services/newsletter-service";
import {
  checkEmailConfig,
  generateNewsletterEmailHtml,
  sendEmail,
  getZeptoMailCreditsStatus,
} from "../services/email-service";
import { getBaseUrl } from "../utils/base-url";

// ==================== UTILITIES ====================

function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 60);
  const suffix = Math.random().toString(36).substring(2, 7);
  return `${base}-${suffix}`;
}

/**
 * Convert an IST datetime-local string (e.g. "2026-06-20T09:00") to UTC ISO string.
 * IST = UTC+05:30
 */
function istDatetimeLocalToUTC(datetimeLocal: string): string {
  if (!datetimeLocal || !datetimeLocal.includes("T")) {
    throw new Error("Invalid datetime-local format");
  }
  const istDateString = datetimeLocal.includes("+") || datetimeLocal.includes("Z")
    ? datetimeLocal
    : datetimeLocal + "+05:30";
  const date = new Date(istDateString);
  if (isNaN(date.getTime())) throw new Error("Invalid date");
  return date.toISOString();
}

// ==================== SCHEMAS ====================

const newsletterCreateSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200, "Title too long"),
  excerpt: z.string().max(300, "Excerpt too long").optional().nullable(),
  content: z.string().min(10, "Content is required"),
  cover_image: z
    .string()
    .url("Invalid cover image URL")
    .optional()
    .or(z.literal(""))
    .nullable(),
  recipient_role: z.string().default("all"),
  recipient_batch: z.string().default("all"),
  recipient_graduation_year: z.string().default("all"),
  recipient_department: z.string().default("all"),
  status: z.enum(["draft", "scheduled"]).default("draft"),
  scheduled_at: z.string().optional().nullable(),
});

const newsletterUpdateSchema = newsletterCreateSchema.partial();

// ==================== ADMIN ROUTER ====================

export const adminRouter = Router();

// GET /api/admin/newsletters — list all newsletters (optional ?status= filter)
adminRouter.get("/", async (req, res) => {
  try {
    let query = supabase
      .from("newsletters")
      .select("id, title, slug, status, recipient_role, recipient_batch, recipient_graduation_year, recipient_department, scheduled_at, sent_at, total_recipients, sent_count, failed_count, open_count, created_at, updated_at, created_by")
      .order("created_at", { ascending: false });

    const statusFilter = req.query.status as string | undefined;
    if (statusFilter && ["draft", "scheduled", "sending", "sent", "failed"].includes(statusFilter)) {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json({ newsletters: data ?? [] });
  } catch (err) {
    console.error("[Newsletter] List error:", err);
    res.status(500).json({ error: "Failed to fetch newsletters" });
  }
});

// GET /api/admin/newsletters/email-credits — check ZeptoMail credit status
adminRouter.get("/email-credits", async (req, res) => {
  try {
    const status = await getZeptoMailCreditsStatus();
    res.json(status);
  } catch (err) {
    console.error("[Newsletter] Credit check error:", err);
    res.status(500).json({ error: "Failed to check email credits" });
  }
});

// GET /api/admin/newsletters/filter-options — distinct values from alumni table for recipient filters
adminRouter.get("/filter-options", async (req, res) => {
  try {
    const [batchRes, branchRes, gradYearRes, roleRes] = await Promise.all([
      supabase.from("alumni").select("batch").not("batch", "is", null).neq("batch", ""),
      supabase.from("alumni").select("branch").not("branch", "is", null).neq("branch", ""),
      supabase.from("alumni").select("graduation_year").not("graduation_year", "is", null),
      supabase.from("users").select("user_role").not("user_role", "is", null).neq("user_role", ""),
    ]);

    const unique = <T>(arr: T[]): T[] => [...new Set(arr)];

    const batches = unique((batchRes.data ?? []).map((r: any) => r.batch as string)).sort();
    const departments = unique((branchRes.data ?? []).map((r: any) => r.branch as string)).sort();
    const graduationYears = unique((gradYearRes.data ?? []).map((r: any) => String(r.graduation_year))).sort((a, b) => Number(b) - Number(a));
    const roles = unique((roleRes.data ?? []).map((r: any) => r.user_role as string)).sort();

    res.json({ batches, departments, graduationYears, roles });
  } catch (err) {
    console.error("[Newsletter] Filter options error:", err);
    res.status(500).json({ error: "Failed to fetch filter options" });
  }
});

// POST /api/admin/newsletters — create newsletter
adminRouter.post("/", async (req, res) => {
  try {
    const adminId = (req as any).user?.id || req.headers["user-id"] as string;
    if (!adminId) return res.status(401).json({ error: "Unauthorized" });

    const parsed = newsletterCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors.map((e) => e.message).join("; ") });
    }

    const data = parsed.data;
    let scheduledAt: string | null = null;

    if (data.status === "scheduled") {
      if (!data.scheduled_at) {
        return res.status(400).json({ error: "scheduled_at is required when status is 'scheduled'" });
      }
      try {
        scheduledAt = istDatetimeLocalToUTC(data.scheduled_at);
      } catch {
        return res.status(400).json({ error: "Invalid scheduled_at format. Use datetime-local (YYYY-MM-DDTHH:mm)" });
      }
      if (new Date(scheduledAt) <= new Date()) {
        return res.status(400).json({ error: "Scheduled time must be in the future" });
      }
    }

    // Generate slug with collision retry
    let slug = generateSlug(data.title);
    let attempts = 0;
    while (attempts < 5) {
      const { data: existing } = await supabase
        .from("newsletters")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!existing) break;
      slug = generateSlug(data.title);
      attempts++;
    }

    const { data: newsletter, error } = await supabase
      .from("newsletters")
      .insert({
        created_by: adminId,
        title: data.title,
        slug,
        excerpt: data.excerpt || null,
        content: data.content,
        cover_image: data.cover_image || null,
        recipient_role: data.recipient_role,
        recipient_batch: data.recipient_batch,
        recipient_graduation_year: data.recipient_graduation_year,
        recipient_department: data.recipient_department,
        status: data.status,
        scheduled_at: scheduledAt,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ newsletter });
  } catch (err) {
    console.error("[Newsletter] Create error:", err);
    res.status(500).json({ error: "Failed to create newsletter" });
  }
});

// GET /api/admin/newsletters/:id — get single newsletter (full content)
adminRouter.get("/:id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("newsletters")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (error || !data) return res.status(404).json({ error: "Newsletter not found" });
    res.json({ newsletter: data });
  } catch (err) {
    console.error("[Newsletter] Get error:", err);
    res.status(500).json({ error: "Failed to fetch newsletter" });
  }
});

// PUT /api/admin/newsletters/:id — update newsletter
adminRouter.put("/:id", async (req, res) => {
  try {
    const { data: existing, error: fetchErr } = await supabase
      .from("newsletters")
      .select("status")
      .eq("id", req.params.id)
      .single();

    if (fetchErr || !existing) return res.status(404).json({ error: "Newsletter not found" });
    if (existing.status === "sending") {
      return res.status(400).json({ error: "Cannot edit a newsletter that is currently sending" });
    }

    const parsed = newsletterUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors.map((e) => e.message).join("; ") });
    }

    const data = parsed.data;
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };

    if (data.title !== undefined) updates.title = data.title;
    if (data.excerpt !== undefined) updates.excerpt = data.excerpt || null;
    if (data.content !== undefined) updates.content = data.content;
    if (data.cover_image !== undefined) updates.cover_image = data.cover_image || null;
    if (data.recipient_role !== undefined) updates.recipient_role = data.recipient_role;
    if (data.recipient_batch !== undefined) updates.recipient_batch = data.recipient_batch;
    if (data.recipient_graduation_year !== undefined) updates.recipient_graduation_year = data.recipient_graduation_year;
    if (data.recipient_department !== undefined) updates.recipient_department = data.recipient_department;

    if (data.status !== undefined) {
      updates.status = data.status;
      if (data.status === "scheduled") {
        if (!data.scheduled_at) {
          return res.status(400).json({ error: "scheduled_at is required when status is 'scheduled'" });
        }
        try {
          const utc = istDatetimeLocalToUTC(data.scheduled_at);
          if (new Date(utc) <= new Date()) {
            return res.status(400).json({ error: "Scheduled time must be in the future" });
          }
          updates.scheduled_at = utc;
        } catch {
          return res.status(400).json({ error: "Invalid scheduled_at format" });
        }
      } else if (data.status === "draft") {
        updates.scheduled_at = null;
      }
    }

    const { data: updated, error } = await supabase
      .from("newsletters")
      .update(updates)
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ newsletter: updated });
  } catch (err) {
    console.error("[Newsletter] Update error:", err);
    res.status(500).json({ error: "Failed to update newsletter" });
  }
});

// DELETE /api/admin/newsletters/:id — delete newsletter
adminRouter.delete("/:id", async (req, res) => {
  try {
    const { data: existing, error: fetchErr } = await supabase
      .from("newsletters")
      .select("status")
      .eq("id", req.params.id)
      .single();

    if (fetchErr || !existing) return res.status(404).json({ error: "Newsletter not found" });
    if (existing.status === "sending") {
      return res.status(400).json({ error: "Cannot delete a newsletter that is currently sending" });
    }

    const { error } = await supabase.from("newsletters").delete().eq("id", req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error("[Newsletter] Delete error:", err);
    res.status(500).json({ error: "Failed to delete newsletter" });
  }
});

// POST /api/admin/newsletters/:id/send-now — send immediately (202 + async)
adminRouter.post("/:id/send-now", async (req, res) => {
  try {
    const { data: existing, error: fetchErr } = await supabase
      .from("newsletters")
      .select("status, title")
      .eq("id", req.params.id)
      .single();

    if (fetchErr || !existing) return res.status(404).json({ error: "Newsletter not found" });
    if (existing.status === "sent") {
      return res.status(400).json({ error: "This newsletter has already been sent" });
    }
    if (existing.status === "sending") {
      return res.status(400).json({ error: "This newsletter is currently being sent" });
    }

    // Check email config early to surface config errors immediately
    try {
      checkEmailConfig();
    } catch (configErr: any) {
      return res.status(503).json({ error: configErr?.message || "Email service not configured" });
    }

    // Return 202 immediately; run the send in the background
    res.status(202).json({ message: "Newsletter send started", newsletterId: req.params.id });

    setImmediate(() => {
      sendNewsletter(req.params.id).catch((err) => {
        console.error(`[Newsletter] Background send failed for ${req.params.id}:`, err);
      });
    });
  } catch (err) {
    console.error("[Newsletter] Send-now error:", err);
    res.status(500).json({ error: "Failed to initiate newsletter send" });
  }
});

// POST /api/admin/newsletters/:id/test-send — send a test email to the requesting admin only
adminRouter.post("/:id/test-send", async (req, res) => {
  try {
    const adminUser = (req as any).user;
    if (!adminUser?.email) {
      return res.status(401).json({ error: "Admin email not found — cannot send test" });
    }

    const { data: newsletter, error } = await supabase
      .from("newsletters")
      .select("title, content, slug, excerpt")
      .eq("id", req.params.id)
      .single();

    if (error || !newsletter) return res.status(404).json({ error: "Newsletter not found" });

    try {
      checkEmailConfig();
    } catch (configErr: any) {
      return res.status(503).json({ error: configErr?.message || "Email service not configured" });
    }

    const baseUrl = getBaseUrl();
    const htmlBody = generateNewsletterEmailHtml(baseUrl, newsletter, {
      recipientFirstName: adminUser.first_name || "Admin",
    });
    const textBody = newsletter.content.replace(/<[^>]*>/gm, "").replace(/\s+/g, " ").trim();

    await sendEmail({
      to: adminUser.email,
      toName: adminUser.first_name || "Admin",
      subject: `[TEST] ${newsletter.title}`,
      htmlBody,
      textBody,
    });

    res.json({ success: true, sentTo: adminUser.email });
  } catch (err: any) {
    console.error("[Newsletter] Test send error:", err);
    res.status(500).json({ error: err.message || "Test send failed" });
  }
});

// GET /api/admin/newsletters/:id/recipients/preview — live recipient preview
adminRouter.get("/:id/recipients/preview", async (req, res) => {
  try {
    const { data: newsletter, error: fetchErr } = await supabase
      .from("newsletters")
      .select("recipient_role, recipient_batch, recipient_graduation_year, recipient_department")
      .eq("id", req.params.id)
      .single();

    if (fetchErr || !newsletter) return res.status(404).json({ error: "Newsletter not found" });

    const { data: users, error } = await buildRecipientQuery({
      role: newsletter.recipient_role,
      batch: newsletter.recipient_batch,
      graduationYear: newsletter.recipient_graduation_year,
      department: newsletter.recipient_department,
    });

    if (error) throw error;

    const formatted = (users ?? []).map((u: any) => ({
      id: u.user_id,
      email: u.email,
      name: `${u.first_name} ${u.last_name}`.trim(),
      batch: u.batch,
      graduationYear: u.graduation_year,
    }));

    res.json({ count: formatted.length, users: formatted });
  } catch (err) {
    console.error("[Newsletter] Recipients preview error:", err);
    res.status(500).json({ error: "Failed to preview recipients" });
  }
});

// POST /api/admin/newsletters/recipients/preview-filters — preview from filter params (before save)
adminRouter.post("/recipients/preview-filters", async (req, res) => {
  try {
    const { role, batch, graduationYear, department } = req.body as {
      role?: string;
      batch?: string;
      graduationYear?: string;
      department?: string;
    };

    const { data: users, error } = await buildRecipientQuery({ role, batch, graduationYear, department });
    if (error) throw error;

    const formatted = (users ?? []).map((u: any) => ({
      id: u.user_id,
      email: u.email,
      name: `${u.first_name} ${u.last_name}`.trim(),
      batch: u.batch,
      graduationYear: u.graduation_year,
    }));

    res.json({ count: formatted.length, users: formatted });
  } catch (err) {
    console.error("[Newsletter] Filter preview error:", err);
    res.status(500).json({ error: "Failed to preview recipients" });
  }
});

// ==================== PUBLIC ROUTER ====================

export const publicRouter = Router();

// GET /api/newsletters/unsubscribe?token=... — one-click unsubscribe from email footer
publicRouter.get("/unsubscribe", async (req, res) => {
  try {
    const token = req.query.token as string;
    if (!token) return res.status(400).send("Invalid unsubscribe link.");

    let userId: string;
    try {
      const decoded = Buffer.from(token, "base64").toString("utf-8");
      const parts = decoded.split(":");
      userId = parts[0];
      if (!userId) throw new Error("bad token");
    } catch {
      return res.status(400).send("Invalid or malformed unsubscribe token.");
    }

    await supabase.from("alumni").update({ newsletter_unsubscribed: true }).eq("user_id", userId);

    res.send(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Unsubscribed</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;text-align:center;padding:60px 20px;color:#374151;">
  <h2 style="color:#008060;">You have been unsubscribed</h2>
  <p>You will no longer receive newsletters from the TKS Alumni Portal.</p>
  <p style="font-size:13px;color:#9ca3af;margin-top:32px;">If this was a mistake, please contact the alumni office.</p>
</body>
</html>`);
  } catch (err) {
    console.error("[Newsletter] Unsubscribe error:", err);
    res.status(500).send("Failed to process your unsubscribe request. Please try again.");
  }
});

// GET /api/newsletters/track/open/:newsletterId/:userId — 1x1 pixel open tracking
publicRouter.get("/track/open/:newsletterId/:userId", async (req, res) => {
  const { newsletterId, userId } = req.params;

  // Respond immediately with a 1x1 transparent GIF — do not await DB work
  const pixel = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
  res.writeHead(200, {
    "Content-Type": "image/gif",
    "Content-Length": String(pixel.length),
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "Pragma": "no-cache",
  });
  res.end(pixel);

  // Fire-and-forget: record open + increment counter
  (async () => {
    try {
      await supabase
        .from("newsletter_opens")
        .insert({ newsletter_id: newsletterId, user_id: userId });
      await supabase.rpc("increment_newsletter_open_count", { nid: newsletterId });
    } catch {
      // best-effort, no-op
    }
  })();
});

// GET /api/newsletters — paginated archive of sent newsletters
publicRouter.get("/", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 12));
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from("newsletters")
      .select("id, title, slug, excerpt, cover_image, sent_at, sent_count, total_recipients", { count: "exact" })
      .eq("status", "sent")
      .order("sent_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    res.json({ newsletters: data ?? [], total: count ?? 0, page, limit });
  } catch (err) {
    console.error("[Newsletter] Public list error:", err);
    res.status(500).json({ error: "Failed to fetch newsletters" });
  }
});

// GET /api/newsletters/:slug — full newsletter by slug (sent only)
publicRouter.get("/:slug", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("newsletters")
      .select("id, title, slug, excerpt, content, cover_image, sent_at, sent_count, total_recipients, recipient_role")
      .eq("slug", req.params.slug)
      .eq("status", "sent")
      .single();

    if (error || !data) return res.status(404).json({ error: "Newsletter not found" });
    res.json({ newsletter: data });
  } catch (err) {
    console.error("[Newsletter] Public detail error:", err);
    res.status(500).json({ error: "Failed to fetch newsletter" });
  }
});
