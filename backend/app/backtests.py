from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from fastapi import HTTPException

from .analytics import compute_portfolio_returns
from .infra.utils import IndicatorSpec, StrategyRule, normalize_weights, weighted_portfolio_price


def compute_indicator(series: pd.Series, spec: IndicatorSpec) -> pd.Series:
    indicator = spec.indicator.lower()
    if indicator == "price":
        return series
    if indicator == "sma":
        if not spec.window:
            raise HTTPException(status_code=400, detail="SMA window required.")
        return series.rolling(spec.window, min_periods=spec.window).mean()
    if indicator == "ema":
        if not spec.window:
            raise HTTPException(status_code=400, detail="EMA window required.")
        return series.ewm(span=spec.window, adjust=False).mean()
    if indicator == "rsi":
        window = spec.window or 14
        delta = series.diff()
        gain = delta.clip(lower=0).rolling(window, min_periods=window).mean()
        loss = -delta.clip(upper=0).rolling(window, min_periods=window).mean()
        rs = gain / loss.replace(0, np.nan)
        return 100 - (100 / (1 + rs))
    if indicator == "macd":
        fast = spec.window or 12
        slow = spec.window_slow or 26
        signal = spec.parameter or 9
        ema_fast = series.ewm(span=fast, adjust=False).mean()
        ema_slow = series.ewm(span=slow, adjust=False).mean()
        macd_line = ema_fast - ema_slow
        signal_line = macd_line.ewm(span=signal, adjust=False).mean()
        return macd_line - signal_line
    if indicator == "bollinger":
        window = spec.window or 20
        std_mult = spec.std_mult or 2
        ma = series.rolling(window, min_periods=window).mean()
        std = series.rolling(window, min_periods=window).std()
        upper = ma + std_mult * std
        lower = ma - std_mult * std
        return pd.DataFrame({"upper": upper, "lower": lower})
    if indicator == "roc":
        window = spec.window or 20
        return series.pct_change(periods=window)
    if indicator == "vol":
        window = spec.window or 20
        return series.pct_change().rolling(window, min_periods=window).std() * np.sqrt(252)
    raise HTTPException(status_code=400, detail=f"Unsupported indicator: {spec.indicator}")


def evaluate_strategy_rules(price: pd.Series, rules: List[StrategyRule], stop_loss: Optional[float], take_profit: Optional[float]) -> pd.Series:
    position = pd.Series(0.0, index=price.index)
    entry_price = None
    computed: Dict[str, pd.Series] = {}

    def get_series(spec: IndicatorSpec) -> pd.Series:
        key = str(spec.dict())
        if key in computed:
            return computed[key]
        series = compute_indicator(price, spec)
        if isinstance(series, pd.DataFrame):
            computed[key] = series["upper"]
            return series["upper"]
        computed[key] = series
        return series

    for i, dt in enumerate(price.index):
        for rule in rules:
            left = get_series(rule.left)
            right_series = get_series(rule.right) if rule.right else None
            val = rule.value
            if left.isna().iloc[i]:
                continue
            condition = False
            if rule.operator == ">":
                comparator = right_series.iloc[i] if right_series is not None else val
                condition = comparator is not None and left.iloc[i] > comparator
            elif rule.operator == "<":
                comparator = right_series.iloc[i] if right_series is not None else val
                condition = comparator is not None and left.iloc[i] < comparator
            elif rule.operator == "cross_over":
                if i == 0:
                    condition = False
                else:
                    comp_series = right_series if right_series is not None else pd.Series([val] * len(price), index=price.index)
                    prev_left = left.iloc[i - 1]
                    prev_right = comp_series.iloc[i - 1]
                    condition = prev_left <= prev_right and left.iloc[i] > comp_series.iloc[i]
            if condition:
                position.iloc[i] = 1.0 if rule.action == "long" else 0.0

        if i > 0 and position.iloc[i] == 0 and position.iloc[i - 1] == 1:
            entry_price = price.iloc[i]
        if position.iloc[i] == 0 and i > 0:
            position.iloc[i] = position.iloc[i - 1]

        if position.iloc[i] == 1:
            if entry_price is None:
                entry_price = price.iloc[i]
            change = (price.iloc[i] - entry_price) / entry_price
            if stop_loss is not None and change <= -abs(stop_loss):
                position.iloc[i] = 0
                entry_price = None
            elif take_profit is not None and change >= abs(take_profit):
                position.iloc[i] = 0
                entry_price = None

    return position


def apply_rebalance(returns: pd.DataFrame, weights: List[float], frequency: Optional[str], cost_bps: float = 0.0) -> Tuple[pd.Series, pd.Series]:
    """Apply periodic rebalancing to returns; frequency in {monthly, quarterly, annual}. Returns returns and turnover."""
    if not frequency or frequency == "none":
        base = returns.dot(pd.Series(weights, index=returns.columns))
        return base, pd.Series(0.0, index=base.index)

    freq_map = {"monthly": "M", "quarterly": "Q", "annual": "A"}
    if frequency not in freq_map:
        raise HTTPException(status_code=400, detail="Invalid rebalance_frequency. Use monthly, quarterly, annual, or none.")

    target_weights = pd.Series(weights, index=returns.columns)
    port_returns = []
    turnover_series = []
    current_weights = target_weights.copy()
    rebalance_dates = set(returns.resample(freq_map[frequency]).asfreq().index)

    for date, daily in returns.iterrows():
        if date in rebalance_dates and returns.index.get_loc(date) != 0:
            turnover = (current_weights - target_weights).abs().sum()
            cost = (cost_bps / 10000) * turnover
            turnover_series.append(float(turnover))
            port_returns.append(float(-cost))
            current_weights = target_weights.copy()
        else:
            turnover_series.append(0.0)

        port_returns.append(float(daily.dot(current_weights)))
        gross = (1 + daily) * current_weights
        total = gross.sum()
        if total != 0:
            current_weights = gross / total

    return pd.Series(port_returns, index=returns.index), pd.Series(turnover_series, index=returns.index)


def run_buy_and_hold(prices: pd.DataFrame, weights: List[float], rebalance_frequency: Optional[str], cost_bps: float) -> Tuple[pd.Series, pd.Series]:
    base_returns = prices.pct_change().dropna()
    return apply_rebalance(base_returns, weights, rebalance_frequency, cost_bps)


def run_sma_crossover(prices: pd.DataFrame, weights: List[float], fast_window: int, slow_window: int) -> pd.Series:
    if fast_window <= 0 or slow_window <= 0:
        raise HTTPException(status_code=400, detail="fast_window and slow_window must be positive integers.")
    if fast_window >= slow_window:
        raise HTTPException(status_code=400, detail="fast_window should be smaller than slow_window for a crossover.")

    returns = prices.pct_change().dropna()
    fast_ma = prices.rolling(window=fast_window, min_periods=fast_window).mean()
    slow_ma = prices.rolling(window=slow_window, min_periods=slow_window).mean()
    signals = (fast_ma > slow_ma).astype(float)

    weight_series = pd.Series(normalize_weights(list(prices.columns), weights), index=prices.columns)
    positioned_weights = signals.multiply(weight_series, axis=1).shift(1).fillna(0.0)
    strategy_returns = (positioned_weights * returns).sum(axis=1)
    return strategy_returns.loc[returns.index]


def run_momentum(prices: pd.DataFrame, lookback: int = 126, top_n: int = 3, rebalance: str = "monthly") -> pd.Series:
    rets = prices.pct_change().dropna()
    period_returns = prices / prices.shift(lookback) - 1
    period_returns = period_returns.dropna()
    signals = pd.DataFrame(0.0, index=period_returns.index, columns=period_returns.columns)
    for dt in period_returns.index:
        top = period_returns.loc[dt].nlargest(min(top_n, len(period_returns.columns)))
        signals.loc[dt, top.index] = 1.0 / len(top)
    signals = signals.resample("D").ffill().reindex(rets.index).fillna(0)
    portfolio_rets = (signals.shift(1).fillna(0) * rets).sum(axis=1)
    return portfolio_rets


def run_min_vol(prices: pd.DataFrame, lookback: int = 63, top_n: int = 3) -> pd.Series:
    rets = prices.pct_change().dropna()
    rolling_vol = rets.rolling(lookback, min_periods=lookback).std()
    weights = pd.DataFrame(0.0, index=rolling_vol.index, columns=rolling_vol.columns)
    for dt in rolling_vol.index:
        vol = rolling_vol.loc[dt].dropna().nsmallest(min(top_n, len(rolling_vol.columns)))
        if vol.empty:
            continue
        weights.loc[dt, vol.index] = 1.0 / len(vol)
    weights = weights.reindex(rets.index).fillna(method="ffill").fillna(0)
    return (weights.shift(1).fillna(0) * rets).sum(axis=1)


def run_mean_reversion(prices: pd.DataFrame, window: int = 14, threshold: float = 30.0) -> pd.Series:
    rets = prices.pct_change().dropna()
    weights = pd.DataFrame(0.0, index=rets.index, columns=rets.columns)
    for col in prices.columns:
        rsi = compute_indicator(prices[col], IndicatorSpec(indicator="rsi", window=window))
        rsi = rsi.reindex(rets.index)
        weights.loc[rsi < threshold, col] = 1.0 / len(prices.columns)
        weights.loc[rsi > (100 - threshold), col] = 0
    weights = weights.fillna(method="ffill").fillna(0)
    return (weights.shift(1).fillna(0) * rets).sum(axis=1)


def run_strategy_builder(prices: pd.DataFrame, weights: List[float], rules: List[StrategyRule], stop_loss: Optional[float], take_profit: Optional[float]) -> Tuple[pd.Series, pd.Series]:
    portfolio_price = weighted_portfolio_price(prices, weights)
    positions = evaluate_strategy_rules(portfolio_price, rules, stop_loss, take_profit)
    returns = portfolio_price.pct_change().fillna(0)
    strat_returns = returns * positions.shift(1).fillna(0)
    return strat_returns, positions
