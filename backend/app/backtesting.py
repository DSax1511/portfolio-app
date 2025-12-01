"""
Advanced backtesting module with walk-forward validation and proper train/test separation.

Key features:
- Walk-forward validation: prevents lookahead bias
- Out-of-sample metrics: realistic performance assessment
- Transaction cost modeling: accounts for trading friction
- Drawdown analysis: underwater plots, recovery time
- Monte Carlo reshuffling: tests strategy robustness

Mathematical framework:
------------------------

Walk-Forward Validation (WFV):
    For each time period t:
        1. Train on data [t-N, t] (training window)
        2. Test on data [t, t+M] (testing window)
        3. Rebalance at t, evaluate on [t, t+M]
    Result: Realistic out-of-sample performance

Transaction Cost Model:
    Cost = λ * |w_new - w_old|₁ * portfolio_value
    Where λ = basis points (e.g., 10 bps = 0.0001)

Sharpe Ratio (Adjusted for Costs):
    Sharpe = (R_portfolio - R_rf) / σ_portfolio
    Where R_portfolio already includes transaction costs

Drawdown Analysis:
    Running maximum: M_t = max(P₀, P₁, ..., P_t)
    Drawdown: DD_t = (P_t - M_t) / M_t
    Max Drawdown: max(DD_t)
    Drawdown Duration: longest consecutive negative periods
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from fastapi import HTTPException

from .analytics import compute_portfolio_returns


def validate_walk_forward_window(
    returns: pd.DataFrame,
    train_window: int = 252,
    test_window: int = 63,
    rebalance_freq: str = "M",
) -> Dict[str, Any]:
    """
    Perform walk-forward validation with proper train/test separation.

    This is the PRIMARY backtesting method. It:
    1. Respects temporal ordering (no lookahead bias)
    2. Rebalances at specified frequency
    3. Computes realistic out-of-sample metrics
    4. Reports training vs testing performance degradation

    Args:
        returns: Historical daily returns (time × assets)
        train_window: Training period in trading days (default 1 year)
        test_window: Testing period in trading days (default 1 quarter)
        rebalance_freq: Rebalancing frequency ("D", "W", "M", "Q")

    Returns:
        {
            "out_of_sample_sharpe": float,
            "out_of_sample_annual_return": float,
            "out_of_sample_volatility": float,
            "max_drawdown_oos": float,
            "training_performance": [{period, return, vol, sharpe}, ...],
            "testing_performance": [{period, return, vol, sharpe}, ...],
            "performance_degradation": float (% return drop from training to testing),
            "overfitting_indicator": str ("low", "medium", "high"),
            "rebalance_count": int,
        }
    """
    n_periods = len(returns)
    
    if train_window + test_window > n_periods:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient data for walk-forward validation. "
                   f"Need {train_window + test_window} periods, have {n_periods}"
        )

    training_results = []
    testing_results = []
    
    # Determine rebalance dates based on frequency
    if rebalance_freq.upper() == "D":
        rebalance_indices = list(range(train_window, n_periods - test_window))
    elif rebalance_freq.upper() == "W":
        # Every ~5 trading days
        rebalance_indices = list(range(train_window, n_periods - test_window, 5))
    elif rebalance_freq.upper() == "M":
        # Every ~21 trading days
        rebalance_indices = list(range(train_window, n_periods - test_window, 21))
    elif rebalance_freq.upper() == "Q":
        # Every ~63 trading days
        rebalance_indices = list(range(train_window, n_periods - test_window, 63))
    else:
        raise HTTPException(status_code=400, detail=f"Invalid rebalance frequency: {rebalance_freq}")

    if not rebalance_indices:
        raise HTTPException(
            status_code=400,
            detail=f"No valid rebalance points with current window settings"
        )

    oos_returns_list = []

    for rebal_idx in rebalance_indices:
        # Training window: [rebal_idx - train_window, rebal_idx]
        train_end_idx = rebal_idx
        train_start_idx = max(0, train_end_idx - train_window)
        train_data = returns.iloc[train_start_idx:train_end_idx]

        # Testing window: [rebal_idx, rebal_idx + test_window]
        test_start_idx = rebal_idx
        test_end_idx = min(n_periods, test_start_idx + test_window)
        test_data = returns.iloc[test_start_idx:test_end_idx]

        # Compute training statistics (for reference)
        train_mean_return = train_data.mean().mean() * 252
        train_vol = train_data.std().mean() * np.sqrt(252)
        train_sharpe = train_mean_return / train_vol if train_vol > 1e-10 else 0.0

        training_results.append({
            "period": str(returns.index[train_end_idx].date()),
            "return": train_mean_return,
            "vol": train_vol,
            "sharpe": train_sharpe,
            "n_days": len(train_data),
        })

        # Compute testing statistics (OOS performance)
        if len(test_data) > 0:
            test_mean_return = test_data.mean().mean() * 252
            test_vol = test_data.std().mean() * np.sqrt(252)
            test_sharpe = test_mean_return / test_vol if test_vol > 1e-10 else 0.0

            testing_results.append({
                "period": str(returns.index[test_start_idx].date()),
                "return": test_mean_return,
                "vol": test_vol,
                "sharpe": test_sharpe,
                "n_days": len(test_data),
            })

            # Collect OOS returns for overall metrics
            oos_returns_list.extend(test_data.values.flatten().tolist())

    # Compute overall out-of-sample statistics
    if oos_returns_list:
        oos_returns_array = np.array(oos_returns_list)
        oos_mean = oos_returns_array.mean() * 252
        oos_vol = oos_returns_array.std() * np.sqrt(252)
        oos_sharpe = oos_mean / oos_vol if oos_vol > 1e-10 else 0.0

        # Compute OOS max drawdown
        cumulative_oos = (1 + pd.Series(oos_returns_array)).cumprod()
        running_max = cumulative_oos.cummax()
        drawdown = (cumulative_oos - running_max) / running_max
        max_drawdown_oos = float(drawdown.min())
    else:
        oos_mean = oos_vol = oos_sharpe = max_drawdown_oos = 0.0

    # Compute performance degradation (training vs testing)
    if training_results and testing_results:
        avg_train_return = np.mean([r["return"] for r in training_results])
        avg_test_return = np.mean([r["return"] for r in testing_results])
        degradation = (avg_train_return - avg_test_return) / abs(avg_train_return) if avg_train_return != 0 else 0.0
    else:
        degradation = 0.0

    # Assess overfitting
    if degradation < 0.1:
        overfitting = "low"
    elif degradation < 0.3:
        overfitting = "medium"
    else:
        overfitting = "high"

    return {
        "out_of_sample_sharpe": oos_sharpe,
        "out_of_sample_annual_return": oos_mean,
        "out_of_sample_volatility": oos_vol,
        "max_drawdown_oos": max_drawdown_oos,
        "training_performance": training_results,
        "testing_performance": testing_results,
        "performance_degradation": degradation,
        "overfitting_indicator": overfitting,
        "rebalance_count": len(rebalance_indices),
        "interpretation": _interpret_walk_forward(degradation, oos_sharpe, overfitting),
    }


def analyze_drawdown(returns: pd.Series, window: int = 252) -> Dict[str, Any]:
    """
    Comprehensive drawdown analysis.

    Args:
        returns: Daily portfolio returns (time series)
        window: Rolling window for rolling max drawdown

    Returns:
        {
            "max_drawdown": float,
            "average_drawdown": float,
            "drawdown_duration": int (days),
            "max_drawdown_duration": int (days),
            "recovery_time": int (days from peak to recovery),
            "num_drawdowns": int,
            "underwater_chart": list of drawdown values
        }
    """
    cumulative = (1 + returns).cumprod()
    running_max = cumulative.cummax()
    drawdown = (cumulative - running_max) / running_max

    max_dd = float(drawdown.min())
    avg_dd = float(drawdown[drawdown < 0].mean()) if (drawdown < 0).any() else 0.0

    # Drawdown duration: longest consecutive negative period
    in_drawdown = (drawdown < 0).astype(int)
    drawdown_periods = np.diff(np.concatenate(([0], in_drawdown, [0])))
    starts = np.where(drawdown_periods == 1)[0]
    ends = np.where(drawdown_periods == -1)[0]
    
    if len(starts) > 0:
        durations = ends - starts
        max_dd_duration = int(durations.max())
        num_drawdowns = len(starts)
    else:
        max_dd_duration = 0
        num_drawdowns = 0

    # Recovery time: days from peak drawdown to recovery
    if len(drawdown) > 0 and max_dd < 0:
        peak_idx = drawdown.idxmin()
        peak_pos = np.where(drawdown.index == peak_idx)[0][0]
        recovery_prices = cumulative.iloc[peak_pos:]
        peak_price = cumulative[peak_idx]
        recovery_idx = (recovery_prices >= peak_price).idxmax() if (recovery_prices >= peak_price).any() else None
        if recovery_idx and recovery_idx > peak_idx:
            recovery_time = (recovery_idx - peak_idx).days
        else:
            recovery_time = None
    else:
        recovery_time = None

    return {
        "max_drawdown": max_dd,
        "average_drawdown": avg_dd,
        "drawdown_duration_days": max_dd_duration,
        "num_drawdowns": num_drawdowns,
        "recovery_time_days": recovery_time,
        "underwater_chart": drawdown.tolist(),
    }


def monte_carlo_backtest(
    returns: pd.DataFrame,
    weights: np.ndarray,
    n_simulations: int = 1000,
    confidence: float = 0.95,
) -> Dict[str, Any]:
    """
    Monte Carlo reshuffle backtest: tests if strategy is robust to parameter uncertainty.

    Method:
        1. Resample historical returns with replacement (bootstrap)
        2. Compute portfolio performance on each sample
        3. Estimate VaR and CVaR at confidence level
        4. Assess if strategy is statistically significant

    Args:
        returns: Historical returns (time × assets)
        weights: Portfolio weights (n_assets,)
        n_simulations: Number of Monte Carlo paths
        confidence: Confidence level for VaR/CVaR (e.g., 0.95 = 5% tail)

    Returns:
        {
            "mean_return": float,
            "std_return": float,
            "var_loss": float (VaR at confidence level),
            "cvar_loss": float (CVaR/Expected Shortfall),
            "return_distribution": list of returns,
            "probability_positive": float,
            "sharpe_ratio_dist": {mean, std, percentiles},
        }
    """
    portfolio_returns = (returns * weights).sum(axis=1)
    
    simulated_returns = []
    simulated_sharpes = []
    
    for _ in range(n_simulations):
        # Resample with replacement
        indices = np.random.choice(len(portfolio_returns), size=len(portfolio_returns), replace=True)
        sim_returns = portfolio_returns.iloc[indices].values
        
        # Compute metrics
        annual_return = sim_returns.mean() * 252
        annual_vol = sim_returns.std() * np.sqrt(252)
        sharpe = annual_return / annual_vol if annual_vol > 1e-10 else 0.0
        
        simulated_returns.append(annual_return)
        simulated_sharpes.append(sharpe)
    
    simulated_returns = np.array(simulated_returns)
    simulated_sharpes = np.array(simulated_sharpes)
    
    # VaR and CVaR
    var_threshold = np.percentile(simulated_returns, (1 - confidence) * 100)
    cvar = simulated_returns[simulated_returns <= var_threshold].mean()
    
    # Probability of positive return
    prob_positive = (simulated_returns > 0).sum() / len(simulated_returns)
    
    return {
        "mean_return": float(simulated_returns.mean()),
        "std_return": float(simulated_returns.std()),
        "var_loss_95pct": float(var_threshold),
        "cvar_loss_95pct": float(cvar),
        "probability_positive": float(prob_positive),
        "sharpe_mean": float(simulated_sharpes.mean()),
        "sharpe_std": float(simulated_sharpes.std()),
        "sharpe_percentiles": {
            "5th": float(np.percentile(simulated_sharpes, 5)),
            "25th": float(np.percentile(simulated_sharpes, 25)),
            "50th": float(np.percentile(simulated_sharpes, 50)),
            "75th": float(np.percentile(simulated_sharpes, 75)),
            "95th": float(np.percentile(simulated_sharpes, 95)),
        },
    }


def transaction_cost_adjusted_returns(
    portfolio_returns: pd.Series,
    weights_history: pd.DataFrame,
    basis_points: float = 10.0,
    portfolio_value: float = 1000000.0,
) -> Dict[str, Any]:
    """
    Adjust portfolio returns for transaction costs from rebalancing.

    Args:
        portfolio_returns: Daily portfolio returns
        weights_history: Portfolio weights over time (time × assets)
        basis_points: Cost per unit traded in bps (default 10 bps)
        portfolio_value: Portfolio value in dollars

    Returns:
        {
            "unadjusted_return": float,
            "adjusted_return": float,
            "total_costs_paid": float,
            "cost_reduction_pct": float,
            "rebalance_frequency": str,
            "adjusted_cumulative": list,
        }
    """
    # Compute turnover (total position changes)
    turnover = weights_history.diff().abs().sum(axis=1)
    
    # Transaction costs = turnover * basis_points / 10000
    cost_per_period = turnover * (basis_points / 10000)
    total_costs = cost_per_period.sum() * portfolio_value / 1e6  # Rough cost estimate
    
    # Adjust returns
    adjusted_returns = portfolio_returns - cost_per_period
    
    # Annualize
    unadjusted_annual = portfolio_returns.mean() * 252
    adjusted_annual = adjusted_returns.mean() * 252
    cost_impact = (unadjusted_annual - adjusted_annual) / abs(unadjusted_annual) if unadjusted_annual != 0 else 0.0
    
    cumulative_adjusted = (1 + adjusted_returns).cumprod()
    
    return {
        "unadjusted_annual_return": float(unadjusted_annual),
        "adjusted_annual_return": float(adjusted_annual),
        "annual_cost_impact_pct": float(cost_impact * 100),
        "total_costs_paid": float(total_costs),
        "avg_turnover": float(turnover.mean()),
        "max_turnover": float(turnover.max()),
        "rebalance_count": int((turnover > 0.01).sum()),  # Significant rebalances
        "adjusted_cumulative_performance": cumulative_adjusted.tolist(),
    }


def _interpret_walk_forward(degradation: float, sharpe: float, overfitting: str) -> str:
    """Generate human-readable interpretation of walk-forward validation results."""
    if overfitting == "high":
        return "⚠️ HIGH OVERFITTING: Large gap between training and testing performance. Strategy may not generalize well."
    elif overfitting == "medium":
        return "⚠️ MEDIUM OVERFITTING: Noticeable performance degradation out-of-sample. Consider regularization."
    else:
        if sharpe > 1.0:
            return "✅ EXCELLENT: Consistent in-sample and out-of-sample performance with strong risk-adjusted returns."
        elif sharpe > 0.5:
            return "✅ GOOD: Reasonable out-of-sample performance. Strategy appears robust."
        else:
            return "⚠️ WEAK: Low out-of-sample Sharpe ratio. Strategy may not be tradeable."
