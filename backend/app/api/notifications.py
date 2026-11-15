from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.dependencies import get_db
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import (
    NotificationList,
    NotificationResponse,
    UnreadNotificationCount,
)

router = APIRouter(
    prefix="/notifications",
    tags=["Notifications"],
)


@router.get("", response_model=NotificationList)
def get_notifications(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    unread_only: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List paginated notifications for the current user (FR-NOTIF-1, FR-NOTIF-2).
    Users can only access their own notifications.
    """
    base_query = select(Notification).where(Notification.user_id == current_user.id)
    if unread_only:
        base_query = base_query.where(Notification.is_read == False)

    total = db.scalar(
        select(func.count(Notification.id)).where(Notification.user_id == current_user.id)
    ) or 0

    unread_count = db.scalar(
        select(func.count(Notification.id)).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
        )
    ) or 0

    notifications = (
        db.scalars(
            base_query.order_by(Notification.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        .unique()
        .all()
    )

    return {
        "items": notifications,
        "total": total,
        "unread_count": unread_count,
    }


@router.get("/unread-count", response_model=UnreadNotificationCount)
def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get unread notification count for the current user's navbar badge.
    """
    unread_count = db.scalar(
        select(func.count(Notification.id)).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
        )
    ) or 0

    return {"unread_count": unread_count}


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
def mark_notification_as_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Mark a specific notification as read (FR-NOTIF-3).
    Ensures users can only mark their own notifications.
    """
    notification = db.scalar(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
    )
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )

    if not notification.is_read:
        notification.is_read = True
        notification.read_at = datetime.utcnow()
        db.commit()
        db.refresh(notification)

    return notification


@router.patch("/read-all")
def mark_all_notifications_as_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Mark all unread notifications as read for current user (FR-NOTIF-3).
    """
    now = datetime.utcnow()
    result = db.execute(
        update(Notification)
        .where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
        )
        .values(is_read=True, read_at=now)
    )
    db.commit()

    return {
        "message": "All notifications marked as read",
        "updated_count": result.rowcount,
    }


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Delete a notification (FR-NOTIF-4).
    Ensures users can only delete their own notifications.
    """
    notification = db.scalar(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
    )
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )

    db.delete(notification)
    db.commit()
    return None

