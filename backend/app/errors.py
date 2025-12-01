"""
Standardized error handling for SaxtonPI API.

All endpoints should use these error responses for consistency.
"""
from enum import Enum
from typing import Optional

from pydantic import BaseModel


class ErrorCode(str, Enum):
    """Standard error codes for API responses."""

    # 400-level errors (client errors)
    INVALID_REQUEST = "INVALID_REQUEST"
    INVALID_TICKER = "INVALID_TICKER"
    INVALID_DATE_RANGE = "INVALID_DATE_RANGE"
    DATA_UNAVAILABLE = "DATA_UNAVAILABLE"  # Ticker not found, no data returned

    # 500-level errors (server/upstream errors)
    UPSTREAM_ERROR = "UPSTREAM_ERROR"  # yfinance/data provider is down
    INTERNAL_ERROR = "INTERNAL_ERROR"


class ApiErrorResponse(BaseModel):
    """
    Standardized error response format for all API endpoints.

    Example:
        {
            "error_code": "UPSTREAM_ERROR",
            "http_status": 503,
            "message": "Market data temporarily unavailable. Please try again shortly.",
            "details": {"ticker": "SPY", "retry_after": 60}
        }
    """
    error_code: str  # Use ErrorCode enum values
    http_status: int
    message: str  # Human-readable message for frontend display
    details: Optional[dict] = None  # Additional context (e.g., failed tickers, retry info)
