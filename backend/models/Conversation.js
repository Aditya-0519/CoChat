const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["direct", "group"],
      default: "direct",
      index: true,
    },

    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],

    // Stable key used to prevent duplicate 1-to-1 conversations.
    directKey: {
      type: String,
      default: null,
      unique: true,
      sparse: true,
      index: true,
    },

    name: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
    },

    description: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    admins: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

conversationSchema.index({
  type: 1,
  participants: 1,
  updatedAt: -1,
});

const Conversation = mongoose.model(
  "Conversation",
  conversationSchema
);

module.exports = Conversation;