/**
 * Email Service for Password Reset, Setup, Bulk Email, and Admin Digests
 * Uses Zoho ZeptoMail API for sending emails
 */

import { getBaseUrl } from "../utils/base-url";

/** ZeptoMail practical limits; exceeding may cause API errors */
const MAX_SUBJECT_LENGTH = 998;
const MAX_TEXT_BODY_LENGTH = 500 * 1024; // 500 KB
const MAX_HTML_BODY_LENGTH = 500 * 1024; // 500 KB
const EMAIL_REQUEST_TIMEOUT_MS = 20000; // 20 seconds

interface EmailOptions {
  to: string;
  toName?: string;
  bcc?: string[];
  cc?: string[];
  subject: string;
  htmlBody?: string;
  textBody: string;
}

/**
 * Get ZeptoMail configuration from environment variables
 */
function getZeptoMailConfig() {
  const zeptoMailToken = process.env.ZEPTOMAIL_TOKEN;
  const zeptoMailFromEmail =
    process.env.ZEPTOMAIL_FROM_EMAIL || "noreply@evonix.co";
  const zeptoMailFromName =
    process.env.ZEPTOMAIL_FROM_NAME || "TKS Alumni Portal";

  // Validate credentials
  if (
    !zeptoMailToken ||
    zeptoMailToken.trim() === "" ||
    zeptoMailToken === "your-zeptomail-token-here"
  ) {
    throw new Error("ZeptoMail credentials not configured. Please set ZEPTOMAIL_TOKEN in environment variables.");
  }

  return {
    token: zeptoMailToken.trim(),
    fromEmail: zeptoMailFromEmail.trim(),
    fromName: zeptoMailFromName.trim(),
  };
}

/** Call before bulk send to fail fast with a clear message if email is not configured */
export function checkEmailConfig(): void {
  getZeptoMailConfig();
}

/** ZeptoMail error codes for credits: LE_101 = expired, LE_102 = exhausted, TM_5001 = credit exhausted */
const ZEPTOMAIL_CREDITS_ERROR_CODES = ["LE_101", "LE_102", "TM_5001"];

/** Safely get a string from API error payload (message/error can be string or object). Never call .toLowerCase() on raw API data. */
function toErrorMessage(data: unknown): string {
  if (data == null) return "";
  if (typeof data === "string") return data;
  if (typeof data !== "object") return String(data);
  const raw = (data as any).message ?? (data as any).error ?? "";
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object" && "message" in raw) return String((raw as { message?: unknown }).message ?? "");
  return String(raw);
}

function isCreditsErrorInResponse(data: any): boolean {
  if (!data || typeof data !== "object") return false;
  const code = data.code || data.sub_code || data.error_code || "";
  const details = data.details || data.error_details;
  const codeStr = String(code).toUpperCase();
  if (ZEPTOMAIL_CREDITS_ERROR_CODES.some((c) => codeStr.includes(c))) return true;
  if (Array.isArray(details)) {
    return details.some(
      (d: any) =>
        ZEPTOMAIL_CREDITS_ERROR_CODES.some((c) => String(d?.code || d?.sub_code || "").includes(c))
    );
  }
  const msg = toErrorMessage(data);
  return msg.toLowerCase().includes("credit exhausted") || msg.toLowerCase().includes("credits expired");
}

/**
 * Check if ZeptoMail has credits available.
 * ZeptoMail does not document a public credits API; we try a known account/usage path and interpret errors.
 */
export async function getZeptoMailCreditsStatus(): Promise<{
  creditsOk: boolean | "unknown";
  message: string;
  details?: { code?: string; raw?: unknown };
}> {
  try {
    const config = getZeptoMailConfig();
    const authHeader = config.token.startsWith("Zoho-enczapikey ")
      ? config.token
      : `Zoho-enczapikey ${config.token}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    // Try possible account/credits endpoints (ZeptoMail may not expose these; 404 is expected)
    const endpoints = [
      "https://api.zeptomail.in/v1.1/account",
      "https://api.zeptomail.in/v2/account",
      "https://api.zeptomail.in/v1.1/usage",
    ];

    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: authHeader,
            Accept: "application/json",
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const data = await res.json().catch(() => ({}));
        if (res.ok && data) {
          const credits = data.credits ?? data.credit_balance ?? data.remaining_credits ?? data.balance;
          const remaining = typeof credits === "number" ? credits : data.emails_remaining ?? data.remaining;
          if (typeof credits === "number" || typeof remaining === "number") {
            const value = typeof credits === "number" ? credits : remaining;
            return {
              creditsOk: value > 0,
              message: value > 0 ? `Credits available (${value})` : "No credits remaining.",
              details: { raw: data },
            };
          }
        }
        if (res.status === 401 || res.status === 403) {
          return {
            creditsOk: "unknown",
            message: "ZeptoMail token invalid or insufficient permissions. Check ZEPTOMAIL_TOKEN.",
            details: { code: String(res.status), raw: data },
          };
        }
      } catch (e) {
        if ((e as any)?.name === "AbortError") {
          clearTimeout(timeoutId);
          return { creditsOk: "unknown", message: "Request timed out." };
        }
        continue;
      }
    }

    clearTimeout(timeoutId);
    return {
      creditsOk: "unknown",
      message:
        "ZeptoMail does not expose a credits API. Check your balance in ZeptoMail Dashboard → Credit Information.",
    };
  } catch (e: any) {
    const isConfig = /not configured|credentials/.test(e?.message || "");
    return {
      creditsOk: "unknown",
      message: isConfig
        ? "ZeptoMail is not configured (ZEPTOMAIL_TOKEN missing)."
        : e?.message || "Failed to check ZeptoMail status.",
      details: { raw: e?.message },
    };
  }
}

/** Returns true if the error is due to ZeptoMail credits (exhausted/expired) */
export function isZeptoMailCreditsError(error: unknown): boolean {
  const msg = (error as any)?.message ?? "";
  if (typeof msg !== "string") return false;
  if (/credit exhausted|credits expired|LE_101|LE_102|TM_5001/i.test(msg)) return true;
  const details = (error as any)?.details;
  return details && isCreditsErrorInResponse(details);
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

/** Optional logo URL override (e.g. CDN). Otherwise uses baseUrl + /tks_logo.png */
const EMAIL_LOGO_URL = process.env.EMAIL_LOGO_URL || process.env.LOGO_URL;

/**
 * Shared email header with logo and branding.
 * Logo: place at client/public/tks_logo.png or set EMAIL_LOGO_URL / LOGO_URL.
 */
export function getEmailHeaderHtml(baseUrl: string, options?: { logoUrl?: string }): string {
  const logoUrl = options?.logoUrl || EMAIL_LOGO_URL || `${baseUrl.replace(/\/$/, "")}/tks_logo.png`;
  return `
  <div style="background: linear-gradient(135deg, #008060 0%, #006b51 100%); padding: 24px 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 560px; margin: 0 auto;">
      <tr>
        <td style="text-align: center;">
          <img src="${sanitizeForEmail(logoUrl)}" alt="The Kalyani School" width="160" height="48" style="display: inline-block; max-width: 160px; height: auto; outline: none; border: 0;" />
          <div style="font-size: 0; line-height: 0;">&nbsp;</div>
          <span style="display: inline-block; color: white; font-size: 22px; font-weight: 700; letter-spacing: 0.02em;">TKS Alumni Portal</span>
        </td>
      </tr>
    </table>
  </div>`.trim();
}

/**
 * Shared email footer. Options: managePreferencesUrl (e.g. for digest), showContact (link to contact page).
 */
export function getEmailFooterHtml(
  baseUrl: string,
  options?: { managePreferencesUrl?: string; showContact?: boolean }
): string {
  const base = baseUrl.replace(/\/$/, "");
  let links = "";
  if (options?.managePreferencesUrl) {
    links += `<a href="${sanitizeForEmail(options.managePreferencesUrl)}" style="color: #008060; text-decoration: none;">Manage preferences</a>`;
  }
  if (options?.showContact) {
    const contactUrl = `${base}/contact`;
    if (links) links += " &middot; ";
    links += `<a href="${sanitizeForEmail(contactUrl)}" style="color: #008060; text-decoration: none;">Contact us</a>`;
  }
  return `
  <div style="background: #f8f9fa; padding: 20px 30px; text-align: center; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0; border-top: none;">
    <p style="color: #666; font-size: 13px; margin: 0 0 8px 0;">
      <strong>TKS Alumni Portal</strong>
    </p>
    ${links ? `<p style="color: #666; font-size: 12px; margin: 0;">${links}</p>` : ""}
  </div>`.trim();
}

/**
 * Validate email address format and length (RFC 5321 local part + domain)
 */
function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  const trimmed = email.trim().toLowerCase();
  if (trimmed.length > 254) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(trimmed);
}

/**
 * Send email using Zoho ZeptoMail API with timeout and length checks
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const to = options.to?.trim?.() ?? "";
  if (!to || !isValidEmail(to)) {
    throw new Error("Invalid recipient email address");
  }

  const subject = (options.subject ?? "").trim();
  const textBody = (options.textBody ?? "").trim();
  if (!subject) throw new Error("Subject is required");
  if (!textBody) throw new Error("Text body is required");

  if (subject.length > MAX_SUBJECT_LENGTH) {
    throw new Error(`Subject must be ${MAX_SUBJECT_LENGTH} characters or less`);
  }
  if (textBody.length > MAX_TEXT_BODY_LENGTH) {
    throw new Error("Text body exceeds maximum allowed length");
  }

  const htmlBody = options.htmlBody?.trim();
  if (htmlBody && htmlBody.length > MAX_HTML_BODY_LENGTH) {
    throw new Error("HTML body exceeds maximum allowed length");
  }

  const toName = (options.toName ?? "").trim() || to; // fallback to email if empty

  const config = getZeptoMailConfig();

  const emailPayload: Record<string, unknown> = {
    from: {
      address: config.fromEmail,
      name: config.fromName,
    },
    to: [
      {
        email_address: {
          address: to.toLowerCase(),
          name: toName.slice(0, 256), // ZeptoMail may have name length limit
        },
      },
    ],
    subject,
    textbody: textBody,
  };

  if (options.bcc && options.bcc.length > 0) {
    emailPayload.bcc = options.bcc.map(address => ({
      email_address: {
        address: address.toLowerCase()
      }
    }));
  }

  if (options.cc && options.cc.length > 0) {
    emailPayload.cc = options.cc.map(address => ({
      email_address: {
        address: address.toLowerCase()
      }
    }));
  }

  if (htmlBody) (emailPayload as any).htmlbody = htmlBody;

  const authHeader = config.token.startsWith("Zoho-enczapikey ")
    ? config.token
    : `Zoho-enczapikey ${config.token}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), EMAIL_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.zeptomail.in/v1.1/email", {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(emailPayload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    let responseData;
    try {
      responseData = await response.json();
    } catch (parseError) {
      console.error("Failed to parse ZeptoMail response:", parseError);
      const textResponse = await response.text();
      console.error("Raw response:", textResponse);
      throw new Error("Invalid response from email service");
    }

    if (!response.ok) {
      console.error("ZeptoMail API error:", {
        status: response.status,
        statusText: response.statusText,
        data: responseData,
        recipient: to,
      });
      const data = responseData as any;
      const msg = toErrorMessage(data) || `Failed to send email (Status: ${response.status})`;
      if (isCreditsErrorInResponse(data)) {
        const err = new Error("ZeptoMail credits exhausted or expired. Purchase credits from ZeptoMail Subscription page.") as Error & { details?: unknown };
        err.details = data;
        throw err;
      }
      throw new Error(msg);
    }

    console.log("✅ Email sent successfully via ZeptoMail to:", to);
    return true;
  } catch (error: any) {
    clearTimeout(timeoutId);
    const isAbort = error?.name === "AbortError";
    const is5xx =
      typeof (error?.message) === "string" &&
      /Status: 5\d\d/.test(error.message);
    const isNetwork =
      error?.message === "fetch failed" ||
      error?.code === "ECONNREFUSED" ||
      error?.code === "ETIMEDOUT";

    if (isAbort) {
      console.error("❌ ZeptoMail request timeout", { recipient: to });
      throw new Error("Email request timed out. Please try again.");
    }
    console.error("❌ ZeptoMail error:", {
      error: error?.message,
      recipient: to,
      stack: error?.stack,
    });
    throw error;
  }
}

/**
 * Generate password reset email content
 */
export function generatePasswordResetEmail(
  resetLink: string,
  userName?: string
): { subject: string; textBody: string; htmlBody: string } {
  const subject = "Reset Your Password - TKS Alumni Portal";
  const name = sanitizeForEmail((userName ?? "").trim() || "there");
  const safeResetLink = sanitizeForEmail((resetLink ?? "").trim());

  const textBody = `
Hello ${name},

We received a request to reset your password for your TKS Alumni Portal account.

Click the link below to reset your password:
${resetLink}

This link will expire in 1 hour for security reasons.

If you didn't request this password reset, please ignore this email. Your password will remain unchanged.

For security reasons, if you continue to receive these emails, please contact our support team.

Best regards,
TKS Alumni Portal Team
  `.trim();

  const baseUrl = getBaseUrl();
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  ${getEmailHeaderHtml(baseUrl)}
  <div style="background: #ffffff; padding: 40px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #008060; margin-top: 0;">Password Reset Request</h2>
    <p>Hello ${name},</p>
    <p>We received a request to reset your password for your TKS Alumni Portal account.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${safeResetLink}" style="display: inline-block; background: linear-gradient(135deg, #008060 0%, #006b51 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Reset Password</a>
    </div>
    <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
    <p style="color: #008060; word-break: break-all; font-size: 14px; background: #f5f5f5; padding: 10px; border-radius: 4px;">${safeResetLink}</p>
    <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; color: #856404; font-size: 14px;"><strong>⚠️ Security Notice:</strong> This link will expire in <strong>1 hour</strong> for security reasons.</p>
    </div>
    <p style="color: #666; font-size: 14px;">If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</p>
    <p style="color: #666; font-size: 14px;">Need help? <a href="${sanitizeForEmail(baseUrl + "/contact")}" style="color: #008060;">Contact us</a>.</p>
    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
    <p style="color: #999; font-size: 12px; margin: 0;">Best regards,<br><strong>TKS Alumni Portal Team</strong></p>
  </div>
  ${getEmailFooterHtml(baseUrl, { showContact: true })}
</body>
</html>
  `.trim();

  return { subject, textBody, htmlBody };
}

/**
 * Generate admin login OTP email content
 */
export function generateAdminOtpEmail(
  otpCode: string,
  userName?: string,
  expiresInMinutes = 10
): { subject: string; textBody: string; htmlBody: string } {
  const subject = "Your Admin Login OTP - TKS Alumni Portal";
  const name = sanitizeForEmail((userName ?? "").trim() || "Admin");
  const safeOtpCode = sanitizeForEmail(String(otpCode));
  const baseUrl = getBaseUrl();

  const textBody = `
Hello ${name},

Use the following one-time password to complete your admin login:

${safeOtpCode}

This OTP will expire in ${expiresInMinutes} minutes.

If you did not attempt to log in to the admin portal, please reset your password immediately and contact support.

Best regards,
TKS Alumni Portal Team
  `.trim();

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Login OTP</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  ${getEmailHeaderHtml(baseUrl)}
  <div style="background: #ffffff; padding: 40px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #008060; margin-top: 0;">Admin Login Verification</h2>
    <p>Hello ${name},</p>
    <p>Use this one-time password to finish signing in to the admin portal:</p>
    <div style="margin: 30px 0; text-align: center;">
      <div style="display: inline-block; letter-spacing: 0.5em; font-size: 28px; font-weight: 700; color: #008060; background: #f5fbf8; border: 1px solid #cfe9df; border-radius: 10px; padding: 16px 24px;">
        ${safeOtpCode}
      </div>
    </div>
    <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; color: #856404; font-size: 14px;"><strong>Security Notice:</strong> This OTP expires in <strong>${expiresInMinutes} minutes</strong>.</p>
    </div>
    <p style="color: #666; font-size: 14px;">If you did not attempt to log in to the admin portal, please reset your password and contact support immediately.</p>
    <p style="color: #666; font-size: 14px;">Need help? <a href="${sanitizeForEmail(baseUrl + "/contact")}" style="color: #008060;">Contact us</a>.</p>
    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
    <p style="color: #999; font-size: 12px; margin: 0;">Best regards,<br><strong>TKS Alumni Portal Team</strong></p>
  </div>
  ${getEmailFooterHtml(baseUrl, { showContact: true })}
</body>
</html>
  `.trim();

  return { subject, textBody, htmlBody };
}

/**
 * Generate initial password setup email content
 */
export function generatePasswordSetupEmail(
  setupLink: string,
  userName: string,
  tempPassword?: string,
  loginUsername?: string
): { subject: string; textBody: string; htmlBody: string } {
  const subject = "Welcome to TKS Alumni Family - Action Required";
  const hasTempPassword = !!tempPassword;
  const safeUserName = sanitizeForEmail((userName ?? "").trim() || "there");
  const safeSetupLink = sanitizeForEmail((setupLink ?? "").trim());
  const safeTempPassword = tempPassword ? sanitizeForEmail(String(tempPassword)) : "";
  const safeLoginUsername = loginUsername ? sanitizeForEmail(String(loginUsername)) : "";

  const textBody = `
Dear ${safeUserName},

Namaste! 🙏

The experiences, friendships, and lessons you gained here continue to connect us all. Once a part of this institution, you are always family.

Stay engaged with us by registering on the Alumni Portal—your gateway to news, events, and meaningful connections.

${safeLoginUsername ? `Your Username: ${safeLoginUsername}\n\n` : ""}${hasTempPassword ? `Your temporary password is: ${safeTempPassword}\n\n` : ""}Register now to complete your account setup and access the portal:
${safeSetupLink}

This link will expire in 1 hour for security reasons.

If you have any questions or need assistance, please don't hesitate to contact our support team.

Warm regards,
TKS Alumni Portal Team
  `.trim();

  const baseUrl = getBaseUrl();
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to the Alumni Portal</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
  <div style="background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #e0e0e0;">
    ${getEmailHeaderHtml(baseUrl)}
    
    <div style="padding: 40px;">
      <p style="font-size: 18px; color: #2c3e50; margin-top: 0; font-weight: 500;">Dear ${safeUserName},</p>
      
      <h2 style="color: #008060; font-size: 24px; margin-bottom: 20px;">Namaste! 🙏</h2>
      
      <p style="font-size: 16px; color: #4a5568; line-height: 1.7;">
        The experiences, friendships, and lessons you gained here continue to connect us all. Once a part of this institution, you are always family.
      </p>
      
      <p style="font-size: 16px; color: #4a5568; line-height: 1.7;">
        Stay engaged with us by registering on the Alumni Portal—your gateway to news, events, and meaningful connections.
      </p>

      ${(safeLoginUsername || hasTempPassword) ? `
      <div style="background: linear-gradient(145deg, #f8fcfb 0%, #edf7f4 100%); border-left: 4px solid #008060; padding: 24px; margin: 32px 0; border-radius: 8px;">
        <p style="margin: 0 0 16px 0; color: #2c3e50; font-weight: 600; font-size: 16px;">Your Access Details:</p>
        
        ${safeLoginUsername ? `
        <div style="margin-bottom: 12px;">
          <span style="color: #718096; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 4px;">Username</span>
          <code style="background: #ffffff; padding: 6px 12px; border-radius: 6px; font-size: 18px; font-weight: 700; color: #008060; display: inline-block; border: 1px solid #e2e8f0;">${safeLoginUsername}</code>
        </div>
        ` : ""}
        
        ${hasTempPassword ? `
        <div>
          <span style="color: #718096; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 4px;">Temporary Password</span>
          <code style="background: #ffffff; padding: 6px 12px; border-radius: 6px; font-size: 18px; font-weight: 700; color: #e53e3e; display: inline-block; border: 1px solid #e2e8f0; letter-spacing: 1px;">${safeTempPassword}</code>
        </div>
        ` : ""}
      </div>
      ` : ""}

      <div style="text-align: center; margin: 40px 0;">
        <p style="margin-bottom: 20px; color: #4a5568; font-weight: 500;">Register now to complete your account setup:</p>
        <a href="${safeSetupLink}" style="display: inline-block; background: linear-gradient(135deg, #008060 0%, #006b51 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 16px;">Set My Password &rarr;</a>
      </div>
      <p style="color: #008060; word-break: break-all; font-size: 14px; background: #f5f5f5; padding: 10px; border-radius: 4px; text-align: center;">${safeSetupLink}</p>

      <div style="background: #fff8f1; border-left: 4px solid #dd6b20; padding: 16px; margin: 30px 0; border-radius: 4px;">
        <p style="margin: 0; color: #dd6b20; font-size: 14px;"><strong>⚠️ Security Notice:</strong> For your protection, this activation link will expire in <strong>1 hour</strong>.</p>
      </div>

      <p style="color: #718096; font-size: 14px; margin-top: 30px; border-top: 1px solid #edf2f7; padding-top: 20px;">
        If you have any questions or need assistance, please feel free to <a href="${sanitizeForEmail(baseUrl + "/contact")}" style="color: #008060; font-weight: 500;">contact our team</a>.
      </p>

      <p style="color: #4a5568; font-size: 15px; margin: 30px 0 0 0;">
        Warm regards,<br>
        <span style="font-weight: 600; color: #2c3e50; font-size: 16px;">TKS Alumni Portal Team</span>
      </p>
    </div>
  </div>
  ${getEmailFooterHtml(baseUrl, { showContact: true })}
</body>
</html>
  `.trim();

  return { subject, textBody, htmlBody };
}

/**
 * Welcome email template for bulk send (admin). Uses shared header/footer and baseUrl for links.
 * Matches the official welcome template with Namaste greeting, school address in signature.
 */
export function getWelcomeEmailTemplate(): { subject: string; htmlBody: string; textBody: string } {
  const baseUrl = getBaseUrl();
  const registerUrl = `https://alumni.thekalyanischool.com/login`;
  const subject = "Welcome to The Kalyani School Alumni Portal – Stay Connected!";

  const schoolAddress = `The Kalyani School\nManjari (Budruk), Near Hadapsar,\nPune 412307, Maharashtra, India\nPhone: +91 8149117666 / +91 8149118666 | alumni@thekalyanischool.edu.in`;

  const textBody = `Dear Alumni,

Namaste!

The experiences, friendships, and lessons you gained here continue to connect us all. Once a part of this institution, you are always family.

Stay engaged with us by registering on the Alumni Portal—your gateway to news, events, and meaningful connections.

Register now: ${registerUrl}

Warm regards,
${schoolAddress}`;

  const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${sanitizeForEmail(subject)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f0f4f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f0f4f8; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; width: 100%;">

          <!-- LOGO HEADER -->
          <tr>
            <td style="background: linear-gradient(135deg, #006845 0%, #008060 60%, #00a07a 100%); border-radius: 14px 14px 0 0; padding: 36px 40px; text-align: center;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom: 14px;">
                    <!-- Logo with circular badge styling -->
                    <div style="display: inline-block; background: white; border-radius: 50%; padding: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.2);">
                      <img src="${sanitizeForEmail(`${baseUrl.replace(/\/$/, "")}/tks_logo.png`)}" alt="The Kalyani School" width="72" height="72" style="display: block; width: 72px; height: 72px; object-fit: contain; border-radius: 50%;" />
                    </div>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <h1 style="margin: 0 0 4px 0; color: #ffffff; font-size: 26px; font-weight: 700; letter-spacing: 0.02em; line-height: 1.2;">The Kalyani School</h1>
                    <p style="margin: 0; color: rgba(255,255,255,0.85); font-size: 14px; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 500;">Alumni Portal</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="background: #ffffff; padding: 44px 48px 36px; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">

              <!-- Greeting -->
              <p style="margin: 0 0 6px 0; font-size: 20px; color: #1a202c; font-weight: 600;">Dear Alumni,</p>
              <p style="margin: 0 0 28px 0; font-size: 22px; color: #008060; font-weight: 700;">Namaste! 🙏</p>

              <!-- Divider accent -->
              <div style="width: 48px; height: 3px; background: linear-gradient(90deg, #008060, #00a07a); border-radius: 2px; margin-bottom: 28px;"></div>

              <!-- Body copy -->
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #4a5568; line-height: 1.8;">
                The experiences, friendships, and lessons you gained here continue to connect us all. Once a part of this institution, <strong style="color: #2d3748;">you are always family.</strong>
              </p>
              <p style="margin: 0 0 36px 0; font-size: 16px; color: #4a5568; line-height: 1.8;">
                Stay engaged with us by registering on the Alumni Portal&mdash;your gateway to news, events, and meaningful connections.
              </p>

              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 40px;">
                <tr>
                  <td align="center">
                    <a href="${sanitizeForEmail(registerUrl)}" style="display: inline-block; background: linear-gradient(135deg, #006845 0%, #008060 100%); color: #ffffff; text-decoration: none; padding: 16px 44px; border-radius: 50px; font-size: 17px; font-weight: 700; letter-spacing: 0.02em; box-shadow: 0 6px 20px rgba(0,128,96,0.35);">Register Now &rarr;</a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 14px;">
                    <p style="margin: 0; font-size: 12px; color: #a0aec0;">Or paste this link in your browser:</p>
                    <p style="margin: 4px 0 0 0; font-size: 12px; color: #008060; word-break: break-all;">${sanitizeForEmail(registerUrl)}</p>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <hr style="border: none; border-top: 1px solid #edf2f7; margin: 0 0 28px 0;">

              <!-- Warm regards -->
              <p style="margin: 0 0 4px 0; font-size: 15px; color: #718096;">Warm regards,</p>
              <p style="margin: 0 0 2px 0; font-size: 17px; color: #1a202c; font-weight: 700;">The Kalyani School</p>
              <p style="margin: 0; font-size: 13px; color: #718096; line-height: 1.7;">
                Manjari (Budruk), Near Hadapsar,<br>
                Pune 412307, Maharashtra, India<br>
                Phone: +91 8149117666 / +91 8149118666 &nbsp;|&nbsp;
                <a href="mailto:alumni@thekalyanischool.edu.in" style="color: #008060; text-decoration: none;">alumni@thekalyanischool.edu.in</a>
              </p>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background: #f7fafc; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 14px 14px; padding: 20px 40px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #a0aec0;">You received this email because you are a valued alumni of The Kalyani School.</p>
              <p style="margin: 0; font-size: 12px; color: #a0aec0;">
                &copy; ${new Date().getFullYear()} The Kalyani School Alumni Portal. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  return { subject, htmlBody, textBody };
}

/**
 * Generate welcome confirmation email for immediate signups (e.g. Student Lab Signup)
 */
export function generateWelcomeConfirmationEmail(
  userName: string,
  loginEmail: string,
  plainPassword?: string,
  loginUsername?: string
): { subject: string; textBody: string; htmlBody: string } {
  const subject = "Welcome to TKS Alumni Portal Family!";
  const safeUserName = sanitizeForEmail((userName ?? "").trim() || "there");
  const safeEmail = sanitizeForEmail(loginEmail);
  const safePassword = plainPassword ? sanitizeForEmail(String(plainPassword)) : "";
  const safeLoginUsername = loginUsername ? sanitizeForEmail(String(loginUsername)) : "";
  
  const baseUrl = getBaseUrl();
  const loginLink = `${baseUrl.replace(/\/$/, "")}/login`;

  const textBody = `
Dear ${safeUserName},

Namaste!

The experiences, friendships, and lessons you gained here continue to connect us all. Once a part of this institution, you are always family.

Stay engaged with us by registering on the Alumni Portal—your gateway to news, events, and meaningful connections.

Your account has been created successfully.

Login Details:
Email: ${safeEmail}
${safeLoginUsername ? `Username: ${safeLoginUsername}\n` : ""}${safePassword ? `Password: ${safePassword}\n` : ""}
Login here: ${loginLink}

Warm regards,
TKS Alumni Portal Team
  `.trim();

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to the Alumni Portal</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
  <div style="background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #e0e0e0;">
    ${getEmailHeaderHtml(baseUrl)}
    
    <div style="padding: 40px;">
      <p style="font-size: 18px; color: #2c3e50; margin-top: 0; font-weight: 500;">Dear ${safeUserName},</p>
      
      <h2 style="color: #008060; font-size: 24px; margin-bottom: 20px;">Namaste! 🙏</h2>
      
      <p style="font-size: 16px; color: #4a5568; line-height: 1.7;">
        The experiences, friendships, and lessons you gained here continue to connect us all. Once a part of this institution, you are always family.
      </p>
      
      <p style="font-size: 16px; color: #4a5568; line-height: 1.7;">
        Stay engaged with us by registering on the Alumni Portal—your gateway to news, events, and meaningful connections.
      </p>
      
      <div style="background: linear-gradient(145deg, #f8fcfb 0%, #edf7f4 100%); border-left: 4px solid #008060; padding: 24px; margin: 32px 0; border-radius: 8px;">
        <p style="margin: 0 0 16px 0; color: #2c3e50; font-weight: 600; font-size: 16px;">Account Details:</p>
        
        <div style="margin-bottom: 12px;">
          <span style="color: #718096; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 2px;">Email</span>
          <span style="color: #2c3e50; font-size: 15px; font-weight: 500;">${safeEmail}</span>
        </div>

        ${safeLoginUsername ? `
        <div style="margin-bottom: 12px;">
          <span style="color: #718096; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 2px;">Username</span>
          <code style="background: #ffffff; padding: 4px 8px; border-radius: 6px; font-size: 16px; font-weight: 700; color: #008060; display: inline-block; border: 1px solid #e2e8f0;">${safeLoginUsername}</code>
        </div>
        ` : ""}
        
        ${safePassword ? `
        <div>
          <span style="color: #718096; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 2px;">Password</span>
          <code style="background: #ffffff; padding: 4px 8px; border-radius: 6px; font-size: 16px; font-weight: 700; color: #e53e3e; display: inline-block; border: 1px solid #e2e8f0; letter-spacing: 1px;">${safePassword}</code>
        </div>
        ` : ""}
      </div>

      <div style="text-align: center; margin: 40px 0;">
        <a href="${sanitizeForEmail(loginLink)}" style="display: inline-block; background: linear-gradient(135deg, #008060 0%, #006b51 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 16px;">Login to Portal &rarr;</a>
      </div>

      <p style="color: #718096; font-size: 14px; margin-top: 30px; border-top: 1px solid #edf2f7; padding-top: 20px;">
        If you have any questions or need assistance, please feel free to <a href="${sanitizeForEmail(baseUrl + "/contact")}" style="color: #008060; font-weight: 500;">contact our team</a>.
      </p>

      <p style="color: #4a5568; font-size: 15px; margin: 30px 0 0 0;">
        Warm regards,<br>
        <span style="font-weight: 600; color: #2c3e50; font-size: 16px;">TKS Alumni Portal Team</span>
      </p>
    </div>
  </div>
  ${getEmailFooterHtml(baseUrl, { showContact: true })}
</body>
</html>
  `.trim();

  return { subject, textBody, htmlBody };
}

/**
 * Replace data-embedded blocks with fully table-based email card HTML.
 * Must be called BEFORE inlineStyleHtml so the card markup gets styled too.
 */
function renderEmbeddedCardsForEmail(html: string, baseUrl: string): string {
  if (!html.includes("data-embedded=")) return html;

  const LABEL: Record<string, string> = { blog: "Blog Post", podcast: "Podcast", post: "Community Post" };
  const ACCENT: Record<string, string> = { blog: "#7c3aed", podcast: "#e11d48", post: "#0284c7" };

  return html.replace(
    /<div\s+data-embedded="([^"]*)"[^>]*data-embedded-type="([^"]*)"[^>]*data-embedded-id="([^"]*)"[^>]*data-embedded-url="([^"]*)"[^>]*data-embedded-cover="([^"]*)"[^>]*data-embedded-meta="([^"]*)"[^>]*>([\s\S]*?)<\/div>/gi,
    (_match, _embedId, type, _id, url, cover, meta, inner) => {
      const titleMatch = inner.match(/<span[^>]*data-embedded-title[^>]*>([\s\S]*?)<\/span>/i);
      const excerptMatch = inner.match(/<span[^>]*data-embedded-excerpt[^>]*>([\s\S]*?)<\/span>/i);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, "").trim() : "";
      const excerpt = excerptMatch ? excerptMatch[1].replace(/<[^>]*>/g, "").trim() : "";
      const label = LABEL[type] || "Featured";
      const accent = ACCENT[type] || "#008060";
      const fullUrl = `${baseUrl.replace(/\/$/, "")}${url}`;

      const coverBlock = cover
        ? `<tr>
            <td style="padding:0;line-height:0;font-size:0;">
              <img src="${cover}" alt="" width="540" style="display:block;width:100%;max-width:540px;height:auto;max-height:180px;object-fit:cover;border:0;" />
            </td>
          </tr>`
        : "";

      const metaBlock = meta
        ? `<p style="font-size:12px;color:#9ca3af;margin:0 0 6px 0;">${meta}</p>`
        : "";

      const excerptBlock = excerpt
        ? `<p style="font-size:14px;color:#4b5563;line-height:1.6;margin:6px 0 14px 0;">${excerpt.slice(0, 160)}${excerpt.length > 160 ? "…" : ""}</p>`
        : "";

      return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:28px 0;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;border-top:4px solid ${accent};box-shadow:0 2px 8px rgba(0,0,0,0.06);">
  <tr>
    <td style="padding:6px 20px;background:#f9fafb;border-bottom:1px solid #f0f0f0;">
      <p style="font-size:10px;font-weight:700;color:${accent};text-transform:uppercase;letter-spacing:0.12em;margin:0;">${label}</p>
    </td>
  </tr>
  ${coverBlock}
  <tr>
    <td style="padding:20px 24px;background:#ffffff;">
      ${metaBlock}
      ${title ? `<h3 style="font-size:18px;font-weight:700;color:#111827;margin:0 0 8px 0;line-height:1.3;">${title}</h3>` : ""}
      ${excerptBlock}
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;">
        <tr>
          <td style="background:${accent};border-radius:50px;">
            <a href="${fullUrl}" style="display:inline-block;padding:10px 24px;font-size:13px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:50px;letter-spacing:0.02em;">Read more &rarr;</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
    }
  );
}

/**
 * Convert TipTap-generated HTML to email-safe HTML with inline styles.
 * Email clients strip CSS classes, so we convert semantic elements to inline-styled equivalents.
 */
export function inlineStyleHtml(html: string): string {
  if (!html) return "";
  // Strip pre-existing style attributes first to avoid duplicate style= attributes
  // which email clients handle inconsistently (last one wins in most, first in some)
  const stripStyle = (attrs: string) => attrs.replace(/\s+style="[^"]*"/gi, "").replace(/\s+style='[^']*'/gi, "");
  // Strip article wrapper attributes — keep content, remove data-* scaffolding
  html = html
    .replace(/<section[^>]*data-article[^>]*>/gi, '<div style="margin:0 0 36px 0;padding-bottom:36px;border-bottom:2px solid #e2e8f0;">')
    .replace(/<\/section>/gi, "</div>")
    .replace(/<h2[^>]*data-article-title[^>]*>/gi, '<h2 style="font-size:22px;font-weight:800;color:#111827;margin:0 0 14px 0;line-height:1.25;padding-bottom:10px;border-bottom:2px solid #A6CE39;">')
    .replace(/<img([^>]*data-article-image[^>]*)\/?>/gi, (_, a) => `<img${stripStyle(a).replace(/\s*data-article-image\s*/gi, " ")} style="max-width:100%;height:auto;display:block;margin:0 0 10px 0;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.09);" />`)
    .replace(/<div[^>]*data-article-body[^>]*>/gi, "<div>");
  return html
    .replace(/<h1([^>]*)>/gi, (_, a) => `<h1${stripStyle(a)} style="font-size:24px;font-weight:700;color:#1a202c;margin:24px 0 12px 0;line-height:1.3;">`)
    .replace(/<h2([^>]*)>/gi, (_, a) => `<h2${stripStyle(a)} style="font-size:20px;font-weight:700;color:#1a202c;margin:20px 0 10px 0;line-height:1.3;">`)
    .replace(/<h3([^>]*)>/gi, (_, a) => `<h3${stripStyle(a)} style="font-size:17px;font-weight:600;color:#1a202c;margin:16px 0 8px 0;line-height:1.3;">`)
    .replace(/<p([^>]*)>/gi, (_, a) => `<p${stripStyle(a)} style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 16px 0;">`)
    .replace(/<strong([^>]*)>/gi, (_, a) => `<strong${stripStyle(a)} style="font-weight:700;color:#111827;">`)
    .replace(/<em([^>]*)>/gi, (_, a) => `<em${stripStyle(a)} style="font-style:italic;">`)
    .replace(/<ul([^>]*)>/gi, (_, a) => `<ul${stripStyle(a)} style="margin:0 0 16px 0;padding-left:24px;">`)
    .replace(/<ol([^>]*)>/gi, (_, a) => `<ol${stripStyle(a)} style="margin:0 0 16px 0;padding-left:24px;">`)
    .replace(/<li([^>]*)>/gi, (_, a) => `<li${stripStyle(a)} style="font-size:15px;color:#374151;line-height:1.7;margin-bottom:6px;">`)
    .replace(/<blockquote([^>]*)>/gi, (_, a) => `<blockquote${stripStyle(a)} style="margin:16px 0;padding:12px 20px;border-left:4px solid #008060;background:#f0fdf9;color:#374151;font-style:italic;">`)
    .replace(/<a([^>]*)>/gi, (_, a) => `<a${stripStyle(a)} style="color:#008060;text-decoration:underline;">`)
    .replace(/<code([^>]*)>/gi, (_, a) => `<code${stripStyle(a)} style="font-family:monospace;background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:13px;color:#374151;">`)
    .replace(/<pre([^>]*)>/gi, (_, a) => `<pre${stripStyle(a)} style="background:#1e293b;color:#e2e8f0;padding:16px;border-radius:8px;overflow-x:auto;font-size:13px;margin:0 0 16px 0;">`)
    // Additional TipTap output elements
    .replace(/<img([^>]*)\/?>/gi, (_, a) => `<img${stripStyle(a)} style="max-width:100%;height:auto;display:block;margin:14px 0;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.09);" />`)
    .replace(/<hr([^>]*)\/?>/gi, () => `<hr style="border:none;border-top:2px solid #e2e8f0;margin:28px 0;" />`)
    .replace(/<s([^>]*)>/gi, (_, a) => `<s${stripStyle(a)} style="text-decoration:line-through;color:#9ca3af;">`)
    .replace(/<del([^>]*)>/gi, (_, a) => `<del${stripStyle(a)} style="text-decoration:line-through;color:#9ca3af;">`)
    .replace(/<table([^>]*)>/gi, (_, a) => `<table${stripStyle(a)} style="width:100%;border-collapse:collapse;margin:0 0 16px 0;">`)
    .replace(/<th([^>]*)>/gi, (_, a) => `<th${stripStyle(a)} style="padding:8px 12px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:600;text-align:left;font-size:14px;color:#374151;">`)
    .replace(/<td([^>]*)>/gi, (_, a) => `<td${stripStyle(a)} style="padding:8px 12px;border:1px solid #e5e7eb;font-size:14px;color:#374151;">`);
}

/**
 * Generate branded newsletter email HTML wrapping TipTap content.
 * Options:
 *   recipientFirstName — personalises with "Hi [name]," greeting
 *   unsubscribeToken   — adds a signed unsubscribe link in the footer
 *   trackingPixelUrl   — injects a 1×1 pixel for open tracking
 */
export function generateNewsletterEmailHtml(
  baseUrl: string,
  newsletter: { title: string; content: string; slug: string; excerpt?: string | null; cover_image?: string | null },
  options?: {
    recipientFirstName?: string;
    unsubscribeToken?: string;
    trackingPixelUrl?: string;
  }
): string {
  const base = baseUrl.replace(/\/$/, "");
  const logoUrl = EMAIL_LOGO_URL || `${base}/tks_logo.png`;
  const archiveUrl = `${base}/newsletters/${encodeURIComponent(newsletter.slug)}`;
  const contactUrl = `${base}/contact`;
  const contentWithCards = renderEmbeddedCardsForEmail(newsletter.content, base);
  const styledContent = inlineStyleHtml(contentWithCards);
  const issueDate = new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });
  const year = new Date().getFullYear();

  const greeting = options?.recipientFirstName
    ? `<p style="font-size:17px;color:#374151;margin:0 0 20px 0;font-weight:500;">Hi ${sanitizeForEmail(options.recipientFirstName)},</p>`
    : "";

  const unsubscribeLink = options?.unsubscribeToken
    ? `${base}/api/newsletters/unsubscribe?token=${encodeURIComponent(options.unsubscribeToken)}`
    : `${base}/settings`;

  const trackingPixel = options?.trackingPixelUrl
    ? `<img src="${sanitizeForEmail(options.trackingPixelUrl)}" width="1" height="1" style="display:none;width:1px;height:1px;" alt="" />`
    : "";

  const coverImageBlock = newsletter.cover_image
    ? `<tr>
        <td style="padding:0;line-height:0;font-size:0;overflow:hidden;">
          <img src="${sanitizeForEmail(newsletter.cover_image)}" alt="${sanitizeForEmail(newsletter.title)}" width="600" class="cover-img" style="display:block;width:100%;max-width:600px;max-height:320px;height:auto;object-fit:cover;border:0;" />
        </td>
      </tr>
      <tr>
        <td height="6" style="background:linear-gradient(180deg,rgba(0,104,69,0.18) 0%,rgba(0,104,69,0) 100%);font-size:0;line-height:0;">&nbsp;</td>
      </tr>`
    : "";

  const excerptText = newsletter.excerpt
    ? newsletter.excerpt.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()
    : "";
  const excerptBlock = excerptText
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 28px 0;">
        <tr>
          <td style="background:#f0fdf9;border-left:5px solid #008060;padding:16px 22px;border-radius:0 8px 8px 0;">
            <p style="font-size:10px;font-weight:700;color:#008060;text-transform:uppercase;letter-spacing:0.12em;margin:0 0 8px 0;">Summary</p>
            <p style="font-size:17px;font-style:italic;font-weight:500;color:#374151;line-height:1.65;margin:0;">${sanitizeForEmail(excerptText)}</p>
          </td>
        </tr>
      </table>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${sanitizeForEmail(newsletter.title)}</title>
  <style>
    @media only screen and (max-width:600px){
      .email-outer{padding:0!important;}
      .email-body{padding:24px 20px!important;}
      .masthead-title{font-size:22px!important;}
      .masthead-pad{padding:20px 20px 0!important;}
      .cta-pad{padding:20px 20px 32px!important;}
      .footer-pad{padding:16px 20px!important;}
      img.cover-img{max-height:200px!important;height:auto!important;}
      img.article-img{width:100%!important;height:auto!important;border-radius:6px!important;}
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="email-outer" style="background-color:#f0f4f8;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;">

          <!-- [A] MASTHEAD -->
          <tr>
            <td style="border-radius:10px 10px 0 0;overflow:hidden;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <!-- Logo bar -->
                <tr>
                  <td style="background:linear-gradient(135deg,#006845 0%,#008060 100%);padding:16px 28px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td style="vertical-align:middle;">
                          <!-- Circular badge + name -->
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td style="vertical-align:middle;padding-right:12px;">
                                <div style="display:inline-block;background:#ffffff;border-radius:50%;padding:5px;box-shadow:0 2px 8px rgba(0,0,0,0.25);">
                                  <img src="${sanitizeForEmail(logoUrl)}" alt="The Kalyani School" width="38" height="38" style="display:block;width:38px;height:38px;border-radius:50%;object-fit:contain;border:0;" />
                                </div>
                              </td>
                              <td style="vertical-align:middle;">
                                <p style="margin:0;font-size:15px;font-weight:700;color:#ffffff;letter-spacing:0.01em;line-height:1.2;">The Kalyani School</p>
                                <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.75);letter-spacing:0.08em;text-transform:uppercase;">Alumni Portal</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                        <td style="text-align:right;vertical-align:middle;">
                          <span style="display:inline-block;background:rgba(166,206,57,0.25);border:1px solid rgba(166,206,57,0.6);border-radius:50px;padding:4px 14px;font-size:11px;font-weight:700;color:#A6CE39;letter-spacing:0.1em;text-transform:uppercase;">Newsletter</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <!-- Title block -->
                <tr>
                  <td class="masthead-pad" style="background:linear-gradient(180deg,#006b51 0%,#005a44 100%);padding:28px 36px 0;">
                    <p style="font-size:11px;letter-spacing:0.18em;color:#A6CE39;text-transform:uppercase;font-weight:700;margin:0 0 8px 0;">The Kalyani School &nbsp;&#x2022;&nbsp; ${issueDate}</p>
                    <h1 class="masthead-title" style="font-size:30px;font-weight:800;color:#ffffff;line-height:1.2;margin:0 0 24px 0;letter-spacing:-0.01em;">${sanitizeForEmail(newsletter.title)}</h1>
                    <!-- Two-tone accent divider — bolder -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td width="50%" height="6" style="background:#FDD11F;font-size:0;line-height:0;">&nbsp;</td>
                        <td width="50%" height="6" style="background:#A6CE39;font-size:0;line-height:0;">&nbsp;</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- [B] COVER IMAGE (conditional) -->
          ${coverImageBlock}

          <!-- [C] CONTENT BODY -->
          <tr>
            <td class="email-body" style="background:#ffffff;padding:40px 48px 8px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
              ${greeting}
              ${excerptBlock}
              <hr style="border:none;border-top:2px solid #e5e7eb;margin:0 0 28px 0;">
              <div style="font-size:15px;color:#374151;line-height:1.7;">
                ${styledContent}
              </div>
            </td>
          </tr>

          <!-- [D] CTA BUTTON -->
          <tr>
            <td class="cta-pad" style="background:#ffffff;padding:28px 48px 44px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
                <tr>
                  <td style="background:linear-gradient(135deg,#006845 0%,#008060 100%);border-radius:50px;box-shadow:0 6px 20px rgba(0,128,96,0.35);">
                    <a href="${sanitizeForEmail(archiveUrl)}" style="display:inline-block;padding:16px 44px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.03em;border-radius:50px;">Read Full Newsletter &rarr;</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- [E] ENHANCED FOOTER -->
          <tr>
            <td style="background:#1a202c;border-radius:0 0 10px 10px;overflow:hidden;">
              <!-- Identity block -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td class="footer-pad" style="padding:28px 36px 20px;text-align:center;">
                    <div style="display:inline-block;background:rgba(255,255,255,0.08);border-radius:50%;padding:8px;margin-bottom:12px;">
                      <img src="${sanitizeForEmail(logoUrl)}" alt="The Kalyani School" width="40" height="40" style="display:block;width:40px;height:40px;border-radius:50%;object-fit:contain;border:0;outline:none;" />
                    </div>
                    <p style="font-size:15px;font-weight:700;color:#ffffff;margin:0 0 6px 0;">The Kalyani School</p>
                    <p style="font-size:12px;color:rgba(255,255,255,0.55);margin:0 0 4px 0;line-height:1.6;">Manjari (Budruk), Near Hadapsar, Pune 412307, Maharashtra, India</p>
                    <p style="font-size:12px;color:rgba(255,255,255,0.55);margin:0;">
                      +91 8149117666 &nbsp;/&nbsp; +91 8149118666 &nbsp;&middot;&nbsp;
                      <a href="mailto:alumni@thekalyanischool.edu.in" style="color:#A6CE39;text-decoration:none;">alumni@thekalyanischool.edu.in</a>
                    </p>
                  </td>
                </tr>
                <!-- Thin divider -->
                <tr>
                  <td style="padding:0 36px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td height="1" style="background:rgba(255,255,255,0.1);font-size:0;line-height:0;">&nbsp;</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <!-- Links & copyright -->
                <tr>
                  <td class="footer-pad" style="padding:16px 36px 24px;text-align:center;">
                    <p style="margin:0 0 10px 0;">
                      <a href="${sanitizeForEmail(`${base}/settings`)}" style="color:#A6CE39;font-size:12px;text-decoration:none;">Manage preferences</a>
                      &nbsp;&middot;&nbsp;
                      <a href="${sanitizeForEmail(unsubscribeLink)}" style="color:#A6CE39;font-size:12px;text-decoration:none;">Unsubscribe</a>
                      &nbsp;&middot;&nbsp;
                      <a href="${sanitizeForEmail(contactUrl)}" style="color:#A6CE39;font-size:12px;text-decoration:none;">Contact us</a>
                    </p>
                    <p style="font-size:11px;color:rgba(255,255,255,0.4);margin:0;">&copy; ${year} The Kalyani School Alumni Portal. All rights reserved.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
  ${trackingPixel}
</body>
</html>`.trim();
}
