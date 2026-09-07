const express = require("express");
const mongoose = require("mongoose");

const Block = require("../models/Block");
const User = require("../models/User");
const protect = require("../middleware/authMiddleware");

const router = express.Router();

/*
 * POST /api/blocks/:userId
 * Block a user
 */
router.post("/:userId", protect, async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID.",
      });
    }

    if (String(req.user._id) === String(userId)) {
      return res.status(400).json({
        success: false,
        message: "You cannot block yourself.",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const existingBlock = await Block.findOne({
      blocker: req.user._id,
      blocked: userId,
    });

    if (existingBlock) {
      return res.status(400).json({
        success: false,
        message: "User is already blocked.",
      });
    }

    await Block.create({
      blocker: req.user._id,
      blocked: userId,
    });

    return res.status(201).json({
      success: true,
      blocked: true,
      message: "User blocked successfully.",
    });
  } catch (error) {
    console.error("Block user error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to block user.",
    });
  }
});

/*
 * DELETE /api/blocks/:userId
 * Unblock a user
 */
router.delete("/:userId", protect, async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID.",
      });
    }

    const result = await Block.findOneAndDelete({
      blocker: req.user._id,
      blocked: userId,
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "User is not blocked.",
      });
    }

    return res.json({
      success: true,
      blocked: false,
      message: "User unblocked successfully.",
    });
  } catch (error) {
    console.error("Unblock user error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to unblock user.",
    });
  }
});

/*
 * GET /api/blocks/:userId/status
 * Check whether current user has blocked another user
 */
router.get("/:userId/status", protect, async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID.",
      });
    }

    const block = await Block.findOne({
      blocker: req.user._id,
      blocked: userId,
    });

    return res.json({
      success: true,
      blocked: Boolean(block),
    });
  } catch (error) {
    console.error("Check block status error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to check block status.",
    });
  }
});

/*
 * GET /api/blocks
 * Get users blocked by current user
 */
router.get("/", protect, async (req, res) => {
  try {
    const blocks = await Block.find({
      blocker: req.user._id,
    })
      .populate("blocked", "username avatar bio college branch semester")
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      blocks,
    });
  } catch (error) {
    console.error("Get blocked users error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load blocked users.",
    });
  }
});

module.exports = router;