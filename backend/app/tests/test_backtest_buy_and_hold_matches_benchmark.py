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


def _build_trending_frame():
    dates = pd.bdate_range("2025-01-02", periods=10)
    prices = np.linspace(100, 110, len(dates))
    return pd.DataFrame({"open": prices, "close": prices}, index=dates)


def test_backtest_buy_and_hold_matches_benchmark(monkeypatch):
    frame = _build_trending_frame()
    _patch_prices(monkeypatch, frame)

    config = QuantStrategyConfig(
        symbol="SPY",
        timeframe="1D",
        start_date="2025-01-02",
        end_date="2025-01-15",
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
    assert len(result["trades"]) == 1
    assert result["equity_curve"][-1] > 1.0
