from __future__ import annotations

from typing import Any, Dict, List, Tuple

import numpy as np
import pandas as pd

from .data import fetch_price_history
from .models import QuantBacktestRequest, QuantStrategyConfig, Trade

TRADING_DAYS = 252


def compute_rsi(close: pd.Series, period: int) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(alpha=1 / period, adjust=False, min_periods=period).mean()
    avg_loss = loss.ewm(alpha=1 / period, adjust=False, min_periods=period).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    rsi = 100 - (100 / (1 + rs))
    return rsi


def _build_price_frame(symbol: str, start: str, end: str) -> pd.DataFrame:
    closes = fetch_price_history([symbol], start, end, field="Close")
    opens = fetch_price_history([symbol], start, end, field="Open")
    df = pd.DataFrame(
        {
            "open": opens[symbol],
            "close": closes[symbol],
        }
    ).sort_index()
    return df.dropna(subset=["open", "close"])


def _build_benchmark_frame(symbol: str, start: str, end: str, index: pd.DatetimeIndex) -> pd.DataFrame:
    closes = fetch_price_history([symbol], start, end, field="Close")
    opens = fetch_price_history([symbol], start, end, field="Open")
    bench_df = pd.DataFrame(
        {
            "open": opens[symbol],
            "close": closes[symbol],
        }
    )
    bench_df = bench_df.sort_index().reindex(index)
    return bench_df.ffill().bfill()


def _generate_long_signal(df: pd.DataFrame, cfg: QuantStrategyConfig) -> pd.Series:
    signals = pd.Series(True, index=df.index, dtype=bool)
    if cfg.use_sma:
        df["sma_fast"] = df["close"].rolling(cfg.sma_fast, min_periods=cfg.sma_fast).mean()
        df["sma_slow"] = df["close"].rolling(cfg.sma_slow, min_periods=cfg.sma_slow).mean()
        sma_ready = df["sma_fast"].notna() & df["sma_slow"].notna()
        signals &= sma_ready & (df["sma_fast"] > df["sma_slow"])
    if cfg.use_rsi:
        df["rsi"] = compute_rsi(df["close"], cfg.rsi_period)
        rsi_ready = df["rsi"].notna()
        signals &= rsi_ready & (df["rsi"] > cfg.rsi_oversold)
        if cfg.rsi_overbought is not None:
            signals &= df["rsi"] < cfg.rsi_overbought
    return signals.fillna(False)


def _simulate_strategy(
    df: pd.DataFrame,
    signals: pd.Series,
    bench_df: pd.DataFrame,
    cfg: QuantStrategyConfig,
    request: QuantBacktestRequest,
) -> Tuple[pd.Series, pd.Series, pd.Series, pd.Series, List[Trade]]:
    dates = df.index
    if len(dates) == 0:
        return pd.Series(dtype=float), pd.Series(dtype=float), []

    equity = cfg.initial_capital
    cash = equity
    shares = 0
    entry_price: float | None = None
    trades: List[Trade] = []
    equity_records = [(dates[0], equity)]
    bench_records = []

    bench_prices = bench_df
    if bench_prices.empty:
        bench_records.append((dates[0], cfg.initial_capital))
        bench_shares = 0
        bench_cash = cfg.initial_capital
    else:
        start_open = bench_prices["open"].iloc[0]
        start_open = (
            start_open if pd.notna(start_open) and start_open > 0 else bench_prices["close"].iloc[0]
        )
        bench_shares = int(cfg.initial_capital // start_open) if start_open > 0 else 0
        bench_cash = cfg.initial_capital - bench_shares * start_open
        bench_records.append((dates[0], bench_cash + bench_shares * bench_prices["close"].iloc[0]))

    max_fraction = max(0.0, min(request.max_position_size or 0.0, 1.0))
    slippage = request.slippage_bps / 10000.0
    commission = request.commission_per_trade or 0.0

    for idx in range(1, len(dates)):
        today = dates[idx]
        prev = dates[idx - 1]
        signal_prev = signals.iloc[idx - 1]
        open_price = df["open"].iloc[idx]
        close_price = df["close"].iloc[idx]

        if pd.isna(open_price) or pd.isna(close_price):
            continue

        target_shares = shares
        if signal_prev and shares == 0:
            max_cash = equity * max_fraction
            desired = int(max_cash // open_price) if open_price > 0 else 0
            target_shares = desired
        elif not signal_prev and shares > 0:
            target_shares = 0

        trade_qty = target_shares - shares
        if trade_qty != 0 and open_price > 0:
            if trade_qty > 0:
                exec_price = open_price * (1 + slippage)
                cost = exec_price * trade_qty + commission
                cash -= cost
                prev_shares = shares
                shares += trade_qty
                entry_price = exec_price if prev_shares == 0 else (
                    (entry_price or exec_price) * prev_shares + exec_price * trade_qty
                ) / shares
                pnl = 0.0
                side = "BUY"
                size = trade_qty
            else:
                sell_qty = abs(trade_qty)
                exec_price = open_price * (1 - slippage)
                proceeds = exec_price * sell_qty - commission
                cash += proceeds
                pnl = (exec_price - entry_price) * sell_qty if entry_price is not None else 0.0
                shares -= sell_qty
                if shares <= 0:
                    shares = 0
                    entry_price = None
                side = "SELL"
                size = sell_qty
            trades.append(
                Trade(
                    timestamp=today.strftime("%Y-%m-%d"),
                    side=side,
                    size=int(size),
                    price=round(float(exec_price), 4),
                    pnl=round(float(pnl), 2),
                )
            )

        equity = cash + shares * close_price
        equity_records.append((today, equity))

        if not bench_prices.empty:
            bench_close = bench_prices["close"].loc[today]
            bench_val = bench_cash + bench_shares * bench_close
        else:
            bench_val = cfg.initial_capital
        bench_records.append((today, bench_val))

    equity_idx = [d for d, _ in equity_records]
    equity_vals = [v for _, v in equity_records]
    bench_idx = [d for d, _ in bench_records]
    bench_vals = [v for _, v in bench_records]

    equity_series = pd.Series(equity_vals, index=equity_idx)
    bench_series = pd.Series(bench_vals, index=bench_idx)
    returns = equity_series.pct_change().fillna(0.0)
    bench_returns = bench_series.pct_change().fillna(0.0)

    return equity_series, bench_series, returns, bench_returns, trades


def run_quant_backtest(request: QuantBacktestRequest) -> Dict[str, Any]:
    cfg = request.strategy
    price_df = _build_price_frame(cfg.symbol, cfg.start_date, cfg.end_date)
    if price_df.empty:
        raise ValueError("Insufficient price data for symbol")

    long_signal = _generate_long_signal(price_df, cfg)
    bench_df = _build_benchmark_frame(request.benchmark or "SPY", cfg.start_date, cfg.end_date, price_df.index)

    equity_series, bench_series, returns, bench_returns, trades = _simulate_strategy(
        price_df, long_signal, bench_df, cfg, request
    )

    cum_equity = (1 + returns).cumprod()
    cum_bench = (1 + bench_returns).cumprod()

    return {
        "dates": [d.strftime("%Y-%m-%d") for d in equity_series.index],
        "equity_curve": [float(v) for v in cum_equity],
        "benchmark_equity": [float(v) for v in cum_bench],
        "returns": [float(r) for r in returns],
        "benchmark_returns": [float(r) for r in bench_returns],
        "trades": trades,
    }
