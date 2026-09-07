import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ArrowRight,
  Compass,
  GraduationCap,
  LoaderCircle,
  MessageCircle,
  UserRoundCheck,
  UserPlus,
  MapPin,
  Search,
  Send,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";

import {
  Link,
  useNavigate,
} from "react-router-dom";

import AppShell from "../components/AppShell";
import { useAuth } from "../context/useAuth";

import {
  getDiscoverUsers,
} from "../services/userService";

import {
  getConnectionStatus,
  sendConnectionRequest,
} from "../services/connectionService";

import {
  createConversation,
  sendMessageRequest,
} from "../services/conversationService";

function Discover() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");

  const [loading, setLoading] =
    useState(true);

  const [message, setMessage] =
    useState("");

  const [connectionStates, setConnectionStates] =
    useState({});

  const [actionLoading, setActionLoading] =
    useState({});

  const [messageTarget, setMessageTarget] =
    useState(null);

  const [messageText, setMessageText] =
    useState("");

  const [messageSending, setMessageSending] =
    useState(false);

  const [messageError, setMessageError] =
    useState("");

  /*
  =====================================================
  LOAD DISCOVER USERS + CONNECTION STATUS
  =====================================================
  */

  useEffect(() => {
    const loadUsers = async () => {
      try {
        setLoading(true);
        setMessage("");

        const data =
          await getDiscoverUsers();

        const discoveredUsers =
          data.users || [];

        setUsers(discoveredUsers);

        /*
        Load connection status for every
        discovered person.
        */

        const statuses =
          await Promise.all(
            discoveredUsers.map(
              async (person) => {
                try {
                  const statusData =
                    await getConnectionStatus(
                      person._id
                    );

                  return [
                    person._id,
                    {
                      status:
                        statusData.status ||
                        "none",

                      direction:
                        statusData.direction ||
                        null,

                      connectionId:
                        statusData.connection?._id ||
                        null,
                    },
                  ];
                } catch (error) {
                  console.error(
                    "Connection status error:",
                    error
                  );

                  return [
                    person._id,
                    {
                      status: "none",
                      direction: null,
                      connectionId: null,
                    },
                  ];
                }
              }
            )
          );

        setConnectionStates(
          Object.fromEntries(statuses)
        );
      } catch (error) {
        console.error(
          "Discover users error:",
          error
        );

        setMessage(
          error.message ||
            "Unable to load people."
        );
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, []);

  /*
  =====================================================
  MATCHING
  =====================================================
  */

  const currentInterests = useMemo(
    () =>
      (user?.interests || []).map(
        (interest) =>
          interest
            .trim()
            .toLowerCase()
      ),
    [user]
  );
const getMatchScore = useCallback((person) => {
  const personInterests =
    (person.interests || []).map(
      (interest) =>
        interest
          .trim()
          .toLowerCase()
    );

  const sharedInterests =
    personInterests.filter(
      (interest) =>
        currentInterests.includes(
          interest
        )
    ).length;

    let score =
      sharedInterests * 2;

    if (
      user?.college &&
      person.college &&
      user.college.toLowerCase() ===
        person.college.toLowerCase()
    ) {
      score += 2;
    }

    if (
      user?.branch &&
      person.branch &&
      user.branch.toLowerCase() ===
        person.branch.toLowerCase()
    ) {
      score += 1;
    }

    return score;
}, [currentInterests, user]);

  /*
  =====================================================
  CONNECT
  =====================================================
  */

  const handleConnect = async (
    person
  ) => {
    if (!person?._id) return;

    setActionLoading((current) => ({
      ...current,
      [person._id]: "connect",
    }));

    setMessage("");

    try {
      const data =
        await sendConnectionRequest(
          person._id
        );

      setConnectionStates(
        (current) => ({
          ...current,

          [person._id]: {
            status:
              data.connection?.status ||
              "pending",

            direction:
              "outgoing",

            connectionId:
              data.connection?._id ||
              null,
          },
        })
      );
    } catch (error) {
      console.error(
        "Connect error:",
        error
      );

      setMessage(
        error.message ||
          "Unable to send connection request."
      );
    } finally {
      setActionLoading(
        (current) => {
          const next = {
            ...current,
          };

          delete next[
            person._id
          ];

          return next;
        }
      );
    }
  };

  /*
  =====================================================
  MESSAGE ACTION
  =====================================================
  */

  const handleMessageAction =
    async (person) => {
      if (!person?._id) return;

      const relationship =
        connectionStates[
          person._id
        ] || {
          status: "none",
          direction: null,
        };

      /*
      Already connected:
      open normal conversation.
      */

      if (
        relationship.status ===
        "accepted"
      ) {
        setActionLoading(
          (current) => ({
            ...current,
            [person._id]:
              "message",
          })
        );

        setMessage("");

        try {
          const data =
            await createConversation(
              person._id
            );

          navigate(
            `/messages/${data.conversation._id}`
          );
        } catch (error) {
          console.error(
            "Open conversation error:",
            error
          );

          setMessage(
            error.message ||
              "Unable to open conversation."
          );
        } finally {
          setActionLoading(
            (current) => {
              const next = {
                ...current,
              };

              delete next[
                person._id
              ];

              return next;
            }
          );
        }

        return;
      }

      /*
      Not connected:
      open message request modal.

      IMPORTANT:
      Even if connection status is
      pending/outgoing, the user can
      still send the message request.
      */

      setMessageTarget(person);
      setMessageText("");
      setMessageError("");
    };

  /*
  =====================================================
  SEND MESSAGE REQUEST
  =====================================================
  */

  const handleSendMessageRequest =
    async (event) => {
      event.preventDefault();

      if (
        !messageTarget?._id ||
        !messageText.trim()
      ) {
        return;
      }

      setMessageSending(true);
      setMessageError("");

      try {
        await sendMessageRequest(
          messageTarget._id,
          messageText.trim()
        );

        /*
        Message request has been sent.

        We do NOT automatically create
        a normal conversation on the
        frontend.
        */

        setConnectionStates(
          (current) => ({
            ...current,

            [messageTarget._id]: {
              ...(current[
                messageTarget._id
              ] || {}),

              status: "pending",
              direction: "outgoing",
            },
          })
        );

        setMessageTarget(null);
        setMessageText("");
      } catch (error) {
        console.error(
          "Message request error:",
          error
        );

        setMessageError(
          error.message ||
            "Unable to send message request."
        );
      } finally {
        setMessageSending(false);
      }
    };

  /*
  =====================================================
  FILTER + SORT
  =====================================================
  */

const filteredUsers = useMemo(() => {
  const query =
    search
      .trim()
      .toLowerCase();

  return users
    .map((person) => ({
      ...person,
      matchScore:
        getMatchScore(person),
    }))
    .filter((person) => {
      if (!query) {
        return true;
      }

      const searchableText = [
        person.username,
        person.bio,
        person.college,
        person.branch,
        ...(person.interests || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(
        query
      );
    })
    .sort(
      (a, b) =>
        b.matchScore -
        a.matchScore
    );
}, [
  users,
  search,
  getMatchScore,
]);
  /*
  =====================================================
  RENDER
  =====================================================
  */

  return (
    <AppShell>
      <div className="discover-page">

        {/* =========================================
            HERO
        ========================================= */}

        <section className="discover-hero">

          <div className="discover-hero-copy">

            <span className="discover-eyebrow">
              <Compass size={14} />
              Discover your people
            </span>

            <h1>
              Meet people
              <br />
              <span>
                worth talking to.
              </span>
            </h1>

            <p>
              Find students who share
              your interests, your
              college, or simply your
              curiosity.
            </p>

          </div>

          <div className="discover-hero-decoration">

            <div className="discover-orbit discover-orbit-one" />
            <div className="discover-orbit discover-orbit-two" />

            <div className="discover-hero-avatar-glow" />

            <div
              className="discover-hero-avatar"
              style={user?.avatar ? {
                backgroundImage: `url(${user.avatar})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              } : undefined}
            >
              {!user?.avatar && (
                <UserRound size={48} strokeWidth={1.8} />
              )}
              <span className="discover-hero-avatar-status" />
            </div>

            <div className="discover-floating-icon discover-floating-one">
              <Sparkles size={18} />
            </div>

            <div className="discover-floating-icon discover-floating-two">
              <Compass size={19} />
            </div>

          </div>

        </section>

        {/* =========================================
            TOOLBAR
        ========================================= */}

        {!loading &&
          !message &&
          users.length > 0 && (
            <section className="discover-toolbar">

              <div className="discover-search">

                <Search size={18} />

                <input
                  type="text"
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                  placeholder="Search people, interests, college..."
                />

                {search && (
                  <button
                    type="button"
                    className="discover-search-clear"
                    onClick={() =>
                      setSearch("")
                    }
                    aria-label="Clear search"
                  >
                    <X size={16} />
                  </button>
                )}

              </div>

              <div className="discover-results">
                <strong>
                  {
                    filteredUsers.length
                  }
                </strong>

                <span>
                  {filteredUsers.length ===
                  1
                    ? "person"
                    : "people"}
                </span>
              </div>

            </section>
          )}

        {/* =========================================
            LOADING
        ========================================= */}

        {loading && (
          <div className="discover-loading">

            <LoaderCircle
              size={22}
              className="discover-spinner"
            />

            <p>
              Finding people for you...
            </p>

          </div>
        )}

        {/* =========================================
            ERROR
        ========================================= */}

        {!loading &&
          message && (
            <div className="discover-empty">

              <div className="discover-empty-icon">
                <Compass size={25} />
              </div>

              <h2>
                Something went wrong.
              </h2>

              <p>
                {message}
              </p>

            </div>
          )}

        {/* =========================================
            NO USERS
        ========================================= */}

        {!loading &&
          !message &&
          users.length === 0 && (
            <div className="discover-empty">

              <div className="discover-empty-icon">
                <Compass size={25} />
              </div>

              <h2>
                You're early.
              </h2>

              <p>
                There aren't any other
                profiles to discover yet.
                Check back soon.
              </p>

            </div>
          )}

        {/* =========================================
            NO SEARCH RESULTS
        ========================================= */}

        {!loading &&
          !message &&
          users.length > 0 &&
          filteredUsers.length === 0 && (
            <div className="discover-empty">

              <div className="discover-empty-icon">
                <Search size={25} />
              </div>

              <h2>
                No one matched that.
              </h2>

              <p>
                Try searching for a
                different name, interest,
                college, or branch.
              </p>

              <button
                type="button"
                className="discover-reset-button"
                onClick={() =>
                  setSearch("")
                }
              >
                Clear search
              </button>

            </div>
          )}

        {/* =========================================
            PEOPLE GRID
        ========================================= */}

        {!loading &&
          !message &&
          filteredUsers.length > 0 && (
            <div className="discover-grid">

              {filteredUsers.map(
                (person) => {
                  const sharedInterests =
                    (person.interests || []).filter((interest) =>
                      currentInterests.includes(
                        interest.trim().toLowerCase()
                      )
                    ).length;

                  const isMatch =
                    person.matchScore >
                    0;

                  const relationship =
                    connectionStates[
                      person._id
                    ] || {
                      status: "none",
                      direction: null,
                    };

                  const status =
                    relationship.status;

                  const connecting =
                    actionLoading[
                      person._id
                    ] === "connect";

                  const messaging =
                    actionLoading[
                      person._id
                    ] === "message";

                  return (
                    <article
                      key={person._id}
                      className={`person-card ${
                        isMatch
                          ? "person-card-match"
                          : ""
                      }`}
                    >

                      {/* CARD TOP */}

                      <div className="person-card-top">

                        <div className="person-avatar-wrap">
                          <div className="person-avatar-glow" />

                          <div className="person-avatar">

                            {person.avatar ? (
                              <img
                                src={person.avatar}
                                alt={`@${person.username}`}
                              />
                            ) : (
                              <UserRound
                                size={34}
                              />
                            )}

                          </div>

                          <span
                            className="person-avatar-ring"
                            aria-hidden="true"
                          />
                        </div>

                        {isMatch ? (
                          <span className="person-status person-status-match">
                            <Sparkles size={12} />
                            For you
                          </span>
                        ) : (
                          <span className="person-status">
                            New here
                          </span>
                        )}

                      </div>

                      {/* CARD INFO */}

                      <div className="person-info">

                        <Link
                          to={`/u/${person.username}`}
                          className="person-name-link"
                        >
                          <h2>
                            @{person.username}
                          </h2>
                        </Link>

                        <p className="person-bio">
                          {person.bio ||
                            "Still figuring out what to write here."}
                        </p>

                        {isMatch && (
                          <div className="person-match-note">
                            <Sparkles size={13} />
                            {sharedInterests > 0
                              ? `${sharedInterests} shared interest${sharedInterests === 1 ? "" : "s"}`
                              : "A good match for you"}
                          </div>
                        )}

                        {(person.college ||
                          person.branch) && (
                          <div className="person-meta">

                            {person.college && (
                              <span>
                                <GraduationCap
                                  size={14}
                                />

                                {
                                  person.college
                                }
                              </span>
                            )}

                            {person.branch && (
                              <span>
                                <MapPin
                                  size={14}
                                />

                                {
                                  person.branch
                                }
                              </span>
                            )}

                          </div>
                        )}

                        {person.interests
                          ?.length >
                          0 && (
                          <div className="person-interests">

                            {person.interests
                              .slice(0, 4)
                              .map(
                                (
                                  interest
                                ) => {
                                  const shared =
                                    currentInterests.includes(
                                      interest
                                        .trim()
                                        .toLowerCase()
                                    );

                                  return (
                                    <span
                                      key={
                                        interest
                                      }
                                      className={
                                        shared
                                          ? "interest-shared"
                                          : ""
                                      }
                                    >
                                      {
                                        interest
                                      }
                                    </span>
                                  );
                                }
                              )}

                            {person.interests
                              .length >
                              4 && (
                              <span>
                                +
                                {person
                                  .interests
                                  .length -
                                  4}
                              </span>
                            )}

                          </div>
                        )}

                      </div>

                      {/* =================================
                          ACTIONS
                      ================================= */}

                      <div className="person-card-actions">

                        {/* CONNECT */}

                        <button
                          type="button"
                          className={`person-connect-button ${
                            status ===
                            "accepted"
                              ? "person-connect-button-connected"
                              : ""
                          }`}
                          onClick={() => {
                            if (
                              status ===
                                "none" ||
                              status ===
                                "rejected"
                            ) {
                              handleConnect(
                                person
                              );
                            }
                          }}
                          disabled={
                            connecting ||
                            status ===
                              "pending" ||
                            status ===
                              "accepted"
                          }
                        >

                          {connecting ? (
                            <>
                              <LoaderCircle
                                size={15}
                                className="discover-spinner"
                              />

                              Sending...
                            </>
                          ) : status ===
                            "accepted" ? (
                            <>
                              <UserRoundCheck
                                size={15}
                              />

                              Connected
                            </>
                          ) : status ===
                            "pending" &&
                            relationship.direction ===
                              "incoming" ? (
                            <>
                              <UserPlus
                                size={15}
                              />

                              Request received
                            </>
                          ) : status ===
                            "pending" ? (
                            "Pending"
                          ) : (
                            <>
                              <UserPlus
                                size={15}
                              />

                              Connect
                            </>
                          )}

                        </button>

                        {/* MESSAGE */}

                        <button
                          type="button"
                          className="person-message-button"
                          onClick={() =>
                            handleMessageAction(
                              person
                            )
                          }
                          disabled={messaging}
                        >

                          <MessageCircle
                            size={15}
                          />

                          {messaging
                            ? "Opening..."
                            : "Message"}

                        </button>

                      </div>

                      {/* PROFILE LINK */}

                      <Link
                        to={`/u/${person.username}`}
                        className="person-view-button"
                      >
                        View profile

                        <ArrowRight
                          size={16}
                        />
                      </Link>

                    </article>
                  );
                }
              )}

            </div>
          )}

        {/* =========================================
            MESSAGE REQUEST MODAL
        ========================================= */}

        {messageTarget && (
          <div
            className="public-profile-modal-overlay"
            onClick={() => {
              if (
                !messageSending
              ) {
                setMessageTarget(
                  null
                );
                setMessageError("");
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
                  setMessageTarget(
                    null
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
                Say hello to @
                {
                  messageTarget.username
                }
              </h2>

              <p>
                You're not connected
                yet. Send a short
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
                  value={
                    messageText
                  }
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

                    <Send size={15} />

                    {messageSending
                      ? "Sending..."
                      : "Send request"}

                  </button>

                </div>

                {messageError && (
                  <div className="public-profile-block-error">
                    {
                      messageError
                    }
                  </div>
                )}

              </form>

            </div>

          </div>
        )}

      </div>
    </AppShell>
  );
}

export default Discover;