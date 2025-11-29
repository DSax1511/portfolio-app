const formatPercent = (value) => `${(value * 100).toFixed(2)}%`;

const TopDrawdownsTable = ({ drawdowns, limit = 5 }) => {
  if (!drawdowns || drawdowns.length === 0) {
    return <p className="muted">No drawdown history available.</p>;
  }

  const rows = drawdowns.slice(0, limit);

  return (
    <div className="table-wrapper" style={{ marginTop: "0.5rem" }}>
      <table>
        <thead>
          <tr>
            <th>Depth</th>
            <th>Start</th>
            <th>Trough</th>
            <th>Recovery</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={`${row.startDate}-${idx}`}>
              <td>{formatPercent(row.depth)}</td>
              <td>{row.startDate}</td>
              <td>{row.troughDate}</td>
              <td>{row.recoveryDate || "Not recovered"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TopDrawdownsTable;
