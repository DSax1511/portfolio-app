export interface MicrostructurePoint {
  date: string;
  return: number;
  volume: number;
  orderFlow: number;
  nextReturn?: number | null;
  spreadBps?: number | null;
}

export interface MicrostructureData {
  symbol: string;
  interval: string;
  startDate: string;
  endDate: string;
  points: MicrostructurePoint[];
  lastUpdated?: string;
}

export interface MicrostructureSummaryMetrics {
  avgReturn: number;
  volReturn: number;
  avgVolume: number;
  volVolume: number;
  avgOrderFlow: number;
  volOrderFlow: number;
  orderFlowVsNextReturnCorr: number | null;
  returnAutocorrLag1: number | null;
  volumeAutocorrLag1: number | null;
  avgSpreadBps: number | null;
}

export interface LagCorrelationRow {
  lag: number;
  orderFlowVsReturnCorr: number | null;
}

export interface AlphaSignalSummary {
  r2OrderFlowToNextReturn: number | null;
  betaOrderFlowToNextReturn: number | null;
}

export interface RollingCorrelationPoint {
  date: string;
  correlation: number | null;
}

export const DEFAULT_LAGS = [1, 2, 5];

const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

const mean = (values: number[]): number => {
  if (!values.length) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
};

const stdDev = (values: number[]): number => {
  if (values.length === 0) return 0;
  const m = mean(values);
  const variance = values.reduce((acc, v) => acc + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
};

/**
 * Pearson correlation between two vectors. Returns null when insufficient data or zero variance.
 */
const pearsonCorr = (x: number[], y: number[]): number | null => {
  if (x.length !== y.length || x.length < 2) return null;
  const mx = mean(x);
  const my = mean(y);
  const dx = x.map((v) => v - mx);
  const dy = y.map((v) => v - my);
  const denom = Math.sqrt(dx.reduce((s, v) => s + v * v, 0) * dy.reduce((s, v) => s + v * v, 0));
  if (denom === 0) return null;
  const num = dx.reduce((s, v, i) => s + v * dy[i], 0);
  return num / denom;
};

/**
 * Computes core summary statistics for microstructure points.
 * Uses population standard deviations and returns null for correlations when insufficient data.
 */
export const computeMicrostructureSummary = (data: MicrostructureData): MicrostructureSummaryMetrics => {
  const pts = data.points || [];
  const returns = pts.map((p) => p.return).filter(isFiniteNumber);
  const volumes = pts.map((p) => p.volume).filter(isFiniteNumber);
  const orderFlows = pts.map((p) => p.orderFlow).filter(isFiniteNumber);
  const nextReturns = pts.map((p) => p.nextReturn).filter((v): v is number => isFiniteNumber(v));
  const spreads = pts.map((p) => p.spreadBps).filter((v): v is number => isFiniteNumber(v));

  const minLen = Math.min(orderFlows.length, nextReturns.length);
  const ofCorr =
    minLen >= 2 ? pearsonCorr(orderFlows.slice(0, minLen), nextReturns.slice(0, minLen)) : null;

  const retLag1 =
    returns.length >= 2
      ? pearsonCorr(returns.slice(0, -1), returns.slice(1))
      : null;
  const volLag1 =
    volumes.length >= 2
      ? pearsonCorr(volumes.slice(0, -1), volumes.slice(1))
      : null;

  return {
    avgReturn: mean(returns),
    volReturn: stdDev(returns),
    avgVolume: mean(volumes),
    volVolume: stdDev(volumes),
    avgOrderFlow: mean(orderFlows),
    volOrderFlow: stdDev(orderFlows),
    orderFlowVsNextReturnCorr: ofCorr,
    returnAutocorrLag1: retLag1,
    volumeAutocorrLag1: volLag1,
    avgSpreadBps: spreads.length ? mean(spreads) : null,
  };
};

/**
 * Correlate order flow at t with returns at t + lag for each requested lag.
 */
export const computeLagCorrelations = (data: MicrostructureData, lags: number[]): LagCorrelationRow[] => {
  const pts = data.points || [];
  return lags.map((lag) => {
    if (lag < 1 || pts.length <= lag) {
      return { lag, orderFlowVsReturnCorr: null };
    }
    const of = [];
    const futureRet = [];
    for (let i = 0; i + lag < pts.length; i += 1) {
      const a = pts[i];
      const b = pts[i + lag];
      if (isFiniteNumber(a.orderFlow) && isFiniteNumber(b.return)) {
        of.push(a.orderFlow);
        futureRet.push(b.return);
      }
    }
    return { lag, orderFlowVsReturnCorr: pearsonCorr(of, futureRet) };
  });
};

/**
 * Simple OLS: nextReturn ~ alpha + beta * orderFlow. Returns beta and R².
 */
export const computeAlphaSignalSummary = (data: MicrostructureData): AlphaSignalSummary => {
  const pairs = data.points
    .filter((p) => isFiniteNumber(p.orderFlow) && isFiniteNumber(p.nextReturn))
    .map((p) => ({ x: p.orderFlow as number, y: p.nextReturn as number }));

  if (pairs.length < 2) return { betaOrderFlowToNextReturn: null, r2OrderFlowToNextReturn: null };

  const x = pairs.map((p) => p.x);
  const y = pairs.map((p) => p.y);
  const mx = mean(x);
  const my = mean(y);
  const denom = x.reduce((s, v) => s + (v - mx) ** 2, 0);
  if (denom === 0) return { betaOrderFlowToNextReturn: null, r2OrderFlowToNextReturn: null };
  const beta = x.reduce((s, v, i) => s + (v - mx) * (y[i] - my), 0) / denom;
  const alpha = my - beta * mx;

  const fitted = x.map((v) => alpha + beta * v);
  const ssTot = y.reduce((s, v) => s + (v - my) ** 2, 0);
  const ssRes = y.reduce((s, v, i) => s + (v - fitted[i]) ** 2, 0);
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  return { betaOrderFlowToNextReturn: beta, r2OrderFlowToNextReturn: r2 };
};

/**
 * Rolling correlation of order flow vs next return over a fixed window (default 20 bars).
 */
export const computeRollingCorrelation = (
  data: MicrostructureData,
  window = 20
): RollingCorrelationPoint[] => {
  const pts = data.points || [];
  const result: RollingCorrelationPoint[] = [];
  if (pts.length < window) return result;
  for (let i = 0; i + window <= pts.length; i += 1) {
    const slice = pts.slice(i, i + window);
    const of = slice.map((p) => p.orderFlow).filter(isFiniteNumber);
    const nr = slice.map((p) => p.nextReturn).filter((v): v is number => isFiniteNumber(v));
    if (of.length === window && nr.length === window) {
      result.push({
        date: slice[slice.length - 1]?.date,
        correlation: pearsonCorr(of, nr),
      });
    } else {
      result.push({
        date: slice[slice.length - 1]?.date,
        correlation: null,
      });
    }
  }
  return result;
};
