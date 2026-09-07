import {
  API_BASE_URL,
} from "./apiConfig";


const API_URL =
  `${API_BASE_URL}/connections`;


async function request(
  path,
  options = {}
) {
  const response =
    await fetch(
      `${API_URL}${path}`,
      {
        credentials: "include",

        headers: {
          "Content-Type":
            "application/json",

          ...(options.headers || {}),
        },

        ...options,
      }
    );


  const data =
    await response
      .json()
      .catch(() => ({}));


  if (!response.ok) {
    throw new Error(
      data?.message ||
        "Something went wrong. Please try again."
    );
  }


  return data;
}


/*
  ============================================================
  ACCEPTED CONNECTIONS
  ============================================================
*/

export const getConnections = () =>
  request("/");


/*
  ============================================================
  CONNECTION STATUS
  ============================================================
*/

export const getConnectionStatus = (
  userId
) =>
  request(
    `/status/${userId}`
  );


/*
  ============================================================
  SEND CONNECTION REQUEST
  ============================================================
*/

export const sendConnectionRequest = (
  userId
) =>
  request(
    `/request/${userId}`,
    {
      method: "POST",
    }
  );


/*
  ============================================================
  INCOMING CONNECTION REQUESTS
  ============================================================
*/

export const getConnectionRequests = () =>
  request("/requests");


/*
  ============================================================
  SENT CONNECTION REQUESTS
  ============================================================
*/

export const getSentConnectionRequests =
  () =>
    request(
      "/requests/sent"
    );


/*
  ============================================================
  ACCEPT CONNECTION REQUEST
  ============================================================
*/

export const acceptConnectionRequest = (
  connectionId
) =>
  request(
    `/${connectionId}/accept`,
    {
      method: "PATCH",
    }
  );


/*
  ============================================================
  REJECT CONNECTION REQUEST
  ============================================================
*/

export const rejectConnectionRequest = (
  connectionId
) =>
  request(
    `/${connectionId}/reject`,
    {
      method: "PATCH",
    }
  );


/*
  ============================================================
  REMOVE CONNECTION
  ============================================================
*/

export const removeConnection = (
  userId
) =>
  request(
    `/${userId}`,
    {
      method: "DELETE",
    }
  );