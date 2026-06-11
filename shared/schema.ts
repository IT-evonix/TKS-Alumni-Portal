import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  isAdmin: boolean("is_admin").default(false),
  userRole: text("user_role").default("alumni"), // 'alumni', 'student', 'faculty', 'administrator'
  accountApproved: boolean("account_approved").default(true),
  accountBlocked: boolean("account_blocked").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  token: text("token").notNull(),
  tokenType: text("token_type").notNull(), // 'reset', 'setup'
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const alumni = pgTable("alumni", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),

  // Personal Information
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  dateOfBirth: timestamp("date_of_birth"),
  gender: text("gender"), // 'male', 'female', 'other', 'prefer_not_to_say'
  profilePicture: text("profile_picture"),
  bio: text("bio"),

  // Academic Information
  graduationYear: integer("graduation_year"),
  batch: text("batch"),
  course: text("course"),
  branch: text("branch"),
  rollNumber: text("roll_number"),
  cgpa: text("cgpa"),

  // Location Information
  currentCity: text("current_city"),
  currentState: text("current_state"),
  currentCountry: text("current_country"),
  permanentAddress: text("permanent_address"),

  // Professional Information
  currentCompany: text("current_company"),

  currentRole: text("current_role"),
  industry: text("industry"),
  experience: text("experience"),
  skills: text("skills"), // JSON string of skills array

  // Advanced Professional Fields


  // Skills & Expertise


  // Additional Info


  // Higher Education
  higherEducation: text("higher_education"),
  university: text("university"),
  higherEducationCountry: text("higher_education_country"),

  // Social Links
  linkedinUrl: text("linkedin_url"),
  githubUrl: text("github_url"),
  twitterUrl: text("twitter_url"),
  personalWebsite: text("personal_website"),

  // Privacy Settings
  isProfilePublic: boolean("is_profile_public").default(true),
  showEmail: boolean("show_email").default(false),
  showPhone: boolean("show_phone").default(false),


  // LinkedIn Integration


  // Status
  isVerified: boolean("is_verified").default(false),
  isActive: boolean("is_active").default(true),


  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ==================== MULTI-ENTRY PROFILE TABLES ====================

// Professional Experiences
export const alumniExperiences = pgTable("alumni_experiences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  alumniId: varchar("alumni_id").references(() => alumni.id, { onDelete: 'cascade' }).notNull(),
  companyName: text("company_name").notNull(),
  position: text("position").notNull(),
  employmentType: text("employment_type"), // full-time, part-time, contract, internship, freelance
  location: text("location"),
  locationType: text("location_type"), // onsite, remote, hybrid
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  isCurrent: boolean("is_current").default(false),
  description: text("description"),
  responsibilities: text("responsibilities").array(),
  achievements: text("achievements").array(),
  skillsUsed: text("skills_used").array(),
  industry: text("industry"),
  companySize: text("company_size"), // startup, small, medium, large, enterprise
  companyUrl: text("company_url"),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Skills & Expertise
export const alumniSkills = pgTable("alumni_skills", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  alumniId: varchar("alumni_id").references(() => alumni.id, { onDelete: 'cascade' }).notNull(),
  skillName: text("skill_name").notNull(),
  category: text("category"), // technical, soft, language, tool, framework, domain
  proficiencyLevel: text("proficiency_level"), // beginner, intermediate, advanced, expert
  yearsOfExperience: integer("years_of_experience"),
  lastUsedDate: timestamp("last_used_date"),
  isPrimary: boolean("is_primary").default(false),
  endorsementsCount: integer("endorsements_count").default(0),
  verified: boolean("verified").default(false),
  description: text("description"),
  relatedProjects: text("related_projects").array(),
  certificationIds: text("certification_ids").array(),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Certifications
export const alumniCertifications = pgTable("alumni_certifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  alumniId: varchar("alumni_id").references(() => alumni.id, { onDelete: 'cascade' }).notNull(),
  certificationName: text("certification_name").notNull(),
  issuingOrganization: text("issuing_organization").notNull(),
  issueDate: timestamp("issue_date").notNull(),
  expiryDate: timestamp("expiry_date"),
  credentialId: text("credential_id"),
  credentialUrl: text("credential_url"),
  verificationUrl: text("verification_url"),
  isActive: boolean("is_active").default(true),
  skillsGained: text("skills_gained").array(),
  description: text("description"),
  certificateFileUrl: text("certificate_file_url"),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Languages
export const alumniLanguages = pgTable("alumni_languages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  alumniId: varchar("alumni_id").references(() => alumni.id, { onDelete: 'cascade' }).notNull(),
  languageName: text("language_name").notNull(),
  proficiencyLevel: text("proficiency_level").notNull(), // native, fluent, advanced, intermediate, beginner
  canRead: boolean("can_read").default(true),
  canWrite: boolean("can_write").default(true),
  canSpeak: boolean("can_speak").default(true),
  certificationName: text("certification_name"),
  certificationScore: text("certification_score"),
  certificationDate: timestamp("certification_date"),
  isNative: boolean("is_native").default(false),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Achievements & Awards
export const alumniAchievements = pgTable("alumni_achievements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  alumniId: varchar("alumni_id").references(() => alumni.id, { onDelete: 'cascade' }).notNull(),
  achievementType: text("achievement_type").notNull(), // award, recognition, publication, patent, project, competition, other
  title: text("title").notNull(),
  description: text("description"),
  issuingOrganization: text("issuing_organization"),
  dateReceived: timestamp("date_received").notNull(),
  category: text("category"), // academic, professional, community, sports, arts, research
  level: text("level"), // international, national, state, institutional, local
  url: text("url"),
  certificateUrl: text("certificate_url"),
  coRecipients: text("co_recipients").array(),
  impactDescription: text("impact_description"),
  mediaCoverageUrls: text("media_coverage_urls").array(),
  isFeatured: boolean("is_featured").default(false),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Projects Portfolio
export const alumniProjects = pgTable("alumni_projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  alumniId: varchar("alumni_id").references(() => alumni.id, { onDelete: 'cascade' }).notNull(),
  projectName: text("project_name").notNull(),
  projectType: text("project_type"), // personal, professional, academic, open-source
  description: text("description").notNull(),
  role: text("role"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  isOngoing: boolean("is_ongoing").default(false),
  technologiesUsed: text("technologies_used").array(),
  projectUrl: text("project_url"),
  githubUrl: text("github_url"),
  demoUrl: text("demo_url"),
  imageUrls: text("image_urls").array(),
  teamSize: integer("team_size"),
  yourContribution: text("your_contribution"),
  outcomes: text("outcomes"),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const events = pgTable("events", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),
  title: text("title").notNull(),
  description: text("description"),
  eventDate: timestamp("event_date").notNull(),
  eventTime: text("event_time"),
  location: text("location"),
  // venue: text("venue"), // Temporarily commented out - column not present in current database
  isVirtual: boolean("is_virtual").default(false),
  virtualLink: text("virtual_link"),
  maxAttendees: integer("max_attendees"),
  registrationDeadline: timestamp("registration_deadline"),
  coverImage: text("cover_image"),
  tags: text("tags").array(),
  organizedBy: varchar("organized_by").references(() => users.id),
  postedBy: varchar("posted_by").references(() => users.id),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const eventRsvps = pgTable("event_rsvps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: text("event_id").references(() => events.id, { onDelete: 'cascade' }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  status: text("status").notNull().default("attending"), // attending, maybe, not_attending
  guestsCount: integer("guests_count").default(1),
  notes: text("notes"),
  reminderSent: boolean("reminder_sent").default(false),
  attendanceMarked: boolean("attendance_marked").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  senderId: varchar("sender_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  receiverId: varchar("receiver_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  subject: text("subject"),
  content: text("content").notNull(),
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  isEdited: boolean("is_edited").default(false),
});

export const messageReactions = pgTable("message_reactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").references(() => messages.id, { onDelete: 'cascade' }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  emoji: text("emoji").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const messageReplies = pgTable("message_replies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").references(() => messages.id, { onDelete: 'cascade' }).notNull(),
  senderId: varchar("sender_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  type: text("type").notNull(), // event, job, message, connection, post
  title: text("title").notNull(),
  content: text("content").notNull(),
  relatedId: text("related_id"), // ID of related entity
  redirectUrl: text("redirect_url"), // URL to redirect when notification is clicked
  actorId: varchar("actor_id").references(() => users.id, { onDelete: 'set null' }), // Who triggered this notification
  metadata: text("metadata"), // JSON string for extensible data
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"), // When notification was marked as read
  createdAt: timestamp("created_at").defaultNow(),
});

export const linkedinIntegrations = pgTable("linkedin_integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  linkedinId: text("linkedin_id").unique(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiry: timestamp("token_expiry"),
  syncEnabled: boolean("sync_enabled").default(false),
  syncFields: text("sync_fields").array().default(sql`'{}'::text[]`), // fields user wants to sync
  lastSyncAt: timestamp("last_sync_at"),
  profileData: text("profile_data"), // JSON string of comprehensive LinkedIn data
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const jobs = pgTable("jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  company: text("company").notNull(),
  location: text("location"),
  jobType: text("job_type"), // full-time, part-time, contract, internship
  workMode: text("work_mode"), // remote, onsite, hybrid
  description: text("description"),
  requirements: text("requirements"),
  salaryMin: integer("salary_min"),
  salaryMax: integer("salary_max"),
  experienceLevel: text("experience_level"),
  applicationDeadline: timestamp("application_deadline"),
  applicationUrl: text("application_url"),
  contactEmail: text("contact_email"),
  postedBy: varchar("posted_by").references(() => users.id),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const jobApplications = pgTable("job_applications", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),
  userId: text("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  jobId: text("job_id").references(() => jobs.id, { onDelete: 'cascade' }).notNull(),
  status: text("status").notNull().default("applied"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const savedJobs = pgTable("saved_jobs", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),
  userId: text("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  jobId: text("job_id").references(() => jobs.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const feedPosts = pgTable("feed_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  authorId: varchar("author_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  postType: text("post_type").default("general"), // general, achievement, job_update, etc.
  likesCount: integer("likes_count").default(0),
  commentsCount: integer("comments_count").default(0),
  isActive: boolean("is_active").default(true),
  status: text("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Added for post interactions
export const postLikes = pgTable("post_likes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").references(() => feedPosts.id, { onDelete: 'cascade' }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const postComments = pgTable("post_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").references(() => feedPosts.id, { onDelete: 'cascade' }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  content: text("content").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// New table for comment replies
export const postCommentReplies = pgTable("post_comment_replies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  commentId: varchar("comment_id").references(() => postComments.id, { onDelete: 'cascade' }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  content: text("content").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const signupRequests = pgTable("signup_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  graduationYear: integer("graduation_year"),
  batch: text("batch"),
  userType: text("user_type").default("alumni"),
  course: text("course"),
  branch: text("branch"),
  rollNumber: text("roll_number"),
  cgpa: text("cgpa"),
  currentCity: text("current_city"),
  currentCompany: text("current_company"),
  currentRole: text("current_role"),
  linkedinUrl: text("linkedin_url"),
  linkedinOauthId: text("linkedin_oauth_id"),
  reasonForJoining: text("reason_for_joining"),
  status: text("status").default("pending"),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const connections = pgTable("connection_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requesterId: varchar("requester_id").references(() => users.id).notNull(),
  recipientId: varchar("recipient_id").references(() => users.id).notNull(),
  status: text("status").notNull().default("pending"),
  message: text("message"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const userBlocks = pgTable("user_blocks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  blockerId: varchar("blocker_id").references(() => users.id).notNull(),
  blockedId: varchar("blocked_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const heroSection = pgTable("hero_section", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  ctaText: text("cta_text"),
  ctaLink: text("cta_link"),
  backgroundImage: text("background_image"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const testimonials = pgTable("testimonials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  role: text("role"),
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const portalFeatures = pgTable("portal_features", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  icon: text("icon"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const alumniStatistics = pgTable("alumni_statistics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  label: text("label").notNull(),
  value: text("value").notNull(),
  icon: text("icon"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const landingEvents = pgTable("landing_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  eventDate: timestamp("event_date").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const communityHighlights = pgTable("community_highlights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const whyJoinReasons = pgTable("why_join_reasons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  icon: text("icon"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const alumniBenefits = pgTable("alumni_benefits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  icon: text("icon"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const signupRateLimits = pgTable("signup_rate_limits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ipAddress: text("ip_address").notNull(),
  attemptedAt: timestamp("attempted_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
});

export const insertAlumniSchema = createInsertSchema(alumni).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  graduationYear: z.coerce.number().min(2018, "Graduation year must be 2018 or later").optional().nullable(),
});

export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertJobSchema = createInsertSchema(jobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertJobApplicationSchema = createInsertSchema(jobApplications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSavedJobSchema = createInsertSchema(savedJobs).omit({
  id: true,
  createdAt: true,
});

export const insertFeedPostSchema = createInsertSchema(feedPosts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  likesCount: true,
  commentsCount: true,
});

// Schema for inserting likes and comments
export const insertPostLikeSchema = createInsertSchema(postLikes).omit({
  id: true,
  createdAt: true,
});

export const insertPostCommentSchema = createInsertSchema(postComments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPostCommentReplySchema = createInsertSchema(postCommentReplies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertConnectionSchema = createInsertSchema(connections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserBlockSchema = createInsertSchema(userBlocks).omit({
  id: true,
  createdAt: true,
});

export const insertHeroSectionSchema = createInsertSchema(heroSection).omit({
  id: true,
  updatedAt: true,
});

export const insertTestimonialSchema = createInsertSchema(testimonials).omit({
  id: true,
  createdAt: true,
});

export const insertPortalFeatureSchema = createInsertSchema(portalFeatures).omit({
  id: true,
  createdAt: true,
});

export const insertAlumniStatisticSchema = createInsertSchema(alumniStatistics).omit({
  id: true,
  createdAt: true,
});

export const insertLandingEventSchema = createInsertSchema(landingEvents).omit({
  id: true,
  createdAt: true,
});

export const insertCommunityHighlightSchema = createInsertSchema(communityHighlights).omit({
  id: true,
  createdAt: true,
});

export const insertWhyJoinReasonSchema = createInsertSchema(whyJoinReasons).omit({
  id: true,
  createdAt: true,
});

export const insertAlumniBenefitSchema = createInsertSchema(alumniBenefits).omit({
  id: true,
  createdAt: true,
});

export const insertSignupRequestSchema = createInsertSchema(signupRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  reviewedBy: true,
  reviewedAt: true,
}).extend({
  graduationYear: z.coerce.number().min(2018, "Graduation year must be 2018 or later").optional().nullable(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertAlumni = z.infer<typeof insertAlumniSchema>;
export type Alumni = typeof alumni.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof events.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobs.$inferSelect;
export type InsertJobApplication = z.infer<typeof insertJobApplicationSchema>;
export type JobApplication = typeof jobApplications.$inferSelect;
export type InsertSavedJob = z.infer<typeof insertSavedJobSchema>;
export type SavedJob = typeof savedJobs.$inferSelect;
export type InsertFeedPost = z.infer<typeof insertFeedPostSchema>;
export type FeedPost = typeof feedPosts.$inferSelect;
export type InsertConnection = z.infer<typeof insertConnectionSchema>;
export type Connection = typeof connections.$inferSelect;
export type UserBlock = typeof userBlocks.$inferSelect;
export type InsertUserBlock = z.infer<typeof insertUserBlockSchema>;
export type HeroSection = typeof heroSection.$inferSelect;
export type Testimonial = typeof testimonials.$inferSelect;
export type PortalFeature = typeof portalFeatures.$inferSelect;
export type AlumniStatistic = typeof alumniStatistics.$inferSelect;
export type LandingEvent = typeof landingEvents.$inferSelect;
export type CommunityHighlight = typeof communityHighlights.$inferSelect;
export type WhyJoinReason = typeof whyJoinReasons.$inferSelect;
export type AlumniBenefit = typeof alumniBenefits.$inferSelect;

// Types for likes and comments
export type PostLike = typeof postLikes.$inferSelect;
export type InsertPostLike = z.infer<typeof insertPostLikeSchema>;
export type PostComment = typeof postComments.$inferSelect;
export type InsertPostComment = z.infer<typeof insertPostCommentSchema>;

// Types for comment replies
export type PostCommentReply = typeof postCommentReplies.$inferSelect;
export type InsertPostCommentReply = z.infer<typeof insertPostCommentReplySchema>;

// Types for signup requests
export type SignupRequest = typeof signupRequests.$inferSelect;
export type InsertSignupRequest = z.infer<typeof insertSignupRequestSchema>;

// Event RSVP schemas
export const insertEventRsvpSchema = createInsertSchema(eventRsvps).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type EventRsvp = typeof eventRsvps.$inferSelect;
export type InsertEventRsvp = z.infer<typeof insertEventRsvpSchema>;


// Message schemas
export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

// Notification schemas
export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

// LinkedIn Integration schemas
export const insertLinkedinIntegrationSchema = createInsertSchema(linkedinIntegrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type LinkedinIntegration = typeof linkedinIntegrations.$inferSelect;
export type InsertLinkedinIntegration = z.infer<typeof insertLinkedinIntegrationSchema>;

// ==================== MULTI-ENTRY PROFILE SCHEMAS ====================

// Experience schemas
export const insertExperienceSchema = createInsertSchema(alumniExperiences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AlumniExperience = typeof alumniExperiences.$inferSelect;
export type InsertAlumniExperience = z.infer<typeof insertExperienceSchema>;

// Skill schemas
export const insertSkillSchema = createInsertSchema(alumniSkills).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AlumniSkill = typeof alumniSkills.$inferSelect;
export type InsertAlumniSkill = z.infer<typeof insertSkillSchema>;

// Certification schemas
export const insertCertificationSchema = createInsertSchema(alumniCertifications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AlumniCertification = typeof alumniCertifications.$inferSelect;
export type InsertAlumniCertification = z.infer<typeof insertCertificationSchema>;

// Language schemas
export const insertLanguageSchema = createInsertSchema(alumniLanguages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AlumniLanguage = typeof alumniLanguages.$inferSelect;
export type InsertAlumniLanguage = z.infer<typeof insertLanguageSchema>;

// Achievement schemas
export const insertAchievementSchema = createInsertSchema(alumniAchievements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AlumniAchievement = typeof alumniAchievements.$inferSelect;
export type InsertAlumniAchievement = z.infer<typeof insertAchievementSchema>;

// Project schemas
export const insertProjectSchema = createInsertSchema(alumniProjects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AlumniProject = typeof alumniProjects.$inferSelect;
export type InsertAlumniProject = z.infer<typeof insertProjectSchema>;

// ==================== ADMIN DIGEST TABLES ====================

// Admin digest preferences - stores admin email digest settings
export const adminDigestPreferences = pgTable("admin_digest_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminId: varchar("admin_id").references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  enabled: boolean("enabled").default(true),
  deliveryTime: text("delivery_time").default("09:00:00"), // HH:MM:SS format
  timezone: text("timezone").default("Asia/Kolkata"),
  includeSections: text("include_sections").default('["pending_actions","metrics","alerts","insights"]'), // JSON array
  minPendingThreshold: integer("min_pending_threshold").default(0), // Only send if pending items >= threshold
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Admin digest logs - tracks digest delivery history
export const adminDigestLogs = pgTable("admin_digest_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminId: varchar("admin_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  sentAt: timestamp("sent_at").defaultNow(),
  digestDate: timestamp("digest_date").notNull(), // Date the digest covers
  emailStatus: text("email_status").default("sent"), // sent, failed, skipped
  metricsSnapshot: text("metrics_snapshot"), // JSON string of metrics sent
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Schemas for admin digest
export const insertAdminDigestPreferenceSchema = createInsertSchema(adminDigestPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAdminDigestLogSchema = createInsertSchema(adminDigestLogs).omit({
  id: true,
  createdAt: true,
});

export type AdminDigestPreference = typeof adminDigestPreferences.$inferSelect;
export type InsertAdminDigestPreference = z.infer<typeof insertAdminDigestPreferenceSchema>;
export type AdminDigestLog = typeof adminDigestLogs.$inferSelect;
export type InsertAdminDigestLog = z.infer<typeof insertAdminDigestLogSchema>;

// ==================== GAMIFICATION MODULE ====================

// Master badges table (Admin-managed)
export const gamificationBadges = pgTable("gamification_badges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(), // 'common', 'series'
  seriesType: text("series_type"), // 'login', 'profile', 'thread', 'event', 'connection'
  requiredScore: integer("required_score").default(0), // Score threshold to unlock
  tier: text("tier"), // 'bronze', 'silver', 'gold', 'platinum'
  iconUrl: text("icon_url"),
  isEnabled: boolean("is_enabled").default(true),
  isCompetitive: boolean("is_competitive").default(false), // Flag for dynamic top-ranker badges
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User engagement scores table
export const userScores = pgTable("user_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  threadScore: integer("thread_score").default(0),
  eventScore: integer("event_score").default(0),
  connectionScore: integer("connection_score").default(0),
  jobScore: integer("job_score").default(0),
  currentStreakDays: integer("current_streak_days").default(0),
  highestStreak: integer("highest_streak").default(0),
  lastActiveDate: timestamp("last_active_date"),
  totalPoints: integer("total_points").default(0), // Aggregate for leaderboard
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User earned badges mapping
export const userBadges = pgTable("user_badges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  badgeId: varchar("badge_id").references(() => gamificationBadges.id, { onDelete: 'cascade' }).notNull(),
  earnedAt: timestamp("earned_at").defaultNow(),
  isFeatured: boolean("is_featured").default(false),
  notified: boolean("notified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Gamification schemas
export const insertGamificationBadgeSchema = createInsertSchema(gamificationBadges).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserScoreSchema = createInsertSchema(userScores).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserBadgeSchema = createInsertSchema(userBadges).omit({
  id: true,
  createdAt: true,
});

// Gamification types
export type GamificationBadge = typeof gamificationBadges.$inferSelect;
export type InsertGamificationBadge = z.infer<typeof insertGamificationBadgeSchema>;
export type UserScore = typeof userScores.$inferSelect;
export type InsertUserScore = z.infer<typeof insertUserScoreSchema>;
export type UserBadge = typeof userBadges.$inferSelect;

// ==================== BLOG MODULE ====================

export const blogCategories = pgTable("blog_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  color: text("color").default("#008060"),
  icon: text("icon"),
  isActive: boolean("is_active").default(true),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const blogPosts = pgTable("blog_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  authorId: varchar("author_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  categoryId: varchar("category_id").references(() => blogCategories.id, { onDelete: 'set null' }),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  excerpt: text("excerpt"),
  content: text("content").notNull(),
  coverImage: text("cover_image"),
  tags: text("tags").array().default(sql`'{}'::text[]`),
  status: text("status").notNull().default("draft"),
  rejectionReason: text("rejection_reason"),
  readingTimeMinutes: integer("reading_time_minutes").default(1),
  viewsCount: integer("views_count").default(0),
  likesCount: integer("likes_count").default(0),
  commentsCount: integer("comments_count").default(0),
  bookmarksCount: integer("bookmarks_count").default(0),
  isFeatured: boolean("is_featured").default(false),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const blogComments = pgTable("blog_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").references(() => blogPosts.id, { onDelete: 'cascade' }).notNull(),
  authorId: varchar("author_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  parentId: varchar("parent_id"),
  content: text("content").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const blogLikes = pgTable("blog_likes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").references(() => blogPosts.id, { onDelete: 'cascade' }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const blogBookmarks = pgTable("blog_bookmarks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").references(() => blogPosts.id, { onDelete: 'cascade' }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Blog insert schemas
export const insertBlogCategorySchema = createInsertSchema(blogCategories).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBlogPostSchema = createInsertSchema(blogPosts).omit({
  id: true, createdAt: true, updatedAt: true,
  viewsCount: true, likesCount: true, commentsCount: true, bookmarksCount: true,
});
export const insertBlogCommentSchema = createInsertSchema(blogComments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBlogLikeSchema = createInsertSchema(blogLikes).omit({ id: true, createdAt: true });
export const insertBlogBookmarkSchema = createInsertSchema(blogBookmarks).omit({ id: true, createdAt: true });

// Blog types
export type BlogCategory = typeof blogCategories.$inferSelect;
export type InsertBlogCategory = z.infer<typeof insertBlogCategorySchema>;
export type BlogPost = typeof blogPosts.$inferSelect;
export type InsertBlogPost = z.infer<typeof insertBlogPostSchema>;
export type BlogComment = typeof blogComments.$inferSelect;
export type InsertBlogComment = z.infer<typeof insertBlogCommentSchema>;
export type BlogLike = typeof blogLikes.$inferSelect;
export type BlogBookmark = typeof blogBookmarks.$inferSelect;
export type InsertUserBadge = z.infer<typeof insertUserBadgeSchema>;

// ==================== TRAVEL CHAPTERS ====================

export const travelChapters = pgTable("travel_chapters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  city: text("city").notNull(),
  country: text("country").notNull(),
  description: text("description"),
  coverImage: text("cover_image"),
  coordinates: text("coordinates"), // JSON string or lat,lng format
  createdBy: varchar("created_by").references(() => users.id),
  status: text("status").default("pending"), // pending, approved, rejected
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const travelChapterMembers = pgTable("travel_chapter_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chapterId: varchar("chapter_id").references(() => travelChapters.id, { onDelete: 'cascade' }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  role: text("role").default("member"), // member, lead, admin
  joinedAt: timestamp("joined_at").defaultNow(),
});

// Travel Chapters Insert Schemas
export const insertTravelChapterSchema = createInsertSchema(travelChapters).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const travelChapterMessages = pgTable("travel_chapter_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chapterId: varchar("chapter_id").references(() => travelChapters.id, { onDelete: 'cascade' }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTravelChapterMemberSchema = createInsertSchema(travelChapterMembers).omit({
  id: true,
  joinedAt: true,
});

export const insertTravelChapterMessageSchema = createInsertSchema(travelChapterMessages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Travel Chapters Types
export type TravelChapter = typeof travelChapters.$inferSelect;
export type InsertTravelChapter = z.infer<typeof insertTravelChapterSchema>;
export type TravelChapterMember = typeof travelChapterMembers.$inferSelect;
export type InsertTravelChapterMember = z.infer<typeof insertTravelChapterMemberSchema>;
export type TravelChapterMessage = typeof travelChapterMessages.$inferSelect;
export type InsertTravelChapterMessage = z.infer<typeof insertTravelChapterMessageSchema>;