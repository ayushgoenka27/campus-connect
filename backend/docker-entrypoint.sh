#!/bin/bash
# =============================================================================
# Campus Connect Backend — Docker Entrypoint (P7-10)
# =============================================================================
# 1. Waits for PostgreSQL to be ready (up to 60 seconds).
# 2. Runs Alembic migrations to bring the schema to head.
# 3. Starts Uvicorn with production settings.
# =============================================================================
set -e

echo "[entrypoint] Campus Connect Backend starting..."

# ── Wait for PostgreSQL ───────────────────────────────────────────────────────
# Parse host and port from DATABASE_URL
# Format: postgresql+psycopg://USER:PASSWORD@HOST:PORT/DATABASE
DB_HOST=$(echo "$DATABASE_URL" | sed -E 's|.*@([^:/]+).*|\1|')
DB_PORT=$(echo "$DATABASE_URL" | sed -E 's|.*:([0-9]+)/.*|\1|')
DB_PORT="${DB_PORT:-5432}"

echo "[entrypoint] Waiting for PostgreSQL at ${DB_HOST}:${DB_PORT}..."
MAX_WAIT=60
WAITED=0
until python -c "
import os, sys
from sqlalchemy import create_engine, text
try:
    url = os.environ.get('DATABASE_URL')
    engine = create_engine(url)
    with engine.connect() as conn:
        conn.execute(text('SELECT 1'))
    sys.exit(0)
except Exception:
    sys.exit(1)
" 2>/dev/null; do
    if [ $WAITED -ge $MAX_WAIT ]; then
        echo "[entrypoint] ERROR: PostgreSQL not ready after ${MAX_WAIT}s. Aborting."
        exit 1
    fi
    echo "[entrypoint] PostgreSQL not ready yet — waiting 2s... (${WAITED}s elapsed)"
    sleep 2
    WAITED=$((WAITED + 2))
done

echo "[entrypoint] PostgreSQL is ready."

# ── Run Alembic Migrations ────────────────────────────────────────────────────
echo "[entrypoint] Running Alembic migrations..."
alembic upgrade head
echo "[entrypoint] Migrations complete."

# ── Start Uvicorn ─────────────────────────────────────────────────────────────
WORKERS="${UVICORN_WORKERS:-2}"
echo "[entrypoint] Starting Uvicorn with ${WORKERS} worker(s)..."

exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --workers "$WORKERS" \
    --proxy-headers \
    --forwarded-allow-ips="*" \
    --log-level info \
    --access-log

