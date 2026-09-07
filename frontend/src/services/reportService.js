import { API_BASE_URL } from "./apiConfig";

const API_URL = `${API_BASE_URL}`;
export const reportUser = async (
  userId,
  reason
) => {
  const response = await fetch(
    `${API_URL}/reports`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId,
        reason,
      }),
    }
  );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.message ||
        "Unable to submit report."
    );
  }

  return data;
};