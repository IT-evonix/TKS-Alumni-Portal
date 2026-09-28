/**
 * Admin Digest Email Template
 * Professional HTML email template for daily admin digest
 */

import { DigestMetrics } from "./admin-digest-service";
import { getBaseUrl } from "../utils/base-url";
import { getEmailHeaderHtml, getEmailFooterHtml } from "./email-service";

const BRAND_GREEN = "#008060";
const BRAND_GREEN_DARK = "#006b51";

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

// ==================== EMAIL-SAFE LAYOUT PRIMITIVES ====================
// All primitives below use nested role="presentation" tables (no floats,
// no CSS grid/flex, no gradients on large surfaces) so the email renders
// consistently in Outlook/Windows Mail as well as Gmail/Apple Mail.

/** Section heading with bottom border, consistent across all sections */
function renderSectionHeading(icon: string, title: string): string {
  return `
      <tr>
        <td style="padding: 0 0 14px 0; border-bottom: 2px solid ${BRAND_GREEN}; font-size: 20px; font-weight: 700; color: ${BRAND_GREEN};">
          ${icon} ${title}
        </td>
      </tr>`;
}

/**
 * A compact grid of label/value stats, `columns` per row (default 4), for sections with
 * many small metrics (e.g. "Today's Activity"'s 8 stats) — packs them into far fewer rows
 * than one-stat-per-row, and uses tight padding + a small label/value stack per cell so
 * the whole section stays short instead of scrolling for a full screen of near-empty boxes.
 */
function renderStatGrid(stats: Array<{ label: string; value: string | number; emphasis?: boolean }>, columns = 4): string {
  const cellHtml = (stat: { label: string; value: string | number; emphasis?: boolean }) => `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="color: #666; font-size: 11px; line-height: 1.3;">${stat.label}</td>
                </tr>
                <tr>
                  <td style="color: ${stat.emphasis ? BRAND_GREEN : "#2d3748"}; font-size: 17px; font-weight: 800; line-height: 1.3;">${stat.value}</td>
                </tr>
              </table>`;
  const colWidth = `${Math.floor(100 / columns)}%`;

  const rows: string[] = [];
  for (let i = 0; i < stats.length; i += columns) {
    const group = stats.slice(i, i + columns);
    const tds: string[] = [];
    group.forEach((stat, j) => {
      if (j > 0) tds.push(`<td width="6" style="font-size: 0; line-height: 0;">&nbsp;</td>`);
      tds.push(`<td width="${colWidth}" valign="top" bgcolor="#f8f9fa" style="background-color: #f8f9fa; padding: 8px 10px; border-radius: 6px;">${cellHtml(stat)}</td>`);
    });
    // pad any incomplete trailing row so table-layout:fixed keeps consistent column widths
    while (group.length < columns) {
      if (tds.length > 0) tds.push(`<td width="6" style="font-size: 0; line-height: 0;">&nbsp;</td>`);
      tds.push(`<td width="${colWidth}">&nbsp;</td>`);
      group.push({ label: "", value: "" });
    }
    rows.push(`<tr>${tds.join("")}</tr><tr><td colspan="${columns * 2 - 1}" style="height: 6px; line-height: 6px; font-size: 0;">&nbsp;</td></tr>`);
  }
  return `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="table-layout: fixed;">
          ${rows.join("")}
        </table>`;
}

/**
 * One CTA button, single shared style for every button in the email.
 * Uses the "bulletproof button" pattern (single-cell table with bgcolor) because
 * Outlook's Word engine does not apply CSS `background` on <a> tags at all, and
 * never renders `linear-gradient()` — bgcolor + background-color give it a solid
 * fallback while modern clients still render the gradient on top.
 */
function renderButton(url: string, label: string, opts?: { variant?: "primary" | "secondary" }): string {
  const solid = opts?.variant === "secondary" ? "#455468" : BRAND_GREEN;
  const bg = opts?.variant === "secondary" ? solid : `linear-gradient(135deg, ${BRAND_GREEN} 0%, ${BRAND_GREEN_DARK} 100%)`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display: inline-table;"><tr><td bgcolor="${solid}" style="background-color: ${solid}; background: ${bg}; border-radius: 6px;"><a href="${url}" style="display: inline-block; color: #ffffff; padding: 12px 22px; text-decoration: none; font-weight: 600; font-size: 14px;">${label}</a></td></tr></table>`;
}

/**
 * One "needs attention" stat card's INNER content only (no wrapping table/background —
 * the background and equal-height sizing are applied by the parent <td> in
 * renderThreeColumnRow so all three cards in a row are guaranteed the same height).
 *
 * Layout: a small circular badge holding the count sits above the label, instead of a
 * bare oversized number plus a thin left-border accent bar — the badge itself carries
 * the color coding, so the number and its meaning read as one grouped unit rather than
 * two separately-styled elements.
 */
function renderAttentionCard(count: number, label: string, color: string, reviewUrl?: string): { html: string; bg: string } {
  // The "Review" line always renders (as a real link when count > 0, or as invisible
  // placeholder text of identical markup/weight/size otherwise) so every card in a row
  // takes up exactly the same height — Outlook does not reliably respect `height` on a
  // <div> with only &nbsp; content, which previously made empty cards render shorter
  // than their siblings and broke the row's bottom alignment.
  const reviewLine =
    count > 0 && reviewUrl
      ? `<a href="${reviewUrl}" style="color: ${BRAND_GREEN}; text-decoration: none; font-size: 13px; font-weight: 600;">Review &rarr;</a>`
      : `<span style="color: transparent; font-size: 13px; font-weight: 600;">Review &rarr;</span>`;
  return {
    bg: "#f8f9fa",
    html: `
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="40" height="40" bgcolor="${color}" style="background-color: ${color}; border-radius: 50%; text-align: center; vertical-align: middle; width: 40px; height: 40px;"><div style="font-size: 17px; font-weight: 800; color: #ffffff; line-height: 40px;">${count}</div></td></tr></table>
                  <div style="color: #444; font-size: 13px; font-weight: 600; margin-top: 12px;">${label}</div>
                  <div style="margin-top: 8px; line-height: 1;">${reviewLine}</div>`,
  };
}

/** Solid-color platform snapshot tile's INNER content only (background applied by parent <td>) */
function renderSnapshotTile(value: string | number, label: string, bg: string): { html: string; bg: string; cellPadding: string } {
  return {
    bg,
    cellPadding: "12px 10px",
    html: `
                  <div style="font-size: 21px; font-weight: 800; color: #ffffff; line-height: 1; text-align: center;">${value}</div>
                  <div style="font-size: 11px; margin-top: 4px; color: rgba(255,255,255,0.92); text-align: center;">${label}</div>`,
  };
}

/**
 * Wrap up to 3 cells into a single fixed-layout, equal-width, equal-height row that
 * stacks on mobile. table-layout:fixed + explicit width on every <td> keeps columns
 * evenly aligned in Outlook/Windows Mail, which otherwise size <td>s to content and
 * produce uneven columns. Each cell renders as its own bordered/colored box directly
 * on the <td> (not a nested table) so all three cells in the row share one row height.
 */
function renderThreeColumnRow(cells: Array<{ html: string; bg?: string; borderColor?: string; cellPadding?: string } | null>): string {
  const tds = cells
    .map((cell, i) => {
      if (!cell) {
        return `<td class="stack-col" width="33.3%" style="padding: 0 8px;">&nbsp;</td>`;
      }
      const padding = i === 0 ? "0 8px 0 0" : i === cells.length - 1 ? "0 0 0 8px" : "0 8px";
      const solidBg = cell.bg || "#f8f9fa";
      const boxStyle = [
        "border-radius: 8px",
        `padding: ${cell.cellPadding || "18px 16px"}`,
        `background-color: ${solidBg}`,
        cell.borderColor ? `border-left: 4px solid ${cell.borderColor}` : "",
      ]
        .filter(Boolean)
        .join("; ");
      return `<td class="stack-col" width="33.3%" valign="top" style="padding: ${padding};"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="table-layout: fixed;"><tr><td bgcolor="${solidBg}" style="${boxStyle}">${cell.html}</td></tr></table></td>`;
    })
    .join("");
  return `
      <tr>
        <td>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="table-layout: fixed;">
            <tr>${tds}</tr>
          </table>
        </td>
      </tr>`;
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

  const totalPending = metrics.pendingSignupRequests + metrics.pendingPosts + metrics.pendingConnections;
  const urgencyColor = totalPending > 10 ? '#dc3545' : totalPending > 5 ? '#e0a800' : BRAND_GREEN;

  // ==================== TEXT BODY ====================

  let textBody = `
Daily Admin Digest - ${today}
Hello ${adminName},

`;

  // Needs Your Attention Section
  if (includeSections.includes("pending_actions")) {
    textBody += `
=== NEEDS YOUR ATTENTION ===

Signup Requests: ${metrics.pendingSignupRequests}
Post Approvals: ${metrics.pendingPosts}
Connection Requests: ${metrics.pendingConnections}

`;

    if (metrics.oldestPendingRequestAge && metrics.oldestPendingRequestAge > 3) {
      textBody += `⚠ Oldest pending signup request is ${metrics.oldestPendingRequestAge} days old - consider reviewing soon.\n\n`;
    }

    if (metrics.newSignupRequests.length > 0) {
      textBody += `New Signup Requests (Last 24h):\n`;
      metrics.newSignupRequests.forEach((req: any, idx: number) => {
        textBody += `${idx + 1}. ${req.name} (${req.email}) - Class of ${req.graduationYear}\n`;
      });
      if (metrics.newSignupRequests.length > 5) {
        textBody += `...and more\n`;
      }
      textBody += '\n';
    }

    if (metrics.pendingPostsList.length > 0) {
      textBody += `Posts Awaiting Moderation:\n`;
      metrics.pendingPostsList.slice(0, 5).forEach((post: any, idx: number) => {
        textBody += `${idx + 1}. ${post.author}: ${post.content}\n`;
      });
      if (metrics.pendingPostsList.length > 5) {
        textBody += `...and ${metrics.pendingPostsList.length - 5} more\n`;
      }
      textBody += '\n';
    }
  }

  // Today's Activity + Platform Snapshot
  if (includeSections.includes("metrics")) {
    textBody += `
=== TODAY'S ACTIVITY ===

Signup Requests Approved: ${metrics.approvedSignupRequests}
Active Users: ${metrics.activeUsers}
New Posts: ${metrics.newPosts}
New Comments: ${metrics.newComments}
New Connections: ${metrics.newConnections}
Messages Sent: ${metrics.messagesSent}
New Jobs Posted: ${metrics.newJobsPosted}
New Job Applications: ${metrics.newApplications}

=== PLATFORM SNAPSHOT ===

Total Users: ${metrics.totalUsers}
Total Alumni: ${metrics.totalAlumni}
Total Posts: ${metrics.totalPosts}
Active Jobs: ${metrics.activeJobs}

`;

    if (metrics.upcomingEvents.length > 0) {
      textBody += `=== THIS WEEK'S EVENTS ===\n\n`;
      metrics.upcomingEvents.forEach((event: any) => {
        textBody += `- ${event.title} (${event.isVirtual ? 'Virtual' : event.location || 'TBD'}) - ${formatDateTime(event.eventDate)}\n`;
      });
      textBody += '\n';
    }
  }

  // Insights Section
  if (includeSections.includes("insights")) {
    if (metrics.mostActiveUsers.length > 0) {
      textBody += `=== TOP CONTRIBUTORS (7-DAY TREND) ===\n\n`;
      metrics.mostActiveUsers.forEach((user: any, idx: number) => {
        textBody += `${idx + 1}. ${user.username || 'Unknown'} - ${user.postCount} post${user.postCount !== 1 ? 's' : ''}\n`;
      });
      textBody += '\n';
    }

    if (metrics.recommendations.length > 0) {
      textBody += `=== RECOMMENDATIONS ===\n\n`;
      metrics.recommendations.forEach((rec: any, idx: number) => {
        textBody += `${idx + 1}. ${rec}\n`;
      });
      textBody += '\n';
    }
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
        margin-bottom: 12px !important;
        box-sizing: border-box !important;
      }
      .stack-col:last-child {
        margin-bottom: 0 !important;
      }
      .action-btn-cell {
        display: block !important;
        width: 100% !important;
        padding: 5px 0 !important;
      }
    }
  </style>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f5f5f5;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 700px; margin: 0 auto;">
    <tr>
      <td>
        ${getEmailHeaderHtml(baseUrl)}
      </td>
    </tr>
    <tr>
      <td bgcolor="#ffffff" style="background-color: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="font-size: 16px;">Hello <strong>${sanitizeForEmail(adminName)}</strong>,</td>
          </tr>
          <tr>
            <td style="color: #666; font-size: 14px; padding-top: 4px;">Here's your daily summary for <strong>${today}</strong> &middot; TKS Alumni Portal.</td>
          </tr>
        </table>

        <p style="text-align: center; margin: 22px 0 26px 0;">${renderButton(`${baseUrl}/admin/dashboard`, "View Full Dashboard")}</p>
`;

  // ==================== NEEDS YOUR ATTENTION SECTION ====================

  if (includeSections.includes("pending_actions")) {
    htmlBody += `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 28px;">
          ${renderSectionHeading("🔔", "Needs Your Attention")}
          <tr><td style="height: 16px; line-height: 16px; font-size: 0;">&nbsp;</td></tr>
          ${renderThreeColumnRow([
            renderAttentionCard(metrics.pendingSignupRequests, "Signup Requests", metrics.pendingSignupRequests > 0 ? urgencyColor : BRAND_GREEN, `${baseUrl}/admin/signup-requests`),
            renderAttentionCard(metrics.pendingPosts, "Post Approvals", metrics.pendingPosts > 0 ? "#17a2b8" : BRAND_GREEN, `${baseUrl}/admin/feed`),
            renderAttentionCard(metrics.pendingConnections, "Connection Requests", metrics.pendingConnections > 0 ? "#6c757d" : BRAND_GREEN, `${baseUrl}/admin/dashboard`),
          ])}
`;

    // Oldest Pending Request Alert (folded directly under the attention cards)
    if (metrics.oldestPendingRequestAge && metrics.oldestPendingRequestAge > 3) {
      htmlBody += `
          <tr><td style="height: 14px; line-height: 14px; font-size: 0;">&nbsp;</td></tr>
          <tr>
            <td bgcolor="#fff3cd" style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 14px 16px; border-radius: 6px;">
              <span style="color: #856404; font-size: 14px;"><strong>⚠️ Aging alert:</strong> Oldest pending signup request is <strong>${metrics.oldestPendingRequestAge} days old</strong>.</span>
            </td>
          </tr>
`;
    }

    // New Signup Requests
    if (metrics.newSignupRequests.length > 0) {
      htmlBody += `
          <tr><td style="height: 14px; line-height: 14px; font-size: 0;">&nbsp;</td></tr>
          <tr>
            <td bgcolor="#f1f7fd" style="background-color: #f1f7fd; border-left: 4px solid ${BRAND_GREEN}; padding: 16px; border-radius: 6px;">
              <div style="color: #003a5d; font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 0.02em; margin-bottom: 8px;">New Signup Requests (Last 24h)</div>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
`;
      metrics.newSignupRequests.slice(0, 5).forEach((req: any) => {
        htmlBody += `
                <tr>
                  <td style="padding: 5px 0; color: #003a5d; font-size: 14px;">${sanitizeForEmail(req.name)} <span style="color: #5a7a94;">(${sanitizeForEmail(req.email)})</span> &middot; Class of ${req.graduationYear}</td>
                </tr>`;
      });
      if (metrics.newSignupRequests.length > 5) {
        htmlBody += `
                <tr><td style="padding: 5px 0; color: #5a7a94; font-size: 13px; font-style: italic;">...and ${metrics.newSignupRequests.length - 5} more</td></tr>`;
      }
      htmlBody += `
              </table>
            </td>
          </tr>
`;
    }

    // Pending Posts Preview
    if (metrics.pendingPostsList.length > 0) {
      htmlBody += `
          <tr><td style="height: 18px; line-height: 18px; font-size: 0;">&nbsp;</td></tr>
          <tr>
            <td style="font-weight: 700; font-size: 14px; color: #333; padding-bottom: 8px;">Posts Awaiting Moderation</td>
          </tr>
          <tr>
            <td>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
`;
      metrics.pendingPostsList.slice(0, 3).forEach((post: any) => {
        htmlBody += `
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #e0e0e0;">
                    <div style="font-size: 13px; color: #666;">${sanitizeForEmail(post.author)}</div>
                    <div style="font-size: 14px; color: #333; margin-top: 3px;">${sanitizeForEmail(post.content)}</div>
                    <div style="font-size: 12px; color: #999; margin-top: 3px;">${formatDateTime(post.createdAt)}</div>
                  </td>
                </tr>`;
      });
      if (metrics.pendingPostsList.length > 3) {
        htmlBody += `
                <tr>
                  <td style="padding: 10px 0; text-align: center; color: #666; font-style: italic; font-size: 13px;">...and ${metrics.pendingPostsList.length - 3} more posts</td>
                </tr>`;
      }
      htmlBody += `
              </table>
            </td>
          </tr>
`;
    }

    htmlBody += `        </table>\n`;
  }

  // ==================== TODAY'S ACTIVITY + PLATFORM SNAPSHOT ====================

  if (includeSections.includes("metrics")) {
    htmlBody += `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 28px;">
          ${renderSectionHeading("📈", "Today's Activity")}
          <tr><td style="height: 16px; line-height: 16px; font-size: 0;">&nbsp;</td></tr>
          <tr>
            <td>
              ${renderStatGrid([
                { label: "Signup Requests Approved", value: metrics.approvedSignupRequests, emphasis: true },
                { label: "Active Users", value: metrics.activeUsers },
                { label: "New Posts", value: metrics.newPosts },
                { label: "New Comments", value: metrics.newComments },
                { label: "New Connections", value: metrics.newConnections },
                { label: "Messages Sent", value: metrics.messagesSent },
                { label: "New Jobs Posted", value: metrics.newJobsPosted },
                { label: "New Job Applications", value: metrics.newApplications },
              ])}
            </td>
          </tr>
        </table>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 28px;">
          <tr>
            <td style="font-weight: 700; font-size: 16px; color: #333; padding-bottom: 10px;">Platform Snapshot</td>
          </tr>
          ${renderThreeColumnRow([
            renderSnapshotTile(metrics.totalUsers, "Total Users", "#4a5568"),
            renderSnapshotTile(metrics.totalAlumni, "Alumni", BRAND_GREEN),
            renderSnapshotTile(metrics.totalPosts, "Posts", "#3182ce"),
          ])}
          <tr><td style="height: 8px; line-height: 8px; font-size: 0;">&nbsp;</td></tr>
          ${renderThreeColumnRow([
            renderSnapshotTile(metrics.activeJobs, "Active Jobs", "#805ad5"),
            renderSnapshotTile(metrics.newJobsPosted, "New Jobs Today", "#d69e2e"),
            renderSnapshotTile(metrics.activeUsers, "Active Users Today", "#e53e3e"),
          ])}
        </table>
`;

    // Events Section
    if (metrics.upcomingEvents.length > 0) {
      htmlBody += `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 28px;">
          <tr>
            <td style="font-weight: 700; font-size: 16px; color: #333; padding-bottom: 14px;">📅 This Week's Events</td>
          </tr>
`;
      metrics.upcomingEvents.forEach((event: any) => {
        htmlBody += `
          <tr>
            <td bgcolor="#f8f9fa" style="padding: 12px 16px; background-color: #f8f9fa; border-radius: 6px; border-left: 3px solid ${BRAND_GREEN};">
              <strong style="color: #333; font-size: 14px;">${sanitizeForEmail(event.title)}</strong><br>
              <span style="color: #666; font-size: 13px;">${event.isVirtual ? 'Virtual' : sanitizeForEmail(event.location || 'TBD')} &middot; ${formatDateTime(event.eventDate)}</span>
            </td>
          </tr>
          <tr><td style="height: 8px; line-height: 8px; font-size: 0;">&nbsp;</td></tr>
`;
      });
      htmlBody += `        </table>\n`;
    }
  }

  // ==================== INSIGHTS SECTION ====================

  if (includeSections.includes("insights")) {
    // Top Contributors
    if (metrics.mostActiveUsers.length > 0) {
      htmlBody += `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 28px;">
          ${renderSectionHeading("💡", "Top Contributors &mdash; 7-Day Trend")}
          <tr><td style="height: 16px; line-height: 16px; font-size: 0;">&nbsp;</td></tr>
`;
      metrics.mostActiveUsers.forEach((user: any, idx: number) => {
        htmlBody += `
          <tr>
            <td style="padding: 9px 0; border-bottom: 1px solid #e0e0e0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="24" valign="top" bgcolor="${BRAND_GREEN}" style="width: 24px; height: 24px; text-align: center; vertical-align: middle; background-color: ${BRAND_GREEN}; color: #fff; border-radius: 50%; font-size: 12px; font-weight: 700; line-height: 24px;">${idx + 1}</td>
                  <td valign="middle" style="padding-left: 10px; font-size: 14px; color: #333;">
                    <strong>${sanitizeForEmail(user.username || 'Unknown')}</strong>
                    <span style="color: #666; font-size: 13px; margin-left: 8px; white-space: nowrap;">${user.postCount} post${user.postCount !== 1 ? 's' : ''}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
`;
      });
      htmlBody += `        </table>\n`;
    }

    // Recommendations
    if (metrics.recommendations.length > 0) {
      htmlBody += `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 20px;">
          <tr>
            <td style="font-weight: 700; font-size: 16px; color: #333; padding-bottom: 10px;">🎯 Recommendations</td>
          </tr>
`;
      metrics.recommendations.forEach((rec: any) => {
        htmlBody += `
          <tr>
            <td bgcolor="#fff8e1" style="padding: 9px 14px; background-color: #fff8e1; border-radius: 6px; border-left: 3px solid #d99b00; color: #6b4e00; font-size: 13px;">
              ${sanitizeForEmail(rec)}
            </td>
          </tr>
          <tr><td style="height: 6px; line-height: 6px; font-size: 0;">&nbsp;</td></tr>
`;
      });
      htmlBody += `        </table>\n`;
    }
  }

  // ==================== FOOTER ====================

  htmlBody += `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 10px 0;">
          <tr>
            <td align="center" style="font-weight: 700; font-size: 16px; color: #333; padding-bottom: 14px;">Quick Actions</td>
          </tr>
          <tr>
            <td>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td class="action-btn-cell" align="center" style="padding: 6px;">${renderButton(`${baseUrl}/admin/dashboard`, "📊 Dashboard")}</td>
                  <td class="action-btn-cell" align="center" style="padding: 6px;">${renderButton(`${baseUrl}/admin/signup-requests`, "👥 Signups", { variant: "secondary" })}</td>
                  <td class="action-btn-cell" align="center" style="padding: 6px;">${renderButton(`${baseUrl}/admin/feed`, "📝 Posts", { variant: "secondary" })}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
        <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">This is an automated digest from TKS Alumni Portal.</p>
      </td>
    </tr>
    <tr>
      <td>
        ${getEmailFooterHtml(baseUrl, { managePreferencesUrl: `${baseUrl}/admin/settings` })}
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  return { subject, textBody, htmlBody };
}
