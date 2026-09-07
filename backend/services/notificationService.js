const webpush = require("web-push");

const PushSubscription = require("../models/PushSubscription");
const Notification = require("../models/Notification");

const vapidPublicKey =
  process.env.VAPID_PUBLIC_KEY;

const vapidPrivateKey =
  process.env.VAPID_PRIVATE_KEY;

const vapidSubject =
  process.env.VAPID_SUBJECT ||
  "mailto:admin@cochat.app";

/*
  Configure Web Push only when both
  VAPID keys are available.
*/

if (
  vapidPublicKey &&
  vapidPrivateKey
) {
  webpush.setVapidDetails(
    vapidSubject,
    vapidPublicKey,
    vapidPrivateKey
  );
}

/*
  =====================================================
  SAVE PUSH SUBSCRIPTION
  =====================================================
*/

const saveSubscription = async (
  userId,
  subscription
) => {
  if (
    !subscription?.endpoint ||
    !subscription?.keys?.p256dh ||
    !subscription?.keys?.auth
  ) {
    throw new Error(
      "Invalid push subscription."
    );
  }

  if (
    !vapidPublicKey ||
    !vapidPrivateKey
  ) {
    throw new Error(
      "Push notifications are not configured on the server."
    );
  }

  return PushSubscription.findOneAndUpdate(
    {
      endpoint:
        subscription.endpoint,
    },
    {
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
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
      runValidators: true,
    }
  );
};

/*
  =====================================================
  REMOVE PUSH SUBSCRIPTION
  =====================================================
*/

const removeSubscription = async (
  endpoint,
  userId = null
) => {
  if (!endpoint) {
    return;
  }

  return PushSubscription.deleteOne(
    {
      endpoint,

      ...(userId
        ? {
            user: userId,
          }
        : {}),
    }
  );
};

/*
  =====================================================
  SEND WEB PUSH NOTIFICATION
  =====================================================
*/

const sendPushNotification =
  async (
    userId,
    payload
  ) => {
    if (
      !vapidPublicKey ||
      !vapidPrivateKey
    ) {
      console.warn(
        "Push notification skipped: VAPID keys are not configured."
      );

      return {
        sent: 0,
        failed: 0,
      };
    }

    const subscriptions =
      await PushSubscription.find({
        user: userId,
      });

    let sent = 0;
    let failed = 0;

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
            payload
          )
        );

        sent += 1;
      } catch (error) {
        failed += 1;

        console.error(
          "Push notification delivery failed:",
          error.statusCode,
          error.message
        );

        /*
          404 / 410 means the browser
          subscription is no longer valid.
        */

        if (
          error.statusCode ===
            404 ||
          error.statusCode ===
            410
        ) {
          await PushSubscription.deleteOne(
            {
              _id:
                subscription._id,
            }
          );
        }
      }
    }

    return {
      sent,
      failed,
    };
  };

/*
  =====================================================
  CREATE IN-APP NOTIFICATION
  =====================================================
*/

const createNotification =
  async ({
    recipient,
    actor = null,
    type,
    title,
    body,
    url = "/dashboard",
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
      Send realtime notification to
      the user's Socket.IO room.

      app.js exposes Socket.IO through
      global.io.
    */

    if (global.io) {
      global.io
        .to(
          `user:${recipient.toString()}`
        )
        .emit(
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