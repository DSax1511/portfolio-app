from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass
class Settings:
    """Centralized app configuration."""

    data_cache_dir: Path = Path(os.getenv("DATA_CACHE_DIR", Path(__file__).parent / "data_cache"))
    runs_dir: Path = Path(os.getenv("RUNS_DIR", Path(__file__).parent / "runs"))
    presets_path: Path = Path(os.getenv("PRESETS_PATH", Path(__file__).parent / "presets.json"))
    default_lookback_years: int = int(os.getenv("DEFAULT_LOOKBACK_YEARS", "3"))
    frontend_origins: str = os.getenv("FRONTEND_ORIGINS", "")


settings = Settings()
settings.data_cache_dir.mkdir(parents=True, exist_ok=True)
settings.runs_dir.mkdir(parents=True, exist_ok=True)
