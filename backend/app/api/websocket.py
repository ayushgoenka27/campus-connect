import json
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect, status
import jwt
from sqlalchemy import and_, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.websocket import manager
from app.db.dependencies import get_db
from app.models.connection import Connection
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.user import User

logger = logging.getLogger("campus_connect.websocket")

router = APIRouter(tags=["WebSocket"])


def _authenticate_ws(token: Optional[str], db: Session) -> Optional[tuple[int, int]]:
    """
    Validates JWT token for WebSocket connection (TD-012, FR-MSG-1, FR-SET-1).
    Returns (user_id, token_tv) if valid, active, and token_version exactly matches, else None.
    """
    if not token:
        return None

    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        sub = payload.get("sub")
        if not sub:
            return None
        user_id = int(sub)
    except Exception as e:
        logger.warning(f"WebSocket auth failed: {type(e).__name__}")
        return None

    user = db.scalar(select(User).where(User.id == user_id))
    if not user or not user.is_active:
        return None

    # Check exact token_version match for session invalidation (FR-SET-1)
    token_tv = payload.get("tv")
    if token_tv is None or token_tv != getattr(user, "token_version", 1):
        logger.warning(f"WebSocket auth failed: token version {token_tv} mismatched for user {user_id}")
        return None

    return user_id, token_tv


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Real-time bidirectional WebSocket gateway (FR-MSG-1 through FR-MSG-5).
    Secured by JWT query parameter '?token=<jwt>'.
    """
    auth_result = _authenticate_ws(token, db)
    if not auth_result:
        # Refuse connection with 1008 Policy Violation
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    user_id, token_tv = auth_result
    await manager.connect(user_id, websocket)

    # Send initial welcome state with online users list
    try:
        await websocket.send_text(
            json.dumps(
                {
                    "type": "connected",
                    "user_id": user_id,
                    "online_users": list(manager.get_online_user_ids()),
                }
            )
        )
    except Exception:
        manager.disconnect(user_id, websocket)
        return

    try:
        while True:
            raw_text = await websocket.receive_text()
            try:
                data = json.loads(raw_text)
            except json.JSONDecodeError:
                continue

            msg_type = data.get("type")

            # Verify user remains active (FR-ADM-3) and token_version has not changed (FR-SET-1)
            current_user = db.scalar(select(User).where(User.id == user_id))
            if (
                not current_user
                or not current_user.is_active
                or token_tv != getattr(current_user, "token_version", 1)
            ):
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                return

            # 1. Heartbeat
            if msg_type == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
                continue

            # 2. Chat message
            elif msg_type == "chat_message":
                conv_id = data.get("conversation_id")
                content = (data.get("content") or "").strip()
                client_msg_id = data.get("client_msg_id")

                if not conv_id or not content:
                    await websocket.send_text(
                        json.dumps({"type": "error", "detail": "Invalid message payload"})
                    )
                    continue

                if len(content) > 5000:
                    await websocket.send_text(
                        json.dumps({"type": "error", "detail": "Message exceeds maximum length (5000 chars)"})
                    )
                    continue

                conv = db.scalar(select(Conversation).where(Conversation.id == conv_id))
                if not conv or user_id not in (conv.user1_id, conv.user2_id):
                    await websocket.send_text(
                        json.dumps({"type": "error", "detail": "Conversation not found or unauthorized"})
                    )
                    continue

                # Idempotency check: if client_msg_id already exists in this conversation from this sender
                if client_msg_id:
                    existing = db.scalar(
                        select(Message).where(
                            Message.conversation_id == conv_id,
                            Message.sender_id == user_id,
                            Message.client_msg_id == client_msg_id,
                        )
                    )
                    if existing:
                        serialized_existing = {
                            "id": existing.id,
                            "conversation_id": existing.conversation_id,
                            "sender_id": existing.sender_id,
                            "recipient_id": existing.recipient_id,
                            "content": existing.content,
                            "status": existing.status,
                            "is_read": existing.is_read,
                            "read_at": existing.read_at.isoformat() if existing.read_at else None,
                            "created_at": existing.created_at.isoformat(),
                            "client_msg_id": existing.client_msg_id,
                        }
                        await websocket.send_text(
                            json.dumps({"type": "new_message", "message": serialized_existing})
                        )
                        continue

                recipient_id = conv.user2_id if conv.user1_id == user_id else conv.user1_id

                # Check connection requirement (FR-MSG-1)
                conn = db.scalar(
                    select(Connection).where(
                        or_(
                            and_(Connection.sender_id == user_id, Connection.receiver_id == recipient_id),
                            and_(Connection.sender_id == recipient_id, Connection.receiver_id == user_id),
                        ),
                        Connection.status == "accepted",
                    )
                )
                if not conn:
                    await websocket.send_text(
                        json.dumps({"type": "error", "detail": "You can only message accepted connections"})
                    )
                    continue

                is_recip_online = manager.is_online(recipient_id)
                now = datetime.utcnow()
                msg_status = "delivered" if is_recip_online else "sent"

                msg = Message(
                    conversation_id=conv_id,
                    sender_id=user_id,
                    recipient_id=recipient_id,
                    content=content,
                    client_msg_id=client_msg_id,
                    status=msg_status,
                    is_read=False,
                    created_at=now,
                )
                db.add(msg)
                conv.last_message_at = now
                conv.updated_at = now

                try:
                    db.commit()
                    db.refresh(msg)
                except IntegrityError:
                    db.rollback()
                    if client_msg_id:
                        existing = db.scalar(
                            select(Message).where(
                                Message.conversation_id == conv_id,
                                Message.sender_id == user_id,
                                Message.client_msg_id == client_msg_id,
                            )
                        )
                        if existing:
                            serialized_existing = {
                                "id": existing.id,
                                "conversation_id": existing.conversation_id,
                                "sender_id": existing.sender_id,
                                "recipient_id": existing.recipient_id,
                                "content": existing.content,
                                "status": existing.status,
                                "is_read": existing.is_read,
                                "read_at": existing.read_at.isoformat() if existing.read_at else None,
                                "created_at": existing.created_at.isoformat(),
                                "client_msg_id": existing.client_msg_id,
                            }
                            await websocket.send_text(
                                json.dumps({"type": "new_message", "message": serialized_existing})
                            )
                            continue
                    raise

                serialized = {
                    "id": msg.id,
                    "conversation_id": msg.conversation_id,
                    "sender_id": msg.sender_id,
                    "recipient_id": msg.recipient_id,
                    "content": msg.content,
                    "status": msg.status,
                    "is_read": msg.is_read,
                    "read_at": None,
                    "created_at": msg.created_at.isoformat(),
                    "client_msg_id": client_msg_id,
                }

                # Dispatch to recipient
                if is_recip_online:
                    await manager.send_to_user(
                        recipient_id,
                        {
                            "type": "new_message",
                            "message": serialized,
                        },
                    )

                # Echo back to sender with resolved DB id
                await manager.send_to_user(
                    user_id,
                    {
                        "type": "new_message",
                        "message": serialized,
                    },
                )

            # 3. Mark read
            elif msg_type == "mark_read":
                conv_id = data.get("conversation_id")
                if not conv_id:
                    continue

                conv = db.scalar(select(Conversation).where(Conversation.id == conv_id))
                if not conv or user_id not in (conv.user1_id, conv.user2_id):
                    continue

                now = datetime.utcnow()
                unread = db.scalars(
                    select(Message).where(
                        Message.conversation_id == conv_id,
                        Message.recipient_id == user_id,
                        Message.is_read.is_(False),
                    )
                ).all()

                for m in unread:
                    m.is_read = True
                    m.status = "read"
                    m.read_at = now

                if unread:
                    db.commit()
                    other_id = conv.user2_id if conv.user1_id == user_id else conv.user1_id
                    await manager.send_to_user(
                        other_id,
                        {
                            "type": "read_receipt",
                            "conversation_id": conv_id,
                            "reader_id": user_id,
                            "read_at": now.isoformat(),
                        },
                    )

            # 4. Typing indicator
            elif msg_type == "typing":
                conv_id = data.get("conversation_id")
                if not conv_id:
                    continue

                conv = db.scalar(select(Conversation).where(Conversation.id == conv_id))
                if conv and user_id in (conv.user1_id, conv.user2_id):
                    other_id = conv.user2_id if conv.user1_id == user_id else conv.user1_id
                    await manager.send_to_user(
                        other_id,
                        {
                            "type": "typing",
                            "conversation_id": conv_id,
                            "user_id": user_id,
                        },
                    )

    except WebSocketDisconnect:
        went_offline = manager.disconnect(user_id, websocket)
        if went_offline:
            await manager.broadcast_presence(user_id, False)
    except Exception as e:
        logger.error(f"WebSocket connection error for user {user_id}: {e}")
        went_offline = manager.disconnect(user_id, websocket)
        if went_offline:
            await manager.broadcast_presence(user_id, False)
