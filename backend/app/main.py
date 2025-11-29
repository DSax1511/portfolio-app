from __future__ import annotations

import csv
import datetime as dt
import io
import json
import logging
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
import yaml
import yfinance as yf
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from . import analytics, backtests, optimizers
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
    RiskBreakdownRequest,
    SavePresetRequest,
    StrategyBuilderRequest,
    StressTestRequest,
)
from .rebalance import position_sizing, suggest_rebalance


app = FastAPI(title="Portfolio Quant API", version="2.0.0")

DEFAULT_ORIGINS = ",".join(
    [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://0.0.0.0:5173",
        "http://0.0.0.0:3000",
    ]
)
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in (settings.frontend_origins or DEFAULT_ORIGINS).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS or ["*"],
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

    return PortfolioMetricsResponse(
        tickers=request.tickers,
        weights=weights,
        start_date=curve["dates"][0] if curve["dates"] else request.start_date,
        end_date=curve["dates"][-1] if curve["dates"] else request.end_date,
        metrics=stats,
        equity_curve=curve,
    )


def _persist_run(kind: str, params: Dict[str, Any], returns: pd.Series, stats: Dict[str, Any]) -> str:
    ts = dt.datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    run_id = f"{kind}_{ts}"
    payload = {
        "id": run_id,
        "kind": kind,
        "timestamp": ts,
        "params": params,
        "stats": stats,
        "equity": returns.head(10).tolist(),  # small slice to keep files light
    }
    log_run(settings.runs_dir / f"{run_id}.json", payload)
    return run_id


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
    if request.benchmark:
        bench_prices = fetch_price_history([request.benchmark], request.start_date, request.end_date)
        bench_returns = bench_prices.pct_change().dropna().iloc[:, 0]
        bench_returns = bench_returns.reindex(returns.index).ffill().bfill()
        benchmark_payload = {
          "benchmark": request.benchmark,
          "dates": [idx.strftime("%Y-%m-%d") for idx in bench_returns.index],
          "returns": [float(r) for r in bench_returns],
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
    )


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
