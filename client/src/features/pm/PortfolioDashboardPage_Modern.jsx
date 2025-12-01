import { useEffect, useMemo, useState } from "react";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid, 
  ComposedChart, Area, AreaChart
} from "recharts";

import Card from "../../components/ui/Card";
import MetricCard from "../../components/ui/MetricCard";
import PageShell from "../../components/ui/PageShell";
import EmptyState from "../../components/ui/EmptyState";
import PositionsTable from "../../components/ui/PositionsTable";
import SectorExposurePanel from "./SectorExposurePanel";
import { portfolioApi } from "../../services/portfolioApi";
import { apiBaseUrl } from "../../services/apiClient";
import { formatDateTick } from "../../utils/format";

// Modern professional color palette (financial-grade)
const COLORS = {
  primary: "#2e78ff",      // Professional blue
  success: "#10b981",      // Modern green
  warning: "#f59e0b",      // Amber
  danger: "#ef4444",       // Red
  neutral: "#6b7280",      // Gray
  surfaces: ["#2e78ff", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4"],
};

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

// Build demo backtest data
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

/**
 * Modern Portfolio Dashboard
 * 
 * Features:
 * - Responsive design (mobile-first)
 * - Real-time portfolio metrics
 * - Interactive visualizations with Recharts
 * - Risk attribution analysis
 * - Sector and position breakdown
 * - Modern color scheme and typography
 */
const PortfolioDashboardPage = ({ 
  portfolio, 
  formatCurrency, 
  onUploadClick, 
  onToggleDemo, 
  demoMode, 
  onOpenGuide 
}) => {
  const safeOpenGuide = onOpenGuide || (() => {});
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState("");
  const [showAllDrift, setShowAllDrift] = useState(false);
  const [pmPerf, setPmPerf] = useState(null);
  const [pmPerfError, setPmPerfError] = useState("");
  const [selectedTimeframe, setSelectedTimeframe] = useState("6m"); // Add interactivity

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

  const enrichedPositions = useMemo(() => {
    const total = totalValue || 1;
    const totalPnlLocal = totalPnL;
    return portfolio.map((p) => {
      const weight = (p.market_value || 0) / total;
      const contrib = totalPnlLocal !== 0 ? (p.pnl || 0) / totalPnlLocal : 0;
      return { ...p, weight, contrib };
    });
  }, [portfolio, totalValue, totalPnL]);

  const placeholderValue = portfolio.length === 0;

  return (
    <PageShell title="Portfolio Dashboard" onOpenGuide={safeOpenGuide}>
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header Section with Actions */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
                Portfolio Overview
              </h1>
              <p className="text-gray-400 text-sm sm:text-base">
                Real-time portfolio metrics and risk analysis
              </p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={onUploadClick}
                className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Upload Positions
              </button>
              <button
                onClick={onToggleDemo}
                className="flex-1 sm:flex-none px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
              >
                {demoMode ? "Real Data" : "Demo"}
              </button>
            </div>
          </div>
        </div>

        {/* Key Metrics Grid - Responsive */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricCard
            title="Total Value"
            value={formatCurrency(totalValue)}
            change={`${totalReturnPct}%`}
            changeType={totalReturnPct >= 0 ? "positive" : "negative"}
            icon="💼"
          />
          <MetricCard
            title="Total P&L"
            value={formatCurrency(totalPnL)}
            change={`${winners}W / ${losers}L`}
            changeType={totalPnL >= 0 ? "positive" : "negative"}
            icon="📈"
          />
          <MetricCard
            title="Positions"
            value={positionsCount}
            change={`${winners} winners`}
            changeType="neutral"
            icon="📊"
          />
          <MetricCard
            title="Top Position"
            value={topPosition ? topPosition.ticker : "—"}
            change={topPosition ? `${((topPosition.market_value / totalValue) * 100).toFixed(1)}%` : "—"}
            changeType="neutral"
            icon="⭐"
          />
        </div>

        {/* Charts Section - Responsive Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          
          {/* Holdings Distribution */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Holdings Distribution</h3>
            {portfolio.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={valueByTicker.slice(0, 6)}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill={COLORS.primary}
                    dataKey="value"
                  >
                    {valueByTicker.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS.surfaces[index % COLORS.surfaces.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="No positions to display" />
            )}
          </Card>

          {/* Performance Waterfall */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Top Contributors</h3>
            {portfolio.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={enrichedPositions
                    .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl))
                    .slice(0, 6)}
                  layout="vertical"
                >
                  <XAxis type="number" tick={{ fill: "#9ca3af" }} />
                  <YAxis type="category" dataKey="ticker" tick={{ fill: "#9ca3af" }} width={60} />
                  <Tooltip formatter={(value) => formatCurrency(value)} contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151" }} />
                  <Bar dataKey="pnl" fill={COLORS.success} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="No data available" />
            )}
          </Card>
        </div>

        {/* Positions Table - Full Width, Responsive */}
        <Card className="p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
            <h3 className="text-lg font-semibold text-white mb-2 sm:mb-0">Positions</h3>
            <button
              onClick={() => setShowAllDrift(!showAllDrift)}
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              {showAllDrift ? "Hide Drift" : "Show Drift"}
            </button>
          </div>
          {portfolio.length > 0 ? (
            <div className="overflow-x-auto">
              <PositionsTable positions={enrichedPositions} />
            </div>
          ) : (
            <EmptyState message="No positions uploaded yet" />
          )}
        </Card>

        {/* Risk Analysis Section */}
        {dashboardData && (
          <Card className="p-6 mt-8">
            <h3 className="text-lg font-semibold text-white mb-4">Risk Analysis</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-1">Portfolio Concentration</p>
                <p className="text-2xl font-bold text-blue-400">
                  {dashboardData.concentration_score ? (dashboardData.concentration_score * 100).toFixed(1) : "—"}%
                </p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-1">Sector Diversification</p>
                <p className="text-2xl font-bold text-green-400">
                  {dashboardData.sector_count || "—"}
                </p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-1">Max Position Size</p>
                <p className="text-2xl font-bold text-amber-400">
                  {topPosition ? ((topPosition.market_value / totalValue) * 100).toFixed(1) : "—"}%
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Error State */}
        {(dashboardError || pmPerfError) && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mt-8">
            <p className="text-red-400">{dashboardError || pmPerfError}</p>
          </div>
        )}

        {/* Demo Data Notice */}
        {demoMode && (
          <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4 mt-8">
            <p className="text-blue-400 text-sm">
              📊 Displaying demo data. Upload real positions to see your actual portfolio analysis.
            </p>
          </div>
        )}
      </div>
    </PageShell>
  );
};

export default PortfolioDashboardPage;
