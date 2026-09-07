import { useEffect, useMemo, useRef, useState } from "react";

import {
  ArrowLeft,
  Check,
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

import {
  getConversations,
  getConversation,
} from "../services/conversationService";

import {
  getMessages,
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

  const messageDate = new Date(date);

  if (Number.isNaN(messageDate.getTime())) {
    return "";
  }

  const now = new Date();

  const sameDay =
    messageDate.toDateString() ===
    now.toDateString();

  if (sameDay) {
    return messageDate.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const yesterday = new Date();

  yesterday.setDate(
    yesterday.getDate() - 1
  );

  if (
    messageDate.toDateString() ===
    yesterday.toDateString()
  ) {
    return "Yesterday";
  }

  return messageDate.toLocaleDateString([], {
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
   MESSAGES PAGE
========================================================= */

function Messages() {
  const {
    conversationId,
  } = useParams();

  const navigate = useNavigate();


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
    sending,
    setSending,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  /* Conversation search */

  const [
    search,
    setSearch,
  ] = useState("");

  /* Three-dot menu */

  const [
    showChatMenu,
    setShowChatMenu,
  ] = useState(false);

  /* Mute */

  const [
    muted,
    setMuted,
  ] = useState(false);

  const [
    muteLoading,
    setMuteLoading,
  ] = useState(false);

  /* Block */

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

  /* Report */

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

  /* Message search */

  const [
    searchMessages,
    setSearchMessages,
  ] = useState(false);

  const [
    messageSearch,
    setMessageSearch,
  ] = useState("");


  /* =======================================================
     REFS
  ======================================================= */

  const messagesEndRef =
    useRef(null);

  const inputRef =
    useRef(null);

  const chatMenuRef =
    useRef(null);


  /* =======================================================
     LOAD CURRENT USER + CONVERSATIONS
  ======================================================= */

  useEffect(() => {
    let mounted = true;

    const loadConversationList =
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

          setCurrentUser(
            userData?.user || null
          );

          setConversations(
            conversationData?.conversations || []
          );
        } catch (error) {
          if (!mounted) {
            return;
          }

          setError(
            error.message ||
              "Unable to load conversations."
          );
        }
      };

    loadConversationList();

    return () => {
      mounted = false;
    };
  }, []);


  /* =======================================================
     LOAD SELECTED CONVERSATION + MESSAGES
  ======================================================= */

useEffect(() => {
  let mounted = true;

  const loadConversation =
    async () => {
      if (!conversationId) {
        if (!mounted) return;

        setConversation(null);
        setMessages([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const [
          conversationData,
          messageData,
        ] = await Promise.all([
          getConversation(
            conversationId
          ),
          getMessages(
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
      } catch (error) {
        if (!mounted) {
          return;
        }

        setError(
          error.message ||
            "Unable to load conversation."
        );

        setConversation(null);
        setMessages([]);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

  loadConversation();

  return () => {
    mounted = false;
  };
}, [conversationId]);


  /* =======================================================
     LOAD MUTE + BLOCK STATUS
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
        } catch (error) {
          console.error(
            "Load chat settings error:",
            error
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
     CLOSE THREE-DOT MENU WHEN CLICKING OUTSIDE
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
     SOCKET.IO REAL-TIME MESSAGING
  ======================================================= */

  useEffect(() => {
    if (!conversationId) {
      return;
    }

    const handleNewMessage =
      (message) => {
        if (!message) {
          return;
        }

        const messageConversationId =
          getId(
            message.conversation
          );

        if (
          messageConversationId &&
          messageConversationId !==
            conversationId
        ) {
          return;
        }

        const senderId =
          getId(message.sender);

        const currentUserId =
          getId(currentUser);

        const isMine =
          senderId &&
          currentUserId &&
          senderId === currentUserId;

        setMessages((previous) => {
          const messageId =
            getId(message);

          const alreadyExists =
            messageId &&
            previous.some(
              (item) =>
                getId(item) ===
                messageId
            );

          if (alreadyExists) {
            return previous;
          }

          return [
            ...previous,
            message,
          ];
        });


        /* ================================================
           BROWSER NOTIFICATION
        ================================================= */

        if (
          !isMine &&
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


        /* ================================================
           UPDATE CONVERSATION LIST
        ================================================= */

        setConversations(
          (previous) => {
            const existingConversation =
              previous.find(
                (item) =>
                  getId(item) ===
                  conversationId
              );

            if (!existingConversation) {
              return previous;
            }

            const updatedConversation = {
              ...existingConversation,

              lastMessage:
                message,

              updatedAt:
                message.createdAt ||
                new Date().toISOString(),
            };

            return [
              updatedConversation,

              ...previous.filter(
                (item) =>
                  getId(item) !==
                  conversationId
              ),
            ];
          }
        );
      };


    const handleConnect =
      () => {
        socket.emit(
          "join-conversation",
          conversationId
        );
      };


    socket.on(
      "connect",
      handleConnect
    );

    socket.on(
      "new-message",
      handleNewMessage
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
    };
  }, [
    conversationId,
    currentUser,
    muted,
  ]);


  /* =======================================================
     SCROLL TO BOTTOM
  ======================================================= */

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);


  /* =======================================================
     FOCUS MESSAGE INPUT
  ======================================================= */

  useEffect(() => {
    if (
      !loading &&
      !blocked
    ) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
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


  /* =======================================================
     OWN MESSAGE CHECK
  ======================================================= */

  const isOwnMessage =
    (message) => {
      const senderId =
        getId(
          message?.sender
        );

      const currentUserId =
        getId(
          currentUser
        );

      return (
        Boolean(senderId) &&
        Boolean(currentUserId) &&
        senderId === currentUserId
      );
    };


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
     MUTE / UNMUTE
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


        /* Request browser notification
           permission when enabling
           notifications. */

        if (
          !nextMuted &&
          "Notification" in window &&
          Notification.permission ===
            "default"
        ) {
          await Notification.requestPermission();
        }
      } catch (error) {
        console.error(
          "Mute conversation error:",
          error
        );

        setError(
          error.message ||
            "Unable to update notification settings."
        );
      } finally {
        setMuteLoading(false);
      }
    };


  /* =======================================================
     BLOCK USER
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

        const otherUserId =
          getId(otherUser);

        await blockUser(
          otherUserId
        );

        setBlocked(true);
        setShowBlockConfirm(false);
        setShowChatMenu(false);
      } catch (error) {
        console.error(
          "Block user error:",
          error
        );

        setError(
          error.message ||
            "Unable to block this user."
        );
      } finally {
        setBlockLoading(false);
      }
    };


  /* =======================================================
     UNBLOCK USER
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

        const otherUserId =
          getId(otherUser);

        await unblockUser(
          otherUserId
        );

        setBlocked(false);
        setShowChatMenu(false);
      } catch (error) {
        console.error(
          "Unblock user error:",
          error
        );

        setError(
          error.message ||
            "Unable to unblock this user."
        );
      } finally {
        setBlockLoading(false);
      }
    };


  /* =======================================================
     REPORT USER
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

        const otherUserId =
          getId(otherUser);

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
      } catch (error) {
        console.error(
          "Report user error:",
          error
        );

        setError(
          error.message ||
            "Unable to submit report."
        );
      } finally {
        setReportLoading(false);
      }
    };


  /* =======================================================
     SEND MESSAGE
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

        await sendMessage(
          conversationId,
          trimmedText
        );

        setText("");

        setTimeout(() => {
          inputRef.current?.focus();
        }, 0);
      } catch (error) {
        setError(
          error.message ||
            "Unable to send message."
        );
      } finally {
        setSending(false);
      }
    };


  /* =======================================================
     OPEN CONVERSATION
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


  /* =======================================================
     OPEN PROFILE
  ======================================================= */

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


  /* =======================================================
     MESSAGE SEARCH TOGGLE
  ======================================================= */

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
              <MessageCircle
                size={19}
              />
            </div>

          </div>


          {/* SEARCH CONVERSATIONS */}

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


          {/* CONVERSATIONS */}

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

                  const active =
                    getId(item) ===
                    conversationId;

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

                      <Avatar
                        user={participant}
                        size="medium"
                      />


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

                          <span className="conversation-preview">

                            {item.lastMessage?.text ||
                              "Start a conversation"}

                          </span>

                        </div>

                      </div>


                      {active && (
                        <span className="conversation-active-dot" />
                      )}

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

            </div>

          ) : (

            <>


              {/* ===========================================
                  CHAT HEADER
              ============================================ */}

              <header className="chat-header">

                <div className="chat-header-left">

                  <Link
                    to="/discover"
                    className="chat-mobile-back"
                  >
                    <ArrowLeft
                      size={18}
                    />
                  </Link>


                  <Avatar
                    user={otherUser}
                    size="large"
                  />


                  <div className="chat-user-info">

                    <div className="chat-user-name-row">

                      <h2>
                        {otherUser?.username ||
                          "User"}
                      </h2>

                      {!blocked && (
                        <span className="chat-online-dot" />
                      )}

                    </div>

                    <p>
                      {blocked
                        ? "Blocked"
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


                {/* =======================================
                    THREE DOT MENU
                ======================================== */}

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
                    <MoreVertical
                      size={19}
                    />
                  </button>


                  {showChatMenu && (

                    <div className="chat-options-menu">

                      {/* VIEW PROFILE */}

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


                      {/* SEARCH MESSAGES */}

                      <button
                        type="button"
                        className="chat-option"
                        onClick={
                          handleToggleMessageSearch
                        }
                      >
                        <SearchCheck
                          size={17}
                        />

                        <span>
                          Search messages
                        </span>
                      </button>


                      <div className="chat-option-divider" />


                      {/* MUTE */}

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


                      {/* BLOCK / UNBLOCK */}

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

                          <ShieldBan
                            size={17}
                          />

                          <span>
                            Block user
                          </span>

                        </button>

                      )}


                      {/* REPORT */}

                      {!blocked && (
                        <button
                          type="button"
                          className="chat-option chat-option-danger"
                          onClick={() => {
                            setShowChatMenu(false);
                            setShowReportModal(true);
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
                  MESSAGE SEARCH BAR
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
                    <X
                      size={17}
                    />
                  </button>

                </div>

              )}


              {/* ===========================================
                  MESSAGES
              ============================================ */}

              <div className="chat-messages">

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

                ) : visibleMessages.length ===
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

                      <Search
                        size={25}
                      />

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
                                  <Check
                                    size={13}
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

                <div
                  ref={messagesEndRef}
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
                  BLOCKED / COMPOSER
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
                    onChange={(event) =>
                      setText(
                        event.target.value
                      )
                    }
                    placeholder={
                      muted
                        ? "Type a message..."
                        : "Type a message..."
                    }
                    maxLength={2000}
                    disabled={
                      sending
                    }
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
          BLOCK CONFIRMATION MODAL
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

    </AppShell>
  );
}


export default Messages;