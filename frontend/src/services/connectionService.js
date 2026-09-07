import { API_BASE_URL } from "./apiConfig";

const API_URL = `${API_BASE_URL}`;

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

/*
|--------------------------------------------------------------------------
| CONNECTIONS
|--------------------------------------------------------------------------
*/

export const getConnections = () =>
  request("/connections");

export const getConnectionStatus = (userId) => {
  if (!userId) {
    throw new Error("User ID is required.");
  }

  return request(
    `/connections/status/${userId}`
  );
};

export const sendConnectionRequest = (userId) => {
  if (!userId) {
    throw new Error("User ID is required.");
  }

  return request(
    `/connections/request/${userId}`,
    {
      method: "POST",
    }
  );
};

/*
|--------------------------------------------------------------------------
| CONNECTION REQUESTS
|--------------------------------------------------------------------------
*/

export const getConnectionRequests = () =>
  request("/connections/requests");

export const getSentConnectionRequests = () =>
  request("/connections/requests/sent");

export const getConnectionRequestCount = () =>
  request("/connections/requests/count");

export const acceptConnectionRequest = (
  connectionId
) => {
  if (!connectionId) {
    throw new Error(
      "Connection ID is required."
    );
  }

  return request(
    `/connections/${connectionId}/accept`,
    {
      method: "PATCH",
    }
  );
};

export const rejectConnectionRequest = (
  connectionId
) => {
  if (!connectionId) {
    throw new Error(
      "Connection ID is required."
    );
  }

  return request(
    `/connections/${connectionId}/reject`,
    {
      method: "PATCH",
    }
  );
};

/*
|--------------------------------------------------------------------------
| LEGACY / CONVERSATION-COMPATIBLE ALIASES
|--------------------------------------------------------------------------
|
| Keep these aliases so older components or future code using
| the previous naming convention continue to work.
|
*/

export const getMessageRequests =
  getConnectionRequests;

export const getSentMessageRequests =
  getSentConnectionRequests;

export const acceptMessageRequest =
  acceptConnectionRequest;

export const declineMessageRequest =
  rejectConnectionRequest;