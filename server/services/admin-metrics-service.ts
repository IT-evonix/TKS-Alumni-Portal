/**
 * Shared admin metrics helpers
 * Keeps the admin dashboard and admin digest aligned on time windows and user analytics.
 */

import { supabase } from "../supabase";

export interface TimeWindow {
  start: Date;
  end: Date;
  startISO: string;
  endISO: string;
}

export interface AdminAnalyticsUserRow {
  id: string;
  user_role: string | null;
  created_at: string | null;
  updated_at: string | null;
  is_admin: boolean | null;
}

export interface AdminActivityMetrics {
  activeToday: number;
  activeWeek: number;
  activeMonth: number;
  newToday: number;
  newWeek: number;
  newMonth: number;
}

export interface AdminDashboardMetrics {
  userGrowth: Array<{
    month: string;
    newUsers: number;
    totalUsers: number;
  }>;
  roleDistribution: Array<{
    name: string;
    value: number;
  }>;
  activityMetrics: AdminActivityMetrics;
  totalUsers: number;
  adminCount: number;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
const MONTH_MS = 30 * DAY_MS;

export function createTimeWindow(durationMs: number, now = new Date()): TimeWindow {
  const end = new Date(now);
  const start = new Date(now.getTime() - durationMs);
  return {
    start,
    end,
    startISO: start.toISOString(),
    endISO: end.toISOString(),
  };
}

export function getLast24HoursWindow(now = new Date()): TimeWindow {
  return createTimeWindow(DAY_MS, now);
}

export function getLast7DaysWindow(now = new Date()): TimeWindow {
  return createTimeWindow(WEEK_MS, now);
}

export function getLast30DaysWindow(now = new Date()): TimeWindow {
  return createTimeWindow(MONTH_MS, now);
}

export function isDateWithinWindow(value: string | null | undefined, window: TimeWindow): boolean {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return timestamp >= window.start.getTime() && timestamp < window.end.getTime();
}

export function buildUserGrowth(users: AdminAnalyticsUserRow[], now = new Date()) {
  const last6Months = Array.from({ length: 6 }, (_, index) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return {
      month: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      calYear: d.getFullYear(),
      calMonth: d.getMonth(),
      newUsers: 0,
    };
  });

  const firstBucketStart = new Date(last6Months[0].calYear, last6Months[0].calMonth, 1).getTime();
  const runningBase = users.filter((user) => {
    if (!user.created_at) return false;
    return new Date(user.created_at).getTime() < firstBucketStart;
  }).length;

  users.forEach((user) => {
    if (!user.created_at) return;
    const created = new Date(user.created_at);
    const bucket = last6Months.find(
      (entry) => entry.calYear === created.getFullYear() && entry.calMonth === created.getMonth()
    );
    if (bucket) {
      bucket.newUsers += 1;
    }
  });

  let cumulative = runningBase;
  return last6Months.map((bucket) => {
    cumulative += bucket.newUsers;
    return {
      month: bucket.month,
      newUsers: bucket.newUsers,
      totalUsers: cumulative,
    };
  });
}

export function buildRoleDistribution(users: AdminAnalyticsUserRow[]) {
  const roles = users.reduce<Record<string, number>>((acc, user) => {
    const role = user.user_role?.trim() || "unassigned";
    acc[role] = (acc[role] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(roles).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
  }));
}

export function buildActivityMetrics(users: AdminAnalyticsUserRow[], now = new Date()): AdminActivityMetrics {
  const dayWindow = getLast24HoursWindow(now);
  const weekWindow = getLast7DaysWindow(now);
  const monthWindow = getLast30DaysWindow(now);

  const countInWindow = (field: "created_at" | "updated_at", window: TimeWindow) =>
    users.filter((user) => isDateWithinWindow(user[field], window)).length;

  return {
    activeToday: countInWindow("updated_at", dayWindow),
    activeWeek: countInWindow("updated_at", weekWindow),
    activeMonth: countInWindow("updated_at", monthWindow),
    newToday: countInWindow("created_at", dayWindow),
    newWeek: countInWindow("created_at", weekWindow),
    newMonth: countInWindow("created_at", monthWindow),
  };
}

async function fetchAllUsersForAnalytics(): Promise<{
  totalUserCount: number;
  users: AdminAnalyticsUserRow[];
}> {
  const { count: totalUserCount, error: countError } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true });

  if (countError) {
    throw countError;
  }

  if (!totalUserCount) {
    return { totalUserCount: 0, users: [] };
  }

  const pageSize = 1000;
  const users: AdminAnalyticsUserRow[] = [];

  for (let offset = 0; offset < totalUserCount; offset += pageSize) {
    const { data, error } = await supabase
      .from("users")
      .select("id, user_role, created_at, updated_at, is_admin")
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw error;
    }

    const page = (data || []) as AdminAnalyticsUserRow[];
    users.push(...page);

    if (page.length < pageSize) {
      break;
    }
  }

  return { totalUserCount, users };
}

export async function aggregateAdminDashboardMetrics(
  now = new Date()
): Promise<AdminDashboardMetrics> {
  const { totalUserCount, users } = await fetchAllUsersForAnalytics();
  const totalUsers = totalUserCount || users.length;

  return {
    userGrowth: buildUserGrowth(users, now),
    roleDistribution: buildRoleDistribution(users),
    activityMetrics: buildActivityMetrics(users, now),
    totalUsers,
    adminCount: users.filter((user) => user.is_admin).length,
  };
}
