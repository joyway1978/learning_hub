"""
Materials Router Module

Handles material listing, detail viewing, and deletion endpoints.
Implements view tracking with deduplication and proper authorization.
"""

from typing import Optional

from fastapi import (
    APIRouter, Depends, HTTPException, Query, Request,
    status, BackgroundTasks
)
from fastapi.responses import StreamingResponse
from minio.error import S3Error
from sqlalchemy.orm import Session

from app.config import settings
from app.crud.material import (
    get_material_by_id, get_materials, count_materials,
    soft_delete_material, check_material_exists, update_material
)
from app.crud.like import toggle_like, check_user_liked, get_user_liked_material_ids
from app.database import get_db
from app.dependencies.auth import (
    get_current_active_user, get_optional_current_user
)
from app.models.material import MaterialStatus, MaterialType
from app.models.user import User
from app.schemas.material import (
    MaterialListResponse, MaterialDetailResponse,
    MaterialWithUploader, MaterialUpdate
)
from app.services.view_service import record_view_async
from app.core.logging import get_logger, get_audit_logger

router = APIRouter()

# Initialize loggers
logger = get_logger(__name__)
audit_logger = get_audit_logger()


def _get_client_ip(request: Request) -> Optional[str]:
    """
    Get client IP address from request.

    Checks X-Forwarded-For header first (for proxies), then falls back to
    direct connection IP.

    Args:
        request: FastAPI request object

    Returns:
        Client IP address or None if cannot be determined
    """
    # Check for forwarded IP (when behind proxy/load balancer)
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        # X-Forwarded-For can contain multiple IPs, take the first one
        return forwarded.split(",")[0].strip()

    # Check for X-Real-IP header
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip

    # Fall back to direct connection
    if request.client:
        return request.client.host

    return None


def _validate_sort_params(sort_by: str, sort_order: str) -> tuple:
    """
    Validate and normalize sort parameters.

    Args:
        sort_by: Field to sort by
        sort_order: Sort order (asc/desc)

    Returns:
        Tuple of (validated_sort_by, validated_sort_order)
    """
    valid_sort_fields = {"created_at", "view_count", "like_count"}
    valid_sort_orders = {"asc", "desc"}

    if sort_by not in valid_sort_fields:
        sort_by = "created_at"
    if sort_order not in valid_sort_orders:
        sort_order = "desc"

    return sort_by, sort_order


@router.get(
    "",
    response_model=MaterialListResponse,
    summary="Get materials list",
    description="Get a paginated list of materials with optional filtering and sorting."
)
async def list_materials(
    request: Request,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(
        default=20, ge=1, le=100, description="Number of items per page"
    ),
    sort_by: str = Query(
        default="created_at",
        description="Sort field: created_at, view_count, like_count"
    ),
    sort_order: str = Query(
        default="desc",
        description="Sort order: asc or desc"
    ),
    material_type: Optional[str] = Query(
        default=None,
        description="Filter by type: video, pdf, pptx, docx, or xlsx"
    ),
    search: Optional[str] = Query(
        default=None,
        description="Search by title (case-insensitive partial match)"
    ),
    uploader_id: Optional[int] = Query(
        default=None,
        ge=1,
        description="Filter by uploader ID"
    ),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
) -> MaterialListResponse:
    """
    Get a paginated list of materials.

    **Features:**
    - Pagination with page and page_size parameters
    - Sorting by created_at, view_count, or like_count
    - Filtering by material type (video/pdf)
    - Preloaded uploader information to avoid N+1 queries

    **Authentication:** Optional
    """
    # Validate and normalize parameters
    sort_by, sort_order = _validate_sort_params(sort_by, sort_order)

    # Validate page_size against settings
    if page_size > settings.max_page_size:
        page_size = settings.max_page_size

    # Log list request
    client_ip = _get_client_ip(request)
    user_id = current_user.id if current_user else None
    logger.info(
        f"Materials list requested: page={page}, page_size={page_size}, "
        f"sort_by={sort_by}, sort_order={sort_order}, type={material_type}, "
        f"search={search}, user_id={user_id}, ip={client_ip}"
    )

    # Parse material type filter
    type_filter = None
    if material_type:
        try:
            type_filter = MaterialType(material_type.lower())
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": {
                        "code": "INVALID_TYPE",
                        "message": "Invalid material type",
                        "details": {"valid_types": ["video", "pdf", "pptx", "docx", "xlsx"]}
                    }
                }
            )

    # Calculate skip
    skip = (page - 1) * page_size

    # Get materials with uploader preloaded
    materials = get_materials(
        db=db,
        skip=skip,
        limit=page_size,
        status=MaterialStatus.ACTIVE,  # Only show active materials
        material_type=type_filter,
        uploader_id=uploader_id,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
        include_uploader=True
    )

    # Get total count for pagination
    total = count_materials(
        db=db,
        status=MaterialStatus.ACTIVE,
        material_type=type_filter,
        uploader_id=uploader_id,
        search=search
    )

    # Calculate total pages
    total_pages = (total + page_size - 1) // page_size

    # Get liked material IDs for current user (if logged in)
    liked_material_ids = set()
    if current_user:
        material_ids = [m.id for m in materials]
        liked_material_ids = get_user_liked_material_ids(db, current_user.id, material_ids)

    # Convert materials to response schema
    items = []
    for material in materials:
        uploader = material.uploader
        item = MaterialWithUploader(
            id=material.id,
            title=material.title,
            description=material.description,
            type=material.type,
            file_path=material.file_path,
            file_size=material.file_size,
            file_format=material.file_format,
            thumbnail_path=material.thumbnail_path,
            uploader_id=material.uploader_id,
            uploader_name=uploader.name if uploader else "Unknown",
            uploader_avatar=uploader.avatar_url if uploader else None,
            view_count=material.view_count,
            like_count=material.like_count,
            status=material.status,
            created_at=material.created_at,
            updated_at=material.updated_at,
            is_liked_by_me=material.id in liked_material_ids
        )
        items.append(item)

    logger.info(
        f"Materials list returned: {len(items)} items, total={total}, "
        f"page={page}/{total_pages}"
    )

    return MaterialListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.get(
    "/{material_id}",
    response_model=MaterialDetailResponse,
    summary="Get material details",
    description="Get detailed information about a specific material."
)
async def get_material_detail(
    request: Request,
    material_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
) -> MaterialDetailResponse:
    """
    Get detailed information about a material.

    **Features:**
    - Returns full material details including uploader info
    - Includes view and like statistics
    - Triggers view tracking asynchronously (10-minute deduplication)

    **Authentication:** Optional (for view tracking)
    """
    # Get material with uploader preloaded
    material = get_material_by_id(db, material_id, include_uploader=True)

    if not material:
        logger.warning(f"Material not found: material_id={material_id}, user_id={current_user.id if current_user else None}")
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

    # Check if material is hidden
    if material.status == MaterialStatus.HIDDEN:
        # Only uploader or admin can see hidden materials
        if not current_user or (
            current_user.id != material.uploader_id and
            not getattr(current_user, 'is_admin', False)
        ):
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

    # Get client IP for view tracking
    client_ip = _get_client_ip(request)

    # Trigger view tracking asynchronously
    # This handles the 10-minute deduplication logic
    user_id = current_user.id if current_user else None
    background_tasks.add_task(
        record_view_async,
        material_id=material.id,
        user_id=user_id,
        ip_address=client_ip
    )

    logger.info(
        f"Material detail viewed: material_id={material_id}, "
        f"title='{material.title}', user_id={user_id}, ip={client_ip}"
    )

    # Check if current user has liked this material
    is_liked = False
    if current_user:
        is_liked = check_user_liked(db, current_user.id, material_id)

    # Get related materials (same type, excluding current)
    related_materials = []
    related = get_materials(
        db=db,
        skip=0,
        limit=5,
        status=MaterialStatus.ACTIVE,
        material_type=material.type,
        sort_by="created_at",
        sort_order="desc",
        include_uploader=False
    )
    for rel in related:
        if rel.id != material.id:
            related_materials.append(rel)
            if len(related_materials) >= 4:  # Limit to 4 related materials
                break

    # Build response
    uploader = material.uploader
    return MaterialDetailResponse(
        id=material.id,
        title=material.title,
        description=material.description,
        type=material.type,
        file_path=material.file_path,
        file_size=material.file_size,
        file_format=material.file_format,
        thumbnail_path=material.thumbnail_path,
        uploader_id=material.uploader_id,
        uploader_name=uploader.name if uploader else "Unknown",
        uploader_avatar=uploader.avatar_url if uploader else None,
        view_count=material.view_count,
        like_count=material.like_count,
        status=material.status,
        created_at=material.created_at,
        updated_at=material.updated_at,
        is_liked_by_me=is_liked,
        related_materials=related_materials
    )


@router.put(
    "/{material_id}",
    response_model=MaterialDetailResponse,
    summary="Update material",
    description="Update material title and description. Only the uploader can edit their own materials."
)
async def update_material_endpoint(
    material_id: int,
    material_update: MaterialUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> MaterialDetailResponse:
    """
    Update material information.

    **Features:**
    - Only the uploader can edit their own materials
    - Can only update title and description
    - Returns the updated material details

    **Authentication:** Required
    """
    # Get material
    material = get_material_by_id(db, material_id, include_uploader=True)

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

    # Check if user is the uploader
    if material.uploader_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": {
                    "code": "FORBIDDEN",
                    "message": "You can only edit your own materials",
                    "details": {}
                }
            }
        )

    # Check if material is active
    if material.status != MaterialStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": {
                    "code": "INVALID_STATUS",
                    "message": "Cannot edit inactive or deleted materials",
                    "details": {"status": material.status.value if isinstance(material.status, MaterialStatus) else material.status}
                }
            }
        )

    # Only allow updating title and description
    update_data = MaterialUpdate(
        title=material_update.title,
        description=material_update.description
    )

    # Update material
    updated_material = update_material(db, material, update_data)

    logger.info(
        f"Material updated: material_id={material_id}, user_id={current_user.id}, "
        f"title='{updated_material.title}'"
    )

    # Build response
    uploader = updated_material.uploader
    is_liked = check_user_liked(db, current_user.id, material_id)

    return MaterialDetailResponse(
        id=updated_material.id,
        title=updated_material.title,
        description=updated_material.description,
        type=updated_material.type,
        file_path=updated_material.file_path,
        file_size=updated_material.file_size,
        file_format=updated_material.file_format,
        thumbnail_path=updated_material.thumbnail_path,
        uploader_id=updated_material.uploader_id,
        uploader_name=uploader.name if uploader else "Unknown",
        uploader_avatar=uploader.avatar_url if uploader else None,
        view_count=updated_material.view_count,
        like_count=updated_material.like_count,
        status=updated_material.status,
        created_at=updated_material.created_at,
        updated_at=updated_material.updated_at,
        is_liked_by_me=is_liked,
        related_materials=[]
    )


@router.delete(
    "/{material_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete material",
    description="Soft delete a material. Only the uploader can delete their own materials."
)
async def delete_material(
    material_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> None:
    """
    Soft delete a material.

    **Features:**
    - Only the uploader can delete their own materials
    - Performs soft delete (changes status to hidden)
    - Returns 204 No Content on success

    **Authentication:** Required
    """
    # Get material
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

    # Check if user is the uploader
    if material.uploader_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": {
                    "code": "FORBIDDEN",
                    "message": "You can only delete your own materials",
                    "details": {}
                }
            }
        )

    # Check if already deleted
    if material.status == MaterialStatus.HIDDEN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": {
                    "code": "ALREADY_DELETED",
                    "message": "Material is already deleted",
                    "details": {}
                }
            }
        )

    # Perform soft delete
    soft_delete_material(db, material)


@router.post(
    "/{material_id}/like",
    response_model=dict,
    summary="Toggle like status",
    description="Toggle like/unlike for a material. If already liked, unlikes it. If not liked, likes it."
)
async def toggle_material_like(
    material_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> dict:
    """
    Toggle like status for a material.

    **Features:**
    - If user has already liked the material, unlikes it
    - If user has not liked the material, likes it
    - Returns the new like status and total like count
    - Uses database transactions for consistency

    **Authentication:** Required

    **Response:**
    - `is_liked`: Boolean indicating whether the material is now liked
    - `like_count`: Current total like count for the material
    """
    # Check if material exists
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

    # Check if material is active
    if material.status != MaterialStatus.ACTIVE:
        # Handle both enum and string status values
        status_value = material.status.value if isinstance(material.status, MaterialStatus) else material.status
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": {
                    "code": "INVALID_STATUS",
                    "message": "Cannot like inactive or hidden materials",
                    "details": {"status": status_value}
                }
            }
        )

    # Toggle like status
    try:
        is_liked, like_count = toggle_like(db, current_user.id, material_id)
        db.commit()  # Commit the transaction to persist like_count changes
    except ValueError as e:
        logger.warning(
            f"Like toggle failed: material_id={material_id}, user_id={current_user.id}, error={e}"
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "NOT_FOUND",
                    "message": str(e),
                    "details": {"material_id": material_id}
                }
            }
        )

    action = "liked" if is_liked else "unliked"
    audit_logger.info(
        f"Material {action}: material_id={material_id}, user_id={current_user.id}, "
        f"new_like_count={like_count}"
    )
    logger.info(
        f"Material {action}: material_id={material_id}, user_id={current_user.id}, "
        f"like_count={like_count}"
    )

    return {
        "liked": is_liked,
        "like_count": like_count
    }


@router.get(
    "/{material_id}/stream",
    summary="Stream or download material file",
    description="Stream video content or download PDF file. Publicly accessible for embedded viewing."
)
async def stream_material(
    material_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Stream video or download PDF file from MinIO storage.

    **Features:**
    - Streams video content for online playback
    - Returns PDF for viewing/download
    - Validates material exists and is accessible
    - Increments download count for PDFs

    **Authentication:** Optional
    """
    from app.core.storage import get_minio_client
    minio_client = get_minio_client()

    # Get material
    material = get_material_by_id(db, material_id)

    if not material:
        logger.warning(f"Stream requested for non-existent material: material_id={material_id}")
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

    # Handle both enum and string type values
    type_value = material.type.value if hasattr(material.type, 'value') else material.type
    logger.info(
        f"Material streaming: material_id={material_id}, type={type_value}, "
        f"format={material.file_format}"
    )

    # Check if material is accessible (stream is public for active materials)
    if material.status == MaterialStatus.HIDDEN:
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

    # Determine content type based on file type
    content_type_map = {
        MaterialType.VIDEO: "video/mp4",
        MaterialType.PDF: "application/pdf"
    }
    content_type = content_type_map.get(material.type, "application/octet-stream")
    safe_filename = f"{material.id}.{material.file_format}"

    # Handle HTTP Range requests for Safari video playback support
    range_header = request.headers.get("range")

    try:
        if range_header:
            # Parse range header (e.g., "bytes=0-1023")
            try:
                range_match = range_header.replace("bytes=", "").split("-")
                start = int(range_match[0]) if range_match[0] else 0
                end = int(range_match[1]) if len(range_match) > 1 and range_match[1] else material.file_size - 1

                # Validate range
                if start >= material.file_size or end >= material.file_size:
                    raise HTTPException(
                        status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE,
                        headers={"Content-Range": f"bytes */{material.file_size}"}
                    )

                content_length = end - start + 1

                # Get partial content from MinIO
                logger.info(f"Range request: material_id={material_id}, bytes={start}-{end}/{material.file_size}")
                response = minio_client.client.get_object(
                    minio_client.bucket_name,
                    material.file_path,
                    offset=start,
                    length=content_length
                )

                return StreamingResponse(
                    response,
                    status_code=status.HTTP_206_PARTIAL_CONTENT,
                    media_type=content_type,
                    headers={
                        "Content-Disposition": f"inline; filename=\"{safe_filename}\"",
                        "Accept-Ranges": "bytes",
                        "Content-Range": f"bytes {start}-{end}/{material.file_size}",
                        "Content-Length": str(content_length)
                    }
                )
            except (ValueError, IndexError) as e:
                logger.warning(f"Invalid range header: {range_header}, error: {e}, falling back to full content")
                # Fall through to return full content

        # Get full content from MinIO (for non-range requests or invalid range headers)
        logger.info(f"Full content request: material_id={material_id}, size={material.file_size}")
        response = minio_client.client.get_object(
            minio_client.bucket_name,
            material.file_path
        )

        return StreamingResponse(
            response,
            media_type=content_type,
            headers={
                "Content-Disposition": f"inline; filename=\"{safe_filename}\"",
                "Accept-Ranges": "bytes",
                "Content-Length": str(material.file_size)
            }
        )
    except S3Error as e:
        logger.error(f"MinIO S3Error when streaming {material.file_path}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": {
                    "code": "STREAM_ERROR",
                    "message": "Failed to retrieve file from storage",
                    "details": {"error": str(e)}
                }
            }
        ) from e
    except Exception as e:
        logger.error(f"Unexpected error when streaming {material.file_path}: {type(e).__name__}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": {
                    "code": "STREAM_ERROR",
                    "message": "Failed to retrieve file from storage",
                    "details": {"error": str(e)}
                }
            }
        ) from e


@router.get(
    "/{material_id}/url",
    summary="Get direct file URL",
    description="Get presigned URL for direct access to video/PDF file from MinIO. Returns a URL that can be used directly in video players or PDF viewers."
)
async def get_material_url(
    material_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Get presigned URL for direct file access from MinIO.

    **Features:**
    - Returns a presigned URL valid for 1 hour
    - URL can be used directly in video players and PDF viewers
    - No file data flows through backend (better performance)
    - Validates material exists and is accessible

    **Authentication:** Optional (for active materials)

    **Response:**
    - `url`: Presigned URL for direct access
    - `expires_in`: URL expiration time in seconds (3600)
    """
    from app.core.storage import get_minio_client
    from datetime import timedelta
    minio_client = get_minio_client()

    # Get material
    material = get_material_by_id(db, material_id)

    if not material:
        logger.warning(f"URL requested for non-existent material: material_id={material_id}")
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

    # Check if material is accessible
    if material.status == MaterialStatus.HIDDEN:
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

    try:
        # Generate presigned URL valid for 1 hour
        presigned_url = minio_client.get_presigned_url(
            object_name=material.file_path,
            expires=timedelta(hours=1)
        )

        logger.info(f"Generated presigned URL for material_id={material_id}, path={material.file_path}")

        return {
            "url": presigned_url,
            "expires_in": 3600,
            "material_id": material_id,
            "file_type": material.type.value if hasattr(material.type, 'value') else material.type,
            "file_format": material.file_format
        }

    except S3Error as e:
        logger.error(f"MinIO S3Error when generating URL for {material.file_path}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": {
                    "code": "URL_GENERATION_ERROR",
                    "message": "Failed to generate file URL",
                    "details": {"error": str(e)}
                }
            }
        ) from e


@router.get(
    "/{material_id}/thumbnail",
    summary="Get material thumbnail",
    description="Stream thumbnail image for a material. Returns JPEG thumbnail for video/PDF files."
)
async def get_material_thumbnail(
    material_id: int,
    db: Session = Depends(get_db),
):
    """
    Get thumbnail image for a material.

    **Features:**
    - Streams thumbnail from MinIO storage
    - Returns JPEG image
    - Validates material exists and has thumbnail

    **Authentication:** Optional
    """
    from app.core.storage import get_minio_client
    minio_client = get_minio_client()

    # Get material
    material = get_material_by_id(db, material_id)

    if not material:
        logger.warning(f"Thumbnail requested for non-existent material: material_id={material_id}")
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

    # Check if material is accessible
    if material.status == MaterialStatus.HIDDEN:
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

    # Check if thumbnail exists
    if not material.thumbnail_path:
        logger.warning(f"Thumbnail requested but not found: material_id={material_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "THUMBNAIL_NOT_FOUND",
                    "message": "Thumbnail not available",
                    "details": {"material_id": material_id}
                }
            }
        )

    # Check if thumbnail is a placeholder
    if "placeholder" in material.thumbnail_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "THUMBNAIL_NOT_GENERATED",
                    "message": "Thumbnail generation failed",
                    "details": {"material_id": material_id}
                }
            }
        )

    try:
        # Get thumbnail from MinIO
        logger.info(f"Streaming thumbnail: material_id={material_id}, path={material.thumbnail_path}")
        response = minio_client.client.get_object(
            minio_client.bucket_name,
            material.thumbnail_path
        )

        return StreamingResponse(
            response,
            media_type="image/jpeg",
            headers={
                "Cache-Control": "public, max-age=86400"  # Cache for 1 day
            }
        )

    except S3Error as e:
        logger.error(f"MinIO S3Error when streaming thumbnail {material.thumbnail_path}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": {
                    "code": "THUMBNAIL_ERROR",
                    "message": "Failed to retrieve thumbnail from storage",
                    "details": {"error": str(e)}
                }
            }
        ) from e
    except Exception as e:
        logger.error(f"Unexpected error when streaming thumbnail {material.thumbnail_path}: {type(e).__name__}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": {
                    "code": "THUMBNAIL_ERROR",
                    "message": "Failed to retrieve thumbnail",
                    "details": {"error": str(e)}
                }
            }
        ) from e
