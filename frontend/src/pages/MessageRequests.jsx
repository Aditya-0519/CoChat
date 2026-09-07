import {
  ArrowLeft,
  Check,
  Clock3,
  Inbox,
  Loader2,
  Send,
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
  acceptConnectionRequest,
  getConnectionRequests,
  getSentConnectionRequests,
  rejectConnectionRequest,
} from "../services/connectionService";

import "./MessageRequests.css";


function getInitial(username = "") {
  return username
    .charAt(0)
    .toUpperCase();
}


function formatDate(date) {
  if (!date) return "";

  const value = new Date(date);

  if (
    Number.isNaN(
      value.getTime()
    )
  ) {
    return "";
  }

  const now = new Date();

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
    error,
    setError,
  ] = useState("");


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


  const handleAccept =
    async (
      requestId
    ) => {
      try {
        setActionId(
          requestId
        );

        setError("");

        await acceptConnectionRequest(
          requestId
        );

        setIncomingRequests(
          (current) =>
            current.filter(
              (request) =>
                request._id !==
                requestId
            )
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


  const handleDecline =
    async (
      requestId
    ) => {
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
                request._id !==
                requestId
            )
        );
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


  return (
    <div className="message-requests-page">
      <div className="message-requests-shell">

        <header className="message-requests-header">

          <div className="message-requests-header-left">

            <button
              type="button"
              className="message-requests-back"
              onClick={() =>
                navigate(
                  "/messages"
                )
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
                Accept people you want
                to connect with before chatting.
              </p>

            </div>

          </div>

          <div className="message-requests-header-icon">
            <Inbox
              size={23}
            />
          </div>

        </header>


        <div className="message-requests-tabs">

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
            onAccept={
              handleAccept
            }
            onDecline={
              handleDecline
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
  INCOMING CONNECTION REQUESTS
  ============================================================
*/

function IncomingRequests({
  requests,
  actionId,
  onAccept,
  onDecline,
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
        description="When someone sends you a connection request, it will appear here."
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
          const requester =
            request.requester;

          const busy =
            actionId ===
            request._id;

          return (
            <article
              className="message-request-card"
              key={
                request._id
              }
            >

              <div className="message-request-card-top">

                <UserAvatar
                  user={
                    requester
                  }
                  size="large"
                />

                <div className="message-request-user">

                  <div className="message-request-name-row">

                    <h3>
                      @
                      {requester?.username ||
                        "unknown"}
                    </h3>

                    <span>
                      {formatDate(
                        request.createdAt
                      )}
                    </span>

                  </div>


                  <div className="message-request-meta">

                    {requester?.college && (
                      <span>
                        {
                          requester.college
                        }
                      </span>
                    )}

                    {requester?.branch && (
                      <>
                        <i>
                          •
                        </i>

                        <span>
                          {
                            requester.branch
                          }
                        </span>
                      </>
                    )}

                    {requester?.semester && (
                      <>
                        <i>
                          •
                        </i>

                        <span>
                          Sem{" "}
                          {
                            requester.semester
                          }
                        </span>
                      </>
                    )}

                  </div>

                </div>

              </div>


              {requester?.bio && (
                <p className="message-request-bio">
                  {
                    requester.bio
                  }
                </p>
              )}


              <div className="message-request-message">

                <Inbox
                  size={16}
                />

                <p>
                  <strong>
                    @
                    {
                      requester?.username ||
                      "Someone"
                    }
                  </strong>{" "}
                  wants to connect with you.
                </p>

              </div>


              <div className="message-request-actions">

                <button
                  type="button"
                  className="message-request-decline"
                  disabled={
                    busy
                  }
                  onClick={() =>
                    onDecline(
                      request._id
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
                      request._id
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

                  Accept
                </button>

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
  SENT CONNECTION REQUESTS
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

      {pendingRequests.length >
        0 && (
        <div className="message-request-list-heading">

          <div>

            <h2>
              Waiting for a response
            </h2>

            <p>
              These people haven't
              accepted your request yet.
            </p>

          </div>

          <span>
            {
              pendingRequests.length
            }{" "}
            pending
          </span>

        </div>
      )}


      {pendingRequests.map(
        (request) => (
          <SentRequestCard
            key={
              request._id
            }
            request={
              request
            }
          />
        )
      )}


      {handledRequests.length >
        0 && (
        <div className="message-request-history-heading">
          Request history
        </div>
      )}


      {handledRequests.map(
        (request) => (
          <SentRequestCard
            key={
              request._id
            }
            request={
              request
            }
            history
          />
        )
      )}

    </div>
  );
}


function SentRequestCard({
  request,
  history = false,
}) {
  const recipient =
    request.recipient;

  const status =
    request.status;

  return (
    <article
      className={
        history
          ? "message-request-card message-request-card-history"
          : "message-request-card"
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
              {
                recipient?.username ||
                "unknown"
              }
            </h3>

            <span>
              {formatDate(
                request.createdAt
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

            {recipient?.semester && (
              <>
                <i>
                  •
                </i>

                <span>
                  Sem{" "}
                  {
                    recipient.semester
                  }
                </span>
              </>
            )}

          </div>

        </div>

        <RequestStatus
          status={
            status
          }
        />

      </div>


      {status ===
        "pending" && (
        <div className="message-request-waiting">

          <Clock3
            size={16}
          />

          Waiting for @
          {
            recipient?.username ||
            "user"
          }{" "}
          to respond.

        </div>
      )}


      {status ===
        "accepted" && (
        <div className="message-request-success">

          <Check
            size={16}
          />

          Connection accepted.

        </div>
      )}


      {status ===
        "rejected" && (
        <div className="message-request-declined">

          <X
            size={16}
          />

          Connection request declined.

        </div>
      )}

    </article>
  );
}


function RequestStatus({
  status,
}) {
  if (
    status ===
    "accepted"
  ) {
    return (
      <span className="message-request-status message-request-status-accepted">

        <Check
          size={13}
        />

        Accepted

      </span>
    );
  }

  if (
    status ===
    "rejected"
  ) {
    return (
      <span className="message-request-status message-request-status-declined">

        <X
          size={13}
        />

        Declined

      </span>
    );
  }

  return (
    <span className="message-request-status message-request-status-pending">

      <Clock3
        size={13}
      />

      Pending

    </span>
  );
}


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