from __future__ import annotations

import numpy as np
import pandas as pd
from hmmlearn import hmm
import warnings

from .data import fetch_price_history
from .models import RegimeRequest, RegimeResponse, RegimeSummary, RegimeStats, RegimePoint

warnings.filterwarnings("ignore")


def _max_drawdown(series: pd.Series) -> float:
    equity = (1 + series.fillna(0)).cumprod()
    running_max = equity.cummax()
    dd = equity / running_max - 1
    return float(dd.min()) if not dd.empty else 0.0


def detect_regimes(payload: RegimeRequest) -> RegimeResponse:
    """
    Detect market regimes using either threshold or HMM method.

    Args:
        payload: RegimeRequest with symbol, dates, n_states, and model_type

    Returns:
        RegimeResponse with detected regimes and statistics
    """
    prices = fetch_price_history([payload.symbol], payload.start_date, payload.end_date).iloc[:, 0]
    returns = np.log(prices / prices.shift(1)).dropna()
    if returns.empty or len(returns) < 40:
        raise ValueError("Not enough data to detect regimes.")

    # Choose detection method
    if payload.model_type == "hmm_vol":
        regimes = _detect_regimes_hmm(returns, payload.n_states)
    else:
        # Default: threshold-based on rolling volatility
        rolling_vol = returns.rolling(20, min_periods=20).std()
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


def _detect_regimes_hmm(returns: pd.Series, n_states: int = 3) -> list:
    """
    Detect regimes using Hidden Markov Model on returns and volatility.

    HMM assumes:
    - Multiple hidden states (regimes)
    - Each state has characteristic mean and volatility
    - Transitions follow Markov chain

    Args:
        returns: Daily returns series
        n_states: Number of hidden states

    Returns:
        List of regime assignments (0 to n_states-1)
    """
    # Prepare features: returns and rolling volatility
    rolling_vol = returns.rolling(5, min_periods=5).std().fillna(method="bfill")

    # Stack features
    X = np.column_stack([returns.values, rolling_vol.values])

    # Fit Gaussian HMM
    model = hmm.GaussianHMM(
        n_components=n_states,
        covariance_type="full",
        n_iter=100,
        random_state=42,
    )

    try:
        model.fit(X)
        hidden_states = model.predict(X)

        # Sort states by mean volatility (0 = low vol, n-1 = high vol)
        state_vols = []
        for i in range(n_states):
            state_mask = hidden_states == i
            if state_mask.sum() > 0:
                state_vol = rolling_vol.values[state_mask].mean()
            else:
                state_vol = 0
            state_vols.append((i, state_vol))

        # Create mapping from raw state to sorted state
        state_vols.sort(key=lambda x: x[1])  # Sort by volatility
        state_mapping = {old_state: new_state for new_state, (old_state, _) in enumerate(state_vols)}

        # Remap states
        remapped_states = [state_mapping[s] for s in hidden_states]

        return remapped_states

    except Exception as e:
        # Fallback to threshold-based if HMM fails
        rolling_vol = returns.rolling(20, min_periods=20).std()
        valid_vol = rolling_vol.dropna()
        quantiles = [valid_vol.quantile(i / n_states) for i in range(1, n_states)]

        regimes = []
        for v in rolling_vol:
            if np.isnan(v):
                regimes.append(0)
                continue
            bucket = 0
            for q in quantiles:
                if v > q:
                    bucket += 1
            regimes.append(bucket)

        return regimes
