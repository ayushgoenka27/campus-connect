from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.post import Post
    from app.models.comment import Comment


# Valid report reasons
VALID_REPORT_REASONS = frozenset({
    "spam",
    "harassment",
    "hate_speech",
    "inappropriate",
    "misinformation",
    "other",
})

# Valid report statuses
VALID_REPORT_STATUSES = frozenset({"pending", "resolved", "dismissed"})

# Valid moderation actions
VALID_MODERATION_ACTIONS = frozenset({"hidden", "removed", "dismissed", "none"})


class Report(Base):
    """
    User-submitted report for a post or comment (FR-ADM-5).

    Design decisions (correction 1):
    - target_type (str), target_id (int), and target_preview (str) are
      IMMUTABLE historical evidence that persist regardless of content deletion.
    - post_id and comment_id are NULLABLE FKs with ON DELETE SET NULL:
      they go NULL when the reported content is deleted but the report and
      its historical snapshot remain.
    - NO CheckConstraint on (post_id, comment_id) because after deletion
      both become NULL — the original target_type/target_id pair is the
      authoritative single-target record.
    - Duplicate prevention: a composite unique index on
      (reporter_id, target_type, target_id) prevents the same user from
      reporting the same content twice.
    """

    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    # Who submitted the report
    reporter_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Immutable historical record — never modified after creation
    target_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        # 'post' or 'comment'
    )

    target_id: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        index=True,
    )

    target_preview: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        # Snapshot of the reported content at the time of report submission.
        # Preserved even after the content is hidden or deleted.
    )

    target_author_id: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        # Snapshot of author ID at the time of report submission.
    )

    # Nullable live references — become NULL when content is deleted
    post_id: Mapped[int | None] = mapped_column(
        ForeignKey("posts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    comment_id: Mapped[int | None] = mapped_column(
        ForeignKey("comments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Validated against VALID_REPORT_REASONS at the API layer
    reason: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    details: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # 'pending' | 'resolved' | 'dismissed'
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="pending",
        index=True,
    )

    # Populated when admin resolves the report
    action_taken: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        # 'hidden' | 'removed' | 'dismissed' | 'none'
    )

    # Nullable FK — log preserved even if the reviewing admin is later removed
    reviewed_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
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

    # Relationships — these may be None if the content was deleted
    reporter: Mapped["User"] = relationship(
        "User",
        foreign_keys=[reporter_id],
        lazy="select",
    )

    post: Mapped["Post | None"] = relationship(
        "Post",
        foreign_keys=[post_id],
        lazy="select",
    )

    comment: Mapped["Comment | None"] = relationship(
        "Comment",
        foreign_keys=[comment_id],
        lazy="select",
    )

    reviewer: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[reviewed_by],
        lazy="select",
    )

    # Duplicate-report prevention: one report per (reporter, target) pair
    __table_args__ = (
        Index(
            "uq_reports_reporter_target",
            "reporter_id",
            "target_type",
            "target_id",
            unique=True,
        ),
    )

