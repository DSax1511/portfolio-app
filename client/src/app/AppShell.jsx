import { useRef, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import "../App.css";
import PageLayout from "../components/layout/PageLayout";
import Sidebar from "../components/layout/Sidebar";
import TopNav from "../components/layout/TopNav";
import ImportPositionsModal from "../features/pm/components/ImportPositionsModal";
import AboutPage from "../features/about/AboutPage";
import MathEnginePage from "../features/about/MathEnginePage";
import RiskDiagnosticsPage from "../features/analytics/RiskDiagnosticsPage";
import ContactPage from "../features/contact/ContactPage";
import HomePage from "../features/home/HomePage";
import PortfolioDashboardPage from "../features/pm/PortfolioDashboardPage";
import AllocationRebalancePage from "../features/pm/AllocationRebalancePage";
import HistoricalAnalysisPage from "../features/pm/HistoricalAnalysisPage";
import TaxHarvestPage from "../features/pm/TaxHarvestPage";
import ExecutionSimulatorPage from "../features/quant/ExecutionSimulatorPage";
import MicrostructurePage from "../features/quant/MicrostructurePage";
import RegimesPage from "../features/quant/RegimesPage";
import StrategyBuilderPage from "../features/quant/StrategyBuilderPage";
import PortfolioLabPage from "../pages/PortfolioLabPage";
import AdvancedBacktestPage from "../pages/AdvancedBacktestPage";
import RiskLabPage from "../pages/RiskLabPage";
import LiveTradingPage from "../pages/LiveTradingPage";
import { PortfolioAnalyticsProvider, usePortfolioAnalytics } from "../state/portfolioAnalytics";
import { QuantLabProvider } from "../state/quantLabStore";
import { ActiveRunProvider } from "../state/activeRun";

const DEMO_PORTFOLIOS = [
  {
    id: "us_large_cap_quality_tech",
    name: "US Large-Cap Core (Tech & Quality Tilt)",
    description:
      "Concentrated US large-cap portfolio overweighting quality and tech names vs the S&P 500.",
    holdings: [
      { symbol: "AAPL", weight: 0.13 },
      { symbol: "MSFT", weight: 0.13 },
      { symbol: "GOOGL", weight: 0.08 },
      { symbol: "AMZN", weight: 0.08 },
      { symbol: "NVDA", weight: 0.07 },
      { symbol: "META", weight: 0.06 },
      { symbol: "BRK.B", weight: 0.08 },
      { symbol: "JPM", weight: 0.06 },
      { symbol: "UNH", weight: 0.06 },
      { symbol: "JNJ", weight: 0.05 },
      { symbol: "XOM", weight: 0.08 },
      { symbol: "HD", weight: 0.12 },
    ],
  },
  {
    id: "global_60_40_multi_asset",
    name: "Global 60/40 Multi-Asset",
    description:
      "Global equity and fixed-income portfolio with US, international, EM, credit, TIPS, and REITs.",
    holdings: [
      { symbol: "VTI", weight: 0.3 },
      { symbol: "VOO", weight: 0.1 },
      { symbol: "VXUS", weight: 0.15 },
      { symbol: "VWO", weight: 0.05 },
      { symbol: "BND", weight: 0.25 },
      { symbol: "HYG", weight: 0.05 },
      { symbol: "TIP", weight: 0.05 },
      { symbol: "VNQ", weight: 0.05 },
    ],
  },
  {
    id: "all_weather_risk_parity_style",
    name: "All-Weather / Risk-Parity Style",
    description: "All-weather style allocation balancing equities, duration, and real assets.",
    holdings: [
      { symbol: "VTI", weight: 0.25 },
      { symbol: "IEF", weight: 0.2 },
      { symbol: "TLT", weight: 0.25 },
      { symbol: "SHY", weight: 0.1 },
      { symbol: "GLD", weight: 0.1 },
      { symbol: "DBC", weight: 0.1 },
    ],
  },
  {
    id: "defensive_low_vol_dividend",
    name: "Defensive Low-Vol / Dividend",
    description: "Low-volatility and dividend tilt with a meaningful bond sleeve.",
    holdings: [
      { symbol: "USMV", weight: 0.3 },
      { symbol: "SPLV", weight: 0.15 },
      { symbol: "VIG", weight: 0.2 },
      { symbol: "XLU", weight: 0.1 },
      { symbol: "XLV", weight: 0.1 },
      { symbol: "BND", weight: 0.1 },
      { symbol: "SHY", weight: 0.05 },
    ],
  },
  {
    id: "sector_rotation_book",
    name: "US Sector Rotation Book",
    description:
      "Sector-tilted portfolio overweighting technology and cyclicals, underweighting defensives.",
    holdings: [
      { symbol: "XLY", weight: 0.12 },
      { symbol: "XLP", weight: 0.08 },
      { symbol: "XLE", weight: 0.1 },
      { symbol: "XLF", weight: 0.1 },
      { symbol: "XLV", weight: 0.12 },
      { symbol: "XLI", weight: 0.1 },
      { symbol: "XLK", weight: 0.18 },
      { symbol: "XLU", weight: 0.08 },
      { symbol: "XLB", weight: 0.07 },
      { symbol: "IYR", weight: 0.05 },
    ],
  },
  {
    id: "spy_benchmark",
    name: "SPY Benchmark",
    description: "Simple 100% S&P 500 benchmark allocation.",
    holdings: [{ symbol: "SPY", weight: 1.0 }],
  },
];

const getRandomDemoNotional = () => {
  const raw = 70_000 + Math.random() * (1_000_000 - 70_000);
  return Math.round(raw / 100) * 100;
};

const priceLookup = {
  VTI: 219.4,
  VOO: 523.2,
  VXUS: 56.8,
  VWO: 42.1,
  BND: 71.2,
  HYG: 78.6,
  TIP: 107.4,
  VNQ: 85.6,
  QQQ: 433.5,
  VUG: 334.1,
  XLK: 225.4,
  USMV: 77.8,
  SPLV: 68.3,
  AGG: 98.5,
  TLT: 94.2,
  IEF: 94.9,
  GLD: 188.3,
  DBC: 23.4,
  SPY: 520.5,
  SHY: 82.3,
  VIG: 175.6,
  XLU: 67.2,
  XLV: 154.3,
  XLY: 188.4,
  XLP: 73.1,
  XLE: 95.2,
  XLF: 40.8,
  XLI: 120.5,
  XLB: 82.7,
  IYR: 89.5,
  AAPL: 187.3,
  MSFT: 412.2,
  GOOGL: 150.4,
  AMZN: 170.1,
  NVDA: 780.4,
  META: 495.7,
  "BRK.B": 409.2,
  JPM: 161.7,
  UNH: 461.1,
  JNJ: 162.3,
  XOM: 114.3,
  HD: 357.4,
};

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

const seededRandom = (seedStr) => {
  let seed = 0;
  for (let i = 0; i < seedStr.length; i += 1) {
    seed = (seed << 5) - seed + seedStr.charCodeAt(i);
    seed |= 0;
  }
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return (seed >>> 0) / 4294967296;
  };
};

const seededNormal = (rand) => {
  const u1 = rand() || 1e-9;
  const u2 = rand();
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
};

// Stylized return scenario engine for demo portfolios.
// Applies simple, transparent assumptions per demo style to generate per-ticker total returns.
const buildDemoScenario = (demoId, holdings) => {
  const profile =
    {
      us_large_cap_quality_tech: {
        mu: 0.16,
        sigma: 0.12,
        min: -0.18,
        max: 0.42,
        tilts: { NVDA: 0.12, META: 0.06, AMZN: 0.05, AAPL: 0.02, MSFT: 0.02, XOM: -0.02, JNJ: -0.015 },
      },
      global_60_40_multi_asset: {
        mu: 0.08,
        sigma: 0.05,
        min: -0.08,
        max: 0.2,
        tilts: { BND: -0.015, HYG: -0.005, TIP: 0.0, VTI: 0.01, VOO: 0.01 },
      },
      all_weather_risk_parity_style: {
        mu: 0.07,
        sigma: 0.04,
        min: -0.06,
        max: 0.16,
        tilts: { TLT: 0.01, IEF: 0.005, SHY: -0.005, GLD: 0.01, DBC: 0.0 },
      },
      defensive_low_vol_dividend: {
        mu: 0.05,
        sigma: 0.03,
        min: -0.05,
        max: 0.12,
        tilts: { USMV: 0.01, SPLV: 0.005, VIG: 0.008, XLU: 0.0, XLV: 0.0, BND: -0.01 },
      },
      sector_rotation_book: {
        mu: 0.1,
        sigma: 0.12,
        min: -0.2,
        max: 0.35,
        tilts: { XLK: 0.08, XLY: 0.04, XLP: -0.02, XLU: -0.04, XLE: 0.01, XLB: 0.0 },
      },
      spy_benchmark: {
        mu: 0.09,
        sigma: 0.04,
        min: -0.08,
        max: 0.25,
        tilts: {},
      },
    }[demoId] || { mu: 0.06, sigma: 0.05, min: -0.1, max: 0.2, tilts: {} };

  const rand = seededRandom(demoId);
  const returnsByTicker = {};

  holdings.forEach((h, idx) => {
    const base = profile.mu + seededNormal(rand) * profile.sigma;
    const tilt = profile.tilts[h.symbol] || 0;
    const noise = seededNormal(rand) * profile.sigma * 0.15;
    const r = clamp(base + tilt + noise, profile.min, profile.max);
    const lossBias = rand() < 0.2 ? -Math.abs(r * 0.4) : 0;
    const finalReturn = clamp(r + lossBias / (idx + 2), profile.min, profile.max);
    returnsByTicker[h.symbol] = finalReturn;
  });

  return returnsByTicker;
};

const buildDemoPositions = (demo, baseValue) => {
  const totalNotional = baseValue || 100000;
  const returns = buildDemoScenario(demo.id, demo.holdings);
  return demo.holdings.map((h, idx) => {
    const price = priceLookup[h.symbol] || 100;
    const targetValue = totalNotional * h.weight;
    const quantity = Number((targetValue / price).toFixed(4));
    const current_price = price;
    const assumedReturn = returns[h.symbol] ?? 0.05;
    const avg_cost = Number((current_price / (1 + assumedReturn)).toFixed(4));
    const market_value = Number((quantity * current_price).toFixed(2));
    const pnl = Number((market_value - quantity * avg_cost).toFixed(2));
    return {
      ticker: h.symbol,
      description: h.symbol,
      quantity,
      avg_cost,
      current_price,
      market_value,
      pnl,
    };
  });
};

const formatCurrency = (n) =>
  n.toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });

const PortfolioFilters = () => {
  const { benchmark, setBenchmark, dateRange, setDateRange } = usePortfolioAnalytics();
  const presets = ["1Y", "3Y", "5Y", "MAX"];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        <span className="label-sm">Date range</span>
        {presets.map((p) => (
          <button
            key={p}
            className={`btn btn-ghost ${dateRange.preset === p ? "btn-primary" : ""}`}
            style={{ padding: "6px 10px", fontSize: "12px" }}
            onClick={() => setDateRange({ preset: p, startDate: null, endDate: null })}
          >
            {p}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <span className="label-sm">Benchmark</span>
        <select
          value={benchmark}
          onChange={(e) => setBenchmark(e.target.value)}
          style={{ width: 120 }}
        >
          <option value="SPY">SPY</option>
          <option value="QQQ">QQQ</option>
          <option value="IWM">IWM</option>
          <option value="ACWI">ACWI</option>
        </select>
      </div>
    </div>
  );
};

const AppContent = () => {
  const {
    positions: portfolio,
    setPositions,
  } = usePortfolioAnalytics();
  const [savedPortfolio, setSavedPortfolio] = useState([]);
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [demoMode, setDemoMode] = useState(false);
  const [activeDemo, setActiveDemo] = useState(null);
  const [latestRiskPayload, setLatestRiskPayload] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const demoNotionalsRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const isPortfolioRoute = location.pathname.startsWith("/pm");

  if (demoNotionalsRef.current === null) {
    demoNotionalsRef.current = DEMO_PORTFOLIOS.reduce((acc, demo) => {
      acc[demo.id] = getRandomDemoNotional();
      return acc;
    }, {});
  }

  const handleImportSuccess = (summary, positions = null) => {
    // Exit demo mode if active
    if (demoMode) {
      setDemoMode(false);
      setActiveDemo(null);
    }

    // If positions were provided, set them
    if (positions && positions.length > 0) {
      // Check if positions are already in the correct format (from file upload)
      // or need conversion (from manual entry)
      const hasBackendFormat = positions[0].hasOwnProperty('current_price');

      if (hasBackendFormat) {
        // Already formatted by backend (file upload)
        setPositions(positions);
      } else {
        // Manual entry format - needs conversion
        const formattedPositions = positions.map((p) => ({
          ticker: p.ticker,
          description: p.ticker,
          quantity: p.quantity,
          avg_cost: p.costBasis || 0,
          current_price: 0, // Will be fetched
          market_value: 0,
          pnl: 0,
        }));
        setPositions(formattedPositions);
      }
    }

    // Clear any previous upload errors
    setUploadError("");

    // Show success toast message
    const message = `Imported ${summary.positionsCount} positions across ${summary.uniqueTickers} tickers. Benchmark: ${summary.benchmark}.`;
    console.log("Import success:", message);

    // Navigate to dashboard if not already there
    if (!location.pathname.startsWith("/pm/dashboard")) {
      navigate("/pm/dashboard");
    }
  };

  const loadDemoPortfolio = (demo) => {
    if (!demoMode) {
      setSavedPortfolio(portfolio);
    }
    const baseValue = demoNotionalsRef.current?.[demo.id] || 100000;
    setPositions(buildDemoPositions(demo, baseValue));
    setUploadError("");
    setDemoMode(true);
    setActiveDemo(demo.id);
    setPositionsLoading(false);
    navigate("/pm/dashboard");
  };

  const toggleDemoPortfolio = () => {
    if (demoMode) {
      setPositions(savedPortfolio);
      setDemoMode(false);
      setActiveDemo(null);
      navigate("/pm/dashboard");
      return;
    }
    // If turning on demo without selection, load first demo
    loadDemoPortfolio(DEMO_PORTFOLIOS[0]);
  };

  const openImportModal = () => {
    setShowImportModal(true);
  };

  const breadcrumb = (() => {
    const path = location.pathname || "";
    if (path.startsWith("/pm/dashboard")) return "Portfolio Management → Dashboard";
    if (path.startsWith("/pm/allocation")) return "Portfolio Management → Allocation & Rebalance";
    if (path.startsWith("/pm/historical")) return "Portfolio Management → Historical Analysis";
    if (path.startsWith("/pm/risk")) return "Portfolio Management → Risk & Diagnostics";
    if (path.startsWith("/pm/tax-harvest")) return "Portfolio Management → Tax Harvest";
    if (path.startsWith("/quant/strategy")) return "Quant → Strategy Research";
    if (path.startsWith("/quant/market-structure")) return "Quant → Market Structure";
    if (path.startsWith("/quant/regimes")) return "Quant → Regimes";
    if (path.startsWith("/quant/execution")) return "Quant → Execution Lab";
    return "Home";
  })();

  return (
    <div className="app-shell">
      <TopNav
        breadcrumb={breadcrumb}
        positionsLoading={positionsLoading}
        demoMode={demoMode}
        demoPortfolios={DEMO_PORTFOLIOS}
        activeDemo={activeDemo}
        onSelectDemo={loadDemoPortfolio}
        onExitDemo={toggleDemoPortfolio}
        onUploadClick={openImportModal}
      />
      <ImportPositionsModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportSuccess={handleImportSuccess}
      />

      <div className="app-body">
        <Sidebar />
        <main className="main-content">
          {isPortfolioRoute && (
            <div className="flex items-center justify-between mb-3">
              <div className="label-sm text-slate-400">Portfolio controls</div>
              <PortfolioFilters />
            </div>
          )}
          <PageLayout>
            <Routes>
              <Route path="/" element={<Navigate to="/home" replace />} />
              <Route path="/home" element={<HomePage />} />
              <Route
                path="/pm/dashboard"
                element={
                  <PortfolioDashboardPage
                    portfolio={portfolio}
                    formatCurrency={formatCurrency}
                    onUploadClick={openImportModal}
                    onToggleDemo={toggleDemoPortfolio}
                    demoMode={demoMode}
                  />
                }
              />
              <Route path="/pm/overview" element={<Navigate to="/pm/dashboard" replace />} />
              <Route path="/overview" element={<Navigate to="/pm/dashboard" replace />} />
              <Route
                path="/pm/allocation-rebalance"
                element={<AllocationRebalancePage portfolio={portfolio} demoMode={demoMode} />}
              />
              <Route path="/pm/allocation" element={<Navigate to="/pm/allocation-rebalance" replace />} />
              <Route
                path="/pm/historical-analysis"
                element={<HistoricalAnalysisPage onRunComplete={setLatestRiskPayload} />}
              />
              <Route path="/pm/backtests" element={<Navigate to="/pm/historical-analysis" replace />} />
              <Route
                path="/pm/risk-diagnostics"
                element={<RiskDiagnosticsPage analysisPayload={latestRiskPayload} />}
              />
              <Route path="/pm/risk" element={<Navigate to="/pm/risk-diagnostics" replace />} />
              <Route path="/pm/tax-harvest" element={<TaxHarvestPage />} />
              <Route path="/analytics" element={<Navigate to="/pm/risk-diagnostics" replace />} />
              <Route path="/quant/strategy-research" element={<StrategyBuilderPage />} />
              <Route path="/quant/strategy-builder" element={<Navigate to="/quant/strategy-research" replace />} />
              <Route path="/quant/backtest-engine" element={<Navigate to="/quant/strategy-research" replace />} />
              <Route path="/quant/market-structure" element={<MicrostructurePage />} />
              <Route path="/quant/microstructure" element={<Navigate to="/quant/market-structure" replace />} />
              <Route path="/quant/regimes" element={<RegimesPage />} />
              <Route path="/quant/execution-lab" element={<ExecutionSimulatorPage />} />
              <Route path="/quant/execution-simulator" element={<Navigate to="/quant/execution-lab" replace />} />
              <Route path="/phase3/portfolio-lab" element={<PortfolioLabPage />} />
              <Route path="/phase3/advanced-backtest" element={<AdvancedBacktestPage />} />
              <Route path="/phase3/risk-lab" element={<RiskLabPage />} />
              <Route path="/phase3/live-trading" element={<LiveTradingPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/math-engine" element={<MathEnginePage />} />
              <Route path="*" element={<Navigate to="/home" replace />} />
            </Routes>
            {uploadError && (
              <p className="error-text" style={{ marginTop: "0.5rem" }}>
                {uploadError}
              </p>
            )}
          </PageLayout>
        </main>
      </div>
    </div>
  );
};

const AppShell = () => (
  <BrowserRouter>
    <ActiveRunProvider>
      <PortfolioAnalyticsProvider>
        <QuantLabProvider>
          <AppContent />
        </QuantLabProvider>
      </PortfolioAnalyticsProvider>
    </ActiveRunProvider>
  </BrowserRouter>
);

export default AppShell;
