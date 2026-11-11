# Campus Connect — Task Tracker

**Last Updated:** 2026-11-11 (Phase 3 + SRS remediation complete)

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
| P4-01 | Create Announcement model | ⬜ Not Started | `models/announcement.py` |
| P4-02 | Create Alembic migration (announcements) | ⬜ Not Started | — |
| P4-03 | Create announcement schemas | ⬜ Not Started | `schemas/announcement.py` |
| P4-04 | Create announcement API (admin) | ⬜ Not Started | CRUD with role check |
| P4-05 | Create announcement API (student) | ⬜ Not Started | Public read + filter |
| P4-06 | Admin user management endpoint | ⬜ Not Started | List users, change roles |
| P4-07 | Create Announcements page | ⬜ Not Started | `src/pages/Announcements.jsx` |
| P4-08 | Create Admin Dashboard | ⬜ Not Started | `src/pages/AdminDashboard.jsx` |
| P4-09 | Create announcement editor | ⬜ Not Started | Admin CRUD UI |
| P4-10 | Add admin nav item (role-gated) | ⬜ Not Started | Only visible to admins |

---

## PHASE 5 — Real-Time Messaging

| ID | Task | Status | Notes |
|----|------|--------|-------|
| P5-01 | Create Conversation model | ⬜ Not Started | `models/conversation.py` |
| P5-02 | Create Message model | ⬜ Not Started | `models/message.py` |
| P5-03 | Create Alembic migration (messaging) | ⬜ Not Started | — |
| P5-04 | Create message schemas | ⬜ Not Started | `schemas/message.py` |
| P5-05 | Create conversation API | ⬜ Not Started | Create, list |
| P5-06 | Create message REST API | ⬜ Not Started | History with pagination |
| P5-07 | Create WebSocket endpoint | ⬜ Not Started | `api/websocket.py` |
| P5-08 | Create WebSocket connection manager | ⬜ Not Started | `core/websocket.py` |
| P5-09 | Mark messages as read | ⬜ Not Started | Read status |
| P5-10 | Unread message count API | ⬜ Not Started | Per-conversation |
| P5-11 | Create Messages page | ⬜ Not Started | `src/pages/Messages.jsx` |
| P5-12 | Create conversation list component | ⬜ Not Started | With unread count |
| P5-13 | Create chat view component | ⬜ Not Started | Real-time messages |
| P5-14 | Create WebSocket hook | ⬜ Not Started | `src/hooks/useWebSocket.js` |
| P5-15 | Real unread count in sidebar | ⬜ Not Started | Replace hardcoded "3" |

---

## PHASE 6 — Notifications & Campus Resources

| ID | Task | Status | Notes |
|----|------|--------|-------|
| P6-01 | Create Notification model | ⬜ Not Started | `models/notification.py` |
| P6-02 | Create Resource model | ⬜ Not Started | `models/resource.py` |
| P6-03 | Create Event model | ⬜ Not Started | `models/event.py` |
| P6-04 | Create Alembic migration (notifications + resources) | ⬜ Not Started | — |
| P6-05 | Create notification API | ⬜ Not Started | List, mark-read, count |
| P6-06 | Trigger notifications from app events | ⬜ Not Started | Connections, messages |
| P6-07 | Create resources API | ⬜ Not Started | CRUD |
| P6-08 | Create events API | ⬜ Not Started | CRUD |
| P6-09 | Create seed data script | ⬜ Not Started | Demo resources/events |
| P6-10 | Create Notifications panel | ⬜ Not Started | Bell → dropdown |
| P6-11 | Create Resources page | ⬜ Not Started | `src/pages/Resources.jsx` |
| P6-12 | Create Events page | ⬜ Not Started | `src/pages/Events.jsx` |
| P6-13 | Create Settings page | ⬜ Not Started | `src/pages/Settings.jsx` |

---

## PHASE 7 — Testing, Documentation & Deployment

| ID | Task | Status | Notes |
|----|------|--------|-------|
| P7-01 | Install pytest + httpx + pytest-asyncio | ⬜ Not Started | `requirements.txt` |
| P7-02 | Write auth tests | ⬜ Not Started | `tests/test_auth.py` |
| P7-03 | Write user tests | ⬜ Not Started | `tests/test_users.py` |
| P7-04 | Write connection tests | ⬜ Not Started | `tests/test_connections.py` |
| P7-05 | Write community tests | ⬜ Not Started | `tests/test_posts.py` |
| P7-06 | Write announcement tests | ⬜ Not Started | `tests/test_announcements.py` |
| P7-07 | Write messaging tests | ⬜ Not Started | `tests/test_messages.py` |
| P7-08 | Write authorization tests | ⬜ Not Started | RBAC 403 responses |
| P7-09 | Create Dockerfile (backend) | ⬜ Not Started | — |
| P7-10 | Create Dockerfile (frontend) | ⬜ Not Started | — |
| P7-11 | Create docker-compose.yml | ⬜ Not Started | Full stack |
| P7-12 | Write README | ⬜ Not Started | Complete documentation |
| P7-13 | Add API endpoint documentation | ⬜ Not Started | Via FastAPI annotations |
| P7-14 | Create architecture diagram | ⬜ Not Started | `docs/` |
| P7-15 | Create ER diagram | ⬜ Not Started | `docs/` |
| P7-16 | Create seed data for demo | ⬜ Not Started | Demo workflow |

---

## Summary

| Phase | Total Tasks | Completed | In Progress | Blocked |
|-------|-------------|-----------|-------------|---------|
| Phase 0 | 10 | 10 | 0 | 0 |
| Phase 1 | 14 | 14 | 0 | 0 |
| Phase 2 | 7 | 7 | 0 | 0 |
| Phase 3 | 13 | 13 | 0 | 0 |
| Phase 4 | 10 | 0 | 0 | 0 |
| Phase 5 | 15 | 0 | 0 | 0 |
| Phase 6 | 13 | 0 | 0 | 0 |
| Phase 7 | 16 | 0 | 0 | 0 |
| **Total** | **98** | **44** | **0** | **0** |

