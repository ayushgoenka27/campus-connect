from datetime import datetime

from pydantic import BaseModel, Field


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


class UpdatePostRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)


class PostResponse(BaseModel):
    id: int
    content: str
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
