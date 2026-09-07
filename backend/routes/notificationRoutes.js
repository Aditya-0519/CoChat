const express = require("express");

const protect = require("../middleware/authMiddleware");

const {
  saveSubscription,
  removeSubscription,
} = require("../services/notificationService");

const Notification = require("../models/Notification");

const router =
  express.Router();

/*
  =====================================================
  GET /api/notifications/public-key
  =====================================================
*/

router.get(
  "/public-key",
  (req, res) => {
    const publicKey =
      process.env
        .VAPID_PUBLIC_KEY;

    if (!publicKey) {
      return res
        .status(500)
        .json({
          success: false,
          message:
            "Push notifications are not configured.",
        });
    }

    return res
      .status(200)
      .json({
        success: true,
        publicKey,
      });
  }
);

/*
  =====================================================
  POST /api/notifications/subscribe
  =====================================================
*/

router.post(
  "/subscribe",
  protect,
  async (
    req,
    res
  ) => {
    try {
      const subscription =
        req.body?.subscription;

      if (!subscription) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Push subscription is required.",
          });
      }

      await saveSubscription(
        req.user._id,
        subscription
      );

      return res
        .status(201)
        .json({
          success: true,
          message:
            "Push notifications enabled.",
        });
    } catch (error) {
      console.error(
        "Save push subscription error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            "Unable to enable notifications.",
        });
    }
  }
);

/*
  =====================================================
  DELETE /api/notifications/subscribe
  =====================================================
*/

router.delete(
  "/subscribe",
  protect,
  async (
    req,
    res
  ) => {
    try {
      const endpoint =
        req.body?.endpoint;

      if (!endpoint) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Subscription endpoint is required.",
          });
      }

      await removeSubscription(
        endpoint,
        req.user._id
      );

      return res
        .status(200)
        .json({
          success: true,
          message:
            "Push notifications disabled.",
        });
    } catch (error) {
      console.error(
        "Remove push subscription error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            "Unable to disable notifications.",
        });
    }
  }
);

/*
  =====================================================
  GET /api/notifications
  =====================================================
*/

router.get(
  "/",
  protect,
  async (
    req,
    res
  ) => {
    try {
      const notifications =
        await Notification.find({
          recipient:
            req.user._id,
        })
          .populate(
            "actor",
            "username avatar"
          )
          .sort({
            createdAt: -1,
          })
          .limit(50)
          .lean();

      return res
        .status(200)
        .json({
          success: true,
          notifications,
        });
    } catch (error) {
      console.error(
        "Get notifications error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            "Unable to load notifications.",
        });
    }
  }
);

/*
  =====================================================
  GET /api/notifications/unread-count
  =====================================================
*/

router.get(
  "/unread-count",
  protect,
  async (
    req,
    res
  ) => {
    try {
      const count =
        await Notification.countDocuments(
          {
            recipient:
              req.user._id,

            readAt: null,
          }
        );

      return res
        .status(200)
        .json({
          success: true,
          count,
        });
    } catch (error) {
      console.error(
        "Get unread notification count error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            "Unable to load notification count.",
        });
    }
  }
);

/*
  =====================================================
  PATCH /api/notifications/:notificationId/read
  =====================================================
*/

router.patch(
  "/:notificationId/read",
  protect,
  async (
    req,
    res
  ) => {
    try {
      const notification =
        await Notification.findOneAndUpdate(
          {
            _id:
              req.params
                .notificationId,

            recipient:
              req.user._id,
          },
          {
            $set: {
              readAt:
                new Date(),
            },
          },
          {
            new: true,
          }
        )
          .populate(
            "actor",
            "username avatar"
          )
          .lean();

      if (!notification) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "Notification not found.",
          });
      }

      return res
        .status(200)
        .json({
          success: true,
          notification,
        });
    } catch (error) {
      console.error(
        "Mark notification as read error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            "Unable to mark notification as read.",
        });
    }
  }
);

/*
  =====================================================
  PATCH /api/notifications/read-all
  =====================================================
*/

router.patch(
  "/read-all",
  protect,
  async (
    req,
    res
  ) => {
    try {
      const result =
        await Notification.updateMany(
          {
            recipient:
              req.user._id,

            readAt: null,
          },
          {
            $set: {
              readAt:
                new Date(),
            },
          }
        );

      return res
        .status(200)
        .json({
          success: true,
          modifiedCount:
            result.modifiedCount,
        });
    } catch (error) {
      console.error(
        "Mark all notifications as read error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            "Unable to mark notifications as read.",
        });
    }
  }
);

module.exports = router;