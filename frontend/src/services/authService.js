import { API_BASE_URL } from "./apiConfig";

const API_URL = `${API_BASE_URL}`;
export const signupUser = async (userData) => {
  const response = await fetch(`${API_URL}/auth/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(userData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Something went wrong."
    );
  }

  return data;
};

export const checkUsername = async (username) => {
  const response = await fetch(
    `${API_URL}/auth/check-username/${encodeURIComponent(
      username
    )}`
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Unable to check username."
    );
  }

  return data;
};

export const loginUser = async (credentials) => {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(credentials),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Unable to login."
    );
  }

  return data;
};

export const getCurrentUser = async () => {
  const response = await fetch(`${API_URL}/auth/me`, {
    credentials: "include",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Not authenticated."
    );
  }

  return data;
};

export const logoutUser = async () => {
  const response = await fetch(
    `${API_URL}/auth/logout`,
    {
      method: "POST",
      credentials: "include",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Unable to logout."
    );
  }

  return data;
};

export const updateProfile = async (profileData) => {
  const response = await fetch(
    `${API_URL}/auth/profile`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(profileData),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Unable to update profile."
    );
  }

  return data;
};

export const uploadAvatar = async (file) => {
  const formData = new FormData();

  formData.append("avatar", file);

  const response = await fetch(
    `${API_URL}/auth/profile/avatar`,
    {
      method: "POST",
      credentials: "include",
      body: formData,
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Unable to upload avatar."
    );
  }

  return data;
};