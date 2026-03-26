"""
Authentication Tests

Tests for user registration, login, token refresh, and profile management.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User
from app.core.security import verify_password, decode_token


class TestRegister:
    """Tests for user registration endpoint."""

    def test_register_success(self, client: TestClient, db_session: Session):
        """Test successful user registration."""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": "newuser@example.com",
                "name": "New User",
                "password": "securepassword123"
            }
        )

        assert response.status_code == 201
        data = response.json()
        assert "user" in data
        assert data["user"]["email"] == "newuser@example.com"
        assert data["user"]["name"] == "New User"
        assert "id" in data["user"]
        assert "created_at" in data["user"]
        assert "is_active" in data["user"]
        assert "password" not in data["user"]  # password should not be in response
        assert "access_token" in data
        assert "refresh_token" in data

    def test_register_duplicate_email(self, client: TestClient, test_user: User):
        """Test registration with duplicate email."""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": test_user.email,  # Already exists
                "name": "Another User",
                "password": "anotherpassword123"
            }
        )

        assert response.status_code == 400
        data = response.json()
        # Check for error in either format (nested or direct)
        if "error" in data:
            assert data["error"]["code"] == "EMAIL_ALREADY_EXISTS"
        else:
            assert "detail" in data or "email" in str(data).lower()

    def test_register_invalid_email(self, client: TestClient):
        """Test registration with invalid email."""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": "invalid-email",
                "name": "Test User",
                "password": "securepassword123"
            }
        )

        assert response.status_code == 422

    def test_register_short_password(self, client: TestClient):
        """Test registration with password too short."""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": "test@example.com",
                "name": "Test User",
                "password": "short"  # Less than 8 characters
            }
        )

        assert response.status_code == 422

    def test_register_missing_fields(self, client: TestClient):
        """Test registration with missing required fields."""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": "test@example.com"
                # Missing name and password
            }
        )

        assert response.status_code == 422

    def test_register_empty_name(self, client: TestClient):
        """Test registration with empty name."""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": "test@example.com",
                "name": "",
                "password": "securepassword123"
            }
        )

        assert response.status_code == 422


class TestLogin:
    """Tests for user login endpoint."""

    def test_login_success(self, client: TestClient, test_user: User):
        """Test successful login."""
        response = client.post(
            "/api/v1/auth/login",
            json={
                "email": test_user.email,
                "password": "testpassword123"
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert "expires_in" in data
        assert "user" in data
        assert data["user"]["email"] == test_user.email

    def test_login_invalid_email(self, client: TestClient):
        """Test login with non-existent email."""
        response = client.post(
            "/api/v1/auth/login",
            json={
                "email": "nonexistent@example.com",
                "password": "somepassword123"
            }
        )

        assert response.status_code == 401
        data = response.json()
        assert data["error"]["code"] == "INVALID_CREDENTIALS"

    def test_login_invalid_password(self, client: TestClient, test_user: User):
        """Test login with wrong password."""
        response = client.post(
            "/api/v1/auth/login",
            json={
                "email": test_user.email,
                "password": "wrongpassword123"
            }
        )

        assert response.status_code == 401
        data = response.json()
        assert data["error"]["code"] == "INVALID_CREDENTIALS"

    def test_login_missing_fields(self, client: TestClient):
        """Test login with missing fields."""
        response = client.post(
            "/api/v1/auth/login",
            json={
                "email": "test@example.com"
                # Missing password
            }
        )

        assert response.status_code == 422

    def test_login_inactive_user(self, client: TestClient, db_session: Session, test_user: User):
        """Test login with inactive user."""
        # Deactivate user
        test_user.is_active = False
        db_session.commit()

        response = client.post(
            "/api/v1/auth/login",
            json={
                "email": test_user.email,
                "password": "testpassword123"
            }
        )

        # Inactive users get 403 Forbidden (authenticated but not authorized)
        assert response.status_code == 403
        data = response.json()
        assert data["error"]["code"] == "INACTIVE_USER"


class TestRefreshToken:
    """Tests for token refresh endpoint."""

    def test_refresh_token_success(self, client: TestClient, test_user: User):
        """Test successful token refresh."""
        from app.core.security import create_refresh_token

        refresh_token = create_refresh_token(subject=test_user.id)

        response = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh_token}
        )

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

        # Verify new token is valid
        token_data = decode_token(data["access_token"])
        assert token_data is not None
        assert token_data.type == "access"

    def test_refresh_token_invalid(self, client: TestClient):
        """Test refresh with invalid token."""
        response = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": "invalid.token.here"}
        )

        assert response.status_code == 401
        data = response.json()
        assert data["error"]["code"] == "INVALID_TOKEN"

    def test_refresh_token_wrong_type(self, client: TestClient, test_user: User):
        """Test refresh with access token instead of refresh token."""
        from app.core.security import create_access_token

        access_token = create_access_token(subject=test_user.id)

        response = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": access_token}
        )

        assert response.status_code == 401
        data = response.json()
        assert data["error"]["code"] == "INVALID_TOKEN"

    def test_refresh_token_missing(self, client: TestClient):
        """Test refresh without token."""
        response = client.post(
            "/api/v1/auth/refresh",
            json={}
        )

        assert response.status_code == 422

    def test_refresh_token_nonexistent_user(self, client: TestClient):
        """Test refresh with token for non-existent user."""
        from app.core.security import create_refresh_token

        refresh_token = create_refresh_token(subject=99999)  # Non-existent user ID

        response = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh_token}
        )

        assert response.status_code == 401
        data = response.json()
        assert data["error"]["code"] == "USER_NOT_FOUND"


class TestGetMe:
    """Tests for get current user endpoint."""

    def test_get_me_success(self, authorized_client: TestClient, test_user: User):
        """Test getting current user profile."""
        response = authorized_client.get("/api/v1/auth/me")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_user.id
        assert data["email"] == test_user.email
        assert data["name"] == test_user.name
        assert "created_at" in data

    def test_get_me_unauthorized(self, client: TestClient):
        """Test getting current user without authentication."""
        response = client.get("/api/v1/auth/me")

        assert response.status_code == 401
        data = response.json()
        # The API returns INVALID_CREDENTIALS when no credentials are provided
        assert data["error"]["code"] == "INVALID_CREDENTIALS"

    def test_get_me_invalid_token(self, client: TestClient):
        """Test getting current user with invalid token."""
        client.headers = {"Authorization": "Bearer invalid.token.here"}
        response = client.get("/api/v1/auth/me")

        assert response.status_code == 401

    def test_get_me_expired_token(self, client: TestClient, test_user: User):
        """Test getting current user with expired token."""
        from datetime import timedelta
        from app.core.security import create_access_token

        expired_token = create_access_token(
            subject=test_user.id,
            expires_delta=timedelta(seconds=-1)  # Already expired
        )

        client.headers = {"Authorization": f"Bearer {expired_token}"}
        response = client.get("/api/v1/auth/me")

        assert response.status_code == 401


class TestLogout:
    """Tests for logout endpoint."""

    def test_logout_success(self, authorized_client: TestClient):
        """Test logout."""
        response = authorized_client.post("/api/v1/auth/logout")

        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "Successfully logged out" in data["message"]

    def test_logout_unauthorized(self, client: TestClient):
        """Test logout without authentication."""
        response = client.post("/api/v1/auth/logout")

        assert response.status_code == 401


class TestpasswordHashing:
    """Tests for password hashing functionality."""

    def test_password_hashing(self):
        """Test that passwords are properly hashed."""
        from app.core.security import get_password_hash, verify_password

        plain_password = "mySecurepassword123"
        hashed_password = get_password_hash(plain_password)

        # Hash should be different from plain password
        assert hashed_password != plain_password

        # Verification should succeed
        assert verify_password(plain_password, hashed_password) is True

        # Wrong password should fail
        assert verify_password("wrongpassword", hashed_password) is False

    def test_password_hash_different_each_time(self):
        """Test that same password produces different hashes."""
        from app.core.security import get_password_hash

        plain_password = "mySecurepassword123"
        hash1 = get_password_hash(plain_password)
        hash2 = get_password_hash(plain_password)

        # Hashes should be different due to salt
        assert hash1 != hash2

        # But both should verify correctly
        from app.core.security import verify_password
        assert verify_password(plain_password, hash1) is True
        assert verify_password(plain_password, hash2) is True
