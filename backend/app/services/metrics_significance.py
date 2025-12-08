from __future__ import annotations

import math
from typing import Any, Dict, Iterable, List, Mapping, Optional

from .metric_methodology import MetricMethodology, get_methodology

METRIC_SIGNIFICANCE_CONFIG: Dict[str, Dict[str, Any]] = {
    "sharpe_ratio": {"threshold": 0.5, "methodology_id": "sharpe_ratio"},
    "sortino_ratio": {"threshold": 0.4, "methodology_id": "sortino_ratio"},
    "alpha": {"threshold": 0.1, "methodology_id": "alpha"},
    "beta": {"threshold": 0.2, "methodology_id": "beta"},
    "correlation": {"threshold": 0.12, "methodology_id": "correlation"},
    "autocorrelation": {"threshold": 0.15, "methodology_id": "autocorrelation"},
    "var_95": {"threshold": 0.01, "methodology_id": "var_95"},
    "var_99": {"threshold": 0.015, "methodology_id": "var_99"},
    "var_95_hist": {"threshold": 0.02, "methodology_id": "var_95_hist"},
    "var_99_hist": {"threshold": 0.03, "methodology_id": "var_99_hist"},
    "cvar_95": {"threshold": 0.02, "methodology_id": "cvar_95"},
    "max_drawdown": {"threshold": 0.05, "methodology_id": "max_drawdown"},
    "calmar_ratio": {"threshold": 0.3, "methodology_id": "calmar_ratio"},
    "omega_ratio": {"threshold": 1.1, "methodology_id": "omega_ratio"},
}

DEFAULT_SIGNIFICANCE_HINT = "Not statistically distinguishable from noise for the observed sample size."


def _normal_cdf(x: float) -> float:
    return 0.5 * (1 + math.erf(x / math.sqrt(2)))


def _correlation_t_stat(value: float, sample_size: int) -> Optional[float]:
    if sample_size <= 2 or not math.isfinite(value):
        return None
    denom = 1 - value * value
    if denom <= 0:
        return None
    return value * math.sqrt((sample_size - 2) / denom)


def _ratio_t_stat(value: float, sample_size: int) -> Optional[float]:
    if sample_size <= 0 or not math.isfinite(value):
        return None
    return value * math.sqrt(sample_size)


def _estimate_p_value(metric_key: str, value: float, sample_size: int) -> Optional[float]:
    if metric_key in {"sharpe_ratio", "sortino_ratio", "alpha", "beta"}:
        t_stat = _ratio_t_stat(value, max(sample_size, 2))
    elif metric_key in {"correlation", "autocorrelation"}:
        t_stat = _correlation_t_stat(value, max(sample_size, 3))
    else:
        t_stat = None
    if t_stat is None:
        return None
    p = 2 * (1 - _normal_cdf(abs(t_stat)))
    return max(0.0, min(1.0, p))


def _adjust_threshold(threshold: float, sample_size: Optional[int]) -> float:
    if sample_size is None:
        return threshold
    if sample_size > 500:
        return max(0.03, threshold - 0.08)
    if sample_size > 250:
        return max(0.05, threshold - 0.05)
    return threshold


def _methodology_payload(methodology_id: Optional[str]) -> Optional[Dict[str, Any]]:
    if not methodology_id:
        return None
    methodology = get_methodology(methodology_id)
    if not methodology:
        return None
    return {
        "title": methodology.title,
        "description": methodology.description,
        "window_length": methodology.window_length,
        "assumptions": methodology.assumptions,
    }


def evaluate_metric_metadata(metric_key: str, value: float, sample_size: Optional[int]) -> Optional[Dict[str, Any]]:
    config = METRIC_SIGNIFICANCE_CONFIG.get(metric_key)
    if not config or not math.isfinite(value):
        return None
    threshold = _adjust_threshold(config["threshold"], sample_size)
    is_significant = abs(value) >= threshold
    p_value = _estimate_p_value(metric_key, value, sample_size or 0)
    methodology_id = config.get("methodology_id")
    return {
        "is_significant": is_significant,
        "methodology_id": methodology_id,
        "methodology": _methodology_payload(methodology_id),
        "p_value": p_value,
    }


def build_metric_metadata(metrics: Mapping[str, float], sample_size: Optional[int]) -> Dict[str, Dict[str, Any]]:
    metadata: Dict[str, Dict[str, Any]] = {}
    for key, value in metrics.items():
        detail = evaluate_metric_metadata(key, value, sample_size)
        if detail:
            metadata[key] = detail
    return metadata


def annotate_correlation_rows(rows: Iterable[Dict[str, Any]], sample_size: Optional[int]) -> List[Dict[str, Any]]:
    annotated: List[Dict[str, Any]] = []
    for row in rows:
        entry = dict(row)
        value = row.get("value")
        if value is None:
            annotated.append(entry)
            continue
        detail = evaluate_metric_metadata("correlation", float(value), sample_size)
        if detail:
            entry["metric_metadata"] = detail
        annotated.append(entry)
    return annotated


def get_significance_badge(metric_key: str, value: float, sample_size: Optional[int]) -> str:
    """
    Return a significance badge for display purposes.

    Returns:
        "✓" - Statistically significant
        "~" - Not significant (likely noise)
        "✗" - Unable to assess (missing config or invalid value)
    """
    metadata = evaluate_metric_metadata(metric_key, value, sample_size)
    if metadata is None:
        return "✗"
    return "✓" if metadata["is_significant"] else "~"
