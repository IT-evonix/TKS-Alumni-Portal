/**
 * Weekly Digest Email Template
 * Professional HTML email template for weekly alumni digest
 */

import { getEmailHeaderHtml, getEmailFooterHtml } from "./email-service";
import { getBaseUrl } from "../utils/base-url";

interface DigestContent {
    alumniId: string;
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
 * Sanitize string to prevent XSS in email templates
 */
function sanitizeForEmail(text: string): string {
    if (!text) return "";
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;");
}

/**
 * Generate weekly digest email content
 */
export function generateWeeklyDigestEmailContent(content: DigestContent): { subject: string; textBody: string; htmlBody: string } {
    const baseUrl = getBaseUrl();
    const subject = "Your Weekly Digest - TKS Alumni Portal";

    // ==================== TEXT BODY ====================
    const textBody = `
Hello ${content.alumniName},

Here's your weekly summary of the TKS Alumni Portal:

=== YOUR STATS (This Week) ===
New Connections: ${content.userStats.newConnections}
Post Engagement: ${content.userStats.postEngagement}

=== HIGHLIGHTS ===
Top Posts: ${content.topPosts.length}
New Alumni: ${content.newAlumni.length}
Upcoming Events: ${content.upcomingEvents.length}
Matching Jobs: ${content.matchingJobs.length}

Visit the portal to see more: ${baseUrl}/feed

Best regards,
TKS Alumni Portal Team
`.trim();

    // ==================== HTML BODY ====================
    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Weekly Digest</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f6f9fc;">
    ${getEmailHeaderHtml(baseUrl)}
    
    <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: #008060; margin-top: 0; font-size: 24px; text-align: center;">Weekly Highlights</h2>
        <p style="text-align: center; color: #666;">Hello <strong>${sanitizeForEmail(content.alumniName)}</strong>, here's what's happening in your community this week.</p>
        
        <!-- Stats Section -->
        <div style="background: #f8f9fa; border-radius: 12px; padding: 20px; margin: 25px 0; border: 1px solid #edf2f7;">
            <h3 style="margin-top: 0; font-size: 16px; color: #4a5568; text-transform: uppercase; letter-spacing: 0.05em; text-align: center;">Your Weekly Impact</h3>
            <div style="display: flex; justify-content: space-around; text-align: center; margin-top: 15px;">
                <div style="flex: 1;">
                    <div style="font-size: 24px; font-weight: bold; color: #008060;">${content.userStats.newConnections}</div>
                    <div style="font-size: 12px; color: #718096;">New Connections</div>
                </div>
                <div style="flex: 1;">
                    <div style="font-size: 24px; font-weight: bold; color: #008060;">${content.userStats.postEngagement}</div>
                    <div style="font-size: 12px; color: #718096;">Post Engagement</div>
                </div>
            </div>
        </div>

        <!-- Top Posts -->
        ${content.topPosts.length > 0 ? `
        <div style="margin-top: 30px;">
            <h3 style="color: #008060; font-size: 18px; border-bottom: 2px solid #eef2f7; padding-bottom: 8px;">🔥 Trending in Feed</h3>
            ${content.topPosts.slice(0, 3).map(post => `
            <div style="padding: 15px 0; border-bottom: 1px solid #f0f0f0;">
                <p style="margin: 0; font-size: 14px; color: #2d3748;">${sanitizeForEmail(post.content?.substring(0, 120))}${post.content?.length > 120 ? '...' : ''}</p>
                <p style="margin: 5px 0 0 0; font-size: 12px; color: #a0aec0;">👍 ${post.likes_count || 0} Likes · 💬 ${post.comments_count || 0} Comments</p>
            </div>
            `).join('')}
        </div>
        ` : ''}

        <!-- New Alumni -->
        ${content.newAlumni.length > 0 ? `
        <div style="margin-top: 30px;">
            <h3 style="color: #008060; font-size: 18px; border-bottom: 2px solid #eef2f7; padding-bottom: 8px;">🎉 New Batchmates</h3>
            <div style="padding: 10px 0;">
                ${content.newAlumni.slice(0, 5).map(a => `
                <div style="display: inline-block; width: 45%; margin: 5px; padding: 10px; background: #fff; border: 1px solid #edf2f7; border-radius: 8px; vertical-align: top;">
                    <strong style="display: block; font-size: 13px; color: #2d3748;">${sanitizeForEmail(a.first_name)} ${sanitizeForEmail(a.last_name)}</strong>
                    <span style="font-size: 11px; color: #718096;">Class of ${a.batch}</span>
                </div>
                `).join('')}
            </div>
        </div>
        ` : ''}

        <!-- Upcoming Events -->
        ${content.upcomingEvents.length > 0 ? `
        <div style="margin-top: 30px;">
            <h3 style="color: #008060; font-size: 18px; border-bottom: 2px solid #eef2f7; padding-bottom: 8px;">📅 Upcoming Events</h3>
            ${content.upcomingEvents.slice(0, 2).map(e => `
            <div style="padding: 12px; margin-top: 10px; background: #fff; border-left: 4px solid #008060; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <strong style="display: block; font-size: 14px; color: #2d3748;">${sanitizeForEmail(e.title)}</strong>
                <span style="font-size: 12px; color: #718096;">${new Date(e.event_date).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })} · ${sanitizeForEmail(e.location || 'TBD')}</span>
            </div>
            `).join('')}
        </div>
        ` : ''}

        <!-- Job Matches -->
        ${content.matchingJobs.length > 0 ? `
        <div style="margin-top: 30px;">
            <h3 style="color: #008060; font-size: 18px; border-bottom: 2px solid #eef2f7; padding-bottom: 8px;">💼 Career Opportunities</h3>
            ${content.matchingJobs.slice(0, 2).map(j => `
            <div style="padding: 12px 0;">
                <strong style="display: block; font-size: 14px; color: #2d3748;">${sanitizeForEmail(j.title)}</strong>
                <span style="font-size: 12px; color: #718096;">${sanitizeForEmail(j.company)} · ${sanitizeForEmail(j.location || 'Remote')}</span>
            </div>
            `).join('')}
        </div>
        ` : ''}

        <div style="margin-top: 40px; text-align: center;">
            <a href="${baseUrl}/feed" style="display: inline-block; background: linear-gradient(135deg, #008060 0%, #006b51 100%); color: white; padding: 14px 35px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(0,128,96,0.2);">Connect and Explore</a>
        </div>
        
    </div>
    
    ${getEmailFooterHtml(baseUrl, { managePreferencesUrl: `${baseUrl}/profile`, showContact: true })}
</body>
</html>
    `.trim();

    return { subject, textBody, htmlBody };
}
