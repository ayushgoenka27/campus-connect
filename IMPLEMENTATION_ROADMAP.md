# Campus Connect — Implementation Roadmap

**Version:** 1.0  
**Created:** 2026-11-11  
**Author:** Principal Architect

---

## Phasing Strategy

The implementation is divided into 7 sequential phases. Each phase builds on the previous one and must be stable before the next begins. Phases contain one or more modules that can be worked on in sub-streams.

---

## PHASE 0 — Stabilise & Repair Foundation
**Goal:** Fix all critical bugs in the existing code before adding any new features.  
**Estimated Complexity:** Low  
**Dependency:** None  
**Priority:** 🔴 Immediate

| Task | File(s) | Acceptance Criteria |
|------|---------|-------------------|
| Fix login field mismatch | `Login.jsx` | Login works with email + password |
| Add frontend auth guard | `App.jsx` | Unauthenticated users redirected to `/login` |
| Remove hardcoded user data | `App.jsx` | Dashboard reads user from `/api/v1/users/me` |
| Remove hardcoded people | `App.jsx` | People section fetches from `/api/v1/users` |
| Add logout functionality | `App.jsx` | Clears token, redirects to login |
| Remove duplicate `main.py` | `backend/main.py` | Single clear entry point |
| Fix duplicate DATABASE_URL in .env | `.env` | Single clean DATABASE_URL |
| Fix `GET /sent` to filter pending only | `connections.py` | Only returns pending sent requests |
| Add `echo=False` for production | `database.py` | SQL not logged in production mode |
| Create `.env.example` | `.env.example` | Placeholder values, safe to commit |
| Clean up duplicate JS/TS config files | `frontend/` | Only one vite.config, one main entry |

---

## PHASE 1 — Authentication, Profiles & Navigation
**Goal:** Complete Module A (Auth) and Module B (Profiles) with full frontend integration.  
**Estimated Complexity:** Medium  
**Dependency:** Phase 0 complete  
**Priority:** 🔴 High

### Backend
| Task | Files | Acceptance Criteria |
|------|-------|-------------------|
| Add health check endpoint | `app/main.py` | `GET /health` returns `{status: "ok"}` |
| Add password strength validation | `schemas/auth.py` | Min 8 chars enforced |
| Add unique constraint migration for connections | `migrations/` | DB-level uniqueness enforced |
| Optimize connections queries with JOIN | `connections.py` | No N+1 queries |
| Add role-based dependency | `core/dependencies.py` | `get_current_admin` raises 403 for non-admins |
| Add public profile view endpoint | `api/users.py` | `GET /users/{user_id}` returns public profile |
| Add pagination to `GET /users` | `api/users.py` | `skip`/`limit` query params, max 50 per page |

### Frontend  
| Task | Files | Acceptance Criteria |
|------|-------|-------------------|
| Create auth context / hook | `src/context/AuthContext.jsx` | User state available globally |
| Create protected route component | `src/components/ProtectedRoute.jsx` | Redirects unauthenticated users |
| Create profile page | `src/pages/Profile.jsx` | View + edit own profile |
| Integrate profile page into routing | `App.jsx` | `/profile` route works |
| Update sidebar with working navigation | `App.jsx` | Sidebar nav renders correct page |
| Connect dashboard stats to backend | `App.jsx` | Real connection count displayed |

---

## PHASE 2 — Connections Management
**Goal:** Complete Module C with full frontend interface.  
**Estimated Complexity:** Medium  
**Dependency:** Phase 1 complete  
**Priority:** 🔴 High

### Backend
| Task | Files | Acceptance Criteria |
|------|-------|-------------------|
| Add connection status to user listings | `api/users.py` | Returns `connection_status` per user |
| Verify all connection edge cases | `connections.py` | No duplicate accepted connections possible |

### Frontend
| Task | Files | Acceptance Criteria |
|------|-------|-------------------|
| Create Discover page | `src/pages/Discover.jsx` | Lists users, search, filter, connect button |
| Create Connections page | `src/pages/Connections.jsx` | Accepted connections + pending requests |
| Wire connect buttons to API | — | Connect/disconnect with optimistic UI |
| Add accept/reject request UI | — | Pending requests actionable |
| Add cancel sent request UI | — | Can cancel outgoing pending requests |
| Handle all connection states in UI | — | Pending/accepted/rejected states shown correctly |

---

## PHASE 3 — Community Module
**Goal:** Implement Module D — Community posts, likes, comments.  
**Estimated Complexity:** High  
**Dependency:** Phase 1 complete  
**Priority:** 🟡 Medium-High

### Backend (New)
| Task | Files | Acceptance Criteria |
|------|-------|-------------------|
| Create Post model | `models/post.py` | Fields: id, author_id, content, created_at, updated_at |
| Create Comment model | `models/comment.py` | Fields: id, post_id, author_id, content, timestamps |
| Create Like model | `models/like.py` | Fields: id, post_id, user_id (unique together) |
| Create Alembic migration | `migrations/` | Tables created cleanly |
| Create post schemas | `schemas/post.py` | Create/update/response schemas |
| Create post API | `api/posts.py` | CRUD + pagination + search |
| Create comment API | `api/comments.py` | CRUD on comments for a post |
| Create like API | `api/posts.py` | Like/unlike toggle, like count |
| Authorization checks | — | Only author can edit/delete own posts/comments |

### Frontend (New)
| Task | Files | Acceptance Criteria |
|------|-------|-------------------|
| Create Community page | `src/pages/Community.jsx` | Feed of posts with pagination |
| Create post composer | `src/components/PostComposer.jsx` | Write + submit new post |
| Create post card component | `src/components/PostCard.jsx` | Like, comment, author info |
| Create comment section | `src/components/Comments.jsx` | List + add comments |
| Implement edit/delete for own content | — | Edit/delete shown only for own posts |

---

## PHASE 4 — Announcements & Admin
**Goal:** Implement Module E — Announcements, and the admin dashboard.  
**Estimated Complexity:** Medium  
**Dependency:** Phase 1 complete (role-based auth required)  
**Priority:** 🟡 Medium

### Backend (New)
| Task | Files | Acceptance Criteria |
|------|-------|-------------------|
| Create Announcement model | `models/announcement.py` | id, title, content, category, is_published, author_id, timestamps |
| Create Alembic migration | `migrations/` | Announcement table created |
| Create announcement schemas | `schemas/announcement.py` | Create/update/response schemas |
| Create announcement API (admin) | `api/announcements.py` | Admin CRUD with role check |
| Create announcement API (student) | `api/announcements.py` | Public read + filter by category |
| Admin user management endpoint | `api/admin.py` | List users, change roles |

### Frontend (New)
| Task | Files | Acceptance Criteria |
|------|-------|-------------------|
| Create Announcements page | `src/pages/Announcements.jsx` | Students see published announcements |
| Create Admin Dashboard | `src/pages/AdminDashboard.jsx` | Admin-only, behind role guard |
| Create announcement editor | `src/components/AnnouncementEditor.jsx` | Admin CRUD for announcements |
| Add admin nav item | `App.jsx` | Admin-only nav visible only to admins |

---

## PHASE 5 — Real-Time Messaging
**Goal:** Implement Module F — WebSocket-based one-to-one messaging.  
**Estimated Complexity:** High (WebSocket, auth, persistence)  
**Dependency:** Phase 1 complete, Phase 2 strongly recommended  
**Priority:** 🟡 Medium-High  
**Technology addition:** WebSockets (via FastAPI built-in support — no additional package required)

### Backend (New)
| Task | Files | Acceptance Criteria |
|------|-------|-------------------|
| Create Conversation model | `models/conversation.py` | id, participants (ManyToMany via junction table) |
| Create Message model | `models/message.py` | id, conversation_id, sender_id, content, is_read, created_at |
| Create Alembic migration | `migrations/` | Tables created cleanly |
| Create conversation/message schemas | `schemas/message.py` | Create/response schemas |
| Create conversation API | `api/conversations.py` | Create, list conversations |
| Create message REST API | `api/conversations.py` | Message history with pagination |
| Create WebSocket endpoint | `api/websocket.py` | WS endpoint with JWT auth |
| WebSocket connection manager | `core/websocket.py` | Track active connections per user |
| Mark messages as read | `api/conversations.py` | Read status update endpoint |
| Unread message count | `api/conversations.py` | Per-conversation unread count |

### Frontend (New)
| Task | Files | Acceptance Criteria |
|------|-------|-------------------|
| Create Messages page | `src/pages/Messages.jsx` | Conversation list + active chat |
| Create conversation list | `src/components/ConversationList.jsx` | Shows participants, last message, unread count |
| Create chat view | `src/components/ChatView.jsx` | Message history, real-time updates |
| WebSocket connection hook | `src/hooks/useWebSocket.js` | Connects on mount, reconnects on failure |
| Real-time message receipt | — | New messages appear without refresh |
| Unread count in sidebar | `App.jsx` | Real number, not hardcoded "3" |

---

## PHASE 6 — Notifications & Campus Resources
**Goal:** Implement Module G (Notifications) and Module H (Campus Resources).  
**Estimated Complexity:** Medium  
**Dependency:** Phases 1–5 complete  
**Priority:** 🟢 Medium

### Notifications (Backend)
| Task | Files | Acceptance Criteria |
|------|-------|-------------------|
| Create Notification model | `models/notification.py` | id, user_id, type, content, is_read, reference_id, timestamps |
| Create Alembic migration | `migrations/` | Table created |
| Create notification API | `api/notifications.py` | List, mark-read, unread count |
| Trigger notifications from events | Multiple routes | Connection, message, announcement events create notifications |

### Campus Resources (Backend)
| Task | Files | Acceptance Criteria |
|------|-------|-------------------|
| Create Resource model | `models/resource.py` | id, title, description, category, url, created_by, timestamps |
| Create Event model | `models/event.py` | id, title, description, start_date, end_date, location, created_by |
| Create Alembic migration | `migrations/` | Tables created |
| Create resources API | `api/resources.py` | CRUD (admin write, all read) |
| Create events API | `api/events.py` | CRUD (admin write, all read) |
| Seed demo data | `scripts/seed_data.py` | Clearly labelled demo resources |

### Frontend (New)
| Task | Files | Acceptance Criteria |
|------|-------|-------------------|
| Create Notifications panel | `src/components/NotificationsPanel.jsx` | Bell → dropdown of notifications |
| Create Resources page | `src/pages/Resources.jsx` | Browse academic/campus resources |
| Create Events page | `src/pages/Events.jsx` | Upcoming events with dates |
| Create Settings page | `src/pages/Settings.jsx` | Account settings, password change |

---

## PHASE 7 — Testing, Documentation & Deployment
**Goal:** Complete all testing, documentation, and production readiness.  
**Estimated Complexity:** Medium-High  
**Dependency:** Phases 0–6 complete  
**Priority:** 🔴 Critical (required for project completion)

### Testing
| Task | Files | Acceptance Criteria |
|------|-------|-------------------|
| Install pytest + httpx + pytest-asyncio | `requirements.txt` | Installed |
| Auth tests | `tests/test_auth.py` | Register, login, invalid credentials |
| User tests | `tests/test_users.py` | Profile get, update, list |
| Connection tests | `tests/test_connections.py` | Full connection lifecycle |
| Community tests | `tests/test_posts.py` | Post CRUD, likes, comments |
| Announcement tests | `tests/test_announcements.py` | Admin CRUD, student read |
| Messaging tests | `tests/test_messages.py` | Conversation, message history |
| Authorization tests | `tests/test_auth.py` | RBAC, 403 responses |
| Frontend component tests | `tests/` | Key components with Vitest |

### Deployment
| Task | Files | Acceptance Criteria |
|------|-------|-------------------|
| Create Dockerfile (backend) | `backend/Dockerfile` | Builds and runs correctly |
| Create Dockerfile (frontend) | `frontend/Dockerfile` | Builds and serves correctly |
| Create docker-compose.yml | `docker-compose.yml` | Full stack runs with single command |
| Create production .env.example | `.env.example` | All variables documented |
| Backend logging configuration | `app/main.py` | Structured logging |
| Write comprehensive README | `README.md` | Setup, run, test, deploy instructions |
| API documentation | Auto from FastAPI + annotations | Docs at `/docs` are complete |
| System architecture diagram | `docs/architecture.md` | Mermaid diagram |
| Database ER diagram | `docs/er_diagram.md` | All tables and relationships |

---

## Progress Summary

| Phase | Description | Status | Completion |
|-------|-------------|--------|-----------|
| 0 | Stabilise & Repair | ⬜ Not Started | 0% |
| 1 | Auth, Profiles, Navigation | ⬜ Not Started | 0% |
| 2 | Connections Management | ⬜ Not Started | 0% |
| 3 | Community Module | ⬜ Not Started | 0% |
| 4 | Announcements & Admin | ⬜ Not Started | 0% |
| 5 | Real-Time Messaging | ⬜ Not Started | 0% |
| 6 | Notifications & Resources | ⬜ Not Started | 0% |
| 7 | Testing, Docs, Deployment | ⬜ Not Started | 0% |

**Overall Progress: ~12% of total scope complete (backend foundation only)**

---

## Technical Risk Register

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| WebSocket auth complexity | Medium | High | Use JWT query param on WS handshake |
| PostgreSQL connection issues in sandbox | High | Low | Architecture can be verified without live DB |
| N+1 query performance at scale | Low | Medium | Add JOINs in Phase 1 |
| Tailwind CSS 4 breaking changes vs v3 docs | Low | Low | Vite plugin handles config — no `tailwind.config.js` needed |
| Login field bug blocks testing | High (already found) | High | Fix in Phase 0, first task |

