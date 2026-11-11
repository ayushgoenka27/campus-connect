from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class Announcement(Base):
    """
    Campus announcement published by an administrator.

    Design decisions (TD-017):
    - author_id uses ON DELETE SET NULL (not CASCADE) so announcements are
      preserved if the authoring admin account is later removed.
    - is_published controls student visibility: drafts (is_published=False)
      are only accessible to administrators.
    - is_pinned surfaces urgent/important notices to the top of the feed.
    """

    __tablename__ = "announcements"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    # ON DELETE SET NULL: announcements survive admin account removal
    author_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    title: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )

    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    # Allowed values: 'general', 'academic', 'events', 'urgent', 'placement'
    category: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="general",
        index=True,
    )

    is_published: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,  # Defaults to draft; admin explicitly publishes
        index=True,
    )

    is_pinned: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    # Relationships
    author: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[author_id],
        lazy="select",
    )

