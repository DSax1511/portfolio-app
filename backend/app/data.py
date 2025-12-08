from __future__ import annotations

import asyncio
import datetime as dt
import logging
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import yfinance as yf
from fastapi import HTTPException

from .config import settings
from .core.errors import ErrorCode
from .infra.utils import parse_date

logger = logging.getLogger(__name__)

# Per-loop semaphore storage to prevent "bound to different event loop" errors
_loop_semaphores: Dict[int, asyncio.Semaphore] = {}


def _cache_path(ticker: str) -> Path:
  return settings.data_cache_dir / f"{ticker.upper()}.parquet"


def _fetch_from_yf_sync(
    ticker: str,
    start: dt.date,
    end: Optional[dt.date],
    max_retries: int = 5,
    base_delay: float = 3.0
) -> Tuple[pd.Series, bool]:
    """
    Synchronous yfinance fetch with exponential backoff retry logic.

    Enhanced for production environment:
    - max_retries: 5 attempts for better reliability
    - base_delay: 3.0s to respect rate limits
    - Exponential backoff: 3s, 6s, 12s, 24s, 48s
    - Detects and handles Yahoo Finance rate limit errors

    Args:
        ticker: Stock ticker symbol
        start: Start date for historical data
        end: End date for historical data
        max_retries: Maximum number of retry attempts (default: 5)
        base_delay: Base delay in seconds for exponential backoff (default: 3.0)

    Returns:
        Tuple of (pandas Series with price data, is_network_error)
        - Series will be empty if fetch failed
        - is_network_error=True if failure was due to network/upstream issues
    """
    last_exception = None

    for attempt in range(max_retries):
        try:
            logger.info(f"Fetching {ticker} from yfinance (attempt {attempt + 1}/{max_retries})")
            data = yf.download(
                tickers=[ticker],
                start=start,
                end=end,
                progress=False,
                auto_adjust=True,
                group_by="ticker",
            )
            if data.empty:
                logger.warning(f"No data returned for {ticker} - ticker may not exist or have no history")
                return pd.Series(dtype=float), False

            # Extract Close prices
            if isinstance(data.columns, pd.MultiIndex):
                close = data.loc[:, (slice(None), "Close")]
                close.columns = [c[0] for c in close.columns]
                logger.info(f"Successfully fetched {len(close)} datapoints for {ticker}")
                return close.iloc[:, 0], False
            logger.info(f"Successfully fetched {len(data)} datapoints for {ticker}")
            return data["Close"], False

        except Exception as e:
            last_exception = e
            error_str = str(e).lower()
            error_type = type(e).__name__

            # Detect rate limiting
            is_rate_limit = (
                "rate limit" in error_str
                or "too many requests" in error_str
                or "429" in error_str
                or "YFRateLimitError" in error_type
            )

            # Detect network errors
            is_network = any(
                err_type in error_type
                for err_type in ["ConnectionError", "Timeout", "HTTPError", "URLError"]
            ) or is_rate_limit

            if attempt < max_retries - 1:
                # Longer delay for rate limits
                if is_rate_limit:
                    delay = base_delay * (2 ** (attempt + 1))  # 6s, 12s, 24s, 48s
                    logger.warning(
                        f"Rate limited on {ticker} (attempt {attempt + 1}/{max_retries}). "
                        f"Waiting {delay}s before retry..."
                    )
                else:
                    delay = base_delay * (2 ** attempt)  # 3s, 6s, 12s, 24s
                    logger.warning(
                        f"Failed to fetch {ticker} (attempt {attempt + 1}/{max_retries}): "
                        f"{error_type}: {e}. Retrying in {delay}s..."
                    )
                time.sleep(delay)
            else:
                logger.error(
                    f"Failed to fetch {ticker} after {max_retries} attempts. "
                    f"Last error: {error_type}: {e}"
                )
                return pd.Series(dtype=float), is_network

    return pd.Series(dtype=float), True


async def _fetch_from_yf_async(ticker: str, start: dt.date, end: Optional[dt.date]) -> Tuple[pd.Series, bool]:
    """
    Async wrapper with rate-limiting semaphore to prevent overwhelming yfinance.
    Limits concurrent requests to 3 at a time to avoid rate limits.

    Returns:
        Tuple of (price series, is_network_error)
    """
    # Get or create semaphore for current event loop
    loop = asyncio.get_running_loop()
    loop_id = id(loop)

    if loop_id not in _loop_semaphores:
        _loop_semaphores[loop_id] = asyncio.Semaphore(3)

    semaphore = _loop_semaphores[loop_id]

    async with semaphore:
        return await loop.run_in_executor(None, _fetch_from_yf_sync, ticker, start, end)


def _raise_data_error(ticker: str, is_network_error: bool = False) -> None:
    """
    Raise appropriate HTTPException based on error type.

    Args:
        ticker: The ticker symbol that failed
        is_network_error: True if this was a network/upstream failure,
                         False if ticker simply has no data

    Raises:
        HTTPException with appropriate status code and structured error response
    """
    if is_network_error:
        # 503 Service Unavailable: upstream data provider issue
        logger.error(f"Upstream data provider error for {ticker}")
        raise HTTPException(
            status_code=503,
            detail={
                "error_code": ErrorCode.UPSTREAM_ERROR,
                "http_status": 503,
                "message": "Market data temporarily unavailable from our data provider. Please try again in a few moments.",
                "details": {"ticker": ticker, "retry_after": 60}
            }
        )
    else:
        # 404 Not Found: ticker symbol not found or no data available
        logger.warning(f"No data available for ticker: {ticker}")
        raise HTTPException(
            status_code=404,
            detail={
                "error_code": ErrorCode.DATA_UNAVAILABLE,
                "http_status": 404,
                "message": f"No historical data available for ticker '{ticker}'. Please verify the symbol is correct.",
                "details": {"ticker": ticker}
            }
        )


def _load_cached(ticker: str, ttl_hours: int = 24) -> pd.Series:
    """
    Load cached price data with TTL (time-to-live) validation.

    Args:
        ticker: Stock ticker symbol
        ttl_hours: Cache TTL in hours (default: 24). Set to 0 to disable TTL check.

    Returns:
        Cached price series if valid, otherwise empty Series
    """
    path = _cache_path(ticker)
    if not path.exists():
        return pd.Series(dtype=float)

    try:
        # Check cache staleness
        if ttl_hours > 0:
            cache_mtime = dt.datetime.fromtimestamp(path.stat().st_mtime)
            cache_age = dt.datetime.now() - cache_mtime
            if cache_age > dt.timedelta(hours=ttl_hours):
                logger.info(
                    f"Cache for {ticker} is stale (age: {cache_age.total_seconds() / 3600:.1f}h). "
                    f"TTL: {ttl_hours}h"
                )
                return pd.Series(dtype=float)

        # Load and validate cached data
        series = pd.read_parquet(path)
        if isinstance(series, pd.DataFrame):
            series = series.iloc[:, 0]
        series.index = pd.to_datetime(series.index)
        series.name = ticker

        # Validate data quality
        if series.empty:
            logger.warning(f"Cached data for {ticker} is empty")
            return pd.Series(dtype=float)

        # Check for recent data (ensure cache includes recent trading days)
        latest_date = series.index.max()
        today = dt.datetime.now().date()
        days_old = (today - latest_date.date()).days

        # If data is more than 5 trading days old, consider it stale
        if days_old > 7:
            logger.warning(
                f"Cached data for {ticker} is outdated. Latest: {latest_date.date()}, "
                f"Days old: {days_old}"
            )
            return pd.Series(dtype=float)

        return series.sort_index()

    except Exception as e:
        logger.error(f"Failed to load cache for {ticker}: {e}")
        return pd.Series(dtype=float)


def _save_cache(ticker: str, series: pd.Series) -> None:
    if series.empty:
        return
    settings.data_cache_dir.mkdir(parents=True, exist_ok=True)
    series.to_frame(name=ticker).to_parquet(_cache_path(ticker))


async def _fetch_single_ticker_async(
    ticker: str, start_date: dt.date, end_date: Optional[dt.date]
) -> Tuple[str, pd.Series]:
    """
    Fetch a single ticker's price history, with caching and fallback.

    This function prioritizes cached data and only fetches from yfinance when needed.
    If both fetch and cache fail, it raises an appropriate HTTP exception.

    Returns:
        Tuple of (ticker, price_series)

    Raises:
        HTTPException: If data cannot be obtained from cache or yfinance
    """
    cached = _load_cached(ticker)
    need_fetch = (
        cached.empty
        or cached.index.min().date() > start_date
        or (end_date and cached.index.max().date() < end_date)
    )

    if need_fetch:
        fetched = pd.Series(dtype=float)
        is_network_error = False

        try:
            fetched, is_network_error = await _fetch_from_yf_async(ticker, start_date, end_date)
            # Add delay between requests to avoid rate limiting
            await asyncio.sleep(1.0)
        except Exception as e:
            logger.error(f"Unexpected error fetching {ticker}: {e}")
            is_network_error = True
            fetched = pd.Series(dtype=float)

        # Determine what to return or if we should raise an error
        if fetched.empty and cached.empty:
            # No data from fetch or cache - raise appropriate error
            _raise_data_error(ticker, is_network_error)
        else:
            # Use fetched data if available, otherwise fall back to cache
            series = fetched if not fetched.empty else cached
            if not fetched.empty:
                _save_cache(ticker, series)
    else:
        # Cache is sufficient
        series = cached

    return ticker, series.rename(ticker)


def fetch_price_history(tickers: List[str], start: Optional[str], end: Optional[str]) -> pd.DataFrame:
    """
    Fetch daily close prices for tickers using yfinance with concurrent async fetching.

    Performance: Fetches all tickers in parallel, ~5x faster than sequential.
    Cache hits are instant; cache misses use thread-executor for non-blocking I/O.

    If start is None, defaults to a rolling lookback defined in settings.
    """
    start_date = parse_date(start)
    end_date = parse_date(end)

    if start_date is None:
        start_date = dt.date.today() - dt.timedelta(days=365 * settings.default_lookback_years)

    # Check if we're already in an async context
    try:
        loop = asyncio.get_running_loop()
        # We're in an async context, create new thread to avoid blocking
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as executor:
            future = executor.submit(_fetch_sync_wrapper, tickers, start_date, end_date)
            frames = future.result()
    except RuntimeError:
        # No running loop, safe to create one
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            tasks = [
                _fetch_single_ticker_async(ticker, start_date, end_date)
                for ticker in tickers
            ]
            results = loop.run_until_complete(asyncio.gather(*tasks))
            frames = [series for _, series in results]
        finally:
            loop.close()

    closes = pd.concat(frames, axis=1).sort_index()
    closes = closes.ffill().bfill()

    if closes.empty:
        raise HTTPException(status_code=400, detail="No price data found for the requested tickers/dates.")
    return closes


def _fetch_sync_wrapper(tickers: List[str], start_date: dt.date, end_date: Optional[dt.date]) -> List[pd.Series]:
    """
    Synchronous wrapper for fetch operations when called from async context.
    Creates a new event loop in a separate thread.
    """
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        tasks = [
            _fetch_single_ticker_async(ticker, start_date, end_date)
            for ticker in tickers
        ]
        results = loop.run_until_complete(asyncio.gather(*tasks))
        return [series for _, series in results]
    finally:
        loop.close()


def get_factor_proxies() -> Dict[str, str]:
    return {
        "market": "SPY",
        "size": "IWM",
        "value": "VLUE",
        "momentum": "MTUM",
        "low_vol": "SPLV",
    }


def load_factor_returns(start: Optional[str], end: Optional[str]) -> pd.DataFrame:
    factor_map = get_factor_proxies()
    prices = fetch_price_history(list(factor_map.values()), start, end)
    rets = prices.pct_change().dropna()
    rets.columns = list(factor_map.keys())
    return rets


def resample_returns(returns: pd.Series, freq: str = "D") -> pd.Series:
    if freq.upper() in ("D", "B"):
        return returns
    return returns.resample(freq).apply(lambda x: (1 + x).prod() - 1)
