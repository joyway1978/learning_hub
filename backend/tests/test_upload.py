"""
Upload Tests

Tests for file upload functionality including validation, processing, and status checks.
"""

import io
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from unittest.mock import Mock, patch

from app.models.user import User
from app.models.material import Material, MaterialStatus, MaterialType


class TestUploadFile:
    """Tests for file upload endpoint."""

    def test_upload_video_success(self, authorized_client: TestClient, db_session: Session):
        """Test successful video upload."""
        # Create a mock video file
        video_content = b"fake video content" * 1000  # Make it reasonably sized

        with patch('app.routers.upload.get_minio_client') as mock_minio:
            mock_minio_client = Mock()
            mock_minio.return_value = mock_minio_client
            mock_minio_client.upload_file_stream.return_value = None

            response = authorized_client.post(
                "/api/v1/upload",
                data={
                    "title": "Test Video Upload",
                    "description": "A test video upload"
                },
                files={
                    "file": ("test_video.mp4", io.BytesIO(video_content), "video/mp4")
                }
            )

        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Test Video Upload"
        assert data["description"] == "A test video upload"
        assert data["file_type"] == "video"
        assert data["file_format"] == "mp4"
        assert data["status"] == "active"
        assert "id" in data
        assert "file_path" in data

    def test_upload_pdf_success(self, authorized_client: TestClient, db_session: Session):
        """Test successful PDF upload."""
        pdf_content = b"%PDF-1.4 fake pdf content" * 100

        with patch('app.routers.upload.get_minio_client') as mock_minio:
            mock_minio_client = Mock()
            mock_minio.return_value = mock_minio_client
            mock_minio_client.upload_file_stream.return_value = None

            response = authorized_client.post(
                "/api/v1/upload",
                data={
                    "title": "Test PDF Upload",
                    "description": "A test PDF upload"
                },
                files={
                    "file": ("test_document.pdf", io.BytesIO(pdf_content), "application/pdf")
                }
            )

        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Test PDF Upload"
        assert data["file_type"] == "pdf"
        assert data["file_format"] == "pdf"

    def test_upload_unauthorized(self, client: TestClient):
        """Test upload without authentication."""
        response = client.post(
            "/api/v1/upload",
            data={"title": "Test Upload"},
            files={"file": ("test.mp4", io.BytesIO(b"content"), "video/mp4")}
        )

        assert response.status_code == 401

    def test_upload_invalid_file_type(self, authorized_client: TestClient):
        """Test upload with invalid file type."""
        response = authorized_client.post(
            "/api/v1/upload",
            data={"title": "Test Upload"},
            files={"file": ("test.txt", io.BytesIO(b"text content"), "text/plain")}
        )

        assert response.status_code == 400
        data = response.json()
        assert data["error"]["code"] == "UNSUPPORTED_FORMAT"

    def test_upload_video_too_large(self, authorized_client: TestClient):
        """Test upload with video file too large."""
        # Create content larger than max video size (500MB)
        large_content = b"x" * (524_288_000 + 1)

        response = authorized_client.post(
            "/api/v1/upload",
            data={"title": "Large Video"},
            files={"file": ("large.mp4", io.BytesIO(large_content), "video/mp4")}
        )

        assert response.status_code == 400
        data = response.json()
        assert data["error"]["code"] == "FILE_TOO_LARGE"

    def test_upload_pdf_too_large(self, authorized_client: TestClient):
        """Test upload with PDF file too large."""
        # Create content larger than max PDF size (50MB)
        large_content = b"%PDF-1.4" + b"x" * (52_428_800 + 1)

        response = authorized_client.post(
            "/api/v1/upload",
            data={"title": "Large PDF"},
            files={"file": ("large.pdf", io.BytesIO(large_content), "application/pdf")}
        )

        assert response.status_code == 400
        data = response.json()
        assert data["error"]["code"] == "FILE_TOO_LARGE"

    def test_upload_missing_title(self, authorized_client: TestClient):
        """Test upload without title."""
        response = authorized_client.post(
            "/api/v1/upload",
            files={"file": ("test.mp4", io.BytesIO(b"content"), "video/mp4")}
        )

        assert response.status_code == 422

    def test_upload_empty_file(self, authorized_client: TestClient):
        """Test upload with empty file."""
        response = authorized_client.post(
            "/api/v1/upload",
            data={"title": "Empty File"},
            files={"file": ("empty.mp4", io.BytesIO(b""), "video/mp4")}
        )

        # Should fail validation
        assert response.status_code in [400, 422]

    def test_upload_webm_video(self, authorized_client: TestClient, db_session: Session):
        """Test uploading webm video format."""
        webm_content = b"fake webm content" * 1000

        with patch('app.routers.upload.get_minio_client') as mock_minio:
            mock_minio_client = Mock()
            mock_minio.return_value = mock_minio_client
            mock_minio_client.upload_file_stream.return_value = None

            response = authorized_client.post(
                "/api/v1/upload",
                data={"title": "WebM Video"},
                files={"file": ("test.webm", io.BytesIO(webm_content), "video/webm")}
            )

        assert response.status_code == 201
        data = response.json()
        assert data["file_format"] == "webm"

    def test_upload_pptx_success(self, authorized_client: TestClient, db_session: Session):
        """Test successful PPTX upload."""
        pptx_content = b"fake pptx content" * 1000

        with patch('app.routers.upload.get_minio_client') as mock_minio:
            mock_minio_client = Mock()
            mock_minio.return_value = mock_minio_client
            mock_minio_client.upload_file_stream.return_value = None

            response = authorized_client.post(
                "/api/v1/upload",
                data={
                    "title": "Test PPTX Upload",
                    "description": "A test PPTX upload"
                },
                files={
                    "file": ("test_presentation.pptx", io.BytesIO(pptx_content), "application/vnd.openxmlformats-officedocument.presentationml.presentation")
                }
            )

        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Test PPTX Upload"
        assert data["file_type"] == "pptx"
        assert data["file_format"] == "pptx"

    def test_upload_docx_success(self, authorized_client: TestClient, db_session: Session):
        """Test successful DOCX upload."""
        docx_content = b"fake docx content" * 1000

        with patch('app.routers.upload.get_minio_client') as mock_minio:
            mock_minio_client = Mock()
            mock_minio.return_value = mock_minio_client
            mock_minio_client.upload_file_stream.return_value = None

            response = authorized_client.post(
                "/api/v1/upload",
                data={
                    "title": "Test DOCX Upload",
                    "description": "A test DOCX upload"
                },
                files={
                    "file": ("test_document.docx", io.BytesIO(docx_content), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
                }
            )

        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Test DOCX Upload"
        assert data["file_type"] == "docx"
        assert data["file_format"] == "docx"

    def test_upload_xlsx_success(self, authorized_client: TestClient, db_session: Session):
        """Test successful XLSX upload."""
        xlsx_content = b"fake xlsx content" * 1000

        with patch('app.routers.upload.get_minio_client') as mock_minio:
            mock_minio_client = Mock()
            mock_minio.return_value = mock_minio_client
            mock_minio_client.upload_file_stream.return_value = None

            response = authorized_client.post(
                "/api/v1/upload",
                data={
                    "title": "Test XLSX Upload",
                    "description": "A test XLSX upload"
                },
                files={
                    "file": ("test_spreadsheet.xlsx", io.BytesIO(xlsx_content), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                }
            )

        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Test XLSX Upload"
        assert data["file_type"] == "xlsx"
        assert data["file_format"] == "xlsx"

    def test_upload_office_file_too_large(self, authorized_client: TestClient):
        """Test upload with Office file too large."""
        # Create content larger than max office size (50MB)
        large_content = b"x" * (52_428_800 + 1)

        response = authorized_client.post(
            "/api/v1/upload",
            data={"title": "Large PPTX"},
            files={"file": ("large.pptx", io.BytesIO(large_content), "application/vnd.openxmlformats-officedocument.presentationml.presentation")}
        )

        assert response.status_code == 413
        data = response.json()
        assert data["error"]["code"] == "FILE_TOO_LARGE"


class TestUploadStatus:
    """Tests for upload status endpoint."""

    def test_get_upload_status_success(self, authorized_client: TestClient, test_video_material: Material, test_user: User):
        """Test getting upload status."""
        # Set the uploader to be the test user
        test_video_material.uploader_id = test_user.id

        response = authorized_client.get(f"/api/v1/upload/status/{test_video_material.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["material_id"] == test_video_material.id
        assert "status" in data
        assert "progress" in data
        assert "message" in data

    def test_get_upload_status_not_found(self, authorized_client: TestClient):
        """Test getting status for non-existent material."""
        response = authorized_client.get("/api/v1/upload/status/99999")

        assert response.status_code == 404
        data = response.json()
        assert data["error"]["code"] == "NOT_FOUND"

    def test_get_upload_status_not_uploader(self, authorized_client_2: TestClient, test_video_material: Material):
        """Test getting status for material uploaded by another user."""
        response = authorized_client_2.get(f"/api/v1/upload/status/{test_video_material.id}")

        assert response.status_code == 403
        data = response.json()
        assert data["error"]["code"] == "FORBIDDEN"

    def test_get_upload_status_unauthorized(self, client: TestClient, test_video_material: Material):
        """Test getting status without authentication."""
        response = client.get(f"/api/v1/upload/status/{test_video_material.id}")

        assert response.status_code == 401

    def test_get_upload_status_processing(self, authorized_client: TestClient, test_processing_material: Material, test_user: User):
        """Test getting status for processing material."""
        test_processing_material.uploader_id = test_user.id

        response = authorized_client.get(f"/api/v1/upload/status/{test_processing_material.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "processing"
        assert data["progress"] == 50

    def test_get_upload_status_active(self, authorized_client: TestClient, test_video_material: Material, test_user: User):
        """Test getting status for active material."""
        test_video_material.uploader_id = test_user.id

        response = authorized_client.get(f"/api/v1/upload/status/{test_video_material.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "active"
        assert data["progress"] == 100


class TestThumbnailStatus:
    """Tests for thumbnail status endpoint."""

    def test_get_thumbnail_status_success(self, authorized_client: TestClient, test_video_material: Material, test_user: User):
        """Test getting thumbnail status."""
        test_video_material.uploader_id = test_user.id

        response = authorized_client.get(f"/api/v1/upload/thumbnail-status/{test_video_material.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["material_id"] == test_video_material.id
        assert "thumbnail_status" in data
        assert "thumbnail_path" in data
        assert "has_thumbnail" in data

    def test_get_thumbnail_status_completed(self, authorized_client: TestClient, test_video_material: Material, test_user: User):
        """Test thumbnail status when thumbnail exists."""
        test_video_material.uploader_id = test_user.id
        test_video_material.thumbnail_path = "thumbnails/1/test.jpg"

        response = authorized_client.get(f"/api/v1/upload/thumbnail-status/{test_video_material.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["thumbnail_status"] == "completed"
        assert data["has_thumbnail"] is True

    def test_get_thumbnail_status_pending(self, authorized_client: TestClient, test_video_material: Material, test_user: User):
        """Test thumbnail status when thumbnail is pending."""
        test_video_material.uploader_id = test_user.id
        test_video_material.thumbnail_path = None

        response = authorized_client.get(f"/api/v1/upload/thumbnail-status/{test_video_material.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["thumbnail_status"] == "pending"
        assert data["has_thumbnail"] is False

    def test_get_thumbnail_status_not_found(self, authorized_client: TestClient):
        """Test getting thumbnail status for non-existent material."""
        response = authorized_client.get("/api/v1/upload/thumbnail-status/99999")

        assert response.status_code == 404

    def test_get_thumbnail_status_not_uploader(self, authorized_client_2: TestClient, test_video_material: Material):
        """Test getting thumbnail status for material uploaded by another user."""
        response = authorized_client_2.get(f"/api/v1/upload/thumbnail-status/{test_video_material.id}")

        assert response.status_code == 403


class TestDeleteUpload:
    """Tests for upload deletion endpoint."""

    def test_delete_upload_success(self, authorized_client: TestClient, test_video_material: Material, test_user: User, db_session: Session):
        """Test deleting upload as uploader."""
        test_video_material.uploader_id = test_user.id

        with patch('app.routers.upload.get_minio_client') as mock_minio:
            mock_minio_client = Mock()
            mock_minio.return_value = mock_minio_client
            mock_minio_client.delete_file.return_value = None

            response = authorized_client.delete(f"/api/v1/upload/{test_video_material.id}")

        assert response.status_code == 204

        # Verify material is deleted from database
        material = db_session.query(Material).filter(Material.id == test_video_material.id).first()
        assert material is None

    def test_delete_upload_not_found(self, authorized_client: TestClient):
        """Test deleting non-existent upload."""
        response = authorized_client.delete("/api/v1/upload/99999")

        assert response.status_code == 404

    def test_delete_upload_not_uploader(self, authorized_client_2: TestClient, test_video_material: Material):
        """Test deleting upload as non-uploader."""
        response = authorized_client_2.delete(f"/api/v1/upload/{test_video_material.id}")

        assert response.status_code == 403
        data = response.json()
        assert data["error"]["code"] == "FORBIDDEN"

    def test_delete_upload_unauthorized(self, client: TestClient, test_video_material: Material):
        """Test deleting upload without authentication."""
        response = client.delete(f"/api/v1/upload/{test_video_material.id}")

        assert response.status_code == 401


class TestFileValidation:
    """Tests for file validation utilities."""

    def test_validate_video_file(self):
        """Test validation of video files."""
        from app.services.file_validation import validate_upload_file, FileType

        # Mock file with mp4 extension
        mock_file = Mock()
        mock_file.filename = "test_video.mp4"

        result = validate_upload_file(mock_file)

        assert result.is_valid is True
        assert result.file_type == FileType.VIDEO
        assert result.extension == "mp4"

    def test_validate_pdf_file(self):
        """Test validation of PDF files."""
        from app.services.file_validation import validate_upload_file, FileType

        mock_file = Mock()
        mock_file.filename = "test_document.pdf"

        result = validate_upload_file(mock_file)

        assert result.is_valid is True
        assert result.file_type == FileType.PDF
        assert result.extension == "pdf"

    def test_validate_pptx_file(self):
        """Test validation of PPTX files."""
        from app.services.file_validation import validate_upload_file, FileType

        mock_file = Mock()
        mock_file.filename = "test_presentation.pptx"

        result = validate_upload_file(mock_file)

        assert result.is_valid is True
        assert result.file_type == FileType.PPTX
        assert result.extension == "pptx"

    def test_validate_docx_file(self):
        """Test validation of DOCX files."""
        from app.services.file_validation import validate_upload_file, FileType

        mock_file = Mock()
        mock_file.filename = "test_document.docx"

        result = validate_upload_file(mock_file)

        assert result.is_valid is True
        assert result.file_type == FileType.DOCX
        assert result.extension == "docx"

    def test_validate_xlsx_file(self):
        """Test validation of XLSX files."""
        from app.services.file_validation import validate_upload_file, FileType

        mock_file = Mock()
        mock_file.filename = "test_spreadsheet.xlsx"

        result = validate_upload_file(mock_file)

        assert result.is_valid is True
        assert result.file_type == FileType.XLSX
        assert result.extension == "xlsx"

    def test_validate_invalid_file(self):
        """Test validation of invalid file type."""
        from app.services.file_validation import validate_upload_file, ValidationErrorCode

        mock_file = Mock()
        mock_file.filename = "test_file.txt"

        result = validate_upload_file(mock_file)

        assert result.is_valid is False
        assert result.error_code == ValidationErrorCode.UNSUPPORTED_FORMAT

    def test_validate_file_size(self):
        """Test file size validation."""
        from app.services.file_validation import validate_file_with_size, FileType

        mock_file = Mock()
        mock_file.filename = "test.mp4"

        # Valid size (under limit)
        result = validate_file_with_size(mock_file, 1024 * 1024)  # 1MB
        assert result.is_valid is True

    def test_validate_file_size_too_large(self):
        """Test file size validation for oversized file."""
        from app.services.file_validation import validate_file_with_size, ValidationErrorCode

        mock_file = Mock()
        mock_file.filename = "test.mp4"

        # Invalid size (over video limit of 500MB)
        result = validate_file_with_size(mock_file, 600_000_000)

        assert result.is_valid is False
        assert result.error_code == ValidationErrorCode.FILE_TOO_LARGE

    def test_validate_office_file_size_too_large(self):
        """Test file size validation for oversized Office file."""
        from app.services.file_validation import validate_file_with_size, ValidationErrorCode

        mock_file = Mock()
        mock_file.filename = "test.pptx"

        # Invalid size (over office limit of 50MB)
        result = validate_file_with_size(mock_file, 60_000_000)

        assert result.is_valid is False
        assert result.error_code == ValidationErrorCode.FILE_TOO_LARGE

    def test_get_content_type_video(self):
        """Test getting content type for video."""
        from app.services.file_validation import get_content_type, FileType

        content_type = get_content_type(FileType.VIDEO, "mp4")
        assert content_type == "video/mp4"

    def test_get_content_type_pdf(self):
        """Test getting content type for PDF."""
        from app.services.file_validation import get_content_type, FileType

        content_type = get_content_type(FileType.PDF, "pdf")
        assert content_type == "application/pdf"

    def test_get_content_type_pptx(self):
        """Test getting content type for PPTX."""
        from app.services.file_validation import get_content_type, FileType

        content_type = get_content_type(FileType.PPTX, "pptx")
        assert content_type == "application/vnd.openxmlformats-officedocument.presentationml.presentation"

    def test_get_content_type_docx(self):
        """Test getting content type for DOCX."""
        from app.services.file_validation import get_content_type, FileType

        content_type = get_content_type(FileType.DOCX, "docx")
        assert content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

    def test_get_content_type_xlsx(self):
        """Test getting content type for XLSX."""
        from app.services.file_validation import get_content_type, FileType

        content_type = get_content_type(FileType.XLSX, "xlsx")
        assert content_type == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    def test_get_file_extension(self):
        """Test extracting file extension."""
        from app.services.file_validation import get_file_extension

        assert get_file_extension("test_video.mp4") == "mp4"
        assert get_file_extension("test.document.pdf") == "pdf"
        assert get_file_extension("test") == ""

    def test_get_file_extension_uppercase(self):
        """Test extracting uppercase file extension."""
        from app.services.file_validation import get_file_extension

        assert get_file_extension("test_video.MP4") == "mp4"
        assert get_file_extension("test.PDF") == "pdf"
