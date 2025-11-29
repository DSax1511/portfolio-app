from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any, Dict, Optional


def log_run(path: Path, payload: Dict[str, Any]) -> Path:
    """Persist a run payload to JSON for reproducibility."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, default=_json_serializable))
    return path


def timed(name: str, payload: Optional[Dict[str, Any]] = None) -> "_Timer":
    return _Timer(name=name, payload=payload or {})


class _Timer:
    def __init__(self, name: str, payload: Dict[str, Any]):
        self.name = name
        self.payload = payload
        self.start = None

    def __enter__(self):
        self.start = time.perf_counter()
        return self

    def __exit__(self, exc_type, exc, tb):
        self.payload["elapsed_sec"] = round(time.perf_counter() - self.start, 4)


def _json_serializable(obj: Any) -> Any:
    if hasattr(obj, "isoformat"):
        return obj.isoformat()
    return str(obj)
