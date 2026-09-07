import { API_BASE_URL } from "./apiConfig";

const API_URL = `${API_BASE_URL}/connections`;
async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data?.message ||
        "Something went wrong. Please try again."
    );
  }

  return data;
}

// Get all accepted connections of the current user.
export const getConnections = () =>
  request("/");

// Get the connection status between the current user
// and another user.
export const getConnectionStatus = (userId) =>
  request(`/status/${userId}`);

// Send a connection request.
export const sendConnectionRequest = (userId) =>
  request(`/request/${userId}`, {
    method: "POST",
  });

// Get incoming connection requests.
export const getConnectionRequests = () =>
  request("/requests");

// Accept an incoming connection request.
export const acceptConnectionRequest = (connectionId) =>
  request(`/${connectionId}/accept`, {
    method: "PATCH",
  });

// Reject an incoming connection request.
export const rejectConnectionRequest = (connectionId) =>
  request(`/${connectionId}/reject`, {
    method: "PATCH",
  });

// Remove an existing connection.
export const removeConnection = (userId) =>
  request(`/${userId}`, {
    method: "DELETE",
  });