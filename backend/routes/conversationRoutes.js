const express = require("express");
const mongoose = require("mongoose");

const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const MessageRequest = require("../models/MessageRequest");
const User = require("../models/User");
const Connection = require("../models/Connection");
const Block = require("../models/Block");

const protect = require("../middleware/authMiddleware");

const {
  createNotification,
  sendPushNotification,
} = require("../services/notificationService");

const router = express.Router();

/*
  ============================================================
  HELPERS
  ============================================================
*/

/*
  Get a direct conversation belonging to the current user.
*/
const getDirectConversationForUser = async (
  conversationId,
  userId
) => {
  return Conversation.findOne({
    _id: conversationId,
    type: "direct",
    participants: userId,
  });
};


/*
  Check whether two users are connected.
*/
const areConnected = async (userA, userB) => {
  const connection = await Connection.findOne({
    $or: [
      {
        requester: userA,
        recipient: userB,
      },
      {
        requester: userB,
        recipient: userA,
      },
    ],
    status: "accepted",
  });

  return Boolean(connection);
};


/*
  Check whether either user has blocked the other.
*/
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

const getDirectKey = (userA, userB) =>
  [userA.toString(), userB.toString()].sort().join(":");


/*
  Send an in-app notification and push notification.
*/
const notifyUser = async ({
  req,
  recipient,
  actor = null,
  type,
  title,
  body,
  url = "/dashboard",
  tag,
}) => {
  try {
    const notification = await createNotification({
      recipient,
      actor,
      type,
      title,
      body,
      url,
    });

    /*
      Push notification.
      Message requests do not belong to a conversation,
      so there is no conversation mute check here.
    */
    await sendPushNotification(recipient, {
      title,
      body,
      type,
      url,
      tag:
        tag ||
        `cochat-${type}-${Date.now()}`,
    });

    return notification;
  } catch (error) {
    console.error(
      "Conversation notification error:",
      error
    );

    return null;
  }
};


/*
  ============================================================
  DIRECT CONVERSATIONS
  ============================================================
*/

/*
  POST /api/conversations

  Create or return a 1-to-1 conversation.

  IMPORTANT:
  This route is ONLY for direct conversations.
  Group conversations are handled by /api/groups.
*/
router.post("/", protect, async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID.",
      });
    }

    /*
      Don't allow messaging yourself.
    */
    if (
      req.user._id.toString() ===
      userId.toString()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "You cannot start a conversation with yourself.",
      });
    }

    /*
      Check target user.
    */
    const targetUser =
      await User.findById(userId);

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    /*
      Don't allow creating a conversation
      with a blocked user.
    */
    if (
      await areBlocked(
        req.user._id,
        userId
      )
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You cannot start a conversation with this user.",
      });
    }

    /*
      Only search DIRECT conversations.
    */
    const directKey = getDirectKey(
      req.user._id,
      userId
    );

    let existingConversation =
      await Conversation.findOne({
        type: "direct",
        directKey,
      }).populate(
        "participants",
        "username avatar bio college branch semester"
      );

    // Backfill the key for older conversations created before this safeguard.
    if (!existingConversation) {
      existingConversation = await Conversation.findOne({
        type: "direct",
        participants: { $all: [req.user._id, userId] },
      }).populate(
        "participants",
        "username avatar bio college branch semester"
      );

      if (existingConversation && !existingConversation.directKey) {
        existingConversation.directKey = directKey;
        await existingConversation.save();
      }
    }

    /*
      Return existing conversation.
    */
    if (existingConversation) {
      return res.status(200).json({
        success: true,
        conversation:
          existingConversation,
      });
    }

    /*
      Only connected users can directly
      create a conversation.

      First contact should go through
      message requests.
    */
    const connected = await areConnected(
      req.user._id,
      userId
    );

    if (!connected) {
      return res.status(403).json({
        success: false,
        message:
          "You can only start a conversation with a connected user. Send a message request instead.",
      });
    }

    /*
      Create DIRECT conversation.
    */
    const conversation =
      await Conversation.findOneAndUpdate(
        { type: "direct", directKey },
        {
          $setOnInsert: {
            type: "direct",
            directKey,
            participants: [req.user._id, userId],
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      );

    /*
      Populate before returning.
    */
    const populatedConversation =
      await Conversation.findById(
        conversation._id
      ).populate(
        "participants",
        "username avatar bio college branch semester"
      );

    return res.status(201).json({
      success: true,
      conversation:
        populatedConversation,
    });
  } catch (error) {
    console.error(
      "Create conversation error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to create conversation.",
    });
  }
});


/*
  GET /api/conversations

  Get current user's DIRECT conversations.

  Groups intentionally do NOT appear here.
*/
router.get("/", protect, async (req, res) => {
  try {
    const conversations =
      await Conversation.find({
        type: "direct",
        participants: req.user._id,
      })
        .populate(
          "participants",
          "username avatar bio college branch semester"
        )
        .populate(
          "lastMessage",
          "text sender createdAt"
        )
        .sort({
          updatedAt: -1,
        });

    return res.status(200).json({
      success: true,
      conversations,
    });
  } catch (error) {
    console.error(
      "Get conversations error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load conversations.",
    });
  }
});


/*
  ============================================================
  MESSAGE REQUESTS
  ============================================================
*/


/*
  GET /api/conversations/requests

  Get incoming pending message requests.
*/
router.get(
  "/requests",
  protect,
  async (req, res) => {
    try {
      const requests =
        await MessageRequest.find({
          recipient: req.user._id,
          status: "pending",
        })
          .populate(
            "sender",
            "username avatar bio college branch semester"
          )
          .populate(
            "recipient",
            "username avatar bio college branch semester"
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
        "Get message requests error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to load message requests.",
      });
    }
  }
);


/*
  GET /api/conversations/requests/sent

  Get requests sent by current user.

  We return all statuses so the frontend can
  display pending / accepted / declined history.
*/
router.get(
  "/requests/sent",
  protect,
  async (req, res) => {
    try {
      const requests =
        await MessageRequest.find({
          sender: req.user._id,
        })
          .populate(
            "recipient",
            "username avatar bio college branch semester"
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
        "Get sent message requests error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to load sent message requests.",
      });
    }
  }
);


/*
  POST /api/conversations/requests

  Send a first-contact message request.
*/
router.post(
  "/requests",
  protect,
  async (req, res) => {
    try {
      const {
        userId,
        text,
      } = req.body;

      const cleanText =
        text?.trim();

      /*
        Validate recipient.
      */
      if (!userId) {
        return res.status(400).json({
          success: false,
          message:
            "User ID is required.",
        });
      }

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

      /*
        Validate message.
      */
      if (!cleanText) {
        return res.status(400).json({
          success: false,
          message:
            "Message is required.",
        });
      }

      if (cleanText.length > 500) {
        return res.status(400).json({
          success: false,
          message:
            "Message request cannot exceed 500 characters.",
        });
      }

      /*
        Prevent self-request.
      */
      if (
        req.user._id.toString() ===
        userId.toString()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "You cannot send a message request to yourself.",
        });
      }

      /*
        Check recipient exists.
      */
      const recipient =
        await User.findById(userId);

      if (!recipient) {
        return res.status(404).json({
          success: false,
          message:
            "User not found.",
        });
      }

      /*
        Block check.
      */
      if (
        await areBlocked(
          req.user._id,
          userId
        )
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You cannot send a message request to this user.",
        });
      }

      /*
        If already connected, a request
        is unnecessary.
      */
      if (
        await areConnected(
          req.user._id,
          userId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "You are already connected with this user.",
        });
      }

      /*
        If an existing conversation exists,
        don't create another request.
      */
      const existingConversation =
        await Conversation.findOne({
          type: "direct",
          participants: {
            $all: [
              req.user._id,
              userId,
            ],
          },
        });

      if (existingConversation) {
        return res.status(400).json({
          success: false,
          message:
            "A conversation with this user already exists.",
        });
      }

      /*
        Prevent duplicate pending request
        in either direction.
      */
      const existingPendingRequest =
        await MessageRequest.findOne({
          $or: [
            {
              sender: req.user._id,
              recipient: userId,
              status: "pending",
            },
            {
              sender: userId,
              recipient: req.user._id,
              status: "pending",
            },
          ],
        });

      if (existingPendingRequest) {
        return res.status(409).json({
          success: false,
          message:
            existingPendingRequest.sender.toString() ===
            req.user._id.toString()
              ? "You already sent a message request to this user."
              : "This user has already sent you a message request.",
        });
      }

      /*
        Create request.
      */
      const request =
        await MessageRequest.create({
          sender: req.user._id,
          recipient: userId,
          text: cleanText,
          status: "pending",
        });

      /*
        Populate request.
      */
      const populatedRequest =
        await MessageRequest.findById(
          request._id
        )
          .populate(
            "sender",
            "username avatar bio college branch semester"
          )
          .populate(
            "recipient",
            "username avatar bio college branch semester"
          );

      /*
        Notify recipient.
      */
      await notifyUser({
        req,
        recipient: userId,
        actor: req.user._id,
        type: "message-request",
        title:
          `@${
            req.user.username ||
            "Someone"
          } sent you a message request`,
        body: cleanText,
        url: "/message-requests",
        tag:
          `message-request-${request._id}`,
      });

      return res.status(201).json({
        success: true,
        message:
          "Message request sent.",
        request:
          populatedRequest,
      });
    } catch (error) {
      console.error(
        "Send message request error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to send message request.",
      });
    }
  }
);


/*
  PATCH /api/conversations/requests/:requestId/accept

  Accept an incoming message request.

  This creates:
  1. A direct conversation.
  2. The original request message as the
     first message in that conversation.
*/
router.patch(
  "/requests/:requestId/accept",
  protect,
  async (req, res) => {
    try {
      const {
        requestId,
      } = req.params;

      if (
        !mongoose.Types.ObjectId.isValid(
          requestId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid message request ID.",
        });
      }

      /*
        Only recipient can accept.
      */
      const request =
        await MessageRequest.findOne({
          _id: requestId,
          recipient: req.user._id,
          status: "pending",
        });

      if (!request) {
        return res.status(404).json({
          success: false,
          message:
            "Message request not found or already handled.",
        });
      }

      /*
        Block safety check.
      */
      if (
        await areBlocked(
          req.user._id,
          request.sender
        )
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You cannot accept this message request.",
        });
      }

      /*
        Find existing direct conversation
        first, just in case one was created
        elsewhere.
      */
      let conversation =
        await Conversation.findOne({
          type: "direct",
          participants: {
            $all: [
              request.sender,
              request.recipient,
            ],
          },
        });

      /*
        Create conversation if needed.
      */
      if (!conversation) {
        conversation =
          await Conversation.create({
            type: "direct",
            participants: [
              request.sender,
              request.recipient,
            ],
          });
      }

      /*
        Prevent the original request from
        being duplicated as a message if
        this endpoint somehow gets retried.
      */
      let firstMessage = null;

      if (!request.conversation) {
        firstMessage =
          await Message.create({
            conversation:
              conversation._id,
            sender:
              request.sender,
            text:
              request.text,
          });

        conversation.lastMessage =
          firstMessage._id;

        await conversation.save();

        request.conversation =
          conversation._id;
      }

      /*
        Mark request accepted.
      */
      request.status =
        "accepted";

      await request.save();

      /*
        Populate conversation.
      */
      const populatedConversation =
        await Conversation.findById(
          conversation._id
        )
          .populate(
            "participants",
            "username avatar bio college branch semester"
          )
          .populate(
            "lastMessage",
            "text sender createdAt"
          );

      /*
        Populate first message.
      */
      if (firstMessage) {
        firstMessage =
          await Message.findById(
            firstMessage._id
          ).populate(
            "sender",
            "username avatar"
          );
      }

      /*
        Notify sender that request was accepted.
      */
      await notifyUser({
        req,
        recipient: request.sender,
        actor: req.user._id,
        type:
          "message-request-accepted",
        title:
          `@${
            req.user.username ||
            "Someone"
          } accepted your message request`,
        body:
          "You can now continue the conversation.",
        url:
          `/messages/${conversation._id}`,
        tag:
          `message-request-accepted-${request._id}`,
      });

      /*
        Real-time conversation update.
      */
      const io = req.app.get("io");

      if (io) {
        io.to(
          `user:${request.sender.toString()}`
        ).emit(
          "message-request:accepted",
          {
            requestId:
              request._id,
            conversation:
              populatedConversation,
          }
        );

        io.to(
          `user:${request.recipient.toString()}`
        ).emit(
          "message-request:accepted",
          {
            requestId:
              request._id,
            conversation:
              populatedConversation,
          }
        );

        /*
          Deliver the original message
          to users currently inside the
          conversation.
        */
        if (firstMessage) {
          io.to(
            `conversation:${conversation._id}`
          ).emit(
            "new-message",
            firstMessage
          );
        }
      }

      return res.status(200).json({
        success: true,
        message:
          "Message request accepted.",
        request,
        conversation:
          populatedConversation,
        firstMessage,
      });
    } catch (error) {
      console.error(
        "Accept message request error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to accept message request.",
      });
    }
  }
);


/*
  PATCH /api/conversations/requests/:requestId/decline

  Decline an incoming message request.
*/
router.patch(
  "/requests/:requestId/decline",
  protect,
  async (req, res) => {
    try {
      const {
        requestId,
      } = req.params;

      if (
        !mongoose.Types.ObjectId.isValid(
          requestId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid message request ID.",
        });
      }

      /*
        Only recipient can decline.
      */
      const request =
        await MessageRequest.findOne({
          _id: requestId,
          recipient: req.user._id,
          status: "pending",
        });

      if (!request) {
        return res.status(404).json({
          success: false,
          message:
            "Message request not found or already handled.",
        });
      }

      request.status =
        "declined";

      await request.save();

      /*
        We intentionally don't notify the
        sender about a decline.
      */

      return res.status(200).json({
        success: true,
        message:
          "Message request declined.",
        request,
      });
    } catch (error) {
      console.error(
        "Decline message request error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to decline message request.",
      });
    }
  }
);


/*
  ============================================================
  SPECIFIC DIRECT CONVERSATION
  ============================================================
*/


/*
  GET /api/conversations/:conversationId

  Get a specific DIRECT conversation.

  Group conversations should be accessed through:
  GET /api/groups/:groupId
*/
router.get(
  "/:conversationId",
  protect,
  async (req, res) => {
    try {
      const {
        conversationId,
      } = req.params;

      /*
        Validate conversation ID.
      */
      if (
        !mongoose.Types.ObjectId.isValid(
          conversationId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid conversation ID.",
        });
      }

      /*
        Explicitly require type: "direct".
      */
      const conversation =
        await getDirectConversationForUser(
          conversationId,
          req.user._id
        );

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message:
            "Conversation not found.",
        });
      }

      const populatedConversation =
        await Conversation.findById(
          conversation._id
        ).populate(
          "participants",
          "username avatar bio college branch semester"
        );

      return res.status(200).json({
        success: true,
        conversation:
          populatedConversation,
      });
    } catch (error) {
      console.error(
        "Get conversation error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to load conversation.",
      });
    }
  }
);


module.exports = router;