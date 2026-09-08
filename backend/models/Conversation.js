// backend/models/Conversation.js

const mongoose = require("mongoose");

const participantStateSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    unreadCount: {
      type: Number,
      default: 0,
    },
    lastReadAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],

    participantStates: {
      type: [participantStateSchema],
      default: [],
    },

    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    lastMessageAt: {
      type: Date,
      default: null,
    },

    lastMessagePreview: {
      type: String,
      default: "",
    },

    isGroup: {
      type: Boolean,
      default: false,
    },

    groupName: {
      type: String,
      trim: true,
      default: "",
    },

    groupAvatar: {
      type: String,
      default: "",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Make sure every participant has a participantStates entry.
 *
 * Older conversations may have been created before participantStates
 * was introduced, so this must be defensive.
 */
conversationSchema.methods.ensureParticipantStates = function () {
  if (!Array.isArray(this.participantStates)) {
    this.participantStates = [];
  }

  const existingUsers = new Set(
    this.participantStates
      .filter((state) => state && state.user)
      .map((state) => state.user.toString())
  );

  for (const participant of this.participants || []) {
    if (!participant) continue;

    const participantId = participant.toString();

    if (!existingUsers.has(participantId)) {
      this.participantStates.push({
        user: participant,
        unreadCount: 0,
        lastReadAt: null,
      });
    }
  }

  return this;
};

/**
 * Get a participant's state.
 */
conversationSchema.methods.getParticipantState = function (userId) {
  if (!userId) return null;

  this.ensureParticipantStates();

  return (
    this.participantStates.find(
      (state) => state.user.toString() === userId.toString()
    ) || null
  );
};

/**
 * Increment unread count for every participant except the sender.
 */
conversationSchema.methods.incrementUnreadForOthers = function (senderId) {
  if (!senderId) return;

  this.ensureParticipantStates();

  for (const state of this.participantStates) {
    if (state.user.toString() !== senderId.toString()) {
      state.unreadCount = (state.unreadCount || 0) + 1;
    }
  }
};

/**
 * Reset unread count for a specific participant.
 */
conversationSchema.methods.markAsRead = function (userId) {
  if (!userId) return;

  this.ensureParticipantStates();

  const state = this.getParticipantState(userId);

  if (state) {
    state.unreadCount = 0;
    state.lastReadAt = new Date();
  }
};

/**
 * Prevent malformed conversations from being treated as valid 1:1 chats.
 */
conversationSchema.methods.hasParticipant = function (userId) {
  if (!userId) return false;

  return (this.participants || []).some(
    (participant) => participant.toString() === userId.toString()
  );
};

conversationSchema.index({
  participants: 1,
  lastMessageAt: -1,
});

conversationSchema.index({
  "participantStates.user": 1,
});

module.exports = mongoose.model("Conversation", conversationSchema);