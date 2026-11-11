from pydantic import BaseModel, Field


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