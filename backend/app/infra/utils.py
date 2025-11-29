from __future__ import annotations

import datetime as dt
import json
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
from fastapi import HTTPException
from pydantic import BaseModel, validator

from ..config import settings


def parse_number(raw: str) -> float:
    """Safely parse broker CSV numbers like '9,000', '$1,278.75', '--', '' into floats."""
    if raw is None:
        return 0.0
    cleaned = str(raw).strip()
    if cleaned in ("", "--"):
        return 0.0
    cleaned = cleaned.replace("$", "").replace(",", "")
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


def parse_date(date_str: Optional[str]) -> Optional[dt.date]:
    """Convert YYYY-MM-DD string to date, or return None if not provided."""
    if not date_str:
        return None
    try:
        return dt.datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {date_str}. Use YYYY-MM-DD.") from exc


def normalize_weights(tickers: List[str], weights: Optional[List[float]]) -> List[float]:
    """Ensure weights are provided and normalized to sum to 1.0."""
    if weights is None:
        return [1.0 / len(tickers)] * len(tickers)
    total = sum(weights)
    if total == 0:
        raise HTTPException(status_code=400, detail="weights must sum to a non-zero value.")
    return [w / total for w in weights]


def load_presets() -> Dict[str, Any]:
    if not settings.presets_path.exists():
        return {}
    try:
        return json.loads(settings.presets_path.read_text())
    except Exception:
        return {}


def save_presets(data: Dict[str, Any]) -> None:
    settings.presets_path.write_text(json.dumps(data, indent=2))


class IndicatorSpec(BaseModel):
    indicator: str  # sma, ema, rsi, macd, bollinger, roc, vol, price
    window: Optional[int] = None
    window_slow: Optional[int] = None
    std_mult: Optional[float] = None  # for bollinger
    parameter: Optional[float] = None  # generic param (e.g., value threshold)


class StrategyRule(BaseModel):
    left: IndicatorSpec
    operator: str  # '>', '<', 'cross_over'
    right: Optional[IndicatorSpec] = None
    value: Optional[float] = None
    action: str  # 'long' or 'flat'

    @validator("operator", allow_reuse=True)
    def validate_operator(cls, v: str) -> str:
        allowed = {">", "<", "cross_over"}
        if v not in allowed:
            raise ValueError(f"operator must be one of {allowed}")
        return v

    @validator("action", allow_reuse=True)
    def validate_action(cls, v: str) -> str:
        allowed = {"long", "flat"}
        if v not in allowed:
            raise ValueError("action must be 'long' or 'flat'")
        return v

    def dict(self, *args, **kwargs) -> Dict[str, Any]:
        payload = super().dict(*args, **kwargs)
        payload["operator"] = self.operator
        payload["action"] = self.action
        return payload


def weighted_portfolio_price(prices, weights):
    norm = prices / prices.iloc[0]
    w = np.array(weights)
    return (norm * w).sum(axis=1)
