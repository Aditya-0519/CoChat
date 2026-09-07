const express = require("express");
const mongoose = require("mongoose");

const protect = require("../middleware/authMiddleware");

const Conversation = require("../models/Conversation");
const Message = require("../models/Message");

const router = express.Router();

const isValidObjectId = (value) =>
  mongoose.Types.ObjectId.isValid(value);

const getConversationForUser = async (
  conversationId,
  userId
) => {
  if (!isValidObjectId(conversationId)) {
    return null;
  }

  return Conversation.findOne({
    _id: conversationId,
    participants: userId,
  });
};

const emitToConversation = (
  conversationId,
  event,
  payload
) => {
  if (!global.io) {
    return;
  }

  global.io
    .to(`conversation:${conversationId}`)
    .emit(event, payload);
};

/*
|--------------------------------------------------------------------------
| GET MESSAGE STATE
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

      const readState =
        conversation.readStates?.find(
          (state) =>
            state.user?.toString() ===
            currentUserId
        );

      const messages =
        await Message.find({
          conversation:
            conversation._id,
          sender:
            req.user._id,
        })
          .sort({
            createdAt: -1,
            _id: -1,
          })
          .limit(100)
          .select(
            "_id receipts createdAt"
          )
          .lean();

      const receipts =
        messages.map(
          (message) => ({
            messageId:
              message._id,
            receipts:
              message.receipts || [],
          })
        );

      return res.status(200).json({
        success: true,

        readState: readState
          ? {
              lastReadMessage:
                readState.lastReadMessage,
              lastReadAt:
                readState.lastReadAt,
            }
          : null,

        receipts,
      });
    } catch (error) {
      console.error(
        "Get message state error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to load message state.",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| MARK MESSAGE DELIVERED
|--------------------------------------------------------------------------
*/

router.post(
  "/:conversationId/delivered",
  protect,
  async (req, res) => {
    try {
      const {
        conversationId,
      } = req.params;

      const {
        messageId,
      } = req.body;

      if (!isValidObjectId(messageId)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid message ID.",
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

      const message =
        await Message.findOne({
          _id: messageId,
          conversation:
            conversation._id,
        });

      if (!message) {
        return res.status(404).json({
          success: false,
          message:
            "Message not found.",
        });
      }

      /*
       * A sender doesn't need to mark their own
       * message as delivered.
       */
      if (
        message.sender.toString() ===
        req.user._id.toString()
      ) {
        return res.status(200).json({
          success: true,
          changed: false,
        });
      }

      const now = new Date();

      let receipt =
        message.receipts.find(
          (item) =>
            item.user?.toString() ===
            req.user._id.toString()
        );

      let changed = false;

      if (!receipt) {
        message.receipts.push({
          user: req.user._id,
          deliveredAt: now,
          readAt: null,
        });

        receipt =
          message.receipts[
            message.receipts.length - 1
          ];

        changed = true;
      } else if (
        !receipt.deliveredAt
      ) {
        receipt.deliveredAt = now;
        changed = true;
      }

      if (changed) {
        await message.save();

        emitToConversation(
          conversation._id,
          "message:delivered",
          {
            messageId:
              message._id.toString(),

            userId:
              req.user._id.toString(),

            deliveredAt:
              receipt.deliveredAt,
          }
        );
      }

      return res.status(200).json({
        success: true,
        changed,

        messageId:
          message._id,

        deliveredAt:
          receipt?.deliveredAt || now,
      });
    } catch (error) {
      console.error(
        "Mark message delivered error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to update delivery state.",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| MARK CONVERSATION READ
|--------------------------------------------------------------------------
*/

router.post(
  "/:conversationId/read",
  protect,
  async (req, res) => {
    try {
      const {
        conversationId,
      } = req.params;

      const {
        messageId,
      } = req.body;

      if (!isValidObjectId(messageId)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid message ID.",
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

      const boundaryMessage =
        await Message.findOne({
          _id: messageId,
          conversation:
            conversation._id,
        }).select(
          "_id createdAt sender"
        );

      if (!boundaryMessage) {
        return res.status(404).json({
          success: false,
          message:
            "Message not found.",
        });
      }

      const now = new Date();

      /*
       * Every incoming message up to the selected
       * boundary becomes delivered + read.
       */
      const incomingMessages =
        await Message.find({
          conversation:
            conversation._id,

          sender: {
            $ne: req.user._id,
          },

          $or: [
            {
              createdAt: {
                $lt:
                  boundaryMessage.createdAt,
              },
            },

            {
              createdAt:
                boundaryMessage.createdAt,

              _id: {
                $lte:
                  boundaryMessage._id,
              },
            },
          ],
        }).select(
          "_id receipts sender"
        );

      const changedMessageIds = [];

      for (
        const message of incomingMessages
      ) {
        let receipt =
          message.receipts.find(
            (item) =>
              item.user?.toString() ===
              req.user._id.toString()
          );

        let changed = false;

        if (!receipt) {
          message.receipts.push({
            user: req.user._id,
            deliveredAt: now,
            readAt: now,
          });

          changed = true;
        } else {
          if (!receipt.deliveredAt) {
            receipt.deliveredAt = now;
            changed = true;
          }

          if (!receipt.readAt) {
            receipt.readAt = now;
            changed = true;
          }
        }

        if (changed) {
          await message.save();

          changedMessageIds.push(
            message._id.toString()
          );
        }
      }

      /*
       * Update the conversation read cursor.
       *
       * IMPORTANT:
       * We compare against the previous READ MESSAGE,
       * not lastReadAt.
       */
      const existingReadState =
        conversation.readStates.find(
          (state) =>
            state.user?.toString() ===
            req.user._id.toString()
        );

      let cursorChanged = false;

      if (!existingReadState) {
        conversation.readStates.push({
          user: req.user._id,

          lastReadMessage:
            boundaryMessage._id,

          lastReadAt: now,
        });

        cursorChanged = true;
      } else {
        let previousMessage = null;

        if (
          existingReadState.lastReadMessage &&
          isValidObjectId(
            existingReadState.lastReadMessage
          )
        ) {
          previousMessage =
            await Message.findOne({
              _id:
                existingReadState.lastReadMessage,

              conversation:
                conversation._id,
            }).select(
              "_id createdAt"
            );
        }

        /*
         * Only move the cursor forward.
         */
        if (!previousMessage) {
          existingReadState.lastReadMessage =
            boundaryMessage._id;

          existingReadState.lastReadAt =
            now;

          cursorChanged = true;
        } else {
          const boundaryIsNewer =
            boundaryMessage.createdAt >
              previousMessage.createdAt ||
            (
              boundaryMessage.createdAt.getTime() ===
                previousMessage.createdAt.getTime() &&
              boundaryMessage._id
                .toString() !==
                previousMessage._id.toString()
            );

          if (boundaryIsNewer) {
            existingReadState.lastReadMessage =
              boundaryMessage._id;

            existingReadState.lastReadAt =
              now;

            cursorChanged = true;
          }
        }
      }

      if (cursorChanged) {
        await conversation.save();
      }

      /*
       * Notify the sender(s) that messages were read.
       */
      for (
        const changedMessageId of
          changedMessageIds
      ) {
        emitToConversation(
          conversation._id,
          "message:read",
          {
            messageId:
              changedMessageId,

            userId:
              req.user._id.toString(),

            readAt: now,
          }
        );
      }

      /*
       * Notify all participants that this user's
       * conversation read cursor moved.
       */
      if (cursorChanged) {
        emitToConversation(
          conversation._id,
          "conversation:read",
          {
            conversationId:
              conversation._id.toString(),

            userId:
              req.user._id.toString(),

            lastReadMessage:
              boundaryMessage._id.toString(),

            lastReadAt: now,
          }
        );
      }

      return res.status(200).json({
        success: true,

        changed:
          changedMessageIds.length > 0 ||
          cursorChanged,

        readAt: now,

        lastReadMessage:
          boundaryMessage._id,

        changedMessageIds,
      });
    } catch (error) {
      console.error(
        "Mark conversation read error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to mark conversation as read.",
      });
    }
  }
);

module.exports = router;