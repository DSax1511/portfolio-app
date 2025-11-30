import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, CartesianGrid } from "recharts";
import Card from "../../components/ui/Card";
import PageShell from "../../components/ui/PageShell";
import { portfolioApi } from "../../services/portfolioApi";
import { formatDateTick } from "../../utils/format";

const defaultConfig = {
  strategy: {
    symbol: "SPY",
    timeframe: "1D",
    start_date: "2020-01-01",
    end_date: new Date().toISOString().slice(0, 10),
    initial_capital: 100000,
    position_mode: "long_flat",
    sma_fast: 10,
    sma_slow: 30,
    rsi_period: 14,
    rsi_overbought: 70,
    rsi_oversold: 30,
    use_sma: true,
    use_rsi: false,
  },
  slippage_bps: 0.5,
  commission_per_trade: 0,
  max_position_size: 1,
  benchmark: "SPY",
};

const metric = (v, pct = false) => {
  if (v === null || v === undefined) return "—";
  return pct ? `${(v * 100).toFixed(2)}%` : v.toFixed(2);
};

const BacktestEnginePage = () => {
  const location = useLocation();
  const [config] = useState(() => location.state?.config || defaultConfig.strategy);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const payload = {
          strategy: config,
          slippage_bps: defaultConfig.slippage_bps,
          commission_per_trade: defaultConfig.commission_per_trade,
          max_position_size: defaultConfig.max_position_size,
          benchmark: "SPY",
        };
        const data = await portfolioApi.runQuantBacktest(payload);
        setResult(data);
      } catch (err) {
        setError(err.message || "Backtest failed");
        setResult(null);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [config]);

  const chartData = useMemo(() => {
    if (!result) return [];
    return result.dates.map((d, i) => ({
      date: d,
      strategy: result.equity_curve[i],
      benchmark: result.benchmark_equity[i],
    }));
  }, [result]);

  return (
    <PageShell
      title="Quant Lab – Backtest Engine"
      subtitle="Execution-aware strategy performance vs benchmark."
    >
      <Card title="Strategy configuration" subtitle="Read-only summary">
        <div className="analytics-grid">
          <div>
            <p className="metric-label">Symbol</p>
            <div className="metric-value">{config.symbol}</div>
          </div>
          <div>
            <p className="metric-label">Date range</p>
            <div className="metric-value">{config.start_date} → {config.end_date}</div>
          </div>
          <div>
            <p className="metric-label">SMA</p>
            <div className="metric-value">{config.use_sma ? `${config.sma_fast}/${config.sma_slow}` : "Off"}</div>
          </div>
          <div>
            <p className="metric-label">RSI</p>
            <div className="metric-value">{config.use_rsi ? `${config.rsi_period} (${config.rsi_overbought}/${config.rsi_oversold})` : "Off"}</div>
          </div>
          <div>
            <p className="metric-label">Position mode</p>
            <div className="metric-value">{config.position_mode}</div>
          </div>
        </div>
      </Card>

      <Card title="Equity vs benchmark" subtitle="Strategy vs SPY">
        {loading && <p className="muted">Running backtest...</p>}
        {error && <p className="error-text">{error}</p>}
        {result && (
          <ResponsiveContainer width="100%" height={320}>
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
              <Line type="monotone" dataKey="strategy" name="Strategy" stroke="#4f8cff" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="benchmark" name="SPY" stroke="#22c55e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      {result && (
        <div className="analytics-grid">
          <Card title="Summary stats" subtitle="PM-style metrics">
            <div className="stats-grid">
              <div className="stat-box"><p className="metric-label">CAGR</p><div className="metric-value">{metric(result.summary.cagr, true)}</div></div>
              <div className="stat-box"><p className="metric-label">Vol</p><div className="metric-value">{metric(result.summary.annualized_volatility, true)}</div></div>
              <div className="stat-box"><p className="metric-label">Sharpe</p><div className="metric-value">{metric(result.summary.sharpe_ratio)}</div></div>
              <div className="stat-box"><p className="metric-label">Sortino</p><div className="metric-value">{metric(result.summary.sortino_ratio)}</div></div>
              <div className="stat-box"><p className="metric-label">Max DD</p><div className="metric-value">{metric(result.summary.max_drawdown, true)}</div></div>
              <div className="stat-box"><p className="metric-label">Alpha</p><div className="metric-value">{metric(result.summary.alpha)}</div></div>
              <div className="stat-box"><p className="metric-label">Beta</p><div className="metric-value">{metric(result.summary.beta)}</div></div>
              <div className="stat-box"><p className="metric-label">Win rate</p><div className="metric-value">{metric(result.summary.win_rate, true)}</div></div>
            </div>
          </Card>
          <Card title="Trades" subtitle="Execution log">
            <div className="table-wrapper compact-table dense">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Side</th>
                    <th className="numeric">Size</th>
                    <th className="numeric">Price</th>
                    <th className="numeric">PnL</th>
                  </tr>
                </thead>
                <tbody>
                  {result.trades && result.trades.length ? (
                    result.trades.map((t, idx) => (
                      <tr key={idx}>
                        <td>{t.timestamp}</td>
                        <td>{t.side}</td>
                        <td className="numeric">{t.size.toFixed(2)}</td>
                        <td className="numeric">{t.price.toFixed(2)}</td>
                        <td className={`numeric ${t.pnl >= 0 ? "positive" : "negative"}`}>{t.pnl.toFixed(2)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={5} className="muted">No trades generated.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </PageShell>
  );
};

export default BacktestEnginePage;
