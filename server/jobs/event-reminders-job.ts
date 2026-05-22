import cron from 'node-cron';
import { processAllEventReminders } from '../services/event-reminder-service';

/**
 * Event Reminders Cron Job
 * Runs every hour to check for upcoming events and send reminders
 */
export function startEventRemindersJob() {
    // Run every hour at minute 0
    cron.schedule('0 * * * *', async () => {
        console.log('[CRON] Event Reminders Job started at', new Date().toISOString());

        try {
            await processAllEventReminders();
            console.log('[CRON] Event Reminders Job completed successfully');
        } catch (error) {
            console.error('[CRON] Event Reminders Job failed:', error);
        }
    }, {
        scheduled: true,
        timezone: "Asia/Kolkata"
    } as any);

    console.log('✅ Event Reminders cron job registered (runs hourly)');
}

/**
 * Manual trigger for testing
 */
export async function triggerEventRemindersManually() {
    console.log('[MANUAL] Triggering Event Reminders Job');
    try {
        await processAllEventReminders();
        console.log('[MANUAL] Event Reminders Job completed');
    } catch (error) {
        console.error('[MANUAL] Event Reminders Job failed:', error);
        throw error;
    }
}
