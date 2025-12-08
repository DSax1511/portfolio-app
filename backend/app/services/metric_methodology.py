from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional


@dataclass(frozen=True)
class MetricMethodology:
    title: str
    description: str
    window_length: Optional[str] = None
    assumptions: Optional[str] = None


METRIC_METHODS: Dict[str, MetricMethodology] = {
    "sharpe_ratio": MetricMethodology(
        title="Sharpe Ratio",
        description="Annualized excess return versus annualized volatility, assuming stable variance.",
        window_length="Full sample",
        assumptions="Returns are approximately IID and volatility is stable across the sample.",
    ),
    "sortino_ratio": MetricMethodology(
        title="Sortino Ratio",
        description="Annualized excess return divided by downside deviation, focusing on unfavorable volatility.",
        window_length="Full sample",
        assumptions="Downside deviations dominate risk; positive deviations are not penalized.",
    ),
    "alpha": MetricMethodology(
        title="Alpha",
        description="Intercept from a regression versus the benchmark, annualized to quantify active edge.",
        window_length="Full sample",
        assumptions="Linear relationship with the benchmark and stationary exposures.",
    ),
    "beta": MetricMethodology(
        title="Beta",
        description="Sensitivity of portfolio returns to benchmark fluctuations over the same window.",
        window_length="Full sample",
        assumptions="Benchmark exposures remain stable and residuals are uncorrelated.",
    ),
    "correlation": MetricMethodology(
        title="Correlation",
        description="Pearson correlation between two return series computed on the matched sample.",
        window_length="Sample length",
        assumptions="Linear dependency; small magnitudes (<0.1) are likely noise unless the sample is very large.",
    ),
    "autocorrelation": MetricMethodology(
        title="Autocorrelation",
        description="Lag-1 autocorrelation on log returns, highlighting serial dependence.",
        window_length="Sample length",
        assumptions="Stationary returns and no heavy tails to bias estimates.",
    ),
    "var_95": MetricMethodology(
        title="Parametric VaR (95%)",
        description="μ + 1.65·σ quantile under a normal returns assumption to bound the 5th percentile loss.",
        window_length="Full sample",
        assumptions="Returns are normally distributed with stable volatility.",
    ),
    "var_99": MetricMethodology(
        title="Parametric VaR (99%)",
        description="μ + 2.33·σ quantile under normal assumptions to bound the 1% tail.",
        window_length="Full sample",
        assumptions="Normal returns with consistent volatility.",
    ),
    "var_95_hist": MetricMethodology(
        title="Historical VaR (95%)",
        description="Empirical 5th percentile of historical returns, capturing observed tail behavior.",
        window_length="Full sample",
        assumptions="Historical returns represent future tail risk.",
    ),
    "var_99_hist": MetricMethodology(
        title="Historical VaR (99%)",
        description="Empirical 1st percentile of historical returns for deeper tail coverage.",
        window_length="Full sample",
        assumptions="Historical extremes approximate future losses.",
    ),
    "cvar_95": MetricMethodology(
        title="Conditional VaR (95%)",
        description="Average loss beyond the 5th percentile, capturing tail severity.",
        window_length="Full sample",
        assumptions="Historical tail losses are representative of future extremes.",
    ),
}


def get_methodology(metric_id: str) -> Optional[MetricMethodology]:
    """Retrieve metadata describing how a metric is computed."""
    return METRIC_METHODS.get(metric_id)


def list_methodologies() -> Dict[str, MetricMethodology]:
    """Return the full methodology registry."""
    return METRIC_METHODS
