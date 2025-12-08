from app.services.metric_methodology import METRIC_METHODS, get_methodology


def test_methodology_registry_contains_sharpe():
    assert "sharpe_ratio" in METRIC_METHODS
    meta = get_methodology("sharpe_ratio")
    assert meta is not None
    assert "Sharpe" in meta.title
