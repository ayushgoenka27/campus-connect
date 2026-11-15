# Campus Connect — Deployment Guide (P7-15)

**Version:** 1.0  
**Last Updated:** 2026-11-15  
**Author:** Campus Connect Engineering

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Prerequisites](#2-prerequisites)
3. [Local Docker Compose Deployment](#3-local-docker-compose-deployment)
4. [Environment Configuration Reference](#4-environment-configuration-reference)
5. [Database Migration Procedures](#5-database-migration-procedures)
6. [Free Public Deployment Options](#6-free-public-deployment-options)
7. [Operational Runbooks](#7-operational-runbooks)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Architecture Overview

```
Browser (port 80)
      │
      ▼
┌─────────────┐
│   Nginx     │  ← campus_connect_frontend container
│  (port 80)  │  ← Serves React SPA + reverse proxy
└──────┬──────┘
       │ /api/*  →  backend:8000  (HTTP)
       │ /ws     →  backend:8000  (WebSocket upgrade)
       │ /health →  backend:8000  (health probes)
       ▼
┌─────────────┐
│   FastAPI   │  ← campus_connect_backend container
│  (port 8000)│  ← Non-root user, Uvicorn ASGI
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ PostgreSQL  │  ← campus_connect_postgres container
│  (port 5432)│  ← Persistent volume: campus_connect_pgdata
└─────────────┘
```

**Key design decisions:**
- Backend and database ports are **not exposed** to the host — all traffic flows through Nginx.
- WebSocket connections are proxied by Nginx with the required `Upgrade` and `Connection` headers.
- PostgreSQL data is stored in a named Docker volume and survives container restarts and rebuilds.
- Secrets are injected via environment variables — never hardcoded.
- The backend runs as non-root user (`appuser`, uid 1001).

> [!IMPORTANT]
> WebSocket connection state (presence, online users) is held **in-process memory**. The default configuration uses `UVICORN_WORKERS=1`. If you increase workers, all WebSocket connections must land on the same process — use sticky-session load balancing.

---

## 2. Prerequisites

### For Local Deployment
- **Docker Desktop** ≥ 24.0 or **Docker Engine** + **Docker Compose Plugin** ≥ 2.20
- 2 GB RAM minimum (4 GB recommended)
- Ports 80 available on the host (or change `HOST_PORT`)

> [!NOTE]
> The Dockerfiles, Nginx reverse proxy configuration, Docker Compose specification, and shell scripts are structurally and syntactically verified. If deploying on a workstation without Docker Engine pre-installed, install Docker Desktop (free for personal use) as described below before running `docker compose up`. Alternatively, the application can run in local development mode without Docker (see `FINAL_DEMO_GUIDE.md`).

### Installing Docker (Windows)
1. Download [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/) — free for personal use.
2. Enable WSL2 integration during installation.
3. Restart and verify: `docker --version`

### Installing Docker (Linux)
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out and back in, then:
docker compose version
```

---

## 3. Local Docker Compose Deployment

### Step 1 — Clone or navigate to the project

```bash
cd "Campus Connect"
```

### Step 2 — Create your production environment file

```bash
# Copy the template
cp .env.docker .env.prod

# Edit with real values (see Section 4)
nano .env.prod     # or use any text editor
```

**Minimum required changes in `.env.prod`:**
```env
POSTGRES_PASSWORD=<strong_random_password>
JWT_SECRET_KEY=<64_char_hex_string>
```

Generate secure values:
```bash
# PostgreSQL password
python -c "import secrets; print(secrets.token_urlsafe(32))"

# JWT secret
python -c "import secrets; print(secrets.token_hex(32))"
```

### Step 3 — Build and start

```bash
docker compose --env-file .env.prod up -d --build
```

This will:
1. Pull `postgres:16-alpine`, `python:3.11-slim`, `node:20-slim`, `nginx:1.27-alpine`
2. Build the backend multi-stage image (installs Python deps, copies app)
3. Build the frontend multi-stage image (runs `npm ci` + `vite build`, copies to Nginx)
4. Start PostgreSQL, wait for it to be healthy
5. Start backend, run Alembic migrations, start Uvicorn
6. Start Nginx frontend

### Step 4 — Verify startup

```bash
# Watch service health
docker compose ps

# Follow logs
docker compose logs -f

# Test backend health
curl http://localhost/health
curl http://localhost/health/db

# Open in browser
start http://localhost    # Windows
open http://localhost     # macOS
xdg-open http://localhost # Linux
```

### Step 5 — Seed initial data (optional)

```bash
# Seed campus resources and events
docker compose exec backend python scripts/seed_phase6.py
```

### Stopping

```bash
# Stop containers (data preserved)
docker compose --env-file .env.prod down

# Stop AND remove volumes (DESTROYS DATA — use only for a clean reset)
docker compose --env-file .env.prod down -v
```

### Rebuilding after code changes

```bash
# Rebuild specific service
docker compose --env-file .env.prod up -d --build backend
docker compose --env-file .env.prod up -d --build frontend

# Rebuild all
docker compose --env-file .env.prod up -d --build
```

---

## 4. Environment Configuration Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `POSTGRES_DB` | No | `campus_connect` | PostgreSQL database name |
| `POSTGRES_USER` | No | `cc_user` | PostgreSQL username |
| `POSTGRES_PASSWORD` | **Yes** | — | PostgreSQL password (strong random string) |
| `JWT_SECRET_KEY` | **Yes** | — | JWT signing secret (64+ char hex) |
| `JWT_ALGORITHM` | No | `HS256` | JWT algorithm |
| `ENVIRONMENT` | No | `production` | `development` or `production` (controls docs/error verbosity) |
| `CORS_ORIGINS` | No | `http://localhost` | Comma-separated allowed origins |
| `TRUSTED_PROXIES` | No | `172.16.0.0/12,10.0.0.0/8` | Docker subnet for X-Forwarded-For extraction |
| `RATE_LIMIT_ENABLED` | No | `true` | Enable sliding-window rate limiter |
| `RATE_LIMIT_AUTH_PER_MINUTE` | No | `15` | Max auth requests per IP per minute |
| `RATE_LIMIT_DEFAULT_PER_MINUTE` | No | `60` | Max general requests per IP per minute |
| `ALLOWED_EMAIL_DOMAINS` | No | `""` (all) | Restrict registration to email domains |
| `UVICORN_WORKERS` | No | `1` | Uvicorn worker count (keep at 1 for WebSocket) |
| `HOST_PORT` | No | `80` | Host port mapped to Nginx |

---

## 5. Database Migration Procedures

### Running migrations (automatic)
Alembic migrations run automatically in the backend entrypoint (`docker-entrypoint.sh`) on every container start. The command is:
```bash
alembic upgrade head
```
This is **idempotent** — already-applied revisions are skipped.

### Checking current migration status
```bash
docker compose exec backend alembic current
docker compose exec backend alembic history --verbose
```

### Manual migration (if needed)
```bash
# Apply all pending
docker compose exec backend alembic upgrade head

# Downgrade one step
docker compose exec backend alembic downgrade -1

# Show SQL for a migration (without applying)
docker compose exec backend alembic upgrade head --sql
```

> [!CAUTION]
> Never modify an already-applied Alembic migration. Create a new revision instead. Downgrading in production requires a backup first.

### Creating new migrations (development)
```bash
# In development (not Docker), from backend/
alembic revision --autogenerate -m "describe the change"
# Review the generated file in backend/migrations/versions/ before applying
alembic upgrade head
```

---

## 6. Free Public Deployment Options

> [!NOTE]
> Docker is **not required** for public deployment. All options below support free-tier hosting. No paid services are required.

### Option A: Railway (Recommended — Easiest)

**Free tier:** 500 hours/month compute, 1 GB PostgreSQL included.

1. Push your code to GitHub.
2. Create a [Railway](https://railway.app) account (free, no credit card required for free tier).
3. Click **New Project → Deploy from GitHub repo**.
4. Add a **PostgreSQL** service (free, managed).
5. Set environment variables in Railway dashboard (see Section 4).
6. Railway auto-detects Dockerfile and deploys.
7. Set `CORS_ORIGINS` to your Railway-generated URL.

**Limitation:** Free tier sleeps after 15 minutes of inactivity.

### Option B: Render

**Free tier:** Web service + PostgreSQL (90 days free), then \$0/month on free plan with limits.

1. Create a [Render](https://render.com) account.
2. Connect your GitHub repo.
3. Create a **Web Service** → select `backend/Dockerfile`.
4. Create a **PostgreSQL** database (free).
5. Create a **Static Site** for the frontend:
   - Build command: `npm ci && npm run build`
   - Publish directory: `dist`
6. Set `VITE_API_URL` to your Render backend URL during frontend build.

**Limitation:** Free services spin down after 15 minutes; first request after sleep takes ~30s.

### Option C: Fly.io

**Free tier:** 3 shared VMs, 3 GB storage, PostgreSQL cluster.

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Deploy backend
fly launch --dockerfile backend/Dockerfile

# Deploy frontend
fly launch --dockerfile frontend/Dockerfile

# Create managed Postgres
fly postgres create
fly postgres attach <app-name>
```

**Limitation:** Requires credit card for verification, but free tier is genuine.

### Option D: Local Network / LAN Sharing (Zero Cloud Cost)

Run Docker Compose on any machine and share via local network:

```bash
# Change HOST_PORT if needed
HOST_PORT=8080 docker compose --env-file .env.prod up -d --build
```

Access from other devices on the same network via `http://<your-machine-ip>:8080`.

For external access, use [ngrok](https://ngrok.com) (free tier — 1 tunnel):
```bash
ngrok http 80
# Share the generated URL
```

---

## 7. Operational Runbooks

### Runbook: Check service health

```bash
# Service status
docker compose ps

# Backend health (liveness)
curl http://localhost/health

# Backend DB health (readiness)
curl http://localhost/health/db

# Backend logs
docker compose logs backend --tail=100

# Nginx logs
docker compose logs frontend --tail=100

# PostgreSQL logs
docker compose logs db --tail=50
```

### Runbook: Restart a service

```bash
docker compose restart backend
docker compose restart frontend
docker compose restart db    # ⚠️ causes brief downtime
```

### Runbook: Create a database backup

```bash
# Automatic timestamped backup
bash scripts/backup.sh

# Named backup
bash scripts/backup.sh pre-migration.dump

# Output: ./backups/YYYY-MM-DD_HHMMSS_campus_connect.dump
```

### Runbook: Restore from backup

```bash
# Restore to a test database (safe, non-destructive)
RESTORE_DB=campus_connect_restore bash scripts/restore.sh ./backups/2026-11-15_123456_campus_connect.dump

# Restore to production (prompts for confirmation)
bash scripts/restore.sh ./backups/2026-11-15_123456_campus_connect.dump
```

See [BACKUP_RESTORE.md](BACKUP_RESTORE.md) for the full backup and restore guide.

### Runbook: View all registered users (admin check)

```bash
docker compose exec db psql -U cc_user -d campus_connect \
    -c "SELECT id, email, full_name, role, is_active FROM users ORDER BY id;"
```

### Runbook: Promote a user to admin

```bash
docker compose exec db psql -U cc_user -d campus_connect \
    -c "UPDATE users SET role='admin' WHERE email='user@example.com' RETURNING id, email, role;"
```

### Runbook: Upgrade to a new version

```bash
# 1. Backup first
bash scripts/backup.sh pre-upgrade.dump

# 2. Pull new code
git pull origin main

# 3. Rebuild and restart
docker compose --env-file .env.prod up -d --build

# 4. Migrations run automatically in entrypoint
# 5. Verify
curl http://localhost/health/db
```

---

## 8. Troubleshooting

### Backend fails to start: "Database connection refused"
**Cause:** Backend started before PostgreSQL was healthy.  
**Fix:** Docker Compose `depends_on: condition: service_healthy` handles this. If it still fails, increase `start_period` in the backend healthcheck.

```bash
docker compose logs db --tail=30
docker compose restart backend
```

### WebSocket disconnects immediately
**Cause:** `CORS_ORIGINS` not set to match the frontend URL.  
**Fix:** Ensure `CORS_ORIGINS` includes the exact origin (e.g., `http://localhost` not `http://localhost:80`).

### Nginx returns 502 Bad Gateway
**Cause:** Backend container not healthy yet.  
**Fix:** Wait for `cc_backend` to show `healthy` in `docker compose ps`.

### "JWT_SECRET_KEY must be set" error at startup
**Cause:** `.env.prod` not passed to `docker compose`.  
**Fix:** Always use `docker compose --env-file .env.prod up`.

### Port 80 already in use
**Fix:** Change `HOST_PORT` in `.env.prod`:
```env
HOST_PORT=8080
```

### Data lost after `docker compose down`
**Cause:** `docker compose down -v` removes volumes.  
**Fix:** Always use `docker compose down` (without `-v`) to preserve data.

