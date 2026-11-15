from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class Event(Base):
    """
    Campus Event model (FR-EVT-1 through FR-EVT-4).
    Represents workshops, hackathons, academic seminars, club activities, and campus gatherings.
    """

    __tablename__ = "events"
    __table_args__ = (
        Index("ix_events_start_date", "start_date"),
        Index("ix_events_category", "category"),
    )

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    title: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )

    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    category: Mapped[str] = mapped_column(
        String(50),
        default="general",
        nullable=False,
        doc="Category: workshop, hackathon, seminar, cultural, sports, academic, general",
    )

    start_date: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
    )

    end_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime,
        nullable=True,
    )

    location: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        doc="Physical venue (e.g. Auditorium B) or virtual link (e.g. Meet URL)",
    )

    registration_url: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
        doc="Optional external form or registration link",
    )

    capacity: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        doc="Maximum attendee limit, if applicable",
    )

    created_by_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        doc="Admin creator ID (survives admin deletion)",
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
    created_by: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[created_by_id],
        lazy="joined",
    )

    rsvps: Mapped[List["EventRSVP"]] = relationship(
        "EventRSVP",
        back_populates="event",
        cascade="all, delete-orphan",
    )


class EventRSVP(Base):
    """
    Event RSVP / registration model (FR-EVT-2).
    Tracks student attendance status with database-enforced uniqueness per (event, user).
    """

    __tablename__ = "event_rsvps"
    __table_args__ = (
        UniqueConstraint("event_id", "user_id", name="uq_event_rsvps_event_user"),
        Index("ix_event_rsvps_user_event", "user_id", "event_id"),
    )

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    event_id: Mapped[int] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    status: Mapped[str] = mapped_column(
        String(20),
        default="attending",
        nullable=False,
        doc="RSVP status: attending, interested",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    # Relationships
    event: Mapped["Event"] = relationship(
        "Event",
        back_populates="rsvps",
    )

    user: Mapped["User"] = relationship(
        "User",
        lazy="joined",
    )

