const express = require("express");

const User = require("../models/User");
const protect = require("../middleware/authMiddleware");

const router = express.Router();

/*
  GET /api/users/discover

  Returns users that the authenticated user
  can discover.
*/
router.get("/discover", protect, async (req, res) => {
  try {
    const users = await User.find({
      _id: { $ne: req.user._id },
      profileCompleted: true,
    })
      .select(
        "username bio avatar interests college branch semester"
      )
      .sort({ createdAt: -1 })
      .limit(20);

    return res.status(200).json({
      success: true,
      users,
    });
  } catch (error) {
    console.error("Discover users error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to discover users.",
    });
  }
});

/*
  GET /api/users/:username

  Returns a public profile.
*/
router.get("/:username", async (req, res) => {
  try {
    const username = req.params.username.trim().toLowerCase();

    const user = await User.findOne({
      username,
    }).select(
      "username bio avatar interests college branch semester profileCompleted createdAt"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        bio: user.bio,
        avatar: user.avatar,
        interests: user.interests,
        college: user.college,
        branch: user.branch,
        semester: user.semester,
        profileCompleted: user.profileCompleted,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Get public profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch profile.",
    });
  }
});

module.exports = router;