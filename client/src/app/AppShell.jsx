import { useEffect, useRef, useState } from "react";
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
import { PortfolioAnalyticsProvider, usePortfolioAnalytics } from "../state/portfolioAnalytics";
import { QuantLabProvider } from "../state/quantLabStore";
import { ActiveRunProvider } from "../state/activeRun";

const DEMO_PORTFOLIOS = [
  {
    id: "core_growth_intel",
    name: "Core Growth & Global Equity",
    description: "High-conviction US + global equity sleeve with growth and quality exposure.",
    holdings: [
      { symbol: "SPY", weight: 0.28 },
      { symbol: "QQQ", weight: 0.18 },
      { symbol: "VTI", weight: 0.12 },
      { symbol: "EFA", weight: 0.11 },
      { symbol: "IWM", weight: 0.08 },
      { symbol: "VNQ", weight: 0.05 },
      { symbol: "AGG", weight: 0.12 },
      { symbol: "GLD", weight: 0.06 },
    ],
  },
  {
    id: "global_modern_income",
    name: "Global Income & Diversified Fixed Income",
    description: "Blends Treasuries, corporate credit, and income-oriented equities for real-world resiliency.",
    holdings: [
      { symbol: "AGG", weight: 0.35 },
      { symbol: "LQD", weight: 0.2 },
      { symbol: "VNQ", weight: 0.1 },
      { symbol: "VFIFX", weight: 0.05 },
      { symbol: "MINT", weight: 0.1 },
      { symbol: "IEFA", weight: 0.15 },
      { symbol: "QQQ", weight: 0.05 },
    ],
  },
  {
    id: "systematic_momentum",
    name: "Systematic Momentum Tilt",
    description: "Modern momentum blend focused on tech, innovation, and adaptive weighting.",
    holdings: [
      { symbol: "MTUM", weight: 0.3 },
      { symbol: "QQQ", weight: 0.2 },
      { symbol: "SPYG", weight: 0.15 },
      { symbol: "IWM", weight: 0.1 },
      { symbol: "XLC", weight: 0.1 },
      { symbol: "XLK", weight: 0.05 },
      { symbol: "SHY", weight: 0.1 },
    ],
  },
  {
    id: "sustainable_global",
    name: "Sustainable Global Equity",
    description: "Broad ESG-forward allocation spanning developed and emerging markets.",
    holdings: [
      { symbol: "ESGU", weight: 0.25 },
      { symbol: "VEA", weight: 0.2 },
      { symbol: "VWO", weight: 0.15 },
      { symbol: "SPYX", weight: 0.1 },
      { symbol: "QQQ", weight: 0.1 },
      { symbol: "AGG", weight: 0.2 },
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

const presets = ["1Y", "3Y", "5Y", "MAX"];
const benchmarkOptions = ["SPY", "QQQ", "IWM", "ACWI"];

const PortfolioControlBar = ({ onUploadClick, onToggleDemo, demoMode }) => {
  const { benchmark, setBenchmark, dateRange, setDateRange } = usePortfolioAnalytics();

  return (
    <div className="dashboard-controls-bar">
      <div className="dashboard-controls-left">
        <div className="dashboard-control-group">
          <p className="label-sm">Date range</p>
          <div className="dashboard-controls-pills">
            {presets.map((preset) => (
              <button
                key={preset}
                type="button"
                className={`btn btn-ghost dashboard-pill ${dateRange.preset === preset ? "btn-primary" : ""}`}
                onClick={() => setDateRange({ preset, startDate: null, endDate: null })}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
        <div className="dashboard-control-group">
          <p className="label-sm">Benchmark</p>
          <select
            value={benchmark}
            onChange={(e) => setBenchmark(e.target.value)}
            className="dashboard-select"
          >
            {benchmarkOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="dashboard-controls-right">
        <button className="btn btn-primary" onClick={onUploadClick}>
          Import positions
        </button>
        <button className="btn btn-ghost" onClick={onToggleDemo}>
          {demoMode ? "Exit demo" : "Demo portfolios"}
        </button>
      </div>
    </div>
  );
};

const AppContent = () => {
  const {
    positions: portfolio,
    setPositions,
    portfolioMode,
    markDemoPortfolio,
    markUserPortfolio,
    clearPortfolioContext,
    activePortfolioName,
    activeDemoId,
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
  const [isCompactViewport, setIsCompactViewport] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 900 : false
  );
  const [mobileNoticeDismissed, setMobileNoticeDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleResize = () => {
      setIsCompactViewport(window.innerWidth < 900);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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

  if (positions && positions.length > 0) {
    markUserPortfolio("Imported portfolio");
  }

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
    markDemoPortfolio(demo.name, demo.id);
    navigate("/pm/dashboard");
  };

  const toggleDemoPortfolio = () => {
    if (demoMode) {
      setPositions(savedPortfolio);
      setDemoMode(false);
      setActiveDemo(null);
      if (savedPortfolio.length > 0) {
        markUserPortfolio("Imported portfolio");
      } else {
        clearPortfolioContext();
      }
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
    if (path.startsWith("/home")) return "Home";
    if (path.startsWith("/pm/dashboard")) return "Portfolio Dashboard";
    if (path.startsWith("/overview")) return "Portfolio Overview";
    if (path.startsWith("/pm/risk-diagnostics") || path.startsWith("/analytics")) return "Analytics";
    if (path.startsWith("/quant/strategy-research")) return "Strategy Research";
    if (path.startsWith("/pm/tax-harvest")) return "Tax Harvest";
    if (path.startsWith("/about")) return "About";
    if (path.startsWith("/contact")) return "Contact";
    if (path.startsWith("/math-engine")) return "Mathematical Engine";
    return "Saxton PI";
  })();
  const showMobileNotice = isCompactViewport && !mobileNoticeDismissed;

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
            <PortfolioControlBar
              onUploadClick={openImportModal}
              onToggleDemo={toggleDemoPortfolio}
              demoMode={demoMode}
            />
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
      {showMobileNotice && (
        <div className="mobile-warning-overlay">
          <div className="mobile-warning-overlay__panel">
            <p className="label-sm">Desktop preferred</p>
            <h2 className="section-title" style={{ marginBottom: "8px" }}>
              Saxton PI is optimized for larger screens
            </h2>
            <p className="muted">
              The interface is designed for laptops and external monitors. For the best experience, please revisit Saxton PI on a desktop browser.
            </p>
            <button
              className="btn btn-primary"
              onClick={() => setMobileNoticeDismissed(true)}
              style={{ marginTop: "1rem" }}
            >
              I prefer a desktop
            </button>
          </div>
        </div>
      )}
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
