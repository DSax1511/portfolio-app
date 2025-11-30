from __future__ import annotations

import os
import csv
import datetime as dt
import io
import json
import logging
import math
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
import yaml
import yfinance as yf
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from . import analytics, backtests, optimizers, commentary
from .quant_engine import run_quant_backtest
from .quant_regimes import detect_regimes
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
)
from .rebalance import position_sizing, suggest_rebalance


app = FastAPI(title="Portfolio Quant API", version="2.0.0")

# CORS origins: local dev defaults plus optional FRONTEND_ORIGIN/ADDITIONAL_ORIGIN
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN")
ADDITIONAL_ORIGIN = os.getenv("ADDITIONAL_ORIGIN")
origins = [
    "http://localhost:4173",
    "http://localhost:5173",
]
if FRONTEND_ORIGIN:
    origins.append(FRONTEND_ORIGIN)
if ADDITIONAL_ORIGIN:
    origins.append(ADDITIONAL_ORIGIN)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger = logging.getLogger("app")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO)


@app.get("/api/health")
def health_check() -> Dict[str, str]:
    return {"status": "ok"}

# Friendly root health for infra checks
@app.get("/health")
def health_root() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/api/portfolio", response_model=List[Position])
def get_portfolio() -> List[Position]:
    return []


@app.post("/api/upload-positions", response_model=List[Position])
async def upload_positions(file: UploadFile = File(...)) -> List[Position]:
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

        quote = yf.Ticker(ticker).history(period="1d")
        current_price = float(quote["Close"].iloc[-1]) if not quote.empty else avg_cost
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
def backtest(request: BacktestRequest) -> BacktestResponse:
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
    prices = fetch_price_history(request.tickers, request.start_date, request.end_date)
    weights = normalize_weights(request.tickers, request.weights)

    returns_df = prices.pct_change().dropna()
    portfolio_returns, _ = apply_rebalance(returns_df, weights, request.rebalance_freq or "none")

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
        weights.tolist(),
        benchmark_symbol,
        request.start_date,
        request.end_date,
        request.rebalance_freq,
    )
    summary = analytics_payload.get("summary", {})

    run_id = _persist_run(
        "pm_backtest",
        {"tickers": request.tickers, "weights": weights, "rebalance_freq": request.rebalance_freq or "none", "benchmark": benchmark_symbol},
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
    tickers = request.get("tickers") or []
    weights = request.get("weights")
    benchmark = request.get("benchmark") or "SPY"
    start = request.get("start_date")
    end = request.get("end_date")
    rebalance_freq = request.get("rebalance_freq")
    if not tickers:
        raise HTTPException(status_code=400, detail="tickers required")
    result = backtest_analytics(tickers, weights, benchmark, start, end, rebalance_freq)
    try:
        run_id = _persist_run(
            "backtest",
            {"tickers": tickers, "weights": weights, "benchmark": benchmark, "rebalance_freq": rebalance_freq or "none"},
            pd.Series(result.get("returns") or []),
            result.get("summary") or {},
            meta={"label": f"{tickers}", "benchmark": benchmark},
        )
        result["run_id"] = run_id
    except Exception:
        pass
    return result


@app.post("/api/v1/pm/allocation", response_model=PMAllocationResponse, responses={400: {"model": ApiError}})
def pm_allocation(request: PMAllocationRequest) -> PMAllocationResponse:
    try:
        return _allocation_from_payload(request)
    except Exception as exc:
        logger.exception("pm_allocation error")
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/v1/quant/backtest", response_model=QuantBacktestResponse, responses={400: {"model": ApiError}})
def quant_backtest(request: QuantBacktestRequest) -> QuantBacktestResponse:
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
    try:
        return detect_regimes(request)
    except Exception as exc:
        logger.exception("quant_regimes error")
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/v1/quant/microstructure", response_model=MicrostructureResponse, responses={400: {"model": ApiError}})
def microstructure(request: MicrostructureRequest) -> MicrostructureResponse:
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
    return _list_runs(limit)


@app.get("/api/runs/latest", response_model=Dict[str, Any])
def latest_run() -> Dict[str, Any]:
    runs = _list_runs(1)
    if not runs:
        raise HTTPException(status_code=404, detail="No runs found")
    return runs[0]


@app.get("/api/runs/{run_id}", response_model=Dict[str, Any])
def get_run(run_id: str) -> Dict[str, Any]:
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
    logger.info("factor_exposures: tickers=%s start=%s end=%s", request.tickers, request.start_date, request.end_date)
    prices = fetch_price_history(request.tickers, request.start_date, request.end_date)
    weights = normalize_weights(request.tickers, request.weights)
    portfolio_returns = analytics.compute_portfolio_returns(prices, weights)
    exposures = factor_regression(portfolio_returns, request.start_date, request.end_date)
    return exposures


@app.post("/api/risk-breakdown")
def risk_breakdown_endpoint(request: RiskBreakdownRequest) -> Dict[str, Any]:
    logger.info("risk_breakdown: tickers=%s", request.tickers)
    prices = fetch_price_history(request.tickers, request.start_date, request.end_date)
    weights = normalize_weights(request.tickers, request.weights)
    breakdown = risk_breakdown(prices, weights)
    return breakdown


@app.post("/api/monte-carlo")
def monte_carlo(request: MonteCarloRequest) -> Dict[str, Any]:
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
def efficient_frontier(request: FrontierRequest) -> Dict[str, Any]:
    logger.info("efficient_frontier: tickers=%s", request.tickers)
    prices = fetch_price_history(request.tickers, request.start_date, request.end_date)
    rets = prices.pct_change().dropna()
    frontier = optimizers.markowitz_frontier(rets)
    summary = optimizers.optimizer_summary(rets)
    return {**frontier, "optimizers": summary}


@app.post("/api/strategy-builder")
def strategy_builder(request: StrategyBuilderRequest) -> Dict[str, Any]:
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
    from .infra.utils import load_presets
    return load_presets()


@app.post("/api/presets")
def save_preset(request: SavePresetRequest) -> Dict[str, Any]:
    from .infra.utils import load_presets, save_presets
    presets = load_presets()
    presets[request.name] = {"tickers": request.tickers, "weights": request.weights}
    save_presets(presets)
    return {"status": "saved", "presets": presets}


@app.delete("/api/presets/{name}")
def delete_preset(name: str) -> Dict[str, Any]:
    from .infra.utils import load_presets, save_presets
    presets = load_presets()
    if name in presets:
        del presets[name]
        save_presets(presets)
    return {"status": "deleted", "presets": presets}


@app.post("/api/export/json")
def export_json(payload: Dict[str, Any]) -> Dict[str, Any]:
    return payload


# -------- Aliased, grouped endpoints for consistency --------

@app.post("/api/analytics/metrics", response_model=PortfolioMetricsResponse, responses={400: {"model": ApiError}})
def analytics_metrics(request: PortfolioMetricsRequest) -> PortfolioMetricsResponse:
    return portfolio_metrics(request)


@app.post("/api/analytics/factors", responses={400: {"model": ApiError}})
def analytics_factors(request: FactorExposureRequest) -> Dict[str, Any]:
    return factor_exposures(request)


@app.post("/api/analytics/risk", responses={400: {"model": ApiError}})
def analytics_risk(request: RiskBreakdownRequest) -> Dict[str, Any]:
    return risk_breakdown_endpoint(request)


@app.post("/api/backtests/run", response_model=BacktestResponse, responses={400: {"model": ApiError}})
def backtests_run(request: BacktestRequest) -> BacktestResponse:
    return backtest(request)


@app.post("/api/backtests/config", response_model=BacktestResponse, responses={400: {"model": ApiError}})
def backtests_config(payload: Dict[str, Any]) -> BacktestResponse:
    return backtest_from_config(payload)


@app.post("/api/optimizers/frontier", responses={400: {"model": ApiError}})
def optimizers_frontier(request: FrontierRequest) -> Dict[str, Any]:
    return efficient_frontier(request)


@app.post("/api/rebalance/position-sizing", response_model=PositionSizingResponse, responses={400: {"model": ApiError}})
def rebalance_position_sizing(request: PositionSizingRequest) -> Dict[str, Any]:
    return position_sizing_endpoint(request)


@app.post("/api/rebalance/trades", response_model=RebalanceResponse, responses={400: {"model": ApiError}})
def rebalance_trades(request: RebalanceRequest) -> Dict[str, Any]:
    return rebalance_endpoint(request)


@app.post("/api/dashboard", response_model=DashboardResponse, responses={400: {"model": ApiError}})
def dashboard_summary(request: DashboardRequest) -> DashboardResponse:
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
