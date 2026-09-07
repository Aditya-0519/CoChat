import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Send,
  UsersRound,
  LoaderCircle,
  UserRound,
  ChevronRight,
  MoreVertical,
} from "lucide-react";

import AppShell from "../components/AppShell";
import { useAuth } from "../context/useAuth";
import { getGroup } from "../services/groupService";
import { getMessages, sendMessage } from "../services/messageService";
import { socket } from "../services/socket";

const getId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value._id) return value._id.toString();
  if (value.id) return value.id.toString();
  return value.toString();
};

function GroupChat() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [group, setGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const currentUserId = useMemo(() => getId(user), [user]);

  const loadGroup = useCallback(async () => {
    try {
      const response = await getGroup(groupId);

      if (!response?.success) {
        throw new Error(response?.message || "Unable to load group.");
      }

      setGroup(response.group);
    } catch (err) {
      console.error("Load group error:", err);
      setError(err.message || "Unable to load group.");
    }
  }, [groupId]);

  const loadMessages = useCallback(async () => {
    try {
      const response = await getMessages(groupId);

      if (!response?.success) {
        throw new Error(response?.message || "Unable to load messages.");
      }

      setMessages(response.messages || []);
    } catch (err) {
      console.error("Load group messages error:", err);
      setError(err.message || "Unable to load messages.");
    }
  }, [groupId]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        await Promise.all([loadGroup(), loadMessages()]);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [loadGroup, loadMessages]);

  useEffect(() => {
    if (!groupId) return;

    if (!socket.connected) {
      socket.connect();
    }

    socket.emit("join-conversation", groupId);

    const handleNewMessage = (message) => {
      if (getId(message?.conversation) !== groupId) return;

      setMessages((previous) => {
        const exists = previous.some(
          (item) => getId(item?._id) === getId(message?._id)
        );

        if (exists) return previous;

        return [...previous, message];
      });
    };

    const handleGroupUpdated = (updatedGroup) => {
      if (getId(updatedGroup?._id) !== groupId) return;

      setGroup(updatedGroup);
    };

    socket.on("new-message", handleNewMessage);
    socket.on("group-updated", handleGroupUpdated);

    return () => {
      socket.off("new-message", handleNewMessage);
      socket.off("group-updated", handleGroupUpdated);
    };
  }, [groupId]);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }, 20);

    return () => clearTimeout(timer);
  }, [messages]);

  const handleSend = async (event) => {
    event.preventDefault();

    const trimmedText = text.trim();

    if (!trimmedText || sending) return;

    try {
      setSending(true);
      setError("");

      const response = await sendMessage(groupId, trimmedText);

      if (!response?.success) {
        throw new Error(response?.message || "Unable to send message.");
      }

      setText("");

      if (response.message) {
        setMessages((previous) => {
          const exists = previous.some(
            (item) => getId(item?._id) === getId(response.message?._id)
          );

          if (exists) return previous;

          return [...previous, response.message];
        });
      }
    } catch (err) {
      console.error("Send group message error:", err);
      setError(err.message || "Unable to send message.");
    } finally {
      setSending(false);
    }
  };

  const memberCount = group?.participants?.length || 0;

  const groupMembers = Array.isArray(group?.participants)
    ? group.participants
    : [];

  const visibleMembers = groupMembers.filter(Boolean).slice(0, 5);

  const groupSubtitle = group?.description?.trim()
    ? group.description.trim()
    : `${memberCount} ${memberCount === 1 ? "member" : "members"} in this space`;

  if (loading) {
    return (
      <AppShell>
        <div className="group-chat-page">
          <div className="group-chat-loading">
            <LoaderCircle size={28} className="spin" />
            <span>Loading group...</span>
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
            <p>{error || "This group may no longer exist."}</p>

            <button
              type="button"
              className="group-primary-button"
              onClick={() => navigate("/groups")}
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
        <section className="group-chat-card" aria-label={`${group.name} group chat`}>
          <header className="group-chat-header">
            <div className="group-chat-header-left">
              <button
                type="button"
                className="group-back-button"
                onClick={() => navigate("/groups")}
                title="Back to groups"
                aria-label="Back to groups"
              >
                <ArrowLeft size={19} strokeWidth={2.2} />
              </button>

              <div className="group-chat-identity">
                <div className="group-chat-avatar">
                  <UsersRound size={23} strokeWidth={1.9} />
                </div>

                <div className="group-chat-title">
                  <div className="group-chat-title-line">
                    <h1 title={group.name}>{group.name}</h1>
                    <span className="group-chat-live-dot" aria-label="Active group" />
                  </div>

                  <button
                    type="button"
                    className="group-chat-member-trigger"
                    onClick={() => navigate("/groups")}
                  >
                    <span>{memberCount} {memberCount === 1 ? "member" : "members"}</span>
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            </div>

            <div className="group-chat-header-actions">
              <div className="group-chat-member-stack" aria-label="Group members">
                {visibleMembers.map((member, index) => {
                  const avatar = member?.avatar || "";
                  const username = member?.username || "Member";

                  return (
                    <div
                      className="group-chat-member-avatar"
                      key={getId(member) || `${username}-${index}`}
                      title={`@${username}`}
                    >
                      {avatar ? (
                        <img src={avatar} alt="" />
                      ) : (
                        <UserRound size={14} />
                      )}
                    </div>
                  );
                })}

                {memberCount > visibleMembers.length && (
                  <span className="group-chat-member-more">
                    +{memberCount - visibleMembers.length}
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
                onClick={() => navigate("/groups")}
                title="Group options"
                aria-label="Group options"
              >
                <MoreVertical size={19} />
              </button>
            </div>
          </header>

          <div className="group-chat-subheader">
            <span className="group-chat-subheader-dot" />
            <p title={groupSubtitle}>{groupSubtitle}</p>
          </div>

          {error && (
            <div className="group-chat-inline-error" role="alert">
              <span>{error}</span>
              <button type="button" onClick={() => setError("")}>
                Dismiss
              </button>
            </div>
          )}

          <div className="group-chat-messages" role="log" aria-live="polite">
            {messages.length === 0 ? (
              <div className="group-chat-empty">
                <div className="group-chat-empty-orbit">
                  <div className="group-chat-empty-icon">
                    <UsersRound size={27} strokeWidth={1.8} />
                  </div>
                </div>

                <span className="group-chat-empty-kicker">WELCOME TO THE SPACE</span>
                <h2>Start the conversation</h2>
                <p>
                  This is the beginning of <strong>{group.name}</strong>.
                  Say hello and get things moving.
                </p>
              </div>
            ) : (
              <>
                <div className="group-chat-day-label">
                  <span>Today</span>
                </div>

                <div className="group-chat-message-list">
                  {messages.map((message) => {
                    const senderId = getId(message?.sender);
                    const isOwnMessage = senderId === currentUserId;

                    const senderName =
                      message?.sender?.username ||
                      (isOwnMessage ? user?.username : "Member");

                    const senderAvatar = message?.sender?.avatar || "";

                    const createdAt = message?.createdAt
                      ? new Date(message.createdAt)
                      : null;

                    const time =
                      createdAt && !Number.isNaN(createdAt.getTime())
                        ? createdAt.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "";

                    return (
                      <div
                        key={getId(message?._id)}
                        className={`group-message-row ${
                          isOwnMessage ? "group-message-row-own" : ""
                        }`}
                      >
                        {!isOwnMessage && (
                          <div className="group-message-avatar">
                            {senderAvatar ? (
                              <img src={senderAvatar} alt="" />
                            ) : (
                              <UserRound size={15} />
                            )}
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
                                <span className="group-message-check" aria-label="Sent">
                                  ✓
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          <form className="group-chat-composer" onSubmit={handleSend}>
            <div className="group-chat-input-wrap">
              <input
                type="text"
                value={text}
                onChange={(event) => setText(event.target.value)}
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
              disabled={!text.trim() || sending}
              title="Send message"
              aria-label="Send message"
            >
              {sending ? (
                <LoaderCircle size={19} className="spin" />
              ) : (
                <Send size={19} />
              )}
            </button>
          </form>
        </section>
      </main>
    </AppShell>
  );
}

export default GroupChat;