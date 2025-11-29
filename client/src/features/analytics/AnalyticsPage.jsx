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
import Card from "../../components/ui/Card";
import PageShell from "../../components/ui/PageShell";

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
  const equitySeries = primaryData?.equitySeries ?? [];
  const drawdownSeries = primaryData?.drawdownSeries ?? [];
  const topDrawdowns = primaryData?.drawdownWindows || [];
  const maxDrawdownWindow = primaryData?.maxDrawdownWindow || null;
  const benchmarkSeries =
    backtestState.data?.benchmarkEquitySeries || metricsState.data?.benchmarkEquitySeries || [];
  const relativeSeries = backtestState.data?.relativeSeries || [];
  const riskDecomposition = primaryData?.riskDecomposition || null;
  const periodReturns = primaryData?.periodReturns || [];
  const periodStats = primaryData?.periodStats;
  const scenarios = primaryData?.scenarios || [];
  const loading = metricsState.loading || backtestState.loading;
  const error = backtestState.error || metricsState.error;

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
      benchmark: null,
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
          <div className="stat-box">
            <p className="muted">Total return</p>
            <p>{formatPercent(summary?.totalReturn)}</p>
          </div>
          <div className="stat-box">
            <p className="muted">Sharpe</p>
            <p>{formatRatio(summary?.sharpe)}</p>
          </div>
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

      <Card title="Performance & Risk Summary" subtitle="Key return and risk metrics from centralized analytics.">
        <div className="section-heading">
          <h3>Performance &amp; Risk Summary</h3>
          <p className="muted">Key return and risk metrics from centralized analytics.</p>
        </div>
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
              portfolioSeries={equitySeries}
              benchmarkSeries={benchmarkSeries}
              relativeSeries={relativeSeries}
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

      <Card title="Period Performance" subtitle="Monthly return breakdown with hit rate and best/worst periods.">
        <div className="section-heading">
          <h3>Period Performance</h3>
          <p className="muted">Monthly return breakdown with hit rate and best/worst periods.</p>
        </div>
        {error ? (
          <p className="error-text">{error}</p>
        ) : loading ? (
          <p className="muted">Loading period performance...</p>
        ) : (
          <PeriodPerformance periods={periodReturns} stats={periodStats} />
        )}
      </Card>

      <Card title="Risk & Concentration" subtitle="Risk contributions and portfolio concentration diagnostics.">
        <div className="section-heading">
          <h3>Risk &amp; Concentration</h3>
          <p className="muted">Risk contributions and portfolio concentration diagnostics.</p>
        </div>
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

      <Card title="Scenario & Stress Testing" subtitle="Shock the portfolio and estimate P&L and drawdown impact.">
        <div className="section-heading">
          <h3>Scenario &amp; Stress Testing</h3>
          <p className="muted">Shock the portfolio and estimate P&amp;L and drawdown impact.</p>
        </div>
        <ScenarioPanel
          scenarios={scenarios}
          runScenario={runScenario}
          loading={loading}
          error={error}
        />
      </Card>
    </PageShell>
  );
};

export default AnalyticsPage;
