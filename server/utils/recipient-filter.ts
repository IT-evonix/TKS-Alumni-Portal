import { supabase } from "../supabase";

export interface RecipientFilters {
  role?: string;
  batch?: string;
  graduationYear?: string;
  department?: string;
}

/**
 * Builds a Supabase query to resolve alumni recipients based on optional filters.
 * Returns rows with: user_id, email, first_name, last_name, graduation_year, batch, branch, users(user_role, is_admin)
 * Filters: 'all' or undefined means no filter applied for that field.
 * countOnly=true returns a count-only query (no row data) for efficient counting.
 */
export const buildRecipientQuery = (filters: RecipientFilters, countOnly = false) => {
  let query = supabase
    .from("alumni")
    .select(
      countOnly
        ? "user_id, users!inner(user_role)"
        : "user_id, email, first_name, last_name, graduation_year, batch, branch, users!inner(user_role, is_admin)",
      countOnly ? { count: "exact", head: true } : undefined
    )
    .not("email", "is", null)
    .neq("email", "")
    .eq("newsletter_unsubscribed", false);

  const gradYear =
    filters.graduationYear && filters.graduationYear !== "all"
      ? parseInt(filters.graduationYear, 10)
      : NaN;
  if (!Number.isNaN(gradYear)) {
    query = query.eq("graduation_year", gradYear);
  }

  if (filters.batch && filters.batch !== "all") {
    query = query.eq("batch", filters.batch);
  }

  if (filters.department && filters.department !== "all") {
    query = query.eq("branch", filters.department);
  }

  if (filters.role && filters.role !== "all") {
    query = query.eq("users.user_role", filters.role);
  }

  return query;
};
