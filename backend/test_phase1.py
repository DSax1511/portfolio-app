"""
Quick validation test for Phase 1 improvements.

Tests:
1. CVXPY-based efficient frontier
2. Ledoit-Wolf covariance shrinkage
3. Factor model regression

Run from backend directory:
    python test_phase1.py
"""

import numpy as np
import pandas as pd
import sys
from pathlib import Path

# Add app to path
sys.path.insert(0, str(Path(__file__).parent))

from app import optimizers_v2, covariance_estimation, factor_models


def test_efficient_frontier():
    """Test CVXPY-based Markowitz frontier."""
    print("\n" + "=" * 60)
    print("TEST 1: CVXPY Efficient Frontier")
    print("=" * 60)

    # Create synthetic return data
    np.random.seed(42)
    n_assets = 5
    n_periods = 252

    returns = pd.DataFrame(
        np.random.randn(n_periods, n_assets) * 0.01 + 0.0005,
        columns=[f"Asset_{i}" for i in range(n_assets)]
    )

    print(f"\nGenerated {n_periods} periods of returns for {n_assets} assets")

    # Compute frontier
    try:
        result = optimizers_v2.markowitz_frontier(
            returns,
            points=20,
            cap=0.5,
            use_shrinkage=True
        )

        print(f"✓ Efficient frontier computed successfully")
        print(f"  - {len(result['frontier'])} points on frontier")
        print(f"\nMax Sharpe Portfolio:")
        print(f"  Return: {result['max_sharpe']['return']:.2%}")
        print(f"  Vol:    {result['max_sharpe']['vol']:.2%}")
        print(f"  Weights: {[f'{w:.2%}' for w in result['max_sharpe']['weights']]}")

        print(f"\nMin Volatility Portfolio:")
        print(f"  Return: {result['min_vol']['return']:.2%}")
        print(f"  Vol:    {result['min_vol']['vol']:.2%}")
        print(f"  Weights: {[f'{w:.2%}' for w in result['min_vol']['weights']]}")

        # Validate weights sum to 1
        for portfolio in result['frontier']:
            assert abs(sum(portfolio['weights']) - 1.0) < 1e-4, "Weights don't sum to 1!"

        print("\n✓ All weight constraints satisfied")
        return True

    except Exception as e:
        print(f"✗ FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_covariance_shrinkage():
    """Test Ledoit-Wolf covariance shrinkage."""
    print("\n" + "=" * 60)
    print("TEST 2: Ledoit-Wolf Covariance Shrinkage")
    print("=" * 60)

    # Create synthetic return data (ill-conditioned case)
    np.random.seed(42)
    n_assets = 20
    n_periods = 60  # T < N → ill-conditioned

    returns = pd.DataFrame(
        np.random.randn(n_periods, n_assets) * 0.01,
        columns=[f"Asset_{i}" for i in range(n_assets)]
    )

    print(f"\nGenerated {n_periods} periods (T) for {n_assets} assets (N)")
    print(f"Ratio T/N = {n_periods/n_assets:.2f} (< 10 → expect benefit from shrinkage)")

    try:
        # Sample covariance
        cov_sample = covariance_estimation.sample_covariance(returns)
        cond_sample = covariance_estimation.condition_number(cov_sample)

        # Ledoit-Wolf shrinkage
        cov_lw, shrinkage = covariance_estimation.ledoit_wolf_shrinkage(returns)
        cond_lw = covariance_estimation.condition_number(cov_lw)

        print(f"\nSample Covariance:")
        print(f"  Condition number: {cond_sample:.2f}")

        print(f"\nLedoit-Wolf Shrinkage:")
        print(f"  Shrinkage intensity: {shrinkage:.2%}")
        print(f"  Condition number: {cond_lw:.2f}")
        print(f"  Improvement: {(1 - cond_lw/cond_sample)*100:.1f}% reduction")

        # Compare all estimators
        comparison = covariance_estimation.compare_estimators(returns)
        print(f"\n{comparison.to_string(index=False)}")

        assert cond_lw < cond_sample, "Shrinkage should reduce condition number"
        print("\n✓ Shrinkage successfully reduces condition number")
        return True

    except Exception as e:
        print(f"✗ FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_factor_model():
    """Test Fama-French factor regression."""
    print("\n" + "=" * 60)
    print("TEST 3: Fama-French 5-Factor Model")
    print("=" * 60)

    # Create synthetic data
    np.random.seed(42)
    n_periods = 252

    # True factor loadings
    true_alpha = 0.05 / 252  # 5% annual alpha
    true_betas = {
        'Mkt-RF': 1.2,
        'SMB': 0.3,
        'HML': -0.2,
        'RMW': 0.1,
        'CMA': 0.0,
    }

    # Generate factor returns
    factor_returns = pd.DataFrame({
        'Mkt-RF': np.random.randn(n_periods) * 0.01 + 0.0003,
        'SMB': np.random.randn(n_periods) * 0.004,
        'HML': np.random.randn(n_periods) * 0.005,
        'RMW': np.random.randn(n_periods) * 0.003,
        'CMA': np.random.randn(n_periods) * 0.003,
    })

    # Generate asset returns using factor model
    asset_returns = pd.Series(index=factor_returns.index, dtype=float)
    for t in factor_returns.index:
        factor_component = sum(
            true_betas[f] * factor_returns.loc[t, f]
            for f in factor_returns.columns
        )
        idio = np.random.randn() * 0.005  # Idiosyncratic return
        asset_returns.loc[t] = true_alpha + factor_component + idio

    print(f"\nGenerated synthetic asset returns with:")
    print(f"  True alpha (annualized): {true_alpha * 252:.2%}")
    print(f"  True betas: {true_betas}")

    try:
        # Run regression
        result = factor_models.fama_french_5factor_regression(
            asset_returns,
            factor_returns
        )

        print(f"\n Regression Results:")
        print(f"  Alpha (annualized): {result['alpha']:.2%}")
        print(f"  R²: {result['r_squared']:.3f}")
        print(f"  Adjusted R²: {result['adj_r_squared']:.3f}")

        print(f"\n Estimated Betas:")
        for factor, beta in result['betas'].items():
            true_beta = true_betas[factor]
            error = abs(beta - true_beta)
            print(f"  {factor:8s}: {beta:6.3f} (true: {true_beta:6.3f}, error: {error:.3f})")

        print(f"\n Coefficient Statistics:")
        for name, stats in result['coefficient_stats'].items():
            sig = "***" if stats['p_value'] < 0.01 else "**" if stats['p_value'] < 0.05 else "*" if stats['p_value'] < 0.1 else ""
            print(f"  {name:8s}: t={stats['t_stat']:6.2f}, p={stats['p_value']:.4f} {sig}")

        # Variance decomposition
        print(f"\n Variance Decomposition:")
        print(f"  Factor variance:        {result['factor_variance']:.6f}")
        print(f"  Idiosyncratic variance: {result['idiosyncratic_variance']:.6f}")
        print(f"  Total variance:         {result['total_variance']:.6f}")
        print(f"  % Factor risk:          {result['pct_factor_risk']*100:.1f}%")

        assert result['r_squared'] > 0.5, "R² should be high for synthetic data with true model"
        print("\n✓ Factor regression successful")
        return True

    except Exception as e:
        print(f"✗ FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Run all tests."""
    print("\n" + "=" * 60)
    print("PHASE 1 VALIDATION TESTS")
    print("Testing mathematical rigor improvements")
    print("=" * 60)

    results = {
        "Efficient Frontier (CVXPY)": test_efficient_frontier(),
        "Covariance Shrinkage": test_covariance_shrinkage(),
        "Factor Model": test_factor_model(),
    }

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)

    for test_name, passed in results.items():
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{test_name:40s} {status}")

    all_passed = all(results.values())
    print("\n" + "=" * 60)
    if all_passed:
        print("ALL TESTS PASSED ✓")
        print("Phase 1 implementation is working correctly!")
    else:
        print("SOME TESTS FAILED ✗")
        print("Review errors above")
    print("=" * 60 + "\n")

    return 0 if all_passed else 1


if __name__ == "__main__":
    exit(main())
