# Campus Connect — Project Status

**Audit Date:** 2026-11-11  
**Auditor:** Principal Architect / AI Engineering Lead  
**Current Phase:** Phase 3 Complete (SRS Remediated) — Ready for Phase 4 Approval

---

## 1. Project Overview

Campus Connect is a full-stack web platform designed to connect students and campus communities. It provides authentication, student profiles, connections, community posts/comments/likes/search, and is planned to support announcements, real-time messaging, notifications, and campus resource management.

**Repository layout:**
```
Campus Connect/
├── backend/           FastAPI + SQLAlchemy + Alembic
│   ├── app/
│   │   ├── api/       auth.py, users.py, connections.py, posts.py
│   │   ├── core/      config.py, security.py, dependencies.py
│   │   ├── db/        database.py, dependencies.py
│   │   ├── models/    user.py, connection.py, post.py, comment.py, like.py, base.py
│   │   ├── schemas/   auth.py, user.py, post.py
│   │   ├── services/  (empty — helper serialization currently sits in routers)
│   │   └── main.py
│   ├── migrations/    6 Alembic revisions (head: 0046fc91e8d6)
│   ├── tests/         test_api.py (8 suites), test_community.py (12 suites)
│   └── main.py        (re-exports app.main:app)
├── frontend/          React 19 + Vite 8 + Tailwind CSS 4 + Vitest
│   └── src/
│       ├── api/       client.js (Axios)
│       ├── pages/     Login.jsx, Register.jsx, Dashboard.jsx, Profile.jsx, Discover.jsx, Connections.jsx, Community.jsx
│       ├── tests/     setup.js, Community.test.jsx, Connections.test.jsx
│       └── App.jsx    (routing & providers)
├── campus_connect_proposal.pdf
├── campus_connect_srs.pdf
└── campus_connect_uml_sources.zip
```

---

## 2. Current Architecture

### Backend
| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | FastAPI | 0.141.1 |
| ORM | SQLAlchemy | 2.0.52 (declarative mapped_column style) |
| Migrations | Alembic | 1.19.1 |
| Database | PostgreSQL via psycopg3 | — |
| Auth | PyJWT + pwdlib (Argon2) | — |
| Validation | Pydantic v2 | 2.13.4 |
| Config | pydantic-settings | 2.15.0 |
| Server | Uvicorn | 0.52.3 |

### Frontend
| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React | 19.2.8 |
| Bundler | Vite | 8.2.2 |
| Styling | Tailwind CSS | 4.3.3 |
| Routing | React Router DOM | 7.18.3 |
| HTTP | Axios | 1.20.0 |
| Icons | Lucide React | 1.38.0 |

---

## 3. Completed Functionality

### Backend — Verified Working

#### Authentication (`/api/v1/auth`)
- ✅ `POST /register` — Creates user with Argon2-hashed password, checks duplicate email/username
- ✅ `POST /login` — Validates credentials, returns JWT (HS256, 60 min expiry)
- ✅ `GET /me` — Returns minimal user info for token holder
- ✅ JWT middleware (`HTTPBearer` → decode → user_id injection)
- ✅ Password never stored in plain text
- ✅ Pydantic validation on register/login payloads

#### Users (`/api/v1/users`)
- ✅ `GET /me` — Full profile retrieval with typed `CurrentUserProfileResponse`
- ✅ `PATCH /me` — Partial profile update (full name, bio, course, branch, year, avatar URL)
- ✅ `GET /{user_id}` — Public profile retrieval with `PublicUserProfileResponse` (hides private email, includes `connection_status` & `connection_id`)
- ✅ `GET /` — List active users with search, course/branch/year filtering, pagination (`skip`/`limit`), and dynamic `connection_status` computation

#### Connections (`/api/v1/connections`)
- ✅ `POST /{user_id}` — Send connection request (self-connect prevented, bidirectional duplicate checked, rejected requests allow fresh re-request, `IntegrityError` caught and rolled back as 409)
- ✅ `GET /` — All connections (sent + received, all statuses)
- ✅ `PATCH /{connection_id}?action=` — Accept or reject pending requests (receiver-only, non-pending rejection guarded)
- ✅ `GET /accepted` — Accepted connections eager-loaded with `joinedload` (peer email excluded)
- ✅ `GET /requests` — Incoming pending requests eager-loaded with `joinedload` (peer email excluded)
- ✅ `GET /sent` — Outgoing pending requests eager-loaded with `joinedload` (peer email excluded)
- ✅ `DELETE /{connection_id}` — Remove a connection or cancel an outgoing request (sender or receiver)

#### Community (`/api/v1/posts`)
- ✅ `POST /` — Create post with text + optional validated `image_url` (`http://`/`https://`)
- ✅ `GET /` — Reverse-chronological paginated feed with `?search=` keyword filter (`FR-COMM-4`) and batched aggregate queries (`like_count`, `comment_count`, `is_liked`)
- ✅ `GET /{post_id}` — Retrieve single post detail
- ✅ `PATCH /{post_id}` — Author-only post content and `image_url` update (`403` for non-authors)
- ✅ `DELETE /{post_id}` — Author-only post deletion with cascade delete of comments & likes (`403` for non-authors)
- ✅ `POST /{post_id}/comments`, `GET /{post_id}/comments`, `DELETE /comments/{comment_id}` — Comment creation, chronological listing, author-only deletion
- ✅ `POST /{post_id}/like` — Idempotent like/unlike toggle backed by `uq_likes_post_user`

#### Database
- ✅ `users` table — Full schema
- ✅ `connections` table — sender_id FK, receiver_id FK, status, timestamps, composite unique constraint `uq_connections_sender_receiver`, bidirectional expression unique index `uq_connections_user_pair` (`LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id)`)
- ✅ `posts` table — author_id FK (`CASCADE`), content, nullable `image_url`, timestamps
- ✅ `comments` table — post_id FK (`CASCADE`), author_id FK (`CASCADE`), content, created_at
- ✅ `likes` table — post_id FK (`CASCADE`), user_id FK (`CASCADE`), composite unique constraint `uq_likes_post_user`
- ✅ 6 Alembic migrations applied up to `0046fc91e8d6`
- ✅ Indexes on id, email, username, sender_id, receiver_id, post_id, author_id, user_id

### Frontend — Verified Present
- ✅ Login page — Correctly sends `email` & `password`, integrates with `AuthContext`
- ✅ Register page — Full validation, creates user, redirects to login
- ✅ Authentication State — `AuthContext` provides reactive token management, current user caching, and `logout`
- ✅ Route Protection — `ProtectedRoute` redirects unauthorized requests to `/login`, renders loading state while validating
- ✅ Shared AppLayout — Responsive sidebar, topbar, user profile pill, and functional logout button
- ✅ Dashboard — Connected to live backend (`/api/v1/users/me`, `/api/v1/connections`, `/api/v1/users`), calculates real connection metrics, real profile completion %, live discover suggestions with functional connect requests and interactive stat cards
- ✅ Profile Page — Dedicated `Profile.jsx` with complete view and edit modes, instant preview, degree/branch/year/bio editing, and global state sync via `refreshUser()`
- ✅ Discover Page — Dedicated `Discover.jsx` with live debounced search, course/branch/year filter dropdowns, student cards with all connection states (Connect including after rejection, Request Sent, Respond to Request, Connected), optimistic updates with rollback, and loading skeletons
- ✅ Connections Page — Dedicated `Connections.jsx` with 3 active tabs (Connected, Requests, Sent), badge counts, Accept/Decline incoming requests, Cancel outgoing requests, Remove accepted connection, optimistic updates with rollback, and inline search
- ✅ Community Page — Dedicated `Community.jsx` with debounced keyword search bar, post composer with optional `image_url` input/validation/preview, image rendering with `onError` graceful fallback, optimistic like toggle, inline post edit/delete for authors, expandable comment threads, pagination, loading skeletons, and error retry
- ✅ Placeholder Views — `ComingSoon` component wired to pending Phase 4–6 workspace routes preventing dead links

---

## 4. Partially Implemented Functionality

| Feature | Status | Notes |
|---------|--------|-------|
| Admin dashboard | Partial | User role field exists; `get_current_admin` RBAC dependency active; admin UI queued for Phase 4 |

---

## 5. Resolved in Phase 0, 1 & 2 vs Remaining Technical Issues

### Fixed in Phase 0, 1 & 2:
- ✅ **Login field mismatch:** Fixed in `Login.jsx` (changed `username` to `email`, wired to `useAuth().login`).
- ✅ **No auth guard on dashboard:** Added `ProtectedRoute` in `App.jsx`.
- ✅ **Hardcoded user identity:** Replaced with live user data from `AuthContext` (`/api/v1/users/me`).
- ✅ **Hardcoded stats:** Replaced with computed metrics based on real user connections and profile completion.
- ✅ **Hardcoded people & dead buttons:** Replaced with live `/api/v1/users` suggestions with active connect actions.
- ✅ **No logout:** Added functional signout button to `AppLayout.jsx` with full session clearance.
- ✅ **`GET /sent` status filtering:** Updated `connections.py` to filter `status == "pending"`.
- ✅ **Duplicate entry point:** `backend/main.py` cleaned up and standardized to re-export `app.main:app`.
- ✅ **Duplicate DATABASE_URL in .env:** Cleaned up `.env` and created `.env.example`.
- ✅ **`echo=True` in production config:** Disabled in `database.py`.
- ✅ **Duplicate JS/TS scaffolding:** Removed unused `.tsx` and `vite.config.ts` files; confirmed clean Vite build.
- ✅ **DB-level unique constraint on connections:** Applied Alembic revision `1b3551e71d96`.
- ✅ **N+1 queries in connections:** Optimized `GET /accepted`, `/requests`, and `/sent` with SQLAlchemy `joinedload`.
- ✅ **Public profile endpoint:** Added `GET /api/v1/users/{user_id}` and pagination on `GET /api/v1/users`.
- ✅ **Dedicated Profile UI:** Created `frontend/src/pages/Profile.jsx` with view and edit modes.
- ✅ **Connection status in user listings:** Added dynamic `connection_status` and `connection_id` to `GET /users` and `GET /users/{id}` (P2-01).
- ✅ **Dedicated Discover page:** Created `frontend/src/pages/Discover.jsx` with live debounced search, course/branch/year filters, student cards with all connection states, optimistic updates with rollback, and loading skeletons (P2-02).
- ✅ **Dedicated Connections page:** Created `frontend/src/pages/Connections.jsx` with Connected, Requests, and Sent tabs, badge counts, Accept/Decline, Cancel sent, Remove connection, and optimistic rollback (P2-03 to P2-07).

### Remaining SRS Discrepancies & Outstanding Requirements (Mapped to Phases):
| SRS Req / Area | Current Behavior | Target Phase |
|----------------|------------------|--------------|
| `FR-AUTH-3` & `FR-AUTH-5` (Refresh token & logout revocation) | Single 60-min JWT access token only; logout clears `localStorage` client-side without server-side revocation | Phase 7 (Security & Auth Hardening) |
| `FR-AUTH-1` (Institutional email domain enforcement) | `RegisterRequest` accepts any valid `EmailStr` | Phase 4 / Phase 7 (configurable domain allowlist) |
| Role naming (`"administrator"` vs `"admin"`) | `get_current_admin` checks `current_user.role != "admin"`; SRS specifies `"administrator"` | Phase 4 (standardize before Admin UI & Announcements) |
| `FR-ADM-5` (Post/comment reporting & moderation queue) | Not implemented in Phase 3 | Phase 4 (`Admin & Moderation`) |
| Standalone `Post Detail` screen (SRS 6.1) | Comments render inline inside expandable `PostCard` drawer; `GET /posts/{id}` exists in API | Optional enhancement / Phase 7 |
| SRS 5.3 UI/client stack (TypeScript, shadcn/ui, TanStack Query) | Implemented in React JS + custom Tailwind CSS v4 + Axios | Accepted foundation divergence |

### Remaining Issues & Known Limitations:
| Issue | Severity | Location | Detail |
|-------|----------|----------|--------|
| Weak JWT secret | 🟡 Medium | `.env` | Must use generated 32+ char secret in production deployment |
| Services directory empty | 🟡 Low | `app/services/` | Serialization/batch helpers currently reside in router modules |
| Standalone rate limiting missing | 🟡 Note | `auth.py` | No rate limiting yet on `/auth/login` or `/auth/register` |

---

## 6. Missing Functionality (vs. Proposal/SRS)

| Module | Required Features | Status |
|--------|-------------------|--------|
| D — Community | Posts, optional `image_url`, likes, comments, keyword search, pagination | ✅ Complete (Phase 3 + SRS remediation) |
| E — Announcements | Admin CRUD, student view, categories, publish/unpublish | ❌ Not started (Phase 4) |
| F — Messaging | WebSocket real-time DMs, conversation list, message history | ❌ Not started (Phase 5) |
| G — Notifications | Connection, message, announcement notifications | ❌ Not started (Phase 6) |
| H — Campus Resources | Academic resources, events, placement info | ❌ Not started (Phase 6) |
| Admin dashboard | Role-based admin panel & content moderation | ❌ Not started (Phase 4) |
| Profile/Post file uploads | Direct Cloudinary / multipart upload (URL strings used currently) | ❌ Not started (Phase 6/7) |
| Connections page (frontend) | Manage connections, requests, discover students | ✅ Complete (Phase 2) |
| Profile page (frontend) | View/edit profile | ✅ Complete (Phase 1) |
| Health check endpoint | `GET /health` | ✅ Complete (Phase 1) |
| Tests (backend) | pytest suite | ✅ 20 suites passing |
| Tests (frontend) | Vitest + RTL component tests | ✅ 6 suites passing (Phase 3 remediation) |
| Browser UI E2E | Live Chrome + PostgreSQL via Playwright | ✅ 15/15 browser checks passed |
| Docker | Dockerfile + docker-compose | ❌ Not started (Phase 7) |
| .env.example | Placeholder values | ✅ Complete (Phase 0) |

---

## 7. Known Technical Debt

1. No `app/services/` layer — business logic lives in route handlers / helpers
2. CORS whitelist only hardcodes localhost ports
3. Weak JWT secret placeholder in local dev environment
4. Starlette testclient httpx deprecation warning (to be updated to httpx2 in Phase 7)
5. Refresh tokens, server-side logout invalidation, and institutional email domain rules queued for hardening

---

## 8. Security Observations

| Finding | Severity | Note |
|---------|----------|------|
| Argon2 for password hashing | ✅ Good | Strong, modern memory-hard algorithm |
| JWT secret is a placeholder | 🔴 Must fix | Replace with generated 32+ char cryptographic secret before production deploy |
| Route guard on frontend | ✅ Resolved | Protected by `ProtectedRoute`, unauthenticated requests redirected |
| `.env` is in `.gitignore` | ✅ Good | Credentials won't be committed; `.env.example` provided |
| `password_hash` not returned in any API response | ✅ Good | Correctly hidden across all endpoints |
| Peer `email` hidden in profiles & connection lists | ✅ Improved | Removed from `/connections/accepted`, `/requests`, and `/sent` payloads |
| Image URL scheme validation | ✅ Good | Enforces `http://`/`https://` and rejects `javascript:` or malformed schemes |
| Password validation | ✅ Strengthened | Enforced minimum 8 characters in `schemas/auth.py` |
| No rate limiting | 🟡 Note | Recommended for production on `/auth/login` and `/auth/register` |

---

## 9. Testing Status

| Area | Tests Present | Executed | Status |
|------|--------------|----------|--------|
| Backend API (`pytest`) | 20 tests (`test_api.py` 8 + `test_community.py` 12) | 20 executed | ✅ 20/20 Passed in 3.85s (SQLite in-memory) |
| Frontend Component Tests (`Vitest + RTL`) | 6 tests (`Community.test.jsx` 4 + `Connections.test.jsx` 2) | 6 executed | ✅ 6/6 Passed in 5.09s (mocked API in `jsdom`) |
| Frontend Code Quality (ESLint) | Project-wide | Executed | ✅ 0 errors, 0 warnings |
| Frontend Production Build (Vite) | Full bundling | Executed | ✅ Built in 713ms (`1,893` modules) |
| Isolated Migration Check (`Alembic`) | `08e11984b53b` -> `0046fc91e8d6` + downgrade | Executed | ✅ Passed on temp DB (`campus_connect_mig_test`) |
| Live Browser UI E2E (Playwright + Chrome) | Full Community & Connections flows (2 accounts) | 15 executed | ✅ 15/15 Passed against live PostgreSQL (`Console errors: []`, `HTTP >= 400: []`) |
| PostgreSQL Connectivity | Live check | Executed | ✅ Connected to `campus_connect` |
| Two-Account API Simulation | Connection lifecycle | Executed | ✅ 8/8 API actions verified (`TestClient`) |

---

## 10. Database Status

- PostgreSQL connected and active on `localhost:5432`, database `campus_connect`
- Alembic migration revision: `0046fc91e8d6` (head, up-to-date)
- Tables present: `alembic_version`, `users`, `connections`, `posts`, `comments`, `likes`
- Connections indexes: `ix_connections_id`, `ix_connections_receiver_id`, `ix_connections_sender_id`, `uq_connections_sender_receiver`, `uq_connections_user_pair`
- Existing data preserved: 6 user accounts (`teststudent01`..`user_beta`), 2 connections (IDs 1 and 4), 0 posts
- **Missing tables (Phase 4–6):** announcements, messages, conversations, notifications, resources, events, reports

