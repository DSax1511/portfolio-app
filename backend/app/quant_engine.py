from __future__ import annotations

import math
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd

from .analytics import compute_portfolio_returns
from .data import fetch_price_history
from .models import QuantBacktestRequest, Trade


def _rsi(series: pd.Series, period: int = 14) -> pd.Series:
  delta = series.diff()
  gain = delta.clip(lower=0).rolling(period).mean()
  loss = -delta.clip(upper=0).rolling(period).mean()
  rs = gain / loss.replace(0, np.nan)
  rsi = 100 - (100 / (1 + rs))
  return rsi


def _signals(prices: pd.Series, cfg) -> pd.Series:
  df = pd.DataFrame({"price": prices})
  if cfg.use_sma:
    df["sma_fast"] = df["price"].rolling(cfg.sma_fast, min_periods=cfg.sma_fast).mean()
    df["sma_slow"] = df["price"].rolling(cfg.sma_slow, min_periods=cfg.sma_slow).mean()
  if cfg.use_rsi:
    df["rsi"] = _rsi(df["price"], cfg.rsi_period)

  signal = pd.Series(0, index=prices.index, dtype=float)
  for i in range(1, len(df)):
    take_long = True
    take_short = True
    if cfg.use_sma:
      prev_fast, prev_slow = df["sma_fast"].iloc[i - 1], df["sma_slow"].iloc[i - 1]
      fast, slow = df["sma_fast"].iloc[i], df["sma_slow"].iloc[i]
      if pd.notna(fast) and pd.notna(slow) and pd.notna(prev_fast) and pd.notna(prev_slow):
        if prev_fast <= prev_slow and fast > slow:
          signal.iloc[i] = 1
        elif prev_fast >= prev_slow and fast < slow:
          signal.iloc[i] = -1
    if cfg.use_rsi:
      rsi_val = df["rsi"].iloc[i]
      if pd.isna(rsi_val):
        continue
      if rsi_val >= cfg.rsi_overbought:
        take_long = False
      if rsi_val <= cfg.rsi_oversold:
        take_short = False
    if signal.iloc[i] == 1 and not take_long:
      signal.iloc[i] = 0
    if signal.iloc[i] == -1 and not take_short:
      signal.iloc[i] = 0
  return signal.replace(np.nan, 0)


def _apply_execution(prices: pd.Series, signals: pd.Series, cfg: QuantBacktestRequest) -> Tuple[pd.Series, List[Trade]]:
  equity = cfg.strategy.initial_capital
  cash = equity
  position = 0.0  # shares
  trades: List[Trade] = []
  prev_equity = equity
  returns = []
  side_label = {1: "LONG", -1: "SHORT", 0: "FLAT"}

  max_pos_frac = max(0.0, min(cfg.max_position_size, 1.0))
  slippage = cfg.slippage_bps / 10000.0

  for i, (dt, price) in enumerate(prices.items()):
    desired_dir = signals.iloc[i]
    if cfg.strategy.position_mode == "long_only":
      desired_dir = 1 if desired_dir > 0 else 0
    elif cfg.strategy.position_mode == "long_flat":
      desired_dir = 1 if desired_dir > 0 else 0
    elif cfg.strategy.position_mode == "long_short":
      desired_dir = 1 if desired_dir > 0 else (-1 if desired_dir < 0 else 0)
    desired_value = equity * max_pos_frac * desired_dir
    current_value = position * price
    diff_value = desired_value - current_value
    if abs(diff_value) > 1e-8:
      side = 1 if diff_value > 0 else -1
      fill_price = price * (1 + slippage * side)
      shares = diff_value / fill_price
      cost = shares * fill_price
      commission = cfg.commission_per_trade
      cash -= cost
      cash -= commission
      position += shares
      trades.append(
        Trade(
          timestamp=dt.strftime("%Y-%m-%d"),
          side=side_label.get(side, "FLAT"),
          size=float(shares),
          price=float(fill_price),
          pnl=float(-commission),
        )
      )

    position_value = position * price
    equity = cash + position_value
    ret = (equity - prev_equity) / prev_equity if prev_equity != 0 else 0.0
    returns.append(ret)
    prev_equity = equity

  return pd.Series(returns, index=prices.index), trades


def run_quant_backtest(request: QuantBacktestRequest) -> Dict[str, any]:
  cfg = request.strategy
  prices = fetch_price_history([cfg.symbol], cfg.start_date, cfg.end_date).iloc[:, 0]
  signals = _signals(prices, cfg)
  strat_returns, trades = _apply_execution(prices, signals, request)

  # benchmark
  bench_symbol = request.benchmark or "SPY"
  bench_prices = fetch_price_history([bench_symbol], cfg.start_date, cfg.end_date).iloc[:, 0]
  bench_returns = bench_prices.pct_change().dropna()
  bench_returns = bench_returns.reindex(strat_returns.index).ffill().bfill()

  equity_curve = (1 + strat_returns).cumprod()
  bench_equity = (1 + bench_returns).cumprod()

  return {
    "dates": [d.strftime("%Y-%m-%d") for d in equity_curve.index],
    "equity_curve": [float(v) for v in equity_curve],
    "benchmark_equity": [float(v) for v in bench_equity],
    "returns": [float(r) for r in strat_returns],
    "benchmark_returns": [float(r) for r in bench_returns],
    "trades": trades,
  }
