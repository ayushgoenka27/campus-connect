import { useState, useEffect } from "react";
import {
  CalendarDays,
  Check,
  Clock,
  Edit2,
  ExternalLink,
  MapPin,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import client from "../api/client";

const CATEGORIES = [
  { id: "all", label: "All Events" },
  { id: "workshop", label: "Workshops" },
  { id: "hackathon", label: "Hackathons" },
  { id: "seminar", label: "Seminars" },
  { id: "cultural", label: "Cultural" },
  { id: "sports", label: "Sports" },
  { id: "academic", label: "Academic" },
];

function formatEventDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getCategoryColor(category) {
  switch (category) {
    case "hackathon":
      return "bg-purple-50 text-purple-700 border-purple-200";
    case "workshop":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "seminar":
      return "bg-cyan-50 text-cyan-700 border-cyan-200";
    case "cultural":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "sports":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
}

export default function Events() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "administrator";

  const [timeFilter, setTimeFilter] = useState("upcoming");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);

  // RSVP Loading state per event ID
  const [rsvpLoading, setRsvpLoading] = useState({});

  // Modal State for Admin Create/Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState("workshop");
  const [formLocation, setFormLocation] = useState("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formCapacity, setFormCapacity] = useState("");
  const [formRegistrationUrl, setFormRegistrationUrl] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.append("time_filter", timeFilter);
        if (selectedCategory !== "all") {
          params.append("category", selectedCategory);
        }
        if (searchTerm.trim()) {
          params.append("search", searchTerm.trim());
        }
        const res = await client.get(`/events?${params.toString()}`);
        if (!cancelled) {
          setEvents(res.data?.items || []);
        }
      } catch {
        if (!cancelled) {
          setError("Failed to load campus events. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadEvents();
    return () => {
      cancelled = true;
    };
  }, [timeFilter, selectedCategory, searchTerm, reloadTick]);

  // Handle RSVP toggle
  const handleToggleRSVP = async (event) => {
    const eventId = event.id;
    setRsvpLoading((prev) => ({ ...prev, [eventId]: true }));

    try {
      if (event.is_rsvped) {
        // Cancel RSVP
        const res = await client.delete(`/events/${eventId}/rsvp`);
        setEvents((prev) =>
          prev.map((e) =>
            e.id === eventId
              ? {
                  ...e,
                  is_rsvped: false,
                  my_rsvp_status: null,
                  attendee_count: res.data.attendee_count,
                }
              : e
          )
        );
      } else {
        // Create RSVP
        const res = await client.post(`/events/${eventId}/rsvp`, {
          status: "attending",
        });
        setEvents((prev) =>
          prev.map((e) =>
            e.id === eventId
              ? {
                  ...e,
                  is_rsvped: true,
                  my_rsvp_status: "attending",
                  attendee_count: res.data.attendee_count,
                }
              : e
          )
        );
      }
    } catch (err) {
      alert(err.response?.data?.detail || "Could not update RSVP status.");
    } finally {
      setRsvpLoading((prev) => ({ ...prev, [eventId]: false }));
    }
  };

  const openCreateModal = () => {
    setEditingEvent(null);
    setFormTitle("");
    setFormCategory("workshop");
    setFormLocation("");
    setFormStartDate("");
    setFormEndDate("");
    setFormCapacity("");
    setFormRegistrationUrl("");
    setFormDescription("");
    setFormError("");
    setIsModalOpen(true);
  };

  const openEditModal = (evt) => {
    setEditingEvent(evt);
    setFormTitle(evt.title);
    setFormCategory(evt.category);
    setFormLocation(evt.location);
    // Format to datetime-local input string YYYY-MM-DDTHH:MM
    setFormStartDate(
      evt.start_date ? new Date(evt.start_date).toISOString().slice(0, 16) : ""
    );
    setFormEndDate(
      evt.end_date ? new Date(evt.end_date).toISOString().slice(0, 16) : ""
    );
    setFormCapacity(evt.capacity ? String(evt.capacity) : "");
    setFormRegistrationUrl(evt.registration_url || "");
    setFormDescription(evt.description || "");
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
    if (!formLocation.trim()) {
      setFormError("Location cannot be blank");
      return;
    }
    if (!formStartDate) {
      setFormError("Start date & time is required");
      return;
    }
    if (formEndDate && new Date(formEndDate) < new Date(formStartDate)) {
      setFormError("End date cannot be earlier than start date");
      return;
    }

    const payload = {
      title: formTitle.trim(),
      description: formDescription.trim(),
      category: formCategory,
      location: formLocation.trim(),
      start_date: new Date(formStartDate).toISOString(),
      end_date: formEndDate ? new Date(formEndDate).toISOString() : null,
      capacity: formCapacity ? parseInt(formCapacity, 10) : null,
      registration_url: formRegistrationUrl.trim() || null,
    };

    setSubmitting(true);
    try {
      if (editingEvent) {
        await client.patch(`/events/${editingEvent.id}`, payload);
      } else {
        await client.post("/events", payload);
      }
      setIsModalOpen(false);
      setReloadTick((t) => t + 1);
    } catch (err) {
      setFormError(
        err.response?.data?.detail || "Failed to save event. Please check inputs."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEvent = async (id) => {
    if (!window.confirm("Are you sure you want to delete this event?")) return;
    try {
      await client.delete(`/events/${id}`);
      setReloadTick((t) => t + 1);
    } catch {
      alert("Failed to delete event.");
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Campus Events & Activities
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Keep track of workshops, hackathons, and gatherings. RSVP with your peers.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            <Plus size={16} />
            Create Event
          </button>
        )}
      </div>

      {/* Controls: Tabs & Filters */}
      <div className="space-y-4">
        {/* Time Tabs (Upcoming vs Past) */}
        <div className="flex items-center justify-between border-b border-slate-200">
          <div className="flex gap-6">
            <button
              onClick={() => setTimeFilter("upcoming")}
              className={`pb-3 text-sm font-semibold transition border-b-2 ${
                timeFilter === "upcoming"
                  ? "border-slate-950 text-slate-950"
                  : "border-transparent text-slate-400 hover:text-slate-700"
              }`}
            >
              Upcoming Events
            </button>
            <button
              onClick={() => setTimeFilter("past")}
              className={`pb-3 text-sm font-semibold transition border-b-2 ${
                timeFilter === "past"
                  ? "border-slate-950 text-slate-950"
                  : "border-transparent text-slate-400 hover:text-slate-700"
              }`}
            >
              Past Events
            </button>
          </div>
        </div>

        {/* Category Pills & Search */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
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

          <div className="relative w-full md:w-72">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by title, venue..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none transition placeholder:text-slate-400 focus:border-slate-400"
            />
          </div>
        </div>
      </div>

      {/* Events List / Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-60 animate-pulse rounded-2xl border border-slate-200 bg-white p-6"
            />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-600">
          {error}
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-14 px-4 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <CalendarDays size={24} />
          </div>
          <p className="text-base font-semibold text-slate-800">No events found</p>
          <p className="mt-1 text-xs text-slate-400 max-w-sm">
            {timeFilter === "upcoming"
              ? "There are currently no upcoming events matching your criteria."
              : "No past events found in this category."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {events.map((evt) => {
            const isFull = evt.capacity && evt.attendee_count >= evt.capacity;
            const isPast = timeFilter === "past";

            return (
              <div
                key={evt.id}
                className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md hover:border-slate-300"
              >
                <div>
                  {/* Top: Category + Admin actions */}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`rounded-lg border px-2.5 py-0.5 text-[11px] font-semibold capitalize ${getCategoryColor(
                        evt.category
                      )}`}
                    >
                      {evt.category}
                    </span>
                    {isAdmin && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={() => openEditModal(evt)}
                          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                          title="Edit Event"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteEvent(evt.id)}
                          className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 transition"
                          title="Delete Event"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="mt-3 text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition">
                    {evt.title}
                  </h3>

                  {/* Description */}
                  <p className="mt-2 text-xs text-slate-600 line-clamp-3 leading-relaxed">
                    {evt.description}
                  </p>

                  {/* Date, Location, Attendees Meta */}
                  <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-slate-400" />
                      <span>{formatEventDate(evt.start_date)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <MapPin size={14} className="text-slate-400" />
                      <span className="truncate">{evt.location}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Users size={14} className="text-slate-400" />
                      <span>
                        {evt.attendee_count} attending
                        {evt.capacity && ` (Max ${evt.capacity})`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom CTA Row */}
                <div className="mt-6 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                  {/* External Registration Link if present */}
                  {evt.registration_url ? (
                    <a
                      href={evt.registration_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
                    >
                      <span>External Info</span>
                      <ExternalLink size={13} />
                    </a>
                  ) : (
                    <span className="text-[11px] text-slate-400">Campus Event</span>
                  )}

                  {/* RSVP Toggle Button */}
                  {isPast ? (
                    <span className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-400">
                      Event Ended
                    </span>
                  ) : (
                    <button
                      onClick={() => handleToggleRSVP(evt)}
                      disabled={rsvpLoading[evt.id] || (isFull && !evt.is_rsvped)}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition ${
                        evt.is_rsvped
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                          : isFull
                          ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                          : "bg-slate-950 text-white hover:bg-slate-800 shadow-sm"
                      } disabled:opacity-50`}
                    >
                      {evt.is_rsvped ? (
                        <>
                          <Check size={14} />
                          <span>RSVP'd</span>
                        </>
                      ) : isFull ? (
                        <span>Full Capacity</span>
                      ) : (
                        <span>RSVP Attend</span>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Admin Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-slate-900">
                {editingEvent ? "Edit Event" : "Create Campus Event"}
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
                  Event Title *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Spring Hackathon 2026"
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
                    Venue / Location *
                  </label>
                  <input
                    type="text"
                    required
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="e.g. Auditorium B or Meet Link"
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-slate-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Start Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    End Date & Time (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-slate-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Capacity (Optional)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formCapacity}
                    onChange={(e) => setFormCapacity(e.target.value)}
                    placeholder="e.g. 100"
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    External Link (Optional)
                  </label>
                  <input
                    type="url"
                    value={formRegistrationUrl}
                    onChange={(e) => setFormRegistrationUrl(e.target.value)}
                    placeholder="https://..."
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Event Description *
                </label>
                <textarea
                  rows={3}
                  required
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Detailed schedule, prerequisites, and registration instructions..."
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
                  {submitting ? "Saving..." : editingEvent ? "Update Event" : "Create Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
