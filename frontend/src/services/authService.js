import {
  API_BASE_URL,
} from "./apiConfig";

const API_URL =
  API_BASE_URL;

/*
|--------------------------------------------------------------------------
| COMMON RESPONSE HANDLER
|--------------------------------------------------------------------------
*/

async function parseResponse(
  response
) {
  const data =
    await response
      .json()
      .catch(() => ({}));

  if (!response.ok) {
    const error =
      new Error(
        data?.message ||
          "Something went wrong. Please try again."
      );

    /*
     * Preserve HTTP status.
     *
     * AuthProvider uses this to distinguish:
     *
     * 401 = genuinely logged out
     *
     * network/5xx = possibly temporary
     */

    error.status =
      response.status;

    throw error;
  }

  return data;
}

/*
|--------------------------------------------------------------------------
| SIGNUP
|--------------------------------------------------------------------------
*/

export const signupUser =
  async (userData) => {
    const response =
      await fetch(
        `${API_URL}/auth/signup`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          credentials:
            "include",

          body: JSON.stringify(
            userData
          ),
        }
      );

    return parseResponse(
      response
    );
  };

/*
|--------------------------------------------------------------------------
| CHECK USERNAME
|--------------------------------------------------------------------------
*/

export const checkUsername =
  async (username) => {
    const response =
      await fetch(
        `${API_URL}/auth/check-username/${encodeURIComponent(
          username
        )}`,
        {
          credentials:
            "include",
        }
      );

    return parseResponse(
      response
    );
  };

/*
|--------------------------------------------------------------------------
| LOGIN
|--------------------------------------------------------------------------
*/

export const loginUser =
  async (credentials) => {
    const response =
      await fetch(
        `${API_URL}/auth/login`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          credentials:
            "include",

          body: JSON.stringify(
            credentials
          ),
        }
      );

    return parseResponse(
      response
    );
  };

/*
|--------------------------------------------------------------------------
| CURRENT USER
|--------------------------------------------------------------------------
*/

export const getCurrentUser =
  async () => {
    const response =
      await fetch(
        `${API_URL}/auth/me`,
        {
          credentials:
            "include",
        }
      );

    return parseResponse(
      response
    );
  };

/*
|--------------------------------------------------------------------------
| LOGOUT
|--------------------------------------------------------------------------
*/

export const logoutUser =
  async () => {
    const response =
      await fetch(
        `${API_URL}/auth/logout`,
        {
          method: "POST",

          credentials:
            "include",
        }
      );

    return parseResponse(
      response
    );
  };

/*
|--------------------------------------------------------------------------
| UPDATE PROFILE
|--------------------------------------------------------------------------
*/

export const updateProfile =
  async (profileData) => {
    const response =
      await fetch(
        `${API_URL}/auth/profile`,
        {
          method: "PUT",

          headers: {
            "Content-Type":
              "application/json",
          },

          credentials:
            "include",

          body: JSON.stringify(
            profileData
          ),
        }
      );

    return parseResponse(
      response
    );
  };

/*
|--------------------------------------------------------------------------
| UPLOAD AVATAR
|--------------------------------------------------------------------------
*/

export const uploadAvatar =
  async (file) => {
    const formData =
      new FormData();

    formData.append(
      "avatar",
      file
    );

    const response =
      await fetch(
        `${API_URL}/auth/profile/avatar`,
        {
          method: "POST",

          credentials:
            "include",

          body: formData,
        }
      );

    return parseResponse(
      response
    );
  };

/*
|--------------------------------------------------------------------------
| GOOGLE LOGIN
|--------------------------------------------------------------------------
*/

export const loginWithGoogle =
  async (credential) => {
    const response =
      await fetch(
        `${API_URL}/auth/google`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          credentials:
            "include",

          body: JSON.stringify({
            credential,
          }),
        }
      );

    return parseResponse(
      response
    );
  };