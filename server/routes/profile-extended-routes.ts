import { Router } from "express";
import { supabase } from "../supabase";
import { transformToCamelCase } from "../utils/case-transform";
import {
    educationValidationSchema,
    certificationValidationSchema,
    languageValidationSchema,
    achievementValidationSchema,
    projectValidationSchema
} from "../../shared/validation";

const router = Router();

// Helper function to get alumni ID from user ID
async function getAlumniId(userId: string): Promise<string | null> {
    const { data, error } = await supabase
        .from("alumni")
        .select("id")
        .eq("user_id", userId)
        .single();

    if (error || !data) {
        return null;
    }

    return data.id;
}

// ==================== EDUCATION ROUTES ====================

router.get("/education", async (req, res) => {
    try {
        const userId = req.headers["user-id"] as string;
        if (!userId) return res.status(401).json({ error: "No user ID provided" });

        const alumniId = await getAlumniId(userId);
        if (!alumniId) return res.status(404).json({ error: "Alumni profile not found" });

        const { data: education, error } = await supabase
            .from("alumni_education")
            .select("*")
            .eq("alumni_id", alumniId)
            .order("start_date", { ascending: false });

        if (error) throw error;
        res.json({ education: transformToCamelCase(education || []) });
    } catch (error) {
        console.error("Get education error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

router.post("/education", async (req, res) => {
    try {
        const userId = req.headers["user-id"] as string;
        if (!userId) return res.status(401).json({ error: "No user ID provided" });

        const alumniId = await getAlumniId(userId);
        if (!alumniId) return res.status(404).json({ error: "Alumni profile not found" });

        const validation = educationValidationSchema.safeParse(req.body);
        if (!validation.success) return res.status(400).json({ error: validation.error.errors[0].message });

        const data = validation.data;

        const { data: education, error } = await supabase
            .from("alumni_education")
            .insert({
                alumni_id: alumniId,
                school: data.school,
                degree: data.degree,
                field_of_study: data.fieldOfStudy || null,
                start_date: data.startDate,
                end_date: data.isCurrent ? null : (data.endDate || null),
                grade: data.grade || null,
                activities: data.activities || null,
                description: data.description || null,
                is_current: data.isCurrent,
                display_order: data.displayOrder,
            })
            .select()
            .single();

        if (error) throw error;

        // Auto-sync alumni profile
        if (data.endDate) {
            await supabase.from("alumni").update({
                graduation_year: new Date(data.endDate).getFullYear(),
                course: data.degree,
                branch: data.fieldOfStudy || null,
                university: data.school
            }).eq("id", alumniId);
        }

        res.status(201).json({ education: transformToCamelCase(education) });
    } catch (error) {
        console.error("Create education error:", error);
        res.status(500).json({ error: "Failed to create education" });
    }
});

router.put("/education/:id", async (req, res) => {
    try {
        const userId = req.headers["user-id"] as string;
        const { id } = req.params;
        if (!userId) return res.status(401).json({ error: "No user ID provided" });

        const alumniId = await getAlumniId(userId);
        if (!alumniId) return res.status(404).json({ error: "Alumni profile not found" });

        const validation = educationValidationSchema.safeParse(req.body);
        if (!validation.success) return res.status(400).json({ error: validation.error.errors[0].message });

        const data = validation.data;

        const { data: education, error } = await supabase
            .from("alumni_education")
            .update({
                school: data.school,
                degree: data.degree,
                field_of_study: data.fieldOfStudy || null,
                start_date: data.startDate,
                end_date: data.isCurrent ? null : (data.endDate || null),
                grade: data.grade || null,
                activities: data.activities || null,
                description: data.description || null,
                is_current: data.isCurrent,
                display_order: data.displayOrder,
            })
            .eq("id", id)
            .eq("alumni_id", alumniId)
            .select()
            .single();

        if (error) throw error;
        res.json({ education: transformToCamelCase(education) });
    } catch (error) {
        console.error("Update education error:", error);
        res.status(500).json({ error: "Failed to update education" });
    }
});

router.delete("/education/:id", async (req, res) => {
    try {
        const userId = req.headers["user-id"] as string;
        const { id } = req.params;
        if (!userId) return res.status(401).json({ error: "No user ID provided" });

        const alumniId = await getAlumniId(userId);
        if (!alumniId) return res.status(404).json({ error: "Alumni profile not found" });

        const { error } = await supabase.from("alumni_education").delete().eq("id", id).eq("alumni_id", alumniId);
        if (error) throw error;
        res.json({ message: "Education deleted successfully" });
    } catch (error) {
        console.error("Delete education error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});



// ==================== CERTIFICATIONS ROUTES ====================

router.get("/certifications", async (req, res) => {
    try {
        const userId = req.headers["user-id"] as string;
        if (!userId) return res.status(401).json({ error: "No user ID provided" });

        const alumniId = await getAlumniId(userId);
        if (!alumniId) return res.status(404).json({ error: "Alumni profile not found" });

        const { data: certifications, error } = await supabase
            .from("alumni_certifications")
            .select("*")
            .eq("alumni_id", alumniId)
            .order("issue_date", { ascending: false });

        if (error) throw error;
        res.json({ certifications: transformToCamelCase(certifications || []) });
    } catch (error) {
        console.error("Get certifications error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

router.post("/certifications", async (req, res) => {
    try {
        const userId = req.headers["user-id"] as string;
        if (!userId) return res.status(401).json({ error: "No user ID provided" });

        const alumniId = await getAlumniId(userId);
        if (!alumniId) return res.status(404).json({ error: "Alumni profile not found" });

        const validation = certificationValidationSchema.safeParse(req.body);
        if (!validation.success) return res.status(400).json({ error: validation.error.errors[0].message });

        const data = validation.data;

        const { data: certification, error } = await supabase
            .from("alumni_certifications")
            .insert({
                alumni_id: alumniId,
                certification_name: data.certificationName,
                issuing_organization: data.issuingOrganization,
                issue_date: data.issueDate,
                duration: data.duration || null,
                credential_id: data.credentialId || null,
                credential_url: data.credentialUrl || null,
                description: data.description || null,
                skills_gained: data.skillsGained,
                display_order: data.displayOrder,
            })
            .select()
            .single();

        if (error) throw error;
        res.status(201).json({ certification: transformToCamelCase(certification) });
    } catch (error) {
        console.error("Create certification error:", error);
        res.status(500).json({ error: "Failed to create certification" });
    }
});

router.put("/certifications/:id", async (req, res) => {
    try {
        const userId = req.headers["user-id"] as string;
        const { id } = req.params;
        if (!userId) return res.status(401).json({ error: "No user ID provided" });

        const alumniId = await getAlumniId(userId);
        if (!alumniId) return res.status(404).json({ error: "Alumni profile not found" });

        const validation = certificationValidationSchema.safeParse(req.body);
        if (!validation.success) return res.status(400).json({ error: validation.error.errors[0].message });

        const data = validation.data;

        const { data: certification, error } = await supabase
            .from("alumni_certifications")
            .update({
                certification_name: data.certificationName,
                issuing_organization: data.issuingOrganization,
                issue_date: data.issueDate,
                duration: data.duration || null,
                credential_id: data.credentialId || null,
                credential_url: data.credentialUrl || null,
                description: data.description || null,
                skills_gained: data.skillsGained,
                display_order: data.displayOrder,
            })
            .eq("id", id)
            .eq("alumni_id", alumniId)
            .select()
            .single();

        if (error) throw error;
        res.json({ certification: transformToCamelCase(certification) });
    } catch (error) {
        console.error("Update certification error:", error);
        res.status(500).json({ error: "Failed to update certification" });
    }
});

router.delete("/certifications/:id", async (req, res) => {
    try {
        const userId = req.headers["user-id"] as string;
        const { id } = req.params;
        if (!userId) return res.status(401).json({ error: "No user ID provided" });

        const alumniId = await getAlumniId(userId);
        if (!alumniId) return res.status(404).json({ error: "Alumni profile not found" });

        const { error } = await supabase.from("alumni_certifications").delete().eq("id", id).eq("alumni_id", alumniId);
        if (error) throw error;
        res.json({ message: "Certification deleted successfully" });
    } catch (error) {
        console.error("Delete certification error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ==================== LANGUAGES ROUTES ====================

router.get("/languages", async (req, res) => {
    try {
        const userId = req.headers["user-id"] as string;
        if (!userId) return res.status(401).json({ error: "No user ID provided" });

        const alumniId = await getAlumniId(userId);
        if (!alumniId) return res.status(404).json({ error: "Alumni profile not found" });

        const { data: languages, error } = await supabase
            .from("alumni_languages")
            .select("*")
            .eq("alumni_id", alumniId)
            .order("is_native", { ascending: false });

        if (error) throw error;
        res.json({ languages: transformToCamelCase(languages || []) });
    } catch (error) {
        console.error("Get languages error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

router.post("/languages", async (req, res) => {
    try {
        const userId = req.headers["user-id"] as string;
        if (!userId) return res.status(401).json({ error: "No user ID provided" });

        const alumniId = await getAlumniId(userId);
        if (!alumniId) return res.status(404).json({ error: "Alumni profile not found" });

        const validation = languageValidationSchema.safeParse(req.body);
        if (!validation.success) return res.status(400).json({ error: validation.error.errors[0].message });

        const data = validation.data;

        const { data: language, error } = await supabase
            .from("alumni_languages")
            .insert({
                alumni_id: alumniId,
                language_name: data.languageName,
                proficiency_level: data.proficiencyLevel,
                can_read: data.canRead,
                can_write: data.canWrite,
                can_speak: data.canSpeak,
                is_native: data.isNative,
                certification_name: data.certificationName || null,
                certification_score: data.certificationScore || null,
                certification_date: data.certificationDate || null,
                display_order: data.displayOrder,
            })
            .select()
            .single();

        if (error) throw error;
        res.status(201).json({ language: transformToCamelCase(language) });
    } catch (error) {
        console.error("Create language error:", error);
        res.status(500).json({ error: "Failed to create language" });
    }
});

router.put("/languages/:id", async (req, res) => {
    try {
        const userId = req.headers["user-id"] as string;
        const { id } = req.params;
        if (!userId) return res.status(401).json({ error: "No user ID provided" });

        const alumniId = await getAlumniId(userId);
        if (!alumniId) return res.status(404).json({ error: "Alumni profile not found" });

        const validation = languageValidationSchema.safeParse(req.body);
        if (!validation.success) return res.status(400).json({ error: validation.error.errors[0].message });

        const data = validation.data;

        const { data: language, error } = await supabase
            .from("alumni_languages")
            .update({
                language_name: data.languageName,
                proficiency_level: data.proficiencyLevel,
                can_read: data.canRead,
                can_write: data.canWrite,
                can_speak: data.canSpeak,
                is_native: data.isNative,
                certification_name: data.certificationName || null,
                certification_score: data.certificationScore || null,
                certification_date: data.certificationDate || null,
                display_order: data.displayOrder,
            })
            .eq("id", id)
            .eq("alumni_id", alumniId)
            .select()
            .single();

        if (error) throw error;
        res.json({ language: transformToCamelCase(language) });
    } catch (error) {
        console.error("Update language error:", error);
        res.status(500).json({ error: "Failed to update language" });
    }
});

router.delete("/languages/:id", async (req, res) => {
    try {
        const userId = req.headers["user-id"] as string;
        const { id } = req.params;
        if (!userId) return res.status(401).json({ error: "No user ID provided" });

        const alumniId = await getAlumniId(userId);
        if (!alumniId) return res.status(404).json({ error: "Alumni profile not found" });

        const { error } = await supabase.from("alumni_languages").delete().eq("id", id).eq("alumni_id", alumniId);
        if (error) throw error;
        res.json({ message: "Language deleted successfully" });
    } catch (error) {
        console.error("Delete language error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ==================== ACHIEVEMENTS ROUTES ====================

router.get("/achievements", async (req, res) => {
    try {
        const userId = req.headers["user-id"] as string;
        if (!userId) return res.status(401).json({ error: "No user ID provided" });

        const alumniId = await getAlumniId(userId);
        if (!alumniId) return res.status(404).json({ error: "Alumni profile not found" });

        const { data: achievements, error } = await supabase
            .from("alumni_achievements")
            .select("*")
            .eq("alumni_id", alumniId)
            .order("date_received", { ascending: false });

        if (error) throw error;
        res.json({ achievements: transformToCamelCase(achievements || []) });
    } catch (error) {
        console.error("Get achievements error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

router.post("/achievements", async (req, res) => {
    try {
        const userId = req.headers["user-id"] as string;
        if (!userId) return res.status(401).json({ error: "No user ID provided" });

        const alumniId = await getAlumniId(userId);
        if (!alumniId) return res.status(404).json({ error: "Alumni profile not found" });

        const validation = achievementValidationSchema.safeParse(req.body);
        if (!validation.success) return res.status(400).json({ error: validation.error.errors[0].message });

        const data = validation.data;

        const { data: achievement, error } = await supabase
            .from("alumni_achievements")
            .insert({
                alumni_id: alumniId,
                achievement_type: data.achievementType,
                title: data.title,
                description: data.description || null,
                issuing_organization: data.issuingOrganization || null,
                date_received: data.dateReceived,
                category: data.category || null,
                level: data.level || null,
                url: data.url || null,
                certificate_url: data.certificateUrl || null,
                co_recipients: data.coRecipients,
                impact_description: data.impactDescription || null,
                media_coverage_urls: data.mediaCoverageUrls,
                is_featured: data.isFeatured,
                display_order: data.displayOrder,
            })
            .select()
            .single();

        if (error) throw error;
        res.status(201).json({ achievement: transformToCamelCase(achievement) });
    } catch (error) {
        console.error("Create achievement error:", error);
        res.status(500).json({ error: "Failed to create achievement" });
    }
});

router.put("/achievements/:id", async (req, res) => {
    try {
        const userId = req.headers["user-id"] as string;
        const { id } = req.params;
        if (!userId) return res.status(401).json({ error: "No user ID provided" });

        const alumniId = await getAlumniId(userId);
        if (!alumniId) return res.status(404).json({ error: "Alumni profile not found" });

        const validation = achievementValidationSchema.safeParse(req.body);
        if (!validation.success) return res.status(400).json({ error: validation.error.errors[0].message });

        const data = validation.data;

        const { data: achievement, error } = await supabase
            .from("alumni_achievements")
            .update({
                achievement_type: data.achievementType,
                title: data.title,
                description: data.description || null,
                issuing_organization: data.issuingOrganization || null,
                date_received: data.dateReceived,
                category: data.category || null,
                level: data.level || null,
                url: data.url || null,
                certificate_url: data.certificateUrl || null,
                co_recipients: data.coRecipients,
                impact_description: data.impactDescription || null,
                media_coverage_urls: data.mediaCoverageUrls,
                is_featured: data.isFeatured,
                display_order: data.displayOrder,
            })
            .eq("id", id)
            .eq("alumni_id", alumniId)
            .select()
            .single();

        if (error) throw error;
        res.json({ achievement: transformToCamelCase(achievement) });
    } catch (error) {
        console.error("Update achievement error:", error);
        res.status(500).json({ error: "Failed to update achievement" });
    }
});

router.delete("/achievements/:id", async (req, res) => {
    try {
        const userId = req.headers["user-id"] as string;
        const { id } = req.params;
        if (!userId) return res.status(401).json({ error: "No user ID provided" });

        const alumniId = await getAlumniId(userId);
        if (!alumniId) return res.status(404).json({ error: "Alumni profile not found" });

        const { error } = await supabase.from("alumni_achievements").delete().eq("id", id).eq("alumni_id", alumniId);
        if (error) throw error;
        res.json({ message: "Achievement deleted successfully" });
    } catch (error) {
        console.error("Delete achievement error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ==================== PROJECTS ROUTES ====================

router.get("/projects", async (req, res) => {
    try {
        const userId = req.headers["user-id"] as string;
        if (!userId) return res.status(401).json({ error: "No user ID provided" });

        const alumniId = await getAlumniId(userId);
        if (!alumniId) return res.status(404).json({ error: "Alumni profile not found" });

        const { data: projects, error } = await supabase
            .from("alumni_projects")
            .select("*")
            .eq("alumni_id", alumniId)
            .order("start_date", { ascending: false });

        if (error) throw error;
        res.json({ projects: transformToCamelCase(projects || []) });
    } catch (error) {
        console.error("Get projects error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

router.post("/projects", async (req, res) => {
    try {
        const userId = req.headers["user-id"] as string;
        if (!userId) return res.status(401).json({ error: "No user ID provided" });

        const alumniId = await getAlumniId(userId);
        if (!alumniId) return res.status(404).json({ error: "Alumni profile not found" });

        const validation = projectValidationSchema.safeParse(req.body);
        if (!validation.success) return res.status(400).json({ error: validation.error.errors[0].message });

        const data = validation.data;

        const { data: project, error } = await supabase
            .from("alumni_projects")
            .insert({
                alumni_id: alumniId,
                project_name: data.projectName,
                description: data.description,
                project_type: data.projectType || null,
                role: data.role || null,
                start_date: data.startDate || null,
                end_date: data.endDate || null,
                is_ongoing: data.isOngoing,
                technologies_used: data.technologiesUsed,
                project_url: data.projectUrl || null,
                github_url: data.githubUrl || null,
                demo_url: data.demoUrl || null,
                image_urls: data.imageUrls,
                team_size: data.teamSize || null,
                your_contribution: data.yourContribution || null,
                outcomes: data.outcomes || null,
                display_order: data.displayOrder,
            })
            .select()
            .single();

        if (error) throw error;
        res.status(201).json({ project: transformToCamelCase(project) });
    } catch (error) {
        console.error("Create project error:", error);
        res.status(500).json({ error: "Failed to create project" });
    }
});

router.put("/projects/:id", async (req, res) => {
    try {
        const userId = req.headers["user-id"] as string;
        const { id } = req.params;
        if (!userId) return res.status(401).json({ error: "No user ID provided" });

        const alumniId = await getAlumniId(userId);
        if (!alumniId) return res.status(404).json({ error: "Alumni profile not found" });

        const validation = projectValidationSchema.safeParse(req.body);
        if (!validation.success) return res.status(400).json({ error: validation.error.errors[0].message });

        const data = validation.data;

        const { data: project, error } = await supabase
            .from("alumni_projects")
            .update({
                project_name: data.projectName,
                description: data.description,
                project_type: data.projectType || null,
                role: data.role || null,
                start_date: data.startDate || null,
                end_date: data.endDate || null,
                is_ongoing: data.isOngoing,
                technologies_used: data.technologiesUsed,
                project_url: data.projectUrl || null,
                github_url: data.githubUrl || null,
                demo_url: data.demoUrl || null,
                image_urls: data.imageUrls,
                team_size: data.teamSize || null,
                your_contribution: data.yourContribution || null,
                outcomes: data.outcomes || null,
                display_order: data.displayOrder,
            })
            .eq("id", id)
            .eq("alumni_id", alumniId)
            .select()
            .single();

        if (error) throw error;
        res.json({ project: transformToCamelCase(project) });
    } catch (error) {
        console.error("Update project error:", error);
        res.status(500).json({ error: "Failed to update project" });
    }
});

router.delete("/projects/:id", async (req, res) => {
    try {
        const userId = req.headers["user-id"] as string;
        const { id } = req.params;
        if (!userId) return res.status(401).json({ error: "No user ID provided" });

        const alumniId = await getAlumniId(userId);
        if (!alumniId) return res.status(404).json({ error: "Alumni profile not found" });

        const { error } = await supabase.from("alumni_projects").delete().eq("id", id).eq("alumni_id", alumniId);
        if (error) throw error;
        res.json({ message: "Project deleted successfully" });
    } catch (error) {
        console.error("Delete project error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
