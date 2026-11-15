from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_admin, get_current_user
from app.db.dependencies import get_db
from app.models.event import Event, EventRSVP
from app.models.user import User
from app.schemas.event import (
    EventCreate,
    EventList,
    EventResponse,
    EventUpdate,
    RSVPRequest,
    RSVPResponse,
    VALID_EVENT_CATEGORIES,
)

router = APIRouter(
    prefix="/events",
    tags=["Events"],
)


def _serialize_event_dict(event: Event, attendee_count: int, my_rsvp: Optional[EventRSVP]) -> dict:
    return {
        "id": event.id,
        "title": event.title,
        "description": event.description,
        "category": event.category,
        "start_date": event.start_date,
        "end_date": event.end_date,
        "location": event.location,
        "registration_url": event.registration_url,
        "capacity": event.capacity,
        "created_by_id": event.created_by_id,
        "created_at": event.created_at,
        "updated_at": event.updated_at,
        "attendee_count": attendee_count,
        "is_rsvped": my_rsvp is not None,
        "my_rsvp_status": my_rsvp.status if my_rsvp else None,
        "created_by": {
            "id": event.created_by.id,
            "full_name": event.created_by.full_name,
            "username": event.created_by.username,
        } if event.created_by else None,
    }


@router.get("", response_model=EventList)
def list_events(
    time_filter: Optional[str] = Query(None, description="'upcoming' or 'past'"),
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List campus events with filtering and RSVP status for current user (FR-EVT-1).
    """
    query = select(Event)
    now = datetime.utcnow()

    if time_filter:
        tf = time_filter.strip().lower()
        if tf == "upcoming":
            query = query.where(Event.start_date >= now)
        elif tf == "past":
            query = query.where(Event.start_date < now)
        else:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="time_filter must be 'upcoming' or 'past'",
            )

    if category:
        cat_lower = category.strip().lower()
        if cat_lower not in VALID_EVENT_CATEGORIES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid category. Valid categories: {sorted(VALID_EVENT_CATEGORIES)}",
            )
        query = query.where(Event.category == cat_lower)

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.where(
            Event.title.ilike(term)
            | Event.description.ilike(term)
            | Event.location.ilike(term)
        )

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0

    # Order upcoming events by start_date asc, past events by start_date desc
    if time_filter and time_filter.strip().lower() == "upcoming":
        query = query.order_by(Event.start_date.asc())
    else:
        query = query.order_by(Event.start_date.desc())

    events = db.scalars(query.offset(skip).limit(limit)).unique().all()
    event_ids = [e.id for e in events]

    attendee_counts = {}
    user_rsvps = {}
    if event_ids:
        # Count attendees per event
        counts = db.execute(
            select(EventRSVP.event_id, func.count(EventRSVP.id))
            .where(EventRSVP.event_id.in_(event_ids))
            .group_by(EventRSVP.event_id)
        ).all()
        attendee_counts = {r[0]: r[1] for r in counts}

        # User's RSVPs
        rsvps = db.scalars(
            select(EventRSVP).where(
                EventRSVP.event_id.in_(event_ids),
                EventRSVP.user_id == current_user.id,
            )
        ).all()
        user_rsvps = {r.event_id: r for r in rsvps}

    items = [
        _serialize_event_dict(
            e,
            attendee_counts.get(e.id, 0),
            user_rsvps.get(e.id),
        )
        for e in events
    ]

    return {"items": items, "total": total}


@router.get("/{event_id}", response_model=EventResponse)
def get_event(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get detailed view of a campus event (FR-EVT-1).
    """
    event = db.scalar(select(Event).where(Event.id == event_id))
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    attendee_count = db.scalar(
        select(func.count(EventRSVP.id)).where(EventRSVP.event_id == event_id)
    ) or 0

    my_rsvp = db.scalar(
        select(EventRSVP).where(
            EventRSVP.event_id == event_id,
            EventRSVP.user_id == current_user.id,
        )
    )

    return _serialize_event_dict(event, attendee_count, my_rsvp)


@router.post("", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
def create_event(
    payload: EventCreate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Create a campus event (FR-EVT-3). Restricted to administrators.
    """
    event = Event(
        title=payload.title.strip(),
        description=payload.description.strip(),
        category=payload.category,
        start_date=payload.start_date,
        end_date=payload.end_date,
        location=payload.location.strip(),
        registration_url=payload.registration_url.strip() if payload.registration_url else None,
        capacity=payload.capacity,
        created_by_id=current_admin.id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return _serialize_event_dict(event, 0, None)


@router.patch("/{event_id}", response_model=EventResponse)
def update_event(
    event_id: int,
    payload: EventUpdate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Update a campus event (FR-EVT-3). Restricted to administrators.
    """
    event = db.scalar(select(Event).where(Event.id == event_id))
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    changed = False
    if payload.title is not None:
        event.title = payload.title.strip()
        changed = True
    if payload.description is not None:
        event.description = payload.description.strip()
        changed = True
    if payload.category is not None:
        event.category = payload.category
        changed = True
    if payload.start_date is not None:
        event.start_date = payload.start_date
        changed = True
    if payload.end_date is not None:
        event.end_date = payload.end_date
        changed = True
    if payload.location is not None:
        event.location = payload.location.strip()
        changed = True
    if payload.registration_url is not None:
        event.registration_url = payload.registration_url.strip() if payload.registration_url else None
        changed = True
    if payload.capacity is not None:
        event.capacity = payload.capacity
        changed = True

    if not changed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No fields provided to update",
        )

    if event.end_date and event.start_date and event.end_date < event.start_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="End date cannot be earlier than start date",
        )

    event.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(event)

    attendee_count = db.scalar(
        select(func.count(EventRSVP.id)).where(EventRSVP.event_id == event_id)
    ) or 0
    my_rsvp = db.scalar(
        select(EventRSVP).where(
            EventRSVP.event_id == event_id,
            EventRSVP.user_id == current_admin.id,
        )
    )

    return _serialize_event_dict(event, attendee_count, my_rsvp)


@router.delete("/{event_id}", status_code=status.HTTP_200_OK)
def delete_event(
    event_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Delete a campus event (FR-EVT-3). Restricted to administrators.
    """
    event = db.scalar(select(Event).where(Event.id == event_id))
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    db.delete(event)
    db.commit()
    return {"message": "Event deleted successfully"}


@router.post("/{event_id}/rsvp", response_model=RSVPResponse)
def rsvp_event(
    event_id: int,
    payload: Optional[RSVPRequest] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    RSVP / register attendance for an event (FR-EVT-2).
    Idempotent: updating an existing RSVP updates the status.
    Protected by database-level unique constraint uq_event_rsvps_event_user.
    Guards against registering for past events or exceeding capacity.
    """
    event = db.scalar(select(Event).where(Event.id == event_id))
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    # Guard: prevent RSVP for past events
    now = datetime.utcnow()
    cutoff = event.end_date if event.end_date else event.start_date
    if cutoff < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot RSVP to an event that has already ended",
        )

    status_val = payload.status if payload else "attending"

    existing_rsvp = db.scalar(
        select(EventRSVP).where(
            EventRSVP.event_id == event_id,
            EventRSVP.user_id == current_user.id,
        )
    )

    if existing_rsvp:
        existing_rsvp.status = status_val
        db.commit()
    else:
        # Check capacity
        if event.capacity:
            current_count = db.scalar(
                select(func.count(EventRSVP.id)).where(EventRSVP.event_id == event_id)
            ) or 0
            if current_count >= event.capacity:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Event capacity has been reached",
                )

        new_rsvp = EventRSVP(
            event_id=event_id,
            user_id=current_user.id,
            status=status_val,
            created_at=datetime.utcnow(),
        )
        db.add(new_rsvp)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            # If concurrent race hit unique constraint, fetch and update
            existing = db.scalar(
                select(EventRSVP).where(
                    EventRSVP.event_id == event_id,
                    EventRSVP.user_id == current_user.id,
                )
            )
            if existing:
                existing.status = status_val
                db.commit()

    attendee_count = db.scalar(
        select(func.count(EventRSVP.id)).where(EventRSVP.event_id == event_id)
    ) or 0

    return {
        "is_rsvped": True,
        "rsvp_status": status_val,
        "attendee_count": attendee_count,
    }


@router.delete("/{event_id}/rsvp", response_model=RSVPResponse)
def cancel_rsvp(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Cancel an RSVP for an event (FR-EVT-2).
    """
    event = db.scalar(select(Event).where(Event.id == event_id))
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    existing_rsvp = db.scalar(
        select(EventRSVP).where(
            EventRSVP.event_id == event_id,
            EventRSVP.user_id == current_user.id,
        )
    )

    if existing_rsvp:
        db.delete(existing_rsvp)
        db.commit()

    attendee_count = db.scalar(
        select(func.count(EventRSVP.id)).where(EventRSVP.event_id == event_id)
    ) or 0

    return {
        "is_rsvped": False,
        "rsvp_status": None,
        "attendee_count": attendee_count,
    }

