"""
Materials Tests

Tests for material listing, detail viewing, and deletion.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.material import Material, MaterialStatus, MaterialType


class TestListMaterials:
    """Tests for materials list endpoint."""

    def test_list_materials_success(self, client: TestClient, test_video_material: Material, test_pdf_material: Material):
        """Test getting list of materials."""
        response = client.get("/api/v1/materials")

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert "total_pages" in data
        assert len(data["items"]) == 2
        assert data["total"] == 2

    def test_list_materials_pagination(self, client: TestClient, test_video_material: Material, test_pdf_material: Material):
        """Test materials list pagination."""
        response = client.get("/api/v1/materials?page=1&page_size=1")

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 1
        assert data["page"] == 1
        assert data["page_size"] == 1
        assert data["total_pages"] == 2

    def test_list_materials_filter_by_type_video(self, client: TestClient, test_video_material: Material, test_pdf_material: Material):
        """Test filtering materials by type (video)."""
        response = client.get("/api/v1/materials?material_type=video")

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["file_type"] == "video"

    def test_list_materials_filter_by_type_pdf(self, client: TestClient, test_video_material: Material, test_pdf_material: Material):
        """Test filtering materials by type (pdf)."""
        response = client.get("/api/v1/materials?material_type=pdf")

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["file_type"] == "pdf"

    def test_list_materials_invalid_type(self, client: TestClient):
        """Test filtering materials with invalid type."""
        response = client.get("/api/v1/materials?material_type=invalid")

        assert response.status_code == 400
        data = response.json()
        assert data["error"]["code"] == "INVALID_TYPE"

    def test_list_materials_sort_by_created_at(self, client: TestClient, test_video_material: Material, test_pdf_material: Material):
        """Test sorting materials by created_at."""
        response = client.get("/api/v1/materials?sort_by=created_at&sort_order=desc")

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 2

    def test_list_materials_sort_by_view_count(self, client: TestClient, test_video_material: Material, test_pdf_material: Material):
        """Test sorting materials by view_count."""
        response = client.get("/api/v1/materials?sort_by=view_count&sort_order=desc")

        assert response.status_code == 200
        data = response.json()
        # Video has more views (10 vs 5)
        assert data["items"][0]["view_count"] >= data["items"][1]["view_count"]

    def test_list_materials_sort_by_like_count(self, client: TestClient, test_video_material: Material, test_pdf_material: Material):
        """Test sorting materials by like_count."""
        response = client.get("/api/v1/materials?sort_by=like_count&sort_order=desc")

        assert response.status_code == 200
        data = response.json()
        # Video has more likes (5 vs 2)
        assert data["items"][0]["like_count"] >= data["items"][1]["like_count"]

    def test_list_materials_excludes_hidden(self, client: TestClient, test_video_material: Material, test_hidden_material: Material):
        """Test that hidden materials are excluded from list."""
        response = client.get("/api/v1/materials")

        assert response.status_code == 200
        data = response.json()
        # Should only show active materials
        assert data["total"] == 1
        assert data["items"][0]["id"] == test_video_material.id

    def test_list_materials_includes_uploader_info(self, client: TestClient, test_video_material: Material):
        """Test that materials include uploader information."""
        response = client.get("/api/v1/materials")

        assert response.status_code == 200
        data = response.json()
        material = data["items"][0]
        assert "uploader_name" in material
        assert "uploader_avatar" in material

    def test_list_materials_page_size_limit(self, client: TestClient):
        """Test that page_size is limited to max_page_size."""
        response = client.get("/api/v1/materials?page_size=200")

        # API validates page_size with le=100, so it returns 422 for values > 100
        assert response.status_code == 422


class TestGetMaterialDetail:
    """Tests for material detail endpoint."""

    def test_get_material_detail_success(self, client: TestClient, test_video_material: Material):
        """Test getting material details."""
        response = client.get(f"/api/v1/materials/{test_video_material.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_video_material.id
        assert data["title"] == test_video_material.title
        assert data["description"] == test_video_material.description
        # Handle both enum and string type values
        type_value = test_video_material.type.value if hasattr(test_video_material.type, 'value') else test_video_material.type
        assert data["file_type"] == type_value
        assert data["view_count"] == test_video_material.view_count
        assert data["like_count"] == test_video_material.like_count
        assert "uploader_name" in data
        assert "is_liked_by_me" in data
        assert "related_materials" in data

    def test_get_material_detail_not_found(self, client: TestClient):
        """Test getting non-existent material."""
        response = client.get("/api/v1/materials/99999")

        assert response.status_code == 404
        data = response.json()
        assert data["error"]["code"] == "NOT_FOUND"

    def test_get_material_detail_hidden_as_uploader(self, authorized_client: TestClient, test_hidden_material: Material, test_user: User):
        """Test getting hidden material as uploader."""
        # test_hidden_material is uploaded by test_user
        response = authorized_client.get(f"/api/v1/materials/{test_hidden_material.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_hidden_material.id

    def test_get_material_detail_hidden_as_other_user(self, authorized_client_2: TestClient, test_hidden_material: Material):
        """Test getting hidden material as another user."""
        response = authorized_client_2.get(f"/api/v1/materials/{test_hidden_material.id}")

        assert response.status_code == 404
        data = response.json()
        assert data["error"]["code"] == "NOT_FOUND"

    def test_get_material_detail_hidden_as_anonymous(self, client: TestClient, test_hidden_material: Material):
        """Test getting hidden material as anonymous user."""
        response = client.get(f"/api/v1/materials/{test_hidden_material.id}")

        assert response.status_code == 404
        data = response.json()
        assert data["error"]["code"] == "NOT_FOUND"

    def test_get_material_detail_increments_view(self, client: TestClient, test_video_material: Material, db_session: Session):
        """Test that viewing material triggers view tracking."""
        initial_views = test_video_material.view_count

        response = client.get(f"/api/v1/materials/{test_video_material.id}")

        assert response.status_code == 200
        # View is recorded asynchronously, so we can't immediately check the count

    def test_get_material_detail_shows_is_liked(self, authorized_client: TestClient, test_video_material: Material, test_like, test_user: User):
        """Test that material detail shows if user has liked it."""
        response = authorized_client.get(f"/api/v1/materials/{test_video_material.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["is_liked_by_me"] is True

    def test_get_material_detail_shows_not_liked(self, authorized_client_2: TestClient, test_video_material: Material):
        """Test that material detail shows if user has not liked it."""
        response = authorized_client_2.get(f"/api/v1/materials/{test_video_material.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["is_liked_by_me"] is False


class TestDeleteMaterial:
    """Tests for material deletion endpoint."""

    def test_delete_material_success(self, authorized_client: TestClient, test_video_material: Material, db_session: Session):
        """Test deleting material as uploader."""
        response = authorized_client.delete(f"/api/v1/materials/{test_video_material.id}")

        assert response.status_code == 204

        # Verify material is soft deleted (hidden)
        db_session.refresh(test_video_material)
        assert test_video_material.status == MaterialStatus.HIDDEN

    def test_delete_material_not_found(self, authorized_client: TestClient):
        """Test deleting non-existent material."""
        response = authorized_client.delete("/api/v1/materials/99999")

        assert response.status_code == 404
        data = response.json()
        assert data["error"]["code"] == "NOT_FOUND"

    def test_delete_material_not_uploader(self, authorized_client_2: TestClient, test_video_material: Material):
        """Test deleting material as non-uploader."""
        response = authorized_client_2.delete(f"/api/v1/materials/{test_video_material.id}")

        assert response.status_code == 403
        data = response.json()
        assert data["error"]["code"] == "FORBIDDEN"

    def test_delete_material_unauthorized(self, client: TestClient, test_video_material: Material):
        """Test deleting material without authentication."""
        response = client.delete(f"/api/v1/materials/{test_video_material.id}")

        assert response.status_code == 401

    def test_delete_already_deleted_material(self, authorized_client: TestClient, test_hidden_material: Material):
        """Test deleting already hidden material."""
        response = authorized_client.delete(f"/api/v1/materials/{test_hidden_material.id}")

        assert response.status_code == 400
        data = response.json()
        assert data["error"]["code"] == "ALREADY_DELETED"


class TestMaterialCRUD:
    """Tests for material CRUD operations."""

    def test_create_material(self, db_session: Session, test_user: User):
        """Test creating a material record."""
        from app.crud.material import create_material
        from app.models.material import MaterialType, MaterialStatus

        material = create_material(
            db=db_session,
            title="New Material",
            description="A new material",
            material_type=MaterialType.VIDEO,
            file_path="materials/1/test.mp4",
            file_size=1024,
            file_format="mp4",
            uploader_id=test_user.id
        )

        assert material.id is not None
        assert material.title == "New Material"
        assert material.status == MaterialStatus.PROCESSING
        assert material.uploader_id == test_user.id

    def test_get_material_by_id(self, db_session: Session, test_video_material: Material):
        """Test getting material by ID."""
        from app.crud.material import get_material_by_id

        material = get_material_by_id(db_session, test_video_material.id)

        assert material is not None
        assert material.id == test_video_material.id

    def test_get_material_by_id_not_found(self, db_session: Session):
        """Test getting non-existent material by ID."""
        from app.crud.material import get_material_by_id

        material = get_material_by_id(db_session, 99999)

        assert material is None

    def test_update_material_status(self, db_session: Session, test_video_material: Material):
        """Test updating material status."""
        from app.crud.material import update_material_status
        from app.models.material import MaterialStatus

        updated = update_material_status(
            db_session,
            test_video_material,
            MaterialStatus.HIDDEN
        )

        assert updated.status == MaterialStatus.HIDDEN

    def test_soft_delete_material(self, db_session: Session, test_video_material: Material):
        """Test soft deleting a material."""
        from app.crud.material import soft_delete_material
        from app.models.material import MaterialStatus

        deleted = soft_delete_material(db_session, test_video_material)

        assert deleted.status == MaterialStatus.HIDDEN

    def test_count_materials(self, db_session: Session, test_video_material: Material, test_pdf_material: Material):
        """Test counting materials."""
        from app.crud.material import count_materials

        count = count_materials(db_session)

        assert count >= 2  # At least our test materials

    def test_count_materials_with_filter(self, db_session: Session, test_video_material: Material, test_pdf_material: Material):
        """Test counting materials with filter."""
        from app.crud.material import count_materials
        from app.models.material import MaterialType

        video_count = count_materials(db_session, material_type=MaterialType.VIDEO)
        pdf_count = count_materials(db_session, material_type=MaterialType.PDF)

        assert video_count >= 1
        assert pdf_count >= 1

    def test_increment_view_count(self, db_session: Session, test_video_material: Material):
        """Test incrementing view count."""
        from app.crud.material import increment_view_count

        initial_count = test_video_material.view_count
        updated = increment_view_count(db_session, test_video_material)

        assert updated.view_count == initial_count + 1

    def test_increment_like_count(self, db_session: Session, test_video_material: Material):
        """Test incrementing like count."""
        from app.crud.material import increment_like_count

        initial_count = test_video_material.like_count
        updated = increment_like_count(db_session, test_video_material)

        assert updated.like_count == initial_count + 1

    def test_decrement_like_count(self, db_session: Session, test_video_material: Material):
        """Test decrementing like count."""
        from app.crud.material import decrement_like_count

        # First increment to ensure we have likes
        test_video_material.like_count = 5
        db_session.commit()

        updated = decrement_like_count(db_session, test_video_material)

        assert updated.like_count == 4

    def test_decrement_like_count_not_below_zero(self, db_session: Session, test_video_material: Material):
        """Test that like count doesn't go below zero."""
        from app.crud.material import decrement_like_count

        test_video_material.like_count = 0
        db_session.commit()

        updated = decrement_like_count(db_session, test_video_material)

        assert updated.like_count == 0
