# =============================================================================
# Campus Connect Frontend — Multi-Stage Production Dockerfile (P7-11)
# =============================================================================
# Stage 1: builder  — Node.js build environment, produces optimized static assets
# Stage 2: runtime  — Nginx alpine serving static files + SPA routing
# =============================================================================

# ── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /build

# Copy package files first (layer cache: only re-install on dependency changes)
COPY package.json package-lock.json ./

# Install ALL dependencies (dev included — needed for Vite build)
RUN npm ci --ignore-scripts

# Copy source
COPY . .

# Build production assets
# VITE_API_URL is injected at build time for the API base URL
# When running behind Nginx reverse proxy, relative URLs work (leave empty)
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build


# ── Stage 2: Nginx Runtime ────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# Remove default Nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom SPA-aware Nginx config
COPY nginx.conf /etc/nginx/conf.d/campus_connect.conf

# Copy built static assets from builder
COPY --from=builder /build/dist /usr/share/nginx/html

# Nginx runs as non-root by default on alpine (nginx user uid 101)
# Ensure correct ownership for the html directory
RUN chown -R nginx:nginx /usr/share/nginx/html \
    && chmod -R 755 /usr/share/nginx/html

EXPOSE 80

# Health check — Nginx serves the index page
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget -qO- http://localhost/health.txt || exit 1

CMD ["nginx", "-g", "daemon off;"]

