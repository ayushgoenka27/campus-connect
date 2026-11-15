from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context

from app.models.base import Base
from app.models.user import User
from app.models.announcement import Announcement
from app.models.report import Report
from app.models.moderation_log import ModerationLog
from app.core.config import settings
# Post, Comment, Like, Connection imported via their modules so metadata is populated
import app.models.post
import app.models.comment
import app.models.like
import app.models.connection
import app.models.conversation
import app.models.message
import app.models.notification
import app.models.resource
import app.models.event


config = context.config


if config.config_file_name is not None:
    fileConfig(config.config_file_name)


target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = settings.database_url

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    configuration = config.get_section(
        config.config_ini_section,
        {},
    )

    ini_url = config.get_main_option("sqlalchemy.url")
    if not ini_url or ini_url.startswith("driver://"):
        configuration["sqlalchemy.url"] = settings.database_url
    else:
        configuration["sqlalchemy.url"] = ini_url

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()