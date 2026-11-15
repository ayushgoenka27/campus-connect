import logging
import time
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.core.config import settings
from app.core.security_headers import SecurityHeadersMiddleware
from app.db.database import SessionLocal

from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.api.connections import router as connections_router
from app.api.posts import router as posts_router
from app.api.announcements import router as announcements_router
from app.api.reports import router as reports_router
from app.api.admin import router as admin_router
from app.api.conversations import router as conversations_router
from app.api.notifications import router as notifications_router
from app.api.resources import router as resources_router
from app.api.events import router as events_router
from app.api.websocket import router as websocket_router


logger = logging.getLogger("campus_connect")

app = FastAPI(
    title="Campus Connect API",
    version="1.0.0",
    docs_url="/docs" if settings.environment != "production" else None,
    redoc_url="/redoc" if settings.environment != "production" else None,
)

# 1. Security Headers & CSP (runs first on response)
app.add_middleware(SecurityHeadersMiddleware)

# 2. CORS Middleware with environment-driven allowed origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global exception handler — prevents leaking stack traces in production (P7-06)
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(
        f"Unhandled exception during {request.method} {request.url.path}: {exc}",
        exc_info=True,
    )
    if settings.environment == "production":
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "An internal server error occurred. Please try again later."},
        )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": f"Internal Server Error: {str(exc)}"},
    )


# API Routers
app.include_router(
    auth_router,
    prefix="/api/v1",
)

app.include_router(
    users_router,
    prefix="/api/v1",
)

app.include_router(
    connections_router,
    prefix="/api/v1",
)

app.include_router(
    posts_router,
    prefix="/api/v1",
)

app.include_router(
    announcements_router,
    prefix="/api/v1",
)

app.include_router(
    reports_router,
    prefix="/api/v1",
)

app.include_router(
    admin_router,
    prefix="/api/v1",
)

app.include_router(
    conversations_router,
    prefix="/api/v1",
)

app.include_router(
    notifications_router,
    prefix="/api/v1",
)

app.include_router(
    resources_router,
    prefix="/api/v1",
)

app.include_router(
    events_router,
    prefix="/api/v1",
)

app.include_router(
    websocket_router,
)


@app.get("/")
def root():
    return {
        "message": "Welcome to Campus Connect API",
    }


@app.get("/health", tags=["System"])
def health_check():
    """Liveness probe: verifies process is alive and responsive."""
    return {
        "status": "healthy",
        "service": "Campus Connect API",
        "version": "1.0.0",
        "environment": settings.environment,
    }


@app.get("/health/db", tags=["System"])
def health_db_check():
    """Readiness probe: verifies database connectivity without leaking infrastructure details."""
    start_time = time.monotonic()
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        latency_ms = round((time.monotonic() - start_time) * 1000, 2)
        return {
            "status": "healthy",
            "database": "connected",
            "latency_ms": latency_ms,
        }
    except Exception as exc:
        logger.error(f"Database readiness check failed: {exc}")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "unhealthy",
                "database": "disconnected",
                "detail": "Database is unreachable",
            },
        )
    finally:
        db.close()
