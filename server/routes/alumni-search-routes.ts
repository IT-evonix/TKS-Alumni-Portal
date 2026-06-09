
import { Router } from "express";
import { supabase } from "../supabase";

function escapeLike(value: string): string {
  return value.replace(/%/g, "\\%").replace(/_/g, "\\_");
}

const router = Router();

// ==================== ALUMNI SEARCH ROUTES ====================

// Alumni search endpoint
router.get("/search", async (req, res) => {
    try {
        const { search, batch, location, industry, education, limit = "20", offset = "0", tab } = req.query;
        const searchLimit = parseInt(limit as string);
        const searchOffset = parseInt(offset as string);
        const currentUserId = req.headers["user-id"] as string;

        // console.log("Alumni search query:", { search, batch, location, limit, offset, tab, currentUserId });

        let userIdsToFilter: string[] | null = null;

        // Handle tab filtering if user is logged in
        if (currentUserId && tab && tab !== 'all' && tab !== 'champions' && tab !== 'faculty') {
            let connectionQuery = supabase.from("connection_requests").select("requester_id, recipient_id, status");

            if (tab === 'connected') {
                // Get all accepted connections involving current user
                connectionQuery = connectionQuery.eq('status', 'accepted')
                    .or(`requester_id.eq.${currentUserId},recipient_id.eq.${currentUserId}`);
            } else if (tab === 'sent') {
                // Get pending requests sent by current user
                connectionQuery = connectionQuery.eq('status', 'pending').eq('requester_id', currentUserId);
            } else if (tab === 'received') {
                // Get pending requests received by current user
                connectionQuery = connectionQuery.eq('status', 'pending').eq('recipient_id', currentUserId);
            }

            const { data: connections } = await connectionQuery;

            if (connections) {
                userIdsToFilter = connections.map(c => {
                    if (tab === 'sent') return c.recipient_id; // People I sent to
                    if (tab === 'received') return c.requester_id; // People who sent to me
                    // For connected, return the OTHER person
                    return c.requester_id === currentUserId ? c.recipient_id : c.requester_id;
                });
            }
        }

        let query = supabase.from("alumni").select(`
          *,
          users!inner(id, username, email, user_role, account_blocked)
        `, { count: 'exact' });

        // Apply User ID filter if applicable
        if (userIdsToFilter !== null) {
            if (userIdsToFilter.length === 0) {
                // Valid filter but no results found (e.g. no connections)
                return res.json({ alumni: [], count: 0 });
            }
            query = query.in('user_id', userIdsToFilter);
        }

        // Filter by active alumni and non-blocked users
        query = query.eq("is_active", true).eq("users.account_blocked", false);

        // Filter by champions tab
        if (tab === 'champions') {
            query = query.eq("is_batch_champion", true);
        }

        // Filter by faculty tab
        if (tab === 'faculty') {
            query = query.eq("users.user_role", "faculty");
        }

        if (search) {
            const searchTerm = search as string;
            const sanitizedSearchTerm = escapeLike(searchTerm.replace(/,/g, " ").trim());

            // Smart search: Search users.email separately to find matching user_ids
            // This allows partial email matching (e.g., "atul" matches "atultelang@gmail.com")
            const { data: emailMatches } = await supabase
                .from("users")
                .select("id")
                .ilike("email", `%${sanitizedSearchTerm}%`)
                .eq("account_blocked", false);

            const emailMatchedUserIds = emailMatches?.map(u => u.id) || [];

            // Smart search enhancement: Also search in experiences and projects
            const [{ data: expMatches }, { data: projMatches }] = await Promise.all([
                supabase.from("alumni_experiences").select("alumni_id").or(`company_name.ilike.%${sanitizedSearchTerm}%,position.ilike.%${sanitizedSearchTerm}%`).limit(50),
                supabase.from("alumni_projects").select("alumni_id").or(`project_name.ilike.%${sanitizedSearchTerm}%,description.ilike.%${sanitizedSearchTerm}%`).limit(50)
            ]);

            const relatedAlumniIds = new Set([
                ...(expMatches?.map(m => m.alumni_id) || []),
                ...(projMatches?.map(m => m.alumni_id) || [])
            ]);

            // Build search condition for alumni table fields
            // Note: current_role is a reserved keyword in PostgreSQL, but Supabase PostgREST handles column names automatically
            let orCondition = `first_name.ilike.%${sanitizedSearchTerm}%,last_name.ilike.%${sanitizedSearchTerm}%,current_company.ilike.%${sanitizedSearchTerm}%,current_role.ilike.%${sanitizedSearchTerm}%,current_city.ilike.%${sanitizedSearchTerm}%,current_country.ilike.%${sanitizedSearchTerm}%,bio.ilike.%${sanitizedSearchTerm}%,skills.ilike.%${sanitizedSearchTerm}%`;

            // Add email-matched user_ids to the search
            if (emailMatchedUserIds.length > 0) {
                const emailIdList = emailMatchedUserIds.join(',');
                orCondition += `,user_id.in.(${emailIdList})`;
            }

            // Add experience/project matched alumni IDs
            if (relatedAlumniIds.size > 0) {
                const idList = Array.from(relatedAlumniIds).join(',');
                orCondition += `,id.in.(${idList})`;
            }

            query = query.or(orCondition);

            // Ensure current user is included if they match the search (even if filtered by tab)
            // This allows users to find their own profile
            if (currentUserId) {
                // Check if current user matches the search criteria
                const { data: currentUserAlumni } = await supabase
                    .from("alumni")
                    .select("id, user_id, first_name, last_name")
                    .eq("user_id", currentUserId)
                    .maybeSingle();

                if (currentUserAlumni) {
                    const fullName = `${currentUserAlumni.first_name || ''} ${currentUserAlumni.last_name || ''}`.toLowerCase();
                    const searchLower = sanitizedSearchTerm.toLowerCase();

                    // Check if current user matches search
                    if (fullName.includes(searchLower) ||
                        (emailMatches?.some(u => u.id === currentUserId))) {
                        // If current user matches but is filtered out by tab, we'll add them back in post-processing
                        // For now, we ensure they're included by not filtering them out
                    }
                }
            }
        }

        if (batch) {
            query = query.eq("batch", batch as string);
        }

        if (location) {
            query = query.ilike("current_city", `%${location}%`);
        }

        if (industry) {
            query = query.ilike("industry", `%${industry}%`);
        }

        if (education) {
            query = query.ilike("higher_education", `%${education}%`);
        }

        // Add skills filter support
        if (req.query.skills) {
            const skillsParam = req.query.skills as string;
            const skillsList = skillsParam.split(",").map(s => s.trim()).filter(Boolean);

            if (skillsList.length > 0) {
                const skillConditions = skillsList.map(skill => `skills.ilike.%${skill}%`).join(",");
                query = query.or(skillConditions);
            }
        }

        // Fetch data with support for limits > 1000 using internal pagination
        let finalData: any[] = [];
        let currentOffset = searchOffset;
        let remainingLimit = searchLimit;
        let totalDBCount = 0;

        while (remainingLimit > 0) {
            const batchLimit = Math.min(remainingLimit, 1000);
            const { data: batchData, error: batchError, count: batchCount } = await query
                .range(currentOffset, currentOffset + batchLimit - 1);

            if (batchError) {
                console.error("Alumni search error:", batchError);
                return res.status(500).json({ error: "Failed to search alumni" });
            }

            if (batchCount !== null) totalDBCount = batchCount;

            if (!batchData || batchData.length === 0) break;

            finalData = [...finalData, ...batchData];
            currentOffset += batchLimit;
            remainingLimit -= batchLimit;

            // If we didn't get a full batch, we've reached the end
            if (batchData.length < batchLimit) break;
        }

        const count = totalDBCount;

        // Ensure current user is included if they match the search (even if filtered by tab)
        if (currentUserId && search) {
            const searchTerm = (search as string).toLowerCase().trim();
            const currentUserInResults = finalData.some((item: any) => item.user_id === currentUserId);

            if (!currentUserInResults) {
                // Check if current user matches the search
                const { data: currentUserData } = await supabase
                    .from("alumni")
                    .select(`
                        *,
                        users!inner(id, username, email, user_role, account_blocked)
                    `)
                    .eq("user_id", currentUserId)
                    .eq("users.account_blocked", false)
                    .maybeSingle();

                if (currentUserData) {
                    const fullName = `${currentUserData.first_name || ''} ${currentUserData.last_name || ''}`.toLowerCase();
                    const userEmail = (currentUserData.users?.email || '').toLowerCase();

                    // Check if current user matches search criteria
                    const matchesName = fullName.includes(searchTerm);
                    const matchesEmail = userEmail.includes(searchTerm);

                    if (matchesName || matchesEmail) {
                        // Add current user to results (at the beginning for visibility)
                        finalData = [currentUserData, ...finalData];
                    }
                }
            }
        }

        // Map data for frontend
        const mappedAlumni = finalData.map((item: any) => ({
            ...item,
            userId: item.user_id,
            firstName: item.first_name,
            lastName: item.last_name,
            currentCompany: item.current_company,
            currentRole: item.current_role,
            currentCity: item.current_city,
            profilePicture: item.profile_picture,
            isBatchChampion: item.is_batch_champion,
            userRole: item.users?.user_role || 'alumni',
        }));

        res.json({ alumni: mappedAlumni, count: count ?? 0 });
    } catch (error) {
        console.error("Alumni search error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Get distinct filter options for alumni (dynamic based on existing data)
router.get("/filters", async (req, res) => {
    try {
        // First, get all active alumni with their user_ids
        const { data: alumni, error: alumniError } = await supabase
            .from("alumni")
            .select("current_city, batch, industry, higher_education, user_id")
            .eq("is_active", true);

        if (alumniError) {
            console.error("Get alumni filters error:", alumniError);
            return res.status(500).json({ error: "Failed to fetch alumni filters" });
        }

        // Filter by non-blocked users
        let filteredAlumni = alumni || [];
        if (filteredAlumni.length > 0) {
            // Fetch user IDs from alumni records
            const userIds = [...new Set(filteredAlumni.map((a: any) => a.user_id).filter(Boolean))];

            if (userIds.length > 0) {
                const { data: users } = await supabase
                    .from("users")
                    .select("id")
                    .in("id", userIds)
                    .eq("account_blocked", false);

                const activeUserIds = new Set(users?.map((u: any) => u.id) || []);

                // Filter alumni to only include those with non-blocked users
                filteredAlumni = filteredAlumni.filter((a: any) => activeUserIds.has(a.user_id));
            }
        }

        const locations = Array.from(
            new Set(
                filteredAlumni.map((a: any) => a.current_city)
                    .filter((l: any) => l && l.trim() !== "")
            )
        ).sort();

        const batches = Array.from(
            new Set(
                filteredAlumni.map((a: any) => a.batch)
                    .filter((b: any) => b && b.trim() !== "")
            )
        ).sort((a: any, b: any) => {
            // Sort batches as strings but try numeric comparison if possible
            const aNum = parseInt(a);
            const bNum = parseInt(b);
            if (!isNaN(aNum) && !isNaN(bNum)) {
                return bNum - aNum; // Descending order (newest first)
            }
            return String(b).localeCompare(String(a)); // Descending order for strings
        });

        const industries = Array.from(
            new Set(
                filteredAlumni.map((a: any) => a.industry)
                    .filter((i: any) => i && i.trim() !== "")
            )
        ).sort();

        const educationLevels = Array.from(
            new Set(
                filteredAlumni.map((a: any) => a.higher_education)
                    .filter((e: any) => e && e.trim() !== "")
            )
        ).sort();

        res.json({
            locations,
            batches,
            industries,
            education: educationLevels,
        });
    } catch (error) {
        console.error("Get alumni filters error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// NOTE: /public/:userId is handled by the richer endpoint in routes.ts which includes
// privacy settings, mutual connections, and full profile data.

export default router;
