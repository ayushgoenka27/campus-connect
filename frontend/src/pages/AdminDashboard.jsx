import { useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  EyeOff,
  Megaphone,
  MessageSquare,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  Trash2,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function AdminDashboard() {
  const { user } = useAuth();

  // Metrics
  const [stats, setStats] = useState({
    total_users: 0,
    active_users: 0,
    total_posts: 0,
    total_announcements: 0,
    pending_reports: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);

  // Active Tab: 'users' | 'reports'
  const [activeTab, setActiveTab] = useState("users");

  // Users tab state
  const [usersList, setUsersList] = useState([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [debouncedUserSearch, setDebouncedUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("");
  const [actionInProgress, setActionInProgress] = useState(null);
  const [userReloadTick, setUserReloadTick] = useState(0);

  // Reports tab state
  const [reportsList, setReportsList] = useState([]);
  const [reportsTotal, setReportsTotal] = useState(0);
  const [loadingReports, setLoadingReports] = useState(false);
  const [reportStatusFilter, setReportStatusFilter] = useState("pending");
  const [reportReloadTick, setReportReloadTick] = useState(0);

  // Moderation notes modal
  const [modModalOpen, setModModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [modAction, setModAction] = useState("");
  const [modNotes, setModNotes] = useState("");
  const [modSaving, setModSaving] = useState(false);

  // Toast
  const [toast, setToast] = useState(null);

  // Debounce user search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedUserSearch(userSearch);
    }, 300);
    return () => clearTimeout(handler);
  }, [userSearch]);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Fetch Stats
  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      setLoadingStats(true);
      try {
        const res = await client.get("/admin/stats");
        if (!cancelled) {
          setStats(res.data);
        }
      } catch (err) {
        console.error("Failed to load admin stats:", err);
      } finally {
        if (!cancelled) {
          setLoadingStats(false);
        }
      }
    }

    loadStats();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch Users
  useEffect(() => {
    if (activeTab !== "users") return;
    let cancelled = false;

    async function loadUsers() {
      setLoadingUsers(true);
      try {
        const params = {};
        if (debouncedUserSearch.trim()) params.search = debouncedUserSearch.trim();
        if (userRoleFilter) params.role = userRoleFilter;
        const res = await client.get("/admin/users", { params });
        if (!cancelled) {
          setUsersList(res.data.items || []);
          setUsersTotal(res.data.total || 0);
        }
      } catch (err) {
        console.error("Failed to load users:", err);
        if (!cancelled) {
          showToast("Failed to load users list", "error");
        }
      } finally {
        if (!cancelled) {
          setLoadingUsers(false);
        }
      }
    }

    loadUsers();
    return () => {
      cancelled = true;
    };
  }, [activeTab, userRoleFilter, debouncedUserSearch, userReloadTick]);

  // Fetch Reports
  useEffect(() => {
    if (activeTab !== "reports") return;
    let cancelled = false;

    async function loadReports() {
      setLoadingReports(true);
      try {
        const params = {};
        if (reportStatusFilter) params.status = reportStatusFilter;
        const res = await client.get("/admin/reports", { params });
        if (!cancelled) {
          setReportsList(res.data.items || []);
          setReportsTotal(res.data.total || 0);
        }
      } catch (err) {
        console.error("Failed to load reports:", err);
        if (!cancelled) {
          showToast("Failed to load reports queue", "error");
        }
      } finally {
        if (!cancelled) {
          setLoadingReports(false);
        }
      }
    }

    loadReports();
    return () => {
      cancelled = true;
    };
  }, [activeTab, reportStatusFilter, reportReloadTick]);

  // Handle user search submit
  const handleUserSearchSubmit = (e) => {
    e.preventDefault();
    setUserReloadTick((t) => t + 1);
  };

  // Toggle user activation status
  const handleToggleUserStatus = async (targetUser) => {
    const newStatus = !targetUser.is_active;
    const confirmMsg = newStatus
      ? `Reactivate account for ${targetUser.full_name}?`
      : `Deactivate account for ${targetUser.full_name}? They will immediately lose access to the platform.`;

    if (!window.confirm(confirmMsg)) return;

    setActionInProgress(targetUser.id);
    try {
      const res = await client.patch(`/admin/users/${targetUser.id}/status`, {
        is_active: newStatus,
      });
      setUsersList((prev) =>
        prev.map((u) => (u.id === targetUser.id ? res.data : u))
      );
      showToast(
        newStatus
          ? `Account ${targetUser.username} activated`
          : `Account ${targetUser.username} deactivated`
      );
      // Refresh stats
      const statsRes = await client.get("/admin/stats");
      setStats(statsRes.data);
    } catch (err) {
      const detail = err.response?.data?.detail || "Status update failed";
      showToast(detail, "error");
    } finally {
      setActionInProgress(null);
    }
  };

  // Open moderation modal
  const openModerationModal = (report, action) => {
    setSelectedReport(report);
    setModAction(action);
    setModNotes("");
    setModModalOpen(true);
  };

  // Submit report moderation action
  const handleModerateReport = async (e) => {
    e.preventDefault();
    if (!selectedReport || !modAction) return;

    setModSaving(true);
    try {
      const res = await client.patch(`/admin/reports/${selectedReport.id}`, {
        action: modAction,
        notes: modNotes.trim() || undefined,
      });
      setReportsList((prev) =>
        prev.map((r) => (r.id === selectedReport.id ? res.data : r))
      );
      showToast(`Report #${selectedReport.id} resolved with action '${modAction}'`);
      setModModalOpen(false);
      // Refresh stats
      const statsRes = await client.get("/admin/stats");
      setStats(statsRes.data);
    } catch (err) {
      const detail = err.response?.data?.detail || "Moderation action failed";
      showToast(detail, "error");
    } finally {
      setModSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-xl transition-all ${
            toast.type === "error"
              ? "bg-red-600 text-white"
              : "bg-slate-900 text-white"
          }`}
        >
          {toast.type === "error" ? <AlertCircle size={18} /> : <Check size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col gap-3 rounded-2xl bg-white p-6 shadow-sm border border-slate-200/80 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-white shadow-md">
            <Shield size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Administrator Console
            </h1>
            <p className="text-xs text-slate-500 sm:text-sm">
              Platform governance, moderation queue, user directory and system analytics.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            if (activeTab === "users") setUserReloadTick((t) => t + 1);
            else setReportReloadTick((t) => t + 1);
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
        >
          <RefreshCw size={14} /> Refresh Data
        </button>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Users
            </span>
            <Users size={16} />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {loadingStats ? "—" : stats.total_users}
          </p>
          <p className="mt-1 text-[11px] text-emerald-600 font-medium">
            {stats.active_users} active accounts
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Active Users
            </span>
            <UserCheck size={16} />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {loadingStats ? "—" : stats.active_users}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            {stats.total_users - stats.active_users} deactivated
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Posts
            </span>
            <MessageSquare size={16} />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {loadingStats ? "—" : stats.total_posts}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">Community feed</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Notices
            </span>
            <Megaphone size={16} />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {loadingStats ? "—" : stats.total_announcements}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">Announcements</p>
        </div>

        <div
          className={`rounded-2xl border p-4 shadow-sm col-span-2 sm:col-span-1 ${
            stats.pending_reports > 0
              ? "border-amber-300 bg-amber-50/40"
              : "border-slate-200/80 bg-white"
          }`}
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Pending Reports
            </span>
            <ShieldAlert
              size={16}
              className={stats.pending_reports > 0 ? "text-amber-600" : ""}
            />
          </div>
          <p
            className={`mt-2 text-2xl font-bold ${
              stats.pending_reports > 0 ? "text-amber-700" : "text-slate-900"
            }`}
          >
            {loadingStats ? "—" : stats.pending_reports}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">Awaiting review</p>
        </div>
      </div>

      {/* Tabs navigation: User Directory vs Moderation Queue */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("users")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
            activeTab === "users"
              ? "border-slate-950 text-slate-950"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Users size={16} />
          <span>User Management</span>
          <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
            {usersTotal}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("reports")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
            activeTab === "reports"
              ? "border-slate-950 text-slate-950"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <ShieldAlert size={16} />
          <span>Moderation Queue</span>
          {reportsTotal > 0 && (
            <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
              {reportsTotal}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: USERS DIRECTORY */}
      {activeTab === "users" && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm border border-slate-200/80 sm:flex-row sm:items-center sm:justify-between">
            <form onSubmit={handleUserSearchSubmit} className="relative flex-1 max-w-md">
              <Search
                size={17}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search by name, @username or institutional email..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white"
              />
            </form>

            <div className="flex items-center gap-2">
              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-700 outline-none transition focus:border-slate-400 focus:bg-white"
              >
                <option value="">All Roles</option>
                <option value="student">Student</option>
                <option value="admin">Administrator</option>
              </select>

              <button
                onClick={() => setUserReloadTick((t) => t + 1)}
                className="h-10 rounded-xl bg-slate-950 px-4 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 transition"
              >
                Search
              </button>
            </div>
          </div>

          {/* Users Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3.5">Student / User</th>
                    <th className="px-4 py-3.5">Role</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5">Joined</th>
                    <th className="px-5 py-3.5 text-right">Account Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {loadingUsers ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                        Loading user directory...
                      </td>
                    </tr>
                  ) : usersList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                        No users matching the current criteria.
                      </td>
                    </tr>
                  ) : (
                    usersList.map((u) => {
                      const isSelf = u.id === user?.id;
                      return (
                        <tr key={u.id} className="hover:bg-slate-50/50 transition">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">
                                {u.full_name ? u.full_name[0] : "U"}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-slate-900">
                                    {u.full_name}
                                  </span>
                                  {isSelf && (
                                    <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] font-medium text-slate-500">
                                      You
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-slate-400">
                                  @{u.username} • {u.email}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3.5">
                            <span
                              className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium capitalize ${
                                u.role === "admin" || u.role === "administrator"
                                  ? "bg-purple-50 text-purple-700 border border-purple-200"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {u.role}
                            </span>
                          </td>

                          <td className="px-4 py-3.5">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                u.is_active
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-red-50 text-red-600"
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  u.is_active ? "bg-emerald-500" : "bg-red-500"
                                }`}
                              />
                              {u.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>

                          <td className="px-4 py-3.5 text-xs text-slate-400">
                            {new Date(u.created_at).toLocaleDateString()}
                          </td>

                          <td className="px-5 py-3.5 text-right">
                            {isSelf ? (
                              <span className="text-xs text-slate-400 italic">
                                Protected
                              </span>
                            ) : (
                              <button
                                onClick={() => handleToggleUserStatus(u)}
                                disabled={actionInProgress === u.id}
                                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                                  u.is_active
                                    ? "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                                    : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                                }`}
                              >
                                {actionInProgress === u.id
                                  ? "Updating..."
                                  : u.is_active
                                  ? "Deactivate"
                                  : "Reactivate"}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MODERATION QUEUE */}
      {activeTab === "reports" && (
        <div className="space-y-4">
          {/* Status Filter Buttons */}
          <div className="flex items-center gap-2">
            {["pending", "resolved", "dismissed"].map((st) => (
              <button
                key={st}
                onClick={() => setReportStatusFilter(st)}
                className={`rounded-xl px-4 py-1.5 text-xs font-semibold capitalize transition ${
                  reportStatusFilter === st
                    ? "bg-slate-950 text-white shadow-sm"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Reports Card List */}
          {loadingReports ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-400 text-xs">
              Loading moderation reports...
            </div>
          ) : reportsList.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500 mb-2" />
              <h3 className="text-sm font-bold text-slate-900">
                All clear! No {reportStatusFilter} reports
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                The community moderation queue is currently empty.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {reportsList.map((rep) => (
                <div
                  key={rep.id}
                  className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700 uppercase">
                        Report #{rep.id}
                      </span>
                      <span className="rounded-full bg-red-50 border border-red-200 px-2.5 py-0.5 text-xs font-semibold text-red-600 capitalize">
                        {rep.reason.replace("_", " ")}
                      </span>
                      <span className="text-xs text-slate-400 capitalize">
                        Target: {rep.target_type} #{rep.target_id}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Clock size={13} />
                      {new Date(rep.created_at).toLocaleString()}
                    </div>
                  </div>

                  {/* Preview of reported content */}
                  <div className="my-3 rounded-xl bg-slate-50 p-3.5 border border-slate-100 text-xs text-slate-700 leading-relaxed font-mono">
                    <span className="font-sans font-semibold text-slate-500 block mb-1">
                      Reported Content Snapshot:
                    </span>
                    {rep.target_preview || (
                      <span className="italic text-slate-400">
                        Content was deleted or preview unavailable.
                      </span>
                    )}
                  </div>

                  {rep.details && (
                    <p className="text-xs text-slate-500 mb-3">
                      <span className="font-semibold text-slate-700">Reporter's note:</span>{" "}
                      {rep.details}
                    </p>
                  )}

                  {/* Resolution Footer */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs">
                    <div>
                      {rep.status === "pending" ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                          <AlertTriangle size={14} /> Pending Administrator Review
                        </span>
                      ) : (
                        <span className="text-slate-500">
                          Resolved:{" "}
                          <span className="font-semibold capitalize text-slate-800">
                            {rep.action_taken || rep.status}
                          </span>
                        </span>
                      )}
                    </div>

                    {/* Pending actions */}
                    {rep.status === "pending" && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openModerationModal(rep, "hide")}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                        >
                          <EyeOff size={13} /> Hide Content
                        </button>

                        <button
                          onClick={() => openModerationModal(rep, "remove")}
                          className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition"
                        >
                          <Trash2 size={13} /> Remove
                        </button>

                        <button
                          onClick={() => openModerationModal(rep, "dismiss")}
                          className="inline-flex items-center gap-1 rounded-xl bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition"
                        >
                          <Check size={13} /> Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Moderation Notes Modal */}
      {modModalOpen && selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 capitalize">
                Confirm Moderation: {modAction}
              </h3>
              <button
                onClick={() => setModModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleModerateReport} className="mt-4 space-y-4">
              <p className="text-xs text-slate-600">
                You are about to <strong className="uppercase">{modAction}</strong> reported{" "}
                {selectedReport.target_type} #{selectedReport.target_id}. An audit entry will be logged.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Audit Notes / Reason (Optional)
                </label>
                <textarea
                  value={modNotes}
                  onChange={(e) => setModNotes(e.target.value)}
                  placeholder="Provide context for this moderation decision..."
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs outline-none transition focus:border-slate-400 focus:bg-white resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modSaving}
                  className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
                >
                  {modSaving ? "Processing..." : "Confirm Action"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
