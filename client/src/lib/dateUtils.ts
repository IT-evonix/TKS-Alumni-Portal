export const ensureUTC = (dateString: string | Date): Date => {
    if (dateString instanceof Date) return dateString;

    // If string, check format
    // If string, check format
    let dateStr = String(dateString);

    // Handle space separator from postgres if present
    if (dateStr.includes(' ') && !dateStr.includes('T')) {
        dateStr = dateStr.replace(' ', 'T');
    }

    // Check if it has timezone info (Z, +HH:mm, -HH:mm)
    // We verify against specific patterns to avoid false negatives from date hyphens
    const hasTimezone = dateStr.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(dateStr);

    // If it's an ISO string without timezone, assume UTC
    if (dateStr.includes('T') && !hasTimezone) {
        return new Date(dateStr + 'Z');
    }

    return new Date(dateStr);
};

export const formatTimeAgo = (date: string | Date): string => {
    const posted = ensureUTC(date);
    const now = new Date();
    const diffMs = now.getTime() - posted.getTime();

    // Handle future dates (small clock skew)
    if (diffMs < 0) return "Just now";

    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffSeconds < 60) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${diffWeeks}w ago`;
    if (diffDays < 365) return `${diffMonths}mo ago`;
    return `${diffYears}y ago`;
};

export const formatDateTimeIST = (date: string | Date): string => {
    const d = ensureUTC(date);

    // Format to IST (UTC+5:30)
    return d.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
};

export const formatTimeIST = (date: string | Date): string => {
    const d = ensureUTC(date);
    return d.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
};

export const getDateSeparatorIST = (date: string | Date): string => {
    const d = ensureUTC(date);

    // Get components in IST
    const options: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'numeric', day: 'numeric' };
    const formatter = new Intl.DateTimeFormat('en-US', options);

    const targetParts = formatter.formatToParts(d);
    const nowParts = formatter.formatToParts(new Date());

    const getPart = (parts: Intl.DateTimeFormatPart[], type: string) => parts.find(p => p.type === type)?.value;

    const targetDateStr = `${getPart(targetParts, 'year')}-${getPart(targetParts, 'month')}-${getPart(targetParts, 'day')}`;
    const nowDateStr = `${getPart(nowParts, 'year')}-${getPart(nowParts, 'month')}-${getPart(nowParts, 'day')}`;

    if (targetDateStr === nowDateStr) return 'Today';

    const targetDateObj = new Date(targetDateStr);
    const nowDateObj = new Date(nowDateStr);
    const diffTime = nowDateObj.getTime() - targetDateObj.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);

    if (diffDays === 1) return 'Yesterday';

    return d.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        month: 'short',
        day: 'numeric',
        year: getPart(targetParts, 'year') !== getPart(nowParts, 'year') ? 'numeric' : undefined
    });
};

/**
 * Converts a UTC date string to IST datetime-local format (YYYY-MM-DDTHH:mm)
 * This is used for datetime-local inputs which expect IST time (since this is an Indian school portal)
 * @param dateString - UTC date string from database
 * @returns Formatted string for datetime-local input in IST timezone
 */
export const utcToLocalDatetimeLocal = (dateString: string | Date | null | undefined): string => {
    if (!dateString) return '';
    
    const date = ensureUTC(dateString);
    
    // Convert UTC to IST (Asia/Kolkata) for display in datetime-local input
    // Use Intl.DateTimeFormat to get IST components
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    
    // Format the date in IST
    const parts = formatter.formatToParts(date);
    const year = parts.find(p => p.type === 'year')?.value || '';
    const month = parts.find(p => p.type === 'month')?.value || '';
    const day = parts.find(p => p.type === 'day')?.value || '';
    const hour = parts.find(p => p.type === 'hour')?.value || '';
    const minute = parts.find(p => p.type === 'minute')?.value || '';
    
    // Return in datetime-local format (YYYY-MM-DDTHH:mm) in IST
    return `${year}-${month}-${day}T${hour}:${minute}`;
};
