# Campus Connect — Final Demo Guide (P7-16)

**Version:** 1.0  
**Last Updated:** 2026-11-15  
**Audience:** Evaluators, instructors, and stakeholders

---

## Quick Start (Development — No Docker Required)

If Docker is not available, the application runs fully in development mode using local Python and Node.js environments.

### Terminal 1 — Backend

```powershell
cd "Campus Connect\backend"
.\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Terminal 2 — Frontend

```powershell
cd "Campus Connect\frontend"
npm run dev
# Opens at http://localhost:5173
```

### Demo URL
Open **http://localhost:5173** in your browser.

---

## Quick Start (Docker — Production Mode)

*(Requires Docker Desktop or Docker Engine installed on the host machine)*

```powershell
cd "Campus Connect"
cp .env.docker .env.prod
# Edit .env.prod: set POSTGRES_PASSWORD and JWT_SECRET_KEY
docker compose --env-file .env.prod up -d --build
# Open http://localhost
```

---

## Demo Accounts

The following baseline accounts exist in the development database:

| Role | Email | Password | Notes |
|------|-------|----------|-------|
| Admin | *(check dev DB)* | *(set during setup)* | Has admin console access |
| Student | *(registered during testing)* | *(as registered)* | Standard student account |

### Create a fresh demo account

1. Open the app → click **"Create your account"**
2. Fill in: Full Name, Username, Email, Password (8+ chars), Course, Branch, Year
3. Click **Register** → redirected to Login
4. Sign in with the new credentials

### Promote to admin (for admin demo)

```bash
# Docker deployment
docker compose exec db psql -U cc_user -d campus_connect \
    -c "UPDATE users SET role='admin' WHERE email='your@email.com';"

# Development (local PostgreSQL)
psql -U postgres -d campus_connect \
    -c "UPDATE users SET role='admin' WHERE email='your@email.com';"
```

---

## Demo Script — Full Feature Walkthrough

### Scene 1: Registration & Authentication (~2 min)

**Show:** Secure registration and login with JWT authentication.

1. Navigate to **http://localhost:5173** → redirected to `/login`
2. Click **"Create your account"**
3. Register **Student A**: `alice@campus.edu`, password `SecurePass1`
4. Register **Student B** (new tab/incognito): `bob@campus.edu`, password `SecurePass2`
5. Log in as Alice → Dashboard shows real stats
6. **Point out:** Browser DevTools → Application → Local Storage → `campus_connect_token` (JWT)

**Demonstrates:** FR-AUTH-1, FR-AUTH-2, FR-AUTH-3, FR-AUTH-4

---

### Scene 2: Profile Management (~1 min)

**Show:** Viewing and editing a student profile.

1. Click **Profile** in the sidebar
2. Click **Edit Profile**
3. Update Bio: *"Computer Science, 3rd year. Interested in distributed systems."*
4. Update Course, Branch, Year
5. Click Save → changes reflected immediately

**Demonstrates:** FR-PRF-1, FR-PRF-2

---

### Scene 3: Student Discovery & Connections (~2 min)

**Show:** Finding students and forming connections.

1. Click **Discover** → shows all registered students (excluding self)
2. Use the Search bar to filter by name
3. Use the Branch/Year dropdowns to narrow results
4. Click **Connect** on Bob's card → button changes to "Pending"
5. Switch to Bob's session → click **Connections** → **Requests** tab
6. Click **Accept** → Alice's card moves to Connected tab
7. Switch back to Alice → Connections → shows Bob as connected

**Demonstrates:** FR-CON-1, FR-CON-2, FR-CON-3, FR-CON-4

---

### Scene 4: Real-Time Messaging (~2 min)

**Show:** Live two-way messaging with read receipts.

1. As Alice, click **Messages** → click **New Conversation** → select Bob
2. Type: *"Hey Bob, want to study together?"* → Send
3. Switch to Bob's session → Messages → new conversation appears with unread badge
4. Bob opens conversation → message shows as **Read** (double-check icon) in Alice's session
5. Bob replies: *"Sure! Library at 3pm?"*
6. Alice sees the reply arrive **in real time** without page refresh
7. **Point out:** Sidebar badge shows unread count; clears when conversation opened

**Demonstrates:** FR-MSG-1, FR-MSG-2, FR-MSG-3, FR-MSG-4, FR-MSG-5

---

### Scene 5: Community Posts (~2 min)

**Show:** Social feed with posts, likes, and comments.

1. Click **Community** → scrollable post feed
2. Click **Create Post** → write: *"Study group for Database Systems — DM me!"*
3. Optionally add an image URL
4. Post appears at top of feed
5. Switch to Bob → Like Alice's post → like count increments
6. Bob adds a comment → appears immediately
7. Alice can Edit or Delete her own post; Bob's edit/delete buttons are hidden on Alice's posts
8. Use the Search bar to filter posts by keyword

**Demonstrates:** FR-COM-1 through FR-COM-5

---

### Scene 6: Notifications (~1 min)

**Show:** Real-time notification delivery.

1. As Bob, send Alice a connection request (or perform an action that triggers a notification)
2. As Alice, observe the **bell icon** in the top bar — badge count increments **in real time**
3. Click the bell → notification dropdown shows the event
4. Click **Mark all read** → badge clears

**Demonstrates:** FR-NOT-1, FR-NOT-2, FR-NOT-3

---

### Scene 7: Announcements (~1 min)

**Show:** Campus-wide announcement board.

1. Click **Announcements** → see seeded announcements
2. Use category tabs to filter (Academic, Events, Administrative, etc.)
3. *(As admin)* Click **New Announcement** → fill form → Publish
4. All logged-in users receive a real-time notification of the new announcement

**Demonstrates:** FR-ANN-1, FR-ANN-2

---

### Scene 8: Campus Resources & Events (~2 min)

**Show:** Academic resource library and event RSVP.

1. Click **Resources** → category filter pills (Syllabus, Question Papers, Lab Manuals, etc.)
2. Use the search bar → results filter in real time
3. Click an external link button → opens in new tab
4. Click **Events** → Upcoming / Past tabs
5. Click **RSVP** on an event → attendee count increments
6. RSVP again → cancels (toggle behaviour)
7. *(As admin)* Create a new event with capacity limit

**Demonstrates:** FR-RES-1, FR-RES-2, FR-EVT-1, FR-EVT-2

---

### Scene 9: Account Settings & Session Security (~2 min)

**Show:** Password change with server-side session revocation.

1. Click **Settings**
2. Enter current password, new password (8+ chars), confirm
3. Click **Change Password**
4. *(Optional demo:)* Open a second browser tab signed in as Alice
5. After password change, the second tab's WebSocket disconnects (code 1008)
6. The second tab's API calls return 401 — forced to log in again

**Demonstrates:** FR-SET-1, FR-AUTH-5

---

### Scene 10: Admin Console (~2 min)

**Show:** Administrative oversight and moderation.

*(Login as an admin account)*

1. Click **Admin Console** in the sidebar
2. **Active Users tab** — see all registered users, their roles, activity status
3. Click **Deactivate** on a test user → they cannot log in (403 returned)
4. **Moderation Queue tab** — see reported content, take action (approve/dismiss)
5. Admin dashboard shows platform statistics (user count, post count, etc.)

**Demonstrates:** FR-ADM-1, FR-ADM-2, FR-ADM-3

---

### Scene 11: Security Hardening Demo (~1 min)

**Show:** Production security features.

1. Open DevTools → Network tab → inspect any API response
2. **Point out response headers:**
   - `X-Frame-Options: DENY`
   - `X-Content-Type-Options: nosniff`
   - `Content-Security-Policy: default-src 'self'; ...`
   - `Referrer-Policy: strict-origin-when-cross-origin`
3. Try accessing `/api/v1/users` without a token → `401 Unauthorized`
4. Try accessing `/api/v1/admin/stats` as a student → `403 Forbidden`
5. Rate limiting: rapid-fire 16 login attempts → `429 Too Many Requests`

**Demonstrates:** FR-SEC-1, FR-SEC-2, FR-SEC-3, FR-AUTH-4

---

## Key Technical Talking Points

### Architecture Decisions Worth Highlighting

| Decision | Rationale |
|----------|-----------|
| FastAPI + Uvicorn | Async-ready, automatic OpenAPI docs, Pydantic validation |
| Argon2id password hashing | Memory-hard; resistant to GPU/ASIC brute-force |
| `token_version` for session revocation | Stateless JWT invalidation without a token blacklist |
| Sliding-window rate limiter | Zero external dependencies; anti-spoofing via trusted proxy check |
| React.lazy + Suspense | 48% bundle size reduction; better Time-to-Interactive |
| Nginx WebSocket proxy | Single entry point; correct `Upgrade`/`Connection` headers |
| PostgreSQL partial unique index | Prevents both A→B and B→A duplicate connections at DB level |
| `pool_pre_ping=True` | Avoids stale connections after PostgreSQL idle timeout |

### Concurrency & Reliability (Demonstrated in P7-01 Tests)

- **Race condition safety:** Two simultaneous connection requests → only one succeeds; DB constraint enforces uniqueness
- **Multi-session WebSocket:** 3 concurrent sessions all receive messages correctly
- **JWT revocation:** Old tokens rejected on both REST and WebSocket after logout
- **Restart resilience:** Posts and data persisted in PostgreSQL survive server restarts

---

## Test Suite Summary

| Suite | Count | Result |
|-------|-------|--------|
| Backend pytest (SQLite in-memory) | 90 | ✅ 90/90 passed in ~15s |
| Frontend Vitest + React Testing Library | 28 | ✅ 28/28 passed in ~6s |
| ESLint | — | ✅ 0 errors, 0 warnings |
| Production Vite build | — | ✅ 251.86 kB main bundle |
| Concurrency & failure tests (Playwright) | 7 suites | ✅ 7/7 passed |
| E2E integration journeys (Chrome + Edge) | 13 journeys | ✅ 13/13 on both browsers |
| Responsive layout (Chrome) | 3 viewports | ✅ Desktop/Tablet/Mobile |

---

## Git History

```
50c2b10  feat: Phase 7 integration testing and multi-browser verification (P7-01, P7-02)
eeda3c7  feat: Phase 7 performance optimization and route code splitting (P7-07 to P7-09)
dfdbbbf  feat: Phase 7 security audit and hardening (P7-03 to P7-06, P7-14)
0029355  docs: record Phase 6 checkpoint hash
5c7ca59  feat: complete Phase 6 notifications and campus resources
14c6896  docs: record Phase 5 checkpoint hash across project tracking documents
3e3ba53  feat: complete Phase 5 real-time messaging
456c238  feat: complete Phase 4 announcements and admin governance module
f61acd3  Phase 3 SRS remediation
```

