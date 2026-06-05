/**
 * Get base URL consistently across the application
 * Handles production, development, and Railway deployment scenarios
 */
export function getBaseUrl(): string {
  let baseUrl: string;

  // Prioritize environment variable if set
  if (process.env.BASE_URL) {
    baseUrl = process.env.BASE_URL.trim();
  } else if (process.env.NODE_ENV === "production") {
    // In production, BASE_URL MUST be set. This fallback is a last-resort placeholder.
    console.warn('⚠️ WARNING: BASE_URL env var is not set in production! OAuth, emails, and Socket.IO CORS will be broken. Set BASE_URL=https://yourdomain.com');
    baseUrl = `http://localhost:${process.env.PORT || 5000}`;
  } else {
    // In development or other cases, default to localhost
    baseUrl = `http://localhost:${process.env.PORT || 5000}`;
  }

  // Clean up baseUrl: remove trailing slash and whitespace
  baseUrl = baseUrl.trim().replace(/\/+$/, "");

  return baseUrl;
}
