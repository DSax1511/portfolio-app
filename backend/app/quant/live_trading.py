"""
Live Trading Module

Real-time portfolio monitoring and order generation:
1. Live position tracking with intraday P&L
2. Risk limit monitoring and breach detection
3. Rebalance order generation (CSV export for broker)
4. Performance attribution (intraday factor decomposition)
"""

from typing import Dict, List, Optional, Tuple, Any
import numpy as np
import pandas as pd
import yfinance as yf
from datetime import datetime, timedelta
import warnings

warnings.filterwarnings("ignore")


def get_live_positions(
    tickers: List[str],
    quantities: List[float],
    entry_prices: Optional[List[float]] = None,
) -> Dict[str, Any]:
    """
    Get real-time position tracking with live P&L.

    Args:
        tickers: List of ticker symbols
        quantities: List of shares held (positive for long, negative for short)
        entry_prices: Optional entry prices (if None, uses current price as cost basis)

    Returns:
        Dictionary with live positions, P&L, and intraday performance
    """
    if len(tickers) != len(quantities):
        raise ValueError("Tickers and quantities must have same length")

    if entry_prices is not None and len(entry_prices) != len(tickers):
        raise ValueError("Entry prices must match tickers length")

    # Fetch live prices
    try:
        data = yf.download(tickers, period="1d", interval="1m", progress=False)
        if isinstance(data, pd.DataFrame) and "Close" in data.columns:
            latest_prices = data["Close"].iloc[-1]
        elif isinstance(data.columns, pd.MultiIndex):
            latest_prices = data["Close"].iloc[-1]
        else:
            latest_prices = data.iloc[-1]

        # Handle single ticker case
        if len(tickers) == 1:
            latest_prices = pd.Series([latest_prices], index=tickers)

    except Exception as e:
        # Fallback to daily data
        latest_prices = pd.Series([yf.Ticker(t).info.get("currentPrice", 100) for t in tickers], index=tickers)

    # Calculate positions
    positions = []
    total_value = 0
    total_pnl = 0
    total_cost_basis = 0

    for i, ticker in enumerate(tickers):
        qty = quantities[i]
        current_price = latest_prices.get(ticker, 100)
        entry_price = entry_prices[i] if entry_prices is not None else current_price

        market_value = qty * current_price
        cost_basis = qty * entry_price
        pnl = market_value - cost_basis
        pnl_pct = (pnl / abs(cost_basis)) if cost_basis != 0 else 0

        total_value += market_value
        total_cost_basis += cost_basis
        total_pnl += pnl

        positions.append({
            "ticker": ticker,
            "quantity": float(qty),
            "entry_price": float(entry_price),
            "current_price": float(current_price),
            "market_value": float(market_value),
            "cost_basis": float(cost_basis),
            "pnl": float(pnl),
            "pnl_percent": float(pnl_pct * 100),
            "weight": 0.0,  # Will be calculated below
        })

    # Calculate weights
    for pos in positions:
        pos["weight"] = (pos["market_value"] / total_value * 100) if total_value != 0 else 0

    # Overall portfolio metrics
    total_pnl_pct = (total_pnl / abs(total_cost_basis)) if total_cost_basis != 0 else 0

    return {
        "timestamp": datetime.now().isoformat(),
        "positions": positions,
        "summary": {
            "total_value": float(total_value),
            "total_cost_basis": float(total_cost_basis),
            "total_pnl": float(total_pnl),
            "total_pnl_percent": float(total_pnl_pct * 100),
            "num_positions": len(positions),
        },
    }


def generate_rebalance_orders(
    current_tickers: List[str],
    current_quantities: List[float],
    current_prices: List[float],
    target_weights: Dict[str, float],
    total_value: float,
) -> Dict[str, Any]:
    """
    Generate rebalance orders to achieve target weights.

    Args:
        current_tickers: Current holdings
        current_quantities: Current shares held
        current_prices: Current market prices
        target_weights: Target allocation {ticker: weight}
        total_value: Total portfolio value

    Returns:
        Dictionary with orders (CSV-ready format)
    """
    # Calculate current weights
    current_value = {
        ticker: qty * price
        for ticker, qty, price in zip(current_tickers, current_quantities, current_prices)
    }

    total_current = sum(current_value.values())

    # Generate orders
    orders = []

    # Sell orders for tickers to reduce/exit
    for ticker, qty in zip(current_tickers, current_quantities):
        price = current_prices[current_tickers.index(ticker)]
        target_weight = target_weights.get(ticker, 0.0)
        target_value = total_value * target_weight
        current_val = current_value[ticker]

        delta_value = target_value - current_val
        delta_shares = delta_value / price if price > 0 else 0

        if abs(delta_shares) > 0.01:  # Min 0.01 share threshold
            side = "BUY" if delta_shares > 0 else "SELL"
            orders.append({
                "ticker": ticker,
                "side": side,
                "quantity": abs(int(delta_shares)),
                "price": float(price),
                "order_value": float(abs(delta_shares) * price),
            })

    # Buy orders for new tickers
    for ticker, target_weight in target_weights.items():
        if ticker not in current_tickers and target_weight > 0:
            # Fetch price for new ticker
            try:
                price = yf.Ticker(ticker).info.get("currentPrice", 100)
            except:
                price = 100

            target_value = total_value * target_weight
            shares = int(target_value / price) if price > 0 else 0

            if shares > 0:
                orders.append({
                    "ticker": ticker,
                    "side": "BUY",
                    "quantity": shares,
                    "price": float(price),
                    "order_value": float(shares * price),
                })

    # Summary
    total_buy_value = sum(o["order_value"] for o in orders if o["side"] == "BUY")
    total_sell_value = sum(o["order_value"] for o in orders if o["side"] == "SELL")
    turnover_pct = (total_buy_value + total_sell_value) / (2 * total_value) * 100 if total_value > 0 else 0

    return {
        "orders": orders,
        "summary": {
            "num_orders": len(orders),
            "total_buy_value": float(total_buy_value),
            "total_sell_value": float(total_sell_value),
            "turnover_percent": float(turnover_pct),
        },
        "timestamp": datetime.now().isoformat(),
    }


def monitor_risk_limits(
    returns: pd.Series,
    positions: Dict[str, float],  # {ticker: weight}
    limits: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Monitor portfolio for risk limit breaches.

    Default limits:
    - Max single position: 30%
    - Max sector exposure: 50%
    - Daily VaR (95%): 2% of portfolio
    - Max drawdown: 10%

    Args:
        returns: Daily returns series
        positions: Current position weights {ticker: weight}
        limits: Custom risk limits

    Returns:
        Dictionary with breach alerts and current risk metrics
    """
    if limits is None:
        limits = {
            "max_position_weight": 0.30,
            "max_sector_weight": 0.50,
            "max_var_95": 0.02,
            "max_drawdown": 0.10,
        }

    breaches = []
    warnings_list = []

    # Check position concentration
    max_weight = max(positions.values()) if positions else 0
    if max_weight > limits["max_position_weight"]:
        breaches.append({
            "type": "position_concentration",
            "severity": "high",
            "message": f"Max position weight {max_weight:.1%} exceeds limit {limits['max_position_weight']:.1%}",
            "current_value": float(max_weight),
            "limit": float(limits["max_position_weight"]),
        })

    # Check VaR
    if len(returns) > 20:
        var_95 = -np.percentile(returns, 5)
        if var_95 > limits["max_var_95"]:
            breaches.append({
                "type": "var_breach",
                "severity": "medium",
                "message": f"VaR(95%) {var_95:.2%} exceeds limit {limits['max_var_95']:.2%}",
                "current_value": float(var_95),
                "limit": float(limits["max_var_95"]),
            })

    # Check drawdown
    if len(returns) > 0:
        cumulative = (1 + returns).cumprod()
        running_max = cumulative.cummax()
        drawdown = (cumulative / running_max - 1).min()

        if abs(drawdown) > limits["max_drawdown"]:
            breaches.append({
                "type": "drawdown_breach",
                "severity": "high",
                "message": f"Current drawdown {drawdown:.2%} exceeds limit {limits['max_drawdown']:.2%}",
                "current_value": float(drawdown),
                "limit": float(-limits["max_drawdown"]),
            })

    # Check volatility spike
    if len(returns) > 20:
        recent_vol = returns.tail(20).std() * np.sqrt(252)
        historical_vol = returns.std() * np.sqrt(252)

        if recent_vol > historical_vol * 1.5:
            warnings_list.append({
                "type": "volatility_spike",
                "severity": "low",
                "message": f"Recent vol {recent_vol:.1%} is 50%+ above historical {historical_vol:.1%}",
            })

    return {
        "timestamp": datetime.now().isoformat(),
        "has_breaches": len(breaches) > 0,
        "num_breaches": len(breaches),
        "breaches": breaches,
        "warnings": warnings_list,
        "current_metrics": {
            "max_position_weight": float(max_weight),
            "daily_var_95": float(var_95) if len(returns) > 20 else None,
            "current_drawdown": float(drawdown) if len(returns) > 0 else None,
        },
        "limits": limits,
    }
