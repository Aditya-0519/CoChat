import { API_BASE_URL } from "./apiConfig";

const API_URL = `${API_BASE_URL}/connections`;

async function request(path, options = {}) {
  const response = await fetch(
    `${API_URL}${path}`,
    {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    }
  );

  const data =
    await response.json().catch(
      () => ({})
    );

  if (!response.ok) {
    throw new Error(
      data?.message ||
        "Something went wrong. Please try again."
    );
  }

  return data;
}

export const getConnections = () =>
  request("/");

export const getConnectionStatus = (
  userId
) =>
  request(
    `/status/${userId}`
  );

export const sendConnectionRequest = (
  userId
) =>
  request(
    `/request/${userId}`,
    {
      method: "POST",
    }
  );

export const getConnectionRequests =
  () =>
    request("/requests");

export const getSentConnectionRequests =
  () =>
    request("/requests/sent");

export const getConnectionRequestCount =
  () =>
    request("/requests/count");

export const acceptConnectionRequest =
  (connectionId) =>
    request(
      `/${connectionId}/accept`,
      {
        method: "PATCH",
      }
    );

export const rejectConnectionRequest =
  (connectionId) =>
    request(
      `/${connectionId}/reject`,
      {
        method: "PATCH",
      }
    );

export const removeConnection = (
  userId
) =>
  request(
    `/${userId}`,
    {
      method: "DELETE",
    }
  );