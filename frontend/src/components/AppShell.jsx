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

function AppShell({ children }) {
  const location = useLocation();

  const {
    user,
    logout,
  } = useAuth();

  const [
    unreadCount,
    setUnreadCount,
  ] = useState(0);

  const isActive = (path) =>
    location.pathname === path;

  const isGroupsActive =
    location.pathname.startsWith(
      "/groups"
    );

  /*
   * Initial notification count.
   *
   * The request lives inside the effect so
   * React does not interpret the effect as
   * synchronously calling a state-changing
   * function.
   */
  useEffect(() => {
    if (!user?._id) {
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
   * Realtime notification listener.
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
        (current) => current + 1
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
   * Refresh count whenever the notifications
   * page is opened.
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
  }, [location.pathname]);

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
              <span>Home</span>
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
              <span>Discover</span>
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
              <span>Messages</span>
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
              <span>Groups</span>
            </Link>

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
              <MailPlus size={16} />
              <span>Requests</span>
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

              {unreadCount > 0 && (
                <span className="app-notification-badge">
                  {unreadCount > 99
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