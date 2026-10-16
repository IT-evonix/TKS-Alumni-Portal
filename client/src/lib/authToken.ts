// Returns the JWT's expiry as epoch milliseconds, or null if the token can't be decoded.
export function getTokenExpiry(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const { exp } = JSON.parse(atob(base64));
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  const expiry = getTokenExpiry(token);
  return expiry === null || expiry <= Date.now();
}

// Exchanges a still-valid token for a fresh one.
// Resolves to the new token, 'unauthorized' if the server rejected it, or null on transient failure.
export async function refreshAuthToken(token: string): Promise<string | 'unauthorized' | null> {
  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (response.status === 401) return 'unauthorized';
    if (!response.ok) return null;
    const data = await response.json();
    return typeof data.token === 'string' ? data.token : null;
  } catch {
    return null;
  }
}
