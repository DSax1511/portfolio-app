import { useEffect, useMemo, useState } from "react";
import { portfolioApi } from "../../services/portfolioApi";
import { usePortfolioAnalytics } from "../../state/portfolioAnalytics";
import "./TaxHarvestPage.css";

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatCurrency = (value) => currencyFormatter.format(value);
const formatPercent = (value) => `${(value * 100).toFixed(0)}%`;

const TaxHarvestPage = () => {
  const { positions } = usePortfolioAnalytics();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [realizedGains, setRealizedGains] = useState(0);
  const [offsetPct, setOffsetPct] = useState(1);

  const validPositions = useMemo(
    () =>
      positions.filter((pos) => pos.quantity > 0 && pos.avg_cost > 0 && pos.current_price > 0),
    [positions]
  );

  const requestBody = useMemo(() => {
    return validPositions.map((pos) => ({
      ticker: pos.ticker,
      quantity: pos.quantity,
      cost_basis: pos.avg_cost * pos.quantity,
      current_price: pos.current_price,
      description: pos.description || null,
    }));
  }, [validPositions]);

  useEffect(() => {
    let active = true;

    if (!validPositions.length) {
      setResult(null);
      setLoading(false);
      setError(
        positions.length
          ? "Add cost-basis data to at least one position to unlock tax-loss harvesting insights."
          : "Import your portfolio to explore harvesting opportunities."
      );
      return undefined;
    }

    setLoading(true);
    setError("");

    portfolioApi
      .getTaxHarvest({
        positions: requestBody,
        realized_gains: realizedGains,
        offset_target_pct: offsetPct,
      })
      .then((res) => {
        if (!active) return;
        setResult(res);
      })
      .catch((err) => {
        if (!active) return;
        setResult(null);
        setError(err.message || "Unable to compute harvesting candidates.");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [requestBody, realizedGains, offsetPct, positions.length, validPositions.length]);

  const handleGainsChange = (value) => {
    const parsed = Number(value);
    setRealizedGains(Number.isNaN(parsed) ? 0 : Math.max(parsed, 0));
  };

  const handleOffsetChange = (value) => {
    const parsed = Number(value);
    setOffsetPct(Number.isNaN(parsed) ? 0 : Math.min(Math.max(parsed, 0), 1));
  };

  return (
    <div className="tax-harvest-page">
      <div className="page-header">
        <div>
          <h1>📉 Tax Harvest Opportunities</h1>
          <p>Identify where unrealized losses can help offset realized gains and support end-of-year planning.</p>
        </div>
        <div className="tax-controls">
          <div className="tax-control">
            <label>Realized gains to offset</label>
            <input
              type="number"
              min="0"
              value={realizedGains}
              onChange={(evt) => handleGainsChange(evt.target.value)}
              placeholder="0"
            />
          </div>
          <div className="tax-control">
            <label>Target % of realized gains</label>
            <div className="tax-range">
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={offsetPct}
                onChange={(evt) => handleOffsetChange(evt.target.value)}
              />
              <span>{formatPercent(offsetPct)}</span>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="tax-error">{error}</div>}
      {loading && <div className="tax-loading">Analyzing portfolio for harvestable losses…</div>}

      {result && (
        <>
          <div className="tax-harvest-summary">
            <div className="tax-stat-card">
              <div className="stat-label">Total loss pool</div>
              <div className="stat-value positive">{formatCurrency(result.summary.total_unrealized_loss)}</div>
              <div className="stat-meta">{result.summary.loss_positions} loss positions</div>
            </div>
            <div className="tax-stat-card">
              <div className="stat-label">Top candidate</div>
              <div className="stat-value positive">{formatCurrency(result.summary.top_loss)}</div>
              <div className="stat-meta">Largest single loss</div>
            </div>
            <div className="tax-stat-card">
              <div className="stat-label">Offset capacity</div>
              <div className="stat-value positive">{formatCurrency(result.summary.offset_capacity)}</div>
              <div className="stat-meta">
                {result.summary.gain_offset_target > 0
                  ? `${formatPercent(offsetPct)} of ${formatCurrency(result.summary.gain_offset_target)}`
                  : "No realized gains entered"}
              </div>
            </div>
          </div>

          <div className="card tax-candidates-card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Harvest candidates</h3>
                <p className="card-subtitle">Highest-loss tickers first; keep a watch for potential wash-sale replacements.</p>
              </div>
            </div>
            <div className="tax-table-wrapper">
              <table className="tax-harvest-table">
                <thead>
                  <tr>
                    <th>Ticker</th>
                    <th>Loss amount</th>
                    <th>Loss %</th>
                    <th>Suggestion</th>
                  </tr>
                </thead>
                <tbody>
                  {result.candidates.map((candidate) => (
                    <tr key={candidate.ticker}>
                      <td>
                        <div className="tax-ticker">{candidate.ticker}</div>
                        {candidate.description && <div className="tax-ticker-meta">{candidate.description}</div>}
                      </td>
                      <td>{formatCurrency(candidate.loss_amount)}</td>
                      <td>{formatPercent(candidate.loss_pct)}</td>
                      <td>{candidate.suggestion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card tax-notes-card">
            <div className="card-header">
              <h3 className="card-title">Notes</h3>
            </div>
            <ul className="tax-notes">
              {result.notes.map((note, idx) => (
                <li key={idx}>{note}</li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
};

export default TaxHarvestPage;
