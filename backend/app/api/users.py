from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user_id
from app.db.dependencies import get_db
from app.models.user import User
from app.schemas.user import (
    CurrentUserProfileResponse,
    PublicUserProfileResponse,
    UpdateProfileRequest,
    UpdateProfileResponse,
)


router = APIRouter(
    prefix="/users",
    tags=["Users"],
)


@router.get(
    "/me",
    response_model=CurrentUserProfileResponse,
)
def get_my_profile(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    user = db.scalar(select(User).where(User.id == user_id))

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return user


@router.patch(
    "/me",
    response_model=UpdateProfileResponse,
)
def update_my_profile(
    data: UpdateProfileRequest,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    user = db.scalar(select(User).where(User.id == user_id))

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    update_data = data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)

    return {
        "message": "Profile updated successfully",
        "user": user,
    }


@router.get(
    "/{user_id}",
    response_model=PublicUserProfileResponse,
)
def get_user_profile(
    user_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    user = db.scalar(
        select(User).where(
            User.id == user_id,
            User.is_active == True,
        )
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return user


@router.get(
    "",
    response_model=list[PublicUserProfileResponse],
)
def get_users(
    search: str | None = None,
    course: str | None = None,
    branch: str | None = None,
    year: int | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    query = (
        select(User)
        .where(User.is_active == True)
        .order_by(User.id)
    )

    # Search by full name or username
    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            (User.full_name.ilike(search_pattern))
            | (User.username.ilike(search_pattern))
        )

    # Filter by course
    if course:
        query = query.where(User.course.ilike(course))

    # Filter by branch
    if branch:
        query = query.where(User.branch.ilike(branch))

    # Filter by year
    if year is not None:
        query = query.where(User.year == year)

    # Pagination
    query = query.offset(skip).limit(limit)

    users = db.scalars(query).all()
    return list(users)
