import { useEffect, useState } from "react";

import {
  ArrowLeft,
  GraduationCap,
  LoaderCircle,
  MapPin,
  MessageCircle,
  UserRoundCheck,
  UserPlus,
  UserRound,
  MoreHorizontal,
  ShieldBan,
  ShieldCheck,
  X,
  Send,
  Clock3,
} from "lucide-react";

import {
  blockUser,
  unblockUser,
  getBlockStatus,
} from "../services/blockService";

import {
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";

import AppShell from "../components/AppShell";

import {
  getPublicProfile,
} from "../services/userService";

import {
  createConversation,
  sendMessageRequest,
  getSentMessageRequests,
} from "../services/conversationService";

import {
  getConnectionStatus,
  sendConnectionRequest,
} from "../services/connectionService";

function PublicProfile() {
  const { username } = useParams();

  const navigate = useNavigate();

  const [user, setUser] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [message, setMessage] =
    useState("");

  const [
    startingConversation,
    setStartingConversation,
  ] = useState(false);

  const [
    conversationError,
    setConversationError,
  ] = useState("");

  const [
    showMenu,
    setShowMenu,
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
    blockError,
    setBlockError,
  ] = useState("");

  const [
    showBlockConfirm,
    setShowBlockConfirm,
  ] = useState(false);

  const [
    connection,
    setConnection,
  ] = useState({
    status: "none",
    direction: null,
    connectionId: null,
  });

  const [
    connectionLoading,
    setConnectionLoading,
  ] = useState(false);

  /*
    Existing message request sent to this user.

    null = no active request
    object = existing request
  */
  const [
    messageRequest,
    setMessageRequest,
  ] = useState(null);

  const [
    messageRequestLoading,
    setMessageRequestLoading,
  ] = useState(false);

  const [
    messageTargetOpen,
    setMessageTargetOpen,
  ] = useState(false);

  const [
    messageText,
    setMessageText,
  ] = useState("");

  const [
    messageSending,
    setMessageSending,
  ] = useState(false);

  const [
    messageRequestError,
    setMessageRequestError,
  ] = useState("");


  /*
    Load profile + relationship state.
  */
  useEffect(() => {
    const loadProfile =
      async () => {
        try {
          setLoading(true);
          setMessage("");

          const data =
            await getPublicProfile(
              username
            );

          const profileUser =
            data.user;

          setUser(
            profileUser
          );

          const targetUserId =
            profileUser.id ||
            profileUser._id;

          /*
            Load connection status.
          */
          try {
            const connectionData =
              await getConnectionStatus(
                targetUserId
              );

            setConnection({
              status:
                connectionData.status ||
                "none",

              direction:
                connectionData.direction ||
                null,

              connectionId:
                connectionData
                  .connection?._id ||
                null,
            });
          } catch (error) {
            console.error(
              "Connection status error:",
              error
            );
          }

          /*
            Load block status.
          */
          try {
            const blockData =
              await getBlockStatus(
                targetUserId
              );

            setBlocked(
              blockData.blocked
            );
          } catch (error) {
            console.error(
              "Block status error:",
              error
            );
          }

          /*
            Load previously sent message
            requests.

            IMPORTANT:
            This is separate from
            connection status.
          */
          try {
            setMessageRequestLoading(
              true
            );

            const requestData =
              await getSentMessageRequests();

            const sentRequests =
              requestData.requests ||
              [];

            /*
              Find the request sent
              specifically to this user.
            */
            const existingRequest =
              sentRequests.find(
                (request) => {
                  const recipient =
                    request?.recipient;

                  const recipientId =
                    recipient?._id ||
                    recipient?.id ||
                    recipient;

                  return (
                    recipientId?.toString() ===
                    targetUserId?.toString()
                  );
                }
              );

            /*
              Only keep an active
              request.

              If the previous request
              was declined, the user
              should be allowed to send
              another message.
            */
            if (
              existingRequest &&
              existingRequest.status ===
                "pending"
            ) {
              setMessageRequest(
                existingRequest
              );
            } else {
              setMessageRequest(null);
            }
          } catch (error) {
            console.error(
              "Sent message request error:",
              error
            );

            /*
              Don't break the profile
              if this endpoint fails.
            */
            setMessageRequest(null);
          } finally {
            setMessageRequestLoading(
              false
            );
          }
        } catch (error) {
          console.error(
            "Load public profile error:",
            error
          );

          setMessage(
            error.message ||
              "Unable to load profile."
          );
        } finally {
          setLoading(false);
        }
      };

    loadProfile();
  }, [username]);


  /*
    Send connection request.
  */
  const handleConnect =
    async () => {
      const targetUserId =
        user?.id ||
        user?._id;

      if (!targetUserId) {
        return;
      }

      try {
        setConnectionLoading(
          true
        );

        setConversationError(
          ""
        );

        const data =
          await sendConnectionRequest(
            targetUserId
          );

        setConnection({
          status:
            data.connection?.status ||
            "pending",

          direction:
            "outgoing",

          connectionId:
            data.connection?._id ||
            null,
        });
      } catch (error) {
        console.error(
          "Connect error:",
          error
        );

        setConversationError(
          error.message ||
            "Unable to send connection request."
        );
      } finally {
        setConnectionLoading(
          false
        );
      }
    };


  /*
    Handle Message button.
  */
  const handleMessageAction =
    async () => {
      const targetUserId =
        user?.id ||
        user?._id;

      if (!targetUserId) {
        return;
      }

      /*
        If already connected,
        open the normal conversation.
      */
      if (
        connection.status ===
        "accepted"
      ) {
        try {
          setStartingConversation(
            true
          );

          setConversationError(
            ""
          );

          const data =
            await createConversation(
              targetUserId
            );

          navigate(
            `/messages/${data.conversation._id}`
          );
        } catch (error) {
          console.error(
            "Open conversation error:",
            error
          );

          setConversationError(
            error.message ||
              "Unable to open conversation."
          );
        } finally {
          setStartingConversation(
            false
          );
        }

        return;
      }

      /*
        If a pending message request
        already exists, don't open the
        composer again.
      */
      if (
        messageRequest &&
        messageRequest.status ===
          "pending"
      ) {
        return;
      }

      setMessageRequestError(
        ""
      );

      setMessageText("");

      setMessageTargetOpen(
        true
      );
    };


  /*
    Send first-contact message request.
  */
  const handleSendMessageRequest =
    async (event) => {
      event.preventDefault();

      const targetUserId =
        user?.id ||
        user?._id;

      if (
        !targetUserId ||
        !messageText.trim()
      ) {
        return;
      }

      try {
        setMessageSending(
          true
        );

        setMessageRequestError(
          ""
        );

        const data =
          await sendMessageRequest(
            targetUserId,
            messageText.trim()
          );

        /*
          Save the request locally
          immediately.

          This means the UI updates
          without requiring a refresh.
        */
        setMessageRequest(
          data.request || {
            _id: null,
            text:
              messageText.trim(),
            status: "pending",
            recipient: user,
          }
        );

        setMessageTargetOpen(
          false
        );

        setMessageText("");
      } catch (error) {
        console.error(
          "Message request error:",
          error
        );

        setMessageRequestError(
          error.message ||
            "Unable to send message request."
        );
      } finally {
        setMessageSending(
          false
        );
      }
    };


  /*
    Block / unblock user.
  */
  const handleBlock =
    async () => {
      const targetUserId =
        user?.id ||
        user?._id;

      if (!targetUserId) {
        return;
      }

      try {
        setBlockLoading(
          true
        );

        setBlockError("");

        if (blocked) {
          await unblockUser(
            targetUserId
          );

          setBlocked(false);
        } else {
          await blockUser(
            targetUserId
          );

          setBlocked(true);
        }

        setShowBlockConfirm(
          false
        );

        setShowMenu(false);
      } catch (error) {
        console.error(
          "Block user error:",
          error
        );

        setBlockError(
          error.message ||
            "Unable to update block status."
        );
      } finally {
        setBlockLoading(
          false
        );
      }
    };


  if (loading) {
    return (
      <AppShell>
        <div className="public-profile-state">
          <LoaderCircle
            size={24}
            className="public-profile-spinner"
          />

          <p>
            Loading profile...
          </p>
        </div>
      </AppShell>
    );
  }


  if (message || !user) {
    return (
      <AppShell>
        <div className="public-profile-state">
          <div className="public-profile-state-icon">
            <UserRound
              size={24}
            />
          </div>

          <h2>
            Profile not found
          </h2>

          <p>
            {message ||
              "This profile doesn't exist."}
          </p>

          <Link
            to="/discover"
            className="public-profile-back"
          >
            <ArrowLeft
              size={16}
            />

            Back to Discover
          </Link>
        </div>
      </AppShell>
    );
  }


  return (
    <AppShell>
      <div className="public-profile-page">

        <Link
          to="/discover"
          className="public-profile-back"
        >
          <ArrowLeft
            size={16}
          />

          Back to Discover
        </Link>


        <div className="public-profile-card public-profile-card-new">
          <div className="public-profile-cover public-profile-cover-new">
            <div className="public-profile-cover-pattern" />
            <span className="public-profile-cover-label">COCHAT / PROFILE</span>
            <div className="public-profile-cover-orbit public-profile-cover-orbit-one" />
            <div className="public-profile-cover-orbit public-profile-cover-orbit-two" />
          </div>

          <div className="public-profile-content">
            <div className="public-profile-intro">
              <div className="public-profile-avatar public-profile-avatar-new">
                {user.avatar ? <img src={user.avatar} alt="" /> : <UserRound size={42} />}
                <span className="public-profile-online-dot" />
              </div>

              <div className="public-profile-identity">
                <span className="public-profile-handle">@{user.username}</span>
                <h1>{user.bio || "This person hasn't added a bio yet."}</h1>
              </div>
            </div>

            <div className="public-profile-layout">
              <div className="public-profile-main">
                <div className="public-profile-details public-profile-details-new">
                  {user.college && (
                    <div className="public-profile-detail public-profile-detail-card">
                      <span className="public-profile-detail-icon"><GraduationCap size={17} /></span>
                      <span><small>COLLEGE</small>{user.college}</span>
                    </div>
                  )}
                  {user.branch && (
                    <div className="public-profile-detail public-profile-detail-card">
                      <span className="public-profile-detail-icon"><MapPin size={17} /></span>
                      <span><small>FIELD</small>{user.branch}{user.semester ? ` · Semester ${user.semester}` : ""}</span>
                    </div>
                  )}
                </div>

                {user.interests?.length > 0 && (
                  <section className="public-profile-section public-profile-section-new">
                    <div className="public-profile-section-heading">
                      <div>
                        <span>INTERESTS</span>
                        <h2>What they're into</h2>
                      </div>
                      <strong>{user.interests.length} topics</strong>
                    </div>
                    <div className="public-profile-interests">
                      {user.interests.map((interest, index) => (
                        <span key={interest}>
                          <i>{String(index + 1).padStart(2, "0")}</i>
                          {interest}
                        </span>
                      ))}
                    </div>
                  </section>
                )}
              </div>

              <aside className="public-profile-action-card">
                <span className="public-profile-action-eyebrow">START A CONNECTION</span>
                <h2>Worth saying hello?</h2>
                <p>
                  Connect first, or send a short message request to introduce yourself.
                </p>

                <div className="public-profile-actions public-profile-actions-new">
                  <button
                    type="button"
                    className="public-profile-connect"
                    onClick={handleConnect}
                    disabled={connectionLoading || connection.status === "accepted" || (connection.status === "pending" && connection.direction === "outgoing")}
                  >
                    {connectionLoading ? <><LoaderCircle size={16} className="public-profile-spinner" /> Sending...</> : connection.status === "accepted" ? <><UserRoundCheck size={16} /> Connected</> : connection.status === "pending" && connection.direction === "incoming" ? <><UserPlus size={16} /> Request received</> : connection.status === "pending" ? "Pending" : <><UserPlus size={16} /> Connect</>}
                  </button>

                  <button
                    type="button"
                    className="public-profile-primary public-profile-message-button"
                    onClick={handleMessageAction}
                    disabled={startingConversation || messageRequestLoading || (messageRequest && messageRequest.status === "pending")}
                  >
                    {startingConversation ? <><LoaderCircle size={16} className="public-profile-spinner" /> Opening...</> : messageRequestLoading ? <><LoaderCircle size={16} className="public-profile-spinner" /> Checking...</> : messageRequest?.status === "pending" ? <><Clock3 size={16} /> Request sent</> : <><MessageCircle size={16} /> Message</>}
                  </button>
                </div>

                {conversationError ? (
                  <p className="public-profile-action-feedback public-profile-action-error">{conversationError}</p>
                ) : connection.status === "accepted" ? (
                  <p className="public-profile-action-feedback">You're connected. Start a conversation.</p>
                ) : messageRequest?.status === "pending" ? (
                  <div className="public-profile-message-sent">
                    <div className="public-profile-message-sent-icon"><Send size={15} /></div>
                    <div>
                      <strong>Message request sent</strong>
                      <span>"{messageRequest.text}"</span>
                      <small>Waiting for @{user.username} to accept.</small>
                    </div>
                  </div>
                ) : (
                  <p className="public-profile-action-feedback">A short introduction is usually the best way to start.</p>
                )}
              </aside>
            </div>

            <div className="public-profile-profile-note">
              <span className="public-profile-note-dot" />
              Be respectful. CoChat is built for genuine student connections.
            </div>
          </div>
        </div>

        {showBlockConfirm && (
          <div
            className="public-profile-modal-overlay"
            onClick={() =>
              setShowBlockConfirm(
                false
              )
            }
          >
            <div
              className="public-profile-modal"
              onClick={(event) =>
                event.stopPropagation()
              }
            >

              <button
                type="button"
                className="public-profile-modal-close"
                onClick={() =>
                  setShowBlockConfirm(
                    false
                  )
                }
                aria-label="Close"
              >
                <X size={18} />
              </button>


              <div className="public-profile-modal-icon">
                <ShieldBan
                  size={24}
                />
              </div>


              <h2>
                Block @{user.username}?
              </h2>


              <p>
                They won't be able
                to message you or
                interact with you
                through CoChat.
              </p>


              {blockError && (
                <div className="public-profile-block-error">
                  {blockError}
                </div>
              )}


              <div className="public-profile-modal-actions">

                <button
                  type="button"
                  className="public-profile-modal-cancel"
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
                  className="public-profile-modal-block"
                  onClick={handleBlock}
                  disabled={
                    blockLoading
                  }
                >
                  {blockLoading ? (
                    <>
                      <LoaderCircle
                        size={16}
                        className="public-profile-spinner"
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


        <div className="public-profile-menu-wrapper">

          <button
            type="button"
            className="public-profile-menu-button"
            onClick={() =>
              setShowMenu(
                (current) =>
                  !current
              )
            }
            aria-label="Profile options"
          >
            <MoreHorizontal
              size={20}
            />
          </button>


          {showMenu && (
            <div className="public-profile-menu">

              <button
                type="button"
                onClick={() => {
                  if (blocked) {
                    handleBlock();
                  } else {
                    setShowBlockConfirm(
                      true
                    );
                  }
                }}
                disabled={
                  blockLoading
                }
              >
                {blocked ? (
                  <>
                    <ShieldCheck
                      size={17}
                    />

                    Unblock user
                  </>
                ) : (
                  <>
                    <ShieldBan
                      size={17}
                    />

                    Block user
                  </>
                )}
              </button>

            </div>
          )}

        </div>

      </div>


      {messageTargetOpen && (
        <div
          className="public-profile-modal-overlay"
          onClick={() => {
            if (!messageSending) {
              setMessageTargetOpen(
                false
              );

              setMessageRequestError(
                ""
              );
            }
          }}
        >

          <div
            className="public-profile-message-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            <button
              type="button"
              className="public-profile-modal-close"
              onClick={() =>
                setMessageTargetOpen(
                  false
                )
              }
              disabled={
                messageSending
              }
              aria-label="Close"
            >
              <X size={18} />
            </button>


            <div className="public-profile-modal-icon">
              <MessageCircle
                size={23}
              />
            </div>


            <span className="public-profile-message-eyebrow">
              Message request
            </span>


            <h2>
              Say hello to @{user.username}
            </h2>


            <p>
              You're not connected
              yet. Send one short
              introduction and
              they'll decide whether
              to accept the
              conversation.
            </p>


            <form
              onSubmit={
                handleSendMessageRequest
              }
            >

              <textarea
                value={messageText}
                onChange={(event) =>
                  setMessageText(
                    event.target.value
                  )
                }
                placeholder="Hey! I saw you're also into..."
                maxLength={500}
                rows={4}
                autoFocus
                disabled={
                  messageSending
                }
              />


              <div className="public-profile-message-footer">

                <span>
                  {
                    messageText.length
                  }
                  /500
                </span>


                <button
                  type="submit"
                  disabled={
                    messageSending ||
                    !messageText.trim()
                  }
                >
                  <Send
                    size={15}
                  />

                  {messageSending
                    ? "Sending..."
                    : "Send request"}
                </button>

              </div>


              {messageRequestError && (
                <div className="public-profile-block-error">
                  {
                    messageRequestError
                  }
                </div>
              )}

            </form>

          </div>

        </div>
      )}

    </AppShell>
  );
}

export default PublicProfile;