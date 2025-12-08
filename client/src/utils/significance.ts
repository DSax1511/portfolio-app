export interface MetricSignificanceMeta {
  threshold: number;
  info: string;
}

export const METRIC_SIGNIFICANCE_CONFIG: Record<string, MetricSignificanceMeta> = {
  Sharpe: {
    threshold: 0.5,
    info: "Sharpe ratio = (mean portfolio excess return) / volatility. Assumes approximately Gaussian returns over the sample.",
  },
  Sortino: {
    threshold: 0.4,
    info: "Sortino isolates downside volatility. We compare excess returns to downside deviation assuming returns are stationary.",
  },
  Alpha: {
    threshold: 0.1,
    info: "Alpha is the intercept from a regression versus the benchmark, interpreted as active edge net of beta.",
  },
  Beta: {
    threshold: 0.2,
    info: "Beta measures linear sensitivity to the benchmark. We use OLS on log returns over the sample window.",
  },
  Correlation: {
    threshold: 0.12,
    info: "Correlation is Pearson's ρ between two series; small magnitudes are hard to distinguish from noise unless the sample is very large.",
  },
  Autocorrelation: {
    threshold: 0.15,
    info: "Autocorrelation is measured on daily log-returns. Values near zero are likely noise without longer samples.",
  },
};

const DEFAULT_SIGNIFICANCE_HINT = "Not statistically distinguishable from noise given the current sample.";

const applySampleAdjustment = (threshold: number, sampleSize?: number): number => {
  if (!sampleSize) return threshold;
  if (sampleSize > 500) {
    return Math.max(0.03, threshold - 0.08);
  }
  if (sampleSize > 250) {
    return Math.max(0.05, threshold - 0.05);
  }
  return threshold;
};

export const getSignificanceHint = () => DEFAULT_SIGNIFICANCE_HINT;

export const isMetricSignificant = (
  value: number | null | undefined,
  metricKey: string,
  sampleSize?: number
): boolean => {
  if (!Number.isFinite(value)) return false;
  const meta = METRIC_SIGNIFICANCE_CONFIG[metricKey];
  if (!meta) return true;
  const effectiveThreshold = applySampleAdjustment(meta.threshold, sampleSize);
  return Math.abs(value) >= effectiveThreshold;
};

export const getMetricMethodology = (metricKey: string): string | undefined => METRIC_SIGNIFICANCE_CONFIG[metricKey]?.info;
