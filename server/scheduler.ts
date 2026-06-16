import { startEventRemindersJob } from './jobs/event-reminders-job';
import { startWeeklyDigestJob, startDailyJobAlertsJob } from './jobs/digest-jobs';
import { scheduleAdminDigest } from './services/admin-digest-scheduler';
import { startPodcastSchedulerJob } from './jobs/podcast-scheduler-job';
import { startNewsletterSchedulerJob } from './jobs/newsletter-scheduler-job';

/**
 * Initialize all cron jobs
 * Call this function when the server starts
 */
export function initializeScheduler() {
    const enableCronJobs = process.env.ENABLE_CRON_JOBS !== 'false';

    if (!enableCronJobs) {
        console.log('⏸️  Cron jobs are disabled (set ENABLE_CRON_JOBS=true to enable)');
        return;
    }

    console.log('🚀 Initializing notification scheduler...');

    try {
        // Start event reminders job (runs hourly)
        startEventRemindersJob();

        // Start weekly digest job (runs Monday 8 AM)
        startWeeklyDigestJob();

        // Start daily job alerts digest (runs daily 9 AM)
        startDailyJobAlertsJob();

        // Start admin digest job (runs daily 9 AM IST)
        console.log('📧 Initializing admin digest scheduler...');
        scheduleAdminDigest();

        // Start podcast scheduler (runs every minute to auto-publish scheduled episodes)
        startPodcastSchedulerJob();

        // Start newsletter scheduler (runs every minute to auto-send scheduled newsletters)
        startNewsletterSchedulerJob();

        console.log('✅ All cron jobs initialized successfully');
        console.log('📅 Scheduled jobs:');
        console.log('   - Event Reminders: Every hour');
        console.log('   - Weekly Digest: Monday at 8:00 AM');
        console.log('   - Job Alerts Digest: Daily at 9:00 AM');
        console.log('   - Admin Digest: Daily at 9:00 AM IST');
        console.log('   - Podcast Auto-Publish: Every minute');
        console.log('   - Newsletter Auto-Send: Every minute');
    } catch (error) {
        console.error('❌ Error initializing scheduler:', error);
    }
}

/**
 * Manual triggers for testing (export for use in routes)
 */
export { triggerEventRemindersManually } from './jobs/event-reminders-job';
export { triggerWeeklyDigestManually, triggerDailyJobAlertsManually } from './jobs/digest-jobs';
