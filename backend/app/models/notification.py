from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class Notification(Base):
    """
    User notification model (FR-NOTIF-1 through FR-NOTIF-4).
    Persists platform notifications for connection requests, connection acceptances,
    announcements, moderation actions, and direct messages.
    """

    __tablename__ = "notifications"
    __table_args__ = (
        Index("ix_notifications_user_unread", "user_id", "is_read"),
        Index("ix_notifications_user_created", "user_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="Recipient of the notification",
    )

    actor_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        doc="User who triggered the notification, if applicable (survives actor deletion)",
    )

    type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        doc="Notification category: connection_request, connection_accepted, announcement, moderation, message",
    )

    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    link: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        doc="Internal client deep-link, e.g. /connections, /announcements, /messages",
    )

    is_read: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
    )

    read_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        foreign_keys=[user_id],
        lazy="joined",
    )

    actor: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[actor_id],
        lazy="joined",
    )

