import logging
from datetime import datetime
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.websocket import manager
from app.models.notification import Notification
from app.models.user import User

logger = logging.getLogger("campus_connect.notifications")


def create_notification_record(
    db: Session,
    user_id: int,
    type: str,
    title: str,
    content: str,
    link: Optional[str] = None,
    actor_id: Optional[int] = None,
) -> Optional[Notification]:
    """
    Persists notification to PostgreSQL before any WebSocket delivery (FR-NOTIF-1).
    Includes duplicate prevention for connection requests and moderation alerts.
    """
    # Duplicate prevention: prevent unread duplicate connection requests from same actor
    if type == "connection_request" and actor_id is not None:
        existing = db.scalar(
            select(Notification).where(
                Notification.user_id == user_id,
                Notification.actor_id == actor_id,
                Notification.type == "connection_request",
                Notification.is_read == False,
            )
        )
        if existing:
            return None

    notification = Notification(
        user_id=user_id,
        actor_id=actor_id,
        type=type,
        title=title,
        content=content,
        link=link,
        created_at=datetime.utcnow(),
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


async def deliver_notification_ws(notification: Notification) -> bool:
    """
    Attempts real-time delivery via WebSocket.
    Catches any delivery exceptions so PostgreSQL persistence is never lost.
    """
    try:
        actor_data = None
        if notification.actor:
            actor_data = {
                "id": notification.actor.id,
                "full_name": notification.actor.full_name,
                "username": notification.actor.username,
            }

        payload = {
            "type": "notification",
            "notification": {
                "id": notification.id,
                "user_id": notification.user_id,
                "actor_id": notification.actor_id,
                "type": notification.type,
                "title": notification.title,
                "content": notification.content,
                "link": notification.link,
                "is_read": notification.is_read,
                "read_at": notification.read_at.isoformat() if notification.read_at else None,
                "created_at": notification.created_at.isoformat(),
                "actor": actor_data,
            },
        }
        return await manager.send_to_user(notification.user_id, payload)
    except Exception as e:
        logger.warning(
            f"Failed to deliver notification {notification.id} via WebSocket: {e}"
        )
        return False


async def notify_user(
    db: Session,
    user_id: int,
    type: str,
    title: str,
    content: str,
    link: Optional[str] = None,
    actor_id: Optional[int] = None,
) -> Optional[Notification]:
    """
    Persists notification in DB first, then attempts real-time WebSocket delivery.
    """
    notif = create_notification_record(
        db=db,
        user_id=user_id,
        type=type,
        title=title,
        content=content,
        link=link,
        actor_id=actor_id,
    )
    if notif:
        await deliver_notification_ws(notif)
    return notif


async def notify_all_active_users(
    db: Session,
    type: str,
    title: str,
    content: str,
    link: Optional[str] = None,
    actor_id: Optional[int] = None,
    exclude_user_id: Optional[int] = None,
) -> list[Notification]:
    """
    Broadcasts notifications to all active users (e.g. for campus announcements).
    """
    query = select(User.id).where(User.is_active == True)
    if exclude_user_id:
        query = query.where(User.id != exclude_user_id)
    user_ids = db.scalars(query).all()

    notifications = []
    for uid in user_ids:
        notif = create_notification_record(
            db=db,
            user_id=uid,
            type=type,
            title=title,
            content=content,
            link=link,
            actor_id=actor_id,
        )
        if notif:
            notifications.append(notif)
            await deliver_notification_ws(notif)

    return notifications

