import { API_BASE_URL } from "./apiConfig";

const API_URL = `${API_BASE_URL}`;
export const getMessages = async (
  conversationId
) => {
  const response = await fetch(
    `${API_URL}/messages/${conversationId}`,
    {
      credentials: "include",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message ||
        "Unable to load messages."
    );
  }

  return data;
};

export const sendMessage = async (
  conversationId,
  text
) => {
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
        text,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message ||
        "Unable to send message."
    );
  }

  return data;
};