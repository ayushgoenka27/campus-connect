from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user_id
from app.db.dependencies import get_db
from app.models.user import User
from app.schemas.user import UpdateProfileRequest


router = APIRouter(
    prefix="/users",
    tags=["Users"],
)


# Get the logged-in user's profile
@router.get("/me")
def get_my_profile(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    user = db.scalar(
        select(User).where(User.id == user_id)
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return {
        "id": user.id,
        "full_name": user.full_name,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "bio": user.bio,
        "profile_image": user.profile_image,
        "course": user.course,
        "branch": user.branch,
        "year": user.year,
        "is_active": user.is_active,
        "created_at": user.created_at,
        "updated_at": user.updated_at,
    }


# Update the logged-in user's profile
@router.patch("/me")
def update_my_profile(
    data: UpdateProfileRequest,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    user = db.scalar(
        select(User).where(User.id == user_id)
    )

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
        "user": {
            "id": user.id,
            "full_name": user.full_name,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "bio": user.bio,
            "profile_image": user.profile_image,
            "course": user.course,
            "branch": user.branch,
            "year": user.year,
            "is_active": user.is_active,
            "created_at": user.created_at,
            "updated_at": user.updated_at,
        },
    }


# Get active users with search and filters
@router.get("")
def get_users(
    search: str | None = None,
    course: str | None = None,
    branch: str | None = None,
    year: int | None = None,
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

    users = db.scalars(query).all()

    return [
        {
            "id": user.id,
            "full_name": user.full_name,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "bio": user.bio,
            "profile_image": user.profile_image,
            "course": user.course,
            "branch": user.branch,
            "year": user.year,
        }
        for user in users
    ]