"""
Advanced Quantitative Trading Strategies

This module implements sophisticated quant strategies beyond basic SMA crossovers:
1. Pairs trading with cointegration testing (ADF, Johansen)
2. GARCH(1,1) volatility targeting
3. Walk-forward optimization with out-of-sample validation
4. Dual momentum with lookback optimization
"""

from typing import Dict, List, Optional, Tuple, Any
import numpy as np
import pandas as pd
from statsmodels.tsa.stattools import adfuller, coint
from statsmodels.tsa.vector_ar.vecm import coint_johansen
from arch import arch_model
import warnings

warnings.filterwarnings("ignore")


def pairs_trading_backtest(
    ticker1: str,
    ticker2: str,
    prices: pd.DataFrame,
    lookback: int = 60,
    entry_z: float = 2.0,
    exit_z: float = 0.5,
    stop_loss_z: float = 4.0,
) -> Dict[str, Any]:
    """
    Pairs trading strategy using cointegration and z-score.

    Algorithm:
    1. Test cointegration using ADF on spread
    2. Compute z-score of spread
    3. Enter long spread when z < -entry_z, short when z > entry_z
    4. Exit when z crosses exit_z
    5. Stop loss when |z| > stop_loss_z

    Args:
        ticker1: First ticker symbol
        ticker2: Second ticker symbol
        prices: DataFrame with columns [ticker1, ticker2]
        lookback: Rolling window for spread calculation
        entry_z: Z-score threshold for entry
        exit_z: Z-score threshold for exit
        stop_loss_z: Z-score threshold for stop loss

    Returns:
        Dictionary with backtest results and diagnostics
    """
    if ticker1 not in prices.columns or ticker2 not in prices.columns:
        raise ValueError(f"Tickers {ticker1}, {ticker2} not found in prices")

    p1 = prices[ticker1].dropna()
    p2 = prices[ticker2].dropna()

    # Align series
    common_idx = p1.index.intersection(p2.index)
    p1 = p1.loc[common_idx]
    p2 = p2.loc[common_idx]

    # Test cointegration
    score, pvalue, _ = coint(p1, p2)
    is_cointegrated = pvalue < 0.05

    # Estimate hedge ratio via OLS
    X = p2.values.reshape(-1, 1)
    y = p1.values
    hedge_ratio = np.linalg.lstsq(X, y, rcond=None)[0][0]

    # Compute spread
    spread = p1 - hedge_ratio * p2

    # Rolling z-score
    spread_mean = spread.rolling(lookback).mean()
    spread_std = spread.rolling(lookback).std()
    z_score = (spread - spread_mean) / (spread_std + 1e-8)

    # Generate signals
    positions = pd.Series(0, index=spread.index)
    current_position = 0

    for i in range(lookback, len(z_score)):
        z = z_score.iloc[i]

        if current_position == 0:
            # Entry signals
            if z < -entry_z:
                current_position = 1  # Long spread (buy ticker1, short ticker2)
            elif z > entry_z:
                current_position = -1  # Short spread
        else:
            # Exit signals
            if abs(z) < exit_z or abs(z) > stop_loss_z:
                current_position = 0

        positions.iloc[i] = current_position

    # Compute returns
    spread_returns = spread.pct_change()
    strategy_returns = positions.shift(1) * spread_returns

    # Performance metrics
    cumulative_returns = (1 + strategy_returns.fillna(0)).cumprod()
    total_return = cumulative_returns.iloc[-1] - 1
    sharpe = strategy_returns.mean() / (strategy_returns.std() + 1e-8) * np.sqrt(252)
    max_dd = (cumulative_returns / cumulative_returns.cummax() - 1).min()

    # Trade analysis
    position_changes = positions.diff().fillna(0)
    trades = position_changes[position_changes != 0]
    num_trades = len(trades)

    return {
        "summary": {
            "ticker1": ticker1,
            "ticker2": ticker2,
            "total_return": float(total_return),
            "sharpe_ratio": float(sharpe),
            "max_drawdown": float(max_dd),
            "num_trades": int(num_trades),
            "cointegration_pvalue": float(pvalue),
            "is_cointegrated": bool(is_cointegrated),
            "hedge_ratio": float(hedge_ratio),
        },
        "timeseries": {
            "dates": spread.index.strftime("%Y-%m-%d").tolist(),
            "spread": spread.tolist(),
            "z_score": z_score.fillna(0).tolist(),
            "positions": positions.tolist(),
            "cumulative_returns": cumulative_returns.tolist(),
        },
        "parameters": {
            "lookback": lookback,
            "entry_z": entry_z,
            "exit_z": exit_z,
            "stop_loss_z": stop_loss_z,
        },
    }


def garch_vol_targeting(
    returns: pd.Series,
    target_vol: float = 0.15,
    initial_capital: float = 100000,
) -> Dict[str, Any]:
    """
    Volatility targeting using GARCH(1,1) forecasts.

    Algorithm:
    1. Fit GARCH(1,1) model to historical returns
    2. Forecast next-day volatility
    3. Scale position to achieve target vol: position = target_vol / forecast_vol
    4. Rebalance daily

    Args:
        returns: Daily returns series
        target_vol: Target annualized volatility (e.g., 0.15 = 15%)
        initial_capital: Starting capital

    Returns:
        Dictionary with backtest results and GARCH diagnostics
    """
    returns = returns.dropna()

    if len(returns) < 100:
        raise ValueError("Insufficient data for GARCH estimation (need 100+ observations)")

    # Fit GARCH(1,1)
    model = arch_model(returns * 100, vol="Garch", p=1, q=1, rescale=False)
    res = model.fit(disp="off", show_warning=False)

    # Forecast volatility
    forecasts = res.conditional_volatility / 100  # Convert back from percentage

    # Position sizing: target_vol / forecast_vol
    positions = (target_vol / np.sqrt(252)) / (forecasts + 1e-8)
    positions = positions.clip(0, 3)  # Cap leverage at 3x

    # Strategy returns
    strategy_returns = positions.shift(1) * returns
    cumulative = (1 + strategy_returns.fillna(0)).cumprod() * initial_capital

    # Metrics
    total_return = cumulative.iloc[-1] / initial_capital - 1
    realized_vol = strategy_returns.std() * np.sqrt(252)
    sharpe = strategy_returns.mean() / (strategy_returns.std() + 1e-8) * np.sqrt(252)
    max_dd = (cumulative / cumulative.cummax() - 1).min()

    return {
        "summary": {
            "total_return": float(total_return),
            "target_vol": float(target_vol),
            "realized_vol": float(realized_vol),
            "sharpe_ratio": float(sharpe),
            "max_drawdown": float(max_dd),
            "avg_leverage": float(positions.mean()),
            "max_leverage": float(positions.max()),
        },
        "timeseries": {
            "dates": returns.index.strftime("%Y-%m-%d").tolist(),
            "forecast_vol": (forecasts * np.sqrt(252)).tolist(),
            "positions": positions.tolist(),
            "cumulative_equity": cumulative.tolist(),
        },
        "garch_params": {
            "omega": float(res.params["omega"]),
            "alpha": float(res.params["alpha[1]"]),
            "beta": float(res.params["beta[1]"]),
            "aic": float(res.aic),
            "bic": float(res.bic),
        },
    }


def walk_forward_optimization(
    returns: pd.DataFrame,
    lookback_months: int = 12,
    reopt_months: int = 3,
    method: str = "sharpe",
) -> Dict[str, Any]:
    """
    Walk-forward optimization for portfolio construction.

    Algorithm:
    1. Divide history into training/testing windows
    2. Optimize on training window (maximize Sharpe)
    3. Apply weights to testing window (out-of-sample)
    4. Roll forward and repeat

    Args:
        returns: DataFrame of asset returns (assets as columns)
        lookback_months: Training window length in months
        reopt_months: Testing window length (reoptimization frequency)
        method: Optimization objective ("sharpe", "min_vol", "equal")

    Returns:
        Dictionary with walk-forward results and diagnostics
    """
    from ..optimizers_v2 import min_variance_weights

    dates = returns.index
    n_assets = returns.shape[1]

    # Convert months to approximate trading days
    lookback_days = lookback_months * 21
    reopt_days = reopt_months * 21

    # Storage for out-of-sample results
    oos_returns = []
    oos_dates = []
    weight_history = []

    start_idx = lookback_days

    while start_idx + reopt_days < len(returns):
        # Training window
        train_returns = returns.iloc[start_idx - lookback_days:start_idx]

        # Optimize on training data
        if method == "equal":
            weights = np.array([1.0 / n_assets] * n_assets)
        elif method == "min_vol":
            cov = train_returns.cov() * 252
            weights = min_variance_weights(cov, use_shrinkage=True)
        elif method == "sharpe":
            # Max Sharpe: inverse volatility as proxy
            vols = train_returns.std() * np.sqrt(252)
            weights = (1 / (vols + 1e-8))
            weights = weights / weights.sum()
        else:
            weights = np.array([1.0 / n_assets] * n_assets)

        # Testing window (out-of-sample)
        test_returns = returns.iloc[start_idx:start_idx + reopt_days]
        portfolio_returns = (test_returns * weights).sum(axis=1)

        oos_returns.extend(portfolio_returns.tolist())
        oos_dates.extend(test_returns.index.tolist())
        weight_history.append({
            "date": dates[start_idx].strftime("%Y-%m-%d"),
            "weights": weights.tolist(),
        })

        # Roll forward
        start_idx += reopt_days

    # Convert to series
    oos_returns_series = pd.Series(oos_returns, index=oos_dates)
    cumulative = (1 + oos_returns_series).cumprod()

    # Metrics
    total_return = cumulative.iloc[-1] - 1
    vol = oos_returns_series.std() * np.sqrt(252)
    sharpe = oos_returns_series.mean() / (oos_returns_series.std() + 1e-8) * np.sqrt(252)
    max_dd = (cumulative / cumulative.cummax() - 1).min()

    # In-sample comparison (use last training window)
    last_train = returns.iloc[-lookback_days:]
    is_returns = (last_train * weights).sum(axis=1)
    is_sharpe = is_returns.mean() / (is_returns.std() + 1e-8) * np.sqrt(252)

    return {
        "summary": {
            "total_return": float(total_return),
            "volatility": float(vol),
            "sharpe_ratio": float(sharpe),
            "max_drawdown": float(max_dd),
            "in_sample_sharpe": float(is_sharpe),
            "num_rebalances": len(weight_history),
        },
        "timeseries": {
            "dates": [d.strftime("%Y-%m-%d") for d in oos_dates],
            "cumulative_returns": cumulative.tolist(),
            "oos_returns": oos_returns,
        },
        "weight_history": weight_history,
        "parameters": {
            "lookback_months": lookback_months,
            "reopt_months": reopt_months,
            "method": method,
        },
    }


def momentum_strategy(
    returns: pd.DataFrame,
    lookback: int = 126,  # ~6 months
    holding_period: int = 21,  # ~1 month
    top_n: int = 3,
) -> Dict[str, Any]:
    """
    Dual momentum strategy: rank assets by past returns, hold top N.

    Algorithm:
    1. Compute cumulative returns over lookback period
    2. Rank assets by momentum
    3. Allocate equal weight to top N assets
    4. Rebalance every holding_period days

    Args:
        returns: DataFrame of asset returns
        lookback: Lookback period for momentum calculation (days)
        holding_period: Rebalancing frequency (days)
        top_n: Number of top assets to hold

    Returns:
        Dictionary with backtest results
    """
    cumulative = (1 + returns).cumprod()
    n_assets = returns.shape[1]

    # Storage
    strategy_returns = []
    dates = []

    for i in range(lookback, len(returns), holding_period):
        # Compute momentum
        momentum = cumulative.iloc[i] / cumulative.iloc[i - lookback] - 1

        # Select top N
        top_assets = momentum.nlargest(top_n).index
        weights = pd.Series(0.0, index=returns.columns)
        weights[top_assets] = 1.0 / top_n

        # Hold for holding_period
        period_returns = returns.iloc[i:i + holding_period]
        portfolio_returns = (period_returns * weights).sum(axis=1)

        strategy_returns.extend(portfolio_returns.tolist())
        dates.extend(period_returns.index.tolist())

    # Metrics
    strategy_series = pd.Series(strategy_returns, index=dates)
    cumulative_eq = (1 + strategy_series).cumprod()

    total_return = cumulative_eq.iloc[-1] - 1
    vol = strategy_series.std() * np.sqrt(252)
    sharpe = strategy_series.mean() / (strategy_series.std() + 1e-8) * np.sqrt(252)
    max_dd = (cumulative_eq / cumulative_eq.cummax() - 1).min()

    # Benchmark: equal weight buy-and-hold
    benchmark_returns = returns.mean(axis=1)
    benchmark_cum = (1 + benchmark_returns).cumprod()
    benchmark_sharpe = benchmark_returns.mean() / (benchmark_returns.std() + 1e-8) * np.sqrt(252)

    return {
        "summary": {
            "total_return": float(total_return),
            "volatility": float(vol),
            "sharpe_ratio": float(sharpe),
            "max_drawdown": float(max_dd),
            "benchmark_sharpe": float(benchmark_sharpe),
        },
        "timeseries": {
            "dates": [d.strftime("%Y-%m-%d") for d in dates],
            "cumulative_returns": cumulative_eq.tolist(),
            "benchmark": benchmark_cum.reindex(dates, method="ffill").tolist(),
        },
        "parameters": {
            "lookback": lookback,
            "holding_period": holding_period,
            "top_n": top_n,
        },
    }
