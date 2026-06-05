
/**
 * Determines the user role ('student' or 'alumni') based on graduation year
 * and the current date.
 * 
 * Logic:
 * - If Graduation Year > Current Year -> Student (Future graduate)
 * - If Graduation Year < Current Year -> Alumni (Past graduate)
 * - If Graduation Year == Current Year:
 *   - If Current Month is before June (Jan-May) -> Student (Still in final year)
 *   - If Current Month is June or later -> Alumni (Graduated)
 * 
 * Note: Schools in India typically finish academic years in March/April/May.
 * By June, students are typically considered graduates/alumni.
 * 
 * @param graduationYear The graduation year to check
 * @returns 'student' | 'alumni'
 */
export function determineUserRole(graduationYear: number | string): 'student' | 'alumni' {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed (0 = Jan, 5 = June)

    // Parse input to integer
    const gradYear = typeof graduationYear === 'string'
        ? parseInt(graduationYear, 10)
        : graduationYear;

    // Safety check for valid number
    if (isNaN(gradYear)) {
        // Default fallback if we can't determine
        return 'alumni';
    }

    if (gradYear > currentYear) {
        return 'student'; // Future graduation
    }

    if (gradYear < currentYear) {
        return 'alumni'; // Past graduation
    }

    // Current Year is Graduation Year
    // Cutoff is June 1st (i.e., Month index 5)
    // Jan(0) to May(4) -> Student
    // June(5) to Dec(11) -> Alumni
    return currentMonth >= 5 ? 'alumni' : 'student';
}
