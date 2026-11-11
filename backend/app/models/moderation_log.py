from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.user import User


# Allowed moderation action values
VALID_LOG_ACTIONS = frozenset({
    "activate_user",
    "deactivate_user",
    "hide_post",
    "unhide_post",
    "remove_post",
    "hide_comment",
    "unhide_comment",
    "remove_comment",
    "resolve_report",
    "dismiss_report",
    "create_announcement",
    "edit_announcement",
    "delete_announcement",
    "publish_announcement",
    "unpublish_announcement",
})


class ModerationLog(Base):
    """
    Immutable audit trail of all administrator moderation actions (FR-ADM-4).

    Design decisions:
    - admin_id uses ON DELETE SET NULL so audit records are preserved even
      if the administrator account is later removed.
    - target_type/target_id pair records the entity acted upon, independently
      of whether that entity still exists.
    - Rows are NEVER updated or deleted; this is an append-only audit log.
    """

    __tablename__ = "moderation_logs"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    # Nullable: log preserved if admin account is removed later
    admin_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Action performed — validated against VALID_LOG_ACTIONS at API layer
    action: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )

    # Type of entity that was acted upon: 'user', 'post', 'comment',
    # 'report', 'announcement'
    target_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    # ID of the entity — preserved even if the entity is later deleted
    target_id: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    # Optional human-readable context (e.g. reason for deactivation)
    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # Immutable creation timestamp — never updated
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
        index=True,
    )

    # Relationship
    admin: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[admin_id],
        lazy="select",
    )

