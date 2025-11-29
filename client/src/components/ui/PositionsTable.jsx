const PositionsTable = ({ portfolio, formatCurrency }) => {
  return (
    <div className="table-wrapper">
      <table className="compact-table">
        <thead>
          <tr>
            <th>Ticker</th>
            <th className="numeric">Quantity</th>
            <th className="numeric">Avg Cost</th>
            <th className="numeric">Current Price</th>
            <th className="numeric">Market Value</th>
            <th className="numeric">P/L</th>
            <th className="numeric">Return %</th>
          </tr>
        </thead>
        <tbody>
          {portfolio.length === 0
            ? Array.from({ length: 4 }).map((_, idx) => (
                <tr key={idx} className="muted">
                  <td>—</td>
                  <td className="numeric">—</td>
                  <td className="numeric">—</td>
                  <td className="numeric">—</td>
                  <td className="numeric">—</td>
                  <td className="numeric">—</td>
                  <td className="numeric">—</td>
                </tr>
              ))
            : portfolio.map((p) => {
                const invested = p.avg_cost * p.quantity;
                const retPct = invested > 0 ? ((p.pnl / invested) * 100).toFixed(2) : "0.00";
                return (
                  <tr key={p.ticker}>
                    <td>{p.ticker}</td>
                    <td className="numeric">{p.quantity.toFixed(2)}</td>
                    <td className="numeric">${p.avg_cost.toFixed(2)}</td>
                    <td className="numeric">${p.current_price.toFixed(2)}</td>
                    <td className="numeric">${formatCurrency(p.market_value)}</td>
                    <td className={`numeric ${p.pnl >= 0 ? "positive" : "negative"}`}>
                      ${formatCurrency(p.pnl)}
                    </td>
                    <td className={`numeric ${Number(retPct) >= 0 ? "positive" : "negative"}`}>
                      {retPct}%
                    </td>
                  </tr>
                );
              })}
        </tbody>
      </table>
    </div>
  );
};

export default PositionsTable;
