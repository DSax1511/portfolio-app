import { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

import Card from "../../components/ui/Card";
import MetricCard from "../../components/ui/MetricCard";
import PageShell from "../../components/ui/PageShell";
import EmptyState from "../../components/ui/EmptyState";
import PositionsTable from "../../components/ui/PositionsTable";
import SectorExposurePanel from "./SectorExposurePanel";
import { portfolioApi } from "../../services/portfolioApi";

const COLORS = ["#4f46e5", "#22c55e", "#f97316", "#06b6d4", "#a855f7", "#e11d48"];
const TECH_TICKERS = new Set(["AAPL", "MSFT", "NVDA", "GOOGL", "GOOG", "AMZN", "META", "TSLA"]);

const OverviewPage = ({ portfolio, formatCurrency, onUploadClick, onToggleDemo, demoMode }) => {
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState("");
  const [showAllDrift, setShowAllDrift] = useState(false);

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

  const hasPortfolio = portfolio.length > 0;

  return (
    <PageShell
      title="Portfolio Overview"
      subtitle="Live snapshot of value, P&L, exposures, and daily focus."
    >
      {!hasPortfolio && (
        <EmptyState
          title="Upload positions or load demo to see analytics."
          description="Your metrics and charts will appear here once data is loaded."
        />
      )}

      <div className="page-hero">
        <div className="metric-row">
          {metricCards.map((card) => (
            <MetricCard key={card.label} label={card.label} value={card.value} helper={card.helper} />
          ))}
        </div>
      </div>

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
        <Card title="Top Positions">
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
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Ticker</th>
                    <th className="numeric">Quantity</th>
                    <th className="numeric">Avg Cost</th>
                    <th className="numeric">Current Price</th>
                    <th className="numeric">Market Value</th>
                    <th className="numeric">P/L</th>
                    <th className="numeric">Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {[...portfolio]
                    .sort((a, b) => b.market_value - a.market_value)
                    .slice(0, 5)
                    .map((p) => {
                      const weight =
                        totalValue > 0
                          ? ((p.market_value / totalValue) * 100).toFixed(1)
                          : "0.0";
                      return (
                        <tr key={p.ticker}>
                          <td>{p.ticker}</td>
                          <td className="numeric">{p.quantity.toFixed(2)}</td>
                          <td className="numeric">${p.avg_cost.toFixed(2)}</td>
                          <td className="numeric">${p.current_price.toFixed(2)}</td>
                          <td className="numeric">${formatCurrency(p.market_value)}</td>
                          <td
                            className={p.pnl >= 0 ? "positive" : "negative"}
                            style={{ textAlign: "right" }}
                          >
                            ${formatCurrency(p.pnl)}
                          </td>
                          <td className="numeric">{weight}%</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="All Positions" subtitle="Compact blotter view with P&L and returns.">
          <PositionsTable portfolio={portfolio} formatCurrency={formatCurrency} />
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

export default OverviewPage;
