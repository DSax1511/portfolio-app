import { useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, CartesianGrid } from "recharts";
import Card from "../../components/ui/Card";
import PageShell from "../../components/ui/PageShell";
import ExperimentHistory from "../../components/ui/ExperimentHistory";
import ErrorBanner from "../../components/ui/ErrorBanner";
import { useQuantLabStore } from "../../state/quantLabStore";
import { useActiveRun } from "../../state/activeRun";
import { formatDateTick } from "../../utils/format";

const defaultConfig = {
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
  slippage_bps: 0.5,
  commission_per_trade: 0,
  max_position_size: 1,
  benchmark: "SPY",
};

const metric = (v, pct = false) => {
  if (v === null || v === undefined) return "—";
  return pct ? `${(v * 100).toFixed(2)}%` : v.toFixed(2);
};

const StrategyBuilderPage = () => {
  const [config, setConfig] = useState(defaultConfig);
  const [mode, setMode] = useState("single");
  const [sweepFast, setSweepFast] = useState("10,20,50");
  const [sweepSlow, setSweepSlow] = useState("30,60,100");
  const [sweepResults, setSweepResults] = useState([]);
  const { current, history, loading, error, runStrategy, setCurrentExperiment } = useQuantLabStore();
  const { setActiveRun } = useActiveRun();
  const isLoading = !!loading.strategy;
  const errMsg = error.strategy;
  const result = current.strategy?.result || null;

  const handleChange = (field) => (e) => {
    const value = e.target.type === "number" ? Number(e.target.value) : e.target.value;
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleCheckbox = (field) => (e) => {
    setConfig((prev) => ({ ...prev, [field]: e.target.checked }));
  };

  const runBacktest = async (e) => {
    e?.preventDefault();
    const payload = {
      strategy: {
        symbol: config.symbol,
        timeframe: config.timeframe,
        start_date: config.start_date,
        end_date: config.end_date,
        initial_capital: config.initial_capital,
        position_mode: config.position_mode,
        sma_fast: config.sma_fast,
        sma_slow: config.sma_slow,
        rsi_period: config.rsi_period,
        rsi_overbought: config.rsi_overbought,
        rsi_oversold: config.rsi_oversold,
        use_sma: config.use_sma,
        use_rsi: config.use_rsi,
      },
      slippage_bps: config.slippage_bps,
      commission_per_trade: config.commission_per_trade,
      max_position_size: config.max_position_size,
      benchmark: config.benchmark,
    };
    if (mode === "single") {
    const res = await runStrategy(payload);
    if (res?.run_id) {
      setActiveRun(res.run_id, res?.parameters ? `Strategy ${config.symbol}` : null);
    }
      return;
    }
    // Sweep mode: iterate combinations of SMA fast/slow
    const fastVals = sweepFast
      .split(",")
      .map((v) => Number(v.trim()))
      .filter((v) => !Number.isNaN(v));
    const slowVals = sweepSlow
      .split(",")
      .map((v) => Number(v.trim()))
      .filter((v) => !Number.isNaN(v));
    const combos = [];
    fastVals.forEach((f) => slowVals.forEach((s) => combos.push({ f, s })));
    const runs = [];
    for (const combo of combos) {
      const p = {
        ...payload,
        strategy: { ...payload.strategy, sma_fast: combo.f, sma_slow: combo.s },
      };
      try {
        const res = await runStrategy(p);
        if (res?.summary) {
          runs.push({
            fast: combo.f,
            slow: combo.s,
            sharpe: res.summary.sharpe_ratio,
            cagr: res.summary.cagr,
            max_dd: res.summary.max_drawdown,
          });
        }
      } catch (err) {
        // ignore individual failures in sweep
      }
    }
    setSweepResults(runs.sort((a, b) => (b.sharpe || 0) - (a.sharpe || 0)));
  };

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
      title="Quant Lab – Strategy Research"
      subtitle="Design and backtest trading strategies with configurable parameters."
    >
      <div className="analytics-grid" style={{ gridTemplateColumns: "1.1fr 1.2fr" }}>
        <Card title="Strategy configuration" subtitle="Define symbol, logic, and execution settings">
          <form className="analytics-form" onSubmit={runBacktest}>
            <div className="form-row">
              <label>
                Mode
                <select value={mode} onChange={(e) => setMode(e.target.value)}>
                  <option value="single">Single run</option>
                  <option value="sweep">Parameter sweep</option>
                </select>
              </label>
            </div>
            <div className="form-row">
              <label>
                Symbol
                <input value={config.symbol} onChange={handleChange("symbol")} />
              </label>
              <label>
                Timeframe
                <select value={config.timeframe} onChange={handleChange("timeframe")}>
                  <option value="1D">Daily</option>
                </select>
              </label>
            </div>
            <div className="form-row">
              <label>
                Start date
                <input type="date" value={config.start_date} onChange={handleChange("start_date")} />
              </label>
              <label>
                End date
                <input type="date" value={config.end_date} onChange={handleChange("end_date")} />
              </label>
            </div>
            <div className="form-row">
              <label>
                SMA fast
                <input type="number" min={1} value={config.sma_fast} onChange={handleChange("sma_fast")} />
              </label>
              <label>
                SMA slow
                <input type="number" min={2} value={config.sma_slow} onChange={handleChange("sma_slow")} />
              </label>
            </div>
            {mode === "sweep" && (
              <div className="form-row">
                <label>
                  Sweep SMA fast (comma-separated)
                  <input value={sweepFast} onChange={(e) => setSweepFast(e.target.value)} />
                </label>
                <label>
                  Sweep SMA slow (comma-separated)
                  <input value={sweepSlow} onChange={(e) => setSweepSlow(e.target.value)} />
                </label>
              </div>
            )}
            <div className="form-row">
              <label>
                RSI period
                <input type="number" min={2} value={config.rsi_period} onChange={handleChange("rsi_period")} />
              </label>
              <label>
                RSI overbought
                <input type="number" min={0} max={100} value={config.rsi_overbought} onChange={handleChange("rsi_overbought")} />
              </label>
              <label>
                RSI oversold
                <input type="number" min={0} max={100} value={config.rsi_oversold} onChange={handleChange("rsi_oversold")} />
              </label>
            </div>
            <div className="form-row">
              <label>
                Position mode
                <select value={config.position_mode} onChange={handleChange("position_mode")}>
                  <option value="long_only">Long only</option>
                  <option value="long_flat">Long / Flat</option>
                  <option value="long_short">Long / Short</option>
                </select>
              </label>
              <label>
                Max position size (fraction of equity)
                <input type="number" step="0.1" min={0} max={1} value={config.max_position_size} onChange={handleChange("max_position_size")} />
              </label>
            </div>
            <div className="form-row">
              <label>
                Slippage (bps)
                <input type="number" step="0.1" value={config.slippage_bps} onChange={handleChange("slippage_bps")} />
              </label>
              <label>
                Commission per trade
                <input type="number" step="0.01" value={config.commission_per_trade} onChange={handleChange("commission_per_trade")} />
              </label>
            </div>
            <div className="form-row">
              <label>
                Benchmark
                <input value={config.benchmark} onChange={handleChange("benchmark")} />
              </label>
              <label>
                Initial capital
                <input type="number" value={config.initial_capital} onChange={handleChange("initial_capital")} />
              </label>
            </div>
            <div className="form-row">
              <label>
                <input type="checkbox" checked={config.use_sma} onChange={handleCheckbox("use_sma")} /> Use SMA crossover
              </label>
              <label>
                <input type="checkbox" checked={config.use_rsi} onChange={handleCheckbox("use_rsi")} /> Apply RSI filter
              </label>
            </div>
            <button className="btn btn-primary" type="submit" disabled={isLoading}>
              {isLoading ? "Running..." : "Run Backtest"}
            </button>
            <ErrorBanner message={errMsg} onRetry={runBacktest} />
          </form>
          <ExperimentHistory
            experiments={history.strategy || []}
            onSelect={(exp) => exp?.id && setCurrentExperiment("strategy", exp.id)}
            title="Recent backtests"
          />
        </Card>

        <Card title="Strategy results" subtitle="Performance vs benchmark" className="chart-card">
          {isLoading && <p className="muted">Running backtest...</p>}
          {errMsg && <p className="error-text">{errMsg}</p>}
          {result ? (
            <ResponsiveContainer width="100%" height={280}>
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
                <Line type="monotone" dataKey="benchmark" name={config.benchmark || "Benchmark"} stroke="#22c55e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="muted">Run a backtest to see equity vs benchmark.</p>
          )}
        </Card>
      </div>

      {mode === "sweep" && sweepResults.length > 0 && (
        <Card
          title="Parameter sweep"
          subtitle="Top combos by Sharpe"
          actions={
            <button
              className="btn btn-ghost"
              onClick={() => {
                const header = ["fast", "slow", "sharpe", "cagr", "max_dd"];
                const csv = [header.join(","), ...sweepResults.map((r) => [r.fast, r.slow, r.sharpe, r.cagr, r.max_dd].join(","))].join("\n");
                const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = "strategy_sweep.csv";
                link.click();
                URL.revokeObjectURL(url);
              }}
            >
              Export CSV
            </button>
          }
        >
          <div className="stats-grid">
            {sweepResults.slice(0, 6).map((row) => (
              <div key={`${row.fast}-${row.slow}`} className="stat-box">
                <p className="metric-label">Fast {row.fast} / Slow {row.slow}</p>
                <div className="metric-value">{metric(row.sharpe)}</div>
                <p className="muted">CAGR {metric(row.cagr, true)} · Max DD {metric(row.max_dd, true)}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {result && mode === "single" && (
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
            {result?.trades?.length ? (
              <div className="flex justify-end mb-2">
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    const header = ["timestamp", "side", "size", "price", "pnl"];
                    const csv = [header.join(","), ...result.trades.map((t) => [t.timestamp, t.side, t.size, t.price, t.pnl].join(","))].join("\n");
                    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = "strategy_trades.csv";
                    link.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Export trades
                </button>
              </div>
            ) : null}
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

export default StrategyBuilderPage;
