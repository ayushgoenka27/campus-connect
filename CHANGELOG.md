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

