const express = require("express");
const mongoose = require("mongoose");

const Conversation = require("../models/Conversation");
const ConversationSetting = require("../models/ConversationSetting");

const protect = require("../middleware/authMiddleware");

const router = express.Router();

/*
 * Helper
 */
const userIsParticipant = (conversation, userId) => {
  return conversation.participants.some(
    (participant) =>
      String(participant._id || participant) === String(userId)
  );
};


/*
 * GET /api/conversation-settings/:conversationId
 *
 * Get current user's settings
 */
router.get("/:conversationId", protect, async (req, res) => {
  try {
    const { conversationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation ID.",
      });
    }

    const conversation = await Conversation.findById(
      conversationId
    );

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found.",
      });
    }

    if (!userIsParticipant(conversation, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "You are not part of this conversation.",
      });
    }

    const setting = await ConversationSetting.findOne({
      conversation: conversationId,
      user: req.user._id,
    });

    return res.json({
      success: true,
      muted: setting?.muted || false,
    });
  } catch (error) {
    console.error("Get conversation settings error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load conversation settings.",
    });
  }
});


/*
 * PATCH /api/conversation-settings/:conversationId/mute
 *
 * Toggle mute
 */
router.patch(
  "/:conversationId/mute",
  protect,
  async (req, res) => {
    try {
      const { conversationId } = req.params;
      const { muted } = req.body;

      if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid conversation ID.",
        });
      }

      if (typeof muted !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "Muted must be true or false.",
        });
      }

      const conversation = await Conversation.findById(
        conversationId
      );

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: "Conversation not found.",
        });
      }

      if (!userIsParticipant(conversation, req.user._id)) {
        return res.status(403).json({
          success: false,
          message: "You are not part of this conversation.",
        });
      }

      const setting =
        await ConversationSetting.findOneAndUpdate(
          {
            conversation: conversationId,
            user: req.user._id,
          },
          {
            $set: {
              muted,
            },
          },
          {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true,
          }
        );

      return res.json({
        success: true,
        muted: setting.muted,
        message: setting.muted
          ? "Notifications muted."
          : "Notifications unmuted.",
      });
    } catch (error) {
      console.error("Update mute setting error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to update notification setting.",
      });
    }
  }
);

module.exports = router;