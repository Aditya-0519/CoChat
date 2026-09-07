const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const protect = require("../middleware/authMiddleware");
const uploadAvatar = require("../middleware/avatarUpload");

const router = express.Router();

const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;

/*
  GET /api/auth/check-username/:username
*/
router.get("/check-username/:username", async (req, res) => {
  try {
    const username = req.params.username.toLowerCase().trim();

    if (username.length < 3 || username.length > 30) {
      return res.json({
        available: false,
        message: "Username must be between 3 and 30 characters.",
      });
    }

    if (!USERNAME_REGEX.test(username)) {
      return res.json({
        available: false,
        message:
          "Username can only contain letters, numbers and underscores.",
      });
    }

    const existingUser = await User.findOne({
      username,
    });

    if (existingUser) {
      return res.json({
        available: false,
        message: "Sorry, this username is already taken.",
      });
    }

    return res.json({
      available: true,
      message: "Username available.",
    });
  } catch (error) {
    console.error("Username check failed:", error.message);

    return res.status(500).json({
      available: false,
      message: "Unable to check username right now.",
    });
  }
});

/*
  POST /api/auth/signup
*/
router.post("/signup", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Username, email and password are required.",
      });
    }

    const normalizedUsername = username.toLowerCase().trim();
    const normalizedEmail = email.toLowerCase().trim();

    if (
      normalizedUsername.length < 3 ||
      normalizedUsername.length > 30
    ) {
      return res.status(400).json({
        success: false,
        message: "Username must be between 3 and 30 characters.",
      });
    }

    if (!USERNAME_REGEX.test(normalizedUsername)) {
      return res.status(400).json({
        success: false,
        message:
          "Username can only contain letters, numbers and underscores.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long.",
      });
    }

    const existingUsername = await User.findOne({
      username: normalizedUsername,
    });

    if (existingUsername) {
      return res.status(409).json({
        success: false,
        message: "Sorry, this username is already taken.",
      });
    }

    const existingEmail = await User.findOne({
      email: normalizedEmail,
    });

    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      username: normalizedUsername,
      email: normalizedEmail,
      password: hashedPassword,
    });

    const token = jwt.sign(
      {
        userId: user._id.toString(),
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite:
        process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(201).json({
      success: true,
      message: "Account created successfully.",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        bio: user.bio,
        avatar: user.avatar,
        interests: user.interests,
        college: user.college,
        branch: user.branch,
        semester: user.semester,
        profileCompleted: user.profileCompleted,
      },
    });
  } catch (error) {
    console.error("Signup failed:", error.message);

    if (error.code === 11000) {
      const duplicateField =
        Object.keys(error.keyPattern || {})[0];

      if (duplicateField === "username") {
        return res.status(409).json({
          success: false,
          message: "Sorry, this username is already taken.",
        });
      }

      if (duplicateField === "email") {
        return res.status(409).json({
          success: false,
          message: "An account with this email already exists.",
        });
      }
    }

    return res.status(500).json({
      success: false,
      message: "Unable to create account right now.",
    });
  }
});

/*
  POST /api/auth/login
*/
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({
      email: normalizedEmail,
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const token = jwt.sign(
      {
        userId: user._id.toString(),
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite:
        process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      success: true,
      message: "Login successful.",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        bio: user.bio,
        avatar: user.avatar,
        interests: user.interests,
        college: user.college,
        branch: user.branch,
        semester: user.semester,
        profileCompleted: user.profileCompleted,
      },
    });
  } catch (error) {
    console.error("Login failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to login right now.",
    });
  }
});

/*
  GET /api/auth/me
*/
router.get("/me", protect, async (req, res) => {
  return res.json({
    success: true,
    user: {
      id: req.user._id,
      username: req.user.username,
      email: req.user.email,
      bio: req.user.bio,
      avatar: req.user.avatar,
      interests: req.user.interests,
      college: req.user.college,
      branch: req.user.branch,
      semester: req.user.semester,
      profileCompleted: req.user.profileCompleted,
    },
  });
});

/*
  POST /api/auth/logout
*/
router.post("/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite:
      process.env.NODE_ENV === "production" ? "none" : "lax",
  });

  return res.json({
    success: true,
    message: "Logged out successfully.",
  });
});

/*
  PUT /api/auth/profile
*/
router.put("/profile", protect, async (req, res) => {
  try {
    const {
      bio,
      interests,
      college,
      branch,
      semester,
    } = req.body;

    if (!Array.isArray(interests)) {
      return res.status(400).json({
        success: false,
        message: "Interests must be an array.",
      });
    }

    if (interests.length > 10) {
      return res.status(400).json({
        success: false,
        message: "You can select up to 10 interests.",
      });
    }

    if (typeof bio === "string" && bio.length > 160) {
      return res.status(400).json({
        success: false,
        message: "Bio cannot exceed 160 characters.",
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        bio: typeof bio === "string" ? bio.trim() : "",
        interests,
        college:
          typeof college === "string" ? college.trim() : "",
        branch:
          typeof branch === "string" ? branch.trim() : "",
        semester: semester || null,
        profileCompleted: true,
      },
      {
        new: true,
        runValidators: true,
      }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return res.json({
      success: true,
      message: "Profile updated successfully.",
      user: {
        id: updatedUser._id,
        username: updatedUser.username,
        email: updatedUser.email,
        bio: updatedUser.bio,
        avatar: updatedUser.avatar,
        interests: updatedUser.interests,
        college: updatedUser.college,
        branch: updatedUser.branch,
        semester: updatedUser.semester,
        profileCompleted: updatedUser.profileCompleted,
      },
    });
  } catch (error) {
    console.error("Profile update failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to update profile right now.",
    });
  }
});

/*
  POST /api/auth/profile/avatar

  Uploads the user's avatar to Cloudinary.
*/
router.post(
  "/profile/avatar",
  protect,
  uploadAvatar.single("avatar"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Please select an image.",
        });
      }

      const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        {
          avatar: req.file.path,
        },
        {
          new: true,
          runValidators: true,
        }
      ).select("-password");

      if (!updatedUser) {
        return res.status(404).json({
          success: false,
          message: "User not found.",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Avatar updated successfully.",
        user: {
          id: updatedUser._id,
          username: updatedUser.username,
          email: updatedUser.email,
          bio: updatedUser.bio,
          avatar: updatedUser.avatar,
          interests: updatedUser.interests,
          college: updatedUser.college,
          branch: updatedUser.branch,
          semester: updatedUser.semester,
          profileCompleted: updatedUser.profileCompleted,
        },
      });
    } catch (error) {
      console.error("Avatar upload failed:", error);

      return res.status(500).json({
        success: false,
        message:
          error.message || "Unable to upload avatar right now.",
      });
    }
  }
);

module.exports = router;