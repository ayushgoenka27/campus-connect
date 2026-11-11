from datetime import datetime
from pydantic import BaseModel, EmailStr, Field


class UpdateProfileRequest(BaseModel):
    full_name: str | None = Field(
        default=None,
        min_length=2,
        max_length=100,
    )

    bio: str | None = Field(
        default=None,
        max_length=500,
    )

    profile_image: str | None = Field(
        default=None,
        max_length=500,
    )

    course: str | None = Field(
        default=None,
        max_length=100,
    )

    branch: str | None = Field(
        default=None,
        max_length=100,
    )

    year: int | None = Field(
        default=None,
        ge=1,
        le=10,
    )


class PublicUserProfileResponse(BaseModel):
    id: int
    full_name: str
    username: str
    role: str
    bio: str | None = None
    profile_image: str | None = None
    course: str | None = None
    branch: str | None = None
    year: int | None = None
    created_at: datetime
    connection_status: str | None = None
    connection_id: int | None = None


class CurrentUserProfileResponse(BaseModel):
    id: int
    full_name: str
    username: str
    email: EmailStr
    role: str
    bio: str | None = None
    profile_image: str | None = None
    course: str | None = None
    branch: str | None = None
    year: int | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class UpdateProfileResponse(BaseModel):
    message: str
    user: CurrentUserProfileResponse
