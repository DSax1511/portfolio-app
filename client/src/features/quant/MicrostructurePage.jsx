import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Card from "../../components/ui/Card";
import PageShell from "../../components/ui/PageShell";
import { portfolioApi } from "../../services/portfolioApi";
import { formatDateTick } from "../../utils/format";

const today = new Date().toISOString().slice(0, 10);
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

const fmtPct = (v) => (v == null ? "—" : `${(v * 100).toFixed(2)}%`);

const MicrostructurePage = () => {
  const [symbol, setSymbol] = useState("SPY");
  const [startDate, setStartDate] = useState(daysAgo(90));
  const [endDate, setEndDate] = useState(today);
  const [interval, setInterval] = useState("1d");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await portfolioApi.runMicrostructure({
          symbol,
          start_date: startDate,
          end_date: endDate,
          bar_interval: interval,
        });
        setData(res);
      } catch (err) {
        setError(err.message || "Failed to load microstructure analytics");
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [symbol, startDate, endDate, interval]);

  const series = useMemo(() => {
    if (!data) return [];
    return data.bars.map((b) => ({
      date: b.timestamp,
      return: b.return_,
      next_return: b.next_return,
      volume: b.volume,
      of: b.order_flow_proxy,
    }));
  }, [data]);

  const scatterData = useMemo(() => {
    if (!data) return [];
    return data.bars
      .filter((b) => b.next_return != null)
      .map((b) => ({ of: b.order_flow_proxy, next: b.next_return }));
  }, [data]);

  return (
    <PageShell
      title="Quant Lab – Microstructure"
      subtitle="Order flow proxies, volume/returns, and microstructure stats."
    >
      <div className="page-layout">
        <Card title="Microstructure parameters" subtitle="Symbol, window, and interval">
          <div className="analytics-form">
            <div className="form-row">
              <label>
                Symbol
                <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} />
              </label>
              <label>
                Interval
                <select value={interval} onChange={(e) => setInterval(e.target.value)}>
                  <option value="1d">Daily</option>
                  {/* Placeholder for intraday options */}
                </select>
              </label>
            </div>
            <div className="form-row">
              <label>
                Start date
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </label>
              <label>
                End date
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </label>
            </div>
          </div>
        </Card>

        <Card
          title="Microstructure analytics"
          subtitle={loading ? "Loading..." : `Computed for ${data?.symbol || symbol}`}
        >
          {error ? (
            <p className="error-text">{error}</p>
          ) : !data ? (
            <p className="muted">Loading microstructure data...</p>
          ) : (
            <div className="analytics-grid">
              <div style={{ minHeight: 240 }}>
                <h4 className="muted" style={{ margin: "0 0 0.35rem" }}>Returns & volume</h4>
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart data={series} margin={{ left: 6, right: 6, top: 6, bottom: 0 }}>
                    <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={formatDateTick} minTickGap={24} stroke="#6b7280" />
                    <YAxis yAxisId="left" stroke="#6b7280" tickFormatter={(v) => `${(v * 100).toFixed(1)}%`} />
                    <YAxis yAxisId="right" orientation="right" stroke="#6b7280" />
                    <Tooltip
                      labelFormatter={formatDateTick}
                      formatter={(val, name) =>
                        name === "volume" ? [val.toFixed(0), "Volume"] : [`${(val * 100).toFixed(2)}%`, name]
                      }
                      contentStyle={{ backgroundColor: "#0b1220", borderColor: "#1f2937" }}
                    />
                    <Legend />
                    <Area yAxisId="left" type="monotone" dataKey="return" name="Return" stroke="#4f8cff" fill="#4f8cff33" />
                    <Bar yAxisId="right" dataKey="volume" name="Volume" fill="#22c55e66" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div style={{ minHeight: 240 }}>
                <h4 className="muted" style={{ margin: "0 0 0.35rem" }}>Order flow proxy</h4>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={series} margin={{ left: 6, right: 6, top: 6, bottom: 0 }}>
                    <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={formatDateTick} minTickGap={24} stroke="#6b7280" />
                    <YAxis stroke="#6b7280" />
                    <Tooltip
                      labelFormatter={formatDateTick}
                      formatter={(val) => [val.toFixed(0), "Order flow proxy"]}
                      contentStyle={{ backgroundColor: "#0b1220", borderColor: "#1f2937" }}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="of" name="Order flow" stroke="#f97316" fill="#f9731633" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div style={{ minHeight: 240 }}>
                <h4 className="muted" style={{ margin: "0 0 0.35rem" }}>Order flow vs next return</h4>
                <ResponsiveContainer width="100%" height={220}>
                  <ScatterChart margin={{ left: 6, right: 6, top: 6, bottom: 0 }}>
                    <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                    <XAxis dataKey="of" name="Order flow" stroke="#6b7280" />
                    <YAxis dataKey="next" name="Next return" stroke="#6b7280" tickFormatter={(v) => `${(v * 100).toFixed(2)}%`} />
                    <Tooltip
                      formatter={(val, name) =>
                        name === "of" ? [val.toFixed(0), "Order flow"] : [`${(val * 100).toFixed(2)}%`, "Next return"]
                      }
                      contentStyle={{ backgroundColor: "#0b1220", borderColor: "#1f2937" }}
                    />
                    <Scatter data={scatterData} fill="#8b5cf6" />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>

              <div className="stats-grid">
                <div className="stat-box">
                  <p className="metric-label">Avg spread proxy</p>
                  <div className="metric-value">{fmtPct(data.summary.avg_spread)}</div>
                </div>
                <div className="stat-box">
                  <p className="metric-label">Median spread proxy</p>
                  <div className="metric-value">{fmtPct(data.summary.median_spread)}</div>
                </div>
                <div className="stat-box">
                  <p className="metric-label">Avg volume</p>
                  <div className="metric-value">{(data.summary.avg_volume || 0).toFixed(0)}</div>
                </div>
                <div className="stat-box">
                  <p className="metric-label">Volatility (annualized)</p>
                  <div className="metric-value">{fmtPct(data.summary.volatility)}</div>
                </div>
                <div className="stat-box">
                  <p className="metric-label">Order flow vs next return corr</p>
                  <div className="metric-value">{data.summary.of_next_return_corr != null ? data.summary.of_next_return_corr.toFixed(2) : "—"}</div>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </PageShell>
  );
};

export default MicrostructurePage;
