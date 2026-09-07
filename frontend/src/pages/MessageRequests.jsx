import {
  ArrowLeft,
  Check,
  Clock3,
  Inbox,
  Loader2,
  MessageCircle,
  Send,
  UserRound,
  X,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  createConversation,
} from "../services/conversationService";

import {
  acceptConnectionRequest,
  getConnectionRequests,
  getSentConnectionRequests,
  rejectConnectionRequest,
} from "../services/connectionService";

import "./MessageRequests.css";


/*
  ============================================================
  HELPERS
  ============================================================
*/

function getId(value) {
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
}


function getInitial(
  username = ""
) {
  return username
    .charAt(0)
    .toUpperCase();
}


function formatDate(date) {
  if (!date) return "";

  const value =
    new Date(date);

  if (
    Number.isNaN(
      value.getTime()
    )
  ) {
    return "";
  }

  const now =
    new Date();

  const diff =
    now.getTime() -
    value.getTime();

  const minute =
    Math.floor(
      diff / 60000
    );

  if (minute < 1) {
    return "Just now";
  }

  if (minute < 60) {
    return `${minute}m ago`;
  }

  const hour =
    Math.floor(
      minute / 60
    );

  if (hour < 24) {
    return `${hour}h ago`;
  }

  const day =
    Math.floor(
      hour / 24
    );

  if (day < 7) {
    return `${day}d ago`;
  }

  return value.toLocaleDateString(
    undefined,
    {
      day: "numeric",
      month: "short",
      year:
        value.getFullYear() !==
        now.getFullYear()
          ? "numeric"
          : undefined,
    }
  );
}


function UserAvatar({
  user,
  size = "medium",
}) {
  return (
    <div
      className={`message-request-avatar message-request-avatar-${size}`}
    >
      {user?.avatar ? (
        <img
          src={user.avatar}
          alt=""
        />
      ) : (
        <span>
          {getInitial(
            user?.username
          )}
        </span>
      )}
    </div>
  );
}


/*
  Tell AppShell that the pending request count
  changed.
*/

function notifyRequestCountChanged() {
  window.dispatchEvent(
    new CustomEvent(
      "connection-request:updated"
    )
  );
}


/*
  ============================================================
  PAGE
  ============================================================
*/

function MessageRequests() {
  const navigate =
    useNavigate();


  const [
    activeTab,
    setActiveTab,
  ] = useState(
    "incoming"
  );


  const [
    incomingRequests,
    setIncomingRequests,
  ] = useState([]);


  const [
    sentRequests,
    setSentRequests,
  ] = useState([]);


  const [
    loading,
    setLoading,
  ] = useState(true);


  const [
    actionId,
    setActionId,
  ] = useState(null);


  const [
    chatId,
    setChatId,
  ] = useState(null);


  const [
    error,
    setError,
  ] = useState("");


  /*
    ==========================================================
    FETCH REQUESTS
    ==========================================================
  */

  const fetchRequests =
    async () => {
      const [
        incomingData,
        sentData,
      ] =
        await Promise.all([
          getConnectionRequests(),
          getSentConnectionRequests(),
        ]);


      return {
        incoming:
          incomingData?.requests ||
          [],

        sent:
          sentData?.requests ||
          [],
      };
    };


  /*
    ==========================================================
    LOAD REQUESTS
    ==========================================================
  */

  const loadRequests =
    async () => {
      try {
        setLoading(true);
        setError("");

        const data =
          await fetchRequests();


        setIncomingRequests(
          data.incoming
        );


        setSentRequests(
          data.sent
        );
      } catch (
        requestError
      ) {
        console.error(
          "Unable to load connection requests:",
          requestError
        );


        setError(
          requestError?.message ||
            "Unable to load connection requests."
        );
      } finally {
        setLoading(false);
      }
    };


  /*
    ==========================================================
    INITIAL LOAD
    ==========================================================
  */

  useEffect(() => {
    let mounted = true;


    const loadInitialRequests =
      async () => {
        try {
          const data =
            await fetchRequests();


          if (!mounted) {
            return;
          }


          setIncomingRequests(
            data.incoming
          );


          setSentRequests(
            data.sent
          );
        } catch (
          requestError
        ) {
          if (!mounted) {
            return;
          }


          console.error(
            "Unable to load connection requests:",
            requestError
          );


          setError(
            requestError?.message ||
              "Unable to load connection requests."
          );
        } finally {
          if (mounted) {
            setLoading(false);
          }
        }
      };


    loadInitialRequests();


    return () => {
      mounted = false;
    };
  }, []);


  /*
    ==========================================================
    ACCEPT CONNECTION + START CHAT
    ==========================================================
  */

  const handleAccept =
    async (request) => {
      const requestId =
        getId(request);

      const requester =
        request?.requester;

      const requesterId =
        getId(requester);


      if (
        !requestId ||
        !requesterId
      ) {
        setError(
          "This connection request is missing the user information needed to start a chat."
        );

        return;
      }


      try {
        setActionId(
          requestId
        );

        setChatId(null);
        setError("");


        /*
          STEP 1:
          Accept connection.
        */

        await acceptConnectionRequest(
          requestId
        );


        /*
          Remove from incoming list
          immediately.
        */

        setIncomingRequests(
          (current) =>
            current.filter(
              (item) =>
                getId(item) !==
                requestId
            )
        );


        /*
          Update navbar badge.
        */

        notifyRequestCountChanged();


        /*
          STEP 2:
          Create or return the
          existing direct conversation.
        */

        try {
          const conversationData =
            await createConversation(
              requesterId
            );


          const conversationId =
            getId(
              conversationData?.conversation
            );


          if (
            conversationId
          ) {
            navigate(
              `/messages/${conversationId}`
            );

            return;
          }
        } catch (
          conversationError
        ) {
          console.error(
            "Unable to create conversation after accepting connection:",
            conversationError
          );
        }


        /*
          Connection succeeded but
          chat creation failed.

          Keep a Start chat button
          visible instead of losing the user.
        */

        setChatId(
          requesterId
        );
      } catch (
        requestError
      ) {
        console.error(
          "Accept connection request error:",
          requestError
        );


        setError(
          requestError?.message ||
            "Unable to accept connection request."
        );
      } finally {
        setActionId(null);
      }
    };


  /*
    ==========================================================
    START CHAT
    ==========================================================
  */

  const handleStartChat =
    async (userId) => {
      if (!userId) {
        return;
      }


      try {
        setActionId(userId);
        setError("");


        const data =
          await createConversation(
            userId
          );


        const conversationId =
          getId(
            data?.conversation
          );


        if (!conversationId) {
          throw new Error(
            "Conversation could not be created."
          );
        }


        navigate(
          `/messages/${conversationId}`
        );
      } catch (
        requestError
      ) {
        console.error(
          "Start chat error:",
          requestError
        );


        setError(
          requestError?.message ||
            "Unable to start the chat."
        );
      } finally {
        setActionId(null);
      }
    };


  /*
    ==========================================================
    DECLINE
    ==========================================================
  */

  const handleDecline =
    async (requestId) => {
      try {
        setActionId(
          requestId
        );

        setError("");


        await rejectConnectionRequest(
          requestId
        );


        setIncomingRequests(
          (current) =>
            current.filter(
              (request) =>
                getId(request) !==
                requestId
            )
        );


        /*
          Update navbar badge.
        */

        notifyRequestCountChanged();
      } catch (
        requestError
      ) {
        console.error(
          "Decline connection request error:",
          requestError
        );


        setError(
          requestError?.message ||
            "Unable to decline connection request."
        );
      } finally {
        setActionId(null);
      }
    };


  /*
    ==========================================================
    SENT REQUEST FILTERS
    ==========================================================
  */

  const pendingSentRequests =
    sentRequests.filter(
      (request) =>
        request.status ===
        "pending"
    );


  const handledSentRequests =
    sentRequests.filter(
      (request) =>
        request.status !==
        "pending"
    );


  /*
    ==========================================================
    RENDER
    ==========================================================
  */

  return (
    <div className="message-requests-page">

      <div className="message-requests-shell">


        {/* HEADER */}

        <header className="message-requests-header">

          <div className="message-requests-header-left">

            <button
              type="button"
              className="message-requests-back"
              onClick={() =>
                navigate("/messages")
              }
              aria-label="Back to messages"
            >
              <ArrowLeft
                size={19}
              />
            </button>


            <div>

              <p className="message-requests-eyebrow">
                Your inbox
              </p>


              <h1>
                Connection requests
              </h1>


              <p>
                Accept people you want to connect with before chatting.
              </p>

            </div>

          </div>


          <div className="message-requests-header-icon">
            <UserRound
              size={23}
            />
          </div>

        </header>


        {/* TABS */}

        <div className="message-requests-tabs">

          {/* INCOMING */}

          <button
            type="button"
            className={
              activeTab ===
              "incoming"
                ? "message-request-tab message-request-tab-active"
                : "message-request-tab"
            }
            onClick={() =>
              setActiveTab(
                "incoming"
              )
            }
          >

            <Inbox
              size={17}
            />

            <span>
              Incoming
            </span>


            {incomingRequests.length >
              0 && (
              <span className="message-request-tab-count">
                {incomingRequests.length >
                99
                  ? "99+"
                  : incomingRequests.length}
              </span>
            )}

          </button>


          {/* SENT */}

          <button
            type="button"
            className={
              activeTab ===
              "sent"
                ? "message-request-tab message-request-tab-active"
                : "message-request-tab"
            }
            onClick={() =>
              setActiveTab(
                "sent"
              )
            }
          >

            <Send
              size={17}
            />

            <span>
              Sent
            </span>


            {pendingSentRequests.length >
              0 && (
              <span className="message-request-tab-count">
                {pendingSentRequests.length >
                99
                  ? "99+"
                  : pendingSentRequests.length}
              </span>
            )}

          </button>

        </div>


        {/* ERROR */}

        {error && (
          <div className="message-requests-error">

            <span>
              {error}
            </span>


            <button
              type="button"
              onClick={
                loadRequests
              }
            >
              Try again
            </button>

          </div>
        )}


        {/* CONTENT */}

        {loading ? (

          <div className="message-requests-loading">

            <Loader2
              size={27}
              className="message-requests-spinner"
            />

            <p>
              Loading requests...
            </p>

          </div>

        ) : activeTab ===
          "incoming" ? (

          <IncomingRequests
            requests={
              incomingRequests
            }
            actionId={
              actionId
            }
            chatId={
              chatId
            }
            onAccept={
              handleAccept
            }
            onDecline={
              handleDecline
            }
            onStartChat={
              handleStartChat
            }
          />

        ) : (

          <SentRequests
            pendingRequests={
              pendingSentRequests
            }
            handledRequests={
              handledSentRequests
            }
          />

        )}

      </div>

    </div>
  );
}


/*
  ============================================================
  INCOMING REQUESTS
  ============================================================
*/

function IncomingRequests({
  requests,
  actionId,
  chatId,
  onAccept,
  onDecline,
  onStartChat,
}) {

  if (!requests.length) {
    return (
      <EmptyState
        icon={
          <Inbox
            size={25}
          />
        }
        title="No connection requests"
        description="When someone wants to connect with you, their request will appear here."
      />
    );
  }


  return (
    <div className="message-request-list">


      <div className="message-request-list-heading">

        <div>

          <h2>
            People who want to connect
          </h2>

          <p>
            Review their profile before accepting.
          </p>

        </div>


        <span>
          {requests.length}{" "}
          {requests.length ===
          1
            ? "request"
            : "requests"}
        </span>

      </div>


      {requests.map(
        (request) => {

          const sender =
            request?.requester;

          const requestId =
            getId(request);

          const senderId =
            getId(sender);

          const busy =
            actionId ===
            requestId;


          return (
            <article
              className="message-request-card"
              key={requestId}
            >

              {/* USER */}

              <div className="message-request-card-top">

                <UserAvatar
                  user={sender}
                  size="large"
                />


                <div className="message-request-user">

                  <div className="message-request-name-row">

                    <h3>
                      @
                      {sender?.username ||
                        "unknown"}
                    </h3>


                    <span>
                      {formatDate(
                        request?.createdAt
                      )}
                    </span>

                  </div>


                  <div className="message-request-meta">

                    {sender?.college && (
                      <span>
                        {sender.college}
                      </span>
                    )}


                    {sender?.branch && (
                      <>
                        <i>
                          •
                        </i>

                        <span>
                          {sender.branch}
                        </span>
                      </>
                    )}


                    {sender?.semester && (
                      <>
                        <i>
                          •
                        </i>

                        <span>
                          Sem{" "}
                          {sender.semester}
                        </span>
                      </>
                    )}

                  </div>

                </div>

              </div>


              {/* BIO */}

              {sender?.bio && (
                <p className="message-request-bio">
                  {sender.bio}
                </p>
              )}


              {/* REQUEST MESSAGE */}

              <div className="message-request-message">

                <MessageCircle
                  size={16}
                />

                <p>
                  @
                  {sender?.username ||
                    "Someone"}{" "}
                  wants to connect with you.
                </p>

              </div>


              {/* SUCCESS */}

              {chatId ===
                senderId && (
                <div className="message-request-success">

                  <Check
                    size={15}
                  />

                  Connected. You can start chatting now.

                </div>
              )}


              {/* ACTIONS */}

              <div className="message-request-actions">

                {chatId ===
                senderId ? (

                  <button
                    type="button"
                    className="message-request-accept"
                    disabled={
                      busy
                    }
                    onClick={() =>
                      onStartChat(
                        senderId
                      )
                    }
                  >

                    {busy ? (

                      <Loader2
                        size={16}
                        className="message-requests-spinner"
                      />

                    ) : (

                      <MessageCircle
                        size={16}
                      />

                    )}

                    Start chat

                  </button>

                ) : (

                  <>

                    <button
                      type="button"
                      className="message-request-decline"
                      disabled={
                        busy
                      }
                      onClick={() =>
                        onDecline(
                          requestId
                        )
                      }
                    >

                      {busy ? (

                        <Loader2
                          size={16}
                          className="message-requests-spinner"
                        />

                      ) : (

                        <X
                          size={16}
                        />

                      )}

                      Decline

                    </button>


                    <button
                      type="button"
                      className="message-request-accept"
                      disabled={
                        busy
                      }
                      onClick={() =>
                        onAccept(
                          request
                        )
                      }
                    >

                      {busy ? (

                        <Loader2
                          size={16}
                          className="message-requests-spinner"
                        />

                      ) : (

                        <Check
                          size={16}
                        />

                      )}

                      Accept & Chat

                    </button>

                  </>

                )}

              </div>

            </article>
          );
        }
      )}

    </div>
  );
}


/*
  ============================================================
  SENT REQUESTS
  ============================================================
*/

function SentRequests({
  pendingRequests,
  handledRequests,
}) {

  if (
    !pendingRequests.length &&
    !handledRequests.length
  ) {
    return (
      <EmptyState
        icon={
          <Send
            size={25}
          />
        }
        title="No sent requests"
        description="Connection requests you send will appear here."
      />
    );
  }


  return (
    <div className="message-request-list">


      {/* PENDING */}

      {pendingRequests.length >
        0 && (
        <>

          <div className="message-request-list-heading">

            <div>

              <h2>
                Requests you've sent
              </h2>

              <p>
                Waiting for them to accept your connection.
              </p>

            </div>


            <span>
              {pendingRequests.length}{" "}
              {pendingRequests.length ===
              1
                ? "request"
                : "requests"}
            </span>

          </div>


          {pendingRequests.map(
            (request) => {

              const recipient =
                request?.recipient;


              return (
                <article
                  className="message-request-card"
                  key={
                    getId(request)
                  }
                >

                  <div className="message-request-card-top">

                    <UserAvatar
                      user={
                        recipient
                      }
                      size="large"
                    />


                    <div className="message-request-user">

                      <div className="message-request-name-row">

                        <h3>
                          @
                          {recipient?.username ||
                            "unknown"}
                        </h3>


                        <span>
                          {formatDate(
                            request?.createdAt
                          )}
                        </span>

                      </div>


                      <div className="message-request-meta">

                        {recipient?.college && (
                          <span>
                            {
                              recipient.college
                            }
                          </span>
                        )}


                        {recipient?.branch && (
                          <>
                            <i>
                              •
                            </i>

                            <span>
                              {
                                recipient.branch
                              }
                            </span>
                          </>
                        )}

                      </div>

                    </div>


                    <span className="message-request-status message-request-status-pending">

                      <Clock3
                        size={13}
                      />

                      Pending

                    </span>

                  </div>

                </article>
              );
            }
          )}

        </>
      )}


      {/* HISTORY */}

      {handledRequests.length >
        0 && (
        <>

          <h3 className="message-request-history-heading">
            Request history
          </h3>


          {handledRequests.map(
            (request) => {

              const recipient =
                request?.recipient;

              const accepted =
                request?.status ===
                "accepted";


              return (
                <article
                  className="message-request-card message-request-card-history"
                  key={
                    getId(request)
                  }
                >

                  <div className="message-request-card-top">

                    <UserAvatar
                      user={
                        recipient
                      }
                      size="medium"
                    />


                    <div className="message-request-user">

                      <div className="message-request-name-row">

                        <h3>
                          @
                          {recipient?.username ||
                            "unknown"}
                        </h3>


                        <span>
                          {formatDate(
                            request?.updatedAt ||
                              request?.createdAt
                          )}
                        </span>

                      </div>

                    </div>


                    <span
                      className={`message-request-status ${
                        accepted
                          ? "message-request-status-accepted"
                          : "message-request-status-declined"
                      }`}
                    >

                      {accepted ? (

                        <Check
                          size={13}
                        />

                      ) : (

                        <X
                          size={13}
                        />

                      )}

                      {accepted
                        ? "Accepted"
                        : "Declined"}

                    </span>

                  </div>

                </article>
              );
            }
          )}

        </>
      )}

    </div>
  );
}


/*
  ============================================================
  EMPTY STATE
  ============================================================
*/

function EmptyState({
  icon,
  title,
  description,
}) {
  return (
    <div className="message-requests-empty">

      <div className="message-requests-empty-icon">
        {icon}
      </div>

      <h2>
        {title}
      </h2>

      <p>
        {description}
      </p>

    </div>
  );
}


export default MessageRequests;