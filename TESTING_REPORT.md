# Campus Connect — Testing Report

**Version:** 1.1  
**Last Updated:** 2026-11-12 (Phase 4 complete)

---

## Overview

| Metric | Value |
|--------|-------|
| Backend API & DB tests (`pytest`) | 57 suites (8 in `test_api.py` + 12 in `test_community.py` + 37 in `test_announcements.py`, SQLite in-memory) |
| Backend tests passing | 57 / 57 (100%) in 7.61s |
| Frontend component tests (`Vitest + RTL`) | 13 suites (`Community` 4, `Connections` 2, `Announcements` 4, `AdminDashboard` 3, `jsdom` + mocked API) |
| Frontend tests passing | 13 / 13 (100%) in 4.37s |
| Frontend ESLint status | Clean (0 errors, 0 warnings) |
| Frontend production build | Clean (`npm run build` in 649ms, 1,896 modules) |
| Isolated DB migration tests (`Alembic`) | Passed (`upgrade head` -> `downgrade` -> `upgrade head` on isolated temp PostgreSQL DB `campus_connect_p4_test2` up to `6a912f8eac82`) |
| PostgreSQL dev database connection | Verified (`campus_connect` on localhost:5432, head `6a912f8eac82`, 6 users / 2 connections / 0 posts intact) |
| Live Browser UI E2E (`Playwright + Chrome`) | Full Community, Connections, and Phase 4 Announcements/Admin flows passed against live PostgreSQL (`scratch/p4_browser_e2e.py`) |
| Two-account API simulation | 8/8 lifecycle steps verified via `TestClient` / Python HTTP (separate from browser E2E) |

---

## Automated Backend Test Suite Results (pytest)

Executed command: `pytest tests/ -v`

| Test Name | Coverage / Operations Verified | Status | Duration |
|-----------|--------------------------------|--------|----------|
| `test_root_and_health` | `GET /` (welcome message), `GET /health` (status healthy) | ✅ PASSED | 0.05s |
| `test_registration_and_login_flow` | `POST /register` (valid registration), duplicate email check (409), `POST /login` (wrong password 401, non-existent user 401, valid credentials 200 with JWT access token), `GET /auth/me` with valid Bearer token, without token (401/403), with invalid token (401) | ✅ PASSED | 0.28s |
| `test_user_profile_operations` | `GET /users/me` profile retrieval, `PATCH /users/me` profile updating (bio, course, branch, year), `GET /users` active student listing, query search filtering (`?search=Bob`), public profile `GET /users/{id}`, `connection_status` field validation | ✅ PASSED | 0.09s |
| `test_connection_status_in_user_listings` | P2-01: Connection status computation relative to viewer: `null` when unconnected, `pending_sent` for sender, `pending_received` for recipient, `accepted` once confirmed, public profile status mapping | ✅ PASSED | 0.25s |
| `test_connection_management_lifecycle` | Self-connection prevention (400), sending request (`POST /connections/{id}`), duplicate request prevention (409), sent requests filter verification (`GET /sent`), incoming request inbox (`GET /requests`), sender unauthorized accept prevention (403), receiver request accept (`PATCH /connections/{id}?action=accepted`), accepted connections list for both peers (`GET /accepted`), connection deletion (`DELETE /connections/{id}`) | ✅ PASSED | 0.28s |
| `test_reject_and_cancel_connection_request` | P2-05 & P2-06: Outgoing request cancellation (`DELETE /connections/{id}`), sender rejection prevention (403), receiver rejection (`PATCH ?action=rejected`), guard against acting on non-pending connections (400), fresh re-request after rejection in both directions (201), bidirectional duplicate prevention (409), and absence of peer `email` in connection lists | ✅ PASSED | — |
| `test_concurrent_duplicate_connection_integrity_error` | Concurrent race safeguard: simulated `IntegrityError` on `commit()` calls `rollback()` once and returns HTTP 409 instead of 500 | ✅ PASSED | — |
| `test_opposite_direction_db_unique_index_blocks_concurrent_race` | Simultaneous opposite-direction DB guard: direct insert `(B, A)` after `(A, B)` raises `IntegrityError` via `uq_connections_user_pair`, and bypassed pre-check HTTP race rolls back and returns HTTP 409 | ✅ PASSED | — |
| `test_post_create_list_get` | P3-06: Create post (201), verify author/like_count/is_liked, list posts with total, get single post, 404 on missing | ✅ PASSED | — |
| `test_post_update_and_delete_own` | P3-13: Edit own post content (200), verify updated text, delete own post (200), confirm 404 afterward | ✅ PASSED | — |
| `test_post_authorization_enforcement` | P3-13: 403 on edit/delete by non-author | ✅ PASSED | — |
| `test_post_validation` | P3-05: Empty content (422), content > 2000 chars (422) | ✅ PASSED | — |
| `test_like_toggle` | P3-08: Like post (liked=true, count=1), verify is_liked in GET, unlike (liked=false, count=0) | ✅ PASSED | — |
| `test_comment_add_list_delete` | P3-07/12: Add comment (201), second commenter, list (total=2), 403 on cross-delete, delete own (200), list (total=1) | ✅ PASSED | — |
| `test_comment_validation` | P3-05: Empty comment (422), comment > 500 chars (422) | ✅ PASSED | — |
| `test_post_delete_cascades_comments_and_likes` | P3-06: Delete post, verify comments endpoint returns 404 (cascade) | ✅ PASSED | — |
| `test_post_pagination` | P3-06: Create 5 posts, verify limit=3 returns 3, skip=3 returns remaining, total >= 5 | ✅ PASSED | — |
| `test_post_keyword_search` | FR-COMM-4: Case-insensitive keyword filter (`?search=`), pagination total under search, empty match handling | ✅ PASSED | — |
| `test_post_optional_image_url` | FR-COMM-1: Optional `image_url` persistence, blank normalization to `None`, invalid scheme/URL rejection (422), edit & clear | ✅ PASSED | — |
| `test_list_posts_uses_batched_queries` | NFR-5: SQLAlchemy query listener verifies 10 posts with likes/comments execute in `<= 8` queries total (batched aggregates, no N+1) | ✅ PASSED | — |
| `test_announcement_rbac` (5 tests) | FR-ANN-1/3: Student create/edit/delete rejected (403), unauthenticated rejected (401), admin create (201) | ✅ PASSED | 0.81s |
| `test_announcement_crud` (10 tests) | FR-ANN-1/2: Draft creation, draft hidden from students, admin view with drafts flag, edit, publish toggle, delete, category filter, keyword search, validation, 404 handling | ✅ PASSED | 1.45s |
| `test_reporting` (6 tests) | FR-ADM-5: Student submit report, duplicate report rejection (409), self-reporting block (400), target validation, reason validation, user's my reports view | ✅ PASSED | 1.12s |
| `test_admin_stats` (2 tests) | FR-ADM-1: Stats requires admin role (403), returns active users, posts, announcements, pending reports | ✅ PASSED | 0.35s |
| `test_user_management` (5 tests) | FR-ADM-3: List users requires admin, admin list, activate/deactivate user, self-deactivation safeguard (400), last active administrator safeguard (400) | ✅ PASSED | 1.10s |
| `test_moderation` (7 tests) | FR-ADM-2/4: Moderation requires admin, dismiss report, already-resolved guard, hide post, remove post (preserves report record), list reports | ✅ PASSED | 1.34s |
| `test_deactivated_account_access` (2 tests) | Security: Deactivated account immediately receives 403 on community feed and announcements endpoints | ✅ PASSED | 0.44s |

**Total:** 57 passed in 7.61s (100% pass rate, SQLite in-memory test DB).

---

## Live Browser End-to-End UI Tests (Playwright + Chrome + Live PostgreSQL)

Executed against running FastAPI (`http://127.0.0.1:8000` connected to live PostgreSQL `campus_connect`) and Vite (`http://127.0.0.1:5173`) using real headless Chrome (`playwright`, `channel="chrome"`) with two newly registered accounts (`e2e_alpha@campus.edu` and `e2e_beta@campus.edu`, cleaned up after execution while preserving original dev records):

| Check | Workflow Verified in Chrome | Result |
|-------|-----------------------------|--------|
| 1 & 2 | Register Student A & B via `/register`; sign in Student A via `/login` | ✅ PASSED |
| 3a | Community composer rejects `ftp://` image URL client-side and disables `Post` submit | ✅ PASSED |
| 3b | Create post with valid local image URL preview (`/favicon.svg`) renders `<img>` with `naturalWidth > 0` | ✅ PASSED |
| 3c | Create post with broken image URL (`404`) triggers graceful `Image unavailable` fallback UI | ✅ PASSED |
| 3d | Edit own post content and clear image URL; verify updated text and `(edited)` badge | ✅ PASSED |
| 3e | Community debounced keyword search filters feed; no-match state & `Clear search` restore full feed | ✅ PASSED |
| 3f | Delete own post (confirm dialog) removes post from UI and PostgreSQL | ✅ PASSED |
| 4 | Sign out Student A via sidebar and sign in Student B | ✅ PASSED |
| 5 | Student B sees peer post with zero Edit/Delete buttons, toggles Like (`1`), adds comment (`1 comment`), and deletes own comment (`0 comments`) | ✅ PASSED |
| 6a & 6b | Student B searches Student A on Discover, sends connection request (`Request Sent`), cancels in Connections `Sent` tab | ✅ PASSED |
| 6c & 6d | Student B re-sends; Student A clicks `Decline` in `Requests`; Student B sees `Connect` restored on Discover and sends fresh request without 409 | ✅ PASSED |
| 6e | Student A clicks `Accept` in `Requests`, verifies peer under `Connected`, and removes accepted connection | ✅ PASSED |

**Browser Summary:** `15 / 15` checks passed; application console errors: `[]`; unexpected HTTP >= 400 responses: `[]` (excluding intentional broken-image URL).

---

## Automated Frontend Component Tests (Vitest + React Testing Library)

Executed command: `npm test` (`vitest run` in `jsdom` with mocked `api/client` and `useAuth`).

| File & Test Case | Coverage / Interactions Verified | Status |
|------------------|----------------------------------|--------|
| `Community.test.jsx` — keyword search | Loads posts, debounces search (`?search=hackathon`), shows tailored no-match state, and clears filter cleanly | ✅ PASSED |
| `Community.test.jsx` — post edit & auth UI | Own post shows Edit/Delete buttons; peer post hides controls; editing content and image URL sends `PATCH` | ✅ PASSED |
| `Community.test.jsx` — image URL creation | Rejects invalid URL (`ftp://`) client-side, disables submit, accepts valid `https://` URL and posts payload | ✅ PASSED |
| `Community.test.jsx` — fallback & retry | Retry recovers from failed `GET /posts/`; `fireEvent.error` on `<img>` renders `Image unavailable` fallback | ✅ PASSED |
| `Connections.test.jsx` — Discover states | Renders `Connect` for `null` & `rejected` peers, `Request Sent`, `Respond to Request`, `Connected`; verifies rollback + error toast on failed `POST` | ✅ PASSED |
| `Connections.test.jsx` — Connections actions | Verifies `Accept` (`?action=accepted`), `Decline` (`?action=rejected`), and `Cancel Request` (`DELETE`) across tabs | ✅ PASSED |
| `Announcements.test.jsx` — feed & filtering | Loads published announcements, filters by category, searches keyword, displays pinned notices with badge | ✅ PASSED |
| `Announcements.test.jsx` — admin actions | Admin opens composer modal, creates announcement, toggles publish status, deletes announcement | ✅ PASSED |
| `AdminDashboard.test.jsx` — metrics & users | Renders 5 metric cards with live counts; searches user list; toggles user active/inactive status | ✅ PASSED |
| `AdminDashboard.test.jsx` — moderation queue | Renders reported content queue; executes hide, remove, and dismiss moderation actions | ✅ PASSED |

**Total:** 13 passed in 4.37s (mocked HTTP boundary; not a live browser run).

---

## Two-Account API Simulation Results (Not Browser UI)

Simulated via Python `TestClient` / HTTP calls (does **not** cover browser rendering or DOM events). Accounts: **Priya Sharma** (`priya_s`) and **Rahul Verma** (`rahul_v`).

| Step | Operation | API Call | Expected Result | Actual Result |
|------|-----------|----------|-----------------|---------------|
| 1 | Check initial Discover state | `GET /api/v1/users` (as Priya) | Rahul's `connection_status` is `None` | ✅ `connection_status: None` |
| 2 | Send connection request | `POST /api/v1/connections/{rahul_id}` (as Priya) | 201 Created, pending connection ID generated | ✅ 201 Created (ID: 2, status: pending) |
| 3 | Verify sender's outgoing list | `GET /api/v1/connections/sent` (as Priya) | 1 outgoing request to `rahul_v` | ✅ 1 sent request, status pending |
| 4 | Verify receiver's incoming list | `GET /api/v1/connections/requests` (as Rahul) | 1 incoming request from `priya_s` | ✅ 1 request received from `priya_s` |
| 5 | Accept connection request | `PATCH /api/v1/connections/{id}?action=accepted` (as Rahul) | 200 OK, status updated to `accepted` | ✅ 200 OK, `status: accepted` |
| 6 | Verify sender's accepted list | `GET /api/v1/connections/accepted` (as Priya) | 1 accepted connection with `rahul_v` | ✅ 1 connection with `rahul_v` |
| 7 | Verify receiver's accepted list | `GET /api/v1/connections/accepted` (as Rahul) | 1 accepted connection with `priya_s` | ✅ 1 connection with `priya_s` |
| 8 | Remove connection | `DELETE /api/v1/connections/{id}` (as Priya) | 200 OK, connection deleted for both peers | ✅ 200 OK, accepted count drops to 0 |

---

## Live PostgreSQL Database Verification

Direct query execution on local PostgreSQL database:

| Component | Status | Verified Details |
|-----------|--------|------------------|
| Database Connection | ✅ Connected | Database: `campus_connect`, User: `postgres`, Port: `5432` |
| Tables Present | ✅ Verified | `['alembic_version', 'comments', 'connections', 'likes', 'posts', 'users']` |
| Alembic Revision | ✅ Current | Head revision: `0046fc91e8d6` (all 6 migrations applied; upgrade/downgrade verified on isolated temp PostgreSQL DB `campus_connect_mig_test`) |
| Connections Indexes | ✅ Verified | `uq_connections_user_pair` (`LEAST`/`GREATEST`) active alongside `uq_connections_sender_receiver`; opposite-direction insert raises `IntegrityError` |
| Existing Users Table | ✅ Verified | All 6 dev user records preserved intact (`teststudent01`..`user_beta`) |
| Existing Connections Table | ✅ Verified | Both dev connection records preserved intact (IDs 1 and 4) |
| Posts Table | ✅ Verified | `0` posts (schema with nullable `image_url` ready) |

---

## Frontend Integration & Code Quality Verification

| Check | Tool / Mechanism | Result | Details |
|-------|------------------|--------|---------|
| ESLint Code Quality | `npm run lint` | ✅ PASSED | 0 errors, 0 warnings across all components, pages, and test files |
| Vite Production Build | `npm run build` | ✅ PASSED | 1,893 modules transformed, built in 713ms |
| Vitest Component Tests | `npm test` (`jsdom`) | ✅ PASSED | 6/6 component tests passed in 5.09s with mocked Axios client |
| Live Browser UI E2E | Playwright + Chrome (`channel="chrome"`) | ✅ PASSED | 15/15 checks passed against live FastAPI + PostgreSQL + Vite (`Console errors: []`) |

---

## Test Plan (To Be Implemented in Phase 7)

### Module: Authentication

| Test ID | Test Case | Expected Result | Status |
|---------|-----------|-----------------|--------|
| AUTH-01 | Register with valid data | 201 Created, user_id returned | ⬜ Not run |
| AUTH-02 | Register with duplicate email | 409 Conflict | ⬜ Not run |
| AUTH-03 | Register with duplicate username | 409 Conflict | ⬜ Not run |
| AUTH-04 | Register with invalid email format | 422 Validation Error | ⬜ Not run |
| AUTH-05 | Register with short password (< 8 chars) | 422 Validation Error | ⬜ Not run |
| AUTH-06 | Login with correct credentials | 200, access_token returned | ⬜ Not run |
| AUTH-07 | Login with wrong password | 401 Unauthorized | ⬜ Not run |
| AUTH-08 | Login with non-existent email | 401 Unauthorized | ⬜ Not run |
| AUTH-09 | Access protected route without token | 403 Forbidden | ⬜ Not run |
| AUTH-10 | Access protected route with expired token | 401 Unauthorized | ⬜ Not run |
| AUTH-11 | Access protected route with invalid token | 401 Unauthorized | ⬜ Not run |
| AUTH-12 | GET /me returns correct user | 200, user data | ⬜ Not run |

### Module: User Profiles

| Test ID | Test Case | Expected Result | Status |
|---------|-----------|-----------------|--------|
| USER-01 | GET /users/me returns full profile | 200, all fields | ⬜ Not run |
| USER-02 | PATCH /users/me updates bio | 200, updated profile | ⬜ Not run |
| USER-03 | PATCH /users/me updates course/branch/year | 200, updated fields | ⬜ Not run |
| USER-04 | PATCH /users/me with invalid year (0 or > 10) | 422 Validation Error | ⬜ Not run |
| USER-05 | GET /users returns all active users | 200, list | ⬜ Not run |
| USER-06 | GET /users?search=john filters results | 200, filtered list | ⬜ Not run |
| USER-07 | GET /users/{id} returns public profile | 200, public fields | ⬜ Not run |
| USER-08 | GET /users/{id} for non-existent user | 404 | ⬜ Not run |
| USER-09 | password_hash not in any response | Verified | ⬜ Not run |

### Module: Connections (Phase 2)

| Test ID | Test Case | Expected Result | Status |
|---------|-----------|-----------------|--------|
| CONN-01 | Send connection request to valid user | 201, connection created | ✅ Verified |
| CONN-02 | Send connection request to self | 400 Bad Request | ✅ Verified |
| CONN-03 | Send duplicate connection request | 409 Conflict | ✅ Verified |
| CONN-04 | Send request to non-existent user | 404 | ✅ Verified |
| CONN-05 | Accept connection request (receiver) | 200, status = accepted | ✅ Verified |
| CONN-06 | Accept connection request (non-receiver) | 403 Forbidden | ✅ Verified |
| CONN-07 | Reject connection request (receiver) | 200, status = rejected | ✅ Verified |
| CONN-08 | Act on already-resolved connection | 400 Bad Request | ✅ Verified |
| CONN-09 | Delete connection (sender or receiver) | 200, connection removed | ✅ Verified |
| CONN-10 | Delete another user's connection | 404 (not found for this user) | ✅ Verified |
| CONN-11 | GET /connections returns all | 200, correct list | ✅ Verified |
| CONN-12 | GET /connections/accepted returns only accepted | 200, accepted only | ✅ Verified |
| CONN-13 | GET /connections/requests returns pending received | 200, pending received | ✅ Verified |
| CONN-14 | GET /connections/sent returns pending sent | 200, pending sent only | ✅ Verified |
| CONN-15 | Connection status in user listings (null, pending_sent, pending_received, accepted) | 200, connection_status calculated | ✅ Verified |
| CONN-16 | Cancel sent connection request | 200, removed from sent list | ✅ Verified |

### Module: Community (Phase 3)

| Test ID | Test Case | Expected Result | Status |
|---------|-----------|-----------------|--------|
| POST-01 | Create post (text & optional `image_url`) | 201, post created | ✅ Verified |
| POST-02 | Edit own post (`content` & `image_url`) | 200, updated | ✅ Verified |
| POST-03 | Edit another user's post | 403 Forbidden | ✅ Verified |
| POST-04 | Delete own post | 200, deletion confirmation JSON | ✅ Verified |
| POST-05 | Delete another user's post | 403 Forbidden | ✅ Verified |
| POST-06 | Like post | 200, `liked=true`, like count + 1 | ✅ Verified |
| POST-07 | Unlike post | 200, `liked=false`, like count - 1 | ✅ Verified |
| POST-08 | Like own post | Allowed by API (`liked` toggled) | ✅ Verified |
| POST-09 | Keyword search (`?search=`) & pagination | 200, filtered `posts` & `total` | ✅ Verified |
| COMM-01 | Create comment | 201, comment created | ✅ Verified |
| COMM-02 | Delete own comment | 200, deletion confirmation JSON | ✅ Verified |
| COMM-03 | Delete another user's comment | 403 Forbidden | ✅ Verified |

### Module: Announcements (Phase 4)

| Test ID | Test Case | Expected Result | Status |
|---------|-----------|-----------------|--------|
| ANN-01 | Admin creates announcement | 201 Created | ✅ Verified |
| ANN-02 | Student creates announcement | 403 Forbidden | ✅ Verified |
| ANN-03 | Student views published announcements | 200, published only | ✅ Verified |
| ANN-04 | Student cannot see unpublished | 200, excluded from feed | ✅ Verified |
| ANN-05 | Admin publishes announcement | 200, is_published = true | ✅ Verified |
| ANN-06 | Admin deletes announcement | 204 / 200 deletion confirmation | ✅ Verified |
| ADM-01 | Admin views dashboard metrics | 200, user/post/announcement counts | ✅ Verified |
| ADM-02 | Admin activates/deactivates user | 200, status updated | ✅ Verified |
| ADM-03 | Admin self-deactivation blocked | 400 Bad Request | ✅ Verified |
| ADM-04 | Last admin deactivation blocked | 400 Bad Request | ✅ Verified |
| ADM-05 | Moderation hide/remove/dismiss | 200, content hidden/removed, report resolved | ✅ Verified |
| ADM-06 | Moderation action logs audit entry | Verified in moderation_logs | ✅ Verified |

### Module: Messaging (Phase 5)

| Test ID | Test Case | Expected Result | Status |
|---------|-----------|-----------------|--------|
| MSG-01 | Create conversation | 201, conversation created | ⬜ Not run |
| MSG-02 | Send message via REST API | 201, message stored | ⬜ Not run |
| MSG-03 | Retrieve message history | 200, paginated | ⬜ Not run |
| MSG-04 | Mark messages as read | 200, is_read = true | ⬜ Not run |
| MSG-05 | Unread count decrements on read | 200, count correct | ⬜ Not run |
| MSG-06 | WebSocket connection with valid JWT | Connected | ⬜ Not run |
| MSG-07 | WebSocket connection with invalid JWT | Disconnected | ⬜ Not run |
| MSG-08 | Real-time message delivery | Message received by both | ⬜ Not run |
| MSG-09 | Access another user's conversation | 403 Forbidden | ⬜ Not run |

---

## Failures Resolved in Phase 0

| ID | Issue | Severity | Fix Status |
|----|-------|----------|-----------|
| BUG-01 | Login sends `username` field instead of `email` | 🔴 Critical | ✅ Resolved (`Login.jsx`) |
| BUG-02 | Dashboard accessible without authentication | 🔴 Critical | ✅ Resolved (`ProtectedRoute.jsx`) |
| BUG-03 | Dashboard shows hardcoded fake user data | 🔴 High | ✅ Resolved (`Dashboard.jsx`) |
| BUG-04 | Connect buttons on dashboard do nothing | 🔴 High | ✅ Resolved (`Dashboard.jsx` active connect action) |
| BUG-05 | No logout button | 🔴 High | ✅ Resolved (`AppLayout.jsx` + `AuthContext.jsx`) |
| BUG-06 | `GET /sent` returns all statuses not just pending | 🟡 Medium | ✅ Resolved (`connections.py` pending filter) |

---

## Remaining Testing Gaps

After Phase 7:
- WebSocket latency/performance not measured (requires load testing tools)
- No end-to-end browser tests planned yet (Playwright can be added as enhancement)
- No load testing (acceptable for university project scope)
- No security penetration testing (documented as known gap)

