# Campus Connect — Changelog

All meaningful changes to Campus Connect will be documented here.

Format:
```
## [Date] — [Phase] [Description]
### Added
### Fixed
### Changed
### Removed
### Database Changes
### Tests Executed
```

---

## [2026-11-15] — Phase 6 Notifications & Campus Resources Module Complete (commit 5c7ca59)

### Added
- `backend/app/models/notification.py` — `Notification` ORM model (`user_id` FK CASCADE, `actor_id` FK SET NULL, `type`, `title`, `content`, `link`, `is_read`, `read_at`, `created_at`) with indices on `(user_id, is_read)` and `(user_id, created_at)`.
- `backend/app/models/resource.py` — `Resource` ORM model for curated academic documents, syllabus guides, question papers, lab manuals, and portals (`title`, `description`, `category`, `resource_type`, `url`, `created_by_id` FK SET NULL, timestamps).
- `backend/app/models/event.py` — `Event` and `EventRSVP` ORM models with `UniqueConstraint("event_id", "user_id", name="uq_event_rsvps_event_user")` to guarantee unique attendee registrations per event.
- `backend/app/models/user.py` — Added `token_version: Mapped[int]` (default 1, server_default "1") for session invalidation across devices on password change.
- `backend/migrations/versions/055c082ed165_add_notifications_resources_events_.py` — Alembic revision creating `notifications`, `resources`, `events`, `event_rsvps` tables, unique constraint `uq_event_rsvps_event_user`, and adding `token_version` column to `users`.
- `backend/app/schemas/notification.py` — Pydantic schemas for `NotificationResponse`, `NotificationList`, `UnreadNotificationCount`.
- `backend/app/schemas/resource.py` — Pydantic schemas for `ResourceCreate`, `ResourceUpdate`, `ResourceResponse`, `ResourceList` with strict HTTP/HTTPS URL scheme validation.
- `backend/app/schemas/event.py` — Pydantic schemas for `EventCreate`, `EventUpdate`, `EventResponse`, `EventList`, `RSVPRequest`, `RSVPResponse` with end date >= start date validation.
- `backend/app/schemas/auth.py` — Added `ChangePasswordRequest` (min 8 chars, password match validator) and `ChangePasswordResponse`.
- `backend/app/services/notification_service.py` — Service layer for DB-first notification persistence with duplicate prevention, and non-blocking real-time WebSocket delivery via `manager.send_to_user`.
- `backend/app/api/notifications.py` — REST API (`/api/v1/notifications`): paginated notifications list, unread counter badge endpoint, mark single read (`PATCH /{id}/read`), mark all read (`PATCH /read-all`), and delete (`DELETE /{id}`) with strict ownership isolation.
- `backend/app/api/resources.py` — REST API (`/api/v1/resources`): public student catalog with category filtering and keyword search; administrator-only create, update, and delete endpoints.
- `backend/app/api/events.py` — REST API (`/api/v1/events`): upcoming/past filtering, keyword search, attendee counts; idempotent RSVP registration (`POST /{id}/rsvp`), past-event guard, capacity limit enforcement, RSVP cancellation (`DELETE /{id}/rsvp`).
- `backend/scripts/seed_phase6.py` — Idempotent database seed script adding 5 curated academic resources and 4 campus events without altering baseline records.
- `backend/tests/test_phase6.py` — 6 automated pytest suites covering password change token invalidation, notification lifecycle and isolation, connection notification triggers, resource RBAC, and event RSVP lifecycle.
- `frontend/src/components/NotificationsDropdown.jsx` — Topbar notification dropdown with unread badge counter, real-time push ingestion via WebSocket, mark all read, deep-link navigation, and deletion.
- `frontend/src/pages/Resources.jsx` — Full-featured resources catalog with category pills, keyword search, external link buttons, and admin create/edit/delete modals.
- `frontend/src/pages/Events.jsx` — Campus activities interface with upcoming vs past tabs, category filter, search, RSVP toggle button with live attendee count, and admin event composer modal.
- `frontend/src/pages/Settings.jsx` — Account security interface with password change form, client-side confirmation checks, token version refresh, and session logout.
- `frontend/src/tests/Phase6.test.jsx` — 6 Vitest suites covering NotificationsDropdown, Resources catalog, Events RSVP, and Settings password change.
- `scratch/p6_browser_e2e.py` — 5-scenario Playwright E2E browser suite executed in real Chrome against live FastAPI, PostgreSQL, and Vite.

### Changed
- `backend/app/core/security.py`: Added `token_version: int = 1` parameter to `create_access_token` and embedded `"tv"` claim in JWT payload.
- `backend/app/core/dependencies.py`: Updated `get_current_user` to check `token_tv < user.token_version` and return HTTP 401 Unauthorized for revoked tokens.
- `backend/app/api/auth.py`: Added `POST /api/v1/auth/change-password` endpoint hashing new password with Argon2, incrementing `user.token_version`, and disconnecting active WebSockets via `manager.disconnect_user`. Updated `/api/v1/auth/me` to use `get_authenticated_user` for token version enforcement.
- `backend/app/api/websocket.py`: Updated `_authenticate_ws` to reject connection if token's `"tv"` claim is less than `user.token_version`.
- `backend/app/api/connections.py`: Triggered `connection_request` notification on request send and `connection_accepted` on acceptance.
- `backend/app/api/announcements.py`: Triggered `announcement` broadcast notification to all active users on announcement publish.
- `backend/app/api/admin.py`: Triggered `moderation` outcome notification to reporter upon report resolution or dismissal.
- `backend/app/main.py`: Mounted `notifications_router`, `resources_router`, and `events_router` under `/api/v1`.
- `frontend/src/App.jsx`: Replaced ComingSoon placeholders with `Events`, `Resources`, and `Settings` components.
- `frontend/src/layout/AppLayout.jsx`: Replaced placeholder bell icon with `<NotificationsDropdown />`.
- `frontend/src/hooks/useWebSocket.js`: Added `onNotification` handler for real-time WebSocket push notifications.
- `frontend/src/context/AuthContext.jsx`: Added `updateToken` helper for updating token without unmounting protected routes.

### Database Changes
- Applied Alembic revision `055c082ed165` to dev database `campus_connect`.
- Preserved all 7 baseline users, 3 connections, 1 post, and 1 like intact.
- Idempotently seeded 5 academic resources and 4 campus events.

### Tests Executed
- Backend `pytest tests/ -v`: **80/80 passed** (100% pass rate in 14.40s).
- Frontend `npm run test` (Vitest + RTL): **24/24 passed** (100% pass rate in 5.37s).
- Frontend `npm run lint` (ESLint): **Clean (0 errors, 0 warnings)**.
- Frontend `npm run build` (Vite production build): **Clean (920ms, 1901 modules)**.
- Live Browser UI E2E (Phase 6): **5/5 passed in real Chrome** via Playwright (`scratch/p6_browser_e2e.py`).

---

## [2026-11-15] — Phase 5 Real-Time Messaging Module Complete (commit 3e3ba53)

### Added
- `backend/app/models/conversation.py` — `Conversation` ORM model (`user1_id` FK, `user2_id` FK, `last_message_at`, timestamps) with symmetric unique index `uq_conversations_user_pair` on `(LEAST(user1_id, user2_id), GREATEST(user1_id, user2_id))` to guarantee exactly one conversation per user pair.
- `backend/app/models/message.py` — `Message` ORM model (`conversation_id` FK with CASCADE, `sender_id` FK, `recipient_id` FK, `content` Text, `status` enum: sent/delivered/read, `is_read` bool, `read_at` datetime, `created_at`, nullable `client_msg_id` String(64)) with indices on `(conversation_id, created_at)`, `(recipient_id, is_read)`, partial unique index `uq_messages_conv_sender_client_id` on `(conversation_id, sender_id, client_msg_id) WHERE client_msg_id IS NOT NULL`, and CheckConstraint `ck_messages_status_is_read_consistent`.
- `backend/migrations/versions/d3160fc03d74_add_conversations_and_messages_tables.py` — Alembic revision adding `conversations` and `messages` tables, indices, check constraints, and safe downgrade `DROP INDEX IF EXISTS`.
- `backend/app/schemas/message.py` — Pydantic schemas for `MessageCreate`, `MessageResponse`, `MessageList`, `ConversationCreate`, `ConversationResponse`, `ConversationList`, `MarkReadResponse`.
- `backend/app/core/websocket.py` — In-memory `ConnectionManager` managing active WebSocket connections per `user_id` (multi-socket set per user, offline broadcast only after final disconnect), presence tracking, `disconnect_user()` for admin deactivations, frame routing, and heartbeat management.
- `backend/app/api/conversations.py` — REST API (`/api/v1/conversations`): list conversations with unread counts and peer profile, create/get conversation (strictly enforcing accepted connection requirement per `FR-MSG-1`), cursor-paginated message history (`before_id`), REST send fallback with `client_msg_id` idempotency deduplication, and read receipt update endpoint (`PATCH /read`).
- `backend/app/api/websocket.py` — WebSocket gateway mounted at `/ws?token=<jwt>` with JWT auth, per-frame active user verification (1008 policy close for inactive/unauthenticated), event routing (`chat_message` with `client_msg_id` deduplication, `mark_read`, `typing`, `ping`/`pong`).
- `frontend/src/hooks/useWebSocket.js` — Custom React hook for real-time WebSocket communication with exponential backoff reconnect (1s..10s), 30s ping heartbeats, online/offline presence tracking, and typed message dispatch.
- `frontend/src/pages/Messages.jsx` — Full-featured real-time split-view messaging interface: conversation sidebar with live unread counter badges, last message previews, search filter, online status indicators, active chat thread with message grouping, sent/read checkmarks (`✓` / `✓✓`), typing indicator, and start conversation modal with accepted connections.
- `frontend/src/layout/AppLayout.jsx` — Dynamic real-time unread messages badge on the Messages sidebar navigation item.
- `frontend/src/tests/Messages.test.jsx` — 5 Vitest tests covering conversation list rendering, unread badge, chat thread opening, sent/read indicators, message submission, search filtering, and incoming WebSocket frame dispatch.
- `backend/tests/test_messages.py` — 17 automated backend test cases covering authorization gating (accepted connections only, self-messaging blocked), idempotency (REST and WebSocket `client_msg_id`), CheckConstraint status consistency, pagination, REST fallback, read receipts, WebSocket gateway auth, ping/pong, multi-socket connection lifecycle, and admin account deactivation WS disconnect.
- `scratch/p5_browser_e2e.py` — 9-scenario Playwright E2E suite executed in real Chrome against live FastAPI + PostgreSQL + Vite.

### Changed
- `backend/app/main.py`: Mounted `conversations_router` under `/api/v1` and `ws_router`.
- `backend/app/api/admin.py`: Changed `update_user_status` to async to call `await manager.disconnect_user(target.id, code=1008)` immediately terminating active WebSocket connections of deactivated accounts.
- `backend/migrations/env.py`: Patched to respect programmatic `config.get_main_option("sqlalchemy.url")` overrides for test databases.
- `backend/requirements.txt`: Added `websockets>=12.0.0` dependency for uvicorn WebSocket protocol support.
- `frontend/src/App.jsx`: Replaced placeholder route with live `/messages` page.
- `frontend/src/context/AuthContext.jsx`: Exposed `token` in context value for WebSocket hook initialization.

### Database Changes
- Applied `d3160fc03d74` on PostgreSQL `campus_connect` (head revision).
- Migration round-trip verified on isolated test DB `campus_connect_p5_verify`.
- Dev database records (7 users, 3 connections, 1 post, 1 like) preserved intact.

### Tests Executed
- Backend `pytest tests/ -v`: **74/74 passed** (100% pass rate in 13.10s).
- Frontend `npm test` (Vitest + RTL): **18/18 passed** (100% pass rate in 6.31s).
- Frontend `npm run lint`: **0 errors, 0 warnings**.
- Frontend `npm run build`: **clean build in 844ms** (1,898 modules).
- Two-account Live Browser E2E in Chrome (`scratch/p5_browser_e2e.py`): **9/9 passed** (100% pass rate).

---

## [2026-11-12] — Phase 4 Announcements & Admin Module Complete

### Added
- `backend/app/models/announcement.py` — `Announcement` ORM model (`author_id` FK with `ON DELETE SET NULL` to survive admin removal, `title`, `content`, `category`, `is_published`, `is_pinned`, timestamps).
- `backend/app/models/report.py` — `Report` ORM model with immutable target snapshot fields (`target_type`, `target_id`, `target_preview`, `target_author_id`), nullable `post_id`/`comment_id` FKs (`ON DELETE SET NULL`), and composite unique index `uq_reports_reporter_target` on `(reporter_id, target_type, target_id)`.
- `backend/app/models/moderation_log.py` — `ModerationLog` append-only audit trail model (`admin_id` FK with `ON DELETE SET NULL`, `action`, `target_type`, `target_id`, `notes`, `created_at`).
- `backend/app/models/post.py` & `comment.py` — Added `is_hidden: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)` for moderation.
- `backend/migrations/versions/6a912f8eac82_add_announcements_reports_moderation_.py` — Alembic revision adding `announcements`, `reports`, `moderation_logs` tables and `is_hidden` column with `server_default=sa.text('false')`.
- `backend/app/schemas/announcement.py` — Pydantic schemas for announcement creation, updates, and serialized responses with author info.
- `backend/app/schemas/admin.py` — Pydantic schemas for reports (`ReportCreate`, `ReportResponse`), moderation requests, user status updates, user listings, and platform metrics (`AdminStats`).
- `backend/app/api/announcements.py` — Announcements REST API (`/api/v1/announcements`): student read with category and keyword search, draft filtering (drafts hidden for non-admins), admin CRUD, pinning, and quick publish toggling.
- `backend/app/api/reports.py` — Reports REST API (`/api/v1/reports`): submission with single-target validation, duplicate detection (409), self-reporting prevention (400), and `/reports/my` endpoint.
- `backend/app/api/admin.py` — Admin REST API (`/api/v1/admin`): platform overview stats (`GET /stats`), user directory (`GET /users`), account activation/deactivation (`PATCH /users/{id}/status` with self-deactivation and last-admin safeguards), and moderation queue actions (`PATCH /reports/{id}` for hide, remove, dismiss with audit logging).
- `frontend/src/components/AdminRoute.jsx` — Route guard restricting admin console routes to users with `role` `"admin"` or `"administrator"`, redirecting unauthorized users to `/`.
- `frontend/src/pages/Announcements.jsx` — Announcements view with category filter tabs (All, Academic, Events, Urgent, Placement, General), search bar, pinned notices, and administrative composer/editor modal, inline publish toggling, and deletion.
- `frontend/src/pages/AdminDashboard.jsx` — Administrator governance portal with 5 live platform metric cards, searchable User Directory with role filters and account activation toggle, and Moderation Queue with hide/remove/dismiss actions.
- `backend/tests/test_announcements.py` — 37 automated backend test cases covering announcement RBAC/CRUD, student filtering, report lifecycle & duplicate prevention, report preservation after content deletion, admin stats, user deactivation & safeguards, moderation actions, and audit logs.
- `frontend/src/tests/Announcements.test.jsx` & `AdminDashboard.test.jsx` — 7 component tests covering announcement rendering, category filtering, search, admin modal submission, metric cards, user status toggling, and moderation queue handling.
- `scratch/p4_browser_e2e.py` — Headless Chrome Playwright E2E suite verifying full student RBAC gating and administrator operations against live FastAPI + PostgreSQL + Vite.

### Fixed / Changed
- `backend/app/api/auth.py` & `backend/app/api/users.py`:
  - Enforced `is_active` check across `/auth/login`, `/auth/me`, and `/users/me`. Deactivated accounts immediately receive `HTTP 403 Forbidden` on all protected endpoints.
- `backend/app/main.py`: Mounted `announcements_router`, `reports_router`, and `admin_router` under `/api/v1`.
- `frontend/src/App.jsx`: Mounted `/announcements` and protected `/admin` route with `AdminRoute`.
- `frontend/src/layout/AppLayout.jsx`: Added Announcements navigation link, role-gated "Admin Console" section with shield icon for administrators, and `overflow-y-auto` on sidebar.

### Database Changes
- Applied `6a912f8eac82` on PostgreSQL `campus_connect` (head revision).
- Migration round-trip (`upgrade head` -> `downgrade` -> `upgrade head`) verified on isolated temporary test database `campus_connect_p4_test2`.
- Preserved existing PostgreSQL records (6 users, 2 connections, 0 posts intact).

### Tests Executed
- Backend `pytest tests/ -v`: **57/57 passed** (100% pass rate in 7.61s).
- Frontend `npm test` (Vitest + RTL): **13/13 passed** (100% pass rate in 4.37s).
- Frontend `npm run lint`: **0 errors, 0 warnings**.
- Frontend `npm run build`: **clean build in 649ms** (1,896 modules).
- Live Browser UI E2E (Playwright + Chrome against live PostgreSQL): **all student and administrator workflows passed**.

---

## [2026-11-11] — Phase 3 Community Module & SRS Remediation

### Added
- `backend/app/models/post.py`, `comment.py`, `like.py` — Community ORM models (`posts` with nullable `image_url`, `comments` with `CASCADE` delete, `likes` with `UniqueConstraint("post_id", "user_id", name="uq_likes_post_user")`).
- `backend/migrations/versions/abd8d6ee3c59_add_community_posts_comments_likes.py` — Initial community schema migration (`posts`, `comments`, `likes` + indexes).
- `backend/migrations/versions/115f1d3a947f_add_image_url_to_posts.py` — Non-destructive migration adding nullable `image_url` (`String(500)`) to `posts` (`FR-COMM-1`).
- `backend/migrations/versions/0046fc91e8d6_add_bidirectional_connection_unique_.py` — Non-destructive migration adding direction-independent functional unique index `uq_connections_user_pair` (`LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id)`) on `connections` to prevent simultaneous opposite-direction races (`A -> B` and `B -> A`).
- `backend/app/models/connection.py` — Added `uq_connections_user_pair` expression unique index (PostgreSQL `LEAST`/`GREATEST`, SQLite `min`/`max`) preserving bidirectional duplicate protection at the DB level.
- `backend/app/schemas/post.py` — Pydantic v2 schemas for posts, comments, likes, with `http://`/`https://` validation and blank normalization on `image_url`.
- `backend/app/api/posts.py` — Full Community REST API (`/api/v1/posts`) with reverse-chronological feed, pagination (`skip`/`limit`), keyword search (`?search=` for `FR-COMM-4`), batched aggregate queries (`like_count`, `comment_count`, `is_liked`), post CRUD, comment add/list/delete, and idempotent like toggle.
- `frontend/src/pages/Community.jsx` — Community feed page with debounced keyword search bar (`FR-COMM-4`), post composer with optional `image_url` input/validation/preview, image rendering with `onError` graceful fallback, optimistic like toggle, inline post edit/delete, expandable comment threads, pagination, skeletons, and error retry state.
- `backend/tests/test_community.py` — 12 backend tests covering post CRUD, authorization (`403`), validation (`422`), like toggle, comments, cascade deletes, pagination, keyword search, optional `image_url`, and bounded batched query count (`<= 8` queries for 10 posts).
- `frontend/src/tests/setup.js`, `Community.test.jsx`, `Connections.test.jsx` — Vitest + React Testing Library test setup and 6 frontend component tests covering Community search, image URL validation/creation/editing, broken-image fallback, and Discover/Connections states & rollback.

### Fixed / Changed
- `backend/app/api/connections.py`:
  - Allowed fresh connection requests after a previous `"rejected"` connection by deleting the rejected record before inserting the new `"pending"` request (while preserving bidirectional duplicate prevention with HTTP `409` for `"pending"` and `"accepted"`).
  - Caught `IntegrityError` on `db.commit()` in `send_connection_request`, rolling back the session and returning HTTP `409` instead of `500` on concurrent duplicate inserts.
  - Removed peer `email` addresses from `/connections/accepted`, `/connections/requests`, and `/connections/sent` payloads via shared `_serialize_connection_user`.
- `backend/app/main.py` — Mounted `posts_router` under `/api/v1`.
- `frontend/src/App.jsx` — Mounted `<Community />` at `/community`.
- `frontend/package.json` & `frontend/vite.config.js` — Added Vitest dev dependencies and configured `jsdom` test runner (`npm test`).

### Database Changes
- Applied `abd8d6ee3c59`, `115f1d3a947f`, and `0046fc91e8d6` on PostgreSQL `campus_connect`.
- Verified full migration chain `upgrade head` -> `downgrade` -> `upgrade head` non-destructively on isolated temporary PostgreSQL test database (`campus_connect_mig_test`), confirming existing post/connection rows survive downgrade/upgrade and `uq_connections_user_pair` blocks opposite-direction `(B, A)` inserts with `IntegrityError`.
- Verified existing dev PostgreSQL records remain intact (`6` users, `2` connections, `0` posts).

### Tests Executed
- Backend API & DB `pytest tests/ -v`: **20/20 passed** (`8` in `test_api.py`, `12` in `test_community.py`, `3.85s`) against SQLite in-memory test DB.
- Frontend `npm test` (Vitest + RTL): **6/6 passed** (`4` in `Community.test.jsx`, `2` in `Connections.test.jsx`, `5.09s`, mocked API client in `jsdom`).
- Frontend `npm run lint`: **0 errors, 0 warnings**.
- Frontend `npm run build`: **built in 713ms** (`1,893` modules).
- Live Browser E2E (`Playwright` + headless Google Chrome against live FastAPI + PostgreSQL + Vite): **15/15 browser checks passed** across 2 student accounts (`Console errors: []`, unexpected `HTTP >= 400: []`).

---

## [2026-11-11] — Phase 2 Connections Management Complete

### Added
- `frontend/src/pages/Discover.jsx` — Dedicated Discover Students page with live debounced search (by name, username, bio), dropdown filters for Course, Branch, and Academic Year, filter reset, student card grid with contextual connect buttons (Connect, Request Sent, Respond to Request, Connected), optimistic state updates with rollback on API failure, and loading skeletons.
- `frontend/src/pages/Connections.jsx` — Dedicated My Connections page with 3 dynamic tabs:
  - **Connected**: lists accepted peers with profile details, connection date, quick Message link, and Remove connection action.
  - **Requests**: lists incoming connection requests with Accept (`PATCH ?action=accepted`) and Decline (`PATCH ?action=rejected`) actions, badge count indicators, and optimistic list updates.
  - **Sent**: lists outgoing pending requests with Pending status badge and Cancel Request (`DELETE /connections/{id}`) action.
  - Includes real-time client-side filter input within active tab, loading skeleton states, empty states tailored for each tab, and auto-dismissing toast notifications.
- `backend/app/schemas/user.py` — Added `connection_status: str | None` and `connection_id: int | None` to `PublicUserProfileResponse`.
- `backend/app/api/users.py` — Updated `GET /api/v1/users` and `GET /api/v1/users/{user_id}` to compute connection status relative to the requesting user (`"pending_sent"`, `"pending_received"`, `"accepted"`, or `null`).
- Automated tests in `backend/tests/test_api.py`:
  - `test_connection_status_in_user_listings`: verifies `null`, `pending_sent`, `pending_received`, and `accepted` status computation across user listing and public profile endpoints.
  - `test_reject_and_cancel_connection_request`: verifies outgoing request cancellation, incoming request rejection, non-receiver rejection prevention (403), and non-pending transition checks (400).

### Changed
- `frontend/src/App.jsx` — Mounted `<Discover />` on route `/discover` and `<Connections />` on route `/connections`.
- `frontend/src/pages/Dashboard.jsx` — Made stat cards clickable to navigate to their respective connection tabs (`/connections?tab=connected`, `/connections?tab=requests`, `/connections?tab=sent`, `/profile`), and updated "Wants to Connect" button on person cards to directly link to `/connections?tab=requests`.

### Tests Executed
- Automated `pytest` suite: 6/6 test suites passed in 1.30s.
- Two-account E2E scenario executed and verified: Priya Sharma & Rahul Verma across all 8 lifecycle steps.
- Frontend `npm run lint`: 0 errors, 0 warnings.
- Frontend `npm run build`: built in 747ms cleanly.

---

## [2026-11-11] — Phase 1 Authentication, Profiles & Navigation Complete

### Added
- `frontend/src/pages/Profile.jsx` — Dedicated Student Profile page with read-only details display and full editing capability (full name, degree/program, branch, academic year, avatar image URL, bio with character counter). Integrates with `useAuth().refreshUser()` for instant global state update.
- `backend/migrations/versions/1b3551e71d96_add_unique_constraint_to_connections.py` — Alembic migration adding composite unique constraint `uq_connections_sender_receiver` on `connections(sender_id, receiver_id)`.
- `backend/app/schemas/user.py` — Strongly typed Pydantic models: `PublicUserProfileResponse`, `CurrentUserProfileResponse`, and `UpdateProfileResponse`.
- `GET /api/v1/users/{user_id}` — Public user profile endpoint in `backend/app/api/users.py`, returning non-sensitive public student details.
- `GET /health` — Health check endpoint in `backend/app/main.py` for deployment readiness.
- `backend/app/core/dependencies.py` — Added `get_current_admin` RBAC dependency.

### Changed
- `backend/app/api/connections.py` — Optimized `GET /accepted`, `GET /requests`, and `GET /sent` endpoints using SQLAlchemy `joinedload` for eager loading, resolving the N+1 query problem.
- `backend/app/api/users.py` — Added `skip` and `limit` query parameters for pagination on `GET /users`, and linked endpoints to Pydantic response models.
- `backend/app/schemas/auth.py` — Added minimum 8-character password constraint and explicit response schemas.
- `frontend/src/App.jsx` — Mounted `<Profile />` component on route `/profile`.

### Database Changes
- Applied Alembic migration `1b3551e71d96`: added unique constraint `uq_connections_sender_receiver` on `connections(sender_id, receiver_id)`. Existing records preserved.

### Tests Executed
- Automated `pytest` suite: 4/4 integration suites passed in 0.58s (covering health, registration, login, profile view, profile edit, public profile, pagination, and connections lifecycle).
- Frontend `npm run lint`: 0 errors, 0 warnings.
- Frontend `npm run build`: built in 765ms with zero errors.

---

## [2026-11-11] — Phase 0 Foundation Repair & Stabilization

### Added
- `frontend/src/context/AuthContext.jsx` — Reactive auth state management, token persistence, user profile caching, and session lifecycle.
- `frontend/src/components/ProtectedRoute.jsx` — Route guard preventing unauthenticated access with full loading transition.
- `frontend/src/layout/AppLayout.jsx` — Responsive layout with persistent sidebar, topbar, active navigation, user card, and functional logout.
- `frontend/src/pages/Dashboard.jsx` — Fully dynamic student dashboard integrating with live backend APIs (`/users/me`, `/connections`, `/users`), real metric calculation, dynamic profile progress, and suggested peers with optimistic connection state handling.
- `frontend/src/pages/ComingSoon.jsx` — Clean placeholder view for upcoming modules to ensure zero broken links.
- `backend/.env.example` — Safe template for environment configuration.

### Fixed
- `frontend/src/pages/Login.jsx` — Fixed credential field payload (changed `username` to `email`), updated input attributes, and integrated with `useAuth().login`.
- `frontend/src/App.jsx` — Wrapped application with `AuthProvider`, protected authenticated views behind `ProtectedRoute`, and configured clean declarative routing.
- `backend/app/api/connections.py` — Fixed `GET /connections/sent` endpoint to filter by `status == "pending"`.
- `backend/app/db/database.py` — Disabled SQL query echoing (`echo=False`) for clean logs.
- `backend/.env` — Removed duplicate `DATABASE_URL` entry.
- `backend/main.py` — Standardized entrypoint to document and cleanly re-export `app.main:app`.

### Removed
- `frontend/vite.config.ts`, `frontend/src/App.tsx`, `frontend/src/main.tsx` — Removed redundant Vite scaffolding files.

### Database Changes
None (non-destructive stabilization only).

### Tests Executed
- Backend sanity test (FastAPI app load, settings parsing, Argon2 hashing, token generation).
- Frontend production build (`npm run build` completed cleanly in 574ms with zero errors).

---

## [2026-11-11] — Phase 0 Audit

### Added
- `PROJECT_STATUS.md` — Comprehensive project audit
- `IMPLEMENTATION_ROADMAP.md` — Full phased implementation plan
- `TECHNICAL_DECISIONS.md` — Architecture decisions record
- `TASK_TRACKER.md` — 98-task tracker across 8 phases
- `CHANGELOG.md` — This file
- `NEXT_SESSION.md` — Session continuity document

### Identified (not yet fixed)
- Login field mismatch: `Login.jsx` sends `username` but backend expects `email`
- No auth guard on dashboard route
- Hardcoded fake data throughout dashboard
- Dead "Connect" buttons on people cards
- No logout functionality
- Duplicate `backend/main.py` entry point
- Duplicate `DATABASE_URL` in `.env`
- N+1 queries in connection detail endpoints
- No DB-level unique constraint on connections table
- Missing: Community, Announcements, Messaging, Notifications, Resources modules
- Missing: All frontend pages except Login and Register
- Missing: All automated tests (0% coverage)
- Missing: Docker, deployment configuration, README

### Database Changes
None — audit only.

### Tests Executed
None — audit phase.

### Files Modified
None — documentation only.

