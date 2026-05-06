const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() ?? "";
const allowExternalApiBaseUrl = import.meta.env.VITE_ALLOW_EXTERNAL_API === "true";

export const API_BASE_URL = allowExternalApiBaseUrl
  ? configuredApiBaseUrl.replace(/\/+$/, "")
  : "";

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}
