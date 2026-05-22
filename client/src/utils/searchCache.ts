/**
 * Search Result Cache Utility
 * Provides client-side caching for search results to improve performance
 */

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    expiresAt: number;
}

interface SearchCacheOptions {
    ttl?: number; // Time to live in milliseconds (default: 5 minutes)
    maxSize?: number; // Maximum number of entries (default: 50)
}

export class SearchCache<T = any> {
    private cache: Map<string, CacheEntry<T>>;
    private ttl: number;
    private maxSize: number;

    constructor(options: SearchCacheOptions = {}) {
        this.cache = new Map();
        this.ttl = options.ttl || 5 * 60 * 1000; // 5 minutes default
        this.maxSize = options.maxSize || 50;
    }

    /**
     * Generate a cache key from query and filters
     */
    private generateKey(query: string, filters?: Record<string, any>): string {
        const filterString = filters ? JSON.stringify(filters) : '';
        return `${query.toLowerCase().trim()}::${filterString}`;
    }

    /**
     * Get cached results if they exist and haven't expired
     */
    get(query: string, filters?: Record<string, any>): T | null {
        const key = this.generateKey(query, filters);
        const entry = this.cache.get(key);

        if (!entry) {
            return null;
        }

        // Check if entry has expired
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }

        // Update timestamp for LRU tracking
        entry.timestamp = Date.now();
        return entry.data;
    }

    /**
     * Set cache entry
     */
    set(query: string, data: T, filters?: Record<string, any>): void {
        const key = this.generateKey(query, filters);
        const now = Date.now();

        // If cache is full, remove oldest entry (LRU)
        if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
            this.evictOldest();
        }

        this.cache.set(key, {
            data,
            timestamp: now,
            expiresAt: now + this.ttl
        });
    }

    /**
     * Remove oldest entry based on timestamp (LRU)
     */
    private evictOldest(): void {
        let oldestKey: string | null = null;
        let oldestTimestamp = Infinity;

        for (const [key, entry] of this.cache.entries()) {
            if (entry.timestamp < oldestTimestamp) {
                oldestTimestamp = entry.timestamp;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.cache.delete(oldestKey);
        }
    }

    /**
     * Clear all cache entries
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * Remove expired entries
     */
    cleanup(): void {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiresAt) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Get cache statistics
     */
    getStats(): {
        size: number;
        maxSize: number;
        hitRate: number;
    } {
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            hitRate: 0 // Can be enhanced with hit/miss tracking
        };
    }

    /**
     * Check if a query is cached
     */
    has(query: string, filters?: Record<string, any>): boolean {
        const key = this.generateKey(query, filters);
        const entry = this.cache.get(key);

        if (!entry) {
            return false;
        }

        // Check if expired
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return false;
        }

        return true;
    }
}

// Create singleton instance
export const searchCache = new SearchCache({
    ttl: 5 * 60 * 1000, // 5 minutes
    maxSize: 50
});

// Cleanup expired entries every minute
if (typeof window !== 'undefined') {
    setInterval(() => {
        searchCache.cleanup();
    }, 60 * 1000);
}
