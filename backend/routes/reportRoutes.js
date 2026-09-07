const express = require("express");
const mongoose = require("mongoose");

const Report = require("../models/Report");

const protect = require("../middleware/authMiddleware");

const router = express.Router();


/* =========================================================
   REPORT USER
   POST /api/reports
========================================================= */

router.post("/", protect, async (req, res) => {
  try {
    const {
      userId,
      reason,
    } = req.body;

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

    if (!reason?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Report reason is required.",
      });
    }

    if (
      String(req.user._id) ===
      String(userId)
    ) {
      return res.status(400).json({
        success: false,
        message: "You cannot report yourself.",
      });
    }

    const report =
      await Report.create({
        reporter: req.user._id,
        reportedUser: userId,
        reason: reason.trim(),
      });

    return res.status(201).json({
      success: true,
      message: "Report submitted successfully.",
      report,
    });
  } catch (error) {
    console.error(
      "Report user error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to submit report.",
    });
  }
});


module.exports = router;