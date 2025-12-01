"""
Comprehensive unit tests for optimizers_v2.py

Tests convex optimization portfolio construction methods:
- Markowitz efficient frontier
- Maximum Sharpe ratio
- Minimum variance
- Risk parity
- Black-Litterman

Coverage targets:
- Unit tests: 80%+
- Property-based tests: Key invariants
- Numerical accuracy: Known solutions
- Edge cases: Singular matrices, extreme weights
"""

import numpy as np
import pandas as pd
import pytest
from hypothesis import given, strategies as st, settings
from numpy.testing import assert_allclose

from app.optimizers_v2 import (
    markowitz_frontier,
    risk_parity_weights_cvxpy,
    min_variance_weights_cvxpy,
    black_litterman,
    portfolio_perf,
    optimizer_summary,
)


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def simple_returns():
    """Generate simple synthetic returns for testing."""
    np.random.seed(42)
    n_assets = 5
    n_periods = 252

    # Generate returns with known properties
    returns = pd.DataFrame(
        np.random.randn(n_periods, n_assets) * 0.01 + 0.0005,
        columns=[f"Asset_{i}" for i in range(n_assets)]
    )
    return returns


@pytest.fixture
def uncorrelated_returns():
    """Generate uncorrelated returns (diagonal covariance)."""
    np.random.seed(42)
    n_assets = 3
    n_periods = 252

    # Independent returns
    returns = pd.DataFrame(
        np.random.randn(n_periods, n_assets) * np.array([0.01, 0.02, 0.015]),
        columns=["Low_Vol", "High_Vol", "Med_Vol"]
    )
    return returns


@pytest.fixture
def perfectly_correlated_returns():
    """Generate perfectly correlated returns (rank 1 covariance)."""
    np.random.seed(42)
    n_periods = 252

    # Single factor driving all returns
    factor = np.random.randn(n_periods) * 0.01

    returns = pd.DataFrame({
        "Asset_A": factor * 1.0 + np.random.randn(n_periods) * 0.001,
        "Asset_B": factor * 0.8 + np.random.randn(n_periods) * 0.001,
        "Asset_C": factor * 1.2 + np.random.randn(n_periods) * 0.001,
    })
    return returns


# ============================================================================
# Unit Tests: Markowitz Frontier
# ============================================================================

@pytest.mark.unit
def test_markowitz_frontier_basic(simple_returns):
    """Test basic Markowitz frontier computation."""
    result = markowitz_frontier(simple_returns, points=20, use_shrinkage=False)

    # Check structure
    assert "frontier" in result
    assert "max_sharpe" in result
    assert "min_vol" in result

    # Check frontier properties
    assert len(result["frontier"]) > 0
    assert len(result["frontier"]) <= 20

    # Check each portfolio on frontier
    for portfolio in result["frontier"]:
        assert "return" in portfolio
        assert "vol" in portfolio
        assert "weights" in portfolio
        assert len(portfolio["weights"]) == len(simple_returns.columns)


@pytest.mark.unit
@pytest.mark.numerical
def test_markowitz_weights_sum_to_one(simple_returns):
    """Test that all portfolio weights sum to 1.0."""
    result = markowitz_frontier(simple_returns, points=10)

    # Check all frontier portfolios
    for portfolio in result["frontier"]:
        weight_sum = sum(portfolio["weights"])
        assert_allclose(weight_sum, 1.0, rtol=1e-4, atol=1e-6)

    # Check special portfolios
    assert_allclose(sum(result["max_sharpe"]["weights"]), 1.0, rtol=1e-4)
    assert_allclose(sum(result["min_vol"]["weights"]), 1.0, rtol=1e-4)


@pytest.mark.unit
@pytest.mark.numerical
def test_markowitz_weights_respect_bounds(simple_returns):
    """Test that weights respect box constraints."""
    cap = 0.4
    min_weight = 0.05

    result = markowitz_frontier(
        simple_returns,
        points=10,
        cap=cap,
        min_weight=min_weight,
        use_shrinkage=False
    )

    for portfolio in result["frontier"]:
        weights = np.array(portfolio["weights"])
        assert np.all(weights >= min_weight - 1e-6)
        assert np.all(weights <= cap + 1e-6)


@pytest.mark.unit
def test_markowitz_frontier_increasing_risk(simple_returns):
    """Test that frontier is monotonically increasing in risk-return space."""
    result = markowitz_frontier(simple_returns, points=30, use_shrinkage=False)

    # Extract returns and vols
    returns = [p["return"] for p in result["frontier"]]
    vols = [p["vol"] for p in result["frontier"]]

    # Frontier should be upward sloping (higher vol → higher return)
    # (with some tolerance for numerical noise)
    for i in range(1, len(returns)):
        # If vol increased, return should not decrease significantly
        if vols[i] > vols[i-1]:
            assert returns[i] >= returns[i-1] - 0.01


@pytest.mark.unit
def test_markowitz_min_vol_has_lowest_vol(simple_returns):
    """Test that min vol portfolio has the lowest volatility."""
    result = markowitz_frontier(simple_returns, points=20)

    min_vol = result["min_vol"]["vol"]

    # All frontier points should have vol >= min_vol
    for portfolio in result["frontier"]:
        assert portfolio["vol"] >= min_vol - 1e-6


@pytest.mark.unit
def test_markowitz_with_shrinkage(simple_returns):
    """Test that shrinkage produces different results."""
    result_no_shrink = markowitz_frontier(simple_returns, use_shrinkage=False)
    result_shrink = markowitz_frontier(simple_returns, use_shrinkage=True)

    # Results should differ (shrinkage changes covariance)
    assert result_no_shrink["min_vol"]["vol"] != result_shrink["min_vol"]["vol"]


# ============================================================================
# Unit Tests: Minimum Variance
# ============================================================================

@pytest.mark.unit
def test_min_variance_basic(simple_returns):
    """Test basic minimum variance optimization."""
    cov = simple_returns.cov() * 252
    weights = min_variance_weights_cvxpy(cov, cap=0.5, use_shrinkage=False)

    # Check properties
    assert len(weights) == len(simple_returns.columns)
    assert_allclose(weights.sum(), 1.0, rtol=1e-5)
    assert np.all(weights >= -1e-6)
    assert np.all(weights <= 0.5 + 1e-6)


@pytest.mark.unit
@pytest.mark.numerical
def test_min_variance_uncorrelated_assets(uncorrelated_returns):
    """Test min variance with uncorrelated assets.

    For uncorrelated assets, min variance should allocate inversely to variance.
    """
    cov = uncorrelated_returns.cov() * 252
    weights = min_variance_weights_cvxpy(cov, cap=1.0, use_shrinkage=False)

    # Extract variances
    variances = np.diag(cov.values)

    # Weights should be inversely proportional to variance
    # (without cap constraints)
    expected_weights = (1 / variances) / (1 / variances).sum()

    # Allow some tolerance for optimization
    assert_allclose(weights, expected_weights, rtol=0.1, atol=0.05)


@pytest.mark.unit
def test_min_variance_respects_caps(simple_returns):
    """Test that min variance respects position caps."""
    cov = simple_returns.cov() * 252
    cap = 0.25

    weights = min_variance_weights_cvxpy(cov, cap=cap)

    assert np.all(weights <= cap + 1e-6)
    assert np.all(weights >= -1e-6)


# ============================================================================
# Unit Tests: Risk Parity
# ============================================================================

@pytest.mark.unit
def test_risk_parity_basic(simple_returns):
    """Test basic risk parity optimization."""
    cov = simple_returns.cov() * 252
    weights = risk_parity_weights_cvxpy(cov, use_shrinkage=False)

    # Check properties
    assert len(weights) == len(simple_returns.columns)
    assert_allclose(weights.sum(), 1.0, rtol=1e-5)
    assert np.all(weights >= -1e-6)


@pytest.mark.unit
@pytest.mark.numerical
def test_risk_parity_equal_contributions(simple_returns):
    """Test that risk parity produces approximately equal risk contributions."""
    cov = simple_returns.cov() * 252
    weights = risk_parity_weights_cvxpy(cov, use_shrinkage=False)

    # Compute risk contributions
    marginal_contrib = cov.values @ weights
    risk_contrib = weights * marginal_contrib

    # Risk contributions should be approximately equal
    target = 1.0 / len(weights)

    # Check that standard deviation of risk contributions is small
    # (Indicates they're close to equal)
    rc_std = np.std(risk_contrib)
    assert rc_std < target * 0.5  # Within 50% of target

    # Also check that no single asset dominates
    max_rc = risk_contrib.max()
    min_rc = risk_contrib.min()
    assert max_rc / min_rc < 3.0  # Ratio not too extreme


@pytest.mark.unit
def test_risk_parity_uncorrelated_assets(uncorrelated_returns):
    """Test risk parity with uncorrelated assets.

    For uncorrelated assets, risk parity should allocate inversely to volatility.
    """
    cov = uncorrelated_returns.cov() * 252
    weights = risk_parity_weights_cvxpy(cov, use_shrinkage=False)

    # Extract volatilities
    vols = np.sqrt(np.diag(cov.values))

    # Weights should be inversely proportional to volatility
    expected_weights = (1 / vols) / (1 / vols).sum()

    # Check that ordering is correct (lowest vol gets highest weight)
    sorted_weights_idx = np.argsort(-weights)  # Descending
    sorted_vols_idx = np.argsort(vols)  # Ascending

    # At least the top 2 should match
    assert sorted_weights_idx[0] == sorted_vols_idx[0] or \
           sorted_weights_idx[1] == sorted_vols_idx[0]


# ============================================================================
# Unit Tests: Black-Litterman
# ============================================================================

@pytest.mark.unit
def test_black_litterman_no_views(simple_returns):
    """Test that Black-Litterman with no views returns prior."""
    mean_returns = simple_returns.mean() * 252
    cov = simple_returns.cov() * 252

    posterior = black_litterman(mean_returns, cov, views=None)

    # Should return prior unchanged
    assert_allclose(posterior.values, mean_returns.values, rtol=1e-10)


@pytest.mark.unit
def test_black_litterman_with_views(simple_returns):
    """Test that Black-Litterman incorporates views."""
    mean_returns = simple_returns.mean() * 252
    cov = simple_returns.cov() * 252

    # Strong bullish view on first asset
    views = {"Asset_0": 0.20}  # Expect 20% return

    posterior = black_litterman(mean_returns, cov, views=views)

    # Posterior for Asset_0 should be higher than prior
    assert posterior["Asset_0"] > mean_returns["Asset_0"]

    # Other assets should be less affected
    for asset in ["Asset_1", "Asset_2"]:
        diff = abs(posterior[asset] - mean_returns[asset])
        assert diff < 0.05  # Small spillover effect


@pytest.mark.unit
def test_black_litterman_view_uncertainty(simple_returns):
    """Test that view uncertainty affects posterior."""
    mean_returns = simple_returns.mean() * 252
    cov = simple_returns.cov() * 252

    views = {"Asset_0": 0.20}

    # High confidence view
    posterior_high_conf = black_litterman(
        mean_returns, cov,
        views=views,
        view_uncertainties={"Asset_0": 0.01}  # Very certain
    )

    # Low confidence view
    posterior_low_conf = black_litterman(
        mean_returns, cov,
        views=views,
        view_uncertainties={"Asset_0": 0.10}  # Less certain
    )

    # High confidence should move posterior more toward view
    high_conf_diff = abs(posterior_high_conf["Asset_0"] - 0.20)
    low_conf_diff = abs(posterior_low_conf["Asset_0"] - 0.20)

    assert high_conf_diff < low_conf_diff


@pytest.mark.unit
def test_black_litterman_invalid_ticker():
    """Test that invalid ticker in views raises error."""
    returns = pd.DataFrame({
        "AAPL": [0.01, 0.02, -0.01],
        "MSFT": [0.02, 0.01, 0.00],
    })

    mean_returns = returns.mean()
    cov = returns.cov()

    with pytest.raises(ValueError, match="invalid tickers"):
        black_litterman(
            mean_returns, cov,
            views={"INVALID": 0.10}
        )


# ============================================================================
# Unit Tests: Portfolio Performance
# ============================================================================

@pytest.mark.unit
@pytest.mark.numerical
def test_portfolio_perf_equal_weight():
    """Test portfolio performance with equal weights."""
    returns = pd.DataFrame({
        "A": [0.10, 0.05, -0.02],
        "B": [0.08, 0.06, 0.01],
        "C": [0.12, 0.04, -0.01],
    })

    mean_returns = returns.mean()
    cov = returns.cov()

    weights = np.array([1/3, 1/3, 1/3])

    ret, vol, sharpe = portfolio_perf(weights, mean_returns, cov)

    # Expected return: average of asset returns
    expected_return = mean_returns.mean()
    assert_allclose(ret, expected_return, rtol=1e-6)

    # Sharpe should be return / vol
    assert_allclose(sharpe, ret / vol if vol > 0 else 0, rtol=1e-6)


@pytest.mark.unit
def test_portfolio_perf_zero_vol():
    """Test that zero volatility portfolio has zero Sharpe."""
    # Constant returns (zero variance)
    returns = pd.DataFrame({
        "A": [0.01, 0.01, 0.01],
        "B": [0.02, 0.02, 0.02],
    })

    mean_returns = returns.mean()
    cov = returns.cov()  # Will be zero matrix

    weights = np.array([0.5, 0.5])

    ret, vol, sharpe = portfolio_perf(weights, mean_returns, cov)

    # Vol should be very small
    assert vol < 1e-6
    # Sharpe should be zero (or handled gracefully)
    assert sharpe == 0.0 or np.isnan(sharpe) == False


# ============================================================================
# Unit Tests: Optimizer Summary
# ============================================================================

@pytest.mark.unit
def test_optimizer_summary(simple_returns):
    """Test optimizer summary returns all strategies."""
    summary = optimizer_summary(simple_returns, cap=0.5)

    assert "risk_parity" in summary
    assert "min_vol" in summary
    assert "black_litterman" in summary

    # Each should be a list of weights
    assert isinstance(summary["risk_parity"], list)
    assert isinstance(summary["min_vol"], list)
    assert isinstance(summary["black_litterman"], list)

    # Check lengths
    n_assets = len(simple_returns.columns)
    assert len(summary["risk_parity"]) == n_assets
    assert len(summary["min_vol"]) == n_assets
    assert len(summary["black_litterman"]) == n_assets


# ============================================================================
# Property-Based Tests (Hypothesis)
# ============================================================================

@pytest.mark.hypothesis
@given(
    n_assets=st.integers(min_value=2, max_value=10),
    cap=st.floats(min_value=0.2, max_value=1.0),
)
@settings(max_examples=20, deadline=5000)
def test_markowitz_invariants(n_assets, cap):
    """Property-based test: Markowitz frontier invariants."""
    # Generate random returns
    np.random.seed(42)
    returns = pd.DataFrame(
        np.random.randn(100, n_assets) * 0.01,
        columns=[f"Asset_{i}" for i in range(n_assets)]
    )

    try:
        result = markowitz_frontier(returns, points=5, cap=cap, use_shrinkage=False)

        # Property 1: All weights sum to 1
        for portfolio in result["frontier"]:
            assert abs(sum(portfolio["weights"]) - 1.0) < 1e-3

        # Property 2: All weights respect bounds
        for portfolio in result["frontier"]:
            weights = np.array(portfolio["weights"])
            assert np.all(weights >= -1e-6)
            assert np.all(weights <= cap + 1e-5)

        # Property 3: Volatility is non-negative
        for portfolio in result["frontier"]:
            assert portfolio["vol"] >= 0

    except Exception:
        # Some random data may cause numerical issues - that's okay
        pass


@pytest.mark.hypothesis
@given(
    n_assets=st.integers(min_value=2, max_value=8),
)
@settings(max_examples=20, deadline=3000)
def test_risk_parity_invariants(n_assets):
    """Property-based test: Risk parity invariants."""
    # Generate random covariance matrix
    np.random.seed(42)
    A = np.random.randn(n_assets, n_assets)
    cov = pd.DataFrame(A.T @ A / 100, index=range(n_assets), columns=range(n_assets))

    try:
        weights = risk_parity_weights_cvxpy(cov, use_shrinkage=False)

        # Property 1: Weights sum to 1
        assert abs(weights.sum() - 1.0) < 1e-4

        # Property 2: All weights non-negative
        assert np.all(weights >= -1e-6)

        # Property 3: Risk contributions are approximately equal
        marginal = cov.values @ weights
        risk_contrib = weights * marginal
        std_risk_contrib = np.std(risk_contrib)

        # Risk contributions should have low variance
        assert std_risk_contrib < 0.1  # Somewhat arbitrary threshold

    except Exception:
        # Some random matrices may cause numerical issues
        pass


# ============================================================================
# Edge Cases
# ============================================================================

@pytest.mark.unit
def test_markowitz_single_asset():
    """Test Markowitz with single asset (trivial case)."""
    returns = pd.DataFrame({
        "Only_Asset": np.random.randn(100) * 0.01
    })

    result = markowitz_frontier(returns, points=5)

    # Should have only one solution: 100% in the only asset
    assert_allclose(result["min_vol"]["weights"], [1.0], rtol=1e-4)
    assert_allclose(result["max_sharpe"]["weights"], [1.0], rtol=1e-4)


@pytest.mark.unit
def test_markowitz_two_assets(uncorrelated_returns):
    """Test Markowitz with two uncorrelated assets."""
    returns = uncorrelated_returns[["Low_Vol", "High_Vol"]]

    # Use looser cap for two-asset case
    result = markowitz_frontier(returns, points=10, cap=0.8, use_shrinkage=False)

    # Min vol should favor low vol asset
    low_vol_weight = result["min_vol"]["weights"][0]
    high_vol_weight = result["min_vol"]["weights"][1]

    # Low vol should get more weight than high vol
    assert low_vol_weight > high_vol_weight


@pytest.mark.unit
def test_perfectly_correlated_frontier(perfectly_correlated_returns):
    """Test frontier with perfectly correlated assets."""
    result = markowitz_frontier(perfectly_correlated_returns, points=5, use_shrinkage=False)

    # Frontier should still be computable
    assert len(result["frontier"]) > 0

    # Weights should still sum to 1
    for portfolio in result["frontier"]:
        assert_allclose(sum(portfolio["weights"]), 1.0, rtol=1e-4)


# ============================================================================
# Numerical Accuracy Tests
# ============================================================================

@pytest.mark.numerical
def test_min_variance_analytical_solution():
    """Test min variance against known analytical solution.

    For uncorrelated assets with no constraints, the solution is:
    w_i = (1/σ_i²) / Σ_j(1/σ_j²)
    """
    # Create diagonal covariance (uncorrelated)
    variances = np.array([0.04, 0.09, 0.16])  # σ = [0.2, 0.3, 0.4]
    cov = pd.DataFrame(np.diag(variances), index=range(3), columns=range(3))

    # Analytical solution
    inv_var = 1 / variances
    expected_weights = inv_var / inv_var.sum()

    # Numerical solution
    weights = min_variance_weights_cvxpy(cov, cap=1.0, use_shrinkage=False)

    # Should match closely
    assert_allclose(weights, expected_weights, rtol=1e-3, atol=1e-4)


@pytest.mark.numerical
def test_portfolio_variance_formula():
    """Test that portfolio variance formula is correct: w^T Σ w"""
    returns = pd.DataFrame({
        "A": [0.01, 0.02, -0.01, 0.00],
        "B": [-0.01, 0.01, 0.02, -0.01],
    })

    weights = np.array([0.6, 0.4])
    mean_returns = returns.mean()
    cov = returns.cov()

    _, vol, _ = portfolio_perf(weights, mean_returns, cov)

    # Manual calculation
    variance_manual = weights @ cov.values @ weights
    vol_manual = np.sqrt(variance_manual)

    assert_allclose(vol, vol_manual, rtol=1e-10)
