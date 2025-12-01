"""Market snapshot endpoint for live ticker data."""
from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Any, Dict, List

import yfinance as yf
from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/market", tags=["market"])

# Ticker symbols for market snapshot
TICKER_SYMBOLS = ["SPY", "QQQ", "IWM", "^VIX"]

# In-memory cache
_snapshot_cache: Dict[str, Any] = {}
CACHE_KEY = "market_snapshot"
CACHE_TTL_SECONDS = 60


def _fetch_market_snapshot() -> Dict[str, Any]:
    """
    Fetch latest market snapshot from yfinance.

    Returns dict with:
    - as_of: timestamp
    - tickers: list of {symbol, last, change_pct}
    """
    tickers_str = " ".join(TICKER_SYMBOLS)

    try:
        # Download last 2 days of data to compute daily change
        data = yf.download(
            tickers=tickers_str,
            period="2d",
            interval="1d",
            group_by="ticker",
            auto_adjust=False,
            progress=False,
        )
    except Exception as e:
        logger.error(f"Failed to download market data: {e}")
        raise

    snapshot = []

    for symbol in TICKER_SYMBOLS:
        try:
            # Extract ticker data
            if len(TICKER_SYMBOLS) == 1:
                df = data
            else:
                df = data[symbol]

            # Ensure we have at least 2 rows
            if len(df) < 2:
                logger.warning(f"Insufficient data for {symbol}, skipping")
                continue

            # Get previous close and latest close
            prev_close = float(df["Close"].iloc[-2])
            last = float(df["Close"].iloc[-1])

            # Calculate daily % change
            change_pct = ((last / prev_close - 1.0) * 100.0) if prev_close != 0 else 0.0

            snapshot.append({
                "symbol": symbol,
                "last": round(last, 2),
                "change_pct": round(change_pct, 2),
            })
        except Exception as e:
            logger.warning(f"Error processing {symbol}: {e}")
            # Skip problematic ticker
            continue

    return {
        "as_of": datetime.now(timezone.utc).isoformat(),
        "tickers": snapshot,
    }


@router.get("/snapshot")
def get_market_snapshot() -> Dict[str, Any]:
    """
    Get market snapshot with ~60 second caching.

    Returns:
        {
            "as_of": "2025-12-01T15:58:00Z",
            "tickers": [
                {"symbol": "SPY", "last": 475.32, "change_pct": 1.23},
                ...
            ]
        }
    """
    # Check cache
    if CACHE_KEY in _snapshot_cache:
        cached = _snapshot_cache[CACHE_KEY]
        age = (datetime.now(timezone.utc) - cached["timestamp"]).total_seconds()

        if age < CACHE_TTL_SECONDS:
            logger.debug(f"Returning cached snapshot (age: {age:.1f}s)")
            return cached["data"]

    # Fetch fresh data
    try:
        logger.info("Fetching fresh market snapshot")
        data = _fetch_market_snapshot()
    except Exception as e:
        logger.error(f"Error fetching market snapshot: {e}")
        raise HTTPException(
            status_code=502,
            detail=f"Error fetching market snapshot: {e}"
        )

    # Update cache
    _snapshot_cache[CACHE_KEY] = {
        "timestamp": datetime.now(timezone.utc),
        "data": data,
    }

    return data
