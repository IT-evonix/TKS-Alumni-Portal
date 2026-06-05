
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Activity, UserPlus, UserCheck, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface ActivityMetrics {
    newMonth: number;
    activeMonth: number;
    newToday: number;
    activeToday: number;
    newWeek: number;
    activeWeek: number;
}

interface ProfileStats {
    complete: number;
    partial: number;
    incomplete: number;
}

interface AdminStatsCardsProps {
    users: any[];
    totalUsers: number;
    adminCount?: number;
    signupRequests: any[];
    totalSignupRequests?: number;
    activityMetrics: ActivityMetrics;
    profileStats: ProfileStats;
}

// ── Animated counter ─────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 900) {
    const [count, setCount] = useState(0);
    const raf = useRef<number>(0);
    useEffect(() => {
        if (target === 0) { setCount(0); return; }
        const start = performance.now();
        const tick = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.round(eased * target));
            if (progress < 1) raf.current = requestAnimationFrame(tick);
        };
        raf.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf.current);
    }, [target, duration]);
    return count;
}

// ── Sparkline (tiny inline SVG line) ────────────────────────────────────────
function Sparkline({ values, color }: { values: number[]; color: string }) {
    if (!values || values.length < 2) return null;
    const max = Math.max(...values, 1);
    const w = 64; const h = 28;
    const pts = values.map((v, i) => {
        const x = (i / (values.length - 1)) * w;
        const y = h - (v / max) * h;
        return `${x},${y}`;
    }).join(" ");
    return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" className="opacity-60">
            <polyline points={pts} stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
    );
}

// ── Trend badge ──────────────────────────────────────────────────────────────
function TrendBadge({ value }: { value: number }) {
    if (value > 0) return (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
            <TrendingUp className="w-2.5 h-2.5" />+{value}
        </span>
    );
    if (value < 0) return (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full">
            <TrendingDown className="w-2.5 h-2.5" />{value}
        </span>
    );
    return (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-full">
            <Minus className="w-2.5 h-2.5" />0
        </span>
    );
}

// ── Hover tooltip ─────────────────────────────────────────────────────────────
function HoverTooltip({ children, tip }: { children: React.ReactNode; tip: React.ReactNode }) {
    const [show, setShow] = useState(false);
    return (
        <div className="relative" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
            {children}
            {show && (
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 min-w-[180px] bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl pointer-events-none">
                    {tip}
                    <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900" />
                </div>
            )}
        </div>
    );
}

export function AdminStatsCards({
    users, totalUsers, adminCount, signupRequests, totalSignupRequests, activityMetrics, profileStats
}: AdminStatsCardsProps) {
    const effectiveTotalUsers = totalUsers > 0 ? totalUsers : (users?.length || 0);
    const effectiveAdminCount = adminCount !== undefined ? adminCount : (users ? users.filter(u => u.is_admin).length : 0);
    const pendingCount = totalSignupRequests !== undefined ? totalSignupRequests : (signupRequests?.length || 0);

    const engagementRate = effectiveTotalUsers > 0
        ? Math.round(((activityMetrics?.activeMonth || 0) / effectiveTotalUsers) * 100)
        : 0;

    const profileTotal = (profileStats?.complete || 0) + (profileStats?.partial || 0) + (profileStats?.incomplete || 0);
    const completePct = profileTotal > 0 ? Math.round((profileStats?.complete / profileTotal) * 100) : 0;

    // Animated values
    const animTotal   = useCountUp(effectiveTotalUsers);
    const animActive  = useCountUp(activityMetrics?.activeMonth || 0);
    const animPending = useCountUp(pendingCount);
    const animAdmins  = useCountUp(effectiveAdminCount);

    // Sparkline data: week breakdown [today, week, month] scaled to week
    const activitySparkline = [
        activityMetrics?.newToday || 0,
        activityMetrics?.newWeek  || 0,
        activityMetrics?.newMonth || 0,
    ];

    return (
        <div className="space-y-4">
            {/* ── Top KPI row ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">

                {/* Total Users */}
                <HoverTooltip tip={
                    <div className="space-y-1">
                        <p className="font-semibold">Total Users breakdown</p>
                        <p>New today: <span className="text-emerald-300">+{activityMetrics?.newToday || 0}</span></p>
                        <p>New this week: <span className="text-emerald-300">+{activityMetrics?.newWeek || 0}</span></p>
                        <p>New this month: <span className="text-emerald-300">+{activityMetrics?.newMonth || 0}</span></p>
                    </div>
                }>
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-white hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-default">
                        <CardHeader className="pb-2 p-4">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-xs font-bold uppercase tracking-wider text-gray-500">Total Users</CardTitle>
                                <div className="p-2 bg-blue-100 rounded-lg">
                                    <Users className="w-4 h-4 text-blue-600" />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <div className="flex items-end justify-between">
                                <div className="text-2xl font-black text-gray-900 tabular-nums">{animTotal.toLocaleString()}</div>
                                <Sparkline values={activitySparkline} color="#3b82f6" />
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                <TrendBadge value={activityMetrics?.newMonth || 0} />
                                <span className="text-[10px] text-gray-400">this month</span>
                            </div>
                        </CardContent>
                    </Card>
                </HoverTooltip>

                {/* Active Users */}
                <HoverTooltip tip={
                    <div className="space-y-1">
                        <p className="font-semibold">Activity (updated_at)</p>
                        <p>Today: <span className="text-emerald-300">{activityMetrics?.activeToday || 0}</span></p>
                        <p>This week: <span className="text-emerald-300">{activityMetrics?.activeWeek || 0}</span></p>
                        <p>This month: <span className="text-emerald-300">{activityMetrics?.activeMonth || 0}</span></p>
                        <p className="text-gray-400 text-[10px] pt-1">Engagement: {engagementRate}%</p>
                    </div>
                }>
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-white hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-default">
                        <CardHeader className="pb-2 p-4">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-xs font-bold uppercase tracking-wider text-gray-500">Active Users</CardTitle>
                                <div className="p-2 bg-green-100 rounded-lg">
                                    <Activity className="w-4 h-4 text-green-600" />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <div className="flex items-end justify-between">
                                <div className="text-2xl font-black text-gray-900 tabular-nums">{animActive.toLocaleString()}</div>
                                <Sparkline values={[activityMetrics?.activeToday || 0, activityMetrics?.activeWeek || 0, activityMetrics?.activeMonth || 0]} color="#22c55e" />
                            </div>
                            <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-[10px] font-bold text-green-600">{engagementRate}%</span>
                                <span className="text-[10px] text-gray-400">engagement · 30 days</span>
                            </div>
                        </CardContent>
                    </Card>
                </HoverTooltip>

                {/* Pending Requests */}
                <HoverTooltip tip={
                    <div>
                        <p className="font-semibold">Signup requests</p>
                        <p className="text-gray-300 mt-1">{pendingCount} request{pendingCount !== 1 ? "s" : ""} awaiting approval</p>
                    </div>
                }>
                    <Card className={`border-0 shadow-lg bg-gradient-to-br from-purple-50 to-white hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-default ${pendingCount > 0 ? "ring-2 ring-purple-300 ring-offset-1" : ""}`}>
                        <CardHeader className="pb-2 p-4">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-xs font-bold uppercase tracking-wider text-gray-500">Pending Requests</CardTitle>
                                <div className={`p-2 rounded-lg ${pendingCount > 0 ? "bg-purple-200 animate-pulse" : "bg-purple-100"}`}>
                                    <UserPlus className="w-4 h-4 text-purple-600" />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <div className="text-2xl font-black text-gray-900 tabular-nums">{animPending.toLocaleString()}</div>
                            <p className="text-[10px] text-gray-400 mt-1 font-medium">
                                {pendingCount > 0 ? "⚡ Action required" : "All clear"}
                            </p>
                        </CardContent>
                    </Card>
                </HoverTooltip>

                {/* Administrators */}
                <HoverTooltip tip={
                    <div>
                        <p className="font-semibold">System admins</p>
                        <p className="text-gray-300 mt-1">{effectiveAdminCount} user{effectiveAdminCount !== 1 ? "s" : ""} with is_admin = true</p>
                        <p className="text-gray-400 text-[10px] mt-1">Counted across all users (not paginated)</p>
                    </div>
                }>
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-50 to-white hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-default">
                        <CardHeader className="pb-2 p-4">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-xs font-bold uppercase tracking-wider text-gray-500">Administrators</CardTitle>
                                <div className="p-2 bg-orange-100 rounded-lg">
                                    <UserCheck className="w-4 h-4 text-orange-600" />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <div className="text-2xl font-black text-gray-900 tabular-nums">{animAdmins.toLocaleString()}</div>
                            <p className="text-[10px] text-gray-400 mt-1 font-medium">System admins</p>
                        </CardContent>
                    </Card>
                </HoverTooltip>
            </div>

            {/* ── Quick Stats row ── */}
            <div className="grid md:grid-cols-4 gap-4">

                {/* Today's Activity */}
                <Card className="border-0 shadow-md bg-white hover:shadow-lg transition-all border-l-4 border-indigo-500 group">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold text-gray-700">Today's Activity</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-500">New Users</span>
                            <span className="text-lg font-bold text-indigo-600 tabular-nums">{activityMetrics?.newToday || 0}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-500">Active</span>
                            <span className="text-lg font-bold text-indigo-600 tabular-nums">{activityMetrics?.activeToday || 0}</span>
                        </div>
                        <div className="w-full h-1 bg-indigo-100 rounded-full overflow-hidden mt-1">
                            <div
                                className="h-1 bg-indigo-400 rounded-full transition-all duration-700"
                                style={{ width: effectiveTotalUsers > 0 ? `${Math.min(Math.round(((activityMetrics?.activeToday || 0) / effectiveTotalUsers) * 100), 100)}%` : "0%" }}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* This Week */}
                <Card className="border-0 shadow-md bg-white hover:shadow-lg transition-all border-l-4 border-teal-500">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold text-gray-700">This Week</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-500">New Users</span>
                            <span className="text-lg font-bold text-teal-600 tabular-nums">{activityMetrics?.newWeek || 0}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-500">Active Users</span>
                            <span className="text-lg font-bold text-teal-600 tabular-nums">{activityMetrics?.activeWeek || 0}</span>
                        </div>
                        <div className="w-full h-1 bg-teal-100 rounded-full overflow-hidden mt-1">
                            <div
                                className="h-1 bg-teal-400 rounded-full transition-all duration-700"
                                style={{ width: effectiveTotalUsers > 0 ? `${Math.min(Math.round(((activityMetrics?.activeWeek || 0) / effectiveTotalUsers) * 100), 100)}%` : "0%" }}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Engagement Rate */}
                <Card className="border-0 shadow-md bg-white hover:shadow-lg transition-all border-l-4 border-amber-500">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold text-gray-700">Engagement Rate</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="flex items-end gap-2">
                            <span className="text-3xl font-black text-amber-600 tabular-nums">{engagementRate}%</span>
                            <span className="text-xs text-gray-400 mb-1">monthly active</span>
                        </div>
                        <div className="relative w-full bg-amber-100 rounded-full h-2 overflow-hidden">
                            <div
                                className="bg-gradient-to-r from-amber-400 to-amber-500 h-2 rounded-full transition-all duration-700"
                                style={{ width: `${Math.min(engagementRate, 100)}%` }}
                            />
                        </div>
                        <p className="text-[10px] text-gray-400">
                            {activityMetrics?.activeMonth || 0} of {effectiveTotalUsers.toLocaleString()} users active
                        </p>
                    </CardContent>
                </Card>

                {/* Profile Completion */}
                <Card className="border-0 shadow-md bg-white hover:shadow-lg transition-all border-l-4 border-emerald-500">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold text-gray-700">Profile Completion</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-500">Complete</span>
                            <div className="flex items-center gap-1.5">
                                <span className="text-sm font-bold text-emerald-600 tabular-nums">{profileStats?.complete || 0}</span>
                                <span className="text-[10px] text-gray-400">({completePct}%)</span>
                            </div>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-500">Partial</span>
                            <div className="flex items-center gap-1.5">
                                <span className="text-sm font-bold text-amber-500 tabular-nums">{profileStats?.partial || 0}</span>
                                <span className="text-[10px] text-gray-400">({profileTotal > 0 ? Math.round((profileStats?.partial / profileTotal) * 100) : 0}%)</span>
                            </div>
                        </div>
                        <div className="flex h-2 mt-1 rounded-full overflow-hidden bg-gray-100">
                            <div className="bg-emerald-500 transition-all duration-700" style={{ width: `${(profileStats?.complete / (profileTotal || 1)) * 100}%` }} />
                            <div className="bg-amber-400 transition-all duration-700"  style={{ width: `${(profileStats?.partial  / (profileTotal || 1)) * 100}%` }} />
                            <div className="bg-red-300 transition-all duration-700"    style={{ width: `${(profileStats?.incomplete / (profileTotal || 1)) * 100}%` }} />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
