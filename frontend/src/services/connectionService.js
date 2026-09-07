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

  const data = await response
    .json()
    .catch(() => ({}));

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
    body: JSON.stringify({
      userId,
    }),
  });

/*
|--------------------------------------------------------------------------
| CONVERSATION LIST
|--------------------------------------------------------------------------
|
| The existing conversation endpoint remains the source of
| conversation data.
|
| We additionally request unread counts and merge them into
| each conversation so the UI receives:
|
| conversation.unreadCount
|
*/

export const getConversations = async () => {
  const [
    conversationData,
    unreadData,
  ] = await Promise.all([
    request("/conversations"),
    request("/conversation-state/unread"),
  ]);

  const conversations =
    Array.isArray(
      conversationData?.conversations
    )
      ? conversationData.conversations
      : [];

  const unread =
    unreadData?.unread || {};

  const mergedConversations =
    conversations.map(
      (conversation) => {
        const conversationId =
          conversation?._id?.toString();

        return {
          ...conversation,

          unreadCount:
            conversationId &&
            Number.isFinite(
              unread[conversationId]
            )
              ? unread[conversationId]
              : 0,
        };
      }
    );

  return {
    ...conversationData,
    conversations:
      mergedConversations,

    totalUnread:
      Number.isFinite(
        unreadData?.totalUnread
      )
        ? unreadData.totalUnread
        : 0,
  };
};

export const getConversation = (
  conversationId
) =>
  request(
    `/conversations/${conversationId}`
  );

export const sendMessageRequest = (
  userId,
  text
) =>
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
  request(
    "/conversations/requests/sent"
  );

export const acceptMessageRequest = (
  requestId
) =>
  request(
    `/conversations/requests/${requestId}/accept`,
    {
      method: "PATCH",
    }
  );

export const declineMessageRequest = (
  requestId
) =>
  request(
    `/conversations/requests/${requestId}/decline`,
    {
      method: "PATCH",
    }
  );