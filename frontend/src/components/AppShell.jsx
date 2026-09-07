import {
  Link,
  useLocation,
} from "react-router-dom";

import {
  Compass,
  Home,
  UserRound,
  MessageCircle,
  LogOut,
  UsersRound,
  Bell,
  MailPlus,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import {
  useAuth,
} from "../context/useAuth";

import {
  socket,
} from "../services/socket";

import {
  getUnreadNotificationCount,
} from "../services/notificationService";

import {
  getConnectionRequestCount,
} from "../services/connectionService";


function AppShell({
  children,
}) {
  const location =
    useLocation();

  const {
    user,
    logout,
  } = useAuth();

  const [
    unreadCount,
    setUnreadCount,
  ] = useState(0);

  const [
    requestCount,
    setRequestCount,
  ] = useState(0);


  const isActive = (
    path
  ) =>
    location.pathname ===
    path;


  const isGroupsActive =
    location.pathname.startsWith(
      "/groups"
    );


  // ==========================================================
  // LOAD NOTIFICATION COUNT
  // ==========================================================

  useEffect(() => {
    if (!user?._id) {
      return undefined;
    }

    let cancelled =
      false;

    const load =
      async () => {
        try {
          const data =
            await getUnreadNotificationCount();

          if (cancelled) {
            return;
          }

          setUnreadCount(
            Number(
              data?.count
            ) || 0
          );
        } catch (error) {
          if (!cancelled) {
            console.error(
              "Unable to load notification count:",
              error
            );
          }
        }
      };

    load();

    return () => {
      cancelled = true;
    };
  }, [user?._id]);


  // ==========================================================
  // LOAD CONNECTION REQUEST COUNT
  // ==========================================================

  useEffect(() => {
    if (!user?._id) {
      setRequestCount(0);
      return undefined;
    }

    let cancelled =
      false;

    const load =
      async () => {
        try {
          const data =
            await getConnectionRequestCount();

          if (cancelled) {
            return;
          }

          setRequestCount(
            Number(
              data?.count
            ) || 0
          );
        } catch (error) {
          if (!cancelled) {
            console.error(
              "Unable to load connection request count:",
              error
            );
          }
        }
      };

    load();

    return () => {
      cancelled = true;
    };
  }, [user?._id]);


  // ==========================================================
  // REFRESH REQUEST COUNT WHEN REQUESTS PAGE OPENS
  // ==========================================================

  useEffect(() => {
    if (
      location.pathname !==
      "/message-requests"
    ) {
      return undefined;
    }

    if (!user?._id) {
      return undefined;
    }

    let cancelled =
      false;

    const refresh =
      async () => {
        try {
          const data =
            await getConnectionRequestCount();

          if (cancelled) {
            return;
          }

          setRequestCount(
            Number(
              data?.count
            ) || 0
          );
        } catch (error) {
          if (!cancelled) {
            console.error(
              "Unable to refresh request count:",
              error
            );
          }
        }
      };

    refresh();

    return () => {
      cancelled = true;
    };
  }, [
    location.pathname,
    user?._id,
  ]);


  // ==========================================================
  // SOCKET EVENTS
  // ==========================================================

  useEffect(() => {
    if (!user?._id) {
      return undefined;
    }

    if (!socket.connected) {
      socket.connect();
    }


    // ------------------------------------------
    // NEW NOTIFICATION
    // ------------------------------------------

    const handleNotification =
      () => {
        setUnreadCount(
          (current) =>
            current + 1
        );
      };


    // ------------------------------------------
    // NEW CONNECTION REQUEST
    // ------------------------------------------

    const handleConnectionRequest =
      () => {
        setRequestCount(
          (current) =>
            current + 1
        );
      };


    socket.on(
      "notification:new",
      handleNotification
    );

    socket.on(
      "connection-request",
      handleConnectionRequest
    );


    return () => {
      socket.off(
        "notification:new",
        handleNotification
      );

      socket.off(
        "connection-request",
        handleConnectionRequest
      );
    };
  }, [user?._id]);


  // ==========================================================
  // LOGOUT
  // ==========================================================

  const handleLogout =
    async () => {
      try {
        socket.disconnect();

        await logout();
      } catch (error) {
        console.error(
          "Logout failed:",
          error
        );
      }
    };


  return (
    <div className="app-shell">

      <div className="app-shell-background">

        <div className="app-shell-glow app-shell-glow-one" />

        <div className="app-shell-glow app-shell-glow-two" />

        <div className="app-shell-glow app-shell-glow-three" />

      </div>


      <header className="app-navbar">

        <div className="app-navbar-inner">

          {/* LOGO */}

          <Link
            to="/dashboard"
            className="app-navbar-logo"
            aria-label="CoChat home"
          >
            CoChat
          </Link>


          {/* NAVIGATION */}

          <nav
            className="app-navbar-links"
            aria-label="Primary navigation"
          >

            <Link
              to="/dashboard"
              className={`app-nav-link ${
                isActive(
                  "/dashboard"
                )
                  ? "app-nav-link-active"
                  : ""
              }`}
            >
              <Home
                size={16}
              />

              <span>
                Home
              </span>
            </Link>


            <Link
              to="/discover"
              className={`app-nav-link ${
                isActive(
                  "/discover"
                )
                  ? "app-nav-link-active"
                  : ""
              }`}
            >
              <Compass
                size={16}
              />

              <span>
                Discover
              </span>
            </Link>


            <Link
              to="/messages"
              className={`app-nav-link ${
                isActive(
                  "/messages"
                )
                  ? "app-nav-link-active"
                  : ""
              }`}
            >
              <MessageCircle
                size={16}
              />

              <span>
                Messages
              </span>
            </Link>


            <Link
              to="/groups"
              className={`app-nav-link ${
                isGroupsActive
                  ? "app-nav-link-active"
                  : ""
              }`}
            >
              <UsersRound
                size={16}
              />

              <span>
                Groups
              </span>
            </Link>


            {/* ====================================
                REQUESTS
                ==================================== */}

            <Link
              to="/message-requests"
              className={`app-nav-link ${
                isActive(
                  "/message-requests"
                )
                  ? "app-nav-link-active"
                  : ""
              }`}
            >

              <span
                style={{
                  position:
                    "relative",
                  display:
                    "inline-flex",
                }}
              >
                <MailPlus
                  size={16}
                />

                {requestCount >
                  0 && (
                  <span
                    style={{
                      position:
                        "absolute",
                      top:
                        "-9px",
                      right:
                        "-11px",
                      minWidth:
                        "17px",
                      height:
                        "17px",
                      padding:
                        "0 4px",
                      borderRadius:
                        "999px",
                      background:
                        "#ef4444",
                      color:
                        "#ffffff",
                      fontSize:
                        "10px",
                      fontWeight:
                        800,
                      lineHeight:
                        "17px",
                      textAlign:
                        "center",
                      border:
                        "2px solid #ffffff",
                    }}
                  >
                    {requestCount >
                    99
                      ? "99+"
                      : requestCount}
                  </span>
                )}

              </span>

              <span>
                Requests
              </span>

            </Link>

          </nav>


          {/* ACTIONS */}

          <div className="app-navbar-actions">

            {/* NOTIFICATIONS */}

            <Link
              to="/notifications"
              className={`app-navbar-notification ${
                isActive(
                  "/notifications"
                )
                  ? "app-navbar-notification-active"
                  : ""
              }`}
              title="Notifications"
              aria-label={
                unreadCount > 0
                  ? `${unreadCount} unread notifications`
                  : "Notifications"
              }
            >

              <Bell
                size={18}
              />

              {unreadCount >
                0 && (
                <span className="app-notification-badge">
                  {unreadCount >
                  99
                    ? "99+"
                    : unreadCount}
                </span>
              )}

            </Link>


            {/* PROFILE */}

            <Link
              to="/profile"
              className="app-navbar-profile"
              title={`@${
                user?.username ||
                "profile"
              }`}
              aria-label="Profile"
            >

              {user?.avatar ? (
                <img
                  src={
                    user.avatar
                  }
                  alt=""
                  className="app-navbar-avatar"
                />
              ) : (
                <UserRound
                  size={18}
                />
              )}

            </Link>


            {/* LOGOUT */}

            <button
              type="button"
              className="app-navbar-logout"
              onClick={
                handleLogout
              }
              title="Log out"
              aria-label="Log out"
            >
              <LogOut
                size={17}
              />
            </button>

          </div>

        </div>

      </header>


      <main className="app-shell-content">
        {children}
      </main>

    </div>
  );
}


export default AppShell;