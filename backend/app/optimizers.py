from __future__ import annotations

import math
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from fastapi import HTTPException


def _sample_weights(n: int, cap: float) -> np.ndarray:
    w = np.random.dirichlet(np.ones(n))
    w = np.minimum(w, cap)
    if w.sum() == 0:
        return np.array([1.0 / n] * n)
    return w / w.sum()


def portfolio_perf(w: np.ndarray, mean_returns: pd.Series, cov: pd.DataFrame) -> Tuple[float, float, float]:
    r = float(np.dot(w, mean_returns))
    v = float(np.sqrt(np.dot(w.T, np.dot(cov.values, w))))
    sharpe = r / v if v != 0 else 0.0
    return r, v, sharpe


def markowitz_frontier(rets: pd.DataFrame, points: int = 20, cap: float = 0.35) -> Dict[str, Any]:
    mean_returns = rets.mean() * 252
    cov = rets.cov() * 252
    n = len(mean_returns)

    candidates = []
    samples = max(points * 800, 5000)
    for _ in range(samples):
        w = _sample_weights(n, cap)
        r, v, s = portfolio_perf(w, mean_returns, cov)
        candidates.append({"return": r, "vol": v, "sharpe": s, "weights": w})

    vols = [c["vol"] for c in candidates]
    if not vols:
        raise HTTPException(status_code=400, detail="Unable to build frontier from returns.")
    min_vol, max_vol = min(vols), max(vols)
    buckets = np.linspace(min_vol, max_vol, points)
    frontier = []
    for i in range(len(buckets) - 1):
        low, high = buckets[i], buckets[i + 1]
        bucket = [c for c in candidates if low <= c["vol"] <= high]
        if not bucket:
            continue
        best = max(bucket, key=lambda x: x["sharpe"])
        frontier.append(
            {
                "return": best["return"],
                "vol": best["vol"],
                "weights": [float(x) for x in best["weights"]],
            }
        )

    max_sharpe = max(candidates, key=lambda x: x["sharpe"])
    min_vol_pt = min(candidates, key=lambda x: x["vol"])

    return {
        "frontier": frontier,
        "max_sharpe": {
            "return": max_sharpe["return"],
            "vol": max_sharpe["vol"],
            "weights": [float(x) for x in max_sharpe["weights"]],
        },
        "min_vol": {
            "return": min_vol_pt["return"],
            "vol": min_vol_pt["vol"],
            "weights": [float(x) for x in min_vol_pt["weights"]],
        },
    }


def risk_parity_weights(cov: pd.DataFrame, max_iter: int = 500, tol: float = 1e-6) -> np.ndarray:
    n = cov.shape[0]
    w = np.array([1.0 / n] * n)
    target = 1.0 / n
    for _ in range(max_iter):
        mrc = cov.values @ w
        rc = w * mrc
        if np.allclose(rc, target, atol=tol):
            break
        w = w * target / (rc + 1e-12)
        w = np.maximum(w, 0)
        w = w / w.sum()
    return w


def min_variance_weights(cov: pd.DataFrame, cap: float = 0.35) -> np.ndarray:
    inv = np.linalg.pinv(cov.values)
    ones = np.ones(len(cov))
    raw = inv @ ones
    w = raw / (ones.T @ raw)
    w = np.maximum(w, 0)
    w = np.minimum(w, cap)
    if w.sum() == 0:
        return np.array([1.0 / len(cov)] * len(cov))
    return w / w.sum()


def black_litterman(prior_returns: pd.Series, cov: pd.DataFrame, views: Optional[Dict[str, float]] = None, view_uncertainties: Optional[Dict[str, float]] = None, tau: float = 0.025,) -> pd.Series:
    # Input validation
    if not prior_returns.index.equals(cov.index):
        raise ValueError("prior_returns and cov indices must match")
    if not cov.index.equals(cov.columns):
        raise ValueError("Covariance matrix must be square with matching indices")
    
    # Check positive semi-definite
    eigvals = np.linalg.eigvalsh(cov.values)
    if np.any(eigvals < -1e-8):
        raise ValueError("Covariance matrix must be positive semi-definite")
    
    # No views: return prior
    if not views:
        return prior_returns.copy()
    
    # Validate views against available assets
    assets = prior_returns.index.tolist()
    invalid_tickers = [t for t in views.keys() if t not in assets]
    if invalid_tickers:
        raise ValueError(f"Views contain invalid tickers not in portfolio: {invalid_tickers}")
    
    # Build pick matrix P and view vector q
    n_views = len(views)
    n_assets = len(assets)
    P = np.zeros((n_views, n_assets))
    q = np.zeros(n_views)
    
    for i, (ticker, view_return) in enumerate(views.items()):
        idx = assets.index(ticker)
        P[i, idx] = 1.0
        q[i] = view_return
    
    # Build view uncertainty matrix Ω
    if view_uncertainties is None:
        omega = np.diag(np.full(n_views, 0.05))
    else:
        uncertainties = [view_uncertainties.get(ticker, 0.05) for ticker in views.keys()]
        omega = np.diag(uncertainties)
    
    # Black-Litterman formula (numerically stable version)
    tau_cov = tau * cov.values
    
    # Solve: (P @ tau_cov @ P.T + Ω) @ x = (q - P @ prior)
    # Then: posterior = prior + tau_cov @ P.T @ x
    try:
        rhs = q - P @ prior_returns.values
        middle_term = P @ tau_cov @ P.T + omega
        x = np.linalg.solve(middle_term, rhs)
        adjustment = tau_cov @ P.T @ x
        posterior = prior_returns.values + adjustment
    except np.linalg.LinAlgError as e:
        raise ValueError(f"Failed to compute posterior returns: {e}") from e
    
    return pd.Series(posterior, index=prior_returns.index, name="posterior_returns")


def optimizer_summary(rets: pd.DataFrame, cap: float = 0.35) -> Dict[str, Any]:
    cov = rets.cov() * 252
    mean_returns = rets.mean() * 252
    rp = risk_parity_weights(cov)
    mv = min_variance_weights(cov, cap)
    bl = black_litterman(mean_returns, cov)
    return {
        "risk_parity": rp.tolist(),
        "min_vol": mv.tolist(),
        "black_litterman": bl.tolist(),
    }
