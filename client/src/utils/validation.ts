/**
 * Comprehensive client-side validation utilities
 * Provides consistent validation across all pages
 */
import DOMPurify from "isomorphic-dompurify";

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
}

/**
 * Sanitize string input to prevent XSS attacks
 */
export function sanitizeString(input: string | undefined | null, maxLength: number = 1000): string {
  if (!input) return '';

  // Use DOMPurify to strip all HTML/XSS vectors, then limit length
  const sanitized = DOMPurify.sanitize(String(input).trim(), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });

  return sanitized.length > maxLength ? sanitized.substring(0, maxLength) : sanitized;
}

/**
 * Validate and sanitize email address
 */
export function validateEmail(email: string | undefined | null): ValidationResult {
  if (!email || !email.trim()) {
    return { isValid: false, error: 'Email is required' };
  }

  const trimmed = email.trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  if (!emailRegex.test(trimmed)) {
    return { isValid: false, error: 'Please enter a valid email address' };
  }

  if (trimmed.length > 254) {
    return { isValid: false, error: 'Email address is too long' };
  }

  return { isValid: true };
}

/**
 * Validate name (first name, last name, etc.)
 */
export function validateName(
  name: string | undefined | null,
  fieldName: string = 'Name',
  minLength: number = 2,
  maxLength: number = 50
): ValidationResult {
  if (!name || !name.trim()) {
    return { isValid: false, error: `${fieldName} is required` };
  }

  const trimmed = name.trim();

  if (trimmed.length < minLength) {
    return { isValid: false, error: `${fieldName} must be at least ${minLength} characters` };
  }

  if (trimmed.length > maxLength) {
    return { isValid: false, error: `${fieldName} must be less than ${maxLength} characters` };
  }

  const nameRegex = /^[A-Za-z\s'-]+$/;
  if (!nameRegex.test(trimmed)) {
    return { isValid: false, error: `${fieldName} should contain only letters, spaces, hyphens, and apostrophes` };
  }

  return { isValid: true };
}

/**
 * Validate URL (LinkedIn, website, etc.)
 */
export function validateURL(url: string | undefined | null, allowEmpty: boolean = true): ValidationResult {
  if (!url || !url.trim()) {
    if (allowEmpty) {
      return { isValid: true };
    }
    return { isValid: false, error: 'URL is required' };
  }

  const trimmed = url.trim();

  if (trimmed.includes(' ')) {
    return { isValid: false, error: 'URL must not contain spaces' };
  }

  // Regex for basic domain matching (requires at least one dot in the domain part)
  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/;

  try {
    const urlObj = new URL(trimmed);
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return { isValid: false, error: 'URL must start with http:// or https://' };
    }

    // Check if the hostname has a valid structure
    if ((!urlObj.hostname.includes('.') || urlObj.hostname.endsWith('.')) && urlObj.hostname !== 'localhost') {
      return { isValid: false, error: 'Please enter a valid domain' };
    }

    // Additional strict check
    if (!domainRegex.test(urlObj.hostname)) {
      if (urlObj.hostname !== 'localhost') {
        return { isValid: false, error: 'Please enter a valid domain name' };
      }
    }

    return { isValid: true };
  } catch {
    // If URL constructor fails, try adding https://
    try {
      // We don't automatically add https here for generalized URL validation as it might mask intent, 
      // but for user convenience we often do. However, for "Advanced" validation, we might want to be strict.
      // But validateWebsiteURL does add it. 
      // The original code tried adding https via try-catch fallback.

      const potentialUrl = `https://${trimmed}`;
      const urlObj = new URL(potentialUrl);

      // We need to apply the same strict checks to the fallback
      if ((!urlObj.hostname.includes('.') || urlObj.hostname.endsWith('.')) && urlObj.hostname !== 'localhost') {
        return { isValid: false, error: 'Please enter a valid URL' };
      }
      if (!domainRegex.test(urlObj.hostname) && urlObj.hostname !== 'localhost') {
        return { isValid: false, error: 'Please enter a valid domain name' };
      }

      return { isValid: true, warnings: ['Consider including https:// in your URL'] };
    } catch {
      return { isValid: false, error: 'Please enter a valid URL' };
    }
  }
}

/**
 * Validate LinkedIn URL specifically
 */
export function validateLinkedInURL(url: string | undefined | null): ValidationResult {
  if (!url || !url.trim()) {
    return { isValid: true }; // LinkedIn URL is optional
  }

  const trimmed = url.trim();
  const linkedinRegex = /^(https?:\/\/)?(www\.)?linkedin\.com\/(in|pub|company|school)\/[a-zA-Z0-9-]+\/?$/i;

  if (!linkedinRegex.test(trimmed)) {
    return { isValid: false, error: 'Please enter a valid LinkedIn profile URL (e.g., https://linkedin.com/in/username)' };
  }

  return { isValid: true };
}

/**
 * Validate GitHub URL
 */
export function validateGitHubURL(url: string | undefined | null): ValidationResult {
  if (!url || !url.trim()) {
    return { isValid: true }; // GitHub URL is optional
  }

  const trimmed = url.trim();
  const githubRegex = /^(https?:\/\/)?(www\.)?github\.com\/[a-zA-Z0-9]([a-zA-Z0-9]|-(?![.-])){0,38}\/?$/i;

  if (githubRegex.test(trimmed)) {
    return { isValid: true };
  }

  return { isValid: false, error: 'Please enter a full, valid GitHub URL (e.g., https://github.com/username)' };
}

/**
 * Validate Twitter/X URL
 */
export function validateTwitterURL(url: string | undefined | null): ValidationResult {
  if (!url || !url.trim()) {
    return { isValid: true }; // Twitter URL is optional
  }

  const trimmed = url.trim();
  const twitterRegex = /^(https?:\/\/)?(www\.)?(twitter\.com|x\.com)\/[a-zA-Z0-9_]{1,15}\/?$/i;

  if (twitterRegex.test(trimmed)) {
    return { isValid: true };
  }

  return { isValid: false, error: 'Please enter a full, valid Twitter/X URL (e.g., https://x.com/username)' };
}

/**
 * Validate personal website URL
 */
export function validateWebsiteURL(url: string | undefined | null): ValidationResult {
  if (!url || !url.trim()) {
    return { isValid: true }; // Website URL is optional
  }

  const trimmed = url.trim();

  if (trimmed.includes(' ')) {
    return { isValid: false, error: 'URL must not contain spaces' };
  }

  // Regex for basic domain matching (requires at least one dot in the domain part)
  // This prevents inputs like "vf" or "localhost" (unless strictly allowed) from being accepted as global websites
  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/;

  try {
    // Try to parse as URL
    let urlToCheck = trimmed;
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      urlToCheck = 'https://' + trimmed;
    }
    const urlObj = new URL(urlToCheck);

    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return { isValid: false, error: 'URL must start with http:// or https://' };
    }

    // Check if the hostname has a valid structure (at least one dot for TLD)
    // We explicitly allow 'localhost' for development purposes
    if ((!urlObj.hostname.includes('.') || urlObj.hostname.endsWith('.')) && urlObj.hostname !== 'localhost') {
      return { isValid: false, error: 'Please enter a valid website domain (e.g., example.com)' };
    }

    // Additional strict check: hostname should look like a domain
    if (!domainRegex.test(urlObj.hostname)) {
      // Allow for localhost during dev maybe? user said "advanced", assuming production grade validation
      if (urlObj.hostname !== 'localhost') {
        return { isValid: false, error: 'Please enter a valid domain name' };
      }
    }

    return { isValid: true };
  } catch {
    return { isValid: false, error: 'Please enter a valid website URL (e.g., https://example.com)' };
  }
}

/**
 * Validate year (graduation year, etc.)
 */
export function validateYear(
  year: string | number | undefined | null,
  minYear: number = 2018,
  maxYear?: number
): ValidationResult {
  if (!year) {
    return { isValid: false, error: 'Year is required' };
  }

  const yearNum = typeof year === 'string' ? parseInt(year, 10) : Math.floor(Number(year));
  const currentYear = new Date().getFullYear();
  const max = maxYear || currentYear + 10;

  if (isNaN(yearNum)) {
    return { isValid: false, error: 'Please enter a valid year' };
  }

  if (yearNum < minYear) {
    return { isValid: false, error: `Year cannot be earlier than ${minYear}` };
  }

  if (yearNum > max) {
    return { isValid: false, error: `Year cannot be later than ${max}` };
  }

  return { isValid: true };
}

/**
 * Validate text length (bio, description, etc.)
 */
export function validateTextLength(
  text: string | undefined | null,
  fieldName: string = 'Text',
  minLength: number = 0,
  maxLength: number = 5000
): ValidationResult {
  if (!text) {
    if (minLength > 0) {
      return { isValid: false, error: `${fieldName} is required` };
    }
    return { isValid: true };
  }

  const trimmed = text.trim();

  if (trimmed.length < minLength) {
    return { isValid: false, error: `${fieldName} must be at least ${minLength} characters` };
  }

  if (trimmed.length > maxLength) {
    return { isValid: false, error: `${fieldName} must be less than ${maxLength} characters` };
  }

  return { isValid: true };
}

/**
 * Validate number (years of experience, etc.)
 */
export function validateNumber(
  value: string | number | undefined | null,
  fieldName: string = 'Number',
  min?: number,
  max?: number,
  allowDecimals: boolean = false
): ValidationResult {
  if (value === undefined || value === null || value === '') {
    return { isValid: false, error: `${fieldName} is required` };
  }

  const num = typeof value === 'string'
    ? (allowDecimals ? parseFloat(value) : parseInt(value, 10))
    : (allowDecimals ? Number(value) : Math.floor(Number(value)));

  if (isNaN(num)) {
    return { isValid: false, error: `Please enter a valid ${fieldName.toLowerCase()}` };
  }

  if (min !== undefined && num < min) {
    return { isValid: false, error: `${fieldName} must be at least ${min}` };
  }

  if (max !== undefined && num > max) {
    return { isValid: false, error: `${fieldName} must not exceed ${max}` };
  }

  return { isValid: true };
}

/**
 * Validate required field
 */
export function validateRequired(
  value: string | number | boolean | undefined | null,
  fieldName: string = 'Field'
): ValidationResult {
  if (value === undefined || value === null || value === '') {
    return { isValid: false, error: `${fieldName} is required` };
  }

  if (typeof value === 'string' && !value.trim()) {
    return { isValid: false, error: `${fieldName} is required` };
  }

  return { isValid: true };
}

/**
 * Validate file upload
 */
export function validateFile(
  file: File | undefined | null,
  options?: {
    maxSizeMB?: number;
    allowedTypes?: string[];
    required?: boolean;
  }
): ValidationResult {
  const {
    maxSizeMB = 5,
    allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    required = false
  } = options || {};

  if (!file) {
    if (required) {
      return { isValid: false, error: 'File is required' };
    }
    return { isValid: true };
  }

  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  if (file.size > maxSizeBytes) {
    return { isValid: false, error: `File size must be less than ${maxSizeMB}MB` };
  }

  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    return { isValid: false, error: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}` };
  }

  return { isValid: true };
}

/**
 * Escape HTML to prevent XSS
 */
export function escapeHTML(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };

  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Validate form data object
 */
export function validateForm<T extends Record<string, any>>(
  formData: T,
  validators: {
    [K in keyof T]?: (value: T[K]) => ValidationResult;
  }
): { isValid: boolean; errors: Partial<Record<keyof T, string>> } {
  const errors: Partial<Record<keyof T, string>> = {};

  for (const [key, validator] of Object.entries(validators)) {
    const fieldKey = key as keyof T;
    const value = formData[fieldKey];
    const result = validator!(value);

    if (!result.isValid && result.error) {
      errors[fieldKey] = result.error;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}
