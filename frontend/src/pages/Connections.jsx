import { useState, useEffect, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  Search,
  MessageCircle,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Send,
  Inbox,
  UserPlus,
} from "lucide-react";
import api from "../api/client";

function getInitials(fullName) {
  if (!fullName) return "?";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDate(dateString) {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function Connections() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "connected";

  // Tab state: "connected" | "requests" | "sent"
  const [activeTab, setActiveTab] = useState(
    ["connected", "requests", "sent"].includes(initialTab) ? initialTab : "connected"
  );

  const [connected, setConnected] = useState([]);
  const [requests, setRequests] = useState([]);
  const [sent, setSent] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchFilter, setSearchFilter] = useState("");

  const [successToast, setSuccessToast] = useState("");
  const [errorToast, setErrorToast] = useState("");

  // In-flight action IDs (connection_id)
  const [actionInProgress, setActionInProgress] = useState(new Set());

  // Keep URL in sync with activeTab
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
    setSearchFilter("");
  };

  // Initial load effect
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [connRes, reqRes, sentRes] = await Promise.all([
          api.get("/connections/accepted"),
          api.get("/connections/requests"),
          api.get("/connections/sent"),
        ]);
        if (!cancelled) {
          setConnected(connRes.data);
          setRequests(reqRes.data);
          setSent(sentRes.data);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to fetch connection data:", err);
          setError("Failed to load connection data. Please check your connection and retry.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  // Manual retry handler
  const handleRetry = async () => {
    setLoading(true);
    setError("");
    try {
      const [connRes, reqRes, sentRes] = await Promise.all([
        api.get("/connections/accepted"),
        api.get("/connections/requests"),
        api.get("/connections/sent"),
      ]);
      setConnected(connRes.data);
      setRequests(reqRes.data);
      setSent(sentRes.data);
    } catch (err) {
      console.error("Failed to fetch connection data:", err);
      setError("Failed to load connection data. Please check your connection and retry.");
    } finally {
      setLoading(false);
    }
  };

  // Handle Accept Request (Optimistic UI)
  const handleAccept = async (item) => {
    const connId = item.connection_id;
    if (actionInProgress.has(connId)) return;

    // Save snapshot for rollback
    const prevRequests = [...requests];
    const prevConnected = [...connected];

    // Optimistic: remove from requests, append to connected
    setRequests((prev) => prev.filter((r) => r.connection_id !== connId));
    setConnected((prev) => [
      {
        ...item,
        status: "accepted",
        updated_at: new Date().toISOString(),
      },
      ...prev,
    ]);

    setActionInProgress((prev) => new Set(prev).add(connId));

    try {
      await api.patch(`/connections/${connId}?action=accepted`);
      setSuccessToast(`Accepted connection with ${item.user.full_name}!`);
      setTimeout(() => setSuccessToast(""), 4000);
    } catch (err) {
      // Rollback
      setRequests(prevRequests);
      setConnected(prevConnected);
      const msg = err.response?.data?.detail || "Failed to accept request.";
      setErrorToast(msg);
      setTimeout(() => setErrorToast(""), 4500);
    } finally {
      setActionInProgress((prev) => {
        const next = new Set(prev);
        next.delete(connId);
        return next;
      });
    }
  };

  // Handle Reject Request (Optimistic UI)
  const handleReject = async (item) => {
    const connId = item.connection_id;
    if (actionInProgress.has(connId)) return;

    const prevRequests = [...requests];
    setRequests((prev) => prev.filter((r) => r.connection_id !== connId));
    setActionInProgress((prev) => new Set(prev).add(connId));

    try {
      await api.patch(`/connections/${connId}?action=rejected`);
      setSuccessToast(`Declined request from ${item.user.full_name}.`);
      setTimeout(() => setSuccessToast(""), 4000);
    } catch (err) {
      setRequests(prevRequests);
      const msg = err.response?.data?.detail || "Failed to decline request.";
      setErrorToast(msg);
      setTimeout(() => setErrorToast(""), 4500);
    } finally {
      setActionInProgress((prev) => {
        const next = new Set(prev);
        next.delete(connId);
        return next;
      });
    }
  };

  // Handle Cancel Sent Request (Optimistic UI)
  const handleCancelSent = async (item) => {
    const connId = item.connection_id;
    if (actionInProgress.has(connId)) return;

    const prevSent = [...sent];
    setSent((prev) => prev.filter((s) => s.connection_id !== connId));
    setActionInProgress((prev) => new Set(prev).add(connId));

    try {
      await api.delete(`/connections/${connId}`);
      setSuccessToast(`Cancelled request to ${item.user.full_name}.`);
      setTimeout(() => setSuccessToast(""), 4000);
    } catch (err) {
      setSent(prevSent);
      const msg = err.response?.data?.detail || "Failed to cancel request.";
      setErrorToast(msg);
      setTimeout(() => setErrorToast(""), 4500);
    } finally {
      setActionInProgress((prev) => {
        const next = new Set(prev);
        next.delete(connId);
        return next;
      });
    }
  };

  // Handle Remove Accepted Connection (Optimistic UI with confirmation)
  const handleRemoveConnection = async (item) => {
    const connId = item.connection_id;
    if (actionInProgress.has(connId)) return;

    const confirmed = window.confirm(
      `Are you sure you want to remove ${item.user.full_name} from your connections?`
    );
    if (!confirmed) return;

    const prevConnected = [...connected];
    setConnected((prev) => prev.filter((c) => c.connection_id !== connId));
    setActionInProgress((prev) => new Set(prev).add(connId));

    try {
      await api.delete(`/connections/${connId}`);
      setSuccessToast(`Removed ${item.user.full_name} from connections.`);
      setTimeout(() => setSuccessToast(""), 4000);
    } catch (err) {
      setConnected(prevConnected);
      const msg = err.response?.data?.detail || "Failed to remove connection.";
      setErrorToast(msg);
      setTimeout(() => setErrorToast(""), 4500);
    } finally {
      setActionInProgress((prev) => {
        const next = new Set(prev);
        next.delete(connId);
        return next;
      });
    }
  };

  // Client-side search within active tab
  const displayedItems = useMemo(() => {
    let list = [];
    if (activeTab === "connected") list = connected;
    else if (activeTab === "requests") list = requests;
    else if (activeTab === "sent") list = sent;

    if (!searchFilter.trim()) return list;

    const term = searchFilter.toLowerCase().trim();
    return list.filter(
      (item) =>
        item.user.full_name?.toLowerCase().includes(term) ||
        item.user.username?.toLowerCase().includes(term) ||
        item.user.course?.toLowerCase().includes(term) ||
        item.user.branch?.toLowerCase().includes(term)
    );
  }, [activeTab, connected, requests, sent, searchFilter]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Toast Feedback */}
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

      {/* Page Header */}
      <div className="mb-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              My Connections
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage your academic network, review pending invites, and track your sent requests.
            </p>
          </div>

          <Link
            to="/discover"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            <UserPlus size={16} />
            <span>Discover New Students</span>
          </Link>
        </div>
      </div>

      {/* Tabs & Search Controls */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Navigation Tabs */}
        <div className="flex rounded-xl bg-slate-100 p-1">
          <button
            onClick={() => handleTabChange("connected")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
              activeTab === "connected"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Users size={15} />
            <span>Connected</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                activeTab === "connected"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              {connected.length}
            </span>
          </button>

          <button
            onClick={() => handleTabChange("requests")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
              activeTab === "requests"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Inbox size={15} />
            <span>Requests</span>
            {requests.length > 0 ? (
              <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white animate-pulse">
                {requests.length}
              </span>
            ) : (
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                0
              </span>
            )}
          </button>

          <button
            onClick={() => handleTabChange("sent")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
              activeTab === "sent"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Send size={15} />
            <span>Sent</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                activeTab === "sent"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              {sent.length}
            </span>
          </button>
        </div>

        {/* Search within Tab */}
        <div className="relative w-full sm:w-72">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder={`Filter ${activeTab}...`}
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-slate-950 focus:outline-none focus:ring-1 focus:ring-slate-950"
          />
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm animate-pulse"
            >
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-slate-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-slate-200" />
                  <div className="h-3 w-1/2 rounded bg-slate-100" />
                </div>
              </div>
              <div className="mt-5 h-8 rounded-xl bg-slate-100" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50/50 p-8 text-center">
          <AlertCircle size={32} className="mx-auto text-red-500" />
          <h3 className="mt-3 text-base font-semibold text-red-900">
            Unable to load connections
          </h3>
          <p className="mt-1 text-sm text-red-600">{error}</p>
          <button
            onClick={handleRetry}
            className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-red-700 transition"
          >
            Retry
          </button>
        </div>
      ) : displayedItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
          {activeTab === "connected" ? (
            <>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <Users size={28} />
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-900">
                No connections yet
              </h3>
              <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                {searchFilter
                  ? `No connections found matching "${searchFilter}".`
                  : "Start expanding your campus circle! Discover students by department or batch."}
              </p>
              {!searchFilter && (
                <Link
                  to="/discover"
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 transition"
                >
                  <Sparkles size={14} />
                  <span>Discover Students</span>
                </Link>
              )}
            </>
          ) : activeTab === "requests" ? (
            <>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-500">
                <Inbox size={28} />
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-900">
                No pending requests
              </h3>
              <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                {searchFilter
                  ? `No requests found matching "${searchFilter}".`
                  : "When other students want to connect with you, their requests will appear here."}
              </p>
            </>
          ) : (
            <>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <Send size={28} />
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-900">
                No outgoing requests
              </h3>
              <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                {searchFilter
                  ? `No sent requests found matching "${searchFilter}".`
                  : "You don't have any sent requests awaiting response right now."}
              </p>
              {!searchFilter && (
                <Link
                  to="/discover"
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 transition"
                >
                  <span>Find People to Connect</span>
                  <ArrowRight size={14} />
                </Link>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayedItems.map((item) => {
            const isProcessing = actionInProgress.has(item.connection_id);
            const user = item.user;

            return (
              <div
                key={item.connection_id}
                className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
              >
                <div>
                  {/* User Profile Info */}
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white shadow-sm ring-2 ring-slate-100">
                      {user.profile_image ? (
                        <img
                          src={user.profile_image}
                          alt={user.full_name}
                          className="h-12 w-12 rounded-full object-cover"
                        />
                      ) : (
                        getInitials(user.full_name)
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-base font-semibold text-slate-900">
                        {user.full_name}
                      </h3>
                      <p className="truncate text-xs font-medium text-slate-400">
                        @{user.username}
                      </p>

                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {user.course && (
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                            {user.course}
                          </span>
                        )}
                        {user.branch && (
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                            {user.branch}
                          </span>
                        )}
                        {user.year && (
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                            Year {user.year}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bio snippet if present */}
                  {user.bio && (
                    <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-slate-600">
                      {user.bio}
                    </p>
                  )}

                  {/* Timestamp info */}
                  <div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400">
                    <Clock size={12} />
                    <span>
                      {activeTab === "connected"
                        ? `Connected ${formatDate(item.updated_at || item.created_at)}`
                        : activeTab === "requests"
                        ? `Received ${formatDate(item.created_at)}`
                        : `Sent ${formatDate(item.created_at)}`}
                    </span>
                  </div>
                </div>

                {/* Tab Action Buttons */}
                <div className="mt-5 border-t border-slate-100 pt-4">
                  {/* Tab: Connected */}
                  {activeTab === "connected" && (
                    <div className="flex items-center gap-2">
                      <Link
                        to="/messages"
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-950 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
                      >
                        <MessageCircle size={14} />
                        <span>Message</span>
                      </Link>

                      <button
                        onClick={() => handleRemoveConnection(item)}
                        disabled={isProcessing}
                        title="Remove connection"
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}

                  {/* Tab: Received Requests */}
                  {activeTab === "requests" && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAccept(item)}
                        disabled={isProcessing}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-950 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
                      >
                        <UserCheck size={14} />
                        <span>{isProcessing ? "Accepting…" : "Accept"}</span>
                      </button>

                      <button
                        onClick={() => handleReject(item)}
                        disabled={isProcessing}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                      >
                        <UserX size={14} />
                        <span>Decline</span>
                      </button>
                    </div>
                  )}

                  {/* Tab: Sent Requests */}
                  {activeTab === "sent" && (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                        <Clock size={14} className="text-amber-500" />
                        <span>Pending reply</span>
                      </div>

                      <button
                        onClick={() => handleCancelSent(item)}
                        disabled={isProcessing}
                        className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      >
                        {isProcessing ? "Cancelling…" : "Cancel Request"}
                      </button>
                    </div>
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
