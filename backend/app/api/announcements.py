"""
Announcements API (FR-ANN-1 through FR-ANN-4).

Access rules:
- GET endpoints: authenticated + active users only (students see published only;
  admins may request drafts via ?include_drafts=true).
- POST / PATCH / DELETE: administrators only (HTTP 403 for students).
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_admin, get_current_user
from app.db.dependencies import get_db
from app.models.announcement import Announcement
from app.models.moderation_log import ModerationLog
from app.models.user import User
from app.services.notification_service import notify_all_active_users
from app.schemas.announcement import (
    AnnouncementCreate,
    AnnouncementList,
    AnnouncementResponse,
    AnnouncementUpdate,
)

router = APIRouter(prefix="/announcements", tags=["Announcements"])

VALID_CATEGORIES = {"general", "academic", "events", "urgent", "placement"}


def _serialize(ann: Announcement) -> dict:
    """Serialize an Announcement ORM object to response dict."""
    author = None
    if ann.author:
        author = {
            "id": ann.author.id,
            "full_name": ann.author.full_name,
            "username": ann.author.username,
        }
    return {
        "id": ann.id,
        "title": ann.title,
        "content": ann.content,
        "category": ann.category,
        "is_published": ann.is_published,
        "is_pinned": ann.is_pinned,
        "author": author,
        "created_at": ann.created_at,
        "updated_at": ann.updated_at,
    }


def _log_action(
    db: Session,
    admin_id: int,
    action: str,
    target_type: str,
    target_id: int,
    notes: Optional[str] = None,
) -> None:
    """Append an audit entry to moderation_logs within the current transaction."""
    log = ModerationLog(
        admin_id=admin_id,
        action=action,
        target_type="announcement",
        target_id=target_id,
        notes=notes,
        created_at=datetime.utcnow(),
    )
    db.add(log)


# ---------------------------------------------------------------------------
# GET /announcements — list (all users, auth required)
# ---------------------------------------------------------------------------
@router.get("", response_model=AnnouncementList)
def list_announcements(
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    include_drafts: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List announcements. Students see published only; admins may pass
    include_drafts=true to also see draft announcements.
    Supports optional ?category= and ?search= filters.
    """
    is_admin = current_user.role in ("admin", "administrator")

    q = select(Announcement)

    # Draft visibility
    if not (is_admin and include_drafts):
        q = q.where(Announcement.is_published.is_(True))

    # Category filter
    if category:
        if category not in VALID_CATEGORIES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid category. Valid values: {sorted(VALID_CATEGORIES)}",
            )
        q = q.where(Announcement.category == category)

    # Keyword search on title and content
    if search and search.strip():
        term = f"%{search.strip()}%"
        q = q.where(
            Announcement.title.ilike(term) | Announcement.content.ilike(term)
        )

    # Total count
    count_q = select(func.count()).select_from(q.subquery())
    total = db.scalar(count_q) or 0

    # Ordering: pinned first, then newest first
    q = (
        q.order_by(Announcement.is_pinned.desc(), Announcement.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    announcements = db.scalars(q).all()

    # Eagerly load authors in a single query
    author_ids = [a.author_id for a in announcements if a.author_id]
    authors = {}
    if author_ids:
        for u in db.scalars(select(User).where(User.id.in_(author_ids))).all():
            authors[u.id] = u
    for ann in announcements:
        if ann.author_id and ann.author_id in authors:
            ann.author = authors[ann.author_id]

    return {"total": total, "items": [_serialize(a) for a in announcements]}


# ---------------------------------------------------------------------------
# GET /announcements/{id} — single (all users, auth required)
# ---------------------------------------------------------------------------
@router.get("/{announcement_id}", response_model=AnnouncementResponse)
def get_announcement(
    announcement_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ann = db.scalar(select(Announcement).where(Announcement.id == announcement_id))
    if not ann:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found")

    is_admin = current_user.role in ("admin", "administrator")
    if not ann.is_published and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This announcement is not published",
        )
    return _serialize(ann)


# ---------------------------------------------------------------------------
# POST /announcements — create (admin only, FR-ANN-1, FR-ANN-3)
# ---------------------------------------------------------------------------
@router.post("", response_model=AnnouncementResponse, status_code=status.HTTP_201_CREATED)
async def create_announcement(
    payload: AnnouncementCreate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    ann = Announcement(
        author_id=current_admin.id,
        title=payload.title.strip(),
        content=payload.content.strip(),
        category=payload.category,
        is_published=payload.is_published,
        is_pinned=payload.is_pinned,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(ann)
    db.flush()  # get ann.id before logging

    action = "publish_announcement" if payload.is_published else "create_announcement"
    _log_action(db, current_admin.id, action, "announcement", ann.id)

    db.commit()
    db.refresh(ann)
    ann.author = current_admin

    if ann.is_published:
        await notify_all_active_users(
            db=db,
            type="announcement",
            title="Campus Announcement",
            content=f"New announcement: {ann.title}",
            link="/announcements",
            actor_id=current_admin.id,
            exclude_user_id=current_admin.id,
        )

    return _serialize(ann)


# ---------------------------------------------------------------------------
# PATCH /announcements/{id} — update (admin only, FR-ANN-2)
# ---------------------------------------------------------------------------
@router.patch("/{announcement_id}", response_model=AnnouncementResponse)
def update_announcement(
    announcement_id: int,
    payload: AnnouncementUpdate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    ann = db.scalar(select(Announcement).where(Announcement.id == announcement_id))
    if not ann:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found")

    changed = False
    if payload.title is not None:
        ann.title = payload.title.strip()
        changed = True
    if payload.content is not None:
        ann.content = payload.content.strip()
        changed = True
    if payload.category is not None:
        ann.category = payload.category
        changed = True
    if payload.is_published is not None:
        ann.is_published = payload.is_published
        changed = True
    if payload.is_pinned is not None:
        ann.is_pinned = payload.is_pinned
        changed = True

    if not changed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No fields to update",
        )

    ann.updated_at = datetime.utcnow()
    _log_action(db, current_admin.id, "edit_announcement", "announcement", ann.id)
    db.commit()
    db.refresh(ann)
    return _serialize(ann)


# ---------------------------------------------------------------------------
# PATCH /announcements/{id}/publish — toggle publish (admin only)
# ---------------------------------------------------------------------------
@router.patch("/{announcement_id}/publish", response_model=AnnouncementResponse)
async def toggle_publish(
    announcement_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    ann = db.scalar(select(Announcement).where(Announcement.id == announcement_id))
    if not ann:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found")

    was_published = ann.is_published
    ann.is_published = not ann.is_published
    ann.updated_at = datetime.utcnow()

    action = "publish_announcement" if ann.is_published else "unpublish_announcement"
    _log_action(db, current_admin.id, action, "announcement", ann.id)
    db.commit()
    db.refresh(ann)

    if not was_published and ann.is_published:
        await notify_all_active_users(
            db=db,
            type="announcement",
            title="Campus Announcement",
            content=f"New announcement: {ann.title}",
            link="/announcements",
            actor_id=current_admin.id,
            exclude_user_id=current_admin.id,
        )

    return _serialize(ann)


# ---------------------------------------------------------------------------
# DELETE /announcements/{id} — remove (admin only, FR-ANN-2)
# ---------------------------------------------------------------------------
@router.delete("/{announcement_id}", status_code=status.HTTP_200_OK)
def delete_announcement(
    announcement_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    ann = db.scalar(select(Announcement).where(Announcement.id == announcement_id))
    if not ann:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found")

    _log_action(db, current_admin.id, "delete_announcement", "announcement", ann.id,
                notes=f"Deleted: {ann.title[:100]!r}")
    db.delete(ann)
    db.commit()
    return {"message": "Announcement deleted successfully"}

