from datetime import datetime
from typing import TYPE_CHECKING, List

from sqlalchemy import DateTime, ForeignKey, Index, Integer, column
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.connection import _pair_least, _pair_greatest

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.message import Message


class Conversation(Base):
    """
    Direct messaging conversation between two users (FR-MSG-1, FR-MSG-2).

    Symmetric unique index 'uq_conversations_user_pair' ensures only one
    conversation exists between any pair of users, regardless of order.
    """

    __tablename__ = "conversations"
    __table_args__ = (
        Index(
            "uq_conversations_user_pair",
            _pair_least(column("user1_id"), column("user2_id")),
            _pair_greatest(column("user1_id"), column("user2_id")),
            unique=True,
        ),
        Index("ix_conversations_last_message_at", "last_message_at"),
    )

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    user1_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    user2_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    last_message_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
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
    user1: Mapped["User"] = relationship(
        "User",
        foreign_keys=[user1_id],
        lazy="joined",
    )

    user2: Mapped["User"] = relationship(
        "User",
        foreign_keys=[user2_id],
        lazy="joined",
    )

    messages: Mapped[List["Message"]] = relationship(
        "Message",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Message.created_at.asc()",
    )

