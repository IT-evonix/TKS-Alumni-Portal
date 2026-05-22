/**
 * Admin Digest Service
 * Aggregates daily metrics and generates digest data for admin emails
 * Refactored to use Supabase SDK for HTTP-based data access.
 */

import { supabase } from "../supabase";
import {
    getLast7DaysWindow,
} from "./admin-metrics-service";

const DIGEST_TIME_ZONE = "Asia/Kolkata";

export interface DigestMetrics {
    // Pending Actions
    pendingSignupRequests: number;
    pendingPosts: number;
    pendingConnections: number;

    // Approval Activity
    approvedSignupRequests: number;

    // Signup Request Details
    newSignupRequests: any[];
    oldestPendingRequestAge: number | null;

    // Post Details
    pendingPostsList: any[];

    // Daily Activity (coverage window)
    activeUsers: number;
    newPosts: number;
    newComments: number;
    newConnections: number;
    messagesSent: number;

    // Event Activity
    upcomingEvents: any[];
    newRsvps: number;

    // Job Board Activity
    newJobsPosted: number;
    newApplications: number;
    activeJobs: number;

    // Total Counts
    totalUsers: number;
    totalAlumni: number;
    totalPosts: number;

    // Insights
    mostActiveUsers: any[];

    // Recommendations
    recommendations: string[];
}

export interface AdminDigestCoverageWindow {
    start: Date;
    end: Date;
    startISO: string;
    endISO: string;
    coverageDate: string;
}

function getDatePartsInTimeZone(now: Date, timeZone: string): { year: string; month: string; day: string } {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(now);

    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;

    if (!year || !month || !day) {
        throw new Error("Failed to resolve digest coverage date");
    }

    return { year, month, day };
}

export function getAdminDigestCoverageWindow(now = new Date()): AdminDigestCoverageWindow {
    const { year, month, day } = getDatePartsInTimeZone(now, DIGEST_TIME_ZONE);
    const start = new Date(`${year}-${month}-${day}T00:00:00+05:30`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    return {
        start,
        end,
        startISO: start.toISOString(),
        endISO: end.toISOString(),
        coverageDate: `${year}-${month}-${day}`,
    };
}

/**
 * Aggregate all metrics for the daily digest
 */
export async function aggregateDailyMetrics(coverageWindow?: AdminDigestCoverageWindow): Promise<DigestMetrics> {
    const now = new Date();
    const window = coverageWindow ?? getAdminDigestCoverageWindow(now);
    const weekWindow = getLast7DaysWindow(now);
    const next7DaysEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    try {

        // Total users (direct count, avoids full paginated user fetch)
        const { count: totalUsersCount, error: totalUsersErr } = await supabase
            .from("users")
            .select("*", { count: 'exact', head: true });

        if (totalUsersErr) throw totalUsersErr;

        // ==================== PENDING ACTIONS ====================

        // Pending signup requests
        const { data: pendingSignups, error: signupError } = await supabase
            .from("signup_requests")
            .select("*")
            .eq("status", "pending")
            .order("created_at", { ascending: false });

        if (signupError) throw signupError;

        // New signup requests in the coverage window (targeted query instead of in-memory filter)
        const { data: newSignupRequestsData, error: newSignupErr } = await supabase
            .from("signup_requests")
            .select("*")
            .eq("status", "pending")
            .gte("created_at", window.startISO)
            .lt("created_at", window.endISO)
            .order("created_at", { ascending: false });

        if (newSignupErr) throw newSignupErr;
        const newSignupRequests = newSignupRequestsData || [];

        // Calculate oldest pending request age
        let oldestPendingRequestAge: number | null = null;
        if (pendingSignups && pendingSignups.length > 0) {
            const oldestRequest = pendingSignups[pendingSignups.length - 1];
            if (oldestRequest.created_at) {
                const ageMs = now.getTime() - new Date(oldestRequest.created_at).getTime();
                oldestPendingRequestAge = Math.ceil(ageMs / (1000 * 60 * 60 * 24));
            }
        }

        // Pending posts
        const { data: pendingPostsData, error: postsError } = await supabase
            .from("feed_posts")
            .select(`
                id,
                content,
                author_id,
                post_type,
                created_at,
                users (
                    username,
                    email
                )
            `)
            .eq("status", "pending")
            .order("created_at", { ascending: false });

        if (postsError) throw postsError;

        // Pending connections
        const { count: pendingConnectionsCount, error: connError } = await supabase
            .from("connections")
            .select("*", { count: 'exact', head: true })
            .eq("status", "pending");

        if (connError) throw connError;

        // ==================== DAILY ACTIVITY ====================

        // Signup approvals completed in the last 24h
        const { count: approvedSignupCount, error: approvedSignupErr } = await supabase
            .from("signup_requests")
            .select("*", { count: 'exact', head: true })
            .eq("status", "approved")
            .gte("reviewed_at", window.startISO)
            .lt("reviewed_at", window.endISO);

        if (approvedSignupErr) throw approvedSignupErr;

        // New posts (approved only - matches totalPosts metric)
        const { count: newPostsCount, error: newPostsErr } = await supabase
            .from("feed_posts")
            .select("*", { count: 'exact', head: true })
            .eq("status", "approved")
            .gte("created_at", window.startISO)
            .lt("created_at", window.endISO);

        if (newPostsErr) throw newPostsErr;

        // New comments
        const { count: newCommentsCount, error: newCommentErr } = await supabase
            .from("post_comments")
            .select("*", { count: 'exact', head: true })
            .gte("created_at", window.startISO)
            .lt("created_at", window.endISO);

        if (newCommentErr) throw newCommentErr;

        // New connections accepted (filter by updated_at so connections accepted today are captured)
        const { count: newConnAcceptedCount, error: newConnErr } = await supabase
            .from("connections")
            .select("*", { count: 'exact', head: true })
            .eq("status", "accepted")
            .gte("updated_at", window.startISO)
            .lt("updated_at", window.endISO);

        if (newConnErr) throw newConnErr;

        // Messages sent
        const { count: messagesSentCount, error: msgErr } = await supabase
            .from("messages")
            .select("*", { count: 'exact', head: true })
            .gte("created_at", window.startISO)
            .lt("created_at", window.endISO);

        if (msgErr) throw msgErr;

        // ==================== EVENT ACTIVITY ====================

        // Upcoming events (next 7 days from now)
        const { data: upcomingEventsData, error: eventErr } = await supabase
            .from("events")
            .select("*")
            .gte("event_date", now.toISOString())
            .lt("event_date", next7DaysEnd)
            .eq("is_active", true)
            .order("event_date")
            .limit(10);

        if (eventErr) throw eventErr;

        // New RSVPs
        const { count: newRsvpsCount, error: rsvpErr } = await supabase
            .from("event_rsvps")
            .select("*", { count: 'exact', head: true })
            .gte("created_at", window.startISO)
            .lt("created_at", window.endISO);

        if (rsvpErr) throw rsvpErr;

        // ==================== JOB BOARD ACTIVITY ====================

        // New jobs posted
        const { count: newJobsCount, error: jobErr } = await supabase
            .from("jobs")
            .select("*", { count: 'exact', head: true })
            .gte("created_at", window.startISO)
            .lt("created_at", window.endISO);

        if (jobErr) throw jobErr;

        // New applications
        const { count: newAppCount, error: appErr } = await supabase
            .from("job_applications")
            .select("*", { count: 'exact', head: true })
            .gte("created_at", window.startISO)
            .lt("created_at", window.endISO);

        if (appErr) throw appErr;

        // Active jobs
        const { count: activeJobsCount, error: activeJobErr } = await supabase
            .from("jobs")
            .select("*", { count: 'exact', head: true })
            .eq("is_active", true);

        if (activeJobErr) throw activeJobErr;

        // ==================== TOTAL COUNTS ====================

        const { count: totalAlumni, error: tAlumniErr } = await supabase.from("alumni").select("*", { count: 'exact', head: true });
        const { count: totalPosts, error: tPostsErr } = await supabase.from("feed_posts").select("*", { count: 'exact', head: true }).eq("status", "approved");

        if (tAlumniErr || tPostsErr) throw tAlumniErr || tPostsErr;

        // ==================== INSIGHTS ====================

        // Active users: distinct users who posted, commented, or messaged in the coverage window
        const [activePostAuthorsRes, activeCommentAuthorsRes, activeMsgSendersRes] = await Promise.all([
            supabase.from("feed_posts").select("author_id").gte("created_at", window.startISO).lt("created_at", window.endISO),
            supabase.from("post_comments").select("user_id").gte("created_at", window.startISO).lt("created_at", window.endISO),
            supabase.from("messages").select("sender_id").gte("created_at", window.startISO).lt("created_at", window.endISO),
        ]);

        const activeUsersCount = new Set([
            ...(activePostAuthorsRes.data || []).map((r: any) => r.author_id),
            ...(activeCommentAuthorsRes.data || []).map((r: any) => r.user_id),
            ...(activeMsgSendersRes.data || []).map((r: any) => r.sender_id),
        ]).size;

        // Most active users (by posts in last 7 days)
        const { data: mostActiveUserDataRaw, error: activeSearchErr } = await supabase
            .from("feed_posts")
            .select(`
                author_id,
                users (
                    username,
                    email
                )
            `)
            .eq("status", "approved")
            .gte("created_at", weekWindow.startISO)
            .lt("created_at", weekWindow.endISO);

        if (activeSearchErr) throw activeSearchErr;

        const activityMap = new Map();
        (mostActiveUserDataRaw || [])
            .filter((post: any) => {
                const u = Array.isArray(post.users) ? post.users[0] : post.users;
                return !!u?.username;
            })
            .forEach((post: any) => {
                const authorId = post.author_id;
                const user = Array.isArray(post.users) ? post.users[0] : post.users;
                if (!activityMap.has(authorId)) {
                    activityMap.set(authorId, {
                        username: user?.username,
                        email: user?.email,
                        postCount: 0
                    });
                }
                activityMap.get(authorId).postCount++;
            });

        const mostActiveUsersData = Array.from(activityMap.values())
            .sort((a, b) => b.postCount - a.postCount)
            .slice(0, 5);

        // ==================== RECOMMENDATIONS ====================

        const recommendations: string[] = [];

        if (pendingSignups && pendingSignups.length > 0) {
            recommendations.push(
                `You have ${pendingSignups.length} pending signup request${pendingSignups.length > 1 ? 's' : ''} awaiting review`
            );
        }

        if (oldestPendingRequestAge && oldestPendingRequestAge > 3) {
            recommendations.push(
                `Oldest pending signup request is ${oldestPendingRequestAge} days old - consider reviewing soon`
            );
        }

        if (pendingPostsData && pendingPostsData.length > 0) {
            recommendations.push(
                `${pendingPostsData.length} post${pendingPostsData.length > 1 ? 's' : ''} awaiting moderation`
            );
        }

        if (pendingConnectionsCount && pendingConnectionsCount > 0) {
            recommendations.push(
                `${pendingConnectionsCount} connection request${pendingConnectionsCount !== 1 ? 's' : ''} pending review`
            );
        }

        // ==================== COMPILE METRICS ====================

        return {
            // Pending Actions
            pendingSignupRequests: pendingSignups?.length || 0,
            pendingPosts: pendingPostsData?.length || 0,
            pendingConnections: pendingConnectionsCount || 0,
            approvedSignupRequests: approvedSignupCount || 0,

            // Signup Details
            newSignupRequests: (newSignupRequests || []).map(req => ({
                id: req.id,
                name: `${req.first_name} ${req.last_name}`,
                email: req.email,
                graduationYear: req.graduation_year,
                createdAt: req.created_at,
            })),
            oldestPendingRequestAge,

            // Post Details
            pendingPostsList: (pendingPostsData || []).map(post => {
                const user = Array.isArray(post.users) ? post.users[0] : post.users;
                return {
                    id: post.id,
                    content: post.content?.substring(0, 100) + (post.content && post.content.length > 100 ? '...' : ''),
                    author: user?.username,
                    authorEmail: user?.email,
                    postType: post.post_type,
                    createdAt: post.created_at,
                };
            }),

            // Daily Activity
            activeUsers: activeUsersCount,
            newPosts: newPostsCount || 0,
            newComments: newCommentsCount || 0,
            newConnections: newConnAcceptedCount || 0,
            messagesSent: messagesSentCount || 0,

            // Event Activity
            upcomingEvents: (upcomingEventsData || []).map(event => ({
                id: event.id,
                title: event.title,
                eventDate: event.event_date,
                location: event.location,
                isVirtual: event.is_virtual,
            })),
            newRsvps: newRsvpsCount || 0,

            // Job Board
            newJobsPosted: newJobsCount || 0,
            newApplications: newAppCount || 0,
            activeJobs: activeJobsCount || 0,

            // Totals
            totalUsers: totalUsersCount || 0,
            totalAlumni: totalAlumni || 0,
            totalPosts: totalPosts || 0,

            // Insights
            mostActiveUsers: mostActiveUsersData,

            // Recommendations
            recommendations,
        };
    } catch (error) {
        console.error("Error aggregating daily metrics:", error);
        throw error;
    }
}

export async function hasSentDigestForAdminDay(
    adminId: string,
    coverageWindow: AdminDigestCoverageWindow
): Promise<boolean> {
    const { count, error } = await supabase
        .from("admin_digest_logs")
        .select("id", { count: "exact", head: true })
        .eq("admin_id", adminId)
        .eq("email_status", "sent")
        .gte("digest_date", coverageWindow.startISO)
        .lt("digest_date", coverageWindow.endISO);

    if (error) {
        throw error;
    }

    return (count || 0) > 0;
}

/**
 * Check if digest should be sent based on preferences and thresholds
 */
export function shouldSendDigest(
    metrics: DigestMetrics,
    minThreshold: number
): boolean {
    const totalPending =
        metrics.pendingSignupRequests +
        metrics.pendingPosts +
        metrics.pendingConnections;

    return totalPending >= minThreshold;
}

/**
 * Log digest delivery
 */
export async function logDigestDelivery(
    adminId: string,
    status: "sent" | "failed" | "skipped" | "duplicate_skipped",
    metrics: DigestMetrics,
    errorMessage?: string,
    digestDate: Date = new Date()
): Promise<void> {
    try {
        await supabase.from("admin_digest_logs").insert({
            admin_id: adminId,
            digest_date: digestDate.toISOString(),
            email_status: status,
            metrics_snapshot: JSON.stringify(metrics),
            error_message: errorMessage || null,
        });
    } catch (error) {
        console.error("Error logging digest delivery:", error);
    }
}
