import React from "react";
import { useTimeAgoTicker } from "@/hooks/useTimeAgoTicker";
import { formatTimeAgo } from "@/lib/dateUtils";

/**
 * Subscribes to the shared time-ago ticker so only this small label
 * re-renders on each tick, instead of the per-card setInterval that used to
 * re-render the entire PostCard every second.
 */
export function TimeAgoLabel({ createdAt }: { createdAt: string }) {
  useTimeAgoTicker(createdAt);
  return <>{formatTimeAgo(createdAt)}</>;
}
