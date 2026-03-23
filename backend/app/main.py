"""
AI Learning Platform API - Main Application

FastAPI application entry point with all configurations and route registrations.
"""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import engine, Base, SessionLocal
from app.core.init_db import init_db
from app.core.storage import minio_client
from app.core.scheduler import init_scheduler, start_scheduler, shutdown_scheduler
from app.core.logging import setup_logging, get_logger


# Create all database tables on startup (for development only, use Alembic in production)
def create_tables():
    """Create database tables if they don't exist."""
    Base.metadata.create_all(bind=engine)


def init_database():
    """Initialize database with default data."""
    db = SessionLocal()
    try:
        init_db(db)
    finally:
        db.close()


def init_storage():
    """Initialize MinIO storage bucket and placeholder thumbnail."""
    try:
        minio_client.ensure_bucket_exists()

        # Initialize placeholder thumbnail
        from app.services.thumbnail_service import ensure_placeholder_thumbnail
        ensure_placeholder_thumbnail()
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f"Failed to initialize MinIO bucket: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan context manager.

    Handles startup and shutdown events.
    """
    # Initialize logging first
    setup_logging()
    logger = get_logger(__name__)
    logger.info("Application starting up...")

    # Startup
    if settings.debug:
        create_tables()
        init_database()
        init_storage()

    # Initialize and start scheduler
    init_scheduler()
    start_scheduler()

    logger.info("Application startup complete")

    yield

    # Shutdown
    logger.info("Application shutting down...")
    shutdown_scheduler()
    logger.info("Application shutdown complete")


app = FastAPI(
    title=settings.app_name,
    description="Backend API for AI Teaching Display Platform",
    version=settings.app_version,
    debug=settings.debug,
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


# Import HTTPException for specific handling
from fastapi import HTTPException


# Custom exception handler for unified error responses
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """
    Handler for HTTPException to ensure consistent error response format.

    If the exception detail already contains an 'error' object, use it directly.
    Otherwise, wrap it in the standard error format.
    """
    # Check if detail already contains our error format
    if isinstance(exc.detail, dict) and "error" in exc.detail:
        return JSONResponse(
            status_code=exc.status_code,
            content=exc.detail
        )

    # Map status codes to error codes
    error_code_map = {
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        422: "VALIDATION_ERROR",
        429: "RATE_LIMIT_EXCEEDED",
    }

    error_code = error_code_map.get(exc.status_code, "INTERNAL_ERROR")
    message = str(exc.detail) if isinstance(exc.detail, str) else "An error occurred"
    details = {"errors": exc.detail} if isinstance(exc.detail, list) else {}

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": error_code,
                "message": message,
                "details": details
            }
        }
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Global exception handler for unified error response format.

    Returns errors in the format:
    {
        "error": {
            "code": "ERROR_CODE",
            "message": "Human readable message",
            "details": {}
        }
    }
    """
    error_code = "INTERNAL_ERROR"
    status_code = 500
    message = "An internal server error occurred"
    details = {}

    # Handle specific exception types
    if hasattr(exc, "status_code"):
        status_code = exc.status_code
        if status_code == 401:
            error_code = "UNAUTHORIZED"
            message = "Authentication required"
        elif status_code == 403:
            error_code = "FORBIDDEN"
            message = "Access denied"
        elif status_code == 404:
            error_code = "NOT_FOUND"
            message = "Resource not found"
        elif status_code == 422:
            error_code = "VALIDATION_ERROR"
            message = "Validation failed"
            if hasattr(exc, "detail"):
                details = {"errors": exc.detail}
        elif status_code == 429:
            error_code = "RATE_LIMIT_EXCEEDED"
            message = "Too many requests"

    # In debug mode, include more details
    if settings.debug:
        details["exception"] = str(exc)
        details["type"] = type(exc).__name__

    return JSONResponse(
        status_code=status_code,
        content={
            "error": {
                "code": error_code,
                "message": message,
                "details": details
            }
        }
    )


# Import and include routers
from app.routers import auth, upload, materials, admin
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(upload.router, prefix="/api/v1/upload", tags=["Upload"])
app.include_router(materials.router, prefix="/api/v1/materials", tags=["Materials"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["Admin"])


@app.get("/")
async def root():
    """Root endpoint - API information."""
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "environment": settings.environment,
        "docs_url": "/docs" if settings.debug else None
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": settings.app_version,
        "environment": settings.environment
    }


@app.get("/api/v1/health/db")
async def db_health_check():
    """Database health check endpoint."""
    try:
        # Test database connection
        from sqlalchemy import text
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            result.scalar()
        return {
            "status": "healthy",
            "database": "connected"
        }
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={
                "error": {
                    "code": "DATABASE_ERROR",
                    "message": "Database connection failed",
                    "details": {"error": str(e)} if settings.debug else {}
                }
            }
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug
    )
