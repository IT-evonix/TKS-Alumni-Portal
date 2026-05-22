export function getClientBaseUrl(): string {
  const baseUrl = import.meta.env.VITE_BASE_URL || window.location.origin;
  return baseUrl.trim().replace(/\/+$/, "");
}

export function buildClientUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalizedPath, getClientBaseUrl()).toString();
}
