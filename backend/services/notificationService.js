const webpush = require("web-push");

const PushSubscription = require("../models/PushSubscription");
const Notification = require("../models/Notification");

/*
|--------------------------------------------------------------------------
| VAPID CONFIGURATION
|--------------------------------------------------------------------------
*/

const vapidPublicKey =
  process.env.VAPID_PUBLIC_KEY?.trim();

const vapidPrivateKey =
  process.env.VAPID_PRIVATE_KEY?.trim();

const vapidSubject =
  process.env.VAPID_SUBJECT?.trim() ||
  "mailto:admin@cochat.app";

/*
|--------------------------------------------------------------------------
| CONFIGURE WEB PUSH
|--------------------------------------------------------------------------
*/

const pushConfigured =
  Boolean(
    vapidPublicKey &&
      vapidPrivateKey
  );

if (pushConfigured) {
  webpush.setVapidDetails(
    vapidSubject,
    vapidPublicKey,
    vapidPrivateKey
  );

  console.log(
    "Web Push: VAPID configured successfully."
  );
} else {
  console.warn(
    "Web Push: VAPID keys are missing. Browser push notifications are disabled."
  );
}

/*
|--------------------------------------------------------------------------
| SAVE PUSH SUBSCRIPTION
|--------------------------------------------------------------------------
*/

const saveSubscription =
  async (
    userId,
    subscription
  ) => {
    if (
      !subscription?.endpoint
    ) {
      throw new Error(
        "Invalid push subscription: endpoint is missing."
      );
    }

    if (
      !subscription?.keys
        ?.p256dh
    ) {
      throw new Error(
        "Invalid push subscription: p256dh key is missing."
      );
    }

    if (
      !subscription?.keys
        ?.auth
    ) {
      throw new Error(
        "Invalid push subscription: auth key is missing."
      );
    }

    if (!pushConfigured) {
      throw new Error(
        "Web Push is not configured on the server."
      );
    }

    /*
     * Store the complete subscription.
     *
     * Endpoint is unique, so a browser/device can safely
     * re-sync the same subscription repeatedly.
     */
    const saved =
      await PushSubscription.findOneAndUpdate(
        {
          endpoint:
            subscription.endpoint,
        },
        {
          $set: {
            user: userId,

            endpoint:
              subscription.endpoint,

            keys: {
              p256dh:
                subscription.keys.p256dh,

              auth:
                subscription.keys.auth,
            },
          },
        },
        {
          upsert: true,

          new: true,

          setDefaultsOnInsert:
            true,

          runValidators:
            true,
        }
      );

    console.log(
      "Push subscription saved:",
      {
        user:
          userId.toString(),

        endpoint:
          subscription.endpoint.substring(
            0,
            80
          ),
      }
    );

    return saved;
  };

/*
|--------------------------------------------------------------------------
| REMOVE PUSH SUBSCRIPTION
|--------------------------------------------------------------------------
*/

const removeSubscription =
  async (
    endpoint,
    userId = null
  ) => {
    if (!endpoint) {
      return null;
    }

    const query = {
      endpoint,
    };

    if (userId) {
      query.user =
        userId;
    }

    return PushSubscription.deleteOne(
      query
    );
  };

/*
|--------------------------------------------------------------------------
| SEND WEB PUSH
|--------------------------------------------------------------------------
*/

const sendPushNotification =
  async (
    userId,
    payload
  ) => {
    if (!pushConfigured) {
      console.warn(
        "Push notification skipped: VAPID is not configured."
      );

      return {
        sent: 0,
        failed: 0,
        reason:
          "vapid-not-configured",
      };
    }

    /*
     * Find every browser/device logged into this account.
     *
     * Example:
     *
     * Chrome desktop
     * Chrome Android
     * another laptop
     *
     * All can receive the notification.
     */
    const subscriptions =
      await PushSubscription.find({
        user: userId,
      });

    if (
      subscriptions.length ===
      0
    ) {
      console.log(
        "No push subscriptions found for user:",
        userId.toString()
      );

      return {
        sent: 0,
        failed: 0,
        reason:
          "no-subscriptions",
      };
    }

    let sent = 0;
    let failed = 0;

    /*
     * Normalize payload.
     */
    const pushPayload = {
      title:
        payload?.title ||
        "CoChat",

      body:
        payload?.body ||
        "You have a new notification.",

      icon:
        payload?.icon ||
        "/icons/icon-192.png",

      badge:
        payload?.badge ||
        "/icons/icon-192.png",

      tag:
        payload?.tag ||
        `cochat-${Date.now()}`,

      renotify:
        payload?.renotify !==
        false,

      type:
        payload?.type ||
        "general",

      url:
        payload?.url ||
        "/notifications",

      conversationId:
        payload?.conversationId ||
        null,

      notificationId:
        payload?.notificationId ||
        null,
    };

    for (
      const subscription of
        subscriptions
    ) {
      try {
        await webpush.sendNotification(
          {
            endpoint:
              subscription.endpoint,

            keys:
              subscription.keys,
          },
          JSON.stringify(
            pushPayload
          ),
          {
            TTL: 60 * 60,
            urgency: "high",
          }
        );

        sent += 1;

        console.log(
          "Push notification sent successfully:",
          {
            user:
              userId.toString(),

            type:
              pushPayload.type,
          }
        );
      } catch (error) {
        failed += 1;

        console.error(
          "Push notification delivery failed:",
          {
            user:
              userId.toString(),

            statusCode:
              error?.statusCode,

            body:
              error?.body,

            message:
              error?.message,
          }
        );

        /*
         * 404 and 410 mean the browser subscription is
         * permanently invalid/expired.
         *
         * Remove it immediately.
         */
        if (
          error?.statusCode ===
            404 ||
          error?.statusCode ===
            410
        ) {
          try {
            await PushSubscription.deleteOne(
              {
                _id:
                  subscription._id,
              }
            );

            console.log(
              "Removed expired push subscription:",
              subscription.endpoint
            );
          } catch (deleteError) {
            console.error(
              "Unable to remove expired push subscription:",
              deleteError
            );
          }
        }
      }
    }

    return {
      sent,
      failed,
      total:
        subscriptions.length,
    };
  };

/*
|--------------------------------------------------------------------------
| CREATE IN-APP NOTIFICATION
|--------------------------------------------------------------------------
*/

const createNotification =
  async ({
    recipient,
    actor = null,
    type,
    title,
    body,
    url = "/notifications",
  }) => {
    const notification =
      await Notification.create({
        recipient,

        actor,

        type,

        title,

        body,

        url,
      });

    /*
     * Notify currently connected clients.
     *
     * app.js stores Socket.IO on req.app.
     *
     * Some older code also expects global.io.
     *
     * Support both safely.
     */
    const io =
      global.io;

    if (io) {
      io.to(
        `user:${recipient.toString()}`
      ).emit(
        "notification:new",
        notification
      );
    }

    return notification;
  };

module.exports = {
  saveSubscription,

  removeSubscription,

  sendPushNotification,

  createNotification,
};