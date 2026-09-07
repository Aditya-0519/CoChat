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
  useCallback,
  useEffect,
  useState,
} from "react";

import { useAuth } from "../context/useAuth";
import { socket } from "../services/socket";

import {
  getUnreadNotificationCount,
  registerNotificationWorker,
  syncNotificationSubscription,
} from "../services/notificationService";

import {
  getConnectionRequestCount,
} from "../services/connectionService";

function AppShell({ children }) {
  const location = useLocation();

  const {
    user,
    logout,
  } = useAuth();

  /*
   * =====================================================
   * NOTIFICATION BADGE
   * =====================================================
   */

  const [
    unreadCount,
    setUnreadCount,
  ] = useState(0);

  /*
   * =====================================================
   * CONNECTION REQUEST BADGE
   * =====================================================
   */

  const [
    pendingRequestCount,
    setPendingRequestCount,
  ] = useState(0);

  const isActive = (path) =>
    location.pathname === path;

  const isGroupsActive =
    location.pathname.startsWith(
      "/groups"
    );

  /*
   * =====================================================
   * LOAD PENDING CONNECTION REQUEST COUNT
   * =====================================================
   */

  const loadPendingRequestCount =
    useCallback(async () => {
      if (!user?._id) {
        return;
      }

      try {
        const data =
          await getConnectionRequestCount();

        setPendingRequestCount(
          Number(data?.count) || 0
        );
      } catch (error) {
        console.error(
          "Unable to load connection request count:",
          error
        );
      }
    }, [user?._id]);

  useEffect(() => {
    if (!user?._id) {
      setPendingRequestCount(0);
      return undefined;
    }

    let cancelled = false;

    const load = async () => {
      if (cancelled) return;

      await loadPendingRequestCount();
    };

    load();

    const interval =
      window.setInterval(
        load,
        10000
      );

    const handleVisibilityChange =
      () => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          load();
        }
      };

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    const handleLocalUpdate =
      () => {
        load();
      };

    window.addEventListener(
      "connection-request:updated",
      handleLocalUpdate
    );

    return () => {
      cancelled = true;

      window.clearInterval(
        interval
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );

      window.removeEventListener(
        "connection-request:updated",
        handleLocalUpdate
      );
    };
  }, [
    user?._id,
    loadPendingRequestCount,
  ]);

  /*
   * =====================================================
   * INITIAL UNREAD NOTIFICATION COUNT
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
   * SERVICE WORKER + PUSH SUBSCRIPTION SYNC
   * =====================================================
   *
   * Register the service worker for every authenticated
   * session.
   *
   * If notification permission has already been granted,
   * synchronize the existing push subscription silently.
   *
   * We NEVER request permission from AppShell.
   */

  useEffect(() => {
    if (!user?._id) {
      return undefined;
    }

    let cancelled = false;

    const setupNotifications =
      async () => {
        try {
          await registerNotificationWorker();

          if (
            cancelled
          ) {
            return;
          }

          if (
            "Notification" in window &&
            Notification.permission ===
              "granted"
          ) {
            await syncNotificationSubscription();
          }
        } catch (error) {
          console.error(
            "Notification setup error:",
            error
          );
        }
      };

    setupNotifications();

    return () => {
      cancelled = true;
    };
  }, [user?._id]);

  /*
   * =====================================================
   * SOCKET CONNECTION
   * =====================================================
   */

  useEffect(() => {
    if (!user?._id) {
      return undefined;
    }

    if (!socket.connected) {
      socket.connect();
    }

    return undefined;
  }, [user?._id]);

  /*
   * =====================================================
   * REALTIME: NEW CONNECTION REQUEST
   * =====================================================
   */

  useEffect(() => {
    if (!user?._id) {
      return undefined;
    }

    const handleNewConnectionRequest =
      () => {
        setPendingRequestCount(
          (current) =>
            current + 1
        );
      };

    socket.on(
      "connection-request",
      handleNewConnectionRequest
    );

    return () => {
      socket.off(
        "connection-request",
        handleNewConnectionRequest
      );
    };
  }, [user?._id]);

  /*
   * =====================================================
   * REALTIME: REQUEST UPDATED
   * =====================================================
   */

  useEffect(() => {
    if (!user?._id) {
      return undefined;
    }

    const handleRequestUpdated =
      () => {
        loadPendingRequestCount();
      };

    socket.on(
      "connection-request:updated",
      handleRequestUpdated
    );

    return () => {
      socket.off(
        "connection-request:updated",
        handleRequestUpdated
      );
    };
  }, [
    user?._id,
    loadPendingRequestCount,
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

    const handleNotification =
      (notification) => {
        setUnreadCount(
          (current) =>
            current + 1
        );

        if (
          notification?.type ===
            "connection-request" ||
          notification?.type ===
            "connection-accepted"
        ) {
          loadPendingRequestCount();
        }
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
  }, [
    user?._id,
    loadPendingRequestCount,
  ]);

  /*
   * =====================================================
   * REFRESH NOTIFICATION COUNT WHEN PAGE OPENS
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

    loadPendingRequestCount();
  }, [
    location.pathname,
    loadPendingRequestCount,
  ]);

  /*
   * =====================================================
   * LOGOUT
   * =====================================================
   */

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

                {pendingRequestCount >
                  0 && (
                  <span
                    className="app-request-badge"
                    aria-label={`${pendingRequestCount} incoming connection requests`}
                  >
                    {pendingRequestCount >
                    99
                      ? "99+"
                      : pendingRequestCount}
                  </span>
                )}

              </span>

              <span>
                Requests
              </span>

            </Link>

          </nav>

          <div className="app-navbar-actions">

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

            <button
              type="button"
              className="app-navbar-logout"
              onClick={
                handleLogout
              }
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