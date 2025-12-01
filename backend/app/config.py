from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass
class Settings:
    """Centralized app configuration with environment variable support."""

    # Paths
    data_cache_dir: Path = Path(os.getenv("DATA_CACHE_DIR", Path(__file__).parent / "data_cache"))
    runs_dir: Path = Path(os.getenv("RUNS_DIR", Path(__file__).parent / "runs"))
    presets_path: Path = Path(os.getenv("PRESETS_PATH", Path(__file__).parent / "presets.json"))
    
    # Lookback defaults
    default_lookback_years: int = int(os.getenv("DEFAULT_LOOKBACK_YEARS", "3"))
    
    # CORS configuration
    frontend_origins: str = os.getenv("FRONTEND_ORIGINS", "")
    
    # Authentication
    secret_key: str = os.getenv("SECRET_KEY", "change-me-in-production")
    jwt_algorithm: str = os.getenv("JWT_ALGORITHM", "HS256")
    access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
    
    # Rate limiting (requests per minute)
    rate_limit_requests: int = int(os.getenv("RATE_LIMIT_REQUESTS", "100"))
    rate_limit_backtest: int = int(os.getenv("RATE_LIMIT_BACKTEST", "10"))  # Expensive endpoint
    rate_limit_optimization: int = int(os.getenv("RATE_LIMIT_OPTIMIZATION", "20"))  # Expensive endpoint
    
    # Environment
    environment: str = os.getenv("ENVIRONMENT", "development")


settings = Settings()
settings.data_cache_dir.mkdir(parents=True, exist_ok=True)
settings.runs_dir.mkdir(parents=True, exist_ok=True)
