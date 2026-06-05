import cron from 'node-cron';
import { processWeeklyDigest } from '../services/weekly-digest-service';
import { processDailyJobAlertsDigest } from '../services/job-alert-service';

/**
 * Weekly Digest Cron Job
 * Runs every Monday at 8 AM
 */
export function startWeeklyDigestJob() {
    // Run every Monday at 8:00 AM
    cron.schedule('0 8 * * 1', async () => {
        console.log('[CRON] Weekly Digest Job started at', new Date().toISOString());

        try {
            await processWeeklyDigest();
            console.log('[CRON] Weekly Digest Job completed successfully');
        } catch (error) {
            console.error('[CRON] Weekly Digest Job failed:', error);
        }
    }, {
        scheduled: true,
        timezone: "Asia/Kolkata"
    } as any);

    console.log('✅ Weekly Digest cron job registered (runs every Monday at 8 AM)');
}

/**
 * Ensuring Cron Job is running every day at 9 AM to send daily job alerts digest to alumni who have enabled daily job alerts
 */
export function startDailyJobAlertsJob() {
    // Run every day at 9:00 AM
    cron.schedule('0 9 * * *', async () => {
        console.log('[CRON] Daily Job Alerts Digest started at', new Date().toISOString());

        try {
            await processDailyJobAlertsDigest();
            console.log('[CRON] Daily Job Alerts Digest completed successfully');
        } catch (error) {
            console.error('[CRON] Daily Job Alerts Digest failed:', error);
        }
    }, {
        scheduled: true,
        timezone: "Asia/Kolkata"
    } as any);

    console.log('✅ Daily Job Alerts Digest cron job registered (runs daily at 9 AM)');
}

/**
 * Manual triggers for testing
 */
export async function triggerWeeklyDigestManually() {
    console.log('[MANUAL] Triggering Weekly Digest Job');
    try {
        await processWeeklyDigest();
        console.log('[MANUAL] Weekly Digest Job completed');
    } catch (error) {
        console.error('[MANUAL] Weekly Digest Job failed:', error);
        throw error;
    }
}

export async function triggerDailyJobAlertsManually() {
    console.log('[MANUAL] Triggering Daily Job Alerts Digest');
    try {
        await processDailyJobAlertsDigest();
        console.log('[MANUAL] Daily Job Alerts Digest completed');
    } catch (error) {
        console.error('[MANUAL] Daily Job Alerts Digest failed:', error);
        throw error;
    }
}
