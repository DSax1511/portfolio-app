"""
Unified Error Response Schema

Provides consistent error format across all API endpoints.
Errors include: error code, message, and optional details for debugging.
"""

from enum import Enum
from typing import Optional, Any
from pydantic import BaseModel


class ErrorCode(str, Enum):
    """Standard error codes for API responses."""
    # Client errors (4xx)
    INVALID_REQUEST = "INVALID_REQUEST"
    INVALID_TICKER = "INVALID_TICKER"
    INVALID_WEIGHTS = "INVALID_WEIGHTS"
    INVALID_DATE_RANGE = "INVALID_DATE_RANGE"
    MISSING_PARAMETER = "MISSING_PARAMETER"
    UNAUTHORIZED = "UNAUTHORIZED"
    FORBIDDEN = "FORBIDDEN"
    NOT_FOUND = "NOT_FOUND"
    
    # Server errors (5xx)
    DATA_UNAVAILABLE = "DATA_UNAVAILABLE"
    COMPUTATION_FAILED = "COMPUTATION_FAILED"
    OPTIMIZATION_FAILED = "OPTIMIZATION_FAILED"
    BACKTEST_FAILED = "BACKTEST_FAILED"
    INTERNAL_ERROR = "INTERNAL_ERROR"


class ApiErrorResponse(BaseModel):
    """Unified API error response schema."""
    error_code: ErrorCode
    message: str
    status_code: int
    details: Optional[Any] = None
    
    class Config:
        schema_extra = {
            "example": {
                "error_code": "INVALID_TICKER",
                "message": "Ticker INVALID does not have sufficient data",
                "status_code": 400,
                "details": {"ticker": "INVALID", "min_data_points": 252}
            }
        }


def error_response(
    error_code: ErrorCode,
    message: str,
    status_code: int,
    details: Optional[Any] = None
) -> ApiErrorResponse:
    """Construct standardized error response."""
    return ApiErrorResponse(
        error_code=error_code,
        message=message,
        status_code=status_code,
        details=details
    )
