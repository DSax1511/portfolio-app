import numpy as np

from backend.app.rebalance import position_sizing, suggest_rebalance


def test_position_sizing_outputs_expected_fields():
    res = position_sizing("AAPL", entry_price=100, stop_price=90, portfolio_value=10000, risk_per_trade_pct=1.0)
    assert res["shares"] > 0
    assert res["risk_pct_of_portfolio"] <= 1.0
    assert res["ticker"] == "AAPL"


def test_rebalance_trades_move_weights_toward_target():
    tickers = ["AAA", "BBB"]
    current_weights = [0.7, 0.3]
    target_weights = [0.5, 0.5]
    portfolio_value = 10000
    prices = [100, 50]
    result = suggest_rebalance(tickers, current_weights, target_weights, portfolio_value, prices)
    trades = result["trades"]
    values = np.array(current_weights) * portfolio_value
    for trade in trades:
        idx = tickers.index(trade["ticker"])
        sign = 1 if trade["action"] == "buy" else -1
        values[idx] += sign * trade["value"]
    new_weights = values / values.sum()
    assert abs(new_weights[0] - target_weights[0]) < 0.1
    assert abs(new_weights[1] - target_weights[1]) < 0.1
