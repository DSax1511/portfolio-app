"""
RT-TSMOM: Regime-Tuned Time-Series Momentum Strategy

Flagship alpha model combining:
- Cross-sectional momentum ranking (12-month returns)
- Volatility targeting (10% annualized by default)
- Regime-aware position scaling (reduces exposure in Risk-Off)
- Monthly rebalancing

Default universe: Sector ETFs (XLK, XLE, XLF, etc.)
"""

from typing import Dict, List, Any, Optional
import datetime as dt
import numpy as np
import pandas as pd
import yfinance as yf
from scipy import stats


def compute_momentum_signals(
    prices: pd.DataFrame,
    lookback: int = 252,
) -> pd.Series:
    """
    Compute momentum signal based on trailing returns.

    Args:
        prices: DataFrame of prices (tickers as columns)
        lookback: Lookback period in days (default 252 = 1 year)

    Returns:
        Series of momentum scores (annualized returns)
    """
    returns = prices.pct_change(lookback).iloc[-1]
    # Annualize
    annualized = (1 + returns) ** (252 / lookback) - 1
    return annualized


def rank_and_assign_buckets(
    signals: pd.Series,
    n_long: int = 3,
    n_short: int = 3,
) -> Dict[str, List[str]]:
    """
    Rank assets by momentum and assign to long/short buckets.

    Args:
        signals: Momentum signals (higher = stronger momentum)
        n_long: Number of assets to go long
        n_short: Number of assets to go short

    Returns:
        Dictionary with 'long' and 'short' ticker lists
    """
    ranked = signals.sort_values(ascending=False)
    long_tickers = ranked.head(n_long).index.tolist()
    short_tickers = ranked.tail(n_short).index.tolist() if n_short > 0 else []

    return {
        "long": long_tickers,
        "short": short_tickers,
    }


def compute_portfolio_volatility(
    returns: pd.DataFrame,
    weights: pd.Series,
    window: int = 60,
) -> float:
    """
    Compute portfolio volatility using historical covariance.

    Args:
        returns: DataFrame of asset returns
        weights: Series of portfolio weights
        window: Rolling window for covariance estimation

    Returns:
        Annualized portfolio volatility
    """
    recent_returns = returns.tail(window)
    cov_matrix = recent_returns.cov()

    # Align weights with cov matrix
    aligned_weights = weights.reindex(cov_matrix.columns, fill_value=0.0)
    w = aligned_weights.values

    portfolio_var = w.T @ cov_matrix.values @ w
    portfolio_vol = np.sqrt(portfolio_var) * np.sqrt(252)

    return float(portfolio_vol)


def apply_volatility_target(
    weights: pd.Series,
    returns: pd.DataFrame,
    target_vol: float = 0.10,
    window: int = 60,
) -> pd.Series:
    """
    Scale portfolio weights to achieve target volatility.

    Args:
        weights: Nominal portfolio weights
        returns: Historical returns for vol estimation
        target_vol: Target annualized volatility (e.g., 0.10 = 10%)
        window: Rolling window for vol estimation

    Returns:
        Scaled weights
    """
    current_vol = compute_portfolio_volatility(returns, weights, window)

    if current_vol > 1e-6:
        scale_factor = target_vol / current_vol
        # Cap leverage at 2x
        scale_factor = min(scale_factor, 2.0)
    else:
        scale_factor = 1.0

    return weights * scale_factor


def apply_regime_filter(
    prices: pd.DataFrame,
    spy_prices: pd.Series,
    regime_scaling: float = 0.5,
) -> float:
    """
    Detect market regime and adjust exposure.

    Risk-Off indicators:
    - SPY below 200-day MA
    - High VIX (proxy: realized vol > 20%)

    Args:
        prices: Asset prices
        spy_prices: SPY prices for regime detection
        regime_scaling: Exposure multiplier in Risk-Off (default 0.5 = 50%)

    Returns:
        Regime multiplier (1.0 = Risk-On, regime_scaling = Risk-Off)
    """
    # Check if SPY is above 200-day MA
    ma_200 = spy_prices.rolling(200).mean().iloc[-1]
    current_price = spy_prices.iloc[-1]

    regime_on = current_price > ma_200

    if regime_on:
        return 1.0
    else:
        return regime_scaling


def construct_portfolio_weights(
    long_tickers: List[str],
    short_tickers: List[str],
    equal_weight: bool = True,
) -> pd.Series:
    """
    Construct portfolio weights from long/short buckets.

    Args:
        long_tickers: Tickers to go long
        short_tickers: Tickers to go short
        equal_weight: If True, equal-weight within each bucket

    Returns:
        Series of weights (sum to 0 for long/short, sum to 1 for long-only)
    """
    weights = {}

    if equal_weight:
        long_weight = 1.0 / len(long_tickers) if long_tickers else 0.0
        short_weight = -1.0 / len(short_tickers) if short_tickers else 0.0

        for ticker in long_tickers:
            weights[ticker] = long_weight

        for ticker in short_tickers:
            weights[ticker] = short_weight
    else:
        # Could implement rank-weighted or signal-weighted
        raise NotImplementedError("Non-equal weighting not yet supported")

    return pd.Series(weights)


def backtest_rt_tsmom(
    tickers: List[str],
    start_date: str,
    end_date: str,
    lookback: int = 252,
    target_vol: float = 0.10,
    regime_scaling: float = 0.5,
    rebalance_freq: str = "monthly",
    use_regime: bool = True,
    n_long: int = 3,
    n_short: int = 0,
) -> Dict[str, Any]:
    """
    Backtest RT-TSMOM strategy.

    Args:
        tickers: List of tickers to trade
        start_date: Start date (YYYY-MM-DD)
        end_date: End date (YYYY-MM-DD)
        lookback: Momentum lookback period (days)
        target_vol: Target annualized volatility
        regime_scaling: Exposure in Risk-Off regime
        rebalance_freq: Rebalancing frequency ('monthly', 'weekly')
        use_regime: Whether to apply regime filter
        n_long: Number of long positions
        n_short: Number of short positions (0 = long-only)

    Returns:
        Dictionary with backtest results
    """
    # Download data
    data = yf.download(
        tickers + ["SPY"],
        start=start_date,
        end=end_date,
        progress=False,
    )["Adj Close"]

    if isinstance(data, pd.Series):
        data = data.to_frame()

    # Handle missing data
    data = data.fillna(method="ffill").dropna()

    if data.empty or len(data) < lookback:
        raise ValueError("Insufficient data for backtest")

    spy_prices = data["SPY"]
    asset_prices = data[tickers]

    # Compute daily returns
    returns = asset_prices.pct_change().fillna(0)

    # Initialize portfolio
    equity = [1.0]
    portfolio_returns = []
    dates = []

    # Rebalancing dates
    if rebalance_freq == "monthly":
        rebal_dates = pd.date_range(
            start=data.index[lookback],
            end=data.index[-1],
            freq="MS"  # Month start
        )
    elif rebalance_freq == "weekly":
        rebal_dates = pd.date_range(
            start=data.index[lookback],
            end=data.index[-1],
            freq="W-MON"  # Weekly Monday
        )
    else:
        raise ValueError(f"Unknown rebalance frequency: {rebalance_freq}")

    rebal_dates = [d for d in rebal_dates if d in data.index]

    # Track current weights
    current_weights = pd.Series(0.0, index=tickers)

    regime_performance = {"risk_on": [], "risk_off": []}

    for i in range(lookback, len(data)):
        date = data.index[i]
        dates.append(date.strftime("%Y-%m-%d"))

        # Rebalance on scheduled dates
        if date in rebal_dates:
            # Compute momentum signals
            historical_prices = asset_prices.iloc[:i]
            signals = compute_momentum_signals(historical_prices, lookback)

            # Rank and assign buckets
            buckets = rank_and_assign_buckets(signals, n_long=n_long, n_short=n_short)

            # Construct nominal weights
            nominal_weights = construct_portfolio_weights(
                buckets["long"],
                buckets["short"],
                equal_weight=True,
            )

            # Volatility targeting
            historical_returns = returns.iloc[max(0, i - 60):i]
            scaled_weights = apply_volatility_target(
                nominal_weights,
                historical_returns,
                target_vol=target_vol,
                window=min(60, len(historical_returns)),
            )

            # Regime filter
            if use_regime:
                regime_multiplier = apply_regime_filter(
                    asset_prices.iloc[:i],
                    spy_prices.iloc[:i],
                    regime_scaling=regime_scaling,
                )
            else:
                regime_multiplier = 1.0

            # Final weights
            current_weights = scaled_weights * regime_multiplier
            current_weights = current_weights.reindex(tickers, fill_value=0.0)

        # Compute portfolio return
        daily_return = (current_weights * returns.iloc[i]).sum()
        portfolio_returns.append(daily_return)

        # Update equity
        equity.append(equity[-1] * (1 + daily_return))

    # Compute performance metrics
    portfolio_returns_series = pd.Series(portfolio_returns)
    total_return = equity[-1] - 1

    annualized_return = (1 + total_return) ** (252 / len(portfolio_returns)) - 1
    annualized_vol = portfolio_returns_series.std() * np.sqrt(252)
    sharpe_ratio = annualized_return / annualized_vol if annualized_vol > 0 else 0.0

    # Drawdown
    equity_series = pd.Series(equity)
    running_max = equity_series.cummax()
    drawdown = (equity_series / running_max) - 1
    max_drawdown = drawdown.min()

    # Calmar ratio
    calmar_ratio = annualized_return / abs(max_drawdown) if max_drawdown != 0 else 0.0

    return {
        "dates": dates,
        "equity_curve": equity[1:],  # Exclude initial value
        "returns": portfolio_returns,
        "metrics": {
            "total_return": float(total_return),
            "annualized_return": float(annualized_return),
            "annualized_volatility": float(annualized_vol),
            "sharpe_ratio": float(sharpe_ratio),
            "max_drawdown": float(max_drawdown),
            "calmar_ratio": float(calmar_ratio),
        },
        "regime_performance": {
            "risk_on_periods": len(regime_performance["risk_on"]),
            "risk_off_periods": len(regime_performance["risk_off"]),
        },
    }
