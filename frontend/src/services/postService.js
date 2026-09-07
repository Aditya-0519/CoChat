import { API_BASE_URL } from "./apiConfig";

const API_URL = `${API_BASE_URL}/posts`;
export const getPosts = async () => {
  const response = await fetch(API_URL, {
    credentials: "include",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Unable to load posts.");
  }

  return data;
};

export const createPost = async (content) => {
  const response = await fetch(API_URL, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Unable to create post.");
  }

  return data;
};

export const toggleLike = async (postId) => {
  const response = await fetch(`${API_URL}/${postId}/like`, {
    method: "POST",
    credentials: "include",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Unable to update like.");
  }

  return data;
};

export const deletePost = async (postId) => {
  const response = await fetch(`${API_URL}/${postId}`, {
    method: "DELETE",
    credentials: "include",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Unable to delete post.");
  }

  return data;
};