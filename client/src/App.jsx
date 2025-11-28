import { useState, useMemo } from "react";
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
} from "recharts";
import "./App.css";

const COLORS = ["#4f46e5", "#22c55e", "#f97316", "#06b6d4", "#a855f7", "#e11d48"];

// Nice currency formatter reused everywhere
const formatCurrency = (n) =>
  n.toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });

function App() {
  const [portfolio, setPortfolio] = useState([]);
  const [positionsFile, setPositionsFile] = useState(null);
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("overview"); // "overview" | "positions" | "charts"

  const backendUrl = "http://127.0.0.1:8000";

  // ------- UPLOAD HANDLER (POSITIONS) -------

  const uploadPositions = async (e) => {
    e.preventDefault();
    if (!positionsFile) return;

    setPositionsLoading(true);
    const formData = new FormData();
    formData.append("file", positionsFile);

    try {
      const res = await fetch(`${backendUrl}/api/upload-positions`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        console.error("Positions upload failed:", await res.text());
        return;
      }
      const data = await res.json();
      setPortfolio(data);
    } catch (err) {
      console.error("Positions upload error:", err);
    } finally {
      setPositionsLoading(false);
    }
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

  // ------- UI -------

  return (
    <div className="app-root">
      {/* HEADER */}
      <header className="app-header">
        <div>
          <h1>My Portfolio Dashboard</h1>
          <p>
            Upload your latest positions CSV from your broker to see live metrics,
            breakdowns, and charts.
          </p>
        </div>

        <form onSubmit={uploadPositions} className="upload-form">
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <label style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
              Positions CSV (Symbol, Description, Qty, Cost Basis)
            </label>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setPositionsFile(e.target.files[0])}
              />
              <button type="submit" disabled={!positionsFile || positionsLoading}>
                {positionsLoading ? "Uploading..." : "Upload"}
              </button>
            </div>
          </div>
        </form>
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
          { id: "charts", label: "Charts" },
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
                  <p>${formatCurrency(totalValue)}</p>
                </div>
                <div className="metric-card">
                  <h3>Total P/L</h3>
                  <p className={totalPnL >= 0 ? "positive" : "negative"}>
                    ${formatCurrency(totalPnL)}
                  </p>
                </div>
                <div className="metric-card">
                  <h3>Total Return</h3>
                  <p
                    className={
                      Number(totalReturnPct) >= 0 ? "positive" : "negative"
                    }
                  >
                    {totalReturnPct}%
                  </p>
                </div>
                <div className="metric-card">
                  <h3>Winners / Losers</h3>
                  <p>
                    <span className="positive">{winners}</span> /{" "}
                    <span className="negative">{losers}</span>
                  </p>
                </div>
                <div className="metric-card">
                  <h3>Positions</h3>
                  <p>{positionsCount}</p>
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
                <h2>Top Positions</h2>
                {portfolio.length === 0 ? (
                  <p className="muted">Upload a positions file to see details.</p>
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
                          <th>Weight</th>
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
                                <td>{p.quantity.toFixed(2)}</td>
                                <td>${p.avg_cost.toFixed(2)}</td>
                                <td>${p.current_price.toFixed(2)}</td>
                                <td>${formatCurrency(p.market_value)}</td>
                                <td
                                  className={p.pnl >= 0 ? "positive" : "negative"}
                                >
                                  ${formatCurrency(p.pnl)}
                                </td>
                                <td>{weight}%</td>
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
                  <p className="muted">Upload positions to see this chart.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={valueByTicker}>
                      <XAxis dataKey="name" />
                      <YAxis
                        tickFormatter={(v) => `$${formatCurrency(v)}`}
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
                  <p className="muted">Upload positions to see this chart.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={valueByTicker}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={95}
                        labelLine={false}
                        label={({ name, percent }) =>
                          `${name} ${(percent * 100).toFixed(1)}%`
                        }
                      >
                        {valueByTicker.map((entry, index) => (
                          <Cell
                            key={`cell-${entry.name}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Legend />
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

        {/* CHARTS TAB ------------------------------------------------------- */}
        {activeTab === "charts" && (
          <section className="app-layout">
            <section className="left-column">
              <div className="card chart-card">
                <h2>Market Value by Ticker</h2>
                {valueByTicker.length === 0 ? (
                  <p className="muted">Upload positions to see this chart.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={valueByTicker}>
                      <XAxis dataKey="name" />
                      <YAxis
                        tickFormatter={(v) => `$${formatCurrency(v)}`}
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
            </section>
            <section className="right-column">
              <div className="card chart-card">
                <h2>Portfolio Allocation</h2>
                {valueByTicker.length === 0 ? (
                  <p className="muted">Upload positions to see this chart.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={valueByTicker}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={110}
                        labelLine={false}
                        label={({ name, percent }) =>
                          `${name} ${(percent * 100).toFixed(1)}%`
                        }
                      >
                        {valueByTicker.map((entry, index) => (
                          <Cell
                            key={`cell-${entry.name}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Legend />
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
      </main>
    </div>
  );
}

export default App;
