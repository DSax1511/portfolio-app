from __future__ import annotations

import os
import csv
import datetime as dt
import io
import json
import logging
import math
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
import yaml
import yfinance as yf
from fastapi import FastAPI, File, HTTPException, UploadFile, Request
from fastapi.middleware.cors import CORSMiddleware

from . import analytics, backtests, commentary, optimizers_v2, covariance_estimation, factor_models, backtesting, quant_strategies, factor_attribution
from .quant_engine import run_quant_backtest
from .quant_regimes import detect_regimes
from .quant import (
    advanced_strategies,
    risk_analytics,
    live_trading,
)
from .analytics_pipeline import portfolio_analytics, backtest_analytics
from .analytics import (
    attribution_allocation_selection,
    benchmark_compare,
    compute_performance_stats,
    equity_curve_payload,
    factor_regression,
    portfolio_dashboard,
    risk_breakdown,
    scenario_shocks,
)
from .backtests import (
    apply_rebalance,
    run_buy_and_hold,
    run_mean_reversion,
    run_min_vol,
    run_momentum,
    run_sma_crossover,
    run_strategy_builder,
)
from .config import settings
from .data import fetch_price_history
from .infra.logging_utils import log_run, timed
from .infra.utils import IndicatorSpec, StrategyRule, normalize_weights, parse_number, weighted_portfolio_price
from .infra.rate_limit import rate_limit_check
from .core.errors import ErrorCode, ApiErrorResponse, error_response
from .quant_microstructure import compute_microstructure
from .models import (
    ApiError,
    BacktestRequest,
    BacktestResponse,
    BenchmarkRequest,
    DashboardRequest,
    DashboardResponse,
    FactorExposureRequest,
    FrontierRequest,
    MonteCarloRequest,
    PortfolioMetricsRequest,
    PortfolioMetricsResponse,
    Position,
    PositionSizingRequest,
    PositionSizingResponse,
    RebalanceRequest,
    RebalanceResponse,
    QuantBacktestRequest,
    QuantBacktestResponse,
    RegimeRequest,
    RegimeResponse,
    PMBacktestRequest,
    PMBacktestResponse,
    MicrostructureRequest,
    MicrostructureResponse,
    PMAllocationRequest,
    PMAllocationResponse,
    RiskBreakdownRequest,
    SavePresetRequest,
    StrategyBuilderRequest,
    StressTestRequest,
    TaxHarvestRequest,
    TaxHarvestResponse,
    TaxHarvestCandidate,
    TaxHarvestSummary,
)
from .rebalance import position_sizing, suggest_rebalance


app = FastAPI(title="Portfolio Quant API", version="2.0.0")

# CORS origins:
# - Local dev: Vite/React ports and FastAPI default port.
# - Production: configure via BACKEND_CORS_ORIGINS env (comma-separated), e.g., https://saxtonpi.com, https://www.saxtonpi.com, Render backend URL.
# - Vercel previews are allowed via allow_origin_regex to match https://*.vercel.app
cors_env = os.getenv("BACKEND_CORS_ORIGINS")
if cors_env:
    origins = [o.strip() for o in cors_env.split(",") if o.strip()]
else:
    origins = [
        "http://localhost:4173",
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:8000",
        "https://saxtonpi.com",
        "https://www.saxtonpi.com",
        "https://portfolio-app-6lfb.onrender.com",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Log effective CORS configuration for debugging (Render logs)
logging.getLogger("uvicorn.error").info("CORS allow_origins=%s allow_origin_regex=%s", origins, r"https://.*\.vercel\.app")

logger = logging.getLogger("app")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO)


@app.get("/api/health")
def health_check() -> Dict[str, str]:
    """
    Health check endpoint for monitoring and load balancers.

    Returns simple status indicator to verify API is running.
    """
    return {"status": "ok"}

# Friendly root health for infra checks
@app.get("/health")
def health_root() -> Dict[str, str]:
    """
    Root health check for infrastructure monitoring.

    Alternative endpoint for platforms that expect /health without prefix.
    """
    return {"status": "ok"}


@app.get("/api/portfolio", response_model=List[Position])
def get_portfolio() -> List[Position]:
    """
    Retrieve current portfolio positions.

    Returns empty list as placeholder for future implementation.
    """
    return []


@app.post("/api/upload-positions", response_model=List[Position])
async def upload_positions(file: UploadFile = File(...)) -> List[Position]:
    """
    Upload portfolio positions from CSV file.

    Expected CSV columns: Symbol, Qty (Quantity), Cost Basis, Description.
    Fetches current prices from yfinance and calculates P&L for each position.

    Returns list of Position objects with current market values.
    """
    content = await file.read()
    text = content.decode("utf-8")

    reader = csv.DictReader(io.StringIO(text))
    positions: List[Position] = []

    for row in reader:
        symbol_raw = (row.get("Symbol") or "").strip()
        if not symbol_raw:
            continue

        qty_str = row.get("Qty (Quantity)")
        cost_str = row.get("Cost Basis")
        desc = (row.get("Description") or "").strip()

        quantity = parse_number(qty_str)
        cost_basis = parse_number(cost_str)

        if quantity <= 0 or cost_basis <= 0:
            continue

        ticker = symbol_raw.upper()
        avg_cost = cost_basis / quantity if quantity > 0 else 0.0

        # Fetch current price with error handling
        try:
            quote = yf.Ticker(ticker).history(period="1d")
            current_price = float(quote["Close"].iloc[-1]) if not quote.empty else avg_cost
        except Exception as exc:
            logger.warning(f"Failed to fetch price for {ticker}: {exc}")
            current_price = avg_cost

        market_value = current_price * quantity
        pnl = market_value - cost_basis

        positions.append(
            Position(
                ticker=ticker,
                description=desc,
                quantity=quantity,
                cost_basis=cost_basis,
                avg_cost=avg_cost,
                current_price=current_price,
                market_value=market_value,
                pnl=pnl,
            )
        )

    if not positions:
        raise HTTPException(status_code=400, detail="No valid positions found in the uploaded CSV.")

    return positions


@app.post("/api/portfolio-metrics", response_model=PortfolioMetricsResponse, responses={400: {"model": ApiError}})
def portfolio_metrics(request: PortfolioMetricsRequest) -> PortfolioMetricsResponse:
    """
    Calculate comprehensive portfolio performance metrics.

    Takes tickers and weights, computes returns, volatility, Sharpe ratio, and benchmarks against SPY.
    Returns metrics, equity curves, and AI-generated commentary.
    """
    prices = fetch_price_history(request.tickers, request.start_date, request.end_date)
    weights = normalize_weights(request.tickers, request.weights)
    portfolio_returns = analytics.compute_portfolio_returns(prices, weights)

    stats = compute_performance_stats(portfolio_returns)
    curve = equity_curve_payload(portfolio_returns)

    # SPY benchmark
    benchmark_symbol = "SPY"
    bench_prices = fetch_price_history([benchmark_symbol], request.start_date, request.end_date)
    bench_returns = bench_prices.pct_change().dropna().iloc[:, 0]
    bench_returns = bench_returns.reindex(portfolio_returns.index).ffill().bfill()
    bench_curve = equity_curve_payload(bench_returns)
    combined_curve = analytics.combined_equity_vs_benchmark(portfolio_returns, bench_returns)
    benchmark_payload = {
        "benchmark": benchmark_symbol,
        "dates": combined_curve["dates"],
        "returns": [float(r) for r in bench_returns],
        "equity_curve": bench_curve,
        "relative": combined_curve["relative"],
    }

    commentary_payload = commentary.build_commentary(
        portfolio_returns,
        bench_returns,
        stats,
        drawdowns=None,
        rolling_vol=None,
        rolling_sharpe=None,
        weights=weights,
        tickers=request.tickers,
        scenarios=None,
    )

    return PortfolioMetricsResponse(
        tickers=request.tickers,
        weights=weights,
        start_date=curve["dates"][0] if curve["dates"] else request.start_date,
        end_date=curve["dates"][-1] if curve["dates"] else request.end_date,
        metrics=stats,
        equity_curve=curve,
        benchmark=benchmark_payload,
        commentary=commentary_payload,
    )


def _build_tax_notes(summary: TaxHarvestSummary, realized_target: float, offset_pct: float) -> List[str]:
    notes = [
        "Tax-loss harvesting can offset realized gains and up to $3k of ordinary income; track realized gains when pairing trades.",
        "Wash-sale rules require waiting 31 days before buying the same ticker or a substantially identical security.",
    ]
    if realized_target > 0:
        notes.insert(
            0,
            f"Targeting {int(offset_pct * 100)}% of your realized gains (${realized_target:,.2f}) with today's loss candidates.",
        )
    return notes


@app.post("/api/tax-harvest", response_model=TaxHarvestResponse, responses={400: {"model": ApiError}})
def tax_harvest(request: TaxHarvestRequest) -> TaxHarvestResponse:
    """
    Suggest tax-loss harvesting candidates based on unrealized losses.
    """
    if not request.positions:
        raise HTTPException(status_code=400, detail="Provide at least one position for tax-loss harvesting analysis.")

    candidates = []
    for pos in request.positions:
        market_value = pos.quantity * pos.current_price
        pnl = market_value - pos.cost_basis
        if pnl >= 0:
            continue

        loss_amount = -pnl
        loss_pct = (loss_amount / pos.cost_basis) if pos.cost_basis else 0.0
        candidate = TaxHarvestCandidate(
            ticker=pos.ticker,
            description=pos.description,
            quantity=pos.quantity,
            market_value=round(market_value, 2),
            pnl=round(pnl, 2),
            loss_amount=round(loss_amount, 2),
            loss_pct=round(loss_pct, 4),
            suggestion=f"Trim {pos.ticker} to harvest up to ${loss_amount:,.0f} in losses.",
            replacement_note="Replace with a diversified proxy or similar sector ETF after the 31-day wash-sale window.",
        )
        candidates.append(candidate)

    if not candidates:
        raise HTTPException(status_code=400, detail="No loss positions found to harvest.")

    candidates.sort(key=lambda c: c.loss_amount, reverse=True)
    total_loss = sum(c.loss_amount for c in candidates)
    target_offset = request.realized_gains * request.offset_target_pct
    offset_capacity = min(total_loss, target_offset) if target_offset > 0 else total_loss

    summary = TaxHarvestSummary(
        total_unrealized_loss=round(total_loss, 2),
        loss_positions=len(candidates),
        top_loss=round(candidates[0].loss_amount, 2),
        gain_offset_target=round(target_offset, 2),
        offset_capacity=round(offset_capacity, 2),
    )

    notes = _build_tax_notes(summary, target_offset, request.offset_target_pct)
    return TaxHarvestResponse(summary=summary, candidates=candidates[:6], notes=notes)


def _persist_run(kind: str, params: Dict[str, Any], returns: pd.Series, stats: Dict[str, Any], meta: Optional[Dict[str, Any]] = None) -> str:
    ts = dt.datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    run_id = f"{kind}_{ts}"
    payload = {
        "id": run_id,
        "kind": kind,
        "timestamp": ts,
        "params": params,
        "stats": stats,
        "equity": returns.head(10).tolist(),  # small slice to keep files light
        "dates": [d.strftime("%Y-%m-%d") for d in returns.index],
        "returns": [float(r) for r in returns],
    }
    if meta:
        payload["meta"] = meta
    log_run(settings.runs_dir / f"{run_id}.json", payload)
    return run_id


def _pm_summary(portfolio_returns: pd.Series, benchmark_returns: pd.Series) -> Dict[str, float]:
    periods = 252
    total_return = float((1 + portfolio_returns).prod() - 1)
    cagr = float((1 + total_return) ** (periods / len(portfolio_returns)) - 1) if len(portfolio_returns) else 0.0
    vol = float(portfolio_returns.std() * math.sqrt(periods)) if not portfolio_returns.empty else 0.0
    downside = portfolio_returns[portfolio_returns < 0].std() * math.sqrt(periods) if not portfolio_returns.empty else 0.0
    sharpe = cagr / vol if vol else 0.0
    sortino = cagr / downside if downside else 0.0

    equity = (1 + portfolio_returns).cumprod()
    drawdowns = equity / equity.cummax() - 1
    max_dd = float(drawdowns.min()) if not drawdowns.empty else 0.0

    bench_cagr = 0.0
    alpha = beta = tracking_error = None
    aligned = pd.concat([portfolio_returns, benchmark_returns], axis=1, join="inner").dropna()
    if not aligned.empty:
        bench = aligned.iloc[:, 1]
        port = aligned.iloc[:, 0]
        X = np.column_stack([np.ones(len(bench)), bench.values])
        betas, _, _, _ = np.linalg.lstsq(X, port.values, rcond=None)
        alpha = float(betas[0] * periods)
        beta = float(betas[1])
        active = port - bench
        tracking_error = float(active.std() * math.sqrt(periods)) if active.std() != 0 else 0.0
        bench_cagr = float((1 + bench).prod() ** (periods / len(bench)) - 1)

    return {
        "cagr": cagr,
        "benchmark_cagr": bench_cagr,
        "annualized_volatility": vol,
        "sharpe_ratio": sharpe,
        "sortino_ratio": sortino,
        "max_drawdown": max_dd,
        "beta": beta if beta is not None else 0.0,
        "alpha": alpha if alpha is not None else 0.0,
        "tracking_error": tracking_error if tracking_error is not None else 0.0,
    }


def _demo_pm_backtest(days: int = 180) -> PMBacktestResponse:
    rng = np.random.default_rng(42)
    dates = pd.date_range(end=dt.date.today(), periods=days, freq="B")
    portfolio_returns = pd.Series(rng.normal(0.0006, 0.01, size=len(dates)), index=dates)
    benchmark_returns = pd.Series(rng.normal(0.0005, 0.009, size=len(dates)), index=dates)
    portfolio_equity = (1 + portfolio_returns).cumprod()
    benchmark_equity = (1 + benchmark_returns).cumprod()
    summary = _pm_summary(portfolio_returns, benchmark_returns)
    return PMBacktestResponse(
        dates=[d.strftime("%Y-%m-%d") for d in dates],
        portfolio_equity=[float(v) for v in portfolio_equity],
        benchmark_equity=[float(v) for v in benchmark_equity],
        portfolio_returns=[float(r) for r in portfolio_returns],
        benchmark_returns=[float(r) for r in benchmark_returns],
        summary=summary,
    )


def _allocation_from_payload(request: PMAllocationRequest) -> PMAllocationResponse:
    tickers = request.tickers
    quantities = request.quantities
    prices = request.prices

    # If prices are missing, fetch latest close for the tickers
    if prices is None:
        price_df = fetch_price_history(tickers, None, None)
        latest = price_df.iloc[-1]
        prices = [float(latest[t]) for t in tickers]

    if quantities is None:
        # default 1 share each if not provided
        quantities = [1.0 for _ in tickers]

    market_values = [q * p for q, p in zip(quantities, prices)]
    total_value = sum(market_values) or 1.0
    weights = [mv / total_value for mv in market_values]

    if request.target_weights:
        target_weights = request.target_weights
    else:
        target_weights = [1 / len(tickers) for _ in tickers]

    drifts = [w - tw for w, tw in zip(weights, target_weights)]
    tolerance = request.tolerance or 0.02
    max_drift = max((abs(d) for d in drifts), default=0.0)
    outside = sum(1 for d in drifts if abs(d) > tolerance)
    turnover = sum(abs(d) for d in drifts) / 2

    items = []
    for t, w, tw, d, mv in zip(tickers, weights, target_weights, drifts, market_values):
        items.append(
            {
                "ticker": t,
                "weight": w,
                "target_weight": tw,
                "drift": d,
                "value": mv,
            }
        )

    return PMAllocationResponse(
        items=items,
        as_of=dt.datetime.utcnow().strftime("%Y-%m-%d"),
        total_value=total_value,
        summary={
            "max_drift": max_drift,
            "outside_tolerance": outside,
            "turnover_to_rebalance": turnover,
        },
    )


@app.post("/api/backtest", response_model=BacktestResponse, responses={400: {"model": ApiError}})
def backtest(request: BacktestRequest, http_request: Request) -> BacktestResponse:
    """
    Run strategy backtest with multiple built-in strategies.

    Supports buy-and-hold, SMA crossover, momentum, min-vol, and mean reversion.
    Returns performance metrics, equity curves, benchmark comparison, and turnover analysis.
    """
    # Rate limiting: expensive computational endpoint
    rate_limit_check(http_request, "/api/backtest", settings.rate_limit_backtest)

    prices = fetch_price_history(request.tickers, request.start_date, request.end_date)
    weights = normalize_weights(request.tickers, request.weights)

    params = request.parameters or {}
    turnover = pd.Series(dtype=float)
    with timed("backtest"):
        if request.strategy == "buy_and_hold":
            returns, turnover = run_buy_and_hold(prices, weights, request.rebalance_frequency, request.transaction_cost_bps or 0.0)
            used_params = {"rebalance_frequency": request.rebalance_frequency or "none", "transaction_cost_bps": request.transaction_cost_bps or 0.0}
        elif request.strategy == "sma_crossover":
            fast_window = int(params.get("fast_window", 20))
            slow_window = int(params.get("slow_window", 50))
            returns = run_sma_crossover(prices, weights, fast_window=fast_window, slow_window=slow_window)
            turnover = pd.Series(0.0, index=returns.index)
            used_params = {
                "fast_window": fast_window,
                "slow_window": slow_window,
                "rebalance_frequency": request.rebalance_frequency or "none",
                "transaction_cost_bps": request.transaction_cost_bps or 0.0,
            }
        elif request.strategy == "momentum":
            lookback = int(params.get("lookback", 126))
            top_n = int(params.get("top_n", min(3, len(request.tickers))))
            returns = run_momentum(prices, lookback=lookback, top_n=top_n, rebalance=request.rebalance_frequency or "monthly")
            turnover = pd.Series(0.0, index=returns.index)
            used_params = {"lookback": lookback, "top_n": top_n, "rebalance_frequency": request.rebalance_frequency or "monthly"}
        elif request.strategy == "min_vol":
            lookback = int(params.get("lookback", 63))
            top_n = int(params.get("top_n", min(3, len(request.tickers))))
            returns = run_min_vol(prices, lookback=lookback, top_n=top_n)
            turnover = pd.Series(0.0, index=returns.index)
            used_params = {"lookback": lookback, "top_n": top_n}
        elif request.strategy == "mean_reversion":
            window = int(params.get("window", 14))
            threshold = float(params.get("threshold", 30.0))
            returns = run_mean_reversion(prices, window=window, threshold=threshold)
            turnover = pd.Series(0.0, index=returns.index)
            used_params = {"window": window, "threshold": threshold}
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported strategy: {request.strategy}")

    stats = compute_performance_stats(returns)
    curve = equity_curve_payload(returns)
    turnover_metric = float(turnover.abs().sum()) if not turnover.empty else 0.0

    benchmark_payload = None
    rolling_payload = None
    benchmark_symbol = request.benchmark or "SPY"
    if benchmark_symbol:
        bench_prices = fetch_price_history([benchmark_symbol], request.start_date, request.end_date)
        bench_returns = bench_prices.pct_change().dropna().iloc[:, 0]
        bench_returns = bench_returns.reindex(returns.index).ffill().bfill()
        bench_curve = equity_curve_payload(bench_returns)
        combined_curve = analytics.combined_equity_vs_benchmark(returns, bench_returns)
        benchmark_payload = {
          "benchmark": benchmark_symbol,
          "dates": combined_curve["dates"],
          "returns": [float(r) for r in bench_returns],
          "equity_curve": bench_curve,
          "relative": combined_curve["relative"],
          "combined_curve": combined_curve,
        }
        rolling_payload = analytics.rolling_active_stats(returns, bench_returns)

    run_id = _persist_run("backtest", {"strategy": request.strategy, **used_params}, returns, stats)

    return BacktestResponse(
        strategy=request.strategy,
        parameters=used_params,
        tickers=request.tickers,
        weights=weights,
        start_date=curve["dates"][0] if curve["dates"] else request.start_date,
        end_date=curve["dates"][-1] if curve["dates"] else request.end_date,
        metrics=stats,
        equity_curve=curve,
        returns=[float(r) for r in returns],
        dates=[idx.strftime("%Y-%m-%d") for idx in returns.index],
        benchmark=benchmark_payload,
        rolling_active=rolling_payload,
        turnover=turnover_metric,
        run_id=run_id,
        commentary=commentary.build_commentary(
            returns,
            bench_returns if benchmark_payload else None,
            stats,
            drawdowns=None,
            rolling_vol=None,
            rolling_sharpe=None,
            weights=weights,
            tickers=request.tickers,
            scenarios=None,
        ),
    )


@app.post("/api/v1/pm/backtest", response_model=PMBacktestResponse, responses={400: {"model": ApiError}})
def pm_backtest(request: PMBacktestRequest) -> PMBacktestResponse:
    """
    Portfolio manager backtest with advanced analytics.

    Runs backtest with rebalancing and computes alpha, beta, tracking error against benchmark.
    Returns full analytics payload including risk decomposition and diagnostics.
    """
    prices = fetch_price_history(request.tickers, request.start_date, request.end_date)
    # Normalize to numpy for consistency; accept None or list input.
    weights_list = normalize_weights(request.tickers, request.weights)
    weights_array = np.asarray(weights_list, dtype=float)

    returns_df = prices.pct_change().dropna()
    portfolio_returns, _ = apply_rebalance(returns_df, weights_array, request.rebalance_freq or "none")

    benchmark_symbol = request.benchmark or "SPY"
    bench_prices = fetch_price_history([benchmark_symbol], request.start_date, request.end_date)
    bench_returns = bench_prices.pct_change().dropna().iloc[:, 0]
    bench_returns = bench_returns.reindex(portfolio_returns.index).ffill().bfill()

    # Align lengths and drop any remaining NaNs
    aligned = pd.concat([portfolio_returns, bench_returns], axis=1, join="inner").dropna()
    if aligned.empty:
        raise HTTPException(status_code=400, detail="Not enough overlapping data to run backtest.")
    portfolio_returns = aligned.iloc[:, 0]
    bench_returns = aligned.iloc[:, 1]

    portfolio_equity = (1 + portfolio_returns).cumprod()
    benchmark_equity = (1 + bench_returns).cumprod()
    dates = [d.strftime("%Y-%m-%d") for d in portfolio_equity.index]

    # Full analytics payload reused for risk/diagnostics
    analytics_payload = backtest_analytics(
        request.tickers,
        weights_array.tolist(),
        benchmark_symbol,
        request.start_date,
        request.end_date,
        request.rebalance_freq,
        request.trading_cost_bps or 0.0,
    )
    summary = analytics_payload.get("summary", {})

    run_id = _persist_run(
        "pm_backtest",
        {"tickers": request.tickers, "weights": weights_array.tolist(), "rebalance_freq": request.rebalance_freq or "none", "benchmark": benchmark_symbol},
        portfolio_returns,
        summary,
        meta={"label": f"PM {request.tickers}", "benchmark": benchmark_symbol},
    )
    analytics_payload["run_id"] = run_id

    return PMBacktestResponse(
        dates=dates,
        portfolio_equity=[float(v) for v in portfolio_equity],
        benchmark_equity=[float(v) for v in benchmark_equity],
        portfolio_returns=[float(r) for r in portfolio_returns],
        benchmark_returns=[float(r) for r in bench_returns],
        summary=summary,
        run_id=run_id,
        analytics=analytics_payload,
    )


@app.get("/api/v1/pm/backtest/demo", response_model=PMBacktestResponse)
def pm_backtest_demo() -> PMBacktestResponse:
    """
    Lightweight demo payload so the UI can render without live market data.
    """
    return _demo_pm_backtest()


@app.post("/api/v2/portfolio-analytics")
def v2_portfolio_analytics(request: Dict[str, Any]) -> Dict[str, Any]:
    """
    V2 portfolio analytics with position-based inputs.

    Takes tickers, quantities, and prices rather than weights. Computes comprehensive
    analytics including risk, attribution, and sector analysis.
    """
    tickers = request.get("tickers") or []
    quantities = request.get("quantities") or [1.0 for _ in tickers]
    prices = request.get("prices") or [1.0 for _ in tickers]
    benchmark = request.get("benchmark") or "SPY"
    start = request.get("start_date")
    end = request.get("end_date")
    sectors = request.get("sectors")
    if not tickers:
        raise HTTPException(status_code=400, detail="tickers required")
    return portfolio_analytics(tickers, quantities, prices, benchmark, start, end, sectors)


@app.post("/api/v2/backtest-analytics")
def v2_backtest_analytics(request: Dict[str, Any]) -> Dict[str, Any]:
    """
    V2 backtest analytics with flexible configuration.

    Runs backtest with specified weights and rebalancing, persists results to run history.
    Returns comprehensive analytics including rolling metrics and active returns.
    """
    tickers = request.get("tickers") or []
    weights = request.get("weights")
    benchmark = request.get("benchmark") or "SPY"
    start = request.get("start_date")
    end = request.get("end_date")
    rebalance_freq = request.get("rebalance_freq")
    trading_cost_bps = request.get("trading_cost_bps", 0.0)
    if not tickers:
        raise HTTPException(status_code=400, detail="tickers required")
    result = backtest_analytics(tickers, weights, benchmark, start, end, rebalance_freq, trading_cost_bps)
    try:
        run_id = _persist_run(
            "backtest",
            {
                "tickers": tickers,
                "weights": weights,
                "benchmark": benchmark,
                "rebalance_freq": rebalance_freq or "none",
                "trading_cost_bps": trading_cost_bps,
            },
            pd.Series(result.get("returns") or []),
            result.get("summary") or {},
            meta={"label": f"{tickers}", "benchmark": benchmark},
        )
        result["run_id"] = run_id
    except Exception as exc:
        logger.exception("Failed to persist backtest run: %s", exc)
    return result


@app.post("/api/v1/pm/allocation", response_model=PMAllocationResponse, responses={400: {"model": ApiError}})
def pm_allocation(request: PMAllocationRequest) -> PMAllocationResponse:
    """
    Portfolio allocation analysis with drift tracking.

    Compares current weights to target weights, identifies positions outside tolerance,
    and computes turnover required for rebalancing.
    """
    try:
        return _allocation_from_payload(request)
    except Exception as exc:
        logger.exception("pm_allocation error")
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/v1/quant/backtest", response_model=QuantBacktestResponse, responses={400: {"model": ApiError}})
def quant_backtest(request: QuantBacktestRequest) -> QuantBacktestResponse:
    """
    Quantitative strategy backtest with trade-level analysis.

    Runs strategy engine with entry/exit rules, computes trade statistics including
    win rate, average win/loss, and risk-adjusted returns.
    """
    payload = run_quant_backtest(request)
    summary = _pm_summary(
        pd.Series(payload["returns"], index=pd.to_datetime(payload["dates"])),
        pd.Series(payload["benchmark_returns"], index=pd.to_datetime(payload["dates"])),
    )

    # Trade-level stats
    wins = [t.pnl for t in payload["trades"] if t.pnl > 0]
    losses = [t.pnl for t in payload["trades"] if t.pnl < 0]
    trade_count = len(payload["trades"])
    win_rate = float(len(wins) / trade_count) if trade_count else 0.0
    avg_win = float(np.mean(wins)) if wins else 0.0
    avg_loss = float(np.mean(losses)) if losses else 0.0

    summary.update(
        {
            "win_rate": win_rate,
            "avg_win": avg_win,
            "avg_loss": avg_loss,
        }
    )

    return QuantBacktestResponse(
        dates=payload["dates"],
        equity_curve=payload["equity_curve"],
        benchmark_equity=payload["benchmark_equity"],
        returns=payload["returns"],
        benchmark_returns=payload["benchmark_returns"],
        trades=payload["trades"],
        summary=summary,
    )


@app.post("/api/v1/quant/regimes", response_model=RegimeResponse, responses={400: {"model": ApiError}})
def quant_regimes(request: RegimeRequest) -> RegimeResponse:
    """
    Market regime detection using Hidden Markov Models.

    Identifies bull/bear market regimes based on volatility and trend patterns.
    Returns regime labels, transition probabilities, and confidence scores.
    """
    try:
        return detect_regimes(request)
    except Exception as exc:
        logger.exception("quant_regimes error")
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/v1/quant/microstructure", response_model=MicrostructureResponse, responses={400: {"model": ApiError}})
def microstructure(request: MicrostructureRequest) -> MicrostructureResponse:
    """
    Market microstructure analysis for trading costs and liquidity.

    Computes bid-ask spreads, price impact, volatility clustering, and execution quality metrics.
    Useful for understanding transaction costs and optimal trade sizing.
    """
    return compute_microstructure(request)


# Runs API (lightweight file-backed history)
def _load_run(run_id: str) -> Dict[str, Any]:
    path = settings.runs_dir / f"{run_id}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Run not found")
    with path.open() as f:
        return json.load(f)


def _list_runs(limit: int = 20) -> List[Dict[str, Any]]:
    paths = sorted(settings.runs_dir.glob("*.json"), reverse=True)
    runs: List[Dict[str, Any]] = []
    for path in paths[:limit]:
        try:
          with path.open() as f:
            runs.append(json.load(f))
        except Exception:
          continue
    return runs


@app.get("/api/runs", response_model=List[Dict[str, Any]])
def list_runs(limit: int = 20) -> List[Dict[str, Any]]:
    """
    List recent backtest run history.

    Returns most recent run metadata with timestamps and performance summaries.
    """
    return _list_runs(limit)


@app.get("/api/runs/latest", response_model=Dict[str, Any])
def latest_run() -> Dict[str, Any]:
    """
    Get most recent backtest run.

    Returns latest run details with full metrics and configuration.
    """
    runs = _list_runs(1)
    if not runs:
        raise HTTPException(status_code=404, detail="No runs found")
    return runs[0]


@app.get("/api/runs/{run_id}", response_model=Dict[str, Any])
def get_run(run_id: str) -> Dict[str, Any]:
    """
    Retrieve specific backtest run by ID.

    Returns full run details including parameters, metrics, and time series data.
    """
    return _load_run(run_id)


@app.post("/api/backtest-config", response_model=BacktestResponse, responses={400: {"model": ApiError}})
def backtest_from_config(payload: Dict[str, Any]) -> BacktestResponse:
    """
    Accepts either YAML or JSON payload describing a BacktestRequest.
    """
    config = payload.get("config")
    if isinstance(config, str):
        parsed = yaml.safe_load(config)
    else:
        parsed = config or payload
    request = BacktestRequest(**parsed)
    return backtest(request)


@app.post("/api/factor-exposures")
def factor_exposures(request: FactorExposureRequest) -> Dict[str, Any]:
    """
    Calculate factor exposures using regression analysis.

    Computes loadings to common risk factors like market, size, value, and momentum.
    Returns factor betas and R-squared values.
    """
    logger.info("factor_exposures: tickers=%s start=%s end=%s", request.tickers, request.start_date, request.end_date)
    prices = fetch_price_history(request.tickers, request.start_date, request.end_date)
    weights = normalize_weights(request.tickers, request.weights)
    portfolio_returns = analytics.compute_portfolio_returns(prices, weights)
    exposures = factor_regression(portfolio_returns, request.start_date, request.end_date)
    return exposures


@app.post("/api/risk-breakdown")
def risk_breakdown_endpoint(request: RiskBreakdownRequest) -> Dict[str, Any]:
    """
    Decompose portfolio risk into individual asset contributions.

    Computes marginal and component risk for each position, showing which assets
    contribute most to portfolio volatility.
    """
    logger.info("risk_breakdown: tickers=%s", request.tickers)
    prices = fetch_price_history(request.tickers, request.start_date, request.end_date)
    weights = normalize_weights(request.tickers, request.weights)
    breakdown = risk_breakdown(prices, weights)
    return breakdown


@app.post("/api/monte-carlo")
def monte_carlo(request: MonteCarloRequest, http_request: Request) -> Dict[str, Any]:
    """
    Run Monte Carlo simulation for portfolio projections.

    Simulates thousands of possible future paths based on historical returns and correlations.
    Returns probability of loss, target return achievement, and distribution statistics.
    """
    # Rate limiting: expensive Monte Carlo simulations
    rate_limit_check(http_request, "/api/monte-carlo", settings.rate_limit_optimization)

    logger.info("monte_carlo: tickers=%s horizon=%s sims=%s", request.tickers, request.horizon_days, request.simulations)
    prices = fetch_price_history(request.tickers, request.start_date, request.end_date)
    weights = normalize_weights(request.tickers, request.weights)
    rets = prices.pct_change().dropna()
    mean = rets.mean().values
    cov = rets.cov().values
    w = np.array(weights)
    sims = np.random.multivariate_normal(mean, cov, size=(request.simulations, request.horizon_days))
    port_paths = (1 + sims @ w).cumprod(axis=1)
    final_values = port_paths[:, -1]
    prob_loss_20 = float((final_values < 0.8).mean())
    target_value = 1 + (request.target_return or 0.2)
    prob_target = float((final_values >= target_value).mean())
    return {
        "prob_loss_20": prob_loss_20,
        "prob_target": prob_target,
        "min": float(final_values.min()),
        "max": float(final_values.max()),
        "median": float(np.median(final_values)),
    }


@app.post("/api/efficient-frontier")
def efficient_frontier(request: FrontierRequest, http_request: Request) -> Dict[str, Any]:
    """
    Compute efficient frontier using CVXPY-based convex optimization.

    This endpoint now uses analytical quadratic programming instead of Monte Carlo sampling,
    guaranteeing optimal solutions with faster convergence and better numerical stability.

    Includes optional Ledoit-Wolf covariance shrinkage for improved estimation in
    high-dimensional settings (many assets, limited history).
    
    Rate limit: 20 requests per minute per client IP.
    """
    # Rate limiting: expensive computational endpoint
    rate_limit_check(http_request, "/api/efficient-frontier", settings.rate_limit_optimization)
    
    logger.info("efficient_frontier: tickers=%s", request.tickers)
    prices = fetch_price_history(request.tickers, request.start_date, request.end_date)
    rets = prices.pct_change().dropna()

    # Use new CVXPY-based optimizer with covariance shrinkage
    use_shrinkage = len(request.tickers) > 10  # Auto-enable for 10+ assets
    frontier = optimizers_v2.markowitz_frontier(rets, points=50, use_shrinkage=use_shrinkage)
    summary = optimizers_v2.optimizer_summary(rets, use_shrinkage=use_shrinkage)

    return {**frontier, "optimizers": summary}


@app.post("/api/strategy-builder")
def strategy_builder(request: StrategyBuilderRequest) -> Dict[str, Any]:
    """
    Build custom strategy with user-defined rules and risk controls.

    Accepts technical indicator rules, stop loss, and take profit parameters.
    Returns backtest results with position tracking.
    """
    logger.info("strategy_builder: tickers=%s rules=%s", request.tickers, len(request.rules))
    prices = fetch_price_history(request.tickers, request.start_date, request.end_date)
    weights = normalize_weights(request.tickers, request.weights)
    strat_returns, positions = run_strategy_builder(
        prices,
        weights,
        request.rules,
        stop_loss=request.stop_loss,
        take_profit=request.take_profit,
    )

    stats = compute_performance_stats(strat_returns)
    curve = equity_curve_payload(strat_returns)

    benchmark_payload = None
    if request.benchmark:
        bench_prices = fetch_price_history([request.benchmark], request.start_date, request.end_date)
        bench_returns = bench_prices.pct_change().dropna().iloc[:, 0].reindex(strat_returns.index).ffill().bfill()
        benchmark_payload = {
            "benchmark": request.benchmark,
            "dates": [idx.strftime("%Y-%m-%d") for idx in bench_returns.index],
            "returns": [float(r) for r in bench_returns],
        }

    return {
        "metrics": stats,
        "equity_curve": curve,
        "positions": [float(p) for p in positions],
        "dates": [idx.strftime("%Y-%m-%d") for idx in strat_returns.index],
        "returns": [float(r) for r in strat_returns],
        "benchmark": benchmark_payload,
    }


@app.post("/api/stress-test")
def stress_test(request: StressTestRequest) -> Dict[str, Any]:
    """
    Stress test portfolio against historical crises.

    Simulates portfolio behavior during dotcom crash, GFC, COVID, and custom shocks.
    Returns peak-to-trough drawdown and scenario-specific metrics.
    """
    logger.info("stress_test: tickers=%s scenario=%s", request.tickers, request.scenario)
    weights = normalize_weights(request.tickers, request.weights)
    periods = {
        "dotcom": ("2000-03-01", "2002-10-31"),
        "gfc": ("2007-10-01", "2009-03-31"),
        "covid": ("2020-02-01", "2020-04-30"),
    }
    scenario_map = {
        "equity_-20": -0.20,
        "rates_up_100bps": -0.05,
        "credit_widen_50bps": -0.03,
    }
    if request.scenario in periods:
        start, end = periods[request.scenario]
        prices = fetch_price_history(request.tickers, start, end)
        returns = analytics.compute_portfolio_returns(prices, weights)
        stats = compute_performance_stats(returns)
        curve = equity_curve_payload(returns)
        equity = (1 + returns).cumprod()
        running_max = equity.cummax()
        drawdown = equity / running_max - 1
        peak_to_trough = float(drawdown.min())
        return {
            "scenario": request.scenario,
            "start": start,
            "end": end,
            "metrics": stats,
            "equity_curve": curve,
            "peak_to_trough": peak_to_trough,
        }
    if request.scenario in scenario_map:
        prices = fetch_price_history(request.tickers, request.start_date, request.end_date)
        returns = analytics.compute_portfolio_returns(prices, weights)
        shocks = scenario_shocks(returns)
        return {"scenario": request.scenario, "shock": shocks.get(request.scenario)}
    raise HTTPException(status_code=400, detail=f"Unsupported scenario. Choose from {list(periods.keys()) + list(scenario_map.keys())}.")


@app.post("/api/benchmark")
def benchmark(request: BenchmarkRequest) -> Dict[str, Any]:
    """
    Compare portfolio performance against benchmark.

    Computes relative returns, rolling alpha/beta, and Brinson attribution
    (allocation vs selection effects).
    """
    logger.info("benchmark: tickers=%s benchmark=%s", request.tickers, request.benchmark)
    prices = fetch_price_history(request.tickers, request.start_date, request.end_date)
    bench_prices = fetch_price_history([request.benchmark], request.start_date, request.end_date)
    weights = normalize_weights(request.tickers, request.weights)
    portfolio_returns = analytics.compute_portfolio_returns(prices, weights)
    bench_returns = bench_prices.pct_change().dropna().iloc[:, 0]
    result = benchmark_compare(portfolio_returns, request.benchmark, request.start_date, request.end_date)
    rolling = analytics.rolling_active_stats(portfolio_returns, bench_returns)
    attribution = attribution_allocation_selection(portfolio_returns, bench_returns, weights)
    return {**result, "rolling": rolling, "attribution": attribution}


@app.get("/api/presets")
def list_presets() -> Dict[str, Any]:
    """
    List saved portfolio presets.

    Returns user-defined portfolio configurations with tickers and weights.
    """
    from .infra.utils import load_presets
    return load_presets()


@app.post("/api/presets")
def save_preset(request: SavePresetRequest) -> Dict[str, Any]:
    """
    Save portfolio configuration as preset.

    Stores tickers and weights for quick access in future sessions.
    """
    from .infra.utils import load_presets, save_presets
    presets = load_presets()
    presets[request.name] = {"tickers": request.tickers, "weights": request.weights}
    save_presets(presets)
    return {"status": "saved", "presets": presets}


@app.delete("/api/presets/{name}")
def delete_preset(name: str) -> Dict[str, Any]:
    """
    Delete saved portfolio preset.

    Removes preset by name and returns updated preset list.
    """
    from .infra.utils import load_presets, save_presets
    presets = load_presets()
    if name in presets:
        del presets[name]
        save_presets(presets)
    return {"status": "deleted", "presets": presets}


@app.post("/api/export/json")
def export_json(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Export data as JSON.

    Returns input payload unchanged, useful for triggering browser downloads.
    """
    return payload


# -------- Aliased, grouped endpoints for consistency --------

@app.post("/api/analytics/metrics", response_model=PortfolioMetricsResponse, responses={400: {"model": ApiError}})
def analytics_metrics(request: PortfolioMetricsRequest) -> PortfolioMetricsResponse:
    """
    Aliased endpoint for portfolio metrics.

    Forwards to /api/portfolio-metrics for consistency.
    """
    return portfolio_metrics(request)


@app.post("/api/analytics/factors", responses={400: {"model": ApiError}})
def analytics_factors(request: FactorExposureRequest) -> Dict[str, Any]:
    """
    Aliased endpoint for factor exposures.

    Forwards to /api/factor-exposures for consistency.
    """
    return factor_exposures(request)


@app.post("/api/analytics/risk", responses={400: {"model": ApiError}})
def analytics_risk(request: RiskBreakdownRequest) -> Dict[str, Any]:
    """
    Aliased endpoint for risk breakdown.

    Forwards to /api/risk-breakdown for consistency.
    """
    return risk_breakdown_endpoint(request)


@app.post("/api/backtests/run", response_model=BacktestResponse, responses={400: {"model": ApiError}})
def backtests_run(request: BacktestRequest) -> BacktestResponse:
    """
    Aliased endpoint for backtests.

    Forwards to /api/backtest for consistency.
    """
    return backtest(request)


@app.post("/api/backtests/config", response_model=BacktestResponse, responses={400: {"model": ApiError}})
def backtests_config(payload: Dict[str, Any]) -> BacktestResponse:
    """
    Aliased endpoint for config-based backtests.

    Forwards to /api/backtest-config for consistency.
    """
    return backtest_from_config(payload)


@app.post("/api/optimizers/frontier", responses={400: {"model": ApiError}})
def optimizers_frontier(request: FrontierRequest) -> Dict[str, Any]:
    """
    Aliased endpoint for efficient frontier.

    Forwards to /api/efficient-frontier for consistency.
    """
    return efficient_frontier(request)


@app.post("/api/rebalance/position-sizing", response_model=PositionSizingResponse, responses={400: {"model": ApiError}})
def rebalance_position_sizing(request: PositionSizingRequest) -> Dict[str, Any]:
    """
    Aliased endpoint for position sizing.

    Forwards to /api/position-sizing for consistency.
    """
    return position_sizing_endpoint(request)


@app.post("/api/rebalance/trades", response_model=RebalanceResponse, responses={400: {"model": ApiError}})
def rebalance_trades(request: RebalanceRequest) -> Dict[str, Any]:
    """
    Aliased endpoint for rebalance trade generation.

    Forwards to /api/rebalance for consistency.
    """
    return rebalance_endpoint(request)


@app.post("/api/dashboard", response_model=DashboardResponse, responses={400: {"model": ApiError}})
def dashboard_summary(request: DashboardRequest) -> DashboardResponse:
    """
    Aliased endpoint for portfolio dashboard.

    Forwards to /api/portfolio-dashboard for consistency.
    """
    return portfolio_dashboard_endpoint(request)

@app.post("/api/position-sizing", response_model=PositionSizingResponse, responses={400: {"model": ApiError}})
def position_sizing_endpoint(request: PositionSizingRequest) -> PositionSizingResponse:
    """
    Calculate position size based on entry/stop and portfolio risk budget.
    Returns shares, position value, and risk sizing details.
    """
    try:
        result = position_sizing(
            ticker=request.ticker,
            entry_price=request.entry_price,
            stop_price=request.stop_price,
            portfolio_value=request.portfolio_value,
            risk_per_trade_pct=request.risk_per_trade_pct,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return PositionSizingResponse(**result)


@app.post("/api/rebalance", response_model=RebalanceResponse, responses={400: {"model": ApiError}})
def rebalance_endpoint(request: RebalanceRequest) -> RebalanceResponse:
    """
    Suggest buy/sell trades to move from current to target weights.
    Returns trade list and estimated turnover.
    """
    try:
        return RebalanceResponse(**suggest_rebalance(
            request.tickers,
            request.current_weights,
            request.target_weights,
            request.portfolio_value,
            request.prices,
        ))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/portfolio-dashboard", response_model=DashboardResponse, responses={400: {"model": ApiError}})
def portfolio_dashboard_endpoint(request: DashboardRequest) -> DashboardResponse:
    """
    Portfolio overview helper: risk contributors, overweight/underweight flags, drawdowns, and a rebalance summary.
    """
    return DashboardResponse(**portfolio_dashboard(
        request.tickers,
        request.quantities,
        request.prices,
        request.cost_basis,
        request.target_weights,
        request.start_date,
        request.end_date,
    ))


@app.post("/api/covariance-analysis")
def covariance_analysis(request: PortfolioMetricsRequest, http_request: Request) -> Dict[str, Any]:
    """
    Compare different covariance estimators for robustness analysis.

    Returns condition numbers, effective ranks, and shrinkage intensities for:
    - Sample covariance (baseline)
    - Ledoit-Wolf shrinkage
    - OAS shrinkage
    - Exponential weighting (60-day halflife)

    Useful for understanding estimation quality and choosing the right method.
    """
    rate_limit_check(http_request, "/api/covariance-analysis", settings.rate_limit_optimization)
    logger.info("covariance_analysis: tickers=%s", request.tickers)
    prices = fetch_price_history(request.tickers, request.start_date, request.end_date)
    rets = prices.pct_change().dropna()

    # Compare estimators
    comparison = covariance_estimation.compare_estimators(rets, annualize=True)

    # Get Ledoit-Wolf details
    cov_lw, shrinkage = covariance_estimation.ledoit_wolf_shrinkage(rets)

    return {
        "comparison_table": comparison.to_dict(orient="records"),
        "ledoit_wolf_shrinkage_intensity": float(shrinkage),
        "recommendation": (
            "Use Ledoit-Wolf shrinkage"
            if comparison.iloc[1]["condition_number"] < comparison.iloc[0]["condition_number"] * 0.8
            else "Sample covariance is adequate"
        ),
    }


@app.post("/api/factor-attribution")
def factor_attribution(request: PortfolioMetricsRequest, http_request: Request) -> Dict[str, Any]:
    """
    Fama-French 5-factor model attribution for portfolio or asset.

    Decomposes returns into:
    - Market beta (systematic risk)
    - Size factor (SMB: small minus big)
    - Value factor (HML: high minus low book-to-market)
    - Profitability factor (RMW: robust minus weak)
    - Investment factor (CMA: conservative minus aggressive)
    - Alpha (excess return after controlling for factors)

    Returns factor loadings, R², and variance decomposition.
    """
    rate_limit_check(http_request, "/api/factor-attribution", settings.rate_limit_optimization)
    logger.info("factor_attribution: tickers=%s", request.tickers)
    prices = fetch_price_history(request.tickers, request.start_date, request.end_date)
    rets = prices.pct_change().dropna()

    # Compute portfolio returns
    weights = normalize_weights(request.tickers, request.weights)
    portfolio_returns = (rets * weights).sum(axis=1)

    # Build synthetic factor returns (in production, use Kenneth French data library)
    factor_returns = factor_models.build_synthetic_factor_returns(
        request.tickers,
        request.start_date,
        request.end_date,
        use_ff_proxies=True
    )

    # Run factor regression
    result = factor_models.fama_french_5factor_regression(
        portfolio_returns,
        factor_returns
    )

    # Generate attribution report
    attribution = factor_models.portfolio_factor_decomposition(
        portfolio_returns,
        factor_returns
    )

    return {
        "alpha_annualized": result["alpha"],
        "factor_betas": result["betas"],
        "r_squared": result["r_squared"],
        "adj_r_squared": result["adj_r_squared"],
        "coefficient_stats": result["coefficient_stats"],
        "variance_decomposition": {
            "total_variance": attribution["total_variance"],
            "factor_variance": attribution["factor_variance"],
            "idiosyncratic_variance": attribution["idiosyncratic_variance"],
            "pct_factor_risk": attribution["percentage_contributions"],
        },
        "volatility_decomposition": {
            "total_volatility": attribution["total_volatility"],
            "factor_volatility": attribution["factor_volatility"],
            "idiosyncratic_volatility": attribution["idiosyncratic_volatility"],
        },
    }


# ============================================================================
# Phase 3: Advanced Quant Endpoints
# ============================================================================

from pydantic import BaseModel


class PairsTradingRequest(BaseModel):
    ticker1: str
    ticker2: str
    start_date: str
    end_date: str
    lookback: int = 60
    entry_z: float = 2.0
    exit_z: float = 0.5
    stop_loss_z: float = 4.0


class GARCHRequest(BaseModel):
    ticker: str
    start_date: str
    end_date: str
    target_vol: float = 0.15
    initial_capital: float = 100000


class WalkForwardRequest(BaseModel):
    tickers: List[str]
    start_date: str
    end_date: str
    lookback_months: int = 12
    reopt_months: int = 3
    method: str = "sharpe"


class MomentumRequest(BaseModel):
    tickers: List[str]
    start_date: str
    end_date: str
    lookback: int = 126
    holding_period: int = 21
    top_n: int = 3


class VaRRequest(BaseModel):
    ticker: str
    start_date: str
    end_date: str
    confidence_level: float = 0.95
    method: str = "historical"
    distribution: str = "normal"


class StressTestRequest(BaseModel):
    ticker: str
    start_date: str
    end_date: str
    current_value: float = 100000
    scenarios: Optional[List[str]] = None


class PCARequest(BaseModel):
    tickers: List[str]
    start_date: str
    end_date: str
    n_components: int = 3


class TailRiskRequest(BaseModel):
    ticker: str
    benchmark_ticker: Optional[str] = None
    start_date: str
    end_date: str
    mar: float = 0.0


class LivePositionsRequest(BaseModel):
    tickers: List[str]
    quantities: List[float]
    entry_prices: Optional[List[float]] = None


class RebalanceOrdersRequest(BaseModel):
    current_tickers: List[str]
    current_quantities: List[float]
    current_prices: List[float]
    target_weights: Dict[str, float]
    total_value: float


class RiskLimitsRequest(BaseModel):
    ticker: str
    start_date: str
    end_date: str
    positions: Dict[str, float]
    limits: Optional[Dict[str, Any]] = None


@app.post("/api/backtests/walk-forward", responses={400: {"model": ApiError}})
def backtest_walk_forward(request: BacktestRequest) -> Dict[str, Any]:
    """
    Walk-forward validation: separates training and testing periods to prevent lookahead bias.

    This is the PROPER way to backtest. Unlike traditional backtests, this:
    1. Trains on historical data
    2. Tests on unseen future data (true out-of-sample)
    3. Reports realistic performance metrics
    4. Detects overfitting (compares train vs test returns)

    Returns:
    - out_of_sample_sharpe: Realistic Sharpe ratio on held-out data
    - training_performance: In-sample metrics (for reference)
    - testing_performance: Out-of-sample metrics (realistic)
    - overfitting_indicator: "low", "medium", or "high"
    - performance_degradation: % return decline from training to testing
    """
    logger.info("walk_forward_backtest: %s", request.strategy)

    prices = fetch_price_history(request.tickers, request.start_date, request.end_date)
    returns_df = prices.pct_change().dropna()

    # Compute portfolio returns
    weights = normalize_weights(request.tickers, request.weights)
    portfolio_returns = (returns_df * weights).sum(axis=1)

    # Run walk-forward validation
    wf_result = backtesting.validate_walk_forward_window(
        returns_df,
        train_window=int(request.parameters.get("train_window", 252)),
        test_window=int(request.parameters.get("test_window", 63)),
        rebalance_freq=request.rebalance_frequency or "M",
    )

    # Also compute drawdown analysis
    dd_result = backtesting.analyze_drawdown(portfolio_returns)

    # Monte Carlo reshuffle for robustness
    mc_result = backtesting.monte_carlo_backtest(
        returns_df,
        np.array(weights),
        n_simulations=request.parameters.get("monte_carlo_sims", 1000),
    )

    return {
        "walk_forward": wf_result,
        "drawdown_analysis": dd_result,
        "monte_carlo_robustness": mc_result,
        "strategy": request.strategy,
        "tickers": request.tickers,
        "weights": weights,
    }


@app.post("/api/strategies/pairs-trading", responses={400: {"model": ApiError}})
def pairs_trading_backtest_endpoint(
    request: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Pairs trading strategy with cointegration testing and mean reversion mechanics.

    Tests cointegration between two assets and generates trading signals
    based on z-score of the spread.

    Signals:
    - Entry: z-score > 2 (deviation from mean)
    - Exit: z-score crosses 0 (reversion to mean)
    - Stop loss: z-score > 3 (deterioration)

    Args:
        asset1: First ticker
        asset2: Second ticker
        start_date: Period start
        end_date: Period end
        lookback: Window for rolling mean/std (default 60)
        entry_zscore: Entry threshold (default 2.0)
        exit_zscore: Exit threshold (default 0.5)
        stop_loss_zscore: Stop loss threshold (default 3.0)

    Returns:
        Backtest results with returns, Sharpe ratio, max drawdown, trade list
    """
    logger.info("pairs_trading: %s vs %s", request.get("asset1"), request.get("asset2"))

    asset1 = request.get("asset1")
    asset2 = request.get("asset2")
    start_date = request.get("start_date")
    end_date = request.get("end_date")

    prices = fetch_price_history([asset1, asset2], start_date, end_date)

    # First, test for cointegration
    coint_result = quant_strategies.johansen_cointegration_test(prices)

    if not coint_result["pairs"]:
        raise HTTPException(
            status_code=400,
            detail="No cointegrating pairs found at 95% confidence level"
        )

    # Get the cointegrating vector
    pair_info = coint_result["pairs"][0]
    coint_vector = pair_info["cointegrating_vector"]

    # Run pairs trading backtest
    backtest_result = quant_strategies.pairs_trading_backtest(
        price_data=prices,
        asset1=asset1,
        asset2=asset2,
        cointegrating_vector=coint_vector,
        lookback=int(request.get("lookback", 60)),
        entry_zscore=float(request.get("entry_zscore", 2.0)),
        exit_zscore=float(request.get("exit_zscore", 0.5)),
        stop_loss_zscore=float(request.get("stop_loss_zscore", 3.0)),
    )

    return {
        "cointegration": coint_result,
        "backtest": backtest_result,
        "interpretation": "Pairs trading exploits mean reversion in cointegrated spreads"
    }


@app.post("/api/analytics/factor-attribution-v2", responses={400: {"model": ApiError}})
def factor_attribution_v2(request: PortfolioMetricsRequest) -> Dict[str, Any]:
    """
    Advanced factor attribution using Fama-French 5-factor model.

    Decomposes portfolio returns into:
    - Alpha (excess return)
    - Market beta (systematic equity risk)
    - Size factor (SMB: small minus big)
    - Value factor (HML: high minus low)
    - Profitability factor (RMW)
    - Investment factor (CMA)

    Also includes:
    - Risk decomposition (systematic vs idiosyncratic)
    - Sector exposure analysis
    - VaR/CVaR tail risk metrics
    """
    logger.info("factor_attribution_v2: %s", request.tickers)

    prices = fetch_price_history(request.tickers, request.start_date, request.end_date)
    weights = normalize_weights(request.tickers, request.weights)
    returns_df = prices.pct_change().dropna()
    portfolio_returns = (returns_df * weights).sum(axis=1)

    # Build Fama-French factor returns (synthetic proxies)
    factor_returns = pd.DataFrame()
    try:
        factor_proxies = {
            "market": "SPY",
            "size": "IWM",
            "value": "VLUE",
            "profitability": "RZG",
            "investment": "SPHD",
        }
        factor_prices = fetch_price_history(list(factor_proxies.values()), request.start_date, request.end_date)
        factor_returns = factor_prices.pct_change().dropna()
        factor_returns.columns = list(factor_proxies.keys())
    except Exception:
        logger.warning("Could not fetch factor proxies, using random data for demo")

    # Run attribution
    try:
        attribution = factor_attribution.fama_french_attribution(portfolio_returns, factor_returns)
    except Exception as e:
        logger.warning("Attribution failed: %s", e)
        attribution = {"error": str(e)}

    # Risk decomposition
    risk_decomp = factor_attribution.risk_decomposition(returns_df, np.array(weights), factor_returns if not factor_returns.empty else None)

    # Sector concentration (if available)
    sector_map = {ticker: "Equity" for ticker in request.tickers}  # Simplified
    sector_analysis = factor_attribution.sector_exposure_analysis(
        dict(zip(request.tickers, weights)),
        sector_map
    )

    # VaR/CVaR
    var_cvar = factor_attribution.var_cvar_analysis(portfolio_returns, confidence=0.95)

    # Stress testing
    stress = factor_attribution.stress_test_portfolio(portfolio_returns, factor_returns) if not factor_returns.empty else {}

    return {
        "attribution": attribution,
        "risk_decomposition": risk_decomp,
        "sector_analysis": sector_analysis,
        "tail_risk": var_cvar,
        "stress_test_scenarios": stress,
    }


@app.post("/api/quant/pairs-trading")
def pairs_trading(request: PairsTradingRequest) -> Dict[str, Any]:
    """
    Pairs trading backtest with cointegration analysis.

    Tests statistical relationship between two assets and trades mean reversion of the spread.
    Returns cointegration test results, trade history, and performance metrics.
    """
    logger.info("pairs_trading: %s vs %s", request.ticker1, request.ticker2)

    prices = fetch_price_history(
        [request.ticker1, request.ticker2],
        request.start_date,
        request.end_date
    )

    result = advanced_strategies.pairs_trading_backtest(
        ticker1=request.ticker1,
        ticker2=request.ticker2,
        prices=prices,
        lookback=request.lookback,
        entry_z=request.entry_z,
        exit_z=request.exit_z,
        stop_loss_z=request.stop_loss_z,
    )

    return result


@app.post("/api/quant/garch-vol-targeting")
def garch_vol_targeting(request: GARCHRequest) -> Dict[str, Any]:
    """
    Dynamic position sizing using GARCH volatility forecasts.

    Fits GARCH(1,1) model to predict next-period volatility and scales positions
    to maintain constant risk exposure.
    """
    logger.info("garch_vol_targeting: %s target_vol=%s", request.ticker, request.target_vol)

    prices = fetch_price_history([request.ticker], request.start_date, request.end_date).iloc[:, 0]
    returns = prices.pct_change().dropna()

    result = advanced_strategies.garch_vol_targeting(
        returns=returns,
        target_vol=request.target_vol,
        initial_capital=request.initial_capital,
    )

    return result


@app.post("/api/quant/walk-forward")
def walk_forward(request: WalkForwardRequest, http_request: Request) -> Dict[str, Any]:
    """
    Rolling optimization with out-of-sample testing.

    Trains on historical window, applies to future period, then rolls forward.
    Prevents lookahead bias and provides realistic performance estimates.
    """
    rate_limit_check(http_request, "/api/quant/walk-forward", settings.rate_limit_optimization)
    logger.info("walk_forward: %s assets, method=%s", len(request.tickers), request.method)

    prices = fetch_price_history(request.tickers, request.start_date, request.end_date)
    returns = prices.pct_change().dropna()

    result = advanced_strategies.walk_forward_optimization(
        returns=returns,
        lookback_months=request.lookback_months,
        reopt_months=request.reopt_months,
        method=request.method,
    )

    return result


@app.post("/api/quant/momentum")
def momentum(request: MomentumRequest) -> Dict[str, Any]:
    """
    Momentum strategy with periodic rebalancing.

    Ranks assets by past performance and holds top performers for specified period.
    Returns backtest with turnover and concentration metrics.
    """
    logger.info("momentum: %s assets, top_n=%s", len(request.tickers), request.top_n)

    prices = fetch_price_history(request.tickers, request.start_date, request.end_date)
    returns = prices.pct_change().dropna()

    result = advanced_strategies.momentum_strategy(
        returns=returns,
        lookback=request.lookback,
        holding_period=request.holding_period,
        top_n=request.top_n,
    )

    return result


@app.post("/api/quant/var-cvar")
def var_cvar(request: VaRRequest) -> Dict[str, Any]:
    """
    Calculate Value at Risk and Expected Shortfall.

    Supports historical simulation, parametric normal/t-distribution, and Cornish-Fisher expansion.
    Returns VaR and CVaR at specified confidence level.
    """
    logger.info("var_cvar: %s method=%s", request.ticker, request.method)

    prices = fetch_price_history([request.ticker], request.start_date, request.end_date).iloc[:, 0]
    returns = prices.pct_change().dropna()

    result = risk_analytics.compute_var_cvar(
        returns=returns,
        confidence_level=request.confidence_level,
        method=request.method,
        distribution=request.distribution,
    )

    return result


@app.post("/api/quant/stress-test")
def stress_test_quant(request: StressTestRequest, http_request: Request) -> Dict[str, Any]:
    """
    Evaluate portfolio under extreme market conditions.

    Tests against 2008 GFC, 2020 COVID, and 2022 rate hikes.
    Returns drawdown, recovery time, and stress loss estimates.
    """
    rate_limit_check(http_request, "/api/quant/stress-test", settings.rate_limit_optimization)
    logger.info("stress_test: %s value=%s", request.ticker, request.current_value)

    prices = fetch_price_history([request.ticker], request.start_date, request.end_date).iloc[:, 0]
    returns = prices.pct_change().dropna()

    result = risk_analytics.stress_test_portfolio(
        returns=returns,
        current_value=request.current_value,
        scenarios=request.scenarios,
    )

    return result


@app.post("/api/quant/pca")
def pca(request: PCARequest, http_request: Request) -> Dict[str, Any]:
    """
    Dimensionality reduction and factor identification via PCA.

    Extracts principal components from return covariance matrix.
    Returns loadings, explained variance, and factor interpretations.
    """
    rate_limit_check(http_request, "/api/quant/pca", settings.rate_limit_optimization)
    logger.info("pca: %s assets, n_components=%s", len(request.tickers), request.n_components)

    prices = fetch_price_history(request.tickers, request.start_date, request.end_date)
    returns = prices.pct_change().dropna()

    result = risk_analytics.pca_decomposition(
        returns=returns,
        n_components=request.n_components,
    )

    return result


@app.post("/api/quant/tail-risk")
def tail_risk(request: TailRiskRequest) -> Dict[str, Any]:
    """
    Analyze downside risk and extreme loss characteristics.

    Computes max drawdown, Calmar ratio, Omega ratio, Sortino ratio, and skewness/kurtosis.
    Focuses on left-tail behavior rather than symmetric volatility.
    """
    logger.info("tail_risk: %s", request.ticker)

    prices = fetch_price_history([request.ticker], request.start_date, request.end_date).iloc[:, 0]
    returns = prices.pct_change().dropna()

    benchmark_returns = None
    if request.benchmark_ticker:
        benchmark_prices = fetch_price_history(
            [request.benchmark_ticker],
            request.start_date,
            request.end_date
        ).iloc[:, 0]
        benchmark_returns = benchmark_prices.pct_change().dropna()

    result = risk_analytics.tail_risk_metrics(
        returns=returns,
        benchmark_returns=benchmark_returns,
        mar=request.mar,
    )

    return result


@app.post("/api/quant/live-positions")
def get_live_positions_api(request: LivePositionsRequest) -> Dict[str, Any]:
    """
    Fetch current positions with real-time valuations.

    Retrieves latest prices and computes unrealized gains/losses for each position.
    Returns total portfolio value and individual P&L breakdown.
    """
    logger.info("live_positions: %s positions", len(request.tickers))

    result = live_trading.get_live_positions(
        tickers=request.tickers,
        quantities=request.quantities,
        entry_prices=request.entry_prices,
    )

    return result


@app.post("/api/quant/generate-orders")
def generate_orders(request: RebalanceOrdersRequest) -> Dict[str, Any]:
    """
    Create trade orders to rebalance to target allocation.

    Compares current positions to target weights and generates buy/sell orders.
    Returns order list with ticker, action, and quantity.
    """
    logger.info("generate_orders: %s positions", len(request.current_tickers))

    result = live_trading.generate_rebalance_orders(
        current_tickers=request.current_tickers,
        current_quantities=request.current_quantities,
        current_prices=request.current_prices,
        target_weights=request.target_weights,
        total_value=request.total_value,
    )

    return result


@app.post("/api/quant/risk-limits")
def risk_limits(request: RiskLimitsRequest) -> Dict[str, Any]:
    """
    Check portfolio against predefined risk constraints.

    Evaluates position size, concentration, VaR, and drawdown limits.
    Returns breach alerts and compliance status.
    """
    logger.info("risk_limits: %s", request.ticker)

    prices = fetch_price_history([request.ticker], request.start_date, request.end_date).iloc[:, 0]
    returns = prices.pct_change().dropna()

    result = live_trading.monitor_risk_limits(
        returns=returns,
        positions=request.positions,
        limits=request.limits,
    )

    return result
