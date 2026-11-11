import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  Users,
  UserPlus,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
  ArrowRight,
  Filter,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";

function getInitials(fullName) {
  if (!fullName) return "?";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const COURSES = [
  "All Courses",
  "B.Tech",
  "M.Tech",
  "BCA",
  "MCA",
  "B.Sc",
  "M.Sc",
  "MBA",
  "B.Com",
];

const BRANCHES = [
  "All Branches",
  "Computer Science",
  "Information Technology",
  "Artificial Intelligence",
  "Electronics & Communication",
  "Electrical Engineering",
  "Mechanical Engineering",
  "Civil Engineering",
  "Data Science",
];

const YEARS = [
  { label: "All Years", value: "" },
  { label: "1st Year", value: "1" },
  { label: "2nd Year", value: "2" },
  { label: "3rd Year", value: "3" },
  { label: "4th Year", value: "4" },
];

export default function Discover() {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successToast, setSuccessToast] = useState("");
  const [errorToast, setErrorToast] = useState("");

  // Filters state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("All Courses");
  const [selectedBranch, setSelectedBranch] = useState("All Branches");
  const [selectedYear, setSelectedYear] = useState("");

  // In-flight connection actions: Set of user IDs
  const [connectingIds, setConnectingIds] = useState(new Set());

  // Fetch users with filters
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const params = {};
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (selectedCourse !== "All Courses") params.course = selectedCourse;
      if (selectedBranch !== "All Branches") params.branch = selectedBranch;
      if (selectedYear) params.year = parseInt(selectedYear, 10);

      const res = await api.get("/users", { params });
      setUsers(res.data);
    } catch (err) {
      console.error("Failed to fetch users:", err);
      setError("Failed to load campus directory. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedCourse, selectedBranch, selectedYear]);

  // Debounced search trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 300);

    return () => clearTimeout(timer);
  }, [fetchUsers]);

  // Handle send connection request with optimistic update & rollback
  const handleConnect = async (targetUser) => {
    if (connectingIds.has(targetUser.id)) return;

    // Save previous state for rollback
    const previousStatus = targetUser.connection_status;
    const previousConnId = targetUser.connection_id;

    // Optimistic UI update: mark as pending_sent immediately
    setUsers((prev) =>
      prev.map((u) =>
        u.id === targetUser.id
          ? { ...u, connection_status: "pending_sent" }
          : u
      )
    );

    setConnectingIds((prev) => new Set(prev).add(targetUser.id));
    setErrorToast("");

    try {
      const res = await api.post(`/connections/${targetUser.id}`);
      const newConnId = res.data?.connection?.id;

      // Update connection_id from response
      setUsers((prev) =>
        prev.map((u) =>
          u.id === targetUser.id
            ? { ...u, connection_status: "pending_sent", connection_id: newConnId }
            : u
        )
      );

      setSuccessToast(`Connection request sent to ${targetUser.full_name}!`);
      setTimeout(() => setSuccessToast(""), 4000);
    } catch (err) {
      // Rollback on failure
      setUsers((prev) =>
        prev.map((u) =>
          u.id === targetUser.id
            ? { ...u, connection_status: previousStatus, connection_id: previousConnId }
            : u
        )
      );

      const msg =
        err.response?.data?.detail ||
        `Failed to send request to ${targetUser.full_name}.`;
      setErrorToast(msg);
      setTimeout(() => setErrorToast(""), 4500);
    } finally {
      setConnectingIds((prev) => {
        const next = new Set(prev);
        next.delete(targetUser.id);
        return next;
      });
    }
  };

  const handleResetFilters = () => {
    setSearchTerm("");
    setSelectedCourse("All Courses");
    setSelectedBranch("All Branches");
    setSelectedYear("");
  };

  const isFiltered =
    searchTerm.trim() !== "" ||
    selectedCourse !== "All Courses" ||
    selectedBranch !== "All Branches" ||
    selectedYear !== "";

  // Separate non-self users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => u.id !== currentUser?.id);
  }, [users, currentUser?.id]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Toast notifications */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl bg-slate-950 px-4 py-3 text-sm font-medium text-white shadow-xl animate-in fade-in slide-in-from-bottom-3">
          <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {errorToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl bg-red-600 px-4 py-3 text-sm font-medium text-white shadow-xl animate-in fade-in slide-in-from-bottom-3">
          <AlertCircle size={18} className="shrink-0" />
          <span>{errorToast}</span>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Discover Students
              </h1>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                {filteredUsers.length} {filteredUsers.length === 1 ? "student" : "students"}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Find peers, project teammates, and study partners across your campus community.
            </p>
          </div>

          <Link
            to="/connections"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
          >
            <Users size={16} />
            <span>Manage My Connections</span>
            <ArrowRight size={14} className="text-slate-400" />
          </Link>
        </div>
      </div>

      {/* Search and Filters Card */}
      <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by student name or @username..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2.5 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-slate-950 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-950"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <Filter size={14} />
              <span>Filters:</span>
            </div>

            {/* Course Filter */}
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition focus:border-slate-950 focus:outline-none"
            >
              {COURSES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {/* Branch Filter */}
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition focus:border-slate-950 focus:outline-none"
            >
              {BRANCHES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>

            {/* Year Filter */}
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition focus:border-slate-950 focus:outline-none"
            >
              {YEARS.map((y) => (
                <option key={y.value} value={y.value}>
                  {y.label}
                </option>
              ))}
            </select>

            {/* Reset Filters button */}
            {isFiltered && (
              <button
                onClick={handleResetFilters}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition"
              >
                <X size={13} />
                <span>Reset filters</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Student Directory Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm animate-pulse"
            >
              <div>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-slate-200" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-3/4 rounded bg-slate-200" />
                    <div className="h-3 w-1/2 rounded bg-slate-100" />
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="h-3 w-full rounded bg-slate-100" />
                  <div className="h-3 w-5/6 rounded bg-slate-100" />
                </div>
              </div>
              <div className="mt-6 h-9 rounded-xl bg-slate-100" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50/50 p-8 text-center">
          <AlertCircle size={32} className="mx-auto text-red-500" />
          <h3 className="mt-3 text-base font-semibold text-red-900">
            Unable to load students
          </h3>
          <p className="mt-1 text-sm text-red-600">{error}</p>
          <button
            onClick={fetchUsers}
            className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-red-700 transition"
          >
            Retry
          </button>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <Users size={28} />
          </div>
          <h3 className="mt-4 text-base font-semibold text-slate-900">
            No students found
          </h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
            {isFiltered
              ? "We couldn't find any students matching your active search or filter criteria."
              : "No other student profiles are currently active in the directory."}
          </p>
          {isFiltered && (
            <button
              onClick={handleResetFilters}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 transition"
            >
              <X size={14} />
              <span>Clear all filters</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredUsers.map((targetUser) => {
            const isConnecting = connectingIds.has(targetUser.id);
            const status = targetUser.connection_status;

            return (
              <div
                key={targetUser.id}
                className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow-md"
              >
                <div>
                  {/* Avatar & Header */}
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white shadow-sm ring-2 ring-slate-100">
                      {targetUser.profile_image ? (
                        <img
                          src={targetUser.profile_image}
                          alt={targetUser.full_name}
                          className="h-12 w-12 rounded-full object-cover"
                        />
                      ) : (
                        getInitials(targetUser.full_name)
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-base font-semibold text-slate-900">
                        {targetUser.full_name}
                      </h3>
                      <p className="truncate text-xs font-medium text-slate-400">
                        @{targetUser.username}
                      </p>

                      {/* Course / Branch / Year Badge */}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {targetUser.course && (
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                            {targetUser.course}
                          </span>
                        )}
                        {targetUser.branch && (
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                            {targetUser.branch}
                          </span>
                        )}
                        {targetUser.year && (
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                            Year {targetUser.year}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bio */}
                  {targetUser.bio ? (
                    <p className="mt-4 line-clamp-2 text-xs leading-relaxed text-slate-600">
                      {targetUser.bio}
                    </p>
                  ) : (
                    <p className="mt-4 text-xs italic text-slate-400">
                      No bio shared yet.
                    </p>
                  )}
                </div>

                {/* Connect Action Button */}
                <div className="mt-6 pt-4 border-t border-slate-100">
                  {isConnecting ? (
                    <button
                      disabled
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 py-2.5 text-xs font-semibold text-slate-400 cursor-not-allowed"
                    >
                      <Clock size={14} className="animate-spin" />
                      <span>Connecting…</span>
                    </button>
                  ) : status === "accepted" ? (
                    <div className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/80 py-2.5 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 size={15} />
                      <span>Connected</span>
                    </div>
                  ) : status === "pending_sent" ? (
                    <div className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-semibold text-slate-500">
                      <Clock size={14} />
                      <span>Request Sent</span>
                    </div>
                  ) : status === "pending_received" ? (
                    <Link
                      to="/connections?tab=requests"
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 py-2.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
                    >
                      <Sparkles size={14} />
                      <span>Respond to Request</span>
                    </Link>
                  ) : (
                    <button
                      onClick={() => handleConnect(targetUser)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-950 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.99]"
                    >
                      <UserPlus size={15} />
                      <span>Connect</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

