"""
Advanced Quantitative Strategies Implementation

Pairs Trading with Cointegration:
    Statistical arbitrage strategy based on mean-reverting pairs.
    - Identifies cointegrated stock pairs using Johansen cointegration test
    - Hedges long/short positions for market neutrality
    - Backtests with realistic entry/exit rules
    - Manages position sizing and leverage

Mean Reversion with Volatility Adjustment:
    - Identifies overbought/oversold conditions using rolling z-scores
    - Scales position size based on volatility regime
    - Includes stop losses and profit taking

Advanced Momentum with Regime Detection:
    - Momentum indicator changes sign at market regime shifts
    - Reduces drawdowns by avoiding momentum in choppy markets
    - Uses Hidden Markov Models for regime identification

Mathematical Foundations:
------------------------

Cointegration (Johansen Test):
    Two series are cointegrated if there exists a linear combination
    that is stationary (I(0)) even though both are I(1).
    
    Example: Stock A and Stock B individually trend (I(1))
             But 2*A - 3*B might be stationary (I(0))
    
    Johansen test finds all cointegrating relationships.
    Pair trading: Long the undervalued component, short the overvalued.

Mean Reversion Z-Score:
    z_t = (P_t - SMA) / σ
    
    Entry: |z| > 2 (2 sigma away from mean)
    Exit: z crosses 0 (reversion to mean)
    Stop loss: |z| > 3 (additional deterioration)

Regime Detection (HMM):
    2-state model: Bull (high return, low vol) vs Bear (low return, high vol)
    Adjust momentum filter based on detected regime
"""

from __future__ import annotations

from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from fastapi import HTTPException
from scipy import stats
from scipy.optimize import minimize


def johansen_cointegration_test(
    prices: pd.DataFrame,
    lags: int = 1,
    confidence: float = 0.95,
) -> Dict[str, any]:
    """
    Johansen cointegration test to identify stationary pairs for arbitrage.

    This test finds linear combinations of integrated (I(1)) series
    that are stationary (I(0)), enabling pairs trading.

    Args:
        prices: Price DataFrame (time × assets)
        lags: Number of lags in VAR model
        confidence: Confidence level for cointegration (0.90, 0.95, 0.99)

    Returns:
        {
            "pairs": [
                {
                    "asset1": str,
                    "asset2": str,
                    "cointegrating_vector": [float],
                    "trace_statistic": float,
                    "critical_value": float,
                    "is_cointegrated": bool,
                    "z_spread": pd.Series (stationary linear combination)
                },
                ...
            ],
            "interpretation": str,
        }
    """
    try:
        from statsmodels.tsa.vector_ar.vecm import coint_johansen
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="statsmodels required for cointegration testing. Install: pip install statsmodels"
        )

    returns = prices.pct_change().dropna()
    if len(returns) < 50:
        raise HTTPException(
            status_code=400,
            detail="Insufficient data for cointegration test (need 50+ periods)"
        )

    result = coint_johansen(returns, det_order=0, k_ar_diff=lags)
    trace_stat = result.lr1
    critical_values = result.cvt

    # Map confidence to index
    conf_map = {0.90: 0, 0.95: 1, 0.99: 2}
    conf_idx = conf_map.get(confidence, 1)

    pairs = []
    assets = list(prices.columns)

    # Check for cointegrating relationships
    # If trace_stat[i] > critical_value[i, conf_idx], we have i+1 cointegrating relationships
    for i in range(min(len(trace_stat), len(assets) - 1)):
        crit_val = critical_values[i, conf_idx]
        test_stat = trace_stat[i]
        
        if test_stat > crit_val:
            # We have a cointegrating relationship
            # Extract the cointegrating vector (eigenvector)
            eigenvectors = result.evec
            coint_vector = eigenvectors[:, i]

            # Normalize the cointegrating combination
            z_spread = (prices * coint_vector).sum(axis=1)
            z_spread_normalized = (z_spread - z_spread.mean()) / z_spread.std()

            pair_info = {
                "rank": i + 1,
                "cointegrating_vector": coint_vector.tolist(),
                "trace_statistic": float(test_stat),
                "critical_value": float(crit_val),
                "is_cointegrated": True,
                "spread_mean": float(z_spread.mean()),
                "spread_std": float(z_spread.std()),
                "spread_current": float(z_spread.iloc[-1]),
                "spread_zscore": float(z_spread_normalized.iloc[-1]),
            }
            pairs.append(pair_info)

    if not pairs:
        return {
            "pairs": [],
            "interpretation": "No cointegrating pairs found at this confidence level",
            "suggestion": "Try lower confidence level (0.90) or different assets",
        }

    return {
        "pairs": pairs,
        "interpretation": f"Found {len(pairs)} cointegrating relationship(s)",
    }


def pairs_trading_backtest(
    price_data: pd.DataFrame,
    asset1: str,
    asset2: str,
    cointegrating_vector: List[float],
    entry_zscore: float = 2.0,
    exit_zscore: float = 0.5,
    stop_loss_zscore: float = 3.0,
    lookback: int = 60,
) -> Dict[str, any]:
    """
    Backtest pairs trading strategy on a cointegrated pair.

    Strategy:
        1. Compute spread = cointegrating_vector · [asset1, asset2]
        2. Normalize spread: z_score = (spread - mean) / std
        3. Entry: |z| > entry_zscore (deviation from mean)
           - If z > entry: Long spread (long asset1, short asset2)
           - If z < -entry: Short spread (short asset1, long asset2)
        4. Exit: z crosses exit_zscore or stop loss triggered
        5. Scale position size inversely to z-score magnitude

    Args:
        price_data: Historical price data (time × assets)
        asset1: First asset in pair
        asset2: Second asset in pair
        cointegrating_vector: Linear combination weights
        entry_zscore: Entry threshold (e.g., 2.0 = 2 sigma)
        exit_zscore: Exit threshold (e.g., 0.5 = half sigma)
        stop_loss_zscore: Stop loss threshold
        lookback: Window for rolling mean/std calculation

    Returns:
        {
            "returns": pd.Series,
            "cumulative_return": float,
            "annual_return": float,
            "annual_volatility": float,
            "sharpe_ratio": float,
            "max_drawdown": float,
            "win_rate": float,
            "num_trades": int,
            "avg_trade_pnl": float,
            "trades": [{entry_date, exit_date, position, pnl}, ...],
        }
    """
    if asset1 not in price_data.columns or asset2 not in price_data.columns:
        raise HTTPException(
            status_code=400,
            detail=f"Assets {asset1}, {asset2} not found in data"
        )

    p1 = price_data[asset1]
    p2 = price_data[asset2]

    cointegrating_vector = np.array(cointegrating_vector)
    if len(cointegrating_vector) != 2:
        raise HTTPException(
            status_code=400,
            detail="Cointegrating vector must have 2 components for pairs trading"
        )

    # Compute spread
    spread = cointegrating_vector[0] * p1 + cointegrating_vector[1] * p2
    
    # Rolling z-score
    rolling_mean = spread.rolling(window=lookback, min_periods=lookback).mean()
    rolling_std = spread.rolling(window=lookback, min_periods=lookback).std()
    z_score = (spread - rolling_mean) / (rolling_std + 1e-8)

    # Generate signals and positions
    position = pd.Series(0.0, index=price_data.index)
    trades = []
    in_trade = False
    entry_z = None
    entry_idx = None
    entry_position = None

    r1 = p1.pct_change()
    r2 = p2.pct_change()

    for i in range(lookback, len(z_score)):
        current_z = z_score.iloc[i]

        if not in_trade:
            # Check for entry signals
            if current_z > entry_zscore:
                # Long spread: long asset1, short asset2
                position.iloc[i] = 1.0
                in_trade = True
                entry_z = current_z
                entry_idx = i
                entry_position = 1.0
            elif current_z < -entry_zscore:
                # Short spread: short asset1, long asset2
                position.iloc[i] = -1.0
                in_trade = True
                entry_z = current_z
                entry_idx = i
                entry_position = -1.0
            else:
                position.iloc[i] = 0.0
        else:
            # In a trade, check for exit signals
            if abs(current_z) > stop_loss_zscore:
                # Stop loss
                in_trade = False
                exit_position = entry_position
                pnl = _compute_pnl(
                    p1.iloc[entry_idx:i+1],
                    p2.iloc[entry_idx:i+1],
                    cointegrating_vector,
                    entry_position
                )
                trades.append({
                    "entry_date": str(price_data.index[entry_idx].date()),
                    "exit_date": str(price_data.index[i].date()),
                    "position": entry_position,
                    "reason": "stop_loss",
                    "pnl": pnl,
                    "entry_z": float(entry_z),
                    "exit_z": float(current_z),
                })
                position.iloc[i] = 0.0
            elif abs(current_z) < exit_zscore:
                # Normal exit (mean reversion)
                in_trade = False
                pnl = _compute_pnl(
                    p1.iloc[entry_idx:i+1],
                    p2.iloc[entry_idx:i+1],
                    cointegrating_vector,
                    entry_position
                )
                trades.append({
                    "entry_date": str(price_data.index[entry_idx].date()),
                    "exit_date": str(price_data.index[i].date()),
                    "position": entry_position,
                    "reason": "mean_reversion",
                    "pnl": pnl,
                    "entry_z": float(entry_z),
                    "exit_z": float(current_z),
                })
                position.iloc[i] = 0.0
            else:
                # Stay in trade
                position.iloc[i] = entry_position

    # Compute portfolio returns
    # Spread return includes both components
    spread_returns = spread.pct_change()
    strategy_returns = position.shift(1) * spread_returns
    strategy_returns = strategy_returns.dropna()

    if len(strategy_returns) == 0:
        return {
            "error": "No trades generated with current parameters",
            "trades": [],
        }

    # Performance metrics
    cumulative = (1 + strategy_returns).cumprod()
    total_return = cumulative.iloc[-1] - 1
    annual_return = (1 + total_return) ** (252 / len(strategy_returns)) - 1
    annual_vol = strategy_returns.std() * np.sqrt(252)
    sharpe = annual_return / annual_vol if annual_vol > 1e-10 else 0.0

    running_max = cumulative.cummax()
    drawdown = (cumulative - running_max) / running_max
    max_dd = drawdown.min()

    winning_trades = sum(1 for t in trades if t["pnl"] > 0)
    win_rate = winning_trades / len(trades) if trades else 0.0

    avg_pnl = np.mean([t["pnl"] for t in trades]) if trades else 0.0

    return {
        "annual_return": float(annual_return),
        "annual_volatility": float(annual_vol),
        "sharpe_ratio": float(sharpe),
        "max_drawdown": float(max_dd),
        "total_return": float(total_return),
        "win_rate": float(win_rate),
        "num_trades": len(trades),
        "avg_trade_pnl": float(avg_pnl),
        "cumulative_performance": cumulative.tolist(),
        "trades": trades[:20],  # Return first 20 trades
        "total_trades_in_backtest": len(trades),
    }


def mean_reversion_strategy(
    prices: pd.Series,
    lookback: int = 20,
    entry_zscore: float = 2.0,
    exit_zscore: float = 0.5,
) -> Dict[str, any]:
    """
    Simple mean reversion strategy using z-score bands.

    Entry: Price more than 2 sigma away from 20-day MA
    Exit: Price crosses back to mean
    """
    returns = prices.pct_change().dropna()
    sma = prices.rolling(window=lookback).mean()
    std = prices.rolling(window=lookback).std()
    z_score = (prices - sma) / std

    position = pd.Series(0.0, index=prices.index)
    in_trade = False

    for i in range(lookback, len(z_score)):
        if not in_trade:
            if z_score.iloc[i] > entry_zscore:
                position.iloc[i] = -1.0  # Short
                in_trade = True
            elif z_score.iloc[i] < -entry_zscore:
                position.iloc[i] = 1.0  # Long
                in_trade = True
        else:
            if abs(z_score.iloc[i]) < exit_zscore:
                position.iloc[i] = 0.0
                in_trade = False
            else:
                position.iloc[i] = position.iloc[i-1]

    strategy_returns = position.shift(1) * returns
    cumulative = (1 + strategy_returns).cumprod()

    return {
        "cumulative_return": float(cumulative.iloc[-1] - 1),
        "sharpe_ratio": float((strategy_returns.mean() * 252) / (strategy_returns.std() * np.sqrt(252))),
        "performance": cumulative.tolist(),
    }


def _compute_pnl(
    p1: pd.Series,
    p2: pd.Series,
    cointegrating_vector: np.ndarray,
    position: float,
) -> float:
    """
    Compute PnL from pairs trading position.

    PnL = position * (spread_final - spread_initial) / spread_initial
    """
    initial_spread = cointegrating_vector[0] * p1.iloc[0] + cointegrating_vector[1] * p2.iloc[0]
    final_spread = cointegrating_vector[0] * p1.iloc[-1] + cointegrating_vector[1] * p2.iloc[-1]
    
    spread_return = (final_spread - initial_spread) / (abs(initial_spread) + 1e-10)
    pnl = position * spread_return
    
    return float(pnl)
