import numpy as np
import pandas as pd

from backend.app.analytics import compute_performance_stats


def test_portfolio_stats_match_hand_calc():
    # 1% daily return over 3 days -> cumulative ~3.03%
    rets = pd.Series([0.01, 0.01, 0.01], index=pd.date_range("2022-01-01", periods=3))
    stats = compute_performance_stats(rets)
    assert round(stats["cumulative_return"], 4) == round((1.01**3) - 1, 4)
    assert stats["annualized_volatility"] > 0
    assert stats["sharpe_ratio"] > 0
