"""
Likes Tests

Tests for like/unlike functionality including toggle, count, and status checks.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.material import Material, MaterialStatus, Like


class TestToggleLike:
    """Tests for toggle like endpoint."""

    def test_like_material_success(self, authorized_client: TestClient, test_video_material: Material, db_session: Session):
        """Test liking a material."""
        initial_like_count = test_video_material.like_count

        response = authorized_client.post(f"/api/v1/materials/{test_video_material.id}/like")

        assert response.status_code == 200
        data = response.json()
        assert data["liked"] is True
        # Verify like_count increased by 1 from the initial value
        assert data["like_count"] == initial_like_count + 1

    def test_unlike_material_success(self, authorized_client: TestClient, test_video_material: Material, test_like: Like, db_session: Session):
        """Test unliking a material (toggle off)."""
        # First like exists from fixture
        initial_count = test_video_material.like_count

        response = authorized_client.post(f"/api/v1/materials/{test_video_material.id}/like")

        assert response.status_code == 200
        data = response.json()
        assert data["liked"] is False
        assert data["like_count"] == initial_count - 1

    def test_like_material_not_found(self, authorized_client: TestClient):
        """Test liking non-existent material."""
        response = authorized_client.post("/api/v1/materials/99999/like")

        assert response.status_code == 404
        data = response.json()
        assert data["error"]["code"] == "NOT_FOUND"

    def test_like_material_unauthorized(self, client: TestClient, test_video_material: Material):
        """Test liking without authentication."""
        response = client.post(f"/api/v1/materials/{test_video_material.id}/like")

        assert response.status_code == 401

    def test_like_hidden_material(self, authorized_client: TestClient, test_hidden_material: Material):
        """Test liking a hidden material."""
        response = authorized_client.post(f"/api/v1/materials/{test_hidden_material.id}/like")

        assert response.status_code == 400
        data = response.json()
        assert data["error"]["code"] == "INVALID_STATUS"

    def test_like_processing_material(self, authorized_client: TestClient, test_processing_material: Material):
        """Test liking a processing material."""
        response = authorized_client.post(f"/api/v1/materials/{test_processing_material.id}/like")

        assert response.status_code == 400
        data = response.json()
        assert data["error"]["code"] == "INVALID_STATUS"

    def test_like_material_twice(self, authorized_client: TestClient, test_video_material: Material, db_session: Session):
        """Test liking material twice (should unlike)."""
        # First like
        response1 = authorized_client.post(f"/api/v1/materials/{test_video_material.id}/like")
        assert response1.status_code == 200
        data1 = response1.json()
        assert data1["liked"] is True

        # Second like (should unlike)
        response2 = authorized_client.post(f"/api/v1/materials/{test_video_material.id}/like")
        assert response2.status_code == 200
        data2 = response2.json()
        assert data2["liked"] is False

        # Third like (should like again)
        response3 = authorized_client.post(f"/api/v1/materials/{test_video_material.id}/like")
        assert response3.status_code == 200
        data3 = response3.json()
        assert data3["liked"] is True


class TestLikeCRUD:
    """Tests for like CRUD operations."""

    def test_create_like(self, db_session: Session, test_user: User, test_video_material: Material):
        """Test creating a like."""
        from app.crud.like import create_like

        like = create_like(db_session, test_user.id, test_video_material.id)

        assert like is not None
        assert like.user_id == test_user.id
        assert like.material_id == test_video_material.id

    def test_create_duplicate_like(self, db_session: Session, test_user: User, test_video_material: Material, test_like: Like):
        """Test creating duplicate like returns None."""
        from app.crud.like import create_like

        # test_like already exists from fixture
        like = create_like(db_session, test_user.id, test_video_material.id)

        assert like is None  # Should return None for duplicate

    def test_delete_like(self, db_session: Session, test_user: User, test_video_material: Material, test_like: Like):
        """Test deleting a like."""
        from app.crud.like import delete_like

        result = delete_like(db_session, test_like)

        assert result is True

        # Verify like is deleted
        like = db_session.query(Like).filter(Like.id == test_like.id).first()
        assert like is None

    def test_delete_like_by_user_and_material(self, db_session: Session, test_user: User, test_video_material: Material, test_like: Like):
        """Test deleting like by user and material IDs."""
        from app.crud.like import delete_like_by_user_and_material

        result = delete_like_by_user_and_material(
            db_session, test_user.id, test_video_material.id
        )

        assert result is True

    def test_delete_nonexistent_like(self, db_session: Session, test_user_2: User, test_video_material: Material):
        """Test deleting non-existent like returns False."""
        from app.crud.like import delete_like_by_user_and_material

        result = delete_like_by_user_and_material(
            db_session, test_user_2.id, test_video_material.id
        )

        assert result is False

    def test_get_like_by_user_and_material(self, db_session: Session, test_user: User, test_video_material: Material, test_like: Like):
        """Test getting like by user and material."""
        from app.crud.like import get_like_by_user_and_material

        like = get_like_by_user_and_material(
            db_session, test_user.id, test_video_material.id
        )

        assert like is not None
        assert like.id == test_like.id

    def test_get_like_not_found(self, db_session: Session, test_user_2: User, test_video_material: Material):
        """Test getting non-existent like."""
        from app.crud.like import get_like_by_user_and_material

        like = get_like_by_user_and_material(
            db_session, test_user_2.id, test_video_material.id
        )

        assert like is None

    def test_get_like_count(self, db_session: Session, test_video_material: Material, test_like: Like):
        """Test getting like count for material."""
        from app.crud.like import get_like_count_by_material

        count = get_like_count_by_material(db_session, test_video_material.id)

        assert count >= 1  # At least our test like

    def test_check_user_liked_true(self, db_session: Session, test_user: User, test_video_material: Material, test_like: Like):
        """Test checking if user liked material (true case)."""
        from app.crud.like import check_user_liked

        result = check_user_liked(db_session, test_user.id, test_video_material.id)

        assert result is True

    def test_check_user_liked_false(self, db_session: Session, test_user_2: User, test_video_material: Material):
        """Test checking if user liked material (false case)."""
        from app.crud.like import check_user_liked

        result = check_user_liked(db_session, test_user_2.id, test_video_material.id)

        assert result is False

    def test_toggle_like_create(self, db_session: Session, test_user_2: User, test_video_material: Material):
        """Test toggle like creates new like."""
        from app.crud.like import toggle_like

        initial_count = test_video_material.like_count

        is_liked, like_count = toggle_like(
            db_session, test_user_2.id, test_video_material.id
        )

        assert is_liked is True
        assert like_count == initial_count + 1

    def test_toggle_like_delete(self, db_session: Session, test_user: User, test_video_material: Material, test_like: Like):
        """Test toggle like deletes existing like."""
        from app.crud.like import toggle_like

        initial_count = test_video_material.like_count

        is_liked, like_count = toggle_like(
            db_session, test_user.id, test_video_material.id
        )

        assert is_liked is False
        assert like_count == initial_count - 1

    def test_toggle_like_material_not_found(self, db_session: Session, test_user: User):
        """Test toggle like for non-existent material."""
        from app.crud.like import toggle_like

        with pytest.raises(ValueError) as exc_info:
            toggle_like(db_session, test_user.id, 99999)

        assert "not found" in str(exc_info.value)

    def test_get_user_liked_material_ids(self, db_session: Session, test_user: User, test_video_material: Material, test_pdf_material: Material, test_like: Like):
        """Test getting all liked material IDs for user."""
        from app.crud.like import get_user_liked_material_ids

        liked_ids = get_user_liked_material_ids(
            db_session,
            test_user.id,
            [test_video_material.id, test_pdf_material.id]
        )

        assert test_video_material.id in liked_ids
        assert test_pdf_material.id not in liked_ids

    def test_get_user_liked_material_ids_empty(self, db_session: Session, test_user: User):
        """Test getting liked material IDs with empty list."""
        from app.crud.like import get_user_liked_material_ids

        liked_ids = get_user_liked_material_ids(db_session, test_user.id, [])

        assert liked_ids == set()


class TestLikeInMaterialList:
    """Tests for like status in material list."""

    def test_material_list_shows_is_liked(self, authorized_client: TestClient, test_video_material: Material, test_like: Like):
        """Test that material list shows is_liked for authenticated user."""
        response = authorized_client.get("/api/v1/materials")

        assert response.status_code == 200
        data = response.json()

        # Find our test material in the list
        material = next((m for m in data["items"] if m["id"] == test_video_material.id), None)
        assert material is not None
        assert material["is_liked_by_me"] is True

    def test_material_list_shows_not_liked(self, authorized_client_2: TestClient, test_video_material: Material):
        """Test that material list shows is_liked=False when not liked."""
        response = authorized_client_2.get("/api/v1/materials")

        assert response.status_code == 200
        data = response.json()

        material = next((m for m in data["items"] if m["id"] == test_video_material.id), None)
        assert material is not None
        assert material["is_liked_by_me"] is False

    def test_material_list_anonymous_no_is_liked(self, client: TestClient, test_video_material: Material):
        """Test that material list for anonymous user has is_liked=False."""
        response = client.get("/api/v1/materials")

        assert response.status_code == 200
        data = response.json()

        material = next((m for m in data["items"] if m["id"] == test_video_material.id), None)
        assert material is not None
        assert material["is_liked_by_me"] is False


class TestLikeCountConsistency:
    """Tests for like count consistency."""

    def test_like_count_increments_correctly(self, authorized_client: TestClient, test_video_material: Material, db_session: Session):
        """Test that like count increments correctly."""
        initial_count = test_video_material.like_count

        # Like the material
        response = authorized_client.post(f"/api/v1/materials/{test_video_material.id}/like")
        assert response.status_code == 200

        # Refresh from database
        db_session.refresh(test_video_material)

        # Verify count incremented
        assert test_video_material.like_count == initial_count + 1

    def test_like_count_decrements_correctly(self, authorized_client: TestClient, test_video_material: Material, test_like: Like, db_session: Session):
        """Test that like count decrements correctly."""
        initial_count = test_video_material.like_count

        # Unlike the material (toggle off)
        response = authorized_client.post(f"/api/v1/materials/{test_video_material.id}/like")
        assert response.status_code == 200

        # Refresh from database
        db_session.refresh(test_video_material)

        # Verify count decremented
        assert test_video_material.like_count == initial_count - 1

    def test_like_count_never_negative(self, db_session: Session, test_video_material: Material, test_user: User):
        """Test that like count never goes below zero."""
        from app.crud.material import decrement_like_count

        # Set count to 0
        test_video_material.like_count = 0
        db_session.commit()

        # Try to decrement
        updated = decrement_like_count(db_session, test_video_material)

        # Should stay at 0
        assert updated.like_count == 0
