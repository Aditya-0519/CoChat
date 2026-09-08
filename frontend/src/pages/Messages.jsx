import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ArrowLeft,
  Check,
  CheckCheck,
  Flag,
  LoaderCircle,
  MessageCircle,
  MoreVertical,
  Paperclip,
  Search,
  SearchCheck,
  Send,
  ShieldBan,
  Smile,
  UserRound,
  UserRoundCheck,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import AppShell from "../components/AppShell";
import PresenceDot from "../components/PresenceDot";

import {
  getConversations,
  getConversation,
} from "../services/conversationService";

import {
  getMessages,
  getMessageState,
  markConversationRead,
  markMessageDelivered,
  sendMessage,
} from "../services/messageService";

import { getCurrentUser } from "../services/authService";

import {
  getConversationSettings,
  setConversationMuted,
} from "../services/conversationSettingService";

import {
  blockUser,
  unblockUser,
  getBlockStatus,
} from "../services/blockService";

import { reportUser } from "../services/reportService";

import { socket } from "../services/socket";


/* =========================================================
   HELPERS
========================================================= */

function getId(value) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  return (
    value._id?.toString() ||
    value.id?.toString() ||
    ""
  );
}


function formatTime(date) {
  if (!date) {
    return "";
  }

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}


function formatConversationTime(date) {
  if (!date) {
    return "";
  }

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const now = new Date();

  if (
    parsed.toDateString() ===
    now.toDateString()
  ) {
    return parsed.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const yesterday = new Date();

  yesterday.setDate(
    yesterday.getDate() - 1
  );

  if (
    parsed.toDateString() ===
    yesterday.toDateString()
  ) {
    return "Yesterday";
  }

  return parsed.toLocaleDateString([], {
    day: "numeric",
    month: "short",
  });
}


/*
 * Return the participant who is NOT the current user.
 *
 * IMPORTANT:
 * We deliberately do NOT fall back to participants[0].
 *
 * The old fallback could make a malformed
 * [currentUser, currentUser] conversation appear
 * as a legitimate conversation with yourself.
 */
function getOtherParticipant(
  conversation,
  currentUser
) {
  if (
    !conversation ||
    !Array.isArray(
      conversation.participants
    )
  ) {
    return null;
  }

  const currentId =
    getId(currentUser);

  if (!currentId) {
    return null;
  }

  return (
    conversation.participants.find(
      (participant) =>
        getId(participant) !==
        currentId
    ) || null
  );
}


function isValidConversationForUser(
  conversation,
  currentUser
) {
  if (!conversation) {
    return false;
  }

  /*
   * Your current backend Conversation model uses
   * `isGroup`, not `type`.
   *
   * Messages page currently supports direct chats.
   */
  if (conversation.isGroup === true) {
    return false;
  }

  const participants =
    conversation.participants;

  if (
    !Array.isArray(participants) ||
    participants.length !== 2
  ) {
    return false;
  }

  const ids = participants
    .map(getId)
    .filter(Boolean);

  if (ids.length !== 2) {
    return false;
  }

  /*
   * Prevent:
   *
   * [currentUser, currentUser]
   *
   * from ever appearing as a valid conversation.
   */
  if (new Set(ids).size !== 2) {
    return false;
  }

  const currentId =
    getId(currentUser);

  if (!currentId) {
    return false;
  }

  /*
   * Current user must actually belong
   * to this conversation.
   */
  if (!ids.includes(currentId)) {
    return false;
  }

  /*
   * Find the other participant.
   */
  const otherId =
    ids.find(
      (id) => id !== currentId
    );

  /*
   * Final self-chat protection.
   */
  if (
    !otherId ||
    otherId === currentId
  ) {
    return false;
  }

  return true;
}

function mergeMessages(
  existing,
  incoming
) {
  const map = new Map();

  for (
    const message of existing || []
  ) {
    const id = getId(message);

    if (id) {
      map.set(id, message);
    }
  }

  for (
    const message of incoming || []
  ) {
    const id = getId(message);

    if (!id) {
      continue;
    }

    map.set(id, {
      ...map.get(id),
      ...message,
    });
  }

  return Array.from(
    map.values()
  ).sort(
    (a, b) =>
      new Date(
        a.createdAt || 0
      ).getTime() -
      new Date(
        b.createdAt || 0
      ).getTime()
  );
}


function getReceiptForUser(
  message,
  userId
) {
  if (
    !message?.receipts ||
    !userId
  ) {
    return null;
  }

  return (
    message.receipts.find(
      (receipt) =>
        getId(receipt.user) ===
        userId
    ) || null
  );
}


function getOwnMessageStatus(
  message,
  currentUserId
) {
  const receipts =
    message?.receipts || [];

  const otherReceipts =
    receipts.filter(
      (receipt) =>
        getId(receipt.user) !==
        currentUserId
    );

  if (
    otherReceipts.some(
      (receipt) => receipt.readAt
    )
  ) {
    return "read";
  }

  if (
    otherReceipts.some(
      (receipt) =>
        receipt.deliveredAt
    )
  ) {
    return "delivered";
  }

  return "sent";
}


/* =========================================================
   AVATAR
========================================================= */

function Avatar({
  user,
  size = "medium",
}) {
  if (user?.avatar) {
    return (
      <img
        src={user.avatar}
        alt={
          user.username ||
          "User"
        }
        className={`chat-avatar chat-avatar-${size}`}
      />
    );
  }

  return (
    <div
      className={`chat-avatar chat-avatar-fallback chat-avatar-${size}`}
    >
      <UserRound
        size={
          size === "small"
            ? 16
            : size === "large"
              ? 25
              : 21
        }
      />
    </div>
  );
}


/* =========================================================
   MESSAGE STATUS
========================================================= */

function MessageStatus({
  message,
  currentUserId,
}) {
  const status =
    getOwnMessageStatus(
      message,
      currentUserId
    );

  if (status === "read") {
    return (
      <CheckCheck
        size={13}
        aria-label="Read"
        title="Read"
      />
    );
  }

  if (
    status === "delivered"
  ) {
    return (
      <CheckCheck
        size={13}
        aria-label="Delivered"
        title="Delivered"
      />
    );
  }

  return (
    <Check
      size={13}
      aria-label="Sent"
      title="Sent"
    />
  );
}


/* =========================================================
   PAGE
========================================================= */

function Messages() {
  const {
    conversationId,
  } = useParams();

  const navigate =
    useNavigate();


  /* =======================================================
     STATE
  ======================================================= */

  const [
    currentUser,
    setCurrentUser,
  ] = useState(null);

  const [
    conversations,
    setConversations,
  ] = useState([]);

  const [
    conversation,
    setConversation,
  ] = useState(null);

  const [
    messages,
    setMessages,
  ] = useState([]);

  const [
    text,
    setText,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    loadingOlder,
    setLoadingOlder,
  ] = useState(false);

  const [
    hasMoreMessages,
    setHasMoreMessages,
  ] = useState(false);

  const [
    nextCursor,
    setNextCursor,
  ] = useState(null);

  const [
    sending,
    setSending,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    searchMessages,
    setSearchMessages,
  ] = useState(false);

  const [
    messageSearch,
    setMessageSearch,
  ] = useState("");

  const [
    typingUsers,
    setTypingUsers,
  ] = useState(new Set());

  const [
    muted,
    setMuted,
  ] = useState(false);

  const [
    muteLoading,
    setMuteLoading,
  ] = useState(false);

  const [
    blocked,
    setBlocked,
  ] = useState(false);

  const [
    blockLoading,
    setBlockLoading,
  ] = useState(false);

  const [
    showBlockConfirm,
    setShowBlockConfirm,
  ] = useState(false);

  const [
    showReportModal,
    setShowReportModal,
  ] = useState(false);

  const [
    reportReason,
    setReportReason,
  ] = useState("");

  const [
    reportLoading,
    setReportLoading,
  ] = useState(false);

  const [
    showChatMenu,
    setShowChatMenu,
  ] = useState(false);

  const [
    readState,
    setReadState,
  ] = useState(null);


  /* =======================================================
     REFS
  ======================================================= */

  const messagesEndRef =
    useRef(null);

  const messagesContainerRef =
    useRef(null);

  const inputRef =
    useRef(null);

  const chatMenuRef =
    useRef(null);

  const typingTimeoutRef =
    useRef(null);

  const initialScrollRef =
    useRef(true);

  const currentUserRef =
    useRef(null);

  const currentConversationRef =
    useRef(null);


  useEffect(() => {
    currentUserRef.current =
      currentUser;
  }, [currentUser]);


  useEffect(() => {
    currentConversationRef.current =
      conversationId;
  }, [conversationId]);


  /* =======================================================
     LOAD CONVERSATIONS
  ======================================================= */

  const loadConversationList =
    useCallback(
      async () => {
        try {
          const data =
            await getConversations();

          const raw =
            data?.conversations ||
            [];

          /*
           * Frontend defensive filtering.
           *
           * Even if an old malformed self-chat exists
           * in MongoDB, it will never be displayed.
           */
          const safe =
  raw.filter(
    (item) =>
      isValidConversationForUser(
        item,
        currentUserRef.current
      )
  );

          setConversations(
            safe
          );
        } catch (loadError) {
          console.error(
            "Load conversations error:",
            loadError
          );

          setError(
            loadError.message ||
              "Unable to load conversations."
          );
        }
      },
      []
    );


  useEffect(() => {
    let mounted = true;

    const loadInitialData =
      async () => {
        try {
          const [
            userData,
            conversationData,
          ] = await Promise.all([
            getCurrentUser(),
            getConversations(),
          ]);

          if (!mounted) {
            return;
          }

          const user =
            userData?.user ||
            null;

          setCurrentUser(
            user
          );

          currentUserRef.current =
            user;

          const raw =
            conversationData?.conversations ||
            [];

          /*
           * This is the first line of defense against
           * the self-chat appearing on mobile or desktop.
           */
          const safe =
            raw.filter(
              (item) =>
                isValidConversationForUser(
                  item,
                  user
                )
            );

          setConversations(
            safe
          );
        } catch (loadError) {
          if (!mounted) {
            return;
          }

          console.error(
            "Initial messages load error:",
            loadError
          );

          setError(
            loadError.message ||
              "Unable to load conversations."
          );
        } finally {
          if (mounted) {
            setLoading(false);
          }
        }
      };

    loadInitialData();

    return () => {
      mounted = false;
    };
  }, []);


  /* =======================================================
     LOAD SELECTED CHAT
  ======================================================= */

  useEffect(() => {
    let mounted = true;

    const loadSelectedConversation =
      async () => {
        /*
         * /messages is intentionally a conversation-list
         * page.
         *
         * This is the key mobile UX change.
         */
        if (!conversationId) {
          setConversation(null);
          setMessages([]);
          setReadState(null);
          setError("");
          setHasMoreMessages(false);
          setNextCursor(null);
          setTypingUsers(
            new Set()
          );
          setLoading(false);
          return;
        }

        try {
          setLoading(true);
          setError("");
          initialScrollRef.current =
            true;

          const data =
            await getConversation(
              conversationId
            );

          if (!mounted) {
            return;
          }

          const loaded =
            data?.conversation ||
            null;

          /*
           * Never allow a malformed/self conversation
           * to become the active chat.
           */
          if (
            !isValidConversationForUser(
              loaded,
              currentUserRef.current
            )
          ) {
            setConversation(null);
            setMessages([]);
            setError(
              "This conversation is no longer available."
            );
            setLoading(false);

            /*
             * Return to the conversation list.
             */
            navigate(
              "/messages",
              {
                replace: true,
              }
            );

            return;
          }

          setConversation(
            loaded
          );

          const [
            messageResult,
            stateResult,
          ] = await Promise.allSettled([
            getMessages(
              conversationId,
              {
                limit: 30,
              }
            ),
            getMessageState(
              conversationId
            ),
          ]);

          if (!mounted) {
            return;
          }

          if (
            messageResult.status ===
            "fulfilled"
          ) {
            const result =
              messageResult.value;

            setMessages(
              result?.messages ||
                []
            );

            setHasMoreMessages(
              Boolean(
                result
                  ?.pagination
                  ?.hasMore
              )
            );

            setNextCursor(
              result
                ?.pagination
                ?.nextCursor ||
                null
            );
          } else {
            console.error(
              "Load messages error:",
              messageResult.reason
            );

            setMessages([]);
            setHasMoreMessages(
              false
            );
            setNextCursor(null);

            setError(
              messageResult.reason
                ?.message ||
                "Unable to load messages."
            );
          }

          if (
            stateResult.status ===
            "fulfilled"
          ) {
            setReadState(
              stateResult.value
                ?.readState ||
                stateResult.value
                  ?.state ||
                null
            );
          } else {
            setReadState(null);
          }
        } catch (loadError) {
          if (!mounted) {
            return;
          }

          console.error(
            "Load selected conversation error:",
            loadError
          );

          setConversation(null);
          setMessages([]);
          setReadState(null);
          setHasMoreMessages(
            false
          );
          setNextCursor(null);

          setError(
            loadError.message ||
              "Unable to load conversation."
          );
        } finally {
          if (mounted) {
            setLoading(false);
          }
        }
      };

    loadSelectedConversation();

    return () => {
      mounted = false;
    };
  }, [
    conversationId,
    navigate,
  ]);


  /* =======================================================
     LOAD CHAT SETTINGS
  ======================================================= */

  useEffect(() => {
    if (
      !conversationId ||
      !conversation ||
      !currentUser
    ) {
      return;
    }

    let mounted = true;

    const loadSettings =
      async () => {
        try {
          const other =
            getOtherParticipant(
              conversation,
              currentUser
            );

          const otherId =
            getId(other);

          if (!otherId) {
            return;
          }

          const [
            settingsData,
            blockData,
          ] = await Promise.all([
            getConversationSettings(
              conversationId
            ),
            getBlockStatus(
              otherId
            ),
          ]);

          if (!mounted) {
            return;
          }

          setMuted(
            Boolean(
              settingsData?.muted ??
              settingsData
                ?.settings
                ?.muted
            )
          );

          setBlocked(
            Boolean(
              blockData?.blocked ??
              blockData?.isBlocked
            )
          );
        } catch (settingsError) {
          console.debug(
            "Chat settings unavailable:",
            settingsError
          );
        }
      };

    loadSettings();

    return () => {
      mounted = false;
    };
  }, [
    conversationId,
    conversation,
    currentUser,
  ]);


  /* =======================================================
     OTHER USER
  ======================================================= */

  const otherUser =
    useMemo(
      () =>
        getOtherParticipant(
          conversation,
          currentUser
        ),
      [
        conversation,
        currentUser,
      ]
    );

  const otherUserId =
    getId(otherUser);


  /* =======================================================
     SOCKET REALTIME
  ======================================================= */

  useEffect(() => {
    if (!conversationId) {
      return;
    }

    const currentUserId =
      getId(
        currentUserRef.current
      );


    const handleNewMessage =
      (message) => {
        if (!message) {
          return;
        }

        const incomingConversationId =
          getId(
            message.conversation
          );

        if (
          incomingConversationId &&
          incomingConversationId !==
            conversationId
        ) {
          return;
        }

        setMessages(
          (previous) =>
            mergeMessages(
              previous,
              [message]
            )
        );

        /*
         * Keep the conversation at the top.
         */
        setConversations(
          (previous) => {
            const existing =
              previous.find(
                (item) =>
                  getId(item) ===
                  conversationId
              );

            if (!existing) {
              /*
               * Do not fabricate a conversation
               * object from a socket message.
               *
               * REST remains authoritative.
               */
              loadConversationList();

              return previous;
            }

            return [
              {
                ...existing,
                lastMessage:
                  message,
                updatedAt:
                  message.createdAt ||
                  new Date()
                    .toISOString(),
              },
              ...previous.filter(
                (item) =>
                  getId(item) !==
                  conversationId
              ),
            ];
          }
        );

        const senderId =
          getId(message.sender);

        if (
          senderId !==
          currentUserId
        ) {
          markMessageDelivered(
            conversationId,
            getId(message)
          ).catch(() => {});

          markConversationRead(
            conversationId,
            getId(message)
          ).catch(() => {});
        }
      };


    const handleConversationUpdated =
      (payload) => {
        const updatedId =
          getId(
            payload?.conversationId ||
            payload?.conversation ||
            payload
          );

        /*
         * A conversation-list update may concern
         * another chat, so simply refresh the list.
         */
        if (
          !updatedId ||
          updatedId ===
            conversationId
        ) {
          loadConversationList();
        }
      };


    const handleDelivered =
      (payload) => {
        const messageId =
          getId(
            payload?.message
          );

        const userId =
          getId(
            payload?.user
          );

        if (
          !messageId ||
          !userId
        ) {
          return;
        }

        setMessages(
          (previous) =>
            previous.map(
              (message) => {
                if (
                  getId(message) !==
                  messageId
                ) {
                  return message;
                }

                const receipts = [
                  ...(message.receipts ||
                    []),
                ];

                const index =
                  receipts.findIndex(
                    (receipt) =>
                      getId(
                        receipt.user
                      ) ===
                      userId
                  );

                const nextReceipt = {
                  user: userId,
                  deliveredAt:
                    payload.deliveredAt ||
                    new Date()
                      .toISOString(),
                  readAt:
                    index >= 0
                      ? receipts[index]
                          ?.readAt ||
                        null
                      : null,
                };

                if (
                  index >= 0
                ) {
                  receipts[index] = {
                    ...receipts[index],
                    ...nextReceipt,
                  };
                } else {
                  receipts.push(
                    nextReceipt
                  );
                }

                return {
                  ...message,
                  receipts,
                };
              }
            )
        );
      };


    const handleRead =
      (payload) => {
        const messageId =
          getId(
            payload?.message
          );

        const userId =
          getId(
            payload?.user
          );

        if (
          !messageId ||
          !userId
        ) {
          return;
        }

        setMessages(
          (previous) =>
            previous.map(
              (message) => {
                if (
                  getId(message) !==
                  messageId
                ) {
                  return message;
                }

                const receipts = [
                  ...(message.receipts ||
                    []),
                ];

                const index =
                  receipts.findIndex(
                    (receipt) =>
                      getId(
                        receipt.user
                      ) ===
                      userId
                  );

                if (
                  index >= 0
                ) {
                  receipts[index] = {
                    ...receipts[index],
                    deliveredAt:
                      receipts[index]
                        ?.deliveredAt ||
                      payload.readAt ||
                      new Date()
                        .toISOString(),
                    readAt:
                      payload.readAt ||
                      new Date()
                        .toISOString(),
                  };
                } else {
                  receipts.push({
                    user: userId,
                    deliveredAt:
                      payload.readAt ||
                      new Date()
                        .toISOString(),
                    readAt:
                      payload.readAt ||
                      new Date()
                        .toISOString(),
                  });
                }

                return {
                  ...message,
                  receipts,
                };
              }
            )
        );
      };


    const handleTyping =
      (payload) => {
        const incomingId =
          getId(
            payload?.conversation
          );

        if (
          incomingId &&
          incomingId !==
            conversationId
        ) {
          return;
        }

        const userId =
          getId(payload?.user);

        if (
          !userId ||
          userId ===
            currentUserId
        ) {
          return;
        }

        setTypingUsers(
          (previous) => {
            const next =
              new Set(previous);

            if (
              payload.typing
            ) {
              next.add(userId);
            } else {
              next.delete(userId);
            }

            return next;
          }
        );
      };


    const handleConnect =
      async () => {
        socket.emit(
          "join-conversation",
          conversationId
        );

        try {
          const [
            messageData,
            stateData,
          ] = await Promise.all([
            getMessages(
              conversationId,
              {
                limit: 30,
              }
            ),
            getMessageState(
              conversationId
            ),
          ]);

          setMessages(
            messageData?.messages ||
              []
          );

          setHasMoreMessages(
            Boolean(
              messageData
                ?.pagination
                ?.hasMore
            )
          );

          setNextCursor(
            messageData
              ?.pagination
              ?.nextCursor ||
              null
          );

          setReadState(
            stateData?.readState ||
            stateData?.state ||
            null
          );

          await loadConversationList();
        } catch (syncError) {
          console.debug(
            "Socket synchronization skipped:",
            syncError
          );
        }
      };


    socket.on(
      "connect",
      handleConnect
    );

    socket.on(
      "new-message",
      handleNewMessage
    );

    socket.on(
      "conversation:updated",
      handleConversationUpdated
    );

    socket.on(
      "message:delivered",
      handleDelivered
    );

    socket.on(
      "message:read",
      handleRead
    );

    socket.on(
      "conversation:typing",
      handleTyping
    );


    if (socket.connected) {
      handleConnect();
    } else {
      socket.connect();
    }


    return () => {
      socket.off(
        "connect",
        handleConnect
      );

      socket.off(
        "new-message",
        handleNewMessage
      );

      socket.off(
        "conversation:updated",
        handleConversationUpdated
      );

      socket.off(
        "message:delivered",
        handleDelivered
      );

      socket.off(
        "message:read",
        handleRead
      );

      socket.off(
        "conversation:typing",
        handleTyping
      );

      socket.emit(
        "leave-conversation",
        conversationId
      );
    };
  }, [
    conversationId,
    loadConversationList,
  ]);


  /* =======================================================
     MARK INCOMING MESSAGES DELIVERED
  ======================================================= */

  useEffect(() => {
    if (
      !conversationId ||
      !currentUser ||
      !messages.length
    ) {
      return;
    }

    const currentId =
      getId(currentUser);

    const pending =
      messages.filter(
        (message) =>
          getId(
            message.sender
          ) !== currentId &&
          !getReceiptForUser(
            message,
            currentId
          )?.deliveredAt
      );

    if (!pending.length) {
      return;
    }

    let cancelled = false;

    const update =
      async () => {
        for (
          const message of pending
        ) {
          if (cancelled) {
            return;
          }

          const id =
            getId(message);

          if (!id) {
            continue;
          }

          try {
            await markMessageDelivered(
              conversationId,
              id
            );
          } catch {
            /* Non-critical. */
          }
        }
      };

    update();

    return () => {
      cancelled = true;
    };
  }, [
    conversationId,
    currentUser,
    messages,
  ]);


  /* =======================================================
     MARK READ
  ======================================================= */

  const markVisibleMessagesRead =
    useCallback(
      async () => {
        if (
          !conversationId ||
          !currentUser ||
          !messages.length
        ) {
          return;
        }

        const currentId =
          getId(currentUser);

        const incoming =
          messages.filter(
            (message) =>
              getId(
                message.sender
              ) !== currentId
          );

        if (!incoming.length) {
          return;
        }

        const last =
          incoming[
            incoming.length - 1
          ];

        const id =
          getId(last);

        if (!id) {
          return;
        }

        try {
          const result =
            await markConversationRead(
              conversationId,
              id
            );

          setReadState(
            result?.readState ||
            result?.state ||
            null
          );

          setConversations(
            (previous) =>
              previous.map(
                (item) =>
                  getId(item) ===
                  conversationId
                    ? {
                        ...item,
                        unreadCount: 0,
                      }
                    : item
              )
          );
        } catch {
          /* Non-critical. */
        }
      },
      [
        conversationId,
        currentUser,
        messages,
      ]
    );


  useEffect(() => {
    if (
      loading ||
      blocked ||
      !conversationId ||
      !messages.length
    ) {
      return;
    }

    const timer =
      setTimeout(
        () => {
          markVisibleMessagesRead();
        },
        250
      );

    return () =>
      clearTimeout(timer);
  }, [
    loading,
    blocked,
    conversationId,
    messages,
    markVisibleMessagesRead,
  ]);


  /* =======================================================
     LOAD OLDER
  ======================================================= */

  const loadOlderMessages =
    async () => {
      if (
        loadingOlder ||
        !conversationId ||
        !hasMoreMessages ||
        !nextCursor
      ) {
        return;
      }

      const container =
        messagesContainerRef.current;

      const oldHeight =
        container?.scrollHeight ||
        0;

      const oldTop =
        container?.scrollTop ||
        0;

      try {
        setLoadingOlder(
          true
        );

        const result =
          await getMessages(
            conversationId,
            {
              limit: 30,
              before: nextCursor,
            }
          );

        setMessages(
          (previous) =>
            mergeMessages(
              result?.messages ||
                [],
              previous
            )
        );

        setHasMoreMessages(
          Boolean(
            result
              ?.pagination
              ?.hasMore
          )
        );

        setNextCursor(
          result
            ?.pagination
            ?.nextCursor ||
            null
        );

        requestAnimationFrame(
          () => {
            if (!container) {
              return;
            }

            container.scrollTop =
              container.scrollHeight -
              oldHeight +
              oldTop;
          }
        );
      } catch (loadError) {
        setError(
          loadError.message ||
            "Unable to load older messages."
        );
      } finally {
        setLoadingOlder(
          false
        );
      }
    };


  /* =======================================================
     SCROLL
  ======================================================= */

  useEffect(() => {
    if (!conversationId) {
      return;
    }

    if (
      initialScrollRef.current
    ) {
      messagesEndRef.current?.scrollIntoView(
        {
          behavior: "auto",
        }
      );

      initialScrollRef.current =
        false;

      return;
    }

    messagesEndRef.current?.scrollIntoView(
      {
        behavior: "smooth",
      }
    );
  }, [
    messages.length,
    conversationId,
  ]);


  /* =======================================================
     SEARCH
  ======================================================= */

  const filteredConversations =
    useMemo(() => {
      const term =
        search
          .trim()
          .toLowerCase();

      return conversations
        .filter(
          (item) =>
            isValidConversationForUser(
              item,
              currentUser
            )
        )
        .filter((item) => {
          if (!term) {
            return true;
          }

          const participant =
            getOtherParticipant(
              item,
              currentUser
            );

          return (
            participant?.username
              ?.toLowerCase()
              .includes(term)
          );
        });
    }, [
      conversations,
      currentUser,
      search,
    ]);


  const visibleMessages =
    useMemo(() => {
      const term =
        messageSearch
          .trim()
          .toLowerCase();

      if (
        !searchMessages ||
        !term
      ) {
        return messages;
      }

      return messages.filter(
        (message) =>
          message.text
            ?.toLowerCase()
            .includes(term)
      );
    }, [
      messages,
      searchMessages,
      messageSearch,
    ]);


  /* =======================================================
     TYPING
  ======================================================= */

  const emitTyping =
    (typing) => {
      if (
        !conversationId ||
        !socket.connected ||
        blocked
      ) {
        return;
      }

      socket.emit(
        "conversation:typing",
        {
          conversationId,
          typing,
        }
      );
    };


  const handleTextChange =
    (event) => {
      const next =
        event.target.value;

      setText(next);

      if (!next.trim()) {
        emitTyping(false);

        if (
          typingTimeoutRef.current
        ) {
          clearTimeout(
            typingTimeoutRef.current
          );
        }

        return;
      }

      emitTyping(true);

      if (
        typingTimeoutRef.current
      ) {
        clearTimeout(
          typingTimeoutRef.current
        );
      }

      typingTimeoutRef.current =
        setTimeout(
          () => {
            emitTyping(false);
          },
          1500
        );
    };


  useEffect(() => {
    return () => {
      if (
        typingTimeoutRef.current
      ) {
        clearTimeout(
          typingTimeoutRef.current
        );
      }

      if (conversationId) {
        socket.emit(
          "conversation:typing",
          {
            conversationId,
            typing: false,
          }
        );
      }
    };
  }, [
    conversationId,
  ]);


  /* =======================================================
     SEND
  ======================================================= */

  const handleSendMessage =
    async (event) => {
      event.preventDefault();

      const clean =
        text.trim();

      if (
        !clean ||
        sending ||
        !conversationId ||
        blocked
      ) {
        return;
      }

      try {
        setSending(true);
        setError("");

        const result =
          await sendMessage(
            conversationId,
            clean
          );

        /*
         * REST response is the immediate source
         * of truth. Socket.IO may also echo the
         * same message; mergeMessages prevents
         * duplicates.
         */
        if (result?.message) {
          setMessages(
            (previous) =>
              mergeMessages(
                previous,
                [result.message]
              )
          );

          setConversations(
            (previous) =>
              previous.map(
                (item) =>
                  getId(item) ===
                  conversationId
                    ? {
                        ...item,
                        lastMessage:
                          result.message,
                        updatedAt:
                          result.message
                            .createdAt ||
                          new Date()
                            .toISOString(),
                      }
                    : item
              )
          );
        }

        setText("");
        emitTyping(false);

        if (
          typingTimeoutRef.current
        ) {
          clearTimeout(
            typingTimeoutRef.current
          );
        }

        setTimeout(() => {
          inputRef.current?.focus();
        }, 0);
      } catch (sendError) {
        console.error(
          "Send message error:",
          sendError
        );

        setError(
          sendError.message ||
            "Unable to send message."
        );
      } finally {
        setSending(false);
      }
    };


  /* =======================================================
     NAVIGATION
  ======================================================= */

  const openConversation =
    (id) => {
      if (!id) {
        return;
      }

      navigate(
        `/messages/${id}`
      );
    };


  /*
   * THIS IS THE IMPORTANT MOBILE FIX.
   *
   * Old implementation:
   *
   *   navigate("/discover")
   *
   * That forces users back to Discover.
   *
   * New implementation:
   *
   *   navigate("/messages")
   *
   * So:
   *
   * /messages
   *      ↓
   * select chat
   *      ↓
   * /messages/:id
   *      ↓
   * Back
   *      ↓
   * /messages
   */
  const handleMobileBack =
    () => {
      navigate(
        "/messages"
      );
    };


  const handleViewProfile =
    () => {
      if (
        !otherUser?.username
      ) {
        return;
      }

      setShowChatMenu(false);

      navigate(
        `/profile/${otherUser.username}`
      );
    };


  /* =======================================================
     MUTE
  ======================================================= */

  const handleToggleMute =
    async () => {
      if (
        muteLoading ||
        !conversationId
      ) {
        return;
      }

      try {
        setMuteLoading(true);
        setError("");

        const next =
          !muted;

        await setConversationMuted(
          conversationId,
          next
        );

        setMuted(next);
        setShowChatMenu(false);
      } catch (muteError) {
        setError(
          muteError.message ||
            "Unable to update notification settings."
        );
      } finally {
        setMuteLoading(false);
      }
    };


  /* =======================================================
     BLOCK
  ======================================================= */

  const handleBlock =
    async () => {
      if (
        blockLoading ||
        !otherUserId
      ) {
        return;
      }

      try {
        setBlockLoading(
          true
        );
        setError("");

        await blockUser(
          otherUserId
        );

        setBlocked(true);
        setShowBlockConfirm(
          false
        );
        setShowChatMenu(false);
      } catch (blockError) {
        setError(
          blockError.message ||
            "Unable to block this user."
        );
      } finally {
        setBlockLoading(
          false
        );
      }
    };


  /* =======================================================
     UNBLOCK
  ======================================================= */

  const handleUnblock =
    async () => {
      if (
        blockLoading ||
        !otherUserId
      ) {
        return;
      }

      try {
        setBlockLoading(
          true
        );
        setError("");

        await unblockUser(
          otherUserId
        );

        setBlocked(false);
        setShowChatMenu(false);
      } catch (unblockError) {
        setError(
          unblockError.message ||
            "Unable to unblock this user."
        );
      } finally {
        setBlockLoading(
          false
        );
      }
    };


  /* =======================================================
     REPORT
  ======================================================= */

  const handleReport =
    async () => {
      if (
        reportLoading ||
        !otherUserId ||
        !reportReason
      ) {
        return;
      }

      try {
        setReportLoading(
          true
        );
        setError("");

        await reportUser(
          otherUserId,
          reportReason
        );

        setShowReportModal(
          false
        );

        setReportReason("");
        setShowChatMenu(false);

        alert(
          "Thanks. Your report has been submitted."
        );
      } catch (reportError) {
        setError(
          reportError.message ||
            "Unable to submit report."
        );
      } finally {
        setReportLoading(
          false
        );
      }
    };


  /* =======================================================
     OUTSIDE MENU
  ======================================================= */

  useEffect(() => {
    const handleOutside =
      (event) => {
        if (
          chatMenuRef.current &&
          !chatMenuRef.current.contains(
            event.target
          )
        ) {
          setShowChatMenu(
            false
          );
        }
      };

    document.addEventListener(
      "mousedown",
      handleOutside
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutside
      );
    };
  }, []);


  /* =======================================================
     LOADING
  ======================================================= */

  if (
    loading &&
    !conversation
  ) {
    return (
      <AppShell>
        <div className="messages-loading">
          <LoaderCircle
            size={26}
            className="messages-spinner"
          />

          <p>
            Loading messages...
          </p>
        </div>
      </AppShell>
    );
  }


  /* =======================================================
     UI
  ======================================================= */

  /*
   * IMPORTANT:
   *
   * `messages-page-chat-open`
   * tells the responsive CSS which screen should
   * occupy the mobile viewport.
   *
   * No JavaScript window.innerWidth is required.
   */
  const pageClass =
    conversationId
      ? "messages-page messages-page-chat-open"
      : "messages-page";


  return (
    <AppShell>

      <div
        className={pageClass}
      >

        {/* =================================================
            CONVERSATION LIST
        ================================================= */}

        <aside className="messages-sidebar">

          <div className="messages-sidebar-header">

            <div>
              <span className="messages-eyebrow">
                YOUR SPACE
              </span>

              <h1>
                Messages
              </h1>
            </div>

            <div className="messages-sidebar-icon">
              <MessageCircle
                size={19}
              />
            </div>

          </div>


          <div className="messages-search">

            <Search
              size={17}
            />

            <input
              type="text"
              placeholder="Search conversations..."
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
            />

          </div>


          <div className="messages-conversation-list">

            {filteredConversations.length ===
            0 ? (

              <div className="messages-sidebar-empty">

                <MessageCircle
                  size={21}
                />

                <p>
                  {search
                    ? "No conversations found."
                    : "No conversations yet."}
                </p>

              </div>

            ) : (

              filteredConversations.map(
                (item) => {
                  const participant =
                    getOtherParticipant(
                      item,
                      currentUser
                    );

                  /*
                   * Extra guard.
                   */
                  if (!participant) {
                    return null;
                  }

                  const id =
                    getId(item);

                  const active =
                    id ===
                    conversationId;

                  const unreadCount =
                    Number(
                      item.unreadCount ||
                      0
                    );

                  return (
                    <button
                      key={id}
                      type="button"
                      className={`conversation-item ${
                        active
                          ? "conversation-item-active"
                          : ""
                      }`}
                      onClick={() =>
                        openConversation(
                          id
                        )
                      }
                    >

                      <div
                        style={{
                          position:
                            "relative",
                          flexShrink: 0,
                        }}
                      >

                        <Avatar
                          user={
                            participant
                          }
                          size="medium"
                        />

                        <div
                          style={{
                            position:
                              "absolute",
                            right: 0,
                            bottom: 1,
                          }}
                        >
                          <PresenceDot
                            userId={getId(
                              participant
                            )}
                            size="small"
                          />
                        </div>

                      </div>


                      <div className="conversation-item-content">

                        <div className="conversation-item-top">

                          <strong>
                            {participant.username ||
                              "User"}
                          </strong>

                          <span className="conversation-time">
                            {formatConversationTime(
                              item.lastMessage
                                ?.createdAt ||
                                item.updatedAt
                            )}
                          </span>

                        </div>


                        <div className="conversation-item-bottom">

                          <span
                            className="conversation-preview"
                            style={{
                              fontWeight:
                                unreadCount >
                                0
                                  ? 700
                                  : undefined,
                            }}
                          >
                            {item
                              .lastMessage
                              ?.text ||
                              "Start a conversation"}
                          </span>

                        </div>

                      </div>


                      {unreadCount >
                      0 ? (

                        <span
                          style={{
                            minWidth: 20,
                            height: 20,
                            padding:
                              "0 6px",
                            display:
                              "flex",
                            alignItems:
                              "center",
                            justifyContent:
                              "center",
                            borderRadius:
                              999,
                            background:
                              "#6366f1",
                            color:
                              "#fff",
                            fontSize: 9,
                            fontWeight: 800,
                          }}
                        >
                          {unreadCount >
                          99
                            ? "99+"
                            : unreadCount}
                        </span>

                      ) : active ? (

                        <span className="conversation-active-dot" />

                      ) : null}

                    </button>
                  );
                }
              )

            )}

          </div>

        </aside>


        {/* =================================================
            CHAT
        ================================================= */}

        <section className="messages-chat">

          {!conversation ? (

            <div className="messages-no-conversation">

              <div className="messages-no-conversation-icon">
                <MessageCircle
                  size={30}
                />
              </div>

              <h2>
                Your conversations
              </h2>

              <p>
                Select a conversation to
                start chatting.
              </p>

              {error && (
                <div
                  className="messages-error"
                  style={{
                    marginTop: 16,
                    maxWidth: 420,
                    textAlign:
                      "center",
                  }}
                >
                  {error}
                </div>
              )}

            </div>

          ) : (

            <>

              {/* ===========================================
                  CHAT HEADER
              ============================================ */}

              <header className="chat-header">

                <div className="chat-header-left">

                  <button
                    type="button"
                    className="chat-mobile-back"
                    onClick={
                      handleMobileBack
                    }
                    aria-label="Back to conversations"
                    title="Back to conversations"
                  >
                    <ArrowLeft
                      size={18}
                    />
                  </button>


                  <div
                    style={{
                      position:
                        "relative",
                      flexShrink: 0,
                    }}
                  >

                    <Avatar
                      user={otherUser}
                      size="large"
                    />

                    <div
                      style={{
                        position:
                          "absolute",
                        right: 1,
                        bottom: 1,
                      }}
                    >
                      <PresenceDot
                        userId={
                          otherUserId
                        }
                        size="small"
                      />
                    </div>

                  </div>


                  <div className="chat-user-info">

                    <div className="chat-user-name-row">

                      <h2>
                        {otherUser?.username ||
                          "User"}
                      </h2>

                      {!blocked && (
                        <PresenceDot
                          userId={
                            otherUserId
                          }
                          size="small"
                        />
                      )}

                    </div>

                    <p>
                      {blocked
                        ? "Blocked"
                        : typingUsers.size >
                            0
                          ? "Typing..."
                          : (
                            <>
                              {otherUser?.college ||
                                "CoChat member"}

                              {otherUser?.branch &&
                                ` · ${otherUser.branch}`}

                              {otherUser?.semester &&
                                ` · Semester ${otherUser.semester}`}
                            </>
                          )}
                    </p>

                  </div>

                </div>


                <div
                  className="chat-menu-wrapper"
                  ref={chatMenuRef}
                >

                  <button
                    type="button"
                    className="chat-more"
                    aria-label="Conversation options"
                    aria-expanded={
                      showChatMenu
                    }
                    onClick={() =>
                      setShowChatMenu(
                        (value) =>
                          !value
                      )
                    }
                  >
                    <MoreVertical
                      size={19}
                    />
                  </button>


                  {showChatMenu && (

                    <div className="chat-options-menu">

                      <button
                        type="button"
                        className="chat-option"
                        onClick={
                          handleViewProfile
                        }
                      >
                        <UserRound
                          size={17}
                        />

                        <span>
                          View profile
                        </span>
                      </button>


                      <button
                        type="button"
                        className="chat-option"
                        onClick={() => {
                          setSearchMessages(
                            (value) =>
                              !value
                          );

                          setMessageSearch(
                            ""
                          );

                          setShowChatMenu(
                            false
                          );
                        }}
                      >
                        <SearchCheck
                          size={17}
                        />

                        <span>
                          Search messages
                        </span>
                      </button>


                      <button
                        type="button"
                        className="chat-option"
                        onClick={
                          handleToggleMute
                        }
                        disabled={
                          muteLoading
                        }
                      >
                        {muted ? (
                          <Volume2
                            size={17}
                          />
                        ) : (
                          <VolumeX
                            size={17}
                          />
                        )}

                        <span>
                          {muted
                            ? "Unmute notifications"
                            : "Mute notifications"}
                        </span>
                      </button>


                      <div className="chat-option-divider" />


                      {blocked ? (

                        <button
                          type="button"
                          className="chat-option"
                          onClick={
                            handleUnblock
                          }
                          disabled={
                            blockLoading
                          }
                        >
                          {blockLoading ? (
                            <LoaderCircle
                              size={17}
                              className="messages-spinner"
                            />
                          ) : (
                            <UserRoundCheck
                              size={17}
                            />
                          )}

                          <span>
                            Unblock user
                          </span>
                        </button>

                      ) : (

                        <button
                          type="button"
                          className="chat-option chat-option-danger"
                          onClick={() => {
                            setShowChatMenu(
                              false
                            );

                            setShowBlockConfirm(
                              true
                            );
                          }}
                        >
                          <ShieldBan
                            size={17}
                          />

                          <span>
                            Block user
                          </span>
                        </button>

                      )}


                      {!blocked && (
                        <button
                          type="button"
                          className="chat-option chat-option-danger"
                          onClick={() => {
                            setShowChatMenu(
                              false
                            );

                            setShowReportModal(
                              true
                            );
                          }}
                        >
                          <Flag
                            size={17}
                          />

                          <span>
                            Report user
                          </span>
                        </button>
                      )}

                    </div>
                  )}

                </div>

              </header>


              {/* ===========================================
                  MESSAGE SEARCH
              ============================================ */}

              {searchMessages && (

                <div className="chat-message-search">

                  <Search
                    size={17}
                  />

                  <input
                    type="text"
                    autoFocus
                    placeholder="Search messages..."
                    value={
                      messageSearch
                    }
                    onChange={(event) =>
                      setMessageSearch(
                        event.target.value
                      )
                    }
                  />

                  <button
                    type="button"
                    onClick={() => {
                      setSearchMessages(
                        false
                      );

                      setMessageSearch(
                        ""
                      );
                    }}
                    aria-label="Close message search"
                  >
                    <X
                      size={17}
                    />
                  </button>

                </div>
              )}


              {/* ===========================================
                  MESSAGES
              ============================================ */}

              <div
                className="chat-messages"
                ref={
                  messagesContainerRef
                }
              >

                {blocked ? (

                  <div className="chat-blocked-state">

                    <div className="chat-blocked-icon">
                      <ShieldBan
                        size={26}
                      />
                    </div>

                    <h3>
                      You blocked{" "}
                      {otherUser?.username}
                    </h3>

                    <p>
                      You won't receive
                      messages from this
                      person.
                    </p>

                    <button
                      type="button"
                      onClick={
                        handleUnblock
                      }
                      disabled={
                        blockLoading
                      }
                    >
                      {blockLoading
                        ? "Unblocking..."
                        : "Unblock user"}
                    </button>

                  </div>

                ) : (

                  <>

                    {hasMoreMessages && (
                      <div
                        style={{
                          display:
                            "flex",
                          justifyContent:
                            "center",
                          marginBottom:
                            18,
                        }}
                      >
                        <button
                          type="button"
                          onClick={
                            loadOlderMessages
                          }
                          disabled={
                            loadingOlder
                          }
                          style={{
                            border:
                              "1px solid #e5e7eb",
                            borderRadius:
                              999,
                            padding:
                              "7px 13px",
                            background:
                              "#fff",
                            color:
                              "#6366f1",
                            fontSize:
                              11,
                            fontWeight:
                              700,
                            cursor:
                              loadingOlder
                                ? "default"
                                : "pointer",
                            opacity:
                              loadingOlder
                                ? 0.6
                                : 1,
                          }}
                        >
                          {loadingOlder
                            ? "Loading..."
                            : "Load older messages"}
                        </button>
                      </div>
                    )}


                    {visibleMessages.length ===
                    0 ? (

                      <div className="chat-empty">

                        <div className="chat-empty-avatar">
                          <Avatar
                            user={
                              otherUser
                            }
                            size="large"
                          />
                        </div>

                        <h3>
                          {searchMessages &&
                          messageSearch.trim()
                            ? "No messages found"
                            : `Say hello to ${
                                otherUser?.username ||
                                "this user"
                              }`}
                        </h3>

                        <p>
                          {searchMessages &&
                          messageSearch.trim()
                            ? "Try a different search term."
                            : "This is the beginning of your private conversation."}
                        </p>

                      </div>

                    ) : (

                      <>

                        <div className="chat-day-divider">
                          <span>
                            Today
                          </span>
                        </div>


                        {visibleMessages.map(
                          (
                            message,
                            index
                          ) => {
                            const mine =
                              getId(
                                message.sender
                              ) ===
                              getId(
                                currentUser
                              );

                            const key =
                              getId(
                                message
                              ) ||
                              `${message.createdAt}-${index}`;

                            return (
                              <div
                                key={key}
                                className={`message-row ${
                                  mine
                                    ? "message-row-mine"
                                    : "message-row-theirs"
                                }`}
                              >

                                {!mine && (
                                  <Avatar
                                    user={
                                      otherUser
                                    }
                                    size="small"
                                  />
                                )}


                                <div
                                  className={`message-group ${
                                    mine
                                      ? "message-group-mine"
                                      : ""
                                  }`}
                                >

                                  <div
                                    className={`message-bubble ${
                                      mine
                                        ? "message-bubble-mine"
                                        : "message-bubble-theirs"
                                    }`}
                                  >
                                    {message.text}
                                  </div>


                                  <div
                                    className={`message-meta ${
                                      mine
                                        ? "message-meta-mine"
                                        : ""
                                    }`}
                                  >
                                    <span>
                                      {formatTime(
                                        message.createdAt
                                      )}
                                    </span>

                                    {mine && (
                                      <MessageStatus
                                        message={
                                          message
                                        }
                                        currentUserId={getId(
                                          currentUser
                                        )}
                                      />
                                    )}
                                  </div>

                                </div>

                              </div>
                            );
                          }
                        )}

                      </>

                    )}


                    {typingUsers.size >
                      0 && (

                      <div className="message-row message-row-theirs">

                        <Avatar
                          user={
                            otherUser
                          }
                          size="small"
                        />

                        <div className="message-group">

                          <div className="message-bubble message-bubble-theirs">

                            <div
                              style={{
                                display:
                                  "flex",
                                gap: 4,
                                alignItems:
                                  "center",
                              }}
                            >
                              <span
                                style={{
                                  width: 5,
                                  height: 5,
                                  borderRadius:
                                    "50%",
                                  background:
                                    "#9ca3af",
                                }}
                              />

                              <span
                                style={{
                                  width: 5,
                                  height: 5,
                                  borderRadius:
                                    "50%",
                                  background:
                                    "#9ca3af",
                                }}
                              />

                              <span
                                style={{
                                  width: 5,
                                  height: 5,
                                  borderRadius:
                                    "50%",
                                  background:
                                    "#9ca3af",
                                }}
                              />
                            </div>

                          </div>

                        </div>

                      </div>
                    )}

                  </>
                )}

                <div
                  ref={
                    messagesEndRef
                  }
                />

              </div>


              {/* ===========================================
                  ERROR
              ============================================ */}

              {error && (

                <div className="messages-error">
                  {error}
                </div>

              )}


              {/* ===========================================
                  COMPOSER
              ============================================ */}

              {blocked ? (

                <div className="chat-composer-blocked">

                  <ShieldBan
                    size={17}
                  />

                  <span>
                    You blocked this person.
                  </span>

                </div>

              ) : (

                <form
                  className="chat-composer"
                  onSubmit={
                    handleSendMessage
                  }
                >

                  <button
                    type="button"
                    className="composer-icon"
                    aria-label="Emoji"
                  >
                    <Smile
                      size={20}
                    />
                  </button>


                  <input
                    ref={inputRef}
                    type="text"
                    value={text}
                    onChange={
                      handleTextChange
                    }
                    placeholder="Type a message..."
                    maxLength={2000}
                    disabled={sending}
                  />


                  <button
                    type="button"
                    className="composer-icon"
                    aria-label="Attach file"
                  >
                    <Paperclip
                      size={19}
                    />
                  </button>


                  <button
                    type="submit"
                    className="composer-send"
                    disabled={
                      sending ||
                      !text.trim()
                    }
                    aria-label="Send message"
                  >
                    {sending ? (
                      <LoaderCircle
                        size={19}
                        className="messages-spinner"
                      />
                    ) : (
                      <Send
                        size={18}
                      />
                    )}
                  </button>

                </form>
              )}

            </>
          )}

        </section>

      </div>


      {/* =====================================================
          BLOCK MODAL
      ====================================================== */}

      {showBlockConfirm && (

        <div
          className="chat-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setShowBlockConfirm(
                false
              );
            }
          }}
        >

          <div className="chat-modal">

            <button
              type="button"
              className="chat-modal-close"
              onClick={() =>
                setShowBlockConfirm(
                  false
                )
              }
              aria-label="Close"
            >
              <X
                size={18}
              />
            </button>


            <div className="chat-modal-icon chat-modal-icon-danger">
              <ShieldBan
                size={24}
              />
            </div>


            <h2>
              Block{" "}
              {otherUser?.username}?
            </h2>

            <p>
              They won't be able to send
              you messages while blocked.
              You can unblock them later.
            </p>


            <div className="chat-modal-actions">

              <button
                type="button"
                className="chat-modal-secondary"
                onClick={() =>
                  setShowBlockConfirm(
                    false
                  )
                }
                disabled={
                  blockLoading
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="chat-modal-danger"
                onClick={
                  handleBlock
                }
                disabled={
                  blockLoading
                }
              >
                {blockLoading ? (
                  <>
                    <LoaderCircle
                      size={16}
                      className="messages-spinner"
                    />

                    Blocking...
                  </>
                ) : (
                  <>
                    <ShieldBan
                      size={16}
                    />

                    Block user
                  </>
                )}
              </button>

            </div>

          </div>

        </div>
      )}


      {/* =====================================================
          REPORT MODAL
      ====================================================== */}

      {showReportModal && (

        <div
          className="chat-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setShowReportModal(
                false
              );
            }
          }}
        >

          <div className="chat-modal">

            <button
              type="button"
              className="chat-modal-close"
              onClick={() =>
                setShowReportModal(
                  false
                )
              }
              aria-label="Close"
            >
              <X
                size={18}
              />
            </button>


            <div className="chat-modal-icon">
              <Flag
                size={23}
              />
            </div>


            <h2>
              Report{" "}
              {otherUser?.username}
            </h2>

            <p>
              Tell us what happened. Your
              report will be reviewed by the
              CoChat team.
            </p>


            <div className="report-reasons">

              {[
                "Harassment or bullying",
                "Spam",
                "Inappropriate content",
                "Threatening behavior",
                "Other",
              ].map(
                (reason) => (
                  <button
                    key={reason}
                    type="button"
                    className={`report-reason ${
                      reportReason ===
                      reason
                        ? "report-reason-active"
                        : ""
                    }`}
                    onClick={() =>
                      setReportReason(
                        reason
                      )
                    }
                  >
                    <span className="report-radio">
                      {reportReason ===
                        reason && (
                        <span />
                      )}
                    </span>

                    {reason}
                  </button>
                )
              )}

            </div>


            <div className="chat-modal-actions">

              <button
                type="button"
                className="chat-modal-secondary"
                onClick={() =>
                  setShowReportModal(
                    false
                  )
                }
                disabled={
                  reportLoading
                }
              >
                Cancel
              </button>


              <button
                type="button"
                className="chat-modal-primary"
                onClick={
                  handleReport
                }
                disabled={
                  !reportReason ||
                  reportLoading
                }
              >
                {reportLoading ? (
                  <>
                    <LoaderCircle
                      size={16}
                      className="messages-spinner"
                    />

                    Sending...
                  </>
                ) : (
                  <>
                    <Flag
                      size={16}
                    />

                    Submit report
                  </>
                )}
              </button>

            </div>

          </div>

        </div>
      )}


      <style>
        {`
          @keyframes messages-typing-dot {
            0%, 60%, 100% {
              opacity: 0.35;
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


export default Messages;