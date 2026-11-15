# =============================================================================
# Campus Connect Backend — Multi-Stage Production Dockerfile (P7-10)
# =============================================================================
# Stage 1: builder  — install dependencies into a virtual environment
# Stage 2: runtime  — minimal image with non-root user, no build tools
# =============================================================================

# ── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /build

# Install system build dependencies (needed for psycopg binary wheels)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        gcc \
        libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Create isolated virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install production Python dependencies
# (playwright and pytest are dev-only — excluded in production)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && grep -v -E "^(playwright|pytest|httpx)" requirements.txt \
        | pip install --no-cache-dir -r /dev/stdin


# ── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

# Install runtime-only system libraries (psycopg binary needs libpq)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libpq5 \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user and group
RUN groupadd --gid 1001 appgroup \
    && useradd --uid 1001 --gid appgroup --no-create-home --shell /bin/bash appuser

WORKDIR /app

# Copy virtual environment from builder stage
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy application source (excluding venv, scratch, tests)
COPY app/ ./app/
COPY migrations/ ./migrations/
COPY scripts/ ./scripts/
COPY main.py ./main.py
COPY alembic.ini ./alembic.ini

# Copy entrypoint script
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Change ownership to non-root user
RUN chown -R appuser:appgroup /app

USER appuser

# Expose the ASGI port
EXPOSE 8000

# Health check — calls the liveness probe (P7-14)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Production entrypoint
ENTRYPOINT ["./docker-entrypoint.sh"]

