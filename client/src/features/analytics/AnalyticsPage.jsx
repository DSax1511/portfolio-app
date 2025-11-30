import { useMemo, useState } from "react";
import { useAnalyticsData } from "./hooks/useAnalyticsData";
import EquityCurveChart from "./components/EquityCurveChart";
import DrawdownChart from "./components/DrawdownChart";
import TopDrawdownsTable from "./components/TopDrawdownsTable";
import RiskContributionTable from "./components/RiskContributionTable";
import RiskConcentrationPanel from "./components/RiskConcentrationPanel";
import PeriodPerformance from "./components/PeriodPerformance";
import ScenarioPanel from "./components/ScenarioPanel";
import PortfolioBuilder from "./components/PortfolioBuilder";
import RollingStatsChart from "./components/RollingStatsChart";
import StrategyCommentary from "./components/StrategyCommentary";
import Card from "../../components/ui/Card";
import PageShell from "../../components/ui/PageShell";
import MethodologyDrawer from "../../components/ui/MethodologyDrawer";
import SectionHeader from "../../components/layout/SectionHeader";

const formatPercent = (value, decimals = 2) =>
  value == null ? "—" : `${(value * 100).toFixed(decimals)}%`;

const formatRatio = (value, decimals = 2) =>
  value == null ? "—" : value.toFixed(decimals);

const AnalyticsPage = () => {
  const [portfolioRows, setPortfolioRows] = useState([
    { ticker: "AAPL", weight: 0.33 },
    { ticker: "MSFT", weight: 0.33 },
    { ticker: "SPY", weight: 0.34 },
  ]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [validationMessage, setValidationMessage] = useState("");
  const [hoveredDate, setHoveredDate] = useState(null);

  const { metricsState, backtestState, loadMetrics, loadBacktest, runScenario } = useAnalyticsData();

  const primaryData = backtestState.data || metricsState.data;
  const summary = primaryData?.summary;
  const equitySeries = useMemo(() => primaryData?.equitySeries ?? [], [primaryData]);
  const drawdownSeries = useMemo(() => primaryData?.drawdownSeries ?? [], [primaryData]);
  const topDrawdowns = primaryData?.drawdownWindows || [];
  const maxDrawdownWindow = primaryData?.maxDrawdownWindow || null;
  const benchmarkSeries = useMemo(
    () => backtestState.data?.benchmarkEquitySeries || metricsState.data?.benchmarkEquitySeries || [],
    [backtestState.data, metricsState.data]
  );
  const relativeSeries = useMemo(() => backtestState.data?.relativeSeries || [], [backtestState.data]);
  const riskDecomposition = primaryData?.riskDecomposition || null;
  const periodReturns = primaryData?.periodReturns || [];
  const periodStats = primaryData?.periodStats;
  const scenarios = primaryData?.scenarios || [];
  const rollingStats = backtestState.data?.rolling || [];
  const combinedEquity = useMemo(() => {
    const benchMap = new Map((benchmarkSeries || []).map((b) => [b.date, b.equity]));
    const relMap = new Map((relativeSeries || []).map((r) => [r.date, r.relative]));
    return (equitySeries || []).map((row) => ({
      date: row.date,
      portfolio: row.equity,
      benchmark: benchMap.get(row.date) ?? null,
      relative: relMap.get(row.date) ?? null,
    }));
  }, [equitySeries, benchmarkSeries, relativeSeries]);
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
  const loading = metricsState.loading || backtestState.loading;
  const error = backtestState.error || metricsState.error;
  const [showMethodology, setShowMethodology] = useState(false);

  const normalizedRows = portfolioRows.filter((r) => r.ticker);
  const sumWeights = normalizedRows.reduce((s, r) => s + (r.weight || 0), 0);
  const tickers = normalizedRows.map((r) => r.ticker);
  const weights = sumWeights ? normalizedRows.map((r) => (r.weight || 0) / sumWeights) : null;

  const validateWeights = () => {
    if (!weights || !weights.length) {
      setValidationMessage("Please add at least one ticker with weight.");
      return false;
    }
    const diff = Math.abs(1 - weights.reduce((s, w) => s + w, 0));
    if (diff > 0.02) {
      setValidationMessage("Weights do not sum to ~100%. Normalize or equalize them.");
      return false;
    }
    setValidationMessage("");
    return true;
  };

  const runAnalysis = () => {
    if (!validateWeights()) return;
    const payload = {
      tickers,
      weights,
      start_date: startDate || null,
      end_date: endDate || null,
    };
    loadMetrics(payload);
    loadBacktest({
      strategy: "buy_and_hold",
      ...payload,
      rebalance_frequency: "none",
      benchmark: "SPY",
      parameters: {},
    });
  };

  const commentary = useMemo(() => {
    if (!summary) return "Run an analysis to generate commentary.";
    if (summary.sharpe >= 1.5 && summary.maxDrawdown > -0.2) {
      return "Strong risk-adjusted performance with contained drawdowns.";
    }
    if (summary.sharpe >= 1 && summary.maxDrawdown > -0.3) {
      return "Solid profile with balanced returns and manageable drawdowns.";
    }
    if (summary.totalReturn > 0 && (summary.sharpe < 1 || summary.maxDrawdown <= -0.3)) {
      return "Returns come with significant risk; consider reducing volatility or drawdowns.";
    }
    return "Risk-adjusted returns are weak; review position sizing and risk controls.";
  }, [summary]);

  const summaryCards = [
    { label: "Total Return", value: formatPercent(summary?.totalReturn) },
    { label: "Annualized Return", value: formatPercent(summary?.annualizedReturn) },
    { label: "Annualized Volatility", value: formatPercent(summary?.volatility) },
    { label: "Sharpe Ratio", value: formatRatio(summary?.sharpe) },
    { label: "Sortino Ratio", value: formatRatio(summary?.sortino) },
    { label: "Max Drawdown", value: formatPercent(summary?.maxDrawdown) },
    { label: "Hit Rate", value: formatPercent(summary?.hitRate) },
  ];

  return (
    <PageShell
      title="Performance & Risk"
      subtitle="Centralized analytics, risk decomposition, period performance, and scenario testing."
      actions={
        <div className="action-row">
          <button className="btn btn-ghost" onClick={() => setShowMethodology(true)}>
            Methodology
          </button>
        </div>
      }
    >

      <PortfolioBuilder
        rows={portfolioRows}
        setRows={setPortfolioRows}
        onNormalize={() => {
          const sum = portfolioRows.reduce((s, r) => s + (r.weight || 0), 0);
          if (sum === 0) return;
          setPortfolioRows(portfolioRows.map((r) => ({ ...r, weight: (r.weight || 0) / sum })));
        }}
        onEqual={() => {
          const count = portfolioRows.length || 1;
          setPortfolioRows(portfolioRows.map((r) => ({ ...r, weight: 1 / count })));
        }}
        onRun={runAnalysis}
        startDate={startDate}
        endDate={endDate}
        setStartDate={setStartDate}
        setEndDate={setEndDate}
        setPreset={(preset) => {
          if (!preset) return;
          const count = preset.tickers.length || 1;
          const equal = 1 / count;
          setPortfolioRows(
            preset.tickers.map((t, idx) => ({
              ticker: t,
              weight: preset.weights ? preset.weights[idx] ?? equal : equal,
            }))
          );
        }}
        validationMessage={validationMessage}
        loading={loading}
      />

      <SectionHeader
        overline="Portfolio Intelligence"
        title="Performance & Risk Summary"
        subtitle="Key return and risk metrics from centralized analytics."
      />
      <Card>
        {loading ? (
          <p className="muted">Loading results...</p>
        ) : !primaryData ? (
          <p className="muted">Run an analysis to see metrics.</p>
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
            <p className="muted">Run an analysis to plot the equity curve.</p>
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
            <p className="muted">Run an analysis to view drawdowns.</p>
          ) : (
            <>
              <DrawdownChart
                drawdownSeries={drawdownSeries}
                maxDrawdownWindow={maxDrawdownWindow}
                hoveredDate={hoveredDate}
                onHover={setHoveredDate}
              />
              <h4 style={{ marginTop: "1rem" }}>Top Drawdowns</h4>
              <TopDrawdownsTable drawdowns={topDrawdowns} />
            </>
          )}
        </div>
      </div>

      <div className="card">
        <div className="section-heading">
          <h3>Strategy Commentary</h3>
          <p className="muted">Quick interpretation based on your risk/return profile.</p>
        </div>
        {loading ? (
          <p className="muted">Evaluating performance...</p>
        ) : (
          <div className="commentary">
            <p>{commentary}</p>
            {summary && (
              <ul className="muted" style={{ marginTop: "0.5rem" }}>
                <li>Sharpe: {formatRatio(summary.sharpe)}</li>
                <li>Volatility: {formatPercent(summary.volatility)}</li>
                <li>Max drawdown: {formatPercent(summary.maxDrawdown)}</li>
              </ul>
            )}
          </div>
        )}
      </div>

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
        ) : (
          <PeriodPerformance periods={periodReturns} stats={periodStats} onExport={exportPeriods} />
        )}
      </Card>

      <SectionHeader
        overline="Risk"
        title="Risk & Concentration"
        subtitle="Risk contributions, concentration metrics, and drawdowns."
      />
      <Card>
        {error ? (
          <p className="error-text">{error}</p>
        ) : loading ? (
          <p className="muted">Loading risk decomposition...</p>
        ) : !riskDecomposition || riskDecomposition.positionContributions.length === 0 ? (
          <p className="muted">Not enough data to compute risk decomposition.</p>
        ) : (
          <>
            <RiskConcentrationPanel concentration={riskDecomposition.concentration} />
            <h4 style={{ marginTop: "1rem" }}>Top Risk Contributors</h4>
            <RiskContributionTable contributions={riskDecomposition.positionContributions} />
          </>
        )}
      </Card>

      <SectionHeader
        overline="Scenarios"
        title="Scenario & Stress Testing"
        subtitle="Shock the portfolio and estimate P&L and drawdown impact."
      />
      <Card>
        <ScenarioPanel
          scenarios={scenarios}
          runScenario={runScenario}
          loading={loading}
          error={error}
          summaryMaxDrawdown={summary?.maxDrawdown}
        />
      </Card>
      <SectionHeader
        overline="Rolling"
        title="Rolling Statistics"
        subtitle="60-day rolling vol, Sharpe, and beta vs SPY."
        actions={<button className="btn btn-ghost" onClick={() => setShowMethodology(true)}>Methodology</button>}
      />
      <Card>
        <RollingStatsChart data={rollingStats} />
      </Card>
      <MethodologyDrawer open={showMethodology} onClose={() => setShowMethodology(false)} />
    </PageShell>
  );
};

export default AnalyticsPage;
