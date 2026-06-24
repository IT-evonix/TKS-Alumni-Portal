import React, { createContext, useContext, useState, useCallback } from 'react';
import { searchCache } from '../utils/searchCache';

interface SearchResult {
  id: string;
  type: 'post' | 'alumni' | 'event' | 'job' | 'message' | 'user' | 'command' | 'forum' | 'blog' | 'podcast' | 'newsletter' | 'travel' | 'mentor';
  title: string;
  description: string;
  image?: string;
  url: string;
  relevance?: number;
  connectionStatus?: string;
  isRequester?: boolean;
  isApplied?: boolean;
  isSaved?: boolean;
  icon?: string;
}

interface SearchFilters {
  type?: 'all' | 'post' | 'alumni' | 'event' | 'job' | 'forum' | 'blog' | 'podcast' | 'newsletter' | 'travel' | 'mentor';
  dateRange?: 'all' | 'today' | 'week' | 'month' | 'year' | 'custom';
  customDateFrom?: string;
  customDateTo?: string;
  location?: string;
  batch?: string;
  batchFrom?: string;
  batchTo?: string;
  skills?: string[];
  expertise?: string[];
  industry?: string;
  company?: string;
  jobType?: 'all' | 'full-time' | 'part-time' | 'contract' | 'internship' | 'freelance';
  workMode?: 'all' | 'remote' | 'hybrid' | 'onsite';
  eventType?: 'all' | 'virtual' | 'in-person' | 'hybrid';
  sortBy?: 'relevance' | 'date' | 'popularity';
  graduationYear?: string;
}

interface SearchContextType {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: SearchResult[];
  isSearching: boolean;
  searchHistory: string[];
  addToHistory: (query: string) => void;
  clearHistory: () => void;
  performGlobalSearch: (query: string, filters?: SearchFilters) => Promise<void>;
  showSearchModal: boolean;
  setShowSearchModal: (show: boolean) => void;
  searchFilters: SearchFilters;
  setSearchFilters: (filters: SearchFilters) => void;
  clearSearchResults: () => void;
  didYouMean: string | null;
  parsedIntent: any | null;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export const SearchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    const saved = localStorage.getItem('searchHistory');
    return saved ? JSON.parse(saved) : [];
  });
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    type: 'all',
    dateRange: 'all',
    sortBy: 'relevance',
    jobType: 'all',
    workMode: 'all',
    eventType: 'all'
  });
  const [didYouMean, setDidYouMean] = useState<string | null>(null);
  const [parsedIntent, setParsedIntent] = useState<any | null>(null);

  const addToHistory = useCallback((query: string) => {
    if (!query.trim()) return;
    setSearchHistory(prev => {
      const updated = [query, ...prev.filter(q => q !== query)].slice(0, 10);
      localStorage.setItem('searchHistory', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearHistory = useCallback(() => {
    const emptyHistory: string[] = [];
    setSearchHistory(emptyHistory);
    localStorage.removeItem('searchHistory');
  }, []);

  const performGlobalSearch = useCallback(async (query: string, filters: SearchFilters = { type: 'all', dateRange: 'all', sortBy: 'relevance' }) => {
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    // Check cache first
    const cachedResults = searchCache.get(query, filters);
    if (cachedResults) {
      console.log('🎯 Cache HIT for query:', query);
      setSearchResults(cachedResults.results || []);
      setDidYouMean(cachedResults.didYouMean || null);
      setParsedIntent(cachedResults.parsedQuery || null);
      setIsSearching(false);

      // Still add to history
      if (query.trim().length > 2 && cachedResults.results?.length > 0) {
        addToHistory(query);
      }
      // Track cache hit analytics
      fetch('/api/analytics/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`,
          'user-id': localStorage.getItem('userId') || ''
        },
        body: JSON.stringify({
          query,
          filters,
          resultsCount: cachedResults.results?.length || 0,
          hadResults: (cachedResults.results?.length || 0) > 0,
          cacheHit: true
        })
      }).catch(err => console.error('Analytics error:', err));

      return;
    }

    console.log('💾 Cache MISS for query:', query);
    const startTime = Date.now();
    setIsSearching(true);
    setSearchResults([]); // Clear previous results

    // Save to recently searched only after successful search
    const shouldAddToHistory = query.trim().length > 2;

    try {
      // Build query parameters
      const params = new URLSearchParams();
      params.append('query', query.trim());
      params.append('type', filters.type || 'all');
      params.append('limit', '40');

      // Add all filter parameters
      if (filters.dateRange && filters.dateRange !== 'all') {
        params.append('dateRange', filters.dateRange);
        if (filters.dateRange === 'custom') {
          if (filters.customDateFrom) params.append('dateFrom', filters.customDateFrom);
          if (filters.customDateTo) params.append('dateTo', filters.customDateTo);
        }
      }
      if (filters.location) params.append('location', filters.location);
      if (filters.batch) params.append('batch', filters.batch);
      if (filters.batchFrom) params.append('batchFrom', filters.batchFrom);
      if (filters.batchTo) params.append('batchTo', filters.batchTo);
      if (filters.skills && filters.skills.length > 0) params.append('skills', filters.skills.join(','));
      if (filters.industry) params.append('industry', filters.industry);
      if (filters.company) params.append('company', filters.company);
      if (filters.jobType && filters.jobType !== 'all') params.append('jobType', filters.jobType);
      if (filters.workMode && filters.workMode !== 'all') params.append('workMode', filters.workMode);
      if (filters.eventType && filters.eventType !== 'all') params.append('eventType', filters.eventType);
      if (filters.sortBy) params.append('sortBy', filters.sortBy);

      // Debug: Log the filters being sent
      console.log('🔍 Performing search with filters:', {
        query: query.trim(),
        filters,
        url: `/api/search?${params.toString()}`
      });

      const response = await fetch(`/api/search?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`,
          'user-id': localStorage.getItem('userId') || ''
        }
      });

      if (!response.ok) {
        throw new Error('Search request failed');
      }

      const data = await response.json();
      const results = data.results || [];

      setSearchResults(results);
      setDidYouMean(data.didYouMean || null);
      setParsedIntent(data.parsedQuery || null);

      // Cache the results
      searchCache.set(query, {
        results: results,
        didYouMean: data.didYouMean || null,
        parsedQuery: data.parsedQuery || null
      }, filters);

      // Only add to history if we got results and query is long enough
      if (shouldAddToHistory && results.length > 0) {
        addToHistory(query);
      }

      // Track analytics
      const searchDurationMs = Date.now() - startTime;
      fetch('/api/analytics/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`,
          'user-id': localStorage.getItem('userId') || ''
        },
        body: JSON.stringify({
          query,
          filters,
          resultsCount: results.length,
          searchDurationMs,
          hadResults: results.length > 0,
          cacheHit: false
        })
      }).catch(err => console.error('Analytics error:', err));
    } catch (error) {
      console.error('Global search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [addToHistory]);

  // Simple relevance calculation
  const calculateRelevance = (query: string, text: string): number => {
    const lowerQuery = query.toLowerCase();
    const lowerText = text.toLowerCase();
    let score = 0;

    // Exact match
    if (lowerText === lowerQuery) score += 100;
    // Starts with query
    else if (lowerText.startsWith(lowerQuery)) score += 50;
    // Contains query
    else if (lowerText.includes(lowerQuery)) score += 25;

    // Word boundary matches
    const words = lowerQuery.split(' ');
    words.forEach(word => {
      if (lowerText.includes(word)) score += 10;
    });

    return score;
  };

  const clearSearchResults = useCallback(() => {
    setSearchResults([]);
    setSearchQuery('');
    setDidYouMean(null);
    setParsedIntent(null);
    // Note: filters are intentionally NOT reset here so they persist across modal open/close
  }, []);

  return (
    <SearchContext.Provider
      value={{
        searchQuery,
        setSearchQuery,
        searchResults,
        isSearching,
        searchHistory,
        addToHistory,
        clearHistory,
        performGlobalSearch,
        showSearchModal,
        setShowSearchModal,
        searchFilters,
        setSearchFilters,
        clearSearchResults,
        didYouMean,
        parsedIntent,
      }}
    >
      {children}
    </SearchContext.Provider>
  );
};

export const useSearch = () => {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch must be used within SearchProvider');
  }
  return context;
};