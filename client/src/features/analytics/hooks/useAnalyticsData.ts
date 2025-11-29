import { useCallback, useState } from "react";

import { portfolioApi } from "../../../services/portfolioApi";
import {
  drawdownSeries,
  DrawdownWindow,
  PerformanceSummary,
  performanceSummary,
  returnsFromEquity,
  rollingStatsWithBeta,
  drawdownWindows,
  relativePerformanceSeries,
  buildRiskDecomposition,
  RiskDecomposition,
  PeriodReturn,
  PeriodStats,
  aggregatePeriodReturns,
  runShockSet,
  runShockScenario,
  ShockScenarioResult,
} from "../../../lib/analyticsCalculations";
import {
  BacktestResponse,
  BenchmarkResponse,
  EquityCurve,
  PortfolioMetricsResponse,
} from "../../../types/portfolio";

type EquityPoint = { date: string; equity: number };
type DrawdownPoint = { date: string; drawdown: number };
type RelativePoint = { date: string; relative: number };
type RollingPoint = {
  date: string;
  sharpe: number;
  beta: number | null;
  vol: number;
  annualizedVol: number;
};

type BaseAnalytics<T> = {
  raw: T;
  summary: PerformanceSummary;
  equitySeries: EquityPoint[];
  drawdownSeries: DrawdownPoint[];
  returns: number[];
  dates: string[];
  drawdownWindows: DrawdownWindow[];
  maxDrawdownWindow: DrawdownWindow | null;
  riskDecomposition: RiskDecomposition | null;
  periodReturns: PeriodReturn[];
  periodStats: PeriodStats;
  scenarios: ShockScenarioResult[];
  portfolioBeta: number | null;
};

type MetricsData = BaseAnalytics<PortfolioMetricsResponse>;
type BacktestData = BaseAnalytics<BacktestResponse> & {
  rolling: RollingPoint[];
  benchmarkEquitySeries?: EquityPoint[];
  benchmarkDrawdownSeries?: DrawdownPoint[];
  relativeSeries?: RelativePoint[];
};
type BenchmarkData = BaseAnalytics<BenchmarkResponse> & {
  rolling: RollingPoint[];
};

type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: string;
};

const toEquitySeries = (
  curve?: EquityCurve | null
): { equitySeries: EquityPoint[]; dates: string[]; equity: number[] } => {
  const dates = curve?.dates ?? [];
  const equityArray = curve?.equity ?? [];
  return {
    dates,
    equity: equityArray,
    equitySeries: dates.map((date, idx) => ({
      date,
      equity: equityArray[idx] ?? 0,
    })),
  };
};

const toDrawdownSeries = (dates: string[], equity: number[]): DrawdownPoint[] => {
  const dd = drawdownSeries(equity);
  return dates.map((date, idx) => ({
    date,
    drawdown: dd[idx] ?? 0,
  }));
};

const buildAnalytics = <T extends { equity_curve: EquityCurve; tickers?: string[]; weights?: number[] }>(
  raw: T
): BaseAnalytics<T> => {
  const { equity, dates, equitySeries } = toEquitySeries(raw.equity_curve);
  const returns = returnsFromEquity(equity);
  const { windows, max } = drawdownWindows(equity, dates);
  const { periods, stats } = aggregatePeriodReturns(returns, dates, "month");
  const portfolioBeta =
    (raw as any).beta ??
    (raw as any).benchmark?.beta ??
    (raw as any).factor_beta ??
    null;
  const riskDecomposition = buildRiskDecomposition({
    tickers: raw.tickers || [],
    weights: raw.weights,
    covariance: (raw as any).covariance || (raw as any).cov_matrix || undefined,
    vols: (raw as any).position_vols || undefined,
    positionReturns: (raw as any).position_returns || (raw as any).ticker_returns || undefined,
  });
  return {
    raw,
    dates,
    returns,
    equitySeries,
    drawdownSeries: toDrawdownSeries(dates, equity),
    drawdownWindows: windows,
    maxDrawdownWindow: max,
    riskDecomposition,
    periodReturns: periods,
    periodStats: stats,
    scenarios: runShockSet(equity, [-0.05, -0.1, -0.2], portfolioBeta),
    portfolioBeta,
    summary: performanceSummary(equity, 252, returns),
  };
};

const errorMessage = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message || fallback : fallback;

export const useAnalyticsData = () => {
  const [metricsState, setMetricsState] = useState<AsyncState<MetricsData>>({
    data: null,
    loading: false,
    error: "",
  });
  const [backtestState, setBacktestState] = useState<AsyncState<BacktestData>>({
    data: null,
    loading: false,
    error: "",
  });
  const [benchmarkState, setBenchmarkState] = useState<AsyncState<BenchmarkData>>({
    data: null,
    loading: false,
    error: "",
  });

  const loadMetrics = useCallback(
    async (payload: Parameters<typeof portfolioApi.getPortfolioMetrics>[0]) => {
      setMetricsState({ data: null, loading: true, error: "" });
      try {
        const raw = await portfolioApi.getPortfolioMetrics(payload);
        setMetricsState({ data: buildAnalytics(raw), loading: false, error: "" });
      } catch (err) {
        setMetricsState({
          data: null,
          loading: false,
          error: errorMessage(err, "Metrics request failed"),
        });
      }
    },
    []
  );

  const loadBacktest = useCallback(
    async (payload: Parameters<typeof portfolioApi.runBacktest>[0]) => {
      setBacktestState({ data: null, loading: true, error: "" });
      try {
        const raw = await portfolioApi.runBacktest(payload);
        const base = buildAnalytics(raw);
        const benchmarkEquity =
          raw.benchmark?.equity_curve?.dates.map((date, idx) => ({
            date,
            equity: raw.benchmark?.equity_curve.equity[idx] ?? 0,
          })) || [];
        const benchmarkDrawdown = benchmarkEquity.length
          ? toDrawdownSeries(
              raw.benchmark?.equity_curve.dates || [],
              raw.benchmark?.equity_curve.equity || []
            )
          : undefined;
        const relativeSeries =
          benchmarkEquity.length > 0 ? relativePerformanceSeries(base.equitySeries, benchmarkEquity) : undefined;
        const rolling = rollingStatsWithBeta(
          raw.returns || [],
          raw.benchmark?.returns ?? null,
          raw.dates || base.dates,
          60
        ).map((row) => ({
          date: row.date,
          beta: row.beta,
          sharpe: row.sharpe,
          vol: row.vol,
          annualizedVol: row.vol * Math.sqrt(252),
        }));
        setBacktestState({
          data: {
            ...base,
            rolling,
            benchmarkEquitySeries: benchmarkEquity.length ? benchmarkEquity : undefined,
            benchmarkDrawdownSeries: benchmarkDrawdown,
            relativeSeries,
          },
          loading: false,
          error: "",
        });
      } catch (err) {
        setBacktestState({
          data: null,
          loading: false,
          error: errorMessage(err, "Backtest request failed"),
        });
      }
    },
    []
  );

  const loadBenchmark = useCallback(
    async (payload: Parameters<typeof portfolioApi.getBenchmarkComparison>[0]) => {
      setBenchmarkState({ data: null, loading: true, error: "" });
      try {
        const raw = await portfolioApi.getBenchmarkComparison(payload);
        const base = buildAnalytics(raw);
        const rolling = rollingStatsWithBeta(
          raw.returns || [],
          null,
          raw.equity_curve?.dates || base.dates,
          60
        ).map((row) => ({
          date: row.date,
          beta: null,
          sharpe: row.sharpe,
          vol: row.vol,
          annualizedVol: row.vol * Math.sqrt(252),
        }));
        setBenchmarkState({
          data: { ...base, rolling },
          loading: false,
          error: "",
        });
      } catch (err) {
        setBenchmarkState({
          data: null,
          loading: false,
          error: errorMessage(err, "Benchmark failed"),
        });
      }
    },
    []
  );

  return {
    metricsState,
    backtestState,
    benchmarkState,
    loadMetrics,
    loadBacktest,
    loadBenchmark,
    runScenario: (shockPct: number) => {
      const base = backtestState.data || metricsState.data;
      if (!base) return null;
      return runShockScenario({
        equity: base.raw.equity_curve?.equity || [],
        shockPct,
        beta: base.portfolioBeta,
      });
    },
  };
};
