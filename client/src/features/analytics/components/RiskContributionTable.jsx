import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const formatPercent = (value) =>
  value == null ? "—" : `${(value * 100).toFixed(1)}%`;

const RiskContributionTable = ({ contributions }) => {
  if (!contributions || contributions.length === 0) {
    return <p className="muted">Not enough data to show risk contributions.</p>;
  }

  const top = [...contributions]
    .filter((c) => c.ticker)
    .sort((a, b) => (b.riskContribution ?? 0) - (a.riskContribution ?? 0))
    .slice(0, 8);

  return (
    <div className="analytics-grid">
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Weight</th>
              <th>Risk %</th>
              <th>Return %</th>
            </tr>
          </thead>
          <tbody>
            {top.map((row) => (
              <tr key={row.ticker}>
                <td>{row.ticker}</td>
                <td>{formatPercent(row.weight)}</td>
                <td>{formatPercent(row.riskContribution)}</td>
                <td>{formatPercent(row.returnContribution)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={top}>
            <XAxis dataKey="ticker" />
            <YAxis tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
            <Tooltip
              formatter={(v, name) =>
                name === "riskContribution" ? formatPercent(v) : formatPercent(v)
              }
              labelFormatter={(label) => label}
            />
            <Bar dataKey="riskContribution" name="Risk %" fill="#f97316" radius={[6, 6, 0, 0]} />
            <Bar dataKey="returnContribution" name="Return %" fill="#22c55e" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default RiskContributionTable;
