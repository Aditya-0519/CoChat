const normalizeBaseUrl = (value) => value?.replace(/\/$/, "");

const configuredApiUrl = normalizeBaseUrl(import.meta.env.VITE_API_URL);
const configuredSocketUrl = normalizeBaseUrl(import.meta.env.VITE_SOCKET_URL);

if (import.meta.env.PROD && !configuredApiUrl) {
  throw new Error("VITE_API_URL must be configured for production builds.");
}

export const API_BASE_URL = configuredApiUrl || "http://localhost:5000/api";

export const SOCKET_URL =
  configuredSocketUrl || API_BASE_URL.replace(/\/api$/, "");
