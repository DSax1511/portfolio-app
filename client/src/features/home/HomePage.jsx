import Card from "../../components/ui/Card";
import PageShell from "../../components/ui/PageShell";

const HomePage = () => {
  return (
    <PageShell hideHeader>
      <div className="page-layout" style={{ gap: "1.25rem" }}>
        <Card className="bg-slate-900/60 border border-slate-800 p-6 md:p-8">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <p className="label-sm">Portfolio Intelligence</p>
              <h1 className="page-title" style={{ margin: 0 }}>
                Portfolio Intelligence
              </h1>
              <p className="page-subtitle" style={{ maxWidth: 780 }}>
                End-to-end portfolio management and quant research platform built with Python, FastAPI, and React.
              </p>
            </div>
            <ul className="simple-list space-y-1" style={{ marginTop: 0 }}>
              <li>Live portfolio analytics with allocation, risk, and rebalance engines</li>
              <li>Quant Lab for backtesting, microstructure, and regime analysis</li>
              <li>API-first FastAPI backend with React/Tailwind frontend, containerized with Docker</li>
            </ul>
            <p className="muted" style={{ marginTop: 0 }}>
              See the About page for project links and the Contact page for getting in touch.
            </p>
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
          </div>
        </div>

        <div>
          <div className="section-header">
            <div>
              <p className="label-sm">Where to start</p>
              <h2 className="section-title">Getting started</h2>
            </div>
          </div>
          <p className="muted" style={{ marginTop: 0 }}>
            If you’re exploring the platform for the first time, here’s a suggested path:
          </p>
          <ul className="simple-list">
            <li>Start in “Portfolio Dashboard” (left sidebar) to see live value, P&L, exposures, and drift.</li>
            <li>Open “Allocation & Rebalance” to review drift, suggested trades, and turnover.</li>
            <li>Review “Risk & Diagnostics” for drawdowns, volatility, and rolling risk metrics for the latest run or demo.</li>
            <li>Explore Quant Lab via “Strategy Research” for backtests, then “Market Structure” and “Regimes” for microstructure and regimes.</li>
            <li>Capture learnings alongside runs (notes/documentation); navigation stays in the left sidebar.</li>
          </ul>
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
