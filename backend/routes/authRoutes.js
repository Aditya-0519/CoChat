const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");

const User = require("../models/User");
const protect = require("../middleware/authMiddleware");
const uploadAvatar = require("../middleware/avatarUpload");

const router = express.Router();

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID
);

// ==========================================
// HELPERS
// ==========================================

const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;

const createToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
};

const setTokenCookie = (res, token) => {
  const isProduction =
    process.env.NODE_ENV === "production";

  res.cookie("token", token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

const getUserResponse = (user) => ({
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
  authProvider: user.authProvider,
});

// ==========================================
// CHECK USERNAME
// ==========================================

router.get(
  "/check-username/:username",
  async (req, res) => {
    try {
      const username = req.params.username
        .trim()
        .toLowerCase();

      if (!username) {
        return res.status(400).json({
          message: "Username is required.",
        });
      }

      const exists = await User.exists({
        username,
      });

      return res.json({
        available: !exists,
      });
    } catch (error) {
      console.error(
        "Check username error:",
        error
      );

      return res.status(500).json({
        message: "Unable to check username.",
      });
    }
  }
);

// ==========================================
// SIGNUP
// ==========================================

router.post("/signup", async (req, res) => {
  try {
    const {
      username,
      email,
      password,
    } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        message:
          "Username, email and password are required.",
      });
    }

    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (
      !USERNAME_REGEX.test(cleanUsername)
    ) {
      return res.status(400).json({
        message:
          "Username can only contain letters, numbers and underscores.",
      });
    }

    if (cleanUsername.length < 3) {
      return res.status(400).json({
        message:
          "Username must be at least 3 characters.",
      });
    }

    if (cleanUsername.length > 30) {
      return res.status(400).json({
        message:
          "Username cannot exceed 30 characters.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message:
          "Password must be at least 6 characters.",
      });
    }

    const existingEmail = await User.findOne({
      email: cleanEmail,
    });

    if (existingEmail) {
      return res.status(409).json({
        message:
          "An account with this email already exists.",
      });
    }

    const existingUsername =
      await User.findOne({
        username: cleanUsername,
      });

    if (existingUsername) {
      return res.status(409).json({
        message:
          "Username is already taken.",
      });
    }

    const hashedPassword =
      await bcrypt.hash(password, 12);

    const user = await User.create({
      username: cleanUsername,
      email: cleanEmail,
      password: hashedPassword,
      authProvider: "local",
      profileCompleted: false,
    });

    const token = createToken(user._id);

    setTokenCookie(res, token);

    return res.status(201).json({
      message: "Account created successfully.",
      user: getUserResponse(user),
    });
  } catch (error) {
    console.error("Signup error:", error);

    return res.status(500).json({
      message: "Unable to create account.",
    });
  }
});

// ==========================================
// LOGIN
// ==========================================

router.post("/login", async (req, res) => {
  try {
    const {
      email,
      password,
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message:
          "Email and password are required.",
      });
    }

    const cleanEmail = email
      .trim()
      .toLowerCase();

    const user = await User.findOne({
      email: cleanEmail,
    });

    if (!user) {
      return res.status(401).json({
        message:
          "Invalid email or password.",
      });
    }

    // Google-only account
    if (!user.password) {
      return res.status(400).json({
        message:
          "This account uses Google login. Please continue with Google.",
      });
    }

    const passwordMatches =
      await bcrypt.compare(
        password,
        user.password
      );

    if (!passwordMatches) {
      return res.status(401).json({
        message:
          "Invalid email or password.",
      });
    }

    const token = createToken(user._id);

    setTokenCookie(res, token);

    return res.json({
      message: "Login successful.",
      user: getUserResponse(user),
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      message: "Unable to log in.",
    });
  }
});

// ==========================================
// GOOGLE LOGIN
// ==========================================

router.post(
  "/google",
  async (req, res) => {
    try {
      const { credential } = req.body;

      if (!credential) {
        return res.status(400).json({
          message:
            "Google credential is required.",
        });
      }

      if (!process.env.GOOGLE_CLIENT_ID) {
        console.error(
          "GOOGLE_CLIENT_ID is not configured."
        );

        return res.status(500).json({
          message:
            "Google login is not configured on the server.",
        });
      }

      // Verify Google ID token
      const ticket =
        await googleClient.verifyIdToken({
          idToken: credential,
          audience:
            process.env.GOOGLE_CLIENT_ID,
        });

      const payload =
        ticket.getPayload();

      if (!payload) {
        return res.status(401).json({
          message:
            "Invalid Google credential.",
        });
      }

      const {
        sub: googleId,
        email,
        email_verified: emailVerified,
        name,
        picture,
      } = payload;

      if (!email || !emailVerified) {
        return res.status(401).json({
          message:
            "Your Google email could not be verified.",
        });
      }

      const cleanEmail =
        email.trim().toLowerCase();

      // ==========================================
      // FIND EXISTING GOOGLE ACCOUNT
      // ==========================================

      let user = await User.findOne({
        googleId,
      });

      // ==========================================
      // IF GOOGLE ACCOUNT DOESN'T EXIST,
      // CHECK WHETHER EMAIL ALREADY EXISTS
      // ==========================================

      if (!user) {
        const existingUser =
          await User.findOne({
            email: cleanEmail,
          });

        if (existingUser) {
          return res.status(409).json({
            message:
              "An account with this email already exists. Log in with your email and password first.",
          });
        }

        // ==========================================
        // GENERATE UNIQUE USERNAME
        // ==========================================

        let baseUsername =
          (name || "user")
            .replace(/[^a-zA-Z0-9]/g, "")
            .toLowerCase();

        if (baseUsername.length < 3) {
          baseUsername = "user";
        }

        baseUsername =
          baseUsername.substring(0, 25);

        let username = baseUsername;
        let counter = 1;

        while (
          await User.exists({ username })
        ) {
          username =
            `${baseUsername}${counter}`;
          counter++;
        }

        // ==========================================
        // CREATE GOOGLE USER
        // ==========================================

        user = await User.create({
          username,
          email: cleanEmail,
          googleId,
          authProvider: "google",
          avatar: picture || "",
          profileCompleted: false,
        });
      }

      // ==========================================
      // CREATE COCHAT JWT
      // ==========================================

      const token = createToken(user._id);

      setTokenCookie(res, token);

      return res.json({
        message:
          "Google login successful.",
        user: getUserResponse(user),
      });
    } catch (error) {
      console.error(
        "Google login error:",
        error
      );

      return res.status(401).json({
        message:
          "Unable to authenticate with Google. Please try again.",
      });
    }
  }
);

// ==========================================
// CURRENT USER
// ==========================================

router.get(
  "/me",
  protect,
  async (req, res) => {
    try {
      return res.json({
        user: getUserResponse(
          req.user
        ),
      });
    } catch (error) {
      console.error(
        "Get current user error:",
        error
      );

      return res.status(500).json({
        message:
          "Unable to get current user.",
      });
    }
  }
);

// ==========================================
// LOGOUT
// ==========================================

router.post(
  "/logout",
  (req, res) => {
    const isProduction =
      process.env.NODE_ENV === "production";

    res.clearCookie("token", {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction
        ? "none"
        : "lax",
    });

    return res.json({
      message:
        "Logged out successfully.",
    });
  }
);

// ==========================================
// UPDATE PROFILE
// ==========================================

router.put(
  "/profile",
  protect,
  async (req, res) => {
    try {
      const {
        bio,
        interests,
        college,
        branch,
        semester,
      } = req.body;

      const user = await User.findById(
        req.user._id
      );

      if (!user) {
        return res.status(404).json({
          message: "User not found.",
        });
      }

      if (bio !== undefined) {
        user.bio = bio;
      }

      if (interests !== undefined) {
        user.interests = interests;
      }

      if (college !== undefined) {
        user.college = college;
      }

      if (branch !== undefined) {
        user.branch = branch;
      }

      if (semester !== undefined) {
        user.semester = semester;
      }

      // Mark profile complete when
      // onboarding information exists.
      user.profileCompleted = Boolean(
        user.college &&
        user.branch &&
        user.semester &&
        user.interests?.length
      );

      await user.save();

      return res.json({
        message:
          "Profile updated successfully.",
        user: getUserResponse(user),
      });
    } catch (error) {
      console.error(
        "Update profile error:",
        error
      );

      return res.status(500).json({
        message:
          "Unable to update profile.",
      });
    }
  }
);

// ==========================================
// UPLOAD AVATAR
// ==========================================

router.post(
  "/profile/avatar",
  protect,
  uploadAvatar.single("avatar"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          message:
            "Please select an image.",
        });
      }

      const user = await User.findById(
        req.user._id
      );

      if (!user) {
        return res.status(404).json({
          message: "User not found.",
        });
      }

      user.avatar =
        req.file.path ||
        req.file.secure_url ||
        "";

      await user.save();

      return res.json({
        message:
          "Avatar updated successfully.",
        user: getUserResponse(user),
      });
    } catch (error) {
      console.error(
        "Upload avatar error:",
        error
      );

      return res.status(500).json({
        message:
          "Unable to upload avatar.",
      });
    }
  }
);

module.exports = router;