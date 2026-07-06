import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { supabase, checkSupabaseConnection } from "./supabase";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { promisify } from "util";
import {
  previewExcelData,
  saveImportedData,
  importExcelData
} from "./import";

import profileRoutes from "./routes/profile-routes";
import profileExtendedRoutes from "./routes/profile-extended-routes";
import notificationRoutes from "./routes/notification-routes";
import connectionRoutes from "./routes/connection-routes";
import alumniSearchRoutes from "./routes/alumni-search-routes";
import globalSearchRoutes from "./routes/global-search-routes";
import securityRoutes from "./routes/security-routes";
import auditLogRoutes from "./routes/audit-log-routes";
import searchAnalyticsRoutes from "./routes/search-analytics-routes";
import resumeRoutes from "./routes/resume-routes";
import alumniMapRoutes from "./routes/alumni-map";
import adminDigestRoutes from "./routes/admin-digest-routes";
import adminBulkEmailRoutes from "./routes/admin-bulk-email-routes";
import { adminRouter as newsletterAdminRoutes, publicRouter as newsletterPublicRoutes } from "./routes/newsletter-routes";
import { aggregateAdminDashboardMetrics } from "./services/admin-metrics-service";
import gamificationRoutes from "./routes/gamification-routes";
import blogRoutes from "./routes/blog-routes";
import podcastRoutes from "./routes/podcast-routes";
import travelChaptersRoutes from "./routes/travel-chapters";
import travelPostsRoutes from "./routes/travel-posts";
import { ensureDefaultPointRulesExist, ensureDefaultBadgesExist, updateStreak, awardCommonBadge, incrementScore } from "./services/gamification-service";
import {
  createAndEmitNotification,
  NotificationType,
  NotificationRedirectUrl
} from "./services/notification-helper";
import { sendEmail, checkEmailConfig, getZeptoMailCreditsStatus, isZeptoMailCreditsError, generateAdminOtpEmail, generatePasswordResetEmail, generatePasswordSetupEmail, generateWelcomeConfirmationEmail, generateSessionCancelledEmail } from "./services/email-service";
import { getBaseUrl } from "./utils/base-url";
import { transformToCamelCase } from "./utils/case-transform";
import { parsePhoneNumber, validatePhoneNumber } from "./utils/phone-validation";
import { encryptToken, decryptToken } from "./utils/token-encryption";
import {
  sanitizeString,
  sanitizeEmail,
  sanitizeName,
  sanitizeInteger,
  isValidEmail,
  isValidName,
} from "./utils/input-sanitization";
import { determineUserRole } from "./utils/role-logic";
import { requireAuth, requireAdmin } from "./middleware/auth";
import { config } from "./config";
import crypto from "crypto";

const JWT_SECRET = config.jwtSecret;
const hashPassword = promisify(bcrypt.hash);
const comparePassword = promisify(bcrypt.compare);
const ADMIN_LOGIN_OTP_TOKEN_TYPE = "admin_login_otp";
const ADMIN_LOGIN_OTP_EXPIRY_MINUTES = 10;
const ADMIN_LOGIN_OTP_RESEND_COOLDOWN_SECONDS = 30;

// Import centralized upload configurations with smart size limits
import {
  uploadProfilePicture,
  uploadEventCover,
  uploadPostAttachment,
  uploadMessageAttachment,
  uploadExcel,
  handleMulterError
} from './config/upload-limits';

/**
 * Converts a datetime-local value (treated as IST) to UTC ISO string
 * Since the frontend sends datetime-local values in IST format, we need to convert them to UTC
 * @param datetimeLocal - String in format "YYYY-MM-DDTHH:mm" (treated as IST)
 * @returns ISO string in UTC format
 */
function istDatetimeLocalToUTC(datetimeLocal: string): string {
  if (!datetimeLocal || !datetimeLocal.includes('T')) {
    throw new Error("Invalid datetime-local format");
  }

  // Parse the datetime-local value as IST (Asia/Kolkata)
  // Create a date string with IST timezone offset (+05:30)
  const istDateString = datetimeLocal + '+05:30';

  // Parse it and convert to UTC
  const date = new Date(istDateString);

  if (isNaN(date.getTime())) {
    throw new Error("Invalid date");
  }

  return date.toISOString();
}

/**
 * Helper function to compute the LinkedIn redirect URI consistently
 * This ensures the same redirect URI is used in authorization request and token exchange
 * 
 * IMPORTANT: The redirect URI returned here MUST match EXACTLY what's registered in
 * LinkedIn Developer Console. LinkedIn is very strict about:
 * - No trailing slashes
 * - Exact case matching
 * - Exact protocol (http vs https)
 * - No URL encoding in the registered URL
 */
function getLinkedInRedirectUri(): string {
  const baseUrl = getBaseUrl();

  // Construct redirect URI - MUST match exactly what's in LinkedIn Developer Console
  // DO NOT add any extra slashes or encoding here
  const redirectUri = `${baseUrl}/api/auth/linkedin/callback`;

  return redirectUri;
}

function generateAdminOtpCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

// Simple in-memory rate limiter for login endpoints
const loginAttemptMap = new Map<string, { count: number; resetAt: number }>();
function loginRateLimitCheck(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttemptMap.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttemptMap.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // ============================================================================
  // HEALTH CHECK ENDPOINTS - Must be first for Railway deployment verification
  // ============================================================================
  app.get('/health', async (req, res) => {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'unknown',
      checks: {
        database: 'unknown' as string,
        supabase: 'unknown' as string,
      }
    };

    try {
      // Check database/Supabase
      const supabaseOk = await checkSupabaseConnection();
      health.checks.supabase = supabaseOk ? 'connected' : 'error';
      health.checks.database = supabaseOk ? 'connected' : 'error';
      if (!supabaseOk) health.status = 'degraded';
    } catch (error) {
      health.checks.supabase = 'error';
      health.checks.database = 'error';
      health.status = 'degraded';
    }

    const statusCode = health.status === 'ok' ? 200 : 503;
    res.status(statusCode).json(health);
  });

  // Readiness check (simpler, for load balancers)
  app.get('/ready', (req, res) => {
    res.status(200).json({ ready: true });
  });

  // ============================================================================
  // APPLICATION ROUTES
  // ============================================================================

  // Register multi-entry profile routes (protected)
  app.use("/api/profile", requireAuth, profileRoutes);
  app.use("/api/profile", requireAuth, profileExtendedRoutes);

  // Register notification preference routes (protected)
  app.use("/api/profile", requireAuth, notificationRoutes);
  app.use("/api/push", requireAuth, notificationRoutes);

  // Register consolidated routes (protected)
  app.use("/api/connections", requireAuth, connectionRoutes);
  app.use("/api/alumni", requireAuth, alumniSearchRoutes);
  app.use("/api/search", requireAuth, globalSearchRoutes);
  app.use("/api/security", requireAuth, securityRoutes);
  app.use("/api/audit-logs", requireAdmin, auditLogRoutes);
  app.use("/api/analytics", requireAuth, searchAnalyticsRoutes);
  app.use("/api/admin/digest", requireAdmin, adminDigestRoutes);
  app.use("/api/resume", requireAuth, resumeRoutes);
  app.use("/api/gamification", gamificationRoutes);
  app.use("/api/blogs", blogRoutes);
  app.use("/api/podcasts", podcastRoutes);
  app.use("/api/travel-chapters", travelChaptersRoutes);
  app.use("/api/travel-posts", travelPostsRoutes);
  ensureDefaultPointRulesExist().catch(err =>
    console.error("[Gamification] Point rules auto-seed failed:", err)
  );
  // Auto-seed default badges on startup (skips if badges already exist)
  ensureDefaultBadgesExist().catch(err =>
    console.error("[Gamification] Default badges auto-seed failed:", err)
  );
  // Excel import endpoints (admin only)
  app.post("/api/admin/import-preview", requireAdmin, uploadExcel.single("file"), handleMulterError, previewExcelData);
  app.post("/api/admin/import-save", requireAdmin, saveImportedData);
  app.post("/api/admin/import-excel", requireAdmin, uploadExcel.single("file"), handleMulterError, importExcelData);

  // Admin Bulk Email Routes (admin only)
  app.use("/api/admin/bulk-email", requireAdmin, adminBulkEmailRoutes);

  // Newsletter Routes
  app.use("/api/admin/newsletters", requireAdmin, newsletterAdminRoutes);
  app.use("/api/newsletters", requireAuth, newsletterPublicRoutes);



  // File proxy endpoint to hide Supabase URLs
  app.get("/api/storage/view", requireAuth, async (req, res) => {
    try {
      const { bucket, path } = req.query;

      if (!bucket || typeof bucket !== 'string') {
        return res.status(400).send("Bucket is required");
      }

      // Whitelist allowed buckets
      const allowedBuckets = ['post-attachments', 'message-attachments', 'event-covers', 'event_covers', 'profile-pictures', 'resumes', 'excel-imports'];
      if (!allowedBuckets.includes(bucket)) {
        return res.status(403).send("Access to this bucket is forbidden");
      }

      if (!path || typeof path !== 'string') {
        return res.status(400).send("Path is required");
      }

      // Prevent path traversal attacks
      if (path.includes('..') || path.startsWith('/') || path.includes('\0')) {
        return res.status(403).send("Invalid path");
      }

      const { data, error } = await supabase.storage.from(bucket).download(path);

      if (error) {
        console.error("Storage download error:", error);
        return res.status(404).send("File not found");
      }

      if (data) {
        res.setHeader('Content-Type', data.type);
        res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
        const arrayBuffer = await data.arrayBuffer();
        res.send(Buffer.from(arrayBuffer));
      }
    } catch (error) {
      console.error("File proxy error:", error);
      res.status(500).send("Internal server error");
    }
  });

  // File upload endpoint for profile pictures
  app.post(
    "/api/upload/profile-picture",
    uploadProfilePicture.single("file"),
    handleMulterError,
    async (req: Request, res: Response) => {
      try {
        const userId = req.headers["user-id"] as string;

        if (!userId) {
          return res.status(401).json({ error: "No user ID provided" });
        }

        if (!req.file) {
          return res.status(400).json({ error: "No file uploaded" });
        }

        const file = req.file;

        // File size limit: 5MB for profile pictures
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
          return res.status(400).json({ error: "File size exceeds 5MB limit" });
        }

        // Only allow image files — validate both extension and MIME type
        const fileExt = file.originalname.split(".").pop()?.toLowerCase() || "";
        const allowedImageExts = ["jpg", "jpeg", "png", "gif", "webp"];
        const allowedImageMimes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
        if (!allowedImageExts.includes(fileExt) || !allowedImageMimes.includes(file.mimetype)) {
          return res.status(400).json({
            error: "Only image files are allowed for profile pictures",
          });
        }

        const timestamp = Date.now();
        const filePath = `${userId}/avatar_${timestamp}.${fileExt}`;

        // console.log(`Uploading profile picture: ${filePath}`);

        // Upload to Supabase Storage bucket 'profile-pictures'
        const { data, error } = await supabase.storage
          .from("profile-pictures")
          .upload(filePath, file.buffer, {
            contentType: file.mimetype,
            upsert: true, // Allow replacing existing profile pictures
          });

        if (error) {
          console.error("Profile picture upload error:", error);
          return res
            .status(500)
            .json({ error: "Failed to upload profile picture" });
        }

        // Get public URL
        const {
          data: { publicUrl },
        } = supabase.storage.from("profile-pictures").getPublicUrl(filePath);

        // console.log(`Profile picture uploaded: ${publicUrl}`);

        // Update alumni table
        const { error: updateError } = await supabase
          .from("alumni")
          .update({
            profile_picture: publicUrl,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);

        if (updateError) {
          throw updateError;
        }
        // console.log(`[Upload] Updated profile_picture for user ${userId} in both tables`);

        res.json({
          url: publicUrl,
          fileName: filePath,
        });
      } catch (error) {
        console.error("Profile picture upload error:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    },
  );

  // File upload endpoint for post attachments
  app.post(
    "/api/upload/post-attachment",
    uploadPostAttachment.single("file"),
    handleMulterError,
    async (req: Request, res: Response) => {
      try {
        const userId = req.headers["user-id"] as string;

        if (!userId) {
          return res.status(401).json({ error: "No user ID provided" });
        }

        if (!req.file) {
          return res.status(400).json({ error: "No file uploaded" });
        }

        const file = req.file;

        // File size limit: 10MB
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
          return res
            .status(400)
            .json({ error: "File size exceeds 10MB limit" });
        }

        // Determine file type and folder — validate both extension and MIME type
        const fileExt = file.originalname.split(".").pop()?.toLowerCase() || "";
        let fileType = "documents";

        const allowedMimes: Record<string, string[]> = {
          images: ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"],
          videos: ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"],
          documents: ["application/pdf", "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "text/plain",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-powerpoint",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
        };

        if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(fileExt) && allowedMimes.images.includes(file.mimetype)) {
          fileType = "images";
        } else if (["mp4", "webm", "mov", "avi"].includes(fileExt) && allowedMimes.videos.includes(file.mimetype)) {
          fileType = "videos";
        } else if (
          ["pdf", "doc", "docx", "txt", "xlsx", "xls", "ppt", "pptx"].includes(fileExt) &&
          allowedMimes.documents.includes(file.mimetype)
        ) {
          fileType = "documents";
        } else {
          return res.status(400).json({ error: "Unsupported file type" });
        }

        const timestamp = Date.now();
        const sanitizedFilename = file.originalname.replace(
          /[^a-zA-Z0-9.-]/g,
          "_",
        );
        const filePath = `${fileType}/${userId}/${timestamp}_${sanitizedFilename}`;

        // console.log(`Uploading file to Supabase Storage: ${filePath}`);

        // Upload to Supabase Storage bucket 'post-attachments'
        const { data, error } = await supabase.storage
          .from("post-attachments")
          .upload(filePath, file.buffer, {
            contentType: file.mimetype,
            upsert: false,
          });

        if (error) {
          console.error("Supabase Storage upload error:", error);
          return res
            .status(500)
            .json({ error: "Failed to upload file to storage" });
        }

        // Return proxy URL instead of direct Supabase URL
        const proxyUrl = `/api/storage/view?bucket=post-attachments&path=${encodeURIComponent(filePath)}`;

        // console.log(`File uploaded successfully: ${proxyUrl}`);

        res.json({
          url: proxyUrl,
          fileName: filePath,
          fileType: fileType,
          size: file.size,
          mimeType: file.mimetype,
        });
      } catch (error) {
        console.error("File upload error:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    },
  );

  // File upload endpoint for message attachments
  app.post(
    "/api/messages/upload",
    uploadMessageAttachment.single("file"),
    handleMulterError,
    async (req: Request, res: Response) => {
      try {
        const userId = req.headers["user-id"] as string;

        if (!userId) {
          return res.status(401).json({ error: "No user ID provided" });
        }

        if (!req.file) {
          return res.status(400).json({ error: "No file uploaded" });
        }

        const file = req.file;
        const maxSize = 10 * 1024 * 1024; // 10MB limit

        if (file.size > maxSize) {
          return res.status(400).json({ error: "File size exceeds 10MB limit" });
        }

        const timestamp = Date.now();
        const filePath = `${userId}/${timestamp}_${file.originalname}`; // Keep original name

        // Upload to Supabase Storage bucket 'message-attachments'
        const { data, error } = await supabase.storage
          .from("message-attachments")
          .upload(filePath, file.buffer, {
            contentType: file.mimetype,
            upsert: false
          });

        if (error) {
          console.error("Attachment upload error:", error);
          return res.status(500).json({ error: "Failed to upload file" });
        }

        const proxyUrl = `/api/storage/view?bucket=message-attachments&path=${encodeURIComponent(filePath)}`;

        res.json({
          url: proxyUrl,
          fileName: file.originalname,
          fileType: file.mimetype,
          filePath: filePath
        });
      } catch (error) {
        console.error("Upload error:", error);
        res.status(500).json({ error: "Internal server error during upload" });
      }
    }
  );

  // Get unread message count
  app.get("/api/messages/unread-count", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;

      if (!userId) {
        return res.status(401).json({ error: "No user ID provided" });
      }

      const { count, error } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("receiver_id", userId)
        .eq("is_read", false);

      if (error) {
        console.error("Error fetching unread message count:", error);
        return res.status(500).json({ error: "Failed to fetch unread count" });
      }

      res.json({ count: count || 0 });
    } catch (error) {
      console.error("Error in unread count route:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // File upload endpoint for event cover images
  app.post(
    "/api/upload/event-cover",
    uploadEventCover.single("file"),
    handleMulterError,
    async (req: Request, res: Response) => {
      try {
        const userId = req.headers["user-id"] as string;
        const eventId = req.body.eventId;

        if (!userId) {
          return res.status(401).json({ error: "No user ID provided" });
        }

        if (!eventId) {
          return res.status(400).json({ error: "Event ID is required" });
        }

        if (!req.file) {
          return res.status(400).json({ error: "No file uploaded" });
        }

        const file = req.file;

        // File size limit: 5MB for event covers
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
          return res.status(400).json({ error: "File size exceeds 5MB limit" });
        }

        // Only allow image files — validate both extension and MIME type
        const fileExt = file.originalname.split(".").pop()?.toLowerCase() || "";
        const allowedImageExts = ["jpg", "jpeg", "png", "gif", "webp"];
        const allowedImageMimes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
        if (!allowedImageExts.includes(fileExt) || !allowedImageMimes.includes(file.mimetype)) {
          return res
            .status(400)
            .json({ error: "Only image files are allowed for event covers" });
        }

        // Delete existing images in the event directory
        const { data: existingFiles } = await supabase.storage
          .from("event_covers")
          .list(eventId);

        if (existingFiles && existingFiles.length > 0) {
          const filesToDelete = existingFiles.map(
            (file) => `${eventId}/${file.name}`,
          );
          await supabase.storage.from("event_covers").remove(filesToDelete);
        }

        // Upload new image
        const filePath = `${eventId}/cover.${fileExt}`;

        const { data, error } = await supabase.storage
          .from("event_covers")
          .upload(filePath, file.buffer, {
            contentType: file.mimetype,
            upsert: true,
          });

        if (error) {
          console.error("Event cover upload error:", error);
          return res
            .status(500)
            .json({ error: "Failed to upload event cover" });
        }

        // Get public URL
        const {
          data: { publicUrl },
        } = supabase.storage.from("event_covers").getPublicUrl(filePath);

        console.log(`Event cover uploaded: ${publicUrl}`);

        res.json({
          url: publicUrl,
          fileName: filePath,
        });
      } catch (error) {
        console.error("Event cover upload error:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    },
  );

  // Note: File serving is now handled directly by Supabase Storage public URLs
  // No need for a custom route as Supabase provides CDN-backed public URLs

  // Admin login route
  app.post("/api/auth/admin/login", async (req, res) => {
    try {
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.socket.remoteAddress || "unknown";
      if (!loginRateLimitCheck(ip)) {
        return res.status(429).json({ error: "Too many login attempts. Please try again in 15 minutes." });
      }

      const { email, password } = req.body;
      const normalizedEmail = String(email || "").trim().toLowerCase();

      if (!normalizedEmail || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      console.log(` [ADMIN LOGIN] Attempting login for: ${normalizedEmail}`);

      // Query Supabase for admin user
      const { data: user, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("email", normalizedEmail)
        .single();

      if (userError) {
        console.error(" [ADMIN LOGIN] Supabase Query Error:", userError.message);
        return res.status(401).json({ error: "Invalid credentials", debug: "User lookup failed" });
      }

      if (!user) {
        console.warn(" [ADMIN LOGIN] User not found in database.");
        return res.status(401).json({ error: "Invalid credentials", debug: "User not found" });
      }

      console.log(" [ADMIN LOGIN] User record found. Role:", user.user_role, "IsAdmin:", user.is_admin);

      // Check if user is admin
      if (user.is_admin !== true && user.user_role !== "administrator") {
        console.warn(" [ADMIN LOGIN] User is not an administrator.");
        return res.status(401).json({ error: "Invalid credentials", debug: "Insufficient permissions" });
      }

      // Check if account is blocked
      if (user.account_blocked === true) {
        console.warn(" [ADMIN LOGIN] Account is blocked.");
        return res
          .status(403)
          .json({ error: "Your account has been blocked." });
      }

      console.log(" [ADMIN LOGIN] Comparing passwords...");
      const isValidPassword = await comparePassword(password, user.password);
      console.log(" [ADMIN LOGIN] Password comparison result:", isValidPassword);

      if (!isValidPassword) {
        console.warn(" [ADMIN LOGIN] Invalid password provided.");
        return res.status(401).json({ error: "Invalid credentials", debug: "Password incorrect" });
      }

      const isTestAdmin = user.email === "bhupendra@evonix.co";
      const otpCode = isTestAdmin
        ? "654321"
        : process.env.NODE_ENV === "production"
          ? generateAdminOtpCode()
          : "111111";
      const hashedOtp = await hashPassword(otpCode, 10);
      const expiresAt = new Date(Date.now() + ADMIN_LOGIN_OTP_EXPIRY_MINUTES * 60 * 1000);
      const ipAddress =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
        req.socket.remoteAddress ||
        "unknown";
      const userAgent = req.headers["user-agent"] || "unknown";

      await supabase
        .from("password_reset_tokens")
        .update({ used_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("token_type", ADMIN_LOGIN_OTP_TOKEN_TYPE)
        .is("used_at", null);

      const { data: otpChallenge, error: otpError } = await supabase
        .from("password_reset_tokens")
        .insert({
          user_id: user.id,
          token: hashedOtp,
          token_type: ADMIN_LOGIN_OTP_TOKEN_TYPE,
          expires_at: expiresAt.toISOString(),
          ip_address: ipAddress,
          user_agent: userAgent,
        })
        .select("id, expires_at")
        .single();

      if (otpError || !otpChallenge) {
        console.error("Failed to create admin OTP challenge:", otpError);
        return res.status(500).json({ error: "Failed to create login verification challenge" });
      }

      const { data: alumniProfile } = await supabase
        .from("alumni")
        .select("first_name")
        .eq("user_id", user.id)
        .maybeSingle();

      const userName = alumniProfile?.first_name || user.username || "Admin";

      if (!isTestAdmin) {
        const emailContent = generateAdminOtpEmail(otpCode, userName, ADMIN_LOGIN_OTP_EXPIRY_MINUTES);
        try {
          if (process.env.NODE_ENV === "production") {
            checkEmailConfig();
            await sendEmail({
              to: user.email,
              toName: userName,
              subject: emailContent.subject,
              textBody: emailContent.textBody,
              htmlBody: emailContent.htmlBody,
            });
          } else {
            console.log(`[DEVELOPMENT] Mock Email Sent: OTP for admin login is ${otpCode}`);
          }
        } catch (emailError) {
          await supabase
            .from("password_reset_tokens")
            .update({ used_at: new Date().toISOString() })
            .eq("id", otpChallenge.id);
          console.error("Failed to send admin OTP email:", emailError);
          return res.status(503).json({ error: "Failed to send OTP email. Please try again." });
        }
      } else {
        console.log(`[TEST ADMIN] Static OTP bypass for ${user.email} — no email sent`);
      }

      res.json({
        requiresOtp: true,
        challengeId: otpChallenge.id,
        email: user.email,
        expiresAt: otpChallenge.expires_at,
        message: "OTP sent to your admin email",
      });
    } catch (error) {
      console.error("Admin login error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/auth/admin/resend-otp", async (req, res) => {
    try {
      const challengeId = String(req.body?.challengeId || "").trim();

      if (!challengeId) {
        return res.status(400).json({ error: "Challenge ID is required" });
      }

      const { data: existingChallenge, error: existingChallengeError } = await supabase
        .from("password_reset_tokens")
        .select("id, user_id, used_at, created_at, token_type")
        .eq("id", challengeId)
        .eq("token_type", ADMIN_LOGIN_OTP_TOKEN_TYPE)
        .maybeSingle();

      if (existingChallengeError || !existingChallenge) {
        return res.status(400).json({ error: "Invalid OTP challenge. Please login again." });
      }

      if (existingChallenge.used_at) {
        return res.status(400).json({ error: "OTP challenge is no longer active. Please login again." });
      }

      // Fix: force UTC parsing on TIMESTAMP WITHOUT TIME ZONE columns
      const createdAtStr = String(existingChallenge.created_at);
      const challengeCreatedAt = new Date(createdAtStr.endsWith('Z') || createdAtStr.includes('+') ? createdAtStr : createdAtStr + 'Z').getTime();
      const now = Date.now();
      const cooldownMs = ADMIN_LOGIN_OTP_RESEND_COOLDOWN_SECONDS * 1000;
      const remainingCooldownMs = challengeCreatedAt + cooldownMs - now;

      if (remainingCooldownMs > 0) {
        return res.status(429).json({
          error: `Please wait ${Math.ceil(remainingCooldownMs / 1000)} seconds before requesting another OTP`,
        });
      }

      const { data: user, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("id", existingChallenge.user_id)
        .single();

      if (userError || !user) {
        return res.status(401).json({ error: "Invalid OTP challenge. Please login again." });
      }

      if (user.is_admin !== true && user.user_role !== "administrator") {
        return res.status(403).json({
          error: "Access denied. This portal is for administrators only.",
          isNotAdmin: true,
        });
      }

      if (user.account_blocked === true) {
        return res.status(403).json({ error: "Your account has been blocked." });
      }

      const isTestAdmin = user.email === "bhupendra@evonix.co";
      const otpCode = isTestAdmin
        ? "654321"
        : process.env.NODE_ENV === "production"
          ? generateAdminOtpCode()
          : "111111";
      const hashedOtp = await hashPassword(otpCode, 10);
      const expiresAt = new Date(Date.now() + ADMIN_LOGIN_OTP_EXPIRY_MINUTES * 60 * 1000);
      const ipAddress =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
        req.socket.remoteAddress ||
        "unknown";
      const userAgent = req.headers["user-agent"] || "unknown";

      await supabase
        .from("password_reset_tokens")
        .update({ used_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("token_type", ADMIN_LOGIN_OTP_TOKEN_TYPE)
        .is("used_at", null);

      const { data: otpChallenge, error: otpError } = await supabase
        .from("password_reset_tokens")
        .insert({
          user_id: user.id,
          token: hashedOtp,
          token_type: ADMIN_LOGIN_OTP_TOKEN_TYPE,
          expires_at: expiresAt.toISOString(),
          ip_address: ipAddress,
          user_agent: userAgent,
        })
        .select("id, expires_at")
        .single();

      if (otpError || !otpChallenge) {
        console.error("Failed to create admin OTP challenge during resend:", otpError);
        return res.status(500).json({ error: "Failed to create login verification challenge" });
      }

      const { data: alumniProfile } = await supabase
        .from("alumni")
        .select("first_name")
        .eq("user_id", user.id)
        .maybeSingle();

      const userName = alumniProfile?.first_name || user.username || "Admin";

      if (isTestAdmin) {
        console.log(`[TEST ADMIN] Static OTP bypass for ${user.email} — no email sent`);
      } else {
        const emailContent = generateAdminOtpEmail(otpCode, userName, ADMIN_LOGIN_OTP_EXPIRY_MINUTES);
        try {
          if (process.env.NODE_ENV === "production") {
            checkEmailConfig();
            await sendEmail({
              to: user.email,
              toName: userName,
              subject: emailContent.subject,
              textBody: emailContent.textBody,
              htmlBody: emailContent.htmlBody,
            });
          } else {
            console.log(`[DEVELOPMENT] Mock Email Sent: Resent OTP for admin login is ${otpCode}`);
          }
        } catch (emailError) {
          await supabase
            .from("password_reset_tokens")
            .update({ used_at: new Date().toISOString() })
            .eq("id", otpChallenge.id);
          console.error("Failed to resend admin OTP email:", emailError);
          return res.status(503).json({ error: "Failed to send OTP email. Please try again." });
        }
      }

      res.json({
        requiresOtp: true,
        challengeId: otpChallenge.id,
        email: user.email,
        expiresAt: otpChallenge.expires_at,
        message: "A new OTP has been sent to your admin email",
      });
    } catch (error) {
      console.error("Admin OTP resend error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/auth/admin/verify-otp", async (req, res) => {
    try {
      const challengeId = String(req.body?.challengeId || "").trim();
      const otp = String(req.body?.otp || "").trim();

      if (!challengeId || !otp) {
        return res.status(400).json({ error: "Challenge ID and OTP are required" });
      }

      if (!/^\d{6}$/.test(otp)) {
        return res.status(400).json({ error: "OTP must be a 6-digit code" });
      }

      const { data: tokenData, error: tokenError } = await supabase
        .from("password_reset_tokens")
        .select("id, user_id, token, expires_at, used_at, token_type")
        .eq("id", challengeId)
        .eq("token_type", ADMIN_LOGIN_OTP_TOKEN_TYPE)
        .maybeSingle();

      if (tokenError || !tokenData) {
        return res.status(400).json({ error: "Invalid or expired OTP challenge" });
      }

      if (tokenData.used_at) {
        return res.status(400).json({ error: "This OTP has already been used" });
      }

      // Fix: Supabase TIMESTAMP (no timezone) returns string without 'Z'.
      // new Date("2026-05-22T12:44:38") is treated as LOCAL time (IST +5:30),
      // making a future UTC expiry appear already past. Force UTC by adding 'Z'.
      const expiresAtStr = String(tokenData.expires_at);
      const expiryUTC = new Date(expiresAtStr.endsWith('Z') || expiresAtStr.includes('+') ? expiresAtStr : expiresAtStr + 'Z');
      if (expiryUTC < new Date()) {
        return res.status(400).json({ error: "OTP has expired" });
      }

      const isValidOtp = await comparePassword(otp, tokenData.token);
      if (!isValidOtp) {
        return res.status(401).json({ error: "Invalid OTP" });
      }

      // Atomically mark token as used after successful OTP verification
      const { data: claimedToken, error: claimError } = await supabase
        .from("password_reset_tokens")
        .update({ used_at: new Date().toISOString() })
        .eq("id", tokenData.id)
        .is("used_at", null)
        .select("id")
        .maybeSingle();

      if (claimError || !claimedToken) {
        return res.status(400).json({ error: "This OTP has already been used" });
      }

      const { data: user, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("id", tokenData.user_id)
        .single();

      if (userError || !user) {
        return res.status(401).json({ error: "Invalid login challenge" });
      }

      if (user.is_admin !== true && user.user_role !== "administrator") {
        return res.status(403).json({
          error: "Access denied. This portal is for administrators only.",
          isNotAdmin: true,
        });
      }

      if (user.account_blocked === true) {
        return res.status(403).json({ error: "Your account has been blocked." });
      }

      // Update activity timestamp on login
      await supabase
        .from("users")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", user.id);

      // Trigger gamification login events (Streak)
      try {
        // Delay by 3 seconds so the frontend websocket has time to connect and show the popup
        setTimeout(async () => {
          try {
            await updateStreak(user.id);
          } catch (e) {
            console.error("[Gamification] Admin login delayed streak error:", e);
          }
        }, 3000);
      } catch (err) {
        console.error("[Gamification] Admin login gamification error:", err);
      }

      const { data: alumniProfile } = await supabase
        .from("alumni")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.user_role || "administrator", isAdmin: user.is_admin },
        JWT_SECRET,
        { expiresIn: "24h" }
      );

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          is_admin: user.is_admin,
          user_role: user.user_role || "administrator",
          created_at: user.created_at,
          updated_at: user.updated_at,
        },
        alumni: alumniProfile || null,
        message: "Admin login successful",
      });
    } catch (error) {
      console.error("Admin OTP verification error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Login route
  app.post("/api/auth/login", async (req, res) => {
    try {
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.socket.remoteAddress || "unknown";
      if (!loginRateLimitCheck(ip)) {
        return res.status(429).json({ error: "Too many login attempts. Please try again in 15 minutes." });
      }

      const { email, password } = req.body;

      // console.log("Login attempt for:", email);

      // Query Supabase instead of local database
      const { data: user, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("email", email)
        .single();

      if (userError || !user) {
        // console.log("User not found:", email);
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Check if user is admin - admins cannot login through regular login
      if (user.is_admin === true || user.user_role === "administrator") {
        // console.log("Admin login attempt blocked on regular login:", email);
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Check if account is blocked
      if (user.account_blocked === true) {
        // console.log("Account blocked:", email);
        return res.status(403).json({
          error:
            "Your account has been blocked by the administrator. Please contact the authority for account activation.",
        });
      }

      // console.log("User found, comparing password...");
      const isValidPassword = await comparePassword(password, user.password);
      // console.log("Password valid:", isValidPassword);

      if (!isValidPassword) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Update activity timestamp on login
      await supabase
        .from("users")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", user.id);

      // Trigger gamification login events (Streak)
      try {
        // Delay by 3 seconds so the frontend websocket has time to connect and show the popup
        setTimeout(async () => {
          try {
            await updateStreak(user.id);
          } catch (e) {
            console.error("[Gamification] User login delayed streak error:", e);
          }
        }, 3000);
      } catch (err) {
        console.error("[Gamification] User login gamification error:", err);
      }

      // Fetch alumni profile from Supabase
      const { data: alumniProfile } = await supabase
        .from("alumni")
        .select("*")
        .eq("user_id", user.id)
        .single();

      // SIGNOFF: Generate JWT Token
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.user_role || "alumni", isAdmin: user.is_admin },
        JWT_SECRET,
        { expiresIn: "24h" }
      );

      const { password: _, ...userWithoutPassword } = user;
      res.json({
        token, // Send token to client
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          is_admin: user.is_admin,
          user_role: user.user_role || "alumni",
          created_at: user.created_at,
          updated_at: user.updated_at,
        },
        alumni: alumniProfile || null,
        message: "Login successful",
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== PASSWORD RESET ROUTES ====================

  /**
   * Request password reset (Forgot Password)
   * POST /api/auth/forgot-password
   */
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;

      // Validate email input
      if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "Email is required" });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const normalizedEmail = email.trim().toLowerCase();

      if (!emailRegex.test(normalizedEmail)) {
        return res.status(400).json({ error: "Invalid email format" });
      }

      // Find user by email
      const { data: user, error: userError } = await supabase
        .from("users")
        .select("id, email, username")
        .eq("email", normalizedEmail)
        .single();

      // Always return success to prevent email enumeration
      // But only send email if user exists
      if (userError || !user) {
        // console.log("Password reset requested for non-existent email:", email);
        return res.json({
          success: true,
          message:
            "If an account with that email exists, a password reset link has been sent.",
        });
      }

      // Check if account is blocked
      const { data: fullUser } = await supabase
        .from("users")
        .select("account_blocked")
        .eq("id", user.id)
        .single();

      if (fullUser?.account_blocked) {
        // console.log("Password reset blocked for blocked account:", email);
        return res.json({
          success: true,
          message:
            "If an account with that email exists, a password reset link has been sent.",
        });
      }

      // Generate secure token
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1); // Token expires in 1 hour

      // Get client IP and user agent for security
      const ipAddress =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
        req.socket.remoteAddress ||
        "unknown";
      const userAgent = req.headers["user-agent"] || "unknown";

      // Invalidate any existing reset tokens for this user
      await supabase
        .from("password_reset_tokens")
        .update({ used_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("token_type", "reset")
        .is("used_at", null);

      // Create new reset token
      const { error: tokenError } = await supabase
        .from("password_reset_tokens")
        .insert({
          user_id: user.id,
          token: token,
          token_type: "reset",
          expires_at: expiresAt.toISOString(),
          ip_address: ipAddress,
          user_agent: userAgent,
        });

      if (tokenError) {
        console.error("Failed to create reset token:", tokenError);
        return res.status(500).json({
          error: "Failed to process password reset request",
        });
      }

      // Generate reset link using consistent base URL helper
      const baseUrl = getBaseUrl();
      const resetLink = `${baseUrl}/reset-password?token=${token}`;

      // Get user's name from alumni profile if available
      const { data: alumniProfile } = await supabase
        .from("alumni")
        .select("first_name, last_name")
        .eq("user_id", user.id)
        .single();

      const userName =
        alumniProfile?.first_name || user.username || "there";

      // Generate and send email
      const emailContent = generatePasswordResetEmail(resetLink, userName);

      try {
        checkEmailConfig();
      } catch (configErr: any) {
        console.error("Forgot password: email not configured", configErr?.message);
        return res.status(503).json({
          error: "Email service is temporarily unavailable. Please try again later.",
        });
      }

      try {
        await sendEmail({
          to: user.email,
          toName: userName,
          subject: emailContent.subject,
          textBody: emailContent.textBody,
          htmlBody: emailContent.htmlBody,
        });

        return res.json({
          success: true,
          message:
            "If an account with that email exists, a password reset link has been sent.",
        });
      } catch (emailError: any) {
        console.error("Failed to send password reset email:", emailError);
        const isConfig = /not configured|credentials/.test(emailError?.message || "");
        if (isConfig) {
          return res.status(503).json({
            error: "Email service is temporarily unavailable. Please try again later.",
          });
        }
        if (isZeptoMailCreditsError(emailError)) {
          return res.status(503).json({
            error: "Email service is temporarily unavailable. Please try again later.",
            code: "ZEPTOMAIL_CREDITS",
          });
        }
        return res.status(500).json({
          error: "Failed to send password reset email. Please try again later.",
        });
      }
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * Verify reset token validity
   * GET /api/auth/reset-password/verify/:token
   */
  app.get("/api/auth/reset-password/verify/:token", async (req, res) => {
    try {
      const { token } = req.params;

      if (!token || token.length !== 64) {
        return res.status(400).json({ error: "Invalid token format" });
      }

      // Find token
      const { data: tokenData, error: tokenError } = await supabase
        .from("password_reset_tokens")
        .select("id, user_id, expires_at, used_at, token_type")
        .eq("token", token)
        .eq("token_type", "reset")
        .single();

      if (tokenError || !tokenData) {
        return res.status(400).json({ error: "Invalid or expired token" });
      }

      // Check if token is used
      if (tokenData.used_at) {
        return res.status(400).json({ error: "Token has already been used" });
      }

      // Check if token is expired
      const expiresAt = new Date(tokenData.expires_at);
      if (expiresAt < new Date()) {
        return res.status(400).json({ error: "Token has expired" });
      }

      // Get user info (without password)
      const { data: user } = await supabase
        .from("users")
        .select("id, email, username, account_blocked")
        .eq("id", tokenData.user_id)
        .single();

      if (!user || user.account_blocked) {
        return res.status(400).json({ error: "Invalid token" });
      }

      return res.json({
        valid: true,
        email: user.email,
        username: user.username,
      });
    } catch (error) {
      console.error("Verify reset token error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * Reset password with token
   * POST /api/auth/reset-password
   */
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, newPassword, confirmPassword } = req.body;

      // Validate inputs
      if (!token || !newPassword || !confirmPassword) {
        return res.status(400).json({
          error: "Token, new password, and confirm password are required",
        });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({ error: "Passwords do not match" });
      }

      // Comprehensive password validation following security standards
      const passwordErrors: string[] = [];

      // Length validation
      if (newPassword.length < 8) {
        passwordErrors.push("Password must be at least 8 characters long");
      }
      if (newPassword.length > 128) {
        passwordErrors.push("Password must not exceed 128 characters");
      }

      // Character type validation
      if (!/[a-z]/.test(newPassword)) {
        passwordErrors.push("Password must contain at least one lowercase letter (a-z)");
      }
      if (!/[A-Z]/.test(newPassword)) {
        passwordErrors.push("Password must contain at least one uppercase letter (A-Z)");
      }
      if (!/\d/.test(newPassword)) {
        passwordErrors.push("Password must contain at least one number (0-9)");
      }
      if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(newPassword)) {
        passwordErrors.push("Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;':\",./<>?`~)");
      }

      // Common password check
      const commonPasswords = [
        "password", "password123", "12345678", "123456789", "1234567890",
        "qwerty123", "abc123456", "password1", "welcome123", "admin123",
        "letmein", "monkey", "dragon", "master", "sunshine", "princess",
        "football", "baseball", "welcome", "login", "admin", "qwerty", "123456"
      ];
      const lowerPassword = newPassword.toLowerCase();
      if (commonPasswords.some(common => lowerPassword.includes(common))) {
        passwordErrors.push("Password is too common. Please choose a more unique password");
      }

      // Sequential characters check (e.g., "123", "abc")
      const hasSequential = (str: string) => {
        const sequences = ["0123456789", "abcdefghijklmnopqrstuvwxyz", "ABCDEFGHIJKLMNOPQRSTUVWXYZ"];
        for (const seq of sequences) {
          for (let i = 0; i <= seq.length - 3; i++) {
            const subSeq = seq.substring(i, i + 3);
            if (str.toLowerCase().includes(subSeq.toLowerCase()) ||
              str.toLowerCase().includes(subSeq.split("").reverse().join("").toLowerCase())) {
              return true;
            }
          }
        }
        return false;
      };
      if (hasSequential(newPassword)) {
        passwordErrors.push("Password contains sequential characters. Please avoid predictable patterns");
      }

      // Repeated characters check (e.g., "aaa", "111")
      if (/(.)\1{2,}/i.test(newPassword)) {
        passwordErrors.push("Password contains repeated characters. Please use more variety");
      }

      if (passwordErrors.length > 0) {
        return res.status(400).json({
          error: passwordErrors[0], // Return first error for API compatibility
          errors: passwordErrors, // Include all errors for detailed feedback
        });
      }

      // Find and validate token
      const { data: tokenData, error: tokenError } = await supabase
        .from("password_reset_tokens")
        .select("id, user_id, expires_at, used_at, token_type")
        .eq("token", token)
        .eq("token_type", "reset")
        .single();

      if (tokenError || !tokenData) {
        return res.status(400).json({ error: "Invalid or expired token" });
      }

      // Check if token is used
      if (tokenData.used_at) {
        return res.status(400).json({ error: "Token has already been used" });
      }

      // Check if token is expired
      const expiresAt = new Date(tokenData.expires_at);
      if (expiresAt < new Date()) {
        return res.status(400).json({ error: "Token has expired" });
      }

      // Get user
      const { data: user, error: userError } = await supabase
        .from("users")
        .select("id, email, account_blocked")
        .eq("id", tokenData.user_id)
        .single();

      if (userError || !user || user.account_blocked) {
        return res.status(400).json({ error: "Invalid token" });
      }

      // Hash new password
      const hashedPassword = await hashPassword(newPassword, 10);

      // Update user password and mark token as used in sequence
      // Note: Supabase doesn't support transactions, so we do this sequentially
      // If password update fails, token remains unused (can retry)
      // If token update fails, password is already changed (security: token is invalidated)
      const { error: updateError } = await supabase
        .from("users")
        .update({
          password: hashedPassword,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (updateError) {
        console.error("Failed to update password:", updateError);
        return res.status(500).json({ error: "Failed to reset password" });
      }

      // Mark token as used (best effort - if this fails, password is already changed)
      const { error: tokenUpdateError } = await supabase
        .from("password_reset_tokens")
        .update({ used_at: new Date().toISOString() })
        .eq("id", tokenData.id);

      if (tokenUpdateError) {
        console.error("Failed to mark token as used (password already updated):", tokenUpdateError);
        // Continue anyway - password is already updated
      }

      // console.log("Password reset successful for user:", user.email);

      return res.json({
        success: true,
        message: "Password has been reset successfully",
      });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * Verify setup token validity (for initial password setup)
   * GET /api/auth/setup-password/verify/:token
   */
  app.get("/api/auth/setup-password/verify/:token", async (req, res) => {
    try {
      const { token } = req.params;

      if (!token || token.length !== 64) {
        return res.status(400).json({ error: "Invalid token format" });
      }

      // Find token
      const { data: tokenData, error: tokenError } = await supabase
        .from("password_reset_tokens")
        .select("id, user_id, expires_at, used_at, token_type")
        .eq("token", token)
        .eq("token_type", "setup")
        .single();

      if (tokenError || !tokenData) {
        return res.status(400).json({ error: "Invalid or expired token" });
      }

      // Check if token is used
      if (tokenData.used_at) {
        return res.status(400).json({ error: "Token has already been used" });
      }

      // Check if token is expired
      const expiresAt = new Date(tokenData.expires_at);
      if (expiresAt < new Date()) {
        return res.status(400).json({ error: "Token has expired" });
      }

      // Get user info (without password)
      const { data: user } = await supabase
        .from("users")
        .select("id, email, username, account_blocked")
        .eq("id", tokenData.user_id)
        .single();

      if (!user || user.account_blocked) {
        return res.status(400).json({ error: "Invalid token" });
      }

      return res.json({
        valid: true,
        email: user.email,
        username: user.username,
      });
    } catch (error) {
      console.error("Verify setup token error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * Set initial password with token (for new users)
   * POST /api/auth/setup-password
   */
  app.post("/api/auth/setup-password", async (req, res) => {
    try {
      const { token, newPassword, confirmPassword } = req.body;

      // Validate inputs
      if (!token || typeof token !== "string" || token.length !== 64) {
        return res.status(400).json({
          error: "Invalid token format",
        });
      }

      if (!newPassword || typeof newPassword !== "string") {
        return res.status(400).json({
          error: "New password is required",
        });
      }

      if (!confirmPassword || typeof confirmPassword !== "string") {
        return res.status(400).json({
          error: "Password confirmation is required",
        });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({ error: "Passwords do not match" });
      }

      // Validate password strength
      if (newPassword.length < 8) {
        return res.status(400).json({
          error: "Password must be at least 8 characters long",
        });
      }

      if (newPassword.length > 128) {
        return res.status(400).json({
          error: "Password must be less than 128 characters",
        });
      }

      if (
        !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword) &&
        !/(?=.*[a-z])(?=.*[A-Z])(?=.*[@$!%*?&#])/.test(newPassword)
      ) {
        return res.status(400).json({
          error:
            "Password must contain at least one uppercase letter, one lowercase letter, and one number or special character",
        });
      }

      // Find and validate token
      const { data: tokenData, error: tokenError } = await supabase
        .from("password_reset_tokens")
        .select("id, user_id, expires_at, used_at, token_type")
        .eq("token", token)
        .eq("token_type", "setup")
        .single();

      if (tokenError || !tokenData) {
        return res.status(400).json({ error: "Invalid or expired token" });
      }

      // Check if token is used
      if (tokenData.used_at) {
        return res.status(400).json({ error: "Token has already been used" });
      }

      // Check if token is expired
      const expiresAt = new Date(tokenData.expires_at);
      if (expiresAt < new Date()) {
        return res.status(400).json({ error: "Token has expired" });
      }

      // Get user
      const { data: user, error: userError } = await supabase
        .from("users")
        .select("id, email, account_blocked")
        .eq("id", tokenData.user_id)
        .single();

      if (userError || !user || user.account_blocked) {
        return res.status(400).json({ error: "Invalid token" });
      }

      // Hash new password
      const hashedPassword = await hashPassword(newPassword, 10);

      // Update user password and mark token as used in sequence
      const { error: updateError } = await supabase
        .from("users")
        .update({
          password: hashedPassword,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (updateError) {
        console.error("Failed to set password:", updateError);
        return res.status(500).json({ error: "Failed to set password" });
      }

      // Mark token as used (best effort)
      const { error: tokenUpdateError } = await supabase
        .from("password_reset_tokens")
        .update({ used_at: new Date().toISOString() })
        .eq("id", tokenData.id);

      if (tokenUpdateError) {
        console.error("Failed to mark token as used (password already set):", tokenUpdateError);
        // Continue anyway - password is already set
      }

      // console.log("Initial password setup successful for user:", user.email);

      return res.json({
        success: true,
        message: "Password has been set successfully. You can now log in.",
      });
    } catch (error) {
      console.error("Setup password error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Signup request route (for admin approval)
  app.post("/api/auth/signup-request", async (req, res) => {
    try {
      const {
        firstName,
        lastName,
        email,
        phone,
        userType,
        graduationYear,
        batch,
        course,
        branch,
        rollNumber,
        cgpa,
        currentCity,
        currentCompany,
        currentRole,
        linkedinUrl,
        reasonForJoining,
        linkedinOauthId,
      } = req.body;

      if (!firstName || !lastName || !email) {
        return res.status(400).json({ error: "Required fields are missing" });
      }

      if (userType !== 'faculty' && !graduationYear) {
        return res.status(400).json({ error: "Graduation year is required for students and alumni" });
      }

      // Validate Graduation Year / Batch (graduation year must be 2018 or later; batch end year must be 2018 or later)
      const gradYearNum = parseInt(String(graduationYear));
      const batchParts = batch ? String(batch).split('-') : [];
      const batchEndYearNum = batchParts.length > 0 ? parseInt(batchParts[batchParts.length - 1]) : gradYearNum;

      if (userType !== 'faculty') {
        if (!isNaN(gradYearNum) && gradYearNum < 2018) {
          return res.status(400).json({ error: "Graduation year cannot be earlier than 2018." });
        }

        if (!isNaN(batchEndYearNum) && batchEndYearNum < 2018) {
          return res.status(400).json({ error: "Batch end year cannot be earlier than 2018." });
        }
      }

      // Check if email already exists in pending/approved signup requests
      // Exclude NULL emails (deleted/replaced entries)
      const { data: existingRequest } = await supabase
        .from("signup_requests")
        .select("id, status")
        .eq("email", email)
        .not('email', 'is', null)
        .in("status", ["pending", "approved"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingRequest) {
        // If pending, it is definitely a conflict
        if (existingRequest.status === "pending") {
          return res
            .status(409)
            .json({ error: "A signup request with this email already exists" });
        }

        // If approved, verify if the user account actually exists
        // (User might have been deleted but the request remains approved)
        if (existingRequest.status === "approved") {
          const { data: userExists } = await supabase
            .from("users")
            .select("id")
            .eq("email", email)
            .maybeSingle();

          if (userExists) {
            return res
              .status(409)
              .json({ error: "This email is already registered" });
          }

          // If user doesn't exist, the old account was deleted.
          // Clean up the orphaned approved signup request to allow new registration
          // console.log(`Cleaning up orphaned approved signup request for email: ${email}`);
          await supabase
            .from("signup_requests")
            .update({ status: "cancelled", updated_at: new Date().toISOString() })
            .eq("id", existingRequest.id);

          // Continue to allow the new request to proceed
        }
      }

      // Check if email already exists in active users only
      // Exclude NULL emails (deleted/replaced entries)
      const { data: existingUser } = await supabase
        .from("users")
        .select("id, account_blocked")
        .eq("email", email)
        .not('email', 'is', null)
        .maybeSingle();

      if (existingUser && !existingUser.account_blocked) {
        return res
          .status(409)
          .json({ error: "This email is already registered" });
      }

      // If user exists but is blocked, clean up the old record
      if (existingUser && existingUser.account_blocked) {
        // console.log(`Cleaning up blocked user account for email: ${email}`);

        // Delete associated alumni record first (foreign key constraint)
        await supabase.from("alumni").delete().eq("user_id", existingUser.id);

        // Delete the blocked user
        await supabase.from("users").delete().eq("id", existingUser.id);

        // Also clean up any old signup requests
        await supabase
          .from("signup_requests")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("email", email)
          .in("status", ["pending", "approved"]);
      }

      // Optional: clean up orphaned alumni records (alumni row whose user was deleted).
      // Alumni table may or may not have an email column (schema varies); wrap in try/catch so signup never fails here.
      try {
        const { data: orphanedAlumni, error: alumniLookupError } = await supabase
          .from("alumni")
          .select("id, user_id")
          .eq("email", email)
          .maybeSingle();

        if (alumniLookupError) {
          // e.g. column "email" does not exist on alumni; skip cleanup
          if (process.env.NODE_ENV === "development") {
            console.warn("Signup: alumni lookup by email skipped:", alumniLookupError.message);
          }
        } else if (orphanedAlumni) {
          const { data: alumniUser } = await supabase
            .from("users")
            .select("id")
            .eq("id", orphanedAlumni.user_id)
            .maybeSingle();

          if (!alumniUser) {
            await supabase.from("alumni").delete().eq("id", orphanedAlumni.id);
          }
        }
      } catch (orphanErr) {
        if (process.env.NODE_ENV === "development") {
          console.warn("Signup: orphaned alumni cleanup skipped", orphanErr);
        }
      }

      const insertPayload: Record<string, unknown> = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim().toLowerCase(),
        user_type: userType || 'alumni',
        status: "pending",
      };

      if (userType !== 'faculty') {
        const gradYearParsed = parseInt(String(graduationYear), 10);
        if (Number.isNaN(gradYearParsed)) {
          return res.status(400).json({ error: "Invalid graduation year." });
        }
        const batchValue = batch != null && String(batch).trim() !== "" ? String(batch).trim() : String(graduationYear);
        insertPayload.graduation_year = gradYearParsed;
        insertPayload.batch = batchValue;
      }
      if (phone != null && String(phone).trim() !== "") insertPayload.phone = String(phone).trim();
      if (course != null && String(course).trim() !== "") insertPayload.course = String(course).trim();
      if (branch != null && String(branch).trim() !== "") insertPayload.branch = String(branch).trim();
      if (rollNumber != null && String(rollNumber).trim() !== "") insertPayload.roll_number = String(rollNumber).trim();
      if (cgpa != null && String(cgpa).trim() !== "") insertPayload.cgpa = String(cgpa).trim();
      if (currentCity != null && String(currentCity).trim() !== "") insertPayload.current_city = String(currentCity).trim();
      if (currentCompany != null && String(currentCompany).trim() !== "") insertPayload.current_company = String(currentCompany).trim();
      if (currentRole != null && String(currentRole).trim() !== "") insertPayload.current_role = String(currentRole).trim();
      if (linkedinUrl != null && String(linkedinUrl).trim() !== "") insertPayload.linkedin_url = String(linkedinUrl).trim();
      if (linkedinOauthId != null && String(linkedinOauthId).trim() !== "") {
        const subValue = String(linkedinOauthId).trim();
        if (/^[a-zA-Z0-9_-]{5,50}$/.test(subValue)) {
          insertPayload.linkedin_oauth_id = subValue;
        }
      }
      if (reasonForJoining != null && String(reasonForJoining).trim() !== "") insertPayload.reason_for_joining = String(reasonForJoining).trim();

      const { data: signupRequest, error } = await supabase
        .from("signup_requests")
        .insert(insertPayload)
        .select()
        .single();

      if (error) {
        console.error("Signup request Supabase error:", error.message, error.code, error.details);
        const userMessage = "Failed to submit signup request. Please try again.";
        return res
          .status(500)
          .json({
            error: userMessage,
            code: "SIGNUP_REQUEST_FAILED",
            ...(process.env.NODE_ENV === "development" && { detail: error.message }),
          });
      }

      // Notify all admins (Supabase). Do not fail the request if notification fails.
      try {
        const { data: admins } = await supabase
          .from("users")
          .select("id")
          .or("is_admin.eq.true,user_role.eq.administrator");

        if (admins && admins.length > 0) {
          for (const admin of admins) {
            try {
              await createAndEmitNotification({
                userId: admin.id,
                type: NotificationType.SIGNUP_REQUEST,
                title: "New Signup Request",
                content: `${firstName} ${lastName} has requested to join the alumni portal.`,
                relatedId: signupRequest.id,
                redirectUrl: NotificationRedirectUrl.ADMIN_USERS,
                actorId: null,
              });
            } catch (notifErr) {
              console.error("Signup request: failed to notify admin", admin.id, notifErr);
            }
          }
        }
      } catch (notifyError) {
        console.error("Signup request: admin notification error", notifyError);
      }

      res.status(201).json({
        message: "Signup request submitted successfully",
        request: signupRequest,
      });
    } catch (error) {
      console.error("Signup request error:", error);
      res.status(500).json({
        error: "Server error occurred. Please try again later.",
        code: "SERVER_ERROR",
        ...(process.env.NODE_ENV === "development" && error instanceof Error && { detail: error.message }),
      });
    }
  });

  // Register route
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, email, password, role = "student" } = req.body;

      if (!username || !email || !password) {
        return res
          .status(400)
          .json({ error: "Username, email and password are required" });
      }

      // Check if user already exists and is active
      const { data: existingUser } = await supabase
        .from("users")
        .select("id, account_blocked")
        .eq("email", email)
        .maybeSingle();

      if (existingUser && existingUser.account_blocked !== true) {
        return res
          .status(409)
          .json({ error: "A user with this email already exists" });
      }

      // If user exists but is blocked/deleted, clean up the old record
      if (existingUser && existingUser.account_blocked === true) {
        // console.log(
        //   `Cleaning up blocked user account: ${existingUser.id} for email: ${email}`,
        // );

        // Delete associated alumni record first (foreign key constraint)
        await supabase.from("alumni").delete().eq("user_id", existingUser.id);

        // Delete the old blocked user to allow email reuse
        await supabase.from("users").delete().eq("id", existingUser.id);

        // console.log(`Successfully cleaned up old account for email: ${email}`);
      }

      const hashedPassword = await hashPassword(password, 10);

      const { data: newUser, error } = await supabase
        .from("users")
        .insert({
          username,
          email,
          password: hashedPassword,
          is_admin: false,
          user_role: role,
        })
        .select(
          "id, username, email, is_admin, user_role, created_at, updated_at",
        )
        .single();

      if (error) {
        console.error("Registration error:", error);
        return res.status(500).json({ error: "Failed to create user" });
      }

      res.status(201).json({
        user: newUser,
        message: "Registration successful",
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── Persistent signup rate limiter (Drizzle/Neon) ──────────────────────────────────
  // Persists across server restarts and deployments.
  const SIGNUP_THROTTLE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
  const SIGNUP_THROTTLE_MAX = 50; // Higher limit for lab sessions (NAT environment)

  // Student signup route (Automated for lab sessions)
  app.post("/api/auth/student-signup", async (req, res) => {
    try {
      const rawIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.ip || 'unknown';
      const clientIp = String(rawIp);
      const windowStart = new Date(Date.now() - SIGNUP_THROTTLE_WINDOW_MS).toISOString();

      // Count recent attempts for this IP from Supabase
      const { count: attemptCount, error: countError } = await supabase
        .from("signup_rate_limits")
        .select("*", { count: 'exact', head: true })
        .eq("ip_address", clientIp)
        .gte("attempted_at", windowStart);

      if (countError) {
        console.error("[StudentSignup] Rate limit check error:", countError);
      }

      if (attemptCount && attemptCount >= SIGNUP_THROTTLE_MAX) {
        console.warn(`[StudentSignup] Throttle triggered for IP: ${clientIp}`);
        return res.status(429).json({
          error: "Too many registrations from this computer. Please wait a few minutes or contact the lab administrator."
        });
      }

      const {
        firstName,
        lastName,
        email,
        password,
        phone,
        gender,
        rollNumber,
        graduationYear,
        course,
        branch,
        batch,
      } = req.body;

      if (!firstName || !lastName || !email || !password || !graduationYear || !rollNumber) {
        return res.status(400).json({ error: "Required fields (including Roll Number) are missing" });
      }

      // Sanitize inputs
      const sFirstName = sanitizeName(firstName);
      const sLastName = sanitizeName(lastName);
      const sEmail = sanitizeEmail(email);
      const sRollNumber = sanitizeString(rollNumber).toUpperCase(); // Consistent Roll Number format

      if (!sFirstName || sFirstName.length < 2) {
        return res.status(400).json({ error: "Invalid First Name" });
      }

      if (!sLastName || sLastName.length < 2) {
        return res.status(400).json({ error: "Invalid Last Name" });
      }

      if (sRollNumber.length < 3) {
        return res.status(400).json({ error: "Roll Number is too short. Please enter your valid school roll number." });
      }

      if (!isValidEmail(sEmail)) {
        return res.status(400).json({ error: "Invalid email address" });
      }

      // Validate Graduation Year (Must be 2018 or later to match client dropdown options)
      const gradYearNum = parseInt(String(graduationYear));
      if (isNaN(gradYearNum) || gradYearNum < 2018) {
        return res.status(400).json({ error: "Graduation year must be 2018 or later" });
      }

      // Check if user already exists
      const { data: existingUser } = await supabase
        .from("users")
        .select("id, account_blocked, email")
        .eq("email", sEmail)
        .maybeSingle();

      if (existingUser && !existingUser.account_blocked) {
        return res.status(409).json({ error: "A user with this email already exists" });
      }

      // If user exists but is blocked/inactive, clean up the old record to allow re-signup
      if (existingUser && existingUser.account_blocked) {
        // console.log(`[StudentSignup] Cleaning up blocked account for re-registration: ${sEmail}`);

        // Delete associated alumni record first (foreign key constraint)
        await supabase.from("alumni").delete().eq("user_id", existingUser.id);

        // Delete the blocked user
        await supabase.from("users").delete().eq("id", existingUser.id);

        // Also clean up any pending signup requests (if any)
        await supabase
          .from("signup_requests")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("email", sEmail)
          .in("status", ["pending", "approved"]);
      }

      // Optional: Check if roll number already exists (to prevent duplicate student profiles)
      if (sRollNumber) {
        const { data: existingRoll } = await supabase
          .from("alumni")
          .select("id, user_id")
          .eq("roll_number", sRollNumber)
          .maybeSingle();

        if (existingRoll) {
          // If the alumni record is orphaned (no associated user), clean it up and allow re-registration
          const { data: rollUser } = await supabase
            .from("users")
            .select("id, account_blocked")
            .eq("id", existingRoll.user_id)
            .maybeSingle();

          if (!rollUser || rollUser.account_blocked) {
            // Orphaned or blocked — safe to delete and proceed
            await supabase.from("alumni").delete().eq("id", existingRoll.id);
            if (rollUser?.account_blocked) {
              await supabase.from("users").delete().eq("id", rollUser.id);
            }
          } else {
            return res.status(409).json({ error: "A profile with this roll number already exists" });
          }
        }
      }

      // Check for legacy/orphaned alumni record with this email
      const { data: existingAlumni } = await supabase
        .from("alumni")
        .select("id, user_id")
        .eq("email", sEmail)
        .maybeSingle();

      if (existingAlumni) {
        // If an alumni record exists but no user (orphaned), clean it up
        if (!existingUser) {
          await supabase.from("alumni").delete().eq("id", existingAlumni.id);
        } else if (existingUser.account_blocked) {
          // If user is blocked, our cleanup logic above already handled user deletion,
          // but let's double check the alumni record is gone
          await supabase.from("alumni").delete().eq("id", existingAlumni.id);
        }
      }

      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }

      const hashedPassword = await hashPassword(password, 10);

      // Generate unique username with collision handling
      const timestamp = Date.now().toString(36).substring(2); // More entropy
      const baseUsername = sEmail.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
      let uniqueUsername = `${baseUsername}_${timestamp}`;

      // Check for username collisions (Edge case)
      let isUsernameUnique = false;
      let collisionCount = 0;

      while (!isUsernameUnique && collisionCount < 5) {
        const { data: existingUsername } = await supabase
          .from("users")
          .select("id")
          .eq("username", uniqueUsername)
          .maybeSingle();

        if (!existingUsername) {
          isUsernameUnique = true;
        } else {
          collisionCount++;
          uniqueUsername = `${baseUsername}_${timestamp}${Math.floor(Math.random() * 1000)}`;
        }
      }

      // Create user - Students signed up in lab are auto-approved
      const { data: newUser, error: userError } = await supabase
        .from("users")
        .insert({
          username: uniqueUsername,
          email: sEmail,
          password: hashedPassword,
          is_admin: false,
          user_role: determineUserRole(gradYearNum), // Set correct role (student vs alumni)
          account_approved: true,
        })
        .select()
        .single();

      if (userError || !newUser) {
        console.error("Student create user error:", userError);
        return res.status(500).json({ error: "Failed to create user account" });
      }

      // Create student profile in alumni table
      const { error: alumniError } = await supabase.from("alumni").insert({
        user_id: newUser.id,
        first_name: sFirstName,
        last_name: sLastName,
        email: sEmail,
        phone: sanitizeString(phone) || null,
        gender: sanitizeString(gender) || null,
        graduation_year: gradYearNum,
        batch: (batch && sanitizeString(batch)) || String(gradYearNum),
        course: (course && sanitizeString(course)) || null,
        branch: (branch && sanitizeString(branch)) || null,
        roll_number: sRollNumber || null,
        is_profile_public: true,
        is_verified: true, // Lab signup is verified by presence
        is_active: true,
      });

      if (alumniError) {
        console.error("Student create profile error:", alumniError);
        // Rollback user creation
        await supabase.from("users").delete().eq("id", newUser.id);
        return res.status(500).json({ error: "Failed to create student profile" });
      }

      // Record this successful signup in Supabase
      await supabase.from("signup_rate_limits").insert({ ip_address: clientIp });

      // Notify user via in-app notification
      await createAndEmitNotification({
        userId: newUser.id,
        type: NotificationType.WELCOME,
        title: "Welcome to TKS Alumni Portal",
        content: `Welcome ${sFirstName}! Your student account has been created successfully.`,
        relatedId: newUser.id,
        redirectUrl: NotificationRedirectUrl.PROFILE,
        actorId: null,
      });

      // Notify user via email
      try {
        const welcomeEmail = generateWelcomeConfirmationEmail(
          `${sFirstName} ${sLastName}`.trim(),
          sEmail,
          password, // plain password as requested
          newUser.username
        );
        await sendEmail({
          to: sEmail,
          toName: `${sFirstName} ${sLastName}`.trim(),
          subject: welcomeEmail.subject,
          textBody: welcomeEmail.textBody,
          htmlBody: welcomeEmail.htmlBody,
        });
      } catch (emailErr: any) {
        console.error("[StudentSignup] Welcome email failed:", emailErr?.message || emailErr);
      }

      res.status(201).json({
        message: "Student registration successful",
        user: newUser,
      });
    } catch (error) {
      console.error("Student signup error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get current user route
  app.get("/api/auth/me", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;

      if (!userId) {
        return res.status(401).json({ error: "No user ID provided" });
      }

      const { data: user, error } = await supabase
        .from("users")
        .select(
          "id, username, email, is_admin, user_role, created_at, updated_at",
        )
        .eq("id", userId)
        .single();

      if (error || !user) {
        return res.status(404).json({ error: "User not found" });
      }

      const { data: alumni } = await supabase
        .from("alumni")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      // Auto-correct user role if needed based on graduation year
      if (alumni && alumni.graduation_year && !user.is_admin && user.user_role !== 'administrator' && user.user_role !== 'faculty') {
        const expectedRole = determineUserRole(alumni.graduation_year);

        if (user.user_role !== expectedRole) {
          // console.log(`Auto-correcting user role for ${user.id} from ${user.user_role} to ${expectedRole}`);

          const { error: updateError } = await supabase
            .from("users")
            .update({ user_role: expectedRole })
            .eq("id", user.id);

          if (!updateError) {
            user.user_role = expectedRole;
          }
        }
      }

      res.json({
        user,
        alumni: alumni || null,
      });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Alumni search endpoint

  // Get public alumni profile by ID

  // Alumni profile routes
  const ALUMNI_PROFILE_ALLOWED_FIELDS = new Set([
    "first_name", "last_name", "bio", "location", "linkedin_url", "website_url",
    "skills", "responsibilities", "achievements", "graduation_year", "major",
    "company", "role", "is_mentor", "max_mentees", "expertise_areas", "help_topics",
    "availability_note", "meeting_link", "profile_picture_url", "resume_url",
    "gender", "cohort", "program", "industry", "interests", "is_open_to_work",
    "newsletter_unsubscribed",
  ]);

  app.post("/api/alumni/profile", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;

      if (!userId) {
        return res.status(401).json({ error: "No user ID provided" });
      }

      const safeBody = Object.fromEntries(
        Object.entries(req.body).filter(([k]) => ALUMNI_PROFILE_ALLOWED_FIELDS.has(k))
      );

      const { data: alumni, error } = await supabase
        .from("alumni")
        .insert({
          user_id: userId,
          ...safeBody,
        })
        .select("*")
        .single();

      if (error) {
        console.error("Create alumni profile error:", error);
        return res
          .status(500)
          .json({ error: "Failed to create alumni profile" });
      }

      res.status(201).json({ alumni });
    } catch (error) {
      console.error("Create alumni profile error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });




  // Alumni Map routes (public)
  app.use("/api/alumni-map", alumniMapRoutes);

  app.put("/api/alumni/profile", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;

      if (!userId) {
        return res.status(401).json({ error: "No user ID provided" });
      }

      const safeBody = Object.fromEntries(
        Object.entries(req.body).filter(([k]) => ALUMNI_PROFILE_ALLOWED_FIELDS.has(k))
      );

      const { data: alumni, error } = await supabase
        .from("alumni")
        .update({
          ...safeBody,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .select("*")
        .single();

      if (error) {
        console.error("Update alumni profile error:", error);
        return res
          .status(500)
          .json({ error: "Failed to update alumni profile" });
      }


      res.json({ alumni });
    } catch (error) {
      console.error("Update alumni profile error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });


  // Send credentials email (uses shared email-service; ZeptoMail)
  app.post("/api/admin/send-credentials-email", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;

      if (!userId) {
        return res.status(401).json({ error: "No user ID provided" });
      }

      const { data: user } = await supabase
        .from("users")
        .select("is_admin, user_role")
        .eq("id", userId)
        .single();

      if (!user || (!user.is_admin && user.user_role !== "administrator")) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const { recipientEmail, recipientName, emailContent } = req.body;

      const email = (recipientEmail ?? "").trim().toLowerCase();
      const content = typeof emailContent === "string" ? emailContent.trim() : "";

      if (!email) {
        return res.status(400).json({ error: "Recipient email is required" });
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Invalid recipient email format" });
      }
      if (!content) {
        return res.status(400).json({ error: "Email content is required" });
      }
      if (content.length > 500 * 1024) {
        return res.status(400).json({ error: "Email content is too long" });
      }

      try {
        checkEmailConfig();
      } catch (configErr: any) {
        console.error("Send credentials: email not configured", configErr?.message);
        return res.status(503).json({
          error: "Email service is not configured. Please set ZEPTOMAIL_TOKEN.",
        });
      }

      await sendEmail({
        to: email,
        toName: (recipientName ?? "").trim() || email,
        subject: "Your Alumni Portal Credentials",
        textBody: content,
        htmlBody: `<p>${content.replace(/\n/g, '<br/>')}</p>`,
      });

      return res.json({
        success: true,
        message: "Credentials email sent successfully",
      });
    } catch (error: any) {
      console.error("Send credentials email error:", error);
      const isConfig = /not configured|credentials/.test(error?.message || "");
      if (isConfig) {
        return res.status(503).json({
          error: error?.message || "Email service is not configured.",
        });
      }
      if (isZeptoMailCreditsError(error)) {
        return res.status(503).json({
          error: "ZeptoMail credits exhausted or expired. Purchase credits from ZeptoMail Subscription page.",
          code: "ZEPTOMAIL_CREDITS",
        });
      }
      return res.status(500).json({
        error: error?.message || "Failed to send email",
        details: error?.message || "Unknown error",
      });
    }
  });

  // ZeptoMail credits status (admin only) – checks if email service has credits / is reachable
  app.get("/api/admin/email/credits-status", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { data: user } = await supabase
        .from("users")
        .select("is_admin, user_role")
        .eq("id", userId)
        .single();

      if (!user || (!user.is_admin && user.user_role !== "administrator")) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const status = await getZeptoMailCreditsStatus();
      const ok = status.creditsOk === true;
      res.status(200).json({
        creditsOk: status.creditsOk,
        message: status.message,
        ...(status.details && { details: status.details }),
        ...(ok && { recommendation: "ZeptoMail is ready to send." }),
        ...(status.creditsOk === false && {
          recommendation: "Purchase credits from ZeptoMail Dashboard → Subscription.",
        }),
        ...(status.creditsOk === "unknown" && {
          recommendation: "Check ZeptoMail Dashboard → Credit Information for balance.",
        }),
      });
    } catch (error) {
      console.error("Credits status check error:", error);
      res.status(500).json({
        creditsOk: "unknown",
        message: "Failed to check ZeptoMail status.",
        error: (error as Error)?.message,
      });
    }
  });

  // ==================== ADMIN SIGNUP REQUESTSROUTES ====================

  // Get all signup requests
  app.get("/api/admin/signup-requests", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;

      if (!userId) {
        return res.status(401).json({ error: "No user ID provided" });
      }

      // Verify user is admin
      const { data: user } = await supabase
        .from("users")
        .select("is_admin, user_role")
        .eq("id", userId)
        .single();

      if (!user || (!user.is_admin && user.user_role !== "administrator")) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const { status = "pending" } = req.query;

      const { data: requests, error, count } = await supabase
        .from("signup_requests")
        .select("*", { count: 'exact' })
        .eq("status", status)
        .order("created_at", { ascending: false })
        .range(0, 10000);

      if (error) {
        console.error("Get signup requests error:", error);
        return res
          .status(500)
          .json({ error: "Failed to fetch signup requests" });
      }

      res.json({
        requests: requests || [],
        totalCount: count || (requests?.length || 0)
      });
    } catch (error) {
      console.error("Get signup requests error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Approve signup request
  app.post("/api/admin/signup-requests/:id/approve", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const requestId = req.params.id;

      console.log("=== Signup Request Approval Started ===");
      console.log("Request ID:", requestId);
      console.log("Admin User ID:", userId);

      if (!userId) {
        return res.status(401).json({ error: "No user ID provided" });
      }

      // Verify user is admin
      const { data: adminUser } = await supabase
        .from("users")
        .select("is_admin")
        .eq("id", userId)
        .single();

      if (!adminUser || !adminUser.is_admin) {
        // console.log("Authorization failed: User is not admin");
        return res.status(403).json({ error: "Unauthorized" });
      }

      // Get signup request
      const { data: request, error: requestError } = await supabase
        .from("signup_requests")
        .select("*")
        .eq("id", requestId)
        .single();

      if (requestError || !request) {
        console.log("Signup request not found:", requestError);
        return res.status(404).json({ error: "Signup request not found" });
      }

      console.log("Current request status:", request.status);

      if (request.status !== "pending") {
        console.log("Request already processed with status:", request.status);
        return res.status(400).json({ error: "Request already processed" });
      }

      // Guard: clean up orphaned records from a prior partial approval attempt.
      // alumni.user_id has ON DELETE no action, so we must delete alumni BEFORE the user.

      // Step 1: Find orphaned user by email
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("email", request.email)
        .maybeSingle();

      if (existingUser) {
        console.warn("[Approve] Found orphaned user from prior partial attempt — id:", existingUser.id, "email:", request.email);

        // Step 1a: Delete alumni row by user_id first (ON DELETE no action blocks user delete otherwise)
        const { error: deleteAlumniByUserError } = await supabase
          .from("alumni")
          .delete()
          .eq("user_id", existingUser.id);
        if (deleteAlumniByUserError) {
          console.warn("[Approve] Alumni delete by user_id failed (may not exist):", deleteAlumniByUserError.message);
        } else {
          console.log("[Approve] Alumni row deleted by user_id.");
        }

        // Step 1b: Delete all tables with ON DELETE no action referencing this user
        await supabase.from("notifications").delete().eq("user_id", existingUser.id);
        await supabase.from("password_reset_tokens").delete().eq("user_id", existingUser.id);
        await supabase.from("connection_requests").delete().eq("requester_id", existingUser.id);
        await supabase.from("connection_requests").delete().eq("recipient_id", existingUser.id);
        await supabase.from("user_blocks").delete().eq("blocker_id", existingUser.id);
        await supabase.from("user_blocks").delete().eq("blocked_id", existingUser.id);
        await supabase.from("feed_posts").delete().eq("author_id", existingUser.id);
        await supabase.from("events").delete().eq("organized_by", existingUser.id);
        await supabase.from("events").delete().eq("posted_by", existingUser.id);
        await supabase.from("jobs").delete().eq("posted_by", existingUser.id);

        // Step 1c: Now delete the user — all referencing rows are cleared
        const { error: deleteUserError } = await supabase.from("users").delete().eq("id", existingUser.id);
        if (deleteUserError) {
          console.error("[Approve] Failed to delete orphaned user after clearing dependencies:", deleteUserError.code, deleteUserError.message, deleteUserError.details);
          return res.status(500).json({ error: "Failed to clean up prior partial approval. Please contact support." });
        }
        console.log("[Approve] Orphaned user deleted successfully, proceeding with fresh creation.");
      }

      // Step 2: Also delete any orphaned alumni by email (in case alumni exists without a user row)
      const { data: existingAlumni } = await supabase
        .from("alumni")
        .select("id")
        .eq("email", request.email)
        .maybeSingle();

      if (existingAlumni) {
        console.warn("[Approve] Found orphaned alumni (no user) — id:", existingAlumni.id, "email:", request.email);
        const { error: deleteAlumniError } = await supabase.from("alumni").delete().eq("id", existingAlumni.id);
        if (deleteAlumniError) {
          console.error("[Approve] Failed to delete orphaned alumni:", deleteAlumniError.code, deleteAlumniError.message);
          return res.status(500).json({ error: "Failed to clean up prior partial approval (alumni). Please contact support." });
        }
        console.log("[Approve] Orphaned alumni deleted successfully.");
      }

      // Generate cryptographically secure random password
      const tempPassword = "TKS" + crypto.randomBytes(6).toString("hex") + "!";
      let hashedPassword: string;

      try {
        hashedPassword = await hashPassword(tempPassword, 10);
      } catch (hashError) {
        console.error("Password hashing error:", hashError);
        return res
          .status(500)
          .json({ error: "Failed to generate secure password" });
      }

      console.log("Creating user account for:", request.email);

      // Generate unique username with timestamp
      const timestamp = Date.now().toString(36); // Convert timestamp to base36 for shorter string
      const baseUsername = request.email
        .split("@")[0]
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      const uniqueUsername = `${baseUsername}_${timestamp}`;

      // Calculate user role based on explicitly set user_type or fallback to calculation
      const calculatedRole = request.user_type || (request.graduation_year ? determineUserRole(request.graduation_year) : 'alumni');

      // Create user
      const { data: newUser, error: userError } = await supabase
        .from("users")
        .insert({
          username: uniqueUsername,
          email: request.email,
          password: hashedPassword,
          is_admin: false,
          user_role: calculatedRole,
          account_approved: true,
        })
        .select()
        .single();

      if (userError || !newUser) {
        console.error("[Approve] Create user FAILED — full error:", JSON.stringify(userError));
        console.error("[Approve] code:", userError?.code, "| message:", userError?.message, "| details:", userError?.details, "| hint:", userError?.hint);
        if (userError?.code === "23505") {
          console.error("[Approve] Duplicate key on users insert — email:", request.email);
          return res.status(409).json({ error: "User with this email already exists" });
        }
        return res.status(500).json({ error: "Failed to create user", code: userError?.code, detail: userError?.message });
      }

      console.log("User created successfully:", newUser.id);
      console.log("Creating alumni profile...");

      // Create alumni profile
      const { error: alumniError } = await supabase.from("alumni").insert({
        user_id: newUser.id,
        first_name: request.first_name,
        last_name: request.last_name,
        email: request.email,
        phone: request.phone,
        graduation_year: request.graduation_year,
        batch: request.batch,
        course: request.course,
        branch: request.branch,
        roll_number: request.roll_number,
        cgpa: request.cgpa,
        current_city: request.current_city,
        current_company: request.current_company,
        current_role: request.current_role,
        linkedin_url: request.linkedin_url,
        is_profile_public: true,
        is_verified: true,
        is_active: true,
      });

      if (alumniError) {
        console.error("[Approve] Create alumni FAILED — full error:", JSON.stringify(alumniError));
        console.error("[Approve] code:", alumniError.code, "| message:", alumniError.message, "| details:", alumniError.details, "| hint:", alumniError.hint);
        // Rollback: delete newly created user (cascades to alumni if FK cascade is set)
        const { error: rollbackError } = await supabase.from("users").delete().eq("id", newUser.id);
        if (rollbackError) {
          console.error("[Approve] Rollback failed:", rollbackError.message);
        }
        if (alumniError.code === "23505") {
          console.error("[Approve] Duplicate key on alumni insert — email:", request.email);
          return res.status(409).json({ error: "Alumni profile with this email already exists" });
        }
        return res.status(500).json({ error: "Failed to create alumni profile", code: alumniError.code, detail: alumniError.message });
      }

      console.log("Alumni profile created successfully");

      // If the signup request came via LinkedIn OAuth, link the linkedin_id to the new user
      if (request.linkedin_oauth_id) {
        const { error: liLinkError } = await supabase
          .from("linkedin_integrations")
          .upsert(
            {
              user_id: newUser.id,
              linkedin_id: request.linkedin_oauth_id,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" }
          );
        if (liLinkError) {
          // Non-fatal: approval continues even if LinkedIn linking fails
          console.error("[LinkedIn] Failed to link linkedin_oauth_id on approval:", liLinkError.message);
        }
      }

      console.log("Updating signup request status to approved...");

      // Update signup request status
      const { data: updatedRequest, error: updateError } = await supabase
        .from("signup_requests")
        .update({
          status: "approved",
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", requestId)
        .select()
        .single();

      if (updateError) {
        console.error("Failed to update signup request status:", updateError);
      } else {
        console.log("Signup request status updated:", updatedRequest?.status);
      }

      // Create notification for the new user using new helper
      await createAndEmitNotification({
        userId: newUser.id,
        type: NotificationType.SIGNUP_APPROVED,
        title: "Account Approved",
        content: "Your signup request has been approved. Welcome to the alumni portal!",
        relatedId: requestId,
        redirectUrl: NotificationRedirectUrl.PROFILE,
        actorId: userId,
      });

      // Generate secure token for initial password setup
      const setupToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1); // Token expires in 1 hour

      // Get client IP and user agent for security (from admin's request)
      const ipAddress =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
        req.socket.remoteAddress ||
        "unknown";
      const userAgent = req.headers["user-agent"] || "unknown";

      // Create setup token
      const { error: tokenError } = await supabase
        .from("password_reset_tokens")
        .insert({
          user_id: newUser.id,
          token: setupToken,
          token_type: "setup",
          expires_at: expiresAt.toISOString(),
          ip_address: ipAddress,
          user_agent: userAgent,
        });

      if (tokenError) {
        console.error("Failed to create setup token:", tokenError);
        // Continue anyway - user can still use temp password
      }

      // Generate setup link using consistent base URL helper
      const baseUrl = getBaseUrl();
      const setupLink = `${baseUrl}/setup-password?token=${setupToken}`;

      // Get user's name
      const userName = `${request.first_name} ${request.last_name}`.trim();

      // Send initial password setup email (non-blocking; admin can resend via Send Credentials)
      try {
        checkEmailConfig();
        const emailContent = generatePasswordSetupEmail(
          setupLink,
          userName,
          tempPassword, // Include temporary password per requirements
          newUser.username
        );
        await sendEmail({
          to: request.email,
          toName: userName,
          subject: emailContent.subject,
          textBody: emailContent.textBody,
          htmlBody: emailContent.htmlBody,
        });
      } catch (emailError: any) {
        console.error("Failed to send password setup email:", emailError?.message || emailError);
        // Do not fail approval; admin can use "Send Credentials" to resend
      }

      console.log("=== Signup Request Approval Completed ===");

      res.json({
        message: "Signup request approved and password setup email sent",
        credentials: {
          username: newUser.username,
          email: request.email,
          temporaryPassword: tempPassword,
          setupLink: setupLink, // Include for admin reference
        },
      });
    } catch (error) {
      console.error("Approve signup request error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Reject signup request
  app.post("/api/admin/signup-requests/:id/reject", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const requestId = req.params.id;

      if (!userId) {
        return res.status(401).json({ error: "No user ID provided" });
      }

      // Verify user is admin
      const { data: adminUser } = await supabase
        .from("users")
        .select("is_admin, user_role")
        .eq("id", userId)
        .single();

      if (!adminUser || (!adminUser.is_admin && adminUser.user_role !== "administrator")) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const { error } = await supabase
        .from("signup_requests")
        .update({
          status: "rejected",
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (error) {
        console.error("Reject signup request error:", error);
        return res
          .status(500)
          .json({ error: "Failed to reject signup request" });
      }

      res.json({ message: "Signup request rejected" });
    } catch (error) {
      console.error("Reject signup request error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Add admin users endpoint

  // Export all users with location data (admin only)
  app.get("/api/admin/users/export", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;

      if (!userId) {
        return res.status(401).json({ error: "No user ID provided" });
      }

      // Check admin privileges
      const { data: requestingUser } = await supabase
        .from("users")
        .select("is_admin, user_role")
        .eq("id", userId)
        .single();

      if (!requestingUser || (!requestingUser.is_admin && requestingUser.user_role !== "administrator")) {
        return res.status(403).json({ error: "Access denied. Admin privileges required." });
      }

      // Fetch all users with alumni location data
      const { data, error } = await supabase
        .from("users")
        .select(`
          id, username, email, is_admin, user_role, account_approved, account_blocked, created_at, updated_at,
          alumni!left (
            graduation_year, batch, branch, first_name, last_name,
            current_city, current_state, current_country, location_label
          )
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching users for export:", error);
        return res.status(500).json({ error: "Failed to fetch users for export" });
      }

      // Transform data to ensure alumni fields are easily accessible
      const transformedData = (data || []).map((user: any) => {
        const alumni = user.alumni && user.alumni.length > 0 ? user.alumni[0] : user.alumni;
        return {
          ...user,
          alumni, // ensure it's either the object or null/undefined
          first_name: alumni?.first_name || null,
          last_name: alumni?.last_name || null,
          graduation_year: alumni?.graduation_year || null,
          batch: alumni?.batch || null,
          branch: alumni?.branch || null,
          current_city: alumni?.current_city || null,
          current_state: alumni?.current_state || null,
          current_country: alumni?.current_country || null,
          location_label: alumni?.location_label || null
        };
      });

      res.json(transformedData);
    } catch (error) {
      console.error("Error in GET /api/admin/users/export:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  // Get users with pagination and filtering (admin only)
  app.get("/api/admin/users", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const search = (req.query.search as string) || "";
      const role = (req.query.role as string) || "all";
      const adminStatus = (req.query.adminStatus as string) || "all";
      const batch = (req.query.batch as string) || "all";

      if (!userId) {
        return res.status(401).json({ error: "No user ID provided" });
      }

      // Check admin privileges
      const { data: requestingUser } = await supabase
        .from("users")
        .select("is_admin, user_role")
        .eq("id", userId)
        .single();

      if (!requestingUser || (!requestingUser.is_admin && requestingUser.user_role !== "administrator")) {
        return res.status(403).json({ error: "Access denied. Admin privileges required." });
      }

      // Build query
      let query = supabase
        .from("users")
        .select(`
          id, username, email, is_admin, user_role, account_approved, account_blocked, created_at, updated_at,
          alumni!left (
            graduation_year, batch, branch, is_batch_champion, first_name, last_name, university, higher_education_country, profile_picture
          )
        `, { count: 'exact' });

      // Apply filters
      if (search) {
        // More robust OR filter for joined tables in Supabase JS
        // Note: For 1-1 or 1-M joins, we use the table.column syntax if it's uniquely identifiable or if we use !inner
        // Since we need !left for admins, we keep it as is but ensure robust flattening below
        query = query.or(`username.ilike.%${search}%,email.ilike.%${search}%,alumni.first_name.ilike.%${search}%,alumni.last_name.ilike.%${search}%`);
      }
      if (role !== "all") {
        query = query.eq("user_role", role);
      }
      if (adminStatus === "admin") {
        query = query.eq("is_admin", true);
      } else if (adminStatus === "regular") {
        query = query.eq("is_admin", false);
      }

      // Handle batch filter requires a nested check or a more complex query if many users
      // For now, let's focus on the primary user filters and handle pagination

      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) {
        console.error("Error fetching users:", error);
        return res.status(500).json({ error: "Failed to fetch users" });
      }

      // Flatten the response to match previously expected structure
      const flattenedData = (data || []).map(user => {
        const alumniData = (user as any).alumni;
        // Robust handling for both array (1-M) and object (1-1) join responses
        const alumni = Array.isArray(alumniData) ? (alumniData[0] || {}) : (alumniData || {});

        return {
          ...user,
          graduation_year: alumni.graduation_year || null,
          batch: alumni.batch || null,
          is_batch_champion: alumni.is_batch_champion || false,
          first_name: alumni.first_name || null,
          last_name: alumni.last_name || null,
          branch: alumni.branch || null,
          university: alumni.university || null,
          higher_education_country: alumni.higher_education_country || null,
          profile_picture: alumni.profile_picture || null
        };
      });

      return res.json({
        users: flattenedData,
        totalCount: count || 0,
        page,
        limit
      });
    } catch (error) {
      console.error("Error in GET /api/admin/users:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/admin/users/:userId", async (req, res) => {
    try {
      const adminId = req.headers["user-id"] as string;
      const targetUserId = req.params.userId;

      if (!adminId) {
        return res.status(401).json({ error: "No user ID provided" });
      }

      const { data: requestingUser } = await supabase
        .from("users")
        .select("is_admin, user_role")
        .eq("id", adminId)
        .single();

      if (!requestingUser || (!requestingUser.is_admin && requestingUser.user_role !== "administrator")) {
        return res.status(403).json({ error: "Access denied. Admin privileges required." });
      }

      const { data, error } = await supabase
        .from("users")
        .select(`
          id, username, email, is_admin, user_role, account_approved, account_blocked, created_at, updated_at,
          alumni!left (
            graduation_year, batch, branch, is_batch_champion, first_name, last_name, university, higher_education_country, profile_picture
          )
        `)
        .eq("id", targetUserId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching user:", error);
        return res.status(500).json({ error: "Failed to fetch user" });
      }

      if (!data) {
        return res.status(404).json({ error: "User not found" });
      }

      const alumniData = (data as any).alumni;
      const alumni = Array.isArray(alumniData) ? (alumniData[0] || {}) : (alumniData || {});

      return res.json({
        ...data,
        graduation_year: alumni.graduation_year || null,
        batch: alumni.batch || null,
        is_batch_champion: alumni.is_batch_champion || false,
        first_name: alumni.first_name || null,
        last_name: alumni.last_name || null,
        branch: alumni.branch || null,
        university: alumni.university || null,
        higher_education_country: alumni.higher_education_country || null,
        profile_picture: alumni.profile_picture || null
      });
    } catch (error) {
      console.error("Error in GET /api/admin/users/:userId:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── Dashboard Analytics Aggregation ──────────────────────────────────────
  // Offloads heavy calculations from the client to the server.
  // Cached for 5 mins.
  const _analyticsCache = { data: null as any, expiresAt: 0 };

  app.get("/api/admin/analytics", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      if (!userId) return res.status(401).json({ error: "No user ID provided" });

      const { data: requestingUser } = await supabase
        .from("users")
        .select("is_admin, user_role")
        .eq("id", userId)
        .single();

      if (!requestingUser || (!requestingUser.is_admin && requestingUser.user_role !== "administrator")) {
        return res.status(403).json({ error: "Access denied. Admin privileges required." });
      }

      const now = Date.now();
      if (_analyticsCache.data && now < _analyticsCache.expiresAt) {
        return res.json(_analyticsCache.data);
      }
      const result = await aggregateAdminDashboardMetrics(new Date(now));

      _analyticsCache.data = result;
      _analyticsCache.expiresAt = now + 5 * 60 * 1000; // 5 mins cache

      return res.json(result);
    } catch (error) {
      console.error("Analytics error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── Profile completion stats (admin) ─────────────────────────────────────
  // Returns server-aggregated counts so the client never needs to dump
  // all alumni rows. Cached in-memory for 60 seconds.
  const _profileStatsCache = { data: null as any, expiresAt: 0 };

  app.get("/api/admin/profile-stats", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      if (!userId) return res.status(401).json({ error: "No user ID provided" });

      const { data: requestingUser } = await supabase
        .from("users")
        .select("is_admin, user_role")
        .eq("id", userId)
        .single();

      if (!requestingUser || (!requestingUser.is_admin && requestingUser.user_role !== "administrator")) {
        return res.status(403).json({ error: "Access denied. Admin privileges required." });
      }

      // Serve from cache if still fresh
      const now = Date.now();
      if (_profileStatsCache.data && now < _profileStatsCache.expiresAt) {
        res.setHeader("Cache-Control", "private, max-age=60");
        return res.json(_profileStatsCache.data);
      }

      // Fetch only the fields we need to compute completion
      const { data: allAlumni, error } = await supabase
        .from("alumni")
        .select("profile_picture, bio, current_company, current_role, current_city, linkedin_url, phone, skills");

      if (error) {
        console.error("profile-stats fetch error:", error);
        return res.status(500).json({ error: "Failed to fetch profile stats" });
      }

      let complete = 0, partial = 0, incomplete = 0;

      (allAlumni || []).forEach((alumni: any) => {
        const checks = [
          alumni.profile_picture,
          alumni.bio,
          alumni.current_company,
          alumni.current_role,
          alumni.current_city,
          alumni.linkedin_url,
          alumni.phone,
          Array.isArray(alumni.skills) && alumni.skills.length >= 3,
        ];
        const filled = checks.filter(Boolean).length;
        const pct = Math.round((filled / checks.length) * 100);
        if (pct === 100) complete++;
        else if (pct >= 50) partial++;
        else incomplete++;
      });

      const result = { complete, partial, incomplete };

      // Cache for 60 seconds
      _profileStatsCache.data = result;
      _profileStatsCache.expiresAt = now + 60_000;

      res.setHeader("Cache-Control", "private, max-age=60");
      return res.json(result);
    } catch (error) {
      console.error("profile-stats error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });


  // Get a single user's alumni profile (admin only) - used by Admin User Edit so data is always loaded
  app.get("/api/admin/users/:userId/alumni", async (req, res) => {
    try {
      const adminId = req.headers["user-id"] as string;
      const targetUserId = req.params.userId;

      if (!adminId) {
        return res.status(401).json({ error: "No user ID provided" });
      }

      const { data: requestingUser } = await supabase
        .from("users")
        .select("is_admin, user_role")
        .eq("id", adminId)
        .single();

      if (!requestingUser || (!requestingUser.is_admin && requestingUser.user_role !== "administrator")) {
        return res.status(403).json({ error: "Access denied. Admin privileges required." });
      }

      const { data: alumni, error } = await supabase
        .from("alumni")
        .select("*")
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching alumni for user:", error);
        return res.status(500).json({ error: "Failed to fetch alumni profile" });
      }

      if (!alumni) {
        return res.status(404).json({ error: "Alumni profile not found for this user" });
      }

      res.json(alumni);
    } catch (error) {
      console.error("Error in GET /api/admin/users/:userId/alumni:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Convert single user to alumni
  app.post("/api/admin/users/:userId/convert-alumni", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const targetUserId = req.params.userId;

      if (!userId) {
        return res.status(401).json({ error: "No user ID provided" });
      }

      // Admin check
      const { data: requestingUser } = await supabase
        .from("users")
        .select("is_admin, user_role")
        .eq("id", userId)
        .single();

      if (!requestingUser || (!requestingUser.is_admin && requestingUser.user_role !== "administrator")) {
        return res.status(403).json({ error: "Access denied. Admin privileges required." });
      }

      // Update user
      const { error } = await supabase
        .from("users")
        .update({ user_role: "alumni" })
        .eq("id", targetUserId);

      if (error) throw error;

      res.json({ message: "User converted to alumni successfully" });
    } catch (error) {
      console.error("Error converting user:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Bulk convert by batch
  app.post("/api/admin/users/bulk-convert-alumni", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const { batch } = req.body;

      if (!userId) return res.status(401).json({ error: "No user ID provided" });
      if (!batch) return res.status(400).json({ error: "Batch is required" });

      // Admin check
      const { data: requestingUser } = await supabase
        .from("users")
        .select("is_admin, user_role")
        .eq("id", userId)
        .single();

      if (!requestingUser || (!requestingUser.is_admin && requestingUser.user_role !== "administrator")) {
        return res.status(403).json({ error: "Access denied. Admin privileges required." });
      }

      // 1. Get alumni records for this batch
      const { data: alumniRecords, error: alumniError } = await supabase
        .from("alumni")
        .select("user_id")
        .eq("batch", batch);

      if (alumniError) throw alumniError;
      if (!alumniRecords || alumniRecords.length === 0) {
        return res.json({ message: "No users found in this batch", count: 0 });
      }

      const userIds = alumniRecords.map(a => a.user_id);

      if (userIds.length === 0) {
        return res.json({ message: "No users found in this batch", count: 0 });
      }

      // 2. Update users who are students
      // We assume that the column name is 'user_role' and value 'student'
      const { error: updateError, count } = await supabase
        .from("users")
        .update({ user_role: "alumni" })
        .in("id", userIds)
        .eq("user_role", "student"); // Only convert students

      if (updateError) throw updateError;

      res.json({ message: "Batch conversion successful", count: count || 0 });

    } catch (error) {
      console.error("Error bulk converting users:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Bulk update role by user IDs
  app.post("/api/admin/users/bulk-update-role", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const { userIds, role } = req.body;

      if (!userId) return res.status(401).json({ error: "No user ID provided" });
      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ error: "User IDs are required" });
      }
      if (!role || !["student", "alumni"].includes(role)) {
        return res.status(400).json({ error: "Valid role is required (student or alumni)" });
      }

      // Admin check
      const { data: requestingUser } = await supabase
        .from("users")
        .select("is_admin, user_role")
        .eq("id", userId)
        .single();

      if (!requestingUser || (!requestingUser.is_admin && requestingUser.user_role !== "administrator")) {
        return res.status(403).json({ error: "Access denied. Admin privileges required." });
      }

      // Update users
      const { data, error: updateError } = await supabase
        .from("users")
        .update({ user_role: role })
        .in("id", userIds)
        .select();

      if (updateError) throw updateError;

      const count = data ? data.length : 0;

      res.json({ message: `Successfully updated ${count} users to ${role}`, count });

    } catch (error) {
      console.error("Error bulk updating roles:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Admin create new alumni account
  app.post("/api/admin/users/create", async (req, res) => {
    try {
      const adminId = req.headers["user-id"] as string;

      if (!adminId) {
        return res.status(401).json({ error: "No user ID provided" });
      }

      // Check if the requesting user is an admin
      const { data: requestingUser } = await supabase
        .from("users")
        .select("is_admin, user_role")
        .eq("id", adminId)
        .single();

      if (!requestingUser || (!requestingUser.is_admin && requestingUser.user_role !== "administrator")) {
        return res
          .status(403)
          .json({ error: "Access denied. Admin privileges required." });
      }

      // Sanitize and extract input data
      const rawData = req.body;
      const firstName = sanitizeName(rawData.firstName);
      const lastName = sanitizeName(rawData.lastName);
      const email = sanitizeEmail(rawData.email);
      const phone = rawData.phone ? sanitizeString(rawData.phone, 50) : null;
      const batch = rawData.batch ? sanitizeString(rawData.batch, 50) : null;
      const graduationYear = rawData.graduationYear ? String(rawData.graduationYear).trim() : null;
      const course = rawData.course ? sanitizeString(rawData.course, 100) : null;
      const branch = rawData.branch ? sanitizeString(rawData.branch, 100) : null;
      const rollNumber = rawData.rollNumber ? sanitizeString(rawData.rollNumber, 50) : null;
      const cgpa = rawData.cgpa ? sanitizeString(rawData.cgpa, 10) : null;
      const currentCity = rawData.currentCity ? sanitizeString(rawData.currentCity, 100) : null;
      const currentCompany = rawData.currentCompany ? sanitizeString(rawData.currentCompany, 200) : null;
      const currentRole = rawData.currentRole ? sanitizeString(rawData.currentRole, 200) : null;
      const linkedinUrl = rawData.linkedinUrl ? sanitizeString(rawData.linkedinUrl, 500) : null;
      const gender = rawData.gender ? sanitizeString(rawData.gender, 20) : null;

      // Validate required fields
      if (!firstName || !lastName || !email || !graduationYear) {
        return res.status(400).json({
          error:
            "First name, last name, email, and graduation year are required",
        });
      }

      // Validate name format and length (security: prevent injection attacks)
      if (!isValidName(firstName, 2, 50)) {
        return res.status(400).json({
          error: "First name must be 2-50 characters and contain only letters, spaces, hyphens, and apostrophes"
        });
      }
      if (!isValidName(lastName, 2, 50)) {
        return res.status(400).json({
          error: "Last name must be 2-50 characters and contain only letters, spaces, hyphens, and apostrophes"
        });
      }

      // Validate email format (security: prevent email injection)
      if (!isValidEmail(email)) {
        return res.status(400).json({ error: "Invalid email format" });
      }

      // Validate Graduation Year (2021 only and onward; max current year + 5, aligned with client)
      const currentYear = new Date().getFullYear();
      const maxGradYear = currentYear + 5;
      const gradYearNum = sanitizeInteger(graduationYear, 2021, maxGradYear);
      if (gradYearNum === null) {
        return res.status(400).json({
          error: `Graduation year must be between 2021 and ${maxGradYear}`
        });
      }

      // Validate Batch if provided (same range as graduation year)
      if (batch) {
        const batchYearMatch = batch.match(/^(\d{4})/);
        if (batchYearMatch) {
          const batchYearNum = sanitizeInteger(batchYearMatch[1], 2021, maxGradYear);
          if (batchYearNum === null) {
            return res.status(400).json({
              error: `Batch year must be between 2021 and ${maxGradYear}`
            });
          }
        }
      }

      // Validate phone number if provided (supports multiple countries)
      if (phone && phone.trim()) {
        const parsed = parsePhoneNumber(phone);

        if (!parsed.country) {
          return res.status(400).json({
            error: "Invalid country code in phone number"
          });
        }

        // Validate phone number based on country-specific rules
        const validation = validatePhoneNumber(parsed.number, parsed.country);
        if (!validation.valid) {
          return res.status(400).json({
            error: validation.error || "Invalid phone number format"
          });
        }

        // Additional validation for India (must start with 6-9)
        if (parsed.country.code === 'IN' && parsed.number) {
          if (!/^[6-9]/.test(parsed.number)) {
            return res.status(400).json({
              error: "Indian phone number must start with 6, 7, 8, or 9"
            });
          }
        }
      }

      // Validate gender if provided (security: whitelist approach)
      const validGenders = ['male', 'female', 'other', 'prefer_not_to_say'];
      if (gender && !validGenders.includes(gender.toLowerCase())) {
        return res.status(400).json({ error: "Invalid gender value" });
      }

      // Check if user already exists
      const { data: existingUser } = await supabase
        .from("users")
        .select("id, account_blocked")
        .eq("email", email)
        .single();

      if (existingUser) {
        if (!existingUser.account_blocked) {
          return res.status(409).json({
            error: "A user with this email already exists and is active",
          });
        }

        // User exists but is blocked/deleted - clean up completely
        // console.log(
        //   `Cleaning up blocked user account: ${existingUser.id} for email: ${email}`,
        // );

        // Delete associated alumni record first (foreign key constraint)
        const { error: deleteAlumniError } = await supabase
          .from("alumni")
          .delete()
          .eq("user_id", existingUser.id);

        if (deleteAlumniError) {
          console.error("Error deleting alumni record:", deleteAlumniError);
        }

        // Delete the old blocked user to allow email reuse
        const { error: deleteUserError } = await supabase
          .from("users")
          .delete()
          .eq("id", existingUser.id);

        if (deleteUserError) {
          console.error("Error deleting user record:", deleteUserError);
          return res.status(500).json({
            error:
              "Failed to clean up previous account. Please try again or contact support.",
          });
        }

        // console.log(`Successfully cleaned up old account for email: ${email}`);
      }

      // Generate temporary password
      const tempPassword = "TKS" + Math.random().toString(36).slice(-8) + "!";
      const hashedPassword = await hashPassword(tempPassword, 10);

      // Generate unique username with timestamp
      const timestamp = Date.now().toString(36); // Convert timestamp to base36 for shorter string
      const baseUsername = email
        .split("@")[0]
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      const uniqueUsername = `${baseUsername}_${timestamp}`;

      // Calculate user role based on graduation year
      // gradYearNum is already validated and parsed above
      const calculatedRole = determineUserRole(gradYearNum || 0);

      // Create user account
      const { data: newUser, error: userError } = await supabase
        .from("users")
        .insert({
          username: uniqueUsername,
          email: email,
          password: hashedPassword,
          is_admin: false,
          user_role: calculatedRole,
          account_approved: true,
        })
        .select(
          "id, username, email, is_admin, user_role, account_approved, created_at, updated_at",
        )
        .single();

      if (userError || !newUser) {
        console.error("Create user error:", userError);
        return res.status(500).json({ error: "Failed to create user account" });
      }

      // Create alumni profile (using sanitized values)
      const { error: alumniError } = await supabase.from("alumni").insert({
        user_id: newUser.id,
        first_name: firstName, // Already sanitized
        last_name: lastName, // Already sanitized
        email: email, // Already sanitized
        phone: phone || null, // Already sanitized
        graduation_year: gradYearNum, // Already validated and sanitized
        batch: batch || null, // Already sanitized
        course: course || null, // Already sanitized
        branch: branch || null, // Already sanitized
        roll_number: rollNumber || null, // Already sanitized
        cgpa: cgpa ? parseFloat(cgpa) : null, // Sanitized string, convert to number
        current_city: currentCity || null, // Already sanitized
        current_company: currentCompany || null, // Already sanitized
        current_role: currentRole || null, // Already sanitized
        linkedin_url: linkedinUrl || null, // Already sanitized
        gender: gender ? gender.toLowerCase() : null, // Already validated
        is_profile_public: true,
        is_verified: true,
        is_active: true,
      });

      if (alumniError) {
        console.error("Create alumni error:", alumniError);
        // Rollback user creation
        await supabase.from("users").delete().eq("id", newUser.id);
        return res
          .status(500)
          .json({ error: "Failed to create alumni profile" });
      }

      // Get the login URL from environment variable or construct it
      const baseUrl = process.env.BASE_URL || process.env.TKS_URL || getBaseUrl();
      const loginUrl = `${baseUrl}/login`;

      res.status(201).json({
        message: "Alumni account created successfully",
        user: newUser,
        credentials: {
          email: email,
          temporaryPassword: tempPassword,
        },
        loginUrl: loginUrl,
      });
    } catch (error) {
      console.error("Create alumni account error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update individual user field (admin only)
  app.put("/api/admin/users/:userId/update", async (req, res) => {
    try {
      const adminId = req.headers["user-id"] as string;
      const targetUserId = req.params.userId;
      const { field, value } = req.body;

      if (!adminId) {
        return res.status(401).json({ error: "No user ID provided" });
      }

      // Check if the requesting user is an admin
      const { data: requestingUser } = await supabase
        .from("users")
        .select("is_admin, user_role")
        .eq("id", adminId)
        .single();

      if (!requestingUser || (!requestingUser.is_admin && requestingUser.user_role !== "administrator")) {
        return res
          .status(403)
          .json({ error: "Access denied. Admin privileges required." });
      }

      // Validate field is allowed to be updated
      // Restricted fields: username and email cannot be changed by admin
      const allowedFields = ["user_role", "is_admin"];
      if (!allowedFields.includes(field)) {
        return res.status(400).json({
          error: field === "username" || field === "email"
            ? "Username and email cannot be changed by admin"
            : "Invalid field for update"
        });
      }

      // Update the specific field
      const { data: updatedUser, error } = await supabase
        .from("users")
        .update({
          [field]: value,
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetUserId)
        .select(
          "id, username, email, is_admin, user_role, account_approved, created_at, updated_at",
        )
        .single();

      if (error) {
        console.error("Error updating user field:", error);
        return res.status(500).json({ error: "Failed to update user field" });
      }

      // If email was updated, also update it in the alumni table
      if (field === "email") {
        const { error: alumniUpdateError } = await supabase
          .from("alumni")
          .update({
            email: value,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", targetUserId);

        if (alumniUpdateError) {
          console.error("Error updating alumni email:", alumniUpdateError);
          // Don't fail the request, but log the error
        }
      }

      res.json({
        message: "Field updated successfully",
        user: updatedUser,
      });
    } catch (error) {
      console.error("Error updating user field:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update individual alumni field (admin only)
  app.put("/api/admin/alumni/:userId/field-update", async (req, res) => {
    try {
      const adminId = req.headers["user-id"] as string;
      const targetUserId = req.params.userId;
      const { field, value } = req.body;

      // Block restricted fields from being updated
      const restrictedFields = ["first_name", "last_name", "phone", "email"];
      if (restrictedFields.includes(field)) {
        return res.status(400).json({
          error: "Name, email, and phone cannot be changed by admin"
        });
      }

      // Validate Graduation Year / Batch if they are being updated
      if ((field === "graduation_year" || field === "batch") && value) {
        const yearNum = parseInt(String(value).split('-')[0]); // Handle "2021-2025" or "2021"
        if (!isNaN(yearNum) && yearNum < 2021) {
          return res.status(400).json({ error: "Year/Batch cannot be earlier than 2021." });
        }
      }

      if (!adminId) {
        return res.status(401).json({ error: "No user ID provided" });
      }

      // Check if the requesting user is an admin
      const { data: requestingUser } = await supabase
        .from("users")
        .select("is_admin, user_role")
        .eq("id", adminId)
        .single();

      if (!requestingUser || (!requestingUser.is_admin && requestingUser.user_role !== "administrator")) {
        return res
          .status(403)
          .json({ error: "Access denied. Admin privileges required." });
      }

      // Enforce: Only one Batch Champion per Batch
      if (field === "is_batch_champion" && value === true) {
        // Get user's batch first
        const { data: currentAlumni } = await supabase
          .from("alumni")
          .select("batch")
          .eq("user_id", targetUserId)
          .single();

        if (currentAlumni && currentAlumni.batch) {
          // console.log(`Setting new Batch Champion for batch ${currentAlumni.batch}. Resetting others.`);
          // Reset other champions of this batch
          await supabase
            .from("alumni")
            .update({ is_batch_champion: false })
            .eq("batch", currentAlumni.batch);
        }
      }

      // Update only the specific field in alumni table
      const { data: updatedAlumni, error } = await supabase
        .from("alumni")
        .update({
          [field]: value,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", targetUserId)
        .select()
        .single();

      if (error) {
        console.error("Error updating alumni field:", error);
        return res.status(500).json({ error: "Failed to update alumni field" });
      }

      // If email was updated, also update it in the users table
      if (field === "email") {
        const { error: userUpdateError } = await supabase
          .from("users")
          .update({
            email: value,
            updated_at: new Date().toISOString(),
          })
          .eq("id", targetUserId);

        if (userUpdateError) {
          console.error("Error updating user email:", userUpdateError);
          // Don't fail the request, but log the error
        }
      }

      // If graduation_year was updated, recalculate user_role
      if (field === "graduation_year") {
        const gradYear = parseInt(String(value));
        if (!isNaN(gradYear)) {
          const currentYear = new Date().getFullYear();
          // Check if current role is 'student' or 'alumni' (don't override admin/faculty)
          const { data: currentUser } = await supabase
            .from("users")
            .select("user_role")
            .eq("id", targetUserId)
            .single();

          if (currentUser && (currentUser.user_role === 'student' || currentUser.user_role === 'alumni')) {
            const newRole = gradYear >= currentYear ? "student" : "alumni";
            if (newRole !== currentUser.user_role) {
              // console.log(`Auto-updating user role for ${targetUserId} to ${newRole}`);
              await supabase.from("users").update({ user_role: newRole }).eq("id", targetUserId);
            }
          }
        }
      }

      res.json({
        message: "Field updated successfully",
        alumni: updatedAlumni,
      });
    } catch (error) {
      console.error("Error updating alumni field:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Toggle batch champion status (admin only)
  app.put("/api/admin/users/:userId/champion", async (req, res) => {
    try {
      const adminId = req.headers["user-id"] as string;
      const targetUserId = req.params.userId;
      const { isBatchChampion } = req.body;

      if (!adminId) {
        return res.status(401).json({ error: "No user ID provided" });
      }

      // Check if the requesting user is an admin
      const { data: requestingUser } = await supabase
        .from("users")
        .select("is_admin, user_role")
        .eq("id", adminId)
        .single();

      if (!requestingUser || (!requestingUser.is_admin && requestingUser.user_role !== "administrator")) {
        return res
          .status(403)
          .json({ error: "Access denied. Admin privileges required." });
      }

      // Get target alumni info to know their batch
      const { data: alumniInfo } = await supabase
        .from("alumni")
        .select("batch")
        .eq("user_id", targetUserId)
        .single();

      if (!alumniInfo || !alumniInfo.batch) {
        return res.status(400).json({ error: "Alumni or batch information not found for this user" });
      }

      // If making champion, unset others in the same batch
      if (isBatchChampion) {
        await supabase
          .from("alumni")
          .update({ is_batch_champion: false })
          .eq("batch", alumniInfo.batch);
      }

      // Update the specific alumni
      const { data: updatedAlumni, error } = await supabase
        .from("alumni")
        .update({
          is_batch_champion: isBatchChampion,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", targetUserId)
        .select()
        .single();

      if (error) {
        console.error("Error updating champion status:", error);
        return res.status(500).json({ error: "Failed to update champion status" });
      }

      res.json({
        message: "Champion status updated successfully",
        alumni: updatedAlumni,
      });
    } catch (error) {
      console.error("Error updating champion status:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Toggle user account approval status (admin only)
  app.put("/api/admin/users/:userId/approval", async (req, res) => {
    try {
      const adminId = req.headers["user-id"] as string;
      const targetUserId = req.params.userId;
      const { accountApproved } = req.body;

      if (!adminId) {
        return res.status(401).json({ error: "No user ID provided" });
      }

      // Check if the requesting user is an admin
      const { data: requestingUser } = await supabase
        .from("users")
        .select("is_admin, user_role")
        .eq("id", adminId)
        .single();

      if (!requestingUser || (!requestingUser.is_admin && requestingUser.user_role !== "administrator")) {
        return res
          .status(403)
          .json({ error: "Access denied. Admin privileges required." });
      }

      // Update the account_approved status
      const { data: updatedUser, error } = await supabase
        .from("users")
        .update({
          account_approved: accountApproved,
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetUserId)
        .select(
          "id, username, email, is_admin, user_role, account_approved, account_blocked, created_at, updated_at",
        )
        .single();

      if (error) {
        console.error("Error updating user approval status:", error);
        return res
          .status(500)
          .json({ error: "Failed to update approval status" });
      }

      res.json({
        message: "Approval status updated successfully",
        user: updatedUser,
      });
    } catch (error) {
      console.error("Error updating user approval status:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Toggle user account blocked status (admin only)
  app.put("/api/admin/users/:userId/block", async (req, res) => {
    try {
      const adminId = req.headers["user-id"] as string;
      const targetUserId = req.params.userId;
      const { accountBlocked } = req.body;

      if (!adminId) {
        return res.status(401).json({ error: "No user ID provided" });
      }

      // Check if the requesting user is an admin
      const { data: requestingUser } = await supabase
        .from("users")
        .select("is_admin, user_role")
        .eq("id", adminId)
        .single();

      if (!requestingUser || (!requestingUser.is_admin && requestingUser.user_role !== "administrator")) {
        return res
          .status(403)
          .json({ error: "Access denied. Admin privileges required." });
      }

      // Prevent admin from blocking themselves
      if (adminId === targetUserId) {
        return res
          .status(400)
          .json({ error: "You cannot block your own account" });
      }

      // Update the account_blocked status
      const { data: updatedUser, error } = await supabase
        .from("users")
        .update({
          account_blocked: accountBlocked,
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetUserId)
        .select(
          "id, username, email, is_admin, user_role, account_approved, account_blocked, created_at, updated_at",
        )
        .single();

      if (error) {
        console.error("Error updating user block status:", error);
        return res.status(500).json({ error: "Failed to update block status" });
      }

      if (!updatedUser) {
        return res.status(404).json({ error: "User not found after update" });
      }

      res.json({
        message: accountBlocked
          ? "Account blocked successfully"
          : "Account unblocked successfully",
        user: updatedUser,
      });
    } catch (error) {
      console.error("Error updating user block status:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== FEED POSTSROUTES ====================

  // ==================== ADMIN POST ROUTES ====================

  // Get pending posts for approval
  app.get("/api/admin/posts/pending", async (req, res) => {
    try {
      const adminId = req.headers["user-id"] as string;

      if (!adminId) {
        return res.status(401).json({ error: "No user ID provided" });
      }

      // Verify admin
      const { data: user } = await supabase
        .from("users")
        .select("is_admin, user_role")
        .eq("id", adminId)
        .single();

      if (!user || (!user.is_admin && user.user_role !== "administrator")) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const { data: posts, error } = await supabase
        .from("feed_posts")
        .select(`
          *,
          author:users!author_id(id, username, email, is_admin, user_role)
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch alumni data
      if (posts && posts.length > 0) {
        const authorIds = posts.map((p) => p.author_id);
        const { data: alumniData } = await supabase
          .from("alumni")
          .select("user_id, profile_picture, first_name, last_name, gender, batch, current_company, current_role, phone")
          .in("user_id", authorIds);

        if (alumniData) {
          const alumniMap = new Map(alumniData.map(a => [a.user_id, a]));
          posts.forEach((post: any) => {
            post.author_alumni = alumniMap.get(post.author_id) || null;
          });
        }
      }

      res.json({ posts: posts || [] });
    } catch (error) {
      console.error("Get pending posts error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Approve a post
  app.post("/api/admin/posts/:id/approve", async (req, res) => {
    try {
      const adminId = req.headers["user-id"] as string;
      const postId = req.params.id;

      const { data: user } = await supabase.from("users").select("is_admin, user_role").eq("id", adminId).single();
      if (!user || (!user.is_admin && user.user_role !== "administrator")) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const { error } = await supabase
        .from("feed_posts")
        .update({ status: "approved", updated_at: new Date().toISOString() })
        .eq("id", postId);

      if (error) throw error;

      // Emit notification to author
      const { data: post } = await supabase.from("feed_posts").select("author_id").eq("id", postId).single();
      if (post) {
        await createAndEmitNotification({
          userId: post.author_id,
          type: NotificationType.POST_APPROVED,
          title: "Post Approved",
          content: "Your post has been approved and is now live.",
          relatedId: postId,
          redirectUrl: NotificationRedirectUrl.FEED,
          actorId: adminId
        });

        // Gamification Points for Feed Post (upon admin approval)
        incrementScore(post.author_id, "thread_score", "feed_create", 1).catch(err => 
          console.error("Gamification feed create error (admin approve):", err)
        );
      }

      res.json({ message: "Post approved" });
    } catch (e) {
      console.error("Approve error", e);
      res.status(500).json({ error: "Failed" });
    }
  });

  // Reject a post
  app.post("/api/admin/posts/:id/reject", async (req, res) => {
    try {
      const adminId = req.headers["user-id"] as string;
      const postId = req.params.id;

      const { data: user } = await supabase.from("users").select("is_admin, user_role").eq("id", adminId).single();
      if (!user || (!user.is_admin && user.user_role !== "administrator")) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const { error } = await supabase
        .from("feed_posts")
        .update({ status: "rejected", updated_at: new Date().toISOString() })
        .eq("id", postId);

      if (error) throw error;

      // Emit notification to author
      const { data: post } = await supabase.from("feed_posts").select("author_id").eq("id", postId).single();
      if (post) {
        await createAndEmitNotification({
          userId: post.author_id,
          type: NotificationType.POST_REJECTED,
          title: "Post Rejected",
          content: "Your post has been rejected by the admin.",
          relatedId: postId,
          redirectUrl: NotificationRedirectUrl.FEED,
          actorId: adminId
        });
      }

      res.json({ message: "Post rejected" });
    } catch (e) {
      console.error("Reject error", e);
      res.status(500).json({ error: "Failed" });
    }
  });

  // Get single post by ID (for sharing)
  app.get("/api/posts/:postId/single", async (req, res) => {
    try {
      let { postId } = req.params;
      const userId = req.headers["user-id"] as string;

      // Clean the postId - extract only UUID pattern (8-4-4-4-12 format)
      const uuidPattern =
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
      const match = postId.match(uuidPattern);

      if (!match) {
        console.log("Invalid post ID format:", postId);
        return res.status(400).json({ error: "Invalid post ID format" });
      }

      postId = match[0]; // Use the extracted UUID
      console.log("Fetching post with ID:", postId);

      // First check if post exists at all
      const { data: post, error } = await supabase
        .from("feed_posts")
        .select(
          `
          *,
          author:users!author_id(id, username, email, is_admin, user_role)
        `,
        )
        .eq("id", postId)
        .single();

      if (error || !post) {
        console.log("Post not found:", postId, error);
        return res.status(404).json({ error: "Post not found" });
      }

      // Check if post is active and approved
      if (!post.is_active) {
        console.log("Post is not active:", postId);
        return res.status(404).json({ error: "Post not found" });
      }

      if (post.status !== "approved") {
        console.log("Post is not approved yet:", postId);
        return res.status(404).json({ error: "Post not found" });
      }

      // Fetch alumni data for author
      const { data: alumniData } = await supabase
        .from("alumni")
        .select("user_id, profile_picture, first_name, last_name, gender")
        .eq("user_id", post.author_id)
        .single();

      if (alumniData) {
        (post as any).author_profile_picture =
          alumniData.profile_picture || null;
        (post as any).author_first_name = alumniData.first_name || null;
        (post as any).author_last_name = alumniData.last_name || null;
        (post as any).author_gender = alumniData.gender || null;
      }

      // Check if user liked this post
      let isLikedByUser = false;
      if (userId) {
        const { data: like } = await supabase
          .from("post_likes")
          .select("id")
          .eq("post_id", postId)
          .eq("user_id", userId)
          .single();

        isLikedByUser = !!like;
      }

      res.json({
        post: {
          ...post,
          isLikedByUser,
        },
      });
    } catch (error) {
      console.error("Get single post error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get posts with pagination and user's like status
  app.get("/api/posts", async (req, res) => {
    try {
      const { limit = 10, offset = 0 } = req.query;
      const userId = req.headers["user-id"] as string;
      const search = req.query.search as string;

      let query = supabase
        .from("feed_posts")
        .select(
          `
          *,
          author:users!author_id(id, username, email, is_admin, user_role)
        `,
        )
        .eq("is_active", true)
        .eq("status", "approved");

      if (search) {
        const sanitizedSearch = (search as string).replace(/,/g, " ");
        // Search in post content AND author information
        // Note: We'll filter by author names after fetching since Supabase doesn't support
        // nested OR queries across joined tables easily
        query = query.or(`content.ilike.%${sanitizedSearch}%,author.username.ilike.%${sanitizedSearch}%`);
      }

      // eslint-disable-next-line prefer-const -- posts is reassigned when filtering by search
      let { data: posts, error } = await query
        .order("created_at", { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      // Fetch alumni profile data for all authors (profile picture, first name, last name, gender)
      if (posts && posts.length > 0) {
        const authorIds = posts.map((p) => p.author_id);
        const { data: alumniData } = await supabase
          .from("alumni")
          .select("user_id, profile_picture, first_name, last_name, gender")
          .in("user_id", authorIds);

        if (alumniData) {
          const alumniMap = new Map(
            alumniData.map((a) => [
              a.user_id,
              {
                profile_picture: a.profile_picture,
                first_name: a.first_name,
                last_name: a.last_name,
                gender: a.gender,
              },
            ]),
          );

          posts.forEach((post) => {
            const alumniInfo = alumniMap.get(post.author_id);
            if (alumniInfo) {
              (post as any).author_profile_picture =
                alumniInfo.profile_picture || null;
              (post as any).author_first_name = alumniInfo.first_name || null;
              (post as any).author_last_name = alumniInfo.last_name || null;
              (post as any).author_gender = alumniInfo.gender || null;
            } else {
              (post as any).author_profile_picture = null;
              (post as any).author_first_name = null;
              (post as any).author_last_name = null;
              (post as any).author_gender = null;
            }
          });

          // Additional filtering by author names if search term provided
          if (search) {
            const searchLower = (search as string).toLowerCase();
            posts = posts.filter((post: any) => {
              const firstName = post.author_first_name?.toLowerCase() || '';
              const lastName = post.author_last_name?.toLowerCase() || '';
              const fullName = `${firstName} ${lastName}`.trim();
              const content = post.content?.toLowerCase() || '';
              const username = post.author?.username?.toLowerCase() || '';

              return content.includes(searchLower) ||
                username.includes(searchLower) ||
                firstName.includes(searchLower) ||
                lastName.includes(searchLower) ||
                fullName.includes(searchLower);
            });
          }
        }
      }

      if (error) {
        console.error("Get posts error:", error);
        return res.status(500).json({ error: "Failed to fetch posts" });
      }

      // Get user's likes for these posts
      let userLikes: Set<string> = new Set();
      if (userId && posts) {
        const postIds = posts.map((p) => p.id);
        const { data: likes } = await supabase
          .from("post_likes")
          .select("post_id")
          .eq("user_id", userId)
          .in("post_id", postIds);

        if (likes) {
          userLikes = new Set(likes.map((l) => l.post_id));
        }
      }

      // Add isLikedByUser flag to each post
      const postsWithLikeStatus = posts?.map((post) => ({
        ...post,
        isLikedByUser: userLikes.has(post.id),
      }));

      res.json({ posts: postsWithLikeStatus || [] });
    } catch (error) {
      console.error("Get posts error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create a new post
  app.post("/api/posts", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;

      if (!userId) {
        return res.status(401).json({ error: "No user ID provided" });
      }

      // Verify user exists
      const { data: user, error: userError } = await supabase
        .from("users")
        .select("id, username, email")
        .eq("id", userId)
        .single();

      if (userError || !user) {
        return res.status(401).json({ error: "Invalid user" });
      }

      const { content, imageUrl, postType } = req.body;

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: "Content is required" });
      }

      // Check if user is admin
      const { data: userData } = await supabase
        .from("users")
        .select("is_admin, user_role")
        .eq("id", userId)
        .single();

      const isAutoApproved = userData?.is_admin || userData?.user_role === "administrator";

      const { data: post, error } = await supabase
        .from("feed_posts")
        .insert({
          author_id: userId,
          content: content.trim(),
          image_url: imageUrl,
          post_type: postType || "general",
          likes_count: 0,
          comments_count: 0,
          shares_count: 0,
          is_active: true,
          status: isAutoApproved ? "approved" : "pending",
        })
        .select("*")
        .single();

      if (error) {
        console.error("Create post error:", error);
        return res
          .status(500)
          .json({ error: "Failed to create post", details: error.message });
      }

      // Fetch alumni profile data for the author
      const { data: alumniData } = await supabase
        .from("alumni")
        .select("profile_picture, first_name, last_name, gender")
        .eq("user_id", userId)
        .single();

      const postWithAuthor = {
        ...post,
        author: user,
        author_profile_picture: alumniData?.profile_picture || null,
        author_first_name: alumniData?.first_name || null,
        author_last_name: alumniData?.last_name || null,
        author_gender: alumniData?.gender || null,
        isLikedByUser: false,
      };

      // Emit real-time update for new post (only if approved)
      if (post.status === "approved") {
        const io = (global as any).io;
        if (io) {
          io.emit("new_post", {
            post: postWithAuthor,
            userId,
          });
        }
        
        // Gamification Points for Feed Post
        incrementScore(userId, "thread_score", "feed_create", 1).catch(err => 
          console.error("Gamification feed create error:", err)
        );
      }

      // Notify admins when a user submits a post for approval (with user details for context)
      if (post.status === "pending") {
        try {
          const authorName = [alumniData?.first_name, alumniData?.last_name].filter(Boolean).join(" ") || user?.username || "A user";
          const authorEmail = user?.email ? ` (${user.email})` : "";
          const contentPreview = post.content && post.content.trim()
            ? ` — "${String(post.content).trim().slice(0, 60)}${post.content.length > 60 ? "…" : ""}"`
            : "";
          const notificationContent = `${authorName}${authorEmail} submitted a post for approval${contentPreview}. Tap to review and approve.`;
          const { data: admins } = await supabase
            .from("users")
            .select("id")
            .or("is_admin.eq.true,user_role.eq.administrator");

          if (admins && admins.length > 0) {
            for (const admin of admins) {
              try {
                await createAndEmitNotification({
                  userId: admin.id,
                  type: NotificationType.POST_PENDING_APPROVAL,
                  title: "Approve feed post",
                  content: notificationContent,
                  relatedId: post.id,
                  redirectUrl: NotificationRedirectUrl.ADMIN_FEED,
                  actorId: userId,
                });
              } catch (notifErr) {
                console.error("Post pending approval: failed to notify admin", admin.id, notifErr);
              }
            }
          }
        } catch (notifyError) {
          console.error("Post pending approval: admin notification error", notifyError);
        }
      }

      // Return post with author information
      res.status(201).json({
        post: postWithAuthor,
      });
    } catch (error) {
      console.error("Create post error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update a post
  app.put("/api/posts/:id", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const postId = req.params.id;

      if (!userId) {
        return res.status(401).json({ error: "No user ID provided" });
      }

      const { content, imageUrl } = req.body;

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: "Content is required" });
      }

      // Verify ownership
      const { data: existingPost } = await supabase
        .from("feed_posts")
        .select("author_id")
        .eq("id", postId)
        .single();

      if (!existingPost || existingPost.author_id !== userId) {
        return res
          .status(403)
          .json({ error: "Not authorized to edit this post" });
      }

      const { data: post, error } = await supabase
        .from("feed_posts")
        .update({
          content: content.trim(),
          image_url: imageUrl || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", postId)
        .select("*")
        .single();

      if (error) {
        console.error("Update post error:", error);
        return res.status(500).json({ error: "Failed to update post" });
      }

      // Emit real-time update
      const io = (global as any).io;
      if (io) {
        io.emit("post_updated", {
          postId,
          content: content.trim(),
          userId,
        });
      }

      // Fetch user and alumni data separately
      const { data: user } = await supabase
        .from("users")
        .select("id, username, email")
        .eq("id", post.author_id)
        .single();

      const { data: alumniData } = await supabase
        .from("alumni")
        .select("profile_picture, first_name, last_name, gender")
        .eq("user_id", post.author_id)
        .single();

      res.json({
        post: {
          ...post,
          author: user,
          author_profile_picture: alumniData?.profile_picture || null,
          author_first_name: alumniData?.first_name || null,
          author_last_name: alumniData?.last_name || null,
          author_gender: alumniData?.gender || null,
        },
      });
    } catch (error) {
      console.error("Update post error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete a post
  app.delete("/api/posts/:id", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const postId = req.params.id;

      if (!userId) {
        return res.status(401).json({ error: "No user ID provided" });
      }

      // Verify ownership
      const { data: existingPost } = await supabase
        .from("feed_posts")
        .select("author_id")
        .eq("id", postId)
        .single();

      if (!existingPost || existingPost.author_id !== userId) {
        return res
          .status(403)
          .json({ error: "Not authorized to delete this post" });
      }

      const { error } = await supabase
        .from("feed_posts")
        .delete()
        .eq("id", postId);

      if (error) {
        console.error("Delete post error:", error);
        return res.status(500).json({ error: "Failed to delete post" });
      }

      // Gamification Deduction: Post deleted
      incrementScore(userId, "thread_score", "feed_create", -1).catch(err => 
        console.error("Gamification post delete error:", err)
      );

      res.json({ message: "Post deleted successfully" });
    } catch (error) {
      console.error("Delete post error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== LIKE ROUTES ====================

  // Toggle like on a post
  app.post("/api/posts/:id/like", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const postId = req.params.id;

      if (!userId) {
        return res.status(401).json({ error: "No user ID provided" });
      }

      // Check if already liked
      const { data: existingLike } = await supabase
        .from("post_likes")
        .select("id")
        .eq("post_id", postId)
        .eq("user_id", userId)
        .single();

      if (existingLike) {
        // Unlike: remove like and decrement count
        const { error: deleteLikeError } = await supabase
          .from("post_likes")
          .delete()
          .eq("id", existingLike.id);

        if (deleteLikeError) {
          console.error("Delete like error:", deleteLikeError);
          return res.status(500).json({ error: "Failed to unlike post" });
        }

        // Decrement likes count
        const { data: post } = await supabase
          .from("feed_posts")
          .select("likes_count")
          .eq("id", postId)
          .single();

        if (post) {
          await supabase
            .from("feed_posts")
            .update({ likes_count: Math.max(0, post.likes_count - 1) })
            .eq("id", postId);

          // Emit real-time update
          const io = (global as any).io;
          if (io) {
            io.emit("post_like", {
              postId,
              likesCount: Math.max(0, post.likes_count - 1),
              isLiked: false,
              userId,
            });
          }
        }

        return res.json({ message: "Post unliked", isLiked: false });
      } else {
        // Like: add like and increment count
        const { error: insertLikeError } = await supabase
          .from("post_likes")
          .insert({
            post_id: postId,
            user_id: userId,
          });

        if (insertLikeError) {
          console.error("Insert like error:", insertLikeError);
          return res.status(500).json({ error: "Failed to like post" });
        }

        // Increment likes count and get post author
        const { data: post } = await supabase
          .from("feed_posts")
          .select("likes_count, author_id")
          .eq("id", postId)
          .single();

        if (post) {
          await supabase
            .from("feed_posts")
            .update({ likes_count: post.likes_count + 1 })
            .eq("id", postId);

          // Emit real-time update
          const io = (global as any).io;
          if (io) {
            io.emit("post_like", {
              postId,
              likesCount: post.likes_count + 1,
              isLiked: true,
              userId,
            });
          }

          // Only notify if the liker is not the author
          if (post.author_id !== userId) {
            // Get liker details
            const { data: likerAlumni } = await supabase
              .from("alumni")
              .select("first_name, last_name")
              .eq("user_id", userId)
              .single();

            const likerName = likerAlumni
              ? `${likerAlumni.first_name} ${likerAlumni.last_name}`
              : "Someone";

            // Create notification for post author using new helper
            await createAndEmitNotification({
              userId: post.author_id,
              type: NotificationType.POST_LIKE,
              title: "Post Liked",
              content: `${likerName} liked your post`,
              relatedId: postId,
              redirectUrl: NotificationRedirectUrl.FEED,
              actorId: userId,
            });
          }
        }

        return res.json({ message: "Post liked", isLiked: true });
      }
    } catch (error) {
      console.error("Like post error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== COMMENT ROUTES ====================

  // Get comments for a post
  app.get("/api/posts/:postId/comments", async (req, res) => {
    try {
      const { postId } = req.params;
      const { limit = 20, offset = 0 } = req.query;

      const { data: comments, error } = await supabase
        .from("post_comments")
        .select(
          `
          id,
          content,
          created_at,
          replies_count,
          user:users!user_id(id, username, email)
        `,
        )
        .eq("post_id", postId)
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      if (error) throw error;

      // Enrich comments with alumni profile data
      const enrichedComments = await Promise.all(
        (comments || []).map(async (comment: any) => {
          const { data: alumni } = await supabase
            .from("alumni")
            .select("first_name, last_name, profile_picture, gender")
            .eq("user_id", comment.user.id)
            .single();

          return {
            ...comment,
            user_first_name: alumni?.first_name,
            user_last_name: alumni?.last_name,
            user_profile_picture: alumni?.profile_picture,
            user_gender: alumni?.gender,
          };
        }),
      );

      res.json({ comments: enrichedComments });
    } catch (error) {
      console.error("Get comments error:", error);
      res.status(500).json({ error: "Failed to fetch comments" });
    }
  });

  // Create a comment
  app.post("/api/posts/:id/comments", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const postId = req.params.id;

      if (!userId) {
        return res.status(401).json({ error: "No user ID provided" });
      }

      const { content } = req.body;

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: "Comment content is required" });
      }

      // Insert comment
      const { data: comment, error: commentError } = await supabase
        .from("post_comments")
        .insert({
          post_id: postId,
          user_id: userId,
          content: content.trim(),
          is_active: true,
        })
        .select(
          `
          *,
          user:users!user_id(id, username, email)
        `,
        )
        .single();

      if (commentError) {
        console.error("Create comment error:", commentError);
        return res.status(500).json({ error: "Failed to create comment" });
      }

      // Fetch alumni profile data for the commenter
      const { data: alumniData } = await supabase
        .from("alumni")
        .select("profile_picture, first_name, last_name, gender")
        .eq("user_id", userId)
        .single();

      const enrichedComment = {
        ...comment,
        user_first_name: alumniData?.first_name || null,
        user_last_name: alumniData?.last_name || null,
        user_profile_picture: alumniData?.profile_picture || null,
        user_gender: alumniData?.gender || null,
      };

      // Increment comments count and get post author
      const { data: post } = await supabase
        .from("feed_posts")
        .select("comments_count, author_id")
        .eq("id", postId)
        .single();

      if (post) {
        await supabase
          .from("feed_posts")
          .update({ comments_count: post.comments_count + 1 })
          .eq("id", postId);

        // Only notify if the commenter is not the author
        if (post.author_id !== userId) {
          // Get commenter details
          const { data: commenterAlumni } = await supabase
            .from("alumni")
            .select("first_name, last_name")
            .eq("user_id", userId)
            .single();

          const commenterName = commenterAlumni
            ? `${commenterAlumni.first_name} ${commenterAlumni.last_name}`
            : "Someone";

          // Create notification for post author using new helper
          await createAndEmitNotification({
            userId: post.author_id,
            type: NotificationType.POST_COMMENT,
            title: "New Comment",
            content: `${commenterName} commented on your post`,
            relatedId: postId,
            redirectUrl: NotificationRedirectUrl.FEED,
            actorId: userId,
          });
        }

        // Emit real-time update
        const io = (global as any).io;
        if (io) {
          io.emit("post_comment", {
            postId,
            commentId: comment.id,
            comment,
            userId,
          });
        }
      }

      // Gamification Points for Feed Post Comment
      incrementScore(userId, "thread_score", "post_reply", 1).catch(err => 
        console.error("Gamification post reply error:", err)
      );

      res.status(201).json({ comment: enrichedComment });
    } catch (error) {
      console.error("Create comment error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete a comment
  app.delete("/api/posts/:postId/comments/:commentId", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const { postId, commentId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: "No user ID provided" });
      }

      // Verify ownership
      const { data: existingComment } = await supabase
        .from("post_comments")
        .select("user_id")
        .eq("id", commentId)
        .single();

      if (!existingComment || existingComment.user_id !== userId) {
        return res
          .status(403)
          .json({ error: "Not authorized to delete this comment" });
      }

      const { error } = await supabase
        .from("post_comments")
        .delete()
        .eq("id", commentId);

      if (error) {
        console.error("Delete comment error:", error);
        return res.status(500).json({ error: "Failed to delete comment" });
      }

      // Decrement comments count
      const { data: post } = await supabase
        .from("feed_posts")
        .select("comments_count")
        .eq("id", postId)
        .single();

      if (post) {
        await supabase
          .from("feed_posts")
          .update({ comments_count: Math.max(0, post.comments_count - 1) })
          .eq("id", postId);
      }

      // Gamification Deduction: Comment deleted
      incrementScore(userId, "thread_score", "post_reply", -1).catch(err => 
        console.error("Gamification comment delete error:", err)
      );

      res.json({ message: "Comment deleted successfully" });
    } catch (error) {
      console.error("Delete comment error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== COMMENT REPLY ROUTES ====================

  // Get replies for a comment
  app.get("/api/comments/:commentId/replies", async (req, res) => {
    try {
      const { commentId } = req.params;
      const { limit = 20, offset = 0 } = req.query;

      const { data: replies, error } = await supabase
        .from("post_comment_replies")
        .select(
          `
          id,
          content,
          created_at,
          user:users!user_id(id, username, email)
        `,
        )
        .eq("comment_id", commentId)
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      if (error) throw error;

      // Enrich replies with alumni profile data
      const enrichedReplies = await Promise.all(
        (replies || []).map(async (reply: any) => {
          const { data: alumni } = await supabase
            .from("alumni")
            .select("first_name, last_name, profile_picture, gender")
            .eq("user_id", reply.user.id)
            .single();

          return {
            ...reply,
            user_first_name: alumni?.first_name,
            user_last_name: alumni?.last_name,
            user_profile_picture: alumni?.profile_picture,
            user_gender: alumni?.gender,
          };
        }),
      );

      res.json({ replies: enrichedReplies });
    } catch (error) {
      console.error("Get comment replies error:", error);
      res.status(500).json({ error: "Failed to fetch replies" });
    }
  });

  // Create a reply to a comment
  app.post("/api/comments/:commentId/replies", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const { commentId } = req.params;

      // console.log("Reply request received:", { userId, commentId });

      if (!userId) {
        console.error("No user ID provided");
        return res.status(401).json({ error: "No user ID provided" });
      }

      const { content } = req.body;

      if (!content || content.trim().length === 0) {
        console.error("Reply content is empty");
        return res.status(400).json({ error: "Reply content is required" });
      }

      // console.log("Creating reply with content:", content.trim());

      // Insert reply
      const { data: reply, error: replyError } = await supabase
        .from("post_comment_replies")
        .insert({
          comment_id: commentId,
          user_id: userId,
          content: content.trim(),
          is_active: true,
        })
        .select(
          `
          *,
          user:users!user_id(id, username, email)
        `,
        )
        .single();

      if (replyError) {
        console.error("Create reply error:", replyError);
        return res.status(500).json({
          error: "Failed to create reply",
          details: replyError.message,
        });
      }

      // Fetch alumni profile data for the replier
      const { data: alumniData } = await supabase
        .from("alumni")
        .select("profile_picture, first_name, last_name, gender")
        .eq("user_id", userId)
        .single();

      const enrichedReply = {
        ...reply,
        user_first_name: alumniData?.first_name || null,
        user_last_name: alumniData?.last_name || null,
        user_profile_picture: alumniData?.profile_picture || null,
        user_gender: alumniData?.gender || null,
      };

      // console.log("Reply created successfully:", reply.id);

      // Increment replies count on comment
      const { data: comment } = await supabase
        .from("post_comments")
        .select("replies_count, user_id, post_id")
        .eq("id", commentId)
        .single();

      if (comment) {
        await supabase
          .from("post_comments")
          .update({ replies_count: (comment.replies_count || 0) + 1 })
          .eq("id", commentId);

        // Notify comment author if different from reply author
        if (comment.user_id !== userId) {
          const { data: replierAlumni } = await supabase
            .from("alumni")
            .select("first_name, last_name")
            .eq("user_id", userId)
            .single();

          const replierName = replierAlumni
            ? `${replierAlumni.first_name} ${replierAlumni.last_name}`
            : "Someone";

          // Create notification using new helper
          await createAndEmitNotification({
            userId: comment.user_id,
            type: NotificationType.COMMENT_REPLY,
            title: "New Reply",
            content: `${replierName} replied to your comment`,
            relatedId: comment.post_id,
            redirectUrl: NotificationRedirectUrl.FEED,
            actorId: userId,
          });
        }
      }

      // Gamification: Award points for replying to a comment
      incrementScore(userId, "connection_score", "comment_reply", 1).catch(err => 
        console.error("Gamification comment reply error:", err)
      );

      res.status(201).json({ reply: enrichedReply });
    } catch (error) {
      console.error("Create reply error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete a comment reply
  app.delete("/api/comments/:commentId/replies/:replyId", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const { commentId, replyId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: "No user ID provided" });
      }

      // Verify ownership
      const { data: existingReply } = await supabase
        .from("post_comment_replies")
        .select("user_id")
        .eq("id", replyId)
        .single();

      if (!existingReply || existingReply.user_id !== userId) {
        return res
          .status(403)
          .json({ error: "Not authorized to delete this reply" });
      }

      const { error } = await supabase
        .from("post_comment_replies")
        .delete()
        .eq("id", replyId);

      if (error) {
        console.error("Delete reply error:", error);
        return res.status(500).json({ error: "Failed to delete reply" });
      }

      // Decrement replies count
      const { data: comment } = await supabase
        .from("post_comments")
        .select("replies_count")
        .eq("id", commentId)
        .single();

      if (comment) {
        await supabase
          .from("post_comments")
          .update({
            replies_count: Math.max(0, (comment.replies_count || 1) - 1),
          })
          .eq("id", commentId);
      }

      res.json({ message: "Reply deleted successfully" });
    } catch (error) {
      console.error("Delete reply error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Track profile views for analytics
  app.post("/api/profile/view/:profileId", async (req, res) => {
    try {
      const viewerId = req.headers["user-id"] as string;
      const { profileId } = req.params;

      if (!viewerId || viewerId === profileId) {
        return res.json({ success: false });
      }

      // Record the view (you can create a profile_views table)
      const { error } = await supabase.from("profile_views").insert({
        profile_user_id: profileId,
        viewer_user_id: viewerId,
        viewed_at: new Date().toISOString(),
      });

      res.json({ success: !error });
    } catch (error) {
      console.error("Profile view tracking error:", error);
      res.json({ success: false });
    }
  });

  // Get profile view statistics
  app.get("/api/profile/analytics/:userId", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const { userId: profileUserId } = req.params;

      if (userId !== profileUserId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const { data: views, error } = await supabase
        .from("profile_views")
        .select("*")
        .eq("profile_user_id", profileUserId)
        .order("viewed_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      // Calculate statistics
      const totalViews = views?.length || 0;
      const uniqueViewers = new Set(views?.map((v) => v.viewer_user_id)).size;
      const last7Days =
        views?.filter(
          (v) =>
            new Date(v.viewed_at) >
            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        ).length || 0;

      res.json({
        totalViews,
        uniqueViewers,
        last7Days,
        recentViews: views?.slice(0, 10),
      });
    } catch (error) {
      console.error("Profile analytics error:", error);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  // ==================== JOBSROUTES ====================


  // Get all jobs with pagination and filters
  app.get("/api/jobs", async (req, res) => {
    try {
      const {
        limit = 20,
        offset = 0,
        location,
        jobType,
        industry,
        workMode,
        search,
      } = req.query;

      let query = supabase
        .from("jobs")
        .select(
          `
          *,
          posted_by_user:users!posted_by(id, username, email, alumni(first_name, last_name))
        `,
        )
        .eq("is_active", true);

      // Apply location filter - case insensitive partial match
      if (location && String(location).trim()) {
        const loc = String(location).trim();
        query = query.ilike("location", `%${loc}%`);
      }

      // Apply job type filter - exact match, case sensitive
      if (jobType && String(jobType).trim()) {
        query = query.eq("job_type", String(jobType).trim());
      }

      // Apply industry filter - case insensitive partial match
      if (industry && String(industry).trim()) {
        query = query.ilike("industry", `%${String(industry).trim()}%`);
      }

      // Apply work mode filter - exact match
      if (workMode && String(workMode).trim()) {
        query = query.eq("work_mode", String(workMode).trim());
      }

      // Apply search filter - searches in title, company, and description
      if (search && String(search).trim()) {
        const searchTerm = String(search).trim();
        const sanitizedSearchTerm = searchTerm.replace(/,/g, " ");
        query = query.or(
          `title.ilike.%${sanitizedSearchTerm}%,company.ilike.%${sanitizedSearchTerm}%,description.ilike.%${sanitizedSearchTerm}%,skills.ilike.%${sanitizedSearchTerm}%`,
        );
      }

      const { data: jobs, error } = await query
        .order("created_at", { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      if (error) {
        console.error("Get jobs error:", error);
        return res
          .status(500)
          .json({ error: "Failed to fetch jobs", details: error.message });
      }

      res.json({ jobs: jobs || [] });
    } catch (error) {
      console.error("Get jobs error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get distinct filter options for jobs (dynamic based on existing data)
  app.get("/api/jobs/filters", async (req, res) => {
    try {
      const { data: jobs, error } = await supabase
        .from("jobs")
        .select("location, job_type, industry, work_mode")
        .eq("is_active", true);

      if (error) {
        console.error("Get job filters error:", error);
        return res.status(500).json({ error: "Failed to fetch job filters" });
      }

      const locations = Array.from(
        new Set(jobs?.map((j) => j.location).filter(Boolean)),
      ).sort();
      const jobTypes = Array.from(
        new Set(jobs?.map((j) => j.job_type).filter(Boolean)),
      ).sort();
      const industries = Array.from(
        new Set(jobs?.map((j) => j.industry).filter(Boolean)),
      ).sort();
      const workModes = Array.from(
        new Set(jobs?.map((j) => j.work_mode).filter(Boolean)),
      ).sort();

      res.json({
        locations,
        jobTypes,
        industries,
        workModes,
      });
    } catch (error) {
      console.error("Get job filters error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create a new job posting
  app.post("/api/jobs", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;

      if (!userId) {
        return res.status(401).json({ error: "No user ID provided" });
      }

      // Verify user permission (Alumni, Faculty, Admin only)
      const { data: user } = await supabase
        .from("users")
        .select("user_role, is_admin")
        .eq("id", userId)
        .single();

      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      // Allow admins, alumni, and faculty. Block students.
      const allowedRoles = ["alumni", "faculty", "administrator"];
      if (!user.is_admin && !allowedRoles.includes(user.user_role || "")) {
        return res
          .status(403)
          .json({ error: "Only Alumni and Faculty members can post jobs." });
      }

      const {
        title,
        company,
        location,
        jobType,
        workMode,
        description,
        requirements,
        experienceLevel,
        salaryMin,
        salaryMax,
        applicationUrl,
        contactEmail,
        industry,
        skills,
        companyLogo,
      } = req.body;

      if (!title || !company) {
        return res
          .status(400)
          .json({ error: "Title and company are required" });
      }

      const { data: job, error } = await supabase
        .from("jobs")
        .insert({
          title,
          company,
          location: location || null,
          job_type: jobType || null,
          work_mode: workMode || null,
          description: description || null,
          requirements: requirements || null,
          experience_level: experienceLevel || null,
          salary_min: salaryMin || null,
          salary_max: salaryMax || null,
          application_url: applicationUrl || null,
          contact_email: contactEmail || null,
          industry: industry || null,
          skills: skills || null,
          company_logo: companyLogo || null,
          posted_by: userId,
          is_active: true,
        })
        .select(
          `
          *,
          posted_by_user:users!posted_by(id, username, email)
        `,
        )
        .single();

      if (error) {
        console.error("Create job error:", error);
        return res.status(500).json({ error: "Failed to create job posting" });
      }

      // Gamification: Award points for posting a job
      incrementScore(userId, "job_score", "job_post", 1).catch(err => 
        console.error("Gamification job post error:", err)
      );

      res.status(201).json({ job });
    } catch (error) {
      console.error("Create job error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update a job posting
  app.put("/api/jobs/:id", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const jobId = req.params.id;

      if (!userId) {
        return res.status(401).json({ error: "No user ID provided" });
      }

      // Verify ownership
      const { data: existingJob } = await supabase
        .from("jobs")
        .select("posted_by")
        .eq("id", jobId)
        .single();

      if (!existingJob || existingJob.posted_by !== userId) {
        return res
          .status(403)
          .json({ error: "Not authorized to edit this job" });
      }

      const {
        title,
        company,
        location,
        jobType,
        workMode,
        description,
        requirements,
        experienceLevel,
        applicationUrl,
        contactEmail,
        industry,
        skills,
        isActive,
        companyLogo,
      } = req.body;

      const { data: job, error } = await supabase
        .from("jobs")
        .update({
          title,
          company,
          location: location || null,
          job_type: jobType || null,
          work_mode: workMode || null,
          description: description || null,
          requirements: requirements || null,
          experience_level: experienceLevel || null,
          application_url: applicationUrl || null,
          contact_email: contactEmail || null,
          industry: industry || null,
          skills: skills || null,
          company_logo: companyLogo !== undefined ? companyLogo : undefined,
          is_active: isActive !== undefined ? isActive : true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId)
        .select(
          `
          *,
          posted_by_user:users!posted_by(id, username, email)
        `,
        )
        .single();

      if (error) {
        console.error("Update job error:", error);
        return res.status(500).json({ error: "Failed to update job" });
      }

      res.json({ job });
    } catch (error) {
      console.error("Update job error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete a job posting
  app.delete("/api/jobs/:id", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const jobId = req.params.id;

      if (!userId) {
        return res.status(401).json({ error: "No user ID provided" });
      }

      // Check if the requesting user is an admin
      const { data: requestingUser } = await supabase
        .from("users")
        .select("is_admin")
        .eq("id", userId)
        .single();

      const isAdmin = requestingUser?.is_admin === true;

      if (!isAdmin) {
        // Non-admins can only delete their own job postings
        const { data: existingJob } = await supabase
          .from("jobs")
          .select("posted_by")
          .eq("id", jobId)
          .single();

        if (!existingJob || existingJob.posted_by !== userId) {
          return res
            .status(403)
            .json({ error: "Not authorized to delete this job" });
        }
      }

      const { error } = await supabase.from("jobs").delete().eq("id", jobId);

      if (error) {
        console.error("Delete job error:", error);
        return res.status(500).json({ error: "Failed to delete job" });
      }

      res.json({ message: "Job deleted successfully" });
    } catch (error) {
      console.error("Delete job error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Apply to job
  app.post("/api/jobs/:id/apply", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const jobId = req.params.id;

      if (!userId) {
        return res.status(401).json({ error: "No user ID provided" });
      }

      // Check if already applied
      const { data: existing } = await supabase
        .from("job_applications")
        .select("id")
        .eq("user_id", userId)
        .eq("job_id", jobId)
        .single();

      if (existing) {
        return res.status(409).json({ error: "Already applied to this job" });
      }

      const { error } = await supabase.from("job_applications").insert({
        user_id: userId,
        job_id: jobId,
        status: "applied",
      });

      if (error) {
        console.error("Apply to job error:", error);
        return res.status(500).json({ error: "Failed to apply" });
      }



      res.json({ message: "Application submitted" });
    } catch (error) {
      console.error("Apply to job error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== EVENTSROUTES ====================

  // Get all events with pagination and filters
  app.get("/api/events", async (req, res) => {
    try {
      const {
        limit = 20,
        offset = 0,
        location,
        search,
        tag,
        tags, // Support multiple tags (comma-separated)
        sort,
        includeInactive = "false",
        isVirtual, // "true" or "false" or undefined
        dateFrom, // ISO date string
        dateTo, // ISO date string
        registrationStatus, // "open", "closed", or undefined
      } = req.query;

      let query = supabase.from("events").select("*");

      // Only filter by is_active if includeInactive is not true
      if (includeInactive !== "true") {
        query = query.eq("is_active", true);
      }

      // Filter for upcoming events
      if (sort === "upcoming") {
        query = query.gte("event_date", new Date().toISOString());
      }

      // Date range filters
      if (dateFrom && String(dateFrom).trim()) {
        query = query.gte("event_date", String(dateFrom).trim());
      }
      if (dateTo && String(dateTo).trim()) {
        query = query.lte("event_date", String(dateTo).trim());
      }

      // Virtual/In-person filter
      if (isVirtual === "true") {
        query = query.eq("is_virtual", true);
      } else if (isVirtual === "false") {
        query = query.eq("is_virtual", false);
      }

      // Registration status filter
      if (registrationStatus === "open") {
        const now = new Date().toISOString();
        query = query.or(`registration_deadline.is.null,registration_deadline.gt.${now}`);
      } else if (registrationStatus === "closed") {
        const now = new Date().toISOString();
        query = query.lt("registration_deadline", now).not("registration_deadline", "is", null);
      }

      if (location && String(location).trim()) {
        const loc = String(location).trim();
        query = query.ilike("location", `%${loc}%`);
      }
      if (search && String(search).trim()) {
        const sanitizedSearch = String(search).trim().replace(/,/g, " ");
        query = query.or(
          `title.ilike.%${sanitizedSearch}%,description.ilike.%${sanitizedSearch}%,location.ilike.%${sanitizedSearch}%`,
        );
      }
      // Support both single tag and multiple tags
      if (tags && String(tags).trim()) {
        const tagArray = String(tags).split(",").map((t) => t.trim()).filter((t) => t);
        if (tagArray.length > 0) {
          // Filter events that contain any of the selected tags
          query = query.overlaps("tags", tagArray);
        }
      } else if (tag && String(tag).trim()) {
        query = query.contains("tags", [tag]);
      }

      const { data: events, error } = await query
        .order("event_date", { ascending: true })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      if (error) {
        console.error("Get events error:", error);
        return res
          .status(500)
          .json({ error: "Failed to fetch events", details: error.message });
      }

      // Fetch user data separately if events exist
      if (events && events.length > 0) {
        const organizerIds = Array.from(
          new Set(events.map((e) => e.organized_by).filter(Boolean))
        );

        if (organizerIds.length > 0) {
          const { data: users } = await supabase
            .from("users")
            .select("id, username, email")
            .in("id", organizerIds);

          if (users) {
            const userMap = new Map(users.map((u) => [u.id, u]));
            events.forEach((event) => {
              if (event.organized_by) {
                (event as any).organized_by_user =
                  userMap.get(event.organized_by) || null;
              }
            });
          }
        }

        // Fetch user's RSVPs and RSVP counts for these events
        const userId = req.headers["user-id"] as string;
        const eventIds = events.map(e => e.id);

        if (eventIds.length > 0) {
          // Fetch user's RSVPs
          if (userId) {
            const { data: rsvps } = await supabase
              .from("event_rsvps")
              .select("event_id, status, guests_count, notes")
              .eq("user_id", userId)
              .in("event_id", eventIds);

            if (rsvps) {
              const rsvpMap = new Map(rsvps.map(r => [r.event_id, r]));
              events.forEach(event => {
                const rsvp = rsvpMap.get(event.id);
                if (rsvp) {
                  (event as any).user_rsvp = {
                    status: rsvp.status,
                    guests_count: rsvp.guests_count,
                    notes: rsvp.notes
                  };
                }
              });
            }
          }

          // Fetch RSVP counts for all events
          const { data: rsvpCounts } = await supabase
            .from("event_rsvps")
            .select("event_id, status")
            .in("event_id", eventIds)
            .eq("status", "attending");

          if (rsvpCounts) {
            const countMap = new Map<string, number>();
            rsvpCounts.forEach(rsvp => {
              const current = countMap.get(rsvp.event_id) || 0;
              countMap.set(rsvp.event_id, current + 1);
            });

            events.forEach(event => {
              const count = countMap.get(event.id) || 0;
              (event as any).rsvp_count = count;
            });
          }
        }
      }

      res.json({ events: events || [] });
    } catch (error) {
      console.error("Get events error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get distinct filter options for events (dynamic based on existing data)
  app.get("/api/events/filters", async (req, res) => {
    try {
      const { includeInactive = "false" } = req.query;
      let query = supabase.from("events").select("location, tags, is_virtual");

      // Only filter by is_active if includeInactive is not true
      if (includeInactive !== "true") {
        query = query.eq("is_active", true);
      }

      const { data: events, error } = await query;

      if (error) {
        console.error("Get event filters error:", error);
        return res.status(500).json({ error: "Failed to fetch event filters" });
      }

      const locations = Array.from(
        new Set(
          events
            ?.map((e) => e.location)
            .filter((l) => l && l !== "TBD" && l.trim() !== "")
        )
      ).sort();

      // Extract all unique tags from events
      const allTags = new Set<string>();
      events?.forEach((e) => {
        if (e.tags && Array.isArray(e.tags)) {
          e.tags.forEach((tag: string) => {
            if (tag && tag.trim() !== "") {
              allTags.add(tag.trim());
            }
          });
        }
      });

      res.json({
        locations,
        tags: Array.from(allTags).sort(),
      });
    } catch (error) {
      console.error("Get event filters error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create a new event
  app.post("/api/events", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;

      if (!userId) {
        return res.status(401).json({ error: "No user ID provided" });
      }

      // Verify user is admin
      const { data: user } = await supabase
        .from("users")
        .select("is_admin")
        .eq("id", userId)
        .single();

      if (!user || !user.is_admin) {
        return res.status(403).json({ error: "Only admins can create events" });
      }

      const {
        title,
        description,
        eventDate,
        eventTime,
        location,
        imageUrl,
        tags,
        maxParticipants,
        isVirtual,
        virtualLink,
        maxAttendees,
        registrationDeadline,
        isActive,
      } = req.body;

      if (!title || !eventDate) {
        return res
          .status(400)
          .json({ error: "Title and event date are required" });
      }

      // Validate virtual event requirements
      if (isVirtual === true && (!virtualLink || virtualLink.trim() === "")) {
        return res
          .status(400)
          .json({ error: "Virtual Link is required for virtual events" });
      }

      // Parse the datetime-local value properly
      // The eventDate comes in format: "YYYY-MM-DDTHH:mm" (datetime-local format)
      // The frontend sends this in IST, so we need to convert IST to UTC
      let eventDateISO;
      try {
        if (eventDate.includes('T') && !eventDate.includes('Z') && !eventDate.includes('+')) {
          // datetime-local format: treat as IST and convert to UTC
          eventDateISO = istDatetimeLocalToUTC(eventDate);
        } else {
          // Already has timezone or is a full ISO string
          const parsedDate = new Date(eventDate);
          if (isNaN(parsedDate.getTime())) {
            throw new Error("Invalid date");
          }
          eventDateISO = parsedDate.toISOString();
        }
      } catch (e) {
        return res.status(400).json({ error: "Invalid event date format: " + (e instanceof Error ? e.message : String(e)) });
      }

      // Parse registration deadline similar to event date
      let registrationDeadlineISO = null;
      if (registrationDeadline && registrationDeadline.trim()) {
        try {
          if (registrationDeadline.includes('T') && !registrationDeadline.includes('Z') && !registrationDeadline.includes('+')) {
            // datetime-local format: treat as IST and convert to UTC
            registrationDeadlineISO = istDatetimeLocalToUTC(registrationDeadline);
          } else {
            // Already has timezone or is a full ISO string
            const parsedDate = new Date(registrationDeadline);
            if (!isNaN(parsedDate.getTime())) {
              registrationDeadlineISO = parsedDate.toISOString();
            }
          }
        } catch (e) {
          // If parsing fails, return error
          return res.status(400).json({ error: "Invalid registration deadline format: " + (e instanceof Error ? e.message : String(e)) });
        }
      }

      const { data: event, error } = await supabase
        .from("events")
        .insert({
          title,
          description,
          event_date: eventDateISO,
          event_time: eventTime || null,
          location: location || "TBD",
          is_virtual: isVirtual === true,
          virtual_link: isVirtual === true ? virtualLink : null,
          max_attendees: maxParticipants ? (parseInt(maxParticipants, 10) || null) : (maxAttendees || null),
          registration_deadline: registrationDeadlineISO,
          cover_image: imageUrl || null,
          tags: tags || [],
          organized_by: userId,
          is_active: isActive !== false,
        })
        .select("*")
        .single();

      if (error) {
        console.error("Create event error:", error);
        return res
          .status(500)
          .json({ error: "Failed to create event", details: error.message });
      }

      // Fetch user separately
      if (event) {
        const { data: userData } = await supabase
          .from("users")
          .select("id, username, email")
          .eq("id", userId)
          .single();

        if (userData) {
          (event as any).organized_by_user = userData;
        }
      }

      res.status(201).json({ event });
    } catch (error) {
      console.error("Create event error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update an event
  app.put("/api/events/:id", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const eventId = req.params.id;

      if (!userId) {
        return res.status(401).json({ error: "No user ID provided" });
      }

      // Verify user is admin or event organizer
      const { data: user } = await supabase
        .from("users")
        .select("is_admin")
        .eq("id", userId)
        .single();

      const { data: existingEvent } = await supabase
        .from("events")
        .select("organized_by")
        .eq("id", eventId)
        .single();

      if (
        !existingEvent ||
        (!user?.is_admin && existingEvent.organized_by !== userId)
      ) {
        return res
          .status(403)
          .json({ error: "Not authorized to edit this event" });
      }

      const {
        title,
        description,
        eventDate,
        eventTime,
        location,
        imageUrl,
        tags,
        isActive,
        isVirtual,
        virtualLink,
        maxAttendees,
        maxParticipants,
        registrationDeadline,
        coverImage, // Keep for backward compatibility
      } = req.body;

      // Use imageUrl if explicitly provided, otherwise fall back to coverImage (for backward compatibility)
      // imageUrl takes precedence for consistency with create endpoint
      // For UPDATE operations: only update if a truthy value is provided (preserve existing if null/undefined)
      // This prevents accidental deletion of cover images when null is sent
      const hasImageUrl = imageUrl !== undefined;
      const hasCoverImage = coverImage !== undefined;

      // Determine the value to use: prioritize imageUrl, fallback to coverImage
      // But only include in update if a truthy value is provided
      let coverImageValue: string | null | undefined = undefined;

      if (hasImageUrl) {
        // If imageUrl is provided (even if null), use it
        // But for updates, null means preserve existing (don't delete)
        if (imageUrl !== null && imageUrl !== undefined && imageUrl !== '') {
          coverImageValue = imageUrl;
        }
        // If imageUrl is null or empty, preserve existing (don't include in update)
      } else if (hasCoverImage) {
        // Backward compatibility: use coverImage if imageUrl not provided
        if (coverImage !== null && coverImage !== undefined && coverImage !== '') {
          coverImageValue = coverImage;
        }
        // If coverImage is null or empty, preserve existing (don't include in update)
      }
      // If neither provided, coverImageValue stays undefined, preserving existing

      // Track which fields were explicitly provided in the request
      const providedFields = req.body;

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      // Only include fields that were explicitly provided in the request
      // This prevents setting fields to NULL when they're not provided

      if ('title' in providedFields) {
        updateData.title = title;
      }
      if ('description' in providedFields) {
        updateData.description = description;
      }
      if ('eventDate' in providedFields) {
        // Parse the datetime-local value properly
        // The eventDate comes in format: "YYYY-MM-DDTHH:mm" (datetime-local format)
        // The frontend sends this in IST, so we need to convert IST to UTC
        let eventDateISO;
        try {
          if (eventDate.includes('T') && !eventDate.includes('Z') && !eventDate.includes('+')) {
            // datetime-local format: treat as IST and convert to UTC
            eventDateISO = istDatetimeLocalToUTC(eventDate);
          } else {
            // Already has timezone or is a full ISO string
            const parsedDate = new Date(eventDate);
            if (isNaN(parsedDate.getTime())) {
              throw new Error("Invalid date");
            }
            eventDateISO = parsedDate.toISOString();
          }
          updateData.event_date = eventDateISO;
        } catch (e) {
          // If parsing fails, return error
          return res.status(400).json({ error: "Invalid event date format: " + (e instanceof Error ? e.message : String(e)) });
        }
      }
      if ('eventTime' in providedFields) {
        updateData.event_time = eventTime || null;
      }
      if ('location' in providedFields) {
        updateData.location = location;
      }
      if ('isVirtual' in providedFields) {
        updateData.is_virtual = isVirtual === true;
        // Only update virtual_link if explicitly provided
        if ('virtualLink' in providedFields) {
          updateData.virtual_link = isVirtual === true ? virtualLink : null;
        }
      }
      if ('maxAttendees' in providedFields || 'maxParticipants' in providedFields) {
        updateData.max_attendees = maxParticipants ? (parseInt(maxParticipants, 10) || null) : (maxAttendees || null);
      }
      if ('registrationDeadline' in providedFields) {
        // Parse registration deadline similar to event date
        if (registrationDeadline && registrationDeadline.trim()) {
          let registrationDeadlineISO;
          try {
            if (registrationDeadline.includes('T') && !registrationDeadline.includes('Z') && !registrationDeadline.includes('+')) {
              // datetime-local format: treat as IST and convert to UTC
              registrationDeadlineISO = istDatetimeLocalToUTC(registrationDeadline);
            } else {
              // Already has timezone or is a full ISO string
              const parsedDate = new Date(registrationDeadline);
              if (isNaN(parsedDate.getTime())) {
                throw new Error("Invalid date");
              }
              registrationDeadlineISO = parsedDate.toISOString();
            }
            updateData.registration_deadline = registrationDeadlineISO;
          } catch (e) {
            // If parsing fails, return error
            return res.status(400).json({ error: "Invalid registration deadline format: " + (e instanceof Error ? e.message : String(e)) });
          }
        } else {
          updateData.registration_deadline = null;
        }
      }
      if ('tags' in providedFields) {
        updateData.tags = tags || [];
      }
      if ('isActive' in providedFields) {
        updateData.is_active = isActive;
      }

      // Only update cover_image if a truthy value is explicitly provided
      // This preserves existing image if field is not provided, null, or empty
      if (coverImageValue !== undefined) {
        updateData.cover_image = coverImageValue;
      }

      const { data: event, error } = await supabase
        .from("events")
        .update(updateData)
        .eq("id", eventId)
        .select("*")
        .single();

      if (error) {
        console.error("Update event error:", error);
        return res.status(500).json({ error: "Failed to update event" });
      }

      // Fetch user separately
      if (event) {
        const { data: userData } = await supabase
          .from("users")
          .select("id, username, email")
          .eq("id", event.organized_by)
          .single();

        if (userData) {
          (event as any).organized_by_user = userData;
        }
      }

      res.json({ event });
    } catch (error) {
      console.error("Update event error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete an event
  app.delete("/api/events/:id", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const eventId = req.params.id;

      if (!userId) {
        return res.status(401).json({ error: "No user ID provided" });
      }

      // Verify user is admin or event organizer
      const { data: user } = await supabase
        .from("users")
        .select("is_admin")
        .eq("id", userId)
        .single();

      const { data: existingEvent } = await supabase
        .from("events")
        .select("organized_by")
        .eq("id", eventId)
        .single();

      if (
        !existingEvent ||
        (!user?.is_admin && existingEvent.organized_by !== userId)
      ) {
        return res
          .status(403)
          .json({ error: "Not authorized to delete this event" });
      }

      const { error } = await supabase
        .from("events")
        .delete()
        .eq("id", eventId);

      if (error) {
        console.error("Delete event error:", error);
        return res.status(500).json({ error: "Failed to delete event" });
      }

      res.json({ message: "Event deleted successfully" });
    } catch (error) {
      console.error("Delete event error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== USER BLOCK ROUTES ====================

  // Get all blocks for current user (both directions)
  app.get("/api/users/blocks", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { data: blocks, error } = await supabase
        .from("user_blocks")
        .select("*")
        .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);

      if (error) {
        console.error("Get blocks error:", error);
        return res.status(500).json({ error: "Failed to fetch blocks" });
      }

      res.json({ blocks: blocks || [] });
    } catch (error) {
      console.error("Get blocks error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Block a user
  app.post("/api/users/block/:targetUserId", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const { targetUserId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (userId === targetUserId) {
        return res.status(400).json({ error: "You cannot block yourself" });
      }

      // Check if already blocked
      const { data: existing } = await supabase
        .from("user_blocks")
        .select("id")
        .eq("blocker_id", userId)
        .eq("blocked_id", targetUserId)
        .single();

      if (existing) {
        return res.json({ message: "User already blocked" });
      }

      const { error } = await supabase
        .from("user_blocks")
        .insert({
          blocker_id: userId,
          blocked_id: targetUserId
        });

      if (error) {
        console.error("Block user error:", error);
        return res.status(500).json({ error: "Failed to block user" });
      }

      res.json({ message: "User blocked successfully" });
    } catch (error) {
      console.error("Block user error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Unblock a user
  app.post("/api/users/unblock/:targetUserId", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const { targetUserId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { error } = await supabase
        .from("user_blocks")
        .delete()
        .eq("blocker_id", userId)
        .eq("blocked_id", targetUserId);

      if (error) {
        console.error("Unblock user error:", error);
        return res.status(500).json({ error: "Failed to unblock user" });
      }

      res.json({ message: "User unblocked successfully" });
    } catch (error) {
      console.error("Unblock user error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== MESSAGING ROUTES ====================

  // Get all messages (admin only)
  app.get("/api/admin/messages/all", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;

      if (!userId) {
        return res.status(401).json({ error: "No user ID provided" });
      }

      // Verify user is admin
      const { data: user } = await supabase
        .from("users")
        .select("is_admin, user_role")
        .eq("id", userId)
        .single();

      if (!user || (!user.is_admin && user.user_role !== "administrator")) {
        return res
          .status(403)
          .json({ error: "Unauthorized. Admin access required." });
      }

      // Fetch all messages with sender and receiver information
      // eslint-disable-next-line prefer-const -- messages is reassigned in fallback path below
      let { data: messages, error } = await supabase
        .from("messages")
        .select(
          `
          *,
          sender:users!sender_id (
            id,
            username,
            email
          ),
          receiver:users!receiver_id (
            id,
            username,
            email
          ),
          reactions:message_reactions(
            *,
            user:users!message_reactions_user_id_fkey(id, username, email)
          ),
          replies:message_replies(
            *,
            sender:users!message_replies_sender_id_fkey(id, username, email)
          )
        `,
        )
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Get all messages error (full query):", error);
        // Fall back to a simpler query without reactions/replies if those tables don't exist
        const fallback = await supabase
          .from("messages")
          .select(
            `
            *,
            sender:users!sender_id (id, username, email),
            receiver:users!receiver_id (id, username, email)
          `,
          )
          .order("created_at", { ascending: false });

        if (fallback.error) {
          console.error("Get all messages fallback error:", fallback.error);
          if (fallback.error.code === "PGRST204" || fallback.error.message.includes("table")) {
            return res.json({ messages: [], warning: "Messages table not initialized" });
          }
          return res.status(500).json({ error: "Failed to fetch messages" });
        }
        messages = fallback.data;
      }

      res.json({ messages: messages || [] });
    } catch (error) {
      console.error("Get all messages error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get admin contact info (primary admin user ID) — used by students to open chat with admin
  app.get("/api/admin/contact", async (req, res) => {
    try {
      const { data: adminUser, error } = await supabase
        .from("users")
        .select("id, username, email")
        .eq("is_admin", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error || !adminUser) {
        // Fallback: try user_role = administrator
        const { data: roleAdmin } = await supabase
          .from("users")
          .select("id, username, email")
          .eq("user_role", "administrator")
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!roleAdmin) {
          return res.status(404).json({ error: "No admin found" });
        }
        return res.json({ admin: roleAdmin });
      }

      return res.json({ admin: adminUser });
    } catch (error) {
      console.error("Get admin contact error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Admin inbox — conversations the admin is part of (sent to or from admin)
  app.get("/api/admin/inbox", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { data: user } = await supabase
        .from("users")
        .select("is_admin, user_role")
        .eq("id", userId)
        .single();

      if (!user || (!user.is_admin && user.user_role !== "administrator")) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const [inboxRes, sentRes] = await Promise.all([
        supabase
          .from("messages")
          .select(`
            *,
            sender:users!sender_id(id, username, email),
            receiver:users!receiver_id(id, username, email),
            reactions:message_reactions(*, user:users!message_reactions_user_id_fkey(id, username, email)),
            replies:message_replies(*, sender:users!message_replies_sender_id_fkey(id, username, email))
          `)
          .eq("receiver_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("messages")
          .select(`
            *,
            sender:users!sender_id(id, username, email),
            receiver:users!receiver_id(id, username, email),
            reactions:message_reactions(*, user:users!message_reactions_user_id_fkey(id, username, email)),
            replies:message_replies(*, sender:users!message_replies_sender_id_fkey(id, username, email))
          `)
          .eq("sender_id", userId)
          .order("created_at", { ascending: false }),
      ]);

      if (inboxRes.error) console.error("Admin inbox query error (received):", inboxRes.error);
      if (sentRes.error) console.error("Admin inbox query error (sent):", sentRes.error);

      const messages = [
        ...(inboxRes.data || []),
        ...(sentRes.data || []),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return res.json({ messages });
    } catch (error) {
      console.error("Admin inbox error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get user's inbox messages
  app.get("/api/messages/resolve-recipient", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const rawEmail = String(req.query?.email || "");
      const email = sanitizeEmail(rawEmail);

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!email || !isValidEmail(email)) {
        return res.status(400).json({ error: "Valid email is required" });
      }

      // eslint-disable-next-line prefer-const -- recipient is reassigned in fallback path below
      let { data: recipient, error: recipientError } = await supabase
        .from("users")
        .select("id, username, email, account_blocked")
        .eq("email", email)
        .maybeSingle();

      // Fallback: if the configured admin email isn't found, use any admin account
      if (recipientError || !recipient) {
        const { data: adminFallback } = await supabase
          .from("users")
          .select("id, username, email, account_blocked")
          .eq("is_admin", true)
          .neq("id", userId)
          .limit(1)
          .maybeSingle();

        if (!adminFallback) {
          const { data: adminByRole } = await supabase
            .from("users")
            .select("id, username, email, account_blocked")
            .eq("user_role", "administrator")
            .neq("id", userId)
            .limit(1)
            .maybeSingle();
          recipient = adminByRole;
        } else {
          recipient = adminFallback;
        }
      }

      if (!recipient) {
        return res.status(404).json({ error: "Recipient not found" });
      }

      if (recipient.account_blocked === true) {
        return res.status(403).json({ error: "Recipient account is blocked" });
      }

      if (recipient.id === userId) {
        return res.status(400).json({ error: "You cannot open a chat with yourself" });
      }

      return res.json({
        recipient: {
          id: recipient.id,
          username: recipient.username,
          email: recipient.email,
        },
      });
    } catch (error) {
      console.error("Resolve message recipient error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get user's inbox messages
  app.get("/api/messages/inbox", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { data: messages, error } = await supabase
        .from("messages")
        .select(
          `
          *,
          sender:users!sender_id (
            id,
            username,
            email
          ),
          reactions:message_reactions(*),
          replies:message_replies(*)
        `,
        )
        .eq("receiver_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Get inbox error:", error);
        if (error.code === "PGRST204" || error.message.includes("table")) {
          return res.json({ messages: [], warning: "Messages table not initialized" });
        }
        return res.status(500).json({ error: "Failed to fetch messages" });
      }

      res.json({ messages: messages || [] });
    } catch (error) {
      console.error("Get inbox error:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // Get user's sent messages
  app.get("/api/messages/sent", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "No user ID provided" });
      }

      const { data: messages, error } = await supabase
        .from("messages")
        .select(
          `
          *,
          sender:users!sender_id (id, username, email),
          receiver:users!receiver_id (id, username, email),
          reactions:message_reactions(*),
          replies:message_replies(*)
        `,
        )
        .eq("sender_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Get sent messages error:", error);
        return res.status(500).json({ error: "Failed to fetch sent messages" });
      }

      res.json({ messages: messages || [] });
    } catch (error) {
      console.error("Get sent messages error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Send a message
  app.post("/api/messages", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const { receiverId, subject, content, senderName } = req.body;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: "Message content is required" });
      }

      // Validate receiver exists
      const { data: receiver, error: receiverError } = await supabase
        .from("users")
        .select("id")
        .eq("id", receiverId)
        .single();

      if (receiverError || !receiver) {
        return res.status(404).json({ error: "Recipient not found" });
      }

      // Check if either user has blocked the other
      // console.log(`[Message] Check blocks: ${userId} <-> ${receiverId}`);

      const { data: blockData, error: blockSearchError } = await supabase
        .from("user_blocks")
        .select("id, blocker_id, blocked_id")
        .or(`and(blocker_id.eq.${userId},blocked_id.eq.${receiverId}),and(blocker_id.eq.${receiverId},blocked_id.eq.${userId})`);

      if (blockSearchError) {
        console.error("Block search error:", blockSearchError);
      }

      if (blockData && blockData.length > 0) {
        // console.log(`[Message] Blocked detected:`, blockData);
        return res.status(403).json({
          error: "Conversation Blocked",
          details: "One of the users has blocked the other. Messages cannot be sent."
        });
      }

      const { data, error } = await supabase
        .from("messages")
        .insert({
          sender_id: userId,
          receiver_id: receiverId,
          subject: subject || "No subject",
          content,
        })
        .select()
        .single();

      if (error) {
        console.error("Send message error:", error);
        return res.status(500).json({ error: "Failed to send message" });
      }

      const { data: senderData } = await supabase
        .from("users")
        .select("username")
        .eq("id", userId)
        .single();

      // Create notification for receiver using new helper
      await createAndEmitNotification({
        userId: receiverId,
        type: NotificationType.MESSAGE,
        title: "New Message",
        content: `You have a new message from ${senderData?.username || senderName || "an alumni"}`,
        relatedId: data.id,
        redirectUrl: NotificationRedirectUrl.INBOX,
        actorId: userId,
      });

      // Removed Gamification Points for Messaging as requested

      // Emit real-time message event to receiver
      const io = (global as any).io;
      if (io) {
        io.to(`user:${receiverId}`).emit("new_message", {
          message: data,
          senderId: userId,
          receiverId,
        });
        // Also emit to sender for optimistic UI update
        io.to(`user:${userId}`).emit("new_message", {
          message: data,
          senderId: userId,
          receiverId,
        });
      }

      res.status(201).json({ message: data });
    } catch (error) {
      console.error("Send message error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Edit a message (only sender and within 2 minutes)
  app.put("/api/messages/:messageId", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const { messageId } = req.params;
      const { content } = req.body;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: "Message content is required" });
      }

      // Fetch the message to check constraints
      const { data: message, error: fetchError } = await supabase
        .from("messages")
        .select("*")
        .eq("id", messageId)
        .single();

      if (fetchError || !message) {
        return res.status(404).json({ error: "Message not found" });
      }

      // Check ownership
      if (message.sender_id !== userId) {
        return res.status(403).json({ error: "You can only edit your own messages" });
      }

      // Check time limit (2 minutes)
      const messageDate = new Date(message.created_at);
      const now = new Date();
      const diffMinutes = (now.getTime() - messageDate.getTime()) / (1000 * 60);

      if (diffMinutes > 2) {
        return res.status(400).json({ error: "You can only edit messages within 2 minutes" });
      }

      // Perform update
      const { data, error } = await supabase
        .from("messages")
        .update({
          content,
          is_edited: true,
          updated_at: new Date().toISOString()
        })
        .eq("id", messageId)
        .select()
        .single();

      if (error) {
        console.error("Edit message error:", error);
        return res.status(500).json({ error: "Failed to edit message" });
      }

      res.status(200).json({ message: data });
    } catch (error) {
      console.error("Edit message error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Mark message as read
  app.put("/api/messages/:messageId/read", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const { messageId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { data, error } = await supabase
        .from("messages")
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .eq("id", messageId)
        .eq("receiver_id", userId)
        .select()
        .single();

      if (error) {
        console.error("Mark as read error:", error);
        return res.status(500).json({ error: "Failed to mark as read" });
      }

      res.json({ message: data });
    } catch (error) {
      console.error("Mark as read error:", error);
      res.status(500).json({ error: "Failed to mark as read" });
    }
  });

  // Delete message (only sender can delete)
  app.delete("/api/messages/:messageId", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const { messageId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Verify the user is the sender of this message
      const { data: message, error: fetchError } = await supabase
        .from("messages")
        .select("sender_id")
        .eq("id", messageId)
        .single();

      if (fetchError || !message) {
        return res.status(404).json({ error: "Message not found" });
      }

      if (message.sender_id !== userId) {
        return res
          .status(403)
          .json({ error: "You can only delete messages you sent" });
      }

      // Delete the message
      const { error: deleteError } = await supabase
        .from("messages")
        .delete()
        .eq("id", messageId);

      if (deleteError) {
        console.error("Delete message error:", deleteError);
        return res.status(500).json({ error: "Failed to delete message" });
      }

      res.json({ message: "Message deleted successfully" });
    } catch (error) {
      console.error("Delete message error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== MESSAGE REACTIONS ROUTES ====================

  // Add a reaction to a message
  app.post("/api/messages/:messageId/reactions", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const { messageId } = req.params;
      const { emoji } = req.body;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!emoji || typeof emoji !== 'string') {
        return res.status(400).json({ error: "Emoji is required" });
      }

      // Verify message exists
      const { data: message, error: messageError } = await supabase
        .from("messages")
        .select("id")
        .eq("id", messageId)
        .single();

      if (messageError || !message) {
        return res.status(404).json({ error: "Message not found" });
      }

      // Check if user already has ANY reaction for this message
      const { data: existingReactions, error: fetchError } = await supabase
        .from("message_reactions")
        .select("*")
        .eq("message_id", messageId)
        .eq("user_id", userId);

      if (fetchError) {
        console.error("Fetch existing reactions error:", fetchError);
        return res.status(500).json({ error: "Internal server error" });
      }

      // Find if they already reacted with THIS EXACT emoji
      const existingSameEmoji = existingReactions?.find(r => r.emoji === emoji);

      if (existingSameEmoji) {
        // WhatsApp behavior: Click same emoji to REMOVE it
        const { error: deleteError } = await supabase
          .from("message_reactions")
          .delete()
          .eq("id", existingSameEmoji.id);

        if (deleteError) {
          console.error("Delete reaction error:", deleteError);
          return res.status(500).json({ error: "Failed to remove reaction" });
        }
        return res.json({ message: "Reaction removed", action: "removed" });
      }

      // WhatsApp behavior: if they have a DIFFERENT emoji, remove it first (or update)
      // Since we want only one reaction per user per message
      if (existingReactions && existingReactions.length > 0) {
        // Remove ALL existing reactions for this user on this message to be safe 
        // (though there should ideally be only one)
        await supabase
          .from("message_reactions")
          .delete()
          .eq("message_id", messageId)
          .eq("user_id", userId);
      }

      // Add the new reaction
      const { data: reaction, error } = await supabase
        .from("message_reactions")
        .insert({
          message_id: messageId,
          user_id: userId,
          emoji: emoji
        })
        .select()
        .single();

      if (error) {
        console.error("Add reaction error:", error);
        return res.status(500).json({ error: "Failed to add reaction" });
      }

      res.status(201).json({ reaction, action: "added" });
    } catch (error) {
      console.error("Add reaction error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Remove a reaction from a message
  app.delete("/api/messages/:messageId/reactions/:emoji", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const { messageId, emoji } = req.params;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { error } = await supabase
        .from("message_reactions")
        .delete()
        .eq("message_id", messageId)
        .eq("user_id", userId)
        .eq("emoji", decodeURIComponent(emoji));

      if (error) {
        console.error("Remove reaction error:", error);
        return res.status(500).json({ error: "Failed to remove reaction" });
      }

      res.json({ message: "Reaction removed successfully" });
    } catch (error) {
      console.error("Remove reaction error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get reactions for a message
  app.get("/api/messages/:messageId/reactions", async (req, res) => {
    try {
      const { messageId } = req.params;

      const { data: reactions, error } = await supabase
        .from("message_reactions")
        .select(`
          *,
          user:users!message_reactions_user_id_fkey (
            id,
            username,
            email
          )
        `)
        .eq("message_id", messageId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Get reactions error:", error);
        return res.status(500).json({ error: "Failed to fetch reactions" });
      }

      res.json({ reactions: reactions || [] });
    } catch (error) {
      console.error("Get reactions error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== MESSAGE REPLIES ROUTES ====================

  // Create a reply to a message
  app.post("/api/messages/:messageId/replies", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const { messageId } = req.params;
      const { content } = req.body;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: "Reply content is required" });
      }

      // Verify message exists
      const { data: message, error: messageError } = await supabase
        .from("messages")
        .select("id, sender_id, receiver_id")
        .eq("id", messageId)
        .single();

      if (messageError || !message) {
        return res.status(404).json({ error: "Message not found" });
      }

      // Check if either user has blocked the other
      const otherUserId = message.sender_id === userId ? message.receiver_id : message.sender_id;

      const { data: blockData, error: blockSearchError } = await supabase
        .from("user_blocks")
        .select("id")
        .or(`and(blocker_id.eq.${userId},blocked_id.eq.${otherUserId}),and(blocker_id.eq.${otherUserId},blocked_id.eq.${userId})`);

      if (blockSearchError) {
        console.error("Block search error in reply:", blockSearchError);
      }

      if (blockData && blockData.length > 0) {
        return res.status(403).json({
          error: "Conversation Blocked",
          details: "You cannot reply to this message because a block is active in this conversation."
        });
      }

      // Create reply
      const { data: reply, error } = await supabase
        .from("message_replies")
        .insert({
          message_id: messageId,
          sender_id: userId,
          content: content.trim()
        })
        .select(`
          *,
          sender:users!message_replies_sender_id_fkey (
            id,
            username,
            email
          )
        `)
        .single();

      if (error) {
        console.error("Create reply error:", error);
        return res.status(500).json({ error: "Failed to create reply" });
      }

      // Get sender info for notification
      const { data: senderData } = await supabase
        .from("users")
        .select("username")
        .eq("id", userId)
        .single();

      // Notify the original message sender (if not replying to own message)
      if (message.sender_id !== userId) {
        await createAndEmitNotification({
          userId: message.sender_id,
          type: NotificationType.MESSAGE,
          title: "New Reply",
          content: `${senderData?.username || "Someone"} replied to your message`,
          relatedId: messageId,
          redirectUrl: NotificationRedirectUrl.INBOX,
          actorId: userId,
        });
      }

      // Also notify the other participant if they're not the sender or replier
      const otherParticipant = message.sender_id === userId ? message.receiver_id : message.sender_id;
      if (otherParticipant !== userId && otherParticipant !== message.sender_id) {
        await createAndEmitNotification({
          userId: otherParticipant,
          type: NotificationType.MESSAGE,
          title: "New Reply",
          content: `${senderData?.username || "Someone"} replied to a message`,
          relatedId: messageId,
          redirectUrl: NotificationRedirectUrl.INBOX,
          actorId: userId,
        });
      }

      // Removed Gamification Points for Messaging as requested

      res.status(201).json({ reply });
    } catch (error) {
      console.error("Create reply error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get replies for a message
  app.get("/api/messages/:messageId/replies", async (req, res) => {
    try {
      const { messageId } = req.params;

      const { data: replies, error } = await supabase
        .from("message_replies")
        .select(`
          *,
          sender:users!message_replies_sender_id_fkey (
            id,
            username,
            email
          )
        `)
        .eq("message_id", messageId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Get replies error:", error);
        return res.status(500).json({ error: "Failed to fetch replies" });
      }

      res.json({ replies: replies || [] });
    } catch (error) {
      console.error("Get replies error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update a reply
  app.put("/api/messages/:messageId/replies/:replyId", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const { replyId } = req.params;
      const { content } = req.body;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: "Reply content is required" });
      }

      // Verify user owns this reply
      const { data: existingReply, error: fetchError } = await supabase
        .from("message_replies")
        .select("sender_id")
        .eq("id", replyId)
        .single();

      if (fetchError || !existingReply) {
        return res.status(404).json({ error: "Reply not found" });
      }

      if (existingReply.sender_id !== userId) {
        return res.status(403).json({ error: "You can only edit your own replies" });
      }

      // Update reply
      const { data: reply, error } = await supabase
        .from("message_replies")
        .update({
          content: content.trim(),
          updated_at: new Date().toISOString()
        })
        .eq("id", replyId)
        .select(`
          *,
          sender:users!message_replies_sender_id_fkey (
            id,
            username,
            email
          )
        `)
        .single();

      if (error) {
        console.error("Update reply error:", error);
        return res.status(500).json({ error: "Failed to update reply" });
      }

      res.json({ reply });
    } catch (error) {
      console.error("Update reply error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete a reply
  app.delete("/api/messages/:messageId/replies/:replyId", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const { replyId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Verify user owns this reply
      const { data: existingReply, error: fetchError } = await supabase
        .from("message_replies")
        .select("sender_id")
        .eq("id", replyId)
        .single();

      if (fetchError || !existingReply) {
        return res.status(404).json({ error: "Reply not found" });
      }

      if (existingReply.sender_id !== userId) {
        return res.status(403).json({ error: "You can only delete your own replies" });
      }

      // Delete reply
      const { error } = await supabase
        .from("message_replies")
        .delete()
        .eq("id", replyId);

      if (error) {
        console.error("Delete reply error:", error);
        return res.status(500).json({ error: "Failed to delete reply" });
      }

      res.json({ message: "Reply deleted successfully" });
    } catch (error) {
      console.error("Delete reply error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });



  // ==================== JOB APPLICATION ROUTES ====================

  // Apply to a job
  app.post("/api/jobs/:id/apply", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const jobId = req.params.id;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Check if already applied
      const { data: existingApplication } = await supabase
        .from("job_applications")
        .select("id")
        .eq("job_id", jobId)
        .eq("user_id", userId)
        .single();

      if (existingApplication) {
        return res.status(400).json({ error: "You have already applied to this job" });
      }

      // Create application
      const { data: application, error } = await supabase
        .from("job_applications")
        .insert({
          job_id: jobId,
          user_id: userId,
          status: "pending",
        })
        .select()
        .single();

      if (error) {
        console.error("Job application error:", error);
        return res.status(500).json({ error: "Failed to submit application" });
      }

      res.status(201).json({ message: "Application submitted successfully", application });
    } catch (error) {
      console.error("Job application error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get jobs the current user has applied for
  app.get("/api/jobs/applied", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { data: applications, error } = await supabase
        .from("job_applications")
        .select("job_id")
        .eq("user_id", userId);

      if (error) {
        console.error("Fetch applied jobs error:", error);
        return res.status(500).json({ error: "Failed to fetch applied jobs" });
      }

      const appliedJobIds = applications?.map(app => app.job_id) || [];
      res.json({ appliedJobIds });
    } catch (error) {
      console.error("Fetch applied jobs error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });


  // ==================== ALUMNI SEARCH ROUTES ====================

  // Search alumni with connection status filtering



  // Respond to a connection request (accept/reject)



  // ==================== NOTIFICATIONS ROUTES ====================



  // ============================================
  // NOTIFICATION ROUTES
  // ============================================

  // Get notifications with enhanced filtering and search
  app.get("/api/notifications", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const { limit = "20", offset = "0", unreadOnly, filter, search, type } = req.query;

      // console.log("[Notifications API] Fetch request:", {
      //   userId,
      //   limit,
      //   offset,
      //   unreadOnly,
      //   filter,
      //   search,
      //   type,
      //   hasUserId: !!userId
      // });

      if (!userId) {
        console.error("[Notifications API] Unauthorized - no userId provided");
        return res.status(401).json({ error: "Unauthorized" });
      }

      const limitNum = Math.min(Number(limit) || 20, 100); // Max 100 per request
      const offsetNum = Math.max(Number(offset) || 0, 0);

      let query = supabase
        .from("notifications")
        .select("*", { count: "exact" })
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .range(offsetNum, offsetNum + limitNum - 1);

      // Filter by read status
      if (unreadOnly === "true") {
        query = query.eq("is_read", false);
      }

      // Filter by type
      if (type && typeof type === "string") {
        query = query.eq("type", type);
      }

      // Filter by date range
      if (filter === "today") {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        query = query.gte("created_at", today.toISOString());
      } else if (filter === "this_week") {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        query = query.gte("created_at", weekAgo.toISOString());
      }

      // Search in title and content
      if (search && typeof search === "string" && search.trim()) {
        const searchTerm = search.trim();
        query = query.or(`title.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%`);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error("[Notifications API] Database query error:", {
          error,
          userId,
          message: error.message,
          details: error.details
        });
        return res.status(500).json({ error: "Failed to fetch notifications" });
      }

      // Fetch actor profile data for notifications with actor_id
      const actorIds = [...new Set((data || []).map((n: any) => n.actor_id).filter(Boolean))];
      const actorProfiles: Record<string, any> = {};

      if (actorIds.length > 0) {
        const { data: alumniData } = await supabase
          .from("alumni")
          .select("user_id, first_name, last_name, profile_picture, gender")
          .in("user_id", actorIds);

        if (alumniData) {
          alumniData.forEach((alumni: any) => {
            actorProfiles[alumni.user_id] = {
              firstName: alumni.first_name,
              lastName: alumni.last_name,
              profilePicture: alumni.profile_picture,
              gender: alumni.gender,
              fullName: `${alumni.first_name || ''} ${alumni.last_name || ''}`.trim()
            };
          });
        }
      }

      // Enrich notifications with actor data
      const enrichedNotifications = (data || []).map((notification: any) => ({
        ...notification,
        actor: notification.actor_id ? actorProfiles[notification.actor_id] || null : null
      }));

      // console.log("[Notifications API] Successfully fetched notifications:", {
      //   userId,
      //   count: enrichedNotifications.length,
      //   total: count || 0,
      //   offset: offsetNum,
      //   limit: limitNum,
      //   unreadOnly: unreadOnly === "true",
      //   filter,
      //   search,
      //   type
      // });

      res.json({
        notifications: transformToCamelCase(enrichedNotifications),
        pagination: {
          total: count || 0,
          limit: limitNum,
          offset: offsetNum,
          hasMore: (count || 0) > offsetNum + limitNum
        }
      });
    } catch (error) {
      console.error("[Notifications API] Exception:", {
        error,
        message: error instanceof Error ? error.message : "Unknown error"
      });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Mark notification as read
  app.put("/api/notifications/:id/read", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const { id } = req.params;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Get notification type before updating
      const { data: notification } = await supabase
        .from("notifications")
        .select("type, is_read")
        .eq("id", id)
        .eq("user_id", userId)
        .single();

      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }

      // Only update if not already read
      if (!notification.is_read) {
        const { error } = await supabase
          .from("notifications")
          .update({ is_read: true }) // read_at will be set by trigger
          .eq("id", id)
          .eq("user_id", userId);

        if (error) {
          console.error("[Notifications API] Mark as read error:", error);
          return res.status(500).json({ error: "Failed to mark as read" });
        }

        // Track analytics
        try {
          await supabase
            .from("notification_analytics")
            .insert({
              user_id: userId,
              notification_id: id,
              notification_type: notification.type,
              action: "read",
            });
        } catch (analyticsError) {
          // Don't fail if analytics fails
          console.error("[Notifications API] Analytics tracking error:", analyticsError);
        }
      }

      res.json({ message: "Marked as read" });
    } catch (error) {
      console.error("[Notifications API] Mark as read exception:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Mark all notifications as read
  app.put("/api/notifications/read-all", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", userId)
        .eq("is_read", false);

      if (error) {
        console.error("Mark all read error:", error);
        return res.status(500).json({ error: "Failed to mark all as read" });
      }

      res.json({ message: "All notifications marked as read" });
    } catch (error) {
      console.error("Mark all read error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });


  // Delete all notifications
  app.delete("/api/notifications", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // console.log("[Notifications API] Clearing all notifications for user:", userId);

      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("user_id", userId);

      if (error) {
        console.error("[Notifications API] Clear all error:", error);
        return res.status(500).json({ error: "Failed to clear notifications" });
      }

      res.json({ message: "All notifications cleared" });
    } catch (error) {
      console.error("[Notifications API] Clear all exception:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete notification
  app.delete("/api/notifications/:id", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const { id } = req.params;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Get notification type before deleting
      const { data: notification } = await supabase
        .from("notifications")
        .select("type")
        .eq("id", id)
        .eq("user_id", userId)
        .single();

      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

      if (error) {
        console.error("[Notifications API] Delete error:", error);
        return res.status(500).json({ error: "Failed to delete notification" });
      }

      // Track analytics if notification existed
      if (notification) {
        try {
          await supabase
            .from("notification_analytics")
            .insert({
              user_id: userId,
              notification_id: id,
              notification_type: notification.type,
              action: "deleted",
            });
        } catch (analyticsError) {
          // Don't fail if analytics fails
          console.error("[Notifications API] Analytics tracking error:", analyticsError);
        }
      }

      res.json({ message: "Notification deleted successfully" });
    } catch (error) {
      console.error("[Notifications API] Delete exception:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // TEST ENDPOINT: Create a test notification (for debugging) - development only
  app.post("/api/notifications/test-create", async (req, res) => {
    // Only allow in development environment
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ error: "Not found" });
    }
    try {
      const userId = req.headers["user-id"] as string;
      const { type, title, content, redirect_url } = req.body;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // console.log("[Test Notification] Creating test notification for user:", userId);

      // Use the notification helper service which handles this correctly
      const { error: createError } = await createAndEmitNotification({
        userId: userId,
        type: type || "test",
        title: title || "Test Notification",
        content: content || "This is a test notification to verify the system is working!",
        redirectUrl: redirect_url || "/feed",
        relatedId: null,
        actorId: null,
      });

      if (createError) {
        console.error("[Test Notification] Failed via helper, trying direct insert:", createError);

        // Fallback: Direct insert - use only 'content' (message column doesn't exist)
        const notificationContent = content || "This is a test notification to verify the system is working!";
        const { data: notificationData, error: notificationError } = await supabase
          .from("notifications")
          .insert({
            user_id: userId,
            type: type || "test",
            title: title || "Test Notification",
            content: notificationContent,
            redirect_url: redirect_url || "/feed",
            is_read: false,
          })
          .select()
          .single();

        if (notificationError) {
          console.error("[Test Notification] Direct insert also failed:", notificationError);
          return res.status(500).json({
            error: "Failed to create test notification",
            details: notificationError.message,
            code: notificationError.code,
            hint: "The 'content' column may not exist. Check database schema or refresh Supabase schema cache."
          });
        }

        // console.log("[Test Notification] Successfully created via direct insert:", notificationData);

        // Emit socket notification using room-based emission
        const io = (global as any).io;
        if (io) {
          const roomName = `user:${userId}`;
          io.to(roomName).emit("notification", {
            type: type || "test",
            title: title || "Test Notification",
            content: content || "This is a test notification to verify the system is working!",
            redirect_url: redirect_url || "/feed",
          });
          // console.log(`[Test Notification] Emitted to room: ${roomName}`);
        }

        return res.json({
          message: "Test notification created successfully",
          notification: notificationData
        });
      }

      // console.log("[Test Notification] Successfully created via helper service");

      // Fetch the created notification to return it
      const { data: createdNotification, error: fetchError } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .eq("type", type || "test")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (fetchError) {
        console.error("[Test Notification] Failed to fetch created notification:", fetchError);
        // Still return success since notification was created
      } else {
        // console.log("[Test Notification] Fetched created notification:", createdNotification);
      }

      // Emit real-time notification using room-based emission
      const io = (global as any).io;
      if (io) {
        const roomName = `user:${userId}`;
        io.to(roomName).emit("notification", {
          type: type || "test",
          title: title || "Test Notification",
          content: content || "This is a test notification to verify the system is working!",
          redirect_url: redirect_url || "/feed",
        });
        // console.log(`[Test Notification] Real-time notification emitted to room: ${roomName}`);
      } else {
        // console.log("[Test Notification] Socket.IO not initialized, skipping real-time emit");
      }

      res.json({
        message: "Test notification created successfully",
        notification: createdNotification || null
      });
    } catch (error) {
      console.error("[Test Notification] Exception:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Handle connection request action (accept/reject) from notification
  app.post("/api/notifications/:id/connection-action", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const { id } = req.params;
      const { action } = req.body; // 'accept' or 'reject'

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!action || !['accept', 'reject'].includes(action)) {
        return res.status(400).json({ error: "Invalid action. Must be 'accept' or 'reject'" });
      }

      // 1. Get notification to find the related connection request ID
      const { data: notification, error: notifError } = await supabase
        .from("notifications")
        .select("*")
        .eq("id", id)
        .eq("user_id", userId)
        .single();

      if (notifError) {
        console.error("Notification query error:", notifError);
        return res.status(404).json({
          error: "Notification not found",
          details: "The notification may have been deleted or doesn't belong to you"
        });
      }

      if (!notification) {
        return res.status(404).json({
          error: "Notification not found",
          details: "This notification no longer exists"
        });
      }

      // The related_id is the requester's User ID
      const requesterId = notification.related_id;

      if (!requesterId) {
        return res.status(400).json({
          error: "Invalid notification data",
          details: "Notification is missing requester information"
        });
      }

      // 2. Find the pending connection request
      const { data: connectionRequest, error: reqError } = await supabase
        .from("connection_requests")
        .select("id, status")
        .eq("requester_id", requesterId)
        .eq("recipient_id", userId)
        .eq("status", "pending")
        .single();

      if (reqError || !connectionRequest) {
        // If request not found, it might have been withdrawn or already processed
        // Mark notification as read and provide helpful message
        await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("id", id);

        return res.status(404).json({
          error: "Connection request not available",
          details: "This request may have been withdrawn or already processed"
        });
      }

      // 3. Process the action (Accept/Reject)
      const newStatus = action === "accept" ? "accepted" : "rejected";

      const { error: updateError } = await supabase
        .from("connection_requests")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq("id", connectionRequest.id);

      if (updateError) {
        console.error(`Error ${action}ing connection:`, updateError);
        return res.status(500).json({ error: `Failed to ${action} connection request` });
      }

      // 4. Get current user's (the ones who accepted/rejected) name
      const { data: alumni } = await supabase
        .from("alumni")
        .select("first_name, last_name")
        .eq("user_id", userId)
        .single();

      const responderName = alumni ? `${alumni.first_name} ${alumni.last_name}` : "An alumni";

      // 5. Notify the requester using the centralized helper
      await createAndEmitNotification({
        userId: requesterId,
        type: NotificationType.CONNECTION_RESPONSE,
        title: action === "accept" ? "Connection Accepted" : "Connection Declined",
        content: action === "accept"
          ? `${responderName} accepted your connection request!`
          : `${responderName} declined your connection request`,
        relatedId: userId, // Pass the responder's ID so clicking notification goes to their profile/connections
        redirectUrl: NotificationRedirectUrl.CONNECTIONS,
        actorId: userId
      });

      // 6. Mark notification as read
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id);

      res.json({
        message: `Connection request ${action}ed successfully`,
        status: newStatus,
        success: true
      });

    } catch (error) {
      console.error("Connection action error:", error);
      res.status(500).json({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });



  // ==================== EVENT RSVP ROUTES ====================

  // RSVP to an event
  app.post("/api/events/:id/rsvp", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const eventId = req.params.id;

      if (!userId) {
        return res.status(401).json({ error: "No user ID provided" });
      }

      const { status = "attending", guestsCount = 0, notes } = req.body;

      if (!["attending", "maybe", "not_attending"].includes(status)) {
        return res.status(400).json({ error: "Invalid RSVP status" });
      }

      // Check event capacity
      const { data: event } = await supabase
        .from("events")
        .select("max_attendees, registration_deadline")
        .eq("id", eventId)
        .single();

      if (event) {
        // Check registration deadline
        if (
          event.registration_deadline &&
          new Date(event.registration_deadline) < new Date()
        ) {
          return res
            .status(400)
            .json({ error: "Registration deadline has passed" });
        }

        // Check capacity
        if (event.max_attendees) {
          const { data: rsvps } = await supabase
            .from("event_rsvps")
            .select("guests_count")
            .eq("event_id", eventId)
            .eq("status", "attending");

          const currentCount =
            rsvps?.reduce((sum, r) => sum + (r.guests_count || 1), 0) || 0;

          if (currentCount + (guestsCount || 1) > event.max_attendees) {
            return res.status(400).json({ error: "Event is at full capacity" });
          }
        }
      }

      // Check if RSVP already exists
      const { data: existingRsvp } = await supabase
        .from("event_rsvps")
        .select("id, status")
        .eq("event_id", eventId)
        .eq("user_id", userId)
        .single();

      if (existingRsvp) {
        // Toggle behavior: If clicking the same status, remove RSVP
        if (existingRsvp.status === status) {
          const { error } = await supabase
            .from("event_rsvps")
            .delete()
            .eq("id", existingRsvp.id);

          if (error) {
            console.error("Delete RSVP error:", error);
            return res.status(500).json({ error: "Failed to remove RSVP" });
          }

          // Deduct gamification points if they were attending
          if (existingRsvp.status === "attending") {
            incrementScore(userId, "event_score", "event_rsvp", -1).catch(err => console.error("Gamification event RSVP revert error:", err));
          }

          return res.json({
            message: "RSVP removed successfully",
            status: null, // Indicates no RSVP
          });
        }

        // Update existing RSVP
        const { error } = await supabase
          .from("event_rsvps")
          .update({
            status,
            guests_count: guestsCount || 1,
            notes: notes || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingRsvp.id);

        if (error) {
          console.error("Update RSVP error:", error);
          return res.status(500).json({ error: "Failed to update RSVP" });
        }

        // Gamification points
        if (existingRsvp.status !== "attending" && status === "attending") {
          incrementScore(userId, "event_score", "event_rsvp", 1).catch(err => console.error("Gamification event RSVP error:", err));
        } else if (existingRsvp.status === "attending" && status !== "attending") {
          incrementScore(userId, "event_score", "event_rsvp", -1).catch(err => console.error("Gamification event RSVP revert error:", err));
        }

        res.json({
          message: "RSVP updated successfully",
          status,
        });
      } else {
        // Create new RSVP
        const { data: rsvp, error } = await supabase
          .from("event_rsvps")
          .insert({
            event_id: eventId,
            user_id: userId,
            status,
            guests_count: guestsCount || 1,
            notes: notes || null,
          })
          .select()
          .single();

        if (error) {
          console.error("Create RSVP error:", error);
          return res.status(500).json({ error: "Failed to create RSVP" });
        }

        // Get event details for notification
        const { data: eventData } = await supabase
          .from("events")
          .select("title, organized_by")
          .eq("id", eventId)
          .single();

        // Get user details
        const { data: userAlumni } = await supabase
          .from("alumni")
          .select("first_name, last_name")
          .eq("user_id", userId)
          .single();

        const userName = userAlumni
          ? `${userAlumni.first_name} ${userAlumni.last_name}`
          : "Someone";

        // Notify event organizer if different from user
        if (
          eventData &&
          eventData.organized_by &&
          eventData.organized_by !== userId
        ) {
          await createAndEmitNotification({
            userId: eventData.organized_by,
            type: NotificationType.EVENT_RSVP,
            title: "New Event RSVP",
            content: `${userName} ${status === "attending" ? "is attending" : status === "maybe" ? "might attend" : "declined"} ${eventData.title}`,
            relatedId: eventId,
            redirectUrl: NotificationRedirectUrl.EVENTS,
            actorId: userId,
          });
        }

        // Award points if attending
        if (status === "attending") {
          // Fire and forget gamification updates
          incrementScore(userId, "event_score", "event_rsvp", 1).catch(err => console.error("Gamification event RSVP error:", err));
        }

        res.status(201).json({
          message: "RSVP created successfully",
          rsvp,
        });
      }
    } catch (error) {
      console.error("RSVP error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get event RSVPs (admin/organizer only)
  app.get("/api/events/:id/rsvps", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const eventId = req.params.id;

      if (!userId) {
        return res.status(401).json({ error: "No user ID provided" });
      }

      const { data: rsvps, error } = await supabase
        .from("event_rsvps")
        .select(
          `
          *,
          user:users!user_id(id, username, email)
        `,
        )
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Get RSVPs error:", error);
        return res.status(500).json({ error: "Failed to fetch RSVPs" });
      }

      // Fetch alumni details for these users
      if (rsvps && rsvps.length > 0) {
        const userIds = rsvps.map((r) => r.user_id);
        const { data: alumniData } = await supabase
          .from("alumni")
          .select(
            "user_id, first_name, last_name, batch, graduation_year, phone, profile_picture"
          )
          .in("user_id", userIds);

        if (alumniData) {
          const alumniMap = new Map(alumniData.map((a) => [a.user_id, a]));
          rsvps.forEach((rsvp) => {
            const alumniInfo = alumniMap.get(rsvp.user_id);
            if (alumniInfo) {
              (rsvp as any).alumni = alumniInfo;
            }
          });
        }
      }

      res.json({ rsvps: rsvps || [] });
    } catch (error) {
      console.error("Get RSVPs error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get user's RSVPs
  app.get("/api/my-rsvps", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "No user ID provided" });
      }

      const { data: rsvps, error } = await supabase
        .from("event_rsvps")
        .select(
          `
          *,
          event:events(*)
        `,
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Get user RSVPs error:", error);
        return res.status(500).json({ error: "Failed to fetch RSVPs" });
      }

      res.json({ rsvps: rsvps || [] });
    } catch (error) {
      console.error("Get user RSVPs error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Advanced profile update endpoint
  app.post("/api/profile/advanced-update", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "No user ID provided" });
      }

      const {
        employmentStatus,
        yearsOfExperience,
        employmentHistory,
        previousCompanies,
        certifications,
        languagesKnown,
        expertiseAreas,
        keywords,
        timezone,
        achievements,
        awards,
        volunteerInterests,
        profileCompletionScore,
        completedSections,
      } = req.body;

      // Update alumni record with advanced fields
      const { error } = await supabase
        .from("alumni")
        .update({
          employment_status: employmentStatus,
          years_of_experience: yearsOfExperience,
          employment_history: employmentHistory,
          previous_companies: previousCompanies,
          certifications: certifications,
          languages_known: languagesKnown,
          expertise_areas: expertiseAreas,
          keywords: keywords,
          timezone: timezone,
          achievements: achievements,
          awards: awards,
          volunteer_interests: volunteerInterests,
          profile_completion_score: profileCompletionScore,
          completed_sections: completedSections,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (error) {
        console.error("Advanced profile update error:", error);
        return res.status(500).json({ error: "Failed to update profile" });
      }

      res.json({ message: "Advanced profile updated successfully" });
    } catch (error) {
      console.error("Advanced profile update error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update complete profile
  app.post("/api/profile/update", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      if (!userId) {
        console.error("Profile update: No user ID provided");
        return res.status(401).json({ error: "No user ID provided" });
      }

      // console.log("Profile update request for user:", userId);
      // console.log("Update data:", req.body);

      const {
        firstName,
        lastName,
        email,
        phone,
        batch,
        currentCompany,
        currentRole,
        location,
        city,
        state,
        country,
        linkedinUrl,
        bio,
        gender,
        profilePicture,
        githubUrl,
        twitterUrl,
        personalWebsite,
        showEmail,
        showPhone,
      } = req.body;

      // Validate required fields
      const requiredFields = {
        firstName,
        lastName,
        email,
        phone,
        batch,
        gender,
      };
      const missingFields = Object.entries(requiredFields)
        .filter(([_, value]) => !value || value.trim() === "")
        .map(([key]) => key);

      if (missingFields.length > 0) {
        return res.status(400).json({
          error: "Missing required fields",
          missingFields,
        });
      }

      // Validate Batch Year (Must be 2021 or later)
      const batchYearNum = parseInt(String(batch).split('-')[0]);
      if (!isNaN(batchYearNum) && batchYearNum < 2021) {
        return res.status(400).json({ error: "Batch cannot be earlier than 2021." });
      }

      const {
        employmentStatus,
        yearsOfExperience,
        previousCompanies,
        employmentHistory,
        certifications,
        languagesKnown,
        expertiseAreas,
        keywords,
        timezone,
        achievements,
        awards,
        volunteerInterests,
        // Startup Fields
        isStartupFounder,
        startupName,
        startupRole,
        fundingStage,
        foundingYear,
        // Resume
        resumeUrl,
      } = req.body;

      // Derive graduation_year from batch if batch is provided
      let graduationYear = null;
      if (batch) {
        const parsedYear = parseInt(batch);
        if (!isNaN(parsedYear)) {
          graduationYear = parsedYear;
        }
      }

      // Check if alumni profile exists
      const { data: existingAlumni, error: checkError } = await supabase
        .from("alumni")
        .select("id")
        .eq("user_id", userId)
        .single();

      if (checkError && checkError.code !== "PGRST116") {
        console.error("Error checking alumni profile:", checkError);
        return res.status(500).json({ error: "Failed to check profile" });
      }

      let result;
      if (existingAlumni) {
        // Update existing profile
        // console.log("Updating existing alumni profile");
        // console.log(
        //   "Profile picture:",
        //   profilePicture ? `Yes (${profilePicture.length} chars)` : "No",
        // );
        const updateData: any = {
          first_name: firstName,
          last_name: lastName,
          email: email,
          phone: phone,
          batch: batch,
          current_company: currentCompany,
          current_role: currentRole,
          linkedin_url: linkedinUrl,
          bio: bio,
          gender: gender,
          profile_picture: profilePicture || null,
          // Advanced fields
          employment_status: employmentStatus || null,
          years_of_experience: yearsOfExperience ? (parseInt(String(yearsOfExperience)) || 0) : 0,
          previous_companies: previousCompanies || "[]",
          employment_history: employmentHistory || "[]",
          certifications: certifications || "[]",
          languages_known: languagesKnown || "[]",
          expertise_areas: expertiseAreas || "[]",
          keywords: keywords || "[]",
          timezone: timezone || "Asia/Kolkata",
          achievements: achievements || "[]",
          awards: awards || "[]",
          volunteer_interests: volunteerInterests || "[]",
          // Startup Fields
          is_startup_founder: !!isStartupFounder,
          startup_name: startupName || null,
          startup_role: startupRole || null,
          funding_stage: fundingStage || null,
          founding_year: foundingYear ? (parseInt(String(foundingYear)) || null) : null,
          // Resume
          resume_url: resumeUrl || null,
          updated_at: new Date().toISOString(),
          // Social media fields
          github_url: githubUrl || null,
          twitter_url: twitterUrl || null,
          personal_website: personalWebsite || null,
          // Privacy settings
          show_email: showEmail !== undefined ? showEmail : true,
          show_phone: showPhone !== undefined ? showPhone : true,
          
          // Updated explicit location fields
          current_city: city || null,
          current_state: state || null,
          current_country: country || null,
          location: city && country ? `${city}, ${country}` : null,
        };

        // Only include graduation_year if we have a valid value
        if (graduationYear !== null) {
          updateData.graduation_year = graduationYear;
        }

        const { data, error } = await supabase
          .from("alumni")
          .update(updateData)
          .eq("user_id", userId)
          .select()
          .single();

        if (error) {
          console.error("Update alumni error:", error);
          return res.status(500).json({
            error: "Failed to update profile",
            details: error.message,
          });
        }
        result = data;
      } else {
        // Create new profile
        // console.log("Creating new alumni profile");

        if (graduationYear === null) {
          return res.status(400).json({
            error: "Batch/Graduation year is required to create a profile",
          });
        }

        const { data, error } = await supabase
          .from("alumni")
          .insert({
            user_id: userId,
            first_name: firstName,
            last_name: lastName,
            email: email,
            phone: phone,
            batch: batch,
            graduation_year: graduationYear,
            current_company: currentCompany,
            current_role: currentRole,
            linkedin_url: linkedinUrl,
            bio: bio,
            gender: gender,
            profile_picture: profilePicture || null,
            // Advanced fields
            employment_status: employmentStatus || null,
            years_of_experience: yearsOfExperience ? (parseInt(String(yearsOfExperience)) || 0) : 0,
            previous_companies: previousCompanies || "[]",
            employment_history: employmentHistory || "[]",
            certifications: certifications || "[]",
            languages_known: languagesKnown || "[]",
            expertise_areas: expertiseAreas || "[]",
            keywords: keywords || "[]",
            timezone: timezone || "Asia/Kolkata",
            achievements: achievements || "[]",
            awards: awards || "[]",
            volunteer_interests: volunteerInterests || "[]",
            // Startup Fields
            is_startup_founder: !!isStartupFounder,
            startup_name: startupName || null,
            startup_role: startupRole || null,
            funding_stage: fundingStage || null,
            founding_year: foundingYear ? (parseInt(String(foundingYear)) || null) : null,
            // Resume
            resume_url: resumeUrl || null,
            // Social media fields
            github_url: githubUrl || null,
            twitter_url: twitterUrl || null,
            personal_website: personalWebsite || null,
            // Privacy settings
            show_email: showEmail !== undefined ? showEmail : true,
            show_phone: showPhone !== undefined ? showPhone : true,
            is_profile_public: true,
            is_verified: false,
            is_active: true,
          })
          .select()
          .single();

        if (error) {
          console.error("Create alumni error:", error);
          return res.status(500).json({
            error: "Failed to create profile",
            details: error.message,
          });
        }
        result = data;
      }

      // Update user email if changed
      if (email) {
        await supabase.from("users").update({ email: email }).eq("id", userId);
      }

      // Check if we need to update user_role based on graduation year
      // Check if we need to update user_role based on graduation year
      if (graduationYear) {
        // Check current user role to avoid overriding admin/faculty
        const { data: currentUser } = await supabase
          .from("users")
          .select("user_role")
          .eq("id", userId)
          .single();

        if (currentUser && (currentUser.user_role === 'student' || currentUser.user_role === 'alumni')) {
          const expectedRole = determineUserRole(graduationYear);
          if (currentUser.user_role !== expectedRole) {
            // console.log(`Auto-updating user role for ${userId} to ${expectedRole} based on batch update`);
            await supabase.from("users").update({ user_role: expectedRole }).eq("id", userId);
          }
        }
      }

      // console.log("Profile updated successfully:", result);
      res.json({
        message: "Profile updated successfully",
        alumni: result,
      });
    } catch (error) {
      console.error("Profile update error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get public alumni profile
  app.get("/api/alumni/public/:userId", async (req, res) => {
    try {
      const { userId } = req.params;

      let alumni: any = null;

      const isNumericId = /^\d+$/.test(userId);

      if (isNumericId) {
        const { data, error } = await supabase
          .from("alumni")
          .select("*")
          .eq("id", parseInt(userId))
          .maybeSingle();
        if (error) {
          console.error("Supabase fetch error:", error);
          return res.status(500).json({ error: "Database error" });
        }
        alumni = data;
      } else {
        const { data, error } = await supabase
          .from("alumni")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();
        if (error) {
          console.error("Supabase fetch error:", error);
          return res.status(500).json({ error: "Database error" });
        }
        alumni = data;
      }

      if (!alumni) {
        return res
          .status(404)
          .json({ error: "Profile not found or not public" });
      }

      // Return profile respecting privacy settings
      const alumniId = alumni.id;
      const currentUserId = req.headers["user-id"] as string;

      // Fetch all related information in parallel
      const [
        { data: education },
        { data: experiences },
        { data: skills },
        { data: certifications },
        { data: languages },
        { data: achievements },
        { data: projects },
        { data: userConnections },
        { data: currentUserConnections }
      ] = await Promise.all([
        supabase.from("alumni_education").select("*").eq("alumni_id", alumniId).order("start_date", { ascending: false }),
        supabase.from("alumni_experiences").select("*").eq("alumni_id", alumniId).order("start_date", { ascending: false }),
        supabase.from("alumni_skills").select("*").eq("alumni_id", alumniId).order("is_primary", { ascending: false }).order("display_order", { ascending: true }),
        supabase.from("alumni_certifications").select("*").eq("alumni_id", alumniId).order("issue_date", { ascending: false }),
        supabase.from("alumni_languages").select("*").eq("alumni_id", alumniId).order("display_order", { ascending: true }),
        supabase.from("alumni_achievements").select("*").eq("alumni_id", alumniId).order("is_featured", { ascending: false }).order("date_received", { ascending: false }),
        supabase.from("alumni_projects").select("*").eq("alumni_id", alumniId).order("start_date", { ascending: false }),
        // Get profile user's connections
        supabase.from("connection_requests").select("requester_id, recipient_id").eq("status", "accepted").or(`requester_id.eq.${userId},recipient_id.eq.${userId}`),
        // Get current viewer's connections (if logged in)
        currentUserId ? supabase.from("connection_requests").select("requester_id, recipient_id").eq("status", "accepted").or(`requester_id.eq.${currentUserId},recipient_id.eq.${currentUserId}`) : Promise.resolve({ data: null })
      ]);

      // Calculate mutual connections
      let mutualConnectionsCount = 0;
      let totalConnections = 0;

      if (userConnections) {
        const profileUserConnectionIds = new Set<string>();
        userConnections.forEach(conn => {
          const otherId = conn.requester_id === userId ? conn.recipient_id : conn.requester_id;
          profileUserConnectionIds.add(otherId);
        });
        totalConnections = profileUserConnectionIds.size;

        if (currentUserId && currentUserConnections) {
          const currentUserConnectionIds = new Set<string>();
          currentUserConnections.forEach(conn => {
            const otherId = conn.requester_id === currentUserId ? conn.recipient_id : conn.requester_id;
            currentUserConnectionIds.add(otherId);
          });

          // Find mutual connections
          profileUserConnectionIds.forEach(id => {
            if (currentUserConnectionIds.has(id)) {
              mutualConnectionsCount++;
            }
          });
        }
      }

      // Check if user is viewing their own profile
      const isOwnProfile = currentUserId && currentUserId === userId;

      const publicProfile = {
        id: alumni.user_id,
        user_id: alumni.user_id,
        firstName: alumni.first_name,
        lastName: alumni.last_name,
        first_name: alumni.first_name,
        last_name: alumni.last_name,
        // Always show email/phone for own profile, otherwise respect privacy settings
        email: isOwnProfile ? alumni.email : (alumni.show_email ? alumni.email : null),
        phone: isOwnProfile ? alumni.phone : (alumni.show_phone ? alumni.phone : null),
        profile_picture: alumni.profile_picture,
        profilePicture: alumni.profile_picture,
        bio: alumni.bio,
        current_company: alumni.show_company ? alumni.current_company : null,
        currentCompany: alumni.show_company ? alumni.current_company : null,
        current_role: alumni.show_company ? alumni.current_role : null,
        current_position: alumni.show_company ? alumni.current_role : null,
        currentPosition: alumni.show_company ? alumni.current_role : null,
        industry: alumni.industry,
        experience: alumni.experience,
        current_city: alumni.show_location ? alumni.current_city : null,
        current_state: alumni.show_location ? alumni.current_state : null,
        current_country: alumni.show_location ? alumni.current_country : null,
        linkedin_url: alumni.linkedin_url,
        linkedinUrl: alumni.linkedin_url,
        github_url: alumni.github_url,
        githubUrl: alumni.github_url,
        twitter_url: alumni.twitter_url,
        twitterUrl: alumni.twitter_url,
        personal_website: alumni.personal_website,
        personalWebsite: alumni.personal_website,
        batch: alumni.show_education ? alumni.batch : null,
        graduation_year: alumni.show_education ? alumni.graduation_year : null,
        graduationYear: alumni.show_education ? alumni.graduation_year : null,
        course: alumni.show_education ? alumni.course : null,
        branch: alumni.show_education ? alumni.branch : null,
        roll_number: alumni.show_education ? alumni.roll_number : null,
        cgpa: alumni.show_education ? alumni.cgpa : null,
        gender: alumni.gender,
        expertise_areas: alumni.expertise_areas,
        volunteer_interests: alumni.volunteer_interests,
        is_verified: alumni.is_verified,
        is_batch_champion: alumni.is_batch_champion,
        // New additional fields
        expertiseAreas: alumni.expertise_areas,
        volunteerInterests: alumni.volunteer_interests,
        keywords: alumni.keywords,
        employment_status: alumni.employment_status,
        employmentStatus: alumni.employment_status,
        yearsOfExperience: alumni.years_of_experience,
        timezone: alumni.timezone,
        is_startup_founder: alumni.is_startup_founder,
        isStartupFounder: alumni.is_startup_founder,
        startup_name: alumni.startup_name,
        startupName: alumni.startup_name,
        startup_role: alumni.startup_role,
        startupRole: alumni.startup_role,
        funding_stage: alumni.funding_stage,
        fundingStage: alumni.funding_stage,
        founding_year: alumni.founding_year,
        foundingYear: alumni.founding_year,
        // Privacy settings
        show_email: alumni.show_email,
        showEmail: alumni.show_email,
        show_phone: alumni.show_phone,
        showPhone: alumni.show_phone,
        show_location: alumni.show_location,
        showLocation: alumni.show_location,
        show_company: alumni.show_company,
        showCompany: alumni.show_company,
        show_education: alumni.show_education,
        showEducation: alumni.show_education,
        // Detailed sections - ensure arrays are properly initialized and transformed
        education: alumni.show_education ? (Array.isArray(education) ? education : []) : [],
        experiences: Array.isArray(experiences) ? experiences : [],
        skills: Array.isArray(skills) ? skills : [],
        certifications: Array.isArray(certifications) ? certifications : [],
        languages: Array.isArray(languages) ? languages : [],
        achievements: Array.isArray(achievements) ? achievements : [],
        projects: Array.isArray(projects) ? projects : [],
        // Connection statistics
        totalConnections,
        mutualConnections: mutualConnectionsCount
      };

      // Debug logging to verify data is being returned
      // console.log(`[Public Profile] User: ${userId}, Skills: ${skills?.length || 0}, Achievements: ${achievements?.length || 0}, Certifications: ${certifications?.length || 0}`);

      res.json({ alumni: publicProfile, profile: publicProfile });
    } catch (error) {
      console.error("Get public profile error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });



  // Update privacy settings
  app.put("/api/profile/privacy", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "No user ID provided" });
      }

      // console.log("Privacy update request for user:", userId);
      // console.log("Privacy settings:", req.body);

      const {
        isProfilePublic,
        showEmail,
        showPhone,
        showLocation,
        showCompany,
        showEducation,
      } = req.body;

      // console.log("Processing privacy update for user:", userId, {
      //   showPhone,
      //   showLocation,
      //   showCompany,
      // });

      const { error } = await supabase
        .from("alumni")
        .update({
          is_profile_public: isProfilePublic ?? true,
          show_email: showEmail ?? false,
          show_phone: showPhone ?? false,
          show_location: showLocation ?? true,
          show_company: showCompany ?? true,
          show_education: showEducation ?? true,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (error) {
        console.error("Update privacy error:", error);
        return res
          .status(500)
          .json({ error: "Failed to update privacy settings" });
      }

      // console.log("Privacy settings updated successfully");
      res.json({ message: "Privacy settings updated successfully" });
    } catch (error) {
      console.error("Update privacy error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get LinkedIn integration status
  app.get("/api/profile/linkedin/status", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "No user ID provided" });
      }

      const { data: integration, error } = await supabase
        .from("linkedin_integrations")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Get LinkedIn status error:", error);
        return res.status(500).json({ error: "Failed to get LinkedIn status" });
      }

      res.json({
        connected: !!integration,
        integration: integration || null,
      });
    } catch (error) {
      console.error("Get LinkedIn status error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== LINKEDIN SIGN-IN ROUTES ====================

  // LinkedIn Sign-In - Start (no auth required — used from LoginPage)
  app.get("/api/auth/linkedin/login", async (req, res) => {
    try {
      const clientId = process.env.LINKEDIN_CLIENT_ID;
      const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

      if (!clientId || clientId === "undefined" || !clientSecret || clientSecret === "undefined") {
        console.error("[LinkedIn Login] Missing LINKEDIN_CLIENT_ID or LINKEDIN_CLIENT_SECRET");
        return res.redirect("/login?linkedin_error=not_configured");
      }

      const redirectUri = getLinkedInRedirectUri();
      const state = Buffer.from(JSON.stringify({ intent: "login" })).toString("base64");
      const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=openid%20profile%20email`;

      // Direct browser redirect — LoginPage uses window.location.href
      return res.redirect(authUrl);
    } catch (error) {
      console.error("[LinkedIn Login] Start error:", error);
      return res.redirect("/login?linkedin_error=token_exchange_failed");
    }
  });

  // Internal handler for LinkedIn login callback flow
  async function handleLinkedInLoginCallback(req: any, res: any, code: string) {
    try {
      const redirectUri = getLinkedInRedirectUri();

      // 1. Exchange code for access token
      const tokenResponse = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: process.env.LINKEDIN_CLIENT_ID || "",
          client_secret: process.env.LINKEDIN_CLIENT_SECRET || "",
          redirect_uri: redirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        const errText = await tokenResponse.text();
        console.error("[LinkedIn Login] Token exchange failed:", errText);
        return res.redirect("/login?linkedin_error=token_exchange_failed");
      }

      const tokenData = await tokenResponse.json();
      if (!tokenData.access_token) {
        return res.redirect("/login?linkedin_error=token_exchange_failed");
      }

      // 2. Extract LinkedIn profile data
      const linkedinData = await extractLinkedInData(tokenData.access_token);
      const linkedinEmail = linkedinData.email;
      const linkedinSub = linkedinData.profile?.sub;

      if (!linkedinEmail) {
        return res.redirect("/login?linkedin_error=no_email");
      }
      if (!linkedinSub) {
        return res.redirect("/login?linkedin_error=no_sub");
      }

      // 3. Check if linkedin_id is already linked to a user (Scenarios 3 & 9)
      const { data: existingIntegration } = await supabase
        .from("linkedin_integrations")
        .select("user_id")
        .eq("linkedin_id", linkedinSub)
        .maybeSingle();

      if (existingIntegration?.user_id) {
        const { data: linkedUser } = await supabase
          .from("users")
          .select("id, email, username, user_role, is_admin, account_approved, account_blocked, created_at, updated_at")
          .eq("id", existingIntegration.user_id)
          .maybeSingle();

        if (!linkedUser) {
          // Stale integration record — delete and continue
          await supabase.from("linkedin_integrations").delete().eq("linkedin_id", linkedinSub);
        } else if (linkedUser.account_blocked) {
          return res.redirect("/login?linkedin_error=account_blocked");
        } else if (linkedUser.is_admin || linkedUser.user_role === "administrator") {
          return res.redirect("/login?linkedin_error=admin_not_allowed");
        } else {
          // Scenario 3: returning user, LinkedIn already linked — issue JWT
          return issueJwtAndRedirect(res, linkedUser);
        }
      }

      // 4. No linkedin_id link found — try matching by email (Scenarios 4 & 5)
      const { data: emailMatchUser } = await supabase
        .from("users")
        .select("id, email, username, user_role, is_admin, account_approved, account_blocked, created_at, updated_at")
        .eq("email", linkedinEmail)
        .maybeSingle();

      if (emailMatchUser) {
        if (emailMatchUser.account_blocked) {
          return res.redirect("/login?linkedin_error=account_blocked");
        }
        if (emailMatchUser.is_admin || emailMatchUser.user_role === "administrator") {
          return res.redirect("/login?linkedin_error=admin_not_allowed");
        }
        // Scenario 4: email matches — link LinkedIn ID and log in
        await supabase.from("linkedin_integrations").upsert(
          {
            user_id: emailMatchUser.id,
            linkedin_id: linkedinSub,
            access_token: encryptToken(tokenData.access_token),
            token_expiry: new Date(Date.now() + (tokenData.expires_in || 5184000) * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
        return issueJwtAndRedirect(res, emailMatchUser);
      }

      // 5. No user found by linkedin_id or email — check signup requests (Scenarios 2 & 8)
      const { data: existingRequest } = await supabase
        .from("signup_requests")
        .select("id, status")
        .eq("email", linkedinEmail)
        .in("status", ["pending", "rejected"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingRequest?.status === "pending") {
        return res.redirect("/login?linkedin_error=signup_pending");
      }
      if (existingRequest?.status === "rejected") {
        return res.redirect("/login?linkedin_error=signup_rejected");
      }

      // Scenario 1: Brand new user — redirect to welcome page with pre-filled data
      const params = new URLSearchParams({
        li_fn: linkedinData.profile.given_name || "",
        li_ln: linkedinData.profile.family_name || "",
        li_email: linkedinEmail,
        li_pic: linkedinData.profile.picture || "",
        li_sub: linkedinSub,
      });
      return res.redirect(`/linkedin-welcome?${params.toString()}`);

    } catch (error) {
      console.error("[LinkedIn Login] Callback error:", error);
      return res.redirect("/login?linkedin_error=token_exchange_failed");
    }
  }

  // Internal helper: issue JWT and redirect to /feed
  async function issueJwtAndRedirect(res: any, user: any) {
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.user_role || "alumni", isAdmin: user.is_admin || false },
      JWT_SECRET,
      { expiresIn: "24h" }
    );
    await supabase.from("users").update({ updated_at: new Date().toISOString() }).eq("id", user.id);
    return res.redirect(`/feed?linkedin_signin=success&token=${encodeURIComponent(token)}`);
  }

  // ==================== LINKEDIN INTEGRATION ROUTES ====================

  // Debug endpoint to check LinkedIn configuration (development only)
  app.get("/api/auth/linkedin/debug", async (req, res) => {
    // Only allow in development environment
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ error: "Not found" });
    }

    try {
      const clientId = process.env.LINKEDIN_CLIENT_ID;
      const nodeEnv = process.env.NODE_ENV;
      const baseUrlEnv = process.env.BASE_URL;
      const port = process.env.PORT || 5000;

      // Use consistent redirect URI helper
      const redirectUri = getLinkedInRedirectUri();
      const baseUrl = redirectUri.replace('/api/auth/linkedin/callback', '');

      res.json({
        environment: {
          NODE_ENV: nodeEnv,
          BASE_URL: baseUrlEnv,
          PORT: port,
          isDevelopment: nodeEnv === 'development',
          baseUrlIncludesLocalhost: baseUrlEnv?.includes('localhost') || false,
        },
        computed: {
          baseUrl,
          redirectUri,
        },
        linkedin: {
          clientId: clientId ? `${clientId.substring(0, 5)}...` : 'NOT SET',
          hasClientSecret: !!process.env.LINKEDIN_CLIENT_SECRET,
        },
        instructions: {
          message: "Add this EXACT redirect URI to your LinkedIn app settings:",
          redirectUri: redirectUri,
          steps: [
            "1. Go to https://www.linkedin.com/developers/apps",
            `2. Select your app (Client ID: ${clientId})`,
            "3. Navigate to the 'Auth' tab",
            "4. Under 'OAuth 2.0 settings', add this redirect URL:",
            `   ${redirectUri}`,
            "5. Also add the production URL if not already added:",
            `   ${process.env.BASE_URL || process.env.TKS_URL || ''}/api/auth/linkedin/callback`,
            "6. Save changes",
          ]
        }
      });
    } catch (error) {
      res.status(500).json({
        error: "Failed to generate debug info",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // LinkedIn OAuth - Start
  app.get("/api/auth/linkedin", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      if (!userId) {
        console.error("[LinkedIn] No user ID provided");
        return res.status(401).json({ error: "Not authenticated" });
      }

      const clientId = process.env.LINKEDIN_CLIENT_ID;
      const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

      // Use consistent redirect URI helper
      const redirectUri = getLinkedInRedirectUri();
      const baseUrl = redirectUri.replace('/api/auth/linkedin/callback', '');

      // console.log("[LinkedIn] Environment check:", {
      //   NODE_ENV: process.env.NODE_ENV,
      //   BASE_URL: process.env.BASE_URL,
      //   hasClientId: !!clientId,
      //   hasClientSecret: !!clientSecret,
      //   computedBaseUrl: baseUrl,
      //   computedRedirectUri: redirectUri,
      //   clientIdPreview: clientId
      //     ? `${clientId.substring(0, 5)}...`
      //     : "MISSING",
      // });

      if (!clientId || clientId === "undefined") {
        console.error("[LinkedIn] CLIENT_ID is missing or undefined");
        return res.status(500).json({
          error: "LinkedIn integration not configured",
          details: "LINKEDIN_CLIENT_ID environment variable is not set",
        });
      }

      if (!clientSecret || clientSecret === "undefined") {
        console.error("[LinkedIn] CLIENT_SECRET is missing or undefined");
        return res.status(500).json({
          error: "LinkedIn integration not configured",
          details: "LINKEDIN_CLIENT_SECRET environment variable is not set",
        });
      }
      const state = Buffer.from(JSON.stringify({ userId })).toString("base64");

      const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=openid%20profile%20email`;

      // console.log("[LinkedIn] ========================================");
      // console.log("[LinkedIn] Generated OAuth Authorization URL");
      // console.log("[LinkedIn] ========================================");
      // console.log("[LinkedIn] Environment Variables:");
      // console.log("[LinkedIn]   NODE_ENV:", process.env.NODE_ENV);
      // console.log("[LinkedIn]   BASE_URL:", process.env.BASE_URL || "(not set, using default)");
      // console.log("[LinkedIn]   PORT:", process.env.PORT || "5000");
      // console.log("[LinkedIn] Computed Values:");
      // console.log("[LinkedIn]   Base URL:", baseUrl);
      // console.log("[LinkedIn]   Redirect URI (raw):", redirectUri);
      // console.log("[LinkedIn]   Redirect URI (encoded):", encodeURIComponent(redirectUri));
      // console.log("[LinkedIn]   Client ID:", clientId ? `${clientId.substring(0, 5)}...` : "MISSING");
      // console.log("[LinkedIn] ========================================");
      // console.log("[LinkedIn] ⚠️  CRITICAL: Verify Redirect URI in LinkedIn Developer Console");
      // console.log("[LinkedIn] This EXACT URL must be registered:");
      // console.log("[LinkedIn]", redirectUri);
      // console.log("[LinkedIn] Check for:");
      // console.log("[LinkedIn]   ✓ No trailing slash");
      // console.log("[LinkedIn]   ✓ Exact case matching");
      // console.log("[LinkedIn]   ✓ Correct protocol (https)");
      // console.log("[LinkedIn]   ✓ Exact path: /api/auth/linkedin/callback");
      // console.log("[LinkedIn] ========================================");

      res.json({ authUrl });
    } catch (error) {
      console.error("[LinkedIn] OAuth start error:", error);
      res.status(500).json({
        error: "Failed to initialize LinkedIn OAuth",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // LinkedIn OAuth - Callback with comprehensive data extraction
  app.get("/api/auth/linkedin/callback", async (req, res) => {
    try {
      const { code, state, error: oauthError, error_description } = req.query;

      // Handle OAuth errors from LinkedIn
      if (oauthError) {
        console.error("[LinkedIn] OAuth error from LinkedIn:", {
          error: oauthError,
          description: error_description,
        });
        return res.redirect(`/profile?linkedin=error&reason=${encodeURIComponent(error_description as string || 'OAuth authorization failed')}`);
      }

      if (!code || !state) {
        console.error("[LinkedIn] Missing code or state parameter");
        return res.redirect("/profile?linkedin=error&reason=missing_params");
      }

      let stateObj: { intent?: string; userId?: string };
      try {
        stateObj = JSON.parse(Buffer.from(state as string, "base64").toString());
        if (!stateObj || typeof stateObj !== "object") throw new Error("invalid state");
      } catch (err) {
        console.error("[LinkedIn] Invalid state parameter:", err);
        return res.redirect("/login?linkedin_error=invalid_state");
      }

      // Branch: login intent (new Sign In with LinkedIn flow) vs profile-sync intent (existing)
      if (stateObj.intent === "login") {
        return handleLinkedInLoginCallback(req, res, code as string);
      }

      // Existing profile-sync flow — requires userId in state
      const userId = stateObj.userId;
      if (!userId) {
        console.error("[LinkedIn] No userId in state and not a login intent");
        return res.redirect("/profile?linkedin=error&reason=invalid_state");
      }

      // console.log("[LinkedIn] Starting OAuth callback for user:", userId);

      // Use consistent redirect URI helper (MUST match authorization request)
      const redirectUri = getLinkedInRedirectUri();
      const baseUrl = redirectUri.replace('/api/auth/linkedin/callback', '');

      // console.log("[LinkedIn] Token exchange - using redirect URI:", {
      //   NODE_ENV: process.env.NODE_ENV,
      //   BASE_URL: process.env.BASE_URL,
      //   computedBaseUrl: baseUrl,
      //   computedRedirectUri: redirectUri,
      //   redirectUriForTokenExchange: redirectUri,
      // });

      // console.log("[LinkedIn] Exchanging code for token...");
      const tokenResponse = await fetch(
        "https://www.linkedin.com/oauth/v2/accessToken",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code: code as string,
            client_id: process.env.LINKEDIN_CLIENT_ID || "",
            client_secret: process.env.LINKEDIN_CLIENT_SECRET || "",
            redirect_uri: redirectUri, // Use the same redirect URI as authorization
          }),
        },
      );

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        let errorDetails: any = {
          status: tokenResponse.status,
          statusText: tokenResponse.statusText,
          error: errorText,
        };

        // Try to parse error details
        try {
          const errorJson = JSON.parse(errorText);
          errorDetails = { ...errorDetails, ...errorJson };
        } catch {
          // Not JSON, keep as text
        }

        console.error("[LinkedIn] Token exchange failed:", {
          ...errorDetails,
          redirectUriUsed: redirectUri,
          redirectUriEncoded: encodeURIComponent(redirectUri),
          baseUrl: baseUrl,
          environment: {
            NODE_ENV: process.env.NODE_ENV,
            BASE_URL: process.env.BASE_URL,
          },
        });

        // If it's a redirect_uri mismatch, provide specific guidance
        if (errorText.includes('redirect_uri') || errorText.includes('redirect_uri_mismatch')) {
          console.error("[LinkedIn] ⚠️ REDIRECT URI MISMATCH DETECTED!");
          console.error("[LinkedIn] The redirect URI used was:", redirectUri);
          console.error("[LinkedIn] Please verify this EXACT URL is registered in LinkedIn Developer Console:");
          console.error("[LinkedIn]", redirectUri);
          console.error("[LinkedIn] URL must match EXACTLY (no trailing slash, case-sensitive, exact protocol)");
        }

        return res.redirect(`/profile?linkedin=error&reason=token_exchange_failed&details=${encodeURIComponent(errorText.substring(0, 200))}`);
      }

      const tokenData = await tokenResponse.json();
      // console.log("[LinkedIn] Token obtained successfully:", {
      //   expires_in: tokenData.expires_in,
      //   has_access_token: !!tokenData.access_token,
      //   has_refresh_token: !!tokenData.refresh_token,
      //   scope: tokenData.scope,
      // });

      if (!tokenData.access_token) {
        console.error("[LinkedIn] No access token in response");
        return res.redirect("/profile?linkedin=error&reason=no_access_token");
      }

      // Comprehensive data extraction
      // console.log("[LinkedIn] Extracting user data from LinkedIn API...");
      const linkedinData = await extractLinkedInData(tokenData.access_token);
      // console.log("[LinkedIn] Data extracted successfully:", {
      //   has_profile: !!linkedinData.profile,
      //   has_email: !!linkedinData.email,
      //   linkedin_id: linkedinData.profile?.sub,
      // });

      // Save integration record with proper error handling
      // console.log("[LinkedIn] Saving integration record to database...");
      const integrationData: any = {
        user_id: userId,
        linkedin_id: linkedinData.profile.sub || null,
        access_token: encryptToken(tokenData.access_token),  // ✅ Encrypted for security
        refresh_token: tokenData.refresh_token ? encryptToken(tokenData.refresh_token) : null,  // ✅ Encrypted for security
        token_expiry: new Date(
          Date.now() + (tokenData.expires_in || 5184000) * 1000,
        ).toISOString(),
        sync_enabled: true,
        sync_fields: ["profile_photo", "basic_info"],
        profile_data: JSON.stringify(linkedinData),  // ✅ Convert to JSON string
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: integrationResult, error: integrationError } = await supabase
        .from("linkedin_integrations")
        .upsert(integrationData, {
          onConflict: "user_id",
        })
        .select()
        .single();

      if (integrationError) {
        console.error("[LinkedIn] Integration save error:", {
          error: integrationError,
          code: integrationError.code,
          message: integrationError.message,
          details: integrationError.details,
          hint: integrationError.hint,
          data: integrationData,  // ✅ Log what we tried to save
        });

        // Check if table exists
        if (integrationError.code === '42P01') {  // undefined_table
          console.error("[LinkedIn] CRITICAL: linkedin_integrations table does not exist! Run FIX_LINKEDIN_INTEGRATION.sql");
          return res.redirect(`/profile?linkedin=error&reason=table_missing`);
        }

        return res.redirect(`/profile?linkedin=error&reason=db_save_failed&code=${integrationError.code}`);
      }

      // console.log("[LinkedIn] Integration record saved successfully:", {
      //   id: integrationResult?.id,
      //   user_id: integrationResult?.user_id,
      // });

      // Process and save extracted data to alumni profile
      /* 
      // DISABLED: We want to ask the user to confirm fields before syncing
      console.log("[LinkedIn] Processing LinkedIn data to alumni profile...");
      try {
        await processLinkedInDataToAlumni(userId, linkedinData);
        console.log("[LinkedIn] Alumni profile updated successfully");
      } catch (alumniError) {
        console.error("[LinkedIn] Alumni update error (non-fatal):", alumniError);
        // Don't fail the entire flow if alumni update fails
      }
      */
      // console.log("[LinkedIn] Skipping auto-sync to allow user confirmation on frontend");
      // console.log("[LinkedIn] OAuth flow completed successfully");
      res.redirect("/profile?linkedin=connected");
    } catch (error) {
      console.error("[LinkedIn] Callback error:", {
        error,
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.redirect("/profile?linkedin=error&reason=internal_error");
    }
  });

  // Helper function to extract LinkedIn data using available OpenID Connect endpoints
  // Note: LinkedIn API v2 only provides basic profile data via OpenID Connect (openid, profile, email scopes)
  // Work experience, education, and skills endpoints require deprecated r_fullprofile scope which is no longer available
  async function extractLinkedInData(accessToken: string) {
    const headers = { Authorization: `Bearer ${accessToken}` };

    try {
      // console.log("[LinkedIn] Fetching user profile from LinkedIn API...");

      // Basic profile information via OpenID Connect userinfo endpoint
      // This is the only reliable endpoint available with standard Sign In with LinkedIn
      const profileResponse = await fetch(
        "https://api.linkedin.com/v2/userinfo",
        { headers },
      );

      if (!profileResponse.ok) {
        const errorText = await profileResponse.text();
        console.error(
          "[LinkedIn] Userinfo fetch failed:",
          profileResponse.status,
          errorText,
        );
        if (profileResponse.status === 401) {
          throw { status: 401, message: "Invalid access token" };
        }
        throw new Error(`LinkedIn API error: ${profileResponse.status} - ${errorText}`);
      }

      const profile = await profileResponse.json();
      // console.log("[LinkedIn] Profile data received:", {
      //   hasName: !!profile.name,
      //   hasGivenName: !!profile.given_name,
      //   hasFamilyName: !!profile.family_name,
      //   hasEmail: !!profile.email,
      //   hasPicture: !!profile.picture,
      //   hasLocale: !!profile.locale,
      //   sub: profile.sub ? "present" : "missing",
      // });

      // Email is included in userinfo response with OpenID Connect
      const email = profile.email || null;

      // Extract name parts - LinkedIn returns both combined name and separate parts
      const givenName = profile.given_name || (profile.name ? profile.name.split(' ')[0] : null);
      const familyName = profile.family_name || (profile.name ? profile.name.split(' ').slice(1).join(' ') : null);

      // Create enhanced profile object with all available data
      const rawProfile = profile as any;
      const enhancedProfile = {
        sub: profile.sub, // LinkedIn unique identifier
        name: profile.name,
        given_name: givenName,
        family_name: familyName,
        picture: profile.picture,
        email: email,
        email_verified: profile.email_verified || false,
        locale: profile.locale || "en_US",
        // Opportunistic fields
        headline: rawProfile.headline || null,
        summary: rawProfile.summary || rawProfile.bio || null,
        // Store raw profile for reference
        raw: profile,
      };

      // console.log("[LinkedIn] Enhanced profile created:", {
      //   id: enhancedProfile.sub,
      //   name: enhancedProfile.name,
      //   email: enhancedProfile.email,
      //   hasPicture: !!enhancedProfile.picture,
      // });

      return {
        profile: enhancedProfile,
        email,
        details: rawProfile.details || {},
        positions: Array.isArray(rawProfile.positions?.values) ? rawProfile.positions.values : (Array.isArray(rawProfile.positions) ? rawProfile.positions : []),
        educations: Array.isArray(rawProfile.educations?.values) ? rawProfile.educations.values : (Array.isArray(rawProfile.educations) ? rawProfile.educations : []),
        skills: Array.isArray(rawProfile.skills?.values) ? rawProfile.skills.values : (Array.isArray(rawProfile.skills) ? rawProfile.skills : []),
        extractedAt: new Date().toISOString(),
        apiVersion: "v2_openid_connect",
        apiLimitations: {
          message:
            "LinkedIn API v2 only provides basic profile data (name, email, photo) via OpenID Connect. Work experience, education, and skills require deprecated scopes that are no longer available.",
          availableData: ["name", "email", "profile_picture", "linkedin_id", "locale"],
          unavailableData: [
            "work_experience",
            "education",
            "skills",
            "positions",
            "headline",
            "summary",
            "industry",
            "location",
          ],
          recommendation: "Users should manually enter work experience, education, and skills in their profile.",
        },
      };
    } catch (error) {
      console.error("[LinkedIn] Data extraction error:", {
        error,
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  // Helper function to process LinkedIn data and update alumni profile
  async function processLinkedInDataToAlumni(
    userId: string,
    linkedinData: any,
  ) {
    try {
      // console.log("[LinkedIn] Processing profile data for user:", userId);

      const { profile, email } = linkedinData;

      // Get current alumni record to check what exists
      const { data: currentAlumni, error: fetchError } = await supabase
        .from("alumni")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (fetchError) {
        console.error("[LinkedIn] Error fetching current alumni profile:", fetchError);
        throw fetchError;
      }

      // Prepare update object with intelligent merging
      const updateData: any = {
        linkedin_synced: true,
        linkedin_profile_url: `https://www.linkedin.com/in/${profile.sub}`,
        linkedin_photo_url: profile.picture || null,
        updated_at: new Date().toISOString(),
      };

      // Only update basic fields if they're empty or user hasn't customized them
      if (!currentAlumni?.first_name && profile.given_name) {
        updateData.first_name = profile.given_name;
        // console.log("[LinkedIn] Updating first_name:", profile.given_name);
      }

      if (!currentAlumni?.last_name && profile.family_name) {
        updateData.last_name = profile.family_name;
        // console.log("[LinkedIn] Updating last_name:", profile.family_name);
      }

      if (!currentAlumni?.email && email) {
        updateData.email = email;
        // console.log("[LinkedIn] Updating email:", email);
      }

      // Always update profile picture if available from LinkedIn
      // Update profile picture - PRIORITIZE MANUAL PICTURES
      // Only update from LinkedIn if there's no manual picture already set
      if (profile.picture) {
        // Fetch current alumni data to check existing picture
        const { data: currentAlumni } = await supabase
          .from("alumni")
          .select("profile_picture, linkedin_photo_url")
          .eq("user_id", userId)
          .single();

        // Always update the source LinkedIn URL
        updateData.linkedin_photo_url = profile.picture;

        const manualPictureExists = currentAlumni?.profile_picture &&
          currentAlumni.profile_picture !== currentAlumni.linkedin_photo_url;

        if (!manualPictureExists) {
          updateData.profile_picture = profile.picture;
          // console.log("[LinkedIn] Updating profile_picture from LinkedIn (no manual picture found)");
        } else {
          // console.log("[LinkedIn] Keeping existing manual profile_picture, updated linkedin_photo_url only");
        }
      }

      // Note: Since LinkedIn API v2 doesn't provide work experience, education, skills, etc.
      // we only sync basic profile information. The API limitations are documented in linkedinData.
      // Users will need to manually enter professional details.

      // console.log(
      //   "[LinkedIn] Updating alumni profile with fields:",
      //   Object.keys(updateData),
      // );

      // Update alumni record
      const { error: updateError } = await supabase
        .from("alumni")
        .update(updateData)
        .eq("user_id", userId);

      if (updateError) {
        console.error("[LinkedIn] Alumni update error:", updateError);
        throw updateError;
      }

      // console.log("[LinkedIn] Alumni profile updated successfully");

      // Create notification for user
      try {
        const linkedinContent = "Your LinkedIn profile has been successfully connected! Basic profile information has been synced. Please manually add your work experience, education, and skills.";
        await supabase.from("notifications").insert({
          user_id: userId,
          type: "linkedin_sync",
          title: "LinkedIn Connected",
          content: linkedinContent,
          is_read: false,
        });
        // console.log("[LinkedIn] Notification created for user");
      } catch (notifError) {
        // Don't fail if notification creation fails
        console.error("[LinkedIn] Failed to create notification (non-fatal):", notifError);
      }
    } catch (error) {
      console.error("[LinkedIn] processLinkedInDataToAlumni error:", {
        error,
        message: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  // Compare LinkedIn Data with local profile
  app.get("/api/profile/linkedin/compare", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Get LinkedIn integration
      const { data: integration } = await supabase
        .from("linkedin_integrations")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (!integration) {
        return res.status(404).json({ error: "LinkedIn not connected" });
      }

      // Check token expiry
      const tokenExpiry = new Date(integration.token_expiry || 0);
      if (tokenExpiry < new Date()) {
        return res.status(401).json({
          error: "LinkedIn token expired",
          message: "Please reconnect your LinkedIn account",
        });
      }

      // Extract fresh data from LinkedIn
      // Decrypt token first
      const decryptedToken = decryptToken(integration.access_token);
      if (!decryptedToken) {
        throw { status: 401, message: "Invalid access token (decryption failed)" };
      }
      const linkedinData = await extractLinkedInData(decryptedToken);

      // Get current alumni data
      const { data: data } = await supabase
        .from("alumni")
        .select("first_name, last_name, email, profile_picture, bio, current_company, current_role")
        .eq("user_id", userId)
        .single();

      const currentAlumni = data as any;

      if (!currentAlumni) {
        return res.status(404).json({ error: "Alumni profile not found" });
      }

      const mismatches = [];

      // Compare Full Name
      const linkedinFirstName = linkedinData.profile.given_name || '';
      const linkedinLastName = linkedinData.profile.family_name || '';

      if (linkedinFirstName && currentAlumni.first_name !== linkedinFirstName) {
        mismatches.push({
          field: 'first_name',
          label: 'First Name',
          current: currentAlumni.first_name,
          linkedin: linkedinFirstName
        });
      }

      if (linkedinLastName && currentAlumni.last_name !== linkedinLastName) {
        mismatches.push({
          field: 'last_name',
          label: 'Last Name',
          current: currentAlumni.last_name,
          linkedin: linkedinLastName
        });
      }

      // Compare Email
      // console.log(`[LinkedIn] Comparing Email: Current '${currentAlumni.email}' vs LinkedIn '${linkedinData.email}'`);
      if (linkedinData.email && currentAlumni.email !== linkedinData.email) {
        mismatches.push({
          field: 'email',
          label: 'Email Address',
          current: currentAlumni.email,
          linkedin: linkedinData.email
        });
      }


      // Compare Profile Picture
      // console.log(`[LinkedIn] Comparing Picture: Current '${currentAlumni.profile_picture}' vs LinkedIn '${linkedinData.profile.picture}'`);
      if (linkedinData.profile.picture && currentAlumni.profile_picture !== linkedinData.profile.picture) {
        mismatches.push({
          field: 'profile_picture',
          label: 'Profile Picture',
          current: currentAlumni.profile_picture ? 'Current Photo' : 'No Photo',
          currentUrl: currentAlumni.profile_picture,
          linkedin: 'LinkedIn Photo',
          linkedinUrl: linkedinData.profile.picture
        });
      }

      res.json({
        hasMismatches: mismatches.length > 0,
        mismatches
      });
    } catch (error: any) {
      console.error("[LinkedIn] Comparison error:", error);
      if (error.status === 401) {
        return res.status(401).json({
          error: "LinkedIn token expired",
          message: "Please reconnect your LinkedIn account"
        });
      }
      res.status(500).json({ error: "Failed to compare LinkedIn data" });
    }
  });

  // Sync LinkedIn Data with comprehensive extraction
  app.post("/api/profile/linkedin/sync", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { syncFields, requestedFields, forceOverwrite = false } = req.body;

      // console.log("[LinkedIn] Manual sync requested by user:", userId);
      // console.log("[LinkedIn] Sync categories:", syncFields);
      // console.log("[LinkedIn] Specific fields requested:", requestedFields);
      // console.log("[LinkedIn] Force overwrite:", forceOverwrite);

      // Get LinkedIn integration
      const { data: integration } = await supabase
        .from("linkedin_integrations")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (!integration) {
        return res.status(404).json({ error: "LinkedIn not connected" });
      }

      // Check token expiry
      const tokenExpiry = new Date(integration.token_expiry);
      if (tokenExpiry < new Date()) {
        return res.status(401).json({
          error: "LinkedIn token expired",
          message: "Please reconnect your LinkedIn account",
        });
      }

      // Extract fresh data from LinkedIn
      // Decrypt token first
      const decryptedToken = decryptToken(integration.access_token);
      if (!decryptedToken) {
        throw { status: 401, message: "Invalid access token (decryption failed)" };
      }
      const linkedinData = await extractLinkedInData(decryptedToken);
      // console.log("[LinkedIn] Fresh data extracted");

      // Get current alumni data
      const { data: currentAlumni } = await supabase
        .from("alumni")
        .select("*")
        .eq("user_id", userId)
        .single();

      const updateData: any = {
        linkedin_synced: true,
        linkedin_profile_url: `https://www.linkedin.com/in/${linkedinData.profile.sub}`,
        linkedin_photo_url: linkedinData.profile.picture || null,
        updated_at: new Date().toISOString(),
      };

      // Helper to check if a field should be updated
      const shouldUpdate = (category: string, field: string, currentValue: any) => {
        // If specific fields are requested, only update those
        if (requestedFields && requestedFields.length > 0) {
          return requestedFields.includes(field);
        }
        // Fallback to category-based sync and forceOverwrite/empty check
        return syncFields.includes(category) && (forceOverwrite || !currentValue);
      };

      // Profile photo sync
      if (linkedinData.profile.picture && shouldUpdate("profile_photo", "profile_picture", currentAlumni?.profile_picture)) {
        updateData.profile_picture = linkedinData.profile.picture;
        updateData.linkedin_photo_url = linkedinData.profile.picture;
      }

      // Basic info sync
      if (linkedinData.profile.given_name && shouldUpdate("basic_info", "first_name", currentAlumni?.first_name)) {
        updateData.first_name = linkedinData.profile.given_name;
      }
      if (linkedinData.profile.family_name && shouldUpdate("basic_info", "last_name", currentAlumni?.last_name)) {
        updateData.last_name = linkedinData.profile.family_name;
      }
      if (linkedinData.email && shouldUpdate("basic_info", "email", currentAlumni?.email)) {
        updateData.email = linkedinData.email;
      }
      if ((linkedinData.profile as any).summary && shouldUpdate("basic_info", "bio", currentAlumni?.bio)) {
        updateData.bio = (linkedinData.profile as any).summary.substring(0, 500);
      }


      // Legacy/Bulk sync for calculated fields (experience, etc.)
      if (!requestedFields || requestedFields.length === 0) {
        // Calculate experience
        if (
          syncFields.includes("work_experience") &&
          linkedinData.positions?.length > 0
        ) {
          const totalMonths = linkedinData.positions.reduce(
            (sum: number, pos: any) => {
              if (pos.timePeriod?.startDate) {
                const start = new Date(
                  pos.timePeriod.startDate.year,
                  pos.timePeriod.startDate.month || 0,
                );
                const end = pos.timePeriod.endDate
                  ? new Date(
                    pos.timePeriod.endDate.year,
                    pos.timePeriod.endDate.month || 0,
                  )
                  : new Date();
                return (
                  sum +
                  Math.round(
                    (end.getTime() - start.getTime()) /
                    (1000 * 60 * 60 * 24 * 30),
                  )
                );
              }
              return sum;
            },
            0,
          );

          if (totalMonths > 0 && (forceOverwrite || !currentAlumni?.experience)) {
            const years = Math.floor(totalMonths / 12);
            const months = totalMonths % 12;
            updateData.experience = `${years} years${months > 0 ? ` ${months} months` : ""}`;
          }
        }

        // Education sync
        if (
          syncFields.includes("education") &&
          linkedinData.educations?.length > 0
        ) {
          const latestEducation: Record<string, any> = linkedinData.educations[0];

          if (forceOverwrite || !currentAlumni?.university) {
            updateData.university = latestEducation.schoolName || null;
          }
          if (forceOverwrite || !currentAlumni?.course) {
            updateData.course = latestEducation.fieldOfStudy || null;
          }
          if (forceOverwrite || !currentAlumni?.higher_education) {
            updateData.higher_education = latestEducation.degreeName || null;
          }
          if (
            latestEducation.timePeriod?.endDate?.year &&
            (forceOverwrite || !currentAlumni?.graduation_year)
          ) {
            updateData.graduation_year = latestEducation.timePeriod.endDate.year;
            updateData.batch = latestEducation.timePeriod.endDate.year.toString();
          }
        }

        // Skills sync
        if (syncFields.includes("skills") && linkedinData.skills?.length > 0) {
          if (forceOverwrite || !currentAlumni?.skills) {
            const skillNames = linkedinData.skills
              .map((s: Record<string, any>) => s.name?.localized?.en_US || s.name)
              .filter(Boolean);
            updateData.skills = JSON.stringify(skillNames);
          }
        }

        // Location sync
        if (syncFields.includes("location") && (linkedinData.profile as Record<string, any>).location) {
          if (forceOverwrite || !currentAlumni?.current_city) {
            const locationParts = (linkedinData.profile as Record<string, any>).location
              .split(",")
              .map((s: string) => s.trim());
            updateData.current_city = locationParts[0] || null;
            if (locationParts.length > 1) {
              updateData.current_country =
                locationParts[locationParts.length - 1] || null;
            }
          }
        }

        // Industry
        if (syncFields.includes("industry") && (linkedinData.profile as Record<string, any>).industry) {
          if (forceOverwrite || !currentAlumni?.industry) {
            updateData.industry = (linkedinData.profile as Record<string, any>).industry || null;
          }
        }
      }

      // console.log(
      //   "[LinkedIn] Prepared update with fields:",
      //   Object.keys(updateData),
      // );

      // Update alumni profile
      if (Object.keys(updateData).length > 1) {
        // More than just updated_at
        const { error: updateError } = await supabase
          .from("alumni")
          .update(updateData)
          .eq("user_id", userId);

        if (updateError) {
          console.error("[LinkedIn] Alumni update error:", updateError);
          throw updateError;
        }

      }

      // Update integration record
      await supabase
        .from("linkedin_integrations")
        .update({
          sync_fields: syncFields,
          profile_data: JSON.stringify(linkedinData),
          last_sync_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      // Create notification
      const syncContent = `Successfully synced ${syncFields.length} data categories from LinkedIn`;
      await supabase.from("notifications").insert({
        user_id: userId,
        type: "linkedin_sync",
        title: "LinkedIn Synced",
        content: syncContent,
        is_read: false,
      });

      res.json({
        message: "LinkedIn data synced successfully",
        updatedFields: Object.keys(updateData).filter(
          (k) => k !== "updated_at",
        ),
      });
    } catch (error) {
      console.error("[LinkedIn] Sync error:", error);
      if ((error as any).status === 401) {
        return res.status(401).json({
          error: "LinkedIn token expired",
          message: "Please reconnect your LinkedIn account"
        });
      }
      res.status(500).json({ error: "Failed to sync LinkedIn data" });
    }
  });

  // Disconnect LinkedIn
  app.delete("/api/profile/linkedin", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      await supabase
        .from("linkedin_integrations")
        .delete()
        .eq("user_id", userId);

      await supabase
        .from("alumni")
        .update({
          linkedin_synced: false,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      res.json({ message: "LinkedIn disconnected successfully" });
    } catch (error) {
      console.error("LinkedIn disconnect error:", error);
      res.status(500).json({ error: "Failed to disconnect LinkedIn" });
    }
  });

  // Get applicants for a specific job (poster only)
  app.get("/api/jobs/:id/applicants", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const jobId = req.params.id;

      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Verify the job exists and belongs to the user
      const { data: job, error: jobError } = await supabase
        .from("jobs")
        .select("posted_by")
        .eq("id", jobId)
        .single();

      if (jobError || !job) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (job.posted_by !== userId) {
        return res
          .status(403)
          .json({ error: "Unauthorized access to applicants" });
      }

      // Fetch applications with user details
      const { data: applications, error: appError } = await supabase
        .from("job_applications")
        .select(
          `
          *,
          user:users!user_id(
            id, 
            username, 
            email
          )
        `,
        )
        .eq("job_id", jobId)
        .order("created_at", { ascending: false });

      if (appError) {
        console.error("Fetch applicants error:", appError);
        return res.status(500).json({ error: "Failed to fetch applicants" });
      }

      // Fetch alumni profiles for the applicants
      const applicantUserIds = applications.map((a: Record<string, any>) => a.user_id);
      const { data: profiles } = await supabase
        .from("alumni")
        .select("*")
        .in("user_id", applicantUserIds);

      const applicantsWithProfiles = applications.map((app: Record<string, any>) => ({
        ...app,
        profile: profiles?.find((p: Record<string, any>) => p.user_id === app.user_id) || null,
      }));

      res.json({ applicants: applicantsWithProfiles });
    } catch (error) {
      console.error("Applicants route error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // LinkedIn Integration Testing Endpoint
  app.get("/api/test/linkedin", async (req, res) => {
    if (process.env.NODE_ENV === "production") {
      return res.status(404).json({ error: "Not found" });
    }
    try {
      const userId = req.headers["user-id"] as string;

      // console.log("=== LinkedIn Integration Test Started ===");
      // console.log("User ID:", userId);

      const results = {
        timestamp: new Date().toISOString(),
        environment: {
          hasSupabaseUrl: !!process.env.SUPABASE_URL,
          hasSupabaseKey: !!process.env.SUPABASE_ANON_KEY,
          hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        },
        tables: {} as Record<string, any>,
        errors: [] as string[],
        summary: {
          totalTables: 0,
          workingTables: 0,
          failedTables: 0,
        },
        testSummary: "",
        tests: {
          environmentVariables: { passed: false, details: {} as any },
          databaseConnection: { passed: false, details: {} as any },
          tableExists: { passed: false, details: {} as any },
          oauthUrlGeneration: { passed: false, details: {} as any },
          integrationCRUD: { passed: false, details: {} as any },
        }
      };

      // Test 1: Environment Variables
      // console.log("[Test 1] Checking environment variables...");
      const clientId = process.env.LINKEDIN_CLIENT_ID;
      const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
      const baseUrl = process.env.BASE_URL;

      results.tests.environmentVariables.details = {
        LINKEDIN_CLIENT_ID: clientId
          ? `SET (${clientId.substring(0, 5)}...)`
          : "MISSING",
        LINKEDIN_CLIENT_SECRET: clientSecret
          ? `SET (${clientSecret.substring(0, 10)}...)`
          : "MISSING",
        BASE_URL: baseUrl || "MISSING (will use default)",
      };

      if (
        clientId &&
        clientId !== "undefined" &&
        clientSecret &&
        clientSecret !== "undefined"
      ) {
        results.tests.environmentVariables.passed = true;
        // console.log("[Test 1] ✓ Environment variables are set");
      } else {
        results.errors.push(
          "Environment variables LINKEDIN_CLIENT_ID or LINKEDIN_CLIENT_SECRET are missing",
        );
        // console.log("[Test 1] ✗ Environment variables missing");
      }

      // Test 2: Database Connection
      // console.log("[Test 2] Testing database connection...");
      try {
        const { data: testQuery, error: dbError } = await supabase
          .from("users")
          .select("id")
          .limit(1);

        if (!dbError) {
          results.tests.databaseConnection.passed = true;
          results.tests.databaseConnection.details = {
            status: "Connected",
            rowsFetched: testQuery?.length || 0,
          };
          // console.log("[Test 2] ✓ Database connection successful");
        } else {
          results.errors.push(`Database connection failed: ${dbError.message}`);
          results.tests.databaseConnection.details = { error: dbError.message };
          // console.log(
          //   "[Test 2] ✗ Database connection failed:",
          //   dbError.message,
          // );
        }
      } catch (err) {
        results.errors.push(
          `Database connection error: ${err instanceof Error ? err.message : "Unknown"}`,
        );
        // console.log("[Test 2] ✗ Database connection error:", err);
      }

      // Test 3: LinkedIn Integrations Table
      // console.log("[Test 3] Checking linkedin_integrations table...");
      try {
        const { data: tableCheck, error: tableError } = await supabase
          .from("linkedin_integrations")
          .select("id")
          .limit(1);

        if (!tableError || tableError.code === "PGRST116") {
          results.tests.tableExists.passed = true;
          results.tests.tableExists.details = {
            exists: true,
            recordCount: tableCheck?.length || 0,
            message: "Table is accessible",
          };
          // console.log("[Test 3] ✓ Table exists and is accessible");
        } else {
          results.errors.push(`Table check failed: ${tableError.message}`);
          results.tests.tableExists.details = { error: tableError.message };
          // console.log("[Test 3] ✗ Table check failed:", tableError.message);
        }
      } catch (err) {
        results.errors.push(
          `Table check error: ${err instanceof Error ? err.message : "Unknown"}`,
        );
        // console.log("[Test 3] ✗ Table check error:", err);
      }

      // Test 4: OAuth URL Generation
      // console.log("[Test 4] Testing OAuth URL generation...");
      if (clientId && clientId !== "undefined") {
        try {
          const redirectUri = `${baseUrl || getBaseUrl()}/api/auth/linkedin/callback`;
          const testState = Buffer.from(
            JSON.stringify({ userId: "test-user" }),
          ).toString("base64");
          const testAuthUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${testState}&scope=profile%20email%20openid`;

          results.tests.oauthUrlGeneration.passed = true;
          results.tests.oauthUrlGeneration.details = {
            redirectUri,
            urlGenerated: true,
            urlLength: testAuthUrl.length,
            scope: "profile email openid",
          };
          // console.log("[Test 4] ✓ OAuth URL generated successfully");
        } catch (err) {
          results.errors.push(
            `OAuth URL generation failed: ${err instanceof Error ? err.message : "Unknown"}`,
          );
          // console.log("[Test 4] ✗ OAuth URL generation failed:", err);
        }
      } else {
        results.errors.push(
          "Cannot test OAuth URL generation without CLIENT_ID",
        );
        // console.log("[Test 4] ✗ Skipped - CLIENT_ID missing");
      }

      // Test 5: Integration CRUD Operations
      // console.log("[Test 5] Testing integration CRUD operations...");
      if (userId && results.tests.tableExists.passed) {
        try {
          // Check if integration exists
          const { data: existingIntegration } = await supabase
            .from("linkedin_integrations")
            .select("*")
            .eq("user_id", userId)
            .single();

          if (existingIntegration) {
            results.tests.integrationCRUD.passed = true;
            results.tests.integrationCRUD.details = {
              operation: "READ",
              status: "Existing integration found",
              integrationId: existingIntegration.id,
              linkedinId: existingIntegration.linkedin_id || "Not set",
              syncEnabled: existingIntegration.sync_enabled,
              lastSync: existingIntegration.last_sync_at || "Never",
            };
            // console.log("[Test 5] ✓ Existing integration found");
          } else {
            // Try creating a test integration
            const { data: testIntegration, error: createError } = await supabase
              .from("linkedin_integrations")
              .insert({
                user_id: userId,
                linkedin_id: "test-linkedin-id",
                sync_enabled: false,
                profile_data: JSON.stringify({ test: true }),
              })
              .select()
              .single();

            if (!createError && testIntegration) {
              results.tests.integrationCRUD.passed = true;
              results.tests.integrationCRUD.details = {
                operation: "CREATE",
                status: "Test integration created successfully",
                integrationId: testIntegration.id,
              };

              // Clean up test integration
              await supabase
                .from("linkedin_integrations")
                .delete()
                .eq("id", testIntegration.id);

              // console.log("[Test 5] ✓ CRUD operations successful");
            } else {
              results.errors.push(
                `CRUD test failed: ${createError?.message || "Unknown error"}`,
              );
              results.tests.integrationCRUD.details = {
                error: createError?.message,
              };
              // console.log("[Test 5] ✗ CRUD test failed:", createError);
            }
          }
        } catch (err) {
          results.errors.push(
            `CRUD operations error: ${err instanceof Error ? err.message : "Unknown"}`,
          );
          // console.log("[Test 5] ✗ CRUD operations error:", err);
        }
      } else {
        results.errors.push(
          "Cannot test CRUD operations without userId or table access",
        );
        // console.log("[Test 5] ✗ Skipped - Prerequisites not met");
      }

      // Generate Summary
      const passedTests = Object.values(results.tests).filter(
        (t) => t.passed,
      ).length;
      const totalTests = Object.keys(results.tests).length;
      results.testSummary = `${passedTests}/${totalTests} tests passed`;

      // console.log("=== LinkedIn Integration Test Completed ===");
      // console.log("Summary:", results.testSummary);
      // console.log("Errors:", results.errors.length);

      res.json({
        success: passedTests === totalTests,
        results,
      });
    } catch (error) {
      console.error("[LinkedIn Test] Fatal error:", error);
      res.status(500).json({
        success: false,
        error: "Test suite failed",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // ==================== CONNECTION REQUESTSROUTES ====================

  // ==================== CONNECTION REQUESTS ROUTES ====================

  // Send connection request
  app.post("/api/connections/request", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const { recipientId, message } = req.body;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!recipientId) {
        return res.status(400).json({ error: "Recipient ID is required" });
      }

      if (userId === recipientId) {
        return res.status(400).json({ error: "Cannot connect with yourself" });
      }

      // Check if request already exists
      const { data: existingRequest } = await supabase
        .from("connection_requests")
        .select("*")
        .or(
          `and(requester_id.eq.${userId},recipient_id.eq.${recipientId}),and(requester_id.eq.${recipientId},recipient_id.eq.${userId})`
        )
        .maybeSingle();

      if (existingRequest) {
        if (existingRequest.status === "pending") {
          return res.status(400).json({ error: "Connection request already pending" });
        } else if (existingRequest.status === "accepted") {
          return res.status(400).json({ error: "Already connected" });
        } else if (existingRequest.status === "rejected") {
          // Allow re-sending if rejected, update status to pending
          const { error: updateError } = await supabase
            .from("connection_requests")
            .update({
              status: "pending",
              updated_at: new Date().toISOString()
            })
            .eq("id", existingRequest.id);

          if (updateError) throw updateError;

          // Notify again
          // Fetch user details for notification
          const { data: senderAlumni } = await supabase
            .from("alumni")
            .select("first_name, last_name")
            .eq("user_id", userId)
            .single();

          const senderName = senderAlumni ? `${senderAlumni.first_name} ${senderAlumni.last_name}` : "An alumni";

          const connectionContent = `${senderName} wants to connect with you`;
          await supabase.from("notifications").insert({
            user_id: recipientId,
            type: "connection_request",
            title: "New Connection Request",
            content: connectionContent,
            related_id: userId,
            is_read: false,
          });

          // Emit socket event
          const io = (global as any).io;
          if (io) {
            io.to(`user:${recipientId}`).emit("notification", {
              type: "connection_request",
              title: "New Connection Request",
              content: `${senderName} wants to connect with you`,
              related_id: userId,
              redirect_url: "/connections"
            });
          }

          return res.json({ message: "Connection request sent" });
        }
      }

      // Create new request
      const { data: newRequest, error: createError } = await supabase
        .from("connection_requests")
        .insert({
          requester_id: userId,
          recipient_id: recipientId,
          status: "pending",
        })
        .select()
        .single();

      if (createError) {
        console.error("Create connection request error:", createError);
        return res.status(500).json({ error: "Failed to create connection request" });
      }

      // Create notification for recipient
      const { data: senderAlumni } = await supabase
        .from("alumni")
        .select("first_name, last_name")
        .eq("user_id", userId)
        .single();

      const senderName = senderAlumni ? `${senderAlumni.first_name} ${senderAlumni.last_name}` : "An alumni";

      // console.log('[Connection Request] Creating notification for recipient:', recipientId);
      const connectionContent = `${senderName} wants to connect with you`;
      const { data: notificationData, error: notificationError } = await supabase.from("notifications").insert({
        user_id: recipientId,
        type: "connection_request",
        title: "New Connection Request",
        content: connectionContent,
        related_id: userId, // The requester's ID
        is_read: false,
      }).select().single();

      if (notificationError) {
        console.error('[Connection Request] Failed to create notification:', notificationError);
      } else {
        // console.log('[Connection Request] Notification created:', notificationData);
      }

      // Emit socket event
      const io = (global as any).io;
      if (io) {
        // console.log('[Connection Request] Emitting notification to room:', `user:${recipientId}`);
        io.to(`user:${recipientId}`).emit("notification", {
          type: "connection_request",
          title: "New Connection Request",
          content: `${senderName} wants to connect with you`,
          related_id: userId,
          redirect_url: "/connections"
        });
        // console.log('[Connection Request] Notification emitted');
      } else {
        console.error('[Connection Request] Socket.IO instance not available');
      }

      res.status(201).json({ message: "Connection request sent", request: newRequest });

    } catch (error) {
      console.error("Connection request error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Batch check connection statuses
  app.post("/api/connections/status/batch", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const { userIds } = req.body;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.json({ statuses: {} });
      }

      // Get sent requests
      const { data: sent } = await supabase
        .from("connection_requests")
        .select("recipient_id, status")
        .eq("requester_id", userId)
        .in("recipient_id", userIds)
        .not("status", "eq", "rejected"); // Don't show rejected as status

      // Get received requests
      const { data: received } = await supabase
        .from("connection_requests")
        .select("requester_id, status")
        .eq("recipient_id", userId)
        .in("requester_id", userIds)
        .not("status", "eq", "rejected");

      const statuses: Record<string, string> = {};

      sent?.forEach(r => {
        if (r.status === 'accepted') statuses[r.recipient_id] = 'connected';
        else if (r.status === 'pending') statuses[r.recipient_id] = 'pending_sent';
      });

      received?.forEach(r => {
        if (r.status === 'accepted') statuses[r.requester_id] = 'connected';
        else if (r.status === 'pending') statuses[r.requester_id] = 'pending_received';
      });

      res.json({ statuses });
    } catch (error) {
      console.error("Batch connection status error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Withdraw connection request
  app.delete("/api/connections/request", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const { recipientId } = req.body;

      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      if (!recipientId) return res.status(400).json({ error: "Recipient ID required" });

      // Delete the pending request sent by user
      const { error } = await supabase
        .from("connection_requests")
        .delete()
        .eq("requester_id", userId)
        .eq("recipient_id", recipientId)
        .eq("status", "pending");

      if (error) {
        console.error("Withdraw request error:", error);
        return res.status(500).json({ error: "Failed to withdraw request" });
      }

      // Attempt to delete the associated notification
      // We don't have the notification ID, but we know user_id=recipientId and related_id=userId and type='connection_request'
      await supabase.from("notifications")
        .delete()
        .eq("user_id", recipientId)
        .eq("related_id", userId)
        .eq("type", "connection_request")
        .eq("is_read", false); // Only delete if unread, to be safe

      res.json({ message: "Request withdrawn" });
    } catch (error) {
      console.error("Withdraw request error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Respond to connection request (using requesterId)
  app.post("/api/connections/respond", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const { requesterId, action } = req.body;

      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      if (!requesterId || !["accept", "reject"].includes(action)) {
        return res.status(400).json({ error: "Invalid request" });
      }

      // Find the request
      const { data: request } = await supabase
        .from("connection_requests")
        .select("id")
        .eq("requester_id", requesterId)
        .eq("recipient_id", userId)
        .eq("status", "pending")
        .single();

      if (!request) {
        return res.status(404).json({ error: "Pending request not found" });
      }

      const newStatus = action === "accept" ? "accepted" : "rejected";

      // Update status
      const { error: updateError } = await supabase
        .from("connection_requests")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq("id", request.id);

      if (updateError) {
        throw updateError;
      }

      // Update notification as read
      await supabase.from("notifications")
        .update({ is_read: true })
        .eq("user_id", userId)
        .eq("related_id", requesterId)
        .eq("type", "connection_request");

      if (action === "accept") {
        // Notify requester
        const { data: recipientAlumni } = await supabase
          .from("alumni")
          .select("first_name, last_name")
          .eq("user_id", userId)
          .single();

        const recipientName = recipientAlumni ? `${recipientAlumni.first_name} ${recipientAlumni.last_name}` : "An alumni";

        const responseContent = `${recipientName} accepted your connection request`;
        await supabase.from("notifications").insert({
          user_id: requesterId,
          type: "connection_response",
          title: "Connection Accepted",
          content: responseContent,
          related_id: userId,
          is_read: false,
        });

        // Emit socket
        const io = (global as any).io;
        if (io) {
          io.to(`user:${requesterId}`).emit("notification", {
            type: "connection_response",
            title: "Connection Accepted",
            content: `${recipientName} accepted your connection request`,
            related_id: userId,
            redirect_url: "/connections"
          });
        }
      }

      res.json({ message: `Request ${newStatus}` });

    } catch (error) {
      console.error("Respond request error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Check connection status (Supports Alumni ID or User ID)
  app.get("/api/connections/status/:recipientId", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const { recipientId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: "No user ID provided" });
      }

      // Resolve recipientId to User ID (in case it is an Alumni ID)
      let targetUserId = recipientId;

      // Check if recipientId exists in users table (if it's a valid UUID)
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (uuidPattern.test(recipientId)) {
        const { data: userCheck } = await supabase
          .from("users")
          .select("id")
          .eq("id", recipientId)
          .single();

        if (!userCheck) {
          // Not a user ID, maybe Alumni ID?
          const { data: alumniCheck } = await supabase
            .from("alumni")
            .select("user_id")
            .eq("id", recipientId)
            .single();

          if (alumniCheck) {
            targetUserId = alumniCheck.user_id;
          }
        }
      }

      if (targetUserId === userId) {
        return res.json({ status: "none", message: "Self" });
      }

      // Check connection status
      const { data: request } = await supabase
        .from("connection_requests")
        .select("status, requester_id, recipient_id")
        .or(
          `and(requester_id.eq.${userId},recipient_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},recipient_id.eq.${userId})`
        )
        .single();

      if (request) {
        if (request.status === "accepted") {
          return res.json({ status: "connected" });
        } else if (request.status === "pending") {
          return res.json({ status: "pending", isRequester: request.requester_id === userId });
        } else {
          return res.json({ status: "none" });
        }
      }

      res.json({ status: "none" });
    } catch (error) {
      console.error("Check connection status error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });



  // Handle job interest toggling
  app.post("/api/jobs/:id/interest", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const jobId = req.params.id;

      if (!userId) {
        return res.status(401).json({ error: "No user ID provided" });
      }

      const { data: existing } = await supabase
        .from("job_interests")
        .select("id, status")
        .eq("user_id", userId)
        .eq("job_id", jobId)
        .single();

      if (existing) {
        // Remove interest
        const { error } = await supabase
          .from("job_interests")
          .delete()
          .eq("id", existing.id);

        if (error) {
          console.error("Remove job interest error:", error);
          return res.status(500).json({ error: "Failed to remove interest" });
        }

        return res.json({
          message: "Interest removed",
          interested: false,
        });
      } else {
        // Add interest
        const { error } = await supabase.from("job_interests").insert({
          user_id: userId,
          job_id: jobId,
          status: "interested",
        });

        if (error) {
          console.error("Add job interest error:", error);
          return res.status(500).json({ error: "Failed to add interest" });
        }

        return res.json({
          message: "Interest added",
          interested: true,
        });
      }
    } catch (error) {
      console.error("Toggle job interest error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get user's job interests
  app.get("/api/jobs/interests", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "No user ID provided" });
      }

      const { data: interests, error } = await supabase
        .from("job_interests")
        .select(
          `
          *,
          job:jobs(*)
        `,
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Get job interests error:", error);
        return res.status(500).json({ error: "Failed to fetch interests" });
      }

      res.json({ interests: interests || [] });
    } catch (error) {
      console.error("Get job interests error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Save/unsave job
  app.post("/api/jobs/:id/save", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const jobId = req.params.id;

      if (!userId) {
        return res.status(401).json({ error: "No user ID provided" });
      }

      const { data: existing } = await supabase
        .from("saved_jobs")
        .select("id")
        .eq("user_id", userId)
        .eq("job_id", jobId)
        .single();

      if (existing) {
        // Unsave
        const { error } = await supabase
          .from("saved_jobs")
          .delete()
          .eq("id", existing.id);

        if (error) {
          console.error("Unsave job error:", error);
          return res.status(500).json({ error: "Failed to unsave job" });
        }

        return res.json({
          message: "Job unsaved",
          saved: false,
        });
      } else {
        // Save
        const { error } = await supabase.from("saved_jobs").insert({
          user_id: userId,
          job_id: jobId,
        });

        if (error) {
          console.error("Save job error:", error);
          return res.status(500).json({ error: "Failed to save job" });
        }

        return res.json({
          message: "Job saved",
          saved: true,
        });
      }
    } catch (error) {
      console.error("Toggle save job error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get user's saved jobs
  app.get("/api/jobs/saved", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "No user ID provided" });
      }

      const { data: savedJobs, error } = await supabase
        .from("saved_jobs")
        .select(
          `
          *,
          job:jobs(*)
        `,
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Get saved jobs error:", error);
        return res.status(500).json({ error: "Failed to fetch saved jobs" });
      }

      res.json({ savedJobs: savedJobs || [] });
    } catch (error) {
      console.error("Get saved jobs error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get user's job applications
  app.get("/api/jobs/my-applications", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "No user ID provided" });
      }

      const { data: applications, error } = await supabase
        .from("job_applications")
        .select(
          `
          *,
          job:jobs(*)
        `,
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Get applications error:", error);
        return res.status(500).json({ error: "Failed to fetch applications" });
      }

      res.json({ applications: applications || [] });
    } catch (error) {
      console.error("Get applications error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== MENTORSHIPROUTES ====================

  // --- Scoring helper ---
  function scoreMentor(mentee: any, mentor: any): { score: number; breakdown: Record<string, number> } {
    const breakdown: Record<string, number> = {
      interestOverlap: 0,
      skillOverlap: 0,
      industryMatch: 0,
      careerStageGap: 0,
      availability: 0,
      timezone: 0,
    };

    // Interest overlap (25%) — Jaccard similarity between mentee and mentor interest_areas
    const parseInterests = (raw: any): string[] => {
      try {
        if (Array.isArray(raw)) return raw.map((s: string) => s.toLowerCase());
        if (typeof raw === "string" && raw.trim()) return JSON.parse(raw).map((s: string) => s.toLowerCase());
      } catch { /* */ }
      return [];
    };
    const menteeInterests = parseInterests(mentee.interest_areas);
    const mentorInterests = parseInterests(mentor.interest_areas);
    if (menteeInterests.length > 0 && mentorInterests.length > 0) {
      const intersection = menteeInterests.filter(i => mentorInterests.includes(i));
      const unionSize = new Set([...menteeInterests, ...mentorInterests]).size;
      const jaccard = intersection.length / unionSize;
      breakdown.interestOverlap = Math.round(jaccard * 25);
    } else {
      breakdown.interestOverlap = 8; // partial credit when interest data missing
    }

    // Skill overlap (25%) — weighted by proficiency
    const proficiencyWeight: Record<string, number> = { beginner: 1, intermediate: 2, advanced: 3, expert: 4 };
    const menteeSkills: string[] = (() => {
      try {
        const raw = mentee.skills;
        if (Array.isArray(raw)) return raw.map((s: any) => s.toLowerCase());
        if (typeof raw === "string") return JSON.parse(raw).map((s: string) => s.toLowerCase());
      } catch { /* */ }
      return [];
    })();
    const mentorSkillRows: any[] = mentor.alumni_skills || [];
    if (menteeSkills.length > 0 && mentorSkillRows.length > 0) {
      let weightedMatches = 0;
      for (const ms of mentorSkillRows) {
        if (menteeSkills.includes((ms.skill_name || "").toLowerCase())) {
          weightedMatches += proficiencyWeight[ms.proficiency_level] || 1;
        }
      }
      const maxPossible = menteeSkills.length * 4;
      breakdown.skillOverlap = Math.round((weightedMatches / maxPossible) * 25);
    } else {
      breakdown.skillOverlap = 8; // partial credit when no skill data
    }

    // Industry match (20%)
    const relatedIndustries: Record<string, string[]> = {
      technology: ["software", "it", "tech", "engineering", "data"],
      business: ["finance", "consulting", "management", "operations"],
      healthcare: ["medicine", "pharma", "biotech", "health"],
      education: ["academia", "research", "teaching"],
    };
    const mi = (mentee.industry || "").toLowerCase();
    const ri = (mentor.industry || "").toLowerCase();
    if (mi && ri) {
      if (mi === ri) {
        breakdown.industryMatch = 20;
      } else {
        const related = Object.values(relatedIndustries).find(group => group.includes(mi));
        breakdown.industryMatch = related && related.includes(ri) ? 10 : 0;
      }
    } else {
      breakdown.industryMatch = 5;
    }

    // Career stage gap (15%) — ideal 5–15 yrs ahead
    const menteeYrs = mentee.years_of_experience ?? (mentee.graduation_year ? new Date().getFullYear() - mentee.graduation_year : null);
    const mentorYrs = mentor.years_of_experience ?? (mentor.graduation_year ? new Date().getFullYear() - mentor.graduation_year : null);
    if (menteeYrs !== null && mentorYrs !== null) {
      const diff = mentorYrs - menteeYrs;
      if (diff >= 5 && diff <= 15) breakdown.careerStageGap = 15;
      else if (diff >= 3 && diff <= 20) breakdown.careerStageGap = 9;
      else if (diff > 0) breakdown.careerStageGap = 4;
    } else {
      breakdown.careerStageGap = 6;
    }

    // Availability (10%)
    const slots = (mentor.max_mentees ?? 3) - (mentor.mentee_count ?? 0);
    if (mentor.mentor_available !== false && slots > 0) {
      breakdown.availability = Math.min(10, 5 + slots * 2);
    }

    // Timezone proximity (5%)
    const parseOffset = (tz: string): number | null => {
      const m = tz?.match(/UTC([+-]\d+)/i);
      return m ? parseInt(m[1]) : null;
    };
    const mo = parseOffset(mentee.timezone || "");
    const ro = parseOffset(mentor.timezone || "");
    if (mo !== null && ro !== null) {
      const diff = Math.abs(mo - ro);
      if (diff <= 3) breakdown.timezone = 5;
      else if (diff <= 6) breakdown.timezone = 3;
    } else {
      breakdown.timezone = 2;
    }

    const score = Math.min(100, Object.values(breakdown).reduce((a, b) => a + b, 0));
    return { score, breakdown };
  }

  // Get all distinct interest tags that active mentors have declared
  app.get("/api/mentorship/available-interests", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("alumni")
        .select("interest_areas")
        .eq("is_mentor", true)
        .eq("is_active", true)
        .not("interest_areas", "is", null);

      if (error) {
        console.error("Get available interests error:", error);
        return res.status(500).json({ error: "Failed to fetch interests" });
      }

      const tagSet = new Set<string>();
      for (const row of data || []) {
        try {
          const tags: string[] = JSON.parse(row.interest_areas || "[]");
          if (Array.isArray(tags)) tags.forEach(t => { if (t) tagSet.add(t); });
        } catch { /* skip malformed rows */ }
      }

      res.json({ interests: Array.from(tagSet).sort() });
    } catch (error) {
      console.error("Get available interests error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get distinct expertise tags from active mentors
  app.get("/api/mentorship/available-expertise", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("alumni")
        .select("expertise_areas")
        .eq("is_mentor", true)
        .eq("is_active", true)
        .not("expertise_areas", "is", null);

      if (error) return res.status(500).json({ error: "Failed to fetch expertise" });

      const tagSet = new Set<string>();
      for (const row of data || []) {
        try {
          const tags: string[] = JSON.parse(row.expertise_areas || "[]");
          if (Array.isArray(tags)) tags.forEach(t => { if (t) tagSet.add(t); });
        } catch {
          // fallback: comma-separated string
          (row.expertise_areas || "").split(",").map((s: string) => s.trim()).filter(Boolean).forEach((t: string) => tagSet.add(t));
        }
      }

      res.json({ expertise: Array.from(tagSet).sort() });
    } catch (error) {
      console.error("Get available expertise error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get available mentors (with scoring)
  app.get("/api/mentorship/mentors", async (req, res) => {
    try {
      const { expertise, goal, interests } = req.query;
      const userId = req.headers["user-id"] as string;

      // Fetch mentee profile for scoring (include interest_areas)
      let menteeProfile: any = null;
      if (userId) {
        const { data } = await supabase
          .from("alumni")
          .select("*, alumni_skills(skill_name, proficiency_level)")
          .eq("user_id", userId)
          .single();
        menteeProfile = data;
      }

      let query = supabase
        .from("alumni")
        .select("*, alumni_skills(skill_name, proficiency_level, category, is_primary), available_days, session_type, meeting_link, mentorship_style, help_topics, linkedin_url, github_url, portfolio_url, twitter_url, total_mentees_helped")
        .eq("is_mentor", true)
        .eq("is_active", true)
        .neq("user_id", userId || "");

      if (expertise && expertise !== "all") {
        query = query.ilike("expertise_areas", `%${expertise}%`);
      }

      const page = Math.max(0, parseInt((req.query.page as string) || "0", 10));

      const { data: mentors, error } = await query.limit(200);

      if (error) {
        console.error("Get mentors error:", error);
        return res.status(500).json({ error: "Failed to fetch mentors" });
      }

      // Filter by selected interest tags (post-fetch JS filter — interest_areas is a JSON array)
      const selectedInterests: string[] = typeof interests === "string" && interests.trim()
        ? interests.split(",").map(s => s.trim().toLowerCase()).filter(Boolean)
        : [];

      let result = (mentors || []).filter((mentor: any) => {
        if (selectedInterests.length === 0) return true;
        try {
          const mentorInterests: string[] = JSON.parse(mentor.interest_areas || "[]").map((s: string) => s.toLowerCase());
          return selectedInterests.some(i => mentorInterests.includes(i));
        } catch { return false; }
      }).map((mentor: any) => {
        if (menteeProfile) {
          const { score, breakdown } = scoreMentor(menteeProfile, mentor);
          return { ...mentor, match_score: score, score_breakdown: breakdown };
        }
        return mentor;
      });

      // Keyword boost from goal text
      if (goal && typeof goal === "string" && goal.trim()) {
        const keywords = goal.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        result = result.map((m: any) => {
          const text = `${m.bio || ""} ${m.expertise_areas || ""} ${m.interest_areas || ""} ${m.industry || ""}`.toLowerCase();
          const boost = keywords.filter(k => text.includes(k)).length * 3;
          return { ...m, match_score: Math.min(100, (m.match_score || 0) + boost) };
        });
      }

      // Sort by match_score descending
      result.sort((a: any, b: any) => (b.match_score || 0) - (a.match_score || 0));

      const PAGE_SIZE = 20;
      const start = page * PAGE_SIZE;
      const paginated = result.slice(start, start + PAGE_SIZE);
      res.json({ mentors: paginated, total: result.length, hasMore: result.length > start + PAGE_SIZE });
    } catch (error) {
      console.error("Get mentors error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get current user's mentor/mentee status
  app.get("/api/mentorship/my-status", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      if (!userId) return res.status(401).json({ error: "No user ID provided" });

      const { data } = await supabase
        .from("alumni")
        .select("is_mentor, mentor_available, max_mentees, mentee_count, interest_areas, available_days, session_type, meeting_link, mentorship_style, help_topics, linkedin_url, github_url, portfolio_url, twitter_url, total_mentees_helped")
        .eq("user_id", userId)
        .single();

      res.json(data || { is_mentor: false, mentor_available: true, max_mentees: 3, mentee_count: 0, interest_areas: '[]' });
    } catch (error) {
      console.error("My status error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Toggle mentor status
  app.post("/api/mentorship/toggle", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "No user ID provided" });
      }

      // Verify user permission (Block students from being mentors)
      const { data: user } = await supabase
        .from("users")
        .select("user_role")
        .eq("id", userId)
        .single();

      const { isMentor } = req.body;

      // When disabling mentor status, block if active relationships or upcoming sessions exist
      if (isMentor === false) {
        const { count: activeRequests } = await supabase
          .from("mentorship_requests")
          .select("id", { count: "exact", head: true })
          .eq("mentor_id", userId)
          .in("status", ["pending", "accepted"]);

        const { count: upcomingSessions } = await supabase
          .from("mentorship_sessions")
          .select("id", { count: "exact", head: true })
          .eq("mentor_id", userId)
          .in("status", ["scheduled", "upcoming"]);

        if ((activeRequests ?? 0) > 0 || (upcomingSessions ?? 0) > 0) {
          return res.status(400).json({
            error: "You have active mentees or upcoming sessions. Please end all mentorship relationships before disabling your mentor status.",
          });
        }
      }

      const { error } = await supabase
        .from("alumni")
        .update({
          is_mentor: isMentor,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (error) {
        console.error("Toggle mentor error:", error);
        return res
          .status(500)
          .json({ error: "Failed to update mentor status" });
      }

      res.json({ message: "Mentor status updated" });
    } catch (error) {
      console.error("Toggle mentor error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Request mentorship (with duplicate guard + goal text)
  app.post("/api/mentorship/request", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "No user ID provided" });
      }

      const { mentorId, message, goalText, matchScore } = req.body;

      // Prevent self-mentorship
      if (mentorId === userId) {
        return res.status(400).json({ error: "You cannot request yourself as a mentor." });
      }

      // Verify mentor exists and is active
      const { data: mentorExists } = await supabase
        .from("alumni")
        .select("user_id")
        .eq("user_id", mentorId)
        .eq("is_mentor", true)
        .maybeSingle();
      if (!mentorExists) return res.status(404).json({ error: "Mentor not found." });

      // Prevent duplicate pending requests
      const { data: existing } = await supabase
        .from("mentorship_requests")
        .select("id")
        .eq("mentee_id", userId)
        .eq("mentor_id", mentorId)
        .eq("status", "pending")
        .maybeSingle();

      if (existing) {
        return res.status(409).json({ error: "You already have a pending request with this mentor." });
      }

      const { data: newRequest, error } = await supabase.from("mentorship_requests").insert({
        mentee_id: userId,
        mentor_id: mentorId,
        status: "pending",
        message: message || null,
        goal_text: goalText || null,
        match_score: matchScore || null,
      }).select().single();

      if (error) {
        console.error("Request mentorship error:", error);
        return res.status(500).json({ error: "Failed to send request" });
      }

      // Fetch mentee name for notification
      const { data: menteeAlumni } = await supabase
        .from("alumni")
        .select("first_name, last_name")
        .eq("user_id", userId)
        .single();
      const menteeName = menteeAlumni
        ? `${menteeAlumni.first_name} ${menteeAlumni.last_name}`
        : "Someone";

      // Notify mentor — persisted + real-time + push
      await createAndEmitNotification({
        userId: mentorId,
        type: NotificationType.MENTORSHIP_REQUEST,
        title: "New Mentorship Request",
        content: goalText
          ? `${menteeName}: "${goalText.slice(0, 80)}${goalText.length > 80 ? "…" : ""}"`
          : `${menteeName} wants you as their mentor!`,
        relatedId: newRequest.id,
        redirectUrl: NotificationRedirectUrl.MENTORSHIP,
        actorId: userId,
      });

      res.json({ message: "Request sent" });
    } catch (error) {
      console.error("Request mentorship error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get mentee's outgoing requests
  app.get("/api/mentorship/my-requests", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      if (!userId) return res.status(401).json({ error: "No user ID provided" });

      const { data: requests, error } = await supabase
        .from("mentorship_requests")
        .select("*")
        .eq("mentee_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("My requests error:", error);
        return res.status(500).json({ error: "Failed to fetch requests" });
      }

      // Enrich with mentor name/picture
      const enriched = await Promise.all(
        (requests || []).map(async (req: any) => {
          const { data: mentor } = await supabase
            .from("alumni")
            .select("first_name, last_name, profile_picture, current_role, current_company")
            .eq("user_id", req.mentor_id)
            .single();
          return { ...req, mentor };
        })
      );

      res.json({ requests: enriched });
    } catch (error) {
      console.error("My requests error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get mentor's incoming requests
  app.get("/api/mentorship/incoming", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      if (!userId) return res.status(401).json({ error: "No user ID provided" });

      const { data: requests, error } = await supabase
        .from("mentorship_requests")
        .select("*")
        .eq("mentor_id", userId)
        .in("status", ["pending", "accepted"])
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Incoming requests error:", error);
        return res.status(500).json({ error: "Failed to fetch requests" });
      }

      // Enrich with mentee name/picture
      const enriched = await Promise.all(
        (requests || []).map(async (req: any) => {
          const { data: mentee } = await supabase
            .from("alumni")
            .select("first_name, last_name, profile_picture, current_role, current_company, graduation_year")
            .eq("user_id", req.mentee_id)
            .single();
          return { ...req, mentee };
        })
      );

      res.json({ requests: enriched });
    } catch (error) {
      console.error("Incoming requests error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Accept or reject a mentorship request (mentor action)
  app.patch("/api/mentorship/request/:id", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      if (!userId) return res.status(401).json({ error: "No user ID provided" });

      const { id } = req.params;
      const { status } = req.body; // "accepted" | "rejected"

      if (!["accepted", "rejected"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      // Fetch request to verify mentor ownership and get mentee_id + current status
      const { data: mentorshipReq } = await supabase
        .from("mentorship_requests")
        .select("mentor_id, mentee_id, status")
        .eq("id", id)
        .single();

      if (!mentorshipReq || mentorshipReq.mentor_id !== userId) {
        return res.status(403).json({ error: "Not authorised" });
      }

      // Check capacity before accepting
      let mentorRow: { mentee_count: number; max_mentees: number } | null = null;
      if (status === "accepted") {
        const { data } = await supabase
          .from("alumni")
          .select("mentee_count, max_mentees")
          .eq("user_id", userId)
          .single();
        mentorRow = data;
        if ((mentorRow?.mentee_count ?? 0) >= (mentorRow?.max_mentees ?? 3)) {
          return res.status(400).json({ error: "Mentor is at full capacity." });
        }
      }

      const { error } = await supabase
        .from("mentorship_requests")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) {
        console.error("Update request error:", error);
        return res.status(500).json({ error: "Failed to update request" });
      }

      // Update mentee_count on mentor's alumni record
      if (status === "accepted") {
        await supabase
          .from("alumni")
          .update({ mentee_count: (mentorRow?.mentee_count ?? 0) + 1 })
          .eq("user_id", userId);

        // Re-check after increment to guard against concurrent accepts exceeding capacity
        const { data: checkRow } = await supabase
          .from("alumni")
          .select("mentee_count, max_mentees")
          .eq("user_id", userId)
          .single();
        if ((checkRow?.mentee_count ?? 0) > (checkRow?.max_mentees ?? 3)) {
          // Roll back: revert request to pending and decrement count
          await supabase.from("mentorship_requests").update({ status: "pending", updated_at: new Date().toISOString() }).eq("id", id);
          await supabase.from("alumni")
            .update({ mentee_count: Math.max(0, (checkRow?.mentee_count ?? 1) - 1) })
            .eq("user_id", userId);
          return res.status(409).json({ error: "Mentor reached capacity. Please try again." });
        }
      }

      // If transitioning away from "accepted", decrement mentee_count
      if (mentorshipReq.status === "accepted" && status !== "accepted") {
        const { data: currentRow } = await supabase
          .from("alumni")
          .select("mentee_count")
          .eq("user_id", userId)
          .single();
        await supabase
          .from("alumni")
          .update({ mentee_count: Math.max(0, (currentRow?.mentee_count ?? 1) - 1) })
          .eq("user_id", userId);
      }

      // Fetch mentor name for notification
      const { data: mentorAlumni } = await supabase
        .from("alumni")
        .select("first_name, last_name")
        .eq("user_id", userId)
        .single();
      const mentorName = mentorAlumni
        ? `${mentorAlumni.first_name} ${mentorAlumni.last_name}`
        : "Your mentor";

      // Notify mentee — persisted + real-time + push
      await createAndEmitNotification({
        userId: mentorshipReq.mentee_id,
        type: NotificationType.MENTORSHIP_RESPONSE,
        title: status === "accepted" ? "Mentorship Request Accepted!" : "Mentorship Request Declined",
        content: status === "accepted"
          ? `${mentorName} accepted your mentorship request.`
          : `${mentorName} declined your mentorship request.`,
        relatedId: id,
        redirectUrl: NotificationRedirectUrl.MENTORSHIP,
        actorId: userId,
      });

      res.json({ message: `Request ${status}` });
    } catch (error) {
      console.error("Update request error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Mentee withdraws a pending request
  app.delete("/api/mentorship/request/:id", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      if (!userId) return res.status(401).json({ error: "No user ID provided" });

      const { id } = req.params;

      const { data: mentorshipReq } = await supabase
        .from("mentorship_requests")
        .select("mentee_id, mentor_id, status")
        .eq("id", id)
        .single();

      if (!mentorshipReq || mentorshipReq.mentee_id !== userId) {
        return res.status(403).json({ error: "Not authorised" });
      }
      if (mentorshipReq.status !== "pending") {
        return res.status(400).json({ error: "Only pending requests can be withdrawn." });
      }

      await supabase.from("mentorship_requests").delete().eq("id", id);

      // Notify mentor
      const { data: menteeAlumni } = await supabase
        .from("alumni").select("first_name, last_name").eq("user_id", userId).single();
      const menteeName = menteeAlumni ? `${menteeAlumni.first_name} ${menteeAlumni.last_name}` : "Someone";
      const io = (global as any).io;
      if (io) {
        io.to(`user:${mentorshipReq.mentor_id}`).emit("notification", {
          type: "mentorship_withdrawn",
          title: "Mentorship Request Withdrawn",
          content: `${menteeName} withdrew their mentorship request.`,
        });
      }

      res.json({ message: "Request withdrawn" });
    } catch (error) {
      console.error("Withdraw request error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // End an accepted mentorship relationship (mentor or mentee)
  app.post("/api/mentorship/request/:id/end", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      if (!userId) return res.status(401).json({ error: "No user ID provided" });

      const { id } = req.params;

      const { data: mentorshipReq } = await supabase
        .from("mentorship_requests")
        .select("mentor_id, mentee_id, status")
        .eq("id", id)
        .single();

      if (!mentorshipReq) return res.status(404).json({ error: "Request not found" });
      if (mentorshipReq.mentor_id !== userId && mentorshipReq.mentee_id !== userId) {
        return res.status(403).json({ error: "Not authorised" });
      }
      if (mentorshipReq.status !== "accepted") {
        return res.status(400).json({ error: "Only accepted relationships can be ended." });
      }

      await supabase
        .from("mentorship_requests")
        .update({ status: "ended", updated_at: new Date().toISOString() })
        .eq("id", id);

      // Decrement mentee_count and increment total_mentees_helped
      const { data: mentorRow } = await supabase
        .from("alumni").select("mentee_count").eq("user_id", mentorshipReq.mentor_id).single();
      await supabase
        .from("alumni")
        .update({ mentee_count: Math.max(0, (mentorRow?.mentee_count ?? 1) - 1) })
        .eq("user_id", mentorshipReq.mentor_id);
      await supabase.rpc("increment_mentees_helped", { uid: mentorshipReq.mentor_id });

      // Notify other party
      const otherId = userId === mentorshipReq.mentor_id ? mentorshipReq.mentee_id : mentorshipReq.mentor_id;
      const { data: initiator } = await supabase
        .from("alumni").select("first_name, last_name").eq("user_id", userId).single();
      const initiatorName = initiator ? `${initiator.first_name} ${initiator.last_name}` : "Your contact";
      const io = (global as any).io;
      if (io) {
        io.to(`user:${otherId}`).emit("notification", {
          type: "mentorship_ended",
          title: "Mentorship Relationship Ended",
          content: `${initiatorName} ended the mentorship relationship.`,
        });
      }

      res.json({ message: "Relationship ended" });
    } catch (error) {
      console.error("End relationship error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Mentor availability settings
  app.patch("/api/mentorship/my-availability", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      if (!userId) return res.status(401).json({ error: "No user ID provided" });

      const { available_days, session_type, meeting_link, max_mentees,
              mentorship_style, help_topics, github_url, portfolio_url, twitter_url } = req.body;

      const { data: existing } = await supabase
        .from("alumni")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();

      let dbError;
      if (existing) {
        const { error } = await supabase
          .from("alumni")
          .update({
            available_days: available_days ?? null,
            session_type: session_type ?? null,
            meeting_link: meeting_link ?? null,
            ...(max_mentees !== undefined ? { max_mentees } : {}),
            mentorship_style: mentorship_style ?? null,
            help_topics: help_topics ?? null,
            github_url: github_url ?? null,
            portfolio_url: portfolio_url ?? null,
            twitter_url: twitter_url ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);
        dbError = error;
      } else {
        const { error } = await supabase
          .from("alumni")
          .insert({
            user_id: userId,
            available_days: available_days ?? null,
            session_type: session_type ?? null,
            meeting_link: meeting_link ?? null,
            max_mentees: max_mentees ?? 3,
            mentorship_style: mentorship_style ?? null,
            help_topics: help_topics ?? null,
            github_url: github_url ?? null,
            portfolio_url: portfolio_url ?? null,
            twitter_url: twitter_url ?? null,
            updated_at: new Date().toISOString(),
          });
        dbError = error;
      }

      if (dbError) {
        console.error("Update availability error:", dbError);
        return res.status(500).json({ error: "Failed to update availability" });
      }

      res.json({ message: "Availability updated" });
    } catch (error) {
      console.error("Update availability error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Bookmark endpoints
  app.post("/api/mentorship/bookmark", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      if (!userId) return res.status(401).json({ error: "No user ID provided" });

      const { mentorId } = req.body;
      if (!mentorId) return res.status(400).json({ error: "mentorId required" });

      const { data: existing } = await supabase
        .from("mentorship_bookmarks")
        .select("mentor_id")
        .eq("mentee_id", userId)
        .eq("mentor_id", mentorId)
        .maybeSingle();

      if (existing) {
        await supabase.from("mentorship_bookmarks").delete()
          .eq("mentee_id", userId).eq("mentor_id", mentorId);
        return res.json({ bookmarked: false });
      }

      await supabase.from("mentorship_bookmarks").insert({ mentee_id: userId, mentor_id: mentorId });
      res.json({ bookmarked: true });
    } catch (error) {
      console.error("Bookmark error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/mentorship/bookmarks", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      if (!userId) return res.status(401).json({ error: "No user ID provided" });

      const { data } = await supabase
        .from("mentorship_bookmarks")
        .select("mentor_id")
        .eq("mentee_id", userId);

      res.json({ mentorIds: (data || []).map((r: any) => r.mentor_id) });
    } catch (error) {
      console.error("Get bookmarks error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Session endpoints
  app.post("/api/mentorship/sessions/bulk", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      if (!userId) return res.status(401).json({ error: "No user ID provided" });

      const { requestIds, scheduledAt, durationMinutes, agenda, meetLink } = req.body;

      if (!Array.isArray(requestIds) || requestIds.length === 0)
        return res.status(400).json({ error: "requestIds must be a non-empty array" });
      if (requestIds.length > 20)
        return res.status(400).json({ error: "Cannot schedule more than 20 sessions at once" });
      if (!scheduledAt)
        return res.status(400).json({ error: "scheduledAt is required" });
      if (new Date(scheduledAt) <= new Date())
        return res.status(400).json({ error: "scheduledAt must be in the future" });

      const MEET_LINK_RE = /^https?:\/\/(meet\.google\.com|zoom\.us|us\d*\.zoom\.us|teams\.microsoft\.com|teams\.live\.com|meet\.jit\.si|whereby\.com|webex\.com|[\w-]+\.webex\.com|bluejeans\.com|gotomeeting\.com|join\.me|gather\.town|meet\.around\.co|8x8\.vc)\//i;
      if (meetLink && !MEET_LINK_RE.test(meetLink))
        return res.status(400).json({ error: "Invalid or unsupported meeting link URL." });

      const { data: creator } = await supabase
        .from("alumni")
        .select("first_name, last_name, meeting_link")
        .eq("user_id", userId)
        .single();
      const creatorName = creator ? `${creator.first_name} ${creator.last_name}` : "Your mentor";
      const resolvedMeetLink = meetLink || creator?.meeting_link || null;

      const io = (global as any).io;

      const results = await Promise.allSettled(
        requestIds.map(async (requestId: string) => {
          const { data: mentorshipReq } = await supabase
            .from("mentorship_requests")
            .select("mentor_id, mentee_id, status")
            .eq("id", requestId)
            .single();

          if (!mentorshipReq || mentorshipReq.status !== "accepted")
            throw new Error("Session requires an accepted mentorship relationship.");
          if (mentorshipReq.mentor_id !== userId)
            throw new Error("Only the mentor of this relationship can schedule sessions.");

          const { data: session, error } = await supabase
            .from("mentorship_sessions")
            .insert({
              mentor_id: mentorshipReq.mentor_id,
              mentee_id: mentorshipReq.mentee_id,
              request_id: requestId,
              scheduled_at: scheduledAt,
              duration_minutes: durationMinutes || 60,
              agenda: agenda || null,
              meet_link: resolvedMeetLink,
              status: "upcoming",
            })
            .select()
            .single();

          if (error) throw new Error("Failed to create session.");

          if (io) {
            io.to(`user:${mentorshipReq.mentee_id}`).emit("notification", {
              type: "session_scheduled",
              title: "Session Scheduled",
              content: `${creatorName} scheduled a mentorship session.`,
            });
          }

          return { requestId, session };
        })
      );

      const succeeded: any[] = [];
      const failed: any[] = [];
      results.forEach((result, i) => {
        if (result.status === "fulfilled") succeeded.push(result.value);
        else failed.push({ requestId: requestIds[i], error: (result.reason as Error)?.message || "Unknown error" });
      });

      if (succeeded.length === 0)
        return res.status(422).json({ succeeded, failed });

      return res.status(207).json({ succeeded, failed });
    } catch (error) {
      console.error("Bulk create session error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/mentorship/sessions", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      if (!userId) return res.status(401).json({ error: "No user ID provided" });

      const { requestId, scheduledAt, durationMinutes, agenda, meetLink } = req.body;
      if (!requestId || !scheduledAt) return res.status(400).json({ error: "requestId and scheduledAt required" });

      const MEET_LINK_RE = /^https?:\/\/(meet\.google\.com|zoom\.us|us\d*\.zoom\.us|teams\.microsoft\.com|teams\.live\.com|meet\.jit\.si|whereby\.com|webex\.com|[\w-]+\.webex\.com|bluejeans\.com|gotomeeting\.com|join\.me|gather\.town|meet\.around\.co|8x8\.vc)\//i;
      if (meetLink && !MEET_LINK_RE.test(meetLink)) {
        return res.status(400).json({ error: "Invalid or unsupported meeting link URL." });
      }

      // Verify user is part of the accepted request
      const { data: mentorshipReq } = await supabase
        .from("mentorship_requests")
        .select("mentor_id, mentee_id, status")
        .eq("id", requestId)
        .single();

      if (!mentorshipReq || mentorshipReq.status !== "accepted") {
        return res.status(400).json({ error: "Session requires an accepted mentorship relationship." });
      }
      if (mentorshipReq.mentor_id !== userId) {
        return res.status(403).json({ error: "Only mentors can schedule sessions." });
      }

      // Fall back to mentor's default meeting link if none provided
      let resolvedMeetLink = meetLink || null;
      if (!resolvedMeetLink) {
        const { data: mentorAlumni } = await supabase
          .from("alumni")
          .select("meeting_link")
          .eq("user_id", mentorshipReq.mentor_id)
          .single();
        resolvedMeetLink = mentorAlumni?.meeting_link ?? null;
      }

      const { data: session, error } = await supabase.from("mentorship_sessions").insert({
        mentor_id: mentorshipReq.mentor_id,
        mentee_id: mentorshipReq.mentee_id,
        request_id: requestId,
        scheduled_at: scheduledAt,
        duration_minutes: durationMinutes || 60,
        agenda: agenda || null,
        meet_link: resolvedMeetLink,
        status: "upcoming",
      }).select().single();

      if (error) {
        console.error("Create session error:", error);
        return res.status(500).json({ error: "Failed to create session" });
      }

      // Notify other party
      const otherId = userId === mentorshipReq.mentor_id ? mentorshipReq.mentee_id : mentorshipReq.mentor_id;
      const { data: creator } = await supabase
        .from("alumni").select("first_name, last_name").eq("user_id", userId).single();
      const creatorName = creator ? `${creator.first_name} ${creator.last_name}` : "Your contact";
      const io = (global as any).io;
      if (io) {
        io.to(`user:${otherId}`).emit("notification", {
          type: "session_scheduled",
          title: "Session Scheduled",
          content: `${creatorName} scheduled a mentorship session.`,
        });
      }

      res.json({ session });
    } catch (error) {
      console.error("Create session error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/mentorship/sessions", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      if (!userId) return res.status(401).json({ error: "No user ID provided" });

      const { data: sessions, error } = await supabase
        .from("mentorship_sessions")
        .select("*")
        .or(`mentor_id.eq.${userId},mentee_id.eq.${userId}`)
        .order("scheduled_at", { ascending: true });

      if (error) return res.status(500).json({ error: "Failed to fetch sessions" });

      // Enrich with other party info
      const enriched = await Promise.all(
        (sessions || []).map(async (s: any) => {
          const otherId = s.mentor_id === userId ? s.mentee_id : s.mentor_id;
          const role = s.mentor_id === userId ? "mentor" : "mentee";
          const { data: other } = await supabase
            .from("alumni")
            .select("first_name, last_name, profile_picture, current_role, current_company")
            .eq("user_id", otherId)
            .single();
          const otherProfile = other ?? { first_name: "Unknown", last_name: "User", profile_picture: null, current_role: null, current_company: null };
          return { ...s, other: otherProfile, myRole: role };
        })
      );

      res.json({ sessions: enriched });
    } catch (error) {
      console.error("Get sessions error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/mentorship/sessions/:id", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      if (!userId) return res.status(401).json({ error: "No user ID provided" });

      const { id } = req.params;
      const { status, notes, agenda, scheduledAt, meetLink, cancellationReason } = req.body;

      const { data: session } = await supabase
        .from("mentorship_sessions")
        .select("mentor_id, mentee_id, scheduled_at")
        .eq("id", id)
        .single();

      if (!session || (session.mentor_id !== userId && session.mentee_id !== userId)) {
        return res.status(403).json({ error: "Not authorised" });
      }

      const isMentor = session.mentor_id === userId;

      // Only mentors can cancel a session
      if (status === "cancelled" && !isMentor) {
        return res.status(403).json({ error: "Only the mentor can cancel a session." });
      }

      // Require a cancellation reason when cancelling
      if (status === "cancelled" && !cancellationReason?.trim()) {
        return res.status(400).json({ error: "A cancellation reason is required." });
      }

      const updates: Record<string, any> = {};
      if (status) updates.status = status;
      if (notes !== undefined) updates.notes = notes;
      if (agenda !== undefined) updates.agenda = agenda;
      if (scheduledAt) updates.scheduled_at = scheduledAt;
      if (meetLink !== undefined) updates.meet_link = meetLink;
      if (cancellationReason?.trim()) updates.cancellation_reason = cancellationReason.trim();

      const { error } = await supabase.from("mentorship_sessions").update(updates).eq("id", id);
      if (error) return res.status(500).json({ error: "Failed to update session" });

      // Send cancellation notification to mentee when mentor cancels
      if (status === "cancelled" && isMentor) {
        const { data: mentorAlumni } = await supabase
          .from("alumni").select("first_name, last_name").eq("user_id", userId).single();
        const mentorName = mentorAlumni ? `${mentorAlumni.first_name} ${mentorAlumni.last_name}` : "Your mentor";

        const cancelContent = cancellationReason?.trim()
          ? `${mentorName} has cancelled your upcoming mentorship session. Reason: ${cancellationReason.trim()}`
          : `${mentorName} has cancelled your upcoming mentorship session.`;
        await createAndEmitNotification({
          userId: session.mentee_id,
          type: NotificationType.SESSION_CANCELLED,
          title: "Session Cancelled",
          content: cancelContent,
          relatedId: id,
          redirectUrl: "/mentorship",
          actorId: userId,
        });

        const { data: menteeUser } = await supabase
          .from("users").select("email").eq("id", session.mentee_id).single();
        const { data: menteeAlumni } = await supabase
          .from("alumni").select("first_name, last_name").eq("user_id", session.mentee_id).single();

        if (menteeUser?.email) {
          try {
            const baseUrl = getBaseUrl();
            const { subject, textBody, htmlBody } = generateSessionCancelledEmail(
              mentorName,
              session.scheduled_at,
              baseUrl,
              cancellationReason?.trim()
            );
            await sendEmail({
              to: menteeUser.email,
              toName: menteeAlumni ? `${menteeAlumni.first_name} ${menteeAlumni.last_name}` : undefined,
              subject,
              textBody,
              htmlBody,
            });
          } catch (emailErr) {
            console.error("[Session] Failed to send cancellation email:", emailErr);
          }
        }
      }

      res.json({ message: "Session updated" });
    } catch (error) {
      console.error("Update session error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Review endpoints
  app.post("/api/mentorship/reviews", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      if (!userId) return res.status(401).json({ error: "No user ID provided" });

      const { sessionId, reviewedId, rating, comment } = req.body;
      if (!sessionId || !reviewedId || !rating) {
        return res.status(400).json({ error: "sessionId, reviewedId, and rating required" });
      }
      if (!Number.isInteger(Number(rating)) || Number(rating) < 1 || Number(rating) > 5) {
        return res.status(400).json({ error: "Rating must be an integer between 1 and 5" });
      }

      // Verify user was in session
      const { data: session } = await supabase
        .from("mentorship_sessions")
        .select("mentor_id, mentee_id, status")
        .eq("id", sessionId)
        .single();

      if (!session || (session.mentor_id !== userId && session.mentee_id !== userId)) {
        return res.status(403).json({ error: "Not authorised" });
      }
      if (session.status !== "completed") {
        return res.status(400).json({ error: "Can only review completed sessions." });
      }

      const { error } = await supabase.from("mentorship_reviews").insert({
        session_id: sessionId,
        reviewer_id: userId,
        reviewed_id: reviewedId,
        rating,
        comment: comment || null,
      });

      if (error) {
        if (error.code === "23505") return res.status(409).json({ error: "You already reviewed this session." });
        console.error("Create review error:", error);
        return res.status(500).json({ error: "Failed to submit review" });
      }

      res.json({ message: "Review submitted" });
    } catch (error) {
      console.error("Create review error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/mentorship/reviews/:userId", async (req, res) => {
    try {
      const { userId: reviewedUserId } = req.params;

      const { data: reviews, error } = await supabase
        .from("mentorship_reviews")
        .select("rating, comment, created_at, reviewer_id")
        .eq("reviewed_id", reviewedUserId)
        .order("created_at", { ascending: false });

      if (error) return res.status(500).json({ error: "Failed to fetch reviews" });

      const ratings = (reviews || []).map((r: any) => r.rating);
      const avg = ratings.length > 0 ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length : null;

      // Enrich with reviewer name
      const enriched = await Promise.all(
        (reviews || []).slice(0, 10).map(async (r: any) => {
          const { data: reviewer } = await supabase
            .from("alumni").select("first_name, last_name").eq("user_id", r.reviewer_id).single();
          return { ...r, reviewer };
        })
      );

      res.json({ reviews: enriched, averageRating: avg ? Math.round(avg * 10) / 10 : null, total: ratings.length });
    } catch (error) {
      console.error("Get reviews error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== SHAREROUTES ====================

  // ==================== LANDING PAGE SECTIONS ROUTES ====================

  // Get hero section
  app.get("/api/landing/hero", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("hero_section")
        .select("*")
        .eq("is_active", true)
        .maybeSingle();

      if (error) {
        console.error("Get hero section error:", error);
        return res.status(500).json({ error: "Failed to fetch hero section" });
      }

      res.json({ hero: data || null });
    } catch (error) {
      console.error("Get hero section error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get alumni benefits
  app.get("/api/landing/benefits", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("alumni_benefits")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) {
        console.error("Get benefits error:", error);
        return res.status(500).json({ error: "Failed to fetch benefits" });
      }

      res.json({ benefits: data || [] });
    } catch (error) {
      console.error("Get benefits error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get why join reasons
  app.get("/api/landing/why-join", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("why_join_reasons")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) {
        console.error("Get why join error:", error);
        return res
          .status(500)
          .json({ error: "Failed to fetch why join reasons" });
      }

      res.json({ reasons: data || [] });
    } catch (error) {
      console.error("Get why join error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get testimonials
  app.get("/api/landing/testimonials", async (req, res) => {
    try {
      const { featured = false } = req.query;

      let query = supabase
        .from("testimonials")
        .select("*")
        .eq("is_active", true);

      if (featured === "true") {
        query = query.eq("is_featured", true);
      }

      const { data, error } = await query.order("created_at", {
        ascending: false,
      });

      if (error) {
        console.error("Get testimonials error:", error);
        return res.status(500).json({ error: "Failed to fetch testimonials" });
      }

      res.json({ testimonials: data || [] });
    } catch (error) {
      console.error("Get testimonials error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get landing events
  app.get("/api/landing/events", async (req, res) => {
    try {
      const { featured = false, limit = 10 } = req.query;

      let query = supabase
        .from("landing_events")
        .select("*")
        .eq("is_active", true)
        .gte("event_date", new Date().toISOString());

      if (featured === "true") {
        query = query.eq("is_featured", true);
      }

      const { data, error } = await query
        .order("event_date", { ascending: true })
        .limit(Number(limit));

      if (error) {
        console.error("Get landing events error:", error);
        return res.status(500).json({ error: "Failed to fetch events" });
      }

      res.json({ events: data || [] });
    } catch (error) {
      console.error("Get landing events error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get portal features
  app.get("/api/landing/features", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("portal_features")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) {
        console.error("Get features error:", error);
        return res.status(500).json({ error: "Failed to fetch features" });
      }

      res.json({ features: data || [] });
    } catch (error) {
      console.error("Get features error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get alumni statistics
  app.get("/api/landing/statistics", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("alumni_statistics")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) {
        console.error("Get statistics error:", error);
        return res.status(500).json({ error: "Failed to fetch statistics" });
      }

      res.json({ statistics: data || [] });
    } catch (error) {
      console.error("Get statistics error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get community highlights
  app.get("/api/landing/community", async (req, res) => {
    try {
      const { category, limit = 10 } = req.query;

      let query = supabase
        .from("community_highlights")
        .select("*")
        .eq("is_active", true);

      if (category) {
        query = query.eq("category", category);
      }

      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(Number(limit));

      if (error) {
        console.error("Get community highlights error:", error);
        return res
          .status(500)
          .json({ error: "Failed to fetch community highlights" });
      }

      res.json({ highlights: data || [] });
    } catch (error) {
      console.error("Get community highlights error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Comprehensive Database Test Endpoint
  app.get("/api/test/database", async (req, res) => {
    if (process.env.NODE_ENV === "production") {
      return res.status(404).json({ error: "Not found" });
    }
    try {
      const results = {
        timestamp: new Date().toISOString(),
        environment: {
          hasSupabaseUrl: !!process.env.SUPABASE_URL,
          hasSupabaseKey: !!process.env.SUPABASE_ANON_KEY,
          hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        },
        tables: {} as Record<string, any>,
        errors: [] as string[],
        summary: {
          totalTables: 0,
          workingTables: 0,
          failedTables: 0,
        },
      };

      const tablesToTest = [
        "users",
        "alumni",
        "feed_posts",
        "post_likes",
        "post_comments",
        "jobs",
        "events",
        "messages",
        "notifications",
        "connection_requests",
        "signup_requests",
        "event_rsvps",
        "linkedin_integrations",
      ];

      for (const table of tablesToTest) {
        try {
          const { count, error } = await supabase
            .from(table)
            .select("*", { count: "exact", head: true });

          results.tables[table] = {
            status: error ? "error" : "ok",
            count: error ? null : count,
            error: error ? error.message : null,
          };

          if (error) {
            results.errors.push(`${table}: ${error.message}`);
            results.summary.failedTables++;
          } else {
            results.summary.workingTables++;
          }
          results.summary.totalTables++;
        } catch (err) {
          results.tables[table] = {
            status: "error",
            count: null,
            error: err instanceof Error ? err.message : "Unknown error",
          };
          results.errors.push(
            `${table}: ${err instanceof Error ? err.message : "Unknown error"}`,
          );
          results.summary.failedTables++;
          results.summary.totalTables++;
        }
      }

      // Test storage buckets
      try {
        const { data: buckets, error: bucketsError } =
          await supabase.storage.listBuckets();
        results.tables["storage_buckets"] = {
          status: bucketsError ? "error" : "ok",
          buckets: bucketsError ? null : buckets?.map((b) => b.name),
          error: bucketsError ? bucketsError.message : null,
        };
      } catch (err) {
        results.tables["storage_buckets"] = {
          status: "error",
          error: err instanceof Error ? err.message : "Unknown error",
        };
      }

      const allPassed = results.summary.failedTables === 0;
      res.status(allPassed ? 200 : 500).json({
        success: allPassed,
        ...results,
      });
    } catch (error) {
      console.error("Database test error:", error);
      res.status(500).json({
        success: false,
        error: "Database connection failed",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Test endpoint to verify messages functionality
  app.post("/api/messages/test", async (req, res) => {
    if (process.env.NODE_ENV === "production") {
      return res.status(404).json({ error: "Not found" });
    }
    try {
      const userId = req.headers["user-id"] as string;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const results = {
        tableExists: false,
        canSendMessage: false,
        canReceiveMessage: false,
        canMarkAsRead: false,
        errors: [] as string[],
      };

      // Test 1: Check if table exists
      const { error: tableError } = await supabase
        .from("messages")
        .select("id")
        .limit(1);

      if (!tableError) {
        results.tableExists = true;
      } else {
        results.errors.push(`Table check failed: ${tableError.message}`);
      }

      // Test 2: Try to send a test message to self
      if (results.tableExists) {
        const { data: testMessage, error: sendError } = await supabase
          .from("messages")
          .insert({
            sender_id: userId,
            receiver_id: userId,
            subject: "Test Message",
            content:
              "This is a test message created at " + new Date().toISOString(),
          })
          .select()
          .single();

        if (!sendError && testMessage) {
          results.canSendMessage = true;

          // Test 3: Try to receive the message
          const { data: receivedMessages, error: receiveError } = await supabase
            .from("messages")
            .select("*")
            .eq("id", testMessage.id)
            .eq("receiver_id", userId);

          if (
            !receiveError &&
            receivedMessages &&
            receivedMessages.length > 0
          ) {
            results.canReceiveMessage = true;

            // Test 4: Try to mark as read
            const { error: readError } = await supabase
              .from("messages")
              .update({ is_read: true })
              .eq("id", testMessage.id)
              .eq("receiver_id", userId);

            if (!readError) {
              results.canMarkAsRead = true;
            } else {
              results.errors.push(`Mark as read failed: ${readError.message}`);
            }

            // Clean up test message
            await supabase.from("messages").delete().eq("id", testMessage.id);
          } else {
            results.errors.push(
              `Receive message failed: ${receiveError?.message || "Unknown error"}`,
            );
          }
        } else {
          results.errors.push(
            `Send message failed: ${sendError?.message || "Unknown error"}`,
          );
        }
      }

      const allTestsPassed =
        results.tableExists &&
        results.canSendMessage &&
        results.canReceiveMessage &&
        results.canMarkAsRead;

      res.json({
        success: allTestsPassed,
        results,
        message: allTestsPassed
          ? "All messaging tests passed!"
          : "Some tests failed",
      });
    } catch (error) {
      console.error("Test messages error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to test messages",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // ============================================
  // FORUMS API ENDPOINTS
  // ============================================

  // Get all categories
  app.get("/api/forums/categories", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("forum_categories")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) {
        console.error("Get categories error:", error);
        return res.status(500).json({ error: "Failed to fetch categories" });
      }

      // If members_count column exists in database, use it directly
      // Otherwise, calculate it on the fly
      const categoriesWithMembers = await Promise.all(
        (data || []).map(async (category) => {
          // Check if members_count is already stored in the database
          if (category.members_count !== undefined && category.members_count !== null) {
            return category;
          }

          // Calculate members_count if not stored (fallback for old data)
          // Get distinct users who created threads in this category
          const { data: threadAuthors } = await supabase
            .from("forum_threads")
            .select("author_id")
            .eq("category_id", category.id);

          // Get distinct users who posted in threads of this category
          const { data: threadIds } = await supabase
            .from("forum_threads")
            .select("id")
            .eq("category_id", category.id);

          let postAuthors: Record<string, any>[] = [];
          if (threadIds && threadIds.length > 0) {
            const threadIdList = threadIds.map((t) => t.id);
            const { data: posts } = await supabase
              .from("forum_posts")
              .select("author_id")
              .in("thread_id", threadIdList);
            postAuthors = posts || [];
          }

          // Combine and count unique users
          const allUserIds = new Set<string>();
          if (threadAuthors) {
            threadAuthors.forEach((t) => {
              if (t.author_id) allUserIds.add(t.author_id);
            });
          }
          postAuthors.forEach((p) => {
            if (p.author_id) allUserIds.add(p.author_id);
          });

          return {
            ...category,
            members_count: allUserIds.size,
          };
        })
      );

      res.json({ categories: categoriesWithMembers });
    } catch (error) {
      console.error("Get categories error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get single category with threads
  app.get("/api/forums/categories/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { limit = "20", offset = "0", sort = "recent" } = req.query;

      // Get category
      const { data: category, error: categoryError } = await supabase
        .from("forum_categories")
        .select("*")
        .eq("id", id)
        .single();

      if (categoryError || !category) {
        return res.status(404).json({ error: "Category not found" });
      }

      // Get threads in category
      let threadsQuery = supabase
        .from("forum_threads")
        .select(`
          *,
          author:users!forum_threads_author_id_fkey!inner(id, username),
          category:forum_categories!inner(name, slug, color)
        `)
        .eq("category_id", id);

      // Sort threads
      if (sort === "votes") {
        threadsQuery = threadsQuery.order("upvotes_count", { ascending: false });
      } else if (sort === "replies") {
        threadsQuery = threadsQuery.order("posts_count", { ascending: false });
      } else if (sort === "views") {
        threadsQuery = threadsQuery.order("views_count", { ascending: false });
      } else {
        threadsQuery = threadsQuery.order("last_activity_at", { ascending: false });
      }

      const { data: threads, error: threadsError } = await threadsQuery
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      if (threadsError) {
        console.error("Get threads error:", threadsError);
        return res.status(500).json({ error: "Failed to fetch threads" });
      }

      res.json({
        category,
        threads: threads || [],
      });
    } catch (error) {
      console.error("Get category error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get all threads with filters
  app.get("/api/forums/threads", async (req, res) => {
    try {
      const {
        category,
        type,
        search,
        sort = "recent",
        limit = "20",
        offset = "0",
        unanswered,
      } = req.query;

      let query = supabase
        .from("forum_threads")
        .select(`
          *,
          author:users!inner(id, username),
          category:forum_categories!inner(name, slug, color)
        `, { count: "exact" });

      // Filter by category
      if (category) {
        query = query.eq("category_id", category);
      }

      // Filter by type
      if (type) {
        query = query.eq("thread_type", type);
      }

      // Filter unanswered (0 replies)
      if (unanswered === "true") {
        query = query.eq("posts_count", 0);
      }

      // Search
      if (search) {
        query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
      }

      // Sort
      if (sort === "votes") {
        query = query.order("upvotes_count", { ascending: false });
      } else if (sort === "replies") {
        query = query.order("posts_count", { ascending: false });
      } else if (sort === "views") {
        query = query.order("views_count", { ascending: false });
      } else if (sort === "new") {
        query = query.order("created_at", { ascending: false });
      } else {
        query = query.order("last_activity_at", { ascending: false });
      }

      const { data, count, error } = await query
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      if (error) {
        console.error("Get threads error:", error);
        return res.status(500).json({ error: "Failed to fetch threads" });
      }

      // Fetch profile pictures from alumni table
      if (data && data.length > 0) {
        const authorIds = data.map((t: Record<string, any>) => t.author?.id).filter(Boolean);
        if (authorIds.length > 0) {
          const { data: alumniData } = await supabase
            .from("alumni")
            .select("user_id, profile_picture")
            .in("user_id", authorIds);

          if (alumniData) {
            const profileMap = new Map(
              alumniData.map((a) => [a.user_id, a.profile_picture])
            );
            data.forEach((thread: Record<string, any>) => {
              if (thread.author?.id) {
                thread.author.profile_picture = profileMap.get(thread.author.id) || null;
              }
            });
          }
        }
      }

      res.json({
        threads: data || [],
        count: count || 0,
      });
    } catch (error) {
      console.error("Get threads error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get single thread with posts
  app.get("/api/forums/threads/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.headers["user-id"] as string;

      // Get thread
      const { data: thread, error: threadError } = await supabase
        .from("forum_threads")
        .select(`
          *,
          author:users!forum_threads_author_id_fkey!inner(id, username),
          category:forum_categories!inner(name, slug, color)
        `)
        .eq("id", id)
        .single();

      if (threadError || !thread) {
        return res.status(404).json({ error: "Thread not found" });
      }

      // Fetch thread author profile picture
      if (thread.author?.id) {
        const { data: threadAlumni } = await supabase
          .from("alumni")
          .select("profile_picture")
          .eq("user_id", thread.author.id)
          .single();
        if (threadAlumni) {
          (thread as Record<string, any>).author.profile_picture = threadAlumni.profile_picture || null;
        }
      }

      // Get posts
      const { data: posts, error: postsError } = await supabase
        .from("forum_posts")
        .select(`
          *,
          author:users!forum_posts_author_id_fkey!inner(id, username)
        `)
        .eq("thread_id", id)
        .eq("is_deleted", false)
        .order("created_at", { ascending: true });

      if (postsError) {
        console.error("Get posts error:", postsError);
      }

      // Fetch post authors' profile pictures
      if (posts && posts.length > 0) {
        const postAuthorIds = posts.map((p: Record<string, any>) => p.author?.id).filter(Boolean);
        if (postAuthorIds.length > 0) {
          const { data: postAlumniData } = await supabase
            .from("alumni")
            .select("user_id, profile_picture")
            .in("user_id", postAuthorIds);

          if (postAlumniData) {
            const postProfileMap = new Map(
              postAlumniData.map((a) => [a.user_id, a.profile_picture])
            );
            posts.forEach((post: Record<string, any>) => {
              if (post.author?.id) {
                post.author.profile_picture = postProfileMap.get(post.author.id) || null;
              }
            });
          }
        }
      }

      // Check if user has voted
      let userVote = null;
      if (userId) {
        const { data: voteData } = await supabase
          .from("forum_votes")
          .select("vote_type")
          .eq("votable_type", "thread")
          .eq("votable_id", id)
          .eq("user_id", userId)
          .maybeSingle();

        userVote = voteData?.vote_type || null;
      }

      // Check if user has bookmarked
      let isBookmarked = false;
      if (userId) {
        const { data: bookmarkData } = await supabase
          .from("forum_bookmarks")
          .select("id")
          .eq("thread_id", id)
          .eq("user_id", userId)
          .maybeSingle();

        isBookmarked = !!bookmarkData;
      }

      // Check if user is subscribed
      let isSubscribed = false;
      if (userId) {
        const { data: subData } = await supabase
          .from("forum_subscriptions")
          .select("id")
          .eq("subscribable_type", "thread")
          .eq("subscribable_id", id)
          .eq("user_id", userId)
          .maybeSingle();

        isSubscribed = !!subData;
      }

      // Increment view count (async, don't wait)
      // Increment view count (if not author and not already viewed)
      if (userId && thread.author.id !== userId) {
        const { data: existingView } = await supabase
          .from("forum_thread_views")
          .select("id")
          .eq("thread_id", id)
          .eq("user_id", userId)
          .maybeSingle();

        if (!existingView) {
          await supabase.from("forum_thread_views").insert({
            thread_id: id,
            user_id: userId,
          });

          // Update the cached count on the thread
          await supabase
            .from("forum_threads")
            .update({ views_count: (thread.views_count || 0) + 1 })
            .eq("id", id);
        }
      }

      // Sync post count if mismatch
      const actualPostCount = posts ? posts.length : 0;
      if (thread.posts_count !== actualPostCount) {
        // Update DB async
        supabase
          .from("forum_threads")
          .update({ posts_count: actualPostCount })
          .eq("id", id)
          .then(({ error }) => {
            if (error) console.error("Failed to sync post count:", error);
          });

        // Use correct count in response
        thread.posts_count = actualPostCount;
      }

      res.json({
        thread: {
          ...thread,
          userVote,
          isBookmarked,
          isSubscribed,
        },
        posts: posts || [],
      });
    } catch (error) {
      console.error("Get thread error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create new thread
  app.post("/api/forums/threads", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { categoryId, title, content, threadType = "discussion", tags = [] } = req.body;

      if (!categoryId || !title || !content) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Generate slug
      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      // Create thread
      const { data: thread, error } = await supabase
        .from("forum_threads")
        .insert({
          category_id: categoryId,
          author_id: userId,
          title,
          slug,
          content,
          thread_type: threadType,
          tags,
        })
        .select(`
          *,
          author:users!forum_threads_author_id_fkey!inner(id, username),
          category:forum_categories!inner(name, slug, color)
        `)
        .single();

      if (error) {
        console.error("Create thread error:", error);
        return res.status(500).json({ error: "Failed to create thread" });
      }

      // Update user reputation
      try {
        await (supabase as any).rpc("increment_reputation", {
          p_user_id: userId,
          p_points: 5,
          p_threads_increment: 1,
        });
        
        // Update gamification points for thread creation
        incrementScore(userId, "thread_score", "thread_create", 1).catch(err => console.error("Gamification thread create error:", err));
      } catch (err) {
        console.error("Reputation update error:", err);
      }

      res.status(201).json({ thread });
    } catch (error) {
      console.error("Create thread error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update thread
  app.put("/api/forums/threads/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.headers["user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { title, content, tags } = req.body;

      // Check if user is author
      const { data: thread } = await supabase
        .from("forum_threads")
        .select("author_id")
        .eq("id", id)
        .single();

      if (!thread || thread.author_id !== userId) {
        return res.status(403).json({ error: "Forbidden: You can only edit your own threads" });
      }

      const updateData: Record<string, any> = {};
      if (title) updateData.title = title;
      if (content) updateData.content = content;
      if (tags) updateData.tags = tags;
      updateData.updated_at = new Date().toISOString();

      const { data: updatedThread, error } = await supabase
        .from("forum_threads")
        .update(updateData)
        .eq("id", id)
        .select(`
          *,
          author:users!forum_threads_author_id_fkey!inner(id, username),
          category:forum_categories!inner(name, slug, color)
        `)
        .single();

      if (error) {
        console.error("Update thread error:", error);
        return res.status(500).json({ error: "Failed to update thread" });
      }

      res.json({ thread: updatedThread });
    } catch (error) {
      console.error("Update thread error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete thread
  app.delete("/api/forums/threads/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.headers["user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Check if user is author or admin
      const { data: thread } = await supabase
        .from("forum_threads")
        .select("author_id")
        .eq("id", id)
        .single();

      const { data: user } = await supabase
        .from("users")
        .select("is_admin")
        .eq("id", userId)
        .single();

      if (!thread || (thread.author_id !== userId && !user?.is_admin)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const { error } = await supabase
        .from("forum_threads")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("Delete thread error:", error);
        return res.status(500).json({ error: "Failed to delete thread" });
      }

      // Deduct gamification points for thread deletion
      incrementScore(thread.author_id, "thread_score", "thread_create", -1).catch(err => console.error("Gamification thread delete error:", err));

      // Gamification Deduction: Forum thread deleted
      incrementScore(userId, "thread_score", "thread_create", -1).catch(err => 
        console.error("Gamification thread delete error:", err)
      );

      res.json({ message: "Thread deleted successfully" });
    } catch (error) {
      console.error("Delete thread error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create post/reply
  app.post("/api/forums/threads/:threadId/posts", async (req, res) => {
    try {
      const { threadId } = req.params;
      const userId = req.headers["user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { content, parentId } = req.body;

      if (!content) {
        return res.status(400).json({ error: "Content is required" });
      }

      // Create post
      const { data: post, error } = await supabase
        .from("forum_posts")
        .insert({
          thread_id: threadId,
          author_id: userId,
          content,
          parent_id: parentId || null,
        })
        .select(`
          *,
          author:users!forum_posts_author_id_fkey!inner(id, username)
        `)
        .single();

      if (error) {
        console.error("Create post error:", error);
        return res.status(500).json({ error: "Failed to create post" });
      }

      // Update thread stats and increment posts_count
      const { data: thread } = await supabase
        .from('forum_threads')
        .select('posts_count')
        .eq('id', threadId)
        .single();

      if (thread) {
        await supabase
          .from('forum_threads')
          .update({
            last_activity_at: new Date().toISOString(),
            posts_count: (thread.posts_count || 0) + 1
          })
          .eq('id', threadId);
      }

      // Update user reputation
      try {
        await (supabase as any).rpc("increment_reputation", {
          p_user_id: userId,
          p_points: 2,
          p_posts_increment: 1,
        });
        
        // Update gamification points for post reply
        incrementScore(userId, "thread_score", "post_reply", 1).catch(err => console.error("Gamification post reply error:", err));
      } catch (err) {
        console.error("Reputation update error:", err);
      }

      res.status(201).json({ post });
    } catch (error) {
      console.error("Create post error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update post
  app.put("/api/forums/posts/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.headers["user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { content } = req.body;

      // Check if user is author
      const { data: post } = await supabase
        .from("forum_posts")
        .select("author_id, content, edit_count, created_at")
        .eq("id", id)
        .single();

      if (!post || post.author_id !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      // Check edit time limit (5 minutes)
      const createdAt = new Date(post.created_at).getTime();
      const now = new Date().getTime();
      const fiveMinutes = 5 * 60 * 1000;

      if (now - createdAt > fiveMinutes) {
        return res.status(403).json({
          error: "Edit time limit exceeded. You can only edit within 5 minutes of posting."
        });
      }

      // Save edit history
      await supabase.from("forum_edit_history").insert({
        editable_type: "post",
        editable_id: id,
        editor_id: userId,
        previous_content: post.content,
        new_content: content,
      });

      const { data: updatedPost, error } = await supabase
        .from("forum_posts")
        .update({
          content,
          is_edited: true,
          edit_count: post.edit_count + 1,
          last_edited_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select(`
          *,
          author:users!forum_posts_author_id_fkey!inner(id, username)
        `)
        .single();

      if (error) {
        console.error("Update post error:", error);
        return res.status(500).json({ error: "Failed to update post" });
      }

      res.json({ post: updatedPost });
    } catch (error) {
      console.error("Update post error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete post
  app.delete("/api/forums/posts/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.headers["user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Check if user is author or admin
      const { data: post } = await supabase
        .from("forum_posts")
        .select("author_id")
        .eq("id", id)
        .single();

      const { data: user } = await supabase
        .from("users")
        .select("is_admin")
        .eq("id", userId)
        .single();

      if (!post || (post.author_id !== userId && !user?.is_admin)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      // Get thread_id before soft deleting
      const { data: postData } = await supabase
        .from('forum_posts')
        .select('thread_id')
        .eq('id', id)
        .single();

      const { error } = await supabase
        .from("forum_posts")
        .update({
          is_deleted: true,
          deleted_by: userId,
          deleted_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) {
        console.error("Delete post error:", error);
        return res.status(500).json({ error: "Failed to delete post" });
      }

      // Recalculate posts_count for the thread to ensure accuracy
      if (postData?.thread_id) {
        const { count, error: countError } = await supabase
          .from('forum_posts')
          .select('*', { count: 'exact', head: true })
          .eq('thread_id', postData.thread_id)
          .eq('is_deleted', false);

        if (!countError && count !== null) {
          await supabase
            .from('forum_threads')
            .update({
              posts_count: count
            })
            .eq('id', postData.thread_id);
        } else {
          console.error("Failed to recount posts:", countError);
        }
      }

      // Deduct gamification points for post deletion
      incrementScore(post.author_id, "thread_score", "post_reply", -1).catch(err => console.error("Gamification post delete error:", err));

      res.json({ message: "Post deleted successfully" });
    } catch (error) {
      console.error("Delete post error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Vote on thread or post
  app.post("/api/forums/:type/:id/vote", async (req, res) => {
    try {
      const { type, id } = req.params;
      const userId = req.headers["user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { voteType } = req.body; // 'upvote' or 'downvote'

      if (!["upvote", "downvote"].includes(voteType)) {
        return res.status(400).json({ error: "Invalid vote type" });
      }

      if (!["threads", "posts"].includes(type)) {
        return res.status(400).json({ error: "Invalid votable type" });
      }

      const votableType = type === "threads" ? "thread" : "post";
      const tableName = type === "threads" ? "forum_threads" : "forum_posts";

      // Check if user already voted
      const { data: existingVote } = await supabase
        .from("forum_votes")
        .select("*")
        .eq("user_id", userId)
        .eq("votable_type", votableType)
        .eq("votable_id", id)
        .maybeSingle();

      if (existingVote) {
        if (existingVote.vote_type === voteType) {
          // Remove vote
          await supabase
            .from("forum_votes")
            .delete()
            .eq("id", existingVote.id);

          // Update count
          const field = voteType === "upvote" ? "upvotes_count" : "downvotes_count";
          await supabase.rpc("decrement_vote_count", {
            p_table: tableName,
            p_id: id,
            p_field: field,
          });

          return res.json({ message: "Vote removed", action: "removed" });
        } else {
          // Change vote
          await supabase
            .from("forum_votes")
            .update({ vote_type: voteType })
            .eq("id", existingVote.id);

          // Update counts
          const oldField = existingVote.vote_type === "upvote" ? "upvotes_count" : "downvotes_count";
          const newField = voteType === "upvote" ? "upvotes_count" : "downvotes_count";

          await supabase.rpc("decrement_vote_count", {
            p_table: tableName,
            p_id: id,
            p_field: oldField,
          });

          await supabase.rpc("increment_vote_count", {
            p_table: tableName,
            p_id: id,
            p_field: newField,
          });

          return res.json({ message: "Vote changed", action: "changed" });
        }
      } else {
        // Add new vote
        await supabase
          .from("forum_votes")
          .insert({
            user_id: userId,
            votable_type: votableType,
            votable_id: id,
            vote_type: voteType,
          });

        // Update count
        const field = voteType === "upvote" ? "upvotes_count" : "downvotes_count";
        await supabase.rpc("increment_vote_count", {
          p_table: tableName,
          p_id: id,
          p_field: field,
        });

        // Update author reputation if upvote
        if (voteType === "upvote") {
          const { data: item } = await supabase
            .from(tableName)
            .select("author_id")
            .eq("id", id)
            .single();

          if (item) {
            await supabase.rpc("increment_reputation", {
              p_user_id: item.author_id,
              p_points: 10,
              p_helpful_votes_increment: 1,
            });
          }
        }

        return res.json({ message: "Vote added", action: "added" });
      }
    } catch (error) {
      console.error("Vote error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // React to thread or post
  app.post("/api/forums/:type/:id/react", async (req, res) => {
    try {
      const { type, id } = req.params;
      const userId = req.headers["user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { reactionType } = req.body;

      if (!["like", "love", "laugh", "think", "celebrate", "clap"].includes(reactionType)) {
        return res.status(400).json({ error: "Invalid reaction type" });
      }

      if (!["threads", "posts"].includes(type)) {
        return res.status(400).json({ error: "Invalid reactable type" });
      }

      const reactableType = type === "threads" ? "thread" : "post";

      // Check if user already reacted
      const { data: existingReaction } = await supabase
        .from("forum_reactions")
        .select("*")
        .eq("user_id", userId)
        .eq("reactable_type", reactableType)
        .eq("reactable_id", id)
        .maybeSingle();

      if (existingReaction) {
        if (existingReaction.reaction_type === reactionType) {
          // Remove reaction
          await supabase
            .from("forum_reactions")
            .delete()
            .eq("id", existingReaction.id);

          return res.json({ message: "Reaction removed" });
        } else {
          // Change reaction
          await supabase
            .from("forum_reactions")
            .update({ reaction_type: reactionType })
            .eq("id", existingReaction.id);

          return res.json({ message: "Reaction changed" });
        }
      } else {
        // Add new reaction
        await supabase
          .from("forum_reactions")
          .insert({
            user_id: userId,
            reactable_type: reactableType,
            reactable_id: id,
            reaction_type: reactionType,
          });

        return res.json({ message: "Reaction added" });
      }
    } catch (error) {
      console.error("React error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get reactions for thread or post
  app.get("/api/forums/:type/:id/reactions", async (req, res) => {
    try {
      const { type, id } = req.params;
      const reactableType = type === "threads" ? "thread" : "post";

      const { data, error } = await supabase
        .from("forum_reactions")
        .select(`
          *,
          user:users!inner(id, username, profile_picture)
        `)
        .eq("reactable_type", reactableType)
        .eq("reactable_id", id);

      if (error) {
        console.error("Get reactions error:", error);
        return res.status(500).json({ error: "Failed to fetch reactions" });
      }

      // Group by reaction type
      const grouped = (data || []).reduce((acc: Record<string, any[]>, reaction: Record<string, any>) => {
        if (!acc[reaction.reaction_type]) {
          acc[reaction.reaction_type] = [];
        }
        acc[reaction.reaction_type].push(reaction.user);
        return acc;
      }, {});

      res.json({ reactions: grouped });
    } catch (error) {
      console.error("Get reactions error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Bookmark thread
  app.post("/api/forums/threads/:id/bookmark", async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.headers["user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { collection = "default", notes } = req.body;

      // Check if already bookmarked
      const { data: existing } = await supabase
        .from("forum_bookmarks")
        .select("id")
        .eq("user_id", userId)
        .eq("thread_id", id)
        .maybeSingle();

      if (existing) {
        // Remove bookmark
        await supabase
          .from("forum_bookmarks")
          .delete()
          .eq("id", existing.id);

        return res.json({ message: "Bookmark removed", bookmarked: false });
      } else {
        // Add bookmark
        await supabase
          .from("forum_bookmarks")
          .insert({
            user_id: userId,
            thread_id: id,
            collection_name: collection,
            notes,
          });

        return res.json({ message: "Bookmark added", bookmarked: true });
      }
    } catch (error) {
      console.error("Bookmark error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get user bookmarks
  app.get("/api/forums/bookmarks", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { data, error } = await supabase
        .from("forum_bookmarks")
        .select(`
          *,
          thread:forum_threads!inner(
            *,
            author:users!forum_threads_author_id_fkey!inner(id, username),
            category:forum_categories!inner(name, slug, color)
          )
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Get bookmarks error:", error);
        return res.status(500).json({ error: "Failed to fetch bookmarks" });
      }

      res.json({ bookmarks: data || [] });
    } catch (error) {
      console.error("Get bookmarks error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Subscribe to thread or category
  app.post("/api/forums/:type/:id/subscribe", async (req, res) => {
    try {
      const { type, id } = req.params;
      const userId = req.headers["user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!["threads", "categories"].includes(type)) {
        return res.status(400).json({ error: "Invalid subscribable type" });
      }

      const subscribableType = type === "threads" ? "thread" : "category";
      const { frequency = "instant" } = req.body;

      // Check if already subscribed
      const { data: existing } = await supabase
        .from("forum_subscriptions")
        .select("id")
        .eq("user_id", userId)
        .eq("subscribable_type", subscribableType)
        .eq("subscribable_id", id)
        .maybeSingle();

      if (existing) {
        // Unsubscribe
        await supabase
          .from("forum_subscriptions")
          .delete()
          .eq("id", existing.id);

        return res.json({ message: "Unsubscribed", subscribed: false });
      } else {
        // Subscribe
        await supabase
          .from("forum_subscriptions")
          .insert({
            user_id: userId,
            subscribable_type: subscribableType,
            subscribable_id: id,
            notification_frequency: frequency,
          });

        return res.json({ message: "Subscribed", subscribed: true });
      }
    } catch (error) {
      console.error("Subscribe error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Search threads and posts
  app.get("/api/forums/search", async (req, res) => {
    try {
      const { q, category, type, sort = "relevance", limit = "20", offset = "0" } = req.query;

      if (!q) {
        return res.status(400).json({ error: "Search query is required" });
      }

      let query = supabase
        .from("forum_threads")
        .select(`
          *,
          author:users!forum_threads_author_id_fkey!inner(id, username),
          category:forum_categories!inner(name, slug, color)
        `, { count: "exact" });

      // Full-text search
      query = query.or(`title.ilike.%${q}%,content.ilike.%${q}%`);

      // Filter by category
      if (category) {
        query = query.eq("category_id", category);
      }

      // Filter by type
      if (type) {
        query = query.eq("thread_type", type);
      }

      // Sort
      if (sort === "votes") {
        query = query.order("upvotes_count", { ascending: false });
      } else if (sort === "recent") {
        query = query.order("created_at", { ascending: false });
      } else {
        query = query.order("last_activity_at", { ascending: false });
      }

      const { data, count, error } = await query
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      if (error) {
        console.error("Search error:", error);
        return res.status(500).json({ error: "Failed to search" });
      }

      // Fetch profile pictures from alumni table
      if (data && data.length > 0) {
        const authorIds = data.map((t: any) => t.author?.id).filter(Boolean);
        if (authorIds.length > 0) {
          const { data: alumniData } = await supabase
            .from("alumni")
            .select("user_id, profile_picture")
            .in("user_id", authorIds);

          if (alumniData) {
            const profileMap = new Map(
              alumniData.map((a) => [a.user_id, a.profile_picture])
            );
            data.forEach((thread: any) => {
              if (thread.author?.id) {
                thread.author.profile_picture = profileMap.get(thread.author.id) || null;
              }
            });
          }
        }
      }

      res.json({
        results: data || [],
        count: count || 0,
      });
    } catch (error) {
      console.error("Search error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get rising threads (formerly trending)
  app.get("/api/forums/rising", async (req, res) => {
    try {
      const { limit = "10" } = req.query;

      // Get threads with rising activity (last 30 days) to calculate "Rising" score
      // Algorithm: (upvotes + posts * 2) / (hours_since_created + 2)^1.8
      // Focuses on new content gaining traction fast
      const { data, error } = await supabase
        .from("forum_threads")
        .select(`
          *,
          author:users!forum_threads_author_id_fkey!inner(id, username),
          category:forum_categories!inner(name, slug, color)
        `)
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .limit(50); // Fetch a candidate pool to sort in-memory

      if (!error && data) {
        // Calculate scores and sort
        const now = new Date().getTime();
        data.forEach((thread: Record<string, any>) => {
          const createdTime = new Date(thread.created_at).getTime();
          const hours = (now - createdTime) / (1000 * 60 * 60);
          const score = (parseInt(thread.upvotes_count || 0) + parseInt(thread.posts_count || 0) * 2) / Math.pow(hours + 2, 1.8);
          thread.rising_score = score;
        });

        // Sort by score descending
        data.sort((a: Record<string, any>, b: Record<string, any>) => b.rising_score - a.rising_score);

        // Apply limit
        const limitNum = Number(limit);
        if (data.length > limitNum) {
          data.length = limitNum;
        }
      }

      if (error) {
        console.error("Get rising error:", error);
        return res.status(500).json({ error: "Failed to fetch rising threads" });
      }

      // Fetch profile pictures from alumni table
      if (data && data.length > 0) {
        const authorIds = data.map((t: Record<string, any>) => t.author?.id).filter(Boolean);
        if (authorIds.length > 0) {
          const { data: alumniData } = await supabase
            .from("alumni")
            .select("user_id, profile_picture")
            .in("user_id", authorIds);

          if (alumniData) {
            const profileMap = new Map(
              alumniData.map((a) => [a.user_id, a.profile_picture])
            );
            data.forEach((thread: Record<string, any>) => {
              if (thread.author?.id) {
                thread.author.profile_picture = profileMap.get(thread.author.id) || null;
              }
            });
          }
        }
      }

      res.json({ threads: data || [] });
    } catch (error) {
      console.error("Get trending error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get user reputation
  app.get("/api/forums/users/:id/reputation", async (req, res) => {
    try {
      const { id } = req.params;

      const { data, error } = await supabase
        .from("forum_user_reputation")
        .select("*")
        .eq("user_id", id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        console.error("Get reputation error:", error);
        return res.status(500).json({ error: "Failed to fetch reputation" });
      }

      // If no reputation record exists, create one
      if (!data) {
        const { data: newRep, error: createError } = await supabase
          .from("forum_user_reputation")
          .insert({
            user_id: id,
            reputation_score: 0,
            threads_count: 0,
            posts_count: 0,
            accepted_answers_count: 0,
            helpful_votes_count: 0,
            reputation_level: "newbie",
          })
          .select()
          .single();

        if (createError) {
          console.error("Create reputation error:", createError);
          return res.status(500).json({ error: "Failed to create reputation" });
        }

        return res.json({ reputation: newRep });
      }

      res.json({ reputation: data });
    } catch (error) {
      console.error("Get reputation error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get user badges
  app.get("/api/forums/users/:id/badges", async (req, res) => {
    try {
      const { id } = req.params;

      const { data, error } = await supabase
        .from("forum_user_badges")
        .select(`
          *,
          badge:forum_badges!inner(*)
        `)
        .eq("user_id", id)
        .order("earned_at", { ascending: false });

      if (error) {
        console.error("Get badges error:", error);
        return res.status(500).json({ error: "Failed to fetch badges" });
      }

      res.json({ badges: data || [] });
    } catch (error) {
      console.error("Get badges error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get leaderboard
  app.get("/api/forums/leaderboard", async (req, res) => {
    try {
      const { period = "all", limit = "10" } = req.query;

      const { data, error } = await supabase
        .from("forum_user_reputation")
        .select(`
          *,
          user:users!inner(id, username)
        `)
        .order("reputation_score", { ascending: false })
        .limit(Number(limit));

      if (error) {
        console.error("Get leaderboard error:", error);
        return res.status(500).json({ error: "Failed to fetch leaderboard" });
      }

      // Fetch profile pictures from alumni table
      if (data && data.length > 0) {
        const userIds = data.map((item: Record<string, any>) => item.user?.id).filter(Boolean);
        if (userIds.length > 0) {
          const { data: alumniData } = await supabase
            .from("alumni")
            .select("user_id, profile_picture")
            .in("user_id", userIds);

          if (alumniData) {
            const profileMap = new Map(
              alumniData.map((a) => [a.user_id, a.profile_picture])
            );
            data.forEach((item: Record<string, any>) => {
              if (item.user?.id) {
                // Prefer alumni profile picture if available
                const alumniPic = profileMap.get(item.user.id);
                if (alumniPic) {
                  item.user.profile_picture = alumniPic;
                }
              }
            });
          }
        }
      }

      res.json({ leaderboard: data || [] });
    } catch (error) {
      console.error("Get leaderboard error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Pin/Unpin thread (moderator)
  app.post("/api/forums/threads/:id/pin", async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.headers["user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Check if user is admin
      const { data: user } = await supabase
        .from("users")
        .select("is_admin")
        .eq("id", userId)
        .single();

      if (!user?.is_admin) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const { data: thread } = await supabase
        .from("forum_threads")
        .select("is_pinned")
        .eq("id", id)
        .single();

      if (!thread) {
        return res.status(404).json({ error: "Thread not found" });
      }

      const { error } = await supabase
        .from("forum_threads")
        .update({ is_pinned: !thread.is_pinned })
        .eq("id", id);

      if (error) {
        console.error("Pin thread error:", error);
        return res.status(500).json({ error: "Failed to pin thread" });
      }

      res.json({ message: thread.is_pinned ? "Thread unpinned" : "Thread pinned" });
    } catch (error) {
      console.error("Pin thread error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Lock/Unlock thread (moderator)
  app.post("/api/forums/threads/:id/lock", async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.headers["user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Check if user is admin
      const { data: user } = await supabase
        .from("users")
        .select("is_admin")
        .eq("id", userId)
        .single();

      if (!user?.is_admin) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const { data: thread } = await supabase
        .from("forum_threads")
        .select("is_locked")
        .eq("id", id)
        .single();

      if (!thread) {
        return res.status(404).json({ error: "Thread not found" });
      }

      const { error } = await supabase
        .from("forum_threads")
        .update({ is_locked: !thread.is_locked })
        .eq("id", id);

      if (error) {
        console.error("Lock thread error:", error);
        return res.status(500).json({ error: "Failed to lock thread" });
      }

      res.json({ message: thread.is_locked ? "Thread unlocked" : "Thread locked" });
    } catch (error) {
      console.error("Lock thread error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Mark thread as resolved
  app.post("/api/forums/threads/:id/resolve", async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.headers["user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { acceptedAnswerId } = req.body;

      // Check if user is thread author
      const { data: thread } = await supabase
        .from("forum_threads")
        .select("author_id, thread_type")
        .eq("id", id)
        .single();

      if (!thread || thread.author_id !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      if (thread.thread_type !== "question") {
        return res.status(400).json({ error: "Only questions can be resolved" });
      }

      const { error } = await supabase
        .from("forum_threads")
        .update({
          is_resolved: true,
          accepted_answer_id: acceptedAnswerId || null,
        })
        .eq("id", id);

      if (error) {
        console.error("Resolve thread error:", error);
        return res.status(500).json({ error: "Failed to resolve thread" });
      }

      // Update reputation for accepted answer author
      if (acceptedAnswerId) {
        const { data: post } = await supabase
          .from("forum_posts")
          .select("author_id")
          .eq("id", acceptedAnswerId)
          .single();

        if (post) {
          await supabase.rpc("increment_reputation", {
            p_user_id: post.author_id,
            p_points: 15,
            p_accepted_answers_increment: 1,
          });
        }
      }

      res.json({ message: "Thread marked as resolved" });
    } catch (error) {
      console.error("Resolve thread error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
