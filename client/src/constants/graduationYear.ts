/**
 * Shared graduation year rules: only 2018 and later.
 * Used by Admin (Create Alumni, Edit User), Signup, and Profile.
 */
export const MIN_GRADUATION_YEAR = 2018;

const MAX_YEARS_AHEAD = 5;

/**
 * Returns graduation year options from MIN_GRADUATION_YEAR up to (current year + MAX_YEARS_AHEAD),
 * newest first (e.g. [2030, 2029, ..., 2021]).
 */
export function getGraduationYearOptions(): number[] {
  const currentYear = new Date().getFullYear();
  const maxYear = currentYear + MAX_YEARS_AHEAD;
  const length = maxYear - MIN_GRADUATION_YEAR + 1;
  return Array.from({ length }, (_, i) => maxYear - i);
}
