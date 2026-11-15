from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_admin, get_current_user
from app.db.dependencies import get_db
from app.models.resource import Resource
from app.models.user import User
from app.schemas.resource import (
    ResourceCreate,
    ResourceList,
    ResourceResponse,
    ResourceUpdate,
    VALID_RESOURCE_CATEGORIES,
)

router = APIRouter(
    prefix="/resources",
    tags=["Resources"],
)


@router.get("", response_model=ResourceList)
def list_resources(
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List campus academic and practical resources (FR-RES-1).
    Accessible to all authenticated users.
    Supports filtering by ?category= and searching by ?search=.
    """
    query = select(Resource)

    if category:
        cat_lower = category.strip().lower()
        if cat_lower not in VALID_RESOURCE_CATEGORIES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid category. Valid categories: {sorted(VALID_RESOURCE_CATEGORIES)}",
            )
        query = query.where(Resource.category == cat_lower)

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.where(
            Resource.title.ilike(term) | Resource.description.ilike(term)
        )

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0

    resources = (
        db.scalars(
            query.order_by(Resource.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        .unique()
        .all()
    )

    return {
        "items": resources,
        "total": total,
    }


@router.get("/{resource_id}", response_model=ResourceResponse)
def get_resource(
    resource_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get single resource by ID (FR-RES-1).
    """
    resource = db.scalar(select(Resource).where(Resource.id == resource_id))
    if not resource:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resource not found",
        )
    return resource


@router.post("", response_model=ResourceResponse, status_code=status.HTTP_201_CREATED)
def create_resource(
    payload: ResourceCreate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Create a new campus resource (FR-RES-2).
    Restricted to administrators only.
    """
    resource = Resource(
        title=payload.title.strip(),
        description=payload.description.strip() if payload.description else None,
        category=payload.category,
        resource_type=payload.resource_type,
        url=payload.url.strip(),
        created_by_id=current_admin.id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(resource)
    db.commit()
    db.refresh(resource)
    return resource


@router.patch("/{resource_id}", response_model=ResourceResponse)
def update_resource(
    resource_id: int,
    payload: ResourceUpdate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Update an existing resource (FR-RES-2).
    Restricted to administrators only.
    """
    resource = db.scalar(select(Resource).where(Resource.id == resource_id))
    if not resource:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resource not found",
        )

    changed = False
    if payload.title is not None:
        resource.title = payload.title.strip()
        changed = True
    if payload.description is not None:
        resource.description = payload.description.strip() if payload.description else None
        changed = True
    if payload.category is not None:
        resource.category = payload.category
        changed = True
    if payload.resource_type is not None:
        resource.resource_type = payload.resource_type
        changed = True
    if payload.url is not None:
        resource.url = payload.url.strip()
        changed = True

    if not changed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No fields provided to update",
        )

    resource.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(resource)
    return resource


@router.delete("/{resource_id}", status_code=status.HTTP_200_OK)
def delete_resource(
    resource_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Delete a resource (FR-RES-2).
    Restricted to administrators only.
    """
    resource = db.scalar(select(Resource).where(Resource.id == resource_id))
    if not resource:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resource not found",
        )

    db.delete(resource)
    db.commit()
    return {"message": "Resource deleted successfully"}

