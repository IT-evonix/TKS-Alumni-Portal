import { useState, useEffect } from 'react';
import { formatTimeAgo } from '@/utils/time';

/**
 * Hook that returns a formatted relative time string that auto-updates every minute
 * @param timestamp - ISO timestamp string or Date object
 * @param updateInterval - Update interval in milliseconds (default: 60000 = 1 minute)
 * @returns Formatted time string that updates automatically
 */
export function useAutoUpdateTime(
    timestamp: string | Date | null | undefined,
    updateInterval: number = 60000
): string {
    const [formattedTime, setFormattedTime] = useState<string>(() => {
        if (!timestamp) return '';
        return formatTimeAgo(timestamp);
    });

    useEffect(() => {
        if (!timestamp) {
            setFormattedTime('');
            return;
        }

        // Update immediately
        setFormattedTime(formatTimeAgo(timestamp));

        // Set up interval for periodic updates
        const intervalId = setInterval(() => {
            setFormattedTime(formatTimeAgo(timestamp));
        }, updateInterval);

        // Cleanup on unmount or when timestamp changes
        return () => clearInterval(intervalId);
    }, [timestamp, updateInterval]);

    return formattedTime;
}

/**
 * Hook that listens for Socket.IO timestamp update events
 * Useful for real-time updates when content is modified by others
 */
export function useTimestampSync() {
    useEffect(() => {
        // Listen for custom timestamp sync events
        const handleTimestampUpdate = (event: CustomEvent) => {
            // Force re-render of components using timestamps
            window.dispatchEvent(new Event('timestamp-sync'));
        };

        window.addEventListener('timestamp-update' as any, handleTimestampUpdate);

        return () => {
            window.removeEventListener('timestamp-update' as any, handleTimestampUpdate);
        };
    }, []);
}
