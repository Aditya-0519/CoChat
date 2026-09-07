import { API_BASE_URL } from "./apiConfig";

const API_URL = `${API_BASE_URL}/notifications`;
/*
  Convert VAPID public key into Uint8Array.
*/
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat(
    (4 - (base64String.length % 4)) % 4
  );

  const base64 = (
    base64String +
    padding
  )
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);

  return Uint8Array.from(
    [...rawData].map((char) => char.charCodeAt(0))
  );
}

/*
  Generic API request helper.
*/
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
      data?.message ||
        "Something went wrong. Please try again."
    );
  }

  return data;
}

/*
  ========================================
  IN-APP NOTIFICATIONS
  ========================================
*/

export const getNotifications = async () => {
  return request("/");
};

export const getUnreadNotificationCount = async () => {
  return request("/unread-count");
};

export const markNotificationAsRead = async (
  notificationId
) => {
  return request(
    `/${notificationId}/read`,
    {
      method: "PATCH",
    }
  );
};

export const markAllNotificationsAsRead = async () => {
  return request(
    "/read-all",
    {
      method: "PATCH",
    }
  );
};

/*
  ========================================
  WEB PUSH
  ========================================
*/

export const getPublicKey = async () => {
  const response = await fetch(
    `${API_URL}/public-key`
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message ||
        "Unable to load notification configuration."
    );
  }

  return data.publicKey;
};

export const registerNotificationWorker =
  async () => {
    if (!("serviceWorker" in navigator)) {
      throw new Error(
        "Service workers are not supported by this browser."
      );
    }

    return navigator.serviceWorker.register(
      "/sw.js"
    );
  };

export const enableNotifications = async () => {
  if (!("Notification" in window)) {
    throw new Error(
      "This browser does not support notifications."
    );
  }

  if (!("PushManager" in window)) {
    throw new Error(
      "This browser does not support push notifications."
    );
  }

  const permission =
    await Notification.requestPermission();

  if (permission !== "granted") {
    throw new Error(
      "Notification permission was not granted."
    );
  }

  const registration =
    await registerNotificationWorker();

  const publicKey =
    await getPublicKey();

  let subscription =
    await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription =
      await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey:
          urlBase64ToUint8Array(
            publicKey
          ),
      });
  }

  const response = await fetch(
    `${API_URL}/subscribe`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subscription,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message ||
        "Unable to save notification subscription."
    );
  }

  return {
    subscription,
    ...data,
  };
};

export const disableNotifications =
  async () => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const registration =
      await navigator.serviceWorker.getRegistration(
        "/"
      );

    if (!registration) {
      return;
    }

    const subscription =
      await registration.pushManager.getSubscription();

    if (!subscription) {
      return;
    }

    await fetch(
      `${API_URL}/subscribe`,
      {
        method: "DELETE",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          endpoint:
            subscription.endpoint,
        }),
      }
    );

    await subscription.unsubscribe();
  };