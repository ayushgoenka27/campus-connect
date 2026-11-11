import { useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  Edit2,
  Megaphone,
  Pin,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";

const CATEGORIES = [
  { id: "all", label: "All Notices", color: "text-slate-700 bg-slate-100 border-slate-200" },
  { id: "urgent", label: "Urgent", color: "text-red-500 bg-red-50 border-red-200" },
  { id: "academic", label: "Academic", color: "text-blue-500 bg-blue-50 border-blue-200" },
  { id: "events", label: "Events", color: "text-purple-500 bg-purple-50 border-purple-200" },
  { id: "placement", label: "Placement", color: "text-emerald-500 bg-emerald-50 border-emerald-200" },
  { id: "general", label: "General", color: "text-slate-500 bg-slate-50 border-slate-200" },
];

function formatDate(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getCategoryBadge(cat) {
  const match = CATEGORIES.find((c) => c.id === cat) || {
    label: cat || "General",
    color: "text-slate-600 bg-slate-100 border-slate-200",
  };
  return match;
}

export default function Announcements() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "administrator";

  const [announcements, setAnnouncements] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [includeDrafts, setIncludeDrafts] = useState(false);

  // Modal editor state (admin)
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editorForm, setEditorForm] = useState({
    title: "",
    content: "",
    category: "general",
    is_published: true,
    is_pinned: false,
  });
  const [saving, setSaving] = useState(false);
  const [editorError, setEditorError] = useState("");

  // Toast
  const [toast, setToast] = useState(null);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = {};
        if (selectedCategory !== "all") {
          params.category = selectedCategory;
        }
        if (debouncedSearch.trim()) {
          params.search = debouncedSearch.trim();
        }
        if (isAdmin && includeDrafts) {
          params.include_drafts = true;
        }

        const res = await client.get("/announcements", { params });
        if (!cancelled) {
          setAnnouncements(res.data.items || []);
          setTotal(res.data.total || 0);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.data?.detail || "Failed to load announcements. Please try again."
          );
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
  }, [selectedCategory, debouncedSearch, includeDrafts, isAdmin, reloadTick]);

  // Open modal for Create
  const handleOpenCreate = () => {
    setEditingItem(null);
    setEditorForm({
      title: "",
      content: "",
      category: "general",
      is_published: true,
      is_pinned: false,
    });
    setEditorError("");
    setEditorOpen(true);
  };

  // Open modal for Edit
  const handleOpenEdit = (ann) => {
    setEditingItem(ann);
    setEditorForm({
      title: ann.title,
      content: ann.content,
      category: ann.category,
      is_published: ann.is_published,
      is_pinned: ann.is_pinned,
    });
    setEditorError("");
    setEditorOpen(true);
  };

  // Save (Create or Update)
  const handleSave = async (e) => {
    e.preventDefault();
    if (!editorForm.title.trim()) {
      setEditorError("Title cannot be empty");
      return;
    }
    if (!editorForm.content.trim()) {
      setEditorError("Content cannot be empty");
      return;
    }

    setSaving(true);
    setEditorError("");

    try {
      if (editingItem) {
        const res = await client.patch(`/announcements/${editingItem.id}`, editorForm);
        setAnnouncements((prev) =>
          prev.map((a) => (a.id === editingItem.id ? res.data : a))
        );
        showToast("Announcement updated successfully");
      } else {
        const res = await client.post("/announcements", editorForm);
        setAnnouncements((prev) => [res.data, ...prev]);
        setTotal((prev) => prev + 1);
        showToast("Announcement created successfully");
      }
      setEditorOpen(false);
    } catch (err) {
      setEditorError(err.response?.data?.detail || "Failed to save announcement");
    } finally {
      setSaving(false);
    }
  };

  // Quick toggle publish status
  const handleTogglePublish = async (ann) => {
    try {
      const res = await client.patch(`/announcements/${ann.id}/publish`);
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === ann.id ? res.data : a))
      );
      showToast(
        res.data.is_published
          ? "Announcement published"
          : "Announcement unpublished (moved to drafts)"
      );
    } catch (err) {
      showToast(err.response?.data?.detail || "Failed to toggle status", "error");
    }
  };

  // Delete announcement
  const handleDelete = async (annId) => {
    if (!window.confirm("Are you sure you want to delete this announcement?")) {
      return;
    }
    try {
      await client.delete(`/announcements/${annId}`);
      setAnnouncements((prev) => prev.filter((a) => a.id !== annId));
      setTotal((prev) => Math.max(0, prev - 1));
      showToast("Announcement deleted");
    } catch (err) {
      showToast(err.response?.data?.detail || "Failed to delete announcement", "error");
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
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

      {/* Top Banner Header */}
      <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm border border-slate-200/80 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white shadow-md">
              <Megaphone size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                  Campus Announcements
                </h1>
                {total > 0 && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                    {total}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 sm:text-sm">
                Official notices, academic schedules, events and alerts.
              </p>
            </div>
          </div>
        </div>

        {/* Admin Action Button */}
        {isAdmin && (
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 transition"
          >
            <Plus size={16} />
            Post Announcement
          </button>
        )}
      </div>

      {/* Controls Bar: Search + Category Filters + Draft Toggle */}
      <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm border border-slate-200/80">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search notices by keyword or title..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Admin Drafts Toggle */}
          {isAdmin && (
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">
              <input
                type="checkbox"
                checked={includeDrafts}
                onChange={(e) => setIncludeDrafts(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-slate-950 focus:ring-0"
              />
              <span>Include Drafts</span>
            </label>
          )}
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2 scrollbar-none">
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-medium transition ${
                  isActive
                    ? "bg-slate-950 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <Tag size={13} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main List Area */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="animate-pulse rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="h-4 w-28 rounded bg-slate-200 mb-3" />
              <div className="h-6 w-3/4 rounded bg-slate-200 mb-2" />
              <div className="h-4 w-full rounded bg-slate-100 mb-2" />
              <div className="h-4 w-1/2 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-red-500 mb-2" />
          <p className="text-sm font-semibold text-red-700">{error}</p>
          <button
            onClick={() => setReloadTick((t) => t + 1)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      ) : announcements.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <Megaphone className="mx-auto h-12 w-12 text-slate-300 mb-3" />
          <h3 className="text-base font-semibold text-slate-900">
            No announcements found
          </h3>
          <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
            {searchTerm || selectedCategory !== "all"
              ? "Try adjusting your search query or switching to another category."
              : "Check back later for university news and important departmental alerts."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map((ann) => {
            const catBadge = getCategoryBadge(ann.category);
            return (
              <article
                key={ann.id}
                className={`relative rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow-md ${
                  ann.is_pinned
                    ? "border-amber-300/80 bg-gradient-to-br from-amber-50/20 to-white ring-1 ring-amber-200/50"
                    : "border-slate-200/80"
                }`}
              >
                {/* Header row: Category + Pinned + Date */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize ${catBadge.color}`}
                    >
                      <Tag size={11} />
                      {catBadge.label}
                    </span>

                    {ann.is_pinned && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100/70 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                        <Pin size={11} className="fill-amber-800" />
                        Pinned
                      </span>
                    )}

                    {!ann.is_published && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        Draft
                      </span>
                    )}
                  </div>

                  <span className="text-xs text-slate-400">
                    {formatDate(ann.created_at)}
                  </span>
                </div>

                {/* Announcement Title */}
                <h2 className="text-lg font-bold text-slate-900 tracking-tight mb-2">
                  {ann.title}
                </h2>

                {/* Announcement Body */}
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                  {ann.content}
                </p>

                {/* Footer: Author Info & Admin Controls */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700">
                      {ann.author?.full_name ? ann.author.full_name[0] : "A"}
                    </div>
                    <span>
                      Posted by{" "}
                      <span className="font-semibold text-slate-700">
                        {ann.author?.full_name || "Administration"}
                      </span>
                    </span>
                  </div>

                  {/* Admin controls: Edit, Toggle Publish, Delete */}
                  {isAdmin && (
                    <div className="flex items-center gap-1.5 ml-auto">
                      <button
                        onClick={() => handleTogglePublish(ann)}
                        title={ann.is_published ? "Unpublish" : "Publish"}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                          ann.is_published
                            ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        }`}
                      >
                        {ann.is_published ? "Make Draft" : "Publish"}
                      </button>

                      <button
                        onClick={() => handleOpenEdit(ann)}
                        title="Edit announcement"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                      >
                        <Edit2 size={15} />
                      </button>

                      <button
                        onClick={() => handleDelete(ann.id)}
                        title="Delete announcement"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Admin Announcement Editor Modal (P4-09) */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">
                {editingItem ? "Edit Announcement" : "Post New Announcement"}
              </h3>
              <button
                onClick={() => setEditorOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            {editorError && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-600">
                {editorError}
              </div>
            )}

            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={editorForm.title}
                  onChange={(e) =>
                    setEditorForm({ ...editorForm, title: e.target.value })
                  }
                  placeholder="e.g. End Semester Exam Schedule 2026"
                  maxLength={200}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Category
                </label>
                <select
                  value={editorForm.category}
                  onChange={(e) =>
                    setEditorForm({ ...editorForm, category: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                >
                  <option value="general">General</option>
                  <option value="academic">Academic</option>
                  <option value="events">Events</option>
                  <option value="placement">Placement</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Content
                </label>
                <textarea
                  value={editorForm.content}
                  onChange={(e) =>
                    setEditorForm({ ...editorForm, content: e.target.value })
                  }
                  rows={5}
                  placeholder="Provide all relevant details, deadlines, and contact information..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:bg-white resize-y"
                  required
                />
              </div>

              <div className="flex items-center gap-6 pt-1">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editorForm.is_pinned}
                    onChange={(e) =>
                      setEditorForm({ ...editorForm, is_pinned: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-slate-300 text-slate-950 focus:ring-0"
                  />
                  <span>Pin to top</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editorForm.is_published}
                    onChange={(e) =>
                      setEditorForm({ ...editorForm, is_published: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-slate-300 text-slate-950 focus:ring-0"
                  />
                  <span>Publish immediately</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50 transition"
                >
                  {saving ? "Saving..." : editingItem ? "Update Notice" : "Post Notice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
