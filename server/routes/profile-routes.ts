import { Router } from "express";
import { supabase } from "../supabase";
import { transformToCamelCase } from "../utils/case-transform";
import { experienceValidationSchema, skillValidationSchema } from "../../shared/validation";

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

// ==================== EXPERIENCES ROUTES ====================

// Get all experiences for a user
router.get("/experiences", async (req, res) => {
    try {
        const userId = req.headers["user-id"] as string;
        if (!userId) {
            return res.status(401).json({ error: "No user ID provided" });
        }

        const alumniId = await getAlumniId(userId);
        if (!alumniId) {
            return res.status(404).json({ error: "Alumni profile not found" });
        }

        const { data: experiences, error } = await supabase
            .from("alumni_experiences")
            .select("*")
            .eq("alumni_id", alumniId)
            .order("display_order", { ascending: true })
            .order("start_date", { ascending: false });

        if (error) {
            console.error("Get experiences error:", error);
            return res.status(500).json({ error: "Failed to fetch experiences" });
        }

        res.json({ experiences: transformToCamelCase(experiences || []) });
    } catch (error) {
        console.error("Get experiences error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Get single experience
router.get("/experiences/:id", async (req, res) => {
    try {
        const userId = req.headers["user-id"] as string;
        const { id } = req.params;

        if (!userId) {
            return res.status(401).json({ error: "No user ID provided" });
        }

        const alumniId = await getAlumniId(userId);
        if (!alumniId) {
            return res.status(404).json({ error: "Alumni profile not found" });
        }

        const { data: experience, error } = await supabase
            .from("alumni_experiences")
            .select("*")
            .eq("id", id)
            .eq("alumni_id", alumniId)
            .single();

        if (error) {
            console.error("Get experience error:", error);
            return res.status(404).json({ error: "Experience not found" });
        }

        res.json({ experience: transformToCamelCase(experience) });
    } catch (error) {
        console.error("Get experience error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Create new experience
router.post("/experiences", async (req, res) => {
    try {
        const userId = req.headers["user-id"] as string;
        if (!userId) {
            return res.status(401).json({ error: "No user ID provided" });
        }

        const alumniId = await getAlumniId(userId);
        if (!alumniId) {
            return res.status(404).json({ error: "Alumni profile not found" });
        }

        const validation = experienceValidationSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                error: validation.error.errors[0].message,
            });
        }

        const {
            companyName,
            position,
            employmentType,
            location,
            locationType,
            startDate,
            endDate,
            isCurrent,
            description,
            industry,
            companyUrl,
        } = validation.data;

        const {
            responsibilities,
            achievements,
            skillsUsed,
            companySize,
            displayOrder,
        } = req.body;

        // If marking as current, unmark all other current positions
        if (isCurrent) {
            await supabase
                .from("alumni_experiences")
                .update({ is_current: false })
                .eq("alumni_id", alumniId)
                .eq("is_current", true);

            // Auto-sync: Update alumni profile header
            // We update current_company and current_role
            await supabase
                .from("alumni")
                .update({
                    current_company: companyName,
                    current_role: position // Sync current_role
                })
                .eq("id", alumniId);
        }

        const { data: experience, error } = await supabase
            .from("alumni_experiences")
            .insert({
                alumni_id: alumniId,
                company_name: companyName,
                position,
                employment_type: employmentType || null,
                location: location || null,
                location_type: locationType || null,
                start_date: startDate,
                end_date: endDate || null,
                is_current: isCurrent || false,
                description: description || null,
                responsibilities: responsibilities || [],
                achievements: achievements || [],
                skills_used: skillsUsed || [],
                industry: industry || null,
                company_size: companySize || null,
                company_url: companyUrl || null,
                display_order: displayOrder || 0,
            })
            .select()
            .single();

        if (error) {
            console.error("Create experience error:", error);
            return res.status(500).json({ error: "Failed to create experience" });
        }

        res.status(201).json({ experience });
    } catch (error) {
        console.error("Create experience error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Update experience
router.put("/experiences/:id", async (req, res) => {
    try {
        const userId = req.headers["user-id"] as string;
        const { id } = req.params;

        if (!userId) {
            return res.status(401).json({ error: "No user ID provided" });
        }

        const alumniId = await getAlumniId(userId);
        if (!alumniId) {
            return res.status(404).json({ error: "Alumni profile not found" });
        }

        const validation = experienceValidationSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                error: validation.error.errors[0].message,
            });
        }

        const {
            companyName,
            position,
            employmentType,
            location,
            locationType,
            startDate,
            endDate,
            isCurrent,
            description,
            industry,
            companyUrl,
        } = validation.data;

        const {
            responsibilities,
            achievements,
            skillsUsed,
            companySize,
            displayOrder,
        } = req.body;

        // If marking as current, unmark all other current positions
        if (isCurrent) {
            await supabase
                .from("alumni_experiences")
                .update({ is_current: false })
                .eq("alumni_id", alumniId)
                .eq("is_current", true)
                .neq("id", id);

            // Auto-sync: Update alumni profile header
            await supabase
                .from("alumni")
                .update({
                    current_company: companyName,
                    current_role: position
                })
                .eq("id", alumniId);
        }

        const { data: experience, error } = await supabase
            .from("alumni_experiences")
            .update({
                company_name: companyName,
                position,
                employment_type: employmentType || null,
                location: location || null,
                location_type: locationType || null,
                start_date: startDate,
                end_date: endDate || null,
                is_current: isCurrent || false,
                description: description || null,
                responsibilities: responsibilities || [],
                achievements: achievements || [],
                skills_used: skillsUsed || [],
                industry: industry || null,
                company_size: companySize || null,
                company_url: companyUrl || null,
                display_order: displayOrder,
            })
            .eq("id", id)
            .eq("alumni_id", alumniId)
            .select()
            .single();

        if (error) {
            console.error("Update experience error:", error);
            return res.status(500).json({ error: "Failed to update experience" });
        }

        res.json({ experience });
    } catch (error) {
        console.error("Update experience error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Delete experience
router.delete("/experiences/:id", async (req, res) => {
    try {
        const userId = req.headers["user-id"] as string;
        const { id } = req.params;

        if (!userId) {
            return res.status(401).json({ error: "No user ID provided" });
        }

        const alumniId = await getAlumniId(userId);
        if (!alumniId) {
            return res.status(404).json({ error: "Alumni profile not found" });
        }

        const { error } = await supabase
            .from("alumni_experiences")
            .delete()
            .eq("id", id)
            .eq("alumni_id", alumniId);

        if (error) {
            console.error("Delete experience error:", error);
            return res.status(500).json({ error: "Failed to delete experience" });
        }

        res.json({ message: "Experience deleted successfully" });
    } catch (error) {
        console.error("Delete experience error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Reorder experiences
router.put("/experiences/reorder", async (req, res) => {
    try {
        const userId = req.headers["user-id"] as string;
        const { experienceIds } = req.body; // Array of IDs in new order

        if (!userId) {
            return res.status(401).json({ error: "No user ID provided" });
        }

        const alumniId = await getAlumniId(userId);
        if (!alumniId) {
            return res.status(404).json({ error: "Alumni profile not found" });
        }

        // Update display order for each experience
        const updates = experienceIds.map((id: string, index: number) =>
            supabase
                .from("alumni_experiences")
                .update({ display_order: index })
                .eq("id", id)
                .eq("alumni_id", alumniId)
        );

        await Promise.all(updates);

        res.json({ message: "Experiences reordered successfully" });
    } catch (error) {
        console.error("Reorder experiences error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ==================== SKILLS ROUTES ====================

// Get all skills for a user
router.get("/skills", async (req, res) => {
    try {
        const userId = req.headers["user-id"] as string;
        if (!userId) {
            return res.status(401).json({ error: "No user ID provided" });
        }

        const alumniId = await getAlumniId(userId);
        if (!alumniId) {
            return res.status(404).json({ error: "Alumni profile not found" });
        }

        const { data: skills, error } = await supabase
            .from("alumni_skills")
            .select("*")
            .eq("alumni_id", alumniId)
            .order("is_primary", { ascending: false })
            .order("proficiency_level", { ascending: false })
            .order("display_order", { ascending: true });

        if (error) {
            console.error("Get skills error:", error);
            return res.status(500).json({ error: "Failed to fetch skills" });
        }

        res.json({ skills: transformToCamelCase(skills || []) });
    } catch (error) {
        console.error("Get skills error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Create new skill
router.post("/skills", async (req, res) => {
    try {
        const userId = req.headers["user-id"] as string;
        if (!userId) {
            return res.status(401).json({ error: "No user ID provided" });
        }

        const alumniId = await getAlumniId(userId);
        if (!alumniId) {
            return res.status(404).json({ error: "Alumni profile not found" });
        }

        const validation = skillValidationSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                error: validation.error.errors[0].message,
            });
        }

        const {
            skillName,
            proficiencyLevel,
            yearsOfExperience,
            isPrimary,
            description,
        } = validation.data;

        const {
            category,
            lastUsedDate,
            relatedProjects,
            certificationIds,
            displayOrder,
        } = req.body;

        // Check for duplicate skill
        const { data: existing } = await supabase
            .from("alumni_skills")
            .select("id")
            .eq("alumni_id", alumniId)
            .eq("skill_name", skillName)
            .single();

        if (existing) {
            return res.status(400).json({ error: "Skill already exists" });
        }

        const { data: skill, error } = await supabase
            .from("alumni_skills")
            .insert({
                alumni_id: alumniId,
                skill_name: skillName,
                category: category || null,
                proficiency_level: proficiencyLevel || null,
                years_of_experience: yearsOfExperience || 0,
                last_used_date: lastUsedDate || null,
                is_primary: isPrimary || false,
                description: description || null,
                related_projects: relatedProjects || [],
                certification_ids: certificationIds || [],
                display_order: displayOrder || 0,
            })
            .select()
            .single();

        if (error) {
            console.error("Create skill error:", error);
            return res.status(500).json({ error: "Failed to create skill" });
        }

        res.status(201).json({ skill });
    } catch (error) {
        console.error("Create skill error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Update skill
router.put("/skills/:id", async (req, res) => {
    try {
        const userId = req.headers["user-id"] as string;
        const { id } = req.params;

        if (!userId) {
            return res.status(401).json({ error: "No user ID provided" });
        }

        const alumniId = await getAlumniId(userId);
        if (!alumniId) {
            return res.status(404).json({ error: "Alumni profile not found" });
        }

        const validation = skillValidationSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                error: validation.error.errors[0].message,
            });
        }

        const {
            skillName,
            proficiencyLevel,
            yearsOfExperience,
            isPrimary,
            description,
        } = validation.data;

        const {
            category,
            lastUsedDate,
            relatedProjects,
            certificationIds,
            displayOrder,
        } = req.body;

        const { data: skill, error } = await supabase
            .from("alumni_skills")
            .update({
                skill_name: skillName,
                category: category || null,
                proficiency_level: proficiencyLevel || null,
                years_of_experience: yearsOfExperience,
                last_used_date: lastUsedDate || null,
                is_primary: isPrimary,
                description: description || null,
                related_projects: relatedProjects || [],
                certification_ids: certificationIds || [],
                display_order: displayOrder,
            })
            .eq("id", id)
            .eq("alumni_id", alumniId)
            .select()
            .single();

        if (error) {
            console.error("Update skill error:", error);
            return res.status(500).json({ error: "Failed to update skill" });
        }

        res.json({ skill });
    } catch (error) {
        console.error("Update skill error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Delete skill
router.delete("/skills/:id", async (req, res) => {
    try {
        const userId = req.headers["user-id"] as string;
        const { id } = req.params;

        if (!userId) {
            return res.status(401).json({ error: "No user ID provided" });
        }

        const alumniId = await getAlumniId(userId);
        if (!alumniId) {
            return res.status(404).json({ error: "Alumni profile not found" });
        }

        const { error } = await supabase
            .from("alumni_skills")
            .delete()
            .eq("id", id)
            .eq("alumni_id", alumniId);

        if (error) {
            console.error("Delete skill error:", error);
            return res.status(500).json({ error: "Failed to delete skill" });
        }

        res.json({ message: "Skill deleted successfully" });
    } catch (error) {
        console.error("Delete skill error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Get skill suggestions (for autocomplete)
router.get("/skills/suggestions", async (req, res) => {
    try {
        const { query } = req.query;

        if (!query || typeof query !== "string") {
            return res.status(400).json({ error: "Query parameter required" });
        }

        // Get popular skills from the database
        const { data: skills, error } = await supabase
            .from("alumni_skills")
            .select("skill_name")
            .ilike("skill_name", `%${query}%`)
            .limit(10);

        if (error) {
            console.error("Get skill suggestions error:", error);
            return res.status(500).json({ error: "Failed to fetch suggestions" });
        }

        // Get unique skill names
        const uniqueSkills = Array.from(new Set(skills?.map((s: any) => s.skill_name) || []));

        res.json({ suggestions: uniqueSkills });
    } catch (error) {
        console.error("Get skill suggestions error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Update user profile
router.post("/update", async (req, res) => {
    try {
        const userId = req.headers["user-id"] as string;
        if (!userId) {
            return res.status(401).json({ error: "No user ID provided" });
        }

        const {
            firstName,
            lastName,
            email,
            phone,
            batch,
            gender,
            currentCompany,
            currentRole,
            location,
            linkedinUrl,
            bio,
            resumeUrl,
            profilePicture,
            githubUrl,
            twitterUrl,
            personalWebsite,
            showEmail,
            showPhone,
            linkedin_photo_url,
            // Additional Information fields
            expertiseAreas,
            volunteerInterests,
            keywords,
            employmentStatus,
            yearsOfExperience,
            startupName,
            startupRole,
            fundingStage,
            foundingYear,
            isStartupFounder,
            timezone,
            currentCity,
            currentState,
            currentCountry,
            latitude,
            longitude,
            locationLabel
        } = req.body;

        // Update user table (email)
        if (email) {
            const { error: userError } = await supabase
                .from("users")
                .update({ email })
                .eq("id", userId);

            if (userError) {
                console.error("Update user error:", userError);
                // Continue to update alumni profile even if email update fails (might be duplicate)
            }
        }

        // Map location strings to alumni columns
        let current_city: string | undefined = currentCity !== undefined ? currentCity : undefined;
        let current_state: string | undefined = currentState !== undefined ? currentState : undefined;
        let current_country: string | undefined = currentCountry !== undefined ? currentCountry : undefined;
        
        // Fallback for legacy 'location' field if sent
        if (location && typeof location === "string" && !current_city) {
            const parts = location.split(",").map((p: string) => p.trim()).filter(Boolean);
            if (parts.length >= 3) {
                current_city = parts[0];
                current_state = parts[1];
                current_country = parts[2];
            } else if (parts.length === 2) {
                current_city = parts[0];
                current_country = parts[1];
            } else if (parts.length === 1) {
                current_city = parts[0];
            }
        }

        // Update alumni table (only include defined values so we don't overwrite with undefined)
        const alumniUpdateData: any = {
            first_name: firstName,
            last_name: lastName,
            phone,
            batch,
            gender,
            current_company: currentCompany,
            current_role: currentRole,
            linkedin_url: linkedinUrl,
            bio,
            resume_url: resumeUrl,
            github_url: githubUrl,
            twitter_url: twitterUrl,
            personal_website: personalWebsite,
            show_email: showEmail,
            show_phone: showPhone,
            // Map additional fields
            expertise_areas: expertiseAreas,
            volunteer_interests: volunteerInterests,
            keywords: keywords,
            employment_status: employmentStatus,
            years_of_experience: yearsOfExperience === "" ? null : (yearsOfExperience !== undefined ? Number(yearsOfExperience) : undefined),
            startup_name: startupName,
            startup_role: startupRole,
            funding_stage: fundingStage,
            founding_year: foundingYear === "" ? null : (foundingYear !== undefined ? Number(foundingYear) : undefined),
            is_startup_founder: isStartupFounder,
            timezone: timezone,
            updated_at: new Date().toISOString()
        };
        if (current_city !== undefined) alumniUpdateData.current_city = current_city;
        if (current_state !== undefined) alumniUpdateData.current_state = current_state;
        if (current_country !== undefined) alumniUpdateData.current_country = current_country;
        if (latitude !== undefined) alumniUpdateData.latitude = latitude === null ? null : Number(latitude);
        if (longitude !== undefined) alumniUpdateData.longitude = longitude === null ? null : Number(longitude);
        if (locationLabel !== undefined) alumniUpdateData.location_label = locationLabel;

        // Auto-sync graduation_year from batch if strictly 4 digits
        if (batch) {
            const batchYearMatch = String(batch).match(/^(\d{4})$/);
            if (batchYearMatch) {
                const year = parseInt(batchYearMatch[1]);
                if (!isNaN(year) && year > 1900 && year < 2100) {
                    alumniUpdateData.graduation_year = year;
                }
            } else {
                // Try to find any 4 digit year if not exact match (e.g. "Batch of 2024")
                const lazyMatch = String(batch).match(/(\d{4})/);
                if (lazyMatch) {
                    const year = parseInt(lazyMatch[1]);
                    if (!isNaN(year) && year > 1900 && year < 2100) {
                        alumniUpdateData.graduation_year = year;
                    }
                }
            }
        }

        if (profilePicture) {
            alumniUpdateData.profile_picture = profilePicture;
        }

        if (linkedin_photo_url) {
            alumniUpdateData.linkedin_photo_url = linkedin_photo_url;
        }

        let alumni: any = null;
        let alumniError: any = null;
        const { data: updatedAlumni, error: updateError } = await supabase
            .from("alumni")
            .update(alumniUpdateData)
            .eq("user_id", userId)
            .select()
            .single();

        if (updateError) {
            alumniError = updateError;
            alumni = null;
        } else {
            alumni = updatedAlumni;
        }

        // If no row was updated (alumni profile doesn't exist yet), create it so personal/academic info is stored
        if (alumniError?.code === "PGRST116" || (alumniError && String(alumniError.message || "").includes("0 rows"))) {
            const gradYear = alumniUpdateData.graduation_year ?? (() => {
                if (batch) {
                    const m = String(batch).match(/(\d{4})/);
                    if (m) {
                        const y = parseInt(m[1], 10);
                        if (!isNaN(y) && y >= 2021 && y < 2100) return y;
                    }
                }
                return new Date().getFullYear();
            })();
            const batchValue = (batch && String(batch).trim()) ? String(batch).trim() : String(gradYear);
            let insertEmail = email && String(email).trim();
            if (!insertEmail) {
                const { data: userRow } = await supabase.from("users").select("email").eq("id", userId).single();
                insertEmail = userRow?.email ?? "";
            }
            if (!insertEmail) {
                return res.status(400).json({ error: "Email is required to create profile" });
            }
            const insertData: any = {
                user_id: userId,
                first_name: firstName ?? "",
                last_name: lastName ?? "",
                email: insertEmail,
                graduation_year: gradYear,
                batch: batchValue,
                phone: phone ?? null,
                gender: gender ?? null,
                current_company: currentCompany ?? null,
                current_role: currentRole ?? null,
                current_city: current_city ?? null,
                current_state: current_state ?? null,
                current_country: current_country ?? null,
                latitude: latitude === null ? null : (latitude !== undefined ? Number(latitude) : null),
                longitude: longitude === null ? null : (longitude !== undefined ? Number(longitude) : null),
                location_label: locationLabel ?? null,
                linkedin_url: linkedinUrl ?? null,
                bio: bio ?? null,
                resume_url: resumeUrl ?? null,
                github_url: githubUrl ?? null,
                twitter_url: twitterUrl ?? null,
                personal_website: personalWebsite ?? null,
                show_email: showEmail ?? false,
                show_phone: showPhone ?? false,
                is_profile_public: true,
                is_active: true,
            };
            if (profilePicture) insertData.profile_picture = profilePicture;
            if (linkedin_photo_url) insertData.linkedin_photo_url = linkedin_photo_url;

            const { data: insertedAlumni, error: insertErr } = await supabase
                .from("alumni")
                .insert(insertData)
                .select()
                .single();

            if (insertErr) {
                console.error("Create alumni (profile) error:", insertErr);
                return res.status(500).json({ error: "Failed to create profile" });
            }
            alumni = insertedAlumni;
        } else if (alumniError) {
            console.error("Update alumni error:", alumniError);
            return res.status(500).json({ error: "Failed to update profile" });
        }

        res.json({ message: "Profile updated successfully", alumni: transformToCamelCase(alumni) });
    } catch (error) {
        console.error("Update profile error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
