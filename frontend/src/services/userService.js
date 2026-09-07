import { API_BASE_URL } from "./apiConfig";

const API_URL = `${API_BASE_URL}`;
export const getDiscoverUsers = async () => {
  const response = await fetch(
    `${API_URL}/users/discover`,
    {
      credentials: "include",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Unable to load people."
    );
  }

  return data;
};

export const getPublicProfile = async (username) => {
  const response = await fetch(
    `${API_URL}/users/${encodeURIComponent(username)}`
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Unable to load profile."
    );
  }

  return data;
};