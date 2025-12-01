"""
Covariance Matrix Estimation with Shrinkage

This module provides robust covariance estimation techniques critical for
portfolio optimization. Sample covariance matrices suffer from estimation
error, especially in high dimensions (many assets, limited history).

Key techniques implemented:
1. Ledoit-Wolf shrinkage (optimal analytical shrinkage)
2. Oracle Approximating Shrinkage (OAS)
3. Minimum Covariance Determinant (robust to outliers)
4. Exponentially-weighted covariance (time-varying)

Mathematical background:
-----------------------

Sample covariance is unbiased but high variance:
    Σ_sample = (1/T) Σ_t (r_t - μ)(r_t - μ)^T

Ledoit-Wolf shrinkage combines sample with structured target:
    Σ_LW = δ * F + (1 - δ) * Σ_sample

Where:
- F is the shrinkage target (typically diagonal or constant correlation)
- δ ∈ [0, 1] is the shrinkage intensity (analytically optimal)

Benefits:
- Reduces estimation error (especially for large N, small T)
- Guarantees positive definiteness
- Improves out-of-sample portfolio performance
- Analytically optimal (Ledoit & Wolf, 2004)

When to use:
- N > 30 assets
- T < 10 * N observations
- High-frequency rebalancing
- Mean-variance optimization (very sensitive to covariance errors)
"""

from __future__ import annotations

from typing import Optional, Tuple

import numpy as np
import pandas as pd
from sklearn.covariance import (
    LedoitWolf,
    OAS,
    MinCovDet,
    EmpiricalCovariance,
)


def ledoit_wolf_shrinkage(
    returns: pd.DataFrame,
    annualize: bool = True,
    periods_per_year: int = 252,
) -> Tuple[pd.DataFrame, float]:
    """
    Compute covariance matrix using Ledoit-Wolf shrinkage.

    This provides an analytically optimal shrinkage intensity that minimizes
    the expected squared Frobenius norm of the estimation error.

    Mathematical formulation:
        Σ_LW = δ * F + (1 - δ) * S

    Where:
        S = sample covariance
        F = shrinkage target (constant correlation model)
        δ = optimal shrinkage intensity (analytically derived)

    Args:
        returns: Historical returns DataFrame (T × N)
        annualize: Whether to annualize the covariance matrix
        periods_per_year: Number of periods per year (252 for daily)

    Returns:
        (covariance_matrix, shrinkage_intensity)
        - covariance_matrix: Shrunk covariance as DataFrame
        - shrinkage_intensity: δ ∈ [0, 1] (higher = more shrinkage)
    """
    lw = LedoitWolf(store_precision=False)
    lw.fit(returns.values)

    cov_matrix = lw.covariance_
    shrinkage = lw.shrinkage_

    if annualize:
        cov_matrix = cov_matrix * periods_per_year

    cov_df = pd.DataFrame(
        cov_matrix,
        index=returns.columns,
        columns=returns.columns
    )

    return cov_df, shrinkage


def oas_shrinkage(
    returns: pd.DataFrame,
    annualize: bool = True,
    periods_per_year: int = 252,
) -> Tuple[pd.DataFrame, float]:
    """
    Compute covariance using Oracle Approximating Shrinkage (OAS).

    OAS is similar to Ledoit-Wolf but uses a different formula for the
    optimal shrinkage intensity. It can provide better performance when
    the true eigenvalues are spread out.

    Args:
        returns: Historical returns DataFrame (T × N)
        annualize: Whether to annualize the covariance matrix
        periods_per_year: Number of periods per year (252 for daily)

    Returns:
        (covariance_matrix, shrinkage_intensity)
    """
    oas = OAS(store_precision=False)
    oas.fit(returns.values)

    cov_matrix = oas.covariance_
    shrinkage = oas.shrinkage_

    if annualize:
        cov_matrix = cov_matrix * periods_per_year

    cov_df = pd.DataFrame(
        cov_matrix,
        index=returns.columns,
        columns=returns.columns
    )

    return cov_df, shrinkage


def robust_covariance_mcd(
    returns: pd.DataFrame,
    annualize: bool = True,
    periods_per_year: int = 252,
    support_fraction: Optional[float] = None,
) -> pd.DataFrame:
    """
    Compute robust covariance using Minimum Covariance Determinant (MCD).

    MCD is robust to outliers - it finds the subset of observations with
    the smallest covariance determinant. Useful when returns have fat tails
    or occasional extreme events.

    Args:
        returns: Historical returns DataFrame (T × N)
        annualize: Whether to annualize the covariance matrix
        periods_per_year: Number of periods per year (252 for daily)
        support_fraction: Fraction of inliers (default: auto-tuned)

    Returns:
        Robust covariance matrix as DataFrame
    """
    mcd = MinCovDet(
        support_fraction=support_fraction,
        random_state=42
    )
    mcd.fit(returns.values)

    cov_matrix = mcd.covariance_

    if annualize:
        cov_matrix = cov_matrix * periods_per_year

    cov_df = pd.DataFrame(
        cov_matrix,
        index=returns.columns,
        columns=returns.columns
    )

    return cov_df


def exponential_covariance(
    returns: pd.DataFrame,
    halflife: int = 60,
    annualize: bool = True,
    periods_per_year: int = 252,
) -> pd.DataFrame:
    """
    Compute exponentially-weighted covariance matrix.

    Recent observations receive higher weight, allowing the covariance
    to adapt to changing market conditions. Useful for risk management
    when volatility is time-varying.

    Weight for observation t periods ago: w_t = (1 - λ) * λ^t
    Where λ = 2^(-1/halflife)

    Args:
        returns: Historical returns DataFrame (T × N)
        halflife: Number of periods for weights to decay by half (default 60 days)
        annualize: Whether to annualize the covariance matrix
        periods_per_year: Number of periods per year (252 for daily)

    Returns:
        Exponentially-weighted covariance matrix as DataFrame
    """
    # Compute decay factor from halflife
    # After 'halflife' periods, weight = 0.5
    decay = 2 ** (-1 / halflife)

    # Compute EWMA covariance
    ewm_cov = returns.ewm(alpha=1 - decay).cov().iloc[-len(returns.columns):, :]

    if annualize:
        ewm_cov = ewm_cov * periods_per_year

    return ewm_cov


def sample_covariance(
    returns: pd.DataFrame,
    annualize: bool = True,
    periods_per_year: int = 252,
    min_periods: Optional[int] = None,
) -> pd.DataFrame:
    """
    Compute sample covariance matrix (baseline, no shrinkage).

    This is the standard unbiased estimator. Use for comparison or when
    T >> N (many observations, few assets).

    Args:
        returns: Historical returns DataFrame (T × N)
        annualize: Whether to annualize the covariance matrix
        periods_per_year: Number of periods per year (252 for daily)
        min_periods: Minimum number of observations required

    Returns:
        Sample covariance matrix as DataFrame
    """
    cov = returns.cov(min_periods=min_periods)

    if annualize:
        cov = cov * periods_per_year

    return cov


def condition_number(cov: pd.DataFrame) -> float:
    """
    Compute condition number of covariance matrix.

    Condition number = λ_max / λ_min (ratio of largest to smallest eigenvalue)

    Interpretation:
    - κ < 10:      Well-conditioned
    - κ < 100:     Acceptable
    - κ < 1000:    Ill-conditioned (use shrinkage!)
    - κ > 1000:    Severely ill-conditioned

    Args:
        cov: Covariance matrix

    Returns:
        Condition number
    """
    eigvals = np.linalg.eigvalsh(cov.values)
    eigvals = eigvals[eigvals > 1e-10]  # Filter near-zero eigenvalues

    if len(eigvals) == 0:
        return np.inf

    return float(eigvals.max() / eigvals.min())


def effective_rank(cov: pd.DataFrame) -> float:
    """
    Compute effective rank of covariance matrix.

    Effective rank is the exponential of the entropy of normalized eigenvalues.
    It measures the "true dimensionality" of the covariance structure.

    A lower effective rank indicates that many assets move together (high correlation),
    reducing diversification benefits.

    Args:
        cov: Covariance matrix

    Returns:
        Effective rank (between 1 and N)
    """
    eigvals = np.linalg.eigvalsh(cov.values)
    eigvals = eigvals[eigvals > 1e-10]

    if len(eigvals) == 0:
        return 1.0

    # Normalize eigenvalues to sum to 1
    probs = eigvals / eigvals.sum()

    # Compute entropy
    entropy = -np.sum(probs * np.log(probs + 1e-10))

    # Effective rank = exp(entropy)
    return float(np.exp(entropy))


def compare_estimators(
    returns: pd.DataFrame,
    annualize: bool = True,
    periods_per_year: int = 252,
) -> pd.DataFrame:
    """
    Compare different covariance estimators.

    Computes condition number and effective rank for:
    - Sample covariance
    - Ledoit-Wolf shrinkage
    - OAS shrinkage
    - Exponential weighting

    Args:
        returns: Historical returns DataFrame (T × N)
        annualize: Whether to annualize the covariance matrices
        periods_per_year: Number of periods per year

    Returns:
        DataFrame comparing estimators
    """
    results = []

    # Sample covariance
    cov_sample = sample_covariance(returns, annualize, periods_per_year)
    results.append({
        "estimator": "Sample",
        "condition_number": condition_number(cov_sample),
        "effective_rank": effective_rank(cov_sample),
        "shrinkage": 0.0,
    })

    # Ledoit-Wolf
    cov_lw, shrinkage_lw = ledoit_wolf_shrinkage(returns, annualize, periods_per_year)
    results.append({
        "estimator": "Ledoit-Wolf",
        "condition_number": condition_number(cov_lw),
        "effective_rank": effective_rank(cov_lw),
        "shrinkage": shrinkage_lw,
    })

    # OAS
    cov_oas, shrinkage_oas = oas_shrinkage(returns, annualize, periods_per_year)
    results.append({
        "estimator": "OAS",
        "condition_number": condition_number(cov_oas),
        "effective_rank": effective_rank(cov_oas),
        "shrinkage": shrinkage_oas,
    })

    # Exponential
    cov_exp = exponential_covariance(returns, annualize=annualize, periods_per_year=periods_per_year)
    results.append({
        "estimator": "Exponential (60d)",
        "condition_number": condition_number(cov_exp),
        "effective_rank": effective_rank(cov_exp),
        "shrinkage": np.nan,
    })

    return pd.DataFrame(results)
