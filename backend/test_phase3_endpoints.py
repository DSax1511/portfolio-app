"""
Quick test of Phase 3 backend endpoints
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import json

# Test data generation
def generate_test_data():
    """Generate realistic test data"""
    dates = pd.date_range(end=datetime.now(), periods=252, freq='D')
    n_assets = 5
    
    np.random.seed(42)
    returns = pd.DataFrame(
        np.random.normal(0.0005, 0.015, (252, n_assets)),
        columns=['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA'],
        index=dates
    )
    
    prices = pd.DataFrame(
        np.random.uniform(100, 500, (252, n_assets)),
        columns=['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA'],
        index=dates
    )
    
    return returns, prices, dates


def test_advanced_strategies():
    """Test advanced strategies module"""
    print("\n" + "="*60)
    print("TESTING ADVANCED STRATEGIES")
    print("="*60)
    
    from quant.advanced_strategies import (
        pairs_trading_backtest,
        garch_vol_targeting,
        walk_forward_optimization,
        momentum_strategy,
    )
    
    returns, prices, dates = generate_test_data()
    
    # Test 1: Pairs Trading
    print("\n1. Testing pairs_trading_backtest...")
    try:
        result = pairs_trading_backtest('AAPL', 'MSFT', prices)
        print(f"   ✓ Sharpe: {result['summary']['sharpe_ratio']:.2f}")
        print(f"   ✓ Cointegration p-value: {result['summary']['cointegration_pvalue']:.4f}")
        print(f"   ✓ Number of trades: {result['summary']['num_trades']}")
    except Exception as e:
        print(f"   ✗ Error: {str(e)[:100]}")
    
    # Test 2: GARCH Vol Targeting
    print("\n2. Testing garch_vol_targeting...")
    try:
        result = garch_vol_targeting(returns['AAPL'], target_vol=0.15)
        print(f"   ✓ Total return: {result['summary']['total_return']:.2%}")
        print(f"   ✓ Realized vol: {result['summary']['realized_vol']:.2%}")
        print(f"   ✓ Sharpe: {result['summary']['sharpe_ratio']:.2f}")
        print(f"   ✓ GARCH params: ω={result['garch_params']['omega']:.6f}, α={result['garch_params']['alpha']:.6f}, β={result['garch_params']['beta']:.6f}")
    except Exception as e:
        print(f"   ✗ Error: {str(e)[:100]}")
    
    # Test 3: Walk-Forward Optimization
    print("\n3. Testing walk_forward_optimization...")
    try:
        result = walk_forward_optimization(returns, lookback_months=6, reopt_months=3)
        print(f"   ✓ Out-of-sample Sharpe: {result['summary']['sharpe_ratio']:.2f}")
        print(f"   ✓ Number of rebalances: {result['summary']['num_rebalances']}")
        print(f"   ✓ Total return: {result['summary']['total_return']:.2%}")
    except Exception as e:
        print(f"   ✗ Error: {str(e)[:100]}")
    
    # Test 4: Momentum Strategy
    print("\n4. Testing momentum_strategy...")
    try:
        result = momentum_strategy(returns, lookback=126, holding_period=21, top_n=3)
        print(f"   ✓ Total return: {result['summary']['total_return']:.2%}")
        print(f"   ✓ Sharpe: {result['summary']['sharpe_ratio']:.2f}")
        print(f"   ✓ Max drawdown: {result['summary']['max_drawdown']:.2%}")
    except Exception as e:
        print(f"   ✗ Error: {str(e)[:100]}")


def test_risk_analytics():
    """Test risk analytics module"""
    print("\n" + "="*60)
    print("TESTING RISK ANALYTICS")
    print("="*60)
    
    from quant.risk_analytics import (
        compute_var_cvar,
        stress_test_portfolio,
        pca_decomposition,
        tail_risk_metrics,
    )
    
    returns, prices, dates = generate_test_data()
    
    # Test 1: VaR/CVaR
    print("\n1. Testing compute_var_cvar...")
    try:
        result = compute_var_cvar(returns['AAPL'], confidence_level=0.95, method='historical')
        print(f"   ✓ VaR (daily): {result['var_daily']:.4f}")
        print(f"   ✓ CVaR (daily): {result['cvar_daily']:.4f}")
        print(f"   ✓ VaR (annual): {result['var_annual']:.2%}")
    except Exception as e:
        print(f"   ✗ Error: {str(e)[:100]}")
    
    # Test 2: Stress Testing
    print("\n2. Testing stress_test_portfolio...")
    try:
        result = stress_test_portfolio(returns['AAPL'], current_value=100000)
        print(f"   ✓ Worst case scenario: {result['summary']['worst_case_scenario']}")
        print(f"   ✓ Worst case loss: {result['summary']['worst_case_loss']:.2%}")
        print(f"   ✓ Number of scenarios: {len(result['scenarios'])}")
    except Exception as e:
        print(f"   ✗ Error: {str(e)[:100]}")
    
    # Test 3: PCA Decomposition
    print("\n3. Testing pca_decomposition...")
    try:
        result = pca_decomposition(returns, n_components=3)
        print(f"   ✓ Explained variance (PC1): {result['explained_variance'][0]:.1%}")
        print(f"   ✓ Cumulative variance (3 PCs): {result['cumulative_variance'][2]:.1%}")
        print(f"   ✓ Effective factors: {result['effective_factors']:.2f}")
    except Exception as e:
        print(f"   ✗ Error: {str(e)[:100]}")
    
    # Test 4: Tail Risk Metrics
    print("\n4. Testing tail_risk_metrics...")
    try:
        result = tail_risk_metrics(returns['AAPL'])
        print(f"   ✓ Max drawdown: {result['max_drawdown']:.2%}")
        print(f"   ✓ CAGR: {result['cagr']:.2%}")
        print(f"   ✓ Calmar ratio: {result['calmar_ratio']:.2f}")
        print(f"   ✓ Sortino ratio: {result['sortino_ratio']:.2f}")
    except Exception as e:
        print(f"   ✗ Error: {str(e)[:100]}")


def test_live_trading():
    """Test live trading module"""
    print("\n" + "="*60)
    print("TESTING LIVE TRADING")
    print("="*60)
    
    from quant.live_trading import (
        get_live_positions,
        generate_rebalance_orders,
        monitor_risk_limits,
    )
    
    returns, prices, dates = generate_test_data()
    
    # Test 1: Live Positions
    print("\n1. Testing get_live_positions...")
    try:
        tickers = ['AAPL', 'MSFT', 'GOOGL']
        quantities = [100, 50, 75]
        entry_prices = [150, 300, 130]
        result = get_live_positions(tickers, quantities, entry_prices)
        print(f"   ✓ Positions: {result['summary']['num_positions']}")
        print(f"   ✓ Total value: ${result['summary']['total_value']:.2f}")
        print(f"   ✓ Total P&L: ${result['summary']['total_pnl']:.2f}")
    except Exception as e:
        print(f"   ✗ Error: {str(e)[:100]}")
    
    # Test 2: Rebalance Orders
    print("\n2. Testing generate_rebalance_orders...")
    try:
        current_tickers = ['AAPL', 'MSFT']
        current_quantities = [100, 50]
        current_prices = [150, 300]
        target_weights = {'AAPL': 0.4, 'MSFT': 0.3, 'GOOGL': 0.3}
        result = generate_rebalance_orders(
            current_tickers, current_quantities, current_prices,
            target_weights, total_value=100000
        )
        print(f"   ✓ Orders generated: {result['summary']['num_orders']}")
        print(f"   ✓ Turnover: {result['summary']['turnover_percent']:.2f}%")
    except Exception as e:
        print(f"   ✗ Error: {str(e)[:100]}")
    
    # Test 3: Risk Limits
    print("\n3. Testing monitor_risk_limits...")
    try:
        positions = {'AAPL': 0.4, 'MSFT': 0.3, 'GOOGL': 0.3}
        result = monitor_risk_limits(returns['AAPL'], positions)
        print(f"   ✓ Has breaches: {result['has_breaches']}")
        print(f"   ✓ Number of breaches: {result['num_breaches']}")
        print(f"   ✓ Warnings: {len(result['warnings'])}")
    except Exception as e:
        print(f"   ✗ Error: {str(e)[:100]}")


def test_regimes():
    """Test HMM regimes detection"""
    print("\n" + "="*60)
    print("TESTING REGIMES (HMM)")
    print("="*60)
    
    from quant_regimes import detect_regimes_hmm
    
    returns, prices, dates = generate_test_data()
    
    print("\n1. Testing detect_regimes_hmm...")
    try:
        result = detect_regimes_hmm(returns['AAPL'], n_regimes=3)
        print(f"   ✓ Number of regimes: {result['summary']['n_regimes']}")
        print(f"   ✓ BIC score: {result['summary']['bic']:.2f}")
        print(f"   ✓ Regime states: {len(result['regimes'])}")
    except Exception as e:
        print(f"   ✗ Error: {str(e)[:100]}")


if __name__ == "__main__":
    print("\n" + "🧪 PHASE 3 BACKEND TESTS".center(60, "="))
    print("Testing all new quantitative modules")
    
    try:
        test_advanced_strategies()
    except Exception as e:
        print(f"\n❌ Advanced strategies test suite failed: {e}")
    
    try:
        test_risk_analytics()
    except Exception as e:
        print(f"\n❌ Risk analytics test suite failed: {e}")
    
    try:
        test_live_trading()
    except Exception as e:
        print(f"\n❌ Live trading test suite failed: {e}")
    
    try:
        test_regimes()
    except Exception as e:
        print(f"\n❌ Regimes test suite failed: {e}")
    
    print("\n" + "="*60)
    print("✅ All tests completed!")
    print("="*60)
