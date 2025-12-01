"""
Comprehensive unit tests for covariance_estimation.py

Tests robust covariance estimation methods:
- Ledoit-Wolf shrinkage
- OAS shrinkage
- Exponential weighting
- Robust MCD
- Condition number and effective rank

Coverage target: 80%+
"""

import numpy as np
import pandas as pd
import pytest
from numpy.testing import assert_allclose

from app.covariance_estimation import (
    ledoit_wolf_shrinkage,
    oas_shrinkage,
    robust_covariance_mcd,
    exponential_covariance,
    sample_covariance,
    condition_number,
    effective_rank,
    compare_estimators,
)


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def simple_returns():
    """Generate simple synthetic returns."""
    np.random.seed(42)
    n_assets = 5
    n_periods = 100

    returns = pd.DataFrame(
        np.random.randn(n_periods, n_assets) * 0.01,
        columns=[f"Asset_{i}" for i in range(n_assets)]
    )
    return returns


@pytest.fixture
def ill_conditioned_returns():
    """Generate ill-conditioned returns (T << N)."""
    np.random.seed(42)
    n_assets = 20
    n_periods = 40  # T < 2N → ill-conditioned

    returns = pd.DataFrame(
        np.random.randn(n_periods, n_assets) * 0.01,
        columns=[f"Asset_{i}" for i in range(n_assets)]
    )
    return returns


# ============================================================================
# Unit Tests: Sample Covariance
# ============================================================================

@pytest.mark.unit
def test_sample_covariance_basic(simple_returns):
    """Test basic sample covariance computation."""
    cov = sample_covariance(simple_returns, annualize=False)

    # Check shape
    assert cov.shape == (len(simple_returns.columns), len(simple_returns.columns))

    # Check symmetry
    assert np.allclose(cov.values, cov.values.T)

    # Check PSD (all eigenvalues non-negative)
    eigvals = np.linalg.eigvalsh(cov.values)
    assert np.all(eigvals >= -1e-10)


@pytest.mark.unit
def test_sample_covariance_annualization(simple_returns):
    """Test that annualization scales covariance correctly."""
    cov_daily = sample_covariance(simple_returns, annualize=False)
    cov_annual = sample_covariance(simple_returns, annualize=True, periods_per_year=252)

    # Annual should be 252x daily
    assert_allclose(cov_annual.values, cov_daily.values * 252, rtol=1e-10)


# ============================================================================
# Unit Tests: Ledoit-Wolf Shrinkage
# ============================================================================

@pytest.mark.unit
def test_ledoit_wolf_basic(simple_returns):
    """Test basic Ledoit-Wolf shrinkage."""
    cov_lw, shrinkage = ledoit_wolf_shrinkage(simple_returns, annualize=False)

    # Check shape and symmetry
    assert cov_lw.shape == (len(simple_returns.columns), len(simple_returns.columns))
    assert np.allclose(cov_lw.values, cov_lw.values.T)

    # Shrinkage intensity should be between 0 and 1
    assert 0 <= shrinkage <= 1


@pytest.mark.unit
def test_ledoit_wolf_reduces_condition_number(ill_conditioned_returns):
    """Test that Ledoit-Wolf reduces condition number."""
    # Sample covariance
    cov_sample = sample_covariance(ill_conditioned_returns, annualize=False)
    cond_sample = condition_number(cov_sample)

    # Ledoit-Wolf
    cov_lw, shrinkage = ledoit_wolf_shrinkage(ill_conditioned_returns, annualize=False)
    cond_lw = condition_number(cov_lw)

    # Shrinkage should reduce condition number
    assert cond_lw < cond_sample
    assert shrinkage > 0  # Should apply some shrinkage for ill-conditioned case


@pytest.mark.unit
def test_ledoit_wolf_psd(simple_returns):
    """Test that Ledoit-Wolf preserves positive semi-definiteness."""
    cov_lw, _ = ledoit_wolf_shrinkage(simple_returns)

    eigvals = np.linalg.eigvalsh(cov_lw.values)
    assert np.all(eigvals >= -1e-10)


# ============================================================================
# Unit Tests: OAS Shrinkage
# ============================================================================

@pytest.mark.unit
def test_oas_basic(simple_returns):
    """Test basic OAS shrinkage."""
    cov_oas, shrinkage = oas_shrinkage(simple_returns, annualize=False)

    # Check properties
    assert cov_oas.shape == (len(simple_returns.columns), len(simple_returns.columns))
    assert np.allclose(cov_oas.values, cov_oas.values.T)
    assert 0 <= shrinkage <= 1


@pytest.mark.unit
def test_oas_vs_ledoit_wolf(ill_conditioned_returns):
    """Test that OAS and Ledoit-Wolf give similar results."""
    cov_lw, shrink_lw = ledoit_wolf_shrinkage(ill_conditioned_returns, annualize=False)
    cov_oas, shrink_oas = oas_shrinkage(ill_conditioned_returns, annualize=False)

    # Both should apply significant shrinkage for ill-conditioned case
    assert shrink_lw > 0.1
    assert shrink_oas > 0.1

    # Results should be similar (but not identical)
    diff = np.abs(cov_lw.values - cov_oas.values).max()
    assert diff < 0.01  # Reasonable tolerance


# ============================================================================
# Unit Tests: Exponential Covariance
# ============================================================================

@pytest.mark.unit
def test_exponential_covariance_basic(simple_returns):
    """Test basic exponential covariance."""
    cov_exp = exponential_covariance(simple_returns, halflife=60, annualize=False)

    # Check shape and symmetry
    assert cov_exp.shape == (len(simple_returns.columns), len(simple_returns.columns))
    assert np.allclose(cov_exp.values, cov_exp.values.T, atol=1e-10)


@pytest.mark.unit
def test_exponential_covariance_halflife(simple_returns):
    """Test that shorter halflife gives more weight to recent data."""
    cov_short = exponential_covariance(simple_returns, halflife=20, annualize=False)
    cov_long = exponential_covariance(simple_returns, halflife=100, annualize=False)

    # Both should be valid covariance matrices
    eigvals_short = np.linalg.eigvalsh(cov_short.values)
    eigvals_long = np.linalg.eigvalsh(cov_long.values)

    assert np.all(eigvals_short >= -1e-10)
    assert np.all(eigvals_long >= -1e-10)

    # They should differ (different weighting schemes)
    diff = np.abs(cov_short.values - cov_long.values).max()
    assert diff > 0  # Should not be identical


# ============================================================================
# Unit Tests: Robust MCD
# ============================================================================

@pytest.mark.unit
@pytest.mark.slow
def test_robust_mcd_basic(simple_returns):
    """Test basic robust MCD covariance."""
    cov_mcd = robust_covariance_mcd(simple_returns, annualize=False)

    # Check shape and symmetry
    assert cov_mcd.shape == (len(simple_returns.columns), len(simple_returns.columns))
    assert np.allclose(cov_mcd.values, cov_mcd.values.T)

    # Check PSD
    eigvals = np.linalg.eigvalsh(cov_mcd.values)
    assert np.all(eigvals >= -1e-10)


# ============================================================================
# Unit Tests: Condition Number
# ============================================================================

@pytest.mark.unit
@pytest.mark.numerical
def test_condition_number_identity():
    """Test condition number of identity matrix (should be 1.0)."""
    cov = pd.DataFrame(np.eye(3))
    cond = condition_number(cov)

    assert_allclose(cond, 1.0, rtol=1e-6)


@pytest.mark.unit
@pytest.mark.numerical
def test_condition_number_diagonal():
    """Test condition number of diagonal matrix."""
    # Diagonal matrix with eigenvalues [1, 2, 4]
    cov = pd.DataFrame(np.diag([1.0, 2.0, 4.0]))
    cond = condition_number(cov)

    # Condition number = max/min = 4/1 = 4
    assert_allclose(cond, 4.0, rtol=1e-6)


@pytest.mark.unit
def test_condition_number_increases_with_correlation(ill_conditioned_returns):
    """Test that condition number increases when T << N."""
    cov = sample_covariance(ill_conditioned_returns, annualize=False)
    cond = condition_number(cov)

    # Should be ill-conditioned
    assert cond > 5.0  # Arbitrary threshold


# ============================================================================
# Unit Tests: Effective Rank
# ============================================================================

@pytest.mark.unit
@pytest.mark.numerical
def test_effective_rank_identity():
    """Test effective rank of identity matrix (should be N)."""
    cov = pd.DataFrame(np.eye(5))
    eff_rank = effective_rank(cov)

    # For identity, effective rank = actual rank = 5
    assert_allclose(eff_rank, 5.0, rtol=0.1)


@pytest.mark.unit
@pytest.mark.numerical
def test_effective_rank_rank_one():
    """Test effective rank of rank-1 matrix."""
    # Rank-1 matrix: all rows/cols proportional
    v = np.array([1, 2, 3])
    cov = pd.DataFrame(np.outer(v, v))

    eff_rank = effective_rank(cov)

    # Effective rank should be close to 1
    assert eff_rank < 1.5


@pytest.mark.unit
def test_effective_rank_less_than_actual(simple_returns):
    """Test that effective rank ≤ actual rank."""
    cov = sample_covariance(simple_returns, annualize=False)
    eff_rank = effective_rank(cov)

    # Effective rank should be between 1 and N
    n_assets = cov.shape[0]
    assert 1 <= eff_rank <= n_assets


# ============================================================================
# Unit Tests: Compare Estimators
# ============================================================================

@pytest.mark.unit
def test_compare_estimators_structure(simple_returns):
    """Test that compare_estimators returns expected structure."""
    comparison = compare_estimators(simple_returns, annualize=False)

    # Check that it's a DataFrame
    assert isinstance(comparison, pd.DataFrame)

    # Check columns
    expected_cols = ["estimator", "condition_number", "effective_rank", "shrinkage"]
    assert list(comparison.columns) == expected_cols

    # Check estimators
    estimators = comparison["estimator"].tolist()
    assert "Sample" in estimators
    assert "Ledoit-Wolf" in estimators
    assert "OAS" in estimators


@pytest.mark.unit
def test_compare_estimators_condition_numbers(ill_conditioned_returns):
    """Test that shrinkage methods have lower condition numbers."""
    comparison = compare_estimators(ill_conditioned_returns, annualize=False)

    # Get condition numbers
    cond_sample = comparison[comparison["estimator"] == "Sample"]["condition_number"].iloc[0]
    cond_lw = comparison[comparison["estimator"] == "Ledoit-Wolf"]["condition_number"].iloc[0]
    cond_oas = comparison[comparison["estimator"] == "OAS"]["condition_number"].iloc[0]

    # Shrinkage methods should have lower condition numbers
    assert cond_lw < cond_sample
    assert cond_oas < cond_sample


@pytest.mark.unit
def test_compare_estimators_shrinkage_intensities(ill_conditioned_returns):
    """Test that shrinkage intensities are reported."""
    comparison = compare_estimators(ill_conditioned_returns, annualize=False)

    # Ledoit-Wolf and OAS should have shrinkage > 0
    lw_shrinkage = comparison[comparison["estimator"] == "Ledoit-Wolf"]["shrinkage"].iloc[0]
    oas_shrinkage = comparison[comparison["estimator"] == "OAS"]["shrinkage"].iloc[0]

    assert lw_shrinkage > 0
    assert oas_shrinkage > 0

    # Sample should have 0 shrinkage
    sample_shrinkage = comparison[comparison["estimator"] == "Sample"]["shrinkage"].iloc[0]
    assert sample_shrinkage == 0.0


# ============================================================================
# Edge Cases
# ============================================================================

@pytest.mark.unit
def test_covariance_single_asset():
    """Test covariance estimators with single asset."""
    returns = pd.DataFrame({
        "Only_Asset": np.random.randn(100) * 0.01
    })

    cov_sample = sample_covariance(returns)
    cov_lw, _ = ledoit_wolf_shrinkage(returns)

    # Both should be 1x1 matrices
    assert cov_sample.shape == (1, 1)
    assert cov_lw.shape == (1, 1)

    # Values should be positive
    assert cov_sample.iloc[0, 0] > 0
    assert cov_lw.iloc[0, 0] > 0


@pytest.mark.unit
def test_covariance_constant_returns():
    """Test covariance with constant returns (zero variance)."""
    returns = pd.DataFrame({
        "A": [0.01] * 50,
        "B": [0.02] * 50,
    })

    cov = sample_covariance(returns, annualize=False)

    # Should be zero or very close to zero
    assert np.allclose(cov.values, 0, atol=1e-10)


# ============================================================================
# Integration Tests
# ============================================================================

@pytest.mark.integration
def test_shrinkage_improves_portfolio_optimization(ill_conditioned_returns):
    """Test that shrinkage leads to better-conditioned optimization."""
    # Sample covariance
    cov_sample = sample_covariance(ill_conditioned_returns, annualize=True)

    # Ledoit-Wolf
    cov_lw, _ = ledoit_wolf_shrinkage(ill_conditioned_returns, annualize=True)

    # Try to invert (for min variance optimization)
    try:
        inv_sample = np.linalg.inv(cov_sample.values)
        cond_sample = np.linalg.cond(inv_sample)
    except np.linalg.LinAlgError:
        cond_sample = np.inf

    try:
        inv_lw = np.linalg.inv(cov_lw.values)
        cond_lw = np.linalg.cond(inv_lw)
    except np.linalg.LinAlgError:
        cond_lw = np.inf

    # Ledoit-Wolf should be more stable
    assert cond_lw < cond_sample or (np.isfinite(cond_lw) and not np.isfinite(cond_sample))
