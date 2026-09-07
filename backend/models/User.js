const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    // ==========================================
    // USERNAME
    // ==========================================

    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },

    // ==========================================
    // EMAIL
    // ==========================================

    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    // ==========================================
    // PASSWORD
    // ==========================================
    // Local accounts use a password.
    // Google accounts do not.

    password: {
      type: String,
      minlength: 6,
      default: null,
    },

    // ==========================================
    // GOOGLE AUTH
    // ==========================================

    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },

    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },

    // ==========================================
    // PROFILE
    // ==========================================

    bio: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    avatar: {
      type: String,
      default: "",
    },

    interests: {
      type: [String],
      default: [],
    },

    college: {
      type: String,
      trim: true,
      default: "",
    },

    branch: {
      type: String,
      trim: true,
      default: "",
    },

    semester: {
      type: Number,
      min: 1,
      max: 12,
      default: null,
    },

    profileCompleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);