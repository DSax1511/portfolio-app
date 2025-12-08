"""Tests for the tax-loss harvesting endpoint."""
from fastapi.testclient import TestClient
import pytest

from backend.app.main import app


@pytest.fixture
def client():
    return TestClient(app)


@pytest.mark.unit
def test_tax_harvest_suggests_loss_candidates(client):
    """Endpoint should return a summary and top loss candidates."""
    payload = {
        "positions": [
            {"ticker": "LOSS1", "quantity": 50, "cost_basis": 6000, "current_price": 90},
            {"ticker": "LOSS2", "quantity": 30, "cost_basis": 4500, "current_price": 110},
        ],
        "realized_gains": 5000,
        "offset_target_pct": 0.5,
    }
    response = client.post("/api/tax-harvest", json=payload)
    assert response.status_code == 200

    data = response.json()
    summary = data["summary"]
    candidates = data["candidates"]

    assert summary["loss_positions"] == 2
    assert summary["top_loss"] == 1500.0
    assert summary["offset_capacity"] == 2500.0
    assert summary["gain_offset_target"] == 2500.0

    assert len(candidates) == 2
    assert candidates[0]["ticker"] == "LOSS1"
    assert candidates[0]["loss_amount"] == 1500.0
    assert candidates[1]["loss_amount"] == 1200.0

    assert isinstance(data["notes"], list)
    assert "Targeting 50%" in data["notes"][0]


@pytest.mark.unit
def test_tax_harvest_requires_losses(client):
    """Endpoint should reject portfolios without unrealized losses."""
    payload = {
        "positions": [
            {"ticker": "GAIN", "quantity": 40, "cost_basis": 3000, "current_price": 90},
        ],
    }
    response = client.post("/api/tax-harvest", json=payload)
    assert response.status_code == 400
    assert "No loss positions" in response.json().get("detail", "")
