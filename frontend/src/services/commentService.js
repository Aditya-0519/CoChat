import { API_BASE_URL } from "./apiConfig";

const API_URL = `${API_BASE_URL}/posts`;
export const getComments = async (postId) => {
  const response = await fetch(
    `${API_URL}/${postId}/comments`,
    {
      credentials: "include",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Unable to load comments."
    );
  }

  return data;
};


export const createComment = async (
  postId,
  content
) => {
  const response = await fetch(
    `${API_URL}/${postId}/comments`,
    {
      method: "POST",

      credentials: "include",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        content,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Unable to add comment."
    );
  }

  return data;
};


export const deleteComment = async (
  postId,
  commentId
) => {
  const response = await fetch(
    `${API_URL}/${postId}/comments/${commentId}`,
    {
      method: "DELETE",

      credentials: "include",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message ||
        "Unable to delete comment."
    );
  }

  return data;
};