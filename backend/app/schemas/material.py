"""
Material Schemas

Pydantic models for material data validation and serialization.
"""

from datetime import datetime
from typing import Optional, List
from enum import Enum

from pydantic import BaseModel, Field, ConfigDict


class MaterialType(str, Enum):
    """Material type enumeration."""
    VIDEO = "video"
    PDF = "pdf"
    PPTX = "pptx"
    DOCX = "docx"
    XLSX = "xlsx"


class MaterialStatus(str, Enum):
    """Material processing status enumeration."""
    ACTIVE = "active"
    PROCESSING = "processing"
    HIDDEN = "hidden"


class MaterialBase(BaseModel):
    """Base material schema with common attributes."""
    model_config = ConfigDict(populate_by_name=True)

    title: str = Field(..., min_length=1, max_length=255, description="Material title")
    description: Optional[str] = Field(None, description="Material description")
    file_type: MaterialType = Field(..., alias="type", serialization_alias="file_type", description="Material type: video, pdf, pptx, docx, or xlsx")


class MaterialCreate(MaterialBase):
    """Schema for creating a new material."""
    pass


class MaterialUpdate(BaseModel):
    """Schema for updating material information."""
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    status: Optional[MaterialStatus] = None


class MaterialInDB(MaterialBase):
    """Schema for material data as stored in database."""
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: int
    file_path: str = Field(..., description="Path to file in MinIO storage")
    file_size: int = Field(..., description="File size in bytes")
    file_format: str = Field(..., description="File format extension (e.g., mp4, pdf)")
    thumbnail_path: Optional[str] = Field(None, description="Path to thumbnail image in MinIO")
    uploader_id: int = Field(..., description="ID of user who uploaded")
    view_count: int = Field(default=0, description="Number of views")
    like_count: int = Field(default=0, description="Number of likes")
    status: MaterialStatus = Field(default=MaterialStatus.PROCESSING)
    created_at: datetime
    updated_at: datetime


class MaterialResponse(MaterialInDB):
    """Schema for material data in API responses."""
    pass


class MaterialWithUploader(MaterialResponse):
    """Schema for material data including uploader information."""
    uploader_name: str = Field(..., description="Name of the uploader")
    uploader_avatar: Optional[str] = Field(None, description="Avatar URL of the uploader")
    is_liked_by_me: bool = Field(default=False, description="Whether current user has liked")


class MaterialListResponse(BaseModel):
    """Schema for paginated material list response."""
    items: List[MaterialWithUploader]
    total: int = Field(..., description="Total number of items")
    page: int = Field(..., description="Current page number")
    page_size: int = Field(..., description="Number of items per page")
    total_pages: int = Field(..., description="Total number of pages")


class MaterialDetailResponse(MaterialWithUploader):
    """Schema for detailed material response."""
    related_materials: List[MaterialResponse] = Field(default=[], description="Related materials")


# Like related schemas
class LikeCreate(BaseModel):
    """Schema for creating a like."""
    material_id: int = Field(..., description="ID of material to like")


class LikeResponse(BaseModel):
    """Schema for like response."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    material_id: int
    user_id: int
    created_at: datetime


# View related schemas
class ViewCreate(BaseModel):
    """Schema for creating a view record."""
    material_id: int = Field(..., description="ID of material being viewed")


class ViewResponse(BaseModel):
    """Schema for view response."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    material_id: int
    user_id: Optional[int]
    ip_address: Optional[str]
    created_at: datetime


# Upload related schemas
class UploadResponse(BaseModel):
    """Schema for file upload response."""
    material_id: int = Field(..., description="ID of created material")
    file_path: str = Field(..., description="Path to uploaded file")
    thumbnail_path: Optional[str] = Field(None, description="Path to generated thumbnail")
    status: MaterialStatus = Field(..., description="Upload processing status")
    message: str = Field(..., description="Status message")


class UploadStatusResponse(BaseModel):
    """Schema for upload status check response."""
    material_id: int
    status: MaterialStatus
    progress: int = Field(..., ge=0, le=100, description="Processing progress percentage")
    message: str
