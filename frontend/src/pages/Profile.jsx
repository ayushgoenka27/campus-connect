import { useState } from "react";
import {
  User,
  Mail,
  GraduationCap,
  BookOpen,
  Calendar,
  Image as ImageIcon,
  FileText,
  CheckCircle2,
  AlertCircle,
  Save,
  Clock,
  Shield,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";

function getInitials(fullName) {
  if (!fullName) return "?";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDate(dateString) {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function Profile() {
  const { user, refreshUser } = useAuth();

  const [formData, setFormData] = useState({
    full_name: user?.full_name || "",
    bio: user?.bio || "",
    profile_image: user?.profile_image || "",
    course: user?.course || "",
    branch: user?.branch || "",
    year: user?.year !== null && user?.year !== undefined ? String(user.year) : "",
  });

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleStartEdit = () => {
    if (user) {
      setFormData({
        full_name: user.full_name || "",
        bio: user.bio || "",
        profile_image: user.profile_image || "",
        course: user.course || "",
        branch: user.branch || "",
        year: user.year !== null && user.year !== undefined ? String(user.year) : "",
      });
    }
    setErrorMessage("");
    setSuccessMessage("");
    setIsEditing(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setSaving(true);

    try {
      const payload = {
        full_name: formData.full_name.trim() || undefined,
        bio: formData.bio.trim() || null,
        profile_image: formData.profile_image.trim() || null,
        course: formData.course.trim() || null,
        branch: formData.branch.trim() || null,
        year: formData.year ? parseInt(formData.year, 10) : null,
      };

      await api.patch("/users/me", payload);
      await refreshUser();

      setSuccessMessage("Profile updated successfully!");
      setIsEditing(false);
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : "Failed to update profile. Please check your inputs.";
      setErrorMessage(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (user) {
      setFormData({
        full_name: user.full_name || "",
        bio: user.bio || "",
        profile_image: user.profile_image || "",
        course: user.course || "",
        branch: user.branch || "",
        year: user.year !== null && user.year !== undefined ? String(user.year) : "",
      });
    }
    setErrorMessage("");
    setIsEditing(false);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Student Profile
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your personal information, academic credentials, and public presence.
          </p>
        </div>

        {!isEditing && (
          <button
            onClick={handleStartEdit}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            Edit Profile
          </button>
        )}
      </div>

      {/* Alerts */}
      {successMessage && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 shadow-sm">
          <CheckCircle2 size={18} className="flex-shrink-0 text-emerald-600" />
          <p className="font-medium">{successMessage}</p>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-sm">
          <AlertCircle size={18} className="flex-shrink-0 text-red-600" />
          <p className="font-medium">{errorMessage}</p>
        </div>
      )}

      {/* Profile Overview Card */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
          {/* Avatar display */}
          <div className="relative flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-slate-100 bg-slate-950 text-2xl font-bold text-white shadow-md sm:h-28 sm:w-28">
            {user?.profile_image ? (
              <img
                src={user.profile_image}
                alt={user.full_name}
                className="h-full w-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <span>{getInitials(user?.full_name)}</span>
            )}
          </div>

          <div className="flex-1 space-y-2">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
              <h2 className="text-2xl font-bold text-slate-900">{user?.full_name}</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold capitalize text-slate-700">
                <Shield size={12} className="text-slate-500" />
                {user?.role || "student"}
              </span>
            </div>

            <p className="text-sm font-medium text-slate-500">@{user?.username}</p>

            <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
              {user?.bio || (
                <span className="italic text-slate-400">
                  No bio provided. Click "Edit Profile" to add an introduction.
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Profile Form / View Mode */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
          <h3 className="text-lg font-bold text-slate-900">
            {isEditing ? "Edit Academic & Personal Details" : "Academic & Account Details"}
          </h3>
          <span className="text-xs font-medium text-slate-400">
            {isEditing ? "All changes are saved to your account" : "Read-only view"}
          </span>
        </div>

        {isEditing ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              {/* Full Name */}
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    name="full_name"
                    required
                    minLength={2}
                    maxLength={100}
                    value={formData.full_name}
                    onChange={handleChange}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-4 focus:ring-slate-100"
                  />
                </div>
              </div>

              {/* Course */}
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Degree / Program
                </label>
                <div className="relative">
                  <GraduationCap size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    name="course"
                    placeholder="e.g. B.Tech, M.Sc, MBA"
                    maxLength={100}
                    value={formData.course}
                    onChange={handleChange}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-4 focus:ring-slate-100"
                  />
                </div>
              </div>

              {/* Branch */}
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Branch / Department
                </label>
                <div className="relative">
                  <BookOpen size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    name="branch"
                    placeholder="e.g. Computer Science, Mechanical"
                    maxLength={100}
                    value={formData.branch}
                    onChange={handleChange}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-4 focus:ring-slate-100"
                  />
                </div>
              </div>

              {/* Academic Year */}
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Academic Year
                </label>
                <div className="relative">
                  <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select
                    name="year"
                    value={formData.year}
                    onChange={handleChange}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-slate-950 focus:ring-4 focus:ring-slate-100"
                  >
                    <option value="">Not selected</option>
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                    <option value="3">3rd Year</option>
                    <option value="4">4th Year</option>
                    <option value="5">5th Year</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Profile Image URL */}
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
                Profile Photo (Image URL)
              </label>
              <div className="relative">
                <ImageIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="url"
                  name="profile_image"
                  placeholder="https://example.com/avatar.jpg"
                  maxLength={500}
                  value={formData.profile_image}
                  onChange={handleChange}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-4 focus:ring-slate-100"
                />
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Enter a direct image link (PNG, JPG, SVG).
              </p>
            </div>

            {/* Bio */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Bio / About Me
                </label>
                <span className="text-xs text-slate-400">
                  {formData.bio.length}/500
                </span>
              </div>
              <div className="relative">
                <textarea
                  name="bio"
                  rows={4}
                  maxLength={500}
                  placeholder="Write a brief intro about your academic focus, projects, or interests..."
                  value={formData.bio}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-4 focus:ring-slate-100"
                />
              </div>
            </div>

            {/* Form actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <span className="text-xs font-semibold text-slate-400">Email Address</span>
                <div className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-900">
                  <Mail size={16} className="text-slate-400" />
                  {user?.email}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <span className="text-xs font-semibold text-slate-400">Username</span>
                <div className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-900">
                  <User size={16} className="text-slate-400" />
                  @{user?.username}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <span className="text-xs font-semibold text-slate-400">Program / Degree</span>
                <div className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-900">
                  <GraduationCap size={16} className="text-slate-400" />
                  {user?.course || <span className="italic text-slate-400">Not set</span>}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <span className="text-xs font-semibold text-slate-400">Branch / Department</span>
                <div className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-900">
                  <BookOpen size={16} className="text-slate-400" />
                  {user?.branch || <span className="italic text-slate-400">Not set</span>}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <span className="text-xs font-semibold text-slate-400">Academic Year</span>
                <div className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-900">
                  <Calendar size={16} className="text-slate-400" />
                  {user?.year ? `Year ${user.year}` : <span className="italic text-slate-400">Not set</span>}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <span className="text-xs font-semibold text-slate-400">Member Since</span>
                <div className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-900">
                  <Clock size={16} className="text-slate-400" />
                  {formatDate(user?.created_at)}
                </div>
              </div>
            </div>

            {user?.bio && (
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                  <FileText size={14} />
                  <span>Bio</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  {user.bio}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
