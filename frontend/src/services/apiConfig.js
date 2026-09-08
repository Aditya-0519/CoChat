const normalizeBaseUrl = (
  value
) =>
  value
    ?.trim()
    .replace(/\/$/, "");

const configuredApiUrl =
  normalizeBaseUrl(
    import.meta.env.VITE_API_URL
  );

const configuredSocketUrl =
  normalizeBaseUrl(
    import.meta.env.VITE_SOCKET_URL
  );

export const API_BASE_URL =
  configuredApiUrl ||
  (import.meta.env.PROD
    ? "https://cochat-g7qi.onrender.com/api"
    : "http://localhost:5000/api");

export const SOCKET_URL =
  configuredSocketUrl ||
  (import.meta.env.PROD
    ? "https://cochat-g7qi.onrender.com"
    : "http://localhost:5000");