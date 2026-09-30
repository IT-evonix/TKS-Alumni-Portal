/**
 * Pure field/step validation for the student signup wizard (no React, no DOM).
 * Server rules live in server/utils/student-signup-validation.ts; keep them in sync.
 */
import { validateName, validateEmail, validateYear } from "./validation";
import { parsePhoneNumber, validatePhoneNumber, COUNTRY_CODES } from "./phoneValidation";
import { validateConfirmPassword } from "./signupValidation";

export const MIN_GRADUATION_YEAR = 2018;
export const ALLOWED_GENDERS = ["male", "female", "other", "prefer_not_to_say"] as const;

export type StudentSignupField =
  | "firstName"
  | "lastName"
  | "gender"
  | "rollNumber"
  | "graduationYear"
  | "phone"
  | "email"
  | "password"
  | "confirmPassword";

export type StudentSignupForm = Record<StudentSignupField, string>;
export type FieldErrors = Partial<Record<StudentSignupField, string>>;

/** Fields belonging to each wizard step, in on-screen order (used for focus + gating). */
export const STEP_FIELDS: readonly (readonly StudentSignupField[])[] = [
  ["firstName", "lastName", "gender"],
  ["rollNumber", "graduationYear", "phone"],
  ["email", "password", "confirmPassword"],
];

const DIAL_CODES = new Set(COUNTRY_CODES.map((c) => c.dialCode));

/** True for "", whitespace, or a bare dial code such as "+91" (the phone widget emits this after a country pick). */
export function isPhoneEmpty(value: string): boolean {
  const v = (value ?? "").trim();
  return v === "" || DIAL_CODES.has(v);
}

/** Graduation cycle the school year ends in: from April onward the next year, else this year. */
export function defaultGraduationYear(now: Date = new Date()): number {
  return now.getMonth() >= 3 ? now.getFullYear() + 1 : now.getFullYear();
}

export function validateField(
  name: StudentSignupField,
  rawValue: string,
  password: string = ""
): string {
  const value = rawValue ? String(rawValue).trim() : "";
  switch (name) {
    case "firstName": {
      const r = validateName(value, "First name");
      return r.isValid ? "" : r.error || "";
    }
    case "lastName": {
      const r = validateName(value, "Last name");
      return r.isValid ? "" : r.error || "";
    }
    case "email": {
      const r = validateEmail(value);
      return r.isValid ? "" : r.error || "";
    }
    case "password":
      if (!rawValue) return "Password is required";
      if (rawValue.length < 6) return "Password must be at least 6 characters";
      if (rawValue.length > 128) return "Password must be 128 characters or less";
      return "";
    case "confirmPassword":
      return validateConfirmPassword(password, rawValue);
    case "phone": {
      if (isPhoneEmpty(value)) return ""; // optional
      const parsed = parsePhoneNumber(value);
      if (!parsed.country) return "Please select a valid country code";
      const r = validatePhoneNumber(parsed.number, parsed.country);
      if (!r.valid) return r.error || "Invalid phone number";
      if (parsed.country.code === "IN" && !/^[6-9]/.test(parsed.number)) {
        return "Indian mobile numbers start with 6, 7, 8 or 9";
      }
      return "";
    }
    case "gender":
      if (!value) return "Please select your gender";
      if (!(ALLOWED_GENDERS as readonly string[]).includes(value)) return "Please select a valid option";
      return "";
    case "graduationYear": {
      const r = validateYear(value, MIN_GRADUATION_YEAR);
      return r.isValid ? "" : r.error || "";
    }
    case "rollNumber":
      if (!value) return "Roll number is required";
      if (value.length < 3) return "Roll number is too short";
      if (value.length > 30) return "Roll number is too long";
      if (!/^[A-Za-z0-9\-\/]+$/.test(value)) return "Use only letters, numbers, hyphens and slashes";
      return "";
    default:
      return "";
  }
}

/** Validates every field of a step. Returns only the failing fields. */
export function validateStep(step: number, form: StudentSignupForm): FieldErrors {
  const errors: FieldErrors = {};
  for (const field of STEP_FIELDS[step] ?? []) {
    const err = validateField(field, form[field], form.password);
    if (err) errors[field] = err;
  }
  return errors;
}

/** First step (0-based) that contains an error, or -1 if the whole form is valid. */
export function firstInvalidStep(form: StudentSignupForm): number {
  for (let i = 0; i < STEP_FIELDS.length; i++) {
    if (Object.keys(validateStep(i, form)).length > 0) return i;
  }
  return -1;
}

export interface PasswordChecks {
  minLength: boolean;
  mixedCase: boolean;
  number: boolean;
  symbol: boolean;
}

export interface PasswordStrength {
  /** 0 = empty, 1 = weak, 2 = fair, 3 = good, 4 = strong */
  score: 0 | 1 | 2 | 3 | 4;
  label: "" | "Weak" | "Fair" | "Good" | "Strong";
  checks: PasswordChecks;
}

/** Advisory only: the server just enforces 6-128 characters. */
export function passwordStrength(password: string): PasswordStrength {
  const checks: PasswordChecks = {
    minLength: password.length >= 8,
    mixedCase: /[a-z]/.test(password) && /[A-Z]/.test(password),
    number: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };
  if (!password) return { score: 0, label: "", checks };
  let points = Object.values(checks).filter(Boolean).length;
  if (password.length < 6) points = Math.min(points, 1);
  const score = Math.max(1, Math.min(4, points)) as 1 | 2 | 3 | 4;
  return { score, label: (["", "Weak", "Fair", "Good", "Strong"] as const)[score], checks };
}

export type ServerErrorTarget = { step: number; field?: StudentSignupField; message: string };

/** Maps an API error to the wizard step/field that caused it. */
export function mapServerError(status: number, message: string): ServerErrorTarget {
  const msg = message || "Signup failed. Please try again.";
  const lower = msg.toLowerCase();
  if (status === 409 && lower.includes("email")) return { step: 2, field: "email", message: msg };
  if (status === 409 && lower.includes("roll")) return { step: 1, field: "rollNumber", message: msg };
  if (status === 400) {
    if (lower.includes("first name")) return { step: 0, field: "firstName", message: msg };
    if (lower.includes("last name")) return { step: 0, field: "lastName", message: msg };
    if (lower.includes("gender")) return { step: 0, field: "gender", message: msg };
    if (lower.includes("roll number")) return { step: 1, field: "rollNumber", message: msg };
    if (lower.includes("graduation year")) return { step: 1, field: "graduationYear", message: msg };
    if (lower.includes("phone")) return { step: 1, field: "phone", message: msg };
    if (lower.includes("email")) return { step: 2, field: "email", message: msg };
    if (lower.includes("password")) return { step: 2, field: "password", message: msg };
  }
  return { step: -1, message: msg };
}
