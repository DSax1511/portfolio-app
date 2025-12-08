from app.services.metrics_significance import annotate_correlation_rows, build_metric_metadata, evaluate_metric_metadata


def test_sharpe_returns_significance_metadata():
    meta = evaluate_metric_metadata("sharpe_ratio", 0.7, 252)
    assert meta is not None
    assert meta["is_significant"] is True
    assert meta["methodology_id"] == "sharpe_ratio"
    assert "methodology" in meta


def test_build_metric_metadata_filters_unknown():
    data = {"sharpe_ratio": 0.2, "unknown": 1.0}
    meta = build_metric_metadata(data, 120)
    assert "sharpe_ratio" in meta
    assert "unknown" not in meta


def test_annotate_correlation_rows_adds_metadata():
    rows = [{"a": "A", "b": "B", "value": 0.35}, {"a": "A", "b": "C", "value": 0.01}]
    annotated = annotate_correlation_rows(rows, 120)
    assert any("metric_metadata" in row for row in annotated)
