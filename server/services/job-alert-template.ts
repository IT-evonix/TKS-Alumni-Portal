/**
 * Job Alert Email Template
 * Professional HTML email template for daily job alert digests
 */

import { getEmailHeaderHtml, getEmailFooterHtml } from "./email-service";
import { getBaseUrl } from "../utils/base-url";

interface JobMatch {
    id: string;
    title: string;
    company: string;
    location: string;
    matchScore: number;
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
 * Generate job alert digest email content
 */
export function generateJobAlertDigestEmailContent(
    alumniName: string,
    matches: JobMatch[]
): { subject: string; textBody: string; htmlBody: string } {
    const baseUrl = getBaseUrl();
    const subject = `Your Daily Job Matches - TKS Alumni Portal`;

    // ==================== TEXT BODY ====================
    const textBody = `
Hello ${alumniName},

We found ${matches.length} new job matches for you today:

${matches.map((m, i) => `${i + 1}. ${m.title} at ${m.company} (${m.matchScore}% Match)
   Location: ${m.location || 'Not specified'}
   View: ${baseUrl}/job-portal?jobId=${m.id}`).join('\n\n')}

Visit the jobs board for more: ${baseUrl}/job-portal

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
    <title>Daily Job Matches</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f6f9fc;">
    ${getEmailHeaderHtml(baseUrl)}
    
    <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: #008060; margin-top: 0; font-size: 22px;">New Job Matches Found!</h2>
        <p>Hello <strong>${sanitizeForEmail(alumniName)}</strong>,</p>
        <p>Based on your profile and preferences, we've found ${matches.length} new career opportunities that might be a great fit for you.</p>
        
        <div style="margin: 25px 0;">
            ${matches.map(m => `
            <div style="padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 15px; background-color: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div style="flex: 1;">
                        <h3 style="margin: 0; font-size: 17px; color: #1a202c;">${sanitizeForEmail(m.title)}</h3>
                        <p style="margin: 5px 0; font-size: 14px; color: #4a5568;"><strong>${sanitizeForEmail(m.company)}</strong> · ${sanitizeForEmail(m.location || 'Remote')}</p>
                    </div>
                    <div style="background: #ebf8ff; color: #2b6cb0; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: bold; whitespace: nowrap; margin-left: 10px;">
                        ${m.matchScore}% Match
                    </div>
                </div>
                <div style="margin-top: 15px; text-align: right;">
                    <a href="${baseUrl}/job-portal?jobId=${m.id}" style="display: inline-block; background: #008060; color: white; padding: 8px 18px; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 600;">View Details</a>
                </div>
            </div>
            `).join('')}
        </div>

        <div style="text-align: center; margin-top: 35px; border-top: 1px solid #edf2f7; padding-top: 25px;">
            <p style="color: #718096; font-size: 14px; margin-bottom: 15px;">Discover more opportunities on our jobs board</p>
            <a href="${baseUrl}/job-portal" style="display: inline-block; color: #008060; font-weight: bold; text-decoration: none; font-size: 15px;">Explore Jobs Board →</a>
        </div>
    </div>
    
    ${getEmailFooterHtml(baseUrl, { managePreferencesUrl: `${baseUrl}/profile`, showContact: true })}
</body>
</html>
    `.trim();

    return { subject, textBody, htmlBody };
}
