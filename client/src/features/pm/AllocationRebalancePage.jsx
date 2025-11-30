import { useEffect, useMemo, useState } from "react";
import { Pie, PieChart, ResponsiveContainer, Cell, Tooltip as ReTooltip, Legend } from "recharts";
import Card from "../../components/ui/Card";
import PageShell from "../../components/ui/PageShell";
import { portfolioApi } from "../../services/portfolioApi";

const COLORS = ["#4f8cff", "#22c55e", "#f97316", "#06b6d4", "#a855f7", "#e11d48", "#facc15", "#8b5cf6", "#0ea5e9"];

const formatPct = (v) => (v == null ? "—" : `${(v * 100).toFixed(2)}%`);
const formatCurrency = (v) =>
  v == null
    ? "—"
    : v.toLocaleString(undefined, {
        maximumFractionDigits: 0,
      });

const AllocationRebalancePage = ({ portfolio = [], demoMode = false }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const hasPortfolio = portfolio && portfolio.length > 0;
  const requestPayload = useMemo(() => {
    if (hasPortfolio) {
      return {
        tickers: portfolio.map((p) => p.ticker),
        quantities: portfolio.map((p) => p.quantity || 0),
        prices: portfolio.map((p) => p.current_price || 0),
        target_weights: Array(portfolio.length).fill(1 / portfolio.length),
        tolerance: 0.02,
      };
    }
    // fallback: use a simple demo portfolio
    return {
      tickers: ["SPY", "QQQ", "IWM"],
      target_weights: [0.34, 0.33, 0.33],
      tolerance: 0.02,
    };
  }, [portfolio, hasPortfolio]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await portfolioApi.getPMAllocation(requestPayload);
        setData(res);
      } catch (err) {
        setError(err.message || "Failed to load allocation data");
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [requestPayload]);

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.items.map((item) => ({
      name: item.ticker,
      value: item.weight * 100,
    }));
  }, [data]);

  const summary = data?.summary || {};
  const badgeText = loading ? "Loading..." : demoMode && !hasPortfolio ? "Demo data" : "Live allocation";

  return (
    <PageShell
      title="Allocation & Rebalance"
      subtitle="Current weights vs targets, drift, and turnover needed to realign the book."
      section="Portfolio Intelligence"
    >
      <div className="page-layout" style={{ width: "100%", gap: "1rem" }}>
        <Card
          title="Allocation workspace"
          subtitle={<span className="pill" style={{ borderColor: "rgba(79,140,255,0.4)", color: "#4f8cff" }}>{badgeText}</span>}
        >
          {loading ? (
            <p className="muted">Loading allocation analytics...</p>
          ) : error ? (
            <p className="error-text">{error}</p>
          ) : data ? (
            <div className="analytics-grid" style={{ gridTemplateColumns: "1.2fr 1fr" }}>
              <div style={{ minHeight: 260 }}>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      labelLine={false}
                      label={false}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <ReTooltip formatter={(val) => `${val.toFixed(2)}%`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="stats-grid">
                <div className="stat-box">
                  <p className="metric-label">Max drift</p>
                  <div className="metric-value">{formatPct(summary.max_drift)}</div>
                </div>
                <div className="stat-box">
                  <p className="metric-label">Positions outside tolerance</p>
                  <div className="metric-value">{summary.outside_tolerance ?? 0}</div>
                </div>
                <div className="stat-box">
                  <p className="metric-label">Turnover to rebalance</p>
                  <div className="metric-value">{formatPct(summary.turnover_to_rebalance)}</div>
                </div>
                <div className="stat-box">
                  <p className="metric-label">Total value</p>
                  <div className="metric-value">${formatCurrency(data.total_value)}</div>
                </div>
              </div>
            </div>
          ) : (
            <p className="muted">No allocation data available.</p>
          )}
        </Card>

        {data && (
          <Card title="Allocation detail">
            <div className="table-wrapper compact-table dense">
              <table>
                <thead>
                  <tr>
                    <th>Ticker</th>
                    <th>Name</th>
                    <th className="numeric">Current %</th>
                    <th className="numeric">Target %</th>
                    <th className="numeric">Drift %</th>
                    <th className="numeric">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr key={item.ticker}>
                      <td>{item.ticker}</td>
                      <td className="muted">{item.name || "—"}</td>
                      <td className="numeric">{formatPct(item.weight)}</td>
                      <td className="numeric">{formatPct(item.target_weight)}</td>
                      <td className={`numeric ${item.drift && item.drift > 0 ? "positive" : "negative"}`}>{formatPct(item.drift)}</td>
                      <td className="numeric">{item.value != null ? `$${formatCurrency(item.value)}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        <div className="analytics-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          <Card title="Near-term roadmap">
            <ul className="simple-list" style={{ fontSize: "0.95rem" }}>
              <li>Visual allocations by asset class, sector, and region.</li>
              <li>Target vs actual weights with drift thresholds.</li>
              <li>Rebalance suggestions based on risk, turnover, and costs.</li>
            </ul>
          </Card>
          <Card title="How it fits the stack">
            <p className="muted" style={{ fontSize: "0.9rem", lineHeight: 1.5 }}>
              The Allocation view sits on top of the PM backtest engine and data layer, reusing holdings, weights, and benchmark data to
              produce allocation and drift analytics that plug directly into the broader PM workflow.
            </p>
          </Card>
        </div>
      </div>
    </PageShell>
  );
};

export default AllocationRebalancePage;
