import pandas as pd

from backend.app.models import QuantBacktestRequest, QuantStrategyConfig
from backend.app.quant_engine import run_quant_backtest

DATES = pd.date_range("2022-01-01", periods=5, freq="D")


def _fake_price_history(tickers: list[str], start, end, field: str = "Close") -> pd.DataFrame:
    values = pd.Series([100.0] * len(DATES), index=DATES)
    return pd.DataFrame({ticker: values.copy() for ticker in tickers})


def _make_request() -> QuantBacktestRequest:
    strategy = QuantStrategyConfig(
        symbol="TEST",
        timeframe="1D",
        start_date="2022-01-01",
        end_date="2022-01-05",
        use_sma=False,
        use_rsi=False,
    )
    return QuantBacktestRequest(
        strategy=strategy,
        slippage_bps=0.0,
        commission_per_trade=0.0,
        max_position_size=0.0,
        benchmark="TEST",
    )


def test_backtest_flat_strategy_keeps_equity_constant(monkeypatch):
    monkeypatch.setattr("backend.app.quant_engine.fetch_price_history", _fake_price_history)
    response = run_quant_backtest(_make_request())
    assert all(value == 1.0 for value in response["equity_curve"])
