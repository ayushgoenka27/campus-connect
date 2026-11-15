from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class ActorBrief(BaseModel):
    id: int
    full_name: str
    username: str

    model_config = ConfigDict(from_attributes=True)


class NotificationResponse(BaseModel):
    id: int
    user_id: int
    actor_id: Optional[int] = None
    type: str
    title: str
    content: str
    link: Optional[str] = None
    is_read: bool
    read_at: Optional[datetime] = None
    created_at: datetime
    actor: Optional[ActorBrief] = None

    model_config = ConfigDict(from_attributes=True)


class NotificationList(BaseModel):
    items: list[NotificationResponse]
    total: int
    unread_count: int


class UnreadNotificationCount(BaseModel):
    unread_count: int

