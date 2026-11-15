"""
Admin dashboard and moderation API (FR-ADM-1 through FR-ADM-4).

All endpoints require admin role ("admin" or "administrator"). Students receive
HTTP 403 Forbidden. All moderation actions are transactional and append to the
moderation_logs audit trail.

Admin account safeguards (correction 3):
- An administrator cannot deactivate their own account.
- The last active administrator cannot be deactivated.
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_admin
from app.core.websocket import manager
from app.db.dependencies import get_db
from app.models.announcement import Announcement
from app.models.comment import Comment
from app.models.moderation_log import ModerationLog
from app.models.post import Post
from app.models.report import Report
from app.models.user import User
from app.services.notification_service import notify_user
from app.schemas.admin import (
    AdminStats,
    AdminUserList,
    AdminUserResponse,
    ModerationRequest,
    ReportListResponse,
    ReportResponse,
    UserStatusUpdate,
)

router = APIRouter(prefix="/admin", tags=["Admin"])


def _log(
    db: Session,
    admin_id: int,
    action: str,
    target_type: str,
    target_id: int,
    notes: Optional[str] = None,
) -> None:
    """Append an audit entry within the current transaction (not committed yet)."""
    db.add(ModerationLog(
        admin_id=admin_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        notes=notes,
        created_at=datetime.utcnow(),
    ))


def _serialize_user(u: User) -> dict:
    return {
        "id": u.id,
        "full_name": u.full_name,
        "username": u.username,
        "email": u.email,
        "role": u.role,
        "is_active": u.is_active,
        "created_at": u.created_at,
    }


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
# GET /admin/stats — dashboard overview (FR-ADM-1)
# ---------------------------------------------------------------------------
@router.get("/stats", response_model=AdminStats)
def admin_stats(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    total_users = db.scalar(select(func.count()).select_from(select(User).subquery())) or 0
    active_users = db.scalar(select(func.count()).select_from(
        select(User).where(User.is_active.is_(True)).subquery()
    )) or 0
    total_posts = db.scalar(select(func.count()).select_from(select(Post).subquery())) or 0
    total_ann = db.scalar(select(func.count()).select_from(select(Announcement).subquery())) or 0
    pending_reports = db.scalar(select(func.count()).select_from(
        select(Report).where(Report.status == "pending").subquery()
    )) or 0

    return {
        "total_users": total_users,
        "active_users": active_users,
        "total_posts": total_posts,
        "total_announcements": total_ann,
        "pending_reports": pending_reports,
    }


# ---------------------------------------------------------------------------
# GET /admin/users — paginated user list with optional search/role filter
# ---------------------------------------------------------------------------
@router.get("/users", response_model=AdminUserList)
def list_users(
    search: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    q = select(User)
    if search and search.strip():
        term = f"%{search.strip()}%"
        q = q.where(User.full_name.ilike(term) | User.username.ilike(term) | User.email.ilike(term))
    if role:
        q = q.where(User.role == role)
    if is_active is not None:
        q = q.where(User.is_active.is_(is_active))

    total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
    users = db.scalars(q.order_by(User.created_at.desc()).offset(skip).limit(limit)).all()
    return {"total": total, "items": [_serialize_user(u) for u in users]}


# ---------------------------------------------------------------------------
# PATCH /admin/users/{id}/status — activate/deactivate account (FR-ADM-3)
# ---------------------------------------------------------------------------
@router.patch("/users/{user_id}/status", response_model=AdminUserResponse)
async def update_user_status(
    user_id: int,
    payload: UserStatusUpdate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Activate or deactivate a user account.

    Admin account safeguards:
    1. An admin cannot deactivate their own account.
    2. The last active administrator cannot be deactivated.

    Deactivated accounts immediately lose access to all protected APIs because
    get_current_user() raises HTTP 403 when is_active is False. Active WebSocket
    connections are closed immediately with code 1008.
    """
    target = db.scalar(select(User).where(User.id == user_id))
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if not payload.is_active:
        # Guard 1: cannot deactivate own account
        if target.id == current_admin.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Administrators cannot deactivate their own account",
            )

        # Guard 2: cannot remove the last active administrator
        if target.role in ("admin", "administrator"):
            active_admin_count = db.scalar(
                select(func.count()).select_from(
                    select(User).where(
                        User.role.in_(["admin", "administrator"]),
                        User.is_active.is_(True),
                    ).subquery()
                )
            ) or 0
            if active_admin_count <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot deactivate the last active administrator",
                )

    action = "activate_user" if payload.is_active else "deactivate_user"
    target.is_active = payload.is_active
    target.updated_at = datetime.utcnow()

    _log(db, current_admin.id, action, "user", target.id,
         notes=f"Set is_active={payload.is_active} on {target.username!r}")

    db.commit()
    db.refresh(target)

    # Immediately close active WebSocket sessions if deactivated
    if not payload.is_active:
        await manager.disconnect_user(target.id, code=1008)

    return _serialize_user(target)


# ---------------------------------------------------------------------------
# GET /admin/reports — moderation queue (FR-ADM-1)
# ---------------------------------------------------------------------------
@router.get("/reports", response_model=ReportListResponse)
def list_reports(
    report_status: Optional[str] = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    q = select(Report)
    if report_status:
        allowed = {"pending", "resolved", "dismissed"}
        if report_status not in allowed:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid status. Valid values: {sorted(allowed)}",
            )
        q = q.where(Report.status == report_status)

    total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
    reports = db.scalars(q.order_by(Report.created_at.desc()).offset(skip).limit(limit)).all()
    return {"total": total, "items": [_serialize_report(r) for r in reports]}


# ---------------------------------------------------------------------------
# PATCH /admin/reports/{id} — moderate a report (FR-ADM-2, FR-ADM-4)
# ---------------------------------------------------------------------------
@router.patch("/reports/{report_id}", response_model=ReportResponse)
async def moderate_report(
    report_id: int,
    payload: ModerationRequest,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Moderate a report:
    - 'hide': sets is_hidden=True on the referenced post or comment (content
      preserved, invisible to public feeds but report history intact).
    - 'remove': deletes the post or comment outright (report history preserved
      via SET NULL FK and immutable target_type/target_id/target_preview).
    - 'dismiss': marks the report resolved with no content action.

    All actions are transactional. The report and a ModerationLog entry are
    committed atomically.
    """
    report = db.scalar(select(Report).where(Report.id == report_id))
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    if report.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Report is already {report.status}",
        )

    action_str = payload.action  # 'hide' | 'remove' | 'dismiss'

    if action_str == "dismiss":
        report.status = "dismissed"
        report.action_taken = "dismissed"
        _log(db, current_admin.id, "dismiss_report", "report", report.id, notes=payload.notes)

    elif action_str == "hide":
        if report.target_type == "post" and report.post_id:
            post = db.scalar(select(Post).where(Post.id == report.post_id))
            if post:
                post.is_hidden = True
                _log(db, current_admin.id, "hide_post", "post", report.post_id, notes=payload.notes)
        elif report.target_type == "comment" and report.comment_id:
            comment = db.scalar(select(Comment).where(Comment.id == report.comment_id))
            if comment:
                comment.is_hidden = True
                _log(db, current_admin.id, "hide_comment", "comment", report.comment_id, notes=payload.notes)
        report.status = "resolved"
        report.action_taken = "hidden"
        _log(db, current_admin.id, "resolve_report", "report", report.id, notes=payload.notes)

    elif action_str == "remove":
        if report.target_type == "post" and report.post_id:
            post = db.scalar(select(Post).where(Post.id == report.post_id))
            if post:
                db.delete(post)  # ON DELETE SET NULL preserves this report
                _log(db, current_admin.id, "remove_post", "post", report.post_id, notes=payload.notes)
        elif report.target_type == "comment" and report.comment_id:
            comment = db.scalar(select(Comment).where(Comment.id == report.comment_id))
            if comment:
                db.delete(comment)
                _log(db, current_admin.id, "remove_comment", "comment", report.comment_id, notes=payload.notes)
        report.status = "resolved"
        report.action_taken = "removed"
        _log(db, current_admin.id, "resolve_report", "report", report.id, notes=payload.notes)

    report.reviewed_by = current_admin.id
    report.reviewed_at = datetime.utcnow()
    report.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(report)

    # Notify reporter if known (FR-NOTIF-1)
    if report.reporter_id:
        outcome = "dismissed" if action_str == "dismiss" else f"resolved ({report.action_taken})"
        await notify_user(
            db=db,
            user_id=report.reporter_id,
            type="moderation",
            title="Moderation Update",
            content=f"Your report regarding {report.target_type} has been {outcome}.",
            link="/community",
            actor_id=current_admin.id,
        )

    return _serialize_report(report)

