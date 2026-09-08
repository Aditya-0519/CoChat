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
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

const getId = (value) => {
  if (!value) return null;

  if (value._id) {
    return value._id.toString();
  }

  return value.toString();
};


/*
 * A valid direct conversation must:
 *
 * 1. Be a non-group conversation
 * 2. Have exactly 2 participants
 * 3. Have 2 unique participants
 * 4. Include the current user
 */
const isValidDirectConversation = (
  conversation,
  userId = null
) => {
  if (!conversation) {
    return false;
  }

  /*
   * Current Conversation model uses isGroup.
   *
   * We intentionally do NOT depend on the old
   * `type: "direct"` field.
   */
  if (conversation.isGroup === true) {
    return false;
  }

  const participants = Array.isArray(
    conversation.participants
  )
    ? conversation.participants
    : [];

  if (participants.length !== 2) {
    return false;
  }

  const participantIds = participants
    .map(getId)
    .filter(Boolean);

  if (participantIds.length !== 2) {
    return false;
  }

  if (
    new Set(participantIds).size !== 2
  ) {
    return false;
  }

  if (
    userId &&
    !participantIds.includes(
      getId(userId)
    )
  ) {
    return false;
  }

  return true;
};


/*
 * Find a valid direct conversation between
 * two different users.
 */
const getDirectConversationForUserPair = async (
  userA,
  userB
) => {
  const userAId = getId(userA);
  const userBId = getId(userB);

  /*
   * Never resolve a self-conversation.
   */
  if (!userAId || !userBId) {
    return null;
  }

  if (userAId === userBId) {
    return null;
  }

  const conversations =
    await Conversation.find({
      isGroup: false,
      participants: {
        $all: [userA, userB],
      },
    }).sort({
      updatedAt: -1,
    });

  /*
   * Do defensive validation in JavaScript.
   *
   * This also makes the code safe if old malformed
   * documents exist in MongoDB.
   */
  return (
    conversations.find(
      (conversation) =>
        isValidDirectConversation(
          conversation
        ) &&
        conversation.participants.some(
          (participant) =>
            getId(participant) === userAId
        ) &&
        conversation.participants.some(
          (participant) =>
            getId(participant) === userBId
        )
    ) || null
  );
};


/*
 * Find a direct conversation belonging to
 * the current user.
 */
const getDirectConversationForUser = async (
  conversationId,
  userId
) => {
  if (
    !mongoose.Types.ObjectId.isValid(
      conversationId
    )
  ) {
    return null;
  }

  const conversation =
    await Conversation.findOne({
      _id: conversationId,
      isGroup: false,
      participants: userId,
    });

  if (
    !isValidDirectConversation(
      conversation,
      userId
    )
  ) {
    return null;
  }

  return conversation;
};


/*
 * Check whether two users are connected.
 */
const areConnected = async (
  userA,
  userB
) => {
  const connection =
    await Connection.findOne({
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
 * Check whether either user has blocked
 * the other.
 */
const areBlocked = async (
  userA,
  userB
) => {
  const block =
    await Block.findOne({
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


/*
 * Send an in-app notification and push
 * notification.
 */
const notifyUser = async ({
  recipient,
  actor = null,
  type,
  title,
  body,
  url = "/dashboard",
  tag,
}) => {
  try {
    const notification =
      await createNotification({
        recipient,
        actor,
        type,
        title,
        body,
        url,
      });

    await sendPushNotification(
      recipient,
      {
        title,
        body,
        type,
        url,
        tag:
          tag ||
          `cochat-${type}-${Date.now()}`,
      }
    );

    return notification;
  } catch (error) {
    console.error(
      "Conversation notification error:",
      error
    );

    /*
     * Notification failure must never
     * break the actual operation.
     */
    return null;
  }
};


/*
|--------------------------------------------------------------------------
| CREATE / GET DIRECT CONVERSATION
|--------------------------------------------------------------------------
|
| POST /api/conversations
|
| Creates a conversation with a connected
| user or returns the existing one.
|
|--------------------------------------------------------------------------
*/

router.post(
  "/",
  protect,
  async (req, res) => {
    try {
      const { userId } = req.body;

      const currentUserId =
        req.user._id.toString();

      /*
       * Validate userId.
       */
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "User ID is required.",
        });
      }

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

      const targetUserId =
        userId.toString();

      /*
       * HARD SELF-CHAT PROTECTION.
       */
      if (
        currentUserId === targetUserId
      ) {
        return res.status(400).json({
          success: false,
          message:
            "You cannot start a conversation with yourself.",
        });
      }

      /*
       * Make sure target exists.
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
       * Block protection.
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
       * First look for an existing valid
       * conversation.
       */
      let conversation =
        await getDirectConversationForUserPair(
          req.user._id,
          userId
        );

      if (conversation) {
        /*
         * Ensure participant states exist.
         */
        if (
          typeof conversation.ensureParticipantStates ===
          "function"
        ) {
          conversation.ensureParticipantStates();

          if (
            conversation.isModified(
              "participantStates"
            )
          ) {
            await conversation.save();
          }
        }

        const populated =
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

        return res.status(200).json({
          success: true,
          conversation: populated,
        });
      }

      /*
       * Only connected users can create a
       * normal conversation.
       *
       * Otherwise they must send a request.
       */
      const connected =
        await areConnected(
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
       * Create the conversation.
       *
       * We do NOT use `type` or `directKey`
       * because the current Conversation model
       * uses `isGroup`.
       */
      conversation =
        await Conversation.create({
          participants: [
            req.user._id,
            userId,
          ],
          isGroup: false,
        });

      /*
       * Ensure participant states.
       */
      if (
        typeof conversation.ensureParticipantStates ===
        "function"
      ) {
        conversation.ensureParticipantStates();
        await conversation.save();
      }

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

      /*
       * Race-condition protection:
       *
       * If another request created the same
       * conversation simultaneously, try to
       * return the existing valid conversation.
       */
      try {
        const { userId } = req.body;

        if (
          userId &&
          mongoose.Types.ObjectId.isValid(
            userId
          ) &&
          req.user._id.toString() !==
            userId.toString()
        ) {
          const existing =
            await getDirectConversationForUserPair(
              req.user._id,
              userId
            );

          if (existing) {
            const populated =
              await Conversation.findById(
                existing._id
              )
                .populate(
                  "participants",
                  "username avatar bio college branch semester"
                )
                .populate(
                  "lastMessage",
                  "text sender createdAt"
                );

            return res.status(200).json({
              success: true,
              conversation: populated,
            });
          }
        }
      } catch (recoveryError) {
        console.error(
          "Conversation recovery error:",
          recoveryError
        );
      }

      return res.status(500).json({
        success: false,
        message:
          "Unable to create conversation.",
      });
    }
  }
);


/*
|--------------------------------------------------------------------------
| GET ALL DIRECT CONVERSATIONS
|--------------------------------------------------------------------------
|
| GET /api/conversations
|
| This powers the mobile /messages page.
|
|--------------------------------------------------------------------------
*/

router.get(
  "/",
  protect,
  async (req, res) => {
    try {
      const currentUserId =
        req.user._id.toString();

      /*
       * Get every non-group conversation
       * containing the current user.
       */
      const conversations =
        await Conversation.find({
          isGroup: false,
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
            lastMessageAt: -1,
            updatedAt: -1,
          })
          .lean();

      /*
       * Defensive filtering.
       *
       * This is critical for old malformed
       * self-conversation documents.
       */
      const safeConversations =
        conversations.filter(
          (conversation) => {
            if (
              !isValidDirectConversation(
                conversation,
                req.user._id
              )
            ) {
              return false;
            }

            const participantIds =
              conversation.participants.map(
                getId
              );

            /*
             * Make sure the other participant
             * actually exists.
             */
            const otherParticipantId =
              participantIds.find(
                (id) =>
                  id !== currentUserId
              );

            if (
              !otherParticipantId ||
              otherParticipantId ===
                currentUserId
            ) {
              return false;
            }

            return true;
          }
        );

      return res.status(200).json({
        success: true,
        conversations:
          safeConversations,
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
  }
);


/*
|--------------------------------------------------------------------------
| MESSAGE REQUESTS
|--------------------------------------------------------------------------
|
| GET /api/conversations/requests
|--------------------------------------------------------------------------
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
|--------------------------------------------------------------------------
| SENT MESSAGE REQUESTS
|--------------------------------------------------------------------------
|
| GET /api/conversations/requests/sent
|--------------------------------------------------------------------------
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
|--------------------------------------------------------------------------
| SEND MESSAGE REQUEST
|--------------------------------------------------------------------------
|
| POST /api/conversations/requests
|--------------------------------------------------------------------------
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
        typeof text === "string"
          ? text.trim()
          : "";

      /*
       * Validate recipient.
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
       * Message validation.
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
       * Self-request protection.
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
       * Recipient.
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
       * Block protection.
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
       * Already connected.
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
       * Existing conversation.
       */
      const existingConversation =
        await getDirectConversationForUserPair(
          req.user._id,
          userId
        );

      if (existingConversation) {
        return res.status(400).json({
          success: false,
          message:
            "A conversation with this user already exists.",
        });
      }

      /*
       * Duplicate pending request.
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
       * Create request.
       */
      const request =
        await MessageRequest.create({
          sender: req.user._id,
          recipient: userId,
          text: cleanText,
          status: "pending",
        });

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
       * Notify recipient.
       */
      await notifyUser({
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

      /*
       * Realtime request event.
       */
      const io = req.app.get("io");

      if (io) {
        io.to(
          `user:${userId.toString()}`
        ).emit(
          "message-request:new",
          {
            request:
              populatedRequest,
          }
        );

        /*
         * Also emit the generic request
         * event used by AppShell.
         */
        io.to(
          `user:${userId.toString()}`
        ).emit(
          "connection-request:updated"
        );
      }

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
|--------------------------------------------------------------------------
| ACCEPT MESSAGE REQUEST
|--------------------------------------------------------------------------
|
| PATCH /api/conversations/requests/:requestId/accept
|--------------------------------------------------------------------------
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
       * Only recipient can accept.
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
       * Block protection.
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
       * Find existing valid conversation.
       */
      let conversation =
        await getDirectConversationForUserPair(
          request.sender,
          request.recipient
        );

      /*
       * Create if necessary.
       */
      if (!conversation) {
        conversation =
          await Conversation.create({
            participants: [
              request.sender,
              request.recipient,
            ],
            isGroup: false,
          });
      }

      /*
       * Validate conversation before
       * creating the first message.
       */
      if (
        !isValidDirectConversation(
          conversation
        )
      ) {
        return res.status(500).json({
          success: false,
          message:
            "Unable to create a valid conversation.",
        });
      }

      /*
       * Ensure participant states.
       */
      if (
        typeof conversation.ensureParticipantStates ===
        "function"
      ) {
        conversation.ensureParticipantStates();
      }

      /*
       * Create the request's original
       * message only once.
       */
      let firstMessage = null;

      if (!request.conversation) {
        const receipts =
          conversation.participants
            .filter(
              (participant) =>
                getId(participant) !==
                getId(request.sender)
            )
            .map((participant) => ({
              user: participant,
              deliveredAt: null,
              readAt: null,
            }));

        firstMessage =
          await Message.create({
            conversation:
              conversation._id,
            sender:
              request.sender,
            text:
              request.text,
            receipts,
          });

        conversation.lastMessage =
          firstMessage._id;

        conversation.lastMessageAt =
          firstMessage.createdAt;

        conversation.lastMessagePreview =
          request.text;

        if (
          typeof conversation.incrementUnreadForOthers ===
          "function"
        ) {
          conversation.incrementUnreadForOthers(
            request.sender
          );
        }

        request.conversation =
          conversation._id;
      }

      /*
       * Save conversation.
       */
      await conversation.save();

      /*
       * Accept request.
       */
      request.status = "accepted";

      await request.save();

      /*
       * Populate conversation.
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
       * Populate first message.
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
       * Notify sender.
       */
      await notifyUser({
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
       * Realtime.
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

        if (firstMessage) {
          io.to(
            `conversation:${conversation._id.toString()}`
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
|--------------------------------------------------------------------------
| DECLINE MESSAGE REQUEST
|--------------------------------------------------------------------------
|
| PATCH /api/conversations/requests/:requestId/decline
|--------------------------------------------------------------------------
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
       * Only recipient can decline.
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

      request.status = "declined";

      await request.save();

      /*
       * Realtime.
       */
      const io = req.app.get("io");

      if (io) {
        io.to(
          `user:${request.sender.toString()}`
        ).emit(
          "message-request:declined",
          {
            requestId:
              request._id,
          }
        );
      }

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
|--------------------------------------------------------------------------
| GET SPECIFIC DIRECT CONVERSATION
|--------------------------------------------------------------------------
|
| GET /api/conversations/:conversationId
|--------------------------------------------------------------------------
*/

router.get(
  "/:conversationId",
  protect,
  async (req, res) => {
    try {
      const {
        conversationId,
      } = req.params;

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

      /*
       * Final self-chat protection.
       */
      const participantIds =
        conversation.participants.map(
          getId
        );

      const otherParticipantId =
        participantIds.find(
          (id) =>
            id !==
            req.user._id.toString()
        );

      if (
        !otherParticipantId ||
        otherParticipantId ===
          req.user._id.toString()
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Conversation not found.",
        });
      }

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