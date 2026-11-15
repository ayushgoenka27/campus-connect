from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.conversation import Conversation


class Message(Base):
    """
    Message record within a conversation (FR-MSG-1, FR-MSG-2, FR-MSG-4, FR-ERR-5).

    Status:
    - 'sent': stored in database, recipient may be offline.
    - 'delivered': received by recipient client via WebSocket or query.
    - 'read': viewed by recipient in chat window.
    """

    __tablename__ = "messages"
    __table_args__ = (
        Index("ix_messages_conv_created", "conversation_id", "created_at"),
        Index("ix_messages_recipient_unread", "recipient_id", "is_read"),
        Index(
            "uq_messages_conv_sender_client_id",
            "conversation_id",
            "sender_id",
            "client_msg_id",
            unique=True,
            postgresql_where=text("client_msg_id IS NOT NULL"),
            sqlite_where=text("client_msg_id IS NOT NULL"),
        ),
        CheckConstraint(
            "((is_read = false AND status IN ('sent', 'delivered')) OR (is_read = true AND status = 'read'))",
            name="ck_messages_status_is_read_consistent",
        ),
    )

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    client_msg_id: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
        index=True,
        doc="Client-generated unique ID for idempotent delivery & retries",
    )

    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    sender_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    recipient_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(20),
        default="sent",
        nullable=False,
    )

    is_read: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    read_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    # Relationships
    conversation: Mapped["Conversation"] = relationship(
        "Conversation",
        back_populates="messages",
    )

    sender: Mapped["User"] = relationship(
        "User",
        foreign_keys=[sender_id],
        lazy="joined",
    )

    recipient: Mapped["User"] = relationship(
        "User",
        foreign_keys=[recipient_id],
        lazy="joined",
    )

