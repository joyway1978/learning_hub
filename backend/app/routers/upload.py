"""
File Upload Router Module

Handles file upload endpoints for videos and PDFs.
Implements streaming upload to MinIO with database record management.
"""

import os
import shutil
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import (
    APIRouter, Depends, File, Form, HTTPException,
    UploadFile, status, BackgroundTasks
)
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.core.storage import get_minio_client, MinIOClient
from app.crud.material import create_material, update_material_status, update_material_thumbnail
from app.database import get_db
from app.dependencies.auth import get_current_active_user
from app.models.material import MaterialStatus, MaterialType
from app.models.user import User
from app.schemas.material import MaterialResponse
from app.core.tasks import submit_task
from app.services.file_validation import (
    FileType,
    ValidationErrorCode,
    get_content_type,
    get_file_extension,
    raise_validation_error,
    validate_file_with_size,
    validate_upload_file,
    VIDEO_MAX_SIZE,
    PDF_MAX_SIZE,
)
from app.services.thumbnail_service import process_thumbnail_generation
from app.core.logging import get_logger, get_audit_logger

router = APIRouter()

# Initialize loggers
logger = get_logger(__name__)
audit_logger = get_audit_logger()


def generate_object_name(user_id: int, filename: str) -> str:
    """
    Generate storage path for uploaded file.

    Format: materials/{user_id}/{timestamp}_{filename}

    Args:
        user_id: ID of uploading user
        filename: Original filename

    Returns:
        str: Object name/path for MinIO
    """
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    safe_filename = Path(filename).name  # Remove any path components
    return f"materials/{user_id}/{timestamp}_{safe_filename}"


def generate_thumbnail_object_name(user_id: int, material_id: int, extension: str = "jpg") -> str:
    """
    Generate storage path for thumbnail.

    Format: thumbnails/{user_id}/{material_id}.{extension}

    Args:
        user_id: ID of uploading user
        material_id: ID of material
        extension: Thumbnail file extension

    Returns:
        str: Object name/path for MinIO
    """
    return f"thumbnails/{user_id}/{material_id}.{extension}"


async def save_upload_file_temp(upload_file: UploadFile) -> tuple[str, int]:
    """
    Save uploaded file to temporary location and return path with size.

    This allows us to handle large files without loading them entirely into memory.

    Args:
        upload_file: FastAPI UploadFile

    Returns:
        Tuple of (temporary file path, file size in bytes)
    """
    # Create temporary file
    suffix = f".{get_file_extension(upload_file.filename)}"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp_path = tmp.name

        # Stream file content to temporary file
        total_size = 0
        chunk_size = settings.upload_chunk_size

        while chunk := await upload_file.read(chunk_size):
            tmp.write(chunk)
            total_size += len(chunk)

    logger.debug(f"File saved to temp: {tmp_path}, size={total_size} bytes")
    return tmp_path, total_size


def trigger_thumbnail_generation(
    material_id: int,
    user_id: int,
    file_path: str,
    file_type: MaterialType
) -> str:
    """
    Trigger asynchronous thumbnail generation.

    Submits the thumbnail generation task to the background task queue.
    The task runs asynchronously and updates the database when complete.

    Args:
        material_id: ID of material
        user_id: ID of user who uploaded the material
        file_path: Path to file in MinIO
        file_type: Type of material

    Returns:
        str: Task ID for tracking
    """
    import logging
    logger = logging.getLogger(__name__)

    logger.info(
        f"Queueing thumbnail generation for material {material_id}, "
        f"type: {file_type.value}"
    )

    # Submit to task manager for async execution
    task_id = submit_task(
        process_thumbnail_generation,
        material_id,
        user_id,
        file_path,
        file_type,
        metadata={
            "material_id": material_id,
            "user_id": user_id,
            "file_type": file_type.value,
            "operation": "thumbnail_generation"
        }
    )

    logger.info(f"Thumbnail generation task {task_id} submitted for material {material_id}")
    return task_id


@router.post(
    "",
    response_model=MaterialResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a file",
    description="Upload a video (mp4, webm) or PDF file. Requires authentication."
)
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="File to upload (video or PDF)"),
    title: str = Form(..., min_length=1, max_length=255, description="Material title"),
    description: Optional[str] = Form(None, description="Material description"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    minio: MinIOClient = Depends(get_minio_client)
) -> MaterialResponse:
    """
    Upload a file to the platform.

    **Process:**
    1. Validate file type and size
    2. Create database record (status=processing)
    3. Stream file to MinIO
    4. Update record to active
    5. Trigger thumbnail generation (async)

    **Supported formats:**
    - Video: mp4, webm (max 500MB)
    - PDF: pdf (max 50MB)

    **Authentication:** Required
    """
    tmp_file_path: Optional[str] = None

    logger.info(f"Upload started: user_id={current_user.id}, filename={file.filename}, title={title}")

    try:
        # Step 1: Initial validation (type check only, before reading file)
        type_validation = validate_upload_file(file)
        if not type_validation.is_valid:
            logger.warning(f"Upload validation failed (type): {file.filename}, errors={type_validation.errors}")
            raise_validation_error(type_validation)

        # Step 2: Save to temporary file and get size
        tmp_file_path, file_size = await save_upload_file_temp(file)

        # Step 3: Validate file size
        size_validation = validate_file_with_size(file, file_size)
        if not size_validation.is_valid:
            logger.warning(f"Upload validation failed (size): {file.filename}, size={file_size}, errors={size_validation.errors}")
            raise_validation_error(size_validation)

        # Determine material type
        material_type = (
            MaterialType.VIDEO
            if size_validation.file_type == FileType.VIDEO
            else MaterialType.PDF
        )

        # Step 4: Create database record (status=processing)
        object_name = generate_object_name(current_user.id, file.filename)
        content_type = get_content_type(size_validation.file_type, size_validation.extension)

        material = create_material(
            db=db,
            title=title,
            description=description,
            material_type=material_type,
            file_path=object_name,
            file_size=file_size,
            file_format=size_validation.extension,
            uploader_id=current_user.id
        )

        # Step 5: Stream upload to MinIO
        try:
            with open(tmp_file_path, "rb") as f:
                minio.upload_file_stream(
                    file_stream=f,
                    object_name=object_name,
                    content_type=content_type,
                    file_size=file_size
                )
            logger.info(f"File uploaded to MinIO: {object_name}, size={file_size}")
        except Exception as e:
            # Upload failed - delete the database record
            logger.error(f"MinIO upload failed: {object_name}, error={e}")
            db.delete(material)
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={
                    "error": {
                        "code": "UPLOAD_FAILED",
                        "message": "Failed to upload file to storage",
                        "details": {"error": str(e)} if settings.debug else {}
                    }
                }
            ) from e

        # Step 6: Update status to active
        material = update_material_status(db, material, MaterialStatus.ACTIVE)

        # Step 7: Trigger async thumbnail generation for videos and PDFs
        if material_type in (MaterialType.VIDEO, MaterialType.PDF):
            background_tasks.add_task(
                trigger_thumbnail_generation,
                material.id,
                current_user.id,
                object_name,
                material_type
            )

        audit_logger.info(
            f"File uploaded successfully: material_id={material.id}, user_id={current_user.id}, "
            f"filename={file.filename}, type={material_type.value}, size={file_size}"
        )
        logger.info(
            f"Upload completed: material_id={material.id}, user_id={current_user.id}, "
            f"title={title}, type={material_type.value}"
        )

        # Return response
        return MaterialResponse.model_validate(material)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected upload error: user_id={current_user.id}, filename={file.filename}, error={e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": {
                    "code": "UPLOAD_FAILED",
                    "message": "An unexpected error occurred during upload",
                    "details": {"error": str(e)} if settings.debug else {}
                }
            }
        ) from e
    finally:
        # Clean up temporary file
        if tmp_file_path and os.path.exists(tmp_file_path):
            try:
                os.unlink(tmp_file_path)
            except OSError:
                pass


@router.get(
    "/status/{material_id}",
    summary="Get upload status",
    description="Check the processing status of an uploaded material."
)
async def get_upload_status(
    material_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> dict:
    """
    Get the processing status of a material.

    **Authentication:** Required
    """
    from app.crud.material import get_material_by_id

    material = get_material_by_id(db, material_id)

    if not material:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "NOT_FOUND",
                    "message": "Material not found",
                    "details": {"material_id": material_id}
                }
            }
        )

    # Check if user has permission to view this material's status
    if material.uploader_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": {
                    "code": "FORBIDDEN",
                    "message": "You can only check status of your own uploads",
                    "details": {}
                }
            }
        )

    # Calculate progress based on status
    progress = 0
    if material.status == MaterialStatus.PROCESSING:
        progress = 50  # File uploaded, processing
    elif material.status == MaterialStatus.ACTIVE:
        progress = 100  # Complete
    elif material.status == MaterialStatus.HIDDEN:
        progress = 100  # Complete but hidden

    # Handle both enum and string status values
    status_value = material.status.value if isinstance(material.status, MaterialStatus) else material.status

    return {
        "material_id": material.id,
        "status": status_value,
        "progress": progress,
        "message": _get_status_message(material.status),
        "thumbnail_path": material.thumbnail_path,
        "has_thumbnail": material.thumbnail_path is not None
    }


def _get_status_message(status: MaterialStatus) -> str:
    """Get human-readable status message."""
    messages = {
        MaterialStatus.PROCESSING: "File uploaded, processing...",
        MaterialStatus.ACTIVE: "Upload complete and ready",
        MaterialStatus.HIDDEN: "Material is hidden"
    }
    return messages.get(status, "Unknown status")


@router.get(
    "/thumbnail-status/{material_id}",
    summary="Get thumbnail generation status",
    description="Check the thumbnail generation status of an uploaded material."
)
async def get_thumbnail_status(
    material_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> dict:
    """
    Get the thumbnail generation status of a material.

    **Authentication:** Required
    """
    from app.crud.material import get_material_by_id

    material = get_material_by_id(db, material_id)

    if not material:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "NOT_FOUND",
                    "message": "Material not found",
                    "details": {"material_id": material_id}
                }
            }
        )

    # Check if user has permission to view this material's status
    if material.uploader_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": {
                    "code": "FORBIDDEN",
                    "message": "You can only check status of your own uploads",
                    "details": {}
                }
            }
        )

    # Determine thumbnail status
    thumbnail_status = "pending"
    if material.thumbnail_path:
        if "placeholder" in material.thumbnail_path:
            thumbnail_status = "failed"
        else:
            thumbnail_status = "completed"

    return {
        "material_id": material.id,
        "thumbnail_status": thumbnail_status,
        "thumbnail_path": material.thumbnail_path,
        "has_thumbnail": material.thumbnail_path is not None
    }


@router.delete(
    "/{material_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete uploaded material",
    description="Delete a material and its associated files."
)
async def delete_upload(
    material_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    minio: MinIOClient = Depends(get_minio_client)
) -> None:
    """
    Delete a material and its files from storage.

    **Authentication:** Required (only uploader or admin can delete)
    """
    from app.crud.material import get_material_by_id, delete_material

    material = get_material_by_id(db, material_id)

    if not material:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "NOT_FOUND",
                    "message": "Material not found",
                    "details": {"material_id": material_id}
                }
            }
        )

    # Check permission
    if material.uploader_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": {
                    "code": "FORBIDDEN",
                    "message": "You can only delete your own uploads",
                    "details": {}
                }
            }
        )

    # Delete file from MinIO
    try:
        minio.delete_file(material.file_path)
        # Delete thumbnail if exists
        if material.thumbnail_path:
            minio.delete_file(material.thumbnail_path)
    except Exception as e:
        # Log error but continue to delete database record
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Failed to delete files from MinIO: {e}")

    # Delete database record
    delete_material(db, material)
