import { supabase } from "../supabase";
import { sendEmail } from "./email-service";
import { generateWeeklyDigestEmailContent } from "./weekly-digest-template";
import {
    createAndEmitNotification,
    NotificationType,
    NotificationRedirectUrl
} from "./notification-helper";

interface DigestContent {
    alumniId: string;
    userId?: string; // Add userId for notifications
    alumniName: string;
    alumniEmail: string;
    topPosts: any[];
    newAlumni: any[];
    upcomingEvents: any[];
    matchingJobs: any[];
    userStats: {
        profileViews: number;
        newConnections: number;
        postEngagement: number;
    };
}

/**
 * Get top posts from platform (trending this week)
 */
async function getTopPosts(): Promise<any[]> {
    try {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const { data: posts, error } = await supabase
            .from("feed_posts")
            .select("id, content, created_at, likes_count, comments_count")
            .eq("status", "approved")
            .gte("created_at", oneWeekAgo.toISOString())
            .order("likes_count", { ascending: false })
            .limit(5);

        if (error) throw error;

        return posts || [];
    } catch (error) {
        console.error('Error fetching top posts:', error);
        return [];
    }
}

/**
 * Get newly joined alumni
 */
async function getNewAlumni(): Promise<any[]> {
    try {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const { data: newAlumni, error } = await supabase
            .from("alumni")
            .select("id, first_name, last_name, batch, current_company, current_role, created_at")
            .gte("created_at", oneWeekAgo.toISOString())
            .order("created_at", { ascending: false })
            .limit(10);

        if (error) throw error;

        return newAlumni || [];
    } catch (error) {
        console.error('Error fetching new alumni:', error);
        return [];
    }
}

/**
 * Get upcoming events
 */
async function getUpcomingEvents(): Promise<any[]> {
    try {
        const now = new Date();
        const oneWeekFromNow = new Date();
        oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);

        const { data: upcomingEvents, error } = await supabase
            .from("events")
            .select("id, title, event_date, location, description")
            .eq("is_active", true)
            .gte("event_date", now.toISOString())
            .lte("event_date", oneWeekFromNow.toISOString())
            .order("event_date")
            .limit(5);

        if (error) throw error;

        return upcomingEvents || [];
    } catch (error) {
        console.error('Error fetching upcoming events:', error);
        return [];
    }
}

/**
 * Get matching jobs for alumni
 */
async function getMatchingJobs(alumniId: string): Promise<any[]> {
    try {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const { data: jobAlerts, error: alertErr } = await supabase
            .from("job_alerts_sent")
            .select("job_id")
            .eq("alumni_id", alumniId)
            .gte("sent_at", oneWeekAgo.toISOString())
            .gte("match_score", 70)
            .limit(5);

        if (alertErr || !jobAlerts || jobAlerts.length === 0) return [];

        const jobIds = jobAlerts.map(ja => ja.job_id);
        const { data: jobsList, error: jobErr } = await supabase
            .from("jobs")
            .select("*")
            .in("id", jobIds);

        if (jobErr) throw jobErr;

        return jobsList || [];
    } catch (error) {
        console.error('Error fetching matching jobs:', error);
        return [];
    }
}

/**
 * Calculate user stats for the week
 */
async function getUserStats(alumniId: string): Promise<any> {
    try {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const oneWeekAgoISO = oneWeekAgo.toISOString();

        const { data: alumniData, error: alErr } = await supabase
            .from("alumni")
            .select("user_id")
            .eq("id", alumniId)
            .single();

        if (alErr || !alumniData) return { profileViews: 0, newConnections: 0, postEngagement: 0 };

        const userId = alumniData.user_id;

        // New Connections (accepted in last 7 days)
        const { count: connCount, error: connErr } = await supabase
            .from("connections")
            .select("*", { count: 'exact', head: true })
            .eq("status", "accepted")
            .gte("updated_at", oneWeekAgoISO)
            .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`);

        if (connErr) throw connErr;

        // Post Engagement (likes and comments on user's posts)
        const { data: userPostsList, error: postErr } = await supabase
            .from("feed_posts")
            .select("id")
            .eq("author_id", userId);

        if (postErr) throw postErr;

        const userPostIds = (userPostsList || []).map(p => p.id);

        let engagementCount = 0;
        if (userPostIds.length > 0) {
            const { count: likesCount, error: likeErr } = await supabase
                .from("post_likes")
                .select("*", { count: 'exact', head: true })
                .in("post_id", userPostIds)
                .gte("created_at", oneWeekAgoISO);

            const { count: commentsCount, error: commErr } = await supabase
                .from("post_comments")
                .select("*", { count: 'exact', head: true })
                .in("post_id", userPostIds)
                .gte("created_at", oneWeekAgoISO);

            if (likeErr || commErr) throw likeErr || commErr;

            engagementCount = (likesCount || 0) + (commentsCount || 0);
        }

        return {
            profileViews: 0,
            newConnections: connCount || 0,
            postEngagement: engagementCount
        };
    } catch (error) {
        console.error('Error calculating user stats:', error);
        return { profileViews: 0, newConnections: 0, postEngagement: 0 };
    }
}

/**
 * Generate digest content for an alumni
 */
async function generateDigestContent(alumniRecord: any): Promise<DigestContent> {
    const [topPosts, newAlumniList, upcomingEventsList, matchingJobs, stats] = await Promise.all([
        getTopPosts(),
        getNewAlumni(),
        getUpcomingEvents(),
        getMatchingJobs(alumniRecord.id),
        getUserStats(alumniRecord.id)
    ]);

    // Get user_id from alumni record for notifications
    const { data: alumniData, error: alErr } = await supabase
        .from("alumni")
        .select("user_id")
        .eq("id", alumniRecord.id)
        .single();

    const userId = alErr || !alumniData ? null : alumniData.user_id;

    return {
        alumniId: alumniRecord.id,
        userId: userId, // Add userId for notifications
        alumniName: `${alumniRecord.first_name} ${alumniRecord.last_name}`,
        alumniEmail: alumniRecord.email,
        topPosts,
        newAlumni: newAlumniList,
        upcomingEvents: upcomingEventsList,
        matchingJobs,
        userStats: stats
    };
}

/**
 * Send weekly digest email
 */
async function sendDigestEmail(content: DigestContent): Promise<boolean> {
    try {
        const { subject, htmlBody, textBody } = generateWeeklyDigestEmailContent(content);

        // Send actual email via ZeptoMail
        await sendEmail({
            to: content.alumniEmail,
            toName: content.alumniName,
            subject,
            htmlBody,
            textBody
        });

        // Also create an in-app, real-time, and push notification using the helper
        // Use userId if available, otherwise fall back to alumniId
        const notificationUserId = content.userId || content.alumniId;
        await createAndEmitNotification({
            userId: notificationUserId,
            type: NotificationType.WEEKLY_DIGEST || 'weekly_digest',
            title: 'Your Weekly Digest is Ready',
            content: `Check out this week's highlights: ${content.topPosts.length} trending posts, ${content.newAlumni.length} new alumni, and more!`,
            redirectUrl: NotificationRedirectUrl.FEED
        });

        console.log(`Weekly digest email sent and notification emitted for ${content.alumniEmail}`);
        return true;
    } catch (error) {
        console.error(`Error sending weekly digest to ${content.alumniEmail}:`, error);
        return false;
    }
}

/**
 * Process weekly digest for all eligible alumni
 */
export async function processWeeklyDigest(): Promise<void> {
    console.log('🚀 Processing weekly digest...');

    try {
        // Get alumni with weekly digest enabled
        const { data: alumniList, error } = await supabase
            .from("alumni")
            .select("id, first_name, last_name, email, last_digest_sent_at, weekly_digest_enabled")
            .eq("weekly_digest_enabled", true);

        if (error || !alumniList) {
            console.error('Error fetching alumni for digest:', error);
            return;
        }

        console.log(`📬 Processing weekly digest for ${alumniList.length} alumni`);

        for (const alumniRecord of alumniList) {
            // Skip if digest is disabled
            if (!alumniRecord.weekly_digest_enabled) {
                console.log(`⏭️ Skipping ${alumniRecord.email} - digest disabled`);
                continue;
            }

            // Check if digest was already sent this week (7 days)
            if (alumniRecord.last_digest_sent_at) {
                const lastSent = new Date(alumniRecord.last_digest_sent_at);
                const daysSinceLastSent = (Date.now() - lastSent.getTime()) / (1000 * 60 * 60 * 24);

                if (daysSinceLastSent < 6.5) { // Using 6.5 to allow for slight variations in processing time
                    console.log(`⏭️ Skipping ${alumniRecord.email} - Sent ${daysSinceLastSent.toFixed(1)} days ago`);
                    continue;
                }
            }

            // Generate digest content
            const content = await generateDigestContent(alumniRecord);

            // Send email
            const sent = await sendDigestEmail(content);

            if (sent) {
                // Update last_digest_sent_at
                await supabase
                    .from("alumni")
                    .update({ last_digest_sent_at: new Date().toISOString() })
                    .eq("id", alumniRecord.id);
            }
        }

        console.log('✅ Weekly digest processing complete');
    } catch (error) {
        console.error('❌ Error processing weekly digest:', error);
    }
}
