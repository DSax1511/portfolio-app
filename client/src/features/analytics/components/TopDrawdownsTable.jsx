const formatPercent = (value) => `${(value * 100).toFixed(2)}%`;

const TopDrawdownsTable = ({ topDrawdowns = [], limit = 5 }) => {
  if (!topDrawdowns || topDrawdowns.length === 0) {
    return <p className="muted">No drawdown history available.</p>;
  }

  const rows = topDrawdowns.slice(0, limit);

  return (
    <div className="table-wrapper" style={{ marginTop: "0.5rem" }}>
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Depth</th>
            <th>Start</th>
            <th>Trough</th>
            <th>Recovery</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={`${row.start || row.startDate}-${idx}`}>
              <td>{idx + 1}</td>
              <td>{formatPercent(row.depth)}</td>
              <td>{row.start || row.startDate}</td>
              <td>{row.trough || row.troughDate}</td>
              <td>{row.end || row.recoveryDate || "Not recovered"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TopDrawdownsTable;
