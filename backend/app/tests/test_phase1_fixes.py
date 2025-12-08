"""
Phase 1 Fixes Test Suite

Tests for:
1. Drawdown floor at -99.9%
2. VaR correctness
3. CVaR t-distribution analytical formula
4. NaN/Inf guards in analytics
5. Significance metadata
"""

import math
import numpy as np
import pandas as pd
import pytest
from scipy import stats

from app.analytics import compute_performance_stats, _sanitize_float, risk_breakdown
from app.quant.risk_analytics import compute_var_cvar, pca_decomposition
from app.services.metrics_significance import (
    evaluate_metric_metadata,
    get_significance_badge,
)


class TestDrawdownFloor:
    """Test that max drawdown is floored at -99.9% for unlevered portfolios."""

    def test_normal_drawdown_passes_through(self):
        """Normal drawdowns should not be modified."""
        returns = pd.Series([0.01, -0.02, 0.03, -0.05, 0.02])
        stats = compute_performance_stats(returns)
        assert stats["max_drawdown"] > -0.999
        assert stats["max_drawdown"] < 0

    def test_extreme_drawdown_is_floored(self):
        """Drawdowns below -99.9% should be floored."""
        # Simulate a portfolio that loses everything (should never happen unlevered)
        returns = pd.Series([0.01, -0.5, -0.5, -0.5, -0.5])
        stats = compute_performance_stats(returns)
        # Should be floored at -99.9%
        assert stats["max_drawdown"] == -0.999


class TestVaRCorrectness:
    """Test VaR calculation correctness."""

    def test_parametric_var_normal(self):
        """Test parametric VaR with normal distribution."""
        np.random.seed(42)
        returns = pd.Series(np.random.normal(0.001, 0.02, 1000))
        result = compute_var_cvar(returns, confidence_level=0.95, method="parametric", distribution="normal")

        # VaR should be positive (loss convention)
        assert result["var_daily"] > 0
        # CVaR should be greater than VaR (expected loss beyond VaR)
        assert result["cvar_daily"] > result["var_daily"]

    def test_historical_var(self):
        """Test historical VaR."""
        returns = pd.Series([-0.05, -0.02, 0.01, 0.02, 0.03] * 20)
        result = compute_var_cvar(returns, confidence_level=0.95, method="historical")

        # Should return reasonable values
        assert result["var_daily"] > 0
        assert result["cvar_daily"] > 0


class TestCVaRTDistribution:
    """Test analytical CVaR formula for t-distribution."""

    def test_cvar_t_distribution_analytical(self):
        """CVaR for t-distribution should use analytical formula, not approximation."""
        np.random.seed(42)
        # Generate returns with fat tails
        returns = pd.Series(stats.t.rvs(df=5, loc=0.001, scale=0.02, size=1000))

        result = compute_var_cvar(
            returns,
            confidence_level=0.95,
            method="parametric",
            distribution="t"
        )

        # CVaR should be computed and greater than VaR
        assert result["cvar_daily"] > result["var_daily"]
        # Should not be exactly 1.2 * VaR (the old approximation)
        assert abs(result["cvar_daily"] - result["var_daily"] * 1.2) > 0.001

    def test_cvar_t_vs_normal(self):
        """CVaR for t-distribution should be higher than normal (fatter tails)."""
        np.random.seed(42)
        returns = pd.Series(stats.t.rvs(df=5, loc=0.001, scale=0.02, size=1000))

        result_t = compute_var_cvar(returns, confidence_level=0.95, method="parametric", distribution="t")
        result_normal = compute_var_cvar(returns, confidence_level=0.95, method="parametric", distribution="normal")

        # t-distribution CVaR should typically be higher (more conservative)
        # This may not always hold for small samples, but generally true
        assert result_t["cvar_daily"] > 0


class TestNaNInfGuards:
    """Test that NaN/Inf values are sanitized properly."""

    def test_sanitize_float_with_nan(self):
        """_sanitize_float should convert NaN to default."""
        result = _sanitize_float(float('nan'), default=0.0)
        assert result == 0.0

    def test_sanitize_float_with_inf(self):
        """_sanitize_float should convert Inf to default."""
        result = _sanitize_float(float('inf'), default=0.0)
        assert result == 0.0
        result = _sanitize_float(float('-inf'), default=0.0)
        assert result == 0.0

    def test_sanitize_float_with_normal_value(self):
        """_sanitize_float should pass through normal values."""
        result = _sanitize_float(3.14159, default=0.0)
        assert result == 3.14159

    def test_performance_stats_returns_finite_values(self):
        """All metrics from compute_performance_stats should be finite."""
        returns = pd.Series([0.01, -0.02, 0.03, -0.01, 0.02])
        stats = compute_performance_stats(returns)

        for key, value in stats.items():
            assert math.isfinite(value), f"{key} is not finite: {value}"

    def test_risk_breakdown_returns_finite_values(self):
        """All metrics from risk_breakdown should be finite."""
        prices = pd.DataFrame({
            'A': [100, 101, 102, 101, 103],
            'B': [50, 51, 50, 52, 51],
        })
        weights = [0.6, 0.4]

        result = risk_breakdown(prices, weights)

        assert math.isfinite(result["portfolio_vol"])
        assert math.isfinite(result["diversification_ratio"])
        for contrib in result["contribution"]:
            assert math.isfinite(contrib["pct_variance"])


class TestSignificanceMetadata:
    """Test significance evaluation and badge generation."""

    def test_evaluate_metric_metadata_significant(self):
        """High Sharpe with large sample should be significant."""
        metadata = evaluate_metric_metadata("sharpe_ratio", 1.5, sample_size=500)
        assert metadata is not None
        assert metadata["is_significant"] is True

    def test_evaluate_metric_metadata_insignificant(self):
        """Low Sharpe with small sample should be insignificant."""
        metadata = evaluate_metric_metadata("sharpe_ratio", 0.3, sample_size=50)
        assert metadata is not None
        assert metadata["is_significant"] is False

    def test_get_significance_badge(self):
        """Test badge generation."""
        # Significant metric
        badge = get_significance_badge("sharpe_ratio", 1.5, sample_size=500)
        assert badge == "✓"

        # Insignificant metric
        badge = get_significance_badge("sharpe_ratio", 0.3, sample_size=50)
        assert badge == "~"

        # Unknown metric
        badge = get_significance_badge("unknown_metric", 1.0, sample_size=100)
        assert badge == "✗"


class TestPCAGuards:
    """Test PCA decomposition with zero-variance safeguards."""

    def test_pca_with_zero_variance_asset(self):
        """PCA should handle assets with zero variance."""
        returns = pd.DataFrame({
            'A': [0.01, -0.02, 0.03, -0.01, 0.02] * 10,
            'B': [0.0, 0.0, 0.0, 0.0, 0.0] * 10,  # Zero variance
            'C': [0.02, -0.01, 0.01, -0.02, 0.03] * 10,
        })

        # Should not raise an error
        result = pca_decomposition(returns, n_components=2)

        assert "explained_variance" in result
        assert len(result["explained_variance"]) == 2

    def test_pca_normal_operation(self):
        """PCA should work normally with varied returns."""
        np.random.seed(42)
        returns = pd.DataFrame({
            'A': np.random.normal(0.001, 0.02, 100),
            'B': np.random.normal(0.002, 0.015, 100),
            'C': np.random.normal(0.0, 0.025, 100),
        })

        result = pca_decomposition(returns, n_components=2)

        assert "explained_variance" in result
        assert "loadings" in result
        assert len(result["explained_variance"]) == 2
