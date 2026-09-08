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

/*
|--------------------------------------------------------------------------
| CONSTANTS
|--------------------------------------------------------------------------
*/

const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;

const TOKEN_MAX_AGE =
  7 * 24 * 60 * 60 * 1000;

/*
|--------------------------------------------------------------------------
| JWT
|--------------------------------------------------------------------------
*/

const createToken = (userId) => {
  return jwt.sign(
    {
      userId: userId.toString(),
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
};

/*
|--------------------------------------------------------------------------
| AUTH COOKIE
|--------------------------------------------------------------------------
|
| IMPORTANT:
|
| Production frontend:
|   https://cochat-alpha.vercel.app
|
| Production backend:
|   https://cochat-g7qi.onrender.com
|
| Because these are different origins, the cookie must use:
|
|   Secure=true
|   SameSite=None
|
| The cookie is intentionally host-only and belongs to the
| backend origin. This allows both normal API requests and
| Socket.IO requests to authenticate against Render.
|
|--------------------------------------------------------------------------
*/

const getTokenCookieOptions = () => {
  const isProduction =
    process.env.NODE_ENV === "production";

  return {
    httpOnly: true,

    secure: isProduction,

    sameSite: isProduction
      ? "none"
      : "lax",

    path: "/",

    maxAge: TOKEN_MAX_AGE,

    expires: new Date(
      Date.now() + TOKEN_MAX_AGE
    ),
  };
};

const setTokenCookie = (
  res,
  token
) => {
  res.cookie(
    "token",
    token,
    getTokenCookieOptions()
  );
};

const clearTokenCookie = (res) => {
  const isProduction =
    process.env.NODE_ENV === "production";

  res.clearCookie("token", {
    httpOnly: true,

    secure: isProduction,

    sameSite: isProduction
      ? "none"
      : "lax",

    path: "/",
  });
};

/*
|--------------------------------------------------------------------------
| USER RESPONSE
|--------------------------------------------------------------------------
|
| IMPORTANT:
|
| We return BOTH:
|
|   _id
|   id
|
| Older/newer frontend code in this project uses both.
| Returning both prevents authentication state from becoming
| partially undefined.
|
|--------------------------------------------------------------------------
*/

const getUserResponse = (
  user
) => ({
  _id: user._id,

  id: user._id,

  username: user.username,

  email: user.email,

  bio: user.bio || "",

  avatar: user.avatar || "",

  interests:
    Array.isArray(user.interests)
      ? user.interests
      : [],

  college: user.college || "",

  branch: user.branch || "",

  semester:
    user.semester ?? null,

  profileCompleted:
    Boolean(user.profileCompleted),

  authProvider:
    user.authProvider || "local",
});

/*
|--------------------------------------------------------------------------
| CHECK USERNAME
|--------------------------------------------------------------------------
*/

router.get(
  "/check-username/:username",
  async (req, res) => {
    try {
      const username =
        String(
          req.params.username || ""
        )
          .trim()
          .toLowerCase();

      if (!username) {
        return res.status(400).json({
          success: false,
          message:
            "Username is required.",
        });
      }

      const exists =
        await User.exists({
          username,
        });

      return res.json({
        success: true,
        available: !exists,
      });
    } catch (error) {
      console.error(
        "Check username error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to check username.",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| SIGNUP
|--------------------------------------------------------------------------
*/

router.post(
  "/signup",
  async (req, res) => {
    try {
      const {
        username,
        email,
        password,
      } = req.body || {};

      if (
        !username ||
        !email ||
        !password
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Username, email and password are required.",
        });
      }

      const cleanUsername =
        String(username).trim();

      const cleanEmail =
        String(email)
          .trim()
          .toLowerCase();

      /*
       * Username validation.
       */

      if (
        !USERNAME_REGEX.test(
          cleanUsername
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Username can only contain letters, numbers and underscores.",
        });
      }

      if (
        cleanUsername.length < 3
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Username must be at least 3 characters.",
        });
      }

      if (
        cleanUsername.length > 30
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Username cannot exceed 30 characters.",
        });
      }

      /*
       * Password validation.
       */

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message:
            "Password must be at least 6 characters.",
        });
      }

      /*
       * Check email.
       */

      const existingEmail =
        await User.findOne({
          email: cleanEmail,
        });

      if (existingEmail) {
        return res.status(409).json({
          success: false,
          message:
            "An account with this email already exists.",
        });
      }

      /*
       * Check username.
       */

      const existingUsername =
        await User.findOne({
          username: cleanUsername,
        });

      if (existingUsername) {
        return res.status(409).json({
          success: false,
          message:
            "Username is already taken.",
        });
      }

      /*
       * Hash password.
       */

      const hashedPassword =
        await bcrypt.hash(
          password,
          12
        );

      /*
       * Create user.
       */

      const user =
        await User.create({
          username:
            cleanUsername,

          email:
            cleanEmail,

          password:
            hashedPassword,

          authProvider:
            "local",

          profileCompleted:
            false,
        });

      /*
       * Create JWT.
       */

      const token =
        createToken(user._id);

      /*
       * IMPORTANT:
       * Correct argument order.
       *
       * setTokenCookie(res, token)
       */

      setTokenCookie(
        res,
        token
      );

      return res.status(201).json({
        success: true,

        message:
          "Account created successfully.",

        user:
          getUserResponse(user),
      });
    } catch (error) {
      console.error(
        "Signup error:",
        error
      );

      /*
       * Handle Mongo duplicate key
       * safely.
       */

      if (
        error?.code === 11000
      ) {
        return res.status(409).json({
          success: false,
          message:
            "Username or email is already in use.",
        });
      }

      return res.status(500).json({
        success: false,
        message:
          "Unable to create account.",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| LOGIN
|--------------------------------------------------------------------------
*/

router.post(
  "/login",
  async (req, res) => {
    try {
      const {
        email,
        password,
      } = req.body || {};

      if (
        !email ||
        !password
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Email and password are required.",
        });
      }

      const cleanEmail =
        String(email)
          .trim()
          .toLowerCase();

      const user =
        await User.findOne({
          email: cleanEmail,
        });

      if (!user) {
        return res.status(401).json({
          success: false,
          message:
            "Invalid email or password.",
        });
      }

      /*
       * Google-only account.
       */

      if (!user.password) {
        return res.status(400).json({
          success: false,
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
          success: false,
          message:
            "Invalid email or password.",
        });
      }

      /*
       * Create JWT.
       */

      const token =
        createToken(user._id);

      /*
       * IMPORTANT:
       * Correct argument order.
       */

      setTokenCookie(
        res,
        token
      );

      return res.json({
        success: true,

        message:
          "Login successful.",

        user:
          getUserResponse(user),
      });
    } catch (error) {
      console.error(
        "Login error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to log in.",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| GOOGLE LOGIN
|--------------------------------------------------------------------------
*/

router.post(
  "/google",
  async (req, res) => {
    try {
      const {
        credential,
      } = req.body || {};

      if (!credential) {
        return res.status(400).json({
          success: false,
          message:
            "Google credential is required.",
        });
      }

      const googleClientId =
        process.env.GOOGLE_CLIENT_ID?.trim();

      if (!googleClientId) {
        console.error(
          "GOOGLE_CLIENT_ID is missing."
        );

        return res.status(500).json({
          success: false,
          message:
            "Google login is not configured on the server.",
        });
      }

      /*
       * Verify Google credential.
       */

      let ticket;

      try {
        ticket =
          await googleClient.verifyIdToken({
            idToken: credential,
            audience:
              googleClientId,
          });
      } catch (googleError) {
        console.error(
          "Google token verification failed:",
          googleError?.message ||
            googleError
        );

        return res.status(401).json({
          success: false,
          message:
            "Google authentication failed. The Google credential could not be verified.",
        });
      }

      const payload =
        ticket.getPayload();

      if (!payload) {
        return res.status(401).json({
          success: false,
          message:
            "Invalid Google credential.",
        });
      }

      const {
        sub: googleId,
        email,
        email_verified:
          emailVerified,
        name,
        picture,
      } = payload;

      if (!googleId) {
        return res.status(401).json({
          success: false,
          message:
            "Google account ID is missing.",
        });
      }

      if (!email) {
        return res.status(401).json({
          success: false,
          message:
            "Google account email is missing.",
        });
      }

      if (!emailVerified) {
        return res.status(401).json({
          success: false,
          message:
            "Your Google email could not be verified.",
        });
      }

      const cleanEmail =
        email.trim().toLowerCase();

      /*
       * Find Google account.
       */

      let user =
        await User.findOne({
          googleId,
        });

      /*
       * If no Google ID exists,
       * check whether email belongs
       * to another account.
       */

      if (!user) {
        const existingUser =
          await User.findOne({
            email: cleanEmail,
          });

        if (existingUser) {
          return res.status(409).json({
            success: false,
            message:
              "An account with this email already exists. Log in with your email and password first.",
          });
        }

        /*
         * Generate username.
         */

        let baseUsername =
          String(name || "user")
            .replace(
              /[^a-zA-Z0-9]/g,
              ""
            )
            .toLowerCase();

        if (
          baseUsername.length < 3
        ) {
          baseUsername = "user";
        }

        baseUsername =
          baseUsername.substring(
            0,
            25
          );

        let username =
          baseUsername;

        let counter = 1;

        while (
          await User.exists({
            username,
          })
        ) {
          username =
            `${baseUsername}${counter}`;

          counter++;
        }

        /*
         * Create Google user.
         */

        user =
          await User.create({
            username,

            email:
              cleanEmail,

            googleId,

            authProvider:
              "google",

            avatar:
              picture || "",

            profileCompleted:
              false,
          });
      }

      /*
       * Create CoChat JWT.
       */

      const token =
        createToken(user._id);

      setTokenCookie(
        res,
        token
      );

      return res.json({
        success: true,

        message:
          "Google login successful.",

        user:
          getUserResponse(user),
      });
    } catch (error) {
      console.error(
        "Google login route error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to complete Google login. Please try again.",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| CURRENT USER
|--------------------------------------------------------------------------
|
| This endpoint is what restores authentication after:
|
| - browser refresh
| - reopening the website
| - navigating directly to a protected URL
|
|--------------------------------------------------------------------------
*/

router.get(
  "/me",
  protect,
  async (req, res) => {
    try {
      return res.json({
        success: true,

        user:
          getUserResponse(
            req.user
          ),
      });
    } catch (error) {
      console.error(
        "Get current user error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to get current user.",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| LOGOUT
|--------------------------------------------------------------------------
*/

router.post(
  "/logout",
  (req, res) => {
    clearTokenCookie(res);

    return res.json({
      success: true,
      message:
        "Logged out successfully.",
    });
  }
);

/*
|--------------------------------------------------------------------------
| UPDATE PROFILE
|--------------------------------------------------------------------------
*/

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
      } = req.body || {};

      const user =
        await User.findById(
          req.user._id
        );

      if (!user) {
        return res.status(404).json({
          success: false,
          message:
            "User not found.",
        });
      }

      if (
        bio !== undefined
      ) {
        user.bio = bio;
      }

      if (
        interests !== undefined
      ) {
        user.interests =
          Array.isArray(
            interests
          )
            ? interests
            : [];
      }

      if (
        college !== undefined
      ) {
        user.college =
          String(college).trim();
      }

      if (
        branch !== undefined
      ) {
        user.branch =
          String(branch).trim();
      }

      if (
        semester !== undefined
      ) {
        user.semester =
          semester;
      }

      /*
       * Determine profile completion.
       */

      user.profileCompleted =
        Boolean(
          user.college &&
            user.branch &&
            user.semester &&
            Array.isArray(
              user.interests
            ) &&
            user.interests.length > 0
        );

      await user.save();

      return res.json({
        success: true,

        message:
          "Profile updated successfully.",

        user:
          getUserResponse(user),
      });
    } catch (error) {
      console.error(
        "Update profile error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to update profile.",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| UPLOAD AVATAR
|--------------------------------------------------------------------------
*/

router.post(
  "/profile/avatar",
  protect,
  uploadAvatar.single(
    "avatar"
  ),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message:
            "Please select an image.",
        });
      }

      const user =
        await User.findById(
          req.user._id
        );

      if (!user) {
        return res.status(404).json({
          success: false,
          message:
            "User not found.",
        });
      }

      user.avatar =
        req.file.path ||
        req.file.secure_url ||
        "";

      await user.save();

      return res.json({
        success: true,

        message:
          "Avatar updated successfully.",

        user:
          getUserResponse(user),
      });
    } catch (error) {
      console.error(
        "Upload avatar error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to upload avatar.",
      });
    }
  }
);

module.exports = router;