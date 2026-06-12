import cron from 'node-cron';
import { supabase } from '../supabase';

async function publishScheduledPodcasts() {
  await supabase
    .from("podcasts")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString());
}

export function startPodcastSchedulerJob() {
  cron.schedule('* * * * *', async () => {
    try {
      await publishScheduledPodcasts();
    } catch (e) {
      console.error('[CRON] Podcast scheduler error:', e);
    }
  }, { scheduled: true, timezone: "Asia/Kolkata" } as any);

  console.log('✅ Podcast scheduler cron job registered (runs every minute)');
}
