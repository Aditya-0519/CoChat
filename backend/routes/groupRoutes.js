const express = require("express");
const mongoose = require("mongoose");

const Conversation = require("../models/Conversation");
const User = require("../models/User");
const Connection = require("../models/Connection");
const ConversationSetting = require("../models/ConversationSetting");
const protect = require("../middleware/authMiddleware");

const {
  createNotification,
  sendPushNotification,
} = require("../services/notificationService");

const router = express.Router();

const getId = (value) => {
  if (!value) return "";

  if (value._id) {
    return value._id.toString();
  }

  return value.toString();
};

const MAX_GROUP_MEMBERS = 50;

const isValidObjectId = (id) =>
  mongoose.Types.ObjectId.isValid(id);

const isMember = (conversation, userId) => {
  const userIdString = userId.toString();

  return conversation.participants.some((participant) => {
    const participantId =
      participant?._id?.toString() ||
      participant?.toString();

    return participantId === userIdString;
  });
};

const isAdmin = (conversation, userId) => {
  const userIdString = userId.toString();

  return (
    conversation.owner?.toString() === userIdString ||
    conversation.admins?.some(
      (admin) => admin.toString() === userIdString
    )
  );
};

const getAcceptedConnection = async (
  userA,
  userB
) => {
  return Connection.findOne({
    $or: [
      {
        requester: userA,
        recipient: userB,
        status: "accepted",
      },
      {
        requester: userB,
        recipient: userA,
        status: "accepted",
      },
    ],
  });
};

const populateGroup = (groupId) => {
  return Conversation.findById(groupId)
    .populate(
      "participants",
      "username avatar bio college branch semester"
    )
    .populate(
      "owner",
      "username avatar bio"
    )
    .populate(
      "admins",
      "username avatar"
    );
};

const notifyUser = async ({
  req,
  recipient,
  actor,
  type,
  title,
  body,
  url,
  tag,
  conversationId = null,
}) => {
  try {
    const notification = await createNotification({
      recipient,
      actor,
      type,
      title,
      body,
      url,
    });

    const setting = conversationId
  ? await ConversationSetting.findOne({
      conversation: conversationId,
      user: recipient,
    })
  : null;
    if (!setting?.muted) {
      await sendPushNotification(
        recipient,
        {
          title,
          body,
          url,
          tag:
            tag ||
            `cochat-${type}-${Date.now()}`,
        }
      );
    }

    return notification;
  } catch (error) {
    console.error(
      "Group notification error:",
      error
    );

    return null;
  }
};

/*
  POST /api/groups

  Create a group from accepted connections.
*/
router.post("/", protect, async (req, res) => {
  try {
    const {
      name,
      description = "",
      memberIds = [],
    } = req.body;

    const cleanName = name?.trim();

    if (!cleanName) {
      return res.status(400).json({
        success: false,
        message: "Group name is required.",
      });
    }

    if (cleanName.length > 80) {
      return res.status(400).json({
        success: false,
        message:
          "Group name cannot exceed 80 characters.",
      });
    }

    if (!Array.isArray(memberIds)) {
      return res.status(400).json({
        success: false,
        message:
          "memberIds must be an array.",
      });
    }

    const uniqueMemberIds = [
      ...new Set(
        memberIds
          .map((id) => id?.toString())
          .filter(Boolean)
      ),
    ];

    if (
      uniqueMemberIds.some(
        (id) => !isValidObjectId(id)
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "One or more member IDs are invalid.",
      });
    }

    if (
      uniqueMemberIds.length + 1 >
      MAX_GROUP_MEMBERS
    ) {
      return res.status(400).json({
        success: false,
        message: `A group can have a maximum of ${MAX_GROUP_MEMBERS} members.`,
      });
    }

    // Don't allow the creator to be added again.
    const creatorId = req.user._id.toString();

    const filteredMemberIds =
      uniqueMemberIds.filter(
        (id) => id !== creatorId
      );

    if (filteredMemberIds.length > 0) {
      const users = await User.find({
        _id: {
          $in: filteredMemberIds,
        },
      }).select("_id");

      if (
        users.length !==
        filteredMemberIds.length
      ) {
        return res.status(404).json({
          success: false,
          message:
            "One or more selected users do not exist.",
        });
      }

      // Every added person must be an accepted connection.
      for (const memberId of filteredMemberIds) {
        const connection =
          await getAcceptedConnection(
            req.user._id,
            memberId
          );

        if (!connection) {
          return res.status(403).json({
            success: false,
            message:
              "You can only add accepted connections to a group.",
          });
        }
      }
    }

    const participants = [
      req.user._id,
      ...filteredMemberIds,
    ];

    const group = await Conversation.create({
      type: "group",
      participants,
      name: cleanName,
      description: description?.trim() || "",
      owner: req.user._id,
      admins: [req.user._id],
    });

    const populatedGroup =
      await populateGroup(group._id);

    const io = req.app.get("io");

    if (io) {
      for (const memberId of participants) {
        io.to(`user:${memberId.toString()}`).emit(
          "group-created",
          populatedGroup
        );
      }
    }
// Notify added members.
for (const memberId of filteredMemberIds) {
  await notifyUser({
    req,
    recipient: memberId,
    actor: req.user._id,
    type: "group-added",
    title: "You were added to a group",
    body: `${req.user.username} added you to ${group.name}.`,
    url: `/groups/${group._id}`,
    tag: `group-added-${group._id}`,
    conversationId: group._id,
  });
}

    return res.status(201).json({
      success: true,
      group: populatedGroup,
    });
  } catch (error) {
    console.error(
      "Create group error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to create group.",
    });
  }
});


/*
  GET /api/groups

  Get groups where current user is a member.
*/
router.get("/", protect, async (req, res) => {
  try {
    const groups = await Conversation.find({
      type: "group",
      participants: req.user._id,
    })
      .populate(
        "participants",
        "username avatar"
      )
      .populate(
        "lastMessage",
        "text sender createdAt"
      )
      .populate(
        "owner",
        "username avatar"
      )
      .sort({
        updatedAt: -1,
      });

    /*
     * Defensive UI/data cleanup.
     *
     * If an old group contains duplicate participant
     * IDs, remove them before returning the group.
     */
    for (const group of groups) {
      const seen = new Set();

      group.participants =
        group.participants.filter((member) => {
          const memberId =
            getId(member);

          if (!memberId) {
            return false;
          }

          if (seen.has(memberId)) {
            return false;
          }

          seen.add(memberId);
          return true;
        });
    }

    return res.status(200).json({
      success: true,
      groups,
    });
  } catch (error) {
    console.error(
      "Get groups error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to load groups.",
    });
  }
});


/*
  GET /api/groups/:groupId

  Get group details.
*/
router.get(
  "/:groupId",
  protect,
  async (req, res) => {
    try {
      const { groupId } = req.params;

      if (!isValidObjectId(groupId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid group ID.",
        });
      }

      const group = await populateGroup(
        groupId
      );

      if (
        !group ||
        group.type !== "group"
      ) {
        return res.status(404).json({
          success: false,
          message: "Group not found.",
        });
      }

      if (
        !isMember(
          group,
          req.user._id
        )
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You are not a member of this group.",
        });
      }

      return res.status(200).json({
        success: true,
        group,
      });
    } catch (error) {
      console.error(
        "Get group error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Unable to load group.",
      });
    }
  }
);


/*
  POST /api/groups/:groupId/members

  Admin adds an accepted connection.
*/
router.post(
  "/:groupId/members",
  protect,
  async (req, res) => {
    try {
      const { groupId } = req.params;
      const { userId } = req.body;

      if (
        !isValidObjectId(groupId) ||
        !isValidObjectId(userId)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid ID.",
        });
      }

      const group =
        await Conversation.findOne({
          _id: groupId,
          type: "group",
        });

      if (!group) {
        return res.status(404).json({
          success: false,
          message: "Group not found.",
        });
      }

      if (
        !isMember(
          group,
          req.user._id
        )
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You are not a member of this group.",
        });
      }

      if (
        !isAdmin(
          group,
          req.user._id
        )
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Only group admins can add members.",
        });
      }

      if (
        group.participants.some(
          (member) =>
            member.toString() ===
            userId.toString()
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "That user is already a group member.",
        });
      }

      if (
        group.participants.length >=
        MAX_GROUP_MEMBERS
      ) {
        return res.status(400).json({
          success: false,
          message: `A group can have a maximum of ${MAX_GROUP_MEMBERS} members.`,
        });
      }

      const targetUser =
        await User.findById(userId);

      if (!targetUser) {
        return res.status(404).json({
          success: false,
          message: "User not found.",
        });
      }

      if (
        userId.toString() ===
        req.user._id.toString()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "You are already a member of this group.",
        });
      }

      const connection =
        await getAcceptedConnection(
          req.user._id,
          userId
        );

      if (!connection) {
        return res.status(403).json({
          success: false,
          message:
            "You can only add accepted connections.",
        });
      }

      group.participants.push(userId);

      await group.save();

      const populatedGroup =
        await populateGroup(
          group._id
        );

      const io = req.app.get("io");

      if (io) {
        io.to(
          `conversation:${group._id}`
        ).emit(
          "group-updated",
          populatedGroup
        );
      }

      await notifyUser({
        req,
        recipient: userId,
        actor: req.user._id,
        type: "group-added",
        title: "You were added to a group",
        body: `${req.user.username} added you to ${group.name}.`,
        url: `/groups/${group._id}`,
        tag: `group-added-${group._id}`,
      });

      return res.status(200).json({
        success: true,
        group: populatedGroup,
      });
    } catch (error) {
      console.error(
        "Add group member error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to add group member.",
      });
    }
  }
);


/*
  DELETE /api/groups/:groupId/members/:userId

  Admin removes a member.
*/
router.delete(
  "/:groupId/members/:userId",
  protect,
  async (req, res) => {
    try {
      const {
        groupId,
        userId,
      } = req.params;

      if (
        !isValidObjectId(groupId) ||
        !isValidObjectId(userId)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid ID.",
        });
      }

      const group =
        await Conversation.findOne({
          _id: groupId,
          type: "group",
        });

      if (!group) {
        return res.status(404).json({
          success: false,
          message: "Group not found.",
        });
      }

      if (
        !isMember(
          group,
          req.user._id
        )
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You are not a member of this group.",
        });
      }

      if (
        !isAdmin(
          group,
          req.user._id
        )
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Only group admins can remove members.",
        });
      }

      if (
        group.owner?.toString() ===
        userId.toString()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "The group owner cannot be removed.",
        });
      }

      if (
        !group.participants.some(
          (member) =>
            member.toString() ===
            userId.toString()
        )
      ) {
        return res.status(404).json({
          success: false,
          message:
            "That user is not a member of this group.",
        });
      }

      group.participants =
        group.participants.filter(
          (member) =>
            member.toString() !==
            userId.toString()
        );

      group.admins =
        group.admins.filter(
          (admin) =>
            admin.toString() !==
            userId.toString()
        );

      await group.save();

      const populatedGroup =
        await populateGroup(
          group._id
        );

      const io = req.app.get("io");

      if (io) {
        io.to(`conversation:${group._id}`).emit(
          "group-updated",
          populatedGroup
        );

        // Immediately revoke the removed user's realtime room access.
        const conversationRoom = `conversation:${group._id}`;
        for (const connectedSocket of io.sockets.sockets.values()) {
          if (connectedSocket.user?._id?.toString() === userId.toString()) {
            connectedSocket.leave(conversationRoom);
            connectedSocket.emit("group-member-removed", {
              groupId: group._id.toString(),
            });
          }
        }

      }

      return res.status(200).json({
        success: true,
        group: populatedGroup,
      });
    } catch (error) {
      console.error(
        "Remove group member error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to remove group member.",
      });
    }
  }
);


/*
  POST /api/groups/:groupId/leave

  Current user leaves the group.
*/
router.post(
  "/:groupId/leave",
  protect,
  async (req, res) => {
    try {
      const { groupId } = req.params;

      if (!isValidObjectId(groupId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid group ID.",
        });
      }

      const group =
        await Conversation.findOne({
          _id: groupId,
          type: "group",
        });

      if (!group) {
        return res.status(404).json({
          success: false,
          message: "Group not found.",
        });
      }

      if (
        !isMember(
          group,
          req.user._id
        )
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You are not a member of this group.",
        });
      }

      // Owner must transfer ownership before leaving.
      if (
        group.owner?.toString() ===
        req.user._id.toString()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "The group owner must transfer ownership before leaving.",
        });
      }

      group.participants =
        group.participants.filter(
          (member) =>
            member.toString() !==
            req.user._id.toString()
        );

      group.admins =
        group.admins.filter(
          (admin) =>
            admin.toString() !==
            req.user._id.toString()
        );

      await group.save();

      const io = req.app.get("io");

      if (io) {
        const conversationRoom = `conversation:${group._id}`;
        io.to(conversationRoom).emit(
          "group-updated",
          await populateGroup(group._id)
        );

        for (const connectedSocket of io.sockets.sockets.values()) {
          if (connectedSocket.user?._id?.toString() === req.user._id.toString()) {
            connectedSocket.leave(conversationRoom);
            connectedSocket.emit("group-left", {
              groupId: group._id.toString(),
            });
          }
        }
      }

      return res.status(200).json({
        success: true,
        message: "You left the group.",
      });
    } catch (error) {
      console.error(
        "Leave group error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to leave group.",
      });
    }
  }
);

module.exports = router;