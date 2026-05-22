

/**
 * Send Welcome Emails to ALL Alumni Users
 * ----------------------------------------
 * Usage:
 *   Dry run  : npx tsx scripts/send-welcome-emails.ts
 *   Live send: npx tsx scripts/send-welcome-emails.ts --send
 *
 * BCC : awasthivanshaj@gmail.com   (on every email)
 * CC  : alumni@thekalyanischool.edu.in
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { resolve } from "path";

// ── Load env ──────────────────────────────────────────────────────────────────
dotenv.config({ path: resolve(process.cwd(), ".env") });

// ── Config ────────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ZEPTOMAIL_TOKEN = process.env.ZEPTOMAIL_TOKEN!;
const FROM_EMAIL = process.env.ZEPTOMAIL_FROM_EMAIL || "alumni@thekalyanischool.edu.in";
const FROM_NAME = process.env.ZEPTOMAIL_FROM_NAME || "The Kalyani School Alumni Portal";
const BASE_URL = (process.env.BASE_URL || process.env.TKS_URL || "https://tks-new-production.up.railway.app").replace(/\/$/, "");

const BCC_EMAIL = "awasthivanshaj@gmail.com";
const CC_EMAIL = "alumni@thekalyanischool.edu.in";

/** Concurrency – send this many emails in parallel at once */
const BATCH_SIZE = 5;
/** Delay (ms) between batches to avoid rate-limiting */
const BATCH_DELAY_MS = 800;

// ── Guards ────────────────────────────────────────────────────────────────────
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌  Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}
if (!ZEPTOMAIL_TOKEN || ZEPTOMAIL_TOKEN === "your-zeptomail-token-here") {
  console.error("❌  Missing or invalid ZEPTOMAIL_TOKEN in .env");
  process.exit(1);
}

const isLive = process.argv.includes("--send");
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── Email template ─────────────────────────────────────────────────────────────
const REGISTER_URL = `https://alumni.thekalyanischool.com/login`;

function sanitize(text: string): string {
  return (text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

const SUBJECT = "Welcome to The Kalyani School Alumni Portal – Stay Connected!";

const TEXT_BODY = `Dear Alumni,

Namaste!

The experiences, friendships, and lessons you gained here continue to connect us all. Once a part of this institution, you are always family.

Stay engaged with us by registering on the Alumni Portal—your gateway to news, events, and meaningful connections.

Register now: ${REGISTER_URL}

Warm regards,
The Kalyani School
Manjari (Budruk), Near Hadapsar,
Pune 412307, Maharashtra, India
Phone: +91 8149117666 / +91 8149118666 | alumni@thekalyanischool.edu.in`;

const YEAR = new Date().getFullYear();
const LOGO_URL = `${BASE_URL}/tks_logo.png`;

const HTML_BODY = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${sanitize(SUBJECT)}</title>
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
                    <div style="display: inline-block; background: white; border-radius: 50%; padding: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.25);">
                      <img src="${sanitize(LOGO_URL)}" alt="The Kalyani School" width="72" height="72"
                           style="display: block; width: 72px; height: 72px; object-fit: contain; border-radius: 50%;" />
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

              <p style="margin: 0 0 6px 0; font-size: 20px; color: #1a202c; font-weight: 600;">Dear Alumni,</p>
              <p style="margin: 0 0 28px 0; font-size: 22px; color: #008060; font-weight: 700;">Namaste! &#x1F64F;</p>

              <!-- Green accent rule -->
              <div style="width: 48px; height: 3px; background: linear-gradient(90deg, #008060, #00a07a); border-radius: 2px; margin-bottom: 28px;"></div>

              <p style="margin: 0 0 20px 0; font-size: 16px; color: #4a5568; line-height: 1.8;">
                The experiences, friendships, and lessons you gained here continue to connect us all.
                Once a part of this institution, <strong style="color: #2d3748;">you are always family.</strong>
              </p>
              <p style="margin: 0 0 36px 0; font-size: 16px; color: #4a5568; line-height: 1.8;">
                Stay engaged with us by registering on the Alumni Portal&mdash;your gateway to news, events, and meaningful connections.
              </p>

              <!-- CTA -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 40px;">
                <tr>
                  <td align="center">
                    <a href="${sanitize(REGISTER_URL)}"
                       style="display: inline-block; background: linear-gradient(135deg, #006845 0%, #008060 100%); color: #ffffff; text-decoration: none; padding: 16px 44px; border-radius: 50px; font-size: 17px; font-weight: 700; letter-spacing: 0.02em; box-shadow: 0 6px 20px rgba(0,128,96,0.35);">
                      Register Now &rarr;
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 14px;">
                    <p style="margin: 0; font-size: 12px; color: #a0aec0;">Or paste this link in your browser:</p>
                    <p style="margin: 4px 0 0 0; font-size: 12px; color: #008060; word-break: break-all;">${sanitize(REGISTER_URL)}</p>
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
                &copy; ${YEAR} The Kalyani School Alumni Portal. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

// ── ZeptoMail send ─────────────────────────────────────────────────────────────
async function sendEmail(toEmail: string, toName: string): Promise<void> {
  const authHeader = ZEPTOMAIL_TOKEN.startsWith("Zoho-enczapikey ")
    ? ZEPTOMAIL_TOKEN
    : `Zoho-enczapikey ${ZEPTOMAIL_TOKEN}`;

  const payload = {
    from: { address: FROM_EMAIL, name: FROM_NAME },
    to: [{ email_address: { address: toEmail.toLowerCase(), name: toName || toEmail } }],
    cc: [{ email_address: { address: CC_EMAIL.toLowerCase() } }],
    bcc: [{ email_address: { address: BCC_EMAIL.toLowerCase() } }],
    subject: SUBJECT,
    textbody: TEXT_BODY,
    htmlbody: HTML_BODY,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const res = await fetch("https://api.zeptomail.in/v1.1/email", {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = (body as any)?.message || (body as any)?.error || `HTTP ${res.status}`;
      throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    }
  } catch (err: any) {
    clearTimeout(timeout);
    if (err?.name === "AbortError") throw new Error("Request timed out");
    throw err;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function processBatch<T>(
  items: T[],
  fn: (item: T) => Promise<void>
): Promise<{ ok: number; fail: number; errors: string[] }> {
  let ok = 0, fail = 0;
  const errors: string[] = [];

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map(fn));
    results.forEach((r, idx) => {
      if (r.status === "fulfilled") {
        ok++;
      } else {
        fail++;
        errors.push((batch[idx] as any).email + ": " + (r.reason?.message || r.reason));
      }
    });

    if (i + BATCH_SIZE < items.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  return { ok, fail, errors };
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log(" TKS Alumni Portal – Welcome Email Blast");
  console.log(`  Mode   : ${isLive ? "🔴 LIVE SEND" : "🟡 DRY RUN (pass --send to deliver)"}`);
  console.log(`  BCC    : ${BCC_EMAIL}`);
  console.log(`  CC     : ${CC_EMAIL}`);
  console.log(`  From   : ${FROM_NAME} <${FROM_EMAIL}>`);
  console.log(`  Portal : ${BASE_URL}`);
  console.log("═══════════════════════════════════════════════════════════\n");

  // ── 1. Fetch ALL alumni with valid emails ──
  console.log("📥  Fetching alumni users from database...");
  const { data: alumni, error } = await supabase
    .from("alumni")
    .select("user_id, email, first_name, last_name")
    .not("email", "is", null)
    .neq("email", "");

  if (error) {
    console.error("❌  Failed to fetch users:", error.message);
    process.exit(1);
  }

  if (!alumni || alumni.length === 0) {
    console.log("⚠️   No alumni found in database. Exiting.");
    process.exit(0);
  }

  // ── 2. De-duplicate and validate ──
  const seen = new Set<string>();
  const recipients: { email: string; name: string }[] = [];

  for (const a of alumni) {
    const email = (a.email || "").trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      console.warn(`  ⚠️  Skipping invalid email: ${a.email}`);
      continue;
    }
    seen.add(email);
    recipients.push({
      email,
      name: [a.first_name, a.last_name].filter(Boolean).join(" ").trim() || email,
    });
  }

  console.log(`✅  ${alumni.length} records fetched → ${recipients.length} unique valid recipients\n`);

  // ── 3. Preview list ──
  console.log("Recipients:");
  recipients.forEach((r, i) => {
    console.log(`  ${String(i + 1).padStart(4, " ")}. ${r.name} <${r.email}>`);
  });
  console.log();

  if (!isLive) {
    console.log("══════════════════════════════════════════════════════════");
    console.log(" DRY RUN complete – no emails were sent.");
    console.log(" Re-run with --send flag to deliver emails:");
    console.log("   npx tsx scripts/send-welcome-emails.ts --send");
    console.log("══════════════════════════════════════════════════════════");
    return;
  }

  // ── 4. Send ──
  console.log(`🚀  Sending to ${recipients.length} recipients in batches of ${BATCH_SIZE}...\n`);
  let done = 0;

  const { ok, fail, errors } = await processBatch(recipients, async (r) => {
    await sendEmail(r.email, r.name);
    done++;
    console.log(`  [${String(done).padStart(4, " ")}/${recipients.length}] ✅  ${r.email}`);
  });

  // ── 5. Summary ──
  console.log("\n══════════════════════════════════════════════════════════");
  console.log(` SEND COMPLETE`);
  console.log(`   ✅ Sent   : ${ok}`);
  console.log(`   ❌ Failed : ${fail}`);
  if (errors.length) {
    console.log("\n Failed recipients:");
    errors.forEach((e) => console.log(`   • ${e}`));
  }
  console.log("══════════════════════════════════════════════════════════");
}

main().catch((err) => {
  console.error("\n❌  Fatal error:", err?.message || err);
  process.exit(1);
});
