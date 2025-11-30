export interface PerformanceSummary {
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpe: number;
  sortino: number;
  maxDrawdown: number;
  hitRate: number;
}

export interface DrawdownWindow {
  startIndex: number;
  troughIndex: number;
  recoveryIndex: number | null;
  startDate: string;
  troughDate: string;
  recoveryDate: string | null;
  depth: number;
}

export interface RollingStat {
  date: string;
  vol: number;
  volAnn?: number;
  sharpe: number;
  beta: number | null;
}

export interface RiskContribution {
  ticker: string;
  weight: number;
  riskContribution: number | null;
  returnContribution: number | null;
}

export interface ConcentrationMetrics {
  hhi: number | null;
  topNWeightPct: number | null;
  topNTickers: string[];
}

export interface RiskDecomposition {
  positionContributions: RiskContribution[];
  concentration: ConcentrationMetrics;
  portfolioVol: number | null;
}

export interface BuildRiskDecompositionInput {
  tickers: string[];
  weights?: number[] | null;
  covariance?: number[][];
  vols?: number[];
  positionReturns?: number[];
  periodsPerYear?: number;
}

export interface PeriodReturn {
  periodLabel: string;
  year: number;
  month: number; // 1-12
  returnPct: number;
  isUp: boolean;
}

export interface PeriodStats {
  best: number | null;
  worst: number | null;
  avg: number | null;
  hitRate: number | null;
}

export interface ShockScenarioResult {
  shockPct: number;
  pnlPct: number | null;
  newEquity: number | null;
  maxDrawdownUnderShock: number | null;
}

export const equityCurveFromValues = (values: number[]) => {
  if (!values.length) return [];
  const first = values[0] || 1;
  return values.map((v) => (first === 0 ? 1 : v / first));
};

export const returnsFromEquity = (equity: number[]) => {
  const out: number[] = [];
  for (let i = 1; i < equity.length; i++) {
    const prev = equity[i - 1] || 1;
    out.push(prev === 0 ? 0 : equity[i] / prev - 1);
  }
  return out;
};

export const totalReturn = (equity: number[]) => {
  if (equity.length < 2) return 0;
  const first = equity[0] || 1;
  const last = equity[equity.length - 1];
  return first === 0 ? 0 : last / first - 1;
};

export const annualizedReturn = (returns: number[], periodsPerYear = 252) => {
  if (!returns.length) return 0;
  const cumulative = returns.reduce((acc, r) => acc * (1 + r), 1);
  const years = returns.length / periodsPerYear;
  return years === 0 ? 0 : Math.pow(cumulative, 1 / years) - 1;
};

export const volatility = (returns: number[], periodsPerYear = 252) => {
  if (!returns.length) return 0;
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance =
    returns.reduce((s, r) => s + (r - mean) * (r - mean), 0) / returns.length;
  return Math.sqrt(variance) * Math.sqrt(periodsPerYear);
};

export const downsideDeviation = (returns: number[], periodsPerYear = 252) => {
  if (!returns.length) return 0;
  const negatives = returns.filter((r) => r < 0);
  if (!negatives.length) return 0;
  const mean = negatives.reduce((s, r) => s + r, 0) / negatives.length;
  const variance =
    negatives.reduce((s, r) => s + (r - mean) * (r - mean), 0) / negatives.length;
  return Math.sqrt(variance) * Math.sqrt(periodsPerYear);
};

export const sharpeRatio = (returns: number[], periodsPerYear = 252) => {
  const vol = volatility(returns, periodsPerYear);
  if (vol === 0) return 0;
  const mean = returns.reduce((s, r) => s + r, 0) / (returns.length || 1);
  return (mean * periodsPerYear) / vol;
};

export const sortinoRatio = (returns: number[], periodsPerYear = 252) => {
  const downside = downsideDeviation(returns, periodsPerYear);
  if (downside === 0) return 0;
  const mean = returns.reduce((s, r) => s + r, 0) / (returns.length || 1);
  return (mean * periodsPerYear) / downside;
};

export const drawdownSeries = (equity: number[]) => {
  const out: number[] = [];
  let peak = -Infinity;
  equity.forEach((v) => {
    peak = Math.max(peak, v);
    out.push(peak === 0 ? 0 : (v - peak) / peak);
  });
  return out;
};

export const maxDrawdown = (equity: number[]) => {
  const dd = drawdownSeries(equity);
  return Math.min(0, ...dd);
};

export const drawdownWindows = (equity: number[], dates: string[]) => {
  if (!equity.length) return { windows: [], max: null as DrawdownWindow | null };
  const dd = drawdownSeries(equity);
  const windows: DrawdownWindow[] = [];
  let current: DrawdownWindow | null = null;
  let peakVal = equity[0];
  let peakIdx = 0;

  for (let i = 0; i < equity.length; i++) {
    const value = equity[i];
    const drawdown = dd[i];

    if (value > peakVal) {
      peakVal = value;
      peakIdx = i;
    }

    if (drawdown < 0 && !current) {
      current = {
        startIndex: peakIdx,
        troughIndex: i,
        recoveryIndex: null,
        startDate: dates[peakIdx],
        troughDate: dates[i],
        recoveryDate: null,
        depth: drawdown,
      };
    }

    if (current) {
      if (drawdown < current.depth) {
        current.depth = drawdown;
        current.troughIndex = i;
        current.troughDate = dates[i];
      }
      if (drawdown === 0) {
        current.recoveryIndex = i;
        current.recoveryDate = dates[i];
        windows.push(current);
        current = null;
      }
    }
  }

  if (current) {
    windows.push(current);
  }

  const sorted = [...windows].sort((a, b) => a.depth - b.depth);
  return { windows: sorted, max: sorted[0] || null };
};

export const hitRate = (returns: number[]) => {
  if (!returns.length) return 0;
  const wins = returns.filter((r) => r > 0).length;
  return wins / returns.length;
};

export const performanceSummary = (
  equity: number[],
  periodsPerYear = 252,
  precomputedReturns?: number[]
): PerformanceSummary => {
  const rets = precomputedReturns ?? returnsFromEquity(equity);
  return {
    totalReturn: totalReturn(equity),
    annualizedReturn: annualizedReturn(rets, periodsPerYear),
    volatility: volatility(rets, periodsPerYear),
    sharpe: sharpeRatio(rets, periodsPerYear),
    sortino: sortinoRatio(rets, periodsPerYear),
    maxDrawdown: maxDrawdown(equity),
    hitRate: hitRate(rets),
  };
};

export const rollingStatsWithBeta = (
  returns: number[],
  benchmark: number[] | null,
  dates: string[],
  window = 60
): RollingStat[] => {
  const out: RollingStat[] = [];
  for (let i = window; i < returns.length; i++) {
    const rSlice = returns.slice(i - window, i);
    const avg = rSlice.reduce((s, v) => s + v, 0) / (rSlice.length || 1);
    const vol = Math.sqrt(
      rSlice.reduce((s, v) => s + (v - avg) * (v - avg), 0) /
        (rSlice.length || 1)
    );
    const volAnn = vol * Math.sqrt(252);
    const sharpe = vol ? (avg / vol) * Math.sqrt(252) : 0;
    let beta: number | null = null;
    if (benchmark && benchmark.length === returns.length) {
      const bSlice = benchmark.slice(i - window, i);
      const bAvg = bSlice.reduce((s, v) => s + v, 0) / (bSlice.length || 1);
      const cov =
        rSlice.reduce((s, v, idx) => s + (v - avg) * (bSlice[idx] - bAvg), 0) /
        (rSlice.length || 1);
      const bVar =
        bSlice.reduce((s, v) => s + (v - bAvg) * (v - bAvg), 0) /
        (bSlice.length || 1);
      beta = bVar ? cov / bVar : null;
    }
    out.push({ date: dates[i], vol, volAnn, sharpe, beta });
  }
  return out;
};

export const relativePerformanceSeries = (
  portfolioEquity: Array<{ date: string; equity: number }>,
  benchmarkEquity: Array<{ date: string; equity: number }>
) => {
  if (!portfolioEquity.length || !benchmarkEquity.length) return [];
  const benchmarkMap = new Map<string, number>();
  benchmarkEquity.forEach((row) => benchmarkMap.set(row.date, row.equity));
  return portfolioEquity
    .filter((row) => benchmarkMap.has(row.date))
    .map((row) => ({
      date: row.date,
      relative: row.equity - (benchmarkMap.get(row.date) ?? 0),
    }));
};

/**
 * Compute a risk decomposition for a portfolio using variance-share (Euler) contributions.
 *
 * - riskContribution: fraction of total portfolio variance contributed by each position
 *   (numbers in [0,1] that sum to 1 when covariance is valid/positive-definite).
 * - returnContribution: fraction of total portfolio return contributed by each position;
 *   may be negative if a position detracts from performance.
 * - portfolioVol: per-period portfolio volatility; null if covariance is missing/invalid.
 * - concentration.hhi: Herfindahl–Hirschman index of weights (0–1).
 * - concentration.topNWeightPct: fraction of weight in the top 5 positions (0–1).
 */
export const buildRiskDecomposition = (input: BuildRiskDecompositionInput): RiskDecomposition | null => {
  const { tickers, weights, covariance, vols, positionReturns, periodsPerYear = 252 } = input;

  const n = tickers.length;
  if (!n) {
    return {
      positionContributions: [],
      concentration: { hhi: null, topNWeightPct: null, topNTickers: [] },
      portfolioVol: null,
    };
  }

  const normalizedWeights = (() => {
    if (!weights || !weights.length || weights.length !== n) return null;
    const sum = weights.reduce((s, w) => s + w, 0);
    if (!Number.isFinite(sum) || sum <= 0) return null;
    return weights.map((w) => w / sum);
  })();

  const neutral = (): RiskDecomposition => ({
    positionContributions: tickers.map((t, i) => ({
      ticker: t,
      weight: normalizedWeights?.[i] ?? 0,
      riskContribution: null,
      returnContribution: null,
    })),
    concentration: buildConcentration(normalizedWeights, tickers),
    portfolioVol: null,
  });

  if (!normalizedWeights) {
    return {
      positionContributions: [],
      concentration: { hhi: null, topNWeightPct: null, topNTickers: [] },
      portfolioVol: null,
    };
  }

  const covMatrix = buildCovariance(normalizedWeights, covariance, vols);
  if (!covMatrix) {
    return neutral();
  }

  const portVar = portfolioVariance(normalizedWeights, covMatrix);
  if (!Number.isFinite(portVar) || portVar <= 0) {
    return neutral();
  }

  const mc = marginalContributions(normalizedWeights, covMatrix);
  const rawRiskContribs = mc.map((m, i) => (normalizedWeights[i] * m) / portVar);
  const clipped = rawRiskContribs.map((rc) => Math.max(0, rc));
  const sumClipped = clipped.reduce((s, v) => s + v, 0);
  const riskContribs =
    sumClipped > 0 ? clipped.map((rc) => rc / sumClipped) : Array.from({ length: n }, () => null);

  const retContribs = (() => {
    if (!positionReturns || positionReturns.length !== n) return Array.from({ length: n }, () => null as number | null);
    const totalRet = positionReturns.reduce((s, r, i) => s + normalizedWeights[i] * r, 0);
    if (!Number.isFinite(totalRet) || Math.abs(totalRet) < 1e-12) {
      return Array.from({ length: n }, () => null as number | null);
    }
    return positionReturns.map((r, i) => (normalizedWeights[i] * r) / totalRet);
  })();

  const positionContributions: RiskContribution[] = tickers.map((t, i) => ({
    ticker: t,
    weight: normalizedWeights[i] ?? 0,
    riskContribution: riskContribs[i] ?? null,
    returnContribution: retContribs[i] ?? null,
  }));

  const portVol = Math.sqrt(portVar);
  // Optional annualized volatility (not returned): const portVolAnn = portVol * Math.sqrt(periodsPerYear);

  return {
    positionContributions,
    concentration: buildConcentration(normalizedWeights, tickers),
    portfolioVol: Number.isFinite(portVol) ? portVol : null,
  };
};

const buildCovariance = (
  weights: number[],
  covariance?: number[][],
  vols?: number[]
): number[][] | null => {
  const n = weights.length;
  if (covariance && covariance.length === n && covariance.every((row) => row.length === n)) {
    return covariance;
  }
  if (vols && vols.length === n) {
    return vols.map((v, i) =>
      Array.from({ length: n }, (_, j) => (i === j ? v * v : 0))
    );
  }
  return null;
};

const portfolioVariance = (weights: number[], cov: number[][]): number => {
  const n = weights.length;
  let variance = 0;
  for (let i = 0; i < n; i++) {
    const wi = weights[i];
    for (let j = 0; j < n; j++) {
      variance += wi * cov[i]?.[j] * weights[j];
    }
  }
  return variance;
};

const marginalContributions = (weights: number[], cov: number[][]): number[] => {
  const n = weights.length;
  const mc = Array.from({ length: n }, () => 0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      mc[i] += cov[i][j] * weights[j];
    }
  }
  return mc;
};

const buildConcentration = (weights: number[] | null, tickers: string[]): ConcentrationMetrics => {
  if (!weights || !weights.length) {
    return { hhi: null, topNWeightPct: null, topNTickers: [] };
  }
  const hhi = weights.reduce((s, w) => s + w * w, 0);
  const sorted = tickers
    .map((t, i) => ({ t, w: weights[i] ?? 0 }))
    .sort((a, b) => b.w - a.w);
  const top = sorted.slice(0, Math.min(5, sorted.length));
  const topNWeightPct = top.reduce((s, row) => s + row.w, 0);
  const topNTickers = top.map((row) => row.t);
  return { hhi, topNWeightPct, topNTickers };
};

export const aggregatePeriodReturns = (
  returns: number[],
  dates: string[],
  bucket: "month" | "quarter" = "month"
): { periods: PeriodReturn[]; stats: PeriodStats } => {
  if (!returns.length || !dates.length) {
    return { periods: [], stats: { best: null, worst: null, avg: null, hitRate: null } };
  }
  const buckets = new Map<
    string,
    { prod: number; count: number; year: number; month: number }
  >();
  for (let i = 0; i < returns.length; i++) {
    const dateStr = dates[i + 1] || dates[i]; // align return with end-of-period date
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) continue;
    const month = d.getUTCMonth() + 1;
    const year = d.getUTCFullYear();
    const periodMonth = bucket === "quarter" ? Math.ceil(month / 3) : month;
    const key = bucket === "quarter" ? `${year}-Q${periodMonth}` : `${year}-${periodMonth}`;
    const entry = buckets.get(key) || { prod: 1, count: 0, year, month: periodMonth };
    entry.prod *= 1 + returns[i];
    entry.count += 1;
    buckets.set(key, entry);
  }

  const periods: PeriodReturn[] = Array.from(buckets.entries())
    .map(([key, val]) => {
      const ret = val.prod - 1;
      return {
        periodLabel: key,
        year: val.year,
        month: val.month,
        returnPct: ret,
        isUp: ret > 0,
      };
    })
    .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);

  const returnsList = periods.map((p) => p.returnPct);
  const best = returnsList.length ? Math.max(...returnsList) : null;
  const worst = returnsList.length ? Math.min(...returnsList) : null;
  const avg = returnsList.length
    ? returnsList.reduce((s, v) => s + v, 0) / returnsList.length
    : null;
  const hitRate = returnsList.length
    ? periods.filter((p) => p.returnPct > 0).length / returnsList.length
    : null;

  return {
    periods,
    stats: { best, worst, avg, hitRate },
  };
};

const peakFromEquity = (equity: number[]) => {
  let peak = -Infinity;
  equity.forEach((v) => {
    peak = Math.max(peak, v);
  });
  return peak;
};

export const runShockScenario = ({
  equity,
  shockPct,
  beta = 1,
}: {
  equity: number[];
  shockPct: number;
  beta?: number | null;
}): ShockScenarioResult => {
  if (!equity.length) {
    return { shockPct, pnlPct: null, newEquity: null, maxDrawdownUnderShock: null };
  }
  const effectiveBeta = beta ?? 1;
  const portfolioShock = shockPct * effectiveBeta;
  const last = equity[equity.length - 1] || 1;
  const newEquity = last * (1 + portfolioShock);
  const pnlPct = (newEquity / last) - 1;
  const peak = peakFromEquity(equity);
  const existingDd = maxDrawdown(equity);
  const newDd = peak === 0 ? null : newEquity / peak - 1;
  const maxDd = newDd == null ? existingDd : Math.min(existingDd, newDd);
  return {
    shockPct,
    pnlPct,
    newEquity,
    maxDrawdownUnderShock: maxDd,
  };
};

export const runShockSet = (equity: number[], shocks: number[], beta?: number | null) =>
  shocks.map((s) => runShockScenario({ equity, shockPct: s, beta }));
