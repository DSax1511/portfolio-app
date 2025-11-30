import { useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, CartesianGrid } from "recharts";

import Card from "../../components/ui/Card";
import PageShell from "../../components/ui/PageShell";
import ErrorBanner from "../../components/ui/ErrorBanner";
import { formatDateTick } from "../../utils/format";
import { usePortfolioAnalytics } from "../../state/portfolioAnalytics";
import { useActiveRun } from "../../state/activeRun";

const today = new Date();
const yearsAgo = (yrs) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - yrs);
  return d.toISOString().slice(0, 10);
};

const defaultForm = {
  tickers: "SPY, QQQ",
  weights: "",
  start_date: yearsAgo(3),
  end_date: today.toISOString().slice(0, 10),
  rebalance_freq: "monthly",
};

const metricFormat = (v, pct = false) => {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return pct ? `${(v * 100).toFixed(2)}%` : v.toFixed(2);
};

const HistoricalAnalysisPage = ({ onRunComplete }) => {
  const [form, setForm] = useState(defaultForm);
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

  const runBacktest = async (e) => {
    e.preventDefault();
    const payload = {
      tickers: parsedTickers,
      weights: parsedWeights,
      start_date: form.start_date,
      end_date: form.end_date,
      rebalance_freq: form.rebalance_freq,
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
      benchmark: "SPY",
      parameters: {},
    });
  };

  const chartData = useMemo(() => {
    if (!backtestAnalytics?.equity_curve?.dates) return [];
    const dates = backtestAnalytics.equity_curve.dates;
    const equity = backtestAnalytics.equity_curve.equity || [];
    const bench = backtestAnalytics.benchmark_curve?.equity || [];
    return dates.map((d, i) => ({
      date: d,
      portfolio: equity[i],
      benchmark: bench[i] ?? null,
    }));
  }, [backtestAnalytics]);

  return (
    <PageShell
      title="Historical Analysis"
      subtitle="Lean backtest control center: configure a scenario, compare to SPY, and review headline stats."
    >
      <div className="analytics-grid">
        <Card title="Analysis parameters" subtitle="Tickers, dates, weights, and rebalance cadence">
          <form className="analytics-form" onSubmit={runBacktest}>
            <label>
              Tickers (comma-separated)
              <input value={form.tickers} onChange={handleChange("tickers")} placeholder="SPY, QQQ, IWM" />
            </label>
            <label>
              Weights (comma-separated, optional)
              <input value={form.weights} onChange={handleChange("weights")} placeholder="leave blank for equal weight" />
            </label>
            <div className="form-row">
              <label>
                Start date
                <input type="date" value={form.start_date} onChange={handleChange("start_date")} />
              </label>
              <label>
                End date
                <input type="date" value={form.end_date} onChange={handleChange("end_date")} />
              </label>
            </div>
            <label>
              Rebalance frequency
              <select value={form.rebalance_freq} onChange={handleChange("rebalance_freq")}>
                <option value="none">None</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
              </select>
            </label>
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? "Running..." : "Run analysis"}
            </button>
            <ErrorBanner message={error} onRetry={runBacktest} />
            <p className="muted">Backtest outputs feed the Risk & Diagnostics view.</p>
          </form>
        </Card>

        {backtestAnalytics ? (
          <Card title="Equity curve vs SPY" subtitle="Normalized to 1.0 at start" className="chart-card">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ left: 12, right: 12, top: 8, bottom: 0 }}>
                <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={formatDateTick} minTickGap={32} stroke="#6b7280" />
                <YAxis tickFormatter={(v) => `${((v - 1) * 100).toFixed(0)}%`} stroke="#6b7280" />
                <Tooltip
                  labelFormatter={formatDateTick}
                  formatter={(val, name) => [`${((val - 1) * 100).toFixed(2)}%`, name]}
                  contentStyle={{ backgroundColor: "#0b1220", borderColor: "#1f2937" }}
                />
                <Legend />
                <Line type="monotone" dataKey="portfolio" name="Portfolio" stroke="#4f8cff" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="benchmark" name="SPY" stroke="#22c55e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        ) : (
          <Card title="Equity curve vs SPY" subtitle="Run a backtest to see results">
            <p className="muted">Configure a portfolio above and run the backtest to view the equity curve.</p>
          </Card>
        )}
      </div>

      {backtestAnalytics && (
        <Card title="Backtest summary" subtitle="Headline stats vs SPY">
          {error && <p className="error-text">{error}</p>}
          <div className="stats-grid">
            <div className="stat-box">
              <p className="metric-label">CAGR</p>
              <div className="metric-value">{metricFormat(backtestAnalytics.summary?.cagr, true)}</div>
            </div>
            <div className="stat-box">
              <p className="metric-label">Benchmark CAGR</p>
              <div className="metric-value">{metricFormat(backtestAnalytics.summary?.benchmark_cagr, true)}</div>
            </div>
            <div className="stat-box">
              <p className="metric-label">Annualized Vol</p>
              <div className="metric-value">{metricFormat(backtestAnalytics.summary?.annualized_volatility, true)}</div>
            </div>
            <div className="stat-box">
              <p className="metric-label">Sharpe</p>
              <div className="metric-value">{metricFormat(backtestAnalytics.summary?.sharpe_ratio)}</div>
            </div>
            <div className="stat-box">
              <p className="metric-label">Sortino</p>
              <div className="metric-value">{metricFormat(backtestAnalytics.summary?.sortino_ratio)}</div>
            </div>
            <div className="stat-box">
              <p className="metric-label">Max Drawdown</p>
              <div className="metric-value">{metricFormat(backtestAnalytics.summary?.max_drawdown, true)}</div>
            </div>
            <div className="stat-box">
              <p className="metric-label">Beta vs SPY</p>
              <div className="metric-value">{metricFormat(backtestAnalytics.summary?.beta)}</div>
            </div>
            <div className="stat-box">
              <p className="metric-label">Alpha (ann.)</p>
              <div className="metric-value">{metricFormat(backtestAnalytics.summary?.alpha)}</div>
            </div>
            <div className="stat-box">
              <p className="metric-label">Tracking Error</p>
              <div className="metric-value">{metricFormat(backtestAnalytics.summary?.tracking_error, true)}</div>
            </div>
          </div>
        </Card>
      )}
    </PageShell>
  );
};

export default HistoricalAnalysisPage;
