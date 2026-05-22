/**
 * Timestamp Debugging Utility
 * Use this to diagnose timestamp issues
 */

export function debugTimestamp(timestamp: string | Date, label: string = 'Timestamp'): void {
    console.group(`🕐 ${label} Debug`);

    try {
        const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
        const now = new Date();

        console.log('Original value:', timestamp);
        console.log('Parsed as Date:', date);
        console.log('ISO String:', date.toISOString());
        console.log('Local String:', date.toLocaleString());
        console.log('UTC String:', date.toUTCString());
        console.log('Timestamp (ms):', date.getTime());
        console.log('Current time (ms):', now.getTime());
        console.log('Difference (ms):', now.getTime() - date.getTime());
        console.log('Difference (seconds):', Math.floor((now.getTime() - date.getTime()) / 1000));
        console.log('Difference (minutes):', Math.floor((now.getTime() - date.getTime()) / 60000));
        console.log('Difference (hours):', Math.floor((now.getTime() - date.getTime()) / 3600000));

        // Check timezone offset
        const offset = date.getTimezoneOffset();
        console.log('Timezone offset (minutes):', offset);
        console.log('Timezone offset (hours):', offset / 60);

        // IST offset check
        const istOffset = -330; // IST is UTC+5:30 = -330 minutes
        console.log('IST offset (minutes):', istOffset);
        console.log('Is IST?:', offset === istOffset);

    } catch (error) {
        console.error('Error debugging timestamp:', error);
    }

    console.groupEnd();
}

/**
 * Test timestamp formatting
 */
export function testTimestampFormatting(): void {
    console.group('🧪 Timestamp Formatting Test');

    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000);
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    console.log('Now:', now.toISOString());
    console.log('5 minutes ago:', fiveMinutesAgo.toISOString());
    console.log('5 hours ago:', fiveHoursAgo.toISOString());
    console.log('Yesterday:', yesterday.toISOString());

    console.groupEnd();
}

// Make available globally for debugging
// Make available globally for debugging
interface CustomWindow extends Window {
    debugTimestamp?: typeof debugTimestamp;
    testTimestampFormatting?: typeof testTimestampFormatting;
}

if (typeof window !== 'undefined') {
    (window as unknown as CustomWindow).debugTimestamp = debugTimestamp;
    (window as unknown as CustomWindow).testTimestampFormatting = testTimestampFormatting;
}
