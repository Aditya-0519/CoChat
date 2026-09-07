import { useEffect, useState } from "react";
import {
  Bell,
  Check,
  CheckCheck,
  MessageCircle,
  UserPlus,
  UsersRound,
  UserCheck,
  X,
  ArrowRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { socket } from "../services/socket";
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "../services/notificationService";

import "./Notifications.css";

function Notifications() {
  const navigate = useNavigate();

  const [notifications, setNotifications] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

useEffect(() => {
  let mounted = true;

  const loadInitialNotifications =
    async () => {
      try {
        const data =
          await getNotifications();

        if (!mounted) return;

        setNotifications(
          data.notifications || []
        );
      } catch (err) {
        if (!mounted) return;

        setError(
          err.message ||
            "Unable to load notifications."
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

  loadInitialNotifications();

  return () => {
    mounted = false;
  };
}, []);
  useEffect(() => {
    const handleNewNotification =
      (notification) => {
        setNotifications((current) => {
          const exists = current.some(
            (item) =>
              item._id ===
              notification._id
          );

          if (exists) {
            return current;
          }

          return [
            notification,
            ...current,
          ].slice(0, 50);
        });
      };

    socket.on(
      "notification:new",
      handleNewNotification
    );

    return () => {
      socket.off(
        "notification:new",
        handleNewNotification
      );
    };
  }, []);

  const handleNotificationClick =
    async (notification) => {
      try {
        if (!notification.readAt) {
          await markNotificationAsRead(
            notification._id
          );

          setNotifications(
            (current) =>
              current.map((item) =>
                item._id ===
                notification._id
                  ? {
                      ...item,
                      readAt:
                        new Date().toISOString(),
                    }
                  : item
              )
          );
        }
      } catch (err) {
        console.error(
          "Unable to mark notification as read:",
          err
        );
      }

      if (notification.url) {
        navigate(notification.url);
      }
    };

  const handleMarkAllRead =
    async () => {
      try {
        await markAllNotificationsAsRead();

        setNotifications(
          (current) =>
            current.map((notification) => ({
              ...notification,
              readAt:
                notification.readAt ||
                new Date().toISOString(),
            }))
        );
      } catch (err) {
        console.error(
          "Unable to mark all notifications as read:",
          err
        );
      }
    };

  const getIcon = (type) => {
    switch (type) {
      case "connection-request":
        return <UserPlus size={19} />;

      case "connection-accepted":
        return <UserCheck size={19} />;

      case "message":
      case "message-request":
      case "message-request-accepted":
        return <MessageCircle size={19} />;

      case "group-created":
      case "group-added":
      case "group-message":
        return <UsersRound size={19} />;

      default:
        return <Bell size={19} />;
    }
  };

  const formatTime = (date) => {
    if (!date) return "";

    const now =
      new Date();

    const created =
      new Date(date);

    const seconds =
      Math.floor(
        (now - created) / 1000
      );

    if (seconds < 60) {
      return "Just now";
    }

    const minutes =
      Math.floor(seconds / 60);

    if (minutes < 60) {
      return `${minutes}m ago`;
    }

    const hours =
      Math.floor(minutes / 60);

    if (hours < 24) {
      return `${hours}h ago`;
    }

    const days =
      Math.floor(hours / 24);

    if (days < 7) {
      return `${days}d ago`;
    }

    return created.toLocaleDateString(
      undefined,
      {
        day: "numeric",
        month: "short",
      }
    );
  };

  const unreadCount =
    notifications.filter(
      (notification) =>
        !notification.readAt
    ).length;

  return (
    <div className="notifications-page">
      <div className="notifications-page-inner">

        <section className="notifications-header">
          <div>
            <div className="notifications-eyebrow">
              <Bell size={15} />
              YOUR ACTIVITY
            </div>

            <h1>
              Notifications
            </h1>

            <p>
              Stay updated with what is
              happening around you.
            </p>
          </div>

          {notifications.length > 0 && (
            <button
              type="button"
              className="notifications-mark-all"
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0}
            >
              <CheckCheck size={17} />
              Mark all as read
            </button>
          )}
        </section>

        {error && (
          <div className="notifications-error">
            <X size={18} />
            {error}
          </div>
        )}

        <section className="notifications-card">
          {loading ? (
            <div className="notifications-state">
              <div className="notifications-loader" />
              <p>
                Loading your notifications...
              </p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="notifications-empty">
              <div className="notifications-empty-icon">
                <Bell size={28} />
              </div>

              <h2>
                You're all caught up
              </h2>

              <p>
                New activity from your
                connections and groups will
                appear here.
              </p>

              <button
                type="button"
                onClick={() =>
                  navigate("/discover")
                }
              >
                Discover people
                <ArrowRight size={17} />
              </button>
            </div>
          ) : (
            <div className="notifications-list">
              {notifications.map(
                (notification) => (
                  <button
                    key={notification._id}
                    type="button"
                    className={`notification-item ${
                      !notification.readAt
                        ? "notification-item-unread"
                        : ""
                    }`}
                    onClick={() =>
                      handleNotificationClick(
                        notification
                      )
                    }
                  >
                    <div className="notification-avatar">
                      {notification.actor
                        ?.avatar ? (
                        <img
                          src={
                            notification
                              .actor
                              .avatar
                          }
                          alt=""
                        />
                      ) : (
                        getIcon(
                          notification.type
                        )
                      )}
                    </div>

                    <div className="notification-content">
                      <div className="notification-top">
                        <span className="notification-title">
                          {
                            notification.title
                          }
                        </span>

                        <span className="notification-time">
                          {formatTime(
                            notification.createdAt
                          )}
                        </span>
                      </div>

                      <p>
                        {
                          notification.body
                        }
                      </p>
                    </div>

                    {!notification.readAt && (
                      <span className="notification-unread-dot" />
                    )}

                    {notification.readAt && (
                      <Check
                        size={16}
                        className="notification-read-icon"
                      />
                    )}
                  </button>
                )
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default Notifications;