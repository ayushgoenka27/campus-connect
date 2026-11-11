from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user_id
from app.db.dependencies import get_db
from app.models.connection import Connection
from app.models.user import User


router = APIRouter(
    prefix="/connections",
    tags=["Connections"],
)


# Send a connection request
@router.post("/{user_id}", status_code=status.HTTP_201_CREATED)
def send_connection_request(
    user_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    if user_id == current_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot connect with yourself",
        )

    receiver = db.scalar(
        select(User).where(
            User.id == user_id,
            User.is_active == True,
        )
    )

    if not receiver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    existing_connection = db.scalar(
        select(Connection).where(
            or_(
                (Connection.sender_id == current_user_id)
                & (Connection.receiver_id == user_id),
                (Connection.sender_id == user_id)
                & (Connection.receiver_id == current_user_id),
            )
        )
    )

    if existing_connection:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A connection already exists between these users",
        )

    connection = Connection(
        sender_id=current_user_id,
        receiver_id=user_id,
        status="pending",
    )

    db.add(connection)
    db.commit()
    db.refresh(connection)

    return {
        "message": "Connection request sent successfully",
        "connection": {
            "id": connection.id,
            "sender_id": connection.sender_id,
            "receiver_id": connection.receiver_id,
            "status": connection.status,
            "created_at": connection.created_at,
        },
    }


# Get the user's connections and requests
@router.get("")
def get_connections(
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    connections = db.scalars(
        select(Connection).where(
            or_(
                Connection.sender_id == current_user_id,
                Connection.receiver_id == current_user_id,
            )
        ).order_by(Connection.created_at.desc())
    ).all()

    return [
        {
            "id": connection.id,
            "sender_id": connection.sender_id,
            "receiver_id": connection.receiver_id,
            "status": connection.status,
            "created_at": connection.created_at,
            "updated_at": connection.updated_at,
        }
        for connection in connections
    ]


# Accept or reject a connection request
@router.patch("/{connection_id}")
def update_connection(
    connection_id: int,
    action: str,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    connection = db.scalar(
        select(Connection).where(
            Connection.id == connection_id
        )
    )

    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connection request not found",
        )

    # Only the receiver can accept or reject the request
    if connection.receiver_id != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only manage requests sent to you",
        )

    if connection.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Connection request is no longer pending",
        )

    if action not in ["accepted", "rejected"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Action must be 'accepted' or 'rejected'",
        )

    connection.status = action

    db.commit()
    db.refresh(connection)

    return {
        "message": f"Connection request {action}",
        "connection": {
            "id": connection.id,
            "sender_id": connection.sender_id,
            "receiver_id": connection.receiver_id,
            "status": connection.status,
            "updated_at": connection.updated_at,
        },
    }
@router.get("/accepted")
def get_accepted_connections(
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    connections = db.scalars(
        select(Connection).where(
            Connection.status == "accepted",
            or_(
                Connection.sender_id == current_user_id,
                Connection.receiver_id == current_user_id,
            ),
        )
    ).all()

    result = []

    for connection in connections:
        other_user_id = (
            connection.receiver_id
            if connection.sender_id == current_user_id
            else connection.sender_id
        )

        user = db.scalar(
            select(User).where(User.id == other_user_id)
        )

        if user:
            result.append(
                {
                    "connection_id": connection.id,
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
                    },
                }
            )

    return result
@router.get("/requests")
def get_connection_requests(
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    connections = db.scalars(
        select(Connection).where(
            Connection.receiver_id == current_user_id,
            Connection.status == "pending",
        ).order_by(Connection.created_at.desc())
    ).all()

    result = []

    for connection in connections:
        sender = db.scalar(
            select(User).where(User.id == connection.sender_id)
        )

        if sender:
            result.append(
                {
                    "connection_id": connection.id,
                    "user": {
                        "id": sender.id,
                        "full_name": sender.full_name,
                        "username": sender.username,
                        "email": sender.email,
                        "role": sender.role,
                        "bio": sender.bio,
                        "profile_image": sender.profile_image,
                        "course": sender.course,
                        "branch": sender.branch,
                        "year": sender.year,
                    },
                    "status": connection.status,
                    "created_at": connection.created_at,
                }
            )

    return result
@router.get("/sent")
def get_sent_requests(
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    connections = db.scalars(
        select(Connection).where(
            Connection.sender_id == current_user_id,
            Connection.status == "pending",
        ).order_by(Connection.created_at.desc())
    ).all()

    result = []

    for connection in connections:
        receiver = db.scalar(
            select(User).where(User.id == connection.receiver_id)
        )

        if receiver:
            result.append(
                {
                    "connection_id": connection.id,
                    "user": {
                        "id": receiver.id,
                        "full_name": receiver.full_name,
                        "username": receiver.username,
                        "email": receiver.email,
                        "role": receiver.role,
                        "bio": receiver.bio,
                        "profile_image": receiver.profile_image,
                        "course": receiver.course,
                        "branch": receiver.branch,
                        "year": receiver.year,
                    },
                    "status": connection.status,
                    "created_at": connection.created_at,
                }
            )

    return result
@router.delete("/{connection_id}")
def delete_connection(
    connection_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    connection = db.scalar(
        select(Connection).where(
            Connection.id == connection_id,
            or_(
                Connection.sender_id == current_user_id,
                Connection.receiver_id == current_user_id,
            ),
        )
    )

    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connection not found",
        )

    db.delete(connection)
    db.commit()

    return {
        "message": "Connection removed successfully",
    }