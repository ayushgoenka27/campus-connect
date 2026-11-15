from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.core.websocket import manager
from app.db.dependencies import get_db
from app.models.connection import Connection
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.user import User
from app.schemas.message import (
    ConversationCreate,
    ConversationList,
    ConversationParticipant,
    ConversationResponse,
    MarkReadResponse,
    MessageCreate,
    MessageList,
    MessageResponse,
)

router = APIRouter(prefix="/conversations", tags=["Messaging"])


def _check_accepted_connection(db: Session, user1_id: int, user2_id: int) -> bool:
    """
    SRS FR-MSG-1: Users can only message accepted connections.
    """
    conn = db.scalar(
        select(Connection).where(
            or_(
                and_(Connection.sender_id == user1_id, Connection.receiver_id == user2_id),
                and_(Connection.sender_id == user2_id, Connection.receiver_id == user1_id),
            ),
            Connection.status == "accepted",
        )
    )
    return conn is not None


def _serialize_participant(user: User) -> ConversationParticipant:
    return ConversationParticipant(
        id=user.id,
        full_name=user.full_name,
        username=user.username,
        profile_image=user.profile_image,
        course=user.course,
        branch=user.branch,
        year=user.year,
        is_online=manager.is_online(user.id),
    )


def _serialize_message(msg: Message, client_msg_id: Optional[str] = None) -> MessageResponse:
    effective_client_id = getattr(msg, "client_msg_id", None) or client_msg_id
    return MessageResponse(
        id=msg.id,
        conversation_id=msg.conversation_id,
        sender_id=msg.sender_id,
        recipient_id=msg.recipient_id,
        content=msg.content,
        status=msg.status,
        is_read=msg.is_read,
        read_at=msg.read_at,
        created_at=msg.created_at,
        client_msg_id=effective_client_id,
    )


def _serialize_conversation(conv: Conversation, current_user_id: int, db: Session) -> ConversationResponse:
    peer = conv.user2 if conv.user1_id == current_user_id else conv.user1

    # Unread count for current user
    unread_count = db.scalar(
        select(func.count(Message.id)).where(
            Message.conversation_id == conv.id,
            Message.recipient_id == current_user_id,
            Message.is_read.is_(False),
        )
    ) or 0

    # Last message
    last_msg = db.scalar(
        select(Message)
        .where(Message.conversation_id == conv.id)
        .order_by(desc(Message.created_at))
        .limit(1)
    )

    return ConversationResponse(
        id=conv.id,
        peer=_serialize_participant(peer),
        last_message=_serialize_message(last_msg) if last_msg else None,
        unread_count=unread_count,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
    )


# ---------------------------------------------------------------------------
# GET /conversations — list conversations for current user
# ---------------------------------------------------------------------------
@router.get("", response_model=ConversationList)
def list_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = (
        select(Conversation)
        .where(
            or_(
                Conversation.user1_id == current_user.id,
                Conversation.user2_id == current_user.id,
            )
        )
        .order_by(desc(Conversation.last_message_at))
    )
    convs = db.scalars(q).all()
    items = [_serialize_conversation(c, current_user.id, db) for c in convs]
    return ConversationList(total=len(items), items=items)


# ---------------------------------------------------------------------------
# POST /conversations — start or retrieve a DM with a connected user
# ---------------------------------------------------------------------------
@router.post("", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
def start_conversation(
    payload: ConversationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.recipient_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot start a conversation with yourself",
        )

    recipient = db.scalar(select(User).where(User.id == payload.recipient_id))
    if not recipient or not recipient.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found or account is inactive",
        )

    # Check connection requirement (FR-MSG-1)
    if not _check_accepted_connection(db, current_user.id, payload.recipient_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only message accepted connections",
        )

    # Canonical order for user pair
    u1, u2 = sorted([current_user.id, payload.recipient_id])

    conv = db.scalar(
        select(Conversation).where(
            Conversation.user1_id == u1,
            Conversation.user2_id == u2,
        )
    )

    if not conv:
        now = datetime.utcnow()
        conv = Conversation(
            user1_id=u1,
            user2_id=u2,
            last_message_at=now,
            created_at=now,
            updated_at=now,
        )
        db.add(conv)
        db.commit()
        db.refresh(conv)

    return _serialize_conversation(conv, current_user.id, db)


# ---------------------------------------------------------------------------
# GET /conversations/{conversation_id} — get conversation details
# ---------------------------------------------------------------------------
@router.get("/{conversation_id}", response_model=ConversationResponse)
def get_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conv = db.scalar(select(Conversation).where(Conversation.id == conversation_id))
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )

    if current_user.id not in (conv.user1_id, conv.user2_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a participant in this conversation",
        )

    return _serialize_conversation(conv, current_user.id, db)


# ---------------------------------------------------------------------------
# GET /conversations/{conversation_id}/messages — paginated message history
# ---------------------------------------------------------------------------
@router.get("/{conversation_id}/messages", response_model=MessageList)
def get_messages(
    conversation_id: int,
    before_id: Optional[int] = Query(None, description="Fetch messages older than this message ID"),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conv = db.scalar(select(Conversation).where(Conversation.id == conversation_id))
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )

    if current_user.id not in (conv.user1_id, conv.user2_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a participant in this conversation",
        )

    q = select(Message).where(Message.conversation_id == conversation_id)
    if before_id:
        q = q.where(Message.id < before_id)

    total = db.scalar(
        select(func.count(Message.id)).where(Message.conversation_id == conversation_id)
    ) or 0

    # Retrieve descending to get the newest before before_id, then reverse for display
    messages = db.scalars(
        q.order_by(desc(Message.created_at), desc(Message.id)).limit(limit + 1)
    ).all()

    has_more = len(messages) > limit
    returned_messages = messages[:limit]
    returned_messages.reverse()  # Return in chronological order (oldest to newest)

    return MessageList(
        total=total,
        items=[_serialize_message(m) for m in returned_messages],
        has_more=has_more,
    )


# ---------------------------------------------------------------------------
# POST /conversations/{conversation_id}/messages — send message via REST fallback
# ---------------------------------------------------------------------------
@router.post("/{conversation_id}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def send_message(
    conversation_id: int,
    payload: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conv = db.scalar(select(Conversation).where(Conversation.id == conversation_id))
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )

    if current_user.id not in (conv.user1_id, conv.user2_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a participant in this conversation",
        )

    recipient_id = conv.user2_id if conv.user1_id == current_user.id else conv.user1_id

    # Verify connection is still active (FR-MSG-1)
    if not _check_accepted_connection(db, current_user.id, recipient_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only message accepted connections",
        )

    # Idempotency check: if client_msg_id is provided, check for existing message
    if payload.client_msg_id:
        existing = db.scalar(
            select(Message).where(
                Message.conversation_id == conversation_id,
                Message.sender_id == current_user.id,
                Message.client_msg_id == payload.client_msg_id,
            )
        )
        if existing:
            return _serialize_message(existing)

    is_recipient_online = manager.is_online(recipient_id)
    msg_status = "delivered" if is_recipient_online else "sent"
    now = datetime.utcnow()

    message = Message(
        conversation_id=conversation_id,
        sender_id=current_user.id,
        recipient_id=recipient_id,
        content=payload.content,
        client_msg_id=payload.client_msg_id,
        status=msg_status,
        is_read=False,
        created_at=now,
    )
    db.add(message)

    # Update conversation last_message_at
    conv.last_message_at = now
    conv.updated_at = now

    try:
        db.commit()
        db.refresh(message)
    except IntegrityError:
        db.rollback()
        if payload.client_msg_id:
            existing = db.scalar(
                select(Message).where(
                    Message.conversation_id == conversation_id,
                    Message.sender_id == current_user.id,
                    Message.client_msg_id == payload.client_msg_id,
                )
            )
            if existing:
                return _serialize_message(existing)
        raise

    serialized = _serialize_message(message)

    # Dispatch via WebSocket to recipient if online
    if is_recipient_online:
        await manager.send_to_user(
            recipient_id,
            {
                "type": "new_message",
                "message": serialized.model_dump(mode="json"),
            },
        )

    # Also dispatch to sender's other tabs
    await manager.send_to_user(
        current_user.id,
        {
            "type": "new_message",
            "message": serialized.model_dump(mode="json"),
        },
    )

    return serialized


# ---------------------------------------------------------------------------
# PATCH /conversations/{conversation_id}/read — mark all incoming messages as read
# ---------------------------------------------------------------------------
@router.patch("/{conversation_id}/read", response_model=MarkReadResponse)
async def mark_conversation_as_read(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conv = db.scalar(select(Conversation).where(Conversation.id == conversation_id))
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )

    if current_user.id not in (conv.user1_id, conv.user2_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a participant in this conversation",
        )

    now = datetime.utcnow()
    unread_messages = db.scalars(
        select(Message).where(
            Message.conversation_id == conversation_id,
            Message.recipient_id == current_user.id,
            Message.is_read.is_(False),
        )
    ).all()

    marked_count = len(unread_messages)
    for m in unread_messages:
        m.is_read = True
        m.status = "read"
        m.read_at = now

    if marked_count > 0:
        db.commit()

        # Notify the sender via WebSocket of the read receipt
        other_user_id = conv.user2_id if conv.user1_id == current_user.id else conv.user1_id
        await manager.send_to_user(
            other_user_id,
            {
                "type": "read_receipt",
                "conversation_id": conversation_id,
                "reader_id": current_user.id,
                "read_at": now.isoformat(),
            },
        )

    return MarkReadResponse(
        conversation_id=conversation_id,
        marked_count=marked_count,
        read_at=now,
    )

