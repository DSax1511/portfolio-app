from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, validator

from .infra.utils import IndicatorSpec, StrategyRule


class ApiError(BaseModel):
    detail: str


class Position(BaseModel):
    ticker: str
    description: str
    quantity: float
    cost_basis: float
    avg_cost: float
    current_price: float
    market_value: float
    pnl: float


class PortfolioMetricsRequest(BaseModel):
    tickers: List[str] = Field(..., min_items=1, description="List of ticker symbols")
    weights: Optional[List[float]] = Field(
        None, description="Optional portfolio weights matching the tickers list"
    )
    start_date: Optional[str] = Field(None, description="Inclusive start date YYYY-MM-DD")
    end_date: Optional[str] = Field(None, description="Inclusive end date YYYY-MM-DD")

    @validator("tickers", allow_reuse=True)
    def normalize_tickers(cls, v: List[str]) -> List[str]:
        tickers = [t.strip().upper() for t in v if t.strip()]
        if not tickers:
            raise ValueError("At least one ticker is required.")
        return tickers

    @validator("weights", allow_reuse=True)
    def validate_weights(cls, v: Optional[List[float]], values: Dict[str, Any]) -> Optional[List[float]]:
        if v is None:
            return None
        tickers = values.get("tickers") or []
        if len(v) != len(tickers):
            raise ValueError("weights length must match tickers length.")
        if sum(v) == 0:
            raise ValueError("weights must sum to a non-zero value.")
        return v


class PortfolioMetricsResponse(BaseModel):
    tickers: List[str]
    weights: List[float]
    start_date: Optional[str]
    end_date: Optional[str]
    metrics: Dict[str, float]
    equity_curve: Dict[str, List[Any]]


class BacktestRequest(BaseModel):
    strategy: str = Field(..., description="buy_and_hold, sma_crossover, momentum, min_vol, mean_reversion")
    tickers: List[str] = Field(..., min_items=1)
    weights: Optional[List[float]] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = Field(
        None, description="Strategy-specific parameters (e.g., fast_window, slow_window)."
    )
    rebalance_frequency: Optional[str] = Field(
        None, description="none, monthly, quarterly, annual"
    )
    benchmark: Optional[str] = Field(
        None, description="Optional benchmark ticker for comparison/rolling beta."
    )
    transaction_cost_bps: Optional[float] = Field(0.0, description="Round-trip bps per rebalance.")

    @validator("strategy", allow_reuse=True)
    def validate_strategy(cls, v: str) -> str:
        strategy = v.lower()
        allowed = {"buy_and_hold", "sma_crossover", "momentum", "min_vol", "mean_reversion"}
        if strategy not in allowed:
            raise ValueError(f"strategy must be one of {', '.join(sorted(allowed))}")
        return strategy

    @validator("tickers", allow_reuse=True)
    def normalize_backtest_tickers(cls, v: List[str]) -> List[str]:
        tickers = [t.strip().upper() for t in v if t.strip()]
        if not tickers:
            raise ValueError("At least one ticker is required for a backtest.")
        return tickers

    @validator("weights", allow_reuse=True)
    def validate_backtest_weights(cls, v: Optional[List[float]], values: Dict[str, Any]) -> Optional[List[float]]:
        if v is None:
            return None
        tickers = values.get("tickers") or []
        if len(v) != len(tickers):
            raise ValueError("weights length must match tickers length.")
        if sum(v) == 0:
            raise ValueError("weights must sum to a non-zero value.")
        return v


class BacktestResponse(BaseModel):
    strategy: str
    parameters: Dict[str, Any]
    tickers: List[str]
    weights: List[float]
    start_date: Optional[str]
    end_date: Optional[str]
    metrics: Dict[str, float]
    equity_curve: Dict[str, List[Any]]
    returns: List[float]
    dates: List[str]
    benchmark: Optional[Dict[str, Any]] = None
    rolling_active: Optional[Dict[str, Any]] = None
    turnover: float = 0.0
    run_id: Optional[str] = None


class FactorExposureRequest(BaseModel):
    tickers: List[str]
    weights: Optional[List[float]] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class RiskBreakdownRequest(BaseModel):
    tickers: List[str]
    weights: Optional[List[float]] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class MonteCarloRequest(BaseModel):
    tickers: List[str]
    weights: Optional[List[float]] = None
    horizon_days: int = 252
    simulations: int = 10000
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    target_return: Optional[float] = None  # as decimal, e.g. 0.1 for 10%


class FrontierRequest(BaseModel):
    tickers: List[str]
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class StressTestRequest(BaseModel):
    tickers: List[str]
    weights: Optional[List[float]] = None
    scenario: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class PositionSizingRequest(BaseModel):
    ticker: str
    entry_price: float
    stop_price: float
    portfolio_value: float
    risk_per_trade_pct: float

    @validator("ticker", allow_reuse=True)
    def ticker_upper(cls, v: str) -> str:
        return v.upper().strip()

    @validator("entry_price", "stop_price", "portfolio_value", allow_reuse=True)
    def positive_values(cls, v: float, field):  # type: ignore
        if v <= 0:
            raise ValueError(f"{field.name} must be positive")
        return v

    @validator("risk_per_trade_pct", allow_reuse=True)
    def risk_pct_bounds(cls, v: float) -> float:
        if v <= 0 or v > 100:
            raise ValueError("risk_per_trade_pct must be between 0 and 100")
        return v


class PositionSizingResponse(BaseModel):
    ticker: str
    shares: int
    position_value: float
    risk_amount: float
    risk_pct_of_portfolio: float


class RebalanceRequest(BaseModel):
    tickers: List[str]
    current_weights: List[float]
    target_weights: List[float]
    portfolio_value: float
    prices: List[float]

    @validator("tickers", allow_reuse=True)
    def normalize_tickers(cls, v: List[str]) -> List[str]:
        tickers = [t.strip().upper() for t in v if t.strip()]
        if not tickers:
            raise ValueError("At least one ticker is required.")
        return tickers

    @validator("current_weights", "target_weights", "prices", allow_reuse=True)
    def lengths_match(cls, v: List[float], values: Dict[str, Any], field):  # type: ignore
        tickers = values.get("tickers") or []
        if tickers and len(v) != len(tickers):
            raise ValueError(f"{field.name} length must match tickers length")
        return v

    @validator("portfolio_value", allow_reuse=True)
    def positive_portfolio(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("portfolio_value must be positive")
        return v


class RebalanceResponse(BaseModel):
    trades: List[Dict[str, Any]]
    estimated_turnover_pct: float


class PositionSizingRequest(BaseModel):
    ticker: str
    entry_price: float
    stop_price: float
    portfolio_value: float
    risk_per_trade_pct: float

    @validator("ticker")
    def ticker_upper(cls, v: str) -> str:
        return v.upper().strip()

    @validator("entry_price", "stop_price", "portfolio_value")
    def positive_values(cls, v: float, field):  # type: ignore
        if v <= 0:
            raise ValueError(f"{field.name} must be positive")
        return v

    @validator("risk_per_trade_pct")
    def risk_pct_bounds(cls, v: float) -> float:
        if v <= 0 or v > 100:
            raise ValueError("risk_per_trade_pct must be between 0 and 100")
        return v


class RebalanceRequest(BaseModel):
    tickers: List[str]
    current_weights: List[float]
    target_weights: List[float]
    portfolio_value: float
    prices: List[float]

    @validator("tickers")
    def normalize_tickers(cls, v: List[str]) -> List[str]:
        tickers = [t.strip().upper() for t in v if t.strip()]
        if not tickers:
            raise ValueError("At least one ticker is required.")
        return tickers

    @validator("current_weights", "target_weights", "prices")
    def lengths_match(cls, v: List[float], values: Dict[str, Any], field):  # type: ignore
        if not isinstance(v, list):
            raise ValueError(f"{field.name} must be a list")
        tickers = values.get("tickers") or []
        if tickers and len(v) != len(tickers):
            raise ValueError(f"{field.name} length must match tickers length")
        return v

    @validator("portfolio_value")
    def positive_portfolio(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("portfolio_value must be positive")
        return v


class DashboardRequest(BaseModel):
    tickers: List[str]
    quantities: List[float]
    prices: List[float]
    cost_basis: List[float]
    target_weights: List[float]
    start_date: Optional[str] = None
    end_date: Optional[str] = None

    @validator("tickers", allow_reuse=True)
    def normalize_dash_tickers(cls, v: List[str]) -> List[str]:
        tickers = [t.strip().upper() for t in v if t.strip()]
        if not tickers:
            raise ValueError("At least one ticker is required.")
        return tickers

    @validator("quantities", "prices", "cost_basis", "target_weights", allow_reuse=True)
    def dash_lengths(cls, v: List[float], values: Dict[str, Any], field):  # type: ignore
        tickers = values.get("tickers") or []
        if tickers and len(v) != len(tickers):
            raise ValueError(f"{field.name} length must match tickers length")
        return v


class BenchmarkRequest(BaseModel):
    tickers: List[str]
    weights: Optional[List[float]] = None
    benchmark: str = "SPY"
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class SavePresetRequest(BaseModel):
    name: str
    tickers: List[str]
    weights: Optional[List[float]] = None


class StrategyBuilderRequest(BaseModel):
    tickers: List[str]
    weights: Optional[List[float]] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    rules: List[StrategyRule]
    stop_loss: Optional[float] = Field(None, description="e.g. 0.1 for 10% drop")
    take_profit: Optional[float] = Field(None, description="e.g. 0.2 for 20% gain")
    benchmark: Optional[str] = None

    @validator("rules", pre=True, each_item=True, allow_reuse=True)
    def validate_rules(cls, v: Any) -> StrategyRule:
        return v if isinstance(v, StrategyRule) else StrategyRule(**v)


class DashboardRequest(BaseModel):
    tickers: List[str]
    quantities: List[float]
    prices: List[float]
    cost_basis: List[float]
    target_weights: List[float]
    start_date: Optional[str] = None
    end_date: Optional[str] = None

    @validator("tickers")
    def normalize_dash_tickers(cls, v: List[str]) -> List[str]:
        tickers = [t.strip().upper() for t in v if t.strip()]
        if not tickers:
            raise ValueError("At least one ticker is required.")
        return tickers

    @validator("quantities", "prices", "cost_basis", "target_weights")
    def dash_lengths(cls, v: List[float], values: Dict[str, Any], field):  # type: ignore
        tickers = values.get("tickers") or []
        if tickers and len(v) != len(tickers):
            raise ValueError(f"{field.name} length must match tickers length")
        return v


class DashboardResponse(BaseModel):
    top_risk_contributors: List[Dict[str, Any]]
    overweight_underweight: List[Dict[str, Any]]
    largest_drawdowns: List[Dict[str, Any]]
    rebalance: RebalanceResponse
