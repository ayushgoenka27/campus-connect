import { useState, useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Bell,
  BookOpen,
  CalendarDays,
  Hash,
  Home,
  LogOut,
  Megaphone,
  MessageCircle,
  Search,
  Settings,
  Shield,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import client from "../api/client";

/** Derives two-letter initials from a full name. */
function getInitials(fullName) {
  if (!fullName) return "?";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const mainNavigation = [
  { label: "Dashboard", icon: Home, path: "/", end: true },
  { label: "Discover", icon: Search, path: "/discover" },
  { label: "Connections", icon: Users, path: "/connections" },
  { label: "Messages", icon: MessageCircle, path: "/messages" },
  { label: "Community", icon: Hash, path: "/community" },
  { label: "Events", icon: CalendarDays, path: "/events" },
  { label: "Announcements", icon: Megaphone, path: "/announcements" },
  { label: "Resources", icon: BookOpen, path: "/resources" },
];

/** Shared sidebar + topbar layout for all protected pages. */
export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenu, setMobileMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const isAdmin = user?.role === "admin" || user?.role === "administrator";

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    client
      .get("/conversations")
      .then((res) => {
        if (!cancelled && res.data?.items) {
          const total = res.data.items.reduce(
            (acc, c) => acc + (c.unread_count || 0),
            0
          );
          setUnreadCount(total);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const navLinkClass = ({ isActive }) =>
    `group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
      isActive
        ? "bg-slate-950 text-white shadow-md shadow-slate-900/10"
        : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
    }`;

  const navIconClass = (isActive) =>
    isActive
      ? "text-white"
      : "text-slate-400 group-hover:text-slate-700";

  return (
    <div className="min-h-screen bg-[#f7f8fc] text-slate-900">

      {/* Mobile overlay */}
      {mobileMenu && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenu(false)}
        />
      )}

      {/* ── Sidebar ───────────────────────────────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[270px] flex-col overflow-y-auto border-r border-slate-200 bg-white px-5 py-6 transition-transform duration-300 lg:translate-x-0 ${
          mobileMenu ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="mb-9 flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white shadow-lg shadow-slate-900/10">
              <span className="text-lg font-bold">C</span>
            </div>
            <div>
              <h1 className="text-[17px] font-bold tracking-tight">
                Campus Connect
              </h1>
              <p className="text-[11px] font-medium text-slate-400">
                Your campus, connected.
              </p>
            </div>
          </div>

          <button
            onClick={() => setMobileMenu(false)}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 lg:hidden"
            aria-label="Close menu"
          >
            <X size={19} />
          </button>
        </div>

        {/* Navigation */}
        <div className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
          Workspace
        </div>

        <nav className="space-y-1">
          {mainNavigation.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                className={navLinkClass}
                onClick={() => setMobileMenu(false)}
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      size={18}
                      strokeWidth={isActive ? 2.2 : 1.9}
                      className={navIconClass(isActive)}
                    />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.path === "/messages" && unreadCount > 0 && (
                      <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[10px] font-bold text-white">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Admin Navigation (Role-Gated) */}
        {isAdmin && (
          <div className="mt-4 pt-3 border-t border-slate-100">
            <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-purple-600">
              Governance
            </div>
            <NavLink
              to="/admin"
              className={navLinkClass}
              onClick={() => setMobileMenu(false)}
            >
              {({ isActive }) => (
                <>
                  <Shield
                    size={18}
                    strokeWidth={isActive ? 2.2 : 1.9}
                    className={navIconClass(isActive)}
                  />
                  Admin Console
                </>
              )}
            </NavLink>
          </div>
        )}

        {/* Bottom section */}
        <div className="mt-auto">
          {/* Promo card */}
          <div className="mb-4 rounded-2xl bg-slate-950 p-4 text-white">
            <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
              <Sparkles size={16} />
            </div>
            <p className="text-sm font-semibold">Make campus count.</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              Connect, collaborate and discover opportunities around you.
            </p>
          </div>

          {/* Settings link */}
          <NavLink
            to="/settings"
            className={navLinkClass}
            onClick={() => setMobileMenu(false)}
          >
            {({ isActive }) => (
              <>
                <Settings
                  size={18}
                  strokeWidth={isActive ? 2.2 : 1.9}
                  className={navIconClass(isActive)}
                />
                Settings
              </>
            )}
          </NavLink>

          {/* User info + logout */}
          <div className="mt-2 flex items-center gap-3 border-t border-slate-100 px-2 pt-4">
            <NavLink to="/profile" className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700 hover:ring-2 hover:ring-slate-300 transition">
              {user?.profile_image ? (
                <img
                  src={user.profile_image}
                  alt={user.full_name}
                  className="h-9 w-9 rounded-full object-cover"
                />
              ) : (
                getInitials(user?.full_name)
              )}
            </NavLink>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {user?.full_name || "Student"}
              </p>
              <p className="truncate text-xs text-slate-400">
                @{user?.username || ""}
              </p>
            </div>

            <button
              onClick={handleLogout}
              title="Sign out"
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
              aria-label="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────── */}
      <main className="min-h-screen lg:pl-[270px]">

        {/* Topbar */}
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 px-5 py-4 backdrop-blur-xl sm:px-8">
          <div className="mx-auto flex max-w-[1500px] items-center gap-4">

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenu(true)}
              className="rounded-xl border border-slate-200 p-2.5 text-slate-600 lg:hidden"
              aria-label="Open menu"
            >
              <span className="block h-0.5 w-5 bg-current" />
              <span className="mt-1 block h-0.5 w-5 bg-current" />
              <span className="mt-1 block h-0.5 w-5 bg-current" />
            </button>

            {/* Search */}
            <div className="relative hidden max-w-md flex-1 md:block">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Search students, events, communities..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white"
              />
            </div>

            {/* Right side: notifications + user */}
            <div className="ml-auto flex items-center gap-2">
              {/* Notifications bell */}
              <button
                className="relative rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                aria-label="Notifications"
              >
                <Bell size={19} />
              </button>

              <div className="ml-1 hidden h-8 w-px bg-slate-200 sm:block" />

              {/* User info */}
              <div className="hidden items-center gap-3 pl-2 sm:flex">
                <NavLink
                  to="/profile"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-white hover:opacity-80 transition"
                >
                  {user?.profile_image ? (
                    <img
                      src={user.profile_image}
                      alt={user.full_name}
                      className="h-9 w-9 rounded-full object-cover"
                    />
                  ) : (
                    getInitials(user?.full_name)
                  )}
                </NavLink>
                <div>
                  <p className="text-sm font-semibold leading-4">
                    {user?.full_name || "Student"}
                  </p>
                  <p className="mt-1 text-[11px] capitalize text-slate-400">
                    {user?.role || "Student"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page content (injected by child routes) */}
        <div className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 lg:py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

