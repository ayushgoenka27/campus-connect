from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings


# Configure resilient pooling for production PostgreSQL connections (P7-08, TD-029)
engine_kwargs = {"echo": False}
if not settings.database_url.startswith("sqlite"):
    engine_kwargs.update(
        {
            "pool_pre_ping": True,  # Test connection viability before handing to caller
            "pool_size": 10,        # Stable connection pool size for web concurrency
            "max_overflow": 20,     # Allow burst headroom during peak load
            "pool_recycle": 1800,   # Recycle connections every 30m to prevent stale sockets
        }
    )

engine = create_engine(
    settings.database_url,
    **engine_kwargs,
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)
