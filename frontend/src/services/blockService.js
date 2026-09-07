import { API_BASE_URL } from "./apiConfig";

const API_URL = `${API_BASE_URL}/blocks`;
export const blockUser = async (userId) => {
  const response = await fetch(`${API_URL}/${userId}`, {
    method: "POST",
    credentials: "include",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Unable to block user.");
  }

  return data;
};

export const unblockUser = async (userId) => {
  const response = await fetch(`${API_URL}/${userId}`, {
    method: "DELETE",
    credentials: "include",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Unable to unblock user.");
  }

  return data;
};

export const getBlockStatus = async (userId) => {
  const response = await fetch(`${API_URL}/${userId}/status`, {
    credentials: "include",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Unable to check block status."
    );
  }

  return data;
};

export const getBlockedUsers = async () => {
  const response = await fetch(API_URL, {
    credentials: "include",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Unable to load blocked users."
    );
  }

  return data;
};