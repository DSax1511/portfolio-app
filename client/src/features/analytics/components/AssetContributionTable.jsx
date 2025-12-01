const formatPercent = (value) => {
  if (value == null || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(2)}%`;
};

const AssetContributionTable = ({ contributions }) => {
  if (!contributions || contributions.length === 0) {
    return <p className="muted">No asset contribution data available.</p>;
  }

  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            <th>Ticker</th>
            <th>Avg Weight</th>
            <th>Contribution to Return</th>
          </tr>
        </thead>
        <tbody>
          {contributions.map((item, idx) => (
            <tr key={`${item.ticker}-${idx}`}>
              <td className="ticker-cell">{item.ticker}</td>
              <td>{formatPercent(item.avg_weight)}</td>
              <td className={item.contribution_to_return >= 0 ? "positive" : "negative"}>
                {formatPercent(item.contribution_to_return)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AssetContributionTable;
