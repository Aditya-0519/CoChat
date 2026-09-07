const mongoose = require("mongoose");

const messageReceiptSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    deliveredAt: {
      type: Date,
      default: null,
    },

    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    _id: false,
  }
);

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    /*
      One receipt per recipient.

      For a direct conversation this normally contains
      one recipient.

      For a group conversation it contains every participant
      except the sender.
    */
    receipts: {
      type: [messageReceiptSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

/*
  Main query used by conversation pagination.

  The second _id component gives us deterministic ordering
  when multiple messages share the same createdAt timestamp.
*/
messageSchema.index({
  conversation: 1,
  createdAt: -1,
  _id: -1,
});

/*
  Useful for unread-message calculations.
*/
messageSchema.index({
  conversation: 1,
  sender: 1,
  createdAt: -1,
});

const Message = mongoose.model(
  "Message",
  messageSchema
);

module.exports = Message;