import { useRef, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";

import "../App.css";
import { api } from "../api";
import PageLayout from "../components/layout/PageLayout";
import Sidebar from "../components/layout/Sidebar";
import AboutPage from "../features/about/AboutPage";
import AnalyticsPage from "../features/analytics/AnalyticsPage";
import OverviewPage from "../features/overview/OverviewPage";
import { routes } from "./routes";

const createDemoPosition = (ticker, description, quantity, avgCost, currentPrice) => {
  const marketValue = Number((quantity * currentPrice).toFixed(2));
  const pnl = Number(((currentPrice - avgCost) * quantity).toFixed(2));
  return {
    ticker,
    description,
    quantity,
    avg_cost: avgCost,
    current_price: currentPrice,
    market_value: marketValue,
    pnl,
  };
};

const DEMO_PORTFOLIO = [
  createDemoPosition("AAPL", "Apple Inc.", 150, 165.4, 182.35),
  createDemoPosition("MSFT", "Microsoft Corp.", 120, 295.8, 327.1),
  createDemoPosition("AMZN", "Amazon.com Inc.", 90, 118.2, 142.44),
  createDemoPosition("GOOGL", "Alphabet Class A", 110, 123.5, 138.65),
  createDemoPosition("NVDA", "NVIDIA Corp.", 60, 390.25, 447.8),
  createDemoPosition("JPM", "JPMorgan Chase", 140, 145.1, 161.72),
  createDemoPosition("UNH", "UnitedHealth Group", 45, 480.5, 461.1),
  createDemoPosition("XOM", "Exxon Mobil", 160, 104.6, 114.3),
  createDemoPosition("TSLA", "Tesla Inc.", 75, 225.4, 211.9),
  createDemoPosition("VTI", "Vanguard Total Market ETF", 200, 206.2, 219.4),
];

const formatCurrency = (n) =>
  n.toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });

const AppContent = () => {
  const [portfolio, setPortfolio] = useState([]);
  const [savedPortfolio, setSavedPortfolio] = useState([]);
  const [positionsFile, setPositionsFile] = useState(null);
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [demoMode, setDemoMode] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const uploadPositions = async (fileOverride = null) => {
    if (demoMode) return;
    const fileToUse = fileOverride || positionsFile;
    if (!fileToUse) return;

    setPositionsLoading(true);
    setUploadError("");
    const formData = new FormData();
    formData.append("file", fileToUse);

    try {
      const data = await api.uploadPositions(formData);
      setPortfolio(data);
    } catch (err) {
      console.error("Positions upload error:", err);
      const msg = err?.message?.includes("Failed to fetch")
        ? "Could not reach the API. Make sure the backend is running (localhost:8000) or set VITE_API_BASE_URL."
        : err.message || "Positions upload failed. Confirm the API is reachable.";
      setUploadError(msg);
    } finally {
      setPositionsLoading(false);
    }
  };

  const toggleDemoPortfolio = () => {
    if (!demoMode) {
      setSavedPortfolio(portfolio);
      setPortfolio(DEMO_PORTFOLIO);
      setPositionsFile(null);
      setUploadError("");
      setDemoMode(true);
      setPositionsLoading(false);
      navigate("/overview");
      return;
    }
    setPortfolio(savedPortfolio);
    setDemoMode(false);
    navigate("/overview");
  };

  const handleFileChange = (e) => {
    if (e.target.files?.[0]) {
      setPositionsFile(e.target.files[0]);
      uploadPositions(e.target.files[0]);
    }
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="app-shell">
      <header className="top-nav">
        <div className="top-brand">
          <span className="badge">Quant</span>
          Portfolio Intelligence
        </div>
        <div className="top-actions">
          <button
            className="btn btn-ghost"
            onClick={toggleDemoPortfolio}
          >
            {demoMode ? "Turn off demo" : "Try demo portfolio"}
          </button>
          <button
            className="btn btn-primary"
            onClick={openFilePicker}
            disabled={demoMode}
            title={demoMode ? "Turn off demo mode to upload your own file" : undefined}
          >
            {positionsLoading ? "Uploading..." : "Upload positions"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
        </div>
      </header>

      <div className="app-body">
        <Sidebar />
        <main className="main-content">
          <PageLayout>
            <Routes>
              <Route path="/" element={<Navigate to="/overview" replace />} />
              <Route
                path="/overview"
                element={
                  <OverviewPage
                    portfolio={portfolio}
                    formatCurrency={formatCurrency}
                    onUploadClick={openFilePicker}
                    onToggleDemo={toggleDemoPortfolio}
                    demoMode={demoMode}
                  />
                }
              />
          <Route
            path="/analytics"
            element={<AnalyticsPage formatCurrency={formatCurrency} />}
          />
          <Route
            path="/backtests"
            element={
              <div className="card">
                <h2>Backtests</h2>
                <p className="muted">Coming soon — backtest library and scenario analysis.</p>
              </div>
            }
          />
          <Route path="/about" element={<AboutPage />} />
          <Route path="*" element={<Navigate to="/overview" replace />} />
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
    <AppContent />
  </BrowserRouter>
);

export default AppShell;
