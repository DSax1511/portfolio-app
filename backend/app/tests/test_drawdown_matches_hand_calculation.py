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


def _build_drawdown_frame():
    dates = pd.bdate_range("2025-01-02", periods=8)
    prices = np.array([100, 105, 95, 97, 120, 118, 125, 130])
    return pd.DataFrame({"open": prices, "close": prices}, index=dates)


def _calc_drawdown(cum_curve):
    arr = np.array(cum_curve, dtype=float)
    peak = np.maximum.accumulate(arr)
    drawdowns = arr / peak - 1
    return float(drawdowns.min())


def test_drawdown_matches_hand_calculation(monkeypatch):
    frame = _build_drawdown_frame()
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
    price_curve = frame["close"].to_numpy()
    expected = _calc_drawdown(price_curve / price_curve[0])
    actual = _calc_drawdown(result["equity_curve"])
    assert np.isclose(actual, expected, atol=1e-9)
