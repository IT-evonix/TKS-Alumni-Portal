import { supabase } from "../supabase";
import { sendEmail } from "./email-service";
import { generateJobAlertDigestEmailContent } from "./job-alert-template";
import {
    createAndEmitNotification,
    NotificationType,
    NotificationRedirectUrl
} from "./notification-helper";

interface JobMatchResult {
    jobId: string;
    alumniId: string;
    matchScore: number;
    jobTitle: string;
    company: string;
    location: string;
}

interface JobAlertPreferences {
    skills?: string[];
    industries?: string[];
    locations?: string[];
    job_types?: string[];
    min_experience?: number;
    max_experience?: number;
    alert_frequency?: 'immediate' | 'daily';
}

/**
 * Calculate match score between a job and alumni profile
 */
function calculateMatchScore(
    job: any,
    alumni: any,
    preferences: JobAlertPreferences
): number {
    let score = 0;

    // Skills match (40 points max)
    if (preferences.skills && preferences.skills.length > 0 && job.required_skills) {
        const jobSkills = Array.isArray(job.required_skills) ? job.required_skills : [];
        const matchingSkills = preferences.skills.filter(skill =>
            jobSkills.some((js: string) => js.toLowerCase().includes(skill.toLowerCase()))
        );
        score += (matchingSkills.length / preferences.skills.length) * 40;
    }

    // Location match (20 points max)
    if (preferences.locations && preferences.locations.length > 0) {
        const jobLocation = job.location?.toLowerCase() || '';
        const locationMatch = preferences.locations.some(loc =>
            jobLocation.includes(loc.toLowerCase()) || loc.toLowerCase() === 'remote'
        );
        if (locationMatch) score += 20;
    }

    // Industry match (15 points max)
    if (preferences.industries && preferences.industries.length > 0) {
        const jobIndustry = job.industry?.toLowerCase() || '';
        const industryMatch = preferences.industries.some(ind =>
            jobIndustry.includes(ind.toLowerCase())
        );
        if (industryMatch) score += 15;
    }

    // Experience range match (15 points max)
    if (job.min_experience !== undefined && job.max_experience !== undefined) {
        const alumniExp = alumni.years_of_experience || 0;
        if (alumniExp >= job.min_experience && alumniExp <= job.max_experience) {
            score += 15;
        } else {
            // Partial credit if close
            const diff = Math.min(
                Math.abs(alumniExp - job.min_experience),
                Math.abs(alumniExp - job.max_experience)
            );
            if (diff <= 2) score += 10;
        }
    }

    // Job type match (10 points max)
    if (preferences.job_types && preferences.job_types.length > 0) {
        const jobType = job.job_type?.toLowerCase() || '';
        const typeMatch = preferences.job_types.some(type =>
            jobType.includes(type.toLowerCase())
        );
        if (typeMatch) score += 10;
    }

    return Math.min(Math.round(score), 100);
}

/**
 * Check if job alert already sent
 */
async function hasJobAlertBeenSent(jobId: string, alumniId: string): Promise<boolean> {
    const { data, error } = await supabase
        .from("job_alerts_sent")
        .select("id")
        .eq("job_id", jobId)
        .eq("alumni_id", alumniId)
        .single();

    return !!data && !error;
}

/**
 * Mark job alert as sent
 */
async function markJobAlertAsSent(
    jobId: string,
    alumniId: string,
    matchScore: number
): Promise<void> {
    await supabase
        .from("job_alerts_sent")
        .insert({
            job_id: jobId,
            alumni_id: alumniId,
            match_score: matchScore,
            sent_at: new Date().toISOString()
        });
}

/**
 * Send job alert notification
 */
async function sendJobAlert(match: JobMatchResult): Promise<void> {
    try {
        // Create real-time and push notification using helper
        await createAndEmitNotification({
            userId: match.alumniId,
            type: NotificationType.JOB,
            title: 'New Job Match',
            content: `${match.jobTitle} at ${match.company} (${match.matchScore}% Match)`,
            redirectUrl: `/jobs/${match.jobId}`
        });

        console.log(`Job alert notification created for alumni ${match.alumniId} (job: ${match.jobId})`);
    } catch (error) {
        console.error('Error sending job alert notification:', error);
    }
}

/**
 * Process job alerts for a new job posting
 */
export async function processJobAlerts(jobId: string): Promise<void> {
    console.log(`🚀 Processing job alerts for job ${jobId}`);

    try {
        // Get job details
        const { data: job, error: jobError } = await supabase
            .from("jobs")
            .select("*")
            .eq("id", jobId)
            .single();

        if (jobError || !job) {
            console.error('Job not found:', jobId);
            return;
        }

        // Get all alumni with job alerts enabled
        const { data: alumniList, error: alumniError } = await supabase
            .from("alumni")
            .select("*")
            .eq("job_alerts_enabled", true);

        if (alumniError || !alumniList) {
            console.error('Error fetching alumni:', alumniError);
            return;
        }

        console.log(`Found ${alumniList.length} alumni with job alerts enabled`);

        for (const alum of alumniList) {
            // Check if alert already sent
            const alreadySent = await hasJobAlertBeenSent(jobId, alum.id);
            if (alreadySent) continue;

            const preferences: JobAlertPreferences = alum.job_alert_preferences || {};

            // Calculate match score
            const matchScore = calculateMatchScore(job, alum, preferences);

            // Only process if score meets threshold (60+)
            if (matchScore >= 60) {
                // For immediate frequency, send now
                if (preferences.alert_frequency === 'immediate' || !preferences.alert_frequency) {
                    await sendJobAlert({
                        jobId: job.id,
                        alumniId: alum.id,
                        matchScore,
                        jobTitle: job.title,
                        company: job.company,
                        location: job.location || ''
                    });

                    // Also send email
                    try {
                        const { subject, htmlBody, textBody } = generateJobAlertDigestEmailContent(
                            alum.first_name || 'Alum',
                            [{ id: job.id, title: job.title, company: job.company, location: job.location || '', matchScore }]
                        );

                        await sendEmail({
                            to: alum.email,
                            toName: `${alum.first_name} ${alum.last_name}`,
                            subject: `Job Opportunity: ${job.title} at ${job.company}`,
                            htmlBody,
                            textBody
                        });
                    } catch (emailErr) {
                        console.error(`Failed to send immediate job alert email to ${alum.email}:`, emailErr);
                    }

                    await markJobAlertAsSent(job.id, alum.id, matchScore);
                }
                // For 'daily' frequency, they'll be processed in the daily digest job
            }
        }

    } catch (error) {
        console.error('Error processing job alerts:', error);
    }
}

/**
 * Process daily job alerts digest
 * Aggregates all unsent job matches from the last 24 hours for alumni with 'daily' preference
 */
export async function processDailyJobAlertsDigest(): Promise<void> {
    console.log('🚀 Processing daily job alerts digest...');

    try {
        const twentyFourHoursAgo = new Date();
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

        // 1. Get all jobs posted in the last 24 hours
        const { data: recentJobs, error: jobsError } = await supabase
            .from("jobs")
            .select("*")
            .eq("is_active", true)
            .gte("created_at", twentyFourHoursAgo.toISOString());

        if (jobsError || !recentJobs || recentJobs.length === 0) {
            console.log('No new jobs posted in the last 24 hours.');
            return;
        }

        console.log(`Found ${recentJobs.length} new jobs to match against.`);

        // 2. Get alumni with job alerts enabled
        const { data: alumniList, error: alumniError } = await supabase
            .from("alumni")
            .select("*")
            .eq("job_alerts_enabled", true);

        if (alumniError || !alumniList) {
            console.error('Error fetching alumni:', alumniError);
            return;
        }

        const dailyDigestAlumni = alumniList.filter(a => {
            const prefs: JobAlertPreferences = a.job_alert_preferences || {};
            return prefs.alert_frequency === 'daily';
        });

        console.log(`Processing daily digest for ${dailyDigestAlumni.length} alumni...`);

        for (const alum of dailyDigestAlumni) {
            const matches: any[] = [];
            const alumPreferences: JobAlertPreferences = alum.job_alert_preferences || {};

            for (const job of recentJobs) {
                // Check if already sent
                const alreadySent = await hasJobAlertBeenSent(job.id, alum.id);
                if (alreadySent) continue;

                const matchScore = calculateMatchScore(job, alum, alumPreferences);
                if (matchScore >= 60) {
                    matches.push({
                        id: job.id,
                        title: job.title,
                        company: job.company,
                        location: job.location || '',
                        matchScore
                    });
                }
            }

            if (matches.length > 0) {
                console.log(`📧 Sending daily job digest (${matches.length} matches) to ${alum.email}`);

                try {
                    const { subject, htmlBody, textBody } = generateJobAlertDigestEmailContent(
                        alum.first_name || 'Alum',
                        matches
                    );

                    await sendEmail({
                        to: alum.email,
                        toName: `${alum.first_name} ${alum.last_name}`,
                        subject,
                        htmlBody,
                        textBody
                    });

                    // Create in-app notifications and mark as sent
                    for (const match of matches) {
                        await createAndEmitNotification({
                            userId: alum.id,
                            type: NotificationType.JOB,
                            title: 'New Job Match (Daily Digest)',
                            content: `${match.title} at ${match.company} (${match.matchScore}% Match)`,
                            redirectUrl: `/jobs/${match.id}`
                        });

                        await markJobAlertAsSent(match.id, alum.id, match.matchScore);
                    }
                } catch (err) {
                    console.error(`Failed to send daily job digest to ${alum.email}:`, err);
                }
            }
        }

        console.log('✅ Daily job alerts digest processing complete');
    } catch (error) {
        console.error('❌ Error processing daily job alerts digest:', error);
    }
}
