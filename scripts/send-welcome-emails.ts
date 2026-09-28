

/**
 * Send "School Gang" Alumni Portal Invite Email to ALL Alumni Users
 * -------------------------------------------------------------------
 * Usage:
 *   Dry run    : npx tsx scripts/send-welcome-emails.ts
 *                  (fetches + prints recipient list, sends nothing)
 *   Test send  : npx tsx scripts/send-welcome-emails.ts --test
 *                  (sends exactly ONE real email to TEST_EMAIL below,
 *                   or npx tsx scripts/send-welcome-emails.ts --test=you@example.com)
 *   Live send  : npx tsx scripts/send-welcome-emails.ts --send
 *                  (sends to every alumni recipient — ALWAYS run --test first!)
 *
 * BCC : vanshaj@evonix.co   (on every email)
 * CC  : alumni@thekalyanischool.edu.in
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { resolve } from "path";

// ── Load env ──────────────────────────────────────────────────────────────────
dotenv.config({ path: resolve(process.cwd(), ".env") });

// ── Config ────────────────────────────────────────────────────────────────────
// NOTE: .env's active SUPABASE_URL points at a small (~40-row) dev/test project.
// The real production alumni data lives in the project below (same one used by
// scripts/export-all-alumni.ts and the dummy-email cleanup migrations). Override
// with EXPORT_SUPABASE_URL/EXPORT_SUPABASE_SERVICE_ROLE_KEY if needed.
const SUPABASE_URL = process.env.EXPORT_SUPABASE_URL || "https://aikvtpqqxasdctchtgct.supabase.co";
const SUPABASE_SERVICE_KEY =
  process.env.EXPORT_SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpa3Z0cHFxeGFzZGN0Y2h0Z2N0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTI5ODM4OCwiZXhwIjoyMDc0ODc0Mzg4fQ.N4Y9iGXA-PnSfSd65U94NOu_QvnTnkl51LWRREzLt5s";
const ZEPTOMAIL_TOKEN = process.env.ZEPTOMAIL_TOKEN!;
const FROM_EMAIL = process.env.ZEPTOMAIL_FROM_EMAIL || "alumni@thekalyanischool.edu.in";
const FROM_NAME = process.env.ZEPTOMAIL_FROM_NAME || "The Kalyani School Alumni Portal";
const BASE_URL = (process.env.BASE_URL || process.env.TKS_URL || "https://tks-new-production.up.railway.app").replace(/\/$/, "");

const BCC_EMAILS = ["vanshaj@evonix.co"];
const CC_EMAIL = "alumni@thekalyanischool.edu.in";

/** Default recipient for --test mode; override with --test=you@example.com */
const TEST_EMAIL = "niladri28@gmail.com";

/** Concurrency – send this many emails in parallel at once */
const BATCH_SIZE = 5;
/** Delay (ms) between batches to avoid rate-limiting */
const BATCH_DELAY_MS = 800;

/**
 * Excluded from the live send — reviewed and confirmed 2026-09-24 (see
 * Alumni_Portal_Invite_Campaign_Review.pdf). Three groups:
 *  - Uncorrected dummy/placeholder emails (@...student.tks.com / *.placeholder.com)
 *  - @demo.com dev/seed test accounts
 *  - Data-entry errors: generic placeholder names or typo'd domains (gamil.com/gmai.com)
 * Pending real contact data from the school for these accounts.
 */
function isExcludedEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  if (domain.includes("tks.com") || domain.includes("placeholder")) return true; // dummy
  if (domain === "demo.com") return true; // seed/test accounts
  if (domain === "gamil.com" || domain === "gmai.com") return true; // typo'd domain
  if (email === "user@gmail.com" || email === "shah@gmail.com") return true; // generic placeholder rows
  return false;
}

// ── Guards ────────────────────────────────────────────────────────────────────
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌  Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}
if (!ZEPTOMAIL_TOKEN || ZEPTOMAIL_TOKEN === "your-zeptomail-token-here") {
  console.error("❌  Missing or invalid ZEPTOMAIL_TOKEN in .env");
  process.exit(1);
}

const testArg = process.argv.find((a) => a === "--test" || a.startsWith("--test="));
const isTest = !!testArg;
const testEmail = testArg?.includes("=") ? testArg.split("=")[1] : TEST_EMAIL;
const isLive = process.argv.includes("--send");
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── Email template ─────────────────────────────────────────────────────────────
// Points at Forgot Password (not /login) so the same email/instructions work
// whether the recipient is registering fresh or already has an account under
// this email — they just set a password for this email either way.
const REGISTER_URL = `https://alumni.thekalyanischool.com/forgot-password`;

function sanitize(text: string): string {
  return (text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

const SUBJECT = "🎒 The School Gang is Getting Back Together!";

const TEXT_BODY = `Hey Alumni! 👋

Remember the assembly lines, canteen chats, sports days, annual functions, and all those unforgettable school memories?

Well, we've got exciting news! 🎉 Our new Alumni Portal is now LIVE, and we'd love to have you on board.

Registration takes just a few minutes, but the memories and connections can last a lifetime - ${REGISTER_URL}

Just enter your email and set a password to get started - it works whether this is your first time or you're picking up right where you left off.

✨ Why join?

- Reconnect with old classmates
- Stay updated on school news and events
- Share your achievements (bragging rights welcome 😎)
- Network with fellow alumni
- Give back through mentoring and school initiatives

It only takes a few minutes. Invite your batchmates too, and let's get the whole gang back together! 🚀

See you on the portal!

Cheers,
The Kalyani School- Alumni Team 🎓💙`;

const YEAR = new Date().getFullYear();
// Served from the live portal domain (BASE_URL/.env may point at a stale/dev deployment)
const LOGO_URL = `https://alumni.thekalyanischool.com/tks_logo.png`;

/** Icon-badge bullet row for the "Why join?" list. Each item: [emoji, text] */
const WHY_JOIN_ITEMS: [string, string][] = [
  ["&#x1F91D;", "Reconnect with old classmates"],
  ["&#x1F4F0;", "Stay updated on school news and events"],
  ["&#x1F3C6;", "Share your achievements (bragging rights welcome &#x1F60E;)"],
  ["&#x1F310;", "Network with fellow alumni"],
  ["&#x1F331;", "Give back through mentoring and school initiatives"],
];

const whyJoinRowsHtml = WHY_JOIN_ITEMS.map(
  ([icon, text]) => `
                <tr>
                  <td style="padding: 0 0 12px 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background: #f6fbf9; border: 1px solid #e3f2ec; border-radius: 12px;">
                      <tr>
                        <td width="48" style="padding: 14px 0 14px 16px; vertical-align: middle;">
                          <div style="width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(135deg, #00a07a 0%, #008060 100%); text-align: center; line-height: 34px; font-size: 16px;">${icon}</div>
                        </td>
                        <td style="padding: 14px 16px 14px 12px; vertical-align: middle; font-size: 15px; color: #2d3748; line-height: 1.5; font-weight: 500;">${text}</td>
                      </tr>
                    </table>
                  </td>
                </tr>`
).join("");

const HTML_BODY = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>${sanitize(SUBJECT)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #eef3f1; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #eef3f1; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; width: 100%;">

          <!-- PREHEADER SPACER (hidden badge above the card) -->
          <tr>
            <td align="center" style="padding-bottom: 14px;">
              <span style="display: inline-block; background: #ffffff; border: 1px solid #d6ebe3; color: #008060; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 6px 16px; border-radius: 999px;">&#x1F4E3; Big Announcement</span>
            </td>
          </tr>

          <!-- CARD -->
          <tr>
            <td style="background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,64,48,0.12);">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">

                <!-- LOGO HEADER -->
                <tr>
                  <td style="background-color: #008060; background-image: linear-gradient(135deg, #005f47 0%, #008060 55%, #00b389 100%); padding: 40px 40px 34px; text-align: center;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td align="center" style="padding-bottom: 16px;">
                          <div style="display: inline-block; background: white; border-radius: 50%; padding: 10px; box-shadow: 0 6px 24px rgba(0,0,0,0.2);">
                            <img src="${sanitize(LOGO_URL)}" alt="The Kalyani School" width="72" height="72"
                                 style="display: block; width: 72px; height: 72px; object-fit: contain; border-radius: 50%;" />
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td align="center">
                          <h1 style="margin: 0 0 6px 0; color: #ffffff; font-size: 27px; font-weight: 800; letter-spacing: 0.01em; line-height: 1.2;">The Kalyani School</h1>
                          <p style="margin: 0; color: rgba(255,255,255,0.9); font-size: 13px; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 600;">Alumni Portal</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- BODY -->
                <tr>
                  <td style="padding: 40px 40px 8px;">

                    <p style="margin: 0 0 4px 0; font-size: 22px; color: #14201c; font-weight: 800; line-height: 1.3;">Hey Alumni! &#x1F44B;</p>
                    <div style="width: 56px; height: 4px; background: linear-gradient(90deg, #008060, #00c896); border-radius: 4px; margin: 14px 0 26px 0;"></div>

                    <p style="margin: 0 0 18px 0; font-size: 16px; color: #4a5568; line-height: 1.75;">
                      Remember the assembly lines, canteen chats, sports days, annual functions, and all those unforgettable school memories?
                    </p>
                    <p style="margin: 0 0 26px 0; font-size: 16px; color: #4a5568; line-height: 1.75;">
                      Well, we've got exciting news! &#x1F389; Our new Alumni Portal is now LIVE, and we'd love to have you on board.
                    </p>

                    <!-- Highlight strip -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 20px;">
                      <tr>
                        <td style="background: linear-gradient(135deg, #f0faf6 0%, #e6f6ef 100%); border: 1px solid #cdeee0; border-radius: 14px; padding: 18px 22px; text-align: center;">
                          <p style="margin: 0; font-size: 15px; color: #00543f; line-height: 1.6; font-weight: 600;">
                            Registration takes just a few minutes, but the memories and connections can last a lifetime.
                          </p>
                        </td>
                      </tr>
                    </table>

                    <p style="margin: 0 0 26px 0; font-size: 15px; color: #4a5568; line-height: 1.7;">
                      Just enter your email and set a password to get started &mdash; it works whether this is your first time or you're picking up right where you left off.
                    </p>

                    <!-- CTA -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 8px;">
                      <tr>
                        <td align="center">
                          <a href="${sanitize(REGISTER_URL)}"
                             style="display: inline-block; background-color: #008060; background-image: linear-gradient(135deg, #006845 0%, #00a07a 100%); color: #ffffff !important; text-decoration: none; padding: 17px 48px; border-radius: 50px; font-size: 17px; font-weight: 700; letter-spacing: 0.02em; box-shadow: 0 10px 24px rgba(0,128,96,0.35); mso-padding-alt: 0;">
                            Set Up Your Account &rarr;
                          </a>
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="padding-top: 16px;">
                          <p style="margin: 0; font-size: 12px; color: #a0aec0;">Or paste this link in your browser:</p>
                          <p style="margin: 4px 0 0 0; font-size: 12px; color: #008060; word-break: break-all;">${sanitize(REGISTER_URL)}</p>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>

                <!-- WHY JOIN -->
                <tr>
                  <td style="padding: 22px 40px 6px;">
                    <p style="margin: 0 0 16px 0; font-size: 18px; color: #14201c; font-weight: 800;">&#x2728; Why join?</p>
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      ${whyJoinRowsHtml}
                    </table>
                  </td>
                </tr>

                <!-- CLOSING -->
                <tr>
                  <td style="padding: 10px 40px 36px;">
                    <p style="margin: 0 0 6px 0; font-size: 16px; color: #4a5568; line-height: 1.75;">
                      It only takes a few minutes. Invite your batchmates too, and let's get the whole gang back together! &#x1F680;
                    </p>
                    <p style="margin: 0 0 30px 0; font-size: 16px; color: #4a5568; line-height: 1.75;">
                      See you on the portal!
                    </p>

                    <!-- Divider -->
                    <hr style="border: none; border-top: 1px solid #edf2f7; margin: 0 0 24px 0;">

                    <!-- Cheers -->
                    <p style="margin: 0 0 4px 0; font-size: 15px; color: #718096;">Cheers,</p>
                    <p style="margin: 0 0 10px 0; font-size: 17px; color: #14201c; font-weight: 700;">The Kalyani School- Alumni Team &#x1F393;&#x1F499;</p>
                    <p style="margin: 0; font-size: 13px; color: #718096; line-height: 1.7;">
                      Manjari (Budruk), Near Hadapsar,<br>
                      Pune 412307, Maharashtra, India<br>
                      Phone: +91 8149117666 / +91 8149118666 &nbsp;|&nbsp;
                      <a href="mailto:alumni@thekalyanischool.edu.in" style="color: #008060; text-decoration: none;">alumni@thekalyanischool.edu.in</a>
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td align="center" style="padding: 22px 20px 4px;">
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #8a9a94;">You received this email because you are a valued alumni of The Kalyani School.</p>
              <p style="margin: 0; font-size: 12px; color: #8a9a94;">
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
async function sendEmail(toEmail: string, toName: string, includeCcBcc = true): Promise<void> {
  const authHeader = ZEPTOMAIL_TOKEN.startsWith("Zoho-enczapikey ")
    ? ZEPTOMAIL_TOKEN
    : `Zoho-enczapikey ${ZEPTOMAIL_TOKEN}`;

  const payload = {
    from: { address: FROM_EMAIL, name: FROM_NAME },
    to: [{ email_address: { address: toEmail.toLowerCase(), name: toName || toEmail } }],
    ...(includeCcBcc ? { cc: [{ email_address: { address: CC_EMAIL.toLowerCase() } }] } : {}),
    ...(includeCcBcc ? { bcc: BCC_EMAILS.map((addr) => ({ email_address: { address: addr.toLowerCase() } })) } : {}),
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
  const mode = isTest ? "🧪 TEST SEND (1 email only)" : isLive ? "🔴 LIVE SEND" : "🟡 DRY RUN (pass --send to deliver)";
  console.log("═══════════════════════════════════════════════════════════");
  console.log(" TKS Alumni Portal – \"School Gang\" Invite Blast");
  console.log(`  Mode   : ${mode}`);
  console.log(`  BCC    : ${BCC_EMAILS.join(", ")}`);
  console.log(`  CC     : ${CC_EMAIL}`);
  console.log(`  From   : ${FROM_NAME} <${FROM_EMAIL}>`);
  console.log(`  Portal : ${BASE_URL}`);
  console.log("═══════════════════════════════════════════════════════════\n");

  // ── TEST MODE: send exactly one real email and exit ──
  if (isTest) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)) {
      console.error(`❌  Invalid --test email address: ${testEmail}`);
      process.exit(1);
    }
    console.log(`🧪  TEST MODE — sending ONE email to: ${testEmail} (no CC/BCC)\n`);
    try {
      await sendEmail(testEmail, testEmail, false);
      console.log("══════════════════════════════════════════════════════════");
      console.log(` ✅  Test email sent to ${testEmail}`);
      console.log(" Review it (subject, formatting, links, mobile + desktop),");
      console.log(" then run with --send to deliver to all alumni:");
      console.log("   npx tsx scripts/send-welcome-emails.ts --send");
      console.log("══════════════════════════════════════════════════════════");
    } catch (err: any) {
      console.error(`❌  Failed to send test email:`, err?.message || err);
      process.exit(1);
    }
    return;
  }

  // ── 1. Fetch ALL alumni with valid emails (paginated — Supabase caps at 1000/request) ──
  console.log("📥  Fetching alumni users from database...");
  const PAGE_SIZE = 1000;
  let alumni: any[] = [];
  {
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("alumni")
        .select("user_id, email, first_name, last_name")
        .not("email", "is", null)
        .neq("email", "")
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        console.error("❌  Failed to fetch users:", error.message);
        process.exit(1);
      }
      if (!data || data.length === 0) break;
      alumni = alumni.concat(data);
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
  }

  if (alumni.length === 0) {
    console.log("⚠️   No alumni found in database. Exiting.");
    process.exit(0);
  }

  // ── 2. De-duplicate, validate, and exclude flagged addresses ──
  const seen = new Set<string>();
  const recipients: { email: string; name: string }[] = [];
  const excluded: { email: string; name: string }[] = [];

  for (const a of alumni) {
    const email = (a.email || "").trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      console.warn(`  ⚠️  Skipping invalid email: ${a.email}`);
      continue;
    }
    seen.add(email);
    const name = [a.first_name, a.last_name].filter(Boolean).join(" ").trim() || email;
    if (isExcludedEmail(email)) {
      excluded.push({ email, name });
      continue;
    }
    recipients.push({ email, name });
  }

  console.log(`✅  ${alumni.length} records fetched → ${recipients.length + excluded.length} unique valid → ${excluded.length} excluded → ${recipients.length} to send\n`);

  if (excluded.length > 0) {
    console.log(`⛔  Excluded (dummy/demo/data-entry-error, pending real data from school):`);
    excluded.forEach((r, i) => {
      console.log(`  ${String(i + 1).padStart(2, " ")}. ${r.name} <${r.email}>`);
    });
    console.log();
  }

  // ── 3. Preview list ──
  console.log("Recipients:");
  recipients.forEach((r, i) => {
    console.log(`  ${String(i + 1).padStart(4, " ")}. ${r.name} <${r.email}>`);
  });
  console.log();

  if (!isLive) {
    console.log("══════════════════════════════════════════════════════════");
    console.log(" DRY RUN complete – no emails were sent.");
    console.log(" ⚠️  Send yourself a test first:");
    console.log("   npx tsx scripts/send-welcome-emails.ts --test");
    console.log(" Then re-run with --send to deliver to everyone above:");
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
