"""
Rate Limiting Middleware

Implements per-endpoint rate limiting to protect against:
- Resource exhaustion (expensive backtests, optimizations)
- DoS attacks
- Runaway computations

Uses in-memory bucket for simplicity. For production, integrate Redis.
"""

from datetime import datetime, timedelta
from typing import Dict, Tuple
from fastapi import HTTPException, Request, status
from collections import defaultdict


class RateLimiter:
    """In-memory rate limiter with sliding window."""
    
    def __init__(self):
        # key: (client_ip, endpoint) -> list of (timestamp, count) tuples
        self.requests: Dict[Tuple[str, str], list] = defaultdict(list)
        
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP from request (handles X-Forwarded-For from proxies)."""
        if request.headers.get("x-forwarded-for"):
            return request.headers["x-forwarded-for"].split(",")[0].strip()
        return request.client.host if request.client else "unknown"
    
    def is_allowed(self, request: Request, endpoint: str, max_requests: int, window_minutes: int = 1) -> bool:
        """
        Check if request is allowed under rate limit.
        
        Args:
            request: FastAPI request
            endpoint: Endpoint path for grouping (e.g., "/api/efficient-frontier")
            max_requests: Max requests allowed in window
            window_minutes: Time window in minutes
            
        Returns:
            True if request is allowed, False if rate limited
        """
        client_ip = self._get_client_ip(request)
        key = (client_ip, endpoint)
        now = datetime.utcnow()
        window_start = now - timedelta(minutes=window_minutes)
        
        # Remove old requests outside the window
        self.requests[key] = [
            req_time for req_time in self.requests[key]
            if req_time > window_start
        ]
        
        # Check if under limit
        if len(self.requests[key]) < max_requests:
            self.requests[key].append(now)
            return True
        
        return False
    
    def get_remaining(self, request: Request, endpoint: str, max_requests: int) -> int:
        """Get remaining requests for this client+endpoint."""
        client_ip = self._get_client_ip(request)
        key = (client_ip, endpoint)
        return max(0, max_requests - len(self.requests[key]))


# Global rate limiter instance
rate_limiter = RateLimiter()


def rate_limit_check(
    request: Request,
    endpoint: str,
    max_requests: int,
    window_minutes: int = 1
) -> None:
    """
    Check rate limit and raise HTTPException if exceeded.
    
    Usage in endpoint:
    ```
    @app.post("/api/efficient-frontier")
    def efficient_frontier(request: Request, ...):
        rate_limit_check(request, "/api/efficient-frontier", 20, window_minutes=1)
        ...
    ```
    """
    if not rate_limiter.is_allowed(request, endpoint, max_requests, window_minutes):
        remaining = rate_limiter.get_remaining(request, endpoint, max_requests)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Max {max_requests} requests per {window_minutes} minute(s). Try again later."
        )
