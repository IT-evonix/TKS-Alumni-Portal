
/**
 * Enhanced NLP Search Parser for Alumni Portal
 * Features:
 * - Synonym detection and expansion
 * - Abbreviation expansion
 * - Natural date parsing
 * - Boolean operator support
 * - Contextual understanding
 */

interface ParsedQuery {
    intentType?: 'alumni' | 'job' | 'event' | 'post';
    filters: {
        location?: string;
        batch?: string;
        industry?: string;
        company?: string;
        dateRange?: string;
        query: string;
    };
    expandedQuery?: string; // Query with synonyms expanded
    booleanOperators?: {
        mustInclude: string[];
        shouldInclude: string[];
        mustExclude: string[];
    };
}

// Synonym mappings for better search coverage
const SYNONYMS: Record<string, string[]> = {
    'developer': ['engineer', 'programmer', 'coder', 'software engineer'],
    'engineer': ['developer', 'programmer', 'software engineer'],
    'job': ['opportunity', 'position', 'opening', 'role', 'career'],
    'event': ['meetup', 'conference', 'webinar', 'session', 'workshop'],
    'alumni': ['graduate', 'alumnus', 'alumna', 'former student'],
    'company': ['organization', 'firm', 'corporation', 'business'],
    'remote': ['work from home', 'wfh', 'telecommute'],
    'internship': ['intern', 'trainee position'],
    'senior': ['experienced', 'lead', 'principal'],
    'junior': ['entry level', 'associate', 'beginner'],
};

// Common abbreviations in tech/professional context
const ABBREVIATIONS: Record<string, string> = {
    'swe': 'software engineer',
    'sde': 'software development engineer',
    'pm': 'product manager',
    'ui': 'user interface',
    'ux': 'user experience',
    'ml': 'machine learning',
    'ai': 'artificial intelligence',
    'devops': 'development operations',
    'qa': 'quality assurance',
    'hr': 'human resources',
    'ceo': 'chief executive officer',
    'cto': 'chief technology officer',
    'cfo': 'chief financial officer',
    'vp': 'vice president',
    'sr': 'senior',
    'jr': 'junior',
    'mgr': 'manager',
    'eng': 'engineer',
    'dev': 'developer',
    'admin': 'administrator',
    'ops': 'operations',
    'tech': 'technology',
    'cs': 'computer science',
    'it': 'information technology',
    'saas': 'software as a service',
    'b2b': 'business to business',
    'b2c': 'business to consumer',
    'api': 'application programming interface',
    'sdk': 'software development kit',
    'ui/ux': 'user interface user experience',
    'full stack': 'full-stack',
    'frontend': 'front-end',
    'backend': 'back-end',
};

// Date parsing patterns
const DATE_PATTERNS = {
    'today': () => 'today',
    'yesterday': () => 'yesterday',
    'this week': () => 'week',
    'last week': () => 'week',
    'this month': () => 'month',
    'last month': () => 'month',
    'this year': () => 'year',
    'last year': () => 'year',
    'recent': () => 'month',
    'latest': () => 'week',
};

/**
 * Expand abbreviations in the query
 */
function expandAbbreviations(query: string): string {
    let expanded = query;

    // Sort by length (longest first) to avoid partial matches
    const sortedAbbrevs = Object.entries(ABBREVIATIONS)
        .sort(([a], [b]) => b.length - a.length);

    for (const [abbrev, full] of sortedAbbrevs) {
        // Match whole words only (case-insensitive)
        const regex = new RegExp(`\\b${abbrev}\\b`, 'gi');
        if (regex.test(expanded)) {
            expanded = expanded.replace(regex, full);
        }
    }

    return expanded;
}

/**
 * Expand synonyms to improve search coverage
 */
function expandSynonyms(query: string): string {
    const words = query.toLowerCase().split(/\s+/);
    const expandedTerms: Set<string> = new Set(words);

    for (const word of words) {
        // Check if word has synonyms
        for (const [key, synonyms] of Object.entries(SYNONYMS)) {
            if (word === key) {
                synonyms.forEach(syn => expandedTerms.add(syn));
            }
        }
    }

    return Array.from(expandedTerms).join(' ');
}

/**
 * Parse natural language dates
 */
function parseDateExpression(query: string): { dateRange?: string; cleanedQuery: string } {
    let cleanedQuery = query;
    let dateRange: string | undefined;

    for (const [pattern, getRangeValue] of Object.entries(DATE_PATTERNS)) {
        const regex = new RegExp(`\\b${pattern}\\b`, 'i');
        if (regex.test(query)) {
            dateRange = getRangeValue();
            cleanedQuery = cleanedQuery.replace(regex, '').trim();
            break;
        }
    }

    return { dateRange, cleanedQuery };
}

/**
 * Parse boolean operators (AND, OR, NOT)
 */
function parseBooleanOperators(query: string): {
    booleanOperators: NonNullable<ParsedQuery['booleanOperators']>;
    cleanedQuery: string;
} {
    const mustInclude: string[] = [];
    const shouldInclude: string[] = [];
    const mustExclude: string[] = [];

    let cleanedQuery = query;

    // Parse NOT operator (must exclude)
    const notMatches = query.match(/NOT\s+([^\s]+)/gi);
    if (notMatches) {
        notMatches.forEach(match => {
            const term = match.replace(/NOT\s+/i, '').trim();
            mustExclude.push(term);
            cleanedQuery = cleanedQuery.replace(match, '').trim();
        });
    }

    // Parse AND operator (must include)
    const andParts = cleanedQuery.split(/\s+AND\s+/i);
    if (andParts.length > 1) {
        andParts.forEach(part => {
            const trimmed = part.trim();
            if (trimmed) mustInclude.push(trimmed);
        });
        cleanedQuery = andParts.join(' ');
    }

    // Parse OR operator (should include)
    const orParts = cleanedQuery.split(/\s+OR\s+/i);
    if (orParts.length > 1) {
        orParts.forEach(part => {
            const trimmed = part.trim();
            if (trimmed) shouldInclude.push(trimmed);
        });
        cleanedQuery = orParts.join(' ');
    }

    // Parse quoted phrases (exact match)
    const quotedMatches = query.match(/"([^"]+)"/g);
    if (quotedMatches) {
        quotedMatches.forEach(match => {
            const phrase = match.replace(/"/g, '');
            mustInclude.push(phrase);
            cleanedQuery = cleanedQuery.replace(match, '').trim();
        });
    }

    return {
        booleanOperators: {
            mustInclude,
            shouldInclude,
            mustExclude
        },
        cleanedQuery
    };
}

export function parseSearchQuery(query: string): ParsedQuery {
    const originalQuery = query.trim();
    let processedQuery = originalQuery.toLowerCase();

    const filters: ParsedQuery['filters'] = {
        query: originalQuery
    };
    let intentType: ParsedQuery['intentType'] = undefined;

    // Step 1: Expand abbreviations
    processedQuery = expandAbbreviations(processedQuery);

    // Step 2: Parse boolean operators
    const { booleanOperators, cleanedQuery: booleanCleanedQuery } = parseBooleanOperators(processedQuery);
    processedQuery = booleanCleanedQuery;

    // Step 3: Parse date expressions
    const { dateRange, cleanedQuery: dateCleanedQuery } = parseDateExpression(processedQuery);
    if (dateRange) {
        filters.dateRange = dateRange;
    }
    processedQuery = dateCleanedQuery;

    // Step 4: Detect Intent Type (with expanded keywords)
    const alumniKeywords = ['alumni', 'people', 'students', 'seniors', 'batchmates', 'graduate', 'alumnus', 'alumna'];
    const jobKeywords = ['jobs', 'opportunities', 'hiring', 'openings', 'careers', 'engineer', 'developer', 'manager', 'position', 'role', 'software engineer'];
    const eventKeywords = ['events', 'meetups', 'webinars', 'reunions', 'sessions', 'conference', 'workshop'];
    const postKeywords = ['posts', 'feed', 'discussions', 'blogs'];

    if (alumniKeywords.some(kw => processedQuery.includes(kw))) intentType = 'alumni';
    else if (jobKeywords.some(kw => processedQuery.includes(kw))) intentType = 'job';
    else if (eventKeywords.some(kw => processedQuery.includes(kw))) intentType = 'event';
    else if (postKeywords.some(kw => processedQuery.includes(kw))) intentType = 'post';

    // Step 5: Extract Location
    const locationMatch = processedQuery.match(/\bin\s+([a-z\s]+?)(?=\s+from|\s+at|\s+batch|\s+jobs|\s+$)/i);
    if (locationMatch) {
        filters.location = locationMatch[1].trim();
        processedQuery = processedQuery.replace(locationMatch[0], '');
    }

    // Step 6: Extract Batch/Year
    const batchMatch = processedQuery.match(/\b(from|batch|class\s+of)\s+(\d{4})/i);
    if (batchMatch) {
        filters.batch = batchMatch[2];
        processedQuery = processedQuery.replace(batchMatch[0], '');
    }

    // Step 7: Extract Company
    const companyMatch = processedQuery.match(/\b(at|in|with|working\s+at)\s+([a-z\s]+?)(?=\s+in|\s+from|\s+batch|\s+$)/i);
    if (companyMatch && !filters.location) {
        filters.company = companyMatch[2].trim();
        processedQuery = processedQuery.replace(companyMatch[0], '');
    }

    // Step 8: Extract Industry
    const industryKeywords = ['finance', 'healthcare', 'technology', 'education', 'retail', 'manufacturing', 'consulting'];
    for (const industry of industryKeywords) {
        if (processedQuery.includes(industry)) {
            filters.industry = industry;
            break;
        }
    }

    // Step 9: Clean up the remaining query
    [...alumniKeywords, ...jobKeywords, ...eventKeywords, ...postKeywords].forEach(kw => {
        processedQuery = processedQuery.replace(new RegExp(`\\b${kw}\\b`, 'g'), '');
    });

    filters.query = processedQuery.trim().replace(/\s+/g, ' ');

    // If query became empty, use original
    if (!filters.query && originalQuery) {
        filters.query = originalQuery;
    }

    // Step 10: Generate expanded query with synonyms
    const expandedQuery = expandSynonyms(filters.query);

    return {
        intentType,
        filters,
        expandedQuery,
        booleanOperators: booleanOperators.mustInclude.length > 0 ||
            booleanOperators.shouldInclude.length > 0 ||
            booleanOperators.mustExclude.length > 0
            ? booleanOperators
            : undefined
    };
}
