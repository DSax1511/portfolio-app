import numpy as np
import pandas as pd

from backend.app.backtests import run_buy_and_hold, run_sma_crossover
from backend.app.analytics import compute_performance_stats, equity_curve_payload


def _sample_prices():
    idx = pd.date_range("2022-01-01", periods=6)
    data = {
        "AAA": [100, 101, 102, 103, 104, 105],
        "BBB": [50, 50.5, 51, 51.5, 52, 52.5],
    }
    return pd.DataFrame(data, index=idx)


def test_buy_and_hold_returns_length():
    prices = _sample_prices()
    rets, _turnover = run_buy_and_hold(prices, weights=[0.5, 0.5], rebalance_frequency="none", cost_bps=0)
    assert len(rets) == len(prices) - 1
    assert not rets.isna().any()
    curve = equity_curve_payload(rets)
    assert curve["equity"][0] >= 1.0


def test_sma_crossover_basic_behavior():
    prices = _sample_prices()
    rets = run_sma_crossover(prices, weights=[0.5, 0.5], fast_window=2, slow_window=3)
    stats = compute_performance_stats(rets)
    assert "sharpe_ratio" in stats
    assert len(rets) == len(prices) - 1
