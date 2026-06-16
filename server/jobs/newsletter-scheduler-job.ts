import cron from "node-cron";
import { supabase } from "../supabase";
import { sendNewsletter } from "../services/newsletter-service";

async function processScheduledNewsletters() {
  // Fetch newsletters that are due (status='scheduled', scheduled_at <= now)
  // Excludes 'sending' — those are already being processed (race-condition guard)
  const { data: due, error } = await supabase
    .from("newsletters")
    .select("id, title")
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString());

  if (error) {
    console.error("[CRON] Newsletter: Failed to query scheduled newsletters:", error);
    return;
  }

  if (!due || due.length === 0) return;

  console.log(`[CRON] Newsletter: Found ${due.length} scheduled newsletter(s) to send`);

  for (const newsletter of due) {
    try {
      console.log(`[CRON] Newsletter: Sending "${newsletter.title}" (${newsletter.id})`);
      await sendNewsletter(newsletter.id);
    } catch (err) {
      // Individual failure does not abort processing of other newsletters
      console.error(`[CRON] Newsletter: Failed to send "${newsletter.title}" (${newsletter.id}):`, err);
    }
  }
}

export function startNewsletterSchedulerJob() {
  cron.schedule(
    "* * * * *",
    async () => {
      try {
        await processScheduledNewsletters();
      } catch (err) {
        console.error("[CRON] Newsletter scheduler error:", err);
      }
    },
    { scheduled: true, timezone: "Asia/Kolkata" } as any
  );

  console.log("✅ Newsletter scheduler cron job registered (runs every minute)");
}

export async function triggerNewsletterSchedulerManually() {
  await processScheduledNewsletters();
}
