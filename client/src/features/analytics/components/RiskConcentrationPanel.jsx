const formatPercent = (value) =>
  value == null ? "—" : `${(value * 100).toFixed(1)}%`;

const interpretHHI = (hhi) => {
  if (hhi == null) return "—";
  if (hhi > 0.25) return "Highly concentrated";
  if (hhi > 0.15) return "Moderately concentrated";
  return "Diversified";
};

const RiskConcentrationPanel = ({ concentration }) => {
  if (!concentration) {
    return <p className="muted">Not enough data for concentration metrics.</p>;
  }
  const { hhi, topNWeightPct, topNTickers } = concentration;
  return (
    <div className="stats-grid">
      <div className="stat-box">
        <p className="muted">Top 5 weight</p>
        <p>{formatPercent(topNWeightPct)}</p>
        <p className="muted" style={{ fontSize: "0.8rem" }}>
          {topNTickers && topNTickers.length > 0 ? topNTickers.join(", ") : "—"}
        </p>
      </div>
      <div className="stat-box">
        <p className="muted">HHI</p>
        <p>{hhi == null ? "—" : hhi.toFixed(3)}</p>
        <p className="muted" style={{ fontSize: "0.8rem" }}>{interpretHHI(hhi)}</p>
      </div>
    </div>
  );
};

export default RiskConcentrationPanel;
