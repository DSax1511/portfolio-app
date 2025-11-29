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


def black_litterman(prior_returns: pd.Series, cov: pd.DataFrame, views: Optional[Dict[str, float]] = None, tau: float = 0.025) -> pd.Series:
    """
    Simplified Black-Litterman: blend prior mean with investor views (absolute views only).
    views: dict of ticker -> expected excess return.
    """
    if not views:
        return prior_returns
    assets = prior_returns.index.tolist()
    P = np.zeros((len(views), len(assets)))
    q = []
    for i, (ticker, view) in enumerate(views.items()):
        if ticker not in assets:
            continue
        idx = assets.index(ticker)
        P[i, idx] = 1
        q.append(view)
    if not q:
        return prior_returns
    q = np.array(q)
    tau_cov = tau * cov.values
    omega = np.diag(np.full(len(q), 0.05))  # view uncertainty
    middle = np.linalg.inv(P @ tau_cov @ P.T + omega)
    posterior = prior_returns.values + tau_cov @ P.T @ middle @ (q - P @ prior_returns.values)
    return pd.Series(posterior, index=assets)


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
