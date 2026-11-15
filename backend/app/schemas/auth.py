from typing import Optional
from pydantic import BaseModel, EmailStr, Field, model_validator


class RegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100, description="User's full name")
    username: str = Field(
        ...,
        min_length=3,
        max_length=50,
        pattern=r"^[a-zA-Z0-9_.-]+$",
        description="Unique username containing letters, numbers, underscores, dots or hyphens",
    )
    email: EmailStr = Field(..., description="Valid institutional or personal email address")
    password: str = Field(..., min_length=8, max_length=128, description="Password with minimum 8 characters")


class RegisterResponse(BaseModel):
    message: str
    user_id: int


class LoginRequest(BaseModel):
    email: EmailStr = Field(..., description="Registered email address")
    password: str = Field(..., min_length=1, description="Account password")


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AuthMeResponse(BaseModel):
    id: int
    full_name: str
    username: str
    email: EmailStr
    role: str


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1, description="Current account password")
    new_password: str = Field(..., min_length=8, max_length=128, description="New password with minimum 8 characters")
    confirm_password: Optional[str] = Field(None, min_length=8, max_length=128, description="Confirm new password")

    @model_validator(mode="after")
    def validate_password_confirmation(self):
        if self.confirm_password is not None and self.new_password != self.confirm_password:
            raise ValueError("New password and confirm password do not match")
        return self


class ChangePasswordResponse(BaseModel):
    message: str
    access_token: str
    token_type: str = "bearer"
