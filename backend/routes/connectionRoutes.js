const express = require("express");
const mongoose = require("mongoose");

const Connection = require("../models/Connection");
const User = require("../models/User");
const Block = require("../models/Block");
const protect = require("../middleware/authMiddleware");

const {
  createNotification,
  sendPushNotification,
} = require("../services/notificationService");

const router = express.Router();

const pairFilter = (userId, otherUserId) => ({
  $or: [
    {
      requester: userId,
      recipient: otherUserId,
    },
    {
      requester: otherUserId,
      recipient: userId,
    },
  ],
});

/*
  GET /api/connections

  Get all accepted connections for the current user.
*/
router.get("/", protect, async (req, res) => {
  try {
    const connections = await Connection.find({
      $or: [
        {
          requester: req.user._id,
          status: "accepted",
        },
        {
          recipient: req.user._id,
          status: "accepted",
        },
      ],
    })
      .populate(
        "requester",
        "username avatar bio college branch semester"
      )
      .populate(
        "recipient",
        "username avatar bio college branch semester"
      )
      .sort({
        updatedAt: -1,
      });

    return res.json({
      success: true,
      connections,
    });
  } catch (error) {
    console.error(
      "Get connections error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to load connections.",
    });
  }
});

/*
  GET /api/connections/status/:userId

  Get the connection status between
  the current user and another user.
*/
router.get(
  "/status/:userId",
  protect,
  async (req, res) => {
    try {
      const { userId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID.",
        });
      }

      const connection =
        await Connection.findOne(
          pairFilter(
            req.user._id,
            userId
          )
        );

      if (!connection) {
        return res.json({
          success: true,
          status: "none",
          direction: null,
          connection: null,
        });
      }

      const currentId =
        req.user._id.toString();

      const isRequester =
        connection.requester.toString() ===
        currentId;

      return res.json({
        success: true,
        status: connection.status,
        direction: isRequester
          ? "outgoing"
          : "incoming",
        connection,
      });
    } catch (error) {
      console.error(
        "Connection status error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to load connection status.",
      });
    }
  }
);

/*
  POST /api/connections/request/:userId

  Send a connection request.
*/
router.post(
  "/request/:userId",
  protect,
  async (req, res) => {
    try {
      const { userId } = req.params;

      if (
        !mongoose.Types.ObjectId.isValid(
          userId
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID.",
        });
      }

      if (
        req.user._id.toString() ===
        userId.toString()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "You cannot connect with yourself.",
        });
      }

      const targetUser =
        await User.findById(userId).select(
          "username avatar"
        );

      if (!targetUser) {
        return res.status(404).json({
          success: false,
          message: "User not found.",
        });
      }

      /*
        Block check.
      */
      const blocked =
        await Block.findOne({
          $or: [
            {
              blocker: req.user._id,
              blocked: userId,
            },
            {
              blocker: userId,
              blocked: req.user._id,
            },
          ],
        });

      if (blocked) {
        return res.status(403).json({
          success: false,
          message:
            "You cannot connect with this user.",
        });
      }

      let connection =
        await Connection.findOne(
          pairFilter(
            req.user._id,
            userId
          )
        );

      /*
        Existing relationship.
      */
      if (connection) {
        const currentId =
          req.user._id.toString();

        /*
          Already connected.
        */
        if (
          connection.status ===
          "accepted"
        ) {
          return res.json({
            success: true,
            message:
              "You are already connected.",
            connection,
          });
        }

        /*
          Current user already sent
          the pending request.
        */
        if (
          connection.status ===
            "pending" &&
          connection.requester.toString() ===
            currentId
        ) {
          return res.json({
            success: true,
            message:
              "Connection request already sent.",
            connection,
          });
        }

        /*
          The other person already sent
          a request to the current user.

          Sending Connect back accepts it.
        */
        if (
          connection.status ===
            "pending" &&
          connection.recipient.toString() ===
            currentId
        ) {
          connection.status =
            "accepted";

          await connection.save();

          return res.json({
            success: true,
            message:
              "Connection accepted.",
            connection,
          });
        }

        /*
          Reuse rejected relationship.
        */
        connection.requester =
          req.user._id;

        connection.recipient =
          userId;

        connection.status =
          "pending";

        await connection.save();
      } else {
        connection =
          await Connection.create({
            requester:
              req.user._id,
            recipient: userId,
            status: "pending",
          });
      }

      /*
        Realtime connection request.
      */
      const io =
        req.app.get("io");

      if (io) {
        io.to(
          `user:${userId.toString()}`
        ).emit(
          "connection-request",
          {
            recipientId:
              userId.toString(),

            connectionId:
              connection._id.toString(),
          }
        );
      }

      /*
        Persistent in-app notification.

        This is important because the recipient
        may not currently have the app open.
      */
      try {
        await createNotification({
          recipient: userId,
          actor: req.user._id,
          type: "connection-request",
          title:
            "New connection request",
          body:
            `@${req.user.username} wants to connect with you.`,
          url:
            "/message-requests",
        });
      } catch (notificationError) {
        console.error(
          "Connection in-app notification error:",
          notificationError
        );
      }

      /*
        Web push notification.
      */
      try {
        await sendPushNotification(
          userId,
          {
            title:
              "New connection request",

            body:
              `@${req.user.username} wants to connect with you.`,

            type:
              "connection-request",

            url:
              "/message-requests",
          }
        );
      } catch (notificationError) {
        console.error(
          "Connection push notification error:",
          notificationError
        );
      }

      return res.status(201).json({
        success: true,
        message:
          "Connection request sent.",
        connection,
      });
    } catch (error) {
      console.error(
        "Send connection request error:",
        error
      );

      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message:
            "A connection request already exists.",
        });
      }

      return res.status(500).json({
        success: false,
        message:
          "Unable to send connection request.",
      });
    }
  }
);

/*
  GET /api/connections/requests

  Get pending incoming connection requests.
*/
router.get(
  "/requests",
  protect,
  async (req, res) => {
    try {
      const requests =
        await Connection.find({
          recipient: req.user._id,
          status: "pending",
        })
          .populate(
            "requester",
            "username avatar bio college branch semester"
          )
          .sort({
            createdAt: -1,
          });

      return res.json({
        success: true,
        requests,
      });
    } catch (error) {
      console.error(
        "Get connection requests error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to load connection requests.",
      });
    }
  }
);

/*
  GET /api/connections/requests/sent

  Get connection requests sent by
  the current user.
*/
router.get(
  "/requests/sent",
  protect,
  async (req, res) => {
    try {
      const requests =
        await Connection.find({
          requester: req.user._id,
        })
          .populate(
            "recipient",
            "username avatar bio college branch semester"
          )
          .sort({
            createdAt: -1,
          });

      return res.json({
        success: true,
        requests,
      });
    } catch (error) {
      console.error(
        "Get sent connection requests error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to load sent connection requests.",
      });
    }
  }
);

/*
  GET /api/connections/requests/count

  Get the number of pending incoming
  connection requests.
*/
router.get(
  "/requests/count",
  protect,
  async (req, res) => {
    try {
      const count =
        await Connection.countDocuments({
          recipient: req.user._id,
          status: "pending",
        });

      return res.json({
        success: true,
        count,
      });
    } catch (error) {
      console.error(
        "Get connection request count error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to load connection request count.",
      });
    }
  }
);

/*
  PATCH /api/connections/:id/accept

  Accept a connection request.
*/
router.patch(
  "/:id/accept",
  protect,
  async (req, res) => {
    try {
      if (
        !mongoose.Types.ObjectId.isValid(
          req.params.id
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid connection ID.",
        });
      }

      const connection =
        await Connection.findOne({
          _id: req.params.id,
          recipient: req.user._id,
          status: "pending",
        });

      if (!connection) {
        return res.status(404).json({
          success: false,
          message:
            "Connection request not found.",
        });
      }

      connection.status =
        "accepted";

      await connection.save();

      const io =
        req.app.get("io");

      if (io) {
        /*
          Tell requester that their request
          was accepted.
        */
        io.to(
          `user:${connection.requester.toString()}`
        ).emit(
          "connection-accepted",
          {
            requesterId:
              connection.requester.toString(),

            connectionId:
              connection._id.toString(),
          }
        );

        /*
          Tell recipient to remove the
          pending request badge.
        */
        io.to(
          `user:${connection.recipient.toString()}`
        ).emit(
          "connection-request:updated",
          {
            connectionId:
              connection._id.toString(),

            status:
              "accepted",
          }
        );
      }

      /*
        Notify requester that the request
        was accepted.
      */
      try {
        await createNotification({
          recipient:
            connection.requester,
          actor:
            req.user._id,
          type:
            "connection-accepted",
          title:
            "Connection request accepted",
          body:
            `@${req.user.username} accepted your connection request.`,
          url:
            "/discover",
        });
      } catch (notificationError) {
        console.error(
          "Connection accepted notification error:",
          notificationError
        );
      }

      return res.json({
        success: true,
        message:
          "Connection accepted.",
        connection,
      });
    } catch (error) {
      console.error(
        "Accept connection error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to accept connection request.",
      });
    }
  }
);

/*
  PATCH /api/connections/:id/reject

  Reject a connection request.
*/
router.patch(
  "/:id/reject",
  protect,
  async (req, res) => {
    try {
      if (
        !mongoose.Types.ObjectId.isValid(
          req.params.id
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid connection ID.",
        });
      }

      const connection =
        await Connection.findOne({
          _id: req.params.id,
          recipient: req.user._id,
          status: "pending",
        });

      if (!connection) {
        return res.status(404).json({
          success: false,
          message:
            "Connection request not found.",
        });
      }

      connection.status =
        "rejected";

      await connection.save();

      const io =
        req.app.get("io");

      if (io) {
        io.to(
          `user:${connection.recipient.toString()}`
        ).emit(
          "connection-request:updated",
          {
            connectionId:
              connection._id.toString(),

            status:
              "rejected",
          }
        );
      }

      return res.json({
        success: true,
        message:
          "Connection request declined.",
      });
    } catch (error) {
      console.error(
        "Reject connection error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to decline connection request.",
      });
    }
  }
);

module.exports = router;