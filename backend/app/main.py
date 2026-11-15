from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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


app = FastAPI(
    title="Campus Connect API",
    version="1.0.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    return {
        "status": "healthy",
        "service": "Campus Connect API",
        "version": "1.0.0",
    }
