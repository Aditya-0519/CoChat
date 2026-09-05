const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
    },

    bio: {
      type: String,
      trim: true,
      maxlength: 160,
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

const User = mongoose.model("User", userSchema);

module.exports = User;