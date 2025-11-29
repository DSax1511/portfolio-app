import numpy as np
import pandas as pd
import pytest
from hypothesis import given, strategies as st

from backend.app.analytics import compute_performance_stats, risk_breakdown
from backend.app.backtests import apply_rebalance
from backend.app.optimizers import markowitz_frontier, min_variance_weights, risk_parity_weights


def test_performance_stats_basic():
    rets = pd.Series([0.01] * 252)
    stats = compute_performance_stats(rets)
    assert stats["cumulative_return"] > 0.01
    assert stats["sharpe_ratio"] > 0


def test_apply_rebalance_costs_and_turnover():
    dates = pd.date_range("2022-01-01", periods=10, freq="D")
    rets = pd.DataFrame({"A": [0.01] * 10, "B": [0.0] * 10}, index=dates)
    weights = [0.5, 0.5]
    port, turnover = apply_rebalance(rets, weights, frequency="monthly", cost_bps=10)
    assert len(port) == len(rets)
    assert turnover.max() >= 0


def test_risk_parity_and_min_vol_weights_sum_to_one():
    cov = pd.DataFrame([[0.04, 0.01], [0.01, 0.09]], columns=["A", "B"], index=["A", "B"])
    rp = risk_parity_weights(cov)
    mv = min_variance_weights(cov, cap=0.8)
    assert np.isclose(rp.sum(), 1.0)
    assert np.isclose(mv.sum(), 1.0)
    assert (mv <= 0.8 + 1e-9).all()


@given(
    st.lists(st.floats(min_value=-0.05, max_value=0.05), min_size=40, max_size=80),
    st.lists(st.floats(min_value=-0.05, max_value=0.05), min_size=40, max_size=80),
)
def test_frontier_weights_are_valid(list_a, list_b):
    # Property: each frontier point weight vector sums to 1 and is non-negative
    size = min(len(list_a), len(list_b))
    rets = pd.DataFrame(
        {"A": list_a[:size], "B": list_b[:size]},
        index=pd.date_range("2020-01-01", periods=size, freq="D"),
    )
    frontier = markowitz_frontier(rets, points=5, cap=0.9)
    for point in frontier["frontier"]:
        w = np.array(point["weights"])
        assert np.all(w >= 0)
        assert np.isclose(w.sum(), 1.0)
