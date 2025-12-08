"""
RT-TSMOM Pydantic Schemas

Note: These schemas are unused in the current implementation.
Models were placed in models.py instead for consistency with project structure.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel


class RTTSMOMRequest(BaseModel):
    """Request schema for RT-TSMOM (Regime-Tuned Time-Series Momentum) backtest."""

    tickers: List[str] = [
        "XLK", "XLE", "XLF", "XLI", "XLP",
        "XLU", "XLV", "XLY", "XLRE", "XLC", "XLB"
    ]
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    lookback: int = 252
    target_vol: float = 0.10
    regime_scaling: float = 0.5
    use_regime: bool = True
    rebalance_freq: str = "monthly"


class RegimePerformance(BaseModel):
    """Performance breakdown by regime."""

    risk_on_periods: int
    risk_off_periods: int


class RTTSMOMMetrics(BaseModel):
    """Performance metrics for RT-TSMOM strategy."""

    total_return: float
    annualized_return: float
    annualized_volatility: float
    sharpe_ratio: float
    max_drawdown: float
    calmar_ratio: float


class RTTSMOMResponse(BaseModel):
    """Response schema for RT-TSMOM backtest."""

    dates: List[str]
    equity_curve: List[float]
    returns: List[float]
    metrics: Dict[str, float]
    regime_performance: Dict[str, Any]
    strategy_name: str = "RT-TSMOM"
    description: str = "Regime-Tuned Time-Series Momentum with volatility targeting"


# Additional helper schemas (unused)
class PortfolioWeights(BaseModel):
    """Portfolio weights at a given time."""

    date: str
    weights: Dict[str, float]
    regime: str  # "risk_on" or "risk_off"


class BacktestDiagnostics(BaseModel):
    """Detailed diagnostics for backtest."""

    rebalance_dates: List[str]
    turnover: float
    avg_leverage: float
    regime_breakdown: RegimePerformance
