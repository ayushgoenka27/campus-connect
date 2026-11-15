# Campus Connect — Technical Decisions

**Version:** 1.0  
**Created:** 2026-11-11

---

## TD-001: Preserve Existing Technology Stack

**Decision:** Retain FastAPI, SQLAlchemy, Alembic, React, Vite, Tailwind CSS, PostgreSQL.  
**Rationale:** The existing stack is well-chosen, modern, and appropriate for the project scope. All chosen technologies are production-grade. No rewrite is warranted.  
**Date:** 2026-11-11

---

## TD-002: Keep pwdlib (Argon2) for Password Hashing

**Decision:** Retain pwdlib with Argon2 algorithm.  
**Rationale:** Argon2 is the OWASP-recommended password hashing algorithm. It is memory-hard and resistant to GPU attacks. passlib would be an alternative but is not necessary.  
**Date:** 2026-11-11

---

## TD-003: Keep PyJWT for Token Management

**Decision:** Retain PyJWT. Do not add python-jose or authlib.  
**Rationale:** PyJWT is a lightweight, well-maintained library. The current implementation correctly sets `exp` and uses HS256. Refresh tokens are not required for a campus MVP.  
**Date:** 2026-11-11

---

## TD-004: WebSockets via FastAPI Built-in Support

**Decision:** Use FastAPI's native WebSocket support (`from fastapi import WebSocket`).  
**Rationale:** FastAPI has first-class WebSocket support with no additional dependencies. For a campus MVP with one server instance, an in-process connection manager (a dict of `user_id → WebSocket`) is sufficient. Redis pub/sub is not needed unless running multiple server instances.  
**Date:** 2026-11-11

---

## TD-005: No Redis in Phase 5

**Decision:** Do not introduce Redis for the messaging module.  
**Rationale:** Redis is only necessary for multi-instance WebSocket fan-out. This campus project runs on a single server. Adding Redis would increase complexity, operational overhead, and cost without benefit at this scale. This decision should be revisited if horizontal scaling is required.  
**Date:** 2026-11-11

---

## TD-006: Profile Image Strategy — URL-Based Initially

**Decision:** Profile images are stored as URL strings. Full file upload is added in Phase 1 as an enhancement.  
**Rationale:** The model already supports `profile_image` as a string. For the initial implementation, users can paste an image URL. A proper file upload endpoint (using FastAPI `UploadFile` + local disk storage) will be added in Phase 1. Cloud storage (S3/Cloudinary) will not be introduced without user approval due to cost.  
**Date:** 2026-11-11

---

## TD-007: Service Layer Introduction

**Decision:** Introduce a service layer (`app/services/`) progressively starting in Phase 3.  
**Rationale:** The existing code places all business logic in route handlers. This is acceptable for simple CRUD operations but becomes problematic for complex operations like messaging (where a notification must also be created). A thin service layer will be introduced for the more complex modules without refactoring the existing clean routes.  
**Date:** 2026-11-11

---

## TD-008: Authentication Context on Frontend

**Decision:** Use React Context API for auth state management, not a third-party state library (Redux, Zustand).  
**Rationale:** The application's auth state is simple: a token and a user object. React Context is sufficient. Adding Redux would be overengineering. Zustand could be added in Phase 5 if WebSocket state management becomes complex, but this will be evaluated then.  
**Date:** 2026-11-11

---

## TD-009: Frontend Architecture — Page-per-Feature

**Decision:** Each major feature gets its own page component in `src/pages/`. Reusable UI elements go in `src/components/`.  
**Rationale:** The existing project already starts this pattern (Login.jsx, Register.jsx). It is clean, easy to navigate, and familiar. The monolithic `App.jsx` with internal state switching will be refactored to proper React Router routes.  
**Date:** 2026-11-11

---

## TD-010: Tailwind CSS v4 Configuration

**Decision:** Keep Tailwind CSS v4 with the Vite plugin. Do not create a `tailwind.config.js`.  
**Rationale:** Tailwind CSS v4 uses a Vite plugin approach and CSS-first configuration. The existing setup (`@tailwindcss/vite`) is correct for v4. Creating a `tailwind.config.js` is for v3 and would be incorrect.  
**Date:** 2026-11-11

---

## TD-011: Single Entry Point (Remove Duplicate main.py)

**Decision:** Remove `backend/main.py` and use only `backend/app/main.py`.  
**Rationale:** Two entry points create ambiguity about which to run. The canonical location is `app/main.py` (following FastAPI conventions). The `alembic.ini` and uvicorn startup commands should reference `app.main:app`.  
**Date:** 2026-11-11

---

## TD-012: JWT Authentication for WebSocket Connections

**Decision:** WebSocket clients will pass the JWT as a query parameter: `ws://localhost:8000/ws?token=<jwt>`.  
**Rationale:** WebSocket connections cannot set custom HTTP headers using the browser's native WebSocket API. The common patterns are (a) query parameter, or (b) first message. Query parameter is simpler and widely used. The token will be validated on connection establishment before any messages are accepted.  
**Date:** 2026-11-11

---

## TD-013: Database Migration Strategy

**Decision:** All schema changes must be accompanied by Alembic migrations. Never use `Base.metadata.create_all()` in production.  
**Rationale:** `create_all()` has no history, cannot be rolled back, and is dangerous in production. Alembic provides version-controlled, reversible schema management.  
**Date:** 2026-11-11

---

## TD-014: Pydantic Response Models

**Decision:** Add explicit Pydantic response models to all existing and new endpoints.  
**Rationale:** Currently, most endpoints return raw dicts. Using Pydantic `response_model` parameters enables automatic documentation in FastAPI's `/docs`, type validation, and ensures sensitive fields (password_hash) can never accidentally be leaked.  
**Date:** 2026-11-11

---

## TD-015: Testing Approach

**Decision:** Use pytest with FastAPI's `TestClient` and SQLite (in-memory) for backend tests. Use Vitest for frontend.  
**Rationale:** TestClient allows testing the full ASGI stack without starting a real server. SQLite in-memory database allows tests to run without a live PostgreSQL instance, making them portable and fast.  
**Date:** 2026-11-11

---

## TD-016: Frontend Stack Deviation from SRS §5.3

**Decision:** Retain the existing frontend stack (React 19 JS + Tailwind CSS v4 + Axios) instead of migrating to the SRS-recommended TypeScript + shadcn/ui + TanStack Query.

| Dimension | SRS §5.3 Recommendation | Actual Choice |
|-----------|--------------------------|---------------|
| Language | TypeScript | JavaScript (ES2022+) |
| Component library | shadcn/ui | Custom Tailwind CSS v4 components |
| Data-fetching | TanStack Query | Axios + `useState`/`useEffect` |
| UI framework | React | React 19 ✓ |
| Styling | Tailwind CSS | Tailwind CSS v4 ✓ |

**Rationale:**  
1. **Mid-project migration cost.** Decision point arose after Phases 1–3 were fully implemented and browser-tested. Migrating every `.jsx` file to TypeScript would require touching all existing schemas without adding new user-facing value.  
2. **Stack cohesion.** All existing pages follow one consistent pattern. Mixing TanStack Query with the existing `useState` pages would create two distinct coding styles.  
3. **Remaining phases planned on current stack.** Phases 4–6 were scoped and estimated assuming the current stack. Switching mid-project risks delivery delays.

**Trade-offs:**

| Trade-off | Mitigation |
|-----------|-----------|
| No compile-time type safety | JSDoc comments on shared helpers; ESLint with react-hooks and import plugins |
| No automatic cache invalidation | Optimistic UI updates with explicit rollback on API failure |
| No pre-built accessible UI primitives | Custom components follow WCAG 2.1 AA patterns (labels, `aria-label`, keyboard nav) |

**Future option:** A TypeScript migration can be done incrementally in Phase 7 using `allowJs: true` + renaming `.jsx` → `.tsx` file by file.  
**Date:** 2026-11-11

---

## TD-017: Admin Role Naming — Accept Both "admin" and "administrator"

**Decision:** `get_current_admin()` accepts both `"admin"` and `"administrator"` as valid admin role strings.

**Context:** SRS FR-ADM-1 specifies `"administrator"`. All existing backend code uses `"admin"`. All 6 dev database accounts have `role = "student"` — no migration needed for user data.

**Resolution:** Updated `get_current_admin()` to check `current_user.role not in ("admin", "administrator")`. No Alembic migration required (the `role` column is an unconstrained `String`, not an `Enum`).  
**Date:** 2026-11-11

---

## TD-018: Report History & Immutable Snapshot Preservation

**Decision:** The `reports` table stores immutable snapshot fields (`target_type`, `target_id`, `target_preview`, `target_author_id`) alongside nullable foreign keys (`post_id`, `comment_id`) configured with `ON DELETE SET NULL`. Do not use a database-level `CHECK ((post_id IS NOT NULL) != (comment_id IS NOT NULL))` constraint.

**Rationale:** When a reported post or comment is deleted (via moderation or author deletion), the live foreign key becomes NULL via `ON DELETE SET NULL`. A strict single-target check constraint would fail upon deletion, either preventing content deletion or cascading report deletion. Storing immutable target metadata preserves historical audit evidence for moderators even if the reported content no longer exists. Duplicate prevention is enforced via composite unique index `uq_reports_reporter_target` on `(reporter_id, target_type, target_id)`.  
**Date:** 2026-11-11

---

## TD-019: Announcement Author Preservation

**Decision:** The `author_id` foreign key in the `announcements` table uses `ON DELETE SET NULL` (not `CASCADE`), and is nullable.

**Rationale:** Announcements represent institutional notices (campus circulars, academic schedules, placement notices). If an administrator account is deleted or removed from the institution, existing announcements should remain visible to students with author metadata falling back to institutional defaults, rather than being deleted by database cascades.  
**Date:** 2026-11-11

---

## TD-020: Admin Account Safeguards & Inactive Access Invalidation

**Decision:** 
1. Server-side validation blocks administrators from deactivating their own account.
2. Server-side validation blocks deactivating the last active administrator.
3. Account deactivation immediately revokes access across all protected endpoints by having `get_current_user` verify `is_active is True` and return `HTTP 403 Forbidden` if false.

**Rationale:** Prevents administrative lock-out scenarios where no active administrators exist to manage the system. Checking `is_active` at request resolution in `get_current_user` guarantees immediate token invalidation for deactivated accounts without requiring token blocklist infrastructure.  
**Date:** 2026-11-11

---

## TD-021: JWT Token Version for Multi-Session Invalidation

**Decision:** Add `token_version: int` (default `1`, server_default `"1"`) to the `users` table and embed a `"tv"` claim in all issued JWT access tokens. Invalidate any token where `token_tv < user.token_version`.

**Rationale:** When a user changes their password, all previous sessions, active tokens, and WebSocket connections across all devices must be invalidated immediately without introducing a stateful token blocklist or Redis store. On password change (`POST /api/v1/auth/change-password`), `user.token_version` increments by 1, `manager.disconnect_user(user.id, code=1008)` terminates active WebSockets, and a fresh JWT with the new `token_version` is returned for the current session.
**Date:** 2026-11-15

---

## TD-022: External Academic Resources Model Without Fake File Uploads

**Decision:** Store academic resources as validated HTTP/HTTPS external links with categorized metadata (syllabus, question papers, lab manuals, handbooks, portals, study material). Do not claim or mock multipart file uploads.

**Rationale:** Accurately reflects actual storage mechanism. Administrators curate verified institutional links (Google Drive, university portals, library links, official PDFs). External URLs are validated strictly for `http://` or `https://` schemes. All authenticated students can read, filter, and search; only administrators may create, update, or delete resources.
**Date:** 2026-11-15

---

## TD-023: Event RSVPs With Database-Level Unique Constraint

**Decision:** Enforce event attendance uniqueness via database-level `UniqueConstraint("event_id", "user_id", name="uq_event_rsvps_event_user")`. Implement idempotent RSVP toggle and capacity limit checks.

**Rationale:** Guarantees that concurrent student registrations cannot create duplicate attendee records. RSVP status (`attending`, `interested`) can be updated idempotently. Past events cannot be registered for, and capacity limits are verified before record creation.
**Date:** 2026-11-15

---

## TD-024: Persistence-First Notification Delivery

**Decision:** Notifications are committed to PostgreSQL before attempting real-time WebSocket delivery. Wrap WebSocket broadcast in try-except logging to ensure delivery failure never rolls back the notification.

**Rationale:** Guarantees zero notification loss if a recipient is offline or temporarily disconnected when an event triggers. Duplicate connection requests from the same user are prevented while unread.
**Date:** 2026-11-15

---

## TD-025: In-Memory Sliding-Window Rate Limiter & Anti-Spoofing (P7-04)

**Decision:** Implement an in-memory sliding-window rate limiter in FastAPI (`core/rate_limit.py`) with environment-driven limits and explicit anti-spoofing IP resolution. Document as single-instance / process-local.
**Rationale:** Provides robust brute-force protection against rapid login/register/password change attacks without requiring paid services or external Redis infrastructure. Protects against client IP spoofing by only inspecting `X-Forwarded-For` when the direct connecting peer (`request.client.host`) matches `settings.trusted_proxies`. Exceeded limits return HTTP 429 with `Retry-After` header.
**Date:** 2026-11-15

---

## TD-026: Comprehensive Security Headers & Content Security Policy (P7-03)

**Decision:** Implement ASGI `SecurityHeadersMiddleware` setting `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, conditional HSTS, and a tailored Content Security Policy.
**Rationale:** Defends against clickjacking, MIME sniffing, and cross-site scripting. CSP is tested and verified against the actual React frontend assets, allowing `default-src 'self'`, inline styles for runtime Tailwind CSS dynamic injection (`style-src 'self' 'unsafe-inline'`), external avatar images (`img-src 'self' data: https: blob:`), and WebSocket connections (`connect-src 'self' ws: wss: http: https:`).
**Date:** 2026-11-15

---

## TD-027: Server-Side JWT Revocation on Logout (P7-06, FR-AUTH-5)

**Decision:** Implement `POST /api/v1/auth/logout` that increments `user.token_version` in PostgreSQL and terminates all open WebSocket connections for the user via `manager.disconnect_user(user.id, code=1008)`.
**Rationale:** Upgrades stateless JWT auth to genuine server-side revocation across all devices. Because `get_current_user` and `_authenticate_ws` enforce exact `token_version` matching against the database record, old access tokens immediately become unusable (HTTP 401 Unauthorized), preventing replay attacks after logout.
**Date:** 2026-11-15

---

## TD-028: Production Exception Masking & Zero-Downtime Health Probes (P7-06, P7-14)

**Decision:** Register a global exception handler in `app/main.py` that sanitizes internal server errors when `settings.environment == "production"` while preserving detailed server-side error logging. Provide separate `/health` (liveness) and `/health/db` (readiness with `SELECT 1` ping) endpoints.
**Rationale:** Prevents SQL queries, database credentials, and internal stack traces from leaking to client responses. Health probes allow orchestration layers (Docker, Kubernetes) to monitor process responsiveness and database connectivity independently without revealing infrastructure details.
**Date:** 2026-11-15


