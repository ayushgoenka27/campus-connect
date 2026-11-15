from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator

VALID_RESOURCE_CATEGORIES = {
    "syllabus",
    "question_paper",
    "lab_manual",
    "handbook",
    "portal",
    "study_material",
    "general",
}

VALID_RESOURCE_TYPES = {
    "external_link",
    "official_doc",
    "drive_link",
    "library_portal",
}


class CreatorBrief(BaseModel):
    id: int
    full_name: str
    username: str

    model_config = ConfigDict(from_attributes=True)


class ResourceBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    category: str = Field("general", max_length=50)
    resource_type: str = Field("external_link", max_length=30)
    url: str = Field(..., max_length=500)

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Resource title cannot be empty or blank")
        return s

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        s = v.strip().lower()
        if s not in VALID_RESOURCE_CATEGORIES:
            raise ValueError(f"Category must be one of {sorted(VALID_RESOURCE_CATEGORIES)}")
        return s

    @field_validator("resource_type")
    @classmethod
    def validate_resource_type(cls, v: str) -> str:
        s = v.strip().lower()
        if s not in VALID_RESOURCE_TYPES:
            raise ValueError(f"Resource type must be one of {sorted(VALID_RESOURCE_TYPES)}")
        return s

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        s = v.strip()
        if not (s.startswith("http://") or s.startswith("https://")):
            raise ValueError("Resource URL must start with http:// or https://")
        return s


class ResourceCreate(ResourceBase):
    pass


class ResourceUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    category: Optional[str] = Field(None, max_length=50)
    resource_type: Optional[str] = Field(None, max_length=30)
    url: Optional[str] = Field(None, max_length=500)

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            s = v.strip()
            if not s:
                raise ValueError("Resource title cannot be empty or blank")
            return s
        return v

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            s = v.strip().lower()
            if s not in VALID_RESOURCE_CATEGORIES:
                raise ValueError(f"Category must be one of {sorted(VALID_RESOURCE_CATEGORIES)}")
            return s
        return v

    @field_validator("resource_type")
    @classmethod
    def validate_resource_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            s = v.strip().lower()
            if s not in VALID_RESOURCE_TYPES:
                raise ValueError(f"Resource type must be one of {sorted(VALID_RESOURCE_TYPES)}")
            return s
        return v

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            s = v.strip()
            if not (s.startswith("http://") or s.startswith("https://")):
                raise ValueError("Resource URL must start with http:// or https://")
            return s
        return v


class ResourceResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    category: str
    resource_type: str
    url: str
    created_by_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    created_by: Optional[CreatorBrief] = None

    model_config = ConfigDict(from_attributes=True)


class ResourceList(BaseModel):
    items: list[ResourceResponse]
    total: int

