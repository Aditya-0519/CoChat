import { API_BASE_URL } from "./apiConfig";

const API_URL = `${API_BASE_URL}/conversation-settings`;
export const getConversationSettings = async (
  conversationId
) => {
  const response = await fetch(
    `${API_URL}/${conversationId}`,
    {
      credentials: "include",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message ||
        "Unable to load conversation settings."
    );
  }

  return data;
};


export const setConversationMuted = async (
  conversationId,
  muted
) => {
  const response = await fetch(
    `${API_URL}/${conversationId}/mute`,
    {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        muted,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message ||
        "Unable to update notification setting."
    );
  }

  return data;
};