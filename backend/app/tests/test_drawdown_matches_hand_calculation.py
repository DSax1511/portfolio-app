import pandas as pd
import pytest

from backend.app.analytics import compute_performance_stats


def test_drawdown_matches_hand_calculation():
    returns = pd.Series([0.0, 0.05, -0.02, -0.06, 0.02], index=pd.date_range("2023-01-01", periods=5, freq="D"))
    stats = compute_performance_stats(returns)
    equity = (1 + returns).cumprod()
    running_max = equity.cummax()
    expected_drawdown = (equity / running_max - 1).min()
    assert stats["max_drawdown"] == pytest.approx(expected_drawdown)
