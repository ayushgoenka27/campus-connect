from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Participant info for conversation responses
# ---------------------------------------------------------------------------
class ConversationParticipant(BaseModel):
    id: int
    full_name: str
    username: str
    profile_image: Optional[str] = None
    course: Optional[str] = None
    branch: Optional[str] = None
    year: Optional[int] = None
    is_online: bool = False

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Message schemas
# ---------------------------------------------------------------------------
class MessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000, description="Message text")
    client_msg_id: Optional[str] = Field(None, max_length=64, description="Client-generated unique ID for idempotency")

    @field_validator("content")
    @classmethod
    def validate_content_not_empty(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Message content cannot be blank")
        return s


class MessageResponse(BaseModel):
    id: int
    conversation_id: int
    sender_id: int
    recipient_id: int
    content: str
    status: str  # 'sent', 'delivered', 'read'
    is_read: bool
    read_at: Optional[datetime] = None
    created_at: datetime
    client_msg_id: Optional[str] = None

    model_config = {"from_attributes": True}


class MessageList(BaseModel):
    total: int
    items: List[MessageResponse]
    has_more: bool = False


# ---------------------------------------------------------------------------
# Conversation schemas
# ---------------------------------------------------------------------------
class ConversationCreate(BaseModel):
    recipient_id: int = Field(..., description="ID of student to message (must be an accepted connection)")


class ConversationResponse(BaseModel):
    id: int
    peer: ConversationParticipant
    last_message: Optional[MessageResponse] = None
    unread_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ConversationList(BaseModel):
    total: int
    items: List[ConversationResponse]


# ---------------------------------------------------------------------------
# Read receipt response
# ---------------------------------------------------------------------------
class MarkReadResponse(BaseModel):
    conversation_id: int
    marked_count: int
    read_at: datetime
