import { useMemo } from "react";

const MethodologyDrawer = ({ open, onClose }) => {
  const sections = useMemo(
    () => [
      {
        id: "returns",
        title: "Returns & Annualization",
        body: "Returns are derived from the equity curve as pct change per period. Annualized return = (product of (1+r))^(periods per year / periods) - 1.",
      },
      {
        id: "vol",
        title: "Volatility",
        body: "Volatility is the standard deviation of periodic returns, scaled by sqrt(252) for daily series to annualize.",
      },
      {
        id: "ratios",
        title: "Sharpe / Sortino",
        body: "Sharpe = mean return / volatility (rf≈0). Sortino replaces volatility with downside deviation (std dev of negative returns).",
      },
      {
        id: "drawdown",
        title: "Drawdown",
        body: "Drawdowns track peak-to-trough declines of the equity curve; max drawdown is the minimum drawdown value observed.",
      },
      {
        id: "hit-rate",
        title: "Hit rate",
        body: "Hit rate is the percentage of periods with positive returns.",
      },
      {
        id: "heatmap",
        title: "Period Performance",
        body: "Monthly returns aggregate daily/period returns per calendar month; best/worst/avg and hit rate summarize those buckets.",
      },
      {
        id: "rolling",
        title: "Rolling statistics",
        body: "60-day rolling window for vol (annualized), Sharpe (rf≈0), and beta vs benchmark: beta = cov(port, bench)/var(bench) over the window.",
      },
      {
        id: "risk-concentration",
        title: "Risk & Concentration",
        body: "Weights normalized to 100%. Concentration uses HHI (sum of squared weights) and top 5 weight share; risk contributions based on weights × marginal contribution.",
      },
      {
        id: "scenarios",
        title: "Scenarios",
        body: "Shocks apply proportional (beta-adjusted when available) moves to the latest equity to approximate P&L and a pro-forma max drawdown. Linear approximation; ignores convexity.",
      },
    ],
    []
  );

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="section-header" style={{ marginBottom: "8px" }}>
          <h4 className="section-title">Methodology</h4>
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="simple-list" style={{ gap: "10px", display: "flex", flexDirection: "column" }}>
          {sections.map((s) => (
            <div key={s.id} id={s.id}>
              <p className="metric-label">{s.title}</p>
              <p className="muted" style={{ margin: "4px 0 0" }}>
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MethodologyDrawer;
