from __future__ import annotations

import math
from typing import Dict, List, Tuple

import numpy as np


def position_sizing(ticker: str, entry_price: float, stop_price: float, portfolio_value: float, risk_per_trade_pct: float) -> Dict[str, float]:
    if entry_price <= 0 or stop_price <= 0 or portfolio_value <= 0:
        raise ValueError("entry_price, stop_price, and portfolio_value must be positive.")
    if risk_per_trade_pct <= 0 or risk_per_trade_pct > 100:
        raise ValueError("risk_per_trade_pct must be between 0 and 100.")
    risk_amount = portfolio_value * (risk_per_trade_pct / 100.0)
    per_share_risk = entry_price - stop_price
    if per_share_risk <= 0:
        raise ValueError("stop_price must be below entry_price to define risk.")
    shares = math.floor(risk_amount / per_share_risk)
    position_value = shares * entry_price
    risk_pct_portfolio = (shares * per_share_risk) / portfolio_value * 100 if portfolio_value > 0 else 0.0
    return {
        "ticker": ticker.upper(),
        "shares": shares,
        "position_value": round(position_value, 2),
        "risk_amount": round(shares * per_share_risk, 2),
        "risk_pct_of_portfolio": round(risk_pct_portfolio, 2),
    }


def suggest_rebalance(
    tickers: List[str],
    current_weights: List[float],
    target_weights: List[float],
    portfolio_value: float,
    prices: List[float],
) -> Dict[str, List[Dict[str, float]]]:
    if not (len(tickers) == len(current_weights) == len(target_weights) == len(prices)):
        raise ValueError("tickers, current_weights, target_weights, and prices must be the same length.")
    if portfolio_value <= 0:
        raise ValueError("portfolio_value must be positive.")
    if sum(target_weights) == 0:
        raise ValueError("target_weights must sum to a non-zero value.")

    tw = np.array(target_weights, dtype=float)
    cw = np.array(current_weights, dtype=float)
    prices_arr = np.array(prices, dtype=float)
    tw = tw / tw.sum()
    cw = cw / cw.sum() if cw.sum() != 0 else np.full_like(tw, 1.0 / len(tw))

    current_values = cw * portfolio_value
    target_values = tw * portfolio_value
    diffs = target_values - current_values

    trades = []
    total_turnover = 0.0
    for ticker, diff, price in zip(tickers, diffs, prices_arr):
        if price <= 0:
            continue
        action = "buy" if diff > 0 else "sell"
        shares = int(abs(diff) // price) if abs(diff) >= price * 0.1 else 0
        if shares == 0:
            continue
        trade_value = round(shares * price, 2)
        total_turnover += trade_value
        trades.append(
            {
                "ticker": ticker,
                "action": action,
                "shares": shares,
                "value": trade_value,
            }
        )

    estimated_turnover_pct = (total_turnover / portfolio_value) * 100 if portfolio_value > 0 else 0.0
    return {
        "trades": trades,
        "estimated_turnover_pct": round(estimated_turnover_pct, 2),
    }
