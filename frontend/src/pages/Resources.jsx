import { useState, useEffect } from "react";
import {
  BookOpen,
  ExternalLink,
  Plus,
  Search,
  Trash2,
  Edit2,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import client from "../api/client";

const CATEGORIES = [
  { id: "all", label: "All Categories" },
  { id: "syllabus", label: "Syllabus" },
  { id: "question_paper", label: "Question Papers" },
  { id: "lab_manual", label: "Lab Manuals" },
  { id: "handbook", label: "Handbooks" },
  { id: "portal", label: "Portals" },
  { id: "study_material", label: "Study Material" },
];

const RESOURCE_TYPES = [
  { id: "external_link", label: "External Link" },
  { id: "official_doc", label: "Official Document" },
  { id: "drive_link", label: "Drive Storage Link" },
  { id: "library_portal", label: "Library Portal" },
];

function getCategoryBadge(category) {
  switch (category) {
    case "syllabus":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "question_paper":
      return "bg-purple-50 text-purple-700 border-purple-200";
    case "lab_manual":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "handbook":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "portal":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
}

export default function Resources() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "administrator";

  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);

  // Modal State for Admin Create/Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingResource, setEditingResource] = useState(null);
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState("syllabus");
  const [formResourceType, setFormResourceType] = useState("official_doc");
  const [formUrl, setFormUrl] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadResources() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (selectedCategory !== "all") {
          params.append("category", selectedCategory);
        }
        if (searchTerm.trim()) {
          params.append("search", searchTerm.trim());
        }
        const res = await client.get(`/resources?${params.toString()}`);
        if (!cancelled) {
          setResources(res.data?.items || []);
        }
      } catch {
        if (!cancelled) {
          setError("Failed to load campus resources. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadResources();
    return () => {
      cancelled = true;
    };
  }, [selectedCategory, searchTerm, reloadTick]);

  const openCreateModal = () => {
    setEditingResource(null);
    setFormTitle("");
    setFormCategory("syllabus");
    setFormResourceType("official_doc");
    setFormUrl("");
    setFormDescription("");
    setFormError("");
    setIsModalOpen(true);
  };

  const openEditModal = (res) => {
    setEditingResource(res);
    setFormTitle(res.title);
    setFormCategory(res.category);
    setFormResourceType(res.resource_type);
    setFormUrl(res.url);
    setFormDescription(res.description || "");
    setFormError("");
    setIsModalOpen(true);
  };

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!formTitle.trim()) {
      setFormError("Title cannot be blank");
      return;
    }
    const trimmedUrl = formUrl.trim();
    if (!trimmedUrl.startsWith("http://") && !trimmedUrl.startsWith("https://")) {
      setFormError("Resource URL must start with http:// or https://");
      return;
    }

    setSubmitting(true);
    try {
      if (editingResource) {
        await client.patch(`/resources/${editingResource.id}`, {
          title: formTitle.trim(),
          category: formCategory,
          resource_type: formResourceType,
          url: trimmedUrl,
          description: formDescription.trim() || null,
        });
      } else {
        await client.post("/resources", {
          title: formTitle.trim(),
          category: formCategory,
          resource_type: formResourceType,
          url: trimmedUrl,
          description: formDescription.trim() || null,
        });
      }
      setIsModalOpen(false);
      setReloadTick((t) => t + 1);
    } catch (err) {
      setFormError(
        err.response?.data?.detail || "Failed to save resource. Please verify fields."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteResource = async (id) => {
    if (!window.confirm("Are you sure you want to delete this resource?")) return;
    try {
      await client.delete(`/resources/${id}`);
      setReloadTick((t) => t + 1);
    } catch {
      alert("Failed to delete resource.");
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Campus Academic Resources
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Curated syllabus files, past question archives, laboratory manuals, and portals.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            <Plus size={16} />
            Add Resource
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {/* Category Pills */}
        <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
                selectedCategory === cat.id
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search resources..."
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none transition placeholder:text-slate-400 focus:border-slate-400"
          />
        </div>
      </div>

      {/* Resources Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-white p-5"
            />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-600">
          {error}
        </div>
      ) : resources.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-14 px-4 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <BookOpen size={24} />
          </div>
          <p className="text-base font-semibold text-slate-800">No resources found</p>
          <p className="mt-1 text-xs text-slate-400 max-w-sm">
            Try adjusting your category filter or search query.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {resources.map((res) => (
            <div
              key={res.id}
              className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md hover:border-slate-300"
            >
              <div>
                {/* Header row: category badge + admin actions */}
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`rounded-lg border px-2.5 py-0.5 text-[11px] font-semibold capitalize ${getCategoryBadge(
                      res.category
                    )}`}
                  >
                    {res.category.replace("_", " ")}
                  </span>
                  {isAdmin && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button
                        onClick={() => openEditModal(res)}
                        className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                        title="Edit Resource"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteResource(res.id)}
                        className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 transition"
                        title="Delete Resource"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Title */}
                <h3 className="mt-3 text-base font-semibold text-slate-900 group-hover:text-indigo-600 transition">
                  {res.title}
                </h3>

                {/* Description */}
                {res.description && (
                  <p className="mt-1.5 text-xs text-slate-600 line-clamp-3 leading-relaxed">
                    {res.description}
                  </p>
                )}
              </div>

              {/* Footer: Open Link Button */}
              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 capitalize">
                  {res.resource_type.replace("_", " ")}
                </span>
                <a
                  href={res.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 transition"
                >
                  <span>Open Resource</span>
                  <ExternalLink size={13} />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Admin Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-slate-900">
                {editingResource ? "Edit Resource" : "Create Campus Resource"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleModalSubmit} className="mt-4 space-y-4">
              {formError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Resource Title *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Operating Systems Complete Lab Manual"
                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-slate-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Category *
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-slate-400 bg-white"
                  >
                    {CATEGORIES.filter((c) => c.id !== "all").map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Resource Type *
                  </label>
                  <select
                    value={formResourceType}
                    onChange={(e) => setFormResourceType(e.target.value)}
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-slate-400 bg-white"
                  >
                    {RESOURCE_TYPES.map((rt) => (
                      <option key={rt.id} value={rt.id}>
                        {rt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Material URL (External Link) *
                </label>
                <input
                  type="url"
                  required
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://campus.edu/resources/file.pdf"
                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-slate-400"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Provide a direct verified HTTP/HTTPS link to the academic document or portal.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Brief overview of the material and target departments..."
                  className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-xs outline-none focus:border-slate-400"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition disabled:opacity-50"
                >
                  {submitting ? "Saving..." : editingResource ? "Update Resource" : "Create Resource"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
