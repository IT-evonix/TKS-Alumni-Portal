/**
 * Time Utility Functions
 * Handles timezone-aware date formatting and relative time calculations
 * 
 * All timestamps from the database should be in UTC (ISO 8601 format)
 * This utility ensures consistent handling across different timezones
 */

/**
 * Format a timestamp as relative time (e.g., "5m ago", "2h ago")
 * @param dateString - ISO 8601 timestamp string from database (UTC)
 * @returns Human-readable relative time string
 */
export function formatTimeAgo(dateString: string | Date): string {
    if (!dateString) return "Unknown";

    try {
        // Parse the date - handles both ISO strings and Date objects
        let date: Date;

        if (typeof dateString === 'string') {
            // Ensure the string is treated as UTC
            // If it doesn't have a timezone indicator, add 'Z' to force UTC interpretation
            const normalizedDateString = dateString.includes('Z') || dateString.includes('+') || dateString.includes('T') && dateString.split('T')[1].includes('-')
                ? dateString
                : dateString.includes('T')
                    ? `${dateString}Z`
                    : new Date(dateString).toISOString();

            date = new Date(normalizedDateString);
        } else {
            date = dateString;
        }

        // Validate the date
        if (isNaN(date.getTime())) {
            console.warn('Invalid date string:', dateString);
            return "Invalid date";
        }

        // Get current time in UTC (this is always correct)
        const now = new Date();

        // Calculate difference in milliseconds
        // Both dates are now properly in UTC, so the difference is accurate
        const diffMs = now.getTime() - date.getTime();
        const seconds = Math.floor(diffMs / 1000);

        // Handle future dates (clock skew or incorrect data)
        if (seconds < -10) { // Allow 10 second tolerance for clock skew
            console.warn('Future timestamp detected:', dateString, 'Difference:', seconds, 'seconds');
            return "just now";
        }

        // Format based on time difference
        if (seconds < 10) return "just now";
        if (seconds < 60) return `${seconds}s ago`;

        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;

        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;

        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d ago`;

        const weeks = Math.floor(days / 7);
        if (weeks < 4) return `${weeks}w ago`;

        // For older dates, show the actual date
        return formatDate(date);
    } catch (error) {
        console.error('Error formatting time ago:', error, dateString);
        return "Unknown";
    }
}

/**
 * Format a date as a localized string
 * @param date - Date object or ISO string
 * @param options - Intl.DateTimeFormat options
 * @returns Formatted date string
 */
export function formatDate(
    date: string | Date,
    options?: Intl.DateTimeFormatOptions
): string {
    try {
        const dateObj = typeof date === 'string' ? new Date(date) : date;

        if (isNaN(dateObj.getTime())) {
            return "Invalid date";
        }

        const defaultOptions: Intl.DateTimeFormatOptions = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            ...options,
        };

        return new Intl.DateTimeFormat('en-US', defaultOptions).format(dateObj);
    } catch (error) {
        console.error('Error formatting date:', error);
        return "Unknown";
    }
}

/**
 * Format a date and time as a localized string
 * @param date - Date object or ISO string
 * @returns Formatted date and time string
 */
export function formatDateTime(date: string | Date): string {
    return formatDate(date, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/**
 * Get the current UTC timestamp as an ISO string
 * Use this when creating new records to ensure consistency
 * @returns ISO 8601 timestamp string
 */
export function getCurrentUTCTimestamp(): string {
    return new Date().toISOString();
}

/**
 * Check if a timestamp is within a certain time window
 * @param timestamp - ISO timestamp string
 * @param windowMs - Time window in milliseconds
 * @returns true if timestamp is within the window
 */
export function isWithinTimeWindow(timestamp: string | Date, windowMs: number): boolean {
    try {
        const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        return diff >= 0 && diff <= windowMs;
    } catch (error) {
        console.error('Error checking time window:', error);
        return false;
    }
}

/**
 * Format a duration in milliseconds to human-readable format
 * @param ms - Duration in milliseconds
 * @returns Formatted duration string
 */
export function formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

/**
 * Timezone preference type
 */
export type TimezonePreference = 'local' | 'utc' | 'ist' | 'custom';

export interface TimeFormatOptions {
    timezone?: TimezonePreference;
    customTimezone?: string; // IANA timezone string like 'America/New_York'
    format?: 'relative' | 'absolute' | 'both';
    includeSeconds?: boolean;
}

/**
 * Get timezone offset string for display
 */
export function getTimezoneDisplay(preference: TimezonePreference, customTimezone?: string): string {
    switch (preference) {
        case 'utc':
            return 'UTC';
        case 'ist':
            return 'IST (UTC+5:30)';
        case 'custom':
            return customTimezone || 'Local';
        case 'local':
        default: {
            const offset = -new Date().getTimezoneOffset();
            const hours = Math.floor(Math.abs(offset) / 60);
            const minutes = Math.abs(offset) % 60;
            const sign = offset >= 0 ? '+' : '-';
            return `UTC${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        }
    }
}

/**
 * Format time with timezone preference
 * @param date - Date to format
 * @param options - Formatting options including timezone preference
 * @returns Formatted time string
 */
export function formatTimeWithPreference(
    date: string | Date,
    options: TimeFormatOptions = {}
): string {
    const {
        timezone = 'local',
        format = 'relative',
        includeSeconds = false,
    } = options;

    try {
        const dateObj = typeof date === 'string' ? new Date(date) : date;

        if (isNaN(dateObj.getTime())) {
            return "Invalid date";
        }

        // For relative format, always use local time for calculation
        if (format === 'relative') {
            return formatTimeAgo(dateObj);
        }

        // For absolute format, respect timezone preference
        const displayDate = dateObj;

        if (timezone === 'utc') {
            // Display in UTC
            const utcString = dateObj.toISOString();
            return formatDateTime(utcString) + ' UTC';
        } else if (timezone === 'ist') {
            // Display in IST (UTC+5:30)
            const istOffset = 5.5 * 60 * 60 * 1000;
            const istTime = new Date(dateObj.getTime() + istOffset);
            return formatDateTime(istTime) + ' IST';
        } else if (timezone === 'custom' && options.customTimezone) {
            // Use Intl.DateTimeFormat for custom timezone
            return new Intl.DateTimeFormat('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: includeSeconds ? '2-digit' : undefined,
                timeZone: options.customTimezone,
                timeZoneName: 'short',
            }).format(displayDate);
        }

        // Default: local timezone
        if (format === 'both') {
            return `${formatTimeAgo(dateObj)} (${formatDateTime(dateObj)})`;
        }

        return formatDateTime(dateObj);
    } catch (error) {
        console.error('Error formatting time with preference:', error);
        return "Unknown";
    }
}

/**
 * Server-side safe timestamp formatting
 * Returns ISO string on server, formatted string on client
 * @param timestamp - ISO timestamp
 * @param options - Format options
 * @returns Formatted timestamp or ISO string
 */
export function formatTimestampSSR(
    timestamp: string | Date,
    options: TimeFormatOptions = {}
): string {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
        // Server-side: return ISO string for hydration
        const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
        return date.toISOString();
    }

    // Client-side: return formatted string
    return formatTimeWithPreference(timestamp, options);
}

/**
 * Get user's timezone preference from localStorage
 */
export function getUserTimezonePreference(): TimeFormatOptions {
    if (typeof window === 'undefined') {
        return { timezone: 'ist', format: 'relative' }; // Default to IST for server-side
    }

    try {
        const stored = localStorage.getItem('timezone-preference');
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (error) {
        console.error('Error reading timezone preference:', error);
    }

    // Default to IST (Indian Standard Time) for Indian users
    return { timezone: 'ist', format: 'relative' };
}

/**
 * Save user's timezone preference to localStorage
 */
export function saveUserTimezonePreference(options: TimeFormatOptions): void {
    if (typeof window === 'undefined') return;

    try {
        localStorage.setItem('timezone-preference', JSON.stringify(options));
        // Dispatch event to notify components of preference change
        window.dispatchEvent(new CustomEvent('timezone-preference-changed', { detail: options }));
    } catch (error) {
        console.error('Error saving timezone preference:', error);
    }
}
