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

export const createConversation = (userId) =>
  request("/conversations", {
    method: "POST",
    body: JSON.stringify({ userId }),
  });

export const getConversations = () =>
  request("/conversations");

export const getConversation = (conversationId) =>
  request(`/conversations/${conversationId}`);

export const sendMessageRequest = (userId, text) =>
  request("/conversations/requests", {
    method: "POST",
    body: JSON.stringify({
      userId,
      text,
    }),
  });

export const getMessageRequests = () =>
  request("/conversations/requests");

export const getSentMessageRequests = () =>
  request("/conversations/requests/sent");

export const acceptMessageRequest = (requestId) =>
  request(
    `/conversations/requests/${requestId}/accept`,
    {
      method: "PATCH",
    }
  );

export const declineMessageRequest = (requestId) =>
  request(
    `/conversations/requests/${requestId}/decline`,
    {
      method: "PATCH",
    }
  );