"""
Material Models

Contains models for course materials, likes, and view records.
"""

from datetime import datetime
from enum import Enum as PyEnum
from typing import TYPE_CHECKING

from sqlalchemy import (
    String, Integer, ForeignKey, DateTime, Index,
    UniqueConstraint, Text, BigInteger, desc
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class MaterialStatus(str, PyEnum):
    """Material processing status enumeration."""
    ACTIVE = "active"
    PROCESSING = "processing"
    HIDDEN = "hidden"


class MaterialType(str, PyEnum):
    """Material type enumeration."""
    VIDEO = "video"
    PDF = "pdf"
    PPTX = "pptx"
    DOCX = "docx"
    XLSX = "xlsx"


class Material(Base):
    """
    Material model for storing course materials (videos, PDFs, etc.).

    Attributes:
        id: Primary key
        title: Material title
        description: Material description
        type: Material type (video, pdf, pptx, docx, xlsx)
        file_path: Path to file in MinIO storage
        file_size: File size in bytes
        file_format: File format extension (e.g., mp4, pdf)
        thumbnail_path: Path to thumbnail image
        uploader_id: Foreign key to user who uploaded
        view_count: Number of views
        like_count: Number of likes
        status: Material status (active/processing/hidden)
        created_at: Creation timestamp
        updated_at: Last update timestamp
    """

    __tablename__ = "materials"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Material title"
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Material description"
    )
    type: Mapped[MaterialType] = mapped_column(
        String(20),
        nullable=False,
        comment="Material type: video, pdf, pptx, docx, or xlsx"
    )
    file_path: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        comment="Path to file in MinIO storage"
    )
    file_size: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        comment="File size in bytes"
    )
    file_format: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="File format extension (e.g., mp4, pdf)"
    )
    thumbnail_path: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="Path to thumbnail image in MinIO"
    )
    uploader_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="Foreign key to user who uploaded"
    )
    view_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        comment="Number of views"
    )
    like_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        comment="Number of likes"
    )
    status: Mapped[MaterialStatus] = mapped_column(
        String(20),
        default=MaterialStatus.PROCESSING,
        nullable=False,
        comment="Material status: active, processing, or hidden"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
        comment="Creation timestamp"
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
        comment="Last update timestamp"
    )

    # Relationships
    uploader: Mapped["User"] = relationship("User", back_populates="materials")
    likes: Mapped[list["Like"]] = relationship(
        "Like",
        back_populates="material",
        cascade="all, delete-orphan"
    )
    views: Mapped[list["View"]] = relationship(
        "View",
        back_populates="material",
        cascade="all, delete-orphan"
    )

    # Table indexes for query optimization
    __table_args__ = (
        Index("idx_materials_uploader", "uploader_id"),
        Index("idx_materials_created", desc("created_at")),
        Index("idx_materials_views", desc("view_count")),
        Index("idx_materials_likes", desc("like_count")),
    )

    def __repr__(self) -> str:
        return f"<Material(id={self.id}, title={self.title}, type={self.type})>"


class Like(Base):
    """
    Like model for tracking user likes on materials.

    Attributes:
        id: Primary key
        material_id: Foreign key to material
        user_id: Foreign key to user who liked
        created_at: Like timestamp
    """

    __tablename__ = "likes"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    material_id: Mapped[int] = mapped_column(
        ForeignKey("materials.id", ondelete="CASCADE"),
        nullable=False,
        comment="Foreign key to material"
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="Foreign key to user who liked"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
        comment="Like timestamp"
    )

    # Relationships
    material: Mapped["Material"] = relationship("Material", back_populates="likes")

    # Unique constraint to prevent duplicate likes
    __table_args__ = (
        UniqueConstraint("material_id", "user_id", name="uq_likes_material_user"),
    )

    def __repr__(self) -> str:
        return f"<Like(id={self.id}, material_id={self.material_id}, user_id={self.user_id})>"


class View(Base):
    """
    View model for tracking material views.

    Attributes:
        id: Primary key
        material_id: Foreign key to material
        user_id: Foreign key to user who viewed (nullable for anonymous)
        ip_address: IP address of viewer
        created_at: View timestamp
    """

    __tablename__ = "views"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    material_id: Mapped[int] = mapped_column(
        ForeignKey("materials.id", ondelete="CASCADE"),
        nullable=False,
        comment="Foreign key to material"
    )
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="Foreign key to user who viewed (nullable for anonymous)"
    )
    ip_address: Mapped[str | None] = mapped_column(
        String(45),
        nullable=True,
        comment="IP address of viewer (supports IPv6)"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
        comment="View timestamp"
    )

    # Relationships
    material: Mapped["Material"] = relationship("Material", back_populates="views")

    # Table indexes for query optimization
    __table_args__ = (
        Index("idx_views_material", "material_id", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<View(id={self.id}, material_id={self.material_id}, user_id={self.user_id})>"
