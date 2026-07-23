// Plain <img>/<video>/<a> tags can't send an Authorization header, so append
// the auth token as a query param for our authenticated storage-proxy endpoint.
export function withAuthenticatedMediaUrl(src: string): string {
  if (!src.startsWith('/api/storage/view')) return src;
  const token = localStorage.getItem('auth_token');
  if (!token) return src;
  const separator = src.includes('?') ? '&' : '?';
  return `${src}${separator}token=${encodeURIComponent(token)}`;
}
