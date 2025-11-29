from __future__ import annotations

import math
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from fastapi import HTTPException

from .data import fetch_price_history, load_factor_returns
from .infra.utils import normalize_weights
from .rebalance import suggest_rebalance


def compute_portfolio_returns(prices: pd.DataFrame, weights: List[float]) -> pd.Series:
    """Compute daily portfolio returns given price history and weights."""
    returns = prices.pct_change().dropna()
    weight_series = pd.Series(weights, index=prices.columns)
    return returns.dot(weight_series)


def compute_performance_stats(returns: pd.Series) -> Dict[str, float]:
    """Calculate common performance metrics; returns JSON-serializable floats."""
    if returns.empty:
        raise HTTPException(status_code=400, detail="Not enough data to compute performance statistics.")

    equity = (1 + returns).cumprod()
    total_return = equity.iloc[-1] - 1

    periods_per_year = 252
    annualized_return = float((1 + total_return) ** (periods_per_year / len(returns)) - 1)
    annualized_vol = float(returns.std() * math.sqrt(periods_per_year))
    sharpe_ratio = float(annualized_return / annualized_vol) if annualized_vol != 0 else 0.0

    running_max = equity.cummax()
    drawdowns = equity / running_max - 1
    max_drawdown = float(drawdowns.min())

    return {
        "cumulative_return": float(total_return),
        "annualized_return": annualized_return,
        "annualized_volatility": annualized_vol,
        "sharpe_ratio": sharpe_ratio,
        "max_drawdown": max_drawdown,
    }


def equity_curve_payload(returns: pd.Series) -> Dict[str, List[Any]]:
    equity = (1 + returns).cumprod()
    dates = [idx.strftime("%Y-%m-%d") for idx in equity.index]
    values = [float(v) for v in equity.values]
    return {"dates": dates, "equity": values}


def risk_breakdown(prices: pd.DataFrame, weights: List[float]) -> Dict[str, Any]:
    rets = prices.pct_change().dropna()
    cov = rets.cov()
    vols = rets.std()
    w = np.array(weights)
    port_var = float(w.T @ cov.values @ w)
    port_vol = port_var ** 0.5
    marginal = cov.values @ w
    contrib = w * marginal
    pct_contrib = contrib / port_var if port_var != 0 else np.zeros_like(contrib)
    diversification_ratio = float((vols.values @ w) / port_vol) if port_vol != 0 else 0.0
    corr = rets.corr()
    return {
        "portfolio_vol": port_vol,
        "contribution": [
            {"ticker": t, "pct_variance": float(pc)}
            for t, pc in zip(prices.columns, pct_contrib)
        ],
        "correlation": corr.to_dict(),
        "diversification_ratio": diversification_ratio,
    }


def factor_regression(portfolio_returns: pd.Series, start: Optional[str], end: Optional[str]) -> Dict[str, Any]:
    factor_returns = load_factor_returns(start, end)
    aligned = portfolio_returns.loc[factor_returns.index].dropna()
    factor_returns = factor_returns.loc[aligned.index]
    if aligned.empty:
        raise HTTPException(status_code=400, detail="Not enough overlapping data for factor regression.")

    X = factor_returns.values
    y = aligned.values
    X_design = np.column_stack([np.ones(len(X)), X])
    betas, _, _, _ = np.linalg.lstsq(X_design, y, rcond=None)
    intercept = betas[0]
    loadings = betas[1:]
    fitted = X_design @ betas
    residuals = y - fitted
    r2 = 1 - np.var(residuals) / np.var(y) if np.var(y) != 0 else 0.0
    factor_names = list(factor_returns.columns)
    return {
        "intercept": float(intercept),
        "r2": float(r2),
        "loadings": [
            {"factor": name, "beta": float(beta)}
            for name, beta in zip(factor_names, loadings)
        ],
        "residual_vol": float(np.std(residuals)),
    }


def benchmark_compare(portfolio_returns: pd.Series, benchmark: str, start: Optional[str], end: Optional[str]) -> Dict[str, Any]:
    bench_prices = fetch_price_history([benchmark], start, end)
    bench_returns = bench_prices.pct_change().dropna().iloc[:, 0]
    aligned_port = portfolio_returns.loc[bench_returns.index]
    aligned_port = aligned_port.dropna()
    bench_returns = bench_returns.loc[aligned_port.index]

    if aligned_port.empty:
        raise HTTPException(status_code=400, detail="Not enough overlapping data for benchmark comparison.")

    X = np.column_stack([np.ones(len(bench_returns)), bench_returns.values])
    y = aligned_port.values
    betas, _, _, _ = np.linalg.lstsq(X, y, rcond=None)
    alpha = betas[0] * 252  # annualize intercept
    beta = betas[1]
    active = aligned_port - bench_returns
    tracking_error = float(active.std() * math.sqrt(252))
    annual_excess = float((1 + aligned_port).prod() ** (252 / len(aligned_port)) - (1 + bench_returns).prod() ** (252 / len(bench_returns)))
    return {
        "alpha": float(alpha),
        "beta": float(beta),
        "tracking_error": tracking_error,
        "benchmark": benchmark,
        "portfolio_cagr": float((1 + aligned_port).prod() ** (252 / len(aligned_port)) - 1),
        "benchmark_cagr": float((1 + bench_returns).prod() ** (252 / len(bench_returns)) - 1),
        "annual_excess_return": annual_excess,
    }


def rolling_active_stats(portfolio_returns: pd.Series, benchmark_returns: pd.Series, window: int = 60) -> Dict[str, List[Any]]:
    aligned = pd.concat([portfolio_returns, benchmark_returns], axis=1, join="inner").dropna()
    aligned.columns = ["portfolio", "benchmark"]
    active = aligned["portfolio"] - aligned["benchmark"]
    info_ratio = active.rolling(window).mean() / active.rolling(window).std()
    tracking_error = active.rolling(window).std() * math.sqrt(252)
    active_return = active.rolling(window).apply(lambda x: (1 + x).prod() - 1)
    return {
        "dates": [d.strftime("%Y-%m-%d") for d in info_ratio.index],
        "information_ratio": info_ratio.fillna(0).tolist(),
        "tracking_error": tracking_error.fillna(0).tolist(),
        "active_return": active_return.fillna(0).tolist(),
    }


def scenario_shocks(portfolio_returns: pd.Series) -> Dict[str, Any]:
    scenarios = {
        "equity_-20": {"shock": -0.20},
        "rates_up_100bps": {"shock": -0.05},
        "credit_widen_50bps": {"shock": -0.03},
    }


def portfolio_dashboard(tickers: List[str], quantities: List[float], prices: List[float], cost_basis: List[float], target_weights: List[float], start: Optional[str], end: Optional[str]) -> Dict[str, Any]:
    if not tickers:
        raise HTTPException(status_code=400, detail="tickers required")
    price_hist = fetch_price_history(tickers, start, end)
    rets = price_hist.pct_change().dropna()
    cov = rets.cov()
    current_values = np.array(quantities) * np.array(prices)
    portfolio_value = current_values.sum()
    current_weights = current_values / portfolio_value if portfolio_value > 0 else np.full(len(tickers), 1 / len(tickers))
    target_weights = np.array(target_weights, dtype=float)
    target_weights = target_weights / target_weights.sum() if target_weights.sum() != 0 else np.full(len(tickers), 1 / len(tickers))

    # Risk contributions
    w = current_weights
    port_var = float(w.T @ cov.values @ w)
    marginal = cov.values @ w
    contrib = w * marginal
    pct_contrib = contrib / port_var if port_var != 0 else np.zeros_like(contrib)
    top_risk = [
        {"ticker": t, "pct_variance": float(pc)}
        for t, pc in sorted(zip(tickers, pct_contrib), key=lambda x: x[1], reverse=True)
    ]

    # Weight diffs
    overweight_underweight = []
    for t, cw, tw in zip(tickers, current_weights, target_weights):
        diff = cw - tw
        status = "on target"
        if diff > 0.01:
            status = "overweight"
        elif diff < -0.01:
            status = "underweight"
        overweight_underweight.append(
            {"ticker": t, "current_weight": round(float(cw), 4), "target_weight": round(float(tw), 4), "status": status, "diff": round(float(diff), 4)}
        )

    # Drawdowns per ticker
    largest_drawdowns = []
    for t in tickers:
        series = price_hist[t]
        running_max = series.cummax()
        dd = series / running_max - 1
        largest_drawdowns.append({"ticker": t, "drawdown": float(dd.min())})

    # Rebalance suggestion reuse
    rebalance = suggest_rebalance(tickers, current_weights.tolist(), target_weights.tolist(), float(portfolio_value), prices)

    return {
        "top_risk_contributors": top_risk,
        "overweight_underweight": overweight_underweight,
        "largest_drawdowns": largest_drawdowns,
        "rebalance": rebalance,
    }
    latest = float(portfolio_returns.iloc[-1]) if not portfolio_returns.empty else 0.0
    return {
        name: {
            "shock_return": cfg["shock"],
            "pnl": float(cfg["shock"]),
            "last_return": latest,
        }
        for name, cfg in scenarios.items()
    }


def attribution_allocation_selection(port_returns: pd.Series, bench_returns: pd.Series, weights: List[float], bench_weights: Optional[List[float]] = None) -> Dict[str, Any]:
    bench_weights = bench_weights or [1.0 / len(weights)] * len(weights)
    weights = normalize_weights([str(i) for i in range(len(weights))], weights)
    bench_weights = normalize_weights([str(i) for i in range(len(bench_weights))], bench_weights)
    asset_rets = pd.DataFrame({"portfolio": port_returns, "benchmark": bench_returns}).dropna()
    allocation = sum((w - bw) * asset_rets["benchmark"].mean() for w, bw in zip(weights, bench_weights))
    selection = sum(bw * (asset_rets["portfolio"].mean() - asset_rets["benchmark"].mean()) for bw in bench_weights)
    interaction = sum((w - bw) * (asset_rets["portfolio"].mean() - asset_rets["benchmark"].mean()) for w, bw in zip(weights, bench_weights))
    return {
        "allocation": float(allocation),
        "selection": float(selection),
        "interaction": float(interaction),
        "total": float(allocation + selection + interaction),
    }
