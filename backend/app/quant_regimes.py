from __future__ import annotations

import numpy as np
import pandas as pd

from .data import fetch_price_history
from .models import RegimeRequest, RegimeResponse, RegimeSummary, RegimeStats, RegimePoint


def _max_drawdown(series: pd.Series) -> float:
    equity = (1 + series.fillna(0)).cumprod()
    running_max = equity.cummax()
    dd = equity / running_max - 1
    return float(dd.min()) if not dd.empty else 0.0


def detect_regimes(payload: RegimeRequest) -> RegimeResponse:
    prices = fetch_price_history([payload.symbol], payload.start_date, payload.end_date).iloc[:, 0]
    returns = np.log(prices / prices.shift(1)).dropna()
    if returns.empty or len(returns) < 40:
        raise ValueError("Not enough data to detect regimes.")

    rolling_vol = returns.rolling(20, min_periods=20).std()
    # drop NaN vol rows for quantiles
    valid_vol = rolling_vol.dropna()
    if valid_vol.empty:
        raise ValueError("Not enough data to compute rolling volatility.")
    quantiles = [valid_vol.quantile(i / payload.n_states) for i in range(1, payload.n_states)]

    regimes = []
    for v in rolling_vol:
        if np.isnan(v):
            regimes.append(None)
            continue
        bucket = 0
        for q in quantiles:
            if v > q:
                bucket += 1
        regimes.append(bucket)

    # Align lengths
    series = []
    for dt, price, ret, regime in zip(prices.index, prices.values, returns.reindex(prices.index, fill_value=np.nan).values, regimes):
        if regime is None:
            continue
        series.append(
            RegimePoint(
                timestamp=dt.strftime("%Y-%m-%d"),
                price=float(price),
                return_=float(ret) if not np.isnan(ret) else 0.0,
                regime=int(regime),
            )
        )

    # Compute stats per regime
    df = pd.DataFrame([{"regime": p.regime, "return": p.return_, "price": p.price} for p in series])
    stats = []
    total = len(df)
    overall_vol = float(df["return"].std()) if total else 0.0
    overall_sharpe = float(df["return"].mean() / df["return"].std()) if df["return"].std() not in (0, np.nan) else 0.0

    for regime_id in sorted(df["regime"].unique()):
        subset = df[df["regime"] == regime_id]
        n_obs = len(subset)
        pct_time = n_obs / total if total else 0.0
        avg_return = float(subset["return"].mean()) if n_obs else 0.0
        vol = float(subset["return"].std()) if n_obs else 0.0
        sharpe = float(avg_return / vol) if vol else 0.0
        # max drawdown using returns restricted to regime
        max_dd = _max_drawdown(subset["return"])
        stats.append(
            RegimeStats(
                regime=int(regime_id),
                n_obs=n_obs,
                pct_time=pct_time,
                avg_return=avg_return,
                vol=vol,
                sharpe=sharpe,
                max_drawdown=max_dd,
            )
        )

    summary = RegimeSummary(
        symbol=payload.symbol,
        start_date=payload.start_date,
        end_date=payload.end_date,
        n_states=payload.n_states,
        overall_vol=overall_vol,
        overall_sharpe=overall_sharpe,
        regimes=stats,
    )

    return RegimeResponse(summary=summary, series=series)
