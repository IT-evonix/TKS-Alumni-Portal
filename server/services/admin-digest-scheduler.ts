/**
 * Admin Digest Scheduler
 * Handles scheduled sending of daily admin digest emails
 * Refactored to use Supabase SDK for HTTP-based data access.
 */

import cron from "node-cron";
import {
    aggregateDailyMetrics,
    getAdminDigestCoverageWindow,
    hasSentDigestForAdminDay,
    shouldSendDigest,
    logDigestDelivery,
    DigestMetrics,
    AdminDigestCoverageWindow,
} from "./admin-digest-service";
import { generateAdminDigestEmail } from "./admin-digest-template";
import { sendEmail, checkEmailConfig } from "./email-service";
import { supabase } from "../supabase";

/**
 * Send digest to a single admin
 */
export async function sendDigestToAdmin(
    adminId: string,
    preferences: any,
    coverageWindow: AdminDigestCoverageWindow = getAdminDigestCoverageWindow()
): Promise<void> {
    try {
        console.log(`📧 Preparing digest for admin: ${adminId}`);

        // Get admin user details via Supabase
        const { data: admin, error: adminErr } = await supabase
            .from("users")
            .select("id, username, email")
            .eq("id", adminId)
            .single();

        if (adminErr || !admin) {
            console.error(`Admin not found: ${adminId}`, adminErr);
            return;
        }

        // Get admin's alumni profile for full name
        const { data: alumniProfile, error: alumniErr } = await supabase
            .from("alumni")
            .select("first_name, last_name")
            .eq("user_id", adminId)
            .single();

        const adminName = alumniProfile
            ? `${alumniProfile.first_name} ${alumniProfile.last_name}`
            : admin.username;

        const alreadySent = await hasSentDigestForAdminDay(adminId, coverageWindow);
        if (alreadySent) {
            console.log(`⏭️ Skipping digest for ${admin.email} - already sent for ${coverageWindow.coverageDate}`);
            await logDigestDelivery(adminId, "duplicate_skipped", {} as DigestMetrics, undefined, coverageWindow.start);
            return;
        }

        // Aggregate metrics
        console.log(`📊 Aggregating metrics...`);
        const metrics = await aggregateDailyMetrics(coverageWindow);

        // Check if digest should be sent based on threshold
        if (!shouldSendDigest(metrics, preferences.min_pending_threshold || 0)) {
            console.log(
                `⏭️ Skipping digest for ${admin.email} - below threshold`
            );
            await logDigestDelivery(adminId, "skipped", metrics, undefined, coverageWindow.start);
            return;
        }

        // Parse included sections
        let includeSections: string[];
        try {
            includeSections =
                typeof preferences.include_sections === "string"
                    ? JSON.parse(preferences.include_sections)
                    : (preferences.include_sections || ["overview", "signups", "posts", "events", "jobs"]);
        } catch {
            includeSections = ["overview", "signups", "posts", "events", "jobs"];
        }

        // Fail fast if email is not configured
        try {
            checkEmailConfig();
        } catch (configErr: any) {
            console.warn(`⏭️ Skipping digest for ${adminId}: email not configured (${configErr?.message || "ZEPTOMAIL_TOKEN missing"})`);
            await logDigestDelivery(adminId, "skipped", metrics, configErr?.message, coverageWindow.start);
            return;
        }

        // Generate email content
        console.log(`✉️ Generating email content...`);
        const emailContent = generateAdminDigestEmail(
            metrics,
            adminName,
            includeSections,
            coverageWindow.coverageDate
        );

        // Send email
        console.log(`📤 Sending digest to ${admin.email}...`);
        await sendEmail({
            to: admin.email,
            toName: adminName,
            subject: emailContent.subject,
            textBody: emailContent.textBody,
            htmlBody: emailContent.htmlBody,
        });

        // Log successful delivery
        await logDigestDelivery(adminId, "sent", metrics, undefined, coverageWindow.start);
        console.log(`✅ Digest sent successfully to ${admin.email}`);
    } catch (error: any) {
        console.error(`❌ Error sending digest to admin ${adminId}:`, error);

        // Log failed delivery
        try {
            const metrics = await aggregateDailyMetrics();
            await logDigestDelivery(
                adminId,
                "failed",
                metrics,
                error.message || "Unknown error",
                coverageWindow.start
            );
        } catch (logError) {
            console.error("Error logging failed delivery:", logError);
        }
    }
}

/**
 * Send digest to all admins with administrator role or is_admin true
 */
export async function sendDigestToAllAdmins(): Promise<void> {
    try {
        console.log("🚀 Starting daily admin digest job...");

        // Find all users who are administrators in Supabase (Source of Truth)
        const { data: administrators, error: adminErr } = await supabase
            .from("users")
            .select("id, email, username")
            .or("is_admin.eq.true,user_role.eq.administrator");

        if (adminErr) {
            console.error("❌ Error fetching administrators from Supabase:", adminErr);
            return;
        }

        if (!administrators || administrators.length === 0) {
            console.log("ℹ️ No users found with is_admin=true or user_role='administrator'");
            return;
        }

        const uniqueAdministrators = Array.from(
            new Map(
                administrators.map((admin) => [admin.email.trim().toLowerCase(), admin] as const)
            ).values()
        );

        if (uniqueAdministrators.length !== administrators.length) {
            console.warn(
                `⚠️ Deduped ${administrators.length - uniqueAdministrators.length} duplicate admin recipient(s) by email`
            );
        }

        const coverageWindow = getAdminDigestCoverageWindow();

        console.log(`📬 Processing digest for ${uniqueAdministrators.length} administrator(s)...`);

        // Iterate through each administrator
        for (const admin of uniqueAdministrators) {
            // Ensure they have preferences initialized
            const preferences = await initializeAdminDigestPreferences(admin.id);

            if (!preferences) continue;

            // Only send if digest is enabled for this admin
            if (preferences.enabled) {
                await sendDigestToAdmin(admin.id, preferences, coverageWindow);
            } else {
                console.log(`⏭️ Skipping digest for ${admin.email} - disabled in preferences`);
            }
        }

        console.log("✅ Daily admin digest job completed");
    } catch (error) {
        console.error("❌ Error in daily admin digest job:", error);
    }
}

/**
 * Schedule daily digest jobs
 */
export function scheduleAdminDigest(): void {
    const cronSchedule = "0 9 * * *";

    console.log(`📅 Scheduling admin digest job: ${cronSchedule} (9 AM IST)`);

    cron.schedule(
        cronSchedule,
        async () => {
            console.log(`⏰ Triggered daily admin digest job at ${new Date().toISOString()}`);
            await sendDigestToAllAdmins();
        },
        {
            timezone: "Asia/Kolkata", // IST timezone
        }
    );

    console.log("✅ Admin digest scheduler initialized");
}

/**
 * Initialize digest preferences for an admin if not exists
 */
export async function initializeAdminDigestPreferences(
    adminId: string
): Promise<any> {
    try {
        // Check if preferences already exist
        const { data: existing, error: fetchErr } = await supabase
            .from("admin_digest_preferences")
            .select("*")
            .eq("admin_id", adminId)
            .single();

        if (existing) {
            return existing;
        }

        // Create default preferences
        const { data: created, error: createErr } = await supabase
            .from("admin_digest_preferences")
            .insert({
                admin_id: adminId,
                enabled: true,
                delivery_time: "09:00:00",
                timezone: "Asia/Kolkata",
                include_sections: [
                    "pending_actions",
                    "metrics",
                    "alerts",
                    "insights",
                ],
                min_pending_threshold: 0,
            })
            .select()
            .single();

        if (createErr) {
            console.error("Error creating preferences:", createErr);
            return null;
        }

        console.log(`✅ Initialized digest preferences for admin: ${adminId}`);
        return created;
    } catch (error) {
        console.error("Error initializing admin digest preferences:", error);
        return null;
    }
}
