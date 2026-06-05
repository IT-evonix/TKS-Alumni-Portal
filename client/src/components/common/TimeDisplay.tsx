import React, { useState, useEffect } from 'react';
import { useAutoUpdateTime } from '@/hooks/useAutoUpdateTime';
import { getUserTimezonePreference, formatTimeWithPreference, type TimeFormatOptions } from '@/utils/time';

interface TimeDisplayProps {
    timestamp: string | Date;
    className?: string;
    showTitle?: boolean;
    updateInterval?: number;
}

/**
 * Component that displays a timestamp with auto-updates and timezone preference support
 * Updates every minute by default and respects user's timezone preferences
 */
export const TimeDisplay: React.FC<TimeDisplayProps> = ({
    timestamp,
    className = '',
    showTitle = true,
    updateInterval = 60000, // 1 minute
}) => {
    const [preferences, setPreferences] = useState<TimeFormatOptions>(() => getUserTimezonePreference());

    // Listen for preference changes
    useEffect(() => {
        const handlePreferenceChange = (event: CustomEvent) => {
            setPreferences(event.detail);
        };

        window.addEventListener('timezone-preference-changed' as any, handlePreferenceChange);
        window.addEventListener('timestamp-sync' as any, () => {
            setPreferences(getUserTimezonePreference());
        });

        return () => {
            window.removeEventListener('timezone-preference-changed' as any, handlePreferenceChange);
            window.removeEventListener('timestamp-sync' as any, () => { });
        };
    }, []);

    // Auto-update the displayed time
    const displayTime = useAutoUpdateTime(timestamp, updateInterval);

    // Format with user preferences
    const formattedTime = formatTimeWithPreference(timestamp, preferences);

    // For title attribute, always show full date/time
    const fullDateTime = new Date(timestamp).toLocaleString();

    return (
        <span className={className} title={showTitle ? fullDateTime : undefined}>
            {formattedTime}
        </span>
    );
};

/**
 * Lightweight version that just uses the hook without preference support
 * Useful for simple relative time displays
 */
export const RelativeTime: React.FC<TimeDisplayProps> = ({
    timestamp,
    className = '',
    showTitle = true,
    updateInterval = 60000,
}) => {
    const displayTime = useAutoUpdateTime(timestamp, updateInterval);
    const fullDateTime = new Date(timestamp).toLocaleString();

    return (
        <span className={className} title={showTitle ? fullDateTime : undefined}>
            {displayTime}
        </span>
    );
};
