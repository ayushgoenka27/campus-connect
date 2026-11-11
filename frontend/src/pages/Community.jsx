import { useState, useEffect, useCallback, useRef } from "react";
import {
  Heart,
  MessageCircle,
  Send,
  Trash2,
  Pencil,
  X,
  Check,
  AlertCircle,
  Users,
  Loader2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function getInitials(name = "") {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function AvatarOrInitials({ user, size = "md" }) {
  const sizes = { sm: "w-7 h-7 text-xs", md: "w-10 h-10 text-sm", lg: "w-12 h-12 text-base" };
  const cls = sizes[size] ?? sizes.md;
  if (user?.profile_image) {
    return (
      <img
        src={user.profile_image}
        alt={user.full_name}
        className={`${cls} rounded-full object-cover ring-2 ring-slate-100`}
      />
    );
  }
  return (
    <div
      className={`${cls} rounded-full bg-slate-200 flex items-center justify-center font-semibold text-slate-600 ring-2 ring-slate-100 shrink-0`}
    >
      {getInitials(user?.full_name)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

function Toast({ message, type = "success", onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  const colors =
    type === "error"
      ? "bg-red-50 border-red-200 text-red-800"
      : "bg-green-50 border-green-200 text-green-800";

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border shadow-md text-sm font-medium ${colors}`}
    >
      {type === "error" ? <AlertCircle size={16} /> : <Check size={16} />}
      <span>{message}</span>
      <button onClick={onClose} className="ml-1 opacity-60 hover:opacity-100">
        <X size={14} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Post Composer (P3-10)
// ---------------------------------------------------------------------------

function PostComposer({ currentUser, onPostCreated }) {
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const MAX = 2000;

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post("/posts/", { content: trimmed });
      setContent("");
      onPostCreated(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to create post");
    } finally {
      setSubmitting(false);
    }
  }

  const remaining = MAX - content.length;
  const isOverLimit = remaining < 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
      <div className="flex gap-3">
        <AvatarOrInitials user={currentUser} size="md" />
        <form onSubmit={handleSubmit} className="flex-1 space-y-3">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share something with your campus..."
            rows={3}
            className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:bg-white transition"
          />
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-medium ${
                isOverLimit ? "text-red-500" : remaining < 100 ? "text-amber-500" : "text-slate-400"
              }`}
            >
              {remaining.toLocaleString()} characters remaining
            </span>
            <button
              type="submit"
              disabled={submitting || !content.trim() || isOverLimit}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-950 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {submitting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              Post
            </button>
          </div>
          {error && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <AlertCircle size={12} /> {error}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Comment Item (P3-12)
// ---------------------------------------------------------------------------

function CommentItem({ comment, currentUserId, onDelete }) {
  const isOwn = comment.author.id === currentUserId;
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm("Delete this comment?")) return;
    setDeleting(true);
    try {
      await api.delete(`/posts/comments/${comment.id}`);
      onDelete(comment.id);
    } catch {
      // silently fail — parent will show nothing changed
      setDeleting(false);
    }
  }

  return (
    <div className="flex gap-2 group">
      <AvatarOrInitials user={comment.author} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-semibold text-slate-700">
              {comment.author.full_name}
            </span>
            <span className="text-[10px] text-slate-400 shrink-0">
              {formatRelativeTime(comment.created_at)}
            </span>
          </div>
          <p className="text-sm text-slate-700 mt-0.5 break-words">{comment.content}</p>
        </div>
      </div>
      {isOwn && (
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="self-center opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition"
          title="Delete comment"
        >
          {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Comment Section (P3-12)
// ---------------------------------------------------------------------------

function CommentSection({ postId, commentCount, currentUser }) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState([]);
  const [total, setTotal] = useState(commentCount);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const loadComments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/posts/${postId}/comments`);
      setComments(res.data.comments);
      setTotal(res.data.total);
    } catch {
      setError("Failed to load comments");
    } finally {
      setLoading(false);
    }
  }, [postId]);

  function handleToggle() {
    if (!open) {
      setOpen(true);
      loadComments();
    } else {
      setOpen(false);
    }
  }

  async function handleAddComment(e) {
    e.preventDefault();
    const trimmed = newComment.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      const res = await api.post(`/posts/${postId}/comments`, { content: trimmed });
      setComments((prev) => [...prev, res.data]);
      setTotal((t) => t + 1);
      setNewComment("");
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to add comment");
    } finally {
      setSubmitting(false);
    }
  }

  function handleDeleteComment(commentId) {
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    setTotal((t) => t - 1);
  }

  return (
    <div>
      <button
        onClick={handleToggle}
        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 font-medium transition"
      >
        <MessageCircle size={15} />
        <span>
          {total} {total === 1 ? "comment" : "comments"}
        </span>
      </button>

      {open && (
        <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
          {loading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="flex gap-2 animate-pulse">
                  <div className="w-7 h-7 rounded-full bg-slate-200 shrink-0" />
                  <div className="flex-1 h-12 rounded-xl bg-slate-100" />
                </div>
              ))}
            </div>
          ) : error ? (
            <p className="text-xs text-red-500">{error}</p>
          ) : comments.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No comments yet. Be the first!</p>
          ) : (
            <div className="space-y-2">
              {comments.map((c) => (
                <CommentItem
                  key={c.id}
                  comment={c}
                  currentUserId={currentUser.id}
                  onDelete={handleDeleteComment}
                />
              ))}
            </div>
          )}

          {/* Add comment form */}
          <form onSubmit={handleAddComment} className="flex gap-2 mt-2">
            <AvatarOrInitials user={currentUser} size="sm" />
            <div className="flex-1 flex gap-2">
              <input
                ref={inputRef}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                maxLength={500}
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:bg-white transition"
              />
              <button
                type="submit"
                disabled={submitting || !newComment.trim()}
                className="rounded-xl bg-slate-950 px-3 py-1.5 text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {submitting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Post Card (P3-11, P3-13)
// ---------------------------------------------------------------------------

function PostCard({ post, currentUser, onDelete, onUpdate }) {
  const isOwn = post.author.id === currentUser.id;
  const [liked, setLiked] = useState(post.is_liked);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [liking, setLiking] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleLike() {
    if (liking) return;
    // Optimistic update
    const prevLiked = liked;
    const prevCount = likeCount;
    setLiked(!liked);
    setLikeCount(liked ? likeCount - 1 : likeCount + 1);
    setLiking(true);
    try {
      const res = await api.post(`/posts/${post.id}/like`);
      setLiked(res.data.liked);
      setLikeCount(res.data.like_count);
    } catch {
      // Rollback
      setLiked(prevLiked);
      setLikeCount(prevCount);
    } finally {
      setLiking(false);
    }
  }

  async function handleSaveEdit() {
    const trimmed = editContent.trim();
    if (!trimmed || trimmed === post.content) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const res = await api.patch(`/posts/${post.id}`, { content: trimmed });
      onUpdate({ ...post, content: res.data.content, updated_at: res.data.updated_at });
      setEditing(false);
    } catch {
      // keep edit open
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this post? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await api.delete(`/posts/${post.id}`);
      onDelete(post.id);
    } catch {
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3 items-start">
          <AvatarOrInitials user={post.author} size="md" />
          <div>
            <p className="text-sm font-semibold text-slate-800 leading-tight">
              {post.author.full_name}
            </p>
            <p className="text-xs text-slate-400">
              @{post.author.username}
              {post.author.course && ` · ${post.author.course}`}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {formatRelativeTime(post.created_at)}
              {post.updated_at !== post.created_at && (
                <span className="italic ml-1">(edited)</span>
              )}
            </p>
          </div>
        </div>

        {/* Own post actions */}
        {isOwn && !editing && (
          <div className="flex gap-1 shrink-0">
            <button
              onClick={() => {
                setEditContent(post.content);
                setEditing(true);
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              title="Edit post"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition"
              title="Delete post"
            >
              {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            </button>
          </div>
        )}
      </div>

      {/* Content / Edit mode */}
      {editing ? (
        <div className="space-y-2">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={4}
            maxLength={2000}
            className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:bg-white transition"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setEditing(false)}
              className="inline-flex items-center gap-1 px-3 py-1 text-xs rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition"
            >
              <X size={12} /> Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={saving || !editContent.trim()}
              className="inline-flex items-center gap-1 px-3 py-1 text-xs rounded-lg bg-slate-950 text-white hover:bg-slate-800 disabled:opacity-50 transition"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              Save
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
          {post.content}
        </p>
      )}

      {/* Actions row */}
      <div className="flex items-center gap-4 pt-1 border-t border-slate-50">
        {/* Like button */}
        <button
          onClick={handleLike}
          disabled={liking}
          className={`flex items-center gap-1.5 text-xs font-medium transition ${
            liked
              ? "text-red-500 hover:text-red-600"
              : "text-slate-400 hover:text-slate-600"
          }`}
        >
          <Heart
            size={15}
            fill={liked ? "currentColor" : "none"}
            className={liking ? "animate-pulse" : ""}
          />
          <span>{likeCount}</span>
        </button>

        {/* Comment toggle */}
        <CommentSection
          postId={post.id}
          commentCount={post.comment_count}
          currentUser={currentUser}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Post Skeleton
// ---------------------------------------------------------------------------

function PostSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 space-y-3 animate-pulse">
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-full bg-slate-200 shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 w-32 rounded bg-slate-200" />
          <div className="h-3 w-24 rounded bg-slate-100" />
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="h-3.5 rounded bg-slate-100" />
        <div className="h-3.5 w-5/6 rounded bg-slate-100" />
        <div className="h-3.5 w-4/6 rounded bg-slate-100" />
      </div>
      <div className="flex gap-4 pt-1">
        <div className="h-4 w-12 rounded bg-slate-100" />
        <div className="h-4 w-16 rounded bg-slate-100" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Community Page (P3-09)
// ---------------------------------------------------------------------------

export default function Community() {
  const { user: currentUser } = useAuth();

  const [posts, setPosts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  const LIMIT = 10;
  const hasMore = posts.length < total;

  // Initial load
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get(`/posts/?skip=0&limit=${LIMIT}`);
        if (!cancelled) {
          setPosts(res.data.posts);
          setTotal(res.data.total);
        }
      } catch {
        if (!cancelled) setError("Failed to load community posts. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLoadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const res = await api.get(`/posts/?skip=${posts.length}&limit=${LIMIT}`);
      setPosts((prev) => [...prev, ...res.data.posts]);
      setTotal(res.data.total);
    } catch {
      showToast("Failed to load more posts", "error");
    } finally {
      setLoadingMore(false);
    }
  }

  function handlePostCreated(newPost) {
    setPosts((prev) => [newPost, ...prev]);
    setTotal((t) => t + 1);
    showToast("Post shared successfully!");
  }

  function handlePostDeleted(postId) {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    setTotal((t) => t - 1);
    showToast("Post deleted");
  }

  function handlePostUpdated(updatedPost) {
    setPosts((prev) => prev.map((p) => (p.id === updatedPost.id ? updatedPost : p)));
  }

  function showToast(message, type = "success") {
    setToast({ message, type });
  }

  return (
    <div className="min-h-screen bg-[#f7f8fc]">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Community</h1>
            <p className="text-sm text-slate-500">Share updates and interact with your campus</p>
          </div>
          {!loading && (
            <span className="text-xs text-slate-400 font-medium">
              {total} {total === 1 ? "post" : "posts"}
            </span>
          )}
        </div>

        {/* Post composer */}
        {currentUser && (
          <PostComposer currentUser={currentUser} onPostCreated={handlePostCreated} />
        )}

        {/* Feed */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <PostSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-red-50 border border-red-200 p-4 flex items-center gap-3 text-red-700">
            <AlertCircle size={18} className="shrink-0" />
            <div>
              <p className="font-medium text-sm">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="text-xs underline mt-0.5"
              >
                Retry
              </button>
            </div>
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-12 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
              <Users size={24} className="text-slate-400" />
            </div>
            <p className="text-slate-600 font-medium">No posts yet</p>
            <p className="text-sm text-slate-400">
              Be the first to share something with the campus!
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUser={currentUser}
                  onDelete={handlePostDeleted}
                  onUpdate={handlePostUpdated}
                />
              ))}
            </div>

            {/* Load more */}
            {hasMore && (
              <div className="text-center pt-2">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 shadow-sm transition"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Loading...
                    </>
                  ) : (
                    `Load more (${total - posts.length} remaining)`
                  )}
                </button>
              </div>
            )}

            {!hasMore && posts.length > 0 && (
              <p className="text-center text-xs text-slate-400 py-2">
                You&apos;ve reached the end of the feed ✓
              </p>
            )}
          </>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
