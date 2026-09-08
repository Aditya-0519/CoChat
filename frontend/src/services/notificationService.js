import {
  API_BASE_URL,
} from "./apiConfig";

/*
|--------------------------------------------------------------------------
| API
|--------------------------------------------------------------------------
*/

const API_URL =
  `${API_BASE_URL}/notifications`;

/*
|--------------------------------------------------------------------------
| VAPID KEY CONVERSION
|--------------------------------------------------------------------------
*/

function urlBase64ToUint8Array(
  base64String
) {
  if (!base64String) {
    throw new Error(
      "VAPID public key is missing."
    );
  }

  const padding =
    "=".repeat(
      (4 -
        (base64String.length %
          4)) %
        4
    );

  const base64 = (
    base64String +
    padding
  )
    .replace(
      /-/g,
      "+"
    )
    .replace(
      /_/g,
      "/"
    );

  const rawData =
    window.atob(base64);

  return Uint8Array.from(
    [...rawData].map(
      (character) =>
        character.charCodeAt(
          0
        )
    )
  );
}

/*
|--------------------------------------------------------------------------
| API REQUEST
|--------------------------------------------------------------------------
*/

async function request(
  path,
  options = {}
) {
  const response =
    await fetch(
      `${API_URL}${path}`,
      {
        credentials:
          "include",

        ...options,

        headers: {
          "Content-Type":
            "application/json",

          ...(options.headers ||
            {}),
        },
      }
    );

  const data =
    await response
      .json()
      .catch(() => ({}));

  if (!response.ok) {
    const error =
      new Error(
        data?.message ||
          "Something went wrong."
      );

    error.status =
      response.status;

    throw error;
  }

  return data;
}

/*
|--------------------------------------------------------------------------
| IN-APP NOTIFICATIONS
|--------------------------------------------------------------------------
*/

export const getNotifications =
  async () => {
    return request("/");
  };

export const getUnreadNotificationCount =
  async () => {
    return request(
      "/unread-count"
    );
  };

export const markNotificationAsRead =
  async (
    notificationId
  ) => {
    return request(
      `/${notificationId}/read`,
      {
        method: "PATCH",
      }
    );
  };

export const markAllNotificationsAsRead =
  async () => {
    return request(
      "/read-all",
      {
        method: "PATCH",
      }
    );
  };

/*
|--------------------------------------------------------------------------
| GET VAPID PUBLIC KEY
|--------------------------------------------------------------------------
*/

export const getPublicKey =
  async () => {
    const response =
      await fetch(
        `${API_URL}/public-key`,
        {
          method: "GET",

          credentials:
            "include",

          cache: "no-store",
        }
      );

    const data =
      await response
        .json()
        .catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data?.message ||
          "Unable to load push notification configuration."
      );
    }

    if (!data?.publicKey) {
      throw new Error(
        "Server did not return a VAPID public key."
      );
    }

    return data.publicKey;
  };

/*
|--------------------------------------------------------------------------
| REGISTER SERVICE WORKER
|--------------------------------------------------------------------------
*/

export const registerNotificationWorker =
  async () => {
    if (
      !("serviceWorker" in
        navigator)
    ) {
      throw new Error(
        "Service workers are not supported by this browser."
      );
    }

    if (
      !window.isSecureContext
    ) {
      throw new Error(
        "Push notifications require HTTPS."
      );
    }

    /*
     * Register from root so it controls the
     * entire CoChat application.
     */
    const registration =
      await navigator.serviceWorker.register(
        "/sw.js",
        {
          scope: "/",
          updateViaCache:
            "none",
        }
      );

    /*
     * Ask browser to check for a new worker.
     */
    try {
      await registration.update();
    } catch (error) {
      console.warn(
        "Service worker update check failed:",
        error
      );
    }

    /*
     * Wait for an active worker.
     */
    await navigator.serviceWorker.ready;

    return registration;
  };

/*
|--------------------------------------------------------------------------
| GET CURRENT PUSH SUBSCRIPTION
|--------------------------------------------------------------------------
*/

const getCurrentPushSubscription =
  async () => {
    const registration =
      await navigator
        .serviceWorker
        .ready;

    return registration
      .pushManager
      .getSubscription();
  };

/*
|--------------------------------------------------------------------------
| SEND SUBSCRIPTION TO BACKEND
|--------------------------------------------------------------------------
*/

const saveBrowserSubscription =
  async (
    subscription
  ) => {
    if (!subscription) {
      throw new Error(
        "No push subscription exists."
      );
    }

    const subscriptionJSON =
      subscription.toJSON
        ? subscription.toJSON()
        : subscription;

    const response =
      await fetch(
        `${API_URL}/subscribe`,
        {
          method: "POST",

          credentials:
            "include",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            subscription:
              subscriptionJSON,
          }),
        }
      );

    const data =
      await response
        .json()
        .catch(() => ({}));

    if (!response.ok) {
      const error =
        new Error(
          data?.message ||
            "Unable to save push subscription."
        );

      error.status =
        response.status;

      throw error;
    }

    return data;
  };

/*
|--------------------------------------------------------------------------
| CREATE NEW PUSH SUBSCRIPTION
|--------------------------------------------------------------------------
*/

const createPushSubscription =
  async () => {
    const publicKey =
      await getPublicKey();

    const registration =
      await navigator
        .serviceWorker
        .ready;

    /*
     * Check once more in case another tab
     * created the subscription.
     */
    let subscription =
      await registration
        .pushManager
        .getSubscription();

    if (!subscription) {
      subscription =
        await registration
          .pushManager
          .subscribe({
            userVisibleOnly:
              true,

            applicationServerKey:
              urlBase64ToUint8Array(
                publicKey
              ),
          });
    }

    return subscription;
  };

/*
|--------------------------------------------------------------------------
| SYNCHRONIZE PUSH SUBSCRIPTION
|--------------------------------------------------------------------------
|
| This function is safe to run repeatedly.
|
| It:
|
| 1. Checks permission.
| 2. Registers SW.
| 3. Gets existing browser subscription.
| 4. Creates one if necessary.
| 5. Sends it to backend.
|
|--------------------------------------------------------------------------
*/

export const syncNotificationSubscription =
  async () => {
    if (
      !("Notification" in
        window)
    ) {
      return {
        enabled: false,
        reason:
          "unsupported",
      };
    }

    if (
      !("PushManager" in
        window)
    ) {
      return {
        enabled: false,
        reason:
          "unsupported",
      };
    }

    if (
      !("serviceWorker" in
        navigator)
    ) {
      return {
        enabled: false,
        reason:
          "unsupported",
      };
    }

    if (
      !window.isSecureContext
    ) {
      return {
        enabled: false,
        reason:
          "insecure-context",
      };
    }

    /*
     * We intentionally NEVER ask for permission
     * from this function.
     */
    if (
      Notification.permission !==
      "granted"
    ) {
      return {
        enabled: false,
        reason:
          Notification.permission,
      };
    }

    await registerNotificationWorker();

    let subscription =
      await getCurrentPushSubscription();

    /*
     * Browser has no subscription.
     */
    if (!subscription) {
      subscription =
        await createPushSubscription();
    }

    /*
     * Save/re-sync with backend.
     */
    const data =
      await saveBrowserSubscription(
        subscription
      );

    return {
      enabled: true,

      subscription,

      ...data,
    };
  };

/*
|--------------------------------------------------------------------------
| ENABLE NOTIFICATIONS
|--------------------------------------------------------------------------
|
| This is the ONLY function that asks the user for
| notification permission.
|--------------------------------------------------------------------------
*/

export const enableNotifications =
  async () => {
    if (
      !("Notification" in
        window)
    ) {
      throw new Error(
        "This browser does not support notifications."
      );
    }

    if (
      !("PushManager" in
        window)
    ) {
      throw new Error(
        "This browser does not support push notifications."
      );
    }

    if (
      !("serviceWorker" in
        navigator)
    ) {
      throw new Error(
        "This browser does not support service workers."
      );
    }

    if (
      !window.isSecureContext
    ) {
      throw new Error(
        "Push notifications require HTTPS. Please open the deployed CoChat HTTPS URL."
      );
    }

    /*
     * Ask permission.
     */
    const permission =
      await Notification.requestPermission();

    if (
      permission !==
      "granted"
    ) {
      throw new Error(
        permission ===
          "denied"
          ? "Notifications are blocked for CoChat in your browser settings."
          : "Notification permission was not granted."
      );
    }

    /*
     * Now create/sync subscription.
     */
    return syncNotificationSubscription();
  };

/*
|--------------------------------------------------------------------------
| DISABLE NOTIFICATIONS
|--------------------------------------------------------------------------
*/

export const disableNotifications =
  async () => {
    if (
      !("serviceWorker" in
        navigator)
    ) {
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
      await registration
        .pushManager
        .getSubscription();

    if (!subscription) {
      return;
    }

    /*
     * Remove subscription from backend first.
     */
    try {
      await fetch(
        `${API_URL}/subscribe`,
        {
          method: "DELETE",

          credentials:
            "include",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            endpoint:
              subscription.endpoint,
          }),
        }
      );
    } catch (error) {
      console.warn(
        "Unable to remove push subscription from server:",
        error
      );
    }

    /*
     * Then unsubscribe locally.
     */
    try {
      await subscription.unsubscribe();
    } catch (error) {
      console.warn(
        "Unable to unsubscribe browser push:",
        error
      );
    }
  };

/*
|--------------------------------------------------------------------------
| RE-SUBSCRIBE AFTER BROWSER ROTATES SUBSCRIPTION
|--------------------------------------------------------------------------
*/

export const handlePushSubscriptionChange =
  async () => {
    if (
      !("Notification" in
        window)
    ) {
      return;
    }

    if (
      Notification.permission !==
      "granted"
    ) {
      return;
    }

    try {
      await syncNotificationSubscription();

      console.log(
        "CoChat push subscription successfully resynchronized."
      );
    } catch (error) {
      console.error(
        "Unable to resynchronize push subscription:",
        error
      );
    }
  };