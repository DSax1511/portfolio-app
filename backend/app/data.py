from __future__ import annotations

import datetime as dt
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np
import pandas as pd
import yfinance as yf
from fastapi import HTTPException

from .config import settings
from .infra.utils import parse_date


def _cache_path(ticker: str) -> Path:
  return settings.data_cache_dir / f"{ticker.upper()}.parquet"


def _fetch_from_yf(ticker: str, start: dt.date, end: Optional[dt.date]) -> pd.Series:
    data = yf.download(
        tickers=[ticker],
        start=start,
        end=end,
        progress=False,
        auto_adjust=True,
        group_by="ticker",
    )
    if data.empty:
        return pd.Series(dtype=float)
    if isinstance(data.columns, pd.MultiIndex):
        close = data.loc[:, (slice(None), "Close")]
        close.columns = [c[0] for c in close.columns]
        return close.iloc[:, 0]
    return data["Close"]


def _load_cached(ticker: str) -> pd.Series:
    path = _cache_path(ticker)
    if not path.exists():
        return pd.Series(dtype=float)
    try:
        series = pd.read_parquet(path)
        if isinstance(series, pd.DataFrame):
            series = series.iloc[:, 0]
        series.index = pd.to_datetime(series.index)
        series.name = ticker
        return series.sort_index()
    except Exception:
        return pd.Series(dtype=float)


def _save_cache(ticker: str, series: pd.Series) -> None:
    if series.empty:
        return
    settings.data_cache_dir.mkdir(parents=True, exist_ok=True)
    series.to_frame(name=ticker).to_parquet(_cache_path(ticker))


def fetch_price_history(tickers: List[str], start: Optional[str], end: Optional[str]) -> pd.DataFrame:
    """
    Fetch daily close prices for tickers using yfinance with simple local caching.
    If start is None, defaults to a rolling lookback defined in settings.
    """
    start_date = parse_date(start)
    end_date = parse_date(end)

    if start_date is None:
        start_date = dt.date.today() - dt.timedelta(days=365 * settings.default_lookback_years)

    frames = []
    for ticker in tickers:
        cached = _load_cached(ticker)
        need_fetch = cached.empty or cached.index.min().date() > start_date or (end_date and cached.index.max().date() < end_date)
        if need_fetch:
            fetched = _fetch_from_yf(ticker, start_date, end_date)
            if fetched.empty and cached.empty:
                raise HTTPException(status_code=400, detail=f"No price data found for {ticker}")
            series = fetched if not fetched.empty else cached
            _save_cache(ticker, series)
        else:
            series = cached
        frames.append(series.rename(ticker))

    closes = pd.concat(frames, axis=1).sort_index()
    closes = closes.ffill().bfill()
    if closes.empty:
        raise HTTPException(status_code=400, detail="No price data found for the requested tickers/dates.")
    return closes


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
