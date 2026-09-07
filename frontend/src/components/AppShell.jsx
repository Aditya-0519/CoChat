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
  getMessageRequests,
} from "../services/conversationService";


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
   * MESSAGE REQUEST BADGE
   * =====================================================
   *
   * IMPORTANT:
   *
   * The Requests page uses:
   *
   * /api/conversations/requests
   *
   * through getMessageRequests().
   *
   * We use the exact same API here.
   */

  const [
    messageRequestCount,
    setMessageRequestCount,
  ] = useState(0);


  const isActive = (path) =>
    location.pathname === path;


  const isGroupsActive =
    location.pathname.startsWith(
      "/groups"
    );


  /*
   * =====================================================
   * LOAD MESSAGE REQUEST COUNT
   * =====================================================
   */

  useEffect(() => {
    if (!user?._id) {
      setMessageRequestCount(0);
      return undefined;
    }

    let cancelled = false;

    const loadMessageRequestCount =
      async () => {
        try {
          const data =
            await getMessageRequests();

          if (cancelled) return;

          const requests =
            Array.isArray(data?.requests)
              ? data.requests
              : [];

          setMessageRequestCount(
            requests.length
          );
        } catch (error) {
          if (!cancelled) {
            console.error(
              "Unable to load message request count:",
              error
            );
          }
        }
      };

    /*
     * Load immediately when the
     * navbar mounts.
     */
    loadMessageRequestCount();


    /*
     * Keep the badge synchronized even
     * if the socket event is missed.
     */
    const interval =
      window.setInterval(
        loadMessageRequestCount,
        10000
      );


    /*
     * Refresh when user returns to
     * the browser tab.
     */
    const handleVisibilityChange =
      () => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          loadMessageRequestCount();
        }
      };

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
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
    };
  }, [user?._id]);


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
   * REALTIME NOTIFICATIONS
   * =====================================================
   *
   * Every persistent notification created by the
   * backend is sent through:
   *
   * notification:new
   *
   * A message request is one of those notifications.
   */

  useEffect(() => {
    if (!user?._id) {
      return undefined;
    }

    const handleNotification =
      (notification) => {

        /*
         * Update normal notification badge.
         */
        setUnreadCount(
          (current) =>
            current + 1
        );


        /*
         * If this notification is a new
         * message request, immediately
         * reload the real pending request
         * count.
         */
        if (
          notification?.type ===
          "message-request"
        ) {
          getMessageRequests()
            .then((data) => {
              const requests =
                Array.isArray(
                  data?.requests
                )
                  ? data.requests
                  : [];

              setMessageRequestCount(
                requests.length
              );
            })
            .catch((error) => {
              console.error(
                "Unable to refresh message request count:",
                error
              );
            });
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
  }, [user?._id]);


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


            {/* =================================================
                REQUESTS
            ================================================= */}

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


                {messageRequestCount >
                  0 && (
                  <span
                    className="app-request-badge"
                    aria-label={`${messageRequestCount} incoming message requests`}
                  >
                    {messageRequestCount >
                    99
                      ? "99+"
                      : messageRequestCount}
                  </span>
                )}

              </span>


              <span>
                Requests
              </span>

            </Link>

          </nav>


          {/* =================================================
              RIGHT SIDE
          ================================================= */}

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