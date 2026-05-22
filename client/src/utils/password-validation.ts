/**
 * Password validation utilities for frontend and backend
 * Following security best practices and industry standards
 */

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

// Common weak passwords to reject
const COMMON_PASSWORDS = [
  "password",
  "password123",
  "12345678",
  "123456789",
  "1234567890",
  "qwerty123",
  "abc123456",
  "password1",
  "welcome123",
  "admin123",
  "letmein",
  "monkey",
  "dragon",
  "master",
  "sunshine",
  "princess",
  "football",
  "baseball",
  "welcome",
  "login",
  "admin",
  "qwerty",
  "123456",
  "1234567890",
];

/**
 * Check for sequential characters (e.g., "12345", "abcde")
 */
function hasSequentialChars(str: string, minLength: number = 3): boolean {
  const sequences = [
    "0123456789",
    "abcdefghijklmnopqrstuvwxyz",
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    "qwertyuiop",
    "asdfghjkl",
    "zxcvbnm",
  ];

  for (const seq of sequences) {
    for (let i = 0; i <= seq.length - minLength; i++) {
      const subSeq = seq.substring(i, i + minLength);
      if (str.toLowerCase().includes(subSeq.toLowerCase())) {
        return true;
      }
      // Check reverse
      const revSeq = subSeq.split("").reverse().join("");
      if (str.toLowerCase().includes(revSeq.toLowerCase())) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Check for repeated characters (e.g., "aaaaaa", "111111")
 */
function hasRepeatedChars(str: string, minRepeat: number = 3): boolean {
  const regex = new RegExp(`(.)\\1{${minRepeat - 1},}`, "i");
  return regex.test(str);
}

/**
 * Check if password contains common patterns
 */
function isCommonPassword(password: string): boolean {
  const lowerPassword = password.toLowerCase();
  return COMMON_PASSWORDS.some((common) => lowerPassword.includes(common.toLowerCase()));
}

/**
 * Validate password strength with comprehensive security standards
 * Requirements:
 * - Minimum 8 characters (industry standard)
 * - Maximum 128 characters (prevent DoS attacks)
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 * - No common passwords
 * - No sequential characters (3+ consecutive)
 * - No repeated characters (3+ same char)
 */
export function validatePassword(
  password: string,
  options?: {
    checkCommon?: boolean;
    checkSequential?: boolean;
    checkRepeated?: boolean;
    minLength?: number;
    maxLength?: number;
  }
): PasswordValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const {
    checkCommon = true,
    checkSequential = true,
    checkRepeated = true,
    minLength = 8,
    maxLength = 128,
  } = options || {};

  if (!password) {
    return { isValid: false, errors: ["Password is required"] };
  }

  // Length validation
  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  }

  if (password.length > maxLength) {
    errors.push(`Password must not exceed ${maxLength} characters`);
  }

  // Character type validation
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter (a-z)");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter (A-Z)");
  }

  if (!/\d/.test(password)) {
    errors.push("Password must contain at least one number (0-9)");
  }

  // Special character validation - expanded set
  const specialChars = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;
  if (!specialChars.test(password)) {
    errors.push(
      "Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;':\",./<>?`~)"
    );
  }

  // Additional security checks
  if (checkCommon && isCommonPassword(password)) {
    errors.push("Password is too common. Please choose a more unique password");
  }

  if (checkSequential && hasSequentialChars(password, 3)) {
    errors.push("Password contains sequential characters (e.g., '123', 'abc'). Please avoid predictable patterns");
  }

  if (checkRepeated && hasRepeatedChars(password, 3)) {
    errors.push("Password contains repeated characters (e.g., 'aaa', '111'). Please use more variety");
  }

  // Warnings for weak but valid passwords
  if (password.length >= minLength && password.length < 12) {
    warnings.push("Consider using a longer password (12+ characters) for better security");
  }

  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]{2,}/.test(password)) {
    warnings.push("Using multiple special characters increases password strength");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Get password strength indicator with detailed scoring
 */
export function getPasswordStrength(password: string): {
  strength: "weak" | "medium" | "strong" | "very-strong";
  score: number;
  percentage: number;
  feedback: string[];
} {
  if (!password) {
    return {
      strength: "weak",
      score: 0,
      percentage: 0,
      feedback: ["Enter a password to see strength"],
    };
  }

  let score = 0;
  const feedback: string[] = [];

  // Length scoring (0-3 points)
  if (password.length >= 8) {
    score += 1;
    feedback.push("✓ Minimum length met");
  } else {
    feedback.push("✗ Too short (need 8+ characters)");
  }
  if (password.length >= 12) {
    score += 1;
    feedback.push("✓ Good length");
  }
  if (password.length >= 16) {
    score += 1;
    feedback.push("✓ Excellent length");
  }

  // Character variety (0-4 points)
  if (/[a-z]/.test(password)) {
    score += 1;
    feedback.push("✓ Contains lowercase letters");
  } else {
    feedback.push("✗ Missing lowercase letters");
  }

  if (/[A-Z]/.test(password)) {
    score += 1;
    feedback.push("✓ Contains uppercase letters");
  } else {
    feedback.push("✗ Missing uppercase letters");
  }

  if (/\d/.test(password)) {
    score += 1;
    feedback.push("✓ Contains numbers");
  } else {
    feedback.push("✗ Missing numbers");
  }

  const specialCharCount = (password.match(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/g) || []).length;
  if (specialCharCount > 0) {
    score += 1;
    if (specialCharCount >= 2) {
      score += 0.5; // Bonus for multiple special chars
      feedback.push("✓ Contains multiple special characters");
    } else {
      feedback.push("✓ Contains special characters");
    }
  } else {
    feedback.push("✗ Missing special characters");
  }

  // Complexity bonuses
  if (password.length >= 12 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && specialCharCount > 0) {
    score += 1; // Bonus for meeting all requirements
  }

  // Penalties
  if (isCommonPassword(password)) {
    score -= 2;
    feedback.push("⚠ Common password detected");
  }

  if (hasSequentialChars(password, 3)) {
    score -= 1;
    feedback.push("⚠ Contains sequential patterns");
  }

  if (hasRepeatedChars(password, 3)) {
    score -= 1;
    feedback.push("⚠ Contains repeated characters");
  }

  // Normalize score (0-10 scale)
  score = Math.max(0, Math.min(10, score));
  const percentage = Math.round((score / 10) * 100);

  let strength: "weak" | "medium" | "strong" | "very-strong";
  if (score <= 3) {
    strength = "weak";
  } else if (score <= 5) {
    strength = "medium";
  } else if (score <= 7) {
    strength = "strong";
  } else {
    strength = "very-strong";
  }

  return {
    strength,
    score: Math.round(score),
    percentage,
    feedback: feedback.filter((f) => !f.startsWith("✗") || score <= 3), // Only show errors for weak passwords
  };
}
