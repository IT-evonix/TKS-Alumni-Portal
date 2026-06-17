import { supabase } from "../supabase";
import { sendEmail, checkEmailConfig, generateNewsletterEmailHtml } from "./email-service";
import { createAndEmitNotification, NotificationType } from "./notification-helper";
import { buildRecipientQuery } from "../utils/recipient-filter";
import { getBaseUrl } from "../utils/base-url";

/**
 * Core newsletter send function.
 * Called by both the /send-now HTTP endpoint and the newsletter cron scheduler.
 *
 * Race-condition safe: atomically sets status='sending' before doing work.
 * Supports partial failures: email and notification channels are independent.
 */
export async function sendNewsletter(newsletterId: string): Promise<void> {
  // 1. Fetch newsletter and guard against already-sent or already-sending
  const { data: newsletter, error: fetchErr } = await supabase
    .from("newsletters")
    .select("*")
    .eq("id", newsletterId)
    .single();

  if (fetchErr || !newsletter) {
    console.error(`[Newsletter] Could not fetch newsletter ${newsletterId}:`, fetchErr);
    return;
  }

  if (newsletter.status === "sent" || newsletter.status === "sending") {
    console.log(`[Newsletter] Skipping ${newsletterId} — already ${newsletter.status}`);
    return;
  }

  // 2. Atomically flip to 'sending' to prevent double-sends (cron or double HTTP)
  // The .in() filter ensures we only flip if another process hasn't already claimed it.
  // We select("id") to get back the matched rows — empty array means another process won the race.
  const { data: flipped, error: flipErr } = await supabase
    .from("newsletters")
    .update({ status: "sending", updated_at: new Date().toISOString() })
    .eq("id", newsletterId)
    .in("status", ["draft", "scheduled"])
    .select("id");

  if (flipErr) {
    console.error(`[Newsletter] Failed to set sending status for ${newsletterId}:`, flipErr);
    return;
  }
  if (!flipped || flipped.length === 0) {
    console.log(`[Newsletter] Skipping ${newsletterId} — another process already claimed it`);
    return;
  }

  try {
    // 3. Resolve recipients from stored filter fields
    const { data: recipients, error: recipErr } = await buildRecipientQuery({
      role: newsletter.recipient_role,
      batch: newsletter.recipient_batch,
      graduationYear: newsletter.recipient_graduation_year,
      department: newsletter.recipient_department,
    });

    if (recipErr) throw new Error(`Failed to resolve recipients: ${recipErr.message}`);

    let users = (recipients as any[] ?? []) as Array<{
      user_id: string | null;
      email: string;
      first_name: string;
      last_name: string;
    }>;

    // Merge custom_recipient_emails (stored as JSON string array) into the recipient list
    const customEmailsRaw: string[] = (() => {
      try {
        const raw = newsletter.custom_recipient_emails;
        if (!raw || raw === "[]") return [];
        return JSON.parse(raw) as string[];
      } catch {
        return [];
      }
    })();
    const existingEmails = new Set(users.map((u) => u.email.toLowerCase()));
    for (const email of customEmailsRaw) {
      if (email && !existingEmails.has(email.toLowerCase())) {
        users = [...users, { user_id: null, email, first_name: "", last_name: "" }];
        existingEmails.add(email.toLowerCase());
      }
    }

    const totalRecipients = users.length;
    console.log(`[Newsletter] Sending "${newsletter.title}" to ${totalRecipients} recipients`);

    // 4. Check email config before blasting (fail fast)
    checkEmailConfig();

    const baseUrl = getBaseUrl();
    const textBody = newsletter.content.replace(/<[^>]*>/gm, "").replace(/\s+/g, " ").trim();

    // 5. Send emails in batches to respect ZeptoMail rate limits.
    // HTML is generated per-user to include personalised greeting + unique unsubscribe/tracking links.
    const SEND_CONCURRENCY = 20;
    const emailResults: PromiseSettledResult<any>[] = [];

    const buildEmailPromise = (u: typeof users[number]) => {
      const unsubToken = u.user_id
        ? Buffer.from(`${u.user_id}:${newsletterId}`).toString("base64")
        : undefined;
      const trackingPixelUrl = u.user_id
        ? `${baseUrl}/api/newsletters/track/open/${encodeURIComponent(newsletterId)}/${encodeURIComponent(u.user_id)}`
        : undefined;
      const htmlBody = generateNewsletterEmailHtml(
        baseUrl,
        {
          title: newsletter.title,
          content: newsletter.content,
          slug: newsletter.slug,
          excerpt: newsletter.excerpt,
          cover_image: newsletter.cover_image,
        },
        {
          recipientFirstName: u.first_name || undefined,
          unsubscribeToken: unsubToken,
          trackingPixelUrl,
        }
      );
      return sendEmail({
        to: u.email,
        toName: `${u.first_name} ${u.last_name}`.trim() || u.email,
        subject: newsletter.title,
        htmlBody,
        textBody,
      });
    };

    for (let i = 0; i < users.length; i += SEND_CONCURRENCY) {
      const chunk = users.slice(i, i + SEND_CONCURRENCY);
      const chunkResults = await Promise.allSettled(chunk.map(buildEmailPromise));
      emailResults.push(...chunkResults);
    }

    const sentCount = emailResults.filter((r) => r.status === "fulfilled").length;
    const failedCount = emailResults.filter((r) => r.status === "rejected").length;

    emailResults.forEach((r, i) => {
      if (r.status === "rejected") {
        console.error(`[Newsletter] Email failed for ${users[i]?.email}:`, (r as PromiseRejectedResult).reason?.message);
      }
    });

    // 7. Mark as sent with delivery stats
    await supabase
      .from("newsletters")
      .update({
        status: failedCount === totalRecipients && totalRecipients > 0 ? "failed" : "sent",
        sent_at: new Date().toISOString(),
        total_recipients: totalRecipients,
        sent_count: sentCount,
        failed_count: failedCount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", newsletterId);

    console.log(`[Newsletter] "${newsletter.title}" sent: ${sentCount} ok, ${failedCount} failed`);

    // 8. In-app notifications — independent of email; failures don't affect email stats
    // Only notify users who have a valid user_id in our system
    const notifiableUsers = users.filter((u) => !!u.user_id);
    const notificationTitle = `New Newsletter: ${newsletter.title}`;
    const notificationContent = newsletter.excerpt || newsletter.title;
    const redirectUrl = `/newsletters/${newsletter.slug}`;

    const concurrency = 10;
    for (let i = 0; i < notifiableUsers.length; i += concurrency) {
      await Promise.all(
        notifiableUsers.slice(i, i + concurrency).map((u) =>
          createAndEmitNotification({
            userId: u.user_id as string,
            type: NotificationType.NEWSLETTER,
            title: notificationTitle,
            content: notificationContent,
            relatedId: newsletterId,
            redirectUrl,
          }).catch((err) =>
            console.error(`[Newsletter] Notification failed for user ${u.user_id}:`, err)
          )
        )
      );
    }

    console.log(`[Newsletter] In-app notifications sent to ${notifiableUsers.length} users`);
  } catch (err: any) {
    console.error(`[Newsletter] Fatal error sending newsletter ${newsletterId}:`, err);
    // Mark as failed so admin can retry
    await supabase
      .from("newsletters")
      .update({
        status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", newsletterId);
  }
}
