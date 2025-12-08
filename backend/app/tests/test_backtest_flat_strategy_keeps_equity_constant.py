import numpy as np
import pandas as pd

from backend.app import quant_engine
from backend.app.models import QuantBacktestRequest, QuantStrategyConfig
from backend.app.quant_engine import run_quant_backtest


def _patch_prices(monkeypatch, frame):
    def fake_fetch_price_history(symbols, start, end, field="Close"):
        series = frame[field.lower()]
        return pd.DataFrame({symbols[0]: series})

    monkeypatch.setattr(quant_engine, "fetch_price_history", fake_fetch_price_history)


def _build_flat_frame():
    dates = pd.bdate_range("2025-01-02", periods=12)
    values = np.full(len(dates), 100.0)
    return pd.DataFrame({"open": values, "close": values}, index=dates)


def test_backtest_flat_strategy_keeps_equity_constant(monkeypatch):
    frame = _build_flat_frame()
    _patch_prices(monkeypatch, frame)

    config = QuantStrategyConfig(
        symbol="SPY",
        timeframe="1D",
        start_date="2025-01-02",
        end_date="2025-01-20",
        use_sma=False,
        use_rsi=False,
    )
    request = QuantBacktestRequest(
        strategy=config,
        slippage_bps=0.0,
        commission_per_trade=0.0,
        max_position_size=1.0,
    )

    result = run_quant_backtest(request)
    equity_series = np.array(result["equity_curve"])
    assert np.allclose(equity_series, equity_series[0], atol=1e-9)
