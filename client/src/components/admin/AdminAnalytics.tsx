
import React, { useState, useEffect, useRef } from "react";
import {
    ComposedChart,
    Bar,
    Line,
    Cell,
    LabelList,
    BarChart,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartInfoButton } from "@/components/admin/ChartInfoButton";
import { TrendingUp, Users, UserCheck } from "lucide-react";

interface AdminAnalyticsProps {
    analytics: {
        userGrowth: any[];
        roleDistribution: any[];
        profileCompletionData: any[];
        profileStats: any;
        totalUsers?: number;
    };
    loadingAnalytics: boolean;
}

const Spinner = () => (
    <div className="h-64 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-[#008060]/30 border-t-[#008060] rounded-full animate-spin" />
    </div>
);

const tooltipStyle = {
    backgroundColor: "#fff",
    borderRadius: "10px",
    border: "1px solid #e2e8f0",
    boxShadow: "0 8px 24px -4px rgb(0 0 0 / 0.12)",
    color: "#1e293b",
    fontSize: 13,
    padding: "10px 14px",
};

// ── Animated counter hook ────────────────────────────────────────────────────
function useCountUp(target: number, duration = 900) {
    const [count, setCount] = useState(0);
    const raf = useRef<number>(0);
    useEffect(() => {
        if (target === 0) { setCount(0); return; }
        const start = performance.now();
        const tick = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
            setCount(Math.round(eased * target));
            if (progress < 1) raf.current = requestAnimationFrame(tick);
        };
        raf.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf.current);
    }, [target, duration]);
    return count;
}

// ── Custom tooltip for Growth chart ─────────────────────────────────────────
const GrowthTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const newU = payload.find((p: any) => p.dataKey === "newUsers");
    const totU = payload.find((p: any) => p.dataKey === "totalUsers");
    return (
        <div style={tooltipStyle} className="min-w-[160px]">
            <p className="font-semibold text-gray-700 mb-2 border-b pb-1">{label}</p>
            {newU && (
                <div className="flex justify-between gap-4">
                    <span className="text-gray-500">New</span>
                    <span className="font-bold text-[#008060]">+{newU.value.toLocaleString()}</span>
                </div>
            )}
            {totU && (
                <div className="flex justify-between gap-4 mt-1">
                    <span className="text-gray-500">Total</span>
                    <span className="font-bold text-indigo-600">{totU.value.toLocaleString()}</span>
                </div>
            )}
        </div>
    );
};

// ── Custom tooltip for Role chart ────────────────────────────────────────────
const RoleTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
        <div style={tooltipStyle}>
            <p className="font-semibold mb-1" style={{ color: d.fill }}>{d.name}</p>
            <p className="text-gray-700">{d.value.toLocaleString()} users</p>
            <p className="text-gray-400 text-xs mt-0.5">{d.pct}% of total</p>
        </div>
    );
};

// ── Animated bar shape ───────────────────────────────────────────────────────
const AnimatedBar = (props: any) => {
    const { x, y, width, height, fill, isHovered } = props;
    return (
        <rect
            x={x}
            y={y}
            width={width}
            height={height}
            fill={fill}
            rx={5}
            ry={5}
            opacity={isHovered ? 1 : 0.88}
            style={{ filter: isHovered ? `drop-shadow(0 4px 8px ${fill}55)` : "none", transition: "all 0.2s" }}
        />
    );
};

export function AdminAnalytics({ analytics, loadingAnalytics }: AdminAnalyticsProps) {
    const totalUsers = analytics.totalUsers || 0;

    // ── Growth chart: time-range filter ─────────────────────────────────────
    const [growthRange, setGrowthRange] = useState<3 | 6>(6);
    const [growthView, setGrowthView] = useState<"both" | "new" | "total">("both");
    const growthData = growthRange === 3
        ? (analytics.userGrowth || []).slice(-3)
        : (analytics.userGrowth || []);

    // ── Role chart: hovered bar ──────────────────────────────────────────────
    const [hoveredRole, setHoveredRole] = useState<string | null>(null);
    const roleDataWithPct = (analytics.roleDistribution || []).map((entry: any) => ({
        ...entry,
        pct: totalUsers > 0 ? Math.round((entry.value / totalUsers) * 100) : 0,
    }));

    // ── Profile: selected segment ────────────────────────────────────────────
    const [selectedSegment, setSelectedSegment] = useState<"complete" | "partial" | "incomplete" | null>(null);
    const profileTotal =
        (analytics.profileStats?.complete || 0) +
        (analytics.profileStats?.partial || 0) +
        (analytics.profileStats?.incomplete || 0);
    const completePct   = profileTotal > 0 ? Math.round((analytics.profileStats?.complete   / profileTotal) * 100) : 0;
    const partialPct    = profileTotal > 0 ? Math.round((analytics.profileStats?.partial    / profileTotal) * 100) : 0;
    const incompletePct = profileTotal > 0 ? Math.round((analytics.profileStats?.incomplete / profileTotal) * 100) : 0;

    // animated totals
    const animTotal    = useCountUp(totalUsers);
    const animComplete = useCountUp(analytics.profileStats?.complete || 0);
    const animPartial  = useCountUp(analytics.profileStats?.partial  || 0);
    const animIncomplete = useCountUp(analytics.profileStats?.incomplete || 0);

    const segmentDetails: Record<string, { label: string; color: string; bg: string; border: string; bar: string; value: number; pct: number }> = {
        complete:   { label: "Complete Profiles",   color: "text-emerald-600", bg: "bg-emerald-50",  border: "border-emerald-300", bar: "bg-emerald-500", value: analytics.profileStats?.complete   || 0, pct: completePct   },
        partial:    { label: "Partial Profiles",    color: "text-amber-600",   bg: "bg-amber-50",    border: "border-amber-300",   bar: "bg-amber-400",   value: analytics.profileStats?.partial    || 0, pct: partialPct    },
        incomplete: { label: "Incomplete Profiles", color: "text-red-500",     bg: "bg-red-50",      border: "border-red-300",     bar: "bg-red-400",     value: analytics.profileStats?.incomplete || 0, pct: incompletePct },
    };

    return (
        <div className="grid md:grid-cols-2 gap-4">

            {/* ── 1. User Growth Trend ──────────────────────────────────────── */}
            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300">
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-[#008060]" />
                            User Growth Trend
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            {/* View toggle */}
                            <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs">
                                {(["both", "new", "total"] as const).map(v => (
                                    <button
                                        key={v}
                                        onClick={() => setGrowthView(v)}
                                        className={`px-2.5 py-1 font-medium transition-colors ${growthView === v ? "bg-[#008060] text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
                                    >
                                        {v === "both" ? "Both" : v === "new" ? "New" : "Total"}
                                    </button>
                                ))}
                            </div>
                            {/* Range toggle */}
                            <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs">
                                {([3, 6] as const).map(r => (
                                    <button
                                        key={r}
                                        onClick={() => setGrowthRange(r)}
                                        className={`px-2.5 py-1 font-medium transition-colors ${growthRange === r ? "bg-[#008060] text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
                                    >
                                        {r}M
                                    </button>
                                ))}
                            </div>
                            <ChartInfoButton
                                title="User Growth Trend"
                                description="New registrations per calendar month (bars) and running total (line). Use the toggles to filter range or view."
                                methodology={[
                                    "Bucketed by exact calendar month of created_at",
                                    "New Users = registrations that month only",
                                    "Total Users = cumulative including all prior users",
                                ]}
                                dataSource="Users table (created_at)"
                                updateFrequency="Cached 5 min"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent id="userGrowthChart">
                    {loadingAnalytics ? <Spinner /> : (
                        <ResponsiveContainer width="100%" height={260}>
                            <ComposedChart data={growthData} margin={{ top: 20, right: 20, left: 0, bottom: 4 }}>
                                <defs>
                                    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#008060" stopOpacity={0.9} />
                                        <stop offset="100%" stopColor="#008060" stopOpacity={0.3} />
                                    </linearGradient>
                                    <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.15} />
                                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                                {(growthView === "both" || growthView === "new") && (
                                    <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={32} />
                                )}
                                {(growthView === "both" || growthView === "total") && (
                                    <YAxis yAxisId="right" orientation="right" allowDecimals={false} tick={{ fontSize: 11, fill: "#6366f1" }} axisLine={false} tickLine={false} width={42} />
                                )}
                                <Tooltip content={<GrowthTooltip />} />
                                <Legend
                                    formatter={(value) => value === "newUsers" ? "New Registrations" : "Total Users"}
                                    iconType="circle" iconSize={8}
                                    wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
                                />
                                {(growthView === "both" || growthView === "new") && (
                                    <Bar yAxisId="left" dataKey="newUsers" fill="url(#barGrad)" radius={[5, 5, 0, 0]} barSize={26} animationDuration={600}>
                                        <LabelList dataKey="newUsers" position="top" style={{ fontSize: 10, fill: "#374151", fontWeight: 700 }} formatter={(v: number) => v > 0 ? `+${v}` : ""} />
                                    </Bar>
                                )}
                                {(growthView === "both" || growthView === "total") && (
                                    <Line
                                        yAxisId="right"
                                        type="monotone"
                                        dataKey="totalUsers"
                                        stroke="#6366f1"
                                        strokeWidth={2.5}
                                        dot={{ r: 4, fill: "#fff", stroke: "#6366f1", strokeWidth: 2 }}
                                        activeDot={{ r: 7, fill: "#6366f1", stroke: "#fff", strokeWidth: 2 }}
                                        animationDuration={800}
                                    />
                                )}
                            </ComposedChart>
                        </ResponsiveContainer>
                    )}
                </CardContent>
            </Card>

            {/* ── 2. User Role Distribution ─────────────────────────────────── */}
            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300">
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                            <Users className="w-5 h-5 text-[#008060]" />
                            User Role Distribution
                        </CardTitle>
                        <ChartInfoButton
                            title="User Role Distribution"
                            description="Count and % share per role. Hover a bar to highlight. All roles sum to total users."
                            methodology={[
                                "All users fetched server-side (no pagination cap)",
                                "Null/empty roles shown as 'Unassigned'",
                                "% = role count ÷ total users × 100",
                            ]}
                            dataSource="Users table (user_role)"
                            updateFrequency="Cached 5 min"
                        />
                    </div>
                </CardHeader>
                <CardContent id="roleDistributionChart">
                    {loadingAnalytics ? <Spinner /> : (
                        <div className="space-y-3">
                            <ResponsiveContainer width="100%" height={200}>
                                <BarChart
                                    data={roleDataWithPct}
                                    margin={{ top: 28, right: 16, left: 0, bottom: 4 }}
                                    barCategoryGap="32%"
                                    onMouseLeave={() => setHoveredRole(null)}
                                >
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={36} />
                                    <Tooltip content={<RoleTooltip />} cursor={false} />
                                    <Bar
                                        dataKey="value"
                                        radius={[6, 6, 0, 0]}
                                        minPointSize={6}
                                        animationDuration={700}
                                        onMouseEnter={(_: any, index: number) => setHoveredRole(roleDataWithPct[index]?.name ?? null)}
                                    >
                                        <LabelList
                                            content={(props: any) => {
                                                const { x, y, width, value, index } = props;
                                                const entry = roleDataWithPct[index];
                                                if (!entry) return null;
                                                const isHov = hoveredRole === entry.name;
                                                return (
                                                    <g>
                                                        <text x={x + width / 2} y={y - 15} textAnchor="middle" fill="#111827" fontSize={isHov ? 13 : 12} fontWeight={700}>{value.toLocaleString()}</text>
                                                        <text x={x + width / 2} y={y - 3}  textAnchor="middle" fill={isHov ? entry.fill : "#9ca3af"} fontSize={10} fontWeight={isHov ? 700 : 400}>{entry.pct}%</text>
                                                    </g>
                                                );
                                            }}
                                        />
                                        {roleDataWithPct.map((entry: any, index: number) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={entry.fill}
                                                opacity={hoveredRole === null || hoveredRole === entry.name ? 1 : 0.35}
                                                style={{ cursor: "pointer", transition: "opacity 0.2s" }}
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>

                            {/* Interactive role legend pills */}
                            <div className="flex flex-wrap gap-2 justify-center">
                                {roleDataWithPct.map((entry: any) => (
                                    <button
                                        key={entry.name}
                                        onMouseEnter={() => setHoveredRole(entry.name)}
                                        onMouseLeave={() => setHoveredRole(null)}
                                        className="flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium transition-all duration-200"
                                        style={{
                                            borderColor: entry.fill,
                                            backgroundColor: hoveredRole === entry.name ? entry.fill : `${entry.fill}15`,
                                            color: hoveredRole === entry.name ? "#fff" : entry.fill,
                                        }}
                                    >
                                        <span className="w-2 h-2 rounded-full" style={{ background: entry.fill }} />
                                        {entry.name}: {entry.value.toLocaleString()} ({entry.pct}%)
                                    </button>
                                ))}
                            </div>
                            <p className="text-center text-xs text-gray-400">
                                Total: <span className="font-semibold text-gray-600">{animTotal.toLocaleString()}</span> users across {roleDataWithPct.length} role{roleDataWithPct.length !== 1 ? "s" : ""}
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ── 3. Profile Completion Status ──────────────────────────────── */}
            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300 md:col-span-2">
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                            <UserCheck className="w-5 h-5 text-[#008060]" />
                            Profile Completion Status
                            {profileTotal > 0 && (
                                <span className="ml-2 text-xs font-normal text-gray-400">
                                    — {profileTotal.toLocaleString()} alumni profiles
                                </span>
                            )}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            {selectedSegment && (
                                <button
                                    onClick={() => setSelectedSegment(null)}
                                    className="text-xs text-gray-400 hover:text-gray-700 underline underline-offset-2 transition-colors"
                                >
                                    Clear selection
                                </button>
                            )}
                            <ChartInfoButton
                                title="Profile Completion"
                                description="Click a segment to highlight it. 8 fields checked: photo, bio, company, role, city, LinkedIn, phone, skills (≥3)."
                                methodology={[
                                    "Complete = all 8 fields filled (100%)",
                                    "Partial = 50–99% of fields filled",
                                    "Incomplete = less than 50% filled",
                                    "Alumni profiles only",
                                ]}
                                dataSource="Alumni table"
                                updateFrequency="Cached 60 s"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent id="profileCompletionChart">
                    {loadingAnalytics ? <Spinner /> : (analytics.profileStats && profileTotal > 0) ? (
                        <div className="space-y-5">
                            {/* Stacked interactive progress bar */}
                            <div>
                                <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                                    <span>Click a segment to inspect</span>
                                    <span>Complete · Partial · Incomplete</span>
                                </div>
                                <div className="flex h-7 w-full rounded-xl overflow-hidden shadow-inner bg-gray-100 cursor-pointer">
                                    {(["complete", "partial", "incomplete"] as const).map(seg => {
                                        const d = segmentDetails[seg];
                                        const pct = d.pct;
                                        const isSelected = selectedSegment === seg;
                                        const isDimmed = selectedSegment !== null && !isSelected;
                                        return (
                                            <div
                                                key={seg}
                                                className={`${d.bar} flex items-center justify-center transition-all duration-500`}
                                                style={{ width: `${pct}%`, opacity: isDimmed ? 0.3 : 1, filter: isSelected ? "brightness(1.1)" : "none" }}
                                                title={`${d.label}: ${d.value.toLocaleString()} (${pct}%)`}
                                                onClick={() => setSelectedSegment(isSelected ? null : seg)}
                                            >
                                                {pct >= 8 && (
                                                    <span className="text-white text-[11px] font-bold drop-shadow">{pct}%</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Three interactive stat cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {(["complete", "partial", "incomplete"] as const).map(seg => {
                                    const d = segmentDetails[seg];
                                    const isSelected = selectedSegment === seg;
                                    const isDimmed = selectedSegment !== null && !isSelected;
                                    const animVal = seg === "complete" ? animComplete : seg === "partial" ? animPartial : animIncomplete;
                                    return (
                                        <button
                                            key={seg}
                                            onClick={() => setSelectedSegment(isSelected ? null : seg)}
                                            className={`text-left p-4 rounded-xl border-2 transition-all duration-300 w-full ${d.bg} ${isSelected ? d.border + " ring-2 ring-offset-1 shadow-lg scale-[1.02]" : "border-transparent hover:border-gray-200 hover:shadow-md"}`}
                                            style={{ opacity: isDimmed ? 0.45 : 1 }}
                                        >
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-3 h-3 rounded-full ${d.bar}`} />
                                                    <p className="text-xs font-semibold text-gray-600">{d.label}</p>
                                                </div>
                                                {isSelected && (
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${d.bar} text-white`}>Selected</span>
                                                )}
                                            </div>
                                            <p className={`text-4xl font-black ${d.color} tabular-nums`}>{animVal.toLocaleString()}</p>
                                            <p className="text-xs text-gray-400 mt-1">{d.pct}% of alumni</p>
                                            <div className={`mt-3 h-1.5 rounded-full ${d.bg} border`} style={{ borderColor: d.bar.replace("bg-", "") }}>
                                                <div
                                                    className={`h-1.5 rounded-full ${d.bar} transition-all duration-700`}
                                                    style={{ width: isSelected ? "100%" : `${d.pct}%` }}
                                                />
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Expanded detail panel when a segment is selected */}
                            {selectedSegment && (
                                <div className={`p-4 rounded-xl border ${segmentDetails[selectedSegment].bg} ${segmentDetails[selectedSegment].border} animate-in fade-in slide-in-from-top-2 duration-300`}>
                                    <p className={`text-sm font-bold mb-1 ${segmentDetails[selectedSegment].color}`}>
                                        {segmentDetails[selectedSegment].label} — Detail
                                    </p>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                                        <div className="p-3 bg-white/70 rounded-lg">
                                            <p className="text-xs text-gray-500">Count</p>
                                            <p className={`text-2xl font-bold ${segmentDetails[selectedSegment].color}`}>{segmentDetails[selectedSegment].value.toLocaleString()}</p>
                                        </div>
                                        <div className="p-3 bg-white/70 rounded-lg">
                                            <p className="text-xs text-gray-500">Share</p>
                                            <p className={`text-2xl font-bold ${segmentDetails[selectedSegment].color}`}>{segmentDetails[selectedSegment].pct}%</p>
                                        </div>
                                        <div className="p-3 bg-white/70 rounded-lg">
                                            <p className="text-xs text-gray-500">of Total Alumni</p>
                                            <p className="text-2xl font-bold text-gray-700">{profileTotal.toLocaleString()}</p>
                                        </div>
                                        <div className="p-3 bg-white/70 rounded-lg">
                                            <p className="text-xs text-gray-500">Completion Range</p>
                                            <p className={`text-sm font-bold ${segmentDetails[selectedSegment].color}`}>
                                                {selectedSegment === "complete" ? "100%" : selectedSegment === "partial" ? "50–99%" : "< 50%"}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="h-40 flex items-center justify-center">
                            <p className="text-gray-400 text-sm">No profile data available</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
