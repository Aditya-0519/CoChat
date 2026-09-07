const mongoose = require("mongoose");

const conversationSettingSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    muted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

conversationSettingSchema.index(
  { conversation: 1, user: 1 },
  { unique: true }
);

const ConversationSetting = mongoose.model(
  "ConversationSetting",
  conversationSettingSchema
);

module.exports = ConversationSetting;