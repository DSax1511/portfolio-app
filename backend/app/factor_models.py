"""
Multi-Factor Models for Asset Pricing and Risk Decomposition

This module implements industry-standard factor models used at quantitative
hedge funds and asset managers for:
1. Risk attribution (which factors drive portfolio volatility?)
2. Performance attribution (is alpha real or factor exposure?)
3. Portfolio construction (target specific factor loadings)

Models implemented:
-------------------
1. Fama-French 5-Factor Model (2015)
2. Carhart 4-Factor Model (Fama-French 3 + Momentum)
3. Custom factor models with user-defined factors

Mathematical Framework:
-----------------------

Factor model regression:
    R_i,t - R_f,t = α_i + Σ_j β_ij * F_j,t + ε_i,t

Where:
    R_i,t = return of asset i at time t
    R_f,t = risk-free rate at time t
    α_i = alpha (excess return not explained by factors)
    β_ij = loading of asset i on factor j (sensitivity)
    F_j,t = return of factor j at time t
    ε_i,t = idiosyncratic return (residual)

Fama-French 5 Factors:
1. Mkt-RF: Market excess return (broad market - risk-free rate)
2. SMB: Small Minus Big (small cap premium)
3. HML: High Minus Low (value premium)
4. RMW: Robust Minus Weak (profitability premium)
5. CMA: Conservative Minus Aggressive (investment premium)

The model captures:
- Market risk (beta)
- Size effect (small caps outperform)
- Value effect (high B/P outperforms)
- Profitability effect (high operating profitability outperforms)
- Investment effect (conservative investment outperforms)

Risk Decomposition:
-------------------
Total variance: Var(R_i) = Σ_j Σ_k β_ij β_ik Cov(F_j, F_k) + Var(ε_i)
               = Factor risk + Idiosyncratic risk

Percentage factor risk = Factor variance / Total variance
"""

from __future__ import annotations

from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from scipy import stats


def fama_french_5factor_regression(
    returns: pd.Series,
    factor_returns: pd.DataFrame,
    risk_free_rate: Optional[pd.Series] = None,
) -> Dict:
    """
    Run Fama-French 5-factor regression for a single asset or portfolio.

    Regression model:
        R_t - R_f,t = α + β_mkt*(Mkt-RF)_t + β_smb*SMB_t + β_hml*HML_t
                       + β_rmw*RMW_t + β_cma*CMA_t + ε_t

    Args:
        returns: Asset/portfolio returns (T,)
        factor_returns: Factor returns DataFrame with columns:
                       ['Mkt-RF', 'SMB', 'HML', 'RMW', 'CMA']
        risk_free_rate: Risk-free rate (T,). If None, assumed zero.

    Returns:
        Dictionary containing:
        - alpha: Intercept (annualized)
        - betas: Dict of factor loadings
        - r_squared: R² of regression
        - adj_r_squared: Adjusted R²
        - residuals: Regression residuals
        - t_stats: t-statistics for each coefficient
        - p_values: p-values for each coefficient
        - factor_variance: Variance explained by factors
        - idiosyncratic_variance: Variance of residuals
        - total_variance: Total return variance
    """
    # Align indices
    common_idx = returns.index.intersection(factor_returns.index)
    if len(common_idx) == 0:
        raise ValueError("No overlapping dates between returns and factor_returns")

    y = returns.loc[common_idx].values
    X_factors = factor_returns.loc[common_idx].values

    # Subtract risk-free rate if provided
    if risk_free_rate is not None:
        rf = risk_free_rate.loc[common_idx].values
        y = y - rf

    # Add intercept column
    X = np.column_stack([np.ones(len(y)), X_factors])

    # OLS regression: β = (X'X)^-1 X'y
    try:
        XtX_inv = np.linalg.inv(X.T @ X)
        beta = XtX_inv @ (X.T @ y)
    except np.linalg.LinAlgError:
        raise ValueError("Singular matrix in regression (multicollinearity?)")

    # Predictions and residuals
    y_pred = X @ beta
    residuals = y - y_pred

    # R-squared
    ss_res = np.sum(residuals ** 2)
    ss_tot = np.sum((y - np.mean(y)) ** 2)
    r_squared = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0.0

    # Adjusted R-squared
    n = len(y)
    k = X.shape[1] - 1  # Number of factors (excluding intercept)
    adj_r_squared = 1 - (1 - r_squared) * (n - 1) / (n - k - 1)

    # Standard errors and t-statistics
    residual_variance = ss_res / (n - k - 1)
    se = np.sqrt(np.diag(XtX_inv) * residual_variance)
    t_stats = beta / se
    p_values = 2 * (1 - stats.t.cdf(np.abs(t_stats), df=n - k - 1))

    # Annualize alpha (assume daily returns, 252 trading days)
    alpha_annualized = beta[0] * 252

    # Factor loadings
    factor_names = factor_returns.columns.tolist()
    betas = {name: beta[i + 1] for i, name in enumerate(factor_names)}

    # Variance decomposition
    total_variance = np.var(y, ddof=1)
    idiosyncratic_variance = np.var(residuals, ddof=1)
    factor_variance = total_variance - idiosyncratic_variance

    # Coefficient statistics
    coef_stats = {
        "alpha": {
            "estimate": alpha_annualized,
            "t_stat": t_stats[0],
            "p_value": p_values[0],
        }
    }
    for i, name in enumerate(factor_names):
        coef_stats[name] = {
            "estimate": beta[i + 1],
            "t_stat": t_stats[i + 1],
            "p_value": p_values[i + 1],
        }

    return {
        "alpha": alpha_annualized,
        "betas": betas,
        "r_squared": r_squared,
        "adj_r_squared": adj_r_squared,
        "residuals": pd.Series(residuals, index=common_idx),
        "coefficient_stats": coef_stats,
        "factor_variance": factor_variance,
        "idiosyncratic_variance": idiosyncratic_variance,
        "total_variance": total_variance,
        "pct_factor_risk": factor_variance / total_variance if total_variance > 0 else 0.0,
    }


def carhart_4factor_regression(
    returns: pd.Series,
    factor_returns: pd.DataFrame,
    risk_free_rate: Optional[pd.Series] = None,
) -> Dict:
    """
    Run Carhart 4-factor regression (Fama-French 3 + Momentum).

    Regression model:
        R_t - R_f,t = α + β_mkt*(Mkt-RF)_t + β_smb*SMB_t + β_hml*HML_t
                       + β_mom*MOM_t + ε_t

    Args:
        returns: Asset/portfolio returns
        factor_returns: Factor returns DataFrame with columns:
                       ['Mkt-RF', 'SMB', 'HML', 'MOM']
        risk_free_rate: Risk-free rate. If None, assumed zero.

    Returns:
        Same structure as fama_french_5factor_regression
    """
    # Use the same regression function (works for any factor set)
    return fama_french_5factor_regression(returns, factor_returns, risk_free_rate)


def rolling_factor_betas(
    returns: pd.Series,
    factor_returns: pd.DataFrame,
    window: int = 252,
    min_periods: int = 126,
) -> pd.DataFrame:
    """
    Compute rolling factor betas to track time-varying exposures.

    Useful for:
    - Detecting style drift in a fund
    - Monitoring factor timing strategies
    - Risk attribution over time

    Args:
        returns: Asset/portfolio returns
        factor_returns: Factor returns DataFrame
        window: Rolling window size (default 252 = 1 year daily)
        min_periods: Minimum observations required

    Returns:
        DataFrame with rolling betas for each factor
    """
    common_idx = returns.index.intersection(factor_returns.index)
    returns = returns.loc[common_idx]
    factor_returns = factor_returns.loc[common_idx]

    factor_names = factor_returns.columns.tolist()
    rolling_betas = pd.DataFrame(index=common_idx, columns=["alpha"] + factor_names)

    for i in range(len(common_idx)):
        if i < min_periods - 1:
            continue

        # Get window of data
        start_idx = max(0, i - window + 1)
        end_idx = i + 1

        ret_window = returns.iloc[start_idx:end_idx]
        factors_window = factor_returns.iloc[start_idx:end_idx]

        # Run regression on window
        try:
            result = fama_french_5factor_regression(ret_window, factors_window)
            rolling_betas.loc[common_idx[i], "alpha"] = result["alpha"]
            for factor, beta in result["betas"].items():
                rolling_betas.loc[common_idx[i], factor] = beta
        except Exception:
            continue

    return rolling_betas.astype(float)


def build_synthetic_factor_returns(
    tickers: List[str],
    start_date: str,
    end_date: str,
    use_ff_proxies: bool = True,
) -> pd.DataFrame:
    """
    Build synthetic factor returns using ETF proxies.

    This is a simplified approach for demonstration. Production systems
    should use official Fama-French data from Kenneth French's data library.

    Factor proxies (ETFs):
    - Mkt-RF: SPY (S&P 500) minus risk-free rate
    - SMB: IWM (Russell 2000) minus IVV (S&P 500)
    - HML: VTV (Value) minus VUG (Growth)
    - RMW: QUAL (Quality) minus SPY
    - CMA: Low turnover minus high turnover (simplified)
    - MOM: MTUM (Momentum) minus SPY

    Args:
        tickers: List of tickers (used for date alignment)
        start_date: Start date
        end_date: End date
        use_ff_proxies: If True, use ETF proxies. If False, return zeros.

    Returns:
        DataFrame with factor returns
    """
    if not use_ff_proxies:
        # Return zero factors (placeholder)
        dates = pd.date_range(start=start_date, end=end_date, freq='B')
        return pd.DataFrame(
            0.0,
            index=dates,
            columns=['Mkt-RF', 'SMB', 'HML', 'RMW', 'CMA']
        )

    # In a real implementation, fetch ETF data and compute factor proxies
    # For now, return a placeholder structure
    # TODO: Implement ETF-based factor construction or fetch from Kenneth French

    dates = pd.date_range(start=start_date, end=end_date, freq='B')
    np.random.seed(42)

    # Stylized factor returns (for demonstration)
    factor_returns = pd.DataFrame({
        'Mkt-RF': np.random.normal(0.0005, 0.012, len(dates)),  # Market premium
        'SMB': np.random.normal(0.0001, 0.004, len(dates)),     # Size premium
        'HML': np.random.normal(0.0001, 0.005, len(dates)),     # Value premium
        'RMW': np.random.normal(0.0002, 0.003, len(dates)),     # Profitability
        'CMA': np.random.normal(0.0001, 0.003, len(dates)),     # Investment
    }, index=dates)

    return factor_returns


def portfolio_factor_decomposition(
    portfolio_returns: pd.Series,
    factor_returns: pd.DataFrame,
    position_weights: Optional[pd.Series] = None,
) -> Dict:
    """
    Decompose portfolio risk into factor and idiosyncratic components.

    Returns detailed attribution:
    - How much variance comes from each factor
    - How much from asset-specific (idiosyncratic) risk
    - Marginal contribution of each factor to portfolio volatility

    Args:
        portfolio_returns: Portfolio returns
        factor_returns: Factor returns DataFrame
        position_weights: Current position weights (for marginal analysis)

    Returns:
        Dictionary with risk decomposition
    """
    result = fama_french_5factor_regression(portfolio_returns, factor_returns)

    # Extract factor covariance matrix
    factor_cov = factor_returns.cov().values * 252  # Annualized

    # Factor loadings (betas)
    betas = np.array([result["betas"][col] for col in factor_returns.columns])

    # Factor contribution to variance
    factor_var_components = {}
    total_factor_var = 0.0

    for i, factor in enumerate(factor_returns.columns):
        # Marginal contribution of factor i: β_i * (Cov(F) @ β)_i
        marginal = betas[i] * (factor_cov @ betas)[i]
        factor_var_components[factor] = marginal
        total_factor_var += marginal

    # Idiosyncratic variance
    idio_var = result["idiosyncratic_variance"] * 252  # Annualized

    # Total portfolio variance
    total_var = total_factor_var + idio_var

    # Percentage contributions
    pct_contributions = {
        factor: var / total_var * 100 if total_var > 0 else 0.0
        for factor, var in factor_var_components.items()
    }
    pct_contributions["Idiosyncratic"] = idio_var / total_var * 100 if total_var > 0 else 0.0

    return {
        "factor_betas": result["betas"],
        "alpha": result["alpha"],
        "r_squared": result["r_squared"],
        "total_variance": total_var,
        "factor_variance": total_factor_var,
        "idiosyncratic_variance": idio_var,
        "factor_variance_contributions": factor_var_components,
        "percentage_contributions": pct_contributions,
        "total_volatility": np.sqrt(total_var),
        "factor_volatility": np.sqrt(total_factor_var),
        "idiosyncratic_volatility": np.sqrt(idio_var),
    }


def attribution_report(
    portfolio_returns: pd.Series,
    factor_returns: pd.DataFrame,
) -> pd.DataFrame:
    """
    Generate a comprehensive factor attribution report.

    Args:
        portfolio_returns: Portfolio returns
        factor_returns: Factor returns DataFrame

    Returns:
        DataFrame with factor exposures, contributions, and statistics
    """
    decomp = portfolio_factor_decomposition(portfolio_returns, factor_returns)

    rows = []

    # Factor rows
    for factor in factor_returns.columns:
        rows.append({
            "Component": factor,
            "Beta": decomp["factor_betas"].get(factor, 0.0),
            "Variance Contribution": decomp["factor_variance_contributions"].get(factor, 0.0),
            "% of Total Risk": decomp["percentage_contributions"].get(factor, 0.0),
        })

    # Idiosyncratic row
    rows.append({
        "Component": "Idiosyncratic",
        "Beta": np.nan,
        "Variance Contribution": decomp["idiosyncratic_variance"],
        "% of Total Risk": decomp["percentage_contributions"]["Idiosyncratic"],
    })

    # Summary row
    rows.append({
        "Component": "Total",
        "Beta": np.nan,
        "Variance Contribution": decomp["total_variance"],
        "% of Total Risk": 100.0,
    })

    df = pd.DataFrame(rows)

    return df
