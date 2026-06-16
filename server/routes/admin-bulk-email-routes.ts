
import { Router } from "express";
import { supabase } from "../supabase";
import { sendEmail, checkEmailConfig, isZeptoMailCreditsError, getWelcomeEmailTemplate } from "../services/email-service";
import { buildRecipientQuery } from "../utils/recipient-filter";
import { z } from "zod";

const router = Router();

// Schema for preview request
const previewSchema = z.object({
    role: z.string().optional(),
    batch: z.string().optional(),
    graduationYear: z.string().optional(),
    department: z.string().optional(),
});

const MAX_SUBJECT_LENGTH = 998;
const MAX_BODY_LENGTH = 500 * 1024; // 500 KB

// Schema for send request
const sendSchema = z.object({
    recipients: z.array(z.string().email().max(254)).min(1, "At least one recipient is required"),
    bcc: z.array(z.string().email().max(254)).optional().default([]),
    subject: z.string().min(1, "Subject is required").max(MAX_SUBJECT_LENGTH, `Subject must be ${MAX_SUBJECT_LENGTH} characters or less`),
    body: z.string().min(1, "Email body is required").max(MAX_BODY_LENGTH, "Email body is too long"),
    isHtml: z.boolean().optional().default(false),
});

// Alias for local use — same shape as previewSchema
const buildUserQuery = (filters: z.infer<typeof previewSchema>) => buildRecipientQuery(filters);


// Get email template by type (e.g. welcome) – admin only
router.get("/template", async (req, res) => {
    try {
        const adminId = req.headers["user-id"] as string;
        if (!adminId) return res.status(401).json({ error: "Unauthorized" });

        const { data: admin } = await supabase
            .from("users")
            .select("is_admin, user_role")
            .eq("id", adminId)
            .single();

        if (!admin || (!admin.is_admin && admin.user_role !== "administrator")) {
            return res.status(403).json({ error: "Forbidden" });
        }

        const type = (req.query.type as string)?.toLowerCase();
        if (type === "welcome") {
            const template = getWelcomeEmailTemplate();
            return res.json({
                subject: template.subject,
                htmlBody: template.htmlBody,
                textBody: template.textBody,
            });
        }
        return res.status(400).json({ error: "Unknown template type. Supported: welcome" });
    } catch (error) {
        console.error("Bulk Email Template Error:", error);
        res.status(500).json({ error: "Failed to load template" });
    }
});

// Preview Recipients
router.post("/preview", async (req, res) => {
    try {
        const adminId = req.headers["user-id"] as string;
        if (!adminId) return res.status(401).json({ error: "Unauthorized" });

        const { data: adminUser } = await supabase
            .from("users")
            .select("id, is_admin, user_role")
            .eq("id", adminId)
            .single();

        if (!adminUser || (!adminUser.is_admin && adminUser.user_role !== "administrator")) {
            return res.status(403).json({ error: "Forbidden" });
        }

        const filters = previewSchema.parse(req.body);

        const query = buildUserQuery(filters);
        const { data: users, error } = await query;

        if (error) throw error;

        // Format response
        const formattedUsers = (users as any[]).map(u => ({
            id: u.user_id,
            email: u.email,
            name: `${u.first_name} ${u.last_name}`,
            batch: u.batch,
            graduationYear: u.graduation_year
        }));

        res.json({ count: formattedUsers.length, users: formattedUsers });

    } catch (error) {
        console.error("Bulk Email Preview Error:", error);
        res.status(500).json({ error: "Failed to fetch recipients" });
    }
});

// Send Emails
router.post("/send", async (req, res) => {
    try {
        const adminId = req.headers["user-id"] as string;
        if (!adminId) return res.status(401).json({ error: "Unauthorized" });

        const { data: adminCheck } = await supabase.from("users").select("is_admin").eq("id", adminId).single();
        if (!adminCheck?.is_admin) return res.status(403).json({ error: "Forbidden" });

        const parsed = sendSchema.safeParse(req.body);
        if (!parsed.success) {
            const msg = parsed.error.errors.map((e) => e.message).join("; ") || "Invalid request";
            return res.status(400).json({ error: msg });
        }
        const { recipients, subject, body, isHtml } = parsed.data;

        // Normalize: trim, lowercase emails; filter out duplicates and invalid
        const normalized = recipients
            .map((e) => e.trim().toLowerCase())
            .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
        const uniqueRecipients = [...new Set(normalized)];

        if (uniqueRecipients.length === 0) {
            return res.status(400).json({
                error: recipients.length === 0
                    ? "No recipients provided"
                    : "No valid email addresses in recipients list",
            });
        }

        // Fail fast if email service is not configured (e.g. missing ZEPTOMAIL_TOKEN)
        try {
            checkEmailConfig();
        } catch (configErr: any) {
            console.error("Bulk Email: email service not configured", configErr?.message);
            return res.status(503).json({
                error: configErr?.message || "Email service is not configured. Please set ZEPTOMAIL_TOKEN.",
            });
        }

        // Send emails in parallel (with some concurrency limit if needed, but ZeptoMail handles bulk well)
        // For ZeptoMail single send, we loop. If ZeptoMail has batch endpoint, we should use it.
        // The current service `sendEmail` sends one by one.

        // We'll proceed with one-by-one for now, but in production with 1000s users, this should be a background job.
        // Given the constraints, we'll try to batch them or just send them.

        let successCount = 0;
        let failCount = 0;

        // Send max 50 at a time to avoid timeout? 
        // Or just fire and forget partially? 
        // We will await all for now to give feedback.

        const results = await Promise.allSettled(uniqueRecipients.map(async (toEmail) => {
            try {
                await sendEmail({
                    to: toEmail,
                    subject: subject,
                    textBody: isHtml ? body.replace(/<[^>]*>?/gm, '') : body, // Strip HTML for text fallback
                    htmlBody: isHtml ? body : undefined
                });
                return true;
            } catch (e) {
                console.error(`Failed to email ${toEmail}`, e);
                throw e;
            }
        }));

        let creditsExhausted = false;
        let firstErrorMessage: string | undefined;
        results.forEach((result) => {
            if (result.status === "fulfilled") successCount++;
            else {
                failCount++;
                if (result.status === "rejected") {
                    if (isZeptoMailCreditsError(result.reason)) creditsExhausted = true;
                    if (!firstErrorMessage) {
                        firstErrorMessage = (result.reason as Error)?.message ?? String(result.reason);
                    }
                }
            }
        });

        if (failCount === uniqueRecipients.length && uniqueRecipients.length > 0) {
            console.error("Bulk Email: all sends failed", {
                total: uniqueRecipients.length,
                creditsExhausted,
                firstError: firstErrorMessage,
            });
            const message = creditsExhausted
                ? "ZeptoMail credits exhausted or expired. Purchase credits from ZeptoMail Subscription page."
                : firstErrorMessage && firstErrorMessage.length < 200
                    ? firstErrorMessage
                    : "No emails could be sent. Check ZEPTOMAIL_TOKEN and ZeptoMail account (from address, domain verification).";
            return res.status(503).json({
                error: message,
                code: creditsExhausted ? "ZEPTOMAIL_CREDITS" : "SEND_FAILED",
                stats: { sent: successCount, failed: failCount },
                ...(firstErrorMessage && firstErrorMessage.length >= 200 && { detail: firstErrorMessage }),
            });
        }

        res.json({
            success: true,
            message: `Processed ${uniqueRecipients.length} emails`,
            stats: { sent: successCount, failed: failCount },
            ...(creditsExhausted ? { warning: "Some sends failed due to ZeptoMail credits. Check GET /api/admin/email/credits-status or ZeptoMail Dashboard." } : {}),
        });

    } catch (error) {
        console.error("Bulk Email Send Error:", error);
        res.status(500).json({ error: "Failed to send emails" });
    }
});

export default router;
