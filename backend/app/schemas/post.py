from datetime import datetime
from urllib.parse import urlparse

from pydantic import BaseModel, Field, field_validator


def _validate_optional_http_url(value: str | None) -> str | None:
    """Normalize blank URLs to None and enforce http/https URLs."""
    if value is None:
        return None
    trimmed = value.strip()
    if not trimmed:
        return None
    if len(trimmed) > 500:
        raise ValueError("Image URL must be at most 500 characters")
    parsed = urlparse(trimmed)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ValueError("Image URL must be a valid http:// or https:// URL")
    if any(ch.isspace() for ch in trimmed):
        raise ValueError("Image URL must not contain whitespace")
    return trimmed


def _validate_non_blank_content(value: str | None) -> str | None:
    if value is None:
        return None
    trimmed = value.strip()
    if not trimmed:
        raise ValueError("Post content cannot be empty")
    return trimmed


# ---------------------------------------------------------------------------
# Shared author info (used in both PostResponse and CommentResponse)
# ---------------------------------------------------------------------------

class PostAuthorInfo(BaseModel):
    id: int
    full_name: str
    username: str
    profile_image: str | None = None
    course: str | None = None
    branch: str | None = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Post schemas
# ---------------------------------------------------------------------------

class CreatePostRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)
    image_url: str | None = Field(default=None, max_length=500)

    @field_validator("content")
    @classmethod
    def check_content_not_blank(cls, v: str) -> str:
        res = _validate_non_blank_content(v)
        assert res is not None
        return res

    @field_validator("image_url")
    @classmethod
    def check_image_url(cls, v: str | None) -> str | None:
        return _validate_optional_http_url(v)


class UpdatePostRequest(BaseModel):
    content: str | None = Field(default=None, min_length=1, max_length=2000)
    image_url: str | None = Field(default=None, max_length=500)

    @field_validator("content")
    @classmethod
    def check_content_not_blank(cls, v: str | None) -> str | None:
        return _validate_non_blank_content(v)

    @field_validator("image_url")
    @classmethod
    def check_image_url(cls, v: str | None) -> str | None:
        return _validate_optional_http_url(v)


class PostResponse(BaseModel):
    id: int
    content: str
    image_url: str | None = None
    author: PostAuthorInfo
    like_count: int
    comment_count: int
    is_liked: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PostListResponse(BaseModel):
    posts: list[PostResponse]
    total: int


# ---------------------------------------------------------------------------
# Comment schemas
# ---------------------------------------------------------------------------

class CreateCommentRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=500)


class CommentResponse(BaseModel):
    id: int
    post_id: int
    content: str
    author: PostAuthorInfo
    created_at: datetime

    model_config = {"from_attributes": True}


class CommentListResponse(BaseModel):
    comments: list[CommentResponse]
    total: int


# ---------------------------------------------------------------------------
# Like schemas
# ---------------------------------------------------------------------------

class LikeResponse(BaseModel):
    message: str
    liked: bool
    like_count: int
