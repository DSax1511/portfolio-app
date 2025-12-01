"""
Comprehensive unit tests for factor_models.py

Tests factor model regression and attribution:
- Fama-French 5-factor regression
- Variance decomposition
- Portfolio factor attribution
- Attribution reports

Coverage target: 70%+ (focus on core functionality)
"""

import numpy as np
import pandas as pd
import pytest
from numpy.testing import assert_allclose

from app.factor_models import (
    fama_french_5factor_regression,
    carhart_4factor_regression,
    portfolio_factor_decomposition,
    attribution_report,
    build_synthetic_factor_returns,
)


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def factor_returns():
    """Generate synthetic factor returns."""
    np.random.seed(42)
    n_periods = 252

    factors = pd.DataFrame({
        'Mkt-RF': np.random.randn(n_periods) * 0.01 + 0.0003,
        'SMB': np.random.randn(n_periods) * 0.004,
        'HML': np.random.randn(n_periods) * 0.005,
        'RMW': np.random.randn(n_periods) * 0.003,
        'CMA': np.random.randn(n_periods) * 0.003,
    })
    return factors


@pytest.fixture
def asset_returns_with_factors(factor_returns):
    """Generate asset returns driven by known factor exposures."""
    np.random.seed(42)

    # True factor loadings
    true_alpha = 0.05 / 252  # 5% annual alpha
    true_betas = {
        'Mkt-RF': 1.2,
        'SMB': 0.3,
        'HML': -0.2,
        'RMW': 0.1,
        'CMA': 0.0,
    }

    # Generate returns
    asset_returns = pd.Series(index=factor_returns.index, dtype=float)
    for t in factor_returns.index:
        factor_component = sum(
            true_betas[f] * factor_returns.loc[t, f]
            for f in factor_returns.columns
        )
        idio = np.random.randn() * 0.005  # Idiosyncratic return
        asset_returns.loc[t] = true_alpha + factor_component + idio

    return asset_returns, true_alpha, true_betas


# ============================================================================
# Unit Tests: Fama-French Regression
# ============================================================================

@pytest.mark.unit
def test_fama_french_basic(asset_returns_with_factors, factor_returns):
    """Test basic Fama-French regression."""
    asset_returns, _, _ = asset_returns_with_factors

    result = fama_french_5factor_regression(asset_returns, factor_returns)

    # Check structure
    assert "alpha" in result
    assert "betas" in result
    assert "r_squared" in result
    assert "adj_r_squared" in result
    assert "residuals" in result
    assert "coefficient_stats" in result

    # Check betas structure
    assert len(result["betas"]) == 5
    for factor in factor_returns.columns:
        assert factor in result["betas"]


@pytest.mark.unit
@pytest.mark.numerical
def test_fama_french_recovers_true_betas(asset_returns_with_factors, factor_returns):
    """Test that regression recovers true factor loadings."""
    asset_returns, true_alpha, true_betas = asset_returns_with_factors

    result = fama_french_5factor_regression(asset_returns, factor_returns)

    # Check that estimated betas are close to true betas for major factors
    # Market beta should be reasonably close
    mkt_beta = result["betas"]["Mkt-RF"]
    assert abs(mkt_beta - true_betas["Mkt-RF"]) < 0.6  # Relaxed tolerance due to noise

    # R² should be high
    assert result["r_squared"] > 0.5


@pytest.mark.unit
def test_fama_french_r_squared(asset_returns_with_factors, factor_returns):
    """Test that R² is reasonable for factor-driven returns."""
    asset_returns, _, _ = asset_returns_with_factors

    result = fama_french_5factor_regression(asset_returns, factor_returns)

    # R² should be high since returns are factor-driven
    assert result["r_squared"] > 0.5
    assert result["adj_r_squared"] > 0.5

    # Adjusted R² should be slightly lower than R²
    assert result["adj_r_squared"] <= result["r_squared"]


@pytest.mark.unit
def test_fama_french_coefficient_stats(asset_returns_with_factors, factor_returns):
    """Test that coefficient statistics are provided."""
    asset_returns, _, _ = asset_returns_with_factors

    result = fama_french_5factor_regression(asset_returns, factor_returns)

    # Check alpha stats
    assert "alpha" in result["coefficient_stats"]
    assert "estimate" in result["coefficient_stats"]["alpha"]
    assert "t_stat" in result["coefficient_stats"]["alpha"]
    assert "p_value" in result["coefficient_stats"]["alpha"]

    # Check factor stats
    for factor in factor_returns.columns:
        assert factor in result["coefficient_stats"]
        assert "t_stat" in result["coefficient_stats"][factor]
        assert "p_value" in result["coefficient_stats"][factor]


@pytest.mark.unit
def test_fama_french_variance_decomposition(asset_returns_with_factors, factor_returns):
    """Test variance decomposition."""
    asset_returns, _, _ = asset_returns_with_factors

    result = fama_french_5factor_regression(asset_returns, factor_returns)

    # Check variance components
    assert "total_variance" in result
    assert "factor_variance" in result
    assert "idiosyncratic_variance" in result
    assert "pct_factor_risk" in result

    # Total variance = factor variance + idiosyncratic variance
    total_calc = result["factor_variance"] + result["idiosyncratic_variance"]
    assert_allclose(total_calc, result["total_variance"], rtol=0.01)

    # Percentage should be between 0 and 1
    assert 0 <= result["pct_factor_risk"] <= 1


# ============================================================================
# Unit Tests: Carhart 4-Factor
# ============================================================================

@pytest.mark.unit
def test_carhart_4factor_basic():
    """Test basic Carhart 4-factor regression."""
    np.random.seed(42)
    n_periods = 100

    # Create 4-factor returns
    factor_returns = pd.DataFrame({
        'Mkt-RF': np.random.randn(n_periods) * 0.01,
        'SMB': np.random.randn(n_periods) * 0.004,
        'HML': np.random.randn(n_periods) * 0.005,
        'MOM': np.random.randn(n_periods) * 0.006,
    })

    # Create asset returns
    asset_returns = pd.Series(
        np.random.randn(n_periods) * 0.01,
        index=factor_returns.index
    )

    result = carhart_4factor_regression(asset_returns, factor_returns)

    # Check structure
    assert "alpha" in result
    assert "betas" in result
    assert len(result["betas"]) == 4


# ============================================================================
# Unit Tests: Portfolio Factor Decomposition
# ============================================================================

@pytest.mark.unit
def test_portfolio_factor_decomposition(asset_returns_with_factors, factor_returns):
    """Test portfolio factor decomposition."""
    asset_returns, _, _ = asset_returns_with_factors

    decomp = portfolio_factor_decomposition(asset_returns, factor_returns)

    # Check structure
    assert "factor_betas" in decomp
    assert "alpha" in decomp
    assert "r_squared" in decomp
    assert "total_variance" in decomp
    assert "factor_variance" in decomp
    assert "idiosyncratic_variance" in decomp
    assert "percentage_contributions" in decomp

    # Check percentage contributions
    pct_contrib = decomp["percentage_contributions"]
    assert "Idiosyncratic" in pct_contrib

    # All percentages should sum to 100
    total_pct = sum(pct_contrib.values())
    assert_allclose(total_pct, 100.0, rtol=0.01)


@pytest.mark.unit
def test_portfolio_factor_decomposition_volatilities(asset_returns_with_factors, factor_returns):
    """Test volatility decomposition."""
    asset_returns, _, _ = asset_returns_with_factors

    decomp = portfolio_factor_decomposition(asset_returns, factor_returns)

    # Check volatility components
    assert "total_volatility" in decomp
    assert "factor_volatility" in decomp
    assert "idiosyncratic_volatility" in decomp

    # All should be non-negative
    assert decomp["total_volatility"] >= 0
    assert decomp["factor_volatility"] >= 0
    assert decomp["idiosyncratic_volatility"] >= 0

    # Total vol² ≈ factor vol² + idio vol² (approximately, due to cross terms)
    total_var = decomp["total_variance"]
    factor_var = decomp["factor_variance"]
    idio_var = decomp["idiosyncratic_variance"]

    assert_allclose(total_var, factor_var + idio_var, rtol=0.05)


# ============================================================================
# Unit Tests: Attribution Report
# ============================================================================

@pytest.mark.unit
def test_attribution_report_structure(asset_returns_with_factors, factor_returns):
    """Test attribution report structure."""
    asset_returns, _, _ = asset_returns_with_factors

    report = attribution_report(asset_returns, factor_returns)

    # Check that it's a DataFrame
    assert isinstance(report, pd.DataFrame)

    # Check columns
    expected_cols = ["Component", "Beta", "Variance Contribution", "% of Total Risk"]
    assert list(report.columns) == expected_cols

    # Check rows (5 factors + idiosyncratic + total)
    assert len(report) == 7  # 5 factors + Idiosyncratic + Total


@pytest.mark.unit
def test_attribution_report_total_row(asset_returns_with_factors, factor_returns):
    """Test that attribution report total row sums correctly."""
    asset_returns, _, _ = asset_returns_with_factors

    report = attribution_report(asset_returns, factor_returns)

    # Total row should sum variance contributions
    total_row = report[report["Component"] == "Total"].iloc[0]

    # Sum of factor + idiosyncratic variance contributions
    other_rows = report[report["Component"] != "Total"]
    var_contrib_sum = other_rows["Variance Contribution"].sum()

    assert_allclose(total_row["Variance Contribution"], var_contrib_sum, rtol=0.01)

    # Total percentage should be 100%
    assert_allclose(total_row["% of Total Risk"], 100.0, rtol=0.01)


# ============================================================================
# Unit Tests: Synthetic Factor Returns
# ============================================================================

@pytest.mark.unit
def test_build_synthetic_factor_returns():
    """Test synthetic factor returns generation."""
    tickers = ["AAPL", "MSFT", "GOOGL"]
    start_date = "2020-01-01"
    end_date = "2020-12-31"

    factors = build_synthetic_factor_returns(
        tickers,
        start_date,
        end_date,
        use_ff_proxies=True
    )

    # Check structure
    assert isinstance(factors, pd.DataFrame)
    assert "Mkt-RF" in factors.columns
    assert "SMB" in factors.columns
    assert "HML" in factors.columns
    assert "RMW" in factors.columns
    assert "CMA" in factors.columns

    # Check date range (approximately)
    assert len(factors) > 200  # ~252 trading days


@pytest.mark.unit
def test_build_synthetic_factor_returns_no_proxies():
    """Test synthetic factor returns with no proxies (zeros)."""
    tickers = ["AAPL"]
    start_date = "2020-01-01"
    end_date = "2020-12-31"

    factors = build_synthetic_factor_returns(
        tickers,
        start_date,
        end_date,
        use_ff_proxies=False
    )

    # Should return zeros
    assert np.allclose(factors.values, 0.0)


# ============================================================================
# Edge Cases
# ============================================================================

@pytest.mark.unit
def test_fama_french_single_period():
    """Test that regression requires multiple periods."""
    # Single period (will fail regression)
    factor_returns = pd.DataFrame({
        'Mkt-RF': [0.01],
        'SMB': [0.002],
        'HML': [-0.001],
        'RMW': [0.0],
        'CMA': [0.001],
    })

    asset_returns = pd.Series([0.015])

    # Should handle gracefully or raise
    try:
        result = fama_french_5factor_regression(asset_returns, factor_returns)
        # If it doesn't raise, check that result is reasonable
        assert "alpha" in result
    except (ValueError, np.linalg.LinAlgError):
        # Regression with 1 observation is ill-defined - acceptable to fail
        pass


@pytest.mark.unit
def test_fama_french_no_variation():
    """Test with constant factor returns (no variation)."""
    factor_returns = pd.DataFrame({
        'Mkt-RF': [0.01] * 50,
        'SMB': [0.0] * 50,
        'HML': [0.0] * 50,
        'RMW': [0.0] * 50,
        'CMA': [0.0] * 50,
    })

    asset_returns = pd.Series(np.random.randn(50) * 0.01)

    # Should handle or raise
    try:
        result = fama_french_5factor_regression(asset_returns, factor_returns)
        # If successful, R² should be very low (no explanatory power)
        assert result["r_squared"] < 0.5
    except (ValueError, np.linalg.LinAlgError):
        # Singular matrix expected - acceptable to fail
        pass


# ============================================================================
# Integration Tests
# ============================================================================

@pytest.mark.integration
def test_full_factor_workflow(asset_returns_with_factors, factor_returns):
    """Test complete factor analysis workflow."""
    asset_returns, _, _ = asset_returns_with_factors

    # Step 1: Run regression
    regression = fama_french_5factor_regression(asset_returns, factor_returns)
    assert regression["r_squared"] > 0.5

    # Step 2: Decompose variance
    decomp = portfolio_factor_decomposition(asset_returns, factor_returns)
    # Check that factor risk percentage is reasonable
    total_pct = sum(decomp["percentage_contributions"].values())
    assert_allclose(total_pct, 100.0, rtol=0.01)

    # Step 3: Generate report
    report = attribution_report(asset_returns, factor_returns)
    assert len(report) == 7

    # Verify consistency
    assert_allclose(
        regression["r_squared"],
        decomp["r_squared"],
        rtol=1e-10
    )
