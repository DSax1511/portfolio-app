const PositionsTable = ({
  portfolio,
  formatCurrency,
  withWeights = false,
  withContribution = false,
  withSector = false,
  maxRows = null,
  dense = false,
  footerSummary = false,
}) => {
  const totalValue = portfolio.reduce((s, p) => s + (p.market_value || 0), 0);
  const totalPnl = portfolio.reduce((s, p) => s + (p.pnl || 0), 0);
  const rows = maxRows ? portfolio.slice(0, maxRows) : portfolio;

  return (
    <div className="table-wrapper">
      <table className={dense ? "compact-table dense" : "compact-table"}>
        <thead>
          <tr>
            <th>Ticker</th>
            <th className="numeric">Quantity</th>
            <th className="numeric">Avg Cost</th>
            <th className="numeric">Current Price</th>
            <th className="numeric">Market Value</th>
            <th className="numeric">P/L</th>
            <th className="numeric">Return %</th>
            {withWeights && <th className="numeric">Weight %</th>}
            {withContribution && <th className="numeric">P&L %</th>}
            {withSector && <th>Sector</th>}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0
            ? Array.from({ length: 4 }).map((_, idx) => (
                <tr key={idx} className="muted">
                  <td>—</td>
                  <td className="numeric">—</td>
                  <td className="numeric">—</td>
                  <td className="numeric">—</td>
                  <td className="numeric">—</td>
                  <td className="numeric">—</td>
                  <td className="numeric">—</td>
                  {withWeights && <td className="numeric">—</td>}
                  {withContribution && <td className="numeric">—</td>}
                  {withSector && <td>—</td>}
                </tr>
              ))
            : rows.map((p) => {
                const invested = p.avg_cost * p.quantity;
                const retPct = invested > 0 ? ((p.pnl / invested) * 100).toFixed(2) : "0.00";
                const weightPct = totalValue > 0 ? ((p.market_value || 0) / totalValue) * 100 : 0;
                const contribPct = totalPnl !== 0 ? ((p.pnl || 0) / totalPnl) * 100 : 0;
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
                    {withWeights && <td className="numeric">{weightPct.toFixed(1)}%</td>}
                    {withContribution && <td className="numeric">{contribPct.toFixed(1)}%</td>}
                    {withSector && <td>{p.sector || "—"}</td>}
                  </tr>
                );
              })}
          {footerSummary && rows.length > 0 && (
            <tr className="muted">
              <td colSpan={withSector ? 7 : 6}>Totals</td>
              {withWeights && <td className="numeric">~100%</td>}
              {withContribution && <td className="numeric">~100%</td>}
              {withSector && <td></td>}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default PositionsTable;
