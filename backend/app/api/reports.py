"""
Reports API (FR-ADM-5) — students and admins can submit reports for posts
and comments. Each user may report any post or comment at most once.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.dependencies import get_db
from app.models.comment import Comment
from app.models.post import Post
from app.models.report import VALID_REPORT_REASONS, Report
from app.models.user import User
from app.schemas.admin import ReportCreate, ReportListResponse, ReportResponse

router = APIRouter(prefix="/reports", tags=["Reports"])


def _serialize_report(r: Report) -> dict:
    return {
        "id": r.id,
        "target_type": r.target_type,
        "target_id": r.target_id,
        "target_preview": r.target_preview,
        "reason": r.reason,
        "details": r.details,
        "status": r.status,
        "action_taken": r.action_taken,
        "reviewed_at": r.reviewed_at,
        "created_at": r.created_at,
    }


# ---------------------------------------------------------------------------
# POST /reports — submit a report
# ---------------------------------------------------------------------------
@router.post("", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
def submit_report(
    payload: ReportCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Submit a content report. Exactly one of post_id or comment_id must be set
    (enforced by the schema). Duplicate reports (same user + same target) return
    HTTP 409. Report history is preserved even if the content is later deleted.
    """
    # Validate reason (belt-and-suspenders beyond Literal type)
    if payload.reason not in VALID_REPORT_REASONS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid reason. Valid values: {sorted(VALID_REPORT_REASONS)}",
        )

    # Resolve the live target and snapshot its content
    if payload.post_id is not None:
        target_type = "post"
        target_id = payload.post_id
        post = db.scalar(select(Post).where(Post.id == payload.post_id))
        if not post:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
        target_preview = post.content[:500] if post.content else None
        target_author_id = post.author_id
        post_id = payload.post_id
        comment_id = None
        # Prevent self-reporting
        if post.author_id == current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot report your own content",
            )
    else:
        target_type = "comment"
        target_id = payload.comment_id
        comment = db.scalar(select(Comment).where(Comment.id == payload.comment_id))
        if not comment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
        target_preview = comment.content[:500] if comment.content else None
        target_author_id = comment.author_id
        post_id = None
        comment_id = payload.comment_id
        if comment.author_id == current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot report your own content",
            )

    report = Report(
        reporter_id=current_user.id,
        target_type=target_type,
        target_id=target_id,
        target_preview=target_preview,
        target_author_id=target_author_id,
        post_id=post_id,
        comment_id=comment_id,
        reason=payload.reason,
        details=payload.details,
        status="pending",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(report)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already reported this content",
        )

    db.refresh(report)
    return _serialize_report(report)


# ---------------------------------------------------------------------------
# GET /reports/my — view own submitted reports
# ---------------------------------------------------------------------------
@router.get("/my", response_model=ReportListResponse)
def my_reports(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = select(Report).where(Report.reporter_id == current_user.id)
    total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
    reports = db.scalars(q.order_by(Report.created_at.desc()).offset(skip).limit(limit)).all()
    return {"total": total, "items": [_serialize_report(r) for r in reports]}

