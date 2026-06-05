import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useSearch } from '@/contexts/SearchContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Search, Clock, X, TrendingUp, FileText, Users, Calendar, Briefcase,
  MessageSquare, Filter, MapPin, ArrowUpDown,
  XCircle, Loader2, UserPlus, Send, Save, Bookmark, LogOut, Settings, Home,
  CheckCircle2, SquareArrowOutUpRight
} from 'lucide-react';

// Filter chip component
const FilterChip: React.FC<{
  label: string;
  onRemove: () => void;
  icon?: React.ReactNode;
}> = ({ label, onRemove, icon }) => (
  <Badge
    variant="secondary"
    className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-[#008060]/10 text-[#008060] border-[#008060]/20 hover:bg-[#008060]/20"
  >
    {icon && <span className="text-[10px]">{icon}</span>}
    <span>{label}</span>
    <button
      onClick={(e) => {
        e.stopPropagation();
        onRemove();
      }}
      className="ml-1 hover:bg-[#008060]/20 rounded-full p-0.5 transition-colors"
      aria-label={`Remove ${label} filter`}
    >
      <XCircle className="w-3 h-3" />
    </button>
  </Badge>
);

// Simple filter section (non-collapsible for better UX)
const FilterSection: React.FC<{
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, icon, children }) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
        {icon && <span className="text-gray-500">{icon}</span>}
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
};

export const GlobalSearchModal: React.FC = () => {
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    searchHistory,
    clearHistory,
    performGlobalSearch,
    showSearchModal,
    setShowSearchModal,
    searchFilters,
    setSearchFilters,
    clearSearchResults,
    didYouMean,
    parsedIntent,
  } = useSearch();

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedResultIndex, setSelectedResultIndex] = useState(-1);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);

  const [showFilters, setShowFilters] = useState(false);
  const [filterOptions, setFilterOptions] = useState<{
    locations: string[];
    industries: string[];
    companies: string[];
    skills: string[];
    batches: string[];
    jobTypes: string[];
    workModes: string[];
  }>({
    locations: [],
    industries: [],
    companies: [],
    skills: [],
    batches: [],
    jobTypes: [],
    workModes: []
  });
  const [, setLocation] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const resultRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Fetch filter options when modal opens
  useEffect(() => {
    if (showSearchModal) {
      fetchFilterOptions();
    }
  }, [showSearchModal]);

  const fetchFilterOptions = async () => {
    try {
      // Fetch locations, industries, companies, skills, batches from various endpoints
      const authHeaders = {
        'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`,
        'user-id': localStorage.getItem('userId') || ''
      };
      const [jobsRes, alumniRes] = await Promise.all([
        fetch('/api/jobs/filters', { headers: authHeaders }),
        fetch('/api/alumni/filters', { headers: authHeaders })
      ]);

      if (jobsRes.ok) {
        const jobsData = await jobsRes.json();
        setFilterOptions(prev => ({
          ...prev,
          locations: Array.from(new Set([
            ...(jobsData.locations || []),
            ...prev.locations
          ])).sort() as string[],
          industries: Array.from(new Set([
            ...(jobsData.industries || []),
            ...prev.industries
          ])).sort() as string[],
          jobTypes: Array.from(new Set(jobsData.jobTypes || [])).sort() as string[],
          workModes: Array.from(new Set(jobsData.workModes || [])).sort() as string[],
        }));
      }

      if (alumniRes.ok) {
        const alumniFilters = await alumniRes.json();

        setFilterOptions(prev => ({
          ...prev,
          locations: Array.from(new Set([...prev.locations, ...(alumniFilters.locations || [])])).sort() as string[],
          industries: Array.from(new Set([...prev.industries, ...(alumniFilters.industries || [])])).sort() as string[],
          batches: alumniFilters.batches || []
        }));
      }
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  };

  useEffect(() => {
    if (showSearchModal && inputRef.current) {
      inputRef.current.focus();
      setSelectedResultIndex(-1);
      setSelectedSuggestionIndex(-1);
    }
  }, [showSearchModal]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedResultIndex(-1);
  }, [searchResults]);

  // Reset suggestion selection when suggestions change
  useEffect(() => {
    setSelectedSuggestionIndex(-1);
  }, [suggestions]);

  const handleConnect = async (e: React.MouseEvent, alumniId: string) => {
    e.stopPropagation();
    try {
      const userId = localStorage.getItem('userId');
      const response = await fetch('/api/connections/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`,
          'user-id': userId || ''
        },
        body: JSON.stringify({ recipientId: alumniId })
      });
      if (response.ok) {
        performGlobalSearch(searchQuery, searchFilters);
      }
    } catch (err) {
      console.error('Connection error:', err);
    }
  };

  const handleMessage = (e: React.MouseEvent, alumniId: string) => {
    e.stopPropagation();
    setLocation(`/chat?with=${alumniId}`);
    handleClose();
  };

  const handleApply = async (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation();
    try {
      const userId = localStorage.getItem('userId');
      const response = await fetch(`/api/jobs/${jobId}/apply`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`,
          'user-id': userId || ''
        }
      });
      if (response.ok) {
        performGlobalSearch(searchQuery, searchFilters);
      }
    } catch (err) {
      console.error('Apply error:', err);
    }
  };

  const handleSaveJob = async (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation();
    try {
      const userId = localStorage.getItem('userId');
      const response = await fetch(`/api/jobs/${jobId}/save`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`,
          'user-id': userId || ''
        }
      });
      if (response.ok) {
        performGlobalSearch(searchQuery, searchFilters);
      }
    } catch (err) {
      console.error('Save error:', err);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/login';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle arrow keys for navigation
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (showSuggestions && suggestions.length > 0) {
        setSelectedSuggestionIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
      } else if (searchResults.length > 0) {
        setSelectedResultIndex(prev =>
          prev < searchResults.length - 1 ? prev + 1 : 0
        );
        // Scroll selected result into view
        setTimeout(() => {
          resultRefs.current[selectedResultIndex + 1]?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest'
          });
        }, 0);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (showSuggestions && suggestions.length > 0) {
        setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
      } else if (searchResults.length > 0) {
        setSelectedResultIndex(prev => prev > 0 ? prev - 1 : -1);
        // Scroll selected result into view
        if (selectedResultIndex > 0) {
          setTimeout(() => {
            resultRefs.current[selectedResultIndex - 1]?.scrollIntoView({
              behavior: 'smooth',
              block: 'nearest'
            });
          }, 0);
        }
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();

      // Handle suggestion selection
      if (showSuggestions && selectedSuggestionIndex >= 0) {
        const selectedSuggestion = suggestions[selectedSuggestionIndex];
        setSearchQuery(selectedSuggestion);
        performGlobalSearch(selectedSuggestion, searchFilters);
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
      }
      // Handle result selection
      else if (selectedResultIndex >= 0 && searchResults[selectedResultIndex]) {
        const selectedResult = searchResults[selectedResultIndex];
        if (e.ctrlKey || e.metaKey) {
          // Open in new tab with Ctrl+Enter or Cmd+Enter
          window.open(selectedResult.url, '_blank');
        } else {
          handleResultClick(selectedResult, selectedResultIndex);
        }
      }
      // Handle first suggestion or perform search
      else if (suggestions.length > 0 && showSuggestions) {
        const firstSuggestion = suggestions[0];
        setSearchQuery(firstSuggestion);
        performGlobalSearch(firstSuggestion, searchFilters);
        setShowSuggestions(false);
      } else if (searchQuery.trim().length >= 2) {
        performGlobalSearch(searchQuery, searchFilters);
        setShowSuggestions(false);
      }
    } else if (e.key === 'Escape') {
      if (showSuggestions) {
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
      } else if (selectedResultIndex >= 0) {
        setSelectedResultIndex(-1);
      } else {
        handleClose();
      }
    }
  };

  const handleResultClick = (result: any, index?: number) => {
    // Analytics
    if (searchQuery.trim().length > 0) {
      fetch('/api/analytics/search/click', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`,
          'user-id': localStorage.getItem('userId') || ''
        },
        body: JSON.stringify({
          query: searchQuery,
          resultId: result.id,
          resultType: result.type,
          position: index
        })
      }).catch(err => console.error('Click tracking error:', err));
    }

    if (result.type === 'command') {
      if (result.id === 'logout') {
        handleLogout();
      } else {
        setLocation(result.url);
        handleClose();
      }
      return;
    }

    handleClose();

    const targetUrl = result.url;
    if (!targetUrl) return;

    if (targetUrl.includes('#')) {
      const [path, hash] = targetUrl.split('#');
      setLocation(path);
      setTimeout(() => {
        const element = document.querySelector(`#${hash}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('search-highlight');
          setTimeout(() => element.classList.remove('search-highlight'), 2000);
        }
      }, 300);
    } else {
      setLocation(targetUrl);
    }
  };

  const handleClose = () => {
    setShowSearchModal(false);
    setSearchQuery('');
    setShowFilters(false);
    setShowSuggestions(false);
    setSuggestions([]);
    setSelectedResultIndex(-1);
    setSelectedSuggestionIndex(-1);
    clearSearchResults();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearchModal(true);
      }
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setShowSearchModal]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Explicitly ignore clicks inside portals or on select content
      if (
        target.closest('[data-radix-portal]') ||
        target.closest('[role="listbox"]') ||
        target.closest('[role="option"]') ||
        target.closest('.radix-select-content') ||
        target.closest('.radix-select-viewport') ||
        !document.body.contains(target) // Handle detached elements
      ) {
        return;
      }

      if (modalRef.current && !modalRef.current.contains(target)) {
        handleClose();
      }
    };

    if (showSearchModal) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSearchModal]);

  // Debounce search
  const debounceTimeout = useRef<NodeJS.Timeout>();

  const handleSearch = (query: string) => {
    setSearchQuery(query);

    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    if (query.trim().length === 0) {
      clearSearchResults();
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    if (query.trim().length >= 2 || query.startsWith('>')) {
      // Fetch suggestions only while typing (not after search is performed)
      if (!query.startsWith('>')) {
        setShowSuggestions(true); // Show suggestions while typing
        fetchSuggestions(query);
      } else {
        setShowSuggestions(false);
      }

      debounceTimeout.current = setTimeout(() => {
        performGlobalSearch(query, searchFilters);
        setShowSuggestions(false); // Hide suggestions after search
      }, 300);
    }
  };

  const fetchSuggestions = async (q: string) => {
    try {
      const res = await fetch(`/api/search/suggestions?q=${encodeURIComponent(q)}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`,
          'user-id': localStorage.getItem('userId') || ''
        }
      });
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions || []);
        if (data.suggestions?.length > 0) {
          setShowSuggestions(true);
        }
      }
    } catch (err) {
      console.error('Error fetching suggestions:', err);
    }
  };

  // Duplicate handlers were here, removed.

  const getResultIcon = (type: string, iconName?: string) => {
    if (type === 'command' && iconName) {
      switch (iconName) {
        case 'User': return <Users className="w-4 h-4" />;
        case 'Settings': return <Settings className="w-4 h-4" />;
        case 'LogOut': return <LogOut className="w-4 h-4" />;
        case 'Home': return <Home className="w-4 h-4" />;
        case 'Calendar': return <Calendar className="w-4 h-4" />;
        case 'MessageSquare': return <MessageSquare className="w-4 h-4" />;
        case 'Briefcase': return <Briefcase className="w-4 h-4" />;
        case 'Users': return <Users className="w-4 h-4" />;
        default: return <SquareArrowOutUpRight className="w-4 h-4" />;
      }
    }
    switch (type) {
      case 'post': return <FileText className="w-4 h-4" />;
      case 'alumni': return <Users className="w-4 h-4" />;
      case 'event': return <Calendar className="w-4 h-4" />;
      case 'job': return <Briefcase className="w-4 h-4" />;
      case 'message': return <MessageSquare className="w-4 h-4" />;
      case 'command': return <SquareArrowOutUpRight className="w-4 h-4" />;
      default: return <Search className="w-4 h-4" />;
    }
  };

  // Get active filter chips (only essential filters)
  const activeFilters = useMemo(() => {
    const filters: Array<{ key: string; label: string; icon?: React.ReactNode }> = [];

    if (searchFilters.type && searchFilters.type !== 'all') {
      filters.push({ key: 'type', label: searchFilters.type, icon: getResultIcon(searchFilters.type) });
    }
    if (searchFilters.dateRange && searchFilters.dateRange !== 'all') {
      filters.push({ key: 'dateRange', label: `Date: ${searchFilters.dateRange}` });
    }
    if (searchFilters.location) {
      filters.push({ key: 'location', label: searchFilters.location, icon: <MapPin className="w-3 h-3" /> });
    }
    if (searchFilters.jobType && searchFilters.jobType !== 'all') {
      filters.push({ key: 'jobType', label: searchFilters.jobType, icon: <Briefcase className="w-3 h-3" /> });
    }
    if (searchFilters.workMode && searchFilters.workMode !== 'all') {
      filters.push({ key: 'workMode', label: searchFilters.workMode, icon: <Home className="w-3 h-3" /> });
    }

    return filters;
  }, [searchFilters]);

  const removeFilter = (key: string) => {
    const newFilters: typeof searchFilters = { ...searchFilters };

    switch (key) {
      case 'type':
        newFilters.type = 'all';
        break;
      case 'dateRange':
        newFilters.dateRange = 'all';
        delete newFilters.customDateFrom;
        delete newFilters.customDateTo;
        break;
      case 'location':
        delete newFilters.location;
        break;
      case 'jobType':
        newFilters.jobType = 'all';
        break;
      case 'workMode':
        newFilters.workMode = 'all';
        break;
    }

    setSearchFilters(newFilters);
    if (searchQuery.trim().length >= 2) {
      // Use setTimeout to ensure state is updated before search
      setTimeout(() => {
        performGlobalSearch(searchQuery, newFilters);
      }, 0);
    }
  };

  const clearAllFilters = () => {
    const resetFilters = {
      type: 'all' as const,
      dateRange: 'all' as const,
      sortBy: 'relevance' as const,
      jobType: 'all' as const,
      workMode: 'all' as const
    };
    setSearchFilters(resetFilters);
    if (searchQuery.trim().length >= 2) {
      // Use setTimeout to ensure state is updated before search
      setTimeout(() => {
        performGlobalSearch(searchQuery, resetFilters);
      }, 0);
    }
  };

  // Group results by type
  const groupedResults = useMemo(() => {
    const groups: Record<string, typeof searchResults> = {};
    searchResults.forEach(result => {
      if (!groups[result.type]) {
        groups[result.type] = [];
      }
      groups[result.type].push(result);
    });
    return groups;
  }, [searchResults]);

  if (!showSearchModal) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[100] flex items-start justify-center pt-12 sm:pt-20 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="search-modal-title"
    >
      <Card ref={modalRef} className="w-full max-w-4xl bg-white rounded-xl shadow-2xl overflow-hidden animate-fade-up max-h-[90vh] flex flex-col">
        {/* Search Header Container */}
        <div className="p-4 border-b border-gray-200 flex-shrink-0">
          <h2 id="search-modal-title" className="sr-only">Global Search</h2>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                ref={inputRef}
                type="text"
                role="searchbox"
                aria-label="Global search input"
                aria-describedby="search-help-text"
                aria-autocomplete="list"
                aria-controls={showSuggestions ? "search-suggestions" : searchResults.length > 0 ? "search-results" : undefined}
                aria-expanded={showSuggestions || searchResults.length > 0}
                aria-activedescendant={selectedResultIndex >= 0 ? `result-${selectedResultIndex}` : selectedSuggestionIndex >= 0 ? `suggestion-${selectedSuggestionIndex}` : undefined}
                placeholder="Search posts, alumni, events, jobs..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                  // Show suggestions if we have them and query is valid
                  if (searchQuery.trim().length >= 2 && suggestions.length > 0) {
                    setShowSuggestions(true);
                  }
                }}
                onBlur={() => {
                  // Hide suggestions after a short delay to allow click events to fire
                  setTimeout(() => setShowSuggestions(false), 150);
                }}
                className="pl-10 pr-10 py-3 text-base border-0 focus-visible:ring-0"
                autoComplete="off"
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <Loader2 className="w-4 h-4 text-[#008060] animate-spin" />
                </div>
              )}
              {!isSearching && searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setShowSuggestions(false); // Hide suggestions when search button is clicked
                    if (searchQuery.trim().length >= 2) {
                      performGlobalSearch(searchQuery, searchFilters);
                    }
                  }}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1.5 text-[#008060] hover:bg-[#008060]/10 rounded-full transition-colors"
                  aria-label="Search"
                >
                  <Search className="w-4 h-4" />
                </button>
              )}

              {/* Typeahead Suggestions Dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div
                  id="search-suggestions"
                  role="listbox"
                  aria-label="Search suggestions"
                  className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-[110] overflow-hidden"
                >
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      id={`suggestion-${index}`}
                      role="option"
                      aria-selected={selectedSuggestionIndex === index}
                      className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-colors border-b last:border-0 border-gray-100 ${selectedSuggestionIndex === index
                        ? 'bg-[#008060]/10 text-[#008060] font-medium'
                        : 'hover:bg-gray-50 text-gray-700'
                        }`}
                      onMouseDown={(e) => {
                        // Prevent blur event from firing before click
                        e.preventDefault();
                      }}
                      onMouseEnter={() => setSelectedSuggestionIndex(index)}
                      onClick={() => {
                        setSearchQuery(suggestion);
                        performGlobalSearch(suggestion, searchFilters);
                        setShowSuggestions(false);
                        setSelectedSuggestionIndex(-1);
                      }}
                    >
                      <Search className="w-3.5 h-3.5 text-gray-400" />
                      <span>{suggestion}</span>
                      {selectedSuggestionIndex === index && (
                        <kbd className="ml-auto text-xs bg-white px-1.5 py-0.5 rounded border border-gray-300">Enter</kbd>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
              aria-label="Close search"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Category Tabs */}
          <div className="flex items-center gap-1 mt-4 overflow-x-auto pb-1 scrollbar-hide no-scrollbar">
            {[
              { id: 'all', label: 'All', icon: <Search className="w-3.5 h-3.5" /> },
              { id: 'alumni', label: 'Alumni', icon: <Users className="w-3.5 h-3.5" /> },
              { id: 'job', label: 'Jobs', icon: <Briefcase className="w-3.5 h-3.5" /> },
              { id: 'event', label: 'Events', icon: <Calendar className="w-3.5 h-3.5" /> },
              { id: 'post', label: 'Posts', icon: <FileText className="w-3.5 h-3.5" /> }
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  const newFilters = { ...searchFilters, type: cat.id as any };
                  setSearchFilters(newFilters);
                  if (searchQuery.trim().length >= 2) {
                    performGlobalSearch(searchQuery, newFilters);
                  }
                }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 border ${(searchFilters.type || 'all') === cat.id
                  ? 'bg-[#008060] text-white border-[#008060] shadow-md shadow-[#008060]/20'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-[#008060] hover:text-[#008060]'
                  }`}
              >
                {cat.icon}
                {cat.label}
              </button>
            ))}
          </div>

          {/* Filters & Sort Row */}
          <div className="flex items-center justify-between mt-4 gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap flex-1">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 border shadow-sm ${showFilters
                  ? 'bg-[#008060] text-white border-[#008060]'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-[#008060] hover:text-[#008060]'
                  }`}
              >
                <Filter className="w-3.5 h-3.5" />
                {showFilters ? 'Hide Filters' : 'More Filters'}
                {activeFilters.length > 0 && !showFilters && (
                  <Badge className="ml-0.5 bg-[#008060] text-white text-[10px] h-4 min-w-[16px] px-1 flex items-center justify-center border-none">
                    {activeFilters.length}
                  </Badge>
                )}
              </button>

              <div className="h-4 w-[1px] bg-gray-200 mx-1 hidden sm:block" />

              {activeFilters.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto max-w-full sm:max-w-md scrollbar-hide no-scrollbar">
                  {activeFilters.map(filter => (
                    filter.key !== 'type' && (
                      <FilterChip
                        key={filter.key}
                        label={filter.label}
                        icon={filter.icon}
                        onRemove={() => removeFilter(filter.key)}
                      />
                    )
                  ))}
                  {activeFilters.some(f => f.key !== 'type') && (
                    <button
                      onClick={clearAllFilters}
                      className="text-[10px] font-bold text-[#008060] hover:underline uppercase tracking-wider ml-1 whitespace-nowrap"
                    >
                      Reset
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-md border border-gray-100 mr-auto">
              <span className="hidden sm:inline">Press <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[10px] shadow-sm">Esc</kbd> to close</span>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Select
                value={searchFilters.sortBy || 'relevance'}
                onValueChange={(value) => {
                  const newFilters = { ...searchFilters, sortBy: value as any };
                  setSearchFilters(newFilters);
                  if (searchQuery.trim().length >= 2) {
                    performGlobalSearch(searchQuery, newFilters);
                  }
                }}
              >
                <SelectTrigger className="h-8 text-[11px] font-bold border-gray-200 hover:border-[#008060] rounded-lg bg-white w-[120px]">
                  <ArrowUpDown className="w-3 h-3 mr-1 text-gray-400" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[101]">
                  <SelectItem value="relevance">Relevance</SelectItem>
                  <SelectItem value="date">Newest First</SelectItem>
                  <SelectItem value="popularity">Popularity</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Intelligent Search Feedback */}
          {parsedIntent && (parsedIntent.intentType || parsedIntent.filters.location || parsedIntent.filters.batch) && (
            <div className="flex items-center gap-2 mt-4 px-3 py-2 bg-blue-50/50 rounded-xl animate-fade-in border border-blue-100/50">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-semibold text-blue-700">Smart View:</span>
                {parsedIntent.intentType && (
                  <Badge variant="outline" className="bg-blue-100/50 border-blue-200 text-blue-800 text-[10px] font-bold uppercase rounded-md">
                    {parsedIntent.intentType}s
                  </Badge>
                )}
                {parsedIntent.filters.location && (
                  <Badge variant="outline" className="bg-blue-100/50 border-blue-200 text-blue-800 text-[10px] font-bold uppercase rounded-md shadow-sm">
                    {parsedIntent.filters.location}
                  </Badge>
                )}
                {parsedIntent.filters.batch && (
                  <Badge variant="outline" className="bg-blue-100/50 border-blue-200 text-blue-800 text-[10px] font-bold uppercase rounded-md shadow-sm">
                    Batch {parsedIntent.filters.batch}
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Advanced Filters Panel */}
          {showFilters && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200 max-h-96 overflow-y-auto">
              <div className="space-y-4">
                {/* Location Filter */}
                <FilterSection title="Location" icon={<MapPin className="w-4 h-4" />}>
                  <Select
                    value={searchFilters.location || 'all'}
                    onValueChange={(value) => {
                      const newFilters = { ...searchFilters, location: value === 'all' ? undefined : value };
                      setSearchFilters(newFilters);
                      setShowFilters(false); // Close menu as requested
                      if (searchQuery.trim().length >= 2) {
                        performGlobalSearch(searchQuery, newFilters);
                      }
                    }}
                  >
                    <SelectTrigger className="h-9 text-sm w-full">
                      <SelectValue placeholder="Any location" />
                    </SelectTrigger>
                    <SelectContent className="z-[101]">
                      <SelectItem value="all">Any Location</SelectItem>
                      {filterOptions.locations.map(loc => (
                        <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FilterSection>

                {/* Date Range */}
                <FilterSection title="Date Range" icon={<Calendar className="w-4 h-4" />}>
                  <Select
                    value={searchFilters.dateRange || 'all'}
                    onValueChange={(value) => {
                      const newFilters = {
                        ...searchFilters,
                        dateRange: value as any,
                        ...(value !== 'custom' && { customDateFrom: undefined, customDateTo: undefined })
                      };
                      setSearchFilters(newFilters);
                      if (value !== 'custom') setShowFilters(false); // Close menu if not choosing dates
                      if (searchQuery.trim().length >= 2) {
                        performGlobalSearch(searchQuery, newFilters);
                      }
                    }}
                  >
                    <SelectTrigger className="h-9 text-sm w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[101]">
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="week">This Week</SelectItem>
                      <SelectItem value="month">This Month</SelectItem>
                      <SelectItem value="year">This Year</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>

                  {searchFilters.dateRange === 'custom' && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <Input
                        type="date"
                        value={searchFilters.customDateFrom || ''}
                        onChange={(e) => {
                          const newFilters = { ...searchFilters, customDateFrom: e.target.value };
                          setSearchFilters(newFilters);
                          if (searchQuery.trim().length >= 2 && e.target.value) {
                            performGlobalSearch(searchQuery, newFilters);
                          }
                        }}
                        className="h-9 text-sm"
                      />
                      <Input
                        type="date"
                        value={searchFilters.customDateTo || ''}
                        onChange={(e) => {
                          const newFilters = { ...searchFilters, customDateTo: e.target.value };
                          setSearchFilters(newFilters);
                          if (searchQuery.trim().length >= 2 && e.target.value) {
                            performGlobalSearch(searchQuery, newFilters);
                          }
                        }}
                        className="h-9 text-sm"
                      />
                    </div>
                  )}
                </FilterSection>

                {/* Batch Filter */}
                <FilterSection title="Graduation Year" icon={<Clock className="w-4 h-4" />}>
                  <Select
                    value={searchFilters.batch || 'all'}
                    onValueChange={(value) => {
                      const newFilters = { ...searchFilters, batch: value === 'all' ? undefined : value };
                      setSearchFilters(newFilters);
                      setShowFilters(false);
                      if (searchQuery.trim().length >= 2) {
                        performGlobalSearch(searchQuery, newFilters);
                      }
                    }}
                  >
                    <SelectTrigger className="h-9 text-sm w-full">
                      <SelectValue placeholder="Any batch" />
                    </SelectTrigger>
                    <SelectContent className="z-[101]">
                      <SelectItem value="all">Any Batch</SelectItem>
                      {filterOptions.batches.map(batch => (
                        <SelectItem key={batch} value={batch}>Class of {batch}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FilterSection>

                {/* Industry Filter (Dynamic) */}
                {filterOptions.industries.length > 0 && (
                  <FilterSection title="Industry" icon={<Briefcase className="w-4 h-4" />}>
                    <Select
                      value={searchFilters.industry || 'all'}
                      onValueChange={(value) => {
                        const newFilters = { ...searchFilters, industry: value === 'all' ? undefined : value };
                        setSearchFilters(newFilters);
                        setShowFilters(false);
                        if (searchQuery.trim().length >= 2) {
                          performGlobalSearch(searchQuery, newFilters);
                        }
                      }}
                    >
                      <SelectTrigger className="h-9 text-sm w-full">
                        <SelectValue placeholder="Any industry" />
                      </SelectTrigger>
                      <SelectContent className="z-[101]">
                        <SelectItem value="all">Any Industry</SelectItem>
                        {filterOptions.industries.map(ind => (
                          <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FilterSection>
                )}

                {/* Job Specific Filters */}
                {searchFilters.type === 'job' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FilterSection title="Job Type" icon={<FileText className="w-4 h-4" />}>
                      <Select
                        value={searchFilters.jobType || 'all'}
                        onValueChange={(value) => {
                          const newFilters = { ...searchFilters, jobType: value as any };
                          setSearchFilters(newFilters);
                          setShowFilters(false);
                          if (searchQuery.trim().length >= 2) {
                            performGlobalSearch(searchQuery, newFilters);
                          }
                        }}
                      >
                        <SelectTrigger className="h-9 text-sm w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-[101]">
                          <SelectItem value="all">Any Type</SelectItem>
                          {filterOptions.jobTypes.map(type => (
                            <SelectItem key={type} value={type}>{type.replace('-', ' ')}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FilterSection>

                    <FilterSection title="Work Mode" icon={<Home className="w-4 h-4" />}>
                      <Select
                        value={searchFilters.workMode || 'all'}
                        onValueChange={(value) => {
                          const newFilters = { ...searchFilters, workMode: value as any };
                          setSearchFilters(newFilters);
                          setShowFilters(false);
                          if (searchQuery.trim().length >= 2) {
                            performGlobalSearch(searchQuery, newFilters);
                          }
                        }}
                      >
                        <SelectTrigger className="h-9 text-sm w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-[101]">
                          <SelectItem value="all">Any Mode</SelectItem>
                          {filterOptions.workModes.map(mode => (
                            <SelectItem key={mode} value={mode}>{mode}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FilterSection>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Search Results or History Area */}
        <div className="flex-1 overflow-y-auto min-h-0 bg-gray-50/30">
          {isSearching ? (
            <div className="p-8 space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="animate-pulse flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-100">
                  <div className="w-12 h-12 bg-gray-100 rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-100 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-100 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : searchResults.length > 0 ? (
            <div className="p-4" id="search-results" role="region" aria-label="Search results" aria-live="polite">
              {/* Grouped Results */}
              {Object.entries(groupedResults).map(([type, results], groupIndex) => {
                // Calculate the global index for this group's results
                const previousResultsCount = Object.entries(groupedResults)
                  .slice(0, groupIndex)
                  .reduce((sum, [, prevResults]) => sum + prevResults.length, 0);

                return (
                  <div key={type} className="mb-6 last:mb-0">
                    <div className="flex items-center justify-between gap-2 px-3 py-2 bg-gray-50 rounded-t-lg border-x border-t border-gray-200 shadow-sm">
                      <div className="flex items-center gap-2">
                        <div className="p-1 bg-white rounded shadow-sm">
                          {getResultIcon(type)}
                        </div>
                        <h3 className="text-[11px] font-extrabold text-gray-700 uppercase tracking-widest">
                          {type === 'alumni' ? 'Alumni' : type === 'post' ? 'Feed Posts' : type === 'job' ? 'Career Opportunities' : type === 'command' ? 'Quick Actions' : type}
                        </h3>
                      </div>
                      <Badge variant="secondary" className="bg-white border-gray-200 text-gray-500 text-[10px] px-1.5 py-0 font-bold shadow-sm">
                        {results.length}
                      </Badge>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-b-lg overflow-hidden divide-y divide-gray-100">
                      {results.map((result, resultIndex) => {
                        const globalIndex = previousResultsCount + resultIndex;
                        const isSelected = selectedResultIndex === globalIndex;

                        return (
                          <button
                            key={`${result.type}-${result.id}`}
                            ref={(el) => {
                              resultRefs.current[globalIndex] = el;
                            }}
                            onClick={(e) => {
                              if (e.ctrlKey || e.metaKey) {
                                window.open(result.url, '_blank');
                              } else {
                                handleResultClick(result, globalIndex);
                              }
                            }}
                            onMouseEnter={() => setSelectedResultIndex(globalIndex)}
                            className={`w-full p-4 flex items-start gap-4 text-left transition-all group ${isSelected
                              ? 'bg-[#008060]/5 border-l-4 border-l-[#008060]'
                              : 'hover:bg-gray-50'
                              }`}
                          >
                            {result.type === 'alumni' ? (
                              <div className="flex-shrink-0">
                                {result.image ? (
                                  <img src={result.image} alt="" className="w-12 h-12 rounded-full object-cover ring-2 ring-white shadow-sm" />
                                ) : (
                                  <div className="w-12 h-12 bg-gradient-to-br from-[#008060] to-[#005c45] rounded-full flex items-center justify-center shadow-sm">
                                    <span className="text-white font-bold text-lg">
                                      {result.title?.split(' ')?.[0]?.[0]?.toUpperCase()}
                                    </span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="mt-1 p-2 bg-gray-50 rounded-lg text-[#008060] group-hover:bg-[#008060]/10 transition-colors">
                                {getResultIcon(result.type, result.icon)}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-gray-900 truncate group-hover:text-[#008060] transition-colors">{result.title}</span>
                              </div>
                              <p className="text-sm text-gray-500 line-clamp-2">{result.description}</p>
                            </div>

                            {/* Quick Actions for Results */}
                            <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                              {result.type === 'alumni' && result.connectionStatus !== 'self' && (
                                <>
                                  {result.connectionStatus === 'none' && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8 px-2 text-xs border-[#008060] text-[#008060] hover:bg-[#008060]/5 rounded-lg flex items-center gap-1"
                                      onClick={(e) => handleConnect(e, result.id)}
                                    >
                                      <UserPlus className="w-3.5 h-3.5" />
                                      Connect
                                    </Button>
                                  )}
                                  {result.connectionStatus === 'pending' && (
                                    <Badge variant="secondary" className="h-8 px-2 text-[10px] bg-amber-50 text-amber-700 border-amber-200 rounded-lg">
                                      {result.isRequester ? 'Pending Sent' : 'Pending Action'}
                                    </Badge>
                                  )}
                                  {result.connectionStatus === 'accepted' && (
                                    <div className="flex items-center gap-1.5">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 px-2 text-xs rounded-lg flex items-center gap-1"
                                        onClick={(e) => handleMessage(e, result.id)}
                                      >
                                        <Send className="w-3.5 h-3.5" />
                                        Message
                                      </Button>
                                      <Badge variant="secondary" className="h-8 px-2 text-[10px] bg-[#008060]/10 text-[#008060] border-transparent rounded-lg">
                                        <CheckCircle2 className="w-3 h-3 mr-1" />
                                        Connected
                                      </Badge>
                                    </div>
                                  )}
                                </>
                              )}

                              {result.type === 'job' && (
                                <>
                                  <Button
                                    variant={result.isApplied ? "ghost" : "outline"}
                                    size="sm"
                                    disabled={result.isApplied}
                                    className={`h-8 px-2 text-xs rounded-lg flex items-center gap-1 ${result.isApplied ? 'text-gray-400' : 'border-[#008060] text-[#008060] hover:bg-[#008060]/5'}`}
                                    onClick={(e) => handleApply(e, result.id)}
                                  >
                                    {result.isApplied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Briefcase className="w-3.5 h-3.5" />}
                                    {result.isApplied ? 'Applied' : 'Apply'}
                                  </Button>
                                  {!result.isApplied && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className={`h-8 w-8 p-0 rounded-lg ${result.isSaved ? 'text-amber-500 hover:text-amber-600' : 'text-gray-400 hover:text-gray-600'}`}
                                      onClick={(e) => handleSaveJob(e, result.id)}
                                    >
                                      {result.isSaved ? <Bookmark className="w-4 h-4 fill-current" /> : <Bookmark className="w-4 h-4" />}
                                    </Button>
                                  )}
                                </>
                              )}

                              {result.type === 'command' && (
                                <div className="flex items-center gap-1.5 text-[#008060] bg-[#008060]/5 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">
                                  <SquareArrowOutUpRight className="w-3 h-3" />
                                  Go
                                </div>
                              )}
                            </div>

                            {result.type !== 'alumni' && result.type !== 'command' && result.image && (
                              <img src={result.image} alt="" className="ml-2 w-16 h-16 rounded-lg object-cover flex-shrink-0 shadow-sm border border-gray-100" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : searchQuery.trim().length > 0 && searchQuery.trim().length < 2 ? (
            <div className="p-12 text-center">
              <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-600 font-medium italic">Keep typing...</p>
              <p className="text-sm text-gray-400 mt-1">Type at least 2 characters to trigger search</p>
            </div>
          ) : searchQuery ? (
            <div className="p-12 text-center">
              <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-8 h-8 text-red-200" />
              </div>
              <p className="text-gray-600 font-bold mb-2">No matches found for "{searchQuery}"</p>

              {didYouMean && (
                <div className="mt-6 p-6 bg-white rounded-2xl border border-gray-100 shadow-sm inline-block max-w-sm">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-widest mb-3">Did you mean?</p>
                  <button
                    onClick={() => {
                      handleSearch(didYouMean);
                      performGlobalSearch(didYouMean, searchFilters);
                    }}
                    className="flex items-center gap-3 px-6 py-3 bg-[#008060]/5 hover:bg-[#008060]/10 text-[#008060] font-bold rounded-xl transition-all group"
                  >
                    <Search className="w-4 h-4" />
                    <span className="text-lg">{didYouMean}</span>
                    <TrendingUp className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </div>
              )}

              <p className="text-sm text-gray-400 mt-6 max-w-md mx-auto">
                Try using more general keywords or removing filters to expand your search.
              </p>
            </div>
          ) : searchHistory.length > 0 ? (
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" />
                  Recent Searches
                </h3>
                <button
                  onClick={clearHistory}
                  className="text-[10px] font-bold text-red-400 hover:text-red-500 uppercase tracking-wider"
                >
                  Clear History
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {searchHistory.map((query, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      handleSearch(query);
                      performGlobalSearch(query, searchFilters);
                    }}
                    className="p-3 hover:bg-white hover:shadow-sm hover:border-gray-200 border border-transparent rounded-xl flex items-center gap-3 text-left transition-all group"
                  >
                    <div className="p-1.5 bg-gray-100 rounded-lg group-hover:bg-[#008060]/10 group-hover:text-[#008060] transition-colors">
                      <Search className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-sm text-gray-700 font-medium">{query}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-16 text-center">
              <div className="w-24 h-24 bg-gradient-to-br from-[#008060]/10 to-[#005c45]/10 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                <Search className="w-10 h-10 text-[#008060] relative z-10" />
                <div className="absolute inset-0 rounded-full animate-ping bg-[#008060]/5"></div>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Search Excellence</h2>
              <p className="text-gray-500 max-w-sm mx-auto mb-8">
                Discover alumni, jobs, events, and posts with our new intelligent natural language search.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <div className="px-4 py-2 bg-gray-100 rounded-full text-xs text-gray-600 font-medium border border-gray-200">
                  "Alumni in Mumbai"
                </div>
                <div className="px-4 py-2 bg-gray-100 rounded-full text-xs text-gray-600 font-medium border border-gray-200">
                  "Software jobs in 2024"
                </div>
                <div className="px-4 py-2 bg-gray-100 rounded-full text-xs text-gray-600 font-medium border border-gray-200">
                  "Events this month"
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
