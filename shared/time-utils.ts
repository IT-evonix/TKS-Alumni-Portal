/**
 * Shared Time Utilities
 * Can be used on both client and server
 */

/**
 * Get the current UTC timestamp as an ISO string
 * Use this when creating new records to ensure consistency
 * @returns ISO 8601 timestamp string
 */
export function getCurrentUTCTimestamp(): string {
    return new Date().toISOString();
}

/**
 * Check if a timestamp is valid
 * @param timestamp - ISO timestamp string or Date
 * @returns true if valid
 */
export function isValidTimestamp(timestamp: string | Date): boolean {
    try {
        const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
        return !isNaN(date.getTime());
    } catch {
        return false;
    }
}

/**
 * Convert a timestamp to UTC ISO string
 * @param timestamp - Any valid timestamp format
 * @returns ISO 8601 UTC string
 */
export function toUTCString(timestamp: string | Date | number): string {
    try {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) {
            throw new Error('Invalid timestamp');
        }
        return date.toISOString();
    } catch (error) {
        console.error('Error converting to UTC string:', error);
        return new Date().toISOString(); // Fallback to current time
    }
}

/**
 * Add time to a timestamp
 * @param timestamp - Base timestamp
 * @param milliseconds - Milliseconds to add
 * @returns New ISO timestamp
 */
export function addTime(timestamp: string | Date, milliseconds: number): string {
    const date = new Date(timestamp);
    date.setTime(date.getTime() + milliseconds);
    return date.toISOString();
}

/**
 * Subtract time from a timestamp
 * @param timestamp - Base timestamp
 * @param milliseconds - Milliseconds to subtract
 * @returns New ISO timestamp
 */
export function subtractTime(timestamp: string | Date, milliseconds: number): string {
    return addTime(timestamp, -milliseconds);
}

/**
 * Check if a timestamp is expired
 * @param timestamp - Timestamp to check
 * @param now - Current time (defaults to now)
 * @returns true if expired
 */
export function isExpired(timestamp: string | Date, now: Date = new Date()): boolean {
    const date = new Date(timestamp);
    return date.getTime() < now.getTime();
}

/**
 * Get time difference in milliseconds
 * @param start - Start timestamp
 * @param end - End timestamp (defaults to now)
 * @returns Difference in milliseconds
 */
export function getTimeDifference(start: string | Date, end: string | Date = new Date()): number {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return endDate.getTime() - startDate.getTime();
}

/**
 * Common time constants in milliseconds
 */
export const TIME_CONSTANTS = {
    SECOND: 1000,
    MINUTE: 60 * 1000,
    HOUR: 60 * 60 * 1000,
    DAY: 24 * 60 * 60 * 1000,
    WEEK: 7 * 24 * 60 * 60 * 1000,
    MONTH: 30 * 24 * 60 * 60 * 1000, // Approximate
    YEAR: 365 * 24 * 60 * 60 * 1000, // Approximate
} as const;
