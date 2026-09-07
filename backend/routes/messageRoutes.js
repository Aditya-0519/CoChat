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

const getConversationForUser = async (
  conversationId,
  userId
) => {
  return Conversation.findOne({
    _id: conversationId,
    participants: userId,
  });
};

const isValidObjectId = (value) =>
  mongoose.Types.ObjectId.isValid(value);

/*
  Cursor format:

  {
    createdAt: ISO date,
    id: message id
  }

  We encode this so the frontend can safely
  send it back to the API.
*/
const encodeCursor = (message) => {
  if (!message) {
    return null;
  }

  const payload = JSON.stringify({
    createdAt: message.createdAt,
    id: message._id.toString(),
  });

  return Buffer.from(payload).toString(
    "base64url"
  );
};

const decodeCursor = (cursor) => {
  if (!cursor) {
    return null;
  }

  try {
    const decoded =
      Buffer.from(
        cursor,
        "base64url"
      ).toString("utf8");

    const parsed =
      JSON.parse(decoded);

    if (
      !parsed?.createdAt ||
      !isValidObjectId(parsed.id)
    ) {
      return null;
    }

    const createdAt =
      new Date(parsed.createdAt);

    if (
      Number.isNaN(
        createdAt.getTime()
      )
    ) {
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
  Create a receipt entry for every recipient.

  The sender does NOT need a receipt for their own
  message.

  We keep receipts on the message because delivery
  and read state belongs to each recipient.
*/
const buildReceipts = (
  participants,
  senderId
) => {
  return participants
    .filter(
      (participant) =>
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
  req,
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
      Always create the in-app notification.
    */
    const notification =
      await createNotification({
        recipient,
        actor,
        type,
        title,
        body,
        url,
      });

    /*
      Conversation mute only affects push.
    */
    const setting = conversationId
      ? await ConversationSetting.findOne({
          conversation:
            conversationId,
          user: recipient,
        })
      : null;

    if (!setting?.muted) {
      await sendPushNotification(
        recipient,
        {
          title,
          body,
          type,
          url,
          conversationId:
            conversationId
              ? conversationId.toString()
              : undefined,
          tag:
            tag ||
            `cochat-${type}-${Date.now()}`,
        }
      );
    }

    return notification;
  } catch (error) {
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
|
|   ?limit=30
|   ?before=<cursor>
|
| Behaviour:
|
|   First request:
|     returns newest 30 messages.
|
|   Next request:
|     returns 30 messages older than cursor.
|
| Response messages are returned oldest -> newest
| inside the requested page so the frontend can
| render naturally.
|
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

      /*
        Limit is intentionally capped.

        This prevents a client from requesting
        thousands of messages in one HTTP request.
      */
      const requestedLimit =
        Number.parseInt(
          req.query.limit,
          10
        );

      const limit =
        Number.isFinite(
          requestedLimit
        )
          ? Math.min(
              Math.max(
                requestedLimit,
                1
              ),
              100
            )
          : 30;

      const cursor =
        decodeCursor(
          req.query.before
        );

      if (
        req.query.before &&
        !cursor
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid message cursor.",
        });
      }

      /*
        Build cursor query.

        We use createdAt + _id together so two messages
        with the same timestamp do not create gaps.
      */
      const query = {
        conversation:
          conversationId,
      };

      if (cursor) {
        query.$or = [
          {
            createdAt: {
              $lt:
                cursor.createdAt,
            },
          },
          {
            createdAt:
              cursor.createdAt,
            _id: {
              $lt:
                cursor.id,
            },
          },
        ];
      }

      /*
        Fetch one extra message.

        If we receive limit + 1, there are older
        messages remaining.
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
        fetchedMessages.length >
        limit;

      const pageMessages =
        hasMore
          ? fetchedMessages.slice(
              0,
              limit
            )
          : fetchedMessages;

      /*
        We fetched newest -> oldest for efficient
        pagination.

        Frontend wants oldest -> newest.
      */
      pageMessages.reverse();

      /*
        The oldest message in this page becomes
        the cursor for the next request.
      */
      const oldestMessage =
        pageMessages[0] || null;

      const nextCursor =
        hasMore && oldestMessage
          ? encodeCursor(
              oldestMessage
            )
          : null;

      /*
        Make sure the conversation has participant
        read-state entries.

        This also backfills conversations created
        before Phase 2.
      */
      conversation.ensureParticipantStates();

      /*
        We don't need to save if nothing changed,
        but old conversations may not have states.
      */
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

      if (cleanText.length > 2000) {
        return res.status(400).json({
          success: false,
          message:
            "Message cannot exceed 2000 characters.",
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
          message:
            "Conversation not found.",
        });
      }

      /*
      ==========================================================
      DIRECT MESSAGE
      ==========================================================
      */

      if (
        conversation.type ===
        "direct"
      ) {
        const otherParticipant =
          conversation.participants.find(
            (participant) =>
              participant.toString() !==
              req.user._id.toString()
          );

        if (!otherParticipant) {
          return res.status(400).json({
            success: false,
            message:
              "Unable to determine message recipient.",
          });
        }

        /*
          Block safety check.
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
          Create message with a receipt for
          the other participant.
        */
        const message =
          await Message.create({
            conversation:
              conversationId,
            sender:
              req.user._id,
            text:
              cleanText,
            receipts:
              buildReceipts(
                conversation.participants,
                req.user._id
              ),
          });

        conversation.lastMessage =
          message._id;

        /*
          Ensure participant state exists for
          this conversation.
        */
        conversation.ensureParticipantStates();

        await conversation.save();

        const populatedMessage =
          await Message.findById(
            message._id
          ).populate(
            "sender",
            "username avatar"
          );

        /*
          Real-time message.
        */
        const io =
          req.app.get("io");

        if (io) {
          io.to(
            `conversation:${conversationId}`
          ).emit(
            "new-message",
            populatedMessage
          );

          /*
            Update conversation lists for every
            participant.

            This allows the sidebar to move the
            conversation to the top immediately.
          */
          for (
            const participant
            of conversation.participants
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
          Notification + push.
        */
        await notifyMessageRecipient({
          req,
          recipient:
            otherParticipant,
          actor:
            req.user._id,
          type:
            "message",
          title:
            `@${
              req.user.username ||
              "Someone"
            }`,
          body:
            cleanText,
          url:
            `/messages/${conversationId}`,
          conversationId,
          tag:
            `message-${conversationId}`,
        });

        return res.status(201).json({
          success: true,
          message:
            populatedMessage,
        });
      }

      /*
      ==========================================================
      GROUP MESSAGE
      ==========================================================
      */

      const message =
        await Message.create({
          conversation:
            conversationId,
          sender:
            req.user._id,
          text:
            cleanText,
          receipts:
            buildReceipts(
              conversation.participants,
              req.user._id
            ),
        });

      conversation.lastMessage =
        message._id;

      conversation.ensureParticipantStates();

      await conversation.save();

      const populatedMessage =
        await Message.findById(
          message._id
        ).populate(
          "sender",
          "username avatar"
        );

      const io =
        req.app.get("io");

      if (io) {
        io.to(
          `conversation:${conversationId}`
        ).emit(
          "new-message",
          populatedMessage
        );

        /*
          Synchronize conversation lists.
        */
        for (
          const participant
          of conversation.participants
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
        Notify all group members except sender.
      */
      const recipients =
        conversation.participants.filter(
          (participant) =>
            participant.toString() !==
            req.user._id.toString()
        );

      for (
        const recipient
        of recipients
      ) {
        await notifyMessageRecipient({
          req,
          recipient,
          actor:
            req.user._id,
          type:
            "group-message",
          title:
            conversation.name ||
            "CoChat group",
          body:
            `@${
              req.user.username ||
              "Someone"
            }: ${cleanText}`,
          url:
            `/groups/${conversationId}`,
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