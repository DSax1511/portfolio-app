import { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, Line, LineChart, CartesianGrid } from "recharts";

import Card from "../../components/ui/Card";
import MetricCard from "../../components/ui/MetricCard";
import PageShell from "../../components/ui/PageShell";
import EmptyState from "../../components/ui/EmptyState";
import PositionsTable from "../../components/ui/PositionsTable";
import SectorExposurePanel from "./SectorExposurePanel";
import { portfolioApi } from "../../services/portfolioApi";
import { apiBaseUrl } from "../../services/apiClient";
import { formatDateTick } from "../../utils/format";

const COLORS = ["#4f46e5", "#22c55e", "#f97316", "#06b6d4", "#a855f7", "#e11d48"];
const TECH_TICKERS = new Set(["AAPL", "MSFT", "NVDA", "GOOGL", "GOOG", "AMZN", "META", "TSLA"]);
const SECTOR_MAP = {
  AAPL: "Technology",
  MSFT: "Technology",
  AMZN: "Consumer Discretionary",
  GOOGL: "Technology",
  META: "Communication Services",
  NVDA: "Technology",
  TSLA: "Consumer Discretionary",
  JPM: "Financials",
  UNH: "Health Care",
  XOM: "Energy",
  VTI: "ETF",
  SPY: "ETF",
  QQQ: "ETF",
  MTUM: "ETF",
  GLD: "Materials",
  TLT: "Fixed Income",
};
const today = new Date();
const yearsAgo = (yrs) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - yrs);
  return d.toISOString().slice(0, 10);
};

const buildDemoBacktest = () => {
  const points = 180;
  const baseDate = new Date();
  const dates = [];
  const portfolio_equity = [];
  const benchmark_equity = [];
  let port = 1;
  let bench = 1;

  for (let i = points - 1; i >= 0; i -= 1) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
    const portRet = 0.0008 + 0.0004 * Math.sin(i / 14);
    const benchRet = 0.0006 + 0.0003 * Math.cos(i / 16);
    port *= 1 + portRet;
    bench *= 1 + benchRet;
    portfolio_equity.push(port);
    benchmark_equity.push(bench);
  }

  const portfolio_returns = portfolio_equity.map((val, idx) =>
    idx === 0 ? 0 : val / portfolio_equity[idx - 1] - 1
  );
  const benchmark_returns = benchmark_equity.map((val, idx) =>
    idx === 0 ? 0 : val / benchmark_equity[idx - 1] - 1
  );

  return {
    dates,
    portfolio_equity,
    benchmark_equity,
    portfolio_returns,
    benchmark_returns,
    summary: {
      cagr: 0.12,
      benchmark_cagr: 0.1,
      annualized_volatility: 0.17,
      sharpe_ratio: 0.85,
      sortino_ratio: 1.1,
      max_drawdown: -0.18,
      beta: 1.02,
      alpha: 0.015,
      tracking_error: 0.05,
    },
  };
};

const PortfolioDashboardPage = ({ portfolio, formatCurrency, onUploadClick, onToggleDemo, demoMode, onOpenGuide }) => {
  const safeOpenGuide = onOpenGuide || (() => {});
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState("");
  const [showAllDrift, setShowAllDrift] = useState(false);
  const [pmPerf, setPmPerf] = useState(null);
  const [pmPerfError, setPmPerfError] = useState("");

  const totalValue = useMemo(
    () => portfolio.reduce((sum, p) => sum + p.market_value, 0),
    [portfolio]
  );

  const totalPnL = useMemo(
    () => portfolio.reduce((sum, p) => sum + p.pnl, 0),
    [portfolio]
  );

  const investedCapital = useMemo(
    () => portfolio.reduce((sum, p) => sum + p.avg_cost * p.quantity, 0),
    [portfolio]
  );

  const totalReturnPct =
    investedCapital > 0 ? ((totalPnL / investedCapital) * 100).toFixed(2) : "0.00";

  const winners = portfolio.filter((p) => p.pnl > 0).length;
  const losers = portfolio.filter((p) => p.pnl < 0).length;
  const positionsCount = portfolio.length;

  const topPosition =
    portfolio.length > 0
      ? [...portfolio].sort((a, b) => b.market_value - a.market_value)[0]
      : null;
  const placeholderValue = portfolio.length === 0;

  const valueByTicker = useMemo(
    () =>
      [...portfolio]
        .sort((a, b) => b.market_value - a.market_value)
        .map((p) => ({
          name: p.ticker,
          value: p.market_value,
          pnl: p.pnl,
        })),
    [portfolio]
  );

  const weightsByTicker = useMemo(() => {
    const total = portfolio.reduce((s, p) => s + p.market_value, 0) || 1;
    return portfolio.reduce((acc, p) => {
      acc[p.ticker] = p.market_value / total;
      return acc;
    }, {});
  }, [portfolio]);

  const enrichedPositions = useMemo(() => {
    const total = totalValue || 1;
    const totalPnlLocal = totalPnL;
    return portfolio.map((p) => {
      const weight = (p.market_value || 0) / total;
      const contrib = totalPnlLocal !== 0 ? (p.pnl || 0) / totalPnlLocal : 0;
      return { ...p, weight, contrib };
    });
  }, [portfolio, totalValue, totalPnL]);

  const insights = useMemo(() => {
    if (!dashboardData || !portfolio.length) return null;
    const overweight = dashboardData.overweight_underweight.find((o) => o.status === "overweight");
    const topRisk = dashboardData.top_risk_contributors?.[0];
    const advice =
      overweight && overweight.diff
        ? `Portfolio is ${Math.abs(overweight.diff * 100).toFixed(1)}% overweight in ${overweight.ticker}. Consider trimming to target.`
        : topRisk
        ? `${topRisk.ticker} drives ${(topRisk.pct_variance * 100).toFixed(1)}% of variance. Reducing it slightly may lower volatility.`
        : "Portfolio weights are close to target today.";

    const pnlSorted = [...portfolio].sort((a, b) => b.pnl - a.pnl);
    const topGain = pnlSorted[0];
    const laggard = pnlSorted[pnlSorted.length - 1];
    const trend =
      topGain && laggard
        ? `${topGain.ticker} is contributing most of today's gain; ${laggard.ticker} is lagging.`
        : "Stable day across holdings.";

    const techWeight = Object.entries(weightsByTicker)
      .filter(([t]) => TECH_TICKERS.has(t))
      .reduce((s, [, w]) => s + w, 0);
    const top3 = Object.values(weightsByTicker)
      .sort((a, b) => b - a)
      .slice(0, 3)
      .reduce((s, w) => s + w, 0);

    const riskBreakdown = [
      { label: "Equities", value: 100 },
      { label: "Tech tilt", value: Math.round(techWeight * 100) },
      { label: "Top 3 positions", value: Math.round(top3 * 100) },
    ];

    const maxWeight = Math.max(...Object.values(weightsByTicker), 0);
    const confidence =
      maxWeight > 0.35
        ? { label: "Volatile", tone: "red" }
        : maxWeight > 0.25
        ? { label: "Elevated", tone: "yellow" }
        : { label: "Stable", tone: "green" };

    const nextStep =
      overweight && overweight.diff
        ? `Suggested next step: rebalance ${overweight.ticker} to reduce drift.`
        : "Suggested next step: review allocations to keep drift in check.";

    return { advice, trend, riskBreakdown, confidence, nextStep };
  }, [dashboardData, portfolio, weightsByTicker]);

  useEffect(() => {
    const buildLocalDashboard = () => {
      if (!portfolio.length) return null;
      const total = portfolio.reduce((s, p) => s + p.market_value, 0) || 1;
      const weights = portfolio.map((p) => p.market_value / total);
      const tickers = portfolio.map((p) => p.ticker);
      const top_risk_contributors = tickers
        .map((t, i) => ({ ticker: t, pct_variance: weights[i] }))
        .sort((a, b) => b.pct_variance - a.pct_variance);
      const overweight_underweight = tickers.map((t, i) => {
        const cw = weights[i];
        const tw = 1 / tickers.length;
        const diff = cw - tw;
        const status = diff > 0.01 ? "overweight" : diff < -0.01 ? "underweight" : "on target";
        return {
          ticker: t,
          current_weight: cw,
          target_weight: tw,
          status,
          diff,
        };
      });
      const largest_drawdowns = tickers.map((t) => ({ ticker: t, drawdown: 0 }));
      return {
        top_risk_contributors,
        overweight_underweight,
        largest_drawdowns,
        rebalance: { trades: [], estimated_turnover_pct: 0 },
      };
    };

    const loadDashboard = async () => {
      if (!portfolio.length) {
        setDashboardData(null);
        return;
      }
      setDashboardLoading(true);
      setDashboardError("");
      try {
        if (demoMode) {
          setDashboardData(buildLocalDashboard());
        } else {
          const tickers = portfolio.map((p) => p.ticker);
          const quantities = portfolio.map((p) => p.quantity);
          const prices = portfolio.map((p) => p.current_price);
          const cost_basis = portfolio.map((p) => p.avg_cost);
          const target_weights = Array(tickers.length).fill(1 / tickers.length);
          const data = await portfolioApi.getPortfolioDashboard({
            tickers,
            quantities,
            prices,
            cost_basis,
            target_weights,
            start_date: null,
            end_date: null,
          });
          setDashboardData(data);
        }
      } catch (err) {
        setDashboardError(err.message || "Dashboard load failed");
      } finally {
        setDashboardLoading(false);
      }
    };
    loadDashboard();
  }, [portfolio, demoMode]);

  useEffect(() => {
    const loadDefaultBacktest = async () => {
      try {
        const payload = {
          tickers: ["SPY", "QQQ"],
          weights: [0.5, 0.5],
          start_date: yearsAgo(3),
          end_date: today.toISOString().slice(0, 10),
          rebalance_freq: "monthly",
          benchmark: "SPY",
        };
        // Overview card hits FastAPI /api/v1/pm/backtest (or /demo when in UI demo mode).
        const data = demoMode ? await portfolioApi.getPMBacktestDemo() : await portfolioApi.runPMBacktest(payload);
        setPmPerf(data);
        setPmPerfError("");
      } catch (error) {
        let message = "Unable to reach the backtest API.";

        // Handle axios-like or fetch-like error shapes from ApiClientError
        if (error?.status) {
          const status = error.status;
          const text =
            typeof error.details === "string"
              ? error.details.slice(0, 200)
              : JSON.stringify(error.details || {}).slice(0, 200);
          message = `Backtest request failed (HTTP ${status}). Details: ${text}`;
        } else if (error?.isNetworkError) {
          message = "No response from API. Check that VITE_API_BASE_URL is set correctly and CORS is configured.";
        } else if (error?.message) {
          message = `Backtest error: ${error.message}`;
        }

        console.error("Backtest API error", error);
        if (demoMode) {
          setPmPerf(buildDemoBacktest());
          setPmPerfError("");
          return;
        }
        setPmPerf(null);
        setPmPerfError(friendly);
      }
    };
    loadDefaultBacktest();
  }, [demoMode]);

  const metricCards = [
    { label: "Total Value", value: placeholderValue ? "—" : `$${formatCurrency(totalValue)}` },
    { label: "Total P&L", value: placeholderValue ? "—" : `$${formatCurrency(totalPnL)}`, helper: null },
    { label: "Total Return", value: placeholderValue ? "—" : `${totalReturnPct}%` },
    { label: "Positions", value: positionsCount || "—" },
    { label: "Winners / Losers", value: placeholderValue ? "—" : `${winners} / ${losers}` },
    topPosition
      ? {
          label: "Top Holding",
          value: `${topPosition.ticker}`,
          helper: `${((topPosition.market_value / (totalValue || 1)) * 100).toFixed(1)}%`,
        }
      : null,
  ].filter(Boolean);

  const sectorExposure = useMemo(() => {
    if (!portfolio.length) return [];
    const total = portfolio.reduce((s, p) => s + p.market_value, 0) || 1;
    const buckets = {};
    portfolio.forEach((p) => {
      const sector = p.sector || SECTOR_MAP[p.ticker] || "Other";
      buckets[sector] = (buckets[sector] || 0) + p.market_value;
    });
    return Object.entries(buckets)
      .map(([sector, value]) => ({ sector, weight: value / total }))
      .sort((a, b) => b.weight - a.weight);
  }, [portfolio]);

  const pmPerfChart = useMemo(() => {
    if (!pmPerf || !pmPerf.dates) return [];
    return pmPerf.dates.map((d, i) => {
      const port = pmPerf.portfolio_equity?.[i] ?? null;
      const bench = pmPerf.benchmark_equity?.[i] ?? null;
      return { date: d, portfolio: port, benchmark: bench };
    });
  }, [pmPerf]);

  const hasPortfolio = portfolio.length > 0;
  const exportPositionsCsv = () => {
    if (!portfolio.length) return;
    const header = [
      "Ticker",
      "Quantity",
      "Avg Cost",
      "Current Price",
      "Market Value",
      "P/L",
      "Return %",
      "Weight %",
      "P&L %",
      "Sector",
    ];
    const rows = enrichedPositions.map((p) => {
      const invested = p.avg_cost * p.quantity;
      const retPct = invested > 0 ? (p.pnl / invested) * 100 : 0;
      return [
        p.ticker,
        p.quantity.toFixed(2),
        p.avg_cost.toFixed(2),
        p.current_price.toFixed(2),
        p.market_value.toFixed(2),
        p.pnl.toFixed(2),
        retPct.toFixed(2),
        (p.weight * 100).toFixed(1),
        (p.contrib * 100).toFixed(1),
        p.sector || "",
      ].join(",");
    });
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "positions_export.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageShell
      title="Portfolio Dashboard"
      subtitle="Live portfolio value, P&L, exposures, and daily focus for today's book."
    >
      {!hasPortfolio && (
        <EmptyState
          title="Upload positions or load demo to see analytics."
          description={
            <>
              Your metrics and charts will appear here once data is loaded.{" "}
              <button className="btn btn-link" type="button" onClick={safeOpenGuide} style={{ padding: 0, marginLeft: 4 }}>
                View format guide
              </button>
            </>
          }
        />
      )}

      <div className="page-hero">
        <div className="metric-row">
          {metricCards.map((card) => (
            <MetricCard key={card.label} label={card.label} value={card.value} helper={card.helper} />
          ))}
        </div>
      </div>

      <Card title="Portfolio equity vs SPY" subtitle="Live curve normalized to 1.0 at start">
        {pmPerf ? (
          <div className="analytics-grid" style={{ gridTemplateColumns: "2fr 1fr" }}>
            <div style={{ minHeight: 220 }}>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={pmPerfChart} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
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
            </div>
            <div className="stats-grid">
              <div className="stat-box">
                <p className="metric-label">CAGR</p>
                <div className="metric-value">{((pmPerf.summary.cagr || 0) * 100).toFixed(2)}%</div>
              </div>
              <div className="stat-box">
                <p className="metric-label">Sharpe</p>
                <div className="metric-value">{(pmPerf.summary.sharpe_ratio || 0).toFixed(2)}</div>
              </div>
              <div className="stat-box">
                <p className="metric-label">Volatility</p>
                <div className="metric-value">{((pmPerf.summary.annualized_volatility || 0) * 100).toFixed(2)}%</div>
              </div>
              <div className="stat-box">
                <p className="metric-label">Max Drawdown</p>
                <div className="metric-value">{((pmPerf.summary.max_drawdown || 0) * 100).toFixed(2)}%</div>
              </div>
            </div>
          </div>
        ) : pmPerfError ? (
          <p className="error-text">{pmPerfError}</p>
        ) : (
          <p className="muted">Loading default backtest...</p>
        )}
      </Card>

      <Card
        title="Daily Attention"
        subtitle="Intraday snapshot of risk drivers, drift, and quick actions."
        actions={
          insights && (
            <span
              className={`pill ${insights.confidence.tone === "red" ? "pill-red" : insights.confidence.tone === "yellow" ? "pill-yellow" : "pill-green"}`}
            >
              {insights.confidence.label}
            </span>
          )
        }
      >
        {dashboardLoading ? (
          <p className="muted">Loading dashboard...</p>
        ) : dashboardError ? (
          <div className="warning-state">
            <p style={{ margin: 0, fontWeight: 600 }}>Unable to load attention items right now.</p>
            <p className="muted" style={{ margin: "0.25rem 0 0" }}>
              Please try again after refreshing or updating positions.
            </p>
          </div>
        ) : !dashboardData ? (
          <div className="empty-state" style={{ textAlign: "left" }}>
            <p style={{ margin: "0 0 0.2rem", fontWeight: 700, color: "var(--text)" }}>
              No insights yet.
            </p>
            <p className="muted" style={{ margin: 0 }}>
              Upload a positions file or load the demo portfolio to view daily analytics.
            </p>
            <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button className="btn btn-ghost" onClick={onUploadClick}>
                Upload CSV
              </button>
              <button className="btn btn-primary" onClick={onToggleDemo}>
                Load demo portfolio
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="insight-headline">
              {insights?.trend || "Stable day across holdings."}
            </div>
            <div className="attention-grid">
              <div className="attention-section">
                <p className="attention-heading">Risk</p>
                <ul className="simple-list">
                  {dashboardData.top_risk_contributors.slice(0, 3).map((item) => (
                    <li key={item.ticker}>
                      {item.ticker}: {(item.pct_variance * 100).toFixed(1)}%
                    </li>
                  ))}
                </ul>
                <div className="micro-chart" style={{ marginTop: "0.5rem" }}>
                  {(insights?.riskBreakdown || []).map((row) => (
                    <div key={row.label} className="micro-row">
                      <span className="micro-label">{row.label}</span>
                      <div className="micro-bar">
                        <div className="micro-fill" style={{ width: `${Math.min(row.value, 100)}%` }} />
                      </div>
                      <span className="muted">{row.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="attention-section">
                <p className="attention-heading">Allocation drift</p>
                <ul className="drift-list">
                  {(dashboardData.overweight_underweight || [])
                    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
                    .slice(0, showAllDrift ? 20 : 5)
                    .map((o) => (
                      <li key={o.ticker} className="drift-item">
                        <span>{o.ticker}: {(o.current_weight * 100).toFixed(1)}% vs {(o.target_weight * 100).toFixed(1)}%</span>
                        <span
                          className={`drift-status ${
                            o.status === "overweight" ? "positive" : o.status === "underweight" ? "negative" : ""
                          }`}
                        >
                          {o.status}
                        </span>
                      </li>
                    ))}
                </ul>
                {(dashboardData.overweight_underweight || []).length > 5 && (
                  <button
                    className="btn btn-ghost"
                    style={{ padding: "4px 8px", fontSize: "12px" }}
                    onClick={() => setShowAllDrift((prev) => !prev)}
                  >
                    {showAllDrift ? "Show less" : "Show all"}
                  </button>
                )}
              </div>
              {dashboardData.largest_drawdowns.some((d) => Math.abs(d.drawdown) > 0) && (
                <div className="attention-section">
                  <p className="attention-heading">Drawdowns</p>
                  <ul className="simple-list">
                    {dashboardData.largest_drawdowns.map((d) => (
                      <li key={d.ticker}>
                        {d.ticker}: {(d.drawdown * 100).toFixed(1)}%
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="attention-section">
                <p className="attention-heading">Quick advice</p>
                <div className="callout">
                  {insights?.advice || "Portfolio weights are close to target today."}
                </div>
                <div className="next-step">
                  {insights?.nextStep || "Suggested next step: keep monitoring drift and risk."}
                </div>
              </div>
            </div>
          </>
        )}
      </Card>

      <div className="analytics-grid">
        <Card title="Top Positions" subtitle="Spotlight on largest weights">
          {portfolio.length === 0 ? (
            <EmptyState
              title="No positions loaded."
              description="Upload a CSV to see position-level analytics."
              action={
                <button className="btn btn-ghost" onClick={onUploadClick}>
                  Upload CSV
                </button>
              }
            />
          ) : (
            <PositionsTable
              portfolio={[...enrichedPositions].sort((a, b) => b.weight - a.weight)}
              formatCurrency={formatCurrency}
              withWeights
              withContribution
              maxRows={5}
            />
          )}
        </Card>

        <Card
          title="All Positions"
          subtitle="Compact blotter view with P&L, returns, weights, and contributions."
          actions={
            <button className="btn btn-ghost" onClick={exportPositionsCsv}>
              Export CSV
            </button>
          }
        >
          <PositionsTable
            portfolio={enrichedPositions}
            formatCurrency={formatCurrency}
            withWeights
            withContribution
            withSector
            dense
            footerSummary
          />
        </Card>

        <Card title="Market Value by Ticker">
          {valueByTicker.length === 0 ? (
            <EmptyState title="No chart yet" description="Upload positions to see this chart." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={valueByTicker}
                margin={{ top: 12, right: 16, left: 16, bottom: 16 }}
              >
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: "var(--text-secondary)" }}
                  tickMargin={10}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickFormatter={(v) => `$${formatCurrency(v)}`}
                  tick={{ fontSize: 12, fill: "var(--text-secondary)" }}
                  tickMargin={8}
                  width={80}
                />
                <Tooltip
                  formatter={(value) => `$${formatCurrency(value)}`}
                  labelFormatter={(label) => `Ticker: ${label}`}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="var(--accent)" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Portfolio Allocation">
          {valueByTicker.length === 0 ? (
            <EmptyState title="No allocation yet" description="Upload positions to see this chart." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={valueByTicker}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={95}
                  labelLine={false}
                  label={false}
                >
                  {valueByTicker.map((entry, index) => (
                    <Cell
                      key={`cell-${entry.name}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Legend
                  verticalAlign="bottom"
                  align="center"
                  wrapperStyle={{ paddingTop: 8 }}
                />
                <Tooltip
                  formatter={(value) => `$${formatCurrency(value)}`}
                  labelFormatter={(label) => `Ticker: ${label}`}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        <SectorExposurePanel data={sectorExposure} />
      </div>
    </PageShell>
  );
};

export default PortfolioDashboardPage;
