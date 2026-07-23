import { useAuth } from "@/contexts/AuthContext";

/**
 * Single source of truth for "who is the current user" across the feed,
 * replacing three different patterns that had accumulated (user?.id,
 * localStorage.getItem('userId'), and JSON.parse(localStorage.getItem('user')).id).
 * Prefers the admin session (when acting in an admin context), then the
 * regular auth user, then falls back to the plain userId key in storage.
 */
export function useCurrentUserId(): string {
  const { adminUser, user } = useAuth();
  return adminUser?.id || user?.id || localStorage.getItem("userId") || "";
}
