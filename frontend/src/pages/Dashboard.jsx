import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  MoreHorizontal,
  Search,
  Sparkles,
  Users,
  UserRound,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";

// ── Helpers ──────────────────────────────────────────────────────

function getInitials(fullName) {
  if (!fullName) return "?";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getProfileCompletion(user) {
  if (!user) return 0;
  const optionalFields = [
    user.bio,
    user.course,
    user.branch,
    user.year,
    user.profile_image,
  ];
  const filled = optionalFields.filter(Boolean).length;
  // 40% base (name + username + email always set), 60% from optional fields
  return 40 + Math.round((filled / optionalFields.length) * 60);
}

function getMemberSince(createdAt) {
  if (!createdAt) return "—";
  return new Date(createdAt).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
  });
}

// ── Person card connect button ────────────────────────────────────

function ConnectButton({ userId, connectionMap, currentUserId, connectingTo, onConnect }) {
  const conn = connectionMap[userId];
  const isConnecting = connectingTo.has(userId);

  if (isConnecting) {
    return (
      <button
        disabled
        className="mt-5 w-full rounded-xl bg-slate-100 py-2.5 text-xs font-semibold text-slate-400 cursor-not-allowed"
      >
        Connecting…
      </button>
    );
  }

  if (!conn) {
    return (
      <button
        onClick={() => onConnect(userId)}
        className="mt-5 w-full rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-700 transition hover:border-slate-950 hover:bg-slate-950 hover:text-white"
      >
        Connect
      </button>
    );
  }

  if (conn.status === "pending") {
    if (conn.sender_id === currentUserId) {
      return (
        <button
          disabled
          className="mt-5 w-full rounded-xl bg-slate-100 py-2.5 text-xs font-semibold text-slate-500 cursor-not-allowed"
        >
          Request Sent
        </button>
      );
    }
    return (
      <button
        disabled
        className="mt-5 w-full rounded-xl border border-amber-200 bg-amber-50 py-2.5 text-xs font-semibold text-amber-700 cursor-not-allowed"
      >
        Wants to Connect
      </button>
    );
  }

  if (conn.status === "accepted") {
    return (
      <button
        disabled
        className="mt-5 w-full rounded-xl border border-emerald-200 bg-emerald-50 py-2.5 text-xs font-semibold text-emerald-700 cursor-not-allowed"
      >
        ✓ Connected
      </button>
    );
  }

  // Rejected or other — show connect again (backend will 409; handled gracefully)
  return (
    <button
      onClick={() => onConnect(userId)}
      className="mt-5 w-full rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-700 transition hover:border-slate-950 hover:bg-slate-950 hover:text-white"
    >
      Connect
    </button>
  );
}

// ── Skeleton loader ───────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="h-12 w-12 rounded-full bg-slate-200" />
        <div className="h-5 w-5 rounded bg-slate-200" />
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-4 w-3/4 rounded bg-slate-200" />
        <div className="h-3 w-1/2 rounded bg-slate-200" />
      </div>
      <div className="mt-4 space-y-1">
        <div className="h-3 w-full rounded bg-slate-200" />
        <div className="h-3 w-2/3 rounded bg-slate-200" />
      </div>
      <div className="mt-5 h-9 w-full rounded-xl bg-slate-200" />
    </div>
  );
}

// ── Main Dashboard component ─────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [connections, setConnections] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [connectError, setConnectError] = useState("");
  const [connectingTo, setConnectingTo] = useState(new Set());

  // ── Fetch dashboard data ─────────────────────────────────────

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const fetchData = async () => {
      setLoadingData(true);
      try {
        const [connRes, usersRes] = await Promise.all([
          api.get("/connections"),
          api.get("/users"),
        ]);
        if (!cancelled) {
          setConnections(connRes.data);
          setAllUsers(usersRes.data);
        }
      } catch (err) {
        // Silently degrade — the page still renders with empty state
        console.error("Dashboard fetch error:", err);
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [user]);

  // ── Computed values ──────────────────────────────────────────

  const connectionMap = useMemo(() => {
    const map = {};
    connections.forEach((conn) => {
      const otherId =
        conn.sender_id === user?.id ? conn.receiver_id : conn.sender_id;
      map[otherId] = conn;
    });
    return map;
  }, [connections, user?.id]);

  const stats = useMemo(() => {
    const accepted = connections.filter((c) => c.status === "accepted").length;
    const incomingPending = connections.filter(
      (c) => c.receiver_id === user?.id && c.status === "pending"
    ).length;
    const outgoingPending = connections.filter(
      (c) => c.sender_id === user?.id && c.status === "pending"
    ).length;
    const profilePct = getProfileCompletion(user);
    return { accepted, incomingPending, outgoingPending, profilePct };
  }, [connections, user]);

  const suggestedUsers = useMemo(() => {
    if (!user) return [];
    return allUsers
      .filter((u) => u.id !== user.id)
      .filter((u) => {
        const conn = connectionMap[u.id];
        return !conn || conn.status !== "accepted";
      })
      .slice(0, 6);
  }, [allUsers, user, connectionMap]);

  // ── Connect action ───────────────────────────────────────────

  const handleConnect = async (targetUserId) => {
    setConnectError("");
    setConnectingTo((prev) => new Set([...prev, targetUserId]));

    // Optimistic update
    const optimistic = {
      id: `opt-${targetUserId}`,
      sender_id: user.id,
      receiver_id: targetUserId,
      status: "pending",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setConnections((prev) => [...prev, optimistic]);

    try {
      const response = await api.post(`/connections/${targetUserId}`);
      // Replace optimistic with real data
      setConnections((prev) => [
        ...prev.filter((c) => c.id !== optimistic.id),
        response.data.connection,
      ]);
    } catch (err) {
      // Revert optimistic update
      setConnections((prev) => prev.filter((c) => c.id !== optimistic.id));

      if (err.response?.status === 409) {
        // Already a connection — refresh to get real state
        try {
          const refresh = await api.get("/connections");
          setConnections(refresh.data);
        } catch (refreshErr) {
          console.warn("Could not refresh connections:", refreshErr);
        }
      } else {
        const msg =
          err.response?.data?.detail || "Failed to send connection request.";
        setConnectError(msg);
        setTimeout(() => setConnectError(""), 4000);
      }
    } finally {
      setConnectingTo((prev) => {
        const next = new Set(prev);
        next.delete(targetUserId);
        return next;
      });
    }
  };

  const profileCompletion = stats.profilePct;
  const firstName = user?.full_name?.split(" ")[0] || "Student";

  // ── Render ───────────────────────────────────────────────────

  return (
    <>
      {/* Error toast */}
      {connectError && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertCircle size={16} className="flex-shrink-0" />
          {connectError}
        </div>
      )}

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-[28px] bg-slate-950 px-6 py-8 text-white shadow-xl shadow-slate-900/10 sm:px-9 sm:py-10">
        <div className="relative z-10 max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Campus Connect is live
          </div>

          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {getGreeting()}, {firstName}.
          </h2>

          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400 sm:text-base">
            Stay connected with your campus. Discover people, explore events
            and build meaningful connections.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <button
              onClick={() => navigate("/discover")}
              className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
            >
              Discover people
            </button>
            <button
              onClick={() => navigate("/connections")}
              className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              My connections
            </button>
          </div>
        </div>

        {/* Decorative circles */}
        <div className="absolute -right-20 -top-28 h-72 w-72 rounded-full border border-white/10" />
        <div className="absolute -right-8 -top-16 h-48 w-48 rounded-full border border-white/10" />
        <div className="absolute -bottom-28 right-24 h-56 w-56 rounded-full bg-white/[0.03]" />
      </section>

      {/* ── Stats ────────────────────────────────────────────── */}
      <section className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            label: "Connections",
            value: loadingData ? "—" : stats.accepted,
            detail: stats.accepted === 1 ? "connected peer" : "connected peers",
            icon: <Users size={16} className="text-emerald-500" />,
          },
          {
            label: "Pending",
            value: loadingData ? "—" : stats.incomingPending,
            detail: "awaiting your reply",
            icon: <Clock size={16} className="text-amber-500" />,
          },
          {
            label: "Sent",
            value: loadingData ? "—" : stats.outgoingPending,
            detail: "awaiting their reply",
            icon: <ChevronRight size={16} className="text-blue-500" />,
          },
          {
            label: "Profile",
            value: loadingData ? "—" : `${profileCompletion}%`,
            detail:
              profileCompletion === 100
                ? "fully complete"
                : "complete your profile",
            icon: <CheckCircle2 size={16} className="text-violet-500" />,
          },
        ].map(({ label, value, detail, icon }) => (
          <div
            key={label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-400">{label}</p>
              {icon}
            </div>
            <div className="mt-2 flex items-end justify-between gap-2">
              <p className="text-2xl font-bold tracking-tight">{value}</p>
              <span className="text-[10px] font-medium text-slate-400">
                {detail}
              </span>
            </div>
          </div>
        ))}
      </section>

      {/* ── Main grid ────────────────────────────────────────── */}
      <section className="mt-8 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">

        {/* Quick actions */}
        <div>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                Get started
              </p>
              <h3 className="mt-1 text-xl font-bold tracking-tight">
                What would you like to do?
              </h3>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                title: "Find people",
                description: "Discover students with similar interests",
                icon: Users,
                path: "/discover",
              },
              {
                title: "Explore events",
                description: "See what's happening around campus",
                icon: CalendarDays,
                path: "/events",
              },
              {
                title: "Study resources",
                description: "Access academic materials and guides",
                icon: BookOpen,
                path: "/resources",
              },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.title}
                  onClick={() => navigate(action.path)}
                  className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition group-hover:bg-slate-950 group-hover:text-white">
                      <Icon size={18} />
                    </div>
                    <ChevronRight
                      size={17}
                      className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-slate-700"
                    />
                  </div>

                  <h4 className="mt-5 text-sm font-bold">{action.title}</h4>
                  <p className="mt-1.5 text-xs leading-5 text-slate-400">
                    {action.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Profile completion */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                Your profile
              </p>
              <h3 className="mt-1 text-lg font-bold">
                {profileCompletion === 100 ? "Looking great!" : "Almost there"}
              </h3>
            </div>
            <UserRound size={19} className="text-slate-400" />
          </div>

          <div className="mt-6 flex items-center gap-4">
            {/* Circular progress */}
            <div className="relative flex h-16 w-16 flex-shrink-0 items-center justify-center">
              <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 36 36">
                <circle
                  cx="18"
                  cy="18"
                  r="15.9"
                  fill="none"
                  stroke="#f1f5f9"
                  strokeWidth="3"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15.9"
                  fill="none"
                  stroke="#0f172a"
                  strokeWidth="3"
                  strokeDasharray={`${profileCompletion} ${100 - profileCompletion}`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="text-sm font-bold">{profileCompletion}%</span>
            </div>

            <div>
              <p className="text-sm font-semibold">
                {profileCompletion === 100
                  ? "Profile complete"
                  : "Complete your profile"}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                {profileCompletion < 100
                  ? "Add your course, branch and bio to help people discover you."
                  : "Your profile is fully filled out. Great work!"}
              </p>
            </div>
          </div>

          {/* Missing fields summary */}
          {user && profileCompletion < 100 && (
            <div className="mt-4 space-y-1.5">
              {[
                { field: user.bio, label: "Bio" },
                { field: user.course, label: "Course" },
                { field: user.branch, label: "Branch" },
                { field: user.year, label: "Academic year" },
                { field: user.profile_image, label: "Profile photo" },
              ]
                .filter((f) => !f.field)
                .slice(0, 3)
                .map(({ label }) => (
                  <div key={label} className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="h-1 w-1 rounded-full bg-slate-300" />
                    {label} not set
                  </div>
                ))}
            </div>
          )}

          <button
            onClick={() => navigate("/profile")}
            className="mt-6 w-full rounded-xl bg-slate-950 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            {profileCompletion === 100 ? "View profile" : "Complete profile"}
          </button>
        </div>
      </section>

      {/* ── People you may know ───────────────────────────────── */}
      <section className="mt-8">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
              People you may know
            </p>
            <h3 className="mt-1 text-xl font-bold tracking-tight">
              Discover your campus
            </h3>
          </div>

          <button
            onClick={() => navigate("/discover")}
            className="hidden text-xs font-semibold text-slate-500 transition hover:text-slate-950 sm:flex sm:items-center sm:gap-1"
          >
            View all
            <ChevronRight size={14} />
          </button>
        </div>

        {loadingData ? (
          <div className="grid gap-4 md:grid-cols-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : suggestedUsers.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Search size={20} />
            </div>
            <p className="text-sm font-semibold text-slate-700">
              No new students to discover
            </p>
            <p className="mt-1 text-xs text-slate-400">
              You're connected with everyone so far — check back later.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {suggestedUsers.map((person) => (
              <div
                key={person.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  {person.profile_image ? (
                    <img
                      src={person.profile_image}
                      alt={person.full_name}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700">
                      {getInitials(person.full_name)}
                    </div>
                  )}

                  <button className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-100 hover:text-slate-700">
                    <MoreHorizontal size={17} />
                  </button>
                </div>

                <div className="mt-4">
                  <h4 className="text-sm font-bold">{person.full_name}</h4>
                  <p className="mt-0.5 text-xs text-slate-400">
                    @{person.username}
                  </p>
                </div>

                <div className="mt-4">
                  {person.course && (
                    <p className="text-xs font-medium text-slate-600">
                      {person.course}
                      {person.branch ? ` · ${person.branch}` : ""}
                    </p>
                  )}
                  {person.year && (
                    <p className="mt-1 text-xs text-slate-400">
                      Year {person.year}
                    </p>
                  )}
                  {!person.course && !person.year && (
                    <p className="text-xs text-slate-400">No course info</p>
                  )}
                </div>

                <ConnectButton
                  userId={person.id}
                  connectionMap={connectionMap}
                  currentUserId={user?.id}
                  connectingTo={connectingTo}
                  onConnect={handleConnect}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Member info footer ───────────────────────────────── */}
      <div className="mt-8 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-100">
          <Sparkles size={16} className="text-slate-500" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-700">
            Member since {getMemberSince(user?.created_at)}
          </p>
          <p className="text-xs text-slate-400">
            Welcome to Campus Connect. Build your network and make the most of your campus.
          </p>
        </div>
      </div>
    </>
  );
}

