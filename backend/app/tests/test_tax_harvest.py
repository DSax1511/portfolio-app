"""Tests for the tax-loss harvesting endpoint."""
from fastapi.testclient import TestClient
import pytest

from backend.app.main import app


@pytest.fixture
def client():
    return TestClient(app)


@pytest.mark.unit
def test_tax_harvest_returns_candidates(client):
    response = client.post(
        "/api/tax-harvest",
        json={
            "portfolio_id": "demo",
            "date_range": "MAX",
            "realized_gains_to_offset": 5000,
            "target_fraction_of_gains": 0.5,
            "benchmark": "SPY",
        },
    )
    assert response.status_code == 200

    data = response.json()
    summary = data["summary"]

    assert summary["target_loss_to_realize"] == 2500.0
    assert summary["estimated_tax_savings"] == 831.0
    assert len(data["candidates"]) == 4
    assert data["candidates"][0]["symbol"] == "AAPL"
    assert data["selected_candidates"][0]["lot_id"] == "AAPL-01"
    assert len(data["selected_candidates"]) == 1


@pytest.mark.unit
def test_tax_harvest_respects_date_range_filter(client):
    full_resp = client.post(
        "/api/tax-harvest",
        json={
            "portfolio_id": "demo",
            "date_range": "MAX",
            "realized_gains_to_offset": 0,
            "target_fraction_of_gains": 1.0,
        },
    )
    one_year_resp = client.post(
        "/api/tax-harvest",
        json={
            "portfolio_id": "demo",
            "date_range": "1Y",
            "realized_gains_to_offset": 0,
            "target_fraction_of_gains": 1.0,
        },
    )
    assert full_resp.status_code == 200
    assert one_year_resp.status_code == 200
    full = full_resp.json()
    one_year = one_year_resp.json()

    assert len(full["candidates"]) > len(one_year["candidates"])
    symbols = {lot["symbol"] for lot in one_year["candidates"]}
    assert "TLT" not in symbols


@pytest.mark.unit
def test_tax_harvest_handles_no_losses(client):
    response = client.post(
        "/api/tax-harvest",
        json={
            "portfolio_id": "gains_only",
            "date_range": "MAX",
            "realized_gains_to_offset": 1000,
            "target_fraction_of_gains": 1.0,
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["candidates"] == []
    assert data["selected_candidates"] == []
    assert data["summary"]["total_unrealized_losses"] == 0
