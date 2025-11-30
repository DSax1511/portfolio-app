import { useState, useMemo } from "react";

const formatPercent = (value) =>
  value == null ? "—" : `${(value * 100).toFixed(1)}%`;

const ScenarioPanel = ({ scenarios, runScenario, loading, error, summaryMaxDrawdown }) => {
  const [customShock, setCustomShock] = useState(-0.1);
  const customResult = useMemo(() => {
    if (!runScenario) return null;
    return runScenario(customShock);
  }, [customShock, runScenario]);

  const presetRows = (scenarios || []).map((s) => {
    let label = s.label;
    if (!label) {
      if (s.shockPct <= -0.2) label = "Severe shock";
      else if (s.shockPct <= -0.1) label = "Standard pullback";
      else if (s.shockPct <= -0.05) label = "Mild correction";
    }
    return { ...s, label };
  });
  const rows = [
    ...presetRows,
    customResult
      ? { ...customResult, shockPct: customShock, label: "Custom" }
      : { shockPct: customShock, pnlPct: null, newEquity: null, maxDrawdownUnderShock: null, label: "Custom" },
  ];

  const interpretation = () => {
    if (!customResult) return null;
    const hist = summaryMaxDrawdown ?? 0;
    const shockDd = customResult.maxDrawdownUnderShock ?? 0;
    const compare =
      shockDd > hist ? "worse" : Math.abs(shockDd - hist) < 0.02 ? "similar to" : "less severe than";
    return `A ${formatPercent(customShock)} shock implies ~${formatPercent(customResult.pnlPct)} P&L and pro-forma max drawdown of ${formatPercent(shockDd)}, ${compare} historical max drawdown (${formatPercent(hist)}).`;
  };

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
          {interpretation() ||
            `Example: ${formatPercent(customShock)} shock implies ~${formatPercent(customResult?.pnlPct)} P&L and max drawdown near ${formatPercent(customResult?.maxDrawdownUnderShock)}.`}
        </p>
      )}
    </div>
  );
};

export default ScenarioPanel;
