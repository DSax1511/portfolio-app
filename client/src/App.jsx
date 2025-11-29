import { useState, useMemo, useEffect, useRef } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
} from "recharts";
import { LineChart, Line, CartesianGrid } from "recharts";
import "./App.css";
import { api } from "./api";

const COLORS = ["#4f46e5", "#22c55e", "#f97316", "#06b6d4", "#a855f7", "#e11d48"];
const TECH_TICKERS = new Set(["AAPL", "MSFT", "NVDA", "GOOGL", "GOOG", "AMZN", "META", "TSLA"]);

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

// Nice currency formatter reused everywhere
const formatCurrency = (n) =>
  n.toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });

function App() {
  const [portfolio, setPortfolio] = useState([]);
  const [savedPortfolio, setSavedPortfolio] = useState([]);
  const [positionsFile, setPositionsFile] = useState(null);
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [activeTab, setActiveTab] = useState("overview"); // "overview" | "positions" | "charts" | "analytics"

  // Analytics/backtest inputs
  const [analyticsTickers, setAnalyticsTickers] = useState("AAPL,MSFT,SPY");
  const [analyticsWeights, setAnalyticsWeights] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [metricsResult, setMetricsResult] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState("");

  const [strategy, setStrategy] = useState("buy_and_hold");
  const [fastWindow, setFastWindow] = useState(20);
  const [slowWindow, setSlowWindow] = useState(50);
  const [rebalanceFrequency, setRebalanceFrequency] = useState("none");
  const [backtestBenchmark, setBacktestBenchmark] = useState("SPY");
  const [backtestResult, setBacktestResult] = useState(null);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [backtestError, setBacktestError] = useState("");

  const [factorResult, setFactorResult] = useState(null);
  const [factorLoading, setFactorLoading] = useState(false);
  const [factorError, setFactorError] = useState("");

  const [riskResult, setRiskResult] = useState(null);
  const [riskLoading, setRiskLoading] = useState(false);
  const [riskError, setRiskError] = useState("");

  const [mcResult, setMcResult] = useState(null);
  const [mcLoading, setMcLoading] = useState(false);
  const [mcError, setMcError] = useState("");

  const [frontierResult, setFrontierResult] = useState(null);
  const [frontierLoading, setFrontierLoading] = useState(false);
  const [frontierError, setFrontierError] = useState("");

  const [stressScenario, setStressScenario] = useState("covid");
  const [stressResult, setStressResult] = useState(null);
  const [stressLoading, setStressLoading] = useState(false);
  const [stressError, setStressError] = useState("");

  const [benchmark, setBenchmark] = useState("SPY");
  const [benchmarkResult, setBenchmarkResult] = useState(null);
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);
  const [benchmarkError, setBenchmarkError] = useState("");

  const [presets, setPresets] = useState(() => {
    const saved = localStorage.getItem("portfolio-presets");
    return saved ? JSON.parse(saved) : [];
  });
  const [presetName, setPresetName] = useState("");
  const [builderRules, setBuilderRules] = useState([
    { left: "sma", leftWindow: 20, operator: ">", right: "sma", rightWindow: 50, value: "", action: "long" },
  ]);
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [builderResult, setBuilderResult] = useState(null);
  const [builderLoading, setBuilderLoading] = useState(false);
  const [builderError, setBuilderError] = useState("");

  const [positionSizingResult, setPositionSizingResult] = useState(null);
  const [positionSizingLoading, setPositionSizingLoading] = useState(false);
  const [positionSizingError, setPositionSizingError] = useState("");
  const [positionSizingForm, setPositionSizingForm] = useState({
    ticker: "NVDA",
    entry_price: 135.5,
    stop_price: 110.0,
    portfolio_value: 50000,
    risk_per_trade_pct: 1.0,
  });

  const [rebalanceResult, setRebalanceResult] = useState(null);
  const [rebalanceLoading, setRebalanceLoading] = useState(false);
  const [rebalanceError, setRebalanceError] = useState("");
  const [rebalanceForm, setRebalanceForm] = useState({
    tickers: "AAPL,MSFT,SPY",
    current_weights: "0.5,0.3,0.2",
    target_weights: "0.4,0.3,0.3",
    prices: "200,400,500",
    portfolio_value: 50000,
  });

  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState("");
  const [showAllDrift, setShowAllDrift] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("portfolio-presets", JSON.stringify(presets));
  }, [presets]);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.listPresets();
        const list = Object.entries(data).map(([name, payload]) => ({
          name,
          tickers: payload.tickers,
          weights: payload.weights,
        }));
        setPresets(list);
      } catch (e) {
        console.warn("Failed to load presets", e);
      }
    })();
  }, []);

  const parseTickers = () =>
    analyticsTickers
      .split(",")
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean);

  const parseWeights = () =>
    analyticsWeights
      ? analyticsWeights.split(",").map((w) => Number(w.trim()))
      : null;

  const computeDrawdownSeries = (equityCurve = []) => {
    let peak = -Infinity;
    return equityCurve.map((v) => {
      peak = Math.max(peak, v);
      return (v - peak) / peak;
    });
  };

  const rollingStats = (returns = [], window = 30) => {
    const out = [];
    for (let i = window; i < returns.length; i++) {
      const slice = returns.slice(i - window, i);
      const avg =
        slice.reduce((sum, v) => sum + v, 0) / (slice.length || 1);
      const vol = Math.sqrt(
        slice.reduce((sum, v) => sum + (v - avg) * (v - avg), 0) /
          (slice.length || 1)
      );
      const sharpe = vol ? (avg / vol) * Math.sqrt(252) : 0;
      out.push({ idx: i, vol, sharpe });
    }
    return out;
  };

  const rollingWithBeta = (returns = [], benchmark = null, dates = [], window = 60) => {
    const out = [];
    for (let i = window; i < returns.length; i++) {
      const rSlice = returns.slice(i - window, i);
      const avg = rSlice.reduce((s, v) => s + v, 0) / (rSlice.length || 1);
      const vol = Math.sqrt(
        rSlice.reduce((s, v) => s + (v - avg) * (v - avg), 0) /
          (rSlice.length || 1)
      );
      const sharpe = vol ? (avg / vol) * Math.sqrt(252) : 0;
      let beta = null;
      if (benchmark && benchmark.length === returns.length) {
        const bSlice = benchmark.slice(i - window, i);
        const bAvg = bSlice.reduce((s, v) => s + v, 0) / (bSlice.length || 1);
        const cov =
          rSlice.reduce((s, v, idx) => s + (v - avg) * (bSlice[idx] - bAvg), 0) /
          (rSlice.length || 1);
        const bVar =
          bSlice.reduce((s, v) => s + (v - bAvg) * (v - bAvg), 0) /
          (bSlice.length || 1);
        beta = bVar ? cov / bVar : null;
      }
      out.push({ idx: i, vol, sharpe, beta, date: dates[i] });
    }
    return out;
  };

  const buildIndicatorSpec = (side, rule) => {
    const spec = { indicator: side, window: null };
    if (side === "sma" || side === "ema" || side === "roc" || side === "vol") {
      spec.window = Number(rule[`${side === "roc" || side === "vol" ? "left" : "left"}Window`] || rule.leftWindow);
    }
    if (side === "macd") {
      spec.window = Number(rule.leftWindow || 12);
      spec.window_slow = Number(rule.rightWindow || 26);
      spec.parameter = 9;
    }
    if (side === "bollinger") {
      spec.window = Number(rule.leftWindow || 20);
      spec.std_mult = 2;
    }
    return spec;
  };

  const runStrategyBuilder = async () => {
    setBuilderLoading(true);
    setBuilderError("");
    setBuilderResult(null);
    try {
      const tickers = parseTickers();
      const weights = parseWeights();
      const rules = builderRules.map((r) => {
        const leftSpec = buildIndicatorSpec(r.left, r);
        const rulePayload = {
          left: leftSpec,
          operator: r.operator,
          action: r.action,
        };
        if (r.right && r.right !== "value") {
          rulePayload.right = buildIndicatorSpec(r.right, { ...r, leftWindow: r.rightWindow });
        }
        if (r.right === "value" && r.value !== "") {
          rulePayload.value = Number(r.value);
        }
        return rulePayload;
      });
      const data = await api.strategyBuilder({
        tickers,
        weights,
        start_date: startDate || null,
        end_date: endDate || null,
        rules,
        stop_loss: stopLoss ? Number(stopLoss) : null,
        take_profit: takeProfit ? Number(takeProfit) : null,
        benchmark: backtestBenchmark || null,
      });
      setBuilderResult(data);
    } catch (err) {
      setBuilderError(err.message || "Strategy builder failed");
    } finally {
      setBuilderLoading(false);
    }
  };

  // ------- UPLOAD HANDLER (POSITIONS) -------

  const uploadPositions = async (fileOverride = null) => {
    if (demoMode) return;
    const fileToUse = fileOverride || positionsFile;
    if (!fileToUse) return;

    setPositionsLoading(true);
    const formData = new FormData();
    formData.append("file", fileToUse);

    try {
      const data = await api.uploadPositions(formData);
      setPortfolio(data);
    } catch (err) {
      console.error("Positions upload error:", err);
    } finally {
      setPositionsLoading(false);
    }
  };

  const toggleDemoPortfolio = () => {
    if (!demoMode) {
      setSavedPortfolio(portfolio);
      setPortfolio(DEMO_PORTFOLIO);
      setPositionsFile(null);
      setDashboardError("");
      setDemoMode(true);
      setPositionsLoading(false);
      setActiveTab("overview");
      return;
    }
    setPortfolio(savedPortfolio);
    setDemoMode(false);
  };

  // ------- METRICS FROM POSITIONS -------

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

  // Charts: sort by market value descending for nicer visuals
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
          const data = await api.portfolioDashboard({
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

  // ------- UI -------

  return (
    <div className="app-root">
      {/* HEADER */}
      <header className="hero">
        <div>
          <p className="eyebrow">PORTFOLIO INTELLIGENCE</p>
          <h1>Understand your portfolio at a glance</h1>
          <p className="hero-sub">
            Upload your latest positions or try the demo to view live analytics, risk, and allocation insights instantly.
          </p>
          <div className="hero-actions">
            <button
              className="primary-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={demoMode}
              title={demoMode ? "Turn off demo mode to upload your own file" : undefined}
            >
              {positionsLoading ? "Uploading..." : "Upload positions CSV"}
            </button>
            <button className="secondary-btn" onClick={toggleDemoPortfolio}>
              {demoMode ? "Turn off demo" : "Try demo portfolio"}
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files?.[0]) {
                setPositionsFile(e.target.files[0]);
                uploadPositions(e.target.files[0]);
              }
            }}
          />
        </div>
      </header>

      {/* TABS */}
      <nav
        style={{
          display: "flex",
          gap: "0.5rem",
          marginBottom: "1rem",
          borderBottom: "1px solid rgba(148,163,184,0.4)",
        }}
      >
        {[
          { id: "overview", label: "Overview" },
          { id: "positions", label: "Positions" },
          { id: "analytics", label: "Analytics" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              border: "none",
              background: "transparent",
              padding: "0.4rem 0.9rem",
              borderBottom:
                activeTab === tab.id ? "2px solid #6366f1" : "2px solid transparent",
              color: activeTab === tab.id ? "#e5e7eb" : "#9ca3af",
              cursor: "pointer",
              fontSize: "0.9rem",
              fontWeight: activeTab === tab.id ? 600 : 500,
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main>
        {/* OVERVIEW TAB ----------------------------------------------------- */}
        {activeTab === "overview" && (
          <section className="app-layout">
            {/* Left: key metrics + highlights */}
            <section className="left-column">
              <div className="metrics-grid">
                <div className="metric-card">
                  <h3>Total Value</h3>
                  <p>{placeholderValue ? "—" : `$${formatCurrency(totalValue)}`}</p>
                </div>
                <div className="metric-card">
                  <h3>Total P/L</h3>
                  <p className={totalPnL >= 0 ? "positive" : "negative"}>
                    {placeholderValue ? "—" : `$${formatCurrency(totalPnL)}`}
                  </p>
                </div>
                <div className="metric-card">
                  <h3>Total Return</h3>
                  <p className={Number(totalReturnPct) >= 0 ? "positive" : "negative"}>
                    {placeholderValue ? "—" : `${totalReturnPct}%`}
                  </p>
                </div>
                <div className="metric-card">
                  <h3>Winners / Losers</h3>
                  <p>
                    <span className="positive">{placeholderValue ? "—" : winners}</span>{" "}
                    / <span className="negative">{placeholderValue ? "—" : losers}</span>
                  </p>
                </div>
                <div className="metric-card">
                  <h3>Positions</h3>
                  <p>{positionsCount || "No positions yet"}</p>
                </div>
                {topPosition && (
                  <div className="metric-card">
                    <h3>Top Holding</h3>
                    <p>
                      {topPosition.ticker} ·{" "}
                      {(
                        (topPosition.market_value / (totalValue || 1)) *
                        100
                      ).toFixed(1)}
                      %
                    </p>
                  </div>
                )}
              </div>

              <div className="card">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <h2 style={{ margin: 0 }}>Daily Attention</h2>
                    <span
                      className="info-dot"
                      title={
                        "Risk contributors = weight × volatility × correlation with the portfolio.\nOver/underweight compares actual allocation to a 10% target benchmark.\nDrawdowns calculated using trailing 12-month price series.\nAdvice is generated based on largest drift or risk concentration."
                      }
                      aria-label="How this is calculated"
                      role="img"
                    >
                      ?
                    </span>
                  </div>
                  {insights && (
                    <span
                      className={`badge ${
                        insights.confidence.tone === "red"
                          ? "badge-volatile"
                          : insights.confidence.tone === "yellow"
                          ? "badge-elevated"
                          : "badge-stable"
                      }`}
                    >
                      {insights.confidence.label}
                    </span>
                  )}
                </div>
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
                      <button className="secondary-btn" onClick={() => fileInputRef.current?.click()}>
                        Upload CSV
                      </button>
                      <button className="primary-btn" onClick={toggleDemoPortfolio}>
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
                            style={{
                              marginTop: "0.4rem",
                              background: "transparent",
                              border: "none",
                              color: "#60a5fa",
                              cursor: "pointer",
                              padding: 0,
                              fontSize: "0.9rem",
                            }}
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
              </div>

              <div className="card">
                <h2>Top Positions</h2>
                {portfolio.length === 0 ? (
                  <div className="empty-state" style={{ textAlign: "left" }}>
                    <p style={{ margin: "0 0 0.2rem", fontWeight: 700, color: "var(--text)" }}>
                      No positions loaded.
                    </p>
                    <p className="muted" style={{ margin: 0 }}>
                      Upload a CSV to see position-level analytics.
                    </p>
                    <div style={{ marginTop: "0.5rem" }}>
                      <button className="secondary-btn" onClick={() => fileInputRef.current?.click()}>
                        Upload CSV
                      </button>
                    </div>
                  </div>
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
              </div>
            </section>

            {/* Right: charts */}
            <section className="right-column">
              <div className="card chart-card">
                <h2>Market Value by Ticker</h2>
                {valueByTicker.length === 0 ? (
                  <div className="empty-state" style={{ textAlign: "center" }}>
                    Upload positions to see this chart.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={valueByTicker}
                      margin={{ top: 12, right: 16, left: 16, bottom: 16 }}
                    >
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 12 }}
                        tickMargin={10}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tickFormatter={(v) => `$${formatCurrency(v)}`}
                        tick={{ fontSize: 12 }}
                        tickMargin={8}
                        width={80}
                      />
                      <Tooltip
                        formatter={(value) => `$${formatCurrency(value)}`}
                        labelFormatter={(label) => `Ticker: ${label}`}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="card chart-card">
                <h2>Portfolio Allocation</h2>
                {valueByTicker.length === 0 ? (
                  <div className="empty-state" style={{ textAlign: "center" }}>
                    Upload positions to see this chart.
                  </div>
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
              </div>
            </section>
          </section>
        )}

        {/* POSITIONS TAB ---------------------------------------------------- */}
        {activeTab === "positions" && (
          <section className="card">
            <h2>All Positions</h2>
            {portfolio.length === 0 ? (
              <p className="muted">No positions loaded yet.</p>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Ticker</th>
                      <th>Quantity</th>
                      <th>Avg Cost</th>
                      <th>Current Price</th>
                      <th>Market Value</th>
                      <th>P/L</th>
                      <th>Return %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.map((p) => {
                      const invested = p.avg_cost * p.quantity;
                      const retPct =
                        invested > 0 ? ((p.pnl / invested) * 100).toFixed(2) : "0.00";
                      return (
                        <tr key={p.ticker}>
                          <td>{p.ticker}</td>
                          <td>{p.quantity.toFixed(2)}</td>
                          <td>${p.avg_cost.toFixed(2)}</td>
                          <td>${p.current_price.toFixed(2)}</td>
                          <td>${formatCurrency(p.market_value)}</td>
                          <td className={p.pnl >= 0 ? "positive" : "negative"}>
                            ${formatCurrency(p.pnl)}
                          </td>
                          <td
                            className={
                              Number(retPct) >= 0 ? "positive" : "negative"
                            }
                          >
                            {retPct}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
        {/* ANALYTICS TAB ---------------------------------------------------- */}
        {activeTab === "analytics" && (
          <section className="analytics-page">
            <header className="analytics-page-header">
              <h2>Quant Analytics & Backtests</h2>
              <p className="muted">
                Define a portfolio, run risk/return analytics, and simulate strategies, stress tests, and optimizations.
              </p>
            </header>

            <div className="analytics-section">
              <div className="section-heading">
                <h3>Portfolio Setup</h3>
                <p className="muted">Define the portfolio inputs and configure your backtest run.</p>
              </div>
              <div className="analytics-grid">
                <div className="analytics-form">
                  <h3>Portfolio Metrics</h3>
                  <label>
                    Tickers (comma-separated)
                    <input
                      type="text"
                      value={analyticsTickers}
                      onChange={(e) => setAnalyticsTickers(e.target.value)}
                      placeholder="AAPL,MSFT,SPY"
                    />
                  </label>
                  <label>
                    Weights (comma-separated, optional)
                    <input
                      type="text"
                      value={analyticsWeights}
                      onChange={(e) => setAnalyticsWeights(e.target.value)}
                      placeholder="0.4,0.3,0.3"
                    />
                  </label>
                  <div className="form-row">
                    <label>
                      Start date
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </label>
                    <label>
                      End date
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </label>
                  </div>
                  <button onClick={async () => {
                    setMetricsLoading(true);
                    setMetricsError("");
                    setMetricsResult(null);
                    try {
                      const tickers = parseTickers();
                      const weights = parseWeights();
                      const data = await api.portfolioMetrics({
                        tickers,
                        weights,
                        start_date: startDate || null,
                        end_date: endDate || null,
                      });
                      setMetricsResult(data);
                    } catch (err) {
                      setMetricsError(err.message || "Metrics request failed");
                    } finally {
                      setMetricsLoading(false);
                    }
                  }} disabled={metricsLoading}>
                    {metricsLoading ? "Loading..." : "Compute metrics"}
                  </button>
                  {metricsError && <p className="error-text">{metricsError}</p>}
                </div>

                <div className="analytics-form">
                  <h3>Backtest</h3>
                  <label>
                    Strategy
                    <select
                      value={strategy}
                      onChange={(e) => setStrategy(e.target.value)}
                    >
                      <option value="buy_and_hold">Buy & Hold</option>
                      <option value="sma_crossover">SMA Crossover</option>
                      <option value="momentum">Momentum (top N)</option>
                      <option value="min_vol">Min Volatility</option>
                      <option value="mean_reversion">Mean Reversion (RSI)</option>
                    </select>
                  </label>
                  {["sma_crossover", "momentum", "mean_reversion", "min_vol"].includes(strategy) && (
                    <div className="form-row">
                      <label>
                        {strategy === "momentum"
                          ? "Lookback (days)"
                          : strategy === "mean_reversion"
                          ? "RSI window"
                          : strategy === "min_vol"
                          ? "Lookback (vol window)"
                          : "Fast window"}
                        <input
                          type="number"
                          min="1"
                          value={fastWindow}
                          onChange={(e) => setFastWindow(Number(e.target.value))}
                        />
                      </label>
                      <label>
                        {strategy === "momentum"
                          ? "Top N"
                          : strategy === "mean_reversion"
                          ? "RSI threshold"
                          : strategy === "min_vol"
                          ? "Top N"
                          : "Slow window"}
                        <input
                          type="number"
                          min="1"
                          value={slowWindow}
                          onChange={(e) => setSlowWindow(Number(e.target.value))}
                        />
                      </label>
                    </div>
                  )}
                  <label>
                    Rebalance frequency
                    <select
                      value={rebalanceFrequency}
                      onChange={(e) => setRebalanceFrequency(e.target.value)}
                    >
                      <option value="none">None</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="annual">Annual</option>
                    </select>
                  </label>
                  <label>
                    Benchmark (for rolling beta/alpha)
                    <input
                      type="text"
                      value={backtestBenchmark}
                      onChange={(e) => setBacktestBenchmark(e.target.value.toUpperCase())}
                      placeholder="SPY"
                    />
                  </label>
                  <button onClick={async () => {
                    setBacktestLoading(true);
                    setBacktestError("");
                    setBacktestResult(null);
                    try {
                      const tickers = parseTickers();
                      const weights = parseWeights();
                      const body = {
                        strategy,
                        tickers,
                        weights,
                        start_date: startDate || null,
                        end_date: endDate || null,
                        rebalance_frequency: rebalanceFrequency,
                        benchmark: backtestBenchmark || null,
                        parameters:
                          strategy === "sma_crossover"
                            ? { fast_window: fastWindow, slow_window: slowWindow }
                            : strategy === "momentum"
                            ? { lookback: fastWindow, top_n: slowWindow }
                            : strategy === "min_vol"
                            ? { lookback: fastWindow, top_n: slowWindow }
                            : strategy === "mean_reversion"
                            ? { window: fastWindow, threshold: slowWindow }
                            : {},
                      };
                      const data = await api.backtest(body);
                      setBacktestResult(data);
                    } catch (err) {
                      setBacktestError(err.message || "Backtest request failed");
                    } finally {
                      setBacktestLoading(false);
                    }
                  }} disabled={backtestLoading}>
                    {backtestLoading ? "Running..." : "Run backtest"}
                  </button>
                  {backtestError && <p className="error-text">{backtestError}</p>}
                </div>
              </div>
            </div>

            <div className="analytics-section">
              <div className="section-heading">
                <h3>Analysis & Results</h3>
                <p className="muted">Review portfolio-level metrics and backtest performance.</p>
              </div>
              <div className="analytics-results">
                <div className="card">
                  <h3>Metrics</h3>
                  {!metricsResult ? (
                    <p className="muted">Run metrics to see results.</p>
                  ) : (
                    <>
                      <div className="stats-grid">
                        {[
                          { label: "Cumulative Return", key: "cumulative_return" },
                          { label: "Annualized Return", key: "annualized_return" },
                          { label: "Annualized Volatility", key: "annualized_volatility" },
                          { label: "Sharpe Ratio", key: "sharpe_ratio" },
                          { label: "Max Drawdown", key: "max_drawdown" },
                        ].map((row) => (
                          <div key={row.key} className="stat-box">
                            <p className="muted">{row.label}</p>
                            <p>
                              {row.key === "sharpe_ratio"
                                ? metricsResult.metrics[row.key].toFixed(2)
                                : `${(metricsResult.metrics[row.key] * 100).toFixed(2)}%`}
                            </p>
                          </div>
                        ))}
                      </div>
                      <p className="chart-title">Portfolio equity curve</p>
                      <div className="chart-wrapper">
                        <ResponsiveContainer width="100%" height={260}>
                          <LineChart
                            data={metricsResult.equity_curve.dates.map((d, idx) => ({
                              date: d,
                              equity: metricsResult.equity_curve.equity[idx],
                            }))}
                            margin={{ left: 4, right: 4, top: 10, bottom: 0 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                            <XAxis
                              dataKey="date"
                              label={{ value: "Date", position: "insideBottom", offset: -5 }}
                              tick={false}
                            />
                            <YAxis
                              tickFormatter={(v) => `${(v * 100 - 100).toFixed(1)}%`}
                              label={{ value: "Growth (%)", angle: -90, position: "insideLeft" }}
                              tick={{ fontSize: 12 }}
                            />
                            <Tooltip
                              formatter={(value) =>
                                `${((value - 1) * 100).toFixed(2)}%`
                              }
                              labelFormatter={(label) => label}
                            />
                            <Line type="monotone" dataKey="equity" stroke="#6366f1" dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      {backtestResult.benchmark && (
                        <>
                          <p className="chart-title">Rolling beta vs {backtestResult.benchmark.benchmark}</p>
                          <div className="chart-wrapper">
                            <ResponsiveContainer width="100%" height={200}>
                              <LineChart
                                data={rollingWithBeta(
                                  backtestResult.returns,
                                  backtestResult.benchmark.returns,
                                  backtestResult.dates,
                                  60
                                ).map((row) => ({
                                  date: row.date,
                                  beta: row.beta,
                                }))}
                              >
                                <XAxis
                                  dataKey="date"
                                  label={{ value: "Date", position: "insideBottom", offset: -5 }}
                                />
                                <YAxis label={{ value: "Beta", angle: -90, position: "insideLeft" }} />
                                <Tooltip formatter={(v) => Number(v).toFixed(2)} />
                                <Line type="monotone" dataKey="beta" stroke="#f59e0b" dot={false} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>

                <div className="card">
                  <h3>Backtest</h3>
                  {!backtestResult ? (
                    <p className="muted">Run a backtest to see results.</p>
                  ) : (
                    <>
                      <div className="stats-grid">
                        {[
                          { label: "Cumulative Return", key: "cumulative_return" },
                          { label: "Annualized Return", key: "annualized_return" },
                          { label: "Annualized Volatility", key: "annualized_volatility" },
                          { label: "Sharpe Ratio", key: "sharpe_ratio" },
                          { label: "Max Drawdown", key: "max_drawdown" },
                        ].map((row) => (
                          <div key={row.key} className="stat-box">
                            <p className="muted">{row.label}</p>
                            <p>
                              {row.key === "sharpe_ratio"
                                ? backtestResult.metrics[row.key].toFixed(2)
                                : `${(backtestResult.metrics[row.key] * 100).toFixed(2)}%`}
                            </p>
                          </div>
                        ))}
                      </div>
                      <p className="chart-title">Backtest equity curve</p>
                      <div className="chart-wrapper">
                        <ResponsiveContainer width="100%" height={260}>
                          <LineChart
                            data={backtestResult.equity_curve.dates.map((d, idx) => ({
                              date: d,
                              equity: backtestResult.equity_curve.equity[idx],
                            }))}
                            margin={{ left: 4, right: 4, top: 10, bottom: 0 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                            <XAxis
                              dataKey="date"
                              label={{ value: "Date", position: "insideBottom", offset: -5 }}
                              tick={false}
                            />
                            <YAxis
                              tickFormatter={(v) => `${(v * 100 - 100).toFixed(1)}%`}
                              label={{ value: "Growth (%)", angle: -90, position: "insideLeft" }}
                              tick={{ fontSize: 12 }}
                            />
                            <Tooltip
                              formatter={(value) =>
                                `${((value - 1) * 100).toFixed(2)}%`
                              }
                              labelFormatter={(label) => label}
                            />
                            <Line type="monotone" dataKey="equity" stroke="#22c55e" dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <p className="chart-title">Underwater (drawdown) curve</p>
                      <div className="chart-wrapper">
                        <ResponsiveContainer width="100%" height={200}>
                          <AreaChart
                            data={backtestResult.equity_curve.equity.map((v, idx) => ({
                              date: backtestResult.equity_curve.dates[idx],
                              dd: computeDrawdownSeries(backtestResult.equity_curve.equity)[idx],
                            }))}
                          >
                            <XAxis
                              dataKey="date"
                              label={{ value: "Date", position: "insideBottom", offset: -5 }}
                              tick={false}
                            />
                            <YAxis
                              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                              label={{ value: "Drawdown (%)", angle: -90, position: "insideLeft" }}
                              tick={{ fontSize: 12 }}
                            />
                            <Tooltip formatter={(v) => `${(v * 100).toFixed(2)}%`} />
                            <Area dataKey="dd" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                      <p className="chart-title">Rolling vol / Sharpe</p>
                      <div className="chart-wrapper">
                        <ResponsiveContainer width="100%" height={200}>
                          <LineChart
                            data={rollingWithBeta(
                              backtestResult.returns,
                              backtestResult.benchmark?.returns,
                              backtestResult.dates,
                              60
                            ).map((row) => ({
                              idx: row.idx,
                              vol: row.vol * Math.sqrt(252),
                              sharpe: row.sharpe,
                              date: row.date,
                            }))}
                          >
                            <XAxis
                              dataKey="date"
                              label={{ value: "Date", position: "insideBottom", offset: -5 }}
                              tick={false}
                            />
                            <YAxis label={{ value: "Value", angle: -90, position: "insideLeft" }} tick={{ fontSize: 12 }} />
                            <Tooltip
                              formatter={(v, name) =>
                                name === "sharpe"
                                  ? v.toFixed(2)
                                  : `${(v * 100).toFixed(2)}%`
                              }
                            />
                            <Line dataKey="vol" stroke="#60a5fa" dot={false} />
                            <Line dataKey="sharpe" stroke="#f97316" dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="analytics-section">
              <div className="section-heading">
                <h3>Tools & Advanced Analytics</h3>
                <p className="muted">Apply presets, size positions, rebalance, and explore advanced simulations.</p>
              </div>

              <div className="analytics-subsection">
                <h4 className="section-title">Portfolio Tools</h4>
                <div className="analytics-grid">
                  <div className="card">
                    <h3>Presets & Examples</h3>
                    <div className="preset-row">
                      <div className="preset-actions">
                        <input
                          type="text"
                          placeholder="Preset name"
                          value={presetName}
                          onChange={(e) => setPresetName(e.target.value)}
                        />
                        <button
                        onClick={() => {
                          if (!presetName) return;
                          const tickers = parseTickers();
                          const weights = parseWeights();
                          const newPreset = { name: presetName, tickers, weights };
                          setPresets([...presets, newPreset]);
                          api.savePreset(newPreset).catch(() => {});
                          setPresetName("");
                        }}
                      >
                          Save preset
                        </button>
                      </div>
                      <div className="preset-buttons">
                        {presets.map((p) => (
                          <button
                            key={p.name}
                            onClick={() => {
                              setAnalyticsTickers(p.tickers.join(","));
                              setAnalyticsWeights(p.weights ? p.weights.join(",") : "");
                            }}
                          >
                            Load {p.name}
                          </button>
                        ))}
                      </div>
                      <div className="preset-buttons">
                        {[
                          { label: "Momentum Portfolio", tickers: "MTUM,QQQ,SPY", weights: "0.5,0.3,0.2" },
                          { label: "Tech Tilt", tickers: "AAPL,MSFT,NVDA,QQQ", weights: "0.3,0.3,0.2,0.2" },
                          { label: "Risk Parity", tickers: "SPY,TLT,GLD", weights: "0.4,0.4,0.2" },
                        ].map((ex) => (
                          <button
                            key={ex.label}
                            onClick={() => {
                              setAnalyticsTickers(ex.tickers);
                              setAnalyticsWeights(ex.weights);
                            }}
                          >
                            {ex.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="card analytics-grid">
                    <div className="analytics-form">
                      <h3>Position Sizing</h3>
                      <div className="form-row">
                        <label>
                          Ticker
                          <input
                            value={positionSizingForm.ticker}
                            onChange={(e) => setPositionSizingForm({ ...positionSizingForm, ticker: e.target.value })}
                            placeholder="NVDA"
                          />
                        </label>
                        <label>
                          Risk per trade (%)
                          <input
                            type="number"
                            value={positionSizingForm.risk_per_trade_pct}
                            onChange={(e) => setPositionSizingForm({ ...positionSizingForm, risk_per_trade_pct: Number(e.target.value) })}
                            step="0.1"
                          />
                        </label>
                      </div>
                      <div className="form-row">
                        <label>
                          Entry price
                          <input
                            type="number"
                            value={positionSizingForm.entry_price}
                            onChange={(e) => setPositionSizingForm({ ...positionSizingForm, entry_price: Number(e.target.value) })}
                          />
                        </label>
                        <label>
                          Stop price
                          <input
                            type="number"
                            value={positionSizingForm.stop_price}
                            onChange={(e) => setPositionSizingForm({ ...positionSizingForm, stop_price: Number(e.target.value) })}
                          />
                        </label>
                      </div>
                      <label>
                        Portfolio value
                        <input
                          type="number"
                          value={positionSizingForm.portfolio_value}
                          onChange={(e) => setPositionSizingForm({ ...positionSizingForm, portfolio_value: Number(e.target.value) })}
                        />
                      </label>
                      <button
                        onClick={async () => {
                          setPositionSizingLoading(true);
                          setPositionSizingError("");
                          try {
                            const data = await api.positionSizing(positionSizingForm);
                            setPositionSizingResult(data);
                          } catch (err) {
                            setPositionSizingError(err.message || "Position sizing failed");
                          } finally {
                            setPositionSizingLoading(false);
                          }
                        }}
                        disabled={positionSizingLoading}
                      >
                        {positionSizingLoading ? "Calculating..." : "Calculate size"}
                      </button>
                      {positionSizingError && <p className="error-text">{positionSizingError}</p>}
                      {positionSizingResult && (
                        <div className="stats-grid">
                          <div className="stat-box">
                            <p className="muted">Shares</p>
                            <p>{positionSizingResult.shares}</p>
                          </div>
                          <div className="stat-box">
                            <p className="muted">Position value</p>
                            <p>${formatCurrency(positionSizingResult.position_value)}</p>
                          </div>
                          <div className="stat-box">
                            <p className="muted">Risk ($)</p>
                            <p>${formatCurrency(positionSizingResult.risk_amount)}</p>
                          </div>
                          <div className="stat-box">
                            <p className="muted">Risk % of portfolio</p>
                            <p>{positionSizingResult.risk_pct_of_portfolio.toFixed(2)}%</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="analytics-form">
                      <h3>Rebalance Suggestions</h3>
                      <label>
                        Tickers
                        <input
                          value={rebalanceForm.tickers}
                          onChange={(e) => setRebalanceForm({ ...rebalanceForm, tickers: e.target.value })}
                          placeholder="AAPL,MSFT,SPY"
                        />
                      </label>
                      <label>
                        Current weights (comma-separated)
                        <input
                          value={rebalanceForm.current_weights}
                          onChange={(e) => setRebalanceForm({ ...rebalanceForm, current_weights: e.target.value })}
                          placeholder="0.5,0.3,0.2"
                        />
                      </label>
                      <label>
                        Target weights (comma-separated)
                        <input
                          value={rebalanceForm.target_weights}
                          onChange={(e) => setRebalanceForm({ ...rebalanceForm, target_weights: e.target.value })}
                          placeholder="0.4,0.3,0.3"
                        />
                      </label>
                      <label>
                        Prices (comma-separated)
                        <input
                          value={rebalanceForm.prices}
                          onChange={(e) => setRebalanceForm({ ...rebalanceForm, prices: e.target.value })}
                          placeholder="200,400,500"
                        />
                      </label>
                      <label>
                        Portfolio value
                        <input
                          type="number"
                          value={rebalanceForm.portfolio_value}
                          onChange={(e) => setRebalanceForm({ ...rebalanceForm, portfolio_value: Number(e.target.value) })}
                        />
                      </label>
                      <button
                        onClick={async () => {
                          setRebalanceLoading(true);
                          setRebalanceError("");
                          try {
                            const payload = {
                              tickers: rebalanceForm.tickers.split(",").map((t) => t.trim()).filter(Boolean),
                              current_weights: rebalanceForm.current_weights.split(",").map((v) => Number(v.trim())),
                              target_weights: rebalanceForm.target_weights.split(",").map((v) => Number(v.trim())),
                              prices: rebalanceForm.prices.split(",").map((v) => Number(v.trim())),
                              portfolio_value: Number(rebalanceForm.portfolio_value),
                            };
                            const data = await api.rebalance(payload);
                            setRebalanceResult(data);
                          } catch (err) {
                            setRebalanceError(err.message || "Rebalance failed");
                          } finally {
                            setRebalanceLoading(false);
                          }
                        }}
                        disabled={rebalanceLoading}
                      >
                        {rebalanceLoading ? "Computing..." : "Get trades"}
                      </button>
                      {rebalanceError && <p className="error-text">{rebalanceError}</p>}
                      {rebalanceResult && (
                        <>
                          <p className="muted">Estimated turnover: {rebalanceResult.estimated_turnover_pct}%</p>
                          <div className="table-wrapper">
                            <table>
                              <thead>
                                <tr>
                                  <th>Ticker</th>
                                  <th>Action</th>
                                  <th>Shares</th>
                                  <th>Value</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rebalanceResult.trades.map((t) => (
                                  <tr key={t.ticker + t.action}>
                                    <td>{t.ticker}</td>
                                    <td style={{ textTransform: "capitalize" }}>{t.action}</td>
                                    <td>{t.shares}</td>
                                    <td>${formatCurrency(t.value)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="analytics-subsection">
                <h4 className="section-title">Advanced Analytics</h4>
                <div className="analytics-grid">
                  <div className="card">
                    <h3>Factor Exposures & Risk</h3>
                    <div className="action-row">
                      <button
                        onClick={async () => {
                          setFactorLoading(true);
                          setFactorError("");
                          try {
                            const data = await api.factorExposures({
                              tickers: parseTickers(),
                              weights: parseWeights(),
                              start_date: startDate || null,
                              end_date: endDate || null,
                            });
                            setFactorResult(data);
                          } catch (err) {
                            setFactorError(err.message || "Factor request failed");
                          } finally {
                            setFactorLoading(false);
                          }
                        }}
                        disabled={factorLoading}
                      >
                        {factorLoading ? "Loading..." : "Run factor regression"}
                      </button>
                      <button
                        onClick={async () => {
                          setRiskLoading(true);
                          setRiskError("");
                          try {
                            const data = await api.riskBreakdown({
                              tickers: parseTickers(),
                              weights: parseWeights(),
                              start_date: startDate || null,
                              end_date: endDate || null,
                            });
                            setRiskResult(data);
                          } catch (err) {
                            setRiskError(err.message || "Risk breakdown failed");
                          } finally {
                            setRiskLoading(false);
                          }
                        }}
                        disabled={riskLoading}
                      >
                        {riskLoading ? "Loading..." : "Risk breakdown"}
                      </button>
                      <button
                        onClick={async () => {
                          setBenchmarkLoading(true);
                          setBenchmarkError("");
                          try {
                            const data = await api.benchmark({
                              tickers: parseTickers(),
                              weights: parseWeights(),
                              benchmark,
                              start_date: startDate || null,
                              end_date: endDate || null,
                            });
                            setBenchmarkResult(data);
                          } catch (err) {
                            setBenchmarkError(err.message || "Benchmark failed");
                          } finally {
                            setBenchmarkLoading(false);
                          }
                        }}
                        disabled={benchmarkLoading}
                      >
                        {benchmarkLoading ? "Loading..." : "Compare to benchmark"}
                      </button>
                      <input
                        type="text"
                        value={benchmark}
                        onChange={(e) => setBenchmark(e.target.value.toUpperCase())}
                        placeholder="Benchmark (SPY)"
                        style={{ maxWidth: 120 }}
                      />
                    </div>
                    {factorError && <p className="error-text">{factorError}</p>}
                    {riskError && <p className="error-text">{riskError}</p>}
                    {benchmarkError && <p className="error-text">{benchmarkError}</p>}
                    <div className="analytics-grid">
                      <div className="stat-box">
                        <p className="muted">Alpha / Beta</p>
                        <p>
                          {benchmarkResult
                            ? `α ${(benchmarkResult.alpha * 100).toFixed(2)}% · β ${benchmarkResult.beta.toFixed(2)}`
                            : "Run benchmark"}
                        </p>
                      </div>
                      <div className="stat-box">
                        <p className="muted">Tracking Error</p>
                        <p>
                          {benchmarkResult
                            ? `${benchmarkResult.tracking_error.toFixed(3)}`
                            : "—"}
                        </p>
                      </div>
                      <div className="stat-box">
                        <p className="muted">Factor R²</p>
                        <p>{factorResult ? factorResult.r2.toFixed(2) : "—"}</p>
                      </div>
                      <div className="stat-box">
                        <p className="muted">Residual Vol</p>
                        <p>
                          {factorResult
                            ? `${(factorResult.residual_vol * 100).toFixed(2)}%`
                            : "—"}
                        </p>
                      </div>
                    </div>
                    {factorResult && (
                      <>
                        <p className="chart-title">Factor loadings</p>
                        <div className="chart-wrapper">
                          <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={factorResult.loadings}>
                              <XAxis
                                dataKey="factor"
                                label={{ value: "Factor", position: "insideBottom", offset: -5 }}
                                tick={{ fontSize: 12 }}
                              />
                              <YAxis label={{ value: "Beta", angle: -90, position: "insideLeft" }} tick={{ fontSize: 12 }} />
                              <Tooltip formatter={(v) => v.toFixed(2)} />
                              <Bar dataKey="beta" fill="#60a5fa" radius={[8, 8, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </>
                    )}
                    {riskResult && (
                      <>
                        <h4>Variance Contribution</h4>
                        <p className="chart-title">Contribution to variance</p>
                        <ResponsiveContainer width="100%" height={240}>
                          <BarChart data={riskResult.contribution}>
                            <XAxis
                              dataKey="ticker"
                              label={{ value: "Ticker", position: "insideBottom", offset: -5 }}
                              tick={{ fontSize: 12 }}
                              interval="preserveStartEnd"
                            />
                            <YAxis
                              tickFormatter={(v) => `${(v * 100).toFixed(1)}%`}
                              label={{ value: "% of portfolio variance", angle: -90, position: "insideLeft" }}
                            />
                            <Tooltip formatter={(v) => `${(v * 100).toFixed(1)}%`} />
                            <Bar dataKey="contribution" fill="#22c55e" radius={[8, 8, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                        <p className="chart-title">Rolling correlation matrix (30D)</p>
                        <div className="table-wrapper">
                          <table>
                            <thead>
                              <tr>
                                <th></th>
                                {riskResult.tickers.map((t) => (
                                  <th key={t}>{t}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {riskResult.corr_matrix.map((row, i) => (
                                <tr key={riskResult.tickers[i]}>
                                  <td>{riskResult.tickers[i]}</td>
                                  {row.map((val, j) => (
                                    <td key={j}>{val.toFixed(2)}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                    {benchmarkResult && (
                      <>
                        <p className="chart-title">Benchmark equity curve ({benchmarkResult.benchmark})</p>
                        <div className="chart-wrapper">
                          <ResponsiveContainer width="100%" height={220}>
                            <LineChart
                              data={benchmarkResult.equity_curve.dates.map((d, idx) => ({
                                date: d,
                                equity: benchmarkResult.equity_curve.equity[idx],
                              }))}
                            >
                              <XAxis
                                dataKey="date"
                                label={{ value: "Date", position: "insideBottom", offset: -5 }}
                                tick={false}
                              />
                              <YAxis
                                tickFormatter={(v) => `${((v - 1) * 100).toFixed(1)}%`}
                                label={{ value: "Growth (%)", angle: -90, position: "insideLeft" }}
                                tick={{ fontSize: 12 }}
                              />
                              <Tooltip
                                formatter={(value) => `${((value - 1) * 100).toFixed(2)}%`}
                                labelFormatter={(label) => label}
                              />
                              <Line type="monotone" dataKey="equity" stroke="#60a5fa" dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                        <p className="chart-title">Benchmark underwater (drawdown)</p>
                        <div className="chart-wrapper">
                          <ResponsiveContainer width="100%" height={180}>
                            <AreaChart
                              data={benchmarkResult.equity_curve.equity.map((v, idx) => ({
                                date: benchmarkResult.equity_curve.dates[idx],
                                dd: computeDrawdownSeries(benchmarkResult.equity_curve.equity)[idx],
                              }))}
                            >
                              <XAxis
                                dataKey="date"
                                label={{ value: "Date", position: "insideBottom", offset: -5 }}
                                tick={false}
                              />
                              <YAxis
                                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                                label={{ value: "Drawdown (%)", angle: -90, position: "insideLeft" }}
                              />
                              <Tooltip formatter={(v) => `${(v * 100).toFixed(2)}%`} />
                              <Area dataKey="dd" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                        <p className="chart-title">Benchmark rolling Sharpe (60D)</p>
                        <div className="chart-wrapper">
                          <ResponsiveContainer width="100%" height={200}>
                            <LineChart
                              data={rollingWithBeta(
                                benchmarkResult.returns,
                                benchmarkResult.returns,
                                benchmarkResult.dates,
                                60
                              ).map((row) => ({
                                date: row.date,
                                sharpe: row.sharpe,
                              }))}
                            >
                              <XAxis
                                dataKey="date"
                                label={{ value: "Date", position: "insideBottom", offset: -5 }}
                                tick={false}
                              />
                              <YAxis label={{ value: "Sharpe", angle: -90, position: "insideLeft" }} />
                              <Tooltip formatter={(v) => v.toFixed(2)} />
                              <Line dataKey="sharpe" stroke="#22c55e" dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="card">
                    <h3>Monte Carlo & Stress Tests</h3>
                    <div className="form-row">
                      <label>
                        Simulations
                        <input
                          type="number"
                          min="1"
                          value={mcParams?.num_simulations ?? 200}
                          onChange={(e) => setMcParams({ ...(mcParams || {}), num_simulations: Number(e.target.value) })}
                        />
                      </label>
                      <label>
                        Days
                        <input
                          type="number"
                          min="10"
                          value={mcParams?.days ?? 252}
                          onChange={(e) => setMcParams({ ...(mcParams || {}), days: Number(e.target.value) })}
                        />
                      </label>
                      <label>
                        Daily drift (μ)
                        <input
                          type="number"
                          step="0.0001"
                          value={mcParams?.drift ?? 0.0005}
                          onChange={(e) => setMcParams({ ...(mcParams || {}), drift: Number(e.target.value) })}
                        />
                      </label>
                      <label>
                        Daily vol (σ)
                        <input
                          type="number"
                          step="0.0001"
                          value={mcParams?.vol ?? 0.02}
                          onChange={(e) => setMcParams({ ...(mcParams || {}), vol: Number(e.target.value) })}
                        />
                      </label>
                    </div>
                    <div className="form-row">
                      <label>
                        Stress scenario
                        <select value={stressScenario} onChange={(e) => setStressScenario(e.target.value)}>
                          <option value="covid">COVID Crash</option>
                          <option value="gfc">2008 GFC</option>
                          <option value="dotcom">Dotcom Bust</option>
                        </select>
                      </label>
                      <label>
                        Portfolio (tickers)
                        <input
                          type="text"
                          value={analyticsTickers}
                          onChange={(e) => setAnalyticsTickers(e.target.value)}
                        />
                      </label>
                    </div>
                    <div className="action-row">
                      <button
                        onClick={async () => {
                          setMcLoading(true);
                          setMcError("");
                          try {
                            const data = await api.monteCarlo({
                              tickers: parseTickers(),
                              weights: parseWeights(),
                              ...mcParams,
                            });
                            setMcResult(data);
                          } catch (err) {
                            setMcError(err.message || "Monte Carlo failed");
                          } finally {
                            setMcLoading(false);
                          }
                        }}
                        disabled={mcLoading}
                      >
                        {mcLoading ? "Simulating..." : "Run Monte Carlo"}
                      </button>
                      <button
                        onClick={async () => {
                          setStressLoading(true);
                          setStressError("");
                          try {
                            const data = await api.stressTest({
                              tickers: parseTickers(),
                              weights: parseWeights(),
                              scenario: stressScenario,
                            });
                            setStressResult(data);
                          } catch (err) {
                            setStressError(err.message || "Stress test failed");
                          } finally {
                            setStressLoading(false);
                          }
                        }}
                        disabled={stressLoading}
                      >
                        {stressLoading ? "Running..." : "Run stress test"}
                      </button>
                    </div>
                    {mcError && <p className="error-text">{mcError}</p>}
                    {stressError && <p className="error-text">{stressError}</p>}
                    {mcResult && (
                      <>
                        <div className="stats-grid">
                          <div className="stat-box">
                            <p className="muted">Mean return</p>
                            <p>{(mcResult.mean_return * 100).toFixed(2)}%</p>
                          </div>
                          <div className="stat-box">
                            <p className="muted">Median return</p>
                            <p>{(mcResult.median_return * 100).toFixed(2)}%</p>
                          </div>
                          <div className="stat-box">
                            <p className="muted">VaR (5%)</p>
                            <p>{(mcResult.var_5 * 100).toFixed(2)}%</p>
                          </div>
                          <div className="stat-box">
                            <p className="muted">CVaR (5%)</p>
                            <p>{(mcResult.cvar_5 * 100).toFixed(2)}%</p>
                          </div>
                        </div>
                        <p className="chart-title">Monte Carlo ending values</p>
                        <div className="chart-wrapper">
                          <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={mcResult.ending_values.map((v, idx) => ({ id: idx, value: v }))}>
                              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                              <XAxis dataKey="id" tick={false} label={{ value: "Simulations", position: "insideBottom", offset: -5 }} />
                              <YAxis tickFormatter={(v) => `$${formatCurrency(v)}`} label={{ value: "Ending Value", angle: -90, position: "insideLeft" }} />
                              <Tooltip formatter={(v) => `$${formatCurrency(v)}`} />
                              <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </>
                    )}
                    {stressResult && (
                      <>
                        <p className="chart-title">Stress test outcome ({stressScenario})</p>
                        <div className="analytics-grid">
                          <div className="stat-box">
                            <p className="muted">Peak drawdown</p>
                            <p>{(stressResult.max_drawdown * 100).toFixed(2)}%</p>
                          </div>
                          <div className="stat-box">
                            <p className="muted">Recovery time (days)</p>
                            <p>{stressResult.recovery_time_days}</p>
                          </div>
                          <div className="stat-box">
                            <p className="muted">Worst day</p>
                            <p>{(stressResult.worst_day_return * 100).toFixed(2)}%</p>
                          </div>
                        </div>
                        <div className="chart-wrapper">
                          <ResponsiveContainer width="100%" height={220}>
                            <LineChart
                              data={stressResult.equity_curve.map((v, idx) => ({
                                date: stressResult.dates[idx],
                                equity: v,
                              }))}
                            >
                              <XAxis dataKey="date" label={{ value: "Date", position: "insideBottom", offset: -5 }} />
                              <YAxis
                                tickFormatter={(v) => `${((v - 1) * 100).toFixed(1)}%`}
                                label={{ value: "Growth (%)", angle: -90, position: "insideLeft" }}
                              />
                              <Tooltip formatter={(value) => `${((value - 1) * 100).toFixed(2)}%`} />
                              <Line dataKey="equity" stroke="#ef4444" dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="card">
                    <h3>Efficient Frontier & Optimization</h3>
                    <div className="action-row">
                      <button
                        onClick={async () => {
                          setFrontierLoading(true);
                          setFrontierError("");
                          try {
                            const data = await api.efficientFrontier({
                              tickers: parseTickers(),
                              start_date: startDate || null,
                              end_date: endDate || null,
                            });
                            setFrontierResult(data);
                          } catch (err) {
                            setFrontierError(err.message || "Frontier failed");
                          } finally {
                            setFrontierLoading(false);
                          }
                        }}
                        disabled={frontierLoading}
                      >
                        {frontierLoading ? "Optimizing..." : "Show frontier"}
                      </button>
                    </div>
                    {frontierError && <p className="error-text">{frontierError}</p>}
                    {frontierResult ? (
                      <>
                        <div className="stats-grid">
                          <div className="stat-box">
                            <p className="muted">Max Sharpe</p>
                            <p>
                              {(frontierResult.max_sharpe.return * 100).toFixed(2)}% /
                              {(frontierResult.max_sharpe.vol * 100).toFixed(2)}%
                            </p>
                          </div>
                          <div className="stat-box">
                            <p className="muted">Min Vol</p>
                            <p>
                              {(frontierResult.min_vol.return * 100).toFixed(2)}% /
                              {(frontierResult.min_vol.vol * 100).toFixed(2)}%
                            </p>
                          </div>
                        </div>
                        <p className="chart-title">Efficient frontier</p>
                        <div className="chart-wrapper">
                          <ResponsiveContainer width="100%" height={260}>
                            <ScatterChart data={frontierResult.frontier}>
                              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                              <XAxis
                                type="number"
                                dataKey="vol"
                                name="Vol"
                                label={{ value: "Volatility (%)", position: "insideBottom", offset: -5 }}
                                tickFormatter={(v) => `${(v * 100).toFixed(1)}%`}
                                tick={{ fontSize: 12 }}
                              />
                              <YAxis
                                type="number"
                                dataKey="return"
                                name="Return"
                                label={{ value: "Return (%)", angle: -90, position: "insideLeft" }}
                                tickFormatter={(v) => `${(v * 100).toFixed(1)}%`}
                                tick={{ fontSize: 12 }}
                              />
                              <Tooltip
                                formatter={(value, name) =>
                                  `${(value * 100).toFixed(2)}% ${name}`
                                }
                              />
                              <Scatter data={frontierResult.frontier} fill="#60a5fa" />
                              <Scatter
                                data={[frontierResult.max_sharpe]}
                                fill="#22c55e"
                                shape="star"
                                name="Max Sharpe"
                              />
                              <Scatter
                                data={[frontierResult.min_vol]}
                                fill="#f97316"
                                shape="triangle"
                                name="Min Vol"
                              />
                            </ScatterChart>
                          </ResponsiveContainer>
                        </div>
                      </>
                    ) : (
                      <p className="muted">Run frontier to visualize optimal portfolios.</p>
                    )}
                  </div>

                  <div className="card">
                    <h3>Custom Strategy Builder</h3>
                    <p className="muted">
                      Combine indicators (SMA, EMA, RSI, MACD, Bollinger, ROC, Vol) with rules to toggle exposure.
                    </p>
                    <div className="builder-rules">
                      {builderRules.map((rule, idx) => (
                        <div key={idx} className="builder-row">
                          <select
                            value={rule.left}
                            onChange={(e) => {
                              const next = [...builderRules];
                              next[idx].left = e.target.value;
                              setBuilderRules(next);
                            }}
                          >
                            {["sma", "ema", "rsi", "macd", "bollinger", "roc", "vol", "price"].map((opt) => (
                              <option key={opt} value={opt}>{opt.toUpperCase()}</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min="1"
                            placeholder="Window"
                            value={rule.leftWindow ?? ""}
                            onChange={(e) => {
                              const next = [...builderRules];
                              next[idx].leftWindow = Number(e.target.value);
                              setBuilderRules(next);
                            }}
                          />
                          <select
                            value={rule.operator}
                            onChange={(e) => {
                              const next = [...builderRules];
                              next[idx].operator = e.target.value;
                              setBuilderRules(next);
                            }}
                          >
                            <option value=">">{">"}</option>
                            <option value="<">{"<"}</option>
                            <option value="cross_over">Cross Over</option>
                          </select>
                          <select
                            value={rule.right}
                            onChange={(e) => {
                              const next = [...builderRules];
                              next[idx].right = e.target.value;
                              setBuilderRules(next);
                            }}
                          >
                            <option value="value">Value</option>
                            {["sma", "ema", "rsi", "macd", "bollinger", "roc", "vol", "price"].map((opt) => (
                              <option key={opt} value={opt}>{opt.toUpperCase()}</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            placeholder="Right window / value"
                            value={rule.right === "value" ? rule.value ?? "" : rule.rightWindow ?? ""}
                            onChange={(e) => {
                              const next = [...builderRules];
                              if (rule.right === "value") {
                                next[idx].value = e.target.value;
                              } else {
                                next[idx].rightWindow = Number(e.target.value);
                              }
                              setBuilderRules(next);
                            }}
                          />
                          <select
                            value={rule.action}
                            onChange={(e) => {
                              const next = [...builderRules];
                              next[idx].action = e.target.value;
                              setBuilderRules(next);
                            }}
                          >
                            <option value="long">Go Long</option>
                            <option value="flat">Exit</option>
                          </select>
                          <button
                            onClick={() => setBuilderRules(builderRules.filter((_, i) => i !== idx))}
                            disabled={builderRules.length === 1}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() =>
                          setBuilderRules([
                            ...builderRules,
                            { left: "sma", leftWindow: 10, operator: ">", right: "value", value: 0, action: "long" },
                          ])
                        }
                      >
                        Add rule
                      </button>
                    </div>
                    <div className="form-row">
                      <label>
                        Stop loss (decimal, e.g. 0.1)
                        <input
                          type="number"
                          step="0.01"
                          value={stopLoss}
                          onChange={(e) => setStopLoss(e.target.value)}
                        />
                      </label>
                      <label>
                        Take profit (decimal, e.g. 0.2)
                        <input
                          type="number"
                          step="0.01"
                          value={takeProfit}
                          onChange={(e) => setTakeProfit(e.target.value)}
                        />
                      </label>
                    </div>
                    <button onClick={runStrategyBuilder} disabled={builderLoading}>
                      {builderLoading ? "Running..." : "Run custom strategy"}
                    </button>
                    {builderError && <p className="error-text">{builderError}</p>}
                    {builderResult ? (
                      <>
                        <div className="stats-grid">
                          {[
                            { label: "Cumulative Return", key: "cumulative_return" },
                            { label: "Annualized Return", key: "annualized_return" },
                            { label: "Annualized Volatility", key: "annualized_volatility" },
                            { label: "Sharpe Ratio", key: "sharpe_ratio" },
                            { label: "Max Drawdown", key: "max_drawdown" },
                          ].map((row) => (
                            <div key={row.key} className="stat-box">
                              <p className="muted">{row.label}</p>
                              <p>
                                {row.key === "sharpe_ratio"
                                  ? builderResult.metrics[row.key].toFixed(2)
                                  : `${(builderResult.metrics[row.key] * 100).toFixed(2)}%`}
                              </p>
                            </div>
                          ))}
                        </div>
                        <p className="chart-title">Strategy equity curve</p>
                        <div className="chart-wrapper">
                          <ResponsiveContainer width="100%" height={240}>
                            <LineChart
                              data={builderResult.equity_curve.dates.map((d, idx) => ({
                                date: d,
                                equity: builderResult.equity_curve.equity[idx],
                              }))}
                            >
                              <XAxis dataKey="date" label={{ value: "Date", position: "insideBottom", offset: -5 }} />
                              <YAxis
                                tickFormatter={(v) => `${(v * 100 - 100).toFixed(1)}%`}
                                label={{ value: "Growth (%)", angle: -90, position: "insideLeft" }}
                              />
                              <Tooltip formatter={(value) => `${((value - 1) * 100).toFixed(2)}%`} />
                              <Line type="monotone" dataKey="equity" stroke="#22c55e" dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                        <p className="chart-title">Underwater (drawdown)</p>
                        <div className="chart-wrapper">
                          <ResponsiveContainer width="100%" height={200}>
                            <AreaChart
                              data={builderResult.equity_curve.equity.map((v, idx) => ({
                                date: builderResult.equity_curve.dates[idx],
                                dd: computeDrawdownSeries(builderResult.equity_curve.equity)[idx],
                              }))}
                            >
                              <XAxis dataKey="date" label={{ value: "Date", position: "insideBottom", offset: -5 }} />
                              <YAxis
                                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                                label={{ value: "Drawdown (%)", angle: -90, position: "insideLeft" }}
                              />
                              <Tooltip formatter={(v) => `${(v * 100).toFixed(2)}%`} />
                              <Area dataKey="dd" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </>
                    ) : (
                      <p className="muted">Define rules and run to see results.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
