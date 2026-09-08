const normalizeBaseUrl = (value) => {
  if (!value) {
    return "";
  }

  return value
    .trim()
    .replace(/\/$/, "");
};

const configuredApiUrl =
  normalizeBaseUrl(
    import.meta.env.VITE_API_URL
  );

const configuredSocketUrl =
  normalizeBaseUrl(
    import.meta.env.VITE_SOCKET_URL
  );

/*
|--------------------------------------------------------------------------
| API
|--------------------------------------------------------------------------
|
| Production:
|
| Frontend:
| https://cochat-alpha.vercel.app
|
| Backend:
| https://cochat-g7qi.onrender.com
|
| Authentication cookies belong to the backend origin.
|
| Therefore HTTP API and Socket.IO must use the SAME backend
| origin.
|
|--------------------------------------------------------------------------
*/

export const API_BASE_URL =
  configuredApiUrl ||
  (import.meta.env.PROD
    ? "https://cochat-g7qi.onrender.com/api"
    : "http://localhost:5000/api");

/*
|--------------------------------------------------------------------------
| SOCKET
|--------------------------------------------------------------------------
*/

export const SOCKET_URL =
  configuredSocketUrl ||
  (import.meta.env.PROD
    ? "https://cochat-g7qi.onrender.com"
    : "http://localhost:5000");