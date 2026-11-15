# Campus Connect — Task Tracker

**Last Updated:** 2026-11-15 (Phase 6 complete, commit `5c7ca59`)

Legend: ⬜ Not Started | 🔄 In Progress | 🚧 Blocked | ✅ Implemented | 🧪 Tested | ✔️ Completed

---

## PHASE 0 — Stabilise & Repair Foundation

| ID | Task | Status | Notes |
|----|------|--------|-------|
| P0-01 | Fix login field mismatch (email not username) | ✔️ Completed | `Login.jsx` uses `email` field & `useAuth().login` |
| P0-02 | Add frontend auth guard / protected routes | ✔️ Completed | `ProtectedRoute.jsx` & `App.jsx` guard |
| P0-03 | Remove hardcoded user data from dashboard | ✔️ Completed | `Dashboard.jsx` fetches `/users/me` via `useAuth` |
| P0-04 | Remove hardcoded people from dashboard | ✔️ Completed | `Dashboard.jsx` fetches real users from `/api/v1/users` |
| P0-05 | Add logout functionality | ✔️ Completed | Token cleared, context reset, redirect to `/login` |
| P0-06 | Remove duplicate `backend/main.py` | ✔️ Completed | Re-exports canonical `app.main:app` |
| P0-07 | Fix duplicate DATABASE_URL in .env | ✔️ Completed | `.env` cleaned up |
| P0-08 | Fix `GET /sent` to filter pending only | ✔️ Completed | `connections.py` filters `status == "pending"` |
| P0-09 | Create `.env.example` | ✔️ Completed | `backend/.env.example` created |
| P0-10 | Clean up duplicate JS/TS config files | ✔️ Completed | Leftover `.tsx` and `vite.config.ts` removed |

---

## PHASE 1 — Authentication, Profiles & Navigation

| ID | Task | Status | Notes |
|----|------|--------|-------|
| P1-01 | Add health check endpoint | ✔️ Completed | `GET /health` added & verified by pytest |
| P1-02 | Add password strength validation | ✔️ Completed | Min 8 chars enforced in `schemas/auth.py` |
| P1-03 | Add unique constraint migration (connections) | ✔️ Completed | Alembic revision `1b3551e71d96` applied |
| P1-04 | Optimize connections queries with JOIN | ✔️ Completed | `joinedload` used for accepted, requests, sent |
| P1-05 | Add admin role dependency | ✔️ Completed | `get_current_admin()` added in `dependencies.py` |
| P1-06 | Add public profile view endpoint | ✔️ Completed | `GET /users/{user_id}` added & verified |
| P1-07 | Add pagination to `GET /users` | ✔️ Completed | `skip` and `limit` params added |
| P1-08 | Add Pydantic response models to all endpoints | ✔️ Completed | Typed schemas across auth & user endpoints |
| P1-09 | Create AuthContext / useAuth hook | ✔️ Completed | `src/context/AuthContext.jsx` implemented |
| P1-10 | Create ProtectedRoute component | ✔️ Completed | `src/components/ProtectedRoute.jsx` implemented |
| P1-11 | Create Profile page (view + edit) | ✔️ Completed | `src/pages/Profile.jsx` view + edit mode |
| P1-12 | Restructure App.jsx routing | ✔️ Completed | Clean declarative React Router configuration |
| P1-13 | Update sidebar navigation to use routes | ✔️ Completed | `AppLayout.jsx` with active NavLinks |
| P1-14 | Connect dashboard stats to backend | ✔️ Completed | Real calculation from `/connections` & profile |

---

## PHASE 2 — Connections Management

| ID | Task | Status | Notes |
|----|------|--------|-------|
| P2-01 | Add connection_status to user listings | ✔️ Completed | `GET /users` & `GET /users/{id}` include `connection_status` & `connection_id` |
| P2-02 | Create Discover page | ✔️ Completed | `src/pages/Discover.jsx` with search, course/branch/year filters & card grid |
| P2-03 | Create Connections page | ✔️ Completed | `src/pages/Connections.jsx` with Connected, Requests, and Sent tabs |
| P2-04 | Wire connect buttons to API | ✔️ Completed | Optimistic UI update, loading state, error rollback & toast feedback |
| P2-05 | Add accept/reject request UI | ✔️ Completed | Accept (`PATCH ?action=accepted`) & Decline (`PATCH ?action=rejected`) with rollback |
| P2-06 | Add cancel sent request UI | ✔️ Completed | Cancel request (`DELETE /connections/{id}`) with rollback & toast feedback |
| P2-07 | Handle all connection states in UI | ✔️ Completed | Handled: null, pending_sent, pending_received, accepted, rejected, self across app |

---

## PHASE 3 — Community Module

| ID | Task | Status | Notes |
|----|------|--------|-------|
| P3-01 | Create Post model | ✔️ Completed | `models/post.py` — id, author_id FK, content (Text), optional nullable `image_url`, timestamps |
| P3-02 | Create Comment model | ✔️ Completed | `models/comment.py` — id, post_id FK (CASCADE), author_id FK, content (Text), created_at |
| P3-03 | Create Like model | ✔️ Completed | `models/like.py` — id, post_id FK (CASCADE), user_id FK, UniqueConstraint `uq_likes_post_user` |
| P3-04 | Create Alembic migration (community) | ✔️ Completed | Revisions `abd8d6ee3c59` & `115f1d3a947f` (`posts.image_url`) + `0046fc91e8d6` (`uq_connections_user_pair`), upgrade/downgrade verified |
| P3-05 | Create post schemas | ✔️ Completed | `schemas/post.py` — `image_url` HTTP/HTTPS validation & normalization, Post/Comment/Like schemas |
| P3-06 | Create post API | ✔️ Completed | `api/posts.py` — CRUD + `search` keyword filter (`FR-COMM-4`), pagination, batched aggregates (no N+1) |
| P3-07 | Create comment API | ✔️ Completed | POST/GET `/posts/{id}/comments`, DELETE `/posts/comments/{id}` |
| P3-08 | Create like API | ✔️ Completed | POST `/posts/{id}/like` — idempotent toggle returning `liked` bool + `like_count` |
| P3-09 | Create Community page | ✔️ Completed | `src/pages/Community.jsx` — debounced keyword search bar, pagination, skeletons, error retry, empty states |
| P3-10 | Create post composer component | ✔️ Completed | Inline `PostComposer` — textarea, char counter (2000), optional `image_url` input with validation & preview |
| P3-11 | Create post card component | ✔️ Completed | Inline `PostCard` — image rendering with `onError` fallback, optimistic like, comment toggle, edit/delete for own |
| P3-12 | Create comment section component | ✔️ Completed | Inline `CommentSection` + `CommentItem` — lazy-loaded, add/delete comments, oldest first |
| P3-13 | Implement edit/delete for own content | ✔️ Completed | Inline edit mode on `PostCard` (`content` + `image_url`), delete with `confirm()`, 403 backend enforcement |

---

## PHASE 4 — Announcements & Admin

| ID | Task | Status | Notes |
|----|------|--------|-------|
| P4-01 | Create Announcement model | ✔️ Completed | `models/announcement.py` (author_id SET NULL), `report.py`, `moderation_log.py`, `is_hidden` on Post/Comment |
| P4-02 | Create Alembic migration (announcements) | ✔️ Completed | Revision `6a912f8eac82` applied; upgrade/downgrade verified on isolated test DB |
| P4-03 | Create announcement schemas | ✔️ Completed | `schemas/announcement.py`, `schemas/admin.py` (Report, Moderation, UserStatus, Stats) |
| P4-04 | Create announcement API (admin) | ✔️ Completed | `POST`, `PATCH`, `PATCH /publish`, `DELETE` with `get_current_admin` RBAC |
| P4-05 | Create announcement API (student) | ✔️ Completed | `GET` with category and keyword search; drafts excluded for non-admins |
| P4-06 | Admin user management endpoint | ✔️ Completed | `GET /admin/users`, `PATCH /users/{id}/status` with self-deactivation & last-admin safeguards; immediate 403 on deactivation |
| P4-07 | Create Announcements page | ✔️ Completed | `src/pages/Announcements.jsx` (category tabs, search, pinned notices, admin actions) |
| P4-08 | Create Admin Dashboard | ✔️ Completed | `src/pages/AdminDashboard.jsx` (metric cards, user directory with status toggle, moderation queue) |
| P4-09 | Create announcement editor | ✔️ Completed | Modal composer in `Announcements.jsx` for create and inline editing |
| P4-10 | Add admin nav item (role-gated) | ✔️ Completed | `AdminRoute.jsx` route guard, role-gated sidebar link in `AppLayout.jsx` for `"admin"` and `"administrator"` |

---

## PHASE 5 — Real-Time Messaging

| ID | Task | Status | Notes |
|----|------|--------|-------|
| P5-01 | Create Conversation model | ✔️ Completed | `models/conversation.py` with symmetric unique index on user pair |
| P5-02 | Create Message model | ✔️ Completed | `models/message.py` with status, read_at, conversation_id FK, indices |
| P5-03 | Create Alembic migration (messaging) | ✔️ Completed | Revision `d3160fc03d74`, upgrade/downgrade verified on test & dev DBs |
| P5-04 | Create message schemas | ✔️ Completed | `schemas/message.py` (MessageCreate, MessageResponse, ConversationList, etc.) |
| P5-05 | Create conversation API | ✔️ Completed | `api/conversations.py` — list user convs, create/get conversation (accepted connections only) |
| P5-06 | Create message REST API | ✔️ Completed | `GET /messages` with cursor pagination (`before_id`), `POST /messages` send fallback |
| P5-07 | Create WebSocket endpoint | ✔️ Completed | `api/websocket.py` mounted at `/ws?token=<jwt>`, heartbeats, presence, policy 1008 |
| P5-08 | Create WebSocket connection manager | ✔️ Completed | `core/websocket.py` in-memory connection manager, presence tracking, frame routing |
| P5-09 | Mark messages as read | ✔️ Completed | `PATCH /read` REST endpoint and WS `mark_read` dispatch with WS read receipts |
| P5-10 | Unread message count API | ✔️ Completed | Aggregated unread count per conversation returned in `GET /conversations` |
| P5-11 | Create Messages page | ✔️ Completed | `src/pages/Messages.jsx` split view (conversation sidebar + chat pane) |
| P5-12 | Create conversation list component | ✔️ Completed | Inline sidebar list with unread counter, last message preview, search, online dot |
| P5-13 | Create chat view component | ✔️ Completed | Real-time chat bubbles, timestamp, single/double read checkmarks, composer |
| P5-14 | Create WebSocket hook | ✔️ Completed | `src/hooks/useWebSocket.js` with exponential backoff reconnect & heartbeats |
| P5-15 | Real unread count in sidebar | ✔️ Completed | Dynamic unread message badge in `AppLayout.jsx` and `Messages.jsx` |

---

## PHASE 6 — Notifications & Campus Resources

| ID | Task | Status | Notes |
|----|------|--------|-------|
| P6-01 | Create Notification model | ✔️ Completed | `models/notification.py` with CASCADE user, SET NULL actor, unread & created indexes |
| P6-02 | Create Resource model | ✔️ Completed | `models/resource.py` with categorized external links, validated HTTP/HTTPS URLs |
| P6-03 | Create Event model | ✔️ Completed | `models/event.py` with Event and EventRSVP, `uq_event_rsvps_event_user` unique constraint |
| P6-04 | Create Alembic migration (notifications + resources) | ✔️ Completed | Revision `055c082ed165` applied and verified; dev DB records preserved intact |
| P6-05 | Create notification API | ✔️ Completed | `api/notifications.py` (paginated list, unread-count, mark-read, read-all, delete, isolation) |
| P6-06 | Trigger notifications from app events | ✔️ Completed | Real-time push + DB persistence on connections, announcements, and moderation outcomes |
| P6-07 | Create resources API | ✔️ Completed | `api/resources.py` (public student read/search/filter, admin-gated CRUD, URL validation) |
| P6-08 | Create events API | ✔️ Completed | `api/events.py` (upcoming/past tabs, attendee count, idempotent RSVP toggle, capacity check) |
| P6-09 | Create seed data script | ✔️ Completed | `scripts/seed_phase6.py` idempotent seeding (5 resources, 4 events, 0 duplicates on repeat) |
| P6-10 | Create Notifications panel | ✔️ Completed | `components/NotificationsDropdown.jsx` in topbar with badge, real-time push, mark all read |
| P6-11 | Create Resources page | ✔️ Completed | `pages/Resources.jsx` with category pills, keyword search, external link buttons, admin modal |
| P6-12 | Create Events page | ✔️ Completed | `pages/Events.jsx` with upcoming/past tabs, RSVP toggle, live attendee counts, admin modal |
| P6-13 | Create Settings page | ✔️ Completed | `pages/Settings.jsx` with Argon2 password change, token_version multi-session invalidation |

---

## PHASE 7 — Testing, Hardening & Deployment

| ID | Task | Status | Notes |
|----|------|--------|-------|
| P7-01 | Full user journey automated E2E test script | ⬜ Not Started | Multi-module browser integration |
| P7-02 | Multi-browser compatibility verification | ⬜ Not Started | Chrome, Edge engines |
| P7-03 | Security headers, CSP & CORS configuration | ✔️ Completed | `SecurityHeadersMiddleware`, CSP, CORS validation |
| P7-04 | API rate limiting on sensitive endpoints | ✔️ Completed | Sliding-window limiter on login/register/password change |
| P7-05 | Input sanitization, URL scheme checks & injection audit | ✔️ Completed | Scheme validation, parameterized queries |
| P7-06 | Error boundaries, log masking & server-side logout | ✔️ Completed | React `ErrorBoundary`, 500 sanitization, `POST /auth/logout` |
| P7-07 | Database query audit, EXPLAIN ANALYZE & N+1 elimination | ⬜ Not Started | Hot path optimizations |
| P7-08 | Index coverage & connection pool tuning | ⬜ Not Started | Production database indexing |
| P7-09 | Frontend route lazy loading & bundle optimization | ⬜ Not Started | `React.lazy` + `Suspense` code splitting |
| P7-10 | Backend multi-stage production Dockerfile | ⬜ Not Started | Python 3.11-slim, unprivileged user |
| P7-11 | Frontend production Dockerfile & Nginx SPA config | ⬜ Not Started | Nginx static serving + SPA fallback |
| P7-12 | Docker Compose full stack orchestration | ⬜ Not Started | Backend, Frontend, Postgres, networks |
| P7-13 | Production DB migration script & backup/restore runbook | ⬜ Not Started | Automation scripts & rollback runbook |
| P7-14 | Zero-downtime healthcheck probes (/health & /health/db) | ✔️ Completed | Liveness & readiness probes |
| P7-15 | Author DEPLOYMENT.md deployment guide & runbooks | ⬜ Not Started | Comprehensive operations manual |
| P7-16 | Architecture diagrams, SRS traceability matrix & demo guide | ⬜ Not Started | Documentation & handover assets |

---

## Summary

| Phase | Total Tasks | Completed | In Progress | Blocked |
|-------|-------------|-----------|-------------|---------|
| Phase 0 | 10 | 10 | 0 | 0 |
| Phase 1 | 14 | 14 | 0 | 0 |
| Phase 2 | 7 | 7 | 0 | 0 |
| Phase 3 | 13 | 13 | 0 | 0 |
| Phase 4 | 10 | 10 | 0 | 0 |
| Phase 5 | 15 | 15 | 0 | 0 |
| Phase 6 | 13 | 13 | 0 | 0 |
| Phase 7 | 16 | 5 | 0 | 0 |
| **Total** | **98** | **87** | **0** | **0** |

                                        