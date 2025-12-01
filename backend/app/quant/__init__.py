"""
Quant Lab Module - Advanced quantitative finance algorithms.

This module contains:
- advanced_strategies.py: Pairs trading, GARCH, walk-forward optimization
- risk_analytics.py: VaR/CVaR, stress testing, PCA decomposition
- live_trading.py: Real-time position tracking and order generation
"""

from .advanced_strategies import (
    pairs_trading_backtest,
    garch_vol_targeting,
    walk_forward_optimization,
    momentum_strategy,
)

from .risk_analytics import (
    compute_var_cvar,
    stress_test_portfolio,
    pca_decomposition,
    tail_risk_metrics,
)

from .live_trading import (
    get_live_positions,
    generate_rebalance_orders,
    monitor_risk_limits,
)

__all__ = [
    "pairs_trading_backtest",
    "garch_vol_targeting",
    "walk_forward_optimization",
    "momentum_strategy",
    "compute_var_cvar",
    "stress_test_portfolio",
    "pca_decomposition",
    "tail_risk_metrics",
    "get_live_positions",
    "generate_rebalance_orders",
    "monitor_risk_limits",
]
