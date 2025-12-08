import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { portfolioApi } from "../services/portfolioApi";
import { ApiClientError } from "../services/apiClient";

export type DatePreset = "1Y" | "3Y" | "5Y" | "MAX" | "CUSTOM";

export type DateRange = {
  preset: DatePreset;
  startDate: string | null;
  endDate: string | null;
};

export type PortfolioPosition = {
  ticker: string;
  quantity: number;
  avg_cost: number;
  current_price: number;
  market_value: number;
  pnl: number;
  description?: string;
  sector?: string;
};

export type EquityCurve = { dates: string[]; equity: number[] };
export type DrawdownPoint = { date: string; drawdown: number };
export type RollingPoint = { date: string; vol: number; sharpe: number; beta: number | null };
export type MonthlyReturn = { year: number; month: number; returnPct: number };

export type PortfolioMode = "none" | "demo" | "user";

export type PortfolioAnalyticsResult = {
  params: Record<string, unknown>;
  summary: Record<string, number>;
  equity_curve: EquityCurve;
  benchmark_curve?: EquityCurve;
  relative_curve?: { dates: string[]; relative: number[] };
  returns?: number[];
  benchmark_returns?: number[];
  drawdown_series?: DrawdownPoint[];
  top_drawdowns?: Array<{ start: string; end: string; depth: number }>;
  monthly_returns?: MonthlyReturn[];
  rolling_stats?: RollingPoint[];
  scenarios?: Array<{ name: string; shock: number; pnl: number }>;
  period_stats?: Record<string, number>;
  factor_risk?: {
    factors: Array<{ factor: string; beta: number; variance_contribution: number }>;
    r2: number;
    residual_vol: number;
  };
  correlations?: Array<{ a: string; b: string; value: number }>;
  var?: Record<string, number>;
  risk_attribution?: {
    by_ticker: Array<{ ticker: string; weight_pct: number; contribution_pct: number }>;
    by_sector: Array<{ sector: string; weight_pct: number; contribution_pct: number }>;
  };
  return_distribution?: {
    histogram: Array<{ bin_start: number; bin_end: number; count: number }>;
    skew: number;
    kurtosis: number;
    worst_1d: number;
    worst_5d: number;
  };
  commentary?: Record<string, any>;
};

type PortfolioAnalyticsState = {
  positions: PortfolioPosition[];
  setPositions: (positions: PortfolioPosition[]) => void;
  benchmark: string;
  setBenchmark: (b: string) => void;
  dateRange: DateRange;
  setDateRange: (r: DateRange) => void;
  liveAnalytics: PortfolioAnalyticsResult | null;
  backtestAnalytics: PortfolioAnalyticsResult | null;
  loading: boolean;
  error: string;
  runLiveAnalytics: () => Promise<void>;
  runBacktestAnalytics: (payload: {
    tickers: string[];
    weights?: number[] | null;
    rebalance_freq?: string | null;
    start_date?: string | null;
    end_date?: string | null;
  }) => Promise<PortfolioAnalyticsResult | null>;
  portfolioMode: PortfolioMode;
  activePortfolioName: string | null;
  activePortfolioId: string | null;
  activeDemoId: string | null;
  markDemoPortfolio: (name: string, id: string) => void;
  markUserPortfolio: (name?: string) => void;
  clearPortfolioContext: () => void;
};

const PortfolioAnalyticsContext = createContext<PortfolioAnalyticsState | undefined>(undefined);

const calcRange = (preset: DatePreset): { start: string | null; end: string | null } => {
  const today = new Date();
  const iso = today.toISOString().slice(0, 10);
  if (preset === "CUSTOM") return { start: null, end: iso };
  const d = new Date();
  const years = preset === "1Y" ? 1 : preset === "3Y" ? 3 : preset === "5Y" ? 5 : 15;
  d.setFullYear(d.getFullYear() - years);
  return { start: d.toISOString().slice(0, 10), end: iso };
};

export const PortfolioAnalyticsProvider = ({ children }: { children: React.ReactNode }) => {
  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  const [benchmark, setBenchmark] = useState("SPY");
  const [dateRange, setDateRange] = useState<DateRange>({ preset: "1Y", startDate: null, endDate: null });
  const [liveAnalytics, setLiveAnalytics] = useState<PortfolioAnalyticsResult | null>(null);
  const [backtestAnalytics, setBacktestAnalytics] = useState<PortfolioAnalyticsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [portfolioMode, setPortfolioMode] = useState<PortfolioMode>("none");
  const [activePortfolioName, setActivePortfolioName] = useState<string | null>("No portfolio selected");
  const [activePortfolioId, setActivePortfolioId] = useState<string | null>(null);
  const [activeDemoId, setActiveDemoId] = useState<string | null>(null);

  const derivedRange = useMemo(() => {
    if (dateRange.preset === "CUSTOM") return { start: dateRange.startDate, end: dateRange.endDate };
    return calcRange(dateRange.preset);
  }, [dateRange]);

  const runLiveAnalytics = useCallback(async () => {
    if (!positions.length) {
      setLiveAnalytics(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const payload = {
        tickers: positions.map((p) => p.ticker),
        quantities: positions.map((p) => p.quantity || 0),
        prices: positions.map((p) => p.current_price || 0),
        benchmark,
        start_date: derivedRange.start,
        end_date: derivedRange.end,
      };
      const res = await portfolioApi.getPortfolioAnalytics(payload);
      setLiveAnalytics(res);
    } catch (err: any) {
      setError(err.message || "Failed to load portfolio analytics");
      setLiveAnalytics(null);
    } finally {
      setLoading(false);
    }
  }, [positions, benchmark, derivedRange.start, derivedRange.end]);

  const runBacktestAnalytics = useCallback(
    async (payload: { tickers: string[]; weights?: number[] | null; rebalance_freq?: string | null; start_date?: string | null; end_date?: string | null }) => {
      setLoading(true);
      setError("");
      try {
        const res = await portfolioApi.runBacktestAnalytics({
          ...payload,
          benchmark,
          start_date: payload.start_date ?? derivedRange.start,
          end_date: payload.end_date ?? derivedRange.end,
        });
        setBacktestAnalytics(res);
        return res;
      } catch (err: any) {
        // Fallback to legacy PM backtest if unified endpoint is unavailable (e.g., older backend build)
        try {
          const pmRes = await portfolioApi.runPMBacktest({
            tickers: payload.tickers,
            weights: payload.weights,
            start_date: payload.start_date ?? derivedRange.start,
            end_date: payload.end_date ?? derivedRange.end,
            rebalance_freq: payload.rebalance_freq,
            benchmark,
          });
          const mapped = pmRes.analytics
            ? { ...pmRes.analytics, run_id: pmRes.run_id || pmRes.analytics.run_id }
            : {
                params: { ...payload, benchmark },
                summary: pmRes.summary || {},
                equity_curve: { dates: pmRes.dates, equity: pmRes.portfolio_equity },
                benchmark_curve: { dates: pmRes.dates, equity: pmRes.benchmark_equity },
                returns: pmRes.portfolio_returns,
                benchmark_returns: pmRes.benchmark_returns,
                run_id: pmRes.run_id,
              };
          setBacktestAnalytics(mapped as any);
          return mapped as any;
        } catch (fallbackErr: any) {
          const msg =
            fallbackErr instanceof ApiClientError
              ? fallbackErr.message
              : err?.message || fallbackErr?.message || "Backtest analytics failed";
          setError(msg);
          setBacktestAnalytics(null);
          throw fallbackErr;
        }
      } finally {
        setLoading(false);
      }
    },
    [benchmark, derivedRange.start, derivedRange.end]
  );

  useEffect(() => {
    runLiveAnalytics();
  }, [runLiveAnalytics]);

  const value: PortfolioAnalyticsState = {
    positions,
    setPositions,
    benchmark,
    setBenchmark,
    dateRange,
    setDateRange,
    liveAnalytics,
    backtestAnalytics,
    loading,
    error,
    runLiveAnalytics,
    runBacktestAnalytics,
    portfolioMode,
    activePortfolioName,
    activePortfolioId,
    activeDemoId,
    markDemoPortfolio: (name: string, id: string) => {
      setPortfolioMode("demo");
      setActivePortfolioName(name);
      setActivePortfolioId(id);
      setActiveDemoId(id);
    },
    markUserPortfolio: (name = "Imported portfolio") => {
      setPortfolioMode("user");
      setActivePortfolioName(name);
      setActivePortfolioId("live");
      setActiveDemoId(null);
    },
    clearPortfolioContext: () => {
      setPortfolioMode("none");
      setActivePortfolioName("No portfolio selected");
      setActivePortfolioId(null);
      setActiveDemoId(null);
    },
  };

  return <PortfolioAnalyticsContext.Provider value={value}>{children}</PortfolioAnalyticsContext.Provider>;
};

export const usePortfolioAnalytics = (): PortfolioAnalyticsState => {
  const ctx = useContext(PortfolioAnalyticsContext);
  if (!ctx) {
    throw new Error("usePortfolioAnalytics must be used within a PortfolioAnalyticsProvider");
  }
  return ctx;
};
