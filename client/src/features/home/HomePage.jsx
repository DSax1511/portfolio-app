import { Link } from "react-router-dom";
import Card from "../../components/ui/Card";
import PageShell from "../../components/ui/PageShell";

const HomePage = () => {
  return (
    <PageShell
      title="Portfolio Intelligence"
      subtitle="End-to-end portfolio management and quant research platform built with Python, FastAPI, and React."
    >
      <div className="page-layout" style={{ gap: "1.25rem" }}>
        <Card className="bg-slate-900/60 border border-slate-800">
          <div className="flex flex-col gap-3">
            <div>
              <p className="label-sm">Portfolio Intelligence</p>
              <h1 className="page-title" style={{ margin: 0 }}>
                Platform overview
              </h1>
              <p className="page-subtitle" style={{ maxWidth: 780 }}>
                End-to-end portfolio management and quant research platform built with Python, FastAPI, and React.
              </p>
            </div>
            <ul className="simple-list" style={{ marginTop: 0 }}>
              <li>Live portfolio analytics with allocation, risk, and rebalance engines</li>
              <li>Quant Lab for backtesting, microstructure, and regime analysis</li>
              <li>API-first FastAPI backend with React/Tailwind frontend, containerized with Docker</li>
            </ul>
          </div>
        </Card>

        <Card className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-800/40">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-100">Powered by SaxtonPI Quant Engine</p>
              <p className="muted" style={{ marginTop: "6px" }}>
                Risk, factor models, portfolio optimization, and backtesting in Python (NumPy/Pandas), exposed via a FastAPI "Portfolio Quant API."
              </p>
            </div>
            <Link to="/math-engine" className="btn btn-primary" style={{ minWidth: "180px", textAlign: "center" }}>
              View math & methods →
            </Link>
          </div>
        </Card>

        <div>
          <div className="section-header">
            <div>
              <p className="label-sm">How to use the platform</p>
              <h2 className="section-title">Workspaces</h2>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div>
              <p className="font-semibold text-slate-100">Portfolio Management workspace</p>
              <p className="muted">
                Monitor live portfolio value, P&L, exposures, and drift. Use the left sidebar to open “Portfolio Dashboard”, “Allocation &
                Rebalance”, and “Risk & Diagnostics” for rebalances, trades, and risk analysis. Navigation stays in the sidebar; Home is an
                overview only.
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-100">Quant Lab workspace</p>
              <p className="muted">
                Build and backtest strategies, study market microstructure, and explore regimes. Open “Strategy Research”, “Market
                Structure”, “Regimes”, or “Execution Lab” from the left menu to run experiments and view analytics.
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-100">Research & notes</p>
              <p className="muted">
                Use the Research section in the sidebar to centralize experiment notes and findings. Home provides context; navigation
                happens via the left-hand menu.
              </p>
            </div>
          </div>
        </div>

        <div>
          <div className="section-header">
            <div>
              <p className="label-sm">Example demo workflows</p>
              <h2 className="section-title">Step-by-step</h2>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <Card className="bg-slate-900/60 border border-slate-800">
              <p className="font-semibold text-slate-100">Demo 1 — Portfolio Management: long-only equity portfolio</p>
              <ol className="simple-list" style={{ marginTop: "8px" }}>
                <li>Turn on demo mode using the toggle in the top bar.</li>
                <li>Open “Portfolio Dashboard” from the sidebar to review live P&L, exposures, and concentration.</li>
                <li>Go to “Allocation & Rebalance” to inspect drift and suggested trades.</li>
                <li>Check “Risk & Diagnostics” for drawdowns, volatility, and rolling stats.</li>
              </ol>
            </Card>
            <Card className="bg-slate-900/60 border border-slate-800">
              <p className="font-semibold text-slate-100">Demo 2 — Quant Lab: strategy backtest</p>
              <ol className="simple-list" style={{ marginTop: "8px" }}>
                <li>Enable demo mode.</li>
                <li>Open “Strategy Research” in the Quant Lab section of the sidebar.</li>
                <li>Run the preconfigured demo strategy (simple factor tilt on SPY with transaction costs).</li>
                <li>Review the equity vs benchmark chart and risk metrics on the page.</li>
                <li>Optionally explore “Market Structure” and “Regimes” for the same symbol.</li>
              </ol>
            </Card>
          </div>
        </div>

        <div>
          <div className="section-header">
            <div>
              <p className="label-sm">Architecture</p>
              <h2 className="section-title">Architecture at a glance</h2>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Card>
              <p className="font-semibold text-slate-100">Backend</p>
              <ul className="simple-list" style={{ marginTop: "6px" }}>
                <li>FastAPI, Python analytics modules</li>
                <li>Backtests, risk, microstructure, regimes</li>
                <li>Caching via parquet</li>
              </ul>
            </Card>
            <Card>
              <p className="font-semibold text-slate-100">Frontend</p>
              <ul className="simple-list" style={{ marginTop: "6px" }}>
                <li>React, TypeScript, Tailwind</li>
                <li>Recharts for analytics visuals</li>
                <li>Shared UI primitives for cards, shells</li>
              </ul>
            </Card>
            <Card>
              <p className="font-semibold text-slate-100">Infra</p>
              <ul className="simple-list" style={{ marginTop: "6px" }}>
                <li>Dockerized services</li>
                <li>Local dev via Vite + uvicorn</li>
                <li>Configurable via env vars</li>
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </PageShell>
  );
};

export default HomePage;
