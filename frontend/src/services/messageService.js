import { API_BASE_URL } from "./apiConfig";

const API_URL = `${API_BASE_URL}`;

const parseResponse = async (response, fallbackMessage) => {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || fallbackMessage);
  }

  return data;
};

/*
  =====================================================
  MESSAGES
  =====================================================
*/

/*
  Fetch messages using cursor pagination.

  Options:
    limit  -> number of messages
    before -> cursor returned by the previous request

  The backend returns messages in chronological order
  so the UI can render them directly.
*/
export const getMessages = async (
  conversationId,
  { limit = 30, before = null } = {}
) => {
  if (!conversationId) {
    throw new Error("Conversation ID is required.");
  }

  const params = new URLSearchParams();

  params.set("limit", String(limit));

  if (before) {
    params.set("before", before);
  }

  const response = await fetch(
    `${API_URL}/messages/${conversationId}?${params.toString()}`,
    {
      credentials: "include",
    }
  );

  return parseResponse(
    response,
    "Unable to load messages."
  );
};

/*
  Send a message.

  The server is the source of truth. The returned message
  should be used by the UI immediately rather than waiting
  for Socket.IO to echo the message back.
*/
export const sendMessage = async (
  conversationId,
  text
) => {
  if (!conversationId) {
    throw new Error("Conversation ID is required.");
  }

  const normalizedText =
    typeof text === "string"
      ? text.trim()
      : "";

  if (!normalizedText) {
    throw new Error("Message cannot be empty.");
  }

  const response = await fetch(
    `${API_URL}/messages`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        conversationId,
        text: normalizedText,
      }),
    }
  );

  return parseResponse(
    response,
    "Unable to send message."
  );
};

/*
  =====================================================
  MESSAGE DELIVERY / READ STATE
  =====================================================
*/

/*
  Mark one message as delivered for the current user.

  This is intentionally idempotent. Calling it more than
  once should not create duplicate receipt records.
*/
export const markMessageDelivered = async (
  conversationId,
  messageId
) => {
  if (!conversationId || !messageId) {
    return null;
  }

  const response = await fetch(
    `${API_URL}/message-state/${conversationId}/delivered`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messageId,
      }),
    }
  );

  return parseResponse(
    response,
    "Unable to update message delivery state."
  );
};

/*
  Mark all messages up to messageId as read.

  Using a boundary message instead of sending an array of
  message IDs keeps the request small and makes the operation
  efficient for long conversations.
*/
export const markConversationRead = async (
  conversationId,
  messageId
) => {
  if (!conversationId || !messageId) {
    return null;
  }

  const response = await fetch(
    `${API_URL}/message-state/${conversationId}/read`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messageId,
      }),
    }
  );

  return parseResponse(
    response,
    "Unable to mark conversation as read."
  );
};

/*
  Fetch the current user's message state for a conversation.

  This is useful after:
    - opening a conversation
    - reconnecting Socket.IO
    - refreshing the page
    - restoring a tab
*/
export const getMessageState = async (
  conversationId
) => {
  if (!conversationId) {
    return null;
  }

  const response = await fetch(
    `${API_URL}/message-state/${conversationId}`,
    {
      credentials: "include",
    }
  );

  return parseResponse(
    response,
    "Unable to load message state."
  );
};