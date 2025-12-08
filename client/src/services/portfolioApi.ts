import { apiClient } from "./apiClient";
import {
  BacktestResponse,
  BenchmarkResponse,
  EfficientFrontierResponse,
  FactorExposureResponse,
  MonteCarloResponse,
  PortfolioDashboardResponse,
  PortfolioMetricsResponse,
  Position,
  PositionSizingResponse,
  PresetMap,
  RebalanceResponse,
  RiskBreakdownResponse,
  StrategyBuilderResponse,
  StressTestResponse,
  TaxHarvestResponse,
} from "../types/portfolio";

export const portfolioApi = {
  // Overview
  getPortfolioDashboard: (payload: {
    tickers: string[];
    quantities: number[];
    prices: number[];
    cost_basis: number[];
    target_weights: number[];
    start_date: string | null;
    end_date: string | null;
  }) => apiClient.post<PortfolioDashboardResponse>("/api/portfolio-dashboard", payload),

  uploadPositions: (formData: FormData) =>
    apiClient.post<Position[]>("/api/upload-positions", formData),

  // Presets
  getPresets: () => apiClient.get<PresetMap>("/api/presets"),
  savePreset: (payload: { name: string; tickers: string[]; weights?: number[] | null }) =>
    apiClient.post<void>("/api/presets", payload),
  health: () => apiClient.get<{ status: string }>("/api/health"),

  // Core analytics
  getPortfolioMetrics: (payload: {
    tickers: string[];
    weights?: number[] | null;
    start_date?: string | null;
    end_date?: string | null;
  }) => apiClient.post<PortfolioMetricsResponse>("/api/portfolio-metrics", payload),

  runBacktest: (payload: {
    strategy: string;
    tickers: string[];
    weights?: number[] | null;
    start_date?: string | null;
    end_date?: string | null;
    rebalance_frequency?: string | null;
    benchmark?: string | null;
    parameters?: Record<string, unknown>;
  }) => apiClient.post<BacktestResponse>("/api/backtest", payload),

  runStrategyBuilder: (payload: {
    tickers: string[];
    weights?: number[] | null;
    start_date?: string | null;
    end_date?: string | null;
    rules: unknown[];
    stop_loss?: number | null;
    take_profit?: number | null;
    benchmark?: string | null;
  }) => apiClient.post<StrategyBuilderResponse>("/api/strategy-builder", payload),

  getFactorExposures: (payload: {
    tickers: string[];
    weights?: number[] | null;
    start_date?: string | null;
    end_date?: string | null;
  }) => apiClient.post<FactorExposureResponse>("/api/factor-exposures", payload),

  getRiskBreakdown: (payload: {
    tickers: string[];
    weights?: number[] | null;
    start_date?: string | null;
    end_date?: string | null;
  }) => apiClient.post<RiskBreakdownResponse>("/api/risk-breakdown", payload),

  getBenchmarkComparison: (payload: {
    tickers: string[];
    weights?: number[] | null;
    benchmark: string;
    start_date?: string | null;
    end_date?: string | null;
  }) => apiClient.post<BenchmarkResponse>("/api/benchmark", payload),

  runMonteCarlo: (payload: {
    tickers: string[];
    weights?: number[] | null;
    simulations: number;
    horizon_days: number;
    start_date?: string | null;
    end_date?: string | null;
  }) => apiClient.post<MonteCarloResponse>("/api/monte-carlo", payload),

  runStressTest: (payload: {
    tickers: string[];
    weights?: number[] | null;
    scenario: string;
  }) => apiClient.post<StressTestResponse>("/api/stress-test", payload),

  getEfficientFrontier: (payload: {
    tickers: string[];
    start_date?: string | null;
    end_date?: string | null;
  }) => apiClient.post<EfficientFrontierResponse>("/api/efficient-frontier", payload),

  // Unified portfolio analytics
  getPortfolioAnalytics: (payload: {
    tickers: string[];
    quantities?: number[] | null;
    prices?: number[] | null;
    benchmark?: string | null;
    start_date?: string | null;
    end_date?: string | null;
  }) => apiClient.post("/api/v2/portfolio-analytics", payload),

  runBacktestAnalytics: (payload: {
    tickers: string[];
    weights?: number[] | null;
    benchmark?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    rebalance_freq?: string | null;
    trading_cost_bps?: number | null;
  }) => apiClient.post("/api/v2/backtest-analytics", payload),

  getRun: (runId: string) => apiClient.get(`/api/runs/${runId}`),
  listRuns: (limit = 20) => apiClient.get(`/api/runs?limit=${limit}`),

  runQuantBacktest: (payload: {
    strategy: Record<string, any>;
    slippage_bps?: number;
    commission_per_trade?: number;
    max_position_size?: number;
    benchmark?: string | null;
  }) => apiClient.post("/api/v1/quant/backtest", payload),

  getRegimes: (payload: { symbol: string; start_date: string; end_date: string; n_states?: number; model_type?: string }) =>
    apiClient.post("/api/v1/quant/regimes", payload),

  runMicrostructure: (payload: {
    symbol: string;
    start_date: string;
    end_date: string;
    bar_interval?: string;
  }) => apiClient.post("/api/v1/quant/microstructure", payload),

  runPMBacktest: (payload: {
    tickers: string[];
    weights?: number[] | null;
    start_date?: string | null;
    end_date?: string | null;
    rebalance_freq?: string | null;
    benchmark?: string | null;
  }) => apiClient.post("/api/v1/pm/backtest", payload),
  getPMBacktestDemo: () => apiClient.get("/api/v1/pm/backtest/demo"),

  getPMAllocation: (payload: {
    tickers: string[];
    quantities?: number[] | null;
    prices?: number[] | null;
    target_weights?: number[] | null;
    tolerance?: number | null;
  }) => apiClient.post("/api/v1/pm/allocation", payload),

  calculatePositionSizing: (payload: {
    ticker: string;
    entry_price: number;
    stop_price: number;
    portfolio_value: number;
    risk_per_trade_pct: number;
  }) => apiClient.post<PositionSizingResponse>("/api/position-sizing", payload),

  getRebalance: (payload: {
    tickers: string[];
    current_weights: number[];
    target_weights: number[];
    portfolio_value: number;
    prices: number[];
  }) => apiClient.post<RebalanceResponse>("/api/rebalance", payload),

  getTaxHarvest: (payload: {
    positions: Array<{
      ticker: string;
      quantity: number;
      cost_basis: number;
      current_price: number;
      description?: string | null;
    }>;
    realized_gains?: number | null;
    offset_target_pct?: number | null;
  }) => apiClient.post<TaxHarvestResponse>("/api/tax-harvest", payload),
};
