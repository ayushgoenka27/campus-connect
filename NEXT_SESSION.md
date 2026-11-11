# Campus Connect — Next Session

**Last Updated:** 2026-11-11  
**Current Phase:** Phase 1 — Authentication, Profiles & Navigation  
**Overall Progress:** Phase 0 Complete (10/10 tasks). Total 15/98 tasks complete.

---

## 1. Current Project Phase

**Phase 1 — Authentication, Profiles & Navigation (Ready to Begin)**

Phase 0 (Foundation Stabilization & Repair) is 100% complete and verified. All 7 critical bugs identified during the initial audit are resolved. The frontend build compiles cleanly and the backend runs with verified imports and security checks.

---

## 2. Overall Progress

| Phase | Status | Completion |
|-------|--------|-----------|
| Audit | ✔️ Complete | 100% |
| Phase 0 — Stabilise & Repair | ✔️ Complete | 100% (10/10 tasks) |
| Phase 1 — Auth, Profiles, Navigation | 🔄 In Progress | 35% (5/14 tasks) |
| Phase 2 — Connections Management | ⬜ Not Started | 0% |
| Phase 3 — Community | ⬜ Not Started | 0% |
| Phase 4 — Announcements & Admin | ⬜ Not Started | 0% |
| Phase 5 — Real-Time Messaging | ⬜ Not Started | 0% |
| Phase 6 — Notifications & Resources | ⬜ Not Started | 0% |
| Phase 7 — Testing & Deployment | ⬜ Not Started | 0% |

**Overall:** ~18% of full scope complete (Foundation stabilized, Auth/Session layer operational, dynamic Dashboard online).

---

## 3. Completed Work in Phase 0

1. **Fixed Login Field Mismatch:** Updated `frontend/src/pages/Login.jsx` to collect and transmit `email` instead of `username`, and integrated with `AuthContext.login`.
2. **Added Reactive Auth State Management:** Implemented `frontend/src/context/AuthContext.jsx` with persistent token handling, automatic user profile synchronization, and clean logout.
3. **Protected Routes & Route Guarding:** Implemented `frontend/src/components/ProtectedRoute.jsx` and reconfigured `frontend/src/App.jsx` to block unauthenticated visitors from workspace routes.
4. **Shared Application Layout:** Created `frontend/src/layout/AppLayout.jsx` with responsive sidebar, active navigation pills, user account chip, and signout trigger.
5. **Dynamic Dashboard:** Replaced the hardcoded mockup with `frontend/src/pages/Dashboard.jsx` fetching live user profile, connections, and suggested students with active connection handlers.
6. **Graceful Placeholders:** Implemented `frontend/src/pages/ComingSoon.jsx` across all workspace routes to eliminate dead links or unhandled routes.
7. **Cleaned Backend Config & Entrypoint:** Standardized `backend/main.py` to re-export `app.main:app`, removed duplicate `DATABASE_URL` in `.env`, created `backend/.env.example`, and disabled `echo=True` in `database.py`.
8. **Fixed Connection Status Filter:** Updated `backend/app/api/connections.py` so `GET /sent` returns only pending requests.
9. **Eliminated Scaffold Bloat:** Removed redundant `.tsx` files and `vite.config.ts`. Verified production build passes with zero errors.

---

## 4. Outstanding Bugs & Blockers

- **Outstanding Bugs:** Zero critical bugs remaining from Phase 0.
- **Blockers:** None. Awaiting user approval to proceed with Phase 1 backend tasks (health check, password validation, connection unique constraints, profile page).

---

## 5. Next Exact Tasks (Phase 1)

1. **P1-01: Health check endpoint:** Add `GET /health` in `backend/app/main.py`.
2. **P1-02: Password validation:** Add minimum 8-character constraint in `backend/app/schemas/auth.py`.
3. **P1-03: Connection DB unique constraint:** Add Alembic migration for unique constraint on `(sender_id, receiver_id)` in `connections`.
4. **P1-04: Optimize connection queries:** Replace per-row N+1 user queries in `connections.py` with SQLAlchemy JOINs.
5. **P1-05: Admin role dependency:** Add `get_current_admin` helper in `backend/app/core/dependencies.py`.
6. **P1-06: Public profile endpoint:** Add `GET /users/{user_id}` in `backend/app/api/users.py`.
7. **P1-07: Pagination for users:** Add `skip` and `limit` query parameters to `GET /users`.
8. **P1-11: Profile Page UI:** Build `frontend/src/pages/Profile.jsx` with profile view, bio editing, course, branch, and academic year updates.

---

## 6. Commands Required to Resume Development

### Start backend server:
```powershell
cd "c:\Users\Lenovo\Desktop\Campus Connect\backend"
venv\Scripts\uvicorn.exe app.main:app --reload
```

### Start frontend dev server:
```powershell
cd "c:\Users\Lenovo\Desktop\Campus Connect\frontend"
npm run dev
```

### Run frontend production build:
```powershell
cd "c:\Users\Lenovo\Desktop\Campus Connect\frontend"
npm run build
```

---

## 6. Outstanding Bugs (Critical)

| ID | Issue | Location |
|----|-------|----------|
| BUG-01 | Login sends `username` instead of `email` | `frontend/src/pages/Login.jsx` L22 |
| BUG-02 | Dashboard accessible without authentication | `frontend/src/App.jsx` L466 |
| BUG-03 | Hardcoded fake user data in dashboard | `frontend/src/App.jsx` throughout |
| BUG-04 | Connect buttons do nothing | `frontend/src/App.jsx` L447 |
| BUG-05 | No logout button | `frontend/src/App.jsx` |
| BUG-06 | `GET /sent` returns all statuses not just pending | `backend/app/api/connections.py` L253–L292 |

---

## 7. Blockers

**None** — awaiting user approval to proceed with Phase 0 implementation.

---

## 8. Next Exact Tasks (Phase 0 — after user approval)

Execute these tasks in order:

### Task 1: Fix login field mismatch
**File:** `frontend/src/pages/Login.jsx`
- Change `username` state to `email`
- Change input label from "Username" to "Email"
- Change input type from `text` to `email`
- Update POST body to `{ email, password }`

### Task 2: Create Auth Context
**File:** `frontend/src/context/AuthContext.jsx` (new)
- Create context with user state
- Provide login(), logout(), and user getters
- Read user from `/api/v1/users/me` on mount if token exists

### Task 3: Create Protected Route
**File:** `frontend/src/components/ProtectedRoute.jsx` (new)
- Redirect to `/login` if no token

### Task 4: Restructure App.jsx routing
**File:** `frontend/src/App.jsx`
- Wrap protected routes with `<ProtectedRoute>`
- Add logout to sidebar
- Remove hardcoded data

### Task 5: Fix backend issues
**Files:** `backend/app/api/connections.py`, `backend/app/db/database.py`
- Filter `GET /sent` to pending only
- Set `echo=False`
- Remove duplicate `backend/main.py`
- Fix duplicate DATABASE_URL in `.env`

### Task 6: Create `.env.example`
**File:** `backend/.env.example` (new)
- Placeholder values for all environment variables

### Task 7: Clean up frontend config files
**Files:** `frontend/vite.config.ts`, `frontend/main.tsx`, `frontend/App.tsx`
- Delete the unused TypeScript variants

---

## 9. Commands Required to Resume Development

### Start the backend
```bash
# From: c:\Users\Lenovo\Desktop\Campus Connect\backend
venv\Scripts\uvicorn.exe app.main:app --reload
```
Backend available at: http://127.0.0.1:8000  
API docs at: http://127.0.0.1:8000/docs

### Start the frontend
```bash
# From: c:\Users\Lenovo\Desktop\Campus Connect\frontend
npm run dev
```
Frontend available at: http://localhost:5173

### Run database migrations
```bash
# From: c:\Users\Lenovo\Desktop\Campus Connect\backend
venv\Scripts\alembic.exe upgrade head
```

### Run backend tests (after Phase 7)
```bash
# From: c:\Users\Lenovo\Desktop\Campus Connect\backend
venv\Scripts\pytest.exe tests/ -v
```

### Check migration history
```bash
# From: c:\Users\Lenovo\Desktop\Campus Connect\backend
venv\Scripts\alembic.exe history --verbose
```

---

## 10. Decisions Awaiting User Approval

1. **Proceed with Phase 0?** — Fix all critical bugs as the first step. No new features until these are resolved.
2. **Profile image uploads:** Start with URL-based approach, then add file upload in Phase 1 (or skip file upload and use URL only)?
3. **Confirm scope of messaging:** The proposal requires real-time WebSocket messaging. This is confirmed in this plan. Proceed?
4. **Confirm technology additions:**
   - WebSockets: via FastAPI built-in (no new package) ✅
   - Testing: pytest + httpx + Vitest (new dev dependencies) — approved?
   - Docker: for deployment only (not required for local dev) — approved?

---

## Audit Summary (For Quick Reference)

The Campus Connect project has a solid foundation:
- ✅ Authentication backend works correctly
- ✅ User profile backend works correctly  
- ✅ Connections backend is feature-complete
- ✅ Beautiful UI design quality (excellent)
- ✅ Modern, appropriate technology stack

Critical issues to fix immediately:
- 🔴 Login is broken (field name mismatch)
- 🔴 Dashboard has no auth guard
- 🔴 All dashboard data is hardcoded/fake

Missing (the bulk of the work):
- 5 major modules: Community, Announcements, Messaging, Notifications, Resources
- 10+ frontend pages
- Complete test suite
- Docker deployment
- README and documentation

