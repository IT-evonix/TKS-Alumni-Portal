import { Router } from "express";
import { supabase } from "../supabase";
import { parseSearchQuery } from "../utils/nlp-search-parser";

const router = Router();

// ==================== GLOBAL SEARCH ROUTES ====================

/**
 * Enhanced Global Search with Fuzzy Matching and Comprehensive Coverage
 * 
 * Searches across:
 * - Alumni (Profile, Experiences, Projects, Skills, Certifications, Achievements, Languages)
 * - Jobs (Title, Company, Description, Skills, Industry)
 * - Events (Title, Description, Location, Tags)
 * - Posts (Content, Author)
 * 
 * Features:
 * - Fuzzy search using PostgreSQL pg_trgm extension (tolerates typos)
 * - Intelligent relevance ranking
 * - Proper URL redirection to specific items
 * - Comprehensive entity coverage
 */

/**
 * Helper function to create fuzzy search conditions using pg_trgm similarity
 * Falls back to ILIKE if trigram similarity doesn't match
 */
function buildFuzzySearchCondition(column: string, searchTerm: string, threshold: number = 0.2): string {
    const sanitized = searchTerm.trim().replace(/[%_]/g, '');
    return `(
        ${column} ILIKE '%${sanitized}%' 
        OR similarity(${column}, '${sanitized}') > ${threshold}
    )`;
}

/**
 * Enhanced relevance calculation with fuzzy matching support
 */
function calculateRelevance(query: string, text: string, matchType: 'exact' | 'fuzzy' | 'partial' = 'partial'): number {
    if (!text) return 0;

    const lowerQuery = query.toLowerCase().trim();
    const lowerText = text.toLowerCase();
    let score = 0;

    // Exact match (highest priority)
    if (lowerText === lowerQuery) {
        score += 100;
        return score;
    }

    // Starts with query
    if (lowerText.startsWith(lowerQuery)) {
        score += 80;
    }

    // Contains exact phrase
    if (lowerText.includes(lowerQuery)) {
        score += 60;

        // Word boundary match (whole word)
        const regex = new RegExp(`\\b${lowerQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (regex.test(lowerText)) {
            score += 30;
        }
    }

    // Fuzzy match (typo tolerance)
    if (matchType === 'fuzzy') {
        // Calculate similarity ratio
        const similarity = calculateSimilarity(lowerQuery, lowerText);
        if (similarity > 0.7) {
            score += 40;
        } else if (similarity > 0.5) {
            score += 20;
        } else if (similarity > 0.3) {
            score += 10;
        }
    }

    // Word matches
    const words = lowerQuery.split(/\s+/).filter(w => w.length > 2);
    words.forEach((word, index) => {
        if (lowerText.includes(word)) {
            // First word gets higher weight
            score += index === 0 ? 15 : 10;

            // Whole word match bonus
            const wordRegex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
            if (wordRegex.test(lowerText)) {
                score += 5;
            }
        }
    });

    // Position bonus (matches earlier in text are more relevant)
    const position = lowerText.indexOf(lowerQuery);
    if (position >= 0 && position < 50) {
        score += 10;
    }

    return score;
}

/**
 * Simple Levenshtein-like similarity calculation for client-side fallback
 */
function calculateSimilarity(str1: string, str2: string): number {
    const a = str1.toLowerCase();
    const b = str2.toLowerCase();
    if (a === b) return 1.0;
    if (a.length === 0 || b.length === 0) return 0.0;

    // Levenshtein edit distance normalized to [0, 1]
    const matrix: number[][] = Array.from({ length: b.length + 1 }, (_, i) =>
        Array.from({ length: a.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            matrix[i][j] = b[i - 1] === a[j - 1]
                ? matrix[i - 1][j - 1]
                : 1 + Math.min(matrix[i - 1][j], matrix[i][j - 1], matrix[i - 1][j - 1]);
        }
    }

    const maxLen = Math.max(a.length, b.length);
    return 1 - matrix[b.length][a.length] / maxLen;
}

router.get("/", async (req, res) => {
    try {
        const {
            query,
            type = 'all',
            limit = '40',
            dateRange,
            dateFrom,
            dateTo,
            location,
            batch,
            batchFrom,
            batchTo,
            skills,
            industry,
            company,
            jobType,
            workMode,
            eventType,
            sortBy = 'relevance'
        } = req.query;

        const rawSearchTerm = (query as string)?.trim();

        // --- NLP SEARCH INTELLIGENCE ---
        const parsed = rawSearchTerm ? parseSearchQuery(rawSearchTerm) : null;

        // Merge NLP parsed values with explicit query params (query params take priority)
        const searchTerm = (query as string) || parsed?.filters.query || '';
        const searchType = (type !== 'all' ? type : parsed?.intentType) || 'all';
        const searchLocation = (location as string) || parsed?.filters.location;
        const searchBatch = (batch as string) || parsed?.filters.batch;
        const searchCompany = (company as string) || parsed?.filters.company;

        const searchLimit = Math.min(parseInt(limit as string) || 40, 100);

        if (!searchTerm || (searchTerm.length < 2 && !searchTerm.startsWith('>'))) {
            return res.json({ results: [] });
        }

        // Helper function to apply date filters
        const applyDateFilter = (queryBuilder: any, dateField: string = 'created_at') => {
            if (dateRange === 'today') {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                queryBuilder = queryBuilder.gte(dateField, today.toISOString());
            } else if (dateRange === 'week') {
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                queryBuilder = queryBuilder.gte(dateField, weekAgo.toISOString());
            } else if (dateRange === 'month') {
                const monthAgo = new Date();
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                queryBuilder = queryBuilder.gte(dateField, monthAgo.toISOString());
            } else if (dateRange === 'year') {
                const yearAgo = new Date();
                yearAgo.setFullYear(yearAgo.getFullYear() - 1);
                queryBuilder = queryBuilder.gte(dateField, yearAgo.toISOString());
            } else if (dateRange === 'custom') {
                if (dateFrom) {
                    queryBuilder = queryBuilder.gte(dateField, dateFrom);
                }
                if (dateTo) {
                    queryBuilder = queryBuilder.lte(dateField, dateTo);
                }
            }
            return queryBuilder;
        };

        // Helper function to apply event date filters (uses event_date field)
        const applyEventDateFilter = (queryBuilder: any) => {
            if (dateRange === 'today') {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                queryBuilder = queryBuilder.gte('event_date', today.toISOString());
            } else if (dateRange === 'week') {
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                queryBuilder = queryBuilder.gte('event_date', weekAgo.toISOString());
            } else if (dateRange === 'month') {
                const monthAgo = new Date();
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                queryBuilder = queryBuilder.gte('event_date', monthAgo.toISOString());
            } else if (dateRange === 'year') {
                const yearAgo = new Date();
                yearAgo.setFullYear(yearAgo.getFullYear() - 1);
                queryBuilder = queryBuilder.gte('event_date', yearAgo.toISOString());
            } else if (dateRange === 'custom') {
                if (dateFrom) {
                    queryBuilder = queryBuilder.gte('event_date', dateFrom);
                }
                if (dateTo) {
                    queryBuilder = queryBuilder.lte('event_date', dateTo);
                }
            }
            return queryBuilder;
        };

        // Debug logging
        console.log('🔍 Global search received filters:', {
            query: searchTerm,
            type: searchType,
            dateRange,
            dateFrom,
            dateTo,
            location: searchLocation,
            batch: searchBatch,
            batchFrom,
            batchTo,
            skills,
            industry,
            company: searchCompany,
            jobType,
            workMode,
            eventType,
            sortBy
        });

        // Sanitize search term for SQL (basic protection)
        const sanitizedSearch = searchTerm.replace(/[%_']/g, ' ').replace(/\s+/g, ' ').trim();
        const results: any[] = [];

        // Build search words for multi-word queries
        const searchWords = sanitizedSearch.split(/\s+/).filter(w => w.length > 1);

        // 0. Handle Navigation Commands (starts with ">")
        if (searchTerm.startsWith('>')) {
            const command = searchTerm.substring(1).trim().toLowerCase();
            const commands = [
                { id: 'profile', title: 'My Profile', url: '/profile', icon: 'User' },
                { id: 'settings', title: 'Settings', url: '/settings', icon: 'Settings' },
                { id: 'logout', title: 'Logout', url: '/logout', icon: 'LogOut' },
                { id: 'feed', title: 'Feed', url: '/feed', icon: 'Home' },
                { id: 'events', title: 'Events', url: '/events', icon: 'Calendar' },
                { id: 'forums', title: 'Forums', url: '/forums', icon: 'MessageSquare' },
                { id: 'jobs', title: 'Job Portal', url: '/job-portal', icon: 'Briefcase' },
                { id: 'alumni', title: 'Alumni Directory', url: '/alumni', icon: 'Users' },
                { id: 'blogs', title: 'Blogs', url: '/blogs', icon: 'BookOpen' },
                { id: 'podcasts', title: 'Podcasts', url: '/podcast', icon: 'Mic' },
                { id: 'newsletters', title: 'Newsletters', url: '/newsletters', icon: 'Mail' },
                { id: 'travel', title: 'Travel Journal', url: '/travel-journal', icon: 'MapPin' },
                { id: 'mentorship', title: 'Mentorship', url: '/mentorship', icon: 'GraduationCap' },
                { id: 'connections', title: 'Connections', url: '/connections', icon: 'Users' },
            ];

            const filteredCommands = command
                ? commands.filter(cmd => cmd.id.includes(command) || cmd.title.toLowerCase().includes(command))
                : commands;

            filteredCommands.forEach(cmd => {
                results.push({
                    id: cmd.id,
                    type: 'command',
                    title: cmd.title,
                    description: `Quick navigate to ${cmd.title}`,
                    image: null,
                    url: cmd.url,
                    icon: cmd.icon,
                    relevance: 1000 // Highest priority
                });
            });

            // If it's purely a command search and we found matches, we might want to return early or let it merge
        }

        // 1. Search Alumni (if type is 'all' or 'alumni')
        if (searchType === 'all' || searchType === 'alumni') {
            // Check if we have filters - if so, skip RPC and use filtered query directly
            const hasFilters = !!(searchLocation || searchBatch || batchFrom || batchTo || industry || searchCompany || skills);

            // Smart search: Search users.email separately to find matching user_ids
            // This allows partial email matching (e.g., "atul" matches "atultelang@gmail.com")
            // Do this early so it's available for both RPC and fallback queries
            const { data: emailMatches } = await supabase
                .from("users")
                .select("id")
                .ilike("email", `%${sanitizedSearch}%`)
                .eq("account_blocked", false);

            const emailMatchedUserIds = emailMatches?.map(u => u.id) || [];

            // Search in basic alumni fields using RPC or raw query for fuzzy search
            let alumniData: any = null;
            let alumniError: any = null;

            // Only use RPC if no filters are applied (RPC doesn't support filters)
            if (!hasFilters) {
                // Try Advanced RPC (FTS + Boolean) first
                try {
                    const rpcResult = await supabase.rpc('search_alumni_advanced', {
                        search_query: sanitizedSearch,
                        limit_count: Math.ceil(searchLimit * 0.5)
                    });

                    if (rpcResult.error) {
                        // Fallback if function doesn't exist or errors
                        throw rpcResult.error;
                    } else {
                        alumniData = rpcResult.data;
                    }
                } catch (advError) {
                    // Fallback to Legacy RPC (Fuzzy)
                    try {
                        const rpcResultFuzzy = await supabase.rpc('search_alumni_fuzzy', {
                            search_term: sanitizedSearch,
                            result_limit: Math.ceil(searchLimit * 0.5)
                        });

                        if (!rpcResultFuzzy.error) {
                            alumniData = rpcResultFuzzy.data;
                            // Clear error to prevent falling back to ILIKE if we have data
                            alumniError = null;
                        } else {
                            alumniError = rpcResultFuzzy.error;
                        }
                    } catch (fuzzyError) {
                        alumniError = fuzzyError;
                    }
                }

                // If RPC succeeded, also add email-matched users that might not be in RPC results
                if (alumniData && emailMatchedUserIds.length > 0) {
                    const existingUserIds = new Set(alumniData.map((item: any) => item.user_id || item.id));
                    const missingEmailUserIds = emailMatchedUserIds.filter(id => !existingUserIds.has(id));
                    
                    if (missingEmailUserIds.length > 0) {
                        const { data: emailMatchedAlumni } = await supabase
                            .from("alumni")
                            .select(`
                                id, user_id, first_name, last_name, bio, skills,
                                current_company, current_role, current_city,
                                profile_picture, industry, batch, created_at
                            `)
                            .in("user_id", missingEmailUserIds)
                            .eq("is_active", true)
                            .limit(10);
                        
                        if (emailMatchedAlumni && emailMatchedAlumni.length > 0) {
                            alumniData = [...alumniData, ...emailMatchedAlumni];
                        }
                    }
                }
            } else {
                // Force fallback when filters are present
                alumniError = new Error('Filters require fallback query');
                alumniData = null; // Ensure we use fallback
            }

            // Fallback to ILIKE if RPC doesn't exist, failed, or filters are present
            if (hasFilters || alumniError || !alumniData) {
                let fallbackQuery = supabase
                    .from("alumni")
                    .select(`
                        id, user_id, first_name, last_name, bio, skills,
                        current_company, current_role, current_city,
                        profile_picture, industry, batch, created_at
                    `)
                    .eq("is_active", true);

                // Build search condition (all OR clauses merged into one .or() call to avoid Supabase AND-of-ORs bug)
                let searchCondition = `first_name.ilike.%${sanitizedSearch}%,last_name.ilike.%${sanitizedSearch}%,bio.ilike.%${sanitizedSearch}%,skills.ilike.%${sanitizedSearch}%,current_company.ilike.%${sanitizedSearch}%,current_role.ilike.%${sanitizedSearch}%,current_city.ilike.%${sanitizedSearch}%,industry.ilike.%${sanitizedSearch}%`;

                // Add email-matched user_ids to the search
                if (emailMatchedUserIds.length > 0) {
                    const emailIdList = emailMatchedUserIds.join(',');
                    searchCondition += `,user_id.in.(${emailIdList})`;
                }

                // Merge skills filter conditions into the same OR string (avoids double .or() conflict)
                if (skills) {
                    const skillsList = (skills as string).split(',').map((s: string) => s.trim()).filter(Boolean);
                    skillsList.forEach((skill: string) => {
                        searchCondition += `,skills.ilike.%${skill}%`;
                    });
                }

                fallbackQuery = fallbackQuery.or(searchCondition);

                // Apply non-OR filters as AND conditions
                if (searchLocation) {
                    fallbackQuery = fallbackQuery.ilike("current_city", `%${searchLocation}%`);
                }
                if (searchBatch) {
                    fallbackQuery = fallbackQuery.eq("batch", searchBatch);
                } else if (batchFrom || batchTo) {
                    if (batchFrom) {
                        fallbackQuery = fallbackQuery.gte("graduation_year", parseInt(batchFrom as string));
                    }
                    if (batchTo) {
                        fallbackQuery = fallbackQuery.lte("graduation_year", parseInt(batchTo as string));
                    }
                }
                if (industry) {
                    fallbackQuery = fallbackQuery.ilike("industry", `%${industry}%`);
                }
                if (searchCompany) {
                    fallbackQuery = fallbackQuery.ilike("current_company", `%${searchCompany}%`);
                }

                const fallbackResult = await fallbackQuery.limit(Math.ceil(searchLimit * 0.5));

                alumniData = fallbackResult.data;
                alumniError = fallbackResult.error;
            }

            const alumniResults = alumniData || [];
            const currentUserId = req.headers['user-id'] as string;
            const currentUserInResults = alumniResults.some((item: any) => item.user_id === currentUserId);
            
            if (!alumniError && alumniResults) {
                alumniResults.forEach((item: any) => {
                    const searchableText = `${item.first_name} ${item.last_name} ${item.bio || ''} ${item.skills || ''} ${item.current_company || ''} ${item.current_role || ''} ${item.current_city || ''} ${item.industry || ''}`;

                    results.push({
                        id: item.user_id || item.id,
                        type: 'alumni',
                        title: `${item.first_name || ''} ${item.last_name || ''}`.trim(),
                        description: [
                            item.current_role,
                            item.current_company,
                            item.current_city,
                            item.industry,
                            item.batch ? `Batch ${item.batch}` : null
                        ].filter(Boolean).join(' • ') || item.bio || 'Alumni Member',
                        image: item.profile_picture,
                        url: `/profile/${item.user_id || item.id}`,
                        relevance: calculateRelevance(searchTerm, searchableText, 'exact'),
                        createdAt: item.created_at || null
                    });
                });
            }

            // Ensure current user is included if they match the search (even if not in initial results)
            if (currentUserId && !currentUserInResults && sanitizedSearch) {
                const { data: currentUserAlumni } = await supabase
                    .from("alumni")
                    .select(`
                        id, user_id, first_name, last_name, bio, skills,
                        current_company, current_role, current_city,
                        profile_picture, industry, batch
                    `)
                    .eq("user_id", currentUserId)
                    .eq("is_active", true)
                    .maybeSingle();

                if (currentUserAlumni) {
                    const fullName = `${currentUserAlumni.first_name || ''} ${currentUserAlumni.last_name || ''}`.toLowerCase();
                    const searchLower = sanitizedSearch.toLowerCase();
                    
                    // Check if current user matches search by name
                    const matchesName = fullName.includes(searchLower);
                    
                    // Check if current user matches search by email
                    const matchesEmail = emailMatchedUserIds.includes(currentUserId);
                    
                    if (matchesName || matchesEmail) {
                        const searchableText = `${currentUserAlumni.first_name} ${currentUserAlumni.last_name} ${currentUserAlumni.bio || ''} ${currentUserAlumni.skills || ''} ${currentUserAlumni.current_company || ''} ${currentUserAlumni.current_role || ''} ${currentUserAlumni.current_city || ''} ${currentUserAlumni.industry || ''}`;
                        
                        // Add current user to results (at the beginning for visibility)
                        results.unshift({
                            id: currentUserAlumni.user_id,
                            type: 'alumni',
                            title: `${currentUserAlumni.first_name || ''} ${currentUserAlumni.last_name || ''}`.trim(),
                            description: [
                                currentUserAlumni.current_role,
                                currentUserAlumni.current_company,
                                currentUserAlumni.current_city,
                                currentUserAlumni.industry,
                                currentUserAlumni.batch ? `Batch ${currentUserAlumni.batch}` : null
                            ].filter(Boolean).join(' • ') || currentUserAlumni.bio || 'Alumni Member',
                            image: currentUserAlumni.profile_picture,
                            url: `/profile/${currentUserAlumni.user_id}`,
                            relevance: calculateRelevance(searchTerm, searchableText, 'exact') + 10,
                            createdAt: (currentUserAlumni as any).created_at || null
                        });
                    }
                }
            }

            // Search in Experiences table
            const { data: expData } = await supabase
                .from("alumni_experiences")
                .select(`
                    alumni_id, company_name, position, description,
                    alumni!inner(user_id, first_name, last_name, profile_picture, is_active)
                `)
                .eq("alumni.is_active", true)
                .or(`company_name.ilike.%${sanitizedSearch}%,position.ilike.%${sanitizedSearch}%,description.ilike.%${sanitizedSearch}%`)
                .limit(20);

            if (expData) {
                expData.forEach((item: any) => {
                    const alumni = item.alumni;
                    if (alumni && !results.some(r => r.type === 'alumni' && r.id === alumni.user_id)) {
                        const searchableText = `${item.company_name} ${item.position} ${item.description || ''}`;
                        results.push({
                            id: alumni.user_id,
                            type: 'alumni',
                            title: `${alumni.first_name} ${alumni.last_name}`,
                            description: `Worked at ${item.company_name} as ${item.position}`,
                            image: alumni.profile_picture,
                            url: `/profile/${alumni.user_id}`,
                            relevance: calculateRelevance(searchTerm, searchableText) - 5
                        });
                    }
                });
            }

            // Search in Projects table
            const { data: projData } = await supabase
                .from("alumni_projects")
                .select(`
                    alumni_id, project_name, description, technologies_used,
                    alumni!inner(user_id, first_name, last_name, profile_picture, is_active)
                `)
                .eq("alumni.is_active", true)
                .or(`project_name.ilike.%${sanitizedSearch}%,description.ilike.%${sanitizedSearch}%`)
                .limit(15);

            if (projData) {
                projData.forEach((item: any) => {
                    const alumni = item.alumni;
                    if (alumni && !results.some(r => r.type === 'alumni' && r.id === alumni.user_id)) {
                        const techUsed = Array.isArray(item.technologies_used) ? item.technologies_used.join(' ') : '';
                        const searchableText = `${item.project_name} ${item.description || ''} ${techUsed}`;
                        results.push({
                            id: alumni.user_id,
                            type: 'alumni',
                            title: `${alumni.first_name} ${alumni.last_name}`,
                            description: `Project: ${item.project_name}`,
                            image: alumni.profile_picture,
                            url: `/profile/${alumni.user_id}`,
                            relevance: calculateRelevance(searchTerm, searchableText) - 8
                        });
                    }
                });
            }

            // Search in Skills table
            const { data: skillsData } = await supabase
                .from("alumni_skills")
                .select(`
                    alumni_id, skill_name, category,
                    alumni!inner(user_id, first_name, last_name, profile_picture, is_active)
                `)
                .eq("alumni.is_active", true)
                .ilike("skill_name", `%${sanitizedSearch}%`)
                .limit(15);

            if (skillsData) {
                skillsData.forEach((item: any) => {
                    const alumni = item.alumni;
                    if (alumni && !results.some(r => r.type === 'alumni' && r.id === alumni.user_id)) {
                        results.push({
                            id: alumni.user_id,
                            type: 'alumni',
                            title: `${alumni.first_name} ${alumni.last_name}`,
                            description: `Skill: ${item.skill_name}${item.category ? ` (${item.category})` : ''}`,
                            image: alumni.profile_picture,
                            url: `/profile/${alumni.user_id}`,
                            relevance: calculateRelevance(searchTerm, item.skill_name) - 6
                        });
                    }
                });
            }

            // Search in Certifications table
            const { data: certData } = await supabase
                .from("alumni_certifications")
                .select(`
                    alumni_id, certification_name, issuing_organization,
                    alumni!inner(user_id, first_name, last_name, profile_picture, is_active)
                `)
                .eq("alumni.is_active", true)
                .eq("is_active", true)
                .or(`certification_name.ilike.%${sanitizedSearch}%,issuing_organization.ilike.%${sanitizedSearch}%`)
                .limit(10);

            if (certData) {
                certData.forEach((item: any) => {
                    const alumni = item.alumni;
                    if (alumni && !results.some(r => r.type === 'alumni' && r.id === alumni.user_id)) {
                        results.push({
                            id: alumni.user_id,
                            type: 'alumni',
                            title: `${alumni.first_name} ${alumni.last_name}`,
                            description: `Certified: ${item.certification_name} by ${item.issuing_organization}`,
                            image: alumni.profile_picture,
                            url: `/profile/${alumni.user_id}`,
                            relevance: calculateRelevance(searchTerm, `${item.certification_name} ${item.issuing_organization}`) - 7
                        });
                    }
                });
            }

            // Search in Achievements table
            const { data: achievementData } = await supabase
                .from("alumni_achievements")
                .select(`
                    alumni_id, title, description, issuing_organization,
                    alumni!inner(user_id, first_name, last_name, profile_picture, is_active)
                `)
                .eq("alumni.is_active", true)
                .or(`title.ilike.%${sanitizedSearch}%,description.ilike.%${sanitizedSearch}%,issuing_organization.ilike.%${sanitizedSearch}%`)
                .limit(10);

            if (achievementData) {
                achievementData.forEach((item: any) => {
                    const alumni = item.alumni;
                    if (alumni && !results.some(r => r.type === 'alumni' && r.id === alumni.user_id)) {
                        results.push({
                            id: alumni.user_id,
                            type: 'alumni',
                            title: `${alumni.first_name} ${alumni.last_name}`,
                            description: `Achievement: ${item.title}`,
                            image: alumni.profile_picture,
                            url: `/profile/${alumni.user_id}`,
                            relevance: calculateRelevance(searchTerm, `${item.title} ${item.description || ''}`) - 7
                        });
                    }
                });
            }
        }

        // 2. Search Jobs (if type is 'all' or 'job') 
        if (searchType === 'all' || searchType === 'job') {
            let jobQuery = supabase
                .from("jobs")
                .select(`
                    *,
                    posted_by_user:users!posted_by(id, username, email, alumni(first_name, last_name))
                `)
                .eq("is_active", true)
                .or(`title.ilike.%${sanitizedSearch}%,company.ilike.%${sanitizedSearch}%,description.ilike.%${sanitizedSearch}%,location.ilike.%${sanitizedSearch}%,industry.ilike.%${sanitizedSearch}%,skills.ilike.%${sanitizedSearch}%`);

            // Apply filters
            if (searchLocation) {
                jobQuery = jobQuery.ilike("location", `%${searchLocation}%`);
            }
            if (industry) {
                jobQuery = jobQuery.ilike("industry", `%${industry}%`);
            }
            if (searchCompany) {
                jobQuery = jobQuery.ilike("company", `%${searchCompany}%`);
            }
            if (jobType && jobType !== 'all') {
                jobQuery = jobQuery.eq("job_type", jobType);
            }
            if (workMode && workMode !== 'all') {
                jobQuery = jobQuery.eq("work_mode", workMode);
            }
            if (skills) {
                const skillsList = (skills as string).split(',').map(s => s.trim()).filter(Boolean);
                if (skillsList.length > 0) {
                    const skillConditions = skillsList.map(skill => `skills.ilike.%${skill}%`).join(',');
                    jobQuery = jobQuery.or(skillConditions);
                }
            }
            jobQuery = applyDateFilter(jobQuery);

            const { data: jobData } = await jobQuery.limit(Math.ceil(searchLimit * 0.3));

            if (jobData) {
                jobData.forEach(item => {
                    const searchableText = `${item.title} ${item.company} ${item.description || ''} ${item.location || ''} ${item.industry || ''} ${item.skills || ''}`;
                    const postedByUser = item.posted_by_user ?? null;
                    const alumniData = postedByUser
                        ? (Array.isArray(postedByUser.alumni) ? postedByUser.alumni[0] : postedByUser.alumni)
                        : null;
                    const postedByFull = alumniData?.first_name
                        ? `${alumniData.first_name} ${alumniData.last_name || ''}`.trim()
                        : (postedByUser?.username ?? null);
                    
                    const jobDescParts = [
                        item.company,
                        item.location || 'Remote',
                        item.job_type || null,
                        item.salary_range || null,
                        item.application_deadline ? `Due ${new Date(item.application_deadline).toLocaleDateString()}` : null,
                        postedByFull ? `by ${postedByFull}` : null
                    ].filter(Boolean).join(' • ');

                    results.push({
                        id: item.id,
                        type: 'job',
                        title: item.title,
                        description: jobDescParts,
                        image: item.company_logo,
                        url: `/job-portal#job-${item.id}`,
                        relevance: calculateRelevance(searchTerm, searchableText),
                        createdAt: item.created_at || null
                    });
                });
            }
        }

        // 3. Search Events (if type is 'all' or 'event')
        if (searchType === 'all' || searchType === 'event') {
            let eventQuery = supabase
                .from("events")
                .select("*")
                .eq("is_active", true)
                .or(`title.ilike.%${sanitizedSearch}%,description.ilike.%${sanitizedSearch}%,location.ilike.%${sanitizedSearch}%`);

            // Apply filters
            if (searchLocation) {
                eventQuery = eventQuery.ilike("location", `%${searchLocation}%`);
            }
            if (eventType && eventType !== 'all') {
                if (eventType === 'virtual') {
                    eventQuery = eventQuery.eq("is_virtual", true);
                } else if (eventType === 'hybrid') {
                    // Hybrid events have both location and virtual_link
                    eventQuery = eventQuery.eq("is_virtual", true).not("virtual_link", "is", null);
                    // Also check for events with both location and virtual_link
                    // Note: This is a simplified approach - adjust based on your actual hybrid event logic
                } else if (eventType === 'in-person') {
                    eventQuery = eventQuery.eq("is_virtual", false);
                }
            }
            eventQuery = applyEventDateFilter(eventQuery);

            const { data: eventData } = await eventQuery.limit(Math.ceil(searchLimit * 0.3));

            if (eventData) {
                eventData.forEach(item => {
                    const eventDate = item.event_date ? new Date(item.event_date).toLocaleDateString() : '';
                    const searchableText = `${item.title} ${item.description || ''} ${item.location || ''} ${item.venue || ''}`;
                    const locationLabel = item.is_virtual ? 'Virtual' : (item.location || null);
                    results.push({
                        id: item.id,
                        type: 'event',
                        title: item.title,
                        description: [eventDate, locationLabel].filter(Boolean).join(' • '),
                        image: item.image_url || item.cover_image,
                        url: `/events#event-${item.id}`,
                        relevance: calculateRelevance(searchTerm, searchableText),
                        createdAt: item.event_date || item.created_at || null
                    });
                });
            }
        }

        // 4. Search Posts (if type is 'all' or 'post')
        if (searchType === 'all' || searchType === 'post') {
            let postQuery = supabase
                .from("feed_posts")
                .select(`
                    id, content, image_url, created_at,
                    users!author_id(id, username, email, alumni(first_name, last_name))
                `)
                .eq("is_active", true)
                .ilike("content", `%${sanitizedSearch}%`);

            // Apply date filter
            postQuery = applyDateFilter(postQuery);

            // Apply sort
            if (sortBy === 'date') {
                postQuery = postQuery.order("created_at", { ascending: false });
            } else if (sortBy === 'popularity') {
                // Assuming there's a likes_count or similar field, adjust based on schema
                postQuery = postQuery.order("created_at", { ascending: false }); // Fallback
            } else {
                postQuery = postQuery.order("created_at", { ascending: false });
            }

            const { data: postData } = await postQuery.limit(Math.ceil(searchLimit * 0.3));

            if (postData) {
                postData.forEach(item => {
                    // Handle users as array (Supabase join returns array)
                    const user = Array.isArray(item.users) ? item.users[0] : item.users;
                    const alumni = Array.isArray(user?.alumni) ? user.alumni[0] : user?.alumni;
                    const authorName = (alumni?.first_name || alumni?.last_name)
                        ? `${alumni.first_name || ''} ${alumni.last_name || ''}`.trim()
                        : user?.username || user?.email?.split('@')[0] || 'Unknown';
                    const contentPreview = item.content.substring(0, 120) + (item.content.length > 120 ? '...' : '');

                    results.push({
                        id: item.id,
                        type: 'post',
                        title: `Post by ${authorName}`,
                        description: contentPreview,
                        image: item.image_url,
                        url: `/post/${item.id}`,
                        relevance: calculateRelevance(searchTerm, item.content),
                        createdAt: item.created_at || null
                    });
                });
            }
        }

        // 5. Search Forum Threads (if type is 'all' or 'forum')
        if (searchType === 'all' || searchType === 'forum') {
            const { data: forumData } = await supabase
                .from("forum_threads")
                .select(`
                    id, title, content, slug, created_at,
                    category:forum_categories!inner(name),
                    author:users!forum_threads_author_id_fkey(username)
                `)
                .eq("is_deleted", false)
                .or(`title.ilike.%${sanitizedSearch}%,content.ilike.%${sanitizedSearch}%`)
                .order("last_activity_at", { ascending: false })
                .limit(Math.ceil(searchLimit * 0.1));

            if (forumData) {
                forumData.forEach((item: any) => {
                    const category = Array.isArray(item.category) ? item.category[0] : item.category;
                    const contentPreview = (item.content || '').substring(0, 120) + ((item.content || '').length > 120 ? '...' : '');
                    const searchableText = `${item.title} ${item.content || ''}`;
                    results.push({
                        id: item.id,
                        type: 'forum',
                        title: item.title,
                        description: [contentPreview, category?.name ? `in ${category.name}` : null].filter(Boolean).join(' — '),
                        image: null,
                        url: `/forums/thread/${item.slug || item.id}`,
                        relevance: calculateRelevance(searchTerm, searchableText),
                        createdAt: item.created_at || null
                    });
                });
            }
        }

        // 6. Search Blog Posts (if type is 'all' or 'blog')
        if (searchType === 'all' || searchType === 'blog') {
            const { data: blogData } = await supabase
                .from("blog_posts")
                .select(`
                    id, title, slug, excerpt, cover_image, created_at,
                    category:blog_categories(name),
                    author:users!author_id(username, alumni(first_name, last_name))
                `)
                .eq("status", "published")
                .or(`title.ilike.%${sanitizedSearch}%,excerpt.ilike.%${sanitizedSearch}%,content.ilike.%${sanitizedSearch}%`)
                .order("published_at", { ascending: false })
                .limit(Math.ceil(searchLimit * 0.1));

            if (blogData) {
                blogData.forEach((item: any) => {
                    const category = Array.isArray(item.category) ? item.category[0] : item.category;
                    const author = Array.isArray(item.author) ? item.author[0] : item.author;
                    const alumni = Array.isArray(author?.alumni) ? author.alumni[0] : author?.alumni;
                    const authorName = alumni?.first_name
                        ? `${alumni.first_name} ${alumni.last_name || ''}`.trim()
                        : (author?.username || null);
                    const descParts = [
                        item.excerpt || null,
                        category?.name ? `in ${category.name}` : null,
                        authorName ? `by ${authorName}` : null
                    ].filter(Boolean);
                    results.push({
                        id: item.id,
                        type: 'blog',
                        title: item.title,
                        description: descParts.join(' • ') || '',
                        image: item.cover_image || null,
                        url: `/blogs/${item.slug}`,
                        relevance: calculateRelevance(searchTerm, `${item.title} ${item.excerpt || ''}`),
                        createdAt: item.created_at || null
                    });
                });
            }
        }

        // 7. Search Podcasts (if type is 'all' or 'podcast')
        if (searchType === 'all' || searchType === 'podcast') {
            const { data: podcastData } = await supabase
                .from("podcasts")
                .select("id, title, slug, description, created_at")
                .eq("status", "published")
                .or(`title.ilike.%${sanitizedSearch}%,description.ilike.%${sanitizedSearch}%,show_notes.ilike.%${sanitizedSearch}%`)
                .order("published_at", { ascending: false })
                .limit(Math.ceil(searchLimit * 0.05));

            if (podcastData) {
                podcastData.forEach((item: any) => {
                    const descPreview = (item.description || '').substring(0, 120) + ((item.description || '').length > 120 ? '...' : '');
                    results.push({
                        id: item.id,
                        type: 'podcast',
                        title: item.title,
                        description: descPreview,
                        image: null,
                        url: `/podcasts/${item.slug}`,
                        relevance: calculateRelevance(searchTerm, `${item.title} ${item.description || ''}`),
                        createdAt: item.created_at || null
                    });
                });
            }
        }

        // 8. Search Newsletters (if type is 'all' or 'newsletter')
        if (searchType === 'all' || searchType === 'newsletter') {
            const { data: newsletterData } = await supabase
                .from("newsletters")
                .select("id, title, slug, excerpt, cover_image, sent_at, created_at")
                .eq("status", "sent")
                .or(`title.ilike.%${sanitizedSearch}%,excerpt.ilike.%${sanitizedSearch}%`)
                .order("sent_at", { ascending: false })
                .limit(Math.ceil(searchLimit * 0.05));

            if (newsletterData) {
                newsletterData.forEach((item: any) => {
                    const sentDate = item.sent_at ? new Date(item.sent_at).toLocaleDateString() : '';
                    results.push({
                        id: item.id,
                        type: 'newsletter',
                        title: item.title,
                        description: [item.excerpt || null, sentDate ? `Sent ${sentDate}` : null].filter(Boolean).join(' • '),
                        image: item.cover_image || null,
                        url: `/newsletters/${item.slug}`,
                        relevance: calculateRelevance(searchTerm, `${item.title} ${item.excerpt || ''}`),
                        createdAt: item.sent_at || item.created_at || null
                    });
                });
            }
        }

        // 9. Search Travel Journal posts (if type is 'all' or 'travel')
        if (searchType === 'all' || searchType === 'travel') {
            const { data: travelData } = await supabase
                .from("travel_posts")
                .select("id, caption, city, country, created_at")
                .eq("is_hidden", false)
                .or(`caption.ilike.%${sanitizedSearch}%,city.ilike.%${sanitizedSearch}%,country.ilike.%${sanitizedSearch}%`)
                .order("created_at", { ascending: false })
                .limit(Math.ceil(searchLimit * 0.05));

            if (travelData) {
                travelData.forEach((item: any) => {
                    const location = [item.city, item.country].filter(Boolean).join(', ');
                    results.push({
                        id: item.id,
                        type: 'travel',
                        title: location || 'Travel Post',
                        description: item.caption ? item.caption.substring(0, 100) : location,
                        image: null,
                        url: `/travel-journal/${item.id}`,
                        relevance: calculateRelevance(searchTerm, `${item.city || ''} ${item.country || ''} ${item.caption || ''}`),
                        createdAt: item.created_at || null
                    });
                });
            }
        }

        // 10. Search Mentors (if type is 'all' or 'mentor')
        if (searchType === 'all' || searchType === 'mentor') {
            const { data: mentorData } = await supabase
                .from("alumni")
                .select(`
                    id, user_id, first_name, last_name, bio, profile_picture,
                    current_role, current_company, current_city, industry, batch,
                    expertise_areas, help_topics, created_at
                `)
                .eq("is_mentor", true)
                .eq("is_active", true)
                .or(`first_name.ilike.%${sanitizedSearch}%,last_name.ilike.%${sanitizedSearch}%,expertise_areas.ilike.%${sanitizedSearch}%,help_topics.ilike.%${sanitizedSearch}%,bio.ilike.%${sanitizedSearch}%,current_role.ilike.%${sanitizedSearch}%,current_company.ilike.%${sanitizedSearch}%`)
                .limit(Math.ceil(searchLimit * 0.1));

            if (mentorData) {
                mentorData.forEach((item: any) => {
                    // Skip if already in results as alumni (dedup handles it, but set type correctly)
                    const existing = results.find(r => r.type === 'alumni' && r.id === (item.user_id || item.id));
                    if (existing) {
                        // Upgrade existing alumni result to show mentor context
                        existing.type = 'mentor';
                        existing.description = [
                            item.current_role,
                            item.current_company,
                            item.expertise_areas ? `Expert in ${item.expertise_areas}` : null
                        ].filter(Boolean).join(' • ') || item.bio || 'Mentor';
                        return;
                    }
                    const searchableText = `${item.first_name} ${item.last_name} ${item.expertise_areas || ''} ${item.help_topics || ''} ${item.bio || ''} ${item.current_role || ''} ${item.current_company || ''}`;
                    results.push({
                        id: item.user_id || item.id,
                        type: 'mentor',
                        title: `${item.first_name || ''} ${item.last_name || ''}`.trim(),
                        description: [
                            item.current_role,
                            item.current_company,
                            item.expertise_areas ? `Expert in ${item.expertise_areas}` : null
                        ].filter(Boolean).join(' • ') || item.bio || 'Mentor',
                        image: item.profile_picture,
                        url: `/profile/${item.user_id || item.id}`,
                        relevance: calculateRelevance(searchTerm, searchableText),
                        createdAt: item.created_at || null
                    });
                });
            }
        }

        // Sort by relevance (highest first) and remove duplicates
        const seen = new Set<string>();
        let uniqueResults = results
            .filter(result => {
                const key = `${result.type}-${result.id}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });


        // Apply sorting
        if (sortBy === 'date') {
            uniqueResults = uniqueResults.sort((a, b) => {
                const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return dateB - dateA;
            });
        } else if (sortBy === 'popularity') {
            // Sort by relevance for now (can be enhanced with actual popularity metrics)
            uniqueResults = uniqueResults.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));
        } else {
            // Default: relevance
            uniqueResults = uniqueResults.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));
        }

        uniqueResults = uniqueResults.slice(0, searchLimit);

        // --- DATA ENRICHMENT (Connection Status, Job Status) ---
        const currentUserId = req.headers['user-id'] as string;

        if (currentUserId && uniqueResults.length > 0) {
            const alumniIds = uniqueResults.filter(r => r.type === 'alumni' || r.type === 'mentor').map(r => r.id);
            const jobIds = uniqueResults.filter(r => r.type === 'job').map(r => r.id);

            // 1. Get Connection Statuses
            const connectionMap: Record<string, { status: string, isRequester: boolean }> = {};
            if (alumniIds.length > 0) {
                const alumniIdList = alumniIds.join(',');
                const { data: connections } = await supabase
                    .from("connection_requests")
                    .select("requester_id, recipient_id, status")
                    .or(
                        `and(requester_id.eq.${currentUserId},recipient_id.in.(${alumniIdList})),` +
                        `and(recipient_id.eq.${currentUserId},requester_id.in.(${alumniIdList}))`
                    );

                if (connections) {
                    connections.forEach(conn => {
                        const otherId = conn.requester_id === currentUserId ? conn.recipient_id : conn.requester_id;
                        connectionMap[otherId] = {
                            status: conn.status,
                            isRequester: conn.requester_id === currentUserId
                        };
                    });
                }
            }

            // 2. Get Job Application Statuses
            const appliedJobs = new Set<string>();
            if (jobIds.length > 0) {
                const { data: applications } = await supabase
                    .from("job_applications")
                    .select("job_id")
                    .eq("user_id", currentUserId)
                    .in("job_id", jobIds);
                if (applications) {
                    applications.forEach(app => appliedJobs.add(app.job_id));
                }
            }

            // 3. Get Saved Jobs
            const savedJobs = new Set<string>();
            if (jobIds.length > 0) {
                const { data: saved } = await supabase
                    .from("saved_jobs")
                    .select("job_id")
                    .eq("user_id", currentUserId)
                    .in("job_id", jobIds);
                if (saved) {
                    saved.forEach(s => savedJobs.add(s.job_id));
                }
            }

            // Apply enrichment to results
            uniqueResults = uniqueResults.map(result => {
                if (result.type === 'alumni' || result.type === 'mentor') {
                    if (result.id === currentUserId) {
                        return { ...result, connectionStatus: 'self' };
                    }
                    const conn = connectionMap[result.id];
                    return {
                        ...result,
                        connectionStatus: conn?.status || 'none',
                        isRequester: conn?.isRequester || false
                    };
                }
                if (result.type === 'job') {
                    return {
                        ...result,
                        isApplied: appliedJobs.has(result.id),
                        isSaved: savedJobs.has(result.id)
                    };
                }
                return result;
            });
        // Remove self from alumni/mentor results — no actionable card to show
        uniqueResults = uniqueResults.filter(r =>
            (r.type !== 'alumni' && r.type !== 'mentor') || (r as any).connectionStatus !== 'self'
        );
        }

        // --- DID YOU MEAN? (Spell Check / Fuzzy Suggestion) ---
        let didYouMean = null;
        if (uniqueResults.length === 0 && rawSearchTerm && !rawSearchTerm.startsWith('>')) {
            // Try to find if there's a highly relevant but slightly different term
            const { data: suggestionData } = await supabase.rpc('search_alumni_fuzzy', {
                search_term: sanitizedSearch,
                result_limit: 1
            });

            if (suggestionData && suggestionData.length > 0) {
                const bestMatch = suggestionData[0];
                const firstName = bestMatch.first_name || '';
                const lastName = bestMatch.last_name || '';
                const matchName = `${firstName} ${lastName}`.trim();
                if (matchName && matchName.toLowerCase() !== sanitizedSearch.toLowerCase()) {
                    didYouMean = matchName;
                }
            }
        }

        res.json({
            results: uniqueResults,
            parsedQuery: parsed,
            didYouMean: didYouMean
        });
    } catch (error) {
        console.error("Global search error:", error);
        res.status(500).json({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) });
    }
});

/**
 * Suggestions endpoint for Predictive Typeahead
 */
router.get("/suggestions", async (req, res) => {
    try {
        const { q } = req.query;
        const query = (q as string)?.trim();

        if (!query || query.length < 2) {
            return res.json({ suggestions: [] });
        }

        // Search for alumni names, companies, and jobs
        const [alumniRes, jobRes] = await Promise.all([
            supabase.from('alumni')
                .select('first_name, last_name, current_company')
                .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,current_company.ilike.%${query}%`)
                .limit(5),
            supabase.from('jobs')
                .select('title, company')
                .or(`title.ilike.%${query}%,company.ilike.%${query}%`)
                .limit(5)
        ]);

        const suggestions: string[] = [];

        if (alumniRes.data) {
            alumniRes.data.forEach(a => {
                const fullName = `${a.first_name} ${a.last_name}`;
                if (fullName.toLowerCase().includes(query.toLowerCase())) {
                    suggestions.push(fullName);
                }
                if (a.current_company && a.current_company.toLowerCase().includes(query.toLowerCase())) {
                    suggestions.push(a.current_company);
                }
            });
        }

        if (jobRes.data) {
            jobRes.data.forEach(j => {
                suggestions.push(j.title);
                if (j.company && j.company.toLowerCase().includes(query.toLowerCase())) {
                    suggestions.push(j.company);
                }
            });
        }

        // Unique, top 8 suggestions
        const uniqueSuggestions = Array.from(new Set(suggestions))
            .filter(s => s.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 8);

        res.json({ suggestions: uniqueSuggestions });
    } catch (error) {
        console.error("Suggestions error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
