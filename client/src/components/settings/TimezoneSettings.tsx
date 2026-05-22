import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Clock, Globe, Loader2 } from "lucide-react";
import {
    getUserTimezonePreference,
    saveUserTimezonePreference,
    getTimezoneDisplay,
    type TimezonePreference,
    type TimeFormatOptions,
} from "@/utils/time";

const COMMON_TIMEZONES = [
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'Europe/London', label: 'London (GMT/BST)' },
    { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
    { value: 'Asia/Dubai', label: 'Dubai (GST)' },
    { value: 'Asia/Kolkata', label: 'India (IST)' },
    { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
    { value: 'Australia/Sydney', label: 'Sydney (AEDT/AEST)' },
];

export const TimezoneSettings = () => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [preferences, setPreferences] = useState<TimeFormatOptions>(() => getUserTimezonePreference());

    useEffect(() => {
        // Load preferences on mount
        const prefs = getUserTimezonePreference();
        setPreferences(prefs);
    }, []);

    const handleSave = async () => {
        setLoading(true);
        try {
            saveUserTimezonePreference(preferences);

            toast({
                title: "Preferences Saved",
                description: "Your timezone and time display preferences have been updated.",
            });

            // Force refresh of timestamps across the app
            window.dispatchEvent(new Event('timestamp-sync'));
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to save preferences",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleTimezoneChange = (value: TimezonePreference) => {
        setPreferences(prev => ({
            ...prev,
            timezone: value,
            // Reset custom timezone if switching away from custom
            customTimezone: value === 'custom' ? prev.customTimezone : undefined,
        }));
    };

    const handleFormatChange = (value: 'relative' | 'absolute' | 'both') => {
        setPreferences(prev => ({ ...prev, format: value }));
    };

    const handleCustomTimezoneChange = (value: string) => {
        setPreferences(prev => ({ ...prev, customTimezone: value }));
    };

    return (
        <Card>
            <CardHeader className="p-4 sm:p-6">
                <div className="flex items-center gap-2">
                    <Globe className="w-5 h-5 text-[#008060]" />
                    <CardTitle className="text-lg sm:text-xl">Time & Timezone Preferences</CardTitle>
                </div>
                <CardDescription>
                    Customize how dates and times are displayed throughout the portal
                </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-6">
                {/* Timezone Selection */}
                <div className="space-y-3">
                    <Label className="text-sm font-semibold">Timezone</Label>
                    <RadioGroup
                        value={preferences.timezone || 'local'}
                        onValueChange={(value) => handleTimezoneChange(value as TimezonePreference)}
                        className="space-y-3"
                    >
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="local" id="tz-local" />
                            <Label htmlFor="tz-local" className="font-normal cursor-pointer flex-1">
                                <div className="flex items-center justify-between">
                                    <span>Local Time</span>
                                    <span className="text-xs text-gray-500">{getTimezoneDisplay('local')}</span>
                                </div>
                            </Label>
                        </div>

                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="utc" id="tz-utc" />
                            <Label htmlFor="tz-utc" className="font-normal cursor-pointer flex-1">
                                <div className="flex items-center justify-between">
                                    <span>UTC (Coordinated Universal Time)</span>
                                    <span className="text-xs text-gray-500">UTC+00:00</span>
                                </div>
                            </Label>
                        </div>

                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="ist" id="tz-ist" />
                            <Label htmlFor="tz-ist" className="font-normal cursor-pointer flex-1">
                                <div className="flex items-center justify-between">
                                    <span>Indian Standard Time</span>
                                    <span className="text-xs text-gray-500">UTC+05:30</span>
                                </div>
                            </Label>
                        </div>

                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="custom" id="tz-custom" />
                            <Label htmlFor="tz-custom" className="font-normal cursor-pointer flex-1">
                                Custom Timezone
                            </Label>
                        </div>
                    </RadioGroup>

                    {preferences.timezone === 'custom' && (
                        <div className="ml-6 mt-2">
                            <Select
                                value={preferences.customTimezone}
                                onValueChange={handleCustomTimezoneChange}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select a timezone" />
                                </SelectTrigger>
                                <SelectContent>
                                    {COMMON_TIMEZONES.map((tz) => (
                                        <SelectItem key={tz.value} value={tz.value}>
                                            {tz.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>

                {/* Time Format Selection */}
                <div className="space-y-3">
                    <Label className="text-sm font-semibold">Time Display Format</Label>
                    <RadioGroup
                        value={preferences.format || 'relative'}
                        onValueChange={(value) => handleFormatChange(value as any)}
                        className="space-y-3"
                    >
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="relative" id="fmt-relative" />
                            <Label htmlFor="fmt-relative" className="font-normal cursor-pointer flex-1">
                                <div>
                                    <div>Relative Time</div>
                                    <div className="text-xs text-gray-500">e.g., "5 minutes ago", "2 hours ago"</div>
                                </div>
                            </Label>
                        </div>

                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="absolute" id="fmt-absolute" />
                            <Label htmlFor="fmt-absolute" className="font-normal cursor-pointer flex-1">
                                <div>
                                    <div>Absolute Time</div>
                                    <div className="text-xs text-gray-500">e.g., "Jan 9, 2026, 12:30 PM"</div>
                                </div>
                            </Label>
                        </div>

                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="both" id="fmt-both" />
                            <Label htmlFor="fmt-both" className="font-normal cursor-pointer flex-1">
                                <div>
                                    <div>Both</div>
                                    <div className="text-xs text-gray-500">e.g., "5 minutes ago (Jan 9, 2026, 12:30 PM)"</div>
                                </div>
                            </Label>
                        </div>
                    </RadioGroup>
                </div>

                {/* Preview */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                        <Clock className="w-4 h-4" />
                        Preview
                    </div>
                    <div className="text-sm text-gray-600">
                        Current time will be displayed as:{" "}
                        <span className="font-semibold text-gray-900">
                            {preferences.format === 'relative' && "just now"}
                            {preferences.format === 'absolute' && new Date().toLocaleString()}
                            {preferences.format === 'both' && `just now (${new Date().toLocaleString()})`}
                        </span>
                    </div>
                </div>

                {/* Save Button */}
                <Button
                    onClick={handleSave}
                    disabled={loading}
                    className="w-full sm:w-auto bg-[#008060] hover:bg-[#006b51]"
                >
                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Save Preferences
                </Button>
            </CardContent>
        </Card>
    );
};
