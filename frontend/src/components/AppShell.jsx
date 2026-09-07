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

import { useAuth } from "../context/useAuth";
import { socket } from "../services/socket";

import {
  getUnreadNotificationCount,
} from "../services/notificationService";

import {
  getConnectionRequests,
} from "../services/connectionService";


function AppShell({ children }) {
  const location = useLocation();

  const {
    user,
    logout,
  } = useAuth();


  /*
   * =====================================================
   * NOTIFICATION COUNT
   * =====================================================
   */

  const [
    unreadCount,
    setUnreadCount,
  ] = useState(0);


  /*
   * =====================================================
   * CONNECTION REQUEST COUNT
   * =====================================================
   */

  const [
    requestCount,
    setRequestCount,
  ] = useState(0);


  const isActive = (path) =>
    location.pathname === path;


  const isGroupsActive =
    location.pathname.startsWith(
      "/groups"
    );


  /*
   * =====================================================
   * LOAD UNREAD NOTIFICATIONS
   * =====================================================
   */

  useEffect(() => {
    if (!user?._id) {
      setUnreadCount(0);
      return undefined;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const data =
          await getUnreadNotificationCount();

        if (cancelled) return;

        setUnreadCount(
          Number(data?.count) || 0
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


  /*
   * =====================================================
   * LOAD CONNECTION REQUEST COUNT
   *
   * This reads the real incoming pending requests
   * from the backend.
   * =====================================================
   */

  useEffect(() => {
    if (!user?._id) {
      setRequestCount(0);
      return undefined;
    }

    let cancelled = false;

    const loadRequestCount = async () => {
      try {
        const data =
          await getConnectionRequests();

        if (cancelled) return;

        const requests =
          Array.isArray(data?.requests)
            ? data.requests
            : [];

        setRequestCount(
          requests.length
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

    loadRequestCount();

    /*
     * Also refresh periodically so the badge stays
     * correct even if the socket reconnects or an
     * action happens from another browser/device.
     */
    const interval = setInterval(
      loadRequestCount,
      15000
    );

    /*
     * Refresh when the user returns to the tab.
     */
    const handleVisibilityChange = () => {
      if (
        document.visibilityState ===
        "visible"
      ) {
        loadRequestCount();
      }
    };

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    /*
     * Refresh whenever navigation changes.
     */
    return () => {
      cancelled = true;

      clearInterval(interval);

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, [
    user?._id,
    location.pathname,
  ]);


  /*
   * =====================================================
   * REALTIME NOTIFICATIONS
   * =====================================================
   */

  useEffect(() => {
    if (!user?._id) {
      return undefined;
    }

    if (!socket.connected) {
      socket.connect();
    }

    const handleNotification = () => {
      setUnreadCount(
        (current) =>
          current + 1
      );
    };

    socket.on(
      "notification:new",
      handleNotification
    );

    return () => {
      socket.off(
        "notification:new",
        handleNotification
      );
    };
  }, [user?._id]);


  /*
   * =====================================================
   * REALTIME CONNECTION REQUESTS
   *
   * Backend emits "connection-request" whenever
   * somebody sends the logged-in user a request.
   * =====================================================
   */

  useEffect(() => {
    if (!user?._id) {
      return undefined;
    }

    if (!socket.connected) {
      socket.connect();
    }

    const handleConnectionRequest = () => {
      /*
       * Don't blindly increment because the socket
       * event could be duplicated after reconnecting.
       *
       * Re-read the backend count instead.
       */

      getConnectionRequests()
        .then((data) => {
          const requests =
            Array.isArray(data?.requests)
              ? data.requests
              : [];

          setRequestCount(
            requests.length
          );
        })
        .catch((error) => {
          console.error(
            "Unable to refresh connection request count:",
            error
          );
        });
    };

    socket.on(
      "connection-request",
      handleConnectionRequest
    );

    return () => {
      socket.off(
        "connection-request",
        handleConnectionRequest
      );
    };
  }, [user?._id]);


  /*
   * =====================================================
   * REFRESH REQUEST COUNT WHEN REQUESTS PAGE OPENS
   * =====================================================
   */

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

    let cancelled = false;

    const refresh = async () => {
      try {
        const data =
          await getConnectionRequests();

        if (cancelled) return;

        const requests =
          Array.isArray(data?.requests)
            ? data.requests
            : [];

        setRequestCount(
          requests.length
        );
      } catch (error) {
        if (!cancelled) {
          console.error(
            "Unable to refresh connection request count:",
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


  /*
   * =====================================================
   * REFRESH NOTIFICATION COUNT WHEN NOTIFICATIONS
   * PAGE OPENS
   * =====================================================
   */

  useEffect(() => {
    if (
      location.pathname !==
      "/notifications"
    ) {
      return undefined;
    }

    let cancelled = false;

    const refresh = async () => {
      try {
        const data =
          await getUnreadNotificationCount();

        if (cancelled) return;

        setUnreadCount(
          Number(data?.count) || 0
        );
      } catch (error) {
        if (!cancelled) {
          console.error(
            "Unable to refresh notification count:",
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
  ]);


  /*
   * =====================================================
   * LOGOUT
   * =====================================================
   */

  const handleLogout = async () => {
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


  /*
   * =====================================================
   * RENDER
   * =====================================================
   */

  return (
    <div className="app-shell">

      <div className="app-shell-background">
        <div className="app-shell-glow app-shell-glow-one" />
        <div className="app-shell-glow app-shell-glow-two" />
        <div className="app-shell-glow app-shell-glow-three" />
      </div>


      <header className="app-navbar">

        <div className="app-navbar-inner">

          <Link
            to="/dashboard"
            className="app-navbar-logo"
            aria-label="CoChat home"
          >
            CoChat
          </Link>


          <nav
            className="app-navbar-links"
            aria-label="Primary navigation"
          >

            {/* HOME */}

            <Link
              to="/dashboard"
              className={`app-nav-link ${
                isActive("/dashboard")
                  ? "app-nav-link-active"
                  : ""
              }`}
            >
              <Home size={16} />

              <span>
                Home
              </span>
            </Link>


            {/* DISCOVER */}

            <Link
              to="/discover"
              className={`app-nav-link ${
                isActive("/discover")
                  ? "app-nav-link-active"
                  : ""
              }`}
            >
              <Compass size={16} />

              <span>
                Discover
              </span>
            </Link>


            {/* MESSAGES */}

            <Link
              to="/messages"
              className={`app-nav-link ${
                isActive("/messages")
                  ? "app-nav-link-active"
                  : ""
              }`}
            >
              <MessageCircle size={16} />

              <span>
                Messages
              </span>
            </Link>


            {/* GROUPS */}

            <Link
              to="/groups"
              className={`app-nav-link ${
                isGroupsActive
                  ? "app-nav-link-active"
                  : ""
              }`}
            >
              <UsersRound size={16} />

              <span>
                Groups
              </span>
            </Link>


            {/* REQUESTS */}

            <Link
              to="/message-requests"
              className={`app-nav-link app-nav-link-requests ${
                isActive(
                  "/message-requests"
                )
                  ? "app-nav-link-active"
                  : ""
              }`}
            >

              <span className="app-nav-link-icon-wrapper">

                <MailPlus size={16} />

                {requestCount > 0 && (
                  <span
                    className="app-request-badge"
                    aria-label={`${requestCount} incoming connection requests`}
                  >
                    {requestCount > 99
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


          {/* RIGHT SIDE */}

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

              <Bell size={18} />

              {unreadCount > 0 && (
                <span className="app-notification-badge">
                  {unreadCount > 99
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
                  src={user.avatar}
                  alt=""
                  className="app-navbar-avatar"
                />
              ) : (
                <UserRound size={18} />
              )}

            </Link>


            {/* LOGOUT */}

            <button
              type="button"
              className="app-navbar-logout"
              onClick={handleLogout}
              title="Log out"
              aria-label="Log out"
            >
              <LogOut size={17} />
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