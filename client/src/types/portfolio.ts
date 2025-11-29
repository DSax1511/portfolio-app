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
}

export interface StrategyBuilderResponse extends BacktestResponse {}

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

export interface BenchmarkResponse {
  benchmark: string;
  alpha: number;
  beta: number;
  tracking_error: number;
  returns: number[];
  equity_curve: EquityCurve;
  rolling?: Record<string, unknown> | null;
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
