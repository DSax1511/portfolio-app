import { useNavigate } from "react-router-dom";
import Card from "../../components/ui/Card";
import PageShell from "../../components/ui/PageShell";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { formatDateTick } from "../../utils/format";

const HomePage = () => {
  const navigate = useNavigate();
  const demoEquity = [
    { date: "2015-01-02", portfolio: 1.0, benchmark: 1.0 },
    { date: "2016-01-04", portfolio: 1.06, benchmark: 1.03 },
    { date: "2017-01-03", portfolio: 1.16, benchmark: 1.11 },
    { date: "2018-01-02", portfolio: 1.32, benchmark: 1.21 },
    { date: "2019-01-02", portfolio: 1.48, benchmark: 1.32 },
    { date: "2020-01-02", portfolio: 1.62, benchmark: 1.37 },
    { date: "2021-01-04", portfolio: 1.95, benchmark: 1.58 },
    { date: "2022-01-03", portfolio: 1.88, benchmark: 1.51 },
    { date: "2023-01-03", portfolio: 2.12, benchmark: 1.73 },
    { date: "2024-01-02", portfolio: 2.28, benchmark: 1.82 },
  ];
  const stats = [
    { label: "CAGR", demo: "12.8%", bench: "10.1%" },
    { label: "Volatility", demo: "13.2%", bench: "14.5%" },
    { label: "Sharpe", demo: "0.97", bench: "0.70" },
    { label: "Max Drawdown", demo: "-18.4%", bench: "-23.8%" },
  ];

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
                Portfolio Intelligence
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
            <div className="flex flex-wrap gap-2">
              <a className="btn btn-ghost" href="https://github.com/DSax1511">
                View GitHub
              </a>
              <a className="btn btn-ghost" href="/resume.pdf">
                Download Resume
              </a>
              <a className="btn btn-ghost" href="/whitepaper.pdf">
                Read Project Whitepaper
              </a>
            </div>
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
              <p className="label-sm">Proof of results (demo data)</p>
              <h2 className="section-title">Demo strategy vs SPY</h2>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="md:col-span-2" title="Demo factor strategy vs SPY" subtitle="2015–2024, net of costs (simulated)">
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={demoEquity} margin={{ left: 6, right: 12, top: 8, bottom: 0 }}>
                    <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={formatDateTick} stroke="#6b7280" />
                    <YAxis tickFormatter={(v) => `${((v - 1) * 100).toFixed(0)}%`} stroke="#6b7280" label={{ value: "Cumulative return (%)", angle: -90, position: "insideLeft", fill: "#94a3b8" }} />
                    <Tooltip
                      labelFormatter={formatDateTick}
                      formatter={(val, name) => [`${((val - 1) * 100).toFixed(2)}%`, name]}
                      contentStyle={{ backgroundColor: "#0b1220", borderColor: "#1f2937" }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="portfolio" name="Demo strategy" stroke="#4f8cff" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="benchmark" name="SPY benchmark" stroke="#22c55e" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="muted" style={{ marginTop: "8px" }}>
                Simulated demo strategy vs SPY benchmark; shown for illustration only.
              </p>
            </Card>
            <Card title="Demo stats" subtitle="Computed from the demo backtest">
              <div className="flex flex-col gap-2">
                {stats.map((s) => (
                  <div key={s.label} className="flex items-center justify-between">
                    <div>
                      <p className="metric-label" style={{ marginBottom: 2 }}>
                        {s.label}
                      </p>
                      <p className="muted" style={{ margin: 0 }}>
                        Demo strategy
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-100">{s.demo}</p>
                      <p className="muted">SPY {s.bench}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="muted" style={{ marginTop: "8px" }}>
                All numbers are from the demo backtest engine over the sample period shown.
              </p>
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
