const mongoose = require("mongoose");

const conversationReadStateSchema =
  new mongoose.Schema(
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },

      lastReadMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message",
        default: null,
      },

      lastReadAt: {
        type: Date,
        default: null,
      },
    },
    {
      _id: false,
    }
  );

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

    /*
      Stable key used to prevent duplicate 1-to-1
      conversations.
    */
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

    /*
      Per-user read cursor.

      Instead of storing thousands of "unread" flags,
      each participant gets one cursor representing the
      latest message they have read.
    */
    readStates: {
      type: [conversationReadStateSchema],
      default: [],
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

conversationSchema.index({
  participants: 1,
  updatedAt: -1,
});

const Conversation = mongoose.model(
  "Conversation",
  conversationSchema
);

module.exports = Conversation;