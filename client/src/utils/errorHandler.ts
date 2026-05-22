/**
 * Centralized error handling utilities
 * Provides consistent error handling across all pages
 */

export interface ErrorInfo {
  message: string;
  code?: string;
  statusCode?: number;
  details?: any;
}

/**
 * Parse error from API response or Error object
 */
export function parseError(error: unknown): ErrorInfo {
  // If it's already an ErrorInfo object
  if (error && typeof error === 'object' && 'message' in error) {
    return error as ErrorInfo;
  }
  
  // If it's an Error object
  if (error instanceof Error) {
    return {
      message: error.message,
      code: error.name
    };
  }
  
  // If it's a string
  if (typeof error === 'string') {
    return { message: error };
  }
  
  // Default fallback
  return {
    message: 'An unexpected error occurred. Please try again.'
  };
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyError(error: unknown): string {
  const errorInfo = parseError(error);
  
  // Map common error codes to user-friendly messages
  const errorMessages: Record<string, string> = {
    'NetworkError': 'Network connection failed. Please check your internet connection.',
    'TimeoutError': 'Request timed out. Please try again.',
    'ValidationError': errorInfo.message,
    'AuthenticationError': 'Please log in to continue.',
    'AuthorizationError': 'You do not have permission to perform this action.',
    'NotFoundError': 'The requested resource was not found.',
    'ServerError': 'Server error occurred. Please try again later.',
    'RateLimitError': 'Too many requests. Please wait a moment and try again.'
  };
  
  if (errorInfo.code && errorMessages[errorInfo.code]) {
    return errorMessages[errorInfo.code];
  }
  
  // Check status codes
  if (errorInfo.statusCode) {
    switch (errorInfo.statusCode) {
      case 400:
        return errorInfo.message || 'Invalid request. Please check your input.';
      case 401:
        return 'Please log in to continue.';
      case 403:
        return 'You do not have permission to perform this action.';
      case 404:
        return 'The requested resource was not found.';
      case 429:
        return 'Too many requests. Please wait a moment and try again.';
      case 500:
        // Use server message when it's a known user-facing message (e.g. signup request failure)
        if (errorInfo.message && errorInfo.message.length < 120 && !errorInfo.message.includes('Internal Server Error')) {
          return errorInfo.message;
        }
        return 'Server error occurred. Please try again later.';
      case 503:
        return 'Service temporarily unavailable. Please try again later.';
      default:
        return errorInfo.message || 'An error occurred. Please try again.';
    }
  }
  
  return errorInfo.message || 'An unexpected error occurred. Please try again.';
}

/**
 * Log error for monitoring (can be extended to send to error tracking service)
 */
export function logError(error: unknown, context?: string): void {
  const errorInfo = parseError(error);
  
  console.error('[Error Handler]', {
    context,
    message: errorInfo.message,
    code: errorInfo.code,
    statusCode: errorInfo.statusCode,
    details: errorInfo.details,
    timestamp: new Date().toISOString()
  });
  
  // TODO: Send to error tracking service (e.g., Sentry)
  // if (window.Sentry) {
  //   window.Sentry.captureException(error, { extra: { context } });
  // }
}

/**
 * Handle API error response
 */
export async function handleAPIError(response: Response): Promise<ErrorInfo> {
  let errorData: any;
  
  try {
    errorData = await response.json();
  } catch {
    errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
  }
  
  return {
    message: errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`,
    code: errorData.code,
    statusCode: response.status,
    details: errorData
  };
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options?: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    retryable?: (error: unknown) => boolean;
  }
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    retryable = () => true
  } = options || {};
  
  let lastError: unknown;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry if it's the last attempt or error is not retryable
      if (attempt === maxRetries || !retryable(error)) {
        throw error;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  const errorInfo = parseError(error);
  
  // Network errors are retryable
  if (errorInfo.code === 'NetworkError' || errorInfo.code === 'TimeoutError') {
    return true;
  }
  
  // 5xx errors are retryable
  if (errorInfo.statusCode && errorInfo.statusCode >= 500 && errorInfo.statusCode < 600) {
    return true;
  }
  
  // 429 (Rate Limit) is retryable
  if (errorInfo.statusCode === 429) {
    return true;
  }
  
  return false;
}
