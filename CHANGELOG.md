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

