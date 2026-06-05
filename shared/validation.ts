import { z } from "zod";

// Helper for optional URL validation (allow empty string)
const optionalUrl = z.string().trim().optional().nullable().refine(
    (val) => !val || val === "" || /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/.test(val),
    { message: "Invalid URL format" }
);

// Helper for required date validation
const dateString = z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date format",
});

// Helper for optional date validation (allow empty string, null, undefined)
const optionalDateString = z.string().optional().nullable().refine((val) => {
    if (!val || val === "") return true;
    return !isNaN(Date.parse(val));
}, { message: "Invalid date format" });

// ==================== EXPERIENCE VALIDATION ====================

export const experienceValidationSchema = z.object({
    companyName: z.string().trim().min(1, "Company name is required").max(100, "Company name too long"),
    position: z.string().trim().min(1, "Position is required").max(100, "Position too long"),
    employmentType: z.enum(['full-time', 'part-time', 'contract', 'internship', 'freelance']).optional().default('full-time'),
    location: z.string().optional().nullable(),
    locationType: z.enum(['onsite', 'remote', 'hybrid']).optional().default('onsite'),
    startDate: dateString,
    endDate: optionalDateString,
    isCurrent: z.boolean().default(false),
    description: z.string().max(2000, "Description must be less than 2000 characters").optional().nullable(),
    industry: z.string().max(100).optional().nullable(),
    companyUrl: optionalUrl,
    responsibilities: z.array(z.string()).optional().default([]),
    achievements: z.array(z.string()).optional().default([]),
    skillsUsed: z.array(z.string()).optional().default([]),
}).refine((data) => {
    if (data.isCurrent) return true;
    if (!data.endDate || data.endDate === "") return true;
    return new Date(data.startDate) <= new Date(data.endDate);
}, {
    message: "End date cannot be earlier than start date",
    path: ["endDate"],
});

export type ExperienceFormData = z.infer<typeof experienceValidationSchema>;


// ==================== EDUCATION VALIDATION ====================

export const educationValidationSchema = z.object({
    school: z.string().trim().min(1, "School/University is required").max(150),
    degree: z.string().trim().min(1, "Degree is required").max(100),
    fieldOfStudy: z.string().trim().max(100).optional().nullable(),
    startDate: dateString,
    endDate: optionalDateString,
    grade: z.string().max(20).optional().nullable(),
    activities: z.string().max(500).optional().nullable(),
    description: z.string().max(2000).optional().nullable(),
    isCurrent: z.boolean().default(false),
    displayOrder: z.coerce.number().int().min(0).optional().default(0),
}).refine((data) => {
    if (data.isCurrent) return true;
    if (!data.endDate || data.endDate === "") return true;
    return new Date(data.startDate) <= new Date(data.endDate);
}, {
    message: "End date cannot be earlier than start date",
    path: ["endDate"],
});

export type EducationFormData = z.infer<typeof educationValidationSchema>;


// ==================== SKILL VALIDATION ====================

export const skillValidationSchema = z.object({
    skillName: z.string().trim().min(1, "Skill name is required").max(50),
    category: z.enum(["technical", "soft", "tool", "framework", "domain", "other"]).optional(),
    proficiencyLevel: z.enum(["beginner", "intermediate", "advanced", "expert"]).optional(),
    yearsOfExperience: z.union([
        z.number().min(0).max(100),
        z.undefined(),
        z.null()
    ]).optional().nullable(),
    isPrimary: z.boolean().default(false),
    description: z.string().max(500).optional().nullable(),
    displayOrder: z.coerce.number().int().min(0).optional().default(0),
});

export type SkillFormData = z.infer<typeof skillValidationSchema>;


// ==================== CERTIFICATION VALIDATION ====================

export const certificationValidationSchema = z.object({
    certificationName: z.string().trim().min(1, "Certification name is required").max(150),
    issuingOrganization: z.string().trim().min(1, "Issuing organization is required").max(150),
    issueDate: dateString,
    duration: z.string().trim().optional().nullable(),
    credentialId: z.string().max(100).optional().nullable(),
    credentialUrl: optionalUrl,
    description: z.string().max(1000).optional().nullable(),
    skillsGained: z.array(z.string()).optional().default([]),
    displayOrder: z.coerce.number().int().min(0).optional().default(0),
});

export type CertificationFormData = z.infer<typeof certificationValidationSchema>;


// ==================== PROJECT VALIDATION ====================

export const projectValidationSchema = z.object({
    projectName: z.string().trim().min(1, "Project name is required").max(100),
    description: z.string().trim().min(5, "Description is required (min 5 characters)").max(2000),
    role: z.string().max(100).optional().nullable(),
    startDate: optionalDateString,
    endDate: optionalDateString,
    isOngoing: z.boolean().default(false),
    technologiesUsed: z.array(z.string()).optional().default([]),
    projectUrl: optionalUrl,
    githubUrl: optionalUrl,
    projectType: z.enum(['personal', 'professional', 'academic', 'open-source']).optional().nullable().default('personal'),
    demoUrl: optionalUrl,
    imageUrls: z.array(z.string()).optional().default([]),
    teamSize: z.coerce.number().int().min(1).optional().nullable(),
    yourContribution: z.string().max(1000).optional().nullable(),
    outcomes: z.string().max(1000).optional().nullable(),
    displayOrder: z.coerce.number().int().min(0).optional().default(0),
}).refine((data) => {
    if (data.isOngoing) return true;
    if (!data.startDate || data.startDate === "" || !data.endDate || data.endDate === "") return true;
    return new Date(data.startDate) <= new Date(data.endDate);
}, {
    message: "End date cannot be earlier than start date",
    path: ["endDate"],
});

export type ProjectFormData = z.infer<typeof projectValidationSchema>;


// ==================== ACHIEVEMENT VALIDATION ====================

export const achievementValidationSchema = z.object({
    title: z.string().trim().min(1, "Title is required").max(150),
    achievementType: z.enum(['award', 'recognition', 'publication', 'patent', 'project', 'competition', 'scholarship', 'other']).default('award'),
    dateReceived: dateString,
    issuingOrganization: z.string().max(150).optional().nullable(),
    description: z.string().max(1000).optional().nullable(),
    url: optionalUrl,
    isFeatured: z.boolean().default(false),
    category: z.string().max(50).optional().nullable(),
    level: z.enum(['international', 'national', 'state', 'institutional', 'local']).optional().nullable(),
    certificateUrl: optionalUrl,
    coRecipients: z.array(z.string()).optional().default([]),
    impactDescription: z.string().max(1000).optional().nullable(),
    mediaCoverageUrls: z.array(z.string()).optional().default([]),
    displayOrder: z.coerce.number().int().min(0).optional().default(0),
});

export type AchievementFormData = z.infer<typeof achievementValidationSchema>;


// ==================== LANGUAGE VALIDATION ====================

export const languageValidationSchema = z.object({
    languageName: z.string().trim().min(1, "Language name is required").max(50),
    proficiencyLevel: z.enum(['basic', 'conversational', 'fluent', 'native']).default('basic'),
    canRead: z.boolean().default(true),
    canWrite: z.boolean().default(true),
    canSpeak: z.boolean().default(true),
    isNative: z.boolean().default(false),
    certificationName: z.string().max(100).optional().nullable(),
    certificationScore: z.string().max(50).optional().nullable(),
    certificationDate: optionalDateString,
    displayOrder: z.coerce.number().int().min(0).optional().default(0),
});

export type LanguageFormData = z.infer<typeof languageValidationSchema>;


// ==================== SECURITY VALIDATION ====================

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(1, "Confirm password is required"),
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
});

export const changeEmailSchema = z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newEmail: z.string().email("Invalid email address"),
});

export const changeUsernameSchema = z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newUsername: z.string().min(3, "Username must be at least 3 characters").max(30, "Username too long"),
});

export type ChangePasswordData = z.infer<typeof changePasswordSchema>;
export type ChangeEmailData = z.infer<typeof changeEmailSchema>;
export type ChangeUsernameData = z.infer<typeof changeUsernameSchema>;
