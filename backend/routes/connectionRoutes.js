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


// ============================================================
// HELPERS
// ============================================================

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


const areBlocked = async (userA, userB) => {
  const block = await Block.findOne({
    $or: [
      {
        blocker: userA,
        blocked: userB,
      },
      {
        blocker: userB,
        blocked: userA,
      },
    ],
  });

  return Boolean(block);
};


// ============================================================
// GET ALL ACCEPTED CONNECTIONS
// ============================================================

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

    return res.status(200).json({
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
      message:
        "Unable to load connections.",
    });
  }
});


// ============================================================
// GET CONNECTION STATUS
// ============================================================

router.get(
  "/status/:userId",
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
          message:
            "Invalid user ID.",
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
        return res.status(200).json({
          success: true,
          status: "none",
          direction: null,
          connection: null,
        });
      }

      const currentUserId =
        req.user._id.toString();

      const isRequester =
        connection.requester.toString() ===
        currentUserId;

      return res.status(200).json({
        success: true,
        status:
          connection.status,
        direction:
          isRequester
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


// ============================================================
// SEND CONNECTION REQUEST
// ============================================================

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
          message:
            "Invalid user ID.",
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
        await User.findById(
          userId
        ).select(
          "username avatar"
        );

      if (!targetUser) {
        return res.status(404).json({
          success: false,
          message:
            "User not found.",
        });
      }

      if (
        await areBlocked(
          req.user._id,
          userId
        )
      ) {
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

      // --------------------------------------------------------
      // EXISTING CONNECTION
      // --------------------------------------------------------

      if (connection) {
        const currentUserId =
          req.user._id.toString();

        // Already connected.
        if (
          connection.status ===
          "accepted"
        ) {
          return res.status(200).json({
            success: true,
            message:
              "You are already connected.",
            connection,
          });
        }

        // Current user already sent it.
        if (
          connection.status ===
            "pending" &&
          connection.requester.toString() ===
            currentUserId
        ) {
          return res.status(200).json({
            success: true,
            message:
              "Connection request already sent.",
            connection,
          });
        }

        // Other user sent one to us.
        // Accept it instead of creating
        // another connection.
        if (
          connection.status ===
            "pending" &&
          connection.recipient.toString() ===
            currentUserId
        ) {
          connection.status =
            "accepted";

          await connection.save();

          // Notify original requester.
          try {
            await createNotification({
              recipient:
                connection.requester,
              actor:
                req.user._id,
              type:
                "connection-accepted",
              title:
                "Connection accepted",
              body:
                `@${req.user.username} accepted your connection request.`,
              url:
                "/discover",
            });

            await sendPushNotification(
              connection.requester,
              {
                title:
                  "Connection accepted",
                body:
                  `@${req.user.username} accepted your connection request.`,
                type:
                  "connection-accepted",
                url:
                  "/discover",
              }
            );
          } catch (notificationError) {
            console.error(
              "Connection acceptance notification error:",
              notificationError
            );
          }

          const io =
            req.app.get("io");

          if (io) {
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
          }

          return res.status(200).json({
            success: true,
            message:
              "Connection accepted.",
            connection,
          });
        }

        // Re-use rejected connection.
        connection.requester =
          req.user._id;

        connection.recipient =
          userId;

        connection.status =
          "pending";

        await connection.save();
      } else {
        // ------------------------------------------------------
        // NEW CONNECTION
        // ------------------------------------------------------

        connection =
          await Connection.create({
            requester:
              req.user._id,
            recipient:
              userId,
            status:
              "pending",
          });
      }

      // ========================================================
      // CREATE PERSISTENT IN-APP NOTIFICATION
      // ========================================================

      try {
        await createNotification({
          recipient:
            userId,
          actor:
            req.user._id,
          type:
            "connection-request",
          title:
            "New connection request",
          body:
            `@${req.user.username} wants to connect with you.`,
          url:
            "/message-requests",
        });
      } catch (notificationError) {
        console.error(
          "Create connection notification error:",
          notificationError
        );
      }

      // ========================================================
      // REAL-TIME CONNECTION REQUEST EVENT
      // ========================================================

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

      // ========================================================
      // WEB PUSH
      // ========================================================

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
      } catch (pushError) {
        console.error(
          "Connection push notification error:",
          pushError
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

      if (
        error?.code === 11000
      ) {
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


// ============================================================
// GET INCOMING CONNECTION REQUESTS
// ============================================================

router.get(
  "/requests",
  protect,
  async (req, res) => {
    try {
      const requests =
        await Connection.find({
          recipient:
            req.user._id,
          status:
            "pending",
        })
          .populate(
            "requester",
            "username avatar bio college branch semester interests"
          )
          .sort({
            createdAt: -1,
          });

      return res.status(200).json({
        success: true,
        requests,
      });
    } catch (error) {
      console.error(
        "Get incoming connection requests error:",
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


// ============================================================
// GET SENT CONNECTION REQUESTS
// ============================================================

router.get(
  "/requests/sent",
  protect,
  async (req, res) => {
    try {
      const requests =
        await Connection.find({
          requester:
            req.user._id,
        })
          .populate(
            "recipient",
            "username avatar bio college branch semester interests"
          )
          .sort({
            createdAt: -1,
          });

      return res.status(200).json({
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


// ============================================================
// GET INCOMING CONNECTION REQUEST COUNT
// ============================================================

router.get(
  "/requests/count",
  protect,
  async (req, res) => {
    try {
      const count =
        await Connection.countDocuments({
          recipient:
            req.user._id,
          status:
            "pending",
        });

      return res.status(200).json({
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


// ============================================================
// ACCEPT CONNECTION REQUEST
// ============================================================

router.patch(
  "/:id/accept",
  protect,
  async (req, res) => {
    try {
      const { id } =
        req.params;

      if (
        !mongoose.Types.ObjectId.isValid(
          id
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
          _id: id,
          recipient:
            req.user._id,
          status:
            "pending",
        });

      if (!connection) {
        return res.status(404).json({
          success: false,
          message:
            "Connection request not found or already handled.",
        });
      }

      connection.status =
        "accepted";

      await connection.save();

      // ========================================================
      // NOTIFY REQUESTER
      // ========================================================

      try {
        await createNotification({
          recipient:
            connection.requester,
          actor:
            req.user._id,
          type:
            "connection-accepted",
          title:
            "Connection accepted",
          body:
            `@${req.user.username} accepted your connection request.`,
          url:
            "/discover",
        });

        await sendPushNotification(
          connection.requester,
          {
            title:
              "Connection accepted",
            body:
              `@${req.user.username} accepted your connection request.`,
            type:
              "connection-accepted",
            url:
              "/discover",
          }
        );
      } catch (notificationError) {
        console.error(
          "Connection accepted notification error:",
          notificationError
        );
      }

      // ========================================================
      // REAL-TIME ACCEPT EVENT
      // ========================================================

      const io =
        req.app.get("io");

      if (io) {
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

        io.to(
          `user:${connection.recipient.toString()}`
        ).emit(
          "connection-accepted",
          {
            requesterId:
              connection.requester.toString(),
            connectionId:
              connection._id.toString(),
          }
        );
      }

      return res.status(200).json({
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


// ============================================================
// REJECT CONNECTION REQUEST
// ============================================================

router.patch(
  "/:id/reject",
  protect,
  async (req, res) => {
    try {
      const { id } =
        req.params;

      if (
        !mongoose.Types.ObjectId.isValid(
          id
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
          _id: id,
          recipient:
            req.user._id,
          status:
            "pending",
        });

      if (!connection) {
        return res.status(404).json({
          success: false,
          message:
            "Connection request not found or already handled.",
        });
      }

      connection.status =
        "rejected";

      await connection.save();

      return res.status(200).json({
        success: true,
        message:
          "Connection request declined.",
        connection,
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