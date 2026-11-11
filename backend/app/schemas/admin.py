from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel

from app.models.report import VALID_REPORT_REASONS


ReportReason = Literal[
    "spam", "harassment", "hate_speech", "inappropriate", "misinformation", "other"
]

ReportStatus = Literal["pending", "resolved", "dismissed"]

ModerationAction = Literal["hide", "remove", "dismiss"]


class ReportCreate(BaseModel):
    """
    Submit a report for a post or comment.
    Exactly one of post_id or comment_id must be provided.
    """
    post_id: Optional[int] = None
    comment_id: Optional[int] = None
    reason: ReportReason
    details: Optional[str] = None

    def model_post_init(self, __context) -> None:  # noqa: D401
        both = self.post_id is not None and self.comment_id is not None
        neither = self.post_id is None and self.comment_id is None
        if both or neither:
            raise ValueError("Exactly one of post_id or comment_id must be provided")


class ReportResponse(BaseModel):
    id: int
    target_type: str
    target_id: int
    target_preview: Optional[str]
    reason: str
    details: Optional[str]
    status: str
    action_taken: Optional[str]
    reviewed_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


class ReportListResponse(BaseModel):
    total: int
    items: list[ReportResponse]


class ModerationRequest(BaseModel):
    """Admin action on a pending report."""
    action: ModerationAction
    notes: Optional[str] = None


# --- Admin schemas ---

class UserStatusUpdate(BaseModel):
    is_active: bool


class AdminUserResponse(BaseModel):
    id: int
    full_name: str
    username: str
    email: str
    role: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminUserList(BaseModel):
    total: int
    items: list[AdminUserResponse]


class AdminStats(BaseModel):
    total_users: int
    active_users: int
    total_posts: int
    total_announcements: int
    pending_reports: int

