from __future__ import annotations

from typing import Any, Dict, Optional

from pydantic import BaseModel


class ErrorResponse(BaseModel):
    detail: str
    code: Optional[str] = None
    meta: Optional[Dict[str, Any]] = None
