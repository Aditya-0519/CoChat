const mongoose = require("mongoose");

const pushSubscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    endpoint: {
      type: String,
      required: true,
      unique: true,
    },

    keys: {
      p256dh: {
        type: String,
        required: true,
      },

      auth: {
        type: String,
        required: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

const PushSubscription = mongoose.model(
  "PushSubscription",
  pushSubscriptionSchema
);

module.exports = PushSubscription;