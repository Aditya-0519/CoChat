
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
  Link,
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

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return parsedDate.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}


function formatConversationTime(date) {
  if (!date) {
    return "";
  }

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  const now = new Date();

  if (
    parsedDate.toDateString() ===
    now.toDateString()
  ) {
    return parsedDate.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (
    parsedDate.toDateString() ===
    yesterday.toDateString()
  ) {
    return "Yesterday";
  }

  return parsedDate.toLocaleDateString([], {
    day: "numeric",
    month: "short",
  });
}


function getOtherParticipant(
  conversation,
  currentUser
) {
  if (!conversation?.participants?.length) {
    return null;
  }

  const currentId = getId(currentUser);

  return (
    conversation.participants.find(
      (participant) =>
        getId(participant) !== currentId
    ) ||
    conversation.participants[0]
  );
}


function mergeMessages(existing, incoming) {
  const map = new Map();

  for (const message of existing || []) {
    const id = getId(message);

    if (id) {
      map.set(id, message);
    }
  }

  for (const message of incoming || []) {
    const id = getId(message);

    if (id) {
      map.set(id, {
        ...map.get(id),
        ...message,
      });
    }
  }

  return Array.from(map.values()).sort(
    (a, b) =>
      new Date(a.createdAt || 0).getTime() -
      new Date(b.createdAt || 0).getTime()
  );
}


function getReceiptForUser(message, userId) {
  if (!message?.receipts?.length || !userId) {
    return null;
  }

  return (
    message.receipts.find(
      (receipt) =>
        getId(receipt.user) === userId
    ) || null
  );
}


function getOwnMessageStatus(
  message,
  currentUserId
) {
  if (!message || !currentUserId) {
    return "sent";
  }

  const receipts = message.receipts || [];

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
      (receipt) => receipt.deliveredAt
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
        alt={user.username || "User"}
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
  const status = getOwnMessageStatus(
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

  if (status === "delivered") {
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
   MESSAGES PAGE
========================================================= */

function Messages() {
  const { conversationId } = useParams();
  const navigate = useNavigate();


  /* =======================================================
     STATE
  ======================================================= */

  const [currentUser, setCurrentUser] =
    useState(null);

  const [conversations, setConversations] =
    useState([]);

  const [conversation, setConversation] =
    useState(null);

  const [messages, setMessages] =
    useState([]);

  const [text, setText] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [loadingOlder, setLoadingOlder] =
    useState(false);

  const [hasMoreMessages, setHasMoreMessages] =
    useState(false);

  const [nextCursor, setNextCursor] =
    useState(null);

  const [sending, setSending] =
    useState(false);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [showChatMenu, setShowChatMenu] =
    useState(false);

  const [muted, setMuted] =
    useState(false);

  const [muteLoading, setMuteLoading] =
    useState(false);

  const [blocked, setBlocked] =
    useState(false);

  const [blockLoading, setBlockLoading] =
    useState(false);

  const [showBlockConfirm, setShowBlockConfirm] =
    useState(false);

  const [showReportModal, setShowReportModal] =
    useState(false);

  const [reportReason, setReportReason] =
    useState("");

  const [reportLoading, setReportLoading] =
    useState(false);

  const [searchMessages, setSearchMessages] =
    useState(false);

  const [messageSearch, setMessageSearch] =
    useState("");

  const [typingUsers, setTypingUsers] =
    useState(new Set());

  const [readState, setReadState] =
    useState(null);

  const [totalUnread, setTotalUnread] =
    useState(0);


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

  const currentConversationRef =
    useRef(conversationId);

  const currentUserRef =
    useRef(currentUser);


  useEffect(() => {
    currentConversationRef.current =
      conversationId;
  }, [conversationId]);


  useEffect(() => {
    currentUserRef.current =
      currentUser;
  }, [currentUser]);


  /* =======================================================
     LOAD USER + CONVERSATIONS
  ======================================================= */

  const loadConversationList =
    useCallback(async () => {
      try {
        const data =
          await getConversations();

        setConversations(
          data?.conversations || []
        );

        setTotalUnread(
          Number(data?.totalUnread || 0)
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
    }, []);


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
            userData?.user || null;

          setCurrentUser(user);

          setConversations(
            conversationData?.conversations || []
          );

          setTotalUnread(
            Number(
              conversationData?.totalUnread || 0
            )
          );
        } catch (loadError) {
          if (!mounted) {
            return;
          }

          setError(
            loadError.message ||
              "Unable to load conversations."
          );
        }
      };

    loadInitialData();

    return () => {
      mounted = false;
    };
  }, []);


  /* =======================================================
     LOAD SELECTED CONVERSATION
  ======================================================= */

  useEffect(() => {
    let mounted = true;

    const loadSelectedConversation =
      async () => {
        if (!conversationId) {
          setConversation(null);
          setMessages([]);
          setReadState(null);
          setHasMoreMessages(false);
          setNextCursor(null);
          setLoading(false);
          return;
        }

        try {
          setLoading(true);
          setError("");
          initialScrollRef.current = true;

          const [
            conversationData,
            messageData,
            stateData,
          ] = await Promise.all([
            getConversation(
              conversationId
            ),
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

          setConversation(
            conversationData?.conversation ||
              null
          );

          setMessages(
            messageData?.messages || []
          );

          setHasMoreMessages(
            Boolean(
              messageData?.pagination?.hasMore
            )
          );

          setNextCursor(
            messageData?.pagination?.nextCursor ||
              null
          );

          setReadState(
            stateData?.state || null
          );
        } catch (loadError) {
          if (!mounted) {
            return;
          }

          setError(
            loadError.message ||
              "Unable to load conversation."
          );

          setConversation(null);
          setMessages([]);
          setReadState(null);
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
  }, [conversationId]);


  /* =======================================================
     LOAD MUTE + BLOCK STATE
  ======================================================= */

  useEffect(() => {
    if (
      !conversationId ||
      !conversation
    ) {
      return;
    }

    let mounted = true;

    const loadSettings =
      async () => {
        try {
          const otherParticipant =
            getOtherParticipant(
              conversation,
              currentUser
            );

          const otherUserId =
            getId(otherParticipant);

          if (!otherUserId) {
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
              otherUserId
            ),
          ]);

          if (!mounted) {
            return;
          }

          setMuted(
            Boolean(
              settingsData?.muted ??
              settingsData?.settings?.muted
            )
          );

          setBlocked(
            Boolean(
              blockData?.blocked ??
              blockData?.isBlocked
            )
          );
        } catch (loadError) {
          console.error(
            "Load chat settings error:",
            loadError
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
     MARK INCOMING MESSAGES DELIVERED
  ======================================================= */

  useEffect(() => {
    if (
      !conversationId ||
      !currentUser
    ) {
      return;
    }

    const currentUserId =
      getId(currentUser);

    const incomingMessages =
      messages.filter(
        (message) =>
          getId(message.sender) !==
            currentUserId &&
          !getReceiptForUser(
            message,
            currentUserId
          )?.deliveredAt
      );

    if (!incomingMessages.length) {
      return;
    }

    let cancelled = false;

    const markDelivered =
      async () => {
        for (const message of incomingMessages) {
          if (cancelled) {
            return;
          }

          const messageId =
            getId(message);

          if (!messageId) {
            continue;
          }

          try {
            await markMessageDelivered(
              conversationId,
              messageId
            );

            if (cancelled) {
              return;
            }

            setMessages((previous) =>
              previous.map((item) => {
                if (
                  getId(item) !==
                  messageId
                ) {
                  return item;
                }

                const receipts = [
                  ...(item.receipts || []),
                ];

                const existingIndex =
                  receipts.findIndex(
                    (receipt) =>
                      getId(
                        receipt.user
                      ) === currentUserId
                  );

                if (
                  existingIndex >= 0
                ) {
                  receipts[
                    existingIndex
                  ] = {
                    ...receipts[
                      existingIndex
                    ],
                    deliveredAt:
                      new Date().toISOString(),
                  };
                } else {
                  receipts.push({
                    user: currentUserId,
                    deliveredAt:
                      new Date().toISOString(),
                    readAt: null,
                  });
                }

                return {
                  ...item,
                  receipts,
                };
              })
            );
          } catch (deliveryError) {
            console.debug(
              "Delivery state update skipped:",
              deliveryError
            );
          }
        }
      };

    markDelivered();

    return () => {
      cancelled = true;
    };
  }, [
    conversationId,
    currentUser,
    messages,
  ]);


  /* =======================================================
     MARK CONVERSATION READ
  ======================================================= */

  const markVisibleMessagesRead =
    useCallback(async () => {
      if (
        !conversationId ||
        !currentUser ||
        !messages.length
      ) {
        return;
      }

      const currentUserId =
        getId(currentUser);

      const incoming =
        messages.filter(
          (message) =>
            getId(message.sender) !==
            currentUserId
        );

      if (!incoming.length) {
        return;
      }

      const lastMessage =
        incoming[incoming.length - 1];

      const lastMessageId =
        getId(lastMessage);

      if (!lastMessageId) {
        return;
      }

      try {
        const result =
          await markConversationRead(
            conversationId,
            lastMessageId
          );

        if (result?.state) {
          setReadState(
            result.state
          );
        }

        setConversations((previous) =>
          previous.map((item) =>
            getId(item) ===
            conversationId
              ? {
                  ...item,
                  unreadCount: 0,
                }
              : item
          )
        );

        setTotalUnread((value) =>
          Math.max(
            0,
            value -
              Number(
                conversations.find(
                  (item) =>
                    getId(item) ===
                    conversationId
                )?.unreadCount || 0
              )
          )
        );
      } catch (readError) {
        console.debug(
          "Read state update skipped:",
          readError
        );
      }
    }, [
      conversationId,
      currentUser,
      messages,
      conversations,
    ]);


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
      setTimeout(() => {
        markVisibleMessagesRead();
      }, 250);

    return () => {
      clearTimeout(timer);
    };
  }, [
    loading,
    blocked,
    conversationId,
    messages,
    markVisibleMessagesRead,
  ]);


  /* =======================================================
     SOCKET REALTIME
  ======================================================= */

  useEffect(() => {
    if (!conversationId) {
      return;
    }

    const currentUserId =
      getId(currentUser);

    const handleNewMessage =
      (message) => {
        if (!message) {
          return;
        }

        const incomingConversationId =
          getId(message.conversation);

        if (
          incomingConversationId &&
          incomingConversationId !==
            conversationId
        ) {
          return;
        }

        const senderId =
          getId(message.sender);

        const mine =
          senderId === currentUserId;

        setMessages((previous) =>
          mergeMessages(
            previous,
            [message]
          )
        );

        setConversations((previous) => {
          const existing =
            previous.find(
              (item) =>
                getId(item) ===
                conversationId
            );

          if (!existing) {
            return previous;
          }

          const unreadCount =
            mine
              ? Number(
                  existing.unreadCount || 0
                )
              : 0;

          return [
            {
              ...existing,
              lastMessage: message,
              updatedAt:
                message.createdAt ||
                new Date().toISOString(),
              unreadCount,
            },
            ...previous.filter(
              (item) =>
                getId(item) !==
                conversationId
            ),
          ];
        });

        if (!mine) {
          if (
            !muted &&
            document.hidden &&
            "Notification" in window &&
            Notification.permission ===
              "granted"
          ) {
            const senderName =
              message.sender?.username ||
              "New message";

            new Notification(
              `Message from ${senderName}`,
              {
                body:
                  message.text ||
                  "You received a new message.",
                icon:
                  message.sender?.avatar ||
                  undefined,
              }
            );
          }

          /*
           * We are currently inside the conversation,
           * so immediately acknowledge the message.
           */
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
            payload?.conversation ||
              payload
          );

        if (
          updatedId &&
          updatedId !== conversationId
        ) {
          return;
        }

        loadConversationList().catch(
          () => {}
        );
      };


    const handleMessageDelivered =
      (payload) => {
        const messageId =
          getId(payload?.message);

        const userId =
          getId(payload?.user);

        if (!messageId || !userId) {
          return;
        }

        setMessages((previous) =>
          previous.map((message) => {
            if (
              getId(message) !==
              messageId
            ) {
              return message;
            }

            const receipts = [
              ...(message.receipts || []),
            ];

            const index =
              receipts.findIndex(
                (receipt) =>
                  getId(receipt.user) ===
                  userId
              );

            const receipt = {
              user: userId,
              deliveredAt:
                payload.deliveredAt ||
                new Date().toISOString(),
              readAt:
                index >= 0
                  ? receipts[index]?.readAt ||
                    null
                  : null,
            };

            if (index >= 0) {
              receipts[index] = {
                ...receipts[index],
                ...receipt,
              };
            } else {
              receipts.push(receipt);
            }

            return {
              ...message,
              receipts,
            };
          })
        );
      };


    const handleMessageRead =
      (payload) => {
        const messageId =
          getId(payload?.message);

        const userId =
          getId(payload?.user);

        if (!messageId || !userId) {
          return;
        }

        setMessages((previous) =>
          previous.map((message) => {
            if (
              getId(message) !==
              messageId
            ) {
              return message;
            }

            const receipts = [
              ...(message.receipts || []),
            ];

            const index =
              receipts.findIndex(
                (receipt) =>
                  getId(receipt.user) ===
                  userId
              );

            if (index >= 0) {
              receipts[index] = {
                ...receipts[index],
                deliveredAt:
                  receipts[index]
                    .deliveredAt ||
                  payload.readAt ||
                  new Date().toISOString(),
                readAt:
                  payload.readAt ||
                  new Date().toISOString(),
              };
            } else {
              receipts.push({
                user: userId,
                deliveredAt:
                  payload.readAt ||
                  new Date().toISOString(),
                readAt:
                  payload.readAt ||
                  new Date().toISOString(),
              });
            }

            return {
              ...message,
              receipts,
            };
          })
        );
      };


    const handleConversationRead =
      (payload) => {
        const readConversationId =
          getId(
            payload?.conversation
          );

        if (
          readConversationId &&
          readConversationId !==
            conversationId
        ) {
          return;
        }

        setConversations((previous) =>
          previous.map((item) =>
            getId(item) ===
            conversationId
              ? {
                  ...item,
                  unreadCount: 0,
                }
              : item
          )
        );
      };


    const handleTyping =
      (payload) => {
        if (
          getId(
            payload?.conversation
          ) !== conversationId
        ) {
          return;
        }

        const userId =
          getId(payload?.user);

        if (
          !userId ||
          userId === currentUserId
        ) {
          return;
        }

        setTypingUsers((previous) => {
          const next =
            new Set(previous);

          if (payload.typing) {
            next.add(userId);
          } else {
            next.delete(userId);
          }

          return next;
        });
      };


    const handleConnect =
      async () => {
        socket.emit(
          "join-conversation",
          conversationId
        );

        /*
         * Socket.IO recovery is helpful, but REST remains
         * authoritative after reconnects.
         */
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
            messageData?.messages || []
          );

          setHasMoreMessages(
            Boolean(
              messageData?.pagination?.hasMore
            )
          );

          setNextCursor(
            messageData?.pagination?.nextCursor ||
              null
          );

          setReadState(
            stateData?.state || null
          );

          await loadConversationList();
        } catch (syncError) {
          console.debug(
            "Reconnect synchronization skipped:",
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
      handleMessageDelivered
    );

    socket.on(
      "message:read",
      handleMessageRead
    );

    socket.on(
      "conversation:read",
      handleConversationRead
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
      socket.emit(
        "leave-conversation",
        conversationId
      );

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
        handleMessageDelivered
      );

      socket.off(
        "message:read",
        handleMessageRead
      );

      socket.off(
        "conversation:read",
        handleConversationRead
      );

      socket.off(
        "conversation:typing",
        handleTyping
      );

      setTypingUsers(new Set());
    };
  }, [
    conversationId,
    currentUser,
    muted,
    loadConversationList,
  ]);


  /* =======================================================
     LOAD OLDER MESSAGES
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

      const previousHeight =
        container?.scrollHeight || 0;

      const previousTop =
        container?.scrollTop || 0;

      try {
        setLoadingOlder(true);

        const response =
          await getMessages(
            conversationId,
            {
              limit: 30,
              before: nextCursor,
            }
          );

        const olderMessages =
          response?.messages || [];

        setMessages((previous) =>
          mergeMessages(
            olderMessages,
            previous
          )
        );

        setHasMoreMessages(
          Boolean(
            response?.pagination?.hasMore
          )
        );

        setNextCursor(
          response?.pagination?.nextCursor ||
            null
        );

        requestAnimationFrame(() => {
          if (!container) {
            return;
          }

          const newHeight =
            container.scrollHeight;

          container.scrollTop =
            newHeight -
            previousHeight +
            previousTop;
        });
      } catch (loadError) {
        setError(
          loadError.message ||
            "Unable to load older messages."
        );
      } finally {
        setLoadingOlder(false);
      }
    };


  /* =======================================================
     CLOSE MENU OUTSIDE
  ======================================================= */

  useEffect(() => {
    const handleOutsideClick =
      (event) => {
        if (
          chatMenuRef.current &&
          !chatMenuRef.current.contains(
            event.target
          )
        ) {
          setShowChatMenu(false);
        }
      };

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, []);


  /* =======================================================
     SCROLL
  ======================================================= */

  useEffect(() => {
    if (initialScrollRef.current) {
      messagesEndRef.current?.scrollIntoView({
        behavior: "auto",
      });

      initialScrollRef.current = false;
      return;
    }

    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages.length]);


  /* =======================================================
     FOCUS INPUT
  ======================================================= */

  useEffect(() => {
    if (
      !loading &&
      !blocked
    ) {
      const timer =
        setTimeout(() => {
          inputRef.current?.focus();
        }, 0);

      return () => {
        clearTimeout(timer);
      };
    }
  }, [
    loading,
    conversationId,
    blocked,
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
     TYPING LABEL
  ======================================================= */

  const isOtherTyping =
    typingUsers.size > 0;


  /* =======================================================
     OWN MESSAGE
  ======================================================= */

  const isOwnMessage =
    (message) =>
      getId(message?.sender) ===
      getId(currentUser);


  /* =======================================================
     FILTER CONVERSATIONS
  ======================================================= */

  const filteredConversations =
    conversations.filter(
      (item) => {
        const participant =
          getOtherParticipant(
            item,
            currentUser
          );

        const username =
          participant?.username || "";

        return username
          .toLowerCase()
          .includes(
            search
              .toLowerCase()
              .trim()
          );
      }
    );


  /* =======================================================
     FILTER MESSAGES
  ======================================================= */

  const visibleMessages =
    messages.filter(
      (message) => {
        if (
          !searchMessages ||
          !messageSearch.trim()
        ) {
          return true;
        }

        return (
          message.text
            ?.toLowerCase()
            .includes(
              messageSearch
                .toLowerCase()
                .trim()
            )
        );
      }
    );


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

        const nextMuted =
          !muted;

        await setConversationMuted(
          conversationId,
          nextMuted
        );

        setMuted(nextMuted);
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
        !otherUser
      ) {
        return;
      }

      try {
        setBlockLoading(true);
        setError("");

        await blockUser(
          otherUserId
        );

        setBlocked(true);
        setShowBlockConfirm(false);
        setShowChatMenu(false);
      } catch (blockError) {
        setError(
          blockError.message ||
            "Unable to block this user."
        );
      } finally {
        setBlockLoading(false);
      }
    };


  /* =======================================================
     UNBLOCK
  ======================================================= */

  const handleUnblock =
    async () => {
      if (
        blockLoading ||
        !otherUser
      ) {
        return;
      }

      try {
        setBlockLoading(true);
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
        setBlockLoading(false);
      }
    };


  /* =======================================================
     REPORT
  ======================================================= */

  const handleReport =
    async () => {
      if (
        reportLoading ||
        !otherUser ||
        !reportReason
      ) {
        return;
      }

      try {
        setReportLoading(true);
        setError("");

        await reportUser(
          otherUserId,
          reportReason
        );

        setShowReportModal(false);
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
        setReportLoading(false);
      }
    };


  /* =======================================================
     TYPING EMISSION
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
      const nextText =
        event.target.value;

      setText(nextText);

      if (!nextText.trim()) {
        emitTyping(false);

        if (typingTimeoutRef.current) {
          clearTimeout(
            typingTimeoutRef.current
          );
        }

        return;
      }

      emitTyping(true);

      if (typingTimeoutRef.current) {
        clearTimeout(
          typingTimeoutRef.current
        );
      }

      typingTimeoutRef.current =
        setTimeout(() => {
          emitTyping(false);
        }, 1500);
    };


  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
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
  }, [conversationId]);


  /* =======================================================
     SEND
  ======================================================= */

  const handleSendMessage =
    async (event) => {
      event.preventDefault();

      const trimmedText =
        text.trim();

      if (
        !trimmedText ||
        sending ||
        !conversationId ||
        blocked
      ) {
        return;
      }

      try {
        setSending(true);
        setError("");

        const response =
          await sendMessage(
            conversationId,
            trimmedText
          );

        /*
         * The socket normally delivers the message.
         * If the socket is temporarily disconnected,
         * use the REST response as the local fallback.
         */
        const sentMessage =
          response?.message;

        if (sentMessage) {
          setMessages((previous) =>
            mergeMessages(
              previous,
              [sentMessage]
            )
          );
        }

        setText("");
        emitTyping(false);

        if (typingTimeoutRef.current) {
          clearTimeout(
            typingTimeoutRef.current
          );
        }

        setTimeout(() => {
          inputRef.current?.focus();
        }, 0);
      } catch (sendError) {
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


  const handleViewProfile =
    () => {
      if (!otherUser?.username) {
        return;
      }

      setShowChatMenu(false);

      navigate(
        `/profile/${otherUser.username}`
      );
    };


  const handleToggleMessageSearch =
    () => {
      setSearchMessages(
        (current) => !current
      );

      setMessageSearch("");
      setShowChatMenu(false);
    };


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

  return (
    <AppShell>

      <div className="messages-page">

        {/* =================================================
            SIDEBAR
        ================================================== */}

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
              <MessageCircle size={19} />

              {totalUnread > 0 && (
                <span
                  style={{
                    position: "absolute",
                    marginTop: "-30px",
                    marginLeft: "30px",
                    minWidth: 18,
                    height: 18,
                    padding: "0 5px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 999,
                    background: "#6366f1",
                    color: "#fff",
                    fontSize: 9,
                    fontWeight: 800,
                  }}
                >
                  {totalUnread > 99
                    ? "99+"
                    : totalUnread}
                </span>
              )}
            </div>

          </div>


          <div className="messages-search">

            <Search size={17} />

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

                <MessageCircle size={21} />

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

                  const active =
                    getId(item) ===
                    conversationId;

                  const unreadCount =
                    Number(
                      item.unreadCount || 0
                    );

                  return (
                    <button
                      key={getId(item)}
                      type="button"
                      className={`conversation-item ${
                        active
                          ? "conversation-item-active"
                          : ""
                      }`}
                      onClick={() =>
                        openConversation(
                          getId(item)
                        )
                      }
                    >

                      <div
                        style={{
                          position: "relative",
                          flexShrink: 0,
                        }}
                      >
                        <Avatar
                          user={participant}
                          size="medium"
                        />

                        <div
                          style={{
                            position: "absolute",
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
                            {participant?.username ||
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
                                unreadCount > 0
                                  ? 700
                                  : undefined,
                              color:
                                unreadCount > 0
                                  ? "#4f46e5"
                                  : undefined,
                            }}
                          >
                            {item.lastMessage?.text ||
                              "Start a conversation"}
                          </span>

                        </div>

                      </div>


                      {unreadCount > 0 ? (
                        <span
                          style={{
                            minWidth: 20,
                            height: 20,
                            padding: "0 6px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: 999,
                            background:
                              active
                                ? "#818cf8"
                                : "#6366f1",
                            color: "#fff",
                            fontSize: 9,
                            fontWeight: 800,
                          }}
                        >
                          {unreadCount > 99
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
        ================================================== */}

        <section className="messages-chat">

          {!conversation ? (

            <div className="messages-no-conversation">

              <div className="messages-no-conversation-icon">
                <MessageCircle size={30} />
              </div>

              <h2>
                Your conversations
              </h2>

              <p>
                Select a conversation to
                start chatting.
              </p>

            </div>

          ) : (

            <>

              {/* ===========================================
                  HEADER
              ============================================ */}

              <header className="chat-header">

                <div className="chat-header-left">

                  <Link
                    to="/discover"
                    className="chat-mobile-back"
                  >
                    <ArrowLeft size={18} />
                  </Link>


                  <div
                    style={{
                      position: "relative",
                      flexShrink: 0,
                    }}
                  >
                    <Avatar
                      user={otherUser}
                      size="large"
                    />

                    <div
                      style={{
                        position: "absolute",
                        right: 1,
                        bottom: 1,
                      }}
                    >
                      <PresenceDot
                        userId={otherUserId}
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
                          userId={otherUserId}
                          size="small"
                        />
                      )}

                    </div>

                    <p>
                      {blocked
                        ? "Blocked"
                        : isOtherTyping
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
                    aria-expanded={showChatMenu}
                    onClick={() =>
                      setShowChatMenu(
                        (current) => !current
                      )
                    }
                  >
                    <MoreVertical size={19} />
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
                        <UserRound size={17} />

                        <span>
                          View profile
                        </span>
                      </button>


                      <button
                        type="button"
                        className="chat-option"
                        onClick={
                          handleToggleMessageSearch
                        }
                      >
                        <SearchCheck size={17} />

                        <span>
                          Search messages
                        </span>
                      </button>


                      <div className="chat-option-divider" />


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

                        {muteLoading ? (
                          <LoaderCircle
                            size={17}
                            className="messages-spinner"
                          />
                        ) : muted ? (
                          <Volume2 size={17} />
                        ) : (
                          <VolumeX size={17} />
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
                            setShowChatMenu(false);
                            setShowBlockConfirm(true);
                          }}
                          disabled={
                            blockLoading
                          }
                        >
                          <ShieldBan size={17} />

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
                            setShowChatMenu(false);
                            setShowReportModal(true);
                          }}
                        >
                          <Flag size={17} />

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
                  SEARCH
              ============================================ */}

              {searchMessages && (

                <div className="chat-message-search">

                  <Search size={17} />

                  <input
                    type="text"
                    autoFocus
                    placeholder="Search messages..."
                    value={messageSearch}
                    onChange={(event) =>
                      setMessageSearch(
                        event.target.value
                      )
                    }
                  />

                  <button
                    type="button"
                    onClick={() => {
                      setSearchMessages(false);
                      setMessageSearch("");
                    }}
                    aria-label="Close message search"
                  >
                    <X size={17} />
                  </button>

                </div>

              )}


              {/* ===========================================
                  MESSAGES
              ============================================ */}

              <div
                className="chat-messages"
                ref={messagesContainerRef}
              >

                {blocked ? (

                  <div className="chat-blocked-state">

                    <div className="chat-blocked-icon">
                      <ShieldBan size={26} />
                    </div>

                    <h3>
                      You blocked{" "}
                      {otherUser?.username}
                    </h3>

                    <p>
                      You won't receive messages
                      from this person.
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

                    {hasMoreMessages &&
                      !searchMessages && (
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "center",
                            marginBottom: 18,
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
                              border: "1px solid #e5e7eb",
                              borderRadius: 999,
                              padding: "7px 13px",
                              background: "#fff",
                              color: "#6366f1",
                              fontSize: 11,
                              fontWeight: 700,
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
                            {loadingOlder ? (
                              <>
                                <LoaderCircle
                                  size={12}
                                  className="messages-spinner"
                                  style={{
                                    marginRight: 5,
                                    verticalAlign:
                                      "middle",
                                  }}
                                />

                                Loading older messages...
                              </>
                            ) : (
                              "Load older messages"
                            )}
                          </button>
                        </div>
                      )}


                    {visibleMessages.length ===
                    0 ? (

                      messages.length === 0 ? (

                        <div className="chat-empty">

                          <div className="chat-empty-avatar">

                            <Avatar
                              user={otherUser}
                              size="large"
                            />

                          </div>

                          <h3>
                            Say hello to{" "}
                            {otherUser?.username}
                          </h3>

                          <p>
                            This is the beginning of
                            your private conversation.
                          </p>

                        </div>

                      ) : (

                        <div className="chat-search-empty">

                          <Search size={25} />

                          <h3>
                            No messages found
                          </h3>

                          <p>
                            Try a different search term.
                          </p>

                        </div>

                      )

                    ) : (

                      <>

                        <div className="chat-day-divider">
                          <span>
                            Today
                          </span>
                        </div>


                        {visibleMessages.map(
                          (message, index) => {
                            const mine =
                              isOwnMessage(
                                message
                              );

                            const messageKey =
                              getId(message) ||
                              `${message.createdAt}-${index}`;

                            return (
                              <div
                                key={messageKey}
                                className={`message-row ${
                                  mine
                                    ? "message-row-mine"
                                    : "message-row-theirs"
                                }`}
                              >

                                {!mine && (
                                  <Avatar
                                    user={otherUser}
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
                                        currentUserId={
                                          getId(
                                            currentUser
                                          )
                                        }
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


                    {isOtherTyping && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginTop: 2,
                          marginBottom: 12,
                        }}
                      >
                        <Avatar
                          user={otherUser}
                          size="small"
                        />

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "10px 13px",
                            borderRadius: 16,
                            background: "#f1f3f9",
                          }}
                        >
                          <span
                            style={{
                              width: 5,
                              height: 5,
                              borderRadius: "50%",
                              background: "#9ca3af",
                              animation:
                                "messages-typing-dot 1s infinite",
                            }}
                          />

                          <span
                            style={{
                              width: 5,
                              height: 5,
                              borderRadius: "50%",
                              background: "#9ca3af",
                              animation:
                                "messages-typing-dot 1s 0.15s infinite",
                            }}
                          />

                          <span
                            style={{
                              width: 5,
                              height: 5,
                              borderRadius: "50%",
                              background: "#9ca3af",
                              animation:
                                "messages-typing-dot 1s 0.3s infinite",
                            }}
                          />
                        </div>
                      </div>
                    )}

                  </>

                )}

                <div ref={messagesEndRef} />

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
                  <ShieldBan size={17} />

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
                    <Smile size={20} />
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
                    <Paperclip size={19} />
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
                      <Send size={18} />
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
              setShowBlockConfirm(false);
            }
          }}
        >

          <div className="chat-modal">

            <button
              type="button"
              className="chat-modal-close"
              onClick={() =>
                setShowBlockConfirm(false)
              }
              aria-label="Close"
            >
              <X size={18} />
            </button>


            <div className="chat-modal-icon chat-modal-icon-danger">
              <ShieldBan size={24} />
            </div>


            <h2>
              Block{" "}
              {otherUser?.username}?
            </h2>

            <p>
              They won't be able to send you
              messages while blocked. You can
              unblock them later.
            </p>


            <div className="chat-modal-actions">

              <button
                type="button"
                className="chat-modal-secondary"
                onClick={() =>
                  setShowBlockConfirm(false)
                }
                disabled={blockLoading}
              >
                Cancel
              </button>

              <button
                type="button"
                className="chat-modal-danger"
                onClick={
                  handleBlock
                }
                disabled={blockLoading}
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
                    <ShieldBan size={16} />

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
              setShowReportModal(false);
            }
          }}
        >

          <div className="chat-modal">

            <button
              type="button"
              className="chat-modal-close"
              onClick={() =>
                setShowReportModal(false)
              }
              aria-label="Close"
            >
              <X size={18} />
            </button>


            <div className="chat-modal-icon">
              <Flag size={23} />
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
                      reportReason === reason
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
                  setShowReportModal(false)
                }
                disabled={reportLoading}
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
                    <Flag size={16} />

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

