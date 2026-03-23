"""
Authentication Router Module

Provides API endpoints for user authentication including registration, login,
token refresh, and user profile management.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    verify_token_type,
)
from app.crud.user import (
    authenticate_user_or_raise,
    check_email_exists,
    create_user,
    get_user_by_email,
)
from app.database import get_db
from app.dependencies.auth import get_current_active_user, get_current_user
from app.models.user import User
from app.schemas.user import (
    LoginRequest,
    Token,
    UserCreate,
    UserResponse,
)
from app.core.logging import get_logger, get_audit_logger

router = APIRouter(tags=["Authentication"])
security = HTTPBearer()

# Initialize loggers
logger = get_logger(__name__)
audit_logger = get_audit_logger()


class TokenResponse(Token):
    """Token response with refresh token and user info."""
    refresh_token: str
    user: UserResponse


class RefreshRequest(BaseModel):
    """Request model for token refresh."""
    refresh_token: str


class RefreshResponse(BaseModel):
    """Response model for token refresh."""
    access_token: str
    refresh_token: str
    token_type: str


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
    description="Create a new user account with email, name, and password."
)
async def register(
    user_data: UserCreate,
    db: Session = Depends(get_db)
) -> UserResponse:
    """
    Register a new user.

    - **email**: User email address (must be unique)
    - **name**: Display name
    - **password**: Password (minimum 8 characters)

    Returns the created user information.

    Raises:
        HTTPException 400: If email already exists
    """
    # Check if email already exists
    if check_email_exists(db, user_data.email):
        audit_logger.warning(f"Registration failed: email already exists - {user_data.email}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": {
                    "code": "EMAIL_ALREADY_EXISTS",
                    "message": "邮箱已被注册",
                    "details": {"email": user_data.email}
                }
            }
        )

    # Create new user
    user = create_user(db, user_data)
    audit_logger.info(f"User registered successfully: user_id={user.id}, email={user.email}")
    logger.info(f"New user registered: {user.email} (ID: {user.id})")

    return UserResponse.model_validate(user)


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="User login",
    description="Authenticate user and return access token and refresh token."
)
async def login(
    login_data: LoginRequest,
    db: Session = Depends(get_db)
) -> TokenResponse:
    """
    User login.

    - **email**: User email address
    - **password**: User password

    Returns access token, refresh token, and user information.

    Raises:
        HTTPException 401: If email or password is incorrect
    """
    # Authenticate user
    try:
        user = authenticate_user_or_raise(
            db,
            email=login_data.email,
            password=login_data.password
        )
    except HTTPException as e:
        audit_logger.warning(f"Login failed for email: {login_data.email}, error: {e.detail}")
        logger.warning(f"Failed login attempt: {login_data.email}")
        raise

    # Create tokens
    access_token = create_access_token(subject=user.id)
    refresh_token = create_refresh_token(subject=user.id)

    audit_logger.info(f"User logged in: user_id={user.id}, email={user.email}")
    logger.info(f"User logged in: {user.email} (ID: {user.id})")

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.access_token_expire_minutes * 60,
        user=UserResponse.model_validate(user)
    )


@router.post(
    "/refresh",
    response_model=RefreshResponse,
    summary="Refresh access token",
    description="Get a new access token using a valid refresh token."
)
async def refresh_token(
    refresh_request: RefreshRequest,
    db: Session = Depends(get_db)
) -> RefreshResponse:
    """
    Refresh access token.

    - **refresh_token**: Valid refresh token from login

    Returns new access token and refresh token.

    Raises:
        HTTPException 401: If refresh token is invalid or expired
    """
    # Verify refresh token
    token_data = verify_token_type(refresh_request.refresh_token, "refresh")

    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": {
                    "code": "INVALID_TOKEN",
                    "message": "Refresh token无效或已过期",
                    "details": {}
                }
            },
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Get user from token
    try:
        user_id = int(token_data.sub) if token_data.sub else None
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": {
                    "code": "INVALID_TOKEN",
                    "message": "Invalid token payload",
                    "details": {}
                }
            },
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": {
                    "code": "INVALID_TOKEN",
                    "message": "Token missing subject",
                    "details": {}
                }
            },
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verify user exists and is active
    from app.crud.user import get_user_by_id
    user = get_user_by_id(db, user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": {
                    "code": "USER_NOT_FOUND",
                    "message": "User not found",
                    "details": {}
                }
            },
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": {
                    "code": "INACTIVE_USER",
                    "message": "User account is inactive",
                    "details": {}
                }
            }
        )

    # Create new tokens (token rotation)
    new_access_token = create_access_token(subject=user.id)
    new_refresh_token = create_refresh_token(subject=user.id)

    return RefreshResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        token_type="bearer"
    )


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current user",
    description="Get the current authenticated user's profile."
)
async def get_me(
    current_user: User = Depends(get_current_active_user)
) -> UserResponse:
    """
    Get current user profile.

    Requires authentication via Bearer token.

    Returns current user information.
    """
    return UserResponse.model_validate(current_user)


@router.post(
    "/logout",
    summary="User logout",
    description="Logout the current user (client should discard tokens)."
)
async def logout(
    current_user: User = Depends(get_current_user)
) -> dict:
    """
    User logout.

    Note: JWT tokens are stateless, so server-side logout is limited.
    The client should discard the tokens.

    Requires authentication via Bearer token.

    Returns success message.
    """
    # Log the logout event
    audit_logger.info(f"User logged out: user_id={current_user.id}, email={current_user.email}")
    logger.info(f"User logged out: {current_user.email} (ID: {current_user.id})")

    # In a more advanced implementation, you could:
    # 1. Add tokens to a blacklist (requires Redis/cache)
    # 2. Track token jti and revoke them
    # For now, we just acknowledge the logout

    return {
        "message": "Successfully logged out",
        "detail": "Please discard your tokens on the client side"
    }
