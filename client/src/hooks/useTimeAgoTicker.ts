import { useSyncExternalStore } from "react";

/**
 * Two shared, reference-counted tickers (1s and 60s) replacing the previous
 * per-PostCard setInterval — one timer per visible card was wasteful when a
 * single shared tick can drive every "time ago" label at once.
 */
function createTicker(intervalMs: number) {
  let listeners = new Set<() => void>();
  let intervalId: ReturnType<typeof setInterval> | null = null;

  const subscribe = (callback: () => void) => {
    listeners.add(callback);
    if (!intervalId) {
      intervalId = setInterval(() => {
        listeners.forEach((l) => l());
      }, intervalMs);
    }
    return () => {
      listeners.delete(callback);
      if (listeners.size === 0 && intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
  };

  const getSnapshot = () => Date.now();

  return { subscribe, getSnapshot };
}

const fastTicker = createTicker(1000);
const slowTicker = createTicker(60000);

/**
 * Subscribes to a shared tick (1s while the post is <60min old, 60s beyond
 * that up to 24h, and no subscription at all past 24h since the label is
 * static). Returns the current Date.now() at the chosen tick rate.
 */
export function useTimeAgoTicker(createdAt: string): number {
  const posted = new Date(createdAt).getTime();
  const diffMinutes = (Date.now() - posted) / 60000;

  const ticker = diffMinutes < 60 ? fastTicker : diffMinutes < 1440 ? slowTicker : null;

  return useSyncExternalStore(
    ticker ? ticker.subscribe : () => () => {},
    ticker ? ticker.getSnapshot : () => Date.now(),
  );
}
