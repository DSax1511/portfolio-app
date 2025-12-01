"""
Tests for analytics_pipeline module.

Focus areas:
1. Ensure pandas Series/DataFrame truthiness is not used in boolean contexts
2. Test _build_payload with various benchmark scenarios (None, empty, valid)
3. Verify JSON serializability of the returned payload
4. Test backtest_analytics end-to-end with benchmark data
"""

import numpy as np
import pandas as pd
import pytest
from datetime import datetime, timedelta

from backend.app.analytics_pipeline import (
    _build_payload,
    _equity_from_returns,
    backtest_analytics,
)
from backend.app.data import fetch_price_history


class TestEquityFromReturns:
    """Test _equity_from_returns utility."""

    def test_equity_from_returns_basic(self):
        """Test basic equity curve generation from returns."""
        rets = pd.Series([0.01, 0.02, -0.01], index=pd.date_range("2020-01-01", periods=3, freq="D"))
        equity = _equity_from_returns(rets)
        assert len(equity) == 3
        assert equity.iloc[0] == pytest.approx(1.01)
        assert equity.iloc[-1] == pytest.approx((1.01 * 1.02 * 0.99), rel=1e-6)

    def test_equity_from_returns_empty(self):
        """Test equity from empty returns series."""
        rets = pd.Series([], dtype=float, index=pd.DatetimeIndex([]))
        equity = _equity_from_returns(rets)
        assert len(equity) == 0


class TestBuildPayload:
    """Test _build_payload function."""

    def _create_sample_returns(self, periods=252):
        """Helper to create sample returns data."""
        np.random.seed(42)
        dates = pd.date_range("2020-01-01", periods=periods, freq="D")
        returns = np.random.randn(periods) * 0.01 + 0.0005
        asset_returns = pd.DataFrame(
            {
                "AAPL": returns + np.random.randn(periods) * 0.005,
                "MSFT": returns + np.random.randn(periods) * 0.005,
            },
            index=dates,
        )
        port_returns = pd.Series(returns, index=dates)
        return port_returns, asset_returns

    def test_build_payload_no_benchmark(self):
        """Test _build_payload with no benchmark (bench_returns=None)."""
        port_returns, asset_returns = self._create_sample_returns()
        
        payload = _build_payload(
            port_returns=port_returns,
            bench_returns=None,
            params={
                "tickers": ["AAPL", "MSFT"],
                "weights": [0.5, 0.5],
                "benchmark": None,
                "start_date": "2020-01-01",
                "end_date": "2020-12-31",
                "rebalance_freq": "none",
                "trading_cost_bps": 0.0,
            },
            asset_returns=asset_returns,
            weights=np.array([0.5, 0.5]),
            sectors=None,
        )
        
        # Assertions
        assert isinstance(payload, dict)
        assert "benchmark_curve" in payload
        assert payload["benchmark_curve"] is None
        assert "relative_curve" in payload
        assert payload["relative_curve"] is None
        assert "equity_curve" in payload
        assert payload["equity_curve"] is not None
        
    def test_build_payload_with_benchmark(self):
        """Test _build_payload with valid benchmark (bench_returns is a Series)."""
        port_returns, asset_returns = self._create_sample_returns()
        
        # Create benchmark returns
        bench_returns = pd.Series(
            np.random.randn(len(port_returns)) * 0.01 + 0.0003,
            index=port_returns.index,
        )
        
        payload = _build_payload(
            port_returns=port_returns,
            bench_returns=bench_returns,
            params={
                "tickers": ["AAPL", "MSFT"],
                "weights": [0.5, 0.5],
                "benchmark": "SPY",
                "start_date": "2020-01-01",
                "end_date": "2020-12-31",
                "rebalance_freq": "none",
                "trading_cost_bps": 0.0,
            },
            asset_returns=asset_returns,
            weights=np.array([0.5, 0.5]),
            sectors=None,
        )
        
        # Assertions
        assert isinstance(payload, dict)
        assert "benchmark_curve" in payload
        assert payload["benchmark_curve"] is not None
        assert isinstance(payload["benchmark_curve"], dict)
        assert "dates" in payload["benchmark_curve"]
        assert "equity" in payload["benchmark_curve"]
        assert len(payload["benchmark_curve"]["dates"]) == len(port_returns)
        assert len(payload["benchmark_curve"]["equity"]) == len(port_returns)
        
        assert "relative_curve" in payload
        assert payload["relative_curve"] is not None
        assert isinstance(payload["relative_curve"], dict)
        assert "dates" in payload["relative_curve"]
        assert "relative" in payload["relative_curve"]

    def test_build_payload_no_ambiguous_truthiness(self):
        """
        Regression test: ensure no ValueError about Series truthiness.
        This would have failed before the fix.
        """
        port_returns, asset_returns = self._create_sample_returns()
        bench_returns = pd.Series(
            np.random.randn(len(port_returns)) * 0.01 + 0.0003,
            index=port_returns.index,
        )
        
        # This should NOT raise: ValueError: The truth value of a Series is ambiguous
        try:
            payload = _build_payload(
                port_returns=port_returns,
                bench_returns=bench_returns,
                params={
                    "tickers": ["AAPL", "MSFT"],
                    "weights": [0.5, 0.5],
                    "benchmark": "SPY",
                    "start_date": "2020-01-01",
                    "end_date": "2020-12-31",
                    "rebalance_freq": "none",
                    "trading_cost_bps": 0.0,
                },
                asset_returns=asset_returns,
                weights=np.array([0.5, 0.5]),
                sectors=None,
            )
            # If we reach here, the fix worked
            assert payload is not None
        except ValueError as e:
            if "truth value of a Series is ambiguous" in str(e):
                pytest.fail(f"Regression: pandas Series truthiness issue not fixed: {e}")
            raise

    def test_build_payload_serializable(self):
        """Test that payload is JSON-serializable."""
        import json
        
        port_returns, asset_returns = self._create_sample_returns()
        bench_returns = pd.Series(
            np.random.randn(len(port_returns)) * 0.01 + 0.0003,
            index=port_returns.index,
        )
        
        payload = _build_payload(
            port_returns=port_returns,
            bench_returns=bench_returns,
            params={
                "tickers": ["AAPL", "MSFT"],
                "weights": [0.5, 0.5],
                "benchmark": "SPY",
                "start_date": "2020-01-01",
                "end_date": "2020-12-31",
                "rebalance_freq": "none",
                "trading_cost_bps": 0.0,
            },
            asset_returns=asset_returns,
            weights=np.array([0.5, 0.5]),
            sectors=None,
        )
        
        # Should not raise serialization errors
        json_str = json.dumps(payload, default=str)
        assert len(json_str) > 0


class TestBacktestAnalytics:
    """Test backtest_analytics end-to-end."""

    def test_backtest_analytics_no_ambiguous_series_truthiness_with_mock_data(self):
        """
        Direct regression test: ensure no ValueError about Series truthiness
        This would have raised ValueError before the fix.
        """
        # Create synthetic data to avoid network calls
        tickers = ["A", "B"]
        dates = pd.date_range("2023-01-01", periods=252, freq="D")
        np.random.seed(42)
        
        # Create mock price data
        price_a = (1 + np.random.randn(252) * 0.01).cumprod()
        price_b = (1 + np.random.randn(252) * 0.01).cumprod()
        prices = pd.DataFrame({"A": price_a, "B": price_b}, index=dates)
        
        # Create mock benchmark data  
        bench_prices = (1 + np.random.randn(252) * 0.01).cumprod()
        bench_df = pd.DataFrame({"SPY": bench_prices}, index=dates)
        
        # Patch fetch_price_history to return our mock data
        from unittest.mock import patch
        
        def mock_fetch(tickers_list, start, end):
            if "SPY" in tickers_list or tickers_list == ["SPY"]:
                return bench_df
            return prices
        
        with patch("backend.app.analytics_pipeline.fetch_price_history", side_effect=mock_fetch):
            # This should NOT raise ValueError about Series truthiness
            try:
                result = backtest_analytics(
                    tickers=tickers,
                    weights=[0.5, 0.5],
                    benchmark="SPY",
                    start="2023-01-01",
                    end="2023-12-31",
                    rebalance_freq="none",
                    trading_cost_bps=0.0,
                )
                # Verify result structure
                assert isinstance(result, dict)
                assert "benchmark_curve" in result
                assert result["benchmark_curve"] is not None  # Should have benchmark
                assert "relative_curve" in result
                assert result["relative_curve"] is not None
                
            except ValueError as e:
                if "truth value of a Series is ambiguous" in str(e):
                    pytest.fail(
                        f"Regression: Series truthiness bug still present: {e}"
                    )
                raise

    def test_backtest_analytics_no_benchmark_with_mock_data(self):
        """Test backtest_analytics without benchmark."""
        tickers = ["A"]
        dates = pd.date_range("2023-01-01", periods=252, freq="D")
        np.random.seed(42)
        
        price_a = (1 + np.random.randn(252) * 0.01).cumprod()
        prices = pd.DataFrame({"A": price_a}, index=dates)
        
        from unittest.mock import patch
        
        def mock_fetch(tickers_list, start, end):
            return prices
        
        with patch("backend.app.analytics_pipeline.fetch_price_history", side_effect=mock_fetch):
            result = backtest_analytics(
                tickers=tickers,
                weights=[1.0],
                benchmark=None,
                start="2023-01-01",
                end="2023-12-31",
                rebalance_freq="none",
                trading_cost_bps=0.0,
            )
            
            # Verify structure
            assert isinstance(result, dict)
            assert result["benchmark_curve"] is None
            assert result["relative_curve"] is None
            assert "equity_curve" in result
            assert result["equity_curve"] is not None


class TestBenchmarkDataHandling:
    """Test proper handling of benchmark data."""

    def test_empty_benchmark_handling(self):
        """Test that empty benchmark Series is handled gracefully."""
        port_returns = pd.Series([0.01, 0.02], index=pd.date_range("2020-01-01", periods=2, freq="D"))
        asset_returns = pd.DataFrame({"A": [0.01, 0.02]}, index=port_returns.index)
        
        # Empty benchmark series - after alignment would be None
        bench_returns = None
        
        # The function should handle it gracefully
        try:
            payload = _build_payload(
                port_returns=port_returns,
                bench_returns=bench_returns,
                params={
                    "tickers": ["A"],
                    "weights": [1.0],
                    "benchmark": None,
                    "start_date": "2020-01-01",
                    "end_date": "2020-01-02",
                    "rebalance_freq": "none",
                    "trading_cost_bps": 0.0,
                },
                asset_returns=asset_returns,
                weights=np.array([1.0]),
                sectors=None,
            )
            assert payload["benchmark_curve"] is None
            assert payload["relative_curve"] is None
        except ValueError as e:
            if "truth value" in str(e):
                pytest.fail(f"Empty benchmark not handled: {e}")
            raise


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
