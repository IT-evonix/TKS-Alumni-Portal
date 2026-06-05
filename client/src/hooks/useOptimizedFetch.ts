/**
 * Optimized Fetch Hook
 * Provides request deduplication, caching, and prefetching
 */

import { useCallback, useRef } from 'react';

interface FetchOptions extends RequestInit {
  cache?: 'default' | 'no-store' | 'reload' | 'no-cache' | 'force-cache' | 'only-if-cached';
  dedupe?: boolean; // Enable request deduplication
  ttl?: number; // Cache TTL in milliseconds
}

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

// Global request cache
const requestCache = new Map<string, CacheEntry>();
// Active requests map for deduplication
const activeRequests = new Map<string, Promise<any>>();

/**
 * Hook for optimized fetching with caching and deduplication
 */
export function useOptimizedFetch() {
  const cacheRef = useRef(requestCache);
  const activeRequestsRef = useRef(activeRequests);

  const fetchWithCache = useCallback(async (
    url: string,
    options: FetchOptions = {}
  ): Promise<any> => {
    const { cache = 'default', dedupe = true, ttl = 60000, ...fetchOptions } = options;
    const cacheKey = `${url}:${JSON.stringify(fetchOptions)}`;

    // Check cache first
    if (cache !== 'no-store' && cache !== 'reload') {
      const cached = cacheRef.current.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < cached.ttl) {
        return cached.data;
      }
      // Remove expired cache
      if (cached) {
        cacheRef.current.delete(cacheKey);
      }
    }

    // Check for active request (deduplication)
    if (dedupe && activeRequestsRef.current.has(cacheKey)) {
      return activeRequestsRef.current.get(cacheKey);
    }

    // Create new request
    const requestPromise = fetch(url, {
      ...fetchOptions,
      headers: {
        'Content-Type': 'application/json',
        ...fetchOptions.headers,
      },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      })
      .then((data) => {
        // Cache the response
        if (cache !== 'no-store') {
          cacheRef.current.set(cacheKey, {
            data,
            timestamp: Date.now(),
            ttl,
          });
        }
        return data;
      })
      .finally(() => {
        // Remove from active requests
        activeRequestsRef.current.delete(cacheKey);
      });

    // Store active request for deduplication
    if (dedupe) {
      activeRequestsRef.current.set(cacheKey, requestPromise);
    }

    return requestPromise;
  }, []);

  const invalidateCache = useCallback((url?: string) => {
    if (url) {
      // Invalidate specific URL
      for (const key of cacheRef.current.keys()) {
        if (key.startsWith(url)) {
          cacheRef.current.delete(key);
        }
      }
    } else {
      // Clear all cache
      cacheRef.current.clear();
    }
  }, []);

  const prefetch = useCallback(async (url: string, options: FetchOptions = {}) => {
    // Prefetch in background
    fetchWithCache(url, { ...options, cache: 'force-cache' }).catch(() => {
      // Silently fail prefetch
    });
  }, [fetchWithCache]);

  return {
    fetch: fetchWithCache,
    invalidateCache,
    prefetch,
  };
}
