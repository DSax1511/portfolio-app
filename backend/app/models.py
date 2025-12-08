from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, validator

from .infra.utils import IndicatorSpec, StrategyRule


class ApiError(BaseModel):
    detail: str


class MetricMethodology(BaseModel):
    title: str
    description: str
    window_length: Optional[str] = None
    assumptions: Optional[str] = None


class MetricMetadata(BaseModel):
    is_significant: Optional[bool] = None
    methodology_id: Optional[str] = None
    methodology: Optional[MetricMethodology] = None
    p_value: Optional[float] = None


class Position(BaseModel):
    ticker: str
    description: str
    quantity: float
    cost_basis: float
    avg_cost: float
    current_price: float
    market_value: float
    pnl: float

class PositionLot(BaseModel):
    symbol: str
    lot_id: str
    quantity: float
    cost_basis: float
    purchase_date: date
    current_price: float

    @validator("symbol", allow_reuse=True)
    def normalize_symbol(cls, value: str) -> str:
        return value.strip().upper()

    @validator("quantity", "cost_basis", "current_price", allow_reuse=True)
    def require_positive(cls, value: float, field) -> float:  # type: ignore
        if value <= 0:
            raise ValueError(f"{field.name} must be greater than zero")
        return value


class HarvestCandidate(BaseModel):
    symbol: str
    lot_id: str
    quantity: float
    cost_basis: float
    current_price: float
    purchase_date: date
    unrealized_pl: float
    unrealized_pl_pct: float
    days_held: int
    wash_sale_risk: bool


class TaxHarvestSummary(BaseModel):
    total_unrealized_losses: float
    max_harvestable_loss: float
    target_loss_to_realize: float
    estimated_tax_savings: float
    marginal_tax_rate: float


class TaxHarvestResponse(BaseModel):
    summary: TaxHarvestSummary
    candidates: List[HarvestCandidate]
    selected_candidates: List[HarvestCandidate]


class TaxHarvestRequest(BaseModel):
    portfolio_id: str
    date_range: Literal["1Y", "3Y", "5Y", "MAX"]
    realized_gains_to_offset: float = Field(0.0, ge=0.0)
    target_fraction_of_gains: float = Field(1.0, ge=0.0, le=1.0)
    benchmark: Optional[str] = None
    marginal_tax_rate: float = Field(0.25, ge=0.0, le=1.0)

    @validator("portfolio_id", allow_reuse=True)
    def normalize_portfolio_id(cls, value: str) -> str:
        return value.strip().lower()


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
    metric_metadata: Optional[Dict[str, MetricMetadata]] = None
    start_date: Optional[str]
    end_date: Optional[str]
    metrics: Dict[str, float]
    equity_curve: Dict[str, List[Any]]
    benchmark: Optional[Dict[str, Any]] = None
    commentary: Optional[Dict[str, Any]] = None


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
    commentary: Optional[Dict[str, Any]] = None


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


class RunRecord(BaseModel):
    id: str
    kind: str
    timestamp: str
    params: Dict[str, Any]
    stats: Dict[str, Any]
    meta: Optional[Dict[str, Any]] = None
    dates: Optional[List[str]] = None
    returns: Optional[List[float]] = None


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


class Trade(BaseModel):
    timestamp: str
    side: str
    size: float
    price: float
    pnl: float


class QuantStrategyConfig(BaseModel):
    symbol: str
    timeframe: str = "1D"
    start_date: str
    end_date: str
    initial_capital: float = 100000.0
    position_mode: str = Field("long_flat", description="long_only, long_flat, or long_short")
    sma_fast: int = 10
    sma_slow: int = 30
    rsi_period: int = 14
    rsi_overbought: float = 70.0
    rsi_oversold: float = 30.0
    use_sma: bool = True
    use_rsi: bool = False


class QuantBacktestRequest(BaseModel):
    strategy: QuantStrategyConfig
    slippage_bps: float = 0.5
    commission_per_trade: float = 0.0
    max_position_size: float = 1.0
    benchmark: Optional[str] = "SPY"


class QuantBacktestResponse(BaseModel):
    dates: List[str]
    equity_curve: List[float]
    benchmark_equity: List[float]
    returns: List[float]
    benchmark_returns: List[float]
    trades: List[Trade]
    summary: Dict[str, float]
    metric_metadata: Optional[Dict[str, MetricMetadata]] = None


class PMBacktestRequest(BaseModel):
    tickers: List[str]
    weights: Optional[List[float]] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    rebalance_freq: Optional[str] = Field("none", description="none, monthly, quarterly, annual")
    benchmark: Optional[str] = Field("SPY", description="Benchmark ticker, defaults to SPY")
    trading_cost_bps: Optional[float] = Field(0.0, description="Trading cost in basis points per 100% turnover")

    @validator("tickers", allow_reuse=True)
    def normalize_pm_tickers(cls, v: List[str]) -> List[str]:
        tickers = [t.strip().upper() for t in v if t.strip()]
        if not tickers:
            raise ValueError("At least one ticker is required.")
        return tickers

    @validator("weights", allow_reuse=True)
    def validate_pm_weights(cls, v: Optional[List[float]], values: Dict[str, Any]) -> Optional[List[float]]:
        if v is None:
            return None
        tickers = values.get("tickers") or []
        if len(v) != len(tickers):
            raise ValueError("weights length must match tickers length.")
        if sum(v) == 0:
            raise ValueError("weights must sum to a non-zero value.")
        return v

    @validator("trading_cost_bps", allow_reuse=True)
    def validate_trading_costs(cls, v: Optional[float]) -> float:
        if v is None:
            return 0.0
        if v < 0:
            raise ValueError("trading_cost_bps must be non-negative")
        return v


class PMBacktestResponse(BaseModel):
    dates: List[str]
    portfolio_equity: List[float]
    benchmark_equity: List[float]
    portfolio_returns: List[float]
    benchmark_returns: List[float]
    summary: Dict[str, float]
    metric_metadata: Optional[Dict[str, MetricMetadata]] = None
    run_id: Optional[str] = None
    analytics: Optional[Dict[str, Any]] = None


class AllocationItem(BaseModel):
    ticker: str
    name: Optional[str] = None
    weight: float
    target_weight: Optional[float] = None
    drift: Optional[float] = None
    value: Optional[float] = None
    asset_class: Optional[str] = None
    sector: Optional[str] = None


class PMAllocationRequest(BaseModel):
    tickers: List[str]
    quantities: Optional[List[float]] = None
    prices: Optional[List[float]] = None
    target_weights: Optional[List[float]] = None
    tolerance: Optional[float] = Field(0.02, description="Drift tolerance; default 2%")

    @validator("tickers", allow_reuse=True)
    def normalize_alloc_tickers(cls, v: List[str]) -> List[str]:
        tickers = [t.strip().upper() for t in v if t.strip()]
        if not tickers:
            raise ValueError("At least one ticker is required.")
        return tickers

    @validator("quantities", "prices", "target_weights", allow_reuse=True)
    def validate_lengths(cls, v: Optional[List[float]], values: Dict[str, Any], field) -> Optional[List[float]]:
        if v is None:
            return None
        tickers = values.get("tickers") or []
        if tickers and len(v) != len(tickers):
            raise ValueError(f"{field.name} length must match tickers length.")
        return v


class PMAllocationResponse(BaseModel):
    items: List[AllocationItem]
    as_of: str
    total_value: Optional[float] = None
    summary: Dict[str, float]


class MicrostructureRequest(BaseModel):
    symbol: str
    start_date: str
    end_date: str
    bar_interval: str = "1d"

    @validator("symbol", allow_reuse=True)
    def symbol_upper(cls, v: str) -> str:
        return v.strip().upper()


class MicrostructureBar(BaseModel):
    timestamp: str
    midprice: float
    return_: float
    next_return: Optional[float] = None
    volume: float
    order_flow_proxy: float
    spread_proxy: Optional[float] = None


class MicrostructureSummary(BaseModel):
    avg_spread: Optional[float] = None
    median_spread: Optional[float] = None
    avg_volume: float
    volatility: float
    of_next_return_corr: Optional[float] = None


class MicrostructureResponse(BaseModel):
    symbol: str
    bar_interval: str
    as_of: str
    bars: List[MicrostructureBar]
    summary: MicrostructureSummary


class RegimePoint(BaseModel):
    timestamp: str
    price: float
    return_: float
    regime: int


class RegimeStats(BaseModel):
    regime: int
    n_obs: int
    pct_time: float
    avg_return: float
    vol: float
    sharpe: float
    max_drawdown: float


class RegimeSummary(BaseModel):
    symbol: str
    start_date: str
    end_date: str
    n_states: int
    overall_vol: float
    overall_sharpe: float
    regimes: List[RegimeStats]


class RegimeRequest(BaseModel):
    symbol: str
    start_date: str
    end_date: str
    n_states: int = 3
    model_type: str = "threshold"

    @validator("symbol", allow_reuse=True)
    def regime_symbol(cls, v: str) -> str:
        return v.strip().upper()


class RegimeResponse(BaseModel):
    summary: RegimeSummary
    series: List[RegimePoint]
    regime_probabilities: Optional[List[List[float]]] = None


# Resolve forward references for pydantic
RegimeResponse.update_forward_refs(RegimeSummary=RegimeSummary, RegimePoint=RegimePoint)
