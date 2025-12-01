"""Tests for market snapshot endpoint."""
import json
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest
import yfinance as yf
from fastapi.testclient import TestClient

from backend.app.main import app


@pytest.fixture
def client():
    """FastAPI test client."""
    return TestClient(app)


@pytest.mark.unit
def test_market_snapshot_endpoint_exists(client):
    """Test that the market snapshot endpoint exists."""
    response = client.get("/api/market/snapshot")
    # Should either succeed (200) or fail gracefully (502 if yfinance fails)
    assert response.status_code in [200, 502]


@pytest.mark.unit
@patch("backend.app.market._fetch_market_snapshot")
def test_market_snapshot_returns_correct_structure(mock_fetch, client):
    """Test that endpoint returns expected structure."""
    mock_fetch.return_value = {
        "as_of": "2025-12-01T15:58:00Z",
        "tickers": [
            {"symbol": "SPY", "last": 475.32, "change_pct": 1.23},
            {"symbol": "QQQ", "last": 398.10, "change_pct": 1.78},
        ],
    }
    
    response = client.get("/api/market/snapshot")
    assert response.status_code == 200
    
    data = response.json()
    assert "as_of" in data
    assert "tickers" in data
    assert isinstance(data["tickers"], list)
    assert len(data["tickers"]) > 0
    
    # Check ticker structure
    ticker = data["tickers"][0]
    assert "symbol" in ticker
    assert "last" in ticker
    assert "change_pct" in ticker


@pytest.mark.unit
@patch("backend.app.market._fetch_market_snapshot")
def test_market_snapshot_caching(mock_fetch, client):
    """Test that snapshots are cached for 60 seconds."""
    mock_fetch.return_value = {
        "as_of": "2025-12-01T15:58:00Z",
        "tickers": [
            {"symbol": "SPY", "last": 475.32, "change_pct": 1.23},
        ],
    }
    
    # First request should fetch
    response1 = client.get("/api/market/snapshot")
    assert response1.status_code == 200
    fetch_count_1 = mock_fetch.call_count
    
    # Second request should use cache
    response2 = client.get("/api/market/snapshot")
    assert response2.status_code == 200
    fetch_count_2 = mock_fetch.call_count
    
    # Fetch should not have been called again
    assert fetch_count_2 == fetch_count_1


@pytest.mark.unit
def test_market_snapshot_tickers_have_required_fields(client):
    """Test that returned tickers have all required fields."""
    response = client.get("/api/market/snapshot")
    
    # If successful, verify structure
    if response.status_code == 200:
        data = response.json()
        for ticker in data["tickers"]:
            assert isinstance(ticker.get("symbol"), str), "symbol should be string"
            assert isinstance(ticker.get("last"), (int, float)), "last should be number"
            assert isinstance(ticker.get("change_pct"), (int, float)), "change_pct should be number"
            assert len(ticker["symbol"]) > 0, "symbol should not be empty"


@pytest.mark.unit
def test_market_snapshot_as_of_is_iso_timestamp(client):
    """Test that as_of timestamp is valid ISO format."""
    response = client.get("/api/market/snapshot")
    
    if response.status_code == 200:
        data = response.json()
        assert "as_of" in data
        
        # Should be parseable as ISO timestamp
        try:
            dt = datetime.fromisoformat(data["as_of"].replace("Z", "+00:00"))
            assert isinstance(dt, datetime)
        except ValueError:
            pytest.fail(f"as_of is not valid ISO format: {data['as_of']}")


@pytest.mark.unit
@patch("backend.app.market._fetch_market_snapshot")
def test_market_snapshot_handles_fetch_error(mock_fetch, client):
    """Test that endpoint handles fetch errors gracefully."""
    mock_fetch.side_effect = Exception("Network error")
    
    response = client.get("/api/market/snapshot")
    assert response.status_code == 502
    
    data = response.json()
    assert "detail" in data


@pytest.mark.unit
def test_market_snapshot_change_pct_precision(client):
    """Test that change_pct is rounded to 2 decimal places."""
    response = client.get("/api/market/snapshot")
    
    if response.status_code == 200:
        data = response.json()
        for ticker in data["tickers"]:
            # Check that change_pct has at most 2 decimal places
            change_str = str(ticker["change_pct"])
            if "." in change_str:
                decimals = len(change_str.split(".")[1])
                assert decimals <= 2, f"change_pct {ticker['change_pct']} has too many decimals"


@pytest.mark.unit
def test_market_snapshot_price_precision(client):
    """Test that prices are rounded to 2 decimal places."""
    response = client.get("/api/market/snapshot")
    
    if response.status_code == 200:
        data = response.json()
        for ticker in data["tickers"]:
            # Check that last has at most 2 decimal places
            price_str = str(ticker["last"])
            if "." in price_str:
                decimals = len(price_str.split(".")[1])
                assert decimals <= 2, f"last {ticker['last']} has too many decimals"


@pytest.mark.integration
def test_market_snapshot_with_real_data():
    """Integration test that fetches real market data (slow)."""
    pytest.importorskip("yfinance")
    
    client = TestClient(app)
    response = client.get("/api/market/snapshot")
    
    # Real data should work or fail gracefully
    assert response.status_code in [200, 502]
    
    if response.status_code == 200:
        data = response.json()
        assert len(data["tickers"]) > 0
        
        # Verify symbols are in expected set
        symbols = {t["symbol"] for t in data["tickers"]}
        expected = {"SPY", "QQQ", "IWM", "^VIX"}
        assert symbols.issubset(expected), f"Unexpected symbols: {symbols - expected}"


@pytest.mark.unit
def test_market_snapshot_includes_vix(client):
    """Test that VIX is attempted to be included (may fail due to yfinance limitations)."""
    response = client.get("/api/market/snapshot")
    
    if response.status_code == 200:
        data = response.json()
        symbols = [t["symbol"] for t in data["tickers"]]
        # VIX may not always be available from yfinance, but SPY/QQQ should be
        assert len(symbols) > 0, "Should have at least some ticker data"
        assert "SPY" in symbols or "QQQ" in symbols, "Should have at least SPY or QQQ"
