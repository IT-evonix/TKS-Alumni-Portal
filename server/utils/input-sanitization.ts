// Input sanitization utilities for security
// Prevents SQL injection, XSS attacks, and validates input formats

/**
 * Sanitize string input by trimming and removing dangerous characters
 * @param input - The input string to sanitize
 * @param maxLength - Maximum allowed length (default: 1000)
 * @returns Sanitized string
 */
export function sanitizeString(input: string | undefined | null, maxLength: number = 1000): string {
  if (!input) return '';
  
  // Convert to string and trim
  let sanitized = String(input).trim();
  
  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  return sanitized;
}

/**
 * Sanitize email address
 * @param email - Email address to sanitize
 * @returns Sanitized email (lowercase, trimmed)
 */
export function sanitizeEmail(email: string | undefined | null): string {
  if (!email) return '';
  return String(email).trim().toLowerCase();
}

/**
 * Sanitize phone number (removes all non-digit characters except +)
 * @param phone - Phone number to sanitize
 * @returns Sanitized phone number
 */
export function sanitizePhone(phone: string | undefined | null): string {
  if (!phone) return '';
  // Keep only digits, spaces, +, -, and parentheses
  return String(phone).replace(/[^\d\s+\-()]/g, '');
}

/**
 * Sanitize name (allows only letters, spaces, hyphens, apostrophes)
 * @param name - Name to sanitize
 * @returns Sanitized name
 */
export function sanitizeName(name: string | undefined | null): string {
  if (!name) return '';
  // Remove any characters that aren't letters, spaces, hyphens, or apostrophes
  return String(name).replace(/[^A-Za-z\s'-]/g, '').trim();
}

/**
 * Validate and sanitize integer
 * @param value - Value to validate and sanitize
 * @param min - Minimum allowed value (optional)
 * @param max - Maximum allowed value (optional)
 * @returns Parsed integer or null if invalid
 */
export function sanitizeInteger(
  value: string | number | undefined | null,
  min?: number,
  max?: number
): number | null {
  if (value === undefined || value === null || value === '') return null;
  
  const num = typeof value === 'string' ? parseInt(value, 10) : Math.floor(Number(value));
  
  if (isNaN(num)) return null;
  
  if (min !== undefined && num < min) return null;
  if (max !== undefined && num > max) return null;
  
  return num;
}

/**
 * Validate email format
 * @param email - Email to validate
 * @returns true if valid email format
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
}

/**
 * Validate name format (letters, spaces, hyphens, apostrophes only)
 * @param name - Name to validate
 * @param minLength - Minimum length (default: 2)
 * @param maxLength - Maximum length (default: 50)
 * @returns true if valid name format
 */
export function isValidName(name: string, minLength: number = 2, maxLength: number = 50): boolean {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (trimmed.length < minLength || trimmed.length > maxLength) return false;
  const nameRegex = /^[A-Za-z\s'-]+$/;
  return nameRegex.test(trimmed);
}

/**
 * Escape HTML to prevent XSS attacks
 * @param text - Text to escape
 * @returns Escaped HTML string
 */
export function escapeHtml(text: string | undefined | null): string {
  if (!text) return '';
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return String(text).replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Validate URL format
 * @param url - URL to validate
 * @returns true if valid URL format
 */
export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    // If URL constructor fails, try regex
    const urlRegex = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i;
    return urlRegex.test(url.trim());
  }
}
