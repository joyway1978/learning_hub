"""
Logging Configuration Module

Configures Python logging with rotating file handlers for production use.
Supports both console and file output with different log levels.
"""

import logging
import logging.handlers
import os
import sys
from pathlib import Path
from typing import Optional

from app.config import settings


# Log formatters
DETAILED_FORMATTER = logging.Formatter(
    fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(filename)s:%(lineno)d | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)

SIMPLE_FORMATTER = logging.Formatter(
    fmt="%(asctime)s | %(levelname)-8s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)

JSON_FORMATTER = logging.Formatter(
    fmt='{"timestamp": "%(asctime)s", "level": "%(levelname)s", "logger": "%(name)s", "message": "%(message)s"}',
    datefmt="%Y-%m-%d %H:%M:%S"
)


def get_logs_directory() -> Path:
    """
    Get or create the logs directory.

    Returns:
        Path to the logs directory
    """
    # Get the backend directory (parent of app)
    backend_dir = Path(__file__).parent.parent.parent
    logs_dir = backend_dir / "logs"

    # Create logs directory if it doesn't exist
    logs_dir.mkdir(parents=True, exist_ok=True)

    return logs_dir


def setup_logging(
    log_level: Optional[str] = None,
    log_to_file: bool = True,
    max_bytes: int = 10 * 1024 * 1024,  # 10MB
    backup_count: int = 5
) -> logging.Logger:
    """
    Set up application logging with rotating file handlers.

    Args:
        log_level: Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL).
                   Defaults to DEBUG in debug mode, INFO otherwise.
        log_to_file: Whether to log to file (default: True)
        max_bytes: Maximum size of each log file before rotation
        backup_count: Number of backup files to keep

    Returns:
        Root application logger
    """
    # Determine log level
    if log_level is None:
        log_level = "DEBUG" if settings.debug else "INFO"

    level = getattr(logging, log_level.upper(), logging.INFO)

    # Get root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(level)

    # Remove existing handlers to avoid duplicates
    root_logger.handlers.clear()

    # Console handler - always add
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)
    console_handler.setFormatter(DETAILED_FORMATTER)
    root_logger.addHandler(console_handler)

    # File handlers - add if enabled
    if log_to_file:
        logs_dir = get_logs_directory()

        # Main application log (rotating)
        app_log_path = logs_dir / "app.log"
        file_handler = logging.handlers.RotatingFileHandler(
            filename=app_log_path,
            maxBytes=max_bytes,
            backupCount=backup_count,
            encoding="utf-8"
        )
        file_handler.setLevel(level)
        file_handler.setFormatter(DETAILED_FORMATTER)
        root_logger.addHandler(file_handler)

        # Error log (separate file for errors)
        error_log_path = logs_dir / "error.log"
        error_handler = logging.handlers.RotatingFileHandler(
            filename=error_log_path,
            maxBytes=max_bytes,
            backupCount=backup_count,
            encoding="utf-8"
        )
        error_handler.setLevel(logging.ERROR)
        error_handler.setFormatter(DETAILED_FORMATTER)
        root_logger.addHandler(error_handler)

    # Create application logger
    app_logger = logging.getLogger("app")
    app_logger.info(f"Logging initialized at level {log_level}")

    return app_logger


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger with the specified name.

    This is a convenience function that returns a logger
    that is a child of the 'app' logger.

    Args:
        name: Logger name (usually __name__)

    Returns:
        Configured logger instance
    """
    return logging.getLogger(f"app.{name}")


# Audit logger for security-related events
def get_audit_logger() -> logging.Logger:
    """
    Get the audit logger for security-related events.

    Audit logs include authentication, authorization, and data access events.

    Returns:
        Audit logger instance
    """
    audit_logger = logging.getLogger("app.audit")

    # Ensure audit log file handler exists
    if not any(isinstance(h, logging.handlers.RotatingFileHandler) and "audit" in str(h.baseFilename)
               for h in audit_logger.handlers):
        logs_dir = get_logs_directory()
        audit_log_path = logs_dir / "audit.log"
        audit_handler = logging.handlers.RotatingFileHandler(
            filename=audit_log_path,
            maxBytes=10 * 1024 * 1024,  # 10MB
            backupCount=10,  # Keep more audit logs
            encoding="utf-8"
        )
        audit_handler.setLevel(logging.INFO)
        audit_handler.setFormatter(DETAILED_FORMATTER)
        audit_logger.addHandler(audit_handler)
        audit_logger.setLevel(logging.INFO)

    return audit_logger


# Performance logger for timing and performance metrics
def get_perf_logger() -> logging.Logger:
    """
    Get the performance logger for timing and metrics.

    Returns:
        Performance logger instance
    """
    perf_logger = logging.getLogger("app.performance")

    # Ensure performance log file handler exists
    if not any(isinstance(h, logging.handlers.RotatingFileHandler) and "performance" in str(h.baseFilename)
               for h in perf_logger.handlers):
        logs_dir = get_logs_directory()
        perf_log_path = logs_dir / "performance.log"
        perf_handler = logging.handlers.RotatingFileHandler(
            filename=perf_log_path,
            maxBytes=10 * 1024 * 1024,  # 10MB
            backupCount=3,
            encoding="utf-8"
        )
        perf_handler.setLevel(logging.DEBUG)
        perf_handler.setFormatter(DETAILED_FORMATTER)
        perf_logger.addHandler(perf_handler)
        perf_logger.setLevel(logging.DEBUG)

    return perf_logger
