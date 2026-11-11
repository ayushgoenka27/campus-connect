from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, field_validator

# Allowed announcement categories
ANNOUNCEMENT_CATEGORIES = Literal["general", "academic", "events", "urgent", "placement"]


class AnnouncementCreate(BaseModel):
    title: str
    content: str
    category: ANNOUNCEMENT_CATEGORIES = "general"
    is_published: bool = False
    is_pinned: bool = False

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Title cannot be empty")
        if len(v) > 200:
            raise ValueError("Title cannot exceed 200 characters")
        return v

    @field_validator("content")
    @classmethod
    def content_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Content cannot be empty")
        return v


class AnnouncementUpdate(BaseModel):
    """All fields optional — partial PATCH."""
    title: Optional[str] = None
    content: Optional[str] = None
    category: Optional[ANNOUNCEMENT_CATEGORIES] = None
    is_published: Optional[bool] = None
    is_pinned: Optional[bool] = None

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("Title cannot be empty")
        if len(v) > 200:
            raise ValueError("Title cannot exceed 200 characters")
        return v

    @field_validator("content")
    @classmethod
    def content_not_empty(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("Content cannot be empty")
        return v


class AnnouncementAuthor(BaseModel):
    id: int
    full_name: str
    username: str


class AnnouncementResponse(BaseModel):
    id: int
    title: str
    content: str
    category: str
    is_published: bool
    is_pinned: bool
    author: Optional[AnnouncementAuthor] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AnnouncementList(BaseModel):
    total: int
    items: list[AnnouncementResponse]

