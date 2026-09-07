const express = require("express");
const mongoose = require("mongoose");

const protect = require("../middleware/authMiddleware");

const Conversation = require("../models/Conversation");
const Message = require("../models/Message");

const router = express.Router();

const isValidObjectId = (value) =>
  mongoose.Types.ObjectId.isValid(value);

/*
|--------------------------------------------------------------------------
| GET UNREAD COUNTS
|--------------------------------------------------------------------------
|
| Returns unread message counts for every conversation belonging
| to the authenticated user.
|
| Response:
|
| {
|   success: true,
|   unread: {
|     conversationId: 3,
|     ...
|   },
|   totalUnread: 5
| }
|
*/

router.get(
  "/unread",
  protect,
  async (req, res) => {
    try {
      const userId = req.user._id;

      const conversations =
        await Conversation.find({
          participants: userId,
        })
          .select(
            "_id participants readStates lastMessage"
          )
          .lean();

      const unread = {};
      let totalUnread = 0;

      await Promise.all(
        conversations.map(
          async (conversation) => {
            const readState =
              Array.isArray(
                conversation.readStates
              )
                ? conversation.readStates.find(
                    (state) =>
                      state.user?.toString() ===
                      userId.toString()
                  )
                : null;

            const filter = {
              conversation:
                conversation._id,
              sender: {
                $ne: userId,
              },
            };

            /*
             * If the user has never read this conversation,
             * every incoming message is unread.
             */
            if (
              readState?.lastReadMessage &&
              isValidObjectId(
                readState.lastReadMessage
              )
            ) {
              const lastReadMessage =
                await Message.findOne({
                  _id:
                    readState.lastReadMessage,
                  conversation:
                    conversation._id,
                })
                  .select(
                    "_id createdAt"
                  )
                  .lean();

              if (lastReadMessage) {
                filter.$or = [
                  {
                    createdAt: {
                      $gt:
                        lastReadMessage.createdAt,
                    },
                  },
                  {
                    createdAt:
                      lastReadMessage.createdAt,
                    _id: {
                      $gt:
                        lastReadMessage._id,
                    },
                  },
                ];
              }
            }

            const count =
              await Message.countDocuments(
                filter
              );

            const conversationId =
              conversation._id.toString();

            unread[conversationId] = count;

            totalUnread += count;
          }
        )
      );

      return res.status(200).json({
        success: true,
        unread,
        totalUnread,
      });
    } catch (error) {
      console.error(
        "Get unread conversation counts error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to load unread message counts.",
      });
    }
  }
);

module.exports = router;