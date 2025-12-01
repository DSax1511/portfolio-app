import { useMemo, useState } from "react";

import Card from "../../components/ui/Card";
import PageShell from "../../components/ui/PageShell";
import ErrorBanner from "../../components/ui/ErrorBanner";
import Spinner from "../../components/ui/Spinner";
import { usePortfolioAnalytics } from "../../state/portfolioAnalytics";
import { useActiveRun } from "../../state/activeRun";

// Import existing analytics components
import EquityCurveChart from "../analytics/components/EquityCurveChart";
import DrawdownChart from "../analytics/components/DrawdownChart";
import RollingStatsChart from "../analytics/components/RollingStatsChart";
import TopDrawdownsTable from "../analytics/components/TopDrawdownsTable";
import PeriodPerformance from "../analytics/components/PeriodPerformance";
import AssetContributionTable from "../analytics/components/AssetContributionTable";

const today = new Date();
const yearsAgo = (yrs) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - yrs);
  return d.toISOString().slice(0, 10);
};

const defaultForm = {
  tickers: "SPY, QQQ",
  weights: "",
  benchmark: "SPY",
  start_date: yearsAgo(3),
  end_date: today.toISOString().slice(0, 10),
  rebalance_freq: "monthly",
  trading_cost_bps: "0",
};

const metricFormat = (v, pct = false) => {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return pct ? `${(v * 100).toFixed(2)}%` : v.toFixed(2);
};

const HistoricalAnalysisPage = ({ onRunComplete }) => {
  const [form, setForm] = useState(defaultForm);
  const [hoveredDate, setHoveredDate] = useState(null);
  const { runBacktestAnalytics, backtestAnalytics, loading, error } = usePortfolioAnalytics();
  const { setActiveRun } = useActiveRun();

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const parsedTickers = useMemo(
    () => form.tickers.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean),
    [form.tickers]
  );

  const parsedWeights = useMemo(() => {
    if (!form.weights.trim()) return null;
    const nums = form.weights.split(",").map((w) => Number(w.trim())).filter((n) => !Number.isNaN(n));
    if (nums.length !== parsedTickers.length || nums.length === 0) return null;
    const total = nums.reduce((s, n) => s + n, 0);
    return total !== 0 ? nums.map((n) => n / total) : null;
  }, [form.weights, parsedTickers.length]);

  const validationError = useMemo(() => {
    if (parsedTickers.length === 0) return "At least one ticker is required.";
    if (form.weights.trim() && !parsedWeights) return "Weights must match ticker count.";
    if (new Date(form.start_date) >= new Date(form.end_date)) return "Start date must be before end date.";
    return null;
  }, [parsedTickers, parsedWeights, form.weights, form.start_date, form.end_date]);

  const runBacktest = async (e) => {
    e.preventDefault();
    if (validationError) return;

    const payload = {
      tickers: parsedTickers,
      weights: parsedWeights,
      benchmark: form.benchmark || "SPY",
      start_date: form.start_date,
      end_date: form.end_date,
      rebalance_freq: form.rebalance_freq,
      trading_cost_bps: parseFloat(form.trading_cost_bps) || 0.0,
    };
    const res = await runBacktestAnalytics(payload);
    const runId = res && res.run_id ? res.run_id : res?.params?.run_id;
    if (runId) {
      setActiveRun(runId, `PM ${payload.tickers.join(",")}`);
    }
    onRunComplete?.({
      strategy: "buy_and_hold",
      ...payload,
      rebalance_frequency: form.rebalance_freq,
      parameters: {},
    });
  };

  // Transform data for charts
  const combinedEquity = useMemo(() => {
    if (!backtestAnalytics?.equity_curve?.dates) return [];
    const dates = backtestAnalytics.equity_curve.dates;
    const portfolioEquity = backtestAnalytics.equity_curve.equity || [];
    const benchmarkEquity = backtestAnalytics.benchmark_curve?.equity || [];
    const relative = backtestAnalytics.relative_curve?.relative || [];
    return dates.map((d, i) => ({
      date: d,
      portfolio: portfolioEquity[i] || 1,
      benchmark: benchmarkEquity[i] || 1,
      relative: relative[i] || 0,
    }));
  }, [backtestAnalytics]);

  const drawdownSeries = useMemo(() => {
    if (!backtestAnalytics?.drawdown_series) return [];
    return backtestAnalytics.drawdown_series.map((d) => ({
      date: d.date,
      drawdown: d.drawdown * 100,
    }));
  }, [backtestAnalytics]);

  const topDrawdowns = useMemo(() => {
    if (!backtestAnalytics?.top_drawdowns) return [];
    return backtestAnalytics.top_drawdowns.map((dd) => ({
      start: dd.startDate || dd.start,
      trough: dd.troughDate || dd.trough,
      end: dd.recoveryDate || dd.end,
      depth: dd.depth,
    }));
  }, [backtestAnalytics]);

  const monthlyPeriods = useMemo(() => {
    if (!backtestAnalytics?.monthly_returns) return [];
    return backtestAnalytics.monthly_returns.map((m) => ({
      year: m.year,
      month: m.month,
      returnPct: m.returnPct,
      periodLabel: `${m.year}-${String(m.month).padStart(2, "0")}`,
    }));
  }, [backtestAnalytics]);

  const periodStats = useMemo(() => {
    if (!backtestAnalytics?.period_stats) return null;
    const ps = backtestAnalytics.period_stats;
    return {
      best: ps.best_period_return,
      worst: ps.worst_period_return,
      avg: ps.average_period_return,
      hitRate: ps.hit_rate_monthly,
    };
  }, [backtestAnalytics]);

  const summary = backtestAnalytics?.summary || {};
  const assetContributions = backtestAnalytics?.asset_contributions || [];

  return (
    <PageShell
      title="Historical Analysis – Backtest Lab"
      subtitle="Run comprehensive portfolio backtests with rebalancing, trading costs, and in-depth performance diagnostics."
    >
      <div className="analytics-grid">
        <Card title="Backtest Setup" subtitle="Configure your portfolio simulation">
          <form className="analytics-form" onSubmit={runBacktest}>
            <label>
              Tickers (comma-separated) <span className="required">*</span>
              <input
                value={form.tickers}
                onChange={handleChange("tickers")}
                placeholder="SPY, QQQ, IWM"
                required
              />
            </label>
            <label>
              Weights (comma-separated, optional)
              <input
                value={form.weights}
                onChange={handleChange("weights")}
                placeholder="Leave blank for equal weight"
              />
              <small className="muted">If specified, must match ticker count. Will be normalized to sum to 1.</small>
            </label>
            <label>
              Benchmark
              <input
                value={form.benchmark}
                onChange={handleChange("benchmark")}
                placeholder="SPY"
              />
              <small className="muted">Ticker to compare against (default: SPY)</small>
            </label>
            <div className="form-row">
              <label>
                Start date
                <input type="date" value={form.start_date} onChange={handleChange("start_date")} required />
              </label>
              <label>
                End date
                <input type="date" value={form.end_date} onChange={handleChange("end_date")} required />
              </label>
            </div>
            <label>
              Rebalance frequency
              <select value={form.rebalance_freq} onChange={handleChange("rebalance_freq")}>
                <option value="none">None (Buy & Hold)</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
              </select>
              <small className="muted">How often to rebalance back to target weights</small>
            </label>
            <label>
              Trading cost (basis points)
              <input
                type="number"
                step="0.1"
                min="0"
                value={form.trading_cost_bps}
                onChange={handleChange("trading_cost_bps")}
                placeholder="0"
              />
              <small className="muted">Cost per 100% turnover. E.g., 10 = 0.10% per full rebalance</small>
            </label>

            {validationError && <p className="error-text">{validationError}</p>}
            {error && <ErrorBanner message={error} onRetry={runBacktest} />}

            <button className="btn btn-primary" type="submit" disabled={loading || !!validationError}>
              {loading ? "Running backtest..." : "Run Analysis"}
            </button>
          </form>
        </Card>

        {loading && (
          <Card title="Running Analysis" subtitle="Computing portfolio metrics...">
            <Spinner size="lg" label="Fetching price data and calculating performance metrics..." />
          </Card>
        )}

        {backtestAnalytics && (
          <Card title="Performance Summary" subtitle="Key metrics vs benchmark">
            <div className="stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
              <div className="stat-box">
                <p className="metric-label">CAGR</p>
                <div className="metric-value">{metricFormat(summary.cagr, true)}</div>
              </div>
              <div className="stat-box">
                <p className="metric-label">Benchmark CAGR</p>
                <div className="metric-value">{metricFormat(summary.benchmark_cagr, true)}</div>
              </div>
              <div className="stat-box">
                <p className="metric-label">Annualized Vol</p>
                <div className="metric-value">{metricFormat(summary.annualized_volatility, true)}</div>
              </div>
              <div className="stat-box">
                <p className="metric-label">Sharpe</p>
                <div className="metric-value">{metricFormat(summary.sharpe_ratio)}</div>
              </div>
              <div className="stat-box">
                <p className="metric-label">Sortino</p>
                <div className="metric-value">{metricFormat(summary.sortino_ratio)}</div>
              </div>
              <div className="stat-box">
                <p className="metric-label">Max Drawdown</p>
                <div className="metric-value">{metricFormat(summary.max_drawdown, true)}</div>
              </div>
              <div className="stat-box">
                <p className="metric-label">Beta vs {form.benchmark}</p>
                <div className="metric-value">{metricFormat(summary.beta)}</div>
              </div>
              <div className="stat-box">
                <p className="metric-label">Alpha (ann.)</p>
                <div className="metric-value">{metricFormat(summary.alpha, true)}</div>
              </div>
              <div className="stat-box">
                <p className="metric-label">Tracking Error</p>
                <div className="metric-value">{metricFormat(summary.tracking_error, true)}</div>
              </div>
              <div className="stat-box">
                <p className="metric-label">Total Turnover</p>
                <div className="metric-value">{metricFormat(summary.total_turnover, true)}</div>
              </div>
              {summary.gross_cagr !== undefined && (
                <>
                  <div className="stat-box">
                    <p className="metric-label">Gross CAGR</p>
                    <div className="metric-value">{metricFormat(summary.gross_cagr, true)}</div>
                  </div>
                  <div className="stat-box">
                    <p className="metric-label">Net CAGR</p>
                    <div className="metric-value">{metricFormat(summary.net_cagr, true)}</div>
                  </div>
                </>
              )}
            </div>
          </Card>
        )}
      </div>

      {backtestAnalytics && (
        <>
          <Card title="Equity Curve" subtitle="Portfolio growth vs benchmark (normalized to 1.0)">
            <EquityCurveChart
              combinedSeries={combinedEquity}
              onHover={setHoveredDate}
              hoveredDate={hoveredDate}
            />
          </Card>

          <Card title="Drawdown Analysis" subtitle="Portfolio underwater curve">
            <DrawdownChart drawdownSeries={drawdownSeries} topDrawdowns={topDrawdowns} />
          </Card>

          <div className="analytics-grid">
            <Card title="Rolling Statistics" subtitle="60-day rolling volatility, Sharpe, and Beta">
              <RollingStatsChart rollingStats={backtestAnalytics.rolling_stats || []} />
            </Card>

            <Card title="Top Drawdowns" subtitle="Largest peak-to-trough declines">
              <TopDrawdownsTable topDrawdowns={topDrawdowns} />
            </Card>
          </div>

          <Card title="Period Returns (Monthly)" subtitle="Heatmap of monthly performance">
            <PeriodPerformance periods={monthlyPeriods} stats={periodStats} />
          </Card>

          {assetContributions.length > 0 && (
            <Card title="Asset Contribution" subtitle="Average weight and contribution to total return">
              <AssetContributionTable contributions={assetContributions} />
            </Card>
          )}
        </>
      )}

      {!backtestAnalytics && !loading && (
        <Card title="Ready to analyze" subtitle="Configure your backtest above">
          <p className="muted" style={{ textAlign: "center", padding: "2rem" }}>
            Set up your portfolio parameters above and click "Run Analysis" to see comprehensive performance metrics,
            drawdown analysis, rolling statistics, and period returns.
          </p>
        </Card>
      )}
    </PageShell>
  );
};

export default HistoricalAnalysisPage;
