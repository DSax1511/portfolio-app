"""
Risk Analytics Module

Comprehensive risk measurement and stress testing:
1. VaR/CVaR using multiple methodologies (historical, parametric, Monte Carlo)
2. Stress testing with historical crisis scenarios
3. PCA decomposition for factor analysis
4. Tail risk metrics (Omega ratio, gain/pain, drawdown analysis)
"""

from typing import Dict, List, Optional, Tuple, Any
import numpy as np
import pandas as pd
from scipy import stats
from sklearn.decomposition import PCA
import warnings

warnings.filterwarnings("ignore")


def compute_var_cvar(
    returns: pd.Series,
    confidence_level: float = 0.95,
    method: str = "historical",
    distribution: str = "normal",
) -> Dict[str, Any]:
    """
    Compute Value at Risk (VaR) and Conditional VaR (CVaR/ES).

    Methods:
    - historical: Empirical quantile of returns
    - parametric: Assumes normal or t-distribution
    - cornish_fisher: Adjusts for skewness and kurtosis

    Args:
        returns: Daily returns series
        confidence_level: Confidence level (e.g., 0.95 = 95%)
        method: "historical", "parametric", or "cornish_fisher"
        distribution: "normal" or "t" (for parametric)

    Returns:
        Dictionary with VaR, CVaR, and diagnostics
    """
    returns = returns.dropna()
    alpha = 1 - confidence_level

    if method == "historical":
        var = -np.percentile(returns, alpha * 100)
        cvar = -returns[returns <= -var].mean()

    elif method == "parametric":
        mu = returns.mean()
        sigma = returns.std()

        if distribution == "normal":
            z_score = stats.norm.ppf(alpha)
            var = -(mu + sigma * z_score)
        elif distribution == "t":
            # Fit t-distribution
            df, loc, scale = stats.t.fit(returns)
            t_score = stats.t.ppf(alpha, df)
            var = -(loc + scale * t_score)
        else:
            raise ValueError(f"Unknown distribution: {distribution}")

        # CVaR for parametric
        if distribution == "normal":
            cvar = sigma * stats.norm.pdf(z_score) / alpha - mu
        else:
            # Analytical CVaR for t-distribution
            # CVaR = mu + sigma * E[T | T < t_alpha] where T ~ t(df)
            t_alpha = stats.t.ppf(alpha, df)
            pdf_val = stats.t.pdf(t_alpha, df)
            conditional_expectation = -(df / (df - 1)) * pdf_val / alpha * ((df + t_alpha**2) / df)
            cvar = -(loc + scale * conditional_expectation)

    elif method == "cornish_fisher":
        # Cornish-Fisher expansion for non-normal distributions
        mu = returns.mean()
        sigma = returns.std()
        skew = returns.skew()
        kurt = returns.kurtosis()

        z = stats.norm.ppf(alpha)
        z_cf = (z +
                (z**2 - 1) * skew / 6 +
                (z**3 - 3 * z) * kurt / 24 -
                (2 * z**3 - 5 * z) * skew**2 / 36)

        var = -(mu + sigma * z_cf)
        cvar = -returns[returns <= -var].mean()

    else:
        raise ValueError(f"Unknown method: {method}")

    # Annualized metrics
    # Note: This assumes IID returns and scales VaR by sqrt(252).
    # For non-normal distributions or autocorrelated returns, this may underestimate tail risk.
    # More sophisticated approaches (e.g., Monte Carlo with fat tails, GARCH-based forecasting)
    # should be used for production risk systems.
    #
    # Why sqrt(252)?
    # - Assumes daily returns are IID with stable variance σ²
    # - Variance of T-day sum = T * σ² (additivity of variance for independent variables)
    # - Standard deviation (and VaR) scales as sqrt(T)
    # - For trading days: sqrt(252) ≈ 15.87
    var_annual = var * np.sqrt(252)
    cvar_annual = cvar * np.sqrt(252)

    return {
        "var_daily": float(var),
        "cvar_daily": float(cvar),
        "var_annual": float(var_annual),
        "cvar_annual": float(cvar_annual),
        "confidence_level": float(confidence_level),
        "method": method,
        "distribution": distribution,
        "diagnostics": {
            "mean": float(returns.mean()),
            "std": float(returns.std()),
            "skew": float(returns.skew()),
            "kurtosis": float(returns.kurtosis()),
        },
    }


def stress_test_portfolio(
    returns: pd.Series,
    current_value: float = 100000,
    scenarios: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Stress test portfolio using historical crisis scenarios.

    Scenarios:
    - 2008 GFC: -37% annual return
    - 2020 COVID: -34% drawdown
    - 2022 Rate hikes: -18% year
    - Custom shocks

    Args:
        returns: Daily returns series
        current_value: Current portfolio value
        scenarios: List of scenario names (default: all historical)

    Returns:
        Dictionary with stress test results
    """
    if scenarios is None:
        scenarios = ["gfc_2008", "covid_2020", "rates_2022"]

    # Define historical shocks
    shock_definitions = {
        "gfc_2008": {
            "return_shock": -0.37,  # Annual return
            "vol_multiplier": 2.5,
            "correlation_shock": 0.3,  # Increase in correlation
            "duration_days": 252,
        },
        "covid_2020": {
            "return_shock": -0.34,
            "vol_multiplier": 3.0,
            "correlation_shock": 0.4,
            "duration_days": 60,
        },
        "rates_2022": {
            "return_shock": -0.18,
            "vol_multiplier": 1.5,
            "correlation_shock": 0.2,
            "duration_days": 252,
        },
    }

    results = []

    for scenario_name in scenarios:
        if scenario_name not in shock_definitions:
            continue

        shock = shock_definitions[scenario_name]

        # Estimate portfolio loss
        daily_shock = (1 + shock["return_shock"]) ** (1 / shock["duration_days"]) - 1
        cumulative_loss = (1 + daily_shock) ** shock["duration_days"] - 1

        shocked_value = current_value * (1 + cumulative_loss)
        dollar_loss = shocked_value - current_value

        # Simulate shocked volatility
        current_vol = returns.std() * np.sqrt(252)
        shocked_vol = current_vol * shock["vol_multiplier"]

        results.append({
            "scenario": scenario_name,
            "return_shock": float(shock["return_shock"]),
            "shocked_value": float(shocked_value),
            "dollar_loss": float(dollar_loss),
            "loss_percent": float(cumulative_loss),
            "shocked_volatility": float(shocked_vol),
            "duration_days": int(shock["duration_days"]),
        })

    # Summary statistics
    worst_case = min(results, key=lambda x: x["shocked_value"])
    avg_loss = np.mean([r["loss_percent"] for r in results])

    return {
        "current_value": float(current_value),
        "scenarios": results,
        "summary": {
            "worst_case_scenario": worst_case["scenario"],
            "worst_case_loss": float(worst_case["loss_percent"]),
            "avg_scenario_loss": float(avg_loss),
        },
    }


def pca_decomposition(
    returns: pd.DataFrame,
    n_components: int = 3,
) -> Dict[str, Any]:
    """
    Principal Component Analysis for factor decomposition.

    Args:
        returns: DataFrame of asset returns
        n_components: Number of principal components to extract

    Returns:
        Dictionary with PCA results, loadings, and explained variance
    """
    returns_clean = returns.dropna()

    if returns_clean.shape[0] < 20:
        raise ValueError("Insufficient data for PCA (need 20+ observations)")

    # Standardize returns
    means = returns_clean.mean()
    stds = returns_clean.std()

    # Replace zero/near-zero std with small value to prevent div by zero
    stds = stds.replace(0, 1e-8)
    stds = stds.where(stds > 1e-8, 1e-8)

    returns_std = (returns_clean - means) / stds

    # Fit PCA
    pca = PCA(n_components=n_components)
    principal_components = pca.fit_transform(returns_std)

    # Extract loadings
    loadings = pd.DataFrame(
        pca.components_.T,
        columns=[f"PC{i+1}" for i in range(n_components)],
        index=returns.columns,
    )

    # Explained variance
    explained_var = pca.explained_variance_ratio_

    # Eigenvalues (raw)
    cov_matrix = returns_clean.cov()
    eigenvalues, eigenvectors = np.linalg.eig(cov_matrix)
    eigenvalues = np.sort(eigenvalues)[::-1]  # Descending

    # Effective number of factors (via entropy)
    normalized_eigenvalues = eigenvalues / eigenvalues.sum()
    entropy = -np.sum(normalized_eigenvalues * np.log(normalized_eigenvalues + 1e-10))
    effective_factors = np.exp(entropy)

    return {
        "explained_variance": explained_var.tolist(),
        "cumulative_variance": np.cumsum(explained_var).tolist(),
        "loadings": {
            asset: {f"PC{i+1}": float(loadings.loc[asset, f"PC{i+1}"]) for i in range(n_components)}
            for asset in loadings.index
        },
        "eigenvalues": eigenvalues[:10].tolist(),  # Top 10
        "effective_factors": float(effective_factors),
        "principal_components": {
            f"PC{i+1}": principal_components[:, i].tolist()
            for i in range(n_components)
        },
    }


def tail_risk_metrics(
    returns: pd.Series,
    benchmark_returns: Optional[pd.Series] = None,
    mar: float = 0.0,  # Minimum acceptable return
) -> Dict[str, Any]:
    """
    Compute tail risk and drawdown metrics.

    Metrics:
    - Maximum drawdown and duration
    - Calmar ratio (CAGR / max drawdown)
    - Omega ratio (gain/loss ratio above MAR)
    - Gain/pain ratio
    - Downside deviation (semi-volatility)

    Args:
        returns: Daily returns series
        benchmark_returns: Optional benchmark for comparison
        mar: Minimum acceptable return (for Omega ratio)

    Returns:
        Dictionary with tail risk metrics
    """
    returns = returns.dropna()
    cumulative = (1 + returns).cumprod()

    # Maximum drawdown
    running_max = cumulative.cummax()
    drawdown = (cumulative / running_max) - 1
    max_drawdown = drawdown.min()

    # Drawdown duration
    is_drawdown = drawdown < 0
    drawdown_periods = []
    in_drawdown = False
    current_duration = 0

    for dd in is_drawdown:
        if dd:
            current_duration += 1
            in_drawdown = True
        else:
            if in_drawdown:
                drawdown_periods.append(current_duration)
                current_duration = 0
            in_drawdown = False

    if in_drawdown:
        drawdown_periods.append(current_duration)

    max_dd_duration = max(drawdown_periods) if drawdown_periods else 0
    avg_dd_duration = np.mean(drawdown_periods) if drawdown_periods else 0

    # CAGR
    total_days = len(returns)
    years = total_days / 252
    cagr = (cumulative.iloc[-1] ** (1 / years)) - 1 if years > 0 else 0

    # Calmar ratio
    calmar = cagr / abs(max_drawdown) if max_drawdown != 0 else 0

    # Omega ratio
    excess = returns - mar
    gains = excess[excess > 0].sum()
    losses = -excess[excess < 0].sum()
    omega = gains / losses if losses > 0 else np.inf

    # Gain/pain ratio
    gain = returns[returns > 0].sum()
    pain = -returns[returns < 0].sum()
    gain_pain = gain / pain if pain > 0 else np.inf

    # Downside deviation (semi-volatility)
    downside_returns = returns[returns < mar]
    downside_dev = downside_returns.std() * np.sqrt(252)

    # Sortino ratio
    excess_return = returns.mean() * 252 - mar
    sortino = excess_return / downside_dev if downside_dev > 0 else 0

    # Benchmark comparison
    if benchmark_returns is not None:
        benchmark_returns = benchmark_returns.dropna()
        benchmark_cum = (1 + benchmark_returns).cumprod()
        benchmark_dd = ((benchmark_cum / benchmark_cum.cummax()) - 1).min()
    else:
        benchmark_dd = None

    return {
        "max_drawdown": float(max_drawdown),
        "max_drawdown_duration_days": int(max_dd_duration),
        "avg_drawdown_duration_days": float(avg_dd_duration),
        "num_drawdown_periods": len(drawdown_periods),
        "cagr": float(cagr),
        "calmar_ratio": float(calmar),
        "omega_ratio": float(omega),
        "gain_pain_ratio": float(gain_pain),
        "downside_deviation": float(downside_dev),
        "sortino_ratio": float(sortino),
        "benchmark_max_drawdown": float(benchmark_dd) if benchmark_dd is not None else None,
        "drawdown_series": {
            "dates": cumulative.index.strftime("%Y-%m-%d").tolist(),
            "drawdown": drawdown.tolist(),
        },
    }
