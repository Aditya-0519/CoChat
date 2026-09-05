const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const protect = require("../middleware/authMiddleware");
const router = express.Router();

const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;

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

    res.json({
      available: true,
      message: "Username available.",
    });
  } catch (error) {
    console.error("Username check failed:", error.message);

    res.status(500).json({
      available: false,
      message: "Unable to check username right now.",
    });
  }
});

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

    // Username validation
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

    // Password validation
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long.",
      });
    }

    // Check username
    const existingUsername = await User.findOne({
      username: normalizedUsername,
    });

    if (existingUsername) {
      return res.status(409).json({
        success: false,
        message: "Sorry, this username is already taken.",
      });
    }

    // Check email
    const existingEmail = await User.findOne({
      email: normalizedEmail,
    });

    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    /*
     * bcrypt automatically:
     * 1. Generates a random salt
     * 2. Combines it with the password
     * 3. Hashes the result
     *
     * The salt is stored inside the bcrypt hash.
     */
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      username: normalizedUsername,
      email: normalizedEmail,
      password: hashedPassword,
    });

    const token = jwt.sign(
  { userId: user._id.toString() },
  process.env.JWT_SECRET,
  { expiresIn: "7d" }
);

res.cookie("token", token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite:
    process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
});

    res.status(201).json({
      success: true,
      message: "Account created successfully.",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Signup failed:", error.message);

    // Handle MongoDB duplicate-key race conditions
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern || {})[0];

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

    res.status(500).json({
      success: false,
      message: "Unable to create account right now.",
    });
  }
});

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
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
});

res.json({
  success: true,
  message: "Login successful.",
 user: {
  id: user._id,
  username: user.username,
  email: user.email,
  bio: user.bio,
  interests: user.interests,
  college: user.college,
  branch: user.branch,
  semester: user.semester,
  profileCompleted: user.profileCompleted,
}
});
  } catch (error) {
    console.error("Login failed:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to login right now.",
    });
  }
});

router.get("/me", protect, async (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user._id,
      username: req.user.username,
      email: req.user.email,
      bio: req.user.bio,
      interests: req.user.interests,
      college: req.user.college,
      branch: req.user.branch,
      semester: req.user.semester,
      profileCompleted: req.user.profileCompleted,
    },
  });
});

router.post("/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite:
      process.env.NODE_ENV === "production"
        ? "none"
        : "lax",
  });

  res.json({
    success: true,
    message: "Logged out successfully.",
  });
});

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

    if (bio && bio.length > 160) {
      return res.status(400).json({
        success: false,
        message: "Bio cannot exceed 160 characters.",
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        bio: bio?.trim() || "",
        interests,
        college: college?.trim() || "",
        branch: branch?.trim() || "",
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

    res.json({
      success: true,
      message: "Profile updated successfully.",
      user: {
        id: updatedUser._id,
        username: updatedUser.username,
        email: updatedUser.email,
        bio: updatedUser.bio,
        interests: updatedUser.interests,
        college: updatedUser.college,
        branch: updatedUser.branch,
        semester: updatedUser.semester,
        profileCompleted: updatedUser.profileCompleted,
      },
    });
  } catch (error) {
    console.error("Profile update failed:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to update profile right now.",
    });
  }
});

module.exports = router;