import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, Line, ComposedChart, Cell } from "recharts";
import Card from "../../components/ui/Card";
import PageShell from "../../components/ui/PageShell";
import { portfolioApi } from "../../services/portfolioApi";
import { formatDateTick } from "../../utils/format";

const todayStr = new Date().toISOString().slice(0, 10);
const yearsAgo = (yrs) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - yrs);
  return d.toISOString().slice(0, 10);
};

const regimeColors = ["#22c55e55", "#f59e0b55", "#ef444455", "#8b5cf655"];

const RegimesPage = () => {
  const [symbol, setSymbol] = useState("SPY");
  const [start, setStart] = useState(yearsAgo(5));
  const [end, setEnd] = useState(todayStr);
  const [nStates, setNStates] = useState(3);
  const [modelType, setModelType] = useState("threshold");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const runRegimes = async (e) => {
    e?.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await portfolioApi.getRegimes({
        symbol,
        start_date: start,
        end_date: end,
        n_states: nStates,
        model_type: modelType,
      });
      setData(res);
    } catch (err) {
      setError(err.message || "Failed to load regimes");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runRegimes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.series.map((p) => ({
      date: p.timestamp,
      price: p.price,
      regime: p.regime,
    }));
  }, [data]);

  return (
    <PageShell
      title="Quant Lab – Regimes"
      subtitle="Detect volatility regimes and study regime-specific performance."
    >
      <div className="page-layout">
        <Card
          title="Regime detection"
          subtitle="Volatility quantiles across history"
          actions={<Link to="/quant/market-structure" className="text-xs underline-offset-4 hover:underline text-slate-300">Use Market Structure to drill into microstructure metrics →</Link>}
        >
          <form className="analytics-form" onSubmit={runRegimes}>
            <div className="form-row">
              <label>
                Symbol
                <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} />
              </label>
              <label>
                Start date
                <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
              </label>
              <label>
                End date
                <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
              </label>
            </div>
            <div className="form-row">
              <label>
                Regimes
                <select value={nStates} onChange={(e) => setNStates(Number(e.target.value))}>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                </select>
              </label>
              <label>
                Model
                <select value={modelType} onChange={(e) => setModelType(e.target.value)} disabled>
                  <option value="threshold">Volatility quantiles (threshold)</option>
                  <option value="hmm_vol">HMM (coming soon)</option>
                </select>
              </label>
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? "Running..." : "Run"}
            </button>
            {error && <p className="error-text">{error}</p>}
          </form>
        </Card>

        <Card title="Price & regimes" subtitle={loading ? "Loading..." : data ? `${data.summary.symbol} regimes` : "Run to see regimes"}>
          {data ? (
            <div style={{ minHeight: 280 }}>
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={chartData} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={formatDateTick} minTickGap={24} stroke="#6b7280" />
                  <YAxis yAxisId="left" stroke="#6b7280" />
                  <YAxis yAxisId="right" orientation="right" stroke="#6b7280" domain={[0, nStates]} />
                  <Tooltip
                    labelFormatter={formatDateTick}
                    formatter={(val, name) => (name === "regime" ? [`Regime ${Number(val) + 1}`, "Regime"] : [Number(val).toFixed(2), "Price"])}
                    contentStyle={{ backgroundColor: "#0b1220", borderColor: "#1f2937" }}
                  />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="price" name="Price" stroke="#4f8cff" dot={false} />
                  <Bar yAxisId="right" dataKey="regime" name="Regime" barSize={6}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={regimeColors[entry.regime % regimeColors.length]} stroke="none" />
                    ))}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
              <div className="muted" style={{ marginTop: "0.5rem" }}>
                Regimes shown as colored bars behind price (Regime 1 = low vol, higher indices = higher vol).
              </div>
            </div>
          ) : loading ? (
            <p className="muted">Loading regime data...</p>
          ) : (
            <p className="muted">Run a regime analysis by selecting a symbol and date range.</p>
          )}
        </Card>

        {data && (
          <Card
            title="Regime statistics"
            subtitle="Per-regime performance and risk"
            actions={
              <button
                className="btn btn-ghost"
                onClick={() => {
                  const header = ["regime", "pct_time", "avg_return", "vol", "sharpe", "max_drawdown"];
                  const csv = [header.join(","), ...data.summary.regimes.map((r) => [r.regime, r.pct_time, r.avg_return, r.vol, r.sharpe, r.max_drawdown].join(","))].join("\n");
                  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = "regime_stats.csv";
                  link.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Export CSV
              </button>
            }
          >
            <div className="stats-grid" style={{ marginBottom: "1rem" }}>
              <div className="stat-box">
                <p className="metric-label">Overall vol</p>
                <div className="metric-value">{(data.summary.overall_vol * 100).toFixed(2)}%</div>
              </div>
              <div className="stat-box">
                <p className="metric-label">Overall Sharpe</p>
                <div className="metric-value">{data.summary.overall_sharpe.toFixed(2)}</div>
              </div>
            </div>
            <div className="table-wrapper compact-table dense">
              <table>
                <thead>
                  <tr>
                    <th>Regime</th>
                    <th className="numeric">% Time</th>
                    <th className="numeric">Avg Return (daily)</th>
                    <th className="numeric">Vol (daily)</th>
                    <th className="numeric">Sharpe</th>
                    <th className="numeric">Max DD</th>
                  </tr>
                </thead>
                <tbody>
                  {data.summary.regimes.map((r) => (
                    <tr key={r.regime}>
                      <td>{`Regime ${r.regime + 1}`}</td>
                      <td className="numeric">{(r.pct_time * 100).toFixed(1)}%</td>
                      <td className="numeric">{(r.avg_return * 100).toFixed(3)}%</td>
                      <td className="numeric">{(r.vol * 100).toFixed(3)}%</td>
                      <td className="numeric">{r.sharpe.toFixed(2)}</td>
                      <td className="numeric">{(r.max_drawdown * 100).toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ height: 200, marginTop: "1rem" }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.summary.regimes.map((r) => ({
                    regime: `R${r.regime + 1}`,
                    sharpe: r.sharpe,
                  }))}
                >
                  <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                  <Bar dataKey="sharpe" name="Sharpe" fill="#38bdf8" />
                  <Tooltip
                    formatter={(val) => Number(val).toFixed(2)}
                    contentStyle={{ backgroundColor: "#0b1220", borderColor: "#1f2937" }}
                  />
                  <XAxis dataKey="regime" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="muted" style={{ marginTop: "0.5rem" }}>
              {data.summary.regimes.some((r) => r.sharpe > 1)
                ? "Lower-vol regimes show better risk-adjusted returns; favor exposure when in Regime 1/2."
                : "Regimes are balanced; use regime filters cautiously."}
            </div>
          </Card>
        )}
      </div>
    </PageShell>
  );
};

export default RegimesPage;
