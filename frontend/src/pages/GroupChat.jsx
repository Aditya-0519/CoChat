import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  ChevronRight,
  LoaderCircle,
  MoreVertical,
  Send,
  UserRound,
  UsersRound,
} from "lucide-react";

import AppShell from "../components/AppShell";
import PresenceDot from "../components/PresenceDot";
import { useAuth } from "../context/useAuth";
import { getGroup } from "../services/groupService";
import {
  getMessageState,
  getMessages,
  markConversationRead,
  markMessageDelivered,
  sendMessage,
} from "../services/messageService";
import { socket } from "../services/socket";

const MESSAGE_PAGE_SIZE = 30;

const getId = (value) => {
  if (!value) return "";

  if (typeof value === "string") {
    return value;
  }

  if (value._id) {
    return value._id.toString();
  }

  if (value.id) {
    return value.id.toString();
  }

  return value.toString();
};

const mergeMessages = (existing, incoming) => {
  const map = new Map();

  [...existing, ...incoming].forEach((message) => {
    const id = getId(message?._id);

    if (id) {
      map.set(id, message);
    }
  });

  return Array.from(map.values()).sort(
    (a, b) =>
      new Date(a.createdAt || 0).getTime() -
      new Date(b.createdAt || 0).getTime()
  );
};

const formatLastSeen = (date) => {
  if (!date) return "Offline";

  const value = new Date(date);

  if (Number.isNaN(value.getTime())) {
    return "Offline";
  }

  const now = Date.now();
  const difference = Math.max(
    0,
    Math.floor((now - value.getTime()) / 1000)
  );

  if (difference < 60) {
    return "Last seen just now";
  }

  const minutes = Math.floor(difference / 60);

  if (minutes < 60) {
    return `Last seen ${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `Last seen ${hours}h ago`;
  }

  const days = Math.floor(hours / 24);

  if (days < 7) {
    return `Last seen ${days}d ago`;
  }

  return `Last seen ${value.toLocaleDateString([], {
    day: "numeric",
    month: "short",
  })}`;
};

function GroupChat() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [group, setGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);

  const [readStates, setReadStates] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});

  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const mountedRef = useRef(true);

  const currentUserId = useMemo(
    () => getId(user),
    [user]
  );

  const groupMembers = useMemo(
    () =>
      Array.isArray(group?.participants)
        ? group.participants.filter(Boolean)
        : [],
    [group]
  );

  const loadGroup = useCallback(async () => {
    try {
      const response = await getGroup(groupId);

      if (!response?.success) {
        throw new Error(
          response?.message || "Unable to load group."
        );
      }

      if (mountedRef.current) {
        setGroup(response.group);
      }
    } catch (err) {
      console.error("Load group error:", err);

      if (mountedRef.current) {
        setError(
          err.message || "Unable to load group."
        );
      }
    }
  }, [groupId]);

  const loadInitialMessages = useCallback(async () => {
    try {
      const response = await getMessages(groupId, {
        limit: MESSAGE_PAGE_SIZE,
      });

      if (!response?.success) {
        throw new Error(
          response?.message ||
            "Unable to load messages."
        );
      }

      if (!mountedRef.current) return;

      setMessages(response.messages || []);

      setHasMore(
        Boolean(response.pagination?.hasMore)
      );

      setNextCursor(
        response.pagination?.nextCursor || null
      );
    } catch (err) {
      console.error(
        "Load group messages error:",
        err
      );

      if (mountedRef.current) {
        setError(
          err.message || "Unable to load messages."
        );
      }
    }
  }, [groupId]);

  const loadMessageState = useCallback(async () => {
    try {
      const response = await getMessageState(groupId);

      if (!response?.success || !mountedRef.current) {
        return;
      }

      setReadStates(response.readStates || []);
    } catch (err) {
      console.error(
        "Load group message state error:",
        err
      );
    }
  }, [groupId]);

  const syncGroupChat = useCallback(
    async ({ scrollToBottom = false } = {}) => {
      try {
        await Promise.all([
          loadGroup(),
          loadInitialMessages(),
          loadMessageState(),
        ]);

        if (
          scrollToBottom &&
          mountedRef.current
        ) {
          window.setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({
              behavior: "auto",
              block: "end",
            });
          }, 30);
        }
      } catch (err) {
        console.error(
          "Group chat sync error:",
          err
        );
      }
    },
    [
      loadGroup,
      loadInitialMessages,
      loadMessageState,
    ]
  );

  useEffect(() => {
    mountedRef.current = true;

    setLoading(true);
    setError("");

    syncGroupChat({
      scrollToBottom: true,
    }).finally(() => {
      if (mountedRef.current) {
        setLoading(false);
      }
    });

    return () => {
      mountedRef.current = false;
    };
  }, [syncGroupChat]);

  const loadOlderMessages = useCallback(async () => {
    if (
      loadingOlder ||
      !hasMore ||
      !nextCursor ||
      !groupId
    ) {
      return;
    }

    const container =
      messagesContainerRef.current;

    const previousScrollHeight =
      container?.scrollHeight || 0;

    const previousScrollTop =
      container?.scrollTop || 0;

    try {
      setLoadingOlder(true);

      const response = await getMessages(groupId, {
        limit: MESSAGE_PAGE_SIZE,
        before: nextCursor,
      });

      if (!response?.success) {
        throw new Error(
          response?.message ||
            "Unable to load older messages."
        );
      }

      if (!mountedRef.current) return;

      setMessages((previous) =>
        mergeMessages(
          response.messages || [],
          previous
        )
      );

      setHasMore(
        Boolean(response.pagination?.hasMore)
      );

      setNextCursor(
        response.pagination?.nextCursor || null
      );

      window.requestAnimationFrame(() => {
        const currentContainer =
          messagesContainerRef.current;

        if (!currentContainer) return;

        const newScrollHeight =
          currentContainer.scrollHeight;

        currentContainer.scrollTop =
          previousScrollTop +
          (newScrollHeight - previousScrollHeight);
      });
    } catch (err) {
      console.error(
        "Load older group messages error:",
        err
      );

      if (mountedRef.current) {
        setError(
          err.message ||
            "Unable to load older messages."
        );
      }
    } finally {
      if (mountedRef.current) {
        setLoadingOlder(false);
      }
    }
  }, [
    groupId,
    hasMore,
    loadingOlder,
    nextCursor,
  ]);

  const handleMessagesScroll = useCallback(() => {
    const container =
      messagesContainerRef.current;

    if (!container || loadingOlder || !hasMore) {
      return;
    }

    if (container.scrollTop <= 100) {
      loadOlderMessages();
    }
  }, [
    hasMore,
    loadOlderMessages,
    loadingOlder,
  ]);

  const getReadStateForUser = useCallback(
    (userId) => {
      const normalizedId = getId(userId);

      return readStates.find(
        (state) =>
          getId(state?.user) === normalizedId
      );
    },
    [readStates]
  );

  const updateMessageReceipt = useCallback(
    ({
      messageId,
      userId,
      deliveredAt,
      readAt,
    }) => {
      const normalizedMessageId =
        getId(messageId);

      const normalizedUserId =
        getId(userId);

      if (
        !normalizedMessageId ||
        !normalizedUserId
      ) {
        return;
      }

      setMessages((previous) =>
        previous.map((message) => {
          if (
            getId(message?._id) !==
            normalizedMessageId
          ) {
            return message;
          }

          const existingReceipts =
            Array.isArray(message.receipts)
              ? message.receipts
              : [];

          const receiptIndex =
            existingReceipts.findIndex(
              (receipt) =>
                getId(receipt?.user) ===
                normalizedUserId
            );

          const nextReceipt = {
            user: normalizedUserId,
            deliveredAt:
              deliveredAt ||
              existingReceipts[
                receiptIndex
              ]?.deliveredAt ||
              null,
            readAt:
              readAt ||
              existingReceipts[
                receiptIndex
              ]?.readAt ||
              null,
          };

          const nextReceipts = [
            ...existingReceipts,
          ];

          if (receiptIndex >= 0) {
            nextReceipts[receiptIndex] =
              nextReceipt;
          } else {
            nextReceipts.push(nextReceipt);
          }

          return {
            ...message,
            receipts: nextReceipts,
          };
        })
      );
    },
    []
  );

  const markVisibleMessagesRead =
    useCallback(async () => {
      if (
        !groupId ||
        !currentUserId ||
        messages.length === 0
      ) {
        return;
      }

      const incomingMessages =
        messages.filter(
          (message) =>
            getId(message?.sender) !==
            currentUserId
        );

      if (incomingMessages.length === 0) {
        return;
      }

      const latestIncoming =
        incomingMessages[
          incomingMessages.length - 1
        ];

      if (!latestIncoming?._id) {
        return;
      }

      try {
        const response =
          await markConversationRead(
            groupId,
            getId(latestIncoming._id)
          );

        if (!response?.success) {
          return;
        }

        setReadStates((previous) => {
          const next = [...previous];

          const index = next.findIndex(
            (state) =>
              getId(state?.user) ===
              currentUserId
          );

          const nextState = {
            user: currentUserId,
            lastReadMessage:
              latestIncoming._id,
            lastReadAt:
              new Date().toISOString(),
          };

          if (index >= 0) {
            next[index] = {
              ...next[index],
              ...nextState,
            };
          } else {
            next.push(nextState);
          }

          return next;
        });
      } catch (err) {
        console.error(
          "Mark group messages read error:",
          err
        );
      }
    }, [
      currentUserId,
      groupId,
      messages,
    ]);

  useEffect(() => {
    if (messages.length === 0) return;

    const timer = window.setTimeout(() => {
      markVisibleMessagesRead();
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    markVisibleMessagesRead,
    messages,
  ]);

  const markIncomingMessageDelivered =
    useCallback(
      async (message) => {
        const messageId = getId(message?._id);

        if (
          !groupId ||
          !messageId ||
          getId(message?.sender) ===
            currentUserId
        ) {
          return;
        }

        try {
          await markMessageDelivered(
            groupId,
            messageId
          );
        } catch (err) {
          console.error(
            "Mark group message delivered error:",
            err
          );
        }
      },
      [currentUserId, groupId]
    );

  useEffect(() => {
    if (!groupId) return;

    if (!socket.connected) {
      socket.connect();
    }

    socket.emit(
      "join-conversation",
      groupId
    );

    const handleNewMessage = (message) => {
      if (
        getId(message?.conversation) !==
        groupId
      ) {
        return;
      }

      setMessages((previous) => {
        return mergeMessages(
          previous,
          [message]
        );
      });

      if (
        getId(message?.sender) !==
        currentUserId
      ) {
        markIncomingMessageDelivered(
          message
        );
      }
    };

    const handleGroupUpdated = (
      updatedGroup
    ) => {
      if (
        getId(updatedGroup?._id) !==
        groupId
      ) {
        return;
      }

      setGroup(updatedGroup);
    };

    const handleTyping = (payload) => {
      if (
        getId(payload?.conversationId) !==
        groupId
      ) {
        return;
      }

      const typingUserId =
        getId(payload?.userId);

      if (
        !typingUserId ||
        typingUserId === currentUserId
      ) {
        return;
      }

      setTypingUsers((previous) => {
        const next = {
          ...previous,
        };

        if (payload?.isTyping) {
          next[typingUserId] =
            payload?.username ||
            "Someone";
        } else {
          delete next[typingUserId];
        }

        return next;
      });
    };

    const handleMessageRead = (payload) => {
      if (
        getId(payload?.conversationId) !==
        groupId
      ) {
        return;
      }

      updateMessageReceipt({
        messageId: payload?.messageId,
        userId: payload?.userId,
        deliveredAt:
          payload?.deliveredAt,
        readAt: payload?.readAt,
      });

      if (
        getId(payload?.userId) ===
        currentUserId
      ) {
        setReadStates((previous) => {
          const next = [...previous];

          const index = next.findIndex(
            (state) =>
              getId(state?.user) ===
              currentUserId
          );

          const nextState = {
            user: currentUserId,
            lastReadMessage:
              payload?.messageId ||
              null,
            lastReadAt:
              payload?.readAt ||
              new Date().toISOString(),
          };

          if (index >= 0) {
            next[index] = {
              ...next[index],
              ...nextState,
            };
          } else {
            next.push(nextState);
          }

          return next;
        });
      }
    };

    const handleMessageDelivered = (
      payload
    ) => {
      if (
        getId(payload?.conversationId) !==
        groupId
      ) {
        return;
      }

      updateMessageReceipt({
        messageId: payload?.messageId,
        userId: payload?.userId,
        deliveredAt:
          payload?.deliveredAt,
        readAt: payload?.readAt,
      });
    };

    const handleConversationRead = (
      payload
    ) => {
      if (
        getId(payload?.conversationId) !==
        groupId
      ) {
        return;
      }

      const readerId =
        getId(payload?.userId);

      if (!readerId) return;

      setReadStates((previous) => {
        const next = [...previous];

        const index = next.findIndex(
          (state) =>
            getId(state?.user) ===
            readerId
        );

        const nextState = {
          user: readerId,
          lastReadMessage:
            payload?.lastReadMessage ||
            null,
          lastReadAt:
            payload?.lastReadAt ||
            new Date().toISOString(),
        };

        if (index >= 0) {
          next[index] = {
            ...next[index],
            ...nextState,
          };
        } else {
          next.push(nextState);
        }

        return next;
      });
    };

    const handleReconnect = () => {
      socket.emit(
        "join-conversation",
        groupId
      );

      syncGroupChat({
        scrollToBottom: false,
      });
    };

    socket.on(
      "new-message",
      handleNewMessage
    );

    socket.on(
      "group-updated",
      handleGroupUpdated
    );

    socket.on(
      "conversation:typing",
      handleTyping
    );

    socket.on(
      "message:read",
      handleMessageRead
    );

    socket.on(
      "message:delivered",
      handleMessageDelivered
    );

    socket.on(
      "conversation:read",
      handleConversationRead
    );

    socket.on(
      "connect",
      handleReconnect
    );

    return () => {
      socket.off(
        "new-message",
        handleNewMessage
      );

      socket.off(
        "group-updated",
        handleGroupUpdated
      );

      socket.off(
        "conversation:typing",
        handleTyping
      );

      socket.off(
        "message:read",
        handleMessageRead
      );

      socket.off(
        "message:delivered",
        handleMessageDelivered
      );

      socket.off(
        "conversation:read",
        handleConversationRead
      );

      socket.off(
        "connect",
        handleReconnect
      );

      socket.emit(
        "leave-conversation",
        groupId
      );

      setTypingUsers({});
    };
  }, [
    currentUserId,
    groupId,
    markIncomingMessageDelivered,
    syncGroupChat,
    updateMessageReceipt,
  ]);

  const emitTypingState = useCallback(
    (isTyping) => {
      if (!groupId || !socket.connected) {
        return;
      }

      socket.emit(
        "conversation:typing",
        {
          conversationId: groupId,
          isTyping,
        }
      );
    },
    [groupId]
  );

  const handleTextChange = (event) => {
    const value = event.target.value;

    setText(value);

    if (!value.trim()) {
      if (typingTimeoutRef.current) {
        window.clearTimeout(
          typingTimeoutRef.current
        );
      }

      emitTypingState(false);
      return;
    }

    emitTypingState(true);

    if (typingTimeoutRef.current) {
      window.clearTimeout(
        typingTimeoutRef.current
      );
    }

    typingTimeoutRef.current =
      window.setTimeout(() => {
        emitTypingState(false);
      }, 1500);
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        window.clearTimeout(
          typingTimeoutRef.current
        );
      }

      emitTypingState(false);
    };
  }, [emitTypingState]);

  const handleSend = async (event) => {
    event.preventDefault();

    const trimmedText = text.trim();

    if (!trimmedText || sending) {
      return;
    }

    try {
      setSending(true);
      setError("");

      emitTypingState(false);

      const response = await sendMessage(
        groupId,
        trimmedText
      );

      if (!response?.success) {
        throw new Error(
          response?.message ||
            "Unable to send message."
        );
      }

      setText("");

      if (response.message) {
        setMessages((previous) =>
          mergeMessages(previous, [
            response.message,
          ])
        );
      }
    } catch (err) {
      console.error(
        "Send group message error:",
        err
      );

      setError(
        err.message ||
          "Unable to send message."
      );
    } finally {
      setSending(false);
    }
  };

  const getOwnMessageStatus = useCallback(
    (message) => {
      const receipts = Array.isArray(
        message?.receipts
      )
        ? message.receipts
        : [];

      const otherParticipantIds =
        groupMembers
          .map((member) => getId(member))
          .filter(
            (memberId) =>
              memberId &&
              memberId !== currentUserId
          );

      if (
        otherParticipantIds.length === 0
      ) {
        return "sent";
      }

      const relevantReceipts =
        otherParticipantIds.map(
          (memberId) =>
            receipts.find(
              (receipt) =>
                getId(receipt?.user) ===
                memberId
            )
        );

      const allRead =
        relevantReceipts.length > 0 &&
        relevantReceipts.every(
          (receipt) => Boolean(receipt?.readAt)
        );

      if (allRead) {
        return "read";
      }

      const anyDelivered =
        relevantReceipts.some(
          (receipt) =>
            Boolean(receipt?.deliveredAt)
        );

      if (anyDelivered) {
        return "delivered";
      }

      return "sent";
    },
    [currentUserId, groupMembers]
  );

  const renderMessageStatus = (
    message
  ) => {
    const status =
      getOwnMessageStatus(message);

    if (status === "read") {
      return (
        <CheckCheck
          size={14}
          strokeWidth={2.4}
          aria-label="Read"
        />
      );
    }

    if (status === "delivered") {
      return (
        <CheckCheck
          size={14}
          strokeWidth={2.4}
          aria-label="Delivered"
        />
      );
    }

    return (
      <Check
        size={14}
        strokeWidth={2.4}
        aria-label="Sent"
      />
    );
  };

  const memberCount =
    group?.participants?.length || 0;

  const visibleMembers =
    groupMembers.slice(0, 5);

  const groupSubtitle =
    group?.description?.trim()
      ? group.description.trim()
      : `${memberCount} ${
          memberCount === 1
            ? "member"
            : "members"
        } in this space`;

  const typingMemberNames = Object.values(
    typingUsers
  );

  const typingLabel =
    typingMemberNames.length === 1
      ? `${typingMemberNames[0]} is typing...`
      : typingMemberNames.length > 1
        ? `${typingMemberNames
            .slice(0, 2)
            .join(", ")} are typing...`
        : "";

  if (loading) {
    return (
      <AppShell>
        <div className="group-chat-page">
          <div className="group-chat-loading">
            <LoaderCircle
              size={28}
              className="spin"
            />
            <span>
              Loading group...
            </span>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!group) {
    return (
      <AppShell>
        <div className="group-chat-page">
          <div className="group-chat-error">
            <h2>Group not found</h2>

            <p>
              {error ||
                "This group may no longer exist."}
            </p>

            <button
              type="button"
              className="group-primary-button"
              onClick={() =>
                navigate("/groups")
              }
            >
              <ArrowLeft size={17} />
              Back to groups
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="group-chat-page">
        <section
          className="group-chat-card"
          aria-label={`${group.name} group chat`}
        >
          <header className="group-chat-header">
            <div className="group-chat-header-left">
              <button
                type="button"
                className="group-back-button"
                onClick={() =>
                  navigate("/groups")
                }
                title="Back to groups"
                aria-label="Back to groups"
              >
                <ArrowLeft
                  size={19}
                  strokeWidth={2.2}
                />
              </button>

              <div className="group-chat-identity">
                <div className="group-chat-avatar">
                  <UsersRound
                    size={23}
                    strokeWidth={1.9}
                  />
                </div>

                <div className="group-chat-title">
                  <div className="group-chat-title-line">
                    <h1 title={group.name}>
                      {group.name}
                    </h1>

                    <span
                      className="group-chat-live-dot"
                      aria-label="Active group"
                    />
                  </div>

                  <button
                    type="button"
                    className="group-chat-member-trigger"
                    onClick={() =>
                      navigate("/groups")
                    }
                  >
                    <span>
                      {memberCount}{" "}
                      {memberCount === 1
                        ? "member"
                        : "members"}
                    </span>

                    <ChevronRight
                      size={13}
                    />
                  </button>
                </div>
              </div>
            </div>

            <div className="group-chat-header-actions">
              <div
                className="group-chat-member-stack"
                aria-label="Group members"
              >
                {visibleMembers.map(
                  (member, index) => {
                    const memberId =
                      getId(member);

                    const avatar =
                      member?.avatar || "";

                    const username =
                      member?.username ||
                      "Member";

                    return (
                      <div
                        className="group-chat-member-avatar"
                        key={
                          memberId ||
                          `${username}-${index}`
                        }
                        title={`@${username}`}
                        style={{
                          position:
                            "relative",
                        }}
                      >
                        {avatar ? (
                          <img
                            src={avatar}
                            alt=""
                          />
                        ) : (
                          <UserRound
                            size={14}
                          />
                        )}

                        {memberId &&
                          memberId !==
                            currentUserId && (
                            <span
                              style={{
                                position:
                                  "absolute",
                                right: -1,
                                bottom: -1,
                              }}
                            >
                              <PresenceDot
                                userId={
                                  memberId
                                }
                                size="small"
                              />
                            </span>
                          )}
                      </div>
                    );
                  }
                )}

                {memberCount >
                  visibleMembers.length && (
                  <span className="group-chat-member-more">
                    +
                    {memberCount -
                      visibleMembers.length}
                  </span>
                )}
              </div>

              <Link
                to="/groups"
                className="group-chat-groups-link"
                title="Back to groups"
              >
                <UsersRound size={17} />
                <span>Groups</span>
              </Link>

              <button
                type="button"
                className="group-chat-more-button"
                onClick={() =>
                  navigate("/groups")
                }
                title="Group options"
                aria-label="Group options"
              >
                <MoreVertical
                  size={19}
                />
              </button>
            </div>
          </header>

          <div className="group-chat-subheader">
            <span className="group-chat-subheader-dot" />

            <p title={groupSubtitle}>
              {groupSubtitle}
            </p>
          </div>

          {error && (
            <div
              className="group-chat-inline-error"
              role="alert"
            >
              <span>{error}</span>

              <button
                type="button"
                onClick={() =>
                  setError("")
                }
              >
                Dismiss
              </button>
            </div>
          )}

          <div
            ref={messagesContainerRef}
            className="group-chat-messages"
            role="log"
            aria-live="polite"
            onScroll={
              handleMessagesScroll
            }
          >
            {loadingOlder && (
              <div
                style={{
                  display: "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  gap: 8,
                  padding:
                    "10px 0 14px",
                  fontSize: 12,
                  opacity: 0.65,
                }}
              >
                <LoaderCircle
                  size={15}
                  className="spin"
                />
                Loading older messages...
              </div>
            )}

            {!loadingOlder &&
              hasMore && (
                <button
                  type="button"
                  onClick={
                    loadOlderMessages
                  }
                  style={{
                    display: "block",
                    margin:
                      "8px auto 14px",
                    padding:
                      "7px 13px",
                    borderRadius: 999,
                    border:
                      "1px solid var(--border, rgba(0,0,0,.08))",
                    background:
                      "var(--surface, #fff)",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  Load older messages
                </button>
              )}

            {messages.length === 0 ? (
              <div className="group-chat-empty">
                <div className="group-chat-empty-orbit">
                  <div className="group-chat-empty-icon">
                    <UsersRound
                      size={27}
                      strokeWidth={1.8}
                    />
                  </div>
                </div>

                <span className="group-chat-empty-kicker">
                  WELCOME TO THE SPACE
                </span>

                <h2>
                  Start the conversation
                </h2>

                <p>
                  This is the beginning of{" "}
                  <strong>
                    {group.name}
                  </strong>
                  . Say hello and get things
                  moving.
                </p>
              </div>
            ) : (
              <>
                <div className="group-chat-day-label">
                  <span>
                    Conversation
                  </span>
                </div>

                <div className="group-chat-message-list">
                  {messages.map(
                    (message) => {
                      const senderId =
                        getId(
                          message?.sender
                        );

                      const isOwnMessage =
                        senderId ===
                        currentUserId;

                      const senderName =
                        message?.sender
                          ?.username ||
                        (isOwnMessage
                          ? user?.username
                          : "Member");

                      const senderAvatar =
                        message?.sender
                          ?.avatar || "";

                      const createdAt =
                        message?.createdAt
                          ? new Date(
                              message.createdAt
                            )
                          : null;

                      const time =
                        createdAt &&
                        !Number.isNaN(
                          createdAt.getTime()
                        )
                          ? createdAt.toLocaleTimeString(
                              [],
                              {
                                hour: "2-digit",
                                minute:
                                  "2-digit",
                              }
                            )
                          : "";

                      const readState =
                        getReadStateForUser(
                          senderId
                        );

                      return (
                        <div
                          key={getId(
                            message?._id
                          )}
                          className={`group-message-row ${
                            isOwnMessage
                              ? "group-message-row-own"
                              : ""
                          }`}
                        >
                          {!isOwnMessage && (
                            <div
                              className="group-message-avatar"
                              style={{
                                position:
                                  "relative",
                              }}
                            >
                              {senderAvatar ? (
                                <img
                                  src={
                                    senderAvatar
                                  }
                                  alt=""
                                />
                              ) : (
                                <UserRound
                                  size={15}
                                />
                              )}

                              <span
                                style={{
                                  position:
                                    "absolute",
                                  right: -2,
                                  bottom: -1,
                                }}
                              >
                                <PresenceDot
                                  userId={
                                    senderId
                                  }
                                  size="small"
                                />
                              </span>
                            </div>
                          )}

                          <div className="group-message-content">
                            {!isOwnMessage && (
                              <span className="group-message-sender">
                                @{senderName}
                              </span>
                            )}

                            <div
                              className={`group-message-bubble ${
                                isOwnMessage
                                  ? "group-message-bubble-own"
                                  : ""
                              }`}
                            >
                              <span className="group-message-text">
                                {message.text}
                              </span>

                              <span className="group-message-meta">
                                {time}

                                {isOwnMessage && (
                                  <span
                                    className="group-message-check"
                                    aria-label={
                                      getOwnMessageStatus(
                                        message
                                      )
                                    }
                                    title={
                                      getOwnMessageStatus(
                                        message
                                      )
                                    }
                                  >
                                    {renderMessageStatus(
                                      message
                                    )}
                                  </span>
                                )}
                              </span>
                            </div>

                            {!isOwnMessage &&
                              readState?.lastReadAt && (
                                <span
                                  style={{
                                    display:
                                      "none",
                                  }}
                                >
                                  {formatLastSeen(
                                    readState.lastReadAt
                                  )}
                                </span>
                              )}
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>

                <div ref={messagesEndRef} />
              </>
            )}

            {typingLabel && (
              <div
                style={{
                  display: "flex",
                  alignItems:
                    "center",
                  gap: 8,
                  padding:
                    "8px 18px 10px",
                  fontSize: 12,
                  opacity: 0.7,
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    gap: 3,
                  }}
                  aria-hidden="true"
                >
                  <span className="group-typing-dot" />
                  <span className="group-typing-dot" />
                  <span className="group-typing-dot" />
                </span>

                <span>
                  {typingLabel}
                </span>
              </div>
            )}
          </div>

          <form
            className="group-chat-composer"
            onSubmit={handleSend}
          >
            <div className="group-chat-input-wrap">
              <input
                type="text"
                value={text}
                onChange={
                  handleTextChange
                }
                onBlur={() =>
                  emitTypingState(false)
                }
                placeholder={`Message ${group.name}...`}
                maxLength={2000}
                disabled={sending}
                autoComplete="off"
                aria-label={`Message ${group.name}`}
              />

              {text.length > 1800 && (
                <span className="group-chat-character-count">
                  {text.length}/2000
                </span>
              )}
            </div>

            <button
              type="submit"
              className="group-chat-send-button"
              disabled={
                !text.trim() || sending
              }
              title="Send message"
              aria-label="Send message"
            >
              {sending ? (
                <LoaderCircle
                  size={19}
                  className="spin"
                />
              ) : (
                <Send size={19} />
              )}
            </button>
          </form>
        </section>
      </main>

      <style>
        {`
          .group-typing-dot {
            width: 4px;
            height: 4px;
            border-radius: 50%;
            background: currentColor;
            display: inline-block;
            animation: groupTypingPulse 1.2s infinite ease-in-out;
          }

          .group-typing-dot:nth-child(2) {
            animation-delay: 0.15s;
          }

          .group-typing-dot:nth-child(3) {
            animation-delay: 0.3s;
          }

          @keyframes groupTypingPulse {
            0%,
            60%,
            100% {
              opacity: 0.3;
              transform: translateY(0);
            }

            30% {
              opacity: 1;
              transform: translateY(-2px);
            }
          }
        `}
      </style>
    </AppShell>
  );
}

export default GroupChat;