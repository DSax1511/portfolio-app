import { useState, useEffect } from "react";

const formatPercent = (value) =>
  value == null ? "—" : `${(value * 100).toFixed(1)}%`;

const ScenarioPanel = ({ scenarios, runScenario, loading, error }) => {
  const [customShock, setCustomShock] = useState(-0.1);
  const [customResult, setCustomResult] = useState(null);

  useEffect(() => {
    if (!runScenario) return;
    setCustomResult(runScenario(customShock));
  }, [customShock, runScenario]);

  const rows = [
    ...(scenarios || []),
    customResult
      ? { ...customResult, shockPct: customShock, label: "Custom" }
      : { shockPct: customShock, pnlPct: null, newEquity: null, maxDrawdownUnderShock: null, label: "Custom" },
  ];

  return (
    <div>
      <div className="analytics-grid" style={{ alignItems: "center", marginBottom: "1rem" }}>
        <div>
          <p className="muted">Custom shock (%)</p>
          <input
            type="range"
            min="-0.3"
            max="0.1"
            step="0.01"
            value={customShock}
            onChange={(e) => setCustomShock(Number(e.target.value))}
            style={{ width: "180px" }}
          />
          <p style={{ marginTop: "0.25rem" }}>{formatPercent(customShock)}</p>
        </div>
        {error && <p className="error-text">{error}</p>}
        {loading && <p className="muted">Loading scenarios...</p>}
      </div>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Scenario</th>
              <th>Shock</th>
              <th>Approx. P&amp;L</th>
              <th>Pro-forma Max DD</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx}>
                <td>{row.label || `${formatPercent(row.shockPct)}`}</td>
                <td>{formatPercent(row.shockPct)}</td>
                <td>{formatPercent(row.pnlPct)}</td>
                <td>{formatPercent(row.maxDrawdownUnderShock)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 0 && (
        <p className="muted" style={{ marginTop: "0.75rem" }}>
          Example: {formatPercent(-0.2)} shock implies ~{formatPercent(customResult?.pnlPct)} P&amp;L and
          max drawdown near {formatPercent(customResult?.maxDrawdownUnderShock)} (using beta-adjusted shock).
        </p>
      )}
    </div>
  );
};

export default ScenarioPanel;
