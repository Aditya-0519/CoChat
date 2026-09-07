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
  Helper:
  Check whether a user is a member of a conversation.
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

/*
  Helper:
  Create an in-app notification and optionally
  send a push notification depending on mute state.
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
    const notification = await createNotification({
      recipient,
      actor,
      type,
      title,
      body,
      url,
    });

    /*
      Check whether this conversation is muted
      for the recipient.
    */
    const setting = conversationId
      ? await ConversationSetting.findOne({
          conversation: conversationId,
          user: recipient,
        })
      : null;

    /*
      Push notifications respect mute.
    */
    if (!setting?.muted) {
      await sendPushNotification(
        recipient,
        {
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
  GET /api/messages/:conversationId

  Get all messages belonging to a conversation.
*/
router.get(
  "/:conversationId",
  protect,
  async (req, res) => {
    try {
      const { conversationId } = req.params;

      if (
        !mongoose.Types.ObjectId.isValid(
          conversationId
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid conversation ID.",
        });
      }

      /*
        Only members can read the conversation.
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

      const messages =
        await Message.find({
          conversation: conversationId,
        })
          .populate(
            "sender",
            "username avatar"
          )
          .sort({
            createdAt: 1,
          });

      return res.status(200).json({
        success: true,
        messages,
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
  POST /api/messages

  Send a message to either:

  - a direct conversation
  - a group conversation
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
        text?.trim();

      /*
        Basic validation.
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

      if (cleanText.length > 2000) {
        return res.status(400).json({
          success: false,
          message:
            "Message cannot exceed 2000 characters.",
        });
      }

      /*
        Find conversation where the
        current user is a participant.
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

      /*
      =====================================================
        GROUP MESSAGE
      =====================================================
      */
      if (
        conversation.type === "group"
      ) {
        /*
          Create message.
        */
        const message =
          await Message.create({
            conversation:
              conversationId,
            sender:
              req.user._id,
            text:
              cleanText,
          });

        /*
          Update last message.
        */
        conversation.lastMessage =
          message._id;

        await conversation.save();

        /*
          Populate sender before sending
          the message to clients.
        */
        const populatedMessage =
          await Message.findById(
            message._id
          ).populate(
            "sender",
            "username avatar"
          );

        /*
          Emit real-time group message.
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
        }

        /*
          Notify every group member
          except the sender.
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
            conversationId:
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
      }

      /*
      =====================================================
        DIRECT MESSAGE
      =====================================================
      */

      const otherParticipant =
        conversation.participants.find(
          (participant) =>
            participant.toString() !==
            req.user._id.toString()
        );

      /*
        Safety check.
      */
      if (!otherParticipant) {
        return res.status(400).json({
          success: false,
          message:
            "Unable to determine message recipient.",
        });
      }

      /*
        Check whether either user has
        blocked the other.
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
        Create direct message.
      */
      const message =
        await Message.create({
          conversation:
            conversationId,
          sender:
            req.user._id,
          text:
            cleanText,
        });

      /*
        Update last message.
      */
      conversation.lastMessage =
        message._id;

      await conversation.save();

      /*
        Populate sender.
      */
      const populatedMessage =
        await Message.findById(
          message._id
        ).populate(
          "sender",
          "username avatar"
        );

      /*
        Emit real-time message.
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
      }

      /*
        Create notification + push.
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
        conversationId:
          conversationId,
        tag:
          `message-${conversationId}`,
      });

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