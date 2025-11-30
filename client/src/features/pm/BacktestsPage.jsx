import { useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, CartesianGrid } from "recharts";

import Card from "../../components/ui/Card";
import PageShell from "../../components/ui/PageShell";
import { formatDateTick } from "../../utils/format";
import { portfolioApi } from "../../services/portfolioApi";

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

const BacktestsPage = () => {
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

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
    setLoading(true);
    setError("");
    try {
      const payload = {
        tickers: parsedTickers,
        weights: parsedWeights,
        start_date: form.start_date,
        end_date: form.end_date,
        rebalance_freq: form.rebalance_freq,
        benchmark: "SPY",
      };
      const data = await portfolioApi.runPMBacktest(payload);
      setResult(data);
    } catch (err) {
      setError(err.message || "Backtest failed");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const chartData = useMemo(() => {
    if (!result) return [];
    return result.dates.map((d, i) => ({
      date: d,
      portfolio: result.portfolio_equity[i],
      benchmark: result.benchmark_equity[i],
    }));
  }, [result]);

  return (
    <PageShell
      title="Portfolio Management – Backtests"
      subtitle="Configure a portfolio, run a benchmarked backtest, and review key stats."
    >
      <div className="analytics-grid">
        <Card title="Backtest parameters" subtitle="Portfolio, dates, and rebalance">
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
              {loading ? "Running..." : "Run Backtest"}
            </button>
            {error && <p className="error-text">{error}</p>}
          </form>
        </Card>

        {result ? (
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

      {result && (
        <Card title="Summary stats" subtitle="Portfolio vs SPY">
          <div className="stats-grid">
            <div className="stat-box">
              <p className="metric-label">CAGR</p>
              <div className="metric-value">{metricFormat(result.summary.cagr, true)}</div>
            </div>
            <div className="stat-box">
              <p className="metric-label">Benchmark CAGR</p>
              <div className="metric-value">{metricFormat(result.summary.benchmark_cagr, true)}</div>
            </div>
            <div className="stat-box">
              <p className="metric-label">Annualized Vol</p>
              <div className="metric-value">{metricFormat(result.summary.annualized_volatility, true)}</div>
            </div>
            <div className="stat-box">
              <p className="metric-label">Sharpe</p>
              <div className="metric-value">{metricFormat(result.summary.sharpe_ratio)}</div>
            </div>
            <div className="stat-box">
              <p className="metric-label">Sortino</p>
              <div className="metric-value">{metricFormat(result.summary.sortino_ratio)}</div>
            </div>
            <div className="stat-box">
              <p className="metric-label">Max Drawdown</p>
              <div className="metric-value">{metricFormat(result.summary.max_drawdown, true)}</div>
            </div>
            <div className="stat-box">
              <p className="metric-label">Beta vs SPY</p>
              <div className="metric-value">{metricFormat(result.summary.beta)}</div>
            </div>
            <div className="stat-box">
              <p className="metric-label">Alpha (ann.)</p>
              <div className="metric-value">{metricFormat(result.summary.alpha)}</div>
            </div>
            <div className="stat-box">
              <p className="metric-label">Tracking Error</p>
              <div className="metric-value">{metricFormat(result.summary.tracking_error, true)}</div>
            </div>
          </div>
        </Card>
      )}
    </PageShell>
  );
};

export default BacktestsPage;
