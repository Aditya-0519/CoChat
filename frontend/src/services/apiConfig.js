const normalizeBaseUrl = (value) => value?.replace(/\/$/, "");

const configuredApiUrl = normalizeBaseUrl(import.meta.env.VITE_API_URL);
const configuredSocketUrl = normalizeBaseUrl(import.meta.env.VITE_SOCKET_URL);

/*
 * In production, API requests go through the Vercel proxy.
 *
 * This is important for authentication because the browser then
 * sees the API and the frontend as the same origin.
 */
export const API_BASE_URL =
  import.meta.env.PROD
    ? "/api"
    : configuredApiUrl || "http://localhost:5000/api";

/*
 * Socket.IO still connects directly to the backend.
 * We are keeping this separate because Vercel rewrites are intended
 * for HTTP requests and should not be relied upon as a WebSocket proxy.
 */
export const SOCKET_URL =
  configuredSocketUrl ||
  (import.meta.env.PROD
    ? "https://cochat-g7qi.onrender.com"
    : "http://localhost:5000");