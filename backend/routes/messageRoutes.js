const express = require("express");
const mongoose = require("mongoose");

const Message = require("../models/Message");
const Conversation = require("../models/Conversation");
const ConversationSetting = require("../models/ConversationSetting");
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

const getConversationForUser = async (conversationId, userId) => {
  return Conversation.findOne({
    _id: conversationId,
    participants: userId,
  });
};

const isValidObjectId = (value) =>
  mongoose.Types.ObjectId.isValid(value);

/*
|--------------------------------------------------------------------------
| CURSOR HELPERS
|--------------------------------------------------------------------------
|
| Cursor format:
|
| {
|   createdAt: ISO date,
|   id: message id
| }
|
|--------------------------------------------------------------------------
*/

const encodeCursor = (message) => {
  if (!message) {
    return null;
  }

  const payload = JSON.stringify({
    createdAt: message.createdAt,
    id: message._id.toString(),
  });

  return Buffer.from(payload).toString("base64url");
};

const decodeCursor = (cursor) => {
  if (!cursor) {
    return null;
  }

  try {
    const decoded = Buffer.from(
      cursor,
      "base64url"
    ).toString("utf8");

    const parsed = JSON.parse(decoded);

    if (
      !parsed?.createdAt ||
      !isValidObjectId(parsed.id)
    ) {
      return null;
    }

    const createdAt = new Date(parsed.createdAt);

    if (Number.isNaN(createdAt.getTime())) {
      return null;
    }

    return {
      createdAt,
      id: parsed.id,
    };
  } catch {
    return null;
  }
};

/*
|--------------------------------------------------------------------------
| RECEIPTS
|--------------------------------------------------------------------------
*/

const buildReceipts = (participants, senderId) => {
  if (!Array.isArray(participants)) {
    return [];
  }

  return participants
    .filter(
      (participant) =>
        participant &&
        participant.toString() !==
          senderId.toString()
    )
    .map((participant) => ({
      user: participant,
      deliveredAt: null,
      readAt: null,
    }));
};

/*
|--------------------------------------------------------------------------
| NOTIFICATIONS
|--------------------------------------------------------------------------
*/

const notifyMessageRecipient = async ({
  recipient,
  actor,
  type,
  title,
  body,
  url,
  conversationId,
  tag,
}) => {
  try {
    /*
     * Always create the in-app notification.
     */
    const notification = await createNotification({
      recipient,
      actor,
      type,
      title,
      body,
      url,
    });

    /*
     * Conversation mute only affects push notifications.
     */
    const setting = conversationId
      ? await ConversationSetting.findOne({
          conversation: conversationId,
          user: recipient,
        })
      : null;

    if (!setting?.muted) {
      await sendPushNotification(recipient, {
        title,
        body,
        type,
        url,
        conversationId: conversationId
          ? conversationId.toString()
          : undefined,
        tag:
          tag ||
          `cochat-${type}-${Date.now()}`,
      });
    }

    return notification;
  } catch (error) {
    /*
     * Notification failure should NOT make
     * the actual message fail.
     */
    console.error(
      "Message notification error:",
      error
    );

    return null;
  }
};

/*
|--------------------------------------------------------------------------
| GET /api/messages/:conversationId
|--------------------------------------------------------------------------
|
| Paginated message history.
|
| Query:
|   ?limit=30
|   ?before=<cursor>
|
|--------------------------------------------------------------------------
*/

router.get(
  "/:conversationId",
  protect,
  async (req, res) => {
    try {
      const { conversationId } = req.params;

      if (!isValidObjectId(conversationId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid conversation ID.",
        });
      }

      const conversation =
        await getConversationForUser(
          conversationId,
          req.user._id
        );

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: "Conversation not found.",
        });
      }

      /*
       * Prevent malformed direct/self conversations
       * from being opened as normal 1:1 chats.
       */
      if (
        !conversation.isGroup &&
        conversation.participants.length !== 2
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid direct conversation.",
        });
      }

      const participantIds =
        conversation.participants.map(
          (participant) =>
            participant.toString()
        );

      if (
        !conversation.isGroup &&
        new Set(participantIds).size !==
          participantIds.length
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid direct conversation.",
        });
      }

      /*
       * Limit is capped to protect the API.
       */
      const requestedLimit =
        Number.parseInt(
          req.query.limit,
          10
        );

      const limit = Number.isFinite(
        requestedLimit
      )
        ? Math.min(
            Math.max(requestedLimit, 1),
            100
          )
        : 30;

      const cursor = decodeCursor(
        req.query.before
      );

      if (
        req.query.before &&
        !cursor
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid message cursor.",
        });
      }

      /*
       * Base message query.
       */
      const query = {
        conversation: conversationId,
      };

      /*
       * Cursor pagination.
       *
       * createdAt + _id prevents gaps when
       * multiple messages share the same timestamp.
       */
      if (cursor) {
        query.$or = [
          {
            createdAt: {
              $lt: cursor.createdAt,
            },
          },
          {
            createdAt:
              cursor.createdAt,
            _id: {
              $lt: cursor.id,
            },
          },
        ];
      }

      /*
       * Fetch one extra message to determine
       * whether older messages exist.
       */
      const fetchedMessages =
        await Message.find(query)
          .populate(
            "sender",
            "username avatar"
          )
          .sort({
            createdAt: -1,
            _id: -1,
          })
          .limit(limit + 1)
          .lean();

      const hasMore =
        fetchedMessages.length > limit;

      const pageMessages = hasMore
        ? fetchedMessages.slice(
            0,
            limit
          )
        : fetchedMessages;

      /*
       * API returns oldest -> newest.
       */
      pageMessages.reverse();

      const oldestMessage =
        pageMessages[0] || null;

      const nextCursor =
        hasMore && oldestMessage
          ? encodeCursor(
              oldestMessage
            )
          : null;

      /*
       * Backfill participant state entries
       * for older conversations.
       */
      conversation.ensureParticipantStates();

      if (
        conversation.isModified(
          "participantStates"
        )
      ) {
        await conversation.save();
      }

      return res.status(200).json({
        success: true,
        messages: pageMessages,
        pagination: {
          limit,
          hasMore,
          nextCursor,
        },
      });
    } catch (error) {
      console.error(
        "Get messages error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to load messages.",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| POST /api/messages
|--------------------------------------------------------------------------
|
| Send a message.
|
| Supports:
|   - direct conversations
|   - group conversations
|
|--------------------------------------------------------------------------
*/

router.post(
  "/",
  protect,
  async (req, res) => {
    try {
      const {
        conversationId,
        text,
      } = req.body;

      const cleanText =
        typeof text === "string"
          ? text.trim()
          : "";

      /*
       * Validate request body.
       */
      if (
        !conversationId ||
        !cleanText
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Conversation and message text are required.",
        });
      }

      /*
       * Validate conversation ID.
       */
      if (
        !isValidObjectId(
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
       * Prevent excessively large messages.
       */
      if (cleanText.length > 2000) {
        return res.status(400).json({
          success: false,
          message:
            "Message cannot exceed 2000 characters.",
        });
      }

      /*
       * Make sure the authenticated user
       * belongs to this conversation.
       */
      const conversation =
        await getConversationForUser(
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

      const currentUserId =
        req.user._id.toString();

      const participants =
        Array.isArray(
          conversation.participants
        )
          ? conversation.participants
          : [];

      const participantIds =
        participants.map(
          (participant) =>
            participant.toString()
        );

      /*
      |--------------------------------------------------------------------------
      | DIRECT CONVERSATION VALIDATION
      |--------------------------------------------------------------------------
      |
      | A valid 1:1 conversation MUST:
      |
      |   1. Have exactly two participants.
      |   2. Have two different participants.
      |   3. Include the authenticated user.
      |
      | This completely prevents self-chat.
      |
      |--------------------------------------------------------------------------
      */

      if (!conversation.isGroup) {
        const hasExactlyTwoParticipants =
          participantIds.length === 2;

        const hasTwoDifferentParticipants =
          new Set(
            participantIds
          ).size === 2;

        const includesCurrentUser =
          participantIds.includes(
            currentUserId
          );

        if (
          !hasExactlyTwoParticipants ||
          !hasTwoDifferentParticipants ||
          !includesCurrentUser
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid direct conversation.",
          });
        }
      }

      /*
      |--------------------------------------------------------------------------
      | DIRECT MESSAGE
      |--------------------------------------------------------------------------
      */

      if (!conversation.isGroup) {
        const otherParticipant =
          participants.find(
            (participant) =>
              participant.toString() !==
              currentUserId
          );

        /*
         * No other participant means
         * this would be a self conversation.
         */
        if (!otherParticipant) {
          return res.status(400).json({
            success: false,
            message:
              "You cannot send messages to yourself.",
          });
        }

        /*
         * Final explicit self-chat protection.
         */
        if (
          otherParticipant.toString() ===
          currentUserId
        ) {
          return res.status(400).json({
            success: false,
            message:
              "You cannot send messages to yourself.",
          });
        }

        /*
         * Check whether either user has blocked
         * the other.
         */
        const blocked =
          await Block.findOne({
            $or: [
              {
                blocker:
                  req.user._id,
                blocked:
                  otherParticipant,
              },
              {
                blocker:
                  otherParticipant,
                blocked:
                  req.user._id,
              },
            ],
          });

        if (blocked) {
          return res.status(403).json({
            success: false,
            message:
              "You cannot message this user.",
          });
        }

        /*
         * Create message.
         */
        const message =
          await Message.create({
            conversation:
              conversationId,
            sender:
              req.user._id,
            text: cleanText,
            receipts:
              buildReceipts(
                participants,
                req.user._id
              ),
          });

        /*
         * Update conversation.
         */
        conversation.lastMessage =
          message._id;

        conversation.lastMessageAt =
          message.createdAt;

        conversation.lastMessagePreview =
          cleanText;

        /*
         * Ensure participant states exist.
         */
        conversation.ensureParticipantStates();

        /*
         * Increment unread count for everyone
         * except sender.
         */
        conversation.incrementUnreadForOthers(
          req.user._id
        );

        await conversation.save();

        /*
         * Populate sender information for frontend.
         */
        const populatedMessage =
          await Message.findById(
            message._id
          ).populate(
            "sender",
            "username avatar"
          );

        /*
         * Socket.IO realtime update.
         */
        const io = req.app.get("io");

        if (io) {
          io.to(
            `conversation:${conversationId}`
          ).emit(
            "new-message",
            populatedMessage
          );

          /*
           * Update conversation list for
           * every participant.
           */
          for (
            const participant of participants
          ) {
            io.to(
              `user:${participant.toString()}`
            ).emit(
              "conversation:updated",
              {
                conversationId:
                  conversationId.toString(),
                lastMessage:
                  populatedMessage,
                updatedAt:
                  conversation.updatedAt,
              }
            );
          }
        }

        /*
         * In-app notification + push.
         *
         * Notification failure will NOT
         * break message sending.
         */
        await notifyMessageRecipient({
          recipient:
            otherParticipant,
          actor:
            req.user._id,
          type: "message",
          title: `@${
            req.user.username ||
            "Someone"
          }`,
          body: cleanText,
          url: `/messages/${conversationId}`,
          conversationId,
          tag: `message-${conversationId}`,
        });

        return res.status(201).json({
          success: true,
          message:
            populatedMessage,
        });
      }

      /*
      |--------------------------------------------------------------------------
      | GROUP MESSAGE
      |--------------------------------------------------------------------------
      */

      if (participants.length === 0) {
        return res.status(400).json({
          success: false,
          message:
            "This group has no participants.",
        });
      }

      /*
       * Create group message.
       */
      const message =
        await Message.create({
          conversation:
            conversationId,
          sender:
            req.user._id,
          text: cleanText,
          receipts:
            buildReceipts(
              participants,
              req.user._id
            ),
        });

      /*
       * Update conversation metadata.
       */
      conversation.lastMessage =
        message._id;

      conversation.lastMessageAt =
        message.createdAt;

      conversation.lastMessagePreview =
        cleanText;

      /*
       * Ensure participant states.
       */
      conversation.ensureParticipantStates();

      /*
       * Increment unread counts.
       */
      conversation.incrementUnreadForOthers(
        req.user._id
      );

      await conversation.save();

      /*
       * Populate sender.
       */
      const populatedMessage =
        await Message.findById(
          message._id
        ).populate(
          "sender",
          "username avatar"
        );

      /*
       * Socket.IO realtime update.
       */
      const io = req.app.get("io");

      if (io) {
        io.to(
          `conversation:${conversationId}`
        ).emit(
          "new-message",
          populatedMessage
        );

        /*
         * Synchronize conversation lists.
         */
        for (
          const participant of participants
        ) {
          io.to(
            `user:${participant.toString()}`
          ).emit(
            "conversation:updated",
            {
              conversationId:
                conversationId.toString(),
              lastMessage:
                populatedMessage,
              updatedAt:
                conversation.updatedAt,
            }
          );
        }
      }

      /*
       * Notify every group member except sender.
       */
      const recipients =
        participants.filter(
          (participant) =>
            participant.toString() !==
            currentUserId
        );

      for (
        const recipient of recipients
      ) {
        await notifyMessageRecipient({
          recipient,
          actor:
            req.user._id,
          type:
            "group-message",
          title:
            conversation.groupName ||
            "CoChat group",
          body: `@${
            req.user.username ||
            "Someone"
          }: ${cleanText}`,
          url: `/groups/${conversationId}`,
          conversationId,
          tag:
            `group-message-${conversationId}`,
        });
      }

      return res.status(201).json({
        success: true,
        message:
          populatedMessage,
      });
    } catch (error) {
      console.error(
        "Send message error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to send message.",
      });
    }
  }
);

module.exports = router;