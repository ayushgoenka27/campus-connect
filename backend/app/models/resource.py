from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class Resource(Base):
    """
    Campus Academic & Practical Resource model (FR-RES-1, FR-RES-2).
    Represents curated external documents, syllabus guides, question papers,
    lab manuals, and academic links.
    """

    __tablename__ = "resources"
    __table_args__ = (
        Index("ix_resources_category", "category"),
        Index("ix_resources_title", "title"),
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

    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    category: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        doc="Category: syllabus, question_paper, lab_manual, handbook, portal, study_material",
    )

    resource_type: Mapped[str] = mapped_column(
        String(30),
        default="external_link",
        nullable=False,
        doc="Type: external_link, official_doc, drive_link, library_portal",
    )

    url: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        doc="Direct validated HTTP/HTTPS external link to the resource material",
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

