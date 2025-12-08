export interface Position {
  ticker: string;
  description?: string;
  quantity: number;
  cost_basis?: number;
  avg_cost: number;
  current_price: number;
  market_value: number;
  pnl: number;
}

export interface RebalanceTrade {
  ticker: string;
  action: string;
  shares: number;
  value: number;
}

export interface RebalanceResponse {
  trades: RebalanceTrade[];
  estimated_turnover_pct: number;
}

export interface PortfolioDashboardResponse {
  top_risk_contributors: Array<{ ticker: string; pct_variance: number }>;
  overweight_underweight: Array<{
    ticker: string;
    current_weight: number;
    target_weight: number;
    status: "overweight" | "underweight" | "on target";
    diff: number;
  }>;
  largest_drawdowns: Array<{ ticker: string; drawdown: number }>;
  rebalance?: RebalanceResponse;
}

export interface EquityCurve {
  dates: string[];
  equity: number[];
}

export interface PerformanceMetrics {
  cumulative_return: number;
  annualized_return: number;
  annualized_volatility: number;
  sharpe_ratio: number;
  max_drawdown: number;
  [key: string]: number;
}

export interface PortfolioMetricsResponse {
  tickers: string[];
  weights: number[];
  start_date?: string | null;
  end_date?: string | null;
  metrics: PerformanceMetrics;
  equity_curve: EquityCurve;
  benchmark?: BenchmarkResponse | null;
  commentary?: Record<string, string> | null;
}

export interface BacktestResponse extends PortfolioMetricsResponse {
  strategy: string;
  parameters: Record<string, unknown>;
  returns: number[];
  dates: string[];
  benchmark?: BenchmarkResponse;
  rolling_active?: Record<string, unknown>;
  turnover: number;
  run_id?: string;
  commentary?: Record<string, string> | null;
}

export interface StrategyBuilderResponse extends BacktestResponse {}

export interface PMBacktestResponse {
  dates: string[];
  portfolio_equity: number[];
  benchmark_equity: number[];
  portfolio_returns: number[];
  benchmark_returns: number[];
  summary: {
    cagr: number;
    benchmark_cagr: number;
    annualized_volatility: number;
    sharpe_ratio: number;
    sortino_ratio: number;
    max_drawdown: number;
    beta: number;
    alpha: number;
    tracking_error: number;
    total_return?: number;
    hit_rate?: number;
  };
  run_id?: string;
  analytics?: any;
}

export interface AllocationItem {
  ticker: string;
  name?: string | null;
  weight: number;
  target_weight?: number | null;
  drift?: number | null;
  value?: number | null;
  asset_class?: string | null;
  sector?: string | null;
}

export interface PMAllocationResponse {
  items: AllocationItem[];
  as_of: string;
  total_value?: number | null;
  summary: {
    max_drift?: number;
    outside_tolerance?: number;
    turnover_to_rebalance?: number;
    [key: string]: number | undefined;
  };
}

export interface MicrostructureBar {
  timestamp: string;
  midprice: number;
  return_: number;
  next_return?: number | null;
  volume: number;
  order_flow_proxy: number;
  spread_proxy?: number | null;
}

export interface MicrostructureSummary {
  avg_spread?: number | null;
  median_spread?: number | null;
  avg_volume: number;
  volatility: number;
  of_next_return_corr?: number | null;
}

export interface MicrostructureResponse {
  symbol: string;
  bar_interval: string;
  as_of: string;
  bars: MicrostructureBar[];
  summary: MicrostructureSummary;
}

export interface RegimePoint {
  timestamp: string;
  price: number;
  return_: number;
  regime: number;
}

export interface RegimeStats {
  regime: number;
  n_obs: number;
  pct_time: number;
  avg_return: number;
  vol: number;
  sharpe: number;
  max_drawdown: number;
}

export interface RegimeSummary {
  symbol: string;
  start_date: string;
  end_date: string;
  n_states: number;
  overall_vol: number;
  overall_sharpe: number;
  regimes: RegimeStats[];
}

export interface RegimeRequest {
  symbol: string;
  start_date: string;
  end_date: string;
  n_states?: number;
  model_type?: "threshold" | "hmm_vol";
}

export interface RegimeResponse {
  summary: RegimeSummary;
  series: RegimePoint[];
}

export interface FactorExposureResponse {
  loadings: Array<{ factor: string; beta: number }>;
  r2: number;
  residual_vol: number;
}

export interface RiskBreakdownResponse {
  contributions: Array<{ ticker: string; pct_variance: number }>;
  portfolio_vol: number;
  diversification_ratio?: number;
  tickers: string[];
  corrMatrix: number[][];
  correlation?: Record<string, Record<string, number>>;
}

export interface HarvestCandidate {
  symbol: string;
  lot_id: string;
  quantity: number;
  cost_basis: number;
  current_price: number;
  purchase_date: string;
  unrealized_pl: number;
  unrealized_pl_pct: number;
  days_held: number;
  wash_sale_risk: boolean;
}

export interface TaxHarvestSummary {
  total_unrealized_losses: number;
  max_harvestable_loss: number;
  target_loss_to_realize: number;
  estimated_tax_savings: number;
  marginal_tax_rate: number;
}

export interface TaxHarvestResponse {
  summary: TaxHarvestSummary;
  candidates: HarvestCandidate[];
  selected_candidates: HarvestCandidate[];
}

export interface BenchmarkResponse {
  benchmark: string;
  alpha: number;
  beta: number;
  tracking_error: number;
  returns: number[];
  equity_curve: EquityCurve;
  rolling?: Record<string, unknown> | null;
  relative?: number[];
}

export interface MonteCarloResponse {
  mean_return: number | null;
  median_return: number | null;
  var_5: number | null;
  cvar_5: number | null;
  ending_values: number[];
  prob_loss_20: number | null;
  prob_target: number | null;
  min: number | null;
  max: number | null;
  median: number | null;
}

export interface StressTestResponse {
  max_drawdown?: number | null;
  recovery_time_days?: number | null;
  worst_day_return?: number | null;
  dates?: string[];
  equity_curve: EquityCurve;
}

export interface EfficientFrontierPoint {
  return: number;
  vol: number;
}

export interface EfficientFrontierResponse {
  frontier: EfficientFrontierPoint[];
  max_sharpe: EfficientFrontierPoint;
  min_vol: EfficientFrontierPoint;
}

export interface PositionSizingResponse {
  ticker: string;
  shares: number;
  position_value: number;
  risk_amount: number;
  risk_pct_of_portfolio: number;
}

export interface Preset {
  name: string;
  tickers: string[];
  weights?: number[] | null;
}

export type PresetMap = Record<string, { tickers: string[]; weights?: number[] | null }>;
