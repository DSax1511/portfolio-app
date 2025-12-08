import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis } from "recharts";
import EquityCurveChart from "./components/EquityCurveChart";
import DrawdownChart from "./components/DrawdownChart";
import TopDrawdownsTable from "./components/TopDrawdownsTable";
import PeriodPerformance from "./components/PeriodPerformance";
import ScenarioPanel from "./components/ScenarioPanel";
import RollingStatsChart from "./components/RollingStatsChart";
import StrategyCommentary from "./components/StrategyCommentary";
import Card from "../../components/ui/Card";
import PageShell from "../../components/ui/PageShell";
import MethodologyDrawer from "../../components/ui/MethodologyDrawer";
import SectionHeader from "../../components/layout/SectionHeader";
import { usePortfolioAnalytics } from "../../state/portfolioAnalytics";
import { useActiveRun } from "../../state/activeRun";
import { portfolioApi } from "../../services/portfolioApi";
import ResearchDisclaimerBanner from "../../components/ui/ResearchDisclaimerBanner";

const formatPercent = (value, decimals = 2) =>
  value == null ? "—" : `${(value * 100).toFixed(decimals)}%`;

const formatRatio = (value, decimals = 2) =>
  value == null ? "—" : value.toFixed(decimals);

const RiskDiagnosticsPage = ({ analysisPayload }) => {
  const [hoveredDate, setHoveredDate] = useState(null);
  const [showMethodology, setShowMethodology] = useState(false);
  const [runSummary, setRunSummary] = useState(null);

  const { backtestAnalytics: primaryData, loading, error, runBacktestAnalytics } = usePortfolioAnalytics();
  const { activeRunId, activeRunLabel, setActiveRun } = useActiveRun();

  useEffect(() => {
    if (analysisPayload?.tickers?.length) {
      runBacktestAnalytics({
        tickers: analysisPayload.tickers,
        weights: analysisPayload.weights,
        start_date: analysisPayload.start_date,
        end_date: analysisPayload.end_date,
        rebalance_freq: analysisPayload.rebalance_frequency,
      });
    }
  }, [analysisPayload, runBacktestAnalytics]);

  useEffect(() => {
    const fetchRun = async () => {
      if (!activeRunId) {
        setRunSummary(null);
        return;
      }
      try {
        const data = await portfolioApi.getRun(activeRunId);
        setRunSummary(data);
      } catch (err) {
        console.error("Run fetch failed", err);
        setRunSummary(null);
        setActiveRun(null);
      }
    };
    fetchRun();
  }, [activeRunId, setActiveRun]);

  const summary = primaryData?.summary;
  const combinedEquity = useMemo(() => {
    if (!primaryData?.equity_curve?.dates) return [];
    const dates = primaryData.equity_curve.dates;
    const port = primaryData.equity_curve.equity || [];
    const bench = primaryData.benchmark_curve?.equity || [];
    const rel = primaryData.relative_curve?.relative || [];
    return dates.map((d, i) => ({
      date: d,
      portfolio: port[i],
      benchmark: bench[i] ?? null,
      relative: rel[i] ?? null,
    }));
  }, [primaryData]);
  const equitySeries = combinedEquity;
  const drawdownSeries = useMemo(() => primaryData?.drawdown_series || [], [primaryData]);
  const topDrawdowns = primaryData?.top_drawdowns || [];
  const drawdownRows = useMemo(
    () =>
      (topDrawdowns || []).map((td, idx) => ({
        startDate: td.startDate || td.start || td.start_date || td.start || "",
        troughDate: td.troughDate || td.trough || td.end || td.trough_date || "",
        recoveryDate: td.recoveryDate || td.recovery || td.recovery_date || null,
        depth: td.depth ?? td.drawdown ?? 0,
        key: idx,
      })),
    [topDrawdowns]
  );
  const maxDrawdownWindow = drawdownRows[0]
    ? { startDate: drawdownRows[0].startDate, recoveryDate: drawdownRows[0].recoveryDate, depth: drawdownRows[0].depth }
    : null;
  const periodReturns = primaryData?.monthly_returns || [];
  const periodStats = primaryData?.period_stats;
  const scenarios = primaryData?.scenarios || [];
  const rollingStats = primaryData?.rolling_stats || [];
  const factorRisk = primaryData?.factor_risk;
  const correlationMatrix = primaryData?.correlations || [];
  const varMetrics = primaryData?.var || {};
  const riskAttribution = primaryData?.risk_attribution;
  const returnDistribution = primaryData?.return_distribution;

  const correlationTickers = useMemo(() => {
    const set = new Set();
    correlationMatrix.forEach((row) => {
      set.add(row.a);
      set.add(row.b);
    });
    return Array.from(set);
  }, [correlationMatrix]);

  const correlationGrid = useMemo(() => {
    const map = new Map();
    correlationMatrix.forEach((row) => {
      map.set(`${row.a}-${row.b}`, row.value);
    });
    return correlationTickers.map((a) =>
      correlationTickers.map((b) => ({
        a,
        b,
        value: map.get(`${a}-${b}`) ?? map.get(`${b}-${a}`) ?? (a === b ? 1 : 0),
      }))
    );
  }, [correlationMatrix, correlationTickers]);

  const exportAttribution = (rows, filename) => {
    if (!rows || !rows.length) return;
    const header = Object.keys(rows[0]);
    const csv = [header.join(","), ...rows.map((r) => header.map((h) => r[h]).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };
  const exportPeriods = () => {
    if (!periodReturns || !periodReturns.length) return;
    const header = ["Year", "Month", "Return %"];
    const rows = periodReturns.map((p) => [p.year, p.month, (p.returnPct * 100).toFixed(2)].join(","));
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "period_returns.csv";
    link.click();
    URL.revokeObjectURL(url);
  };
  const hasData = !!primaryData;
  const samplePayload = useMemo(
    () => ({
      strategy: "buy_and_hold",
      tickers: ["AAPL", "MSFT", "SPY"],
      weights: [0.34, 0.33, 0.33],
      start_date: null,
      end_date: null,
      rebalance_frequency: "none",
      benchmark: "SPY",
      parameters: {},
    }),
    []
  );

  const summaryCards = [
    { label: "Total Return", value: formatPercent(summary?.total_return ?? summary?.totalReturn) },
    { label: "Annualized Return", value: formatPercent(summary?.cagr ?? summary?.annualizedReturn) },
    { label: "Annualized Volatility", value: formatPercent(summary?.annualized_volatility ?? summary?.volatility) },
    { label: "Sharpe Ratio", value: formatRatio(summary?.sharpe_ratio ?? summary?.sharpe) },
    { label: "Sortino Ratio", value: formatRatio(summary?.sortino_ratio ?? summary?.sortino) },
    { label: "Max Drawdown", value: formatPercent(summary?.max_drawdown ?? summary?.maxDrawdown) },
    { label: "Hit Rate", value: formatPercent(summary?.hit_rate ?? summary?.hitRate) },
  ];

  return (
    <PageShell
      title="Backtest Performance & Risk Summary"
      subtitle="Deep diagnostics for the latest backtest: performance, drawdowns, heatmaps, and stress tests."
      contextStatus="backtest"
      actions={
        <div className="action-row">
          <button className="btn btn-ghost" onClick={() => setShowMethodology(true)}>
            Methodology
          </button>
        </div>
      }
    >
      <ResearchDisclaimerBanner />
      {!activeRunId && !primaryData && (
        <Card>
          <p className="font-semibold text-slate-100">No active backtest selected</p>
          <p className="muted">
            Run a demo or custom backtest in the Quant Lab, then return here to view risk metrics. Use the left sidebar to navigate.
          </p>
          <ul className="simple-list">
            <li>Total return & annualized return</li>
            <li>Volatility, Sharpe/Sortino, max drawdown</li>
            <li>Equity curve, drawdowns, period performance</li>
          </ul>
        </Card>
      )}

      {activeRunId && (
        <Card className="bg-slate-900/60 border border-slate-800">
          <p className="label-sm">Active run</p>
          <p className="muted" style={{ margin: 0 }}>
            Showing analytics for run {runSummary?.meta?.label || activeRunLabel || activeRunId} — started {runSummary?.timestamp || "N/A"}
          </p>
        </Card>
      )}

      {!hasData && !loading && (
        <Card title="No diagnostics yet" subtitle="Run a Historical Analysis to populate risk analytics, or load a sample.">
          <div className="action-row">
            <a className="btn btn-primary" href="/pm/historical-analysis">
              Go to Historical Analysis
            </a>
            <button className="btn btn-ghost" onClick={() => runBacktestAnalytics(samplePayload)}>
              Load sample diagnostics
            </button>
          </div>
          {error && <p className="error-text" style={{ marginTop: "0.5rem" }}>{error}</p>}
        </Card>
      )}

      <SectionHeader
        overline="Portfolio Intelligence"
        title="Performance & Risk Summary"
        subtitle="Key return and risk metrics from centralized analytics."
      />
      <Card>
        {loading ? (
          <p className="muted">Loading results...</p>
        ) : !primaryData ? (
          <p className="muted">Run a Historical Analysis to see metrics here.</p>
        ) : (
          <div className="stats-grid">
            {summaryCards.map((card) => (
              <div key={card.label} className="stat-box">
                <p className="muted">{card.label}</p>
                <p>{card.value}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <StrategyCommentary
        commentary={primaryData?.commentary}
        loading={loading}
        error={error}
      />

      <div className="analytics-grid">
        <div className="card">
          <div className="section-heading">
            <h3>Equity Curve</h3>
            <p className="muted">Portfolio vs benchmark plus relative performance.</p>
          </div>
          {error ? (
            <p className="error-text">{error}</p>
          ) : loading ? (
            <p className="muted">Loading chart...</p>
          ) : equitySeries.length === 0 ? (
            <p className="muted">Run a Historical Analysis to plot the equity curve.</p>
          ) : (
            <EquityCurveChart
              combinedSeries={combinedEquity}
              hoveredDate={hoveredDate}
              onHover={setHoveredDate}
            />
          )}
        </div>

        <div className="card">
          <div className="section-heading">
            <h3>Drawdown</h3>
            <p className="muted">Underwater curve highlighting peak-to-trough declines.</p>
          </div>
          {error ? (
            <p className="error-text">{error}</p>
          ) : loading ? (
            <p className="muted">Loading chart...</p>
          ) : drawdownSeries.length === 0 ? (
            <p className="muted">Run a Historical Analysis to view drawdowns.</p>
          ) : (
            <>
              <DrawdownChart
                drawdownSeries={drawdownSeries}
                maxDrawdownWindow={maxDrawdownWindow}
                hoveredDate={hoveredDate}
                onHover={setHoveredDate}
              />
              <h4 style={{ marginTop: "1rem" }}>Top Drawdowns</h4>
              <TopDrawdownsTable drawdowns={drawdownRows} />
            </>
          )}
        </div>
      </div>

      <SectionHeader
        overline="Risk"
        title="VaR & Tail Risk"
        subtitle="1-day parametric and historical tail metrics."
      />
      <Card>
        {loading ? (
          <p className="muted">Loading VaR...</p>
        ) : !primaryData ? (
          <p className="muted">Run a Historical Analysis to compute VaR.</p>
        ) : (
          <div className="stats-grid">
            <div className="stat-box"><p className="metric-label">VaR 95% (parametric)</p><div className="metric-value">{formatPercent(-(varMetrics.var_95 || 0))}</div></div>
            <div className="stat-box"><p className="metric-label">VaR 99% (parametric)</p><div className="metric-value">{formatPercent(-(varMetrics.var_99 || 0))}</div></div>
            <div className="stat-box"><p className="metric-label">VaR 95% (historical)</p><div className="metric-value">{formatPercent(-(varMetrics.var_95_hist || 0))}</div></div>
            <div className="stat-box"><p className="metric-label">CVaR 95%</p><div className="metric-value">{formatPercent(-(varMetrics.cvar_95 || 0))}</div></div>
          </div>
        )}
      </Card>

      <SectionHeader
        overline="Factors"
        title="Factor Risk & Exposures"
        subtitle="Factor betas and variance contributions."
      />
      <Card>
        {loading ? (
          <p className="muted">Loading factor exposures...</p>
        ) : !factorRisk?.factors?.length ? (
          <p className="muted">Run a Historical Analysis to see factor risk.</p>
        ) : (
          <div className="analytics-grid">
            <div className="card" style={{ background: "transparent", border: "none", boxShadow: "none" }}>
              <p className="muted" style={{ marginBottom: "6px" }}>Factor betas</p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={factorRisk.factors}>
                  <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                  <XAxis dataKey="factor" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <ReTooltip />
                  <Legend />
                  <Bar dataKey="beta" fill="#4f8cff" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="card" style={{ background: "transparent", border: "none", boxShadow: "none" }}>
              <p className="muted" style={{ marginBottom: "6px" }}>Variance contribution</p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={factorRisk.factors}>
                  <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                  <XAxis dataKey="factor" stroke="#94a3b8" />
                  <YAxis tickFormatter={(v) => `${(v * 100).toFixed(1)}%`} stroke="#94a3b8" />
                  <ReTooltip formatter={(v) => `${(v * 100).toFixed(2)}%`} />
                  <Bar dataKey="variance_contribution" name="Risk %" fill="#22c55e" />
                </BarChart>
              </ResponsiveContainer>
              <p className="muted">R² {formatRatio(factorRisk.r2, 3)} · Residual vol {formatPercent(factorRisk.residual_vol)}</p>
            </div>
          </div>
        )}
      </Card>

      <SectionHeader
        overline="Dependence"
        title="Correlation & Dependence"
        subtitle="Pairwise correlations across holdings."
      />
      <Card>
        {loading ? (
          <p className="muted">Loading correlations...</p>
        ) : !correlationMatrix.length ? (
          <p className="muted">Run a Historical Analysis to see correlations.</p>
        ) : (
          <div className="correlation-grid" style={{ overflowX: "auto" }}>
            <table className="compact-table dense">
              <thead>
                <tr>
                  <th></th>
                  {correlationTickers.map((t) => (
                    <th key={`col-${t}`}>{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {correlationGrid.map((row, i) => (
                  <tr key={`row-${i}`}>
                    <td className="muted">{correlationTickers[i]}</td>
                    {row.map((cell) => {
                      const val = cell.value;
                      const intensity = Math.min(1, Math.abs(val));
                      const color = val >= 0 ? `rgba(34,197,94,${0.2 + intensity * 0.5})` : `rgba(239,68,68,${0.2 + intensity * 0.5})`;
                      return (
                        <td key={`${cell.a}-${cell.b}`} title={`${cell.a} / ${cell.b}: ${val.toFixed(2)}`} style={{ background: color }}>
                          {val.toFixed(2)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <SectionHeader
        overline="Diagnostics"
        title="Period Performance"
        subtitle="Monthly returns, hit rate, and best/worst periods."
      />
      <Card>
        {error ? (
          <p className="error-text">{error}</p>
        ) : loading ? (
          <p className="muted">Loading period performance...</p>
        ) : periodReturns.length === 0 ? (
          <p className="muted">Run a Historical Analysis to populate period performance.</p>
        ) : (
          <PeriodPerformance periods={periodReturns} stats={periodStats} onExport={exportPeriods} />
        )}
      </Card>

      <SectionHeader
        overline="Distribution"
        title="Return Distribution"
        subtitle="Histogram and tail diagnostics."
      />
      <Card>
        {loading ? (
          <p className="muted">Loading distribution...</p>
        ) : !returnDistribution ? (
          <p className="muted">Run a Historical Analysis to see the return distribution.</p>
        ) : (
          <>
            <div className="stats-grid">
              <div className="stat-box">
                <p className="metric-label">Skew</p>
                <div className="metric-value">{formatRatio(returnDistribution.skew)}</div>
              </div>
              <div className="stat-box">
                <p className="metric-label">Kurtosis</p>
                <div className="metric-value">{formatRatio(returnDistribution.kurtosis)}</div>
              </div>
              <div className="stat-box">
                <p className="metric-label">Worst 1D</p>
                <div className="metric-value">{formatPercent(returnDistribution.worst_1d)}</div>
              </div>
              <div className="stat-box">
                <p className="metric-label">Worst 5D</p>
                <div className="metric-value">{formatPercent(returnDistribution.worst_5d)}</div>
              </div>
            </div>
            <div style={{ height: 240, marginTop: "12px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={returnDistribution.histogram}>
                  <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                  <XAxis dataKey="bin_start" tickFormatter={(v) => `${(v * 100).toFixed(1)}%`} stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <ReTooltip formatter={(v, name, ctx) => [`${ctx.payload.bin_start.toFixed(4)} to ${ctx.payload.bin_end.toFixed(4)}`, "Bin"]} />
                  <Bar dataKey="count" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </Card>

      <SectionHeader
        overline="Risk"
        title="Risk Attribution"
        subtitle="Contribution to volatility by ticker and sector."
      />
      <Card
        actions={
          riskAttribution?.by_ticker?.length ? (
            <button className="btn btn-ghost" onClick={() => exportAttribution(riskAttribution.by_ticker, "risk_by_ticker.csv")}>
              Export CSV
            </button>
          ) : null
        }
      >
        {error ? (
          <p className="error-text">{error}</p>
        ) : loading ? (
          <p className="muted">Loading risk attribution...</p>
        ) : !riskAttribution?.by_ticker?.length ? (
          <p className="muted">Run a Historical Analysis to compute risk attribution.</p>
        ) : (
          <div className="analytics-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div>
              <p className="muted">By ticker</p>
              <table className="compact-table dense">
                <thead>
                  <tr>
                    <th>Ticker</th>
                    <th>Weight %</th>
                    <th>Risk %</th>
                  </tr>
                </thead>
                <tbody>
                  {riskAttribution.by_ticker.slice(0, 8).map((row) => (
                    <tr key={row.ticker}>
                      <td>{row.ticker}</td>
                      <td>{formatPercent(row.weight_pct)}</td>
                      <td>{formatPercent(row.contribution_pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="muted" style={{ marginTop: "6px" }}>
                Top 3 tickers contribute {formatPercent(riskAttribution.by_ticker.slice(0, 3).reduce((s, r) => s + (r.contribution_pct || 0), 0))} of risk.
              </p>
            </div>
            <div>
              <p className="muted">By sector</p>
              <table className="compact-table dense">
                <thead>
                  <tr>
                    <th>Sector</th>
                    <th>Weight %</th>
                    <th>Risk %</th>
                  </tr>
                </thead>
                <tbody>
                  {(riskAttribution.by_sector || []).map((row) => (
                    <tr key={row.sector}>
                      <td>{row.sector}</td>
                      <td>{formatPercent(row.weight_pct)}</td>
                      <td>{formatPercent(row.contribution_pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {riskAttribution.by_sector?.length ? (
                <button className="btn btn-ghost" style={{ marginTop: "6px" }} onClick={() => exportAttribution(riskAttribution.by_sector, "risk_by_sector.csv")}>
                  Export sectors CSV
                </button>
              ) : null}
            </div>
          </div>
        )}
      </Card>

      <SectionHeader
        overline="Scenarios"
        title="Scenario & Stress Testing"
        subtitle="Shock the portfolio and estimate P&L and drawdown impact."
      />
      <Card>
        {error ? (
          <p className="error-text">{error}</p>
        ) : !hasData && !loading ? (
          <p className="muted">Run a Historical Analysis to unlock scenario testing.</p>
        ) : (
          <ScenarioPanel
            scenarios={scenarios}
            runScenario={null}
            loading={loading}
            error={error}
            summaryMaxDrawdown={summary?.max_drawdown ?? summary?.maxDrawdown}
          />
        )}
      </Card>
      <SectionHeader
        overline="Rolling"
        title="Rolling Statistics"
        subtitle="60-day rolling vol, Sharpe, and beta vs SPY."
        actions={<button className="btn btn-ghost" onClick={() => setShowMethodology(true)}>Methodology</button>}
      />
      <Card>
        {error ? (
          <p className="error-text">{error}</p>
        ) : loading ? (
          <p className="muted">Loading rolling statistics...</p>
        ) : rollingStats.length === 0 ? (
          <p className="muted">Run a Historical Analysis to see rolling vol, Sharpe, and beta.</p>
        ) : (
          <RollingStatsChart data={rollingStats} />
        )}
      </Card>
      <MethodologyDrawer open={showMethodology} onClose={() => setShowMethodology(false)} />
    </PageShell>
  );
};

export default RiskDiagnosticsPage;
