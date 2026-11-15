import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  CheckCheck,
  Megaphone,
  ShieldAlert,
  Trash2,
  UserCheck,
  UserPlus,
} from "lucide-react";
import client from "../api/client";
import { useWebSocket } from "../hooks/useWebSocket";

function formatRelativeTime(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diffInSec = Math.floor((now - date) / 1000);

  if (diffInSec < 60) return "Just now";
  const diffInMin = Math.floor(diffInSec / 60);
  if (diffInMin < 60) return `${diffInMin}m ago`;
  const diffInHours = Math.floor(diffInMin / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;
  return date.toLocaleDateString();
}

function getNotificationIcon(type) {
  switch (type) {
    case "connection_request":
      return <UserPlus size={16} className="text-blue-600" />;
    case "connection_accepted":
      return <UserCheck size={16} className="text-emerald-600" />;
    case "announcement":
      return <Megaphone size={16} className="text-amber-600" />;
    case "moderation":
      return <ShieldAlert size={16} className="text-purple-600" />;
    default:
      return <Bell size={16} className="text-indigo-600" />;
  }
}

export default function NotificationsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Load unread count on mount
  useEffect(() => {
    let cancelled = false;
    client
      .get("/notifications/unread-count")
      .then((res) => {
        if (!cancelled && res.data) {
          setUnreadCount(res.data.unread_count || 0);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  // Real-time notification handler via WebSocket
  useWebSocket({
    onNotification: (newNotif) => {
      if (!newNotif) return;
      setUnreadCount((prev) => prev + 1);
      setNotifications((prev) => [newNotif, ...prev]);
    },
  });

  // Fetch full notifications list when dropdown is opened
  const fetchNotifications = () => {
    setLoading(true);
    client
      .get("/notifications?limit=15")
      .then((res) => {
        if (res.data?.items) {
          setNotifications(res.data.items);
          setUnreadCount(res.data.unread_count || 0);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const handleToggle = () => {
    if (!isOpen) {
      fetchNotifications();
    }
    setIsOpen((prev) => !prev);
  };

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Mark all notifications as read
  const handleMarkAllRead = async () => {
    try {
      await client.patch("/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  // Delete notification
  const handleDelete = async (e, notifId) => {
    e.stopPropagation();
    try {
      await client.delete(`/notifications/${notifId}`);
      setNotifications((prev) => {
        const target = prev.find((n) => n.id === notifId);
        if (target && !target.is_read) {
          setUnreadCount((c) => Math.max(0, c - 1));
        }
        return prev.filter((n) => n.id !== notifId);
      });
    } catch {
      // ignore
    }
  };

  // Click on notification item: mark read and deep-link
  const handleItemClick = async (notif) => {
    if (!notif.is_read) {
      try {
        await client.patch(`/notifications/${notif.id}/read`);
        setUnreadCount((prev) => Math.max(0, prev - 1));
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
        );
      } catch {
        // ignore
      }
    }
    setIsOpen(false);
    if (notif.link) {
      navigate(notif.link);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={handleToggle}
        className="relative rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none"
        aria-label="Notifications"
      >
        <Bell size={19} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white shadow-sm animate-in zoom-in-50">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white shadow-xl z-50 overflow-hidden animate-in fade-in-50 slide-in-from-top-2">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900">Notifications</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">
                  {unreadCount} unread
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition"
              >
                <CheckCheck size={14} />
                Mark all read
              </button>
            )}
          </div>

          {/* List Content */}
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-xs text-slate-400">
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <Bell size={20} />
                </div>
                <p className="text-sm font-medium text-slate-700">All caught up!</p>
                <p className="mt-0.5 text-xs text-slate-400">No new notifications at this time.</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleItemClick(notif)}
                  className={`group relative flex items-start gap-3 p-3.5 transition cursor-pointer ${
                    notif.is_read
                      ? "bg-white hover:bg-slate-50/80"
                      : "bg-indigo-50/30 hover:bg-indigo-50/60"
                  }`}
                >
                  {/* Icon */}
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 mt-0.5">
                    {getNotificationIcon(notif.type)}
                  </div>

                  {/* Body */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className={`text-xs font-semibold ${notif.is_read ? "text-slate-800" : "text-indigo-950"}`}>
                        {notif.title}
                      </p>
                      <span className="text-[10px] text-slate-400 flex-shrink-0">
                        {formatRelativeTime(notif.created_at)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-600 line-clamp-2">
                      {notif.content}
                    </p>
                  </div>

                  {/* Actions & Read dot */}
                  <div className="flex items-center gap-1.5 flex-shrink-0 self-center">
                    {!notif.is_read && (
                      <span className="h-2 w-2 rounded-full bg-indigo-600" />
                    )}
                    <button
                      onClick={(e) => handleDelete(e, notif.id)}
                      className="opacity-0 group-hover:opacity-100 rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 transition"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
