# Campus Connect — System Architecture (P7-16)

**Version:** 1.0  
**Last Updated:** 2026-11-15

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT BROWSER                           │
│  React 19 SPA  ·  React Router 7  ·  Axios  ·  native WebSocket│
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP / WebSocket
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      NGINX (port 80)                            │
│  · Serves React static assets (JS/CSS/images)                   │
│  · SPA fallback: all unknown paths → index.html                 │
│  · Reverse proxy /api/* → FastAPI :8000                         │
│  · WebSocket upgrade /ws → FastAPI :8000                        │
│  · Gzip compression · Cache-Control headers                     │
└──────────────────┬──────────────────────────────────────────────┘
                   │ HTTP + WebSocket (internal Docker network)
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                   FastAPI (Uvicorn, port 8000)                  │
│  · JWT authentication (PyJWT + Argon2 passwords)                │
│  · Rate limiting (sliding-window, in-memory)                    │
│  · Security headers + CSP middleware                            │
│  · REST API: /api/v1/*                                          │
│  · WebSocket manager: /ws                                       │
│  · Alembic migrations on startup                                │
│  · Non-root container user (appuser, uid 1001)                  │
└──────────────────┬──────────────────────────────────────────────┘
                   │ psycopg3 (async-capable sync driver)
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│               PostgreSQL 16 (port 5432, internal only)          │
│  · Persistent volume: campus_connect_pgdata                     │
│  · 15 tables, 6 Alembic revisions                               │
│  · Partial unique indexes, CHECK constraints, CASCADE FKs       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Technology Stack

### Backend

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| Framework | FastAPI | 0.141.1 | ASGI web framework, OpenAPI docs |
| ASGI Server | Uvicorn | 0.52.3 | Production ASGI runner |
| ORM | SQLAlchemy | 2.0.52 | Database access, relationship loading |
| Migrations | Alembic | 1.19.1 | Schema version control |
| Database | PostgreSQL | 16 | Relational data store |
| DB Driver | psycopg3 | 3.3.4 | PostgreSQL async-ready driver |
| Auth | PyJWT | 2.13.0 | JWT token signing/verification |
| Passwords | pwdlib (Argon2) | 0.3.1 | Password hashing (Argon2id) |
| Validation | Pydantic v2 | 2.13.4 | Request/response schema validation |
| Settings | pydantic-settings | 2.15.0 | Environment-driven configuration |
| Real-time | websockets | ≥12.0 | WebSocket protocol support |

### Frontend

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| UI Library | React | 19.2.8 | Component-based UI |
| Routing | React Router | 7.18.3 | Client-side SPA routing |
| Build Tool | Vite | 8.2.2 | Dev server + production bundler |
| CSS | Tailwind CSS | 4.3.3 | Utility-first styling |
| HTTP Client | Axios | 1.20.0 | REST API requests with interceptors |
| Icons | lucide-react | 1.38.0 | Icon set |
| Testing | Vitest + RTL | 5.1.0 / 16.3.3 | Component unit tests |

### Infrastructure

| Component | Technology | Purpose |
|-----------|------------|---------|
| Reverse Proxy | Nginx 1.27-alpine | Static files, API proxy, WS proxy |
| Container Runtime | Docker + Compose | Local orchestration |
| Container Registry | Docker Hub / GHCR | Public free image hosting |

---

## 3. Database Schema

```
users                    connections
──────────────           ───────────────────────────
id PK                    id PK
email UNIQUE             requester_id FK→users.id
username UNIQUE          addressee_id FK→users.id
full_name                status (pending/accepted/rejected)
password_hash            created_at
role (student/admin)     ── UQ(requester_id, addressee_id)
is_active                ── partial UQ(min,max) blocks reverse duplicates
token_version            ── INDEX(addressee_id, status)
bio, course, branch,
year_of_study
avatar_url
created_at, updated_at

posts                    comments                   likes
─────────────            ────────────────────       ─────────────────
id PK                    id PK                      id PK
author_id FK→users       post_id FK→posts           post_id FK→posts
content (Text)           author_id FK→users         user_id FK→users
image_url (nullable)     content (Text)             ── UQ(post_id, user_id)
created_at               created_at

announcements            reports                    moderation_logs
─────────────────────    ─────────────────────      ───────────────────────
id PK                    id PK                      id PK
title                    reporter_id FK→users       action
content (Text)           target_type                moderator_id FK→users
category                 target_id                  report_id FK→reports
is_active                reason                     reason
author_id FK→users       status                     created_at
created_at               created_at

conversations            messages
─────────────────────    ────────────────────────────────
id PK                    id PK
participant_1 FK→users   conversation_id FK→conversations
participant_2 FK→users   sender_id FK→users
created_at               content (Text)
── UQ(p1,p2) ordered     status (sent/delivered/read)
                         client_msg_id (dedup)
                         created_at

notifications            resources                  events + event_rsvps
─────────────────────    ─────────────────────      ───────────────────────
id PK                    id PK                      events.id PK
user_id FK→users         title                      title, description
actor_id FK→users        description                category
type                     category                   start_time, end_time
message                  url (HTTP/HTTPS)           location
entity_type, entity_id   created_by FK→users        capacity (nullable)
is_read                  created_at                 created_by FK→users
created_at                                          rsvps: UQ(event_id,user_id)
── INDEX(user_id,is_read)
── INDEX(user_id,created_at)
```

**Alembic revision chain:**
```
(base) → 1b3551e71d96 → 6a912f8eac82 → 0046fc91e8d6 → 9f35bc80d4a1 → b78e3c5a2d91 → 055c082ed165 (head)
```

---

## 4. API Endpoint Map

| Module | Prefix | Key Endpoints |
|--------|--------|---------------|
| Auth | `/api/v1/auth` | `POST /register`, `POST /login`, `POST /logout`, `POST /change-password` |
| Users | `/api/v1/users` | `GET /me`, `PATCH /me`, `GET /` (discover), `GET /{id}` |
| Connections | `/api/v1/connections` | `POST /`, `GET /` (accepted), `GET /requests`, `GET /sent`, `PATCH /{id}`, `DELETE /{id}` |
| Posts | `/api/v1/posts` | `GET /`, `POST /`, `PATCH /{id}`, `DELETE /{id}`, `POST /{id}/like`, `DELETE /{id}/like`, `GET /{id}/comments`, `POST /{id}/comments` |
| Announcements | `/api/v1/announcements` | `GET /`, `POST /` (admin), `PATCH /{id}` (admin), `DELETE /{id}` (admin), `POST /{id}/report` |
| Reports | `/api/v1/reports` | `GET /` (admin), `PATCH /{id}` (admin) |
| Admin | `/api/v1/admin` | `GET /stats`, `GET /users`, `PATCH /users/{id}`, `GET /moderation`, `POST /moderation/{id}` |
| Conversations | `/api/v1/conversations` | `GET /`, `POST /`, `GET /{id}/messages`, `POST /{id}/messages` |
| Notifications | `/api/v1/notifications` | `GET /`, `GET /unread-count`, `POST /{id}/read`, `POST /read-all`, `DELETE /{id}` |
| Resources | `/api/v1/resources` | `GET /`, `POST /` (admin), `PATCH /{id}` (admin), `DELETE /{id}` (admin) |
| Events | `/api/v1/events` | `GET /`, `GET /{id}`, `POST /` (admin), `PATCH /{id}` (admin), `DELETE /{id}` (admin), `POST /{id}/rsvp`, `DELETE /{id}/rsvp` |
| WebSocket | (root) | `WS /ws?token=<jwt>` |
| Health | (root) | `GET /health`, `GET /health/db` |

---

## 5. Real-Time Architecture (WebSocket)

```
Client Browser                  FastAPI WebSocketManager
──────────────                  ───────────────────────
  connect /ws?token=<jwt>  ───►  Authenticate JWT (token_version check)
                           ◄───  {"type":"connected","online_users":[...]}

  send {"type":"ping"}     ───►  {"type":"pong"}

  send {"type":"chat_message",  ───►  Store in DB
        "conversation_id":X,         ───►  {"type":"new_message",...} to recipient
        "content":"..."}

  send {"type":"mark_read",     ───►  Update message status in DB
        "conversation_id":X}         ───►  {"type":"read_receipt",...} to sender

  disconnect               ───►  Broadcast {"type":"presence","is_online":false}
```

**WebSocket message types:**

| Type | Direction | Description |
|------|-----------|-------------|
| `connected` | Server→Client | On connect: online user list |
| `ping` | Client→Server | Heartbeat (every 30s) |
| `pong` | Server→Client | Heartbeat reply |
| `chat_message` | Client→Server | Send a message |
| `new_message` | Server→Client | Incoming message delivery |
| `mark_read` | Client→Server | Mark conversation as read |
| `read_receipt` | Server→Client | Delivery confirmation |
| `typing` | Client↔Server | Typing indicator |
| `presence` | Server→Client | User online/offline update |
| `notification` | Server→Client | Real-time notification push |

---

## 6. Security Architecture

| Layer | Mechanism | Detail |
|-------|-----------|--------|
| Authentication | JWT (HS256) | Signed tokens, 24h expiry, `token_version` for revocation |
| Password hashing | Argon2id | Via `pwdlib`, memory-hard, salted |
| Authorization | Role-based | `student` / `admin` roles, enforced per endpoint |
| Session revocation | `token_version` | Incremented on logout/password-change; old tokens rejected |
| Rate limiting | Sliding-window (in-memory) | 15 req/min auth, 60 req/min general; anti-spoofing on X-Forwarded-For |
| CORS | Explicit origin list | No wildcard `*`; credentials enabled |
| CSP | Per-request header | `default-src 'self'`; justified exceptions documented |
| Security headers | Middleware | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, HSTS, `Permissions-Policy` |
| Input validation | Pydantic v2 | Strict schema validation on all request bodies |
| URL validation | Scheme check | `http://` and `https://` only on resource URLs |
| SQL injection | SQLAlchemy ORM | Fully parameterized queries; no raw string interpolation |
| Error masking | Global handler | Production 500s return generic message; stack traces logged server-side only |

---

## 7. Frontend Architecture

```
src/
├── api/
│   └── client.js          Axios instance; relative URLs in production
├── context/
│   └── AuthContext.jsx     JWT storage, user state, login/logout
├── hooks/
│   └── useWebSocket.js    WS connect, heartbeat, reconnect backoff, message dispatch
├── layout/
│   └── AppLayout.jsx      Sidebar nav, notifications bell, sign-out
├── components/
│   ├── ProtectedRoute.jsx      Auth guard
│   ├── AdminRoute.jsx          Admin role guard
│   ├── ErrorBoundary.jsx       React error boundary (P7-06)
│   ├── RouteLoadingFallback.jsx Lazy-load skeleton (P7-09)
│   └── NotificationsDropdown.jsx Real-time notification bell
└── pages/                 All routes — lazy-loaded via React.lazy()
    ├── Login / Register / Profile / Dashboard
    ├── Discover / Connections
    ├── Community (posts, comments, likes)
    ├── Messages (WebSocket-powered)
    ├── Announcements / Resources / Events
    ├── Settings (password change)
    └── AdminDashboard
```

**Route code-splitting:** All 13 page components are loaded via `React.lazy()` + `Suspense`. Initial JS bundle: **251.86 kB** (79.82 kB gzip), down from 484.73 kB (−48%).

---

## 8. SRS Traceability Matrix

| FR ID | Requirement | Implementation | Test Coverage |
|-------|-------------|----------------|---------------|
| FR-AUTH-1 | User registration with email/password | `POST /api/v1/auth/register` → `users` table | `test_api.py::test_register_user` |
| FR-AUTH-2 | User login returns JWT | `POST /api/v1/auth/login` | `test_api.py::test_login_user` |
| FR-AUTH-3 | Password minimum 8 characters | `schemas/auth.py` Pydantic validator | `test_api.py::test_password_strength` |
| FR-AUTH-4 | Protected routes require valid JWT | `dependencies.py::get_current_user` | Multiple test files |
| FR-AUTH-5 | Server-side logout/token revocation | `POST /auth/logout` increments `token_version` | `test_security_p7.py::test_logout_revokes_token` |
| FR-PRF-1 | View and edit own profile | `GET/PATCH /api/v1/users/me` | `test_api.py::test_update_profile` |
| FR-PRF-2 | View public profile of other users | `GET /api/v1/users/{id}` | `test_api.py::test_public_profile` |
| FR-CON-1 | Send connection request | `POST /api/v1/connections` | `test_api.py::test_send_connection` |
| FR-CON-2 | Accept/reject connection request | `PATCH /api/v1/connections/{id}` | `test_api.py::test_accept_connection` |
| FR-CON-3 | Cancel sent connection request | `DELETE /api/v1/connections/{id}` | `test_api.py::test_cancel_request` |
| FR-CON-4 | Prevent duplicate connections | Partial unique index + DB constraint | `test_api.py::test_concurrent_duplicate_connection` |
| FR-COM-1 | Create community post | `POST /api/v1/posts` | `test_community.py::test_create_post` |
| FR-COM-2 | Edit/delete own post | `PATCH/DELETE /api/v1/posts/{id}` | `test_community.py::test_edit_post` |
| FR-COM-3 | Like/unlike post | `POST/DELETE /api/v1/posts/{id}/like` | `test_community.py::test_like_post` |
| FR-COM-4 | Comment on post | `POST /api/v1/posts/{id}/comments` | `test_community.py::test_add_comment` |
| FR-COM-5 | Search posts by keyword | `GET /api/v1/posts?search=...` | `test_community.py::test_search_posts` |
| FR-ANN-1 | Browse announcements | `GET /api/v1/announcements` | `test_announcements.py` |
| FR-ANN-2 | Admin creates/edits announcements | `POST/PATCH /api/v1/announcements` | `test_announcements.py::TestAdminActions` |
| FR-ANN-3 | Report inappropriate announcement | `POST /api/v1/announcements/{id}/report` | `test_announcements.py::TestReporting` |
| FR-MSG-1 | Real-time messaging via WebSocket | `WS /ws` + `useWebSocket.js` | `test_messages.py` |
| FR-MSG-2 | Message history persistence | `GET /api/v1/conversations/{id}/messages` | `test_messages.py::TestMessagingAndHistory` |
| FR-MSG-3 | Read receipt delivery | WebSocket `mark_read` → `read_receipt` | `test_messages.py::test_read_receipt` |
| FR-MSG-4 | Unread message count | `GET /api/v1/conversations` returns `unread_count` | `test_messages.py::test_unread_count` |
| FR-MSG-5 | Typing indicator | WebSocket `typing` event | `useWebSocket.js` |
| FR-NOT-1 | Real-time notification push | WebSocket `notification` event from `notification_service` | `test_phase6.py::test_notification_push` |
| FR-NOT-2 | Notification persistence | `notifications` table, `GET /api/v1/notifications` | `test_phase6.py` |
| FR-NOT-3 | Mark notifications read | `POST /api/v1/notifications/read-all` | `test_phase6.py::test_mark_notifications_read` |
| FR-RES-1 | Browse campus resources | `GET /api/v1/resources` with category/search filters | `test_phase6.py::test_resources` |
| FR-RES-2 | Admin manages resources | `POST/PATCH/DELETE /api/v1/resources` | `test_phase6.py::test_admin_resources` |
| FR-EVT-1 | Browse upcoming/past events | `GET /api/v1/events?tab=upcoming\|past` | `test_phase6.py::test_events` |
| FR-EVT-2 | RSVP to event | `POST/DELETE /api/v1/events/{id}/rsvp` | `test_phase6.py::test_rsvp` |
| FR-ADM-1 | Admin dashboard statistics | `GET /api/v1/admin/stats` | `test_announcements.py::TestAdminStats` |
| FR-ADM-2 | Deactivate/reactivate user | `PATCH /api/v1/admin/users/{id}` | `test_announcements.py::TestAdminUserManagement` |
| FR-ADM-3 | Moderation queue | `GET/POST /api/v1/admin/moderation` | `test_announcements.py::TestModeration` |
| FR-SET-1 | Change password (invalidates sessions) | `POST /api/v1/auth/change-password` → increments `token_version` | `test_security_p7.py::test_password_change_revokes` |
| FR-SEC-1 | Rate limit auth endpoints | `core/rate_limit.py` sliding-window | `test_security_p7.py::TestRateLimiting` |
| FR-SEC-2 | Security response headers + CSP | `core/security_headers.py` middleware | `test_security_p7.py::TestSecurityHeaders` |
| FR-SEC-3 | CORS validation | `CORSMiddleware` with explicit origins | `test_security_p7.py::TestCORS` |
| FR-ERR-1 | Production error masking | Global exception handler in `main.py` | `test_security_p7.py::TestErrorHandling` |
| FR-ERR-2 | Frontend error boundary | `ErrorBoundary.jsx` | `ErrorBoundary.test.jsx` |
| FR-PERF-1 | Database N+1 elimination | Batched queries in `conversations.py` | `test_messages.py` (timing) |
| FR-PERF-2 | Route code splitting | `React.lazy()` + `Suspense` in `App.jsx` | `RouteLoadingFallback.test.jsx` |
| FR-OPS-1 | Health check endpoints | `GET /health`, `GET /health/db` | `test_security_p7.py::TestHealthChecks` |
| FR-OPS-2 | Docker Compose deployment | `docker-compose.yml` | Structurally verified; runtime pending live Docker engine |
| FR-OPS-3 | Database backup/restore | `scripts/backup.sh`, `scripts/restore.sh` | Script syntax verified; runtime pending live Docker engine |

