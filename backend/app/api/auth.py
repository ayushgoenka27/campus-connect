from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.dependencies import get_current_user_id, get_current_user as get_authenticated_user
from app.core.rate_limit import rate_limit
from app.core.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from app.core.websocket import manager
from app.db.dependencies import get_db
from app.models.user import User
from app.schemas.auth import (
    RegisterRequest,
    RegisterResponse,
    LoginRequest,
    TokenResponse,
    AuthMeResponse,
    ChangePasswordRequest,
    ChangePasswordResponse,
)


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit(times=15, seconds=60, key="auth_register"))],
)
def register(
    data: RegisterRequest,
    db: Session = Depends(get_db),
):
    # Optional institutional email domain check (FR-AUTH-1)
    if settings.allowed_email_domains:
        domain = data.email.split("@")[-1].lower()
        allowed = [d.lower() for d in settings.allowed_email_domains]
        if domain not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Registration restricted to institutional domains: {', '.join(settings.allowed_email_domains)}",
            )

    existing_user = db.scalar(
        select(User).where(
            (User.email == data.email)
            | (User.username == data.username)
        )
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email or username already exists",
        )

    user = User(
        full_name=data.full_name,
        username=data.username,
        email=data.email,
        password_hash=hash_password(data.password),
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "message": "User registered successfully",
        "user_id": user.id,
    }


@router.post(
    "/login",
    response_model=TokenResponse,
    dependencies=[Depends(rate_limit(times=15, seconds=60, key="auth_login"))],
)
def login(
    data: LoginRequest,
    db: Session = Depends(get_db),
):
    user = db.scalar(
        select(User).where(User.email == data.email)
    )

    if not user or not verify_password(
        data.password,
        user.password_hash,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    access_token = create_access_token(
        user.id,
        token_version=getattr(user, "token_version", 1),
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
    }


@router.post(
    "/change-password",
    response_model=ChangePasswordResponse,
    dependencies=[Depends(rate_limit(times=10, seconds=60, key="auth_change_password"))],
)
async def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
):
    """
    Secure password change endpoint (FR-SET-1).
    Validates current password, updates to Argon2 hash, increments token_version to
    invalidate all previous sessions/tokens, and terminates active WebSockets.
    """
    if not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    if verify_password(data.new_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from current password",
        )

    # Invalidate all existing sessions by incrementing token_version
    current_user.password_hash = hash_password(data.new_password)
    current_user.token_version = getattr(current_user, "token_version", 1) + 1
    db.commit()
    db.refresh(current_user)

    # Disconnect any open WebSocket connections immediately
    await manager.disconnect_user(current_user.id, code=1008)

    # Issue fresh token for the current session reflecting the new token_version
    new_token = create_access_token(
        user_id=current_user.id,
        token_version=current_user.token_version,
    )

    return {
        "message": "Password changed successfully",
        "access_token": new_token,
        "token_type": "bearer",
    }


@router.post(
    "/logout",
    status_code=status.HTTP_200_OK,
)
async def logout(
    current_user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
):
    """
    Genuine server-side JWT revocation (FR-AUTH-5, TD-024).
    Increments token_version in PostgreSQL, invalidating the current
    access token (and any other sessions using this token_version) for both
    REST endpoints and WebSocket connections, and closes all active WebSockets.
    """
    current_user.token_version = getattr(current_user, "token_version", 1) + 1
    db.commit()
    db.refresh(current_user)

    await manager.disconnect_user(current_user.id, code=1008)

    return {
        "message": "Logged out successfully; session invalidated",
    }


@router.get(
    "/me",
    response_model=AuthMeResponse,
)
def get_current_user_profile(
    current_user: User = Depends(get_authenticated_user),
):
    return {
        "id": current_user.id,
        "full_name": current_user.full_name,
        "username": current_user.username,
        "email": current_user.email,
        "role": current_user.role,
    }