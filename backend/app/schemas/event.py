from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

VALID_EVENT_CATEGORIES = {
    "workshop",
    "hackathon",
    "seminar",
    "cultural",
    "sports",
    "academic",
    "general",
}

VALID_RSVP_STATUSES = {"attending", "interested"}


class CreatorBrief(BaseModel):
    id: int
    full_name: str
    username: str

    model_config = ConfigDict(from_attributes=True)


class EventBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=1, max_length=5000)
    category: str = Field("general", max_length=50)
    start_date: datetime
    end_date: Optional[datetime] = None
    location: str = Field(..., min_length=1, max_length=255)
    registration_url: Optional[str] = Field(None, max_length=500)
    capacity: Optional[int] = Field(None, ge=1)

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Event title cannot be blank")
        return s

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Event description cannot be blank")
        return s

    @field_validator("location")
    @classmethod
    def validate_location(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Event location cannot be blank")
        return s

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        s = v.strip().lower()
        if s not in VALID_EVENT_CATEGORIES:
            raise ValueError(f"Category must be one of {sorted(VALID_EVENT_CATEGORIES)}")
        return s

    @field_validator("registration_url")
    @classmethod
    def validate_url(cls, v: Optional[str]) -> Optional[str]:
        if v:
            s = v.strip()
            if not (s.startswith("http://") or s.startswith("https://")):
                raise ValueError("Registration URL must start with http:// or https://")
            return s
        return v

    @model_validator(mode="after")
    def validate_dates(self):
        if self.end_date and self.start_date and self.end_date < self.start_date:
            raise ValueError("End date cannot be earlier than start date")
        return self


class EventCreate(EventBase):
    pass


class EventUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, min_length=1, max_length=5000)
    category: Optional[str] = Field(None, max_length=50)
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    location: Optional[str] = Field(None, min_length=1, max_length=255)
    registration_url: Optional[str] = Field(None, max_length=500)
    capacity: Optional[int] = Field(None, ge=1)

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            s = v.strip()
            if not s:
                raise ValueError("Event title cannot be blank")
            return s
        return v

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            s = v.strip().lower()
            if s not in VALID_EVENT_CATEGORIES:
                raise ValueError(f"Category must be one of {sorted(VALID_EVENT_CATEGORIES)}")
            return s
        return v

    @field_validator("registration_url")
    @classmethod
    def validate_url(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            s = v.strip()
            if not (s.startswith("http://") or s.startswith("https://")):
                raise ValueError("Registration URL must start with http:// or https://")
            return s
        return v

    @model_validator(mode="after")
    def validate_dates(self):
        if self.end_date and self.start_date and self.end_date < self.start_date:
            raise ValueError("End date cannot be earlier than start date")
        return self


class RSVPRequest(BaseModel):
    status: str = Field("attending", max_length=20)

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        s = v.strip().lower()
        if s not in VALID_RSVP_STATUSES:
            raise ValueError(f"Status must be one of {sorted(VALID_RSVP_STATUSES)}")
        return s


class RSVPResponse(BaseModel):
    is_rsvped: bool
    rsvp_status: Optional[str] = None
    attendee_count: int


class EventResponse(BaseModel):
    id: int
    title: str
    description: str
    category: str
    start_date: datetime
    end_date: Optional[datetime] = None
    location: str
    registration_url: Optional[str] = None
    capacity: Optional[int] = None
    created_by_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    attendee_count: int = 0
    is_rsvped: bool = False
    my_rsvp_status: Optional[str] = None
    created_by: Optional[CreatorBrief] = None

    model_config = ConfigDict(from_attributes=True)


class EventList(BaseModel):
    items: list[EventResponse]
    total: int

