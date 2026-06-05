/**
 * Admin Digest Email Template
 * Professional HTML email template for daily admin digest
 */

import { DigestMetrics } from "./admin-digest-service";
import { getBaseUrl } from "../utils/base-url";
import { getEmailHeaderHtml, getEmailFooterHtml } from "./email-service";

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
 * Format date for display
 */
function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format date and time for display
 */
function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Generate admin digest email content
 */
export function generateAdminDigestEmail(
  metrics: DigestMetrics,
  adminName: string,
  includeSections: string[] = ["pending_actions", "metrics", "insights"],
  coverageDate?: string
): { subject: string; textBody: string; htmlBody: string } {
  const baseUrl = getBaseUrl();
  const today = coverageDate
    ? formatDate(`${coverageDate}T00:00:00+05:30`)
    : formatDate(new Date());
  const subject = `Daily Admin Digest - ${today}`;

  // ==================== TEXT BODY ====================

  let textBody = `
Daily Admin Digest - ${today}
Hello ${adminName},

Here's your daily summary of the TKS Alumni Portal:

`;

  // Pending Actions Section
  if (includeSections.includes("pending_actions")) {
    textBody += `
=== PENDING ACTIONS ===

Signup Requests: ${metrics.pendingSignupRequests}
Post Approvals: ${metrics.pendingPosts}
Connection Requests: ${metrics.pendingConnections}

`;

    if (metrics.newSignupRequests.length > 0) {
      textBody += `New Signup Requests (Last 24h):\n`;
      metrics.newSignupRequests.forEach((req: any, idx: number) => {
        textBody += `${idx + 1}. ${req.name} (${req.email}) - Class of ${req.graduationYear}\n`;
      });
      textBody += '\n';
    }

    if (metrics.pendingPostsList.length > 0) {
      textBody += `Pending Posts:\n`;
      metrics.pendingPostsList.slice(0, 5).forEach((post: any, idx: number) => {
        textBody += `${idx + 1}. ${post.author}: ${post.content}\n`;
      });
      textBody += '\n';
    }
  }

  // Metrics Section
  if (includeSections.includes("metrics")) {
    textBody += `
=== DAILY ACTIVITY (Last 24 Hours) ===

Signup Requests Approved: ${metrics.approvedSignupRequests}
Active Users: ${metrics.activeUsers}
New Posts: ${metrics.newPosts}
New Comments: ${metrics.newComments}
New Connections: ${metrics.newConnections}
Messages Sent: ${metrics.messagesSent}

=== PLATFORM OVERVIEW ===

Total Users: ${metrics.totalUsers}
Total Alumni: ${metrics.totalAlumni}
Total Posts: ${metrics.totalPosts}
Active Jobs: ${metrics.activeJobs}

`;
  }

  // Insights Section
  if (includeSections.includes("insights") && metrics.recommendations.length > 0) {
    textBody += `
=== RECOMMENDATIONS ===

`;
    metrics.recommendations.forEach((rec: any, idx: number) => {
      textBody += `${idx + 1}. ${rec}\n`;
    });
    textBody += '\n';
  }

  textBody += `
View Full Dashboard: ${baseUrl}/admin/dashboard

Best regards,
TKS Alumni Portal System
  `.trim();

  // ==================== HTML BODY ====================

  let htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Admin Digest</title>
  <style>
    @media screen and (max-width: 600px) {
      .stack-col {
        display: block !important;
        width: 100% !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
        margin-bottom: 15px !important;
        box-sizing: border-box !important;
      }
      .stack-col:last-child {
        margin-bottom: 0 !important;
      }
      .action-card {
        height: auto !important;
        min-height: 100px !important;
      }
      .action-btn {
        width: 100% !important;
        min-width: 0 !important;
        box-sizing: border-box !important;
        margin-bottom: 10px !important;
      }
      .action-btn-cell {
        display: block !important;
        width: 100% !important;
        padding: 5px 0 !important;
      }
    }
  </style>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 700px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  ${getEmailHeaderHtml(baseUrl)}
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
    <p style="text-align: center; margin: 0 0 20px 0;"><a href="${baseUrl}/admin/dashboard" style="display: inline-block; background: linear-gradient(135deg, #008060 0%, #006b51 100%); color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">View full dashboard</a></p>
    <p style="color: #666; font-size: 14px; text-align: center; margin: 0 0 20px 0;">📊 Daily Admin Digest &middot; ${today}</p>
    <p style="font-size: 16px; margin-top: 0;">Hello <strong>${sanitizeForEmail(adminName)}</strong>,</p>
    <p style="color: #666;">Here's your daily summary of the TKS Alumni Portal:</p>
`;

  // ==================== PENDING ACTIONS SECTION ====================

  if (includeSections.includes("pending_actions")) {
    const totalPending = metrics.pendingSignupRequests + metrics.pendingPosts + metrics.pendingConnections;
    const urgencyColor = totalPending > 10 ? '#dc3545' : totalPending > 5 ? '#ffc107' : '#28a745';

    htmlBody += `
    <!-- Pending Actions -->
    <div style="margin: 30px 0;">
      <h2 style="color: #008060; margin-bottom: 15px; font-size: 22px; border-bottom: 2px solid #008060; padding-bottom: 10px;">
        🔔 Pending Actions
      </h2>
      
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
        <tr>
          <td class="stack-col" style="width: 33.3%; padding: 0 8px 0 0; vertical-align: top;">
            <div class="action-card" style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid ${urgencyColor};">
              <div style="font-size: 32px; font-weight: bold; color: ${urgencyColor};">${metrics.pendingSignupRequests}</div>
              <div style="color: #666; font-size: 14px; margin-top: 5px;">Signup Requests</div>
              ${metrics.pendingSignupRequests > 0 ? `<a href="${baseUrl}/admin/signup-requests" style="display: inline-block; margin-top: 10px; color: #008060; text-decoration: none; font-size: 13px;">Review →</a>` : ''}
            </div>
          </td>
          <td class="stack-col" style="width: 33.3%; padding: 0 8px; vertical-align: top;">
            <div class="action-card" style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #17a2b8;">
              <div style="font-size: 32px; font-weight: bold; color: #17a2b8;">${metrics.pendingPosts}</div>
              <div style="color: #666; font-size: 14px; margin-top: 5px;">Post Approvals</div>
              ${metrics.pendingPosts > 0 ? `<a href="${baseUrl}/admin/feed" style="display: inline-block; margin-top: 10px; color: #008060; text-decoration: none; font-size: 13px;">Review →</a>` : ''}
            </div>
          </td>
          <td class="stack-col" style="width: 33.3%; padding: 0 0 0 8px; vertical-align: top;">
            <div class="action-card" style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #6c757d;">
              <div style="font-size: 32px; font-weight: bold; color: #6c757d;">${metrics.pendingConnections}</div>
              <div style="color: #666; font-size: 14px; margin-top: 5px;">Connections</div>
              ${metrics.pendingConnections > 0 ? `<a href="${baseUrl}/admin/dashboard" style="display: inline-block; margin-top: 10px; color: #008060; text-decoration: none; font-size: 13px;">Review →</a>` : ''}
            </div>
          </td>
        </tr>
      </table>
`;

    // New Signup Requests
    if (metrics.newSignupRequests.length > 0) {
      htmlBody += `
      <div style="background: #e7f3ff; border-left: 4px solid #008060; padding: 15px; margin: 15px 0; border-radius: 4px;">
        <strong style="color: #004085;">New Signup Requests (Last 24h):</strong>
        <ul style="margin: 10px 0; padding-left: 20px;">
`;
      metrics.newSignupRequests.slice(0, 5).forEach((req: any) => {
        htmlBody += `          <li style="margin: 5px 0; color: #004085;">${sanitizeForEmail(req.name)} (${sanitizeForEmail(req.email)}) - Class of ${req.graduationYear}</li>\n`;
      });
      if (metrics.newSignupRequests.length > 5) {
        htmlBody += `          <li style="margin: 5px 0; color: #666; font-style: italic;">...and ${metrics.newSignupRequests.length - 5} more</li>\n`;
      }
      htmlBody += `        </ul>
      </div>
`;
    }

    // Oldest Pending Request Alert
    if (metrics.oldestPendingRequestAge && metrics.oldestPendingRequestAge > 3) {
      htmlBody += `
      <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 15px 0; border-radius: 4px;">
        <p style="margin: 0; color: #856404;">
          <strong>⚠️ Alert:</strong> Oldest pending signup request is <strong>${metrics.oldestPendingRequestAge} days old</strong>
        </p>
      </div>
`;
    }

    // Pending Posts Preview
    if (metrics.pendingPostsList.length > 0) {
      htmlBody += `
      <div style="margin-top: 20px;">
        <strong style="color: #333;">Posts Awaiting Moderation:</strong>
        <table style="width: 100%; margin-top: 10px; border-collapse: collapse;">
`;
      metrics.pendingPostsList.slice(0, 3).forEach((post: any, idx: number) => {
        htmlBody += `
          <tr style="border-bottom: 1px solid #e0e0e0;">
            <td style="padding: 10px 0;">
              <div style="font-size: 13px; color: #666;">${sanitizeForEmail(post.author)}</div>
              <div style="font-size: 14px; color: #333; margin-top: 3px;">${sanitizeForEmail(post.content)}</div>
              <div style="font-size: 12px; color: #999; margin-top: 3px;">${formatDateTime(post.createdAt)}</div>
            </td>
          </tr>
`;
      });
      if (metrics.pendingPostsList.length > 3) {
        htmlBody += `
          <tr>
            <td style="padding: 10px 0; text-align: center; color: #666; font-style: italic;">
              ...and ${metrics.pendingPostsList.length - 3} more posts
            </td>
          </tr>
`;
      }
      htmlBody += `
        </table>
      </div>
`;
    }

    htmlBody += `    </div>\n`;
  }

  // ==================== METRICS SECTION ====================

  if (includeSections.includes("metrics")) {
    htmlBody += `
    <!-- Daily Activity -->
    <div style="margin: 30px 0;">
      <h2 style="color: #008060; margin-bottom: 15px; font-size: 22px; border-bottom: 2px solid #008060; padding-bottom: 10px;">
        📈 Daily Activity (Last 24 Hours)
      </h2>
      
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 10px; background: #f8f9fa; border-radius: 4px; margin-bottom: 5px;">
            <span style="color: #666;">Signup Requests Approved:</span>
            <strong style="float: right; color: #008060;">${metrics.approvedSignupRequests}</strong>
          </td>
        </tr>
        <tr><td style="height: 5px;"></td></tr>
        <tr>
          <td style="padding: 10px; background: #f8f9fa; border-radius: 4px;">
            <span style="color: #666;">Active Users:</span>
            <strong style="float: right; color: #008060;">${metrics.activeUsers}</strong>
          </td>
        </tr>
        <tr><td style="height: 5px;"></td></tr>
        <tr>
          <td style="padding: 10px; background: #f8f9fa; border-radius: 4px;">
            <span style="color: #666;">New Posts:</span>
            <strong style="float: right; color: #008060;">${metrics.newPosts}</strong>
          </td>
        </tr>
        <tr><td style="height: 5px;"></td></tr>
        <tr>
          <td style="padding: 10px; background: #f8f9fa; border-radius: 4px;">
            <span style="color: #666;">New Comments:</span>
            <strong style="float: right; color: #008060;">${metrics.newComments}</strong>
          </td>
        </tr>
        <tr><td style="height: 5px;"></td></tr>
        <tr>
          <td style="padding: 10px; background: #f8f9fa; border-radius: 4px;">
            <span style="color: #666;">New Connections:</span>
            <strong style="float: right; color: #008060;">${metrics.newConnections}</strong>
          </td>
        </tr>
        <tr><td style="height: 5px;"></td></tr>
        <tr>
          <td style="padding: 10px; background: #f8f9fa; border-radius: 4px;">
            <span style="color: #666;">Messages Sent:</span>
            <strong style="float: right; color: #008060;">${metrics.messagesSent}</strong>
          </td>
        </tr>
      </table>
    </div>

    <!-- Platform Overview -->
    <div style="margin: 30px 0;">
      <h3 style="color: #333; margin-bottom: 15px; font-size: 18px;">Platform Overview</h3>
      
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td class="stack-col" style="width: 33.3%; padding: 0 8px 0 0;">
            <div style="text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px; color: white;">
              <div style="font-size: 28px; font-weight: bold;">${metrics.totalUsers}</div>
              <div style="font-size: 14px; margin-top: 5px; opacity: 0.9;">Total Users</div>
            </div>
          </td>
          <td class="stack-col" style="width: 33.3%; padding: 0 8px;">
            <div style="text-align: center; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 20px; border-radius: 8px; color: white;">
              <div style="font-size: 28px; font-weight: bold;">${metrics.totalAlumni}</div>
              <div style="font-size: 14px; margin-top: 5px; opacity: 0.9;">Alumni</div>
            </div>
          </td>
          <td class="stack-col" style="width: 33.3%; padding: 0 0 0 8px;">
            <div style="text-align: center; background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 20px; border-radius: 8px; color: white;">
              <div style="font-size: 28px; font-weight: bold;">${metrics.totalPosts}</div>
              <div style="font-size: 14px; margin-top: 5px; opacity: 0.9;">Posts</div>
            </div>
          </td>
        </tr>
      </table>
    </div>
`;

    // Events Section
    if (metrics.upcomingEvents.length > 0) {
      htmlBody += `
    <div style="margin: 30px 0;">
      <h3 style="color: #333; margin-bottom: 15px; font-size: 18px;">📅 Upcoming Events (Next 7 Days)</h3>
      <ul style="list-style: none; padding: 0;">
`;
      metrics.upcomingEvents.forEach((event: any) => {
        htmlBody += `
        <li style="padding: 12px; background: #f8f9fa; margin-bottom: 8px; border-radius: 6px; border-left: 3px solid #008060;">
          <strong style="color: #333;">${sanitizeForEmail(event.title)}</strong><br>
          <span style="color: #666; font-size: 13px;">📍 ${event.isVirtual ? 'Virtual' : sanitizeForEmail(event.location || 'TBD')} | 📆 ${formatDateTime(event.eventDate)}</span>
        </li>
`;
      });
      htmlBody += `
      </ul>
    </div>
`;
    }

    // Job Board Section
    if (metrics.newJobsPosted > 0 || metrics.newApplications > 0) {
      htmlBody += `
    <div style="margin: 30px 0;">
      <h3 style="color: #333; margin-bottom: 15px; font-size: 18px;">💼 Job Board Activity</h3>
      <div style="background: #f8f9fa; padding: 15px; border-radius: 6px;">
        <p style="margin: 5px 0; color: #666;">New Jobs Posted: <strong style="color: #008060;">${metrics.newJobsPosted}</strong></p>
        <p style="margin: 5px 0; color: #666;">New Applications: <strong style="color: #008060;">${metrics.newApplications}</strong></p>
        <p style="margin: 5px 0; color: #666;">Active Jobs: <strong style="color: #008060;">${metrics.activeJobs}</strong></p>
      </div>
    </div>
`;
    }
  }

  // ==================== INSIGHTS SECTION ====================

  if (includeSections.includes("insights")) {
    // Most Active Users
    if (metrics.mostActiveUsers.length > 0) {
      htmlBody += `
    <div style="margin: 30px 0;">
      <h2 style="color: #008060; margin-bottom: 15px; font-size: 22px; border-bottom: 2px solid #008060; padding-bottom: 10px;">
        💡 Insights
      </h2>
      
      <h3 style="color: #333; margin-bottom: 15px; font-size: 18px;">Most Active Users (Last 7 Days)</h3>
      <table style="width: 100%; border-collapse: collapse;">
`;
      metrics.mostActiveUsers.forEach((user: any, idx: number) => {
        htmlBody += `
        <tr style="border-bottom: 1px solid #e0e0e0;">
          <td style="padding: 10px 0;">
            <span style="display: inline-block; width: 24px; height: 24px; background: #008060; color: white; text-align: center; border-radius: 50%; line-height: 24px; font-size: 12px; margin-right: 10px;">${idx + 1}</span>
            <strong style="color: #333;">${sanitizeForEmail(user.username || 'Unknown')}</strong>
            <span style="color: #666; font-size: 13px; margin-left: 10px;">${user.postCount} post${user.postCount !== 1 ? 's' : ''}</span>
          </td>
        </tr>
`;
      });
      htmlBody += `
      </table>
    </div>
`;
    }

    // Recommendations
    if (metrics.recommendations.length > 0) {
      htmlBody += `
    <div style="margin: 30px 0;">
      <h3 style="color: #333; margin-bottom: 15px; font-size: 18px;">🎯 Recommendations</h3>
      <ul style="list-style: none; padding: 0;">
`;
      metrics.recommendations.forEach((rec: any) => {
        htmlBody += `
        <li style="padding: 12px; background: #fff3cd; margin-bottom: 8px; border-radius: 6px; border-left: 3px solid #ffc107; color: #856404;">
          ${sanitizeForEmail(rec)}
        </li>
`;
      });
      htmlBody += `
      </ul>
    </div>
`;
    }
  }

  // ==================== FOOTER ====================

  htmlBody += `
    <!-- Quick Actions -->
    <div style="margin: 40px 0 30px 0; text-align: center;">
      <h3 style="color: #333; margin-bottom: 20px; font-size: 18px;">Quick Actions</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td class="action-btn-cell" style="text-align: center; padding: 8px;">
            <a class="action-btn" href="${baseUrl}/admin/dashboard" style="display: inline-block; background: linear-gradient(135deg, #008060 0%, #006b51 100%); color: white; padding: 12px 14px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 13px; min-width: 110px;">
              📊 Dashboard
            </a>
          </td>
          <td class="action-btn-cell" style="text-align: center; padding: 8px;">
            <a class="action-btn" href="${baseUrl}/admin/signup-requests" style="display: inline-block; background: #17a2b8; color: white; padding: 12px 14px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 13px; min-width: 110px;">
              👥 Signup Requests
            </a>
          </td>
          <td class="action-btn-cell" style="text-align: center; padding: 8px;">
            <a class="action-btn" href="${baseUrl}/admin/feed" style="display: inline-block; background: #6c757d; color: white; padding: 12px 14px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 13px; min-width: 110px;">
              📝 Post Approvals
            </a>
          </td>
        </tr>
      </table>
    </div>
    
    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
    <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">This is an automated digest from TKS Alumni Portal.</p>
  </div>
  ${getEmailFooterHtml(baseUrl, { managePreferencesUrl: `${baseUrl}/admin/settings` })}
</body>
</html>
  `.trim();

  return { subject, textBody, htmlBody };
}
