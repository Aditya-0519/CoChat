import { API_BASE_URL } from "./apiConfig";

const API_URL = `${API_BASE_URL}/groups`;
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
      data?.message || "Something went wrong. Please try again."
    );
  }

  return data;
}

export const getGroups = () => request("");

export const getGroup = (groupId) =>
  request(`/${groupId}`);

export const createGroup = ({
  name,
  description = "",
  memberIds = [],
}) =>
  request("", {
    method: "POST",
    body: JSON.stringify({
      name,
      description,
      memberIds,
    }),
  });

export const addGroupMember = (
  groupId,
  userId
) =>
  request(`/${groupId}/members`, {
    method: "POST",
    body: JSON.stringify({
      userId,
    }),
  });

export const removeGroupMember = (
  groupId,
  userId
) =>
  request(
    `/${groupId}/members/${userId}`,
    {
      method: "DELETE",
    }
  );

export const leaveGroup = (groupId) =>
  request(`/${groupId}/leave`, {
    method: "POST",
  });