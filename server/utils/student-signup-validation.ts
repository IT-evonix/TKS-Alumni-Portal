// Pure validation for POST /api/auth/student-signup.
// Runs before any database read/write so invalid input can never trigger cleanup of existing records.
import { isValidName, isValidEmail, sanitizeEmail, sanitizePhone, sanitizeString } from "./input-sanitization";

export const MIN_GRADUATION_YEAR = 2018;
export const MAX_YEARS_AHEAD = 5;
export const ALLOWED_GENDERS = ["male", "female", "other", "prefer_not_to_say"] as const;

export interface StudentSignupData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string | null;
  gender: string | null;
  rollNumber: string;
  graduationYear: number;
  batch: string;
  course: string | null;
  branch: string | null;
}

export type StudentSignupResult =
  | { ok: true; data: StudentSignupData }
  | { ok: false; error: string };

const fail = (error: string): StudentSignupResult => ({ ok: false, error });

const ROLL_NUMBER_REGEX = /^[A-Za-z0-9\-\/]+$/;

export function validateStudentSignup(body: unknown, now: Date = new Date()): StudentSignupResult {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

  const { firstName, lastName, email, password, rollNumber, graduationYear, phone, gender, course, branch, batch } = b;

  const isEmpty = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");
  if (
    isEmpty(firstName) || isEmpty(lastName) || isEmpty(email) || isEmpty(rollNumber) || isEmpty(graduationYear) ||
    password === undefined || password === null || password === ""
  ) {
    return fail("Required fields (including Roll Number) are missing");
  }

  if (
    typeof firstName !== "string" || typeof lastName !== "string" || typeof email !== "string" ||
    typeof password !== "string" || typeof rollNumber !== "string" ||
    (typeof graduationYear !== "string" && typeof graduationYear !== "number")
  ) {
    return fail("Invalid input format");
  }
  for (const optional of [phone, gender, course, branch, batch]) {
    if (optional !== undefined && optional !== null && typeof optional !== "string") {
      return fail("Invalid input format");
    }
  }

  if (!isValidName(firstName)) return fail("Invalid First Name");
  if (!isValidName(lastName)) return fail("Invalid Last Name");

  const sEmail = sanitizeEmail(email);
  if (sEmail.length > 254 || !isValidEmail(sEmail)) return fail("Invalid email address");

  if (password.length < 6) return fail("Password must be at least 6 characters");
  if (password.length > 128) return fail("Password must be 128 characters or less");

  const sRollNumber = sanitizeString(rollNumber, 1000).toUpperCase();
  if (sRollNumber.length < 3) {
    return fail("Roll Number is too short. Please enter your valid school roll number.");
  }
  if (sRollNumber.length > 30) return fail("Roll Number is too long");
  if (!ROLL_NUMBER_REGEX.test(sRollNumber)) {
    return fail("Roll Number can only contain letters, numbers, hyphens, and slashes");
  }

  const maxYear = now.getFullYear() + MAX_YEARS_AHEAD;
  const yearStr = String(graduationYear).trim();
  if (!/^\d{4}$/.test(yearStr)) return fail("Invalid graduation year");
  const gradYearNum = parseInt(yearStr, 10);
  if (gradYearNum < MIN_GRADUATION_YEAR) return fail(`Graduation year must be ${MIN_GRADUATION_YEAR} or later`);
  if (gradYearNum > maxYear) return fail(`Graduation year cannot be later than ${maxYear}`);

  let sGender: string | null = null;
  if (typeof gender === "string" && gender.trim() !== "") {
    sGender = gender.trim();
    if (!(ALLOWED_GENDERS as readonly string[]).includes(sGender)) return fail("Invalid gender");
  }

  let sPhone: string | null = null;
  if (typeof phone === "string" && phone.trim() !== "") {
    sPhone = sanitizePhone(phone).trim();
    const digits = sPhone.replace(/\D/g, "").length;
    if (digits < 7 || digits > 15) return fail("Invalid phone number");
  }

  const optionalText = (v: unknown): string | null =>
    typeof v === "string" && v.trim() !== "" ? sanitizeString(v, 100) : null;

  return {
    ok: true,
    data: {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: sEmail,
      password,
      phone: sPhone,
      gender: sGender,
      rollNumber: sRollNumber,
      graduationYear: gradYearNum,
      batch: optionalText(batch) ?? String(gradYearNum),
      course: optionalText(course),
      branch: optionalText(branch),
    },
  };
}
