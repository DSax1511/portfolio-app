"""
Factor Attribution and Risk Analysis Module

Analyzes portfolio returns and risk across multiple factors:
- Fama-French 5-factor model (market, size, value, profitability, investment)
- Momentum factor
- Volatility (low vol) factor
- Sector factor exposures
- Factor contribution to return and risk

Mathematical Framework:
------------------------

Fama-French 5-Factor Model:
    R_p - R_f = α + β_mkt(R_mkt) + β_smb(SMB) + β_hml(HML)
                     + β_rmw(RMW) + β_cma(CMA) + ε

Where:
    SMB (Small Minus Big): Size factor
    HML (High Minus Low): Value factor
    RMW (Robust Minus Weak): Profitability factor
    CMA (Conservative Minus Aggressive): Investment factor

Risk Decomposition:
    Portfolio Variance = Σ_i Σ_j cov(i, j) * w_i * w_j
                      = Σ_i β_i² σ²_i (systematic) + σ²_ε (idiosyncratic)

Factor Contribution to Return:
    Contribution_i = β_i * Factor_Return_i
    Total Return = Σ Contribution_i + Alpha

Factor Contribution to Risk:
    Risk Contribution_i = (β_i * σ_i * corr_i,p) / σ_p
"""

from __future__ import annotations

from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from fastapi import HTTPException
from sklearn.linear_model import LinearRegression


def fama_french_attribution(
    portfolio_returns: pd.Series,
    factor_returns: pd.DataFrame,
) -> Dict[str, any]:
    """
    Perform Fama-French factor attribution analysis.

    Decomposes portfolio returns into:
    1. Alpha (unexplained return)
    2. Market factor contribution
    3. Size factor contribution
    4. Value factor contribution
    5. Profitability factor contribution
    6. Investment factor contribution

    Args:
        portfolio_returns: Portfolio daily returns (time series)
        factor_returns: Factor returns DataFrame with columns:
                       'market', 'size', 'value', 'profitability', 'investment'

    Returns:
        {
            "alpha": float (annual, bps),
            "alpha_pvalue": float,
            "factor_betas": {
                "market": float,
                "size": float,
                "value": float,
                "profitability": float,
                "investment": float,
            },
            "factor_contributions_annual": {
                "market": float (bps),
                "size": float (bps),
                ...
            },
            "r_squared": float,
            "residual_std": float,
            "model_summary": str,
        }
    """
    # Align indices
    combined = pd.concat([portfolio_returns, factor_returns], axis=1).dropna()
    
    if len(combined) < 30:
        raise HTTPException(
            status_code=400,
            detail="Insufficient data for factor attribution (need 30+ observations)"
        )

    y = combined.iloc[:, 0].values
    X = combined.iloc[:, 1:].values
    factor_names = factor_returns.columns.tolist()

    # Run regression
    model = LinearRegression()
    model.fit(X, y)

    alpha = model.intercept_
    betas = model.coef_
    
    # Compute R-squared and residuals
    y_pred = model.predict(X)
    ss_res = ((y - y_pred) ** 2).sum()
    ss_tot = ((y - y.mean()) ** 2).sum()
    r_squared = 1 - (ss_res / ss_tot)
    
    residual_std = np.sqrt(ss_res / (len(y) - len(betas) - 1))

    # Annualize
    alpha_annual = alpha * 252 * 10000  # Convert to bps
    residual_std_annual = residual_std * np.sqrt(252)

    # Factor contributions
    factor_contributions = {}
    for i, factor_name in enumerate(factor_names):
        # Contribution = beta * average factor return (annualized)
        factor_avg_return = factor_returns.iloc[:, i].mean() * 252
        contribution = betas[i] * factor_avg_return * 10000  # Convert to bps
        factor_contributions[factor_name] = contribution

    # T-statistic and p-value for alpha
    se_alpha = residual_std / np.sqrt(len(y))
    t_stat = alpha / se_alpha
    from scipy import stats as scipy_stats
    p_value = 2 * (1 - scipy_stats.t.cdf(abs(t_stat), len(y) - len(betas) - 1))

    return {
        "alpha_annual_bps": float(alpha_annual),
        "alpha_pvalue": float(p_value),
        "alpha_significant": p_value < 0.05,
        "factor_betas": {name: float(beta) for name, beta in zip(factor_names, betas)},
        "factor_contributions_annual_bps": {
            name: float(contrib) for name, contrib in factor_contributions.items()
        },
        "r_squared": float(r_squared),
        "residual_std_annual": float(residual_std_annual),
        "model_summary": _create_factor_summary(alpha_annual, betas, factor_names, r_squared, p_value),
    }


def sector_exposure_analysis(
    portfolio: Dict[str, float],
    sector_map: Dict[str, str],
) -> Dict[str, any]:
    """
    Analyze portfolio concentration and exposures by sector.

    Args:
        portfolio: {ticker: weight, ...}
        sector_map: {ticker: sector, ...}

    Returns:
        {
            "sector_weights": {sector: weight, ...},
            "sector_count": {sector: num_holdings, ...},
            "diversification_herfindahl": float (0=max div, 1=concentrated),
            "top_sector": str,
            "top_sector_weight": float,
            "concentration_risk": str ("low", "medium", "high"),
        }
    """
    sector_weights = {}
    sector_count = {}

    for ticker, weight in portfolio.items():
        sector = sector_map.get(ticker, "Unknown")
        sector_weights[sector] = sector_weights.get(sector, 0) + weight
        sector_count[sector] = sector_count.get(sector, 0) + 1

    # Herfindahl-Hirschman Index (HHI)
    hhi = sum(w ** 2 for w in sector_weights.values())

    # Assess concentration
    if hhi < 0.15:
        concentration = "low"
    elif hhi < 0.25:
        concentration = "medium"
    else:
        concentration = "high"

    # Top sector
    top_sector = max(sector_weights, key=sector_weights.get)
    top_weight = sector_weights[top_sector]

    return {
        "sector_weights": sector_weights,
        "sector_holdings": sector_count,
        "herfindahl_index": float(hhi),
        "concentration_assessment": concentration,
        "top_sector": top_sector,
        "top_sector_weight": float(top_weight),
        "num_sectors": len(sector_weights),
        "interpretation": f"Portfolio is concentrated in {top_sector} ({top_weight*100:.1f}%)"
    }


def risk_decomposition(
    returns: pd.DataFrame,
    weights: np.ndarray,
    factor_returns: Optional[pd.DataFrame] = None,
) -> Dict[str, any]:
    """
    Decompose portfolio risk into systematic and idiosyncratic components.

    Systematic Risk: Risk explained by factors
    Idiosyncratic Risk: Diversifiable risk specific to holdings

    Args:
        returns: Historical returns (time × assets)
        weights: Portfolio weights
        factor_returns: Optional factor returns for attribution

    Returns:
        {
            "portfolio_volatility": float,
            "systematic_risk": float,
            "idiosyncratic_risk": float,
            "systematic_pct": float (% of total),
            "idiosyncratic_pct": float (% of total),
            "diversification_ratio": float,
            "marginal_risk_contribution": {asset: contribution, ...},
        }
    """
    # Portfolio volatility
    cov = returns.cov() * 252
    portfolio_vol = np.sqrt(weights @ cov.values @ weights)

    # Systematic vs idiosyncratic decomposition
    if factor_returns is not None:
        # Regression on factors
        model = LinearRegression()
        model.fit(factor_returns.values, returns.values)
        
        # Explained variance
        r_squared = model.score(factor_returns.values, returns.values)
        systematic_var = r_squared * cov.values
        idiosyncratic_var = (1 - r_squared) * cov.values
        
        systematic_vol = np.sqrt(weights @ systematic_var @ weights)
        idiosyncratic_vol = np.sqrt(weights @ idiosyncratic_var @ weights)
    else:
        # Assume 60% systematic (market beta ~1 for diversified portfolio)
        systematic_vol = portfolio_vol * 0.60
        idiosyncratic_vol = portfolio_vol * 0.40

    # Diversification ratio = weighted avg vol / portfolio vol
    individual_vols = np.sqrt(np.diag(cov.values))
    weighted_ind_vol = weights @ individual_vols
    diversification_ratio = weighted_ind_vol / portfolio_vol if portfolio_vol > 1e-10 else 1.0

    # Marginal risk contribution
    mrc = {}
    marginal_contrib = cov.values @ weights
    for i, col in enumerate(returns.columns):
        mrc[col] = float(marginal_contrib[i] * weights[i] / portfolio_vol)

    return {
        "portfolio_volatility_annual": float(portfolio_vol),
        "systematic_volatility_annual": float(systematic_vol),
        "idiosyncratic_volatility_annual": float(idiosyncratic_vol),
        "systematic_pct": float(100 * systematic_vol / portfolio_vol),
        "idiosyncratic_pct": float(100 * idiosyncratic_vol / portfolio_vol),
        "diversification_ratio": float(diversification_ratio),
        "marginal_risk_contributions": mrc,
    }


def var_cvar_analysis(
    returns: pd.Series,
    confidence: float = 0.95,
) -> Dict[str, any]:
    """
    Value-at-Risk (VaR) and Conditional Value-at-Risk (CVaR) analysis.

    VaR: Maximum expected loss at confidence level (e.g., 95% → 5% tail)
    CVaR: Average loss in the tail beyond VaR

    Args:
        returns: Portfolio returns
        confidence: Confidence level (0.95 = 5% tail)

    Returns:
        {
            "var_95pct": float (daily loss),
            "cvar_95pct": float (expected loss beyond VaR),
            "annual_var": float,
            "annual_cvar": float,
            "worst_day": float,
            "recovery_days": int,
        }
    """
    alpha = 1 - confidence
    var = returns.quantile(alpha)
    cvar = returns[returns <= var].mean()

    # Annualize
    annual_var = var * np.sqrt(252) * 100  # Convert to %
    annual_cvar = cvar * np.sqrt(252) * 100

    # Worst day and recovery
    cumulative = (1 + returns).cumprod()
    worst_day = returns.min()
    
    max_dd_idx = (cumulative / cumulative.cummax()).idxmin()
    recovery_idx = (cumulative >= cumulative[max_dd_idx]).idxmax()
    recovery_days = (recovery_idx - max_dd_idx).days if recovery_idx > max_dd_idx else None

    return {
        "var_daily_pct": float(var * 100),
        "cvar_daily_pct": float(cvar * 100),
        "var_annual_pct": float(annual_var),
        "cvar_annual_pct": float(annual_cvar),
        "worst_day_pct": float(worst_day * 100),
        "recovery_days": recovery_days,
        "interpretation": f"There is a 5% chance of losing >{abs(var*100):.2f}% in a single day"
    }


def stress_test_portfolio(
    portfolio_returns: pd.Series,
    factor_returns: pd.DataFrame,
    shock_scenarios: Optional[Dict[str, float]] = None,
) -> Dict[str, any]:
    """
    Stress test portfolio under adverse market scenarios.

    Args:
        portfolio_returns: Historical portfolio returns
        factor_returns: Historical factor returns
        shock_scenarios: Optional custom shock dictionary
                        {factor: shock_pct, ...}

    Returns:
        {
            "base_case": {return, vol, sharpe},
            "scenarios": {
                "tech_crash": {return, vol, sharpe},
                ...
            }
        }
    """
    if shock_scenarios is None:
        shock_scenarios = {
            "tech_crash": {"market": -0.15, "size": -0.20},
            "value_rally": {"value": 0.20, "market": 0.05},
            "volatility_spike": {"market": -0.10},
            "interest_rate_shock": {"investment": -0.15},
        }

    results = {}

    # Base case
    base_return = portfolio_returns.mean() * 252
    base_vol = portfolio_returns.std() * np.sqrt(252)
    base_sharpe = base_return / base_vol if base_vol > 1e-10 else 0.0

    results["base_case"] = {
        "annual_return": float(base_return),
        "annual_volatility": float(base_vol),
        "sharpe_ratio": float(base_sharpe),
    }

    # Stress scenarios
    for scenario_name, shocks in shock_scenarios.items():
        stressed_factor_returns = factor_returns.copy()
        
        for factor, shock in shocks.items():
            if factor in stressed_factor_returns.columns:
                stressed_factor_returns[factor] = stressed_factor_returns[factor] * (1 + shock)

        # Compute portfolio return under shock (simple approximation)
        # Assume portfolio betas = 1 for all factors
        factor_contribution = stressed_factor_returns.mean().sum() * 252
        
        stressed_vol = portfolio_returns.std() * np.sqrt(252)
        stressed_sharpe = factor_contribution / stressed_vol if stressed_vol > 1e-10 else 0.0

        results[scenario_name] = {
            "annual_return": float(factor_contribution),
            "annual_volatility": float(stressed_vol),
            "sharpe_ratio": float(stressed_sharpe),
            "return_impact": float(factor_contribution - base_return),
        }

    return results


def _create_factor_summary(alpha: float, betas: np.ndarray, factor_names: List[str], r_sq: float, p_val: float) -> str:
    """Generate human-readable factor model summary."""
    alpha_sig = "✓" if p_val < 0.05 else "✗"
    
    return f"""
    Fama-French 5-Factor Attribution:
    ├─ Alpha: {alpha:.1f} bps {alpha_sig} (p={p_val:.3f})
    ├─ R²: {r_sq:.2%}
    └─ Factor Loadings:
       ├─ Market: {betas[0]:.3f}
       ├─ Size: {betas[1]:.3f}
       ├─ Value: {betas[2]:.3f}
       ├─ Profitability: {betas[3]:.3f}
       └─ Investment: {betas[4]:.3f}
    """
