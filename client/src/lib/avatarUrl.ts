const seedCache = new Map<string, string>();

/**
 * Deterministic DiceBear avatar URL for a user without a profile picture,
 * varied by gender. Extracted from PostCard's three duplicated switch
 * statements (post/comment/reply author avatars). Memoized since DiceBear
 * URLs are pure functions of (seed, gender) and were being regenerated on
 * every render.
 */
export function getAvatarUrl(
  profilePicture: string | null | undefined,
  gender: string | null | undefined,
  name: string,
): string {
  if (profilePicture && profilePicture.trim() !== "") return profilePicture;

  const cacheKey = `${gender ?? "default"}:${name}`;
  const cached = seedCache.get(cacheKey);
  if (cached) return cached;

  const seed = encodeURIComponent(name);
  let url: string;
  switch (gender) {
    case "male":
      url = `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=008060`;
      break;
    case "female":
      url = `https://api.dicebear.com/7.x/avataaars-neutral/svg?seed=${seed}&backgroundColor=ff69b4`;
      break;
    case "other":
      url = `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}&backgroundColor=ffa500`;
      break;
    case "prefer_not_to_say":
      url = `https://api.dicebear.com/7.x/initials/svg?seed=${seed}&backgroundColor=6c63ff`;
      break;
    default:
      url = `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=008060`;
  }

  seedCache.set(cacheKey, url);
  return url;
}
