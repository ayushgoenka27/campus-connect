import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Lock,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import client from "../api/client";

export default function Settings() {
  const { user, updateToken, logout } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setSuccessMessage("");
    setErrorMessage("");

    if (!currentPassword) {
      setErrorMessage("Please enter your current password.");
      return;
    }
    if (newPassword.length < 8) {
      setErrorMessage("New password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage("New password and confirm password do not match.");
      return;
    }
    if (newPassword === currentPassword) {
      setErrorMessage("New password must be different from your current password.");
      return;
    }

    setLoading(true);
    try {
      const res = await client.post("/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      // Update current session with the fresh token issued with updated token_version
      if (res.data?.access_token) {
        if (updateToken) {
          updateToken(res.data.access_token);
        } else {
          localStorage.setItem("campus_connect_token", res.data.access_token);
        }
      }

      setSuccessMessage(
        "Password changed successfully! All other active sessions and tokens have been revoked."
      );
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setErrorMessage(
        err.response?.data?.detail || "Failed to change password. Please check your inputs."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Account Settings
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your credentials, session security, and account preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {/* Left: Account Summary */}
        <div className="space-y-6 md:col-span-1">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-950 font-bold text-white text-sm">
                {user?.full_name ? user.full_name[0].toUpperCase() : "U"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900">
                  {user?.full_name || "Campus Student"}
                </p>
                <p className="truncate text-xs text-slate-400">@{user?.username}</p>
              </div>
            </div>

            <div className="mt-4 space-y-3 text-xs text-slate-600">
              <div>
                <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Email
                </span>
                <span className="truncate block font-medium mt-0.5">{user?.email}</span>
              </div>

              <div>
                <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Role
                </span>
                <span className="capitalize block font-medium mt-0.5">
                  {user?.role || "Student"}
                </span>
              </div>

              {user?.course && (
                <div>
                  <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Course & Branch
                  </span>
                  <span className="block font-medium mt-0.5">
                    {user.course} - {user.branch || "General"}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Security Info Card */}
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5 text-indigo-950">
            <div className="flex items-center gap-2 font-semibold text-xs text-indigo-900 mb-2">
              <ShieldCheck size={16} className="text-indigo-600" />
              <span>Session Invalidation</span>
            </div>
            <p className="text-xs text-indigo-800/80 leading-relaxed">
              When you update your password, your account’s token version is immediately
              incremented. Any open browser tabs, mobile sessions, or WebSocket connections
              are terminated instantly.
            </p>
          </div>
        </div>

        {/* Right: Security & Password Form */}
        <div className="space-y-6 md:col-span-2">
          {/* Change Password Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <KeyRound size={18} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Change Password</h2>
                <p className="text-xs text-slate-400">
                  Choose a strong, unique password of at least 8 characters.
                </p>
              </div>
            </div>

            <form onSubmit={handlePasswordChange} className="mt-6 space-y-4">
              {successMessage && (
                <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-800 animate-in fade-in-50">
                  <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span>{successMessage}</span>
                </div>
              )}

              {errorMessage && (
                <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700 animate-in fade-in-50">
                  <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Current Password *
                </label>
                <div className="relative mt-1">
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-slate-400 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  New Password (min 8 characters) *
                </label>
                <div className="relative mt-1">
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-slate-400 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Confirm New Password *
                </label>
                <div className="relative mt-1">
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-slate-400 transition"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
                >
                  <Lock size={14} />
                  <span>{loading ? "Updating..." : "Update Password"}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Session Invalidation CTA */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Sign Out Everywhere</h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  End your current session on this device.
                </p>
              </div>
              <button
                onClick={logout}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
